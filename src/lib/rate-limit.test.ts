import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createTestDb, type TestDb } from '@/lib/db/testing';
import { rateLimits } from '@/lib/db/schema';

import { hitRateLimit, limitDefine, limitFeedback, nextUtcMidnight, purgeExpiredRateLimits, RATE_LIMITS } from './rate-limit';

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.truncateAll();
});

const T0 = new Date('2026-09-27T10:00:00Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

describe('hitRateLimit', () => {
  it('counts hits in a fixed window and blocks past the limit', async () => {
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await hitRateLimit({ key: 'k', limit: 3, window: { windowMs: 60_000 }, now: at(i * 1000), db: testDb.db }));
    }
    expect(results.map((r) => r.count)).toEqual([1, 2, 3, 4]);
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
    // The window started at the first hit and does not slide.
    expect(results[3].resetAt.toISOString()).toBe(at(60_000).toISOString());
    expect(results[3].retryAfterSeconds).toBe(57);
    expect(results[0].retryAfterSeconds).toBe(0);
  });

  it('starts a fresh window once the old one has expired', async () => {
    const opts = { key: 'k', limit: 1, window: { windowMs: 60_000 }, db: testDb.db };
    await hitRateLimit({ ...opts, now: at(0) });
    expect((await hitRateLimit({ ...opts, now: at(30_000) })).allowed).toBe(false);
    const fresh = await hitRateLimit({ ...opts, now: at(60_000) });
    expect(fresh).toMatchObject({ allowed: true, count: 1 });
    expect(fresh.resetAt.toISOString()).toBe(at(120_000).toISOString());
  });

  it('supports windows that end at a fixed instant', async () => {
    const result = await hitRateLimit({ key: 'daily', limit: 5, window: { resetAt: nextUtcMidnight(T0) }, now: T0, db: testDb.db });
    expect(result.resetAt.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  it('keeps keys independent', async () => {
    await hitRateLimit({ key: 'a', limit: 1, window: { windowMs: 60_000 }, now: T0, db: testDb.db });
    expect((await hitRateLimit({ key: 'b', limit: 1, window: { windowMs: 60_000 }, now: T0, db: testDb.db })).allowed).toBe(true);
  });

  it('loses no hits under concurrency (atomic upsert)', async () => {
    const hits = await Promise.all(
      Array.from({ length: 25 }, () => hitRateLimit({ key: 'burst', limit: 10, window: { windowMs: 60_000 }, now: T0, db: testDb.db })),
    );
    expect(hits.map((h) => h.count).sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(hits.filter((h) => h.allowed)).toHaveLength(10);
  });
});

describe('limitFeedback', () => {
  it('allows 60 per requester per day, then says why it refused', async () => {
    for (let i = 0; i < RATE_LIMITS.feedbackPerIpPerDay; i++) {
      expect(await limitFeedback('hash-a', { now: at(i), db: testDb.db, dailyCap: 1000 })).toEqual({ allowed: true });
    }
    const refused = await limitFeedback('hash-a', { now: at(100), db: testDb.db, dailyCap: 1000 });
    expect(refused).toMatchObject({ allowed: false, reason: 'ip' });
    expect(await limitFeedback('hash-b', { now: at(200), db: testDb.db, dailyCap: 1000 })).toEqual({ allowed: true });
  });

  it('enforces the global daily cap across requesters, resetting at UTC midnight', async () => {
    expect(await limitFeedback('a', { now: T0, db: testDb.db, dailyCap: 2 })).toEqual({ allowed: true });
    expect(await limitFeedback('b', { now: T0, db: testDb.db, dailyCap: 2 })).toEqual({ allowed: true });
    const capped = await limitFeedback('c', { now: T0, db: testDb.db, dailyCap: 2 });
    expect(capped).toMatchObject({ allowed: false, reason: 'global', retryAfterSeconds: 14 * 3600 });
    expect(await limitFeedback('c', { now: new Date('2026-09-28T00:00:01Z'), db: testDb.db, dailyCap: 2 })).toEqual({ allowed: true });
  });

  it('stores only hashed keys', async () => {
    await limitFeedback('0f'.repeat(32), { now: T0, db: testDb.db, dailyCap: 5 });
    const keys = (await testDb.db.select({ key: rateLimits.key }).from(rateLimits)).map((r) => r.key).sort();
    expect(keys).toEqual([`feedback:global:2026-09-27`, `feedback:ip:${'0f'.repeat(32)}`]);
  });

  it('fails closed when the limiter cannot run', async () => {
    const broken = await createTestDb();
    await broken.close();
    const original = console.error;
    console.error = () => {};
    try {
      expect(await limitFeedback('a', { now: T0, db: broken.db, dailyCap: 5 })).toMatchObject({ allowed: false, reason: 'unavailable' });
    } finally {
      console.error = original;
    }
  });
});

describe('limitDefine and cleanup', () => {
  it('allows 120 lookups a minute per requester', async () => {
    for (let i = 0; i < RATE_LIMITS.definePerIpPerMinute; i++) {
      expect((await limitDefine('x', { now: T0, db: testDb.db })).allowed).toBe(true);
    }
    expect(await limitDefine('x', { now: T0, db: testDb.db })).toMatchObject({ allowed: false, reason: 'ip', retryAfterSeconds: 60 });
    expect((await limitDefine('x', { now: at(60_000), db: testDb.db })).allowed).toBe(true);
  });

  it('purges expired keys only', async () => {
    await hitRateLimit({ key: 'old', limit: 1, window: { windowMs: 1000 }, now: T0, db: testDb.db });
    await hitRateLimit({ key: 'new', limit: 1, window: { windowMs: 3_600_000 }, now: T0, db: testDb.db });
    expect(await purgeExpiredRateLimits({ now: at(5000), db: testDb.db })).toBe(1);
    const keys = (await testDb.db.select({ key: rateLimits.key }).from(rateLimits)).map((r) => r.key);
    expect(keys).toEqual(['new']);
  });
});
