import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { describe, expect, it } from 'vitest';

import { isDatabaseUnavailableError } from './index';
import { createTestDb } from './testing';

describe('isDatabaseUnavailableError', () => {
  it('recognises a refused connection (through Drizzle’s error wrapper)', async () => {
    const client = postgres('postgres://postgres:postgres@127.0.0.1:1/wiege', { max: 1, connect_timeout: 2, onnotice: () => {} });
    const error = await drizzle(client)
      .execute(sql`select 1`)
      .then(() => null, (e: unknown) => e);
    await client.end({ timeout: 1 });
    expect(error).not.toBeNull();
    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

  it('recognises a database that has not been migrated', async () => {
    const testDb = await createTestDb();
    try {
      const error = await testDb.db.execute(sql`select * from wiege.nope`).then(() => null, (e: unknown) => e);
      expect(isDatabaseUnavailableError(error)).toBe(true);
    } finally {
      await testDb.close();
    }
  });

  it('does not swallow real query bugs', async () => {
    const testDb = await createTestDb();
    try {
      const error = await testDb.db.execute(sql`select 1/0`).then(() => null, (e: unknown) => e);
      expect(isDatabaseUnavailableError(error)).toBe(false);
      expect(isDatabaseUnavailableError(new Error('x'))).toBe(false);
      expect(isDatabaseUnavailableError(null)).toBe(false);
    } finally {
      await testDb.close();
    }
  });
});
