import 'server-only';

import path from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { migrationDatabaseUrl } from '@/lib/env';

export const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle');

/**
 * Wiege shares its production database with another Drizzle app, so its
 * migration history lives in its own schema (never `drizzle.__drizzle_migrations`).
 */
export const MIGRATIONS_SCHEMA = 'wiege';
export const MIGRATIONS_TABLE = '__wiege_migrations';

// A concurrent migrator (e.g. two instances booting at once) makes the loser
// fail with "already exists"; by the time it retries, the winner has committed.
const CONCURRENT_MIGRATION_SQLSTATES = new Set(['42P06', '42P07', '42710', '23505']);

function sqlState(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

async function migrateOnce(url: string, migrationsFolder: string): Promise<void> {
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {}, connect_timeout: 10 });
  try {
    await migrate(drizzle(client), { migrationsFolder, migrationsSchema: MIGRATIONS_SCHEMA, migrationsTable: MIGRATIONS_TABLE });
  } finally {
    await client.end({ timeout: 5 });
  }
}

/**
 * Applies pending drizzle migrations (idempotent). Uses `MIGRATION_DATABASE_URL`
 * when set (Supabase session pooler), else `DATABASE_URL`, else the local dev DB.
 */
export async function runMigrations(opts: { url?: string; migrationsFolder?: string } = {}): Promise<void> {
  const url = opts.url ?? migrationDatabaseUrl();
  const migrationsFolder = opts.migrationsFolder ?? MIGRATIONS_FOLDER;
  try {
    await migrateOnce(url, migrationsFolder);
  } catch (error) {
    const state = sqlState(error);
    if (!state || !CONCURRENT_MIGRATION_SQLSTATES.has(state)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await migrateOnce(url, migrationsFolder);
  }
}

/**
 * One-line description of a database error including its causes (Drizzle wraps
 * driver errors as "Failed query: ..."), e.g. for CLI output. First lines only,
 * so query parameters are never echoed.
 */
export function describeDatabaseError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    const message = current instanceof Error ? current.message : String(current);
    const firstLine = message.split('\n')[0].trim();
    const code = typeof current === 'object' && current !== null ? (current as { code?: unknown }).code : undefined;
    if (firstLine) parts.push(typeof code === 'string' && !firstLine.includes(code) ? `${firstLine} (${code})` : firstLine);
    current = typeof current === 'object' && current !== null ? (current as { cause?: unknown }).cause : undefined;
  }
  return parts.join(' <- ') || 'unknown error';
}

/** Removes credentials from a connection string so it can be logged. */
export function redactDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '(unparseable database URL)';
  }
}
