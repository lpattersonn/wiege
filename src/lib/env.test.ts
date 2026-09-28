import { describe, expect, it } from 'vitest';

import {
  autoMigrateOnBoot,
  databaseUrl,
  isServerlessEnvironment,
  isServerlessHost,
  LOCAL_DATABASE_URL,
  migrationDatabaseUrl,
  parseEnv,
} from './env';

describe('parseEnv', () => {
  it('applies defaults in development', () => {
    const env = parseEnv({});
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      WIEGE_AI_MODEL: 'claude-opus-5',
      WIEGE_FEEDBACK_DAILY_CAP: 2000,
      WIEGE_SCHEDULER: true,
      WIEGE_SITE_URL: 'http://localhost:3000',
    });
    expect(databaseUrl(env)).toBe(LOCAL_DATABASE_URL);
    expect(migrationDatabaseUrl(env)).toBe(LOCAL_DATABASE_URL);
    // No default: cron runs are budgeted only on serverless hosts unless this is set (lib/news/cron.ts).
    expect(env.WIEGE_INGEST_BUDGET_MS).toBeUndefined();
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
    expect(env.WIEGE_AUTO_MIGRATE).toBeUndefined();
    expect(autoMigrateOnBoot(env)).toBe(true);
  });

  it('migrates on boot on long-lived servers only, unless told otherwise', () => {
    expect(autoMigrateOnBoot(parseEnv({ AWS_LAMBDA_FUNCTION_NAME: 'fn' }))).toBe(false);
    expect(autoMigrateOnBoot(parseEnv({ NETLIFY: 'true', WIEGE_AUTO_MIGRATE: '1' }))).toBe(true);
    expect(autoMigrateOnBoot(parseEnv({ WIEGE_AUTO_MIGRATE: '0' }))).toBe(false);
  });

  it('parses an explicit ingest budget and rejects nonsense', () => {
    expect(parseEnv({ WIEGE_INGEST_BUDGET_MS: '15000' }).WIEGE_INGEST_BUDGET_MS).toBe(15_000);
    expect(parseEnv({ WIEGE_INGEST_BUDGET_MS: '' }).WIEGE_INGEST_BUDGET_MS).toBeUndefined();
    expect(() => parseEnv({ WIEGE_INGEST_BUDGET_MS: 'soon' })).toThrow(/WIEGE_INGEST_BUDGET_MS/);
  });

  it('recognises serverless hosts, including Netlify functions that only carry Lambda markers at runtime', () => {
    expect(isServerlessEnvironment({})).toBe(false);
    expect(isServerlessEnvironment({ NETLIFY: 'true' })).toBe(true);
    expect(isServerlessEnvironment({ VERCEL: '1' })).toBe(true);
    expect(isServerlessEnvironment({ AWS_LAMBDA_FUNCTION_NAME: '___netlify-server-handler' })).toBe(true);
    expect(isServerlessEnvironment({ LAMBDA_TASK_ROOT: '/var/task' })).toBe(true);
    expect(isServerlessHost(parseEnv({ AWS_LAMBDA_FUNCTION_NAME: 'fn' }))).toBe(true);
    expect(isServerlessHost(parseEnv({ NETLIFY: '' }))).toBe(false);
  });

  it('treats empty strings as unset and parses flags and numbers', () => {
    const env = parseEnv({
      DATABASE_URL: '',
      ANTHROPIC_API_KEY: '',
      WIEGE_SCHEDULER: '0',
      WIEGE_AUTO_MIGRATE: 'false',
      WIEGE_FEEDBACK_DAILY_CAP: '50',
      WIEGE_SITE_URL: 'https://wiege.example/',
    });
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.WIEGE_SCHEDULER).toBe(false);
    expect(env.WIEGE_AUTO_MIGRATE).toBe(false);
    expect(env.WIEGE_FEEDBACK_DAILY_CAP).toBe(50);
    expect(env.WIEGE_SITE_URL).toBe('https://wiege.example');
  });

  it('prefers the migration URL for migrations', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgresql://app:pw@db.example:6543/postgres',
      MIGRATION_DATABASE_URL: 'postgresql://app:pw@db.example:5432/postgres',
    });
    expect(databaseUrl(env)).toContain(':6543/');
    expect(migrationDatabaseUrl(env)).toContain(':5432/');
  });

  it('requires DATABASE_URL in production instead of silently using the local database', () => {
    const env = parseEnv({ NODE_ENV: 'production' });
    expect(() => databaseUrl(env)).toThrow(/DATABASE_URL is not set/);
  });

  it('lists every invalid variable in one error, without echoing values', () => {
    let message = '';
    try {
      parseEnv({ DATABASE_URL: 'mysql://x', WIEGE_IP_SALT: 'short', WIEGE_SITE_URL: 'ftp://x', WIEGE_SCHEDULER: 'maybe' });
    } catch (error) {
      message = String(error);
    }
    for (const name of ['DATABASE_URL', 'WIEGE_IP_SALT', 'WIEGE_SITE_URL', 'WIEGE_SCHEDULER']) expect(message).toContain(name);
    expect(message).not.toContain('mysql://x');
  });
});
