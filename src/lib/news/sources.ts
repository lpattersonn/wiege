import 'server-only';

import { asc, eq, sql } from 'drizzle-orm';

import { getDb, type Database } from '@/lib/db';
import { sources, type SourceRow } from '@/lib/db/schema';

import { FEEDS, getFeed, type FeedDefinition } from './feeds';
import type { FeedValidators } from './fetch';

/**
 * `wiege.sources` mirrors the curated list in `feeds.ts`. The code list is the
 * allowlist; the `enabled` column is the operator's switch
 * (`npm run sources -- disable <id>`), which syncing never overrides.
 */

/** Upserts the curated feeds from `feeds.ts` into `wiege.sources` (idempotent). */
export async function syncSources(db: Database = getDb()): Promise<{ upserted: number }> {
  const rows = await db
    .insert(sources)
    .values(
      FEEDS.map((feed) => ({
        id: feed.id,
        name: feed.name,
        feedUrl: feed.feedUrl,
        homepage: feed.homepage,
        category: feed.category,
      })),
    )
    .onConflictDoUpdate({
      target: sources.id,
      set: {
        name: sql`excluded.name`,
        feedUrl: sql`excluded.feed_url`,
        homepage: sql`excluded.homepage`,
        category: sql`excluded.category`,
      },
    })
    .returning({ id: sources.id });
  return { upserted: rows.length };
}

export interface SourceListing extends SourceRow {
  /** Listed in `feeds.ts`; rows that are not (e.g. the practice source) are never fetched. */
  curated: boolean;
}

export async function listSources(db: Database = getDb()): Promise<SourceListing[]> {
  const rows = await db.select().from(sources).orderBy(asc(sources.category), asc(sources.id));
  return rows.map((row) => ({ ...row, curated: getFeed(row.id) !== undefined }));
}

/** Enables or disables a source. False when no such source exists. */
export async function setSourceEnabled(id: string, enabled: boolean, db: Database = getDb()): Promise<boolean> {
  const rows = await db.update(sources).set({ enabled }).where(eq(sources.id, id)).returning({ id: sources.id });
  return rows.length > 0;
}

export interface ActiveFeed {
  feed: FeedDefinition;
  validators: FeedValidators;
}

/** Curated feeds whose source row is enabled. */
export async function activeFeeds(db: Database): Promise<ActiveFeed[]> {
  const rows = await db.select().from(sources).where(eq(sources.enabled, true)).orderBy(asc(sources.id));
  const active: ActiveFeed[] = [];
  for (const row of rows) {
    const feed = getFeed(row.id);
    if (feed) active.push({ feed, validators: { etag: row.etag, lastModified: row.lastModified } });
  }
  return active;
}

/**
 * Records a fetch attempt. `validators` undefined keeps the stored ones,
 * null clears them (forces a full fetch next time).
 */
export async function recordSourceFetch(
  db: Database,
  id: string,
  update: { at: Date; error: string | null; validators?: FeedValidators | null },
): Promise<void> {
  const validators =
    update.validators === undefined
      ? {}
      : { etag: update.validators?.etag ?? null, lastModified: update.validators?.lastModified ?? null };
  await db
    .update(sources)
    .set({ lastFetchedAt: update.at, lastError: update.error, ...validators })
    .where(eq(sources.id, id));
}
