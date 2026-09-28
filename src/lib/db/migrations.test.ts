import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MIGRATIONS_SCHEMA, MIGRATIONS_TABLE } from './migrate';
import { createTestDb, type TestDb } from './testing';

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const TABLES = ['__wiege_migrations', 'articles', 'definitions', 'ingest_runs', 'lessons', 'rate_limits', 'sources'];

describe('migrations on PGlite', () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
  });

  afterAll(async () => {
    await testDb.close();
  });

  it('creates every table in the wiege schema with RLS enabled', async () => {
    const { rows } = await testDb.client.query<{ tablename: string; rowsecurity: boolean }>(
      "select tablename, rowsecurity from pg_tables where schemaname = 'wiege' order by tablename",
    );
    expect(rows.map((r) => r.tablename)).toEqual(TABLES);
    expect(rows.every((r) => r.rowsecurity)).toBe(true);
  });

  it('keeps the migration history inside wiege, never in the shared drizzle schema', async () => {
    const history = await testDb.client.query<{ n: number }>(`select count(*)::int as n from ${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}`);
    expect(history.rows[0].n).toBe(2);
    const drizzleSchema = await testDb.client.query("select 1 from information_schema.schemata where schema_name = 'drizzle'");
    expect(drizzleSchema.rows).toHaveLength(0);
    const publicTables = await testDb.client.query("select 1 from pg_tables where schemaname = 'public'");
    expect(publicTables.rows).toHaveLength(0);
  });

  it('is idempotent when applied again', async () => {
    await migrate(testDb.db as Parameters<typeof migrate>[0], {
      migrationsFolder: MIGRATIONS_FOLDER,
      migrationsSchema: MIGRATIONS_SCHEMA,
      migrationsTable: MIGRATIONS_TABLE,
    });
    const history = await testDb.client.query<{ n: number }>(`select count(*)::int as n from wiege.${MIGRATIONS_TABLE}`);
    expect(history.rows[0].n).toBe(2);
  });

  it('enforces the check constraints and the single-running-ingest lock', async () => {
    await expect(
      testDb.client.query("insert into wiege.sources (id, name, feed_url, homepage, category) values ('x', 'X', 'https://x/feed', 'https://x', 'politics')"),
    ).rejects.toThrow(/sources_category_check/);
    await testDb.client.query("insert into wiege.ingest_runs (id, trigger) values ('r1', 'cli')");
    await expect(testDb.client.query("insert into wiege.ingest_runs (id, trigger) values ('r2', 'cron')")).rejects.toThrow(
      /ingest_runs_single_running_idx/,
    );
    await testDb.client.query("update wiege.ingest_runs set status = 'ok' where id = 'r1'");
    await testDb.client.query("insert into wiege.ingest_runs (id, trigger) values ('r2', 'cron')");
  });
});

describe('Supabase hardening on a database that has the API roles', () => {
  it('revokes everything on wiege from anon and authenticated, on a pre-existing schema', async () => {
    const client = new PGlite();
    try {
      // Simulate Supabase: API roles exist and were granted access to the (pre-created) schema.
      await client.exec(`
        create role anon nologin;
        create role authenticated nologin;
        create schema wiege;
        grant usage on schema wiege to anon, authenticated;
        alter default privileges in schema wiege grant all on tables to anon, authenticated;
      `);
      await migrate(drizzle(client), {
        migrationsFolder: MIGRATIONS_FOLDER,
        migrationsSchema: MIGRATIONS_SCHEMA,
        migrationsTable: MIGRATIONS_TABLE,
      });
      const { rows } = await client.query<{ role: string; usage: boolean; select_articles: boolean; insert_limits: boolean }>(`
        select r as role,
               has_schema_privilege(r, 'wiege', 'USAGE') as usage,
               has_table_privilege(r, 'wiege.articles', 'SELECT') as select_articles,
               has_table_privilege(r, 'wiege.rate_limits', 'INSERT') as insert_limits
        from unnest(array['anon', 'authenticated']) as r
      `);
      expect(rows).toEqual([
        { role: 'anon', usage: false, select_articles: false, insert_limits: false },
        { role: 'authenticated', usage: false, select_articles: false, insert_limits: false },
      ]);
    } finally {
      await client.close();
    }
  });
});
