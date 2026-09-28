import './load-env';

import postgres from 'postgres';

import { closeDb } from '@/lib/db';
import { describeDatabaseError, redactDatabaseUrl, runMigrations } from '@/lib/db/migrate';
import { migrationDatabaseUrl } from '@/lib/env';
import { seedPracticeStories } from '@/lib/literacy/seed';
import { syncSources } from '@/lib/news/sources';

/**
 * `npm run db:seed`: migrate, then upsert the curated sources and the practice
 * stories (idempotent). With `--prebuild` (the `prebuild` npm hook) it is allowed
 * to skip when no database is reachable, but only if WIEGE_SKIP_DB_PREBUILD=1;
 * otherwise an unreachable database fails the build, because static pages read
 * the database at build time.
 */

const isPrebuild = process.argv.includes('--prebuild');
const skipAllowed = process.env.WIEGE_SKIP_DB_PREBUILD === '1';

async function probe(url: string): Promise<boolean> {
  const sql = postgres(url, { max: 1, connect_timeout: 5, prepare: false, onnotice: () => {} });
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

async function main(): Promise<void> {
  let url: string;
  try {
    url = migrationDatabaseUrl();
  } catch (error) {
    if (isPrebuild && skipAllowed) {
      console.warn(`[seed] skipped: ${error instanceof Error ? error.message : String(error)} (WIEGE_SKIP_DB_PREBUILD=1)`);
      return;
    }
    throw error;
  }

  if (isPrebuild && skipAllowed && !(await probe(url))) {
    console.warn(`[seed] skipped: no database reachable at ${redactDatabaseUrl(url)} (WIEGE_SKIP_DB_PREBUILD=1)`);
    return;
  }

  const started = Date.now();
  console.log(`[seed] migrating ${redactDatabaseUrl(url)}`);
  await runMigrations({ url });

  const sources = await syncSources();
  console.log(`[seed] sources upserted: ${sources.upserted}`);
  const practice = await seedPracticeStories();
  console.log(`[seed] practice stories inserted: ${practice.inserted}, updated: ${practice.updated}`);
  console.log(`[seed] done (${Date.now() - started} ms)`);
}

main()
  .catch((error: unknown) => {
    console.error(`[seed] failed: ${describeDatabaseError(error)}`);
    if (isPrebuild) {
      console.error('[seed] Start the local database with "npm run db:start", set DATABASE_URL, or set WIEGE_SKIP_DB_PREBUILD=1 to build without one.');
    }
    process.exitCode = 1;
  })
  .finally(() => closeDb());
