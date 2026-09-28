import 'server-only';

import { lt, sql } from 'drizzle-orm';

import { getDb, isDatabaseUnavailableError, type Database } from '@/lib/db';
import { rateLimits } from '@/lib/db/schema';
import { getEnv } from '@/lib/env';

/**
 * Database-backed fixed-window rate limiter (works across serverless instances)
 * plus the app's policies (SPEC §6, §8). Keys hold salted IP hashes, never raw
 * IPs, and expire; `purgeExpiredRateLimits()` deletes old keys.
 */

export const RATE_LIMITS = {
  /** Schools share one IP, so this is generous. */
  feedbackPerIpPerDay: 60,
  definePerIpPerMinute: 120,
} as const;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export type RateLimitWindow =
  /** The window starts at the first hit and lasts `windowMs`. */
  | { windowMs: number }
  /** The window ends at a fixed instant (e.g. the next UTC midnight for daily caps). */
  | { resetAt: Date };

export interface RateLimitResult {
  allowed: boolean;
  /** Hits in the current window, including this one. */
  count: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  /** Seconds until the window resets when not allowed (for `Retry-After`), else 0. */
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  window: RateLimitWindow;
  now?: Date;
  db?: Database;
}

/**
 * Counts one hit against `key` in a single atomic upsert: a new or expired key
 * starts a fresh window at 1, otherwise the count is incremented. Concurrent
 * hits serialise on the row lock, so no hit is lost.
 */
export async function hitRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const db = opts.db ?? getDb();
  const now = opts.now ?? new Date();
  const freshReset = 'windowMs' in opts.window ? new Date(now.getTime() + opts.window.windowMs) : opts.window.resetAt;
  const nowSql = sql`${now.toISOString()}::timestamptz`;
  const expired = sql`${rateLimits.resetAt} <= ${nowSql}`;

  const [row] = await db
    .insert(rateLimits)
    .values({ key: opts.key, count: 1, resetAt: freshReset })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${expired} then ${freshReset.toISOString()}::timestamptz else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });

  const allowed = row.count <= opts.limit;
  return {
    allowed,
    count: row.count,
    limit: opts.limit,
    remaining: Math.max(0, opts.limit - row.count),
    resetAt: row.resetAt,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000)),
  };
}

export function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export type LimitDecision =
  | { allowed: true }
  | { allowed: false; reason: 'ip' | 'global' | 'unavailable'; retryAfterSeconds: number };

interface PolicyOptions {
  now?: Date;
  db?: Database;
}

/**
 * AI writing feedback: per requester (IP hash) per day, then the global daily
 * cap (`WIEGE_FEEDBACK_DAILY_CAP`). Call it only when a Claude call will
 * actually be made. Fails closed: if the limiter cannot run, no AI call is made
 * and the client shows its offline feedback instead.
 */
export async function limitFeedback(ipHash: string, opts: PolicyOptions & { dailyCap?: number } = {}): Promise<LimitDecision> {
  const now = opts.now ?? new Date();
  try {
    const perIp = await hitRateLimit({
      key: `feedback:ip:${ipHash}`,
      limit: RATE_LIMITS.feedbackPerIpPerDay,
      window: { windowMs: DAY_MS },
      now,
      db: opts.db,
    });
    if (!perIp.allowed) return { allowed: false, reason: 'ip', retryAfterSeconds: perIp.retryAfterSeconds };

    const global = await hitRateLimit({
      key: `feedback:global:${now.toISOString().slice(0, 10)}`,
      limit: opts.dailyCap ?? getEnv().WIEGE_FEEDBACK_DAILY_CAP,
      window: { resetAt: nextUtcMidnight(now) },
      now,
      db: opts.db,
    });
    if (!global.allowed) return { allowed: false, reason: 'global', retryAfterSeconds: global.retryAfterSeconds };
    return { allowed: true };
  } catch (error) {
    console.error('[rate-limit] feedback limiter failed; denying AI feedback', error);
    return { allowed: false, reason: 'unavailable', retryAfterSeconds: 60 };
  }
}

/**
 * Dictionary lookups: per requester per minute. Fails open when the database is
 * unreachable (lookups are cheap and CDN-cached); other errors propagate.
 */
export async function limitDefine(ipHash: string, opts: PolicyOptions = {}): Promise<LimitDecision> {
  try {
    const result = await hitRateLimit({
      key: `define:ip:${ipHash}`,
      limit: RATE_LIMITS.definePerIpPerMinute,
      window: { windowMs: MINUTE_MS },
      now: opts.now,
      db: opts.db,
    });
    return result.allowed ? { allowed: true } : { allowed: false, reason: 'ip', retryAfterSeconds: result.retryAfterSeconds };
  } catch (error) {
    if (isDatabaseUnavailableError(error)) return { allowed: true };
    throw error;
  }
}

/** Deletes keys whose window ended before `now`; returns how many. Run it from the ingest cleanup step. */
export async function purgeExpiredRateLimits(opts: PolicyOptions = {}): Promise<number> {
  const db = opts.db ?? getDb();
  const now = opts.now ?? new Date();
  const deleted = await db.delete(rateLimits).where(lt(rateLimits.resetAt, now)).returning({ key: rateLimits.key });
  return deleted.length;
}
