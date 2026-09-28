import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import { isServerlessEnvironment } from '@/lib/env';

/**
 * Pure helpers for `/api/cron/ingest` and the schedulers: who may trigger an
 * ingest, which host we run on, and how much time a triggered run gets.
 */

type EnvSource = Record<string, string | undefined>;

/** See `isServerlessEnvironment` in lib/env.ts (one definition for the whole app). */
export function isServerlessRuntime(env: EnvSource = process.env): boolean {
  return isServerlessEnvironment(env);
}

export const DEFAULT_CRON_BUDGET_MS = 20_000;

const BudgetSchema = z.coerce.number().int().positive();

/**
 * Budget for a cron-triggered run: `WIEGE_INGEST_BUDGET_MS` when set,
 * otherwise 20 s on serverless hosts and unlimited (undefined) elsewhere.
 */
export function cronBudgetMs(env: EnvSource = process.env): number | undefined {
  const explicit = env.WIEGE_INGEST_BUDGET_MS?.trim();
  if (explicit) {
    const parsed = BudgetSchema.safeParse(explicit);
    if (parsed.success) return parsed.data;
  }
  return isServerlessRuntime(env) ? DEFAULT_CRON_BUDGET_MS : undefined;
}

/** Constant-time string comparison (hashing first hides the length). */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '');
  return match ? match[1] : null;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isLoopbackAddress(value: string): boolean {
  const host = value.trim().toLowerCase().replace(/^::ffff:/, '');
  return LOOPBACK_HOSTS.has(host) || host.startsWith('127.');
}

/** A request addressed to this machine and not relayed through a proxy for someone else. */
export function isLoopbackRequest(request: { url: string; headers: Headers }): boolean {
  let hostname: string;
  try {
    hostname = new URL(request.url).hostname;
  } catch {
    return false;
  }
  if (!isLoopbackAddress(hostname)) return false;
  const forwarded = request.headers.get('x-forwarded-for');
  return !forwarded || forwarded.split(',').every(isLoopbackAddress);
}

export type CronAuthorization =
  | { ok: true; via: 'secret' | 'development-localhost' }
  | { ok: false; reason: 'not-configured' | 'unauthorized' };

/**
 * Bearer `CRON_SECRET` (constant-time compare). Without a valid token, only
 * a localhost request in development is allowed.
 */
export function authorizeCronRequest(
  request: { url: string; headers: Headers },
  opts: { secret: string | undefined; nodeEnv: string | undefined },
): CronAuthorization {
  const token = bearerToken(request.headers.get('authorization'));
  if (opts.secret && token && secretsMatch(token, opts.secret)) return { ok: true, via: 'secret' };
  if (opts.nodeEnv === 'development' && isLoopbackRequest(request)) return { ok: true, via: 'development-localhost' };
  return { ok: false, reason: opts.secret ? 'unauthorized' : 'not-configured' };
}

const CronQuerySchema = z.object({
  revalidateOnly: z
    .enum(['1', 'true', '0', 'false'])
    .optional()
    .transform((value) => value === '1' || value === 'true'),
});
export type CronQuery = z.infer<typeof CronQuerySchema>;

/** Validated query string; null when it is malformed. Unknown parameters are ignored. */
export function parseCronQuery(searchParams: URLSearchParams): CronQuery | null {
  const parsed = CronQuerySchema.safeParse({ revalidateOnly: searchParams.get('revalidateOnly') ?? undefined });
  return parsed.success ? parsed.data : null;
}
