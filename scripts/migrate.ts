import './load-env';

import { migrationDatabaseUrl } from '@/lib/env';
import { describeDatabaseError, redactDatabaseUrl, runMigrations } from '@/lib/db/migrate';

async function main(): Promise<void> {
  const url = migrationDatabaseUrl();
  console.log(`[migrate] applying migrations to ${redactDatabaseUrl(url)}`);
  const started = Date.now();
  await runMigrations({ url });
  console.log(`[migrate] up to date (${Date.now() - started} ms)`);
}

main().catch((error: unknown) => {
  console.error(`[migrate] failed: ${describeDatabaseError(error)}`);
  process.exitCode = 1;
});
