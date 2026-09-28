#!/usr/bin/env node
// Local development Postgres 17 (no Docker) via the embedded-postgres binaries.
//
//   node scripts/dev/db.mjs start [--if-local]   initialise once, start detached, create db "wiege"
//   node scripts/dev/db.mjs status                exit 0 when accepting connections, 1 otherwise
//   node scripts/dev/db.mjs stop                  fast shutdown (no-op when stopped)
//   node scripts/dev/db.mjs reset                 stop, delete ./data/postgres, start fresh
//
// The server is started with the bundled pg_ctl, which detaches it into its own
// session, so it keeps running after this script exits (logs: ./data/postgres.log).
// Every command is idempotent. `--if-local` skips everything when DATABASE_URL
// points somewhere other than this local server (e.g. a Supabase dev project).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { arch, platform } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import postgres from 'postgres';

const ROOT = process.cwd();
const DATA_ROOT = path.join(ROOT, 'data');
const DATA_DIR = path.join(DATA_ROOT, 'postgres');
const LOG_FILE = path.join(DATA_ROOT, 'postgres.log');
const PORT = 54329;
const USER = 'postgres';
const PASSWORD = 'postgres';
const DATABASE = 'wiege';

const log = (message) => console.log(`[db] ${message}`);

async function binaries() {
  const os = platform() === 'win32' ? 'windows' : platform();
  const pkg = `@embedded-postgres/${os}-${arch()}`;
  try {
    return await import(pkg);
  } catch {
    throw new Error(`No embedded Postgres binaries for ${platform()}-${arch()} (${pkg} is not installed).`);
  }
}

function adminUrl(database) {
  return `postgres://${USER}:${PASSWORD}@localhost:${PORT}/${database}`;
}

async function canConnect() {
  const sql = postgres(adminUrl('postgres'), { max: 1, connect_timeout: 3, onnotice: () => {} });
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

function isInitialised() {
  return existsSync(path.join(DATA_DIR, 'PG_VERSION'));
}

function pgCtl(pgCtlPath, args) {
  return spawnSync(pgCtlPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function isRunning(pgCtlPath) {
  if (!isInitialised()) return false;
  // pg_ctl status: 0 = running, 3 = not running, 4 = no accessible data directory.
  return pgCtl(pgCtlPath, ['status', '-D', DATA_DIR]).status === 0;
}

function logTail(lines = 20) {
  try {
    return readFileSync(LOG_FILE, 'utf8').trim().split('\n').slice(-lines).join('\n');
  } catch {
    return '(no log yet)';
  }
}

async function initialise() {
  log(`initialising a new cluster in ${path.relative(ROOT, DATA_DIR)} ...`);
  mkdirSync(DATA_ROOT, { recursive: true });
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const output = [];
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: PORT,
    user: USER,
    password: PASSWORD,
    authMethod: 'scram-sha-256',
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: (message) => output.push(String(message)),
    onError: (error) => output.push(String(error)),
  });
  try {
    await pg.initialise();
  } catch (error) {
    console.error(output.join(''));
    throw error;
  }
}

async function ensureDatabase() {
  const sql = postgres(adminUrl('postgres'), { max: 1, connect_timeout: 5, onnotice: () => {} });
  try {
    const rows = await sql`select 1 from pg_database where datname = ${DATABASE}`;
    if (rows.length === 0) {
      await sql.unsafe(`create database "${DATABASE}"`);
      log(`created database "${DATABASE}"`);
    }
  } finally {
    await sql.end({ timeout: 2 });
  }
}

async function waitUntilAccepting(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canConnect()) return true;
    await sleep(250);
  }
  return false;
}

async function start() {
  const { pg_ctl: pgCtlPath } = await binaries();
  if (!isInitialised()) await initialise();

  if (isRunning(pgCtlPath)) {
    if (!(await waitUntilAccepting(5_000))) {
      throw new Error(`Postgres is running but not accepting connections on port ${PORT}. Log:\n${logTail()}`);
    }
  } else {
    if (await canConnect()) {
      throw new Error(`Port ${PORT} is already used by another Postgres server. Stop it, then run this again.`);
    }
    log(`starting Postgres on port ${PORT} ...`);
    const result = pgCtl(pgCtlPath, [
      'start',
      '-D',
      DATA_DIR,
      '-l',
      LOG_FILE,
      '-w',
      '-t',
      '30',
      '-o',
      `-p ${PORT} -c listen_addresses=localhost`,
    ]);
    if (result.status !== 0 || !(await waitUntilAccepting())) {
      throw new Error(`Postgres did not start.\n${result.stderr || result.stdout}\nLog:\n${logTail()}`);
    }
  }

  await ensureDatabase();
  log(`ready: ${adminUrl(DATABASE).replace(`:${PASSWORD}@`, ':***@')}`);
}

async function stop() {
  const { pg_ctl: pgCtlPath } = await binaries();
  if (!isRunning(pgCtlPath)) {
    log('not running');
    return;
  }
  const result = pgCtl(pgCtlPath, ['stop', '-D', DATA_DIR, '-m', 'fast', '-w', '-t', '30']);
  if (result.status !== 0) throw new Error(`pg_ctl stop failed:\n${result.stderr || result.stdout}`);
  log('stopped');
}

async function status() {
  const { pg_ctl: pgCtlPath } = await binaries();
  if (!isInitialised()) {
    log('not initialised (run: npm run db:start)');
    return 1;
  }
  if (!isRunning(pgCtlPath)) {
    log('stopped');
    return 1;
  }
  if (!(await canConnect())) {
    log('running but not accepting connections yet');
    return 1;
  }
  log(`accepting connections on port ${PORT}`);
  return 0;
}

async function reset() {
  await stop();
  rmSync(DATA_DIR, { recursive: true, force: true });
  log(`deleted ${path.relative(ROOT, DATA_DIR)}`);
  await start();
  log('run "npm run db:migrate && npm run db:seed" (or "npm run setup") to recreate the schema');
}

/** True when DATABASE_URL (from the environment or .env files) targets another server. */
function usesRemoteDatabase() {
  const mode = process.env.NODE_ENV ?? 'development';
  const files = [`.env.${mode}.local`, ...(mode === 'test' ? [] : ['.env.local']), `.env.${mode}`, '.env'];
  for (const file of files) {
    try {
      process.loadEnvFile(path.join(ROOT, file));
    } catch {
      // Missing file: nothing to load.
    }
  }
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  try {
    const { hostname, port } = new URL(url);
    return !(['localhost', '127.0.0.1', '::1'].includes(hostname) && Number(port) === PORT);
  } catch {
    return false;
  }
}

async function main() {
  const [command, ...flags] = process.argv.slice(2);
  switch (command) {
    case 'start':
      if (flags.includes('--if-local') && usesRemoteDatabase()) {
        log('DATABASE_URL points to another server; not starting the local database');
        return 0;
      }
      await start();
      return 0;
    case 'stop':
      await stop();
      return 0;
    case 'status':
      return status();
    case 'reset':
      await reset();
      return 0;
    default:
      console.error('Usage: node scripts/dev/db.mjs start [--if-local] | stop | status | reset');
      return 2;
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`[db] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  },
);
