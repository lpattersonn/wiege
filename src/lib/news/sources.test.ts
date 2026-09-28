import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { sources } from '@/lib/db/schema';
import { createTestDb, type TestDb } from '@/lib/db/testing';

import { FEEDS } from './feeds';
import { activeFeeds, listSources, recordSourceFetch, setSourceEnabled, syncSources } from './sources';

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

describe('sources', () => {
  it('syncs the curated list idempotently', async () => {
    expect(await syncSources(testDb.db)).toEqual({ upserted: FEEDS.length });
    expect(await syncSources(testDb.db)).toEqual({ upserted: FEEDS.length });
    const rows = await listSources(testDb.db);
    expect(rows).toHaveLength(FEEDS.length);
    expect(rows.every((row) => row.curated && row.enabled)).toBe(true);
  });

  it('updates names and URLs but never overrides the operator switch', async () => {
    await syncSources(testDb.db);
    await testDb.db.update(sources).set({ name: 'Old name' }).where(eq(sources.id, 'espn'));
    expect(await setSourceEnabled('espn', false, testDb.db)).toBe(true);
    await syncSources(testDb.db);
    const [espn] = await testDb.db.select().from(sources).where(eq(sources.id, 'espn'));
    expect(espn).toMatchObject({ name: 'ESPN', enabled: false });
  });

  it('reports unknown ids when toggling', async () => {
    expect(await setSourceEnabled('nope', true, testDb.db)).toBe(false);
  });

  it('only fetches enabled, curated sources', async () => {
    await syncSources(testDb.db);
    await setSourceEnabled('bbc-sport', false, testDb.db);
    await testDb.db.insert(sources).values({
      id: 'wiege-practice',
      name: 'Wiege practice',
      feedUrl: 'https://wiege.invalid/practice',
      homepage: 'https://wiege.invalid',
      category: 'writing',
    });
    const ids = (await activeFeeds(testDb.db)).map((active) => active.feed.id);
    expect(ids).not.toContain('bbc-sport');
    expect(ids).not.toContain('wiege-practice');
    expect(ids).toHaveLength(FEEDS.length - 1);
    expect((await listSources(testDb.db)).find((row) => row.id === 'wiege-practice')?.curated).toBe(false);
  });

  it('records fetches, keeping, replacing or clearing validators', async () => {
    await syncSources(testDb.db);
    const at = new Date('2026-09-27T10:00:00Z');
    const read = async () => (await testDb.db.select().from(sources).where(eq(sources.id, 'colossal')))[0];

    await recordSourceFetch(testDb.db, 'colossal', { at, error: null, validators: { etag: '"a"', lastModified: 'yesterday' } });
    expect(await read()).toMatchObject({ etag: '"a"', lastModified: 'yesterday', lastError: null });

    await recordSourceFetch(testDb.db, 'colossal', { at, error: 'HTTP 503' });
    expect(await read()).toMatchObject({ etag: '"a"', lastError: 'HTTP 503' });

    await recordSourceFetch(testDb.db, 'colossal', { at, error: null, validators: null });
    expect(await read()).toMatchObject({ etag: null, lastModified: null, lastError: null });
    expect((await read()).lastFetchedAt?.toISOString()).toBe(at.toISOString());
  });
});
