import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

import type { Database } from './index';
import { MIGRATIONS_SCHEMA, MIGRATIONS_TABLE } from './migrate';
import * as schema from './schema';

/**
 * Test-only helper: an in-memory PGlite database with every migration applied,
 * so unit tests exercise the real schema, constraints and RLS migration without a
 * server. Create one per test file (startup takes ~1 s) and `truncateAll()`
 * between tests.
 */

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../../drizzle', import.meta.url));

export interface TestDb {
  db: Database;
  client: PGlite;
  /** Empties every `wiege` table (keeps the schema). */
  truncateAll(): Promise<void>;
  close(): Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER, migrationsSchema: MIGRATIONS_SCHEMA, migrationsTable: MIGRATIONS_TABLE });
  return {
    db,
    client,
    async truncateAll() {
      await db.execute(
        sql.raw(
          'truncate table wiege.lessons, wiege.articles, wiege.sources, wiege.definitions, wiege.ingest_runs, wiege.rate_limits cascade',
        ),
      );
    },
    async close() {
      await client.close();
    },
  };
}
