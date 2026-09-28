/**
 * Runs once when a Next.js server instance starts (SPEC §3, §5):
 * 1. validates the environment (a misconfigured deployment fails fast),
 * 2. applies pending migrations on long-lived servers (not on serverless
 *    hosts, whose build already migrated) unless `WIEGE_AUTO_MIGRATE` says otherwise,
 * 3. starts the 4-hourly news scheduler unless `WIEGE_SCHEDULER=0` or the
 *    host is serverless (Netlify, Vercel), which schedules on its own.
 *
 * Everything is imported lazily inside the Node.js branch so nothing
 * Node-only reaches another runtime.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const { autoMigrateOnBoot, getEnv } = await import('./lib/env');
  const env = getEnv();

  if (autoMigrateOnBoot(env)) await migrateOnBoot();

  const { schedulerDisabledReason, startScheduler } = await import('./lib/news/scheduler');
  const reason = schedulerDisabledReason(env.WIEGE_SCHEDULER);
  if (reason) console.info(`[wiege] news scheduler off: ${reason}`);
  else startScheduler();
}

/**
 * Migrations failing must not take the site down: pages render honest empty
 * states without a database, and the error is logged for the operator.
 */
async function migrateOnBoot(): Promise<void> {
  const [{ existsSync }, path, { MIGRATIONS_FOLDER, describeDatabaseError, runMigrations }] = await Promise.all([
    import('node:fs'),
    import('node:path'),
    import('./lib/db/migrate'),
  ]);
  if (!existsSync(path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json'))) {
    console.warn(`[wiege] no migrations found at ${MIGRATIONS_FOLDER}; skipping boot migrations (they run in prebuild)`);
    return;
  }
  try {
    await runMigrations();
    console.info('[wiege] database migrations are up to date');
  } catch (error) {
    console.error(`[wiege] migrations on boot failed: ${describeDatabaseError(error)}`);
  }
}
