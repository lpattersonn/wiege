import 'server-only';

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres, { type Sql } from 'postgres';

import { databaseUrl } from '@/lib/env';
import * as schema from './schema';

export { schema };

/**
 * Driver-agnostic database type. Production uses postgres.js; unit tests use
 * PGlite (`createTestDb()`), and both satisfy this type. Stick to the query
 * builder (`select/insert/update/delete ... returning()`); raw `execute()`
 * results differ in shape between drivers.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

interface DbHandle {
  client: Sql;
  db: PostgresJsDatabase<typeof schema>;
}

// Survives Next.js dev HMR, which re-evaluates modules but keeps globalThis.
const globalForDb = globalThis as typeof globalThis & { __wiegeDb?: DbHandle };

function createHandle(url: string): DbHandle {
  const client = postgres(url, {
    // Required for Supabase's transaction pooler (port 6543), which cannot keep prepared statements.
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  return { client, db: drizzle(client, { schema }) };
}

/** The shared app database (lazy singleton). */
export function getDb(): Database {
  globalForDb.__wiegeDb ??= createHandle(databaseUrl());
  return globalForDb.__wiegeDb.db;
}

/** Closes the pool so CLI scripts can exit. Safe to call when nothing is open. */
export async function closeDb(): Promise<void> {
  const handle = globalForDb.__wiegeDb;
  if (!handle) return;
  globalForDb.__wiegeDb = undefined;
  await handle.client.end({ timeout: 5 });
}

const UNAVAILABLE_NODE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
]);

// SQLSTATEs meaning "the database exists but is not ready for us": missing
// database / schema / table (migrations not applied) or the server is starting up / shutting down.
const UNAVAILABLE_SQLSTATES = new Set(['3D000', '3F000', '42P01', '57P01', '57P02', '57P03', '53300', '08000', '08001', '08006']);

/**
 * True when `error` (or anything in its `cause` chain, which is where Drizzle
 * puts driver errors) means the database cannot be reached or is not migrated.
 * Read paths use this to render honest empty states instead of crashing.
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (typeof current === 'object' && current !== null) {
      const code = (current as { code?: unknown }).code;
      if (typeof code === 'string' && (UNAVAILABLE_NODE_CODES.has(code) || UNAVAILABLE_SQLSTATES.has(code))) {
        return true;
      }
      if (current instanceof AggregateError && current.errors.some((e) => isDatabaseUnavailableError(e))) {
        return true;
      }
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  return false;
}
