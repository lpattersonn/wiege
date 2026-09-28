import 'server-only';

import { randomBytes } from 'node:crypto';
import { z } from 'zod';

/**
 * Typed, validated environment (SPEC §12). Validation is lazy (first call) so
 * importing a module never throws during `next build`; `instrumentation.ts`
 * calls `getEnv()` at boot to fail fast on a misconfigured deployment.
 */

export const LOCAL_DATABASE_URL = 'postgres://postgres:postgres@localhost:54329/wiege';
export const DEFAULT_SITE_URL = 'http://localhost:3000';
export const DEFAULT_AI_MODEL = 'claude-opus-5';

/** Unset, empty and whitespace-only variables are all treated as "not provided". */
const optionalString = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().min(1).optional(),
);

const postgresUrl = z
  .string()
  .trim()
  .refine((value) => /^postgres(ql)?:\/\//.test(value), 'must start with postgres:// or postgresql://');

const optionalPostgresUrl = z.preprocess((v) => (v === '' ? undefined : v), postgresUrl.optional());

const flag = (fallback: boolean) =>
  z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : String(v).trim().toLowerCase()),
    z
      .enum(['1', '0', 'true', 'false', 'on', 'off', 'yes', 'no'])
      .optional()
      .transform((v) => (v === undefined ? fallback : ['1', 'true', 'on', 'yes'].includes(v))),
  );

/** A flag with no default: undefined when unset, so the caller can pick a host-dependent default. */
const optionalFlag = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : String(v).trim().toLowerCase()),
  z
    .enum(['1', '0', 'true', 'false', 'on', 'off', 'yes', 'no'])
    .optional()
    .transform((v) => (v === undefined ? undefined : ['1', 'true', 'on', 'yes'].includes(v))),
);

const positiveInt = (fallback: number) =>
  z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.coerce.number().int().positive().default(fallback));

const optionalPositiveInt = z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().positive().optional());

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: optionalPostgresUrl,
  MIGRATION_DATABASE_URL: optionalPostgresUrl,
  ANTHROPIC_API_KEY: optionalString,
  /** Alternative to an API key (e.g. an OAuth token from `ant auth`). */
  ANTHROPIC_AUTH_TOKEN: optionalString,
  WIEGE_AI_MODEL: optionalString.transform((v) => v ?? DEFAULT_AI_MODEL),
  WIEGE_FEEDBACK_DAILY_CAP: positiveInt(2000),
  /**
   * Budget for cron-triggered ingest runs. Unset: 20 s on serverless hosts,
   * unlimited elsewhere (see `cronBudgetMs` in lib/news/cron.ts).
   */
  WIEGE_INGEST_BUDGET_MS: optionalPositiveInt,
  WIEGE_IP_SALT: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(16, 'use at least 16 characters').optional()),
  CRON_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(16, 'use at least 16 characters').optional()),
  WIEGE_SCHEDULER: flag(true),
  /** Unset: on for long-lived servers, off on serverless hosts (see `autoMigrateOnBoot`). */
  WIEGE_AUTO_MIGRATE: optionalFlag,
  WIEGE_SITE_URL: z.preprocess(
    (v) => (v === '' || v === undefined ? DEFAULT_SITE_URL : v),
    z.url({ protocol: /^https?$/ }).transform((v) => v.replace(/\/+$/, '')),
  ),
  WIEGE_CONTACT_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.email().optional()),
  NETLIFY: optionalString,
  VERCEL: optionalString,
  AWS_LAMBDA_FUNCTION_NAME: optionalString,
  LAMBDA_TASK_ROOT: optionalString,
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** Parses `source` (default `process.env`); throws one readable error listing every problem. */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    throw new Error(`Invalid environment variables:\n${lines.join('\n')}`);
  }
  return result.data;
}

export function getEnv(): Env {
  cached ??= parseEnv();
  return cached;
}

/** Test hook: forget the cached environment so the next `getEnv()` re-reads it. */
export function resetEnvCache(): void {
  cached = null;
  ephemeralSalt = null;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}

/** App connection string: `DATABASE_URL`, or the local embedded Postgres outside production. */
export function databaseUrl(env: Env = getEnv()): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is not set. Set it to the Supabase transaction pooler URL (port 6543).');
  }
  return LOCAL_DATABASE_URL;
}

/** Migration connection string: a session connection when provided (Supabase port 5432). */
export function migrationDatabaseUrl(env: Env = getEnv()): string {
  return env.MIGRATION_DATABASE_URL ?? databaseUrl(env);
}

export function siteUrl(): string {
  return getEnv().WIEGE_SITE_URL;
}

let ephemeralSalt: string | null = null;

/**
 * Salt for hashing client IPs. Without `WIEGE_IP_SALT` a random per-process salt
 * is used: hashes stay unlinkable to IPs, but per-IP limits only hold within one
 * server instance, so production logs a loud warning once.
 */
export function ipSalt(): string {
  const env = getEnv();
  if (env.WIEGE_IP_SALT) return env.WIEGE_IP_SALT;
  if (!ephemeralSalt) {
    ephemeralSalt = randomBytes(32).toString('hex');
    if (env.NODE_ENV === 'production') {
      console.error('[wiege] WIEGE_IP_SALT is not set; using a random per-instance salt. Set it to a long random string.');
    }
  }
  return ephemeralSalt;
}

/**
 * True where a server instance lives only for a request, so an in-process
 * timer cannot run and requests have hard time limits. Netlify exposes
 * `NETLIFY` only at build time; its functions (and Vercel's) run on Lambda,
 * which sets the Lambda markers. Takes raw variables so pure helpers can use it.
 */
export function isServerlessEnvironment(source: Record<string, string | undefined> = process.env): boolean {
  return Boolean(source.NETLIFY || source.VERCEL || source.AWS_LAMBDA_FUNCTION_NAME || source.LAMBDA_TASK_ROOT);
}

/** `isServerlessEnvironment` for the validated environment. */
export function isServerlessHost(env: Env = getEnv()): boolean {
  return isServerlessEnvironment({
    NETLIFY: env.NETLIFY,
    VERCEL: env.VERCEL,
    AWS_LAMBDA_FUNCTION_NAME: env.AWS_LAMBDA_FUNCTION_NAME,
    LAMBDA_TASK_ROOT: env.LAMBDA_TASK_ROOT,
  });
}

/**
 * Whether `instrumentation.ts` applies migrations when a server boots. An
 * explicit `WIEGE_AUTO_MIGRATE` wins. Otherwise long-lived servers migrate on
 * boot, while serverless hosts do not: every cold start would open a session
 * connection and run the migrator's DDL checks, and their build (`prebuild`)
 * has already migrated.
 */
export function autoMigrateOnBoot(env: Env = getEnv()): boolean {
  return env.WIEGE_AUTO_MIGRATE ?? !isServerlessHost(env);
}
