import './load-env';

import { closeDb } from '@/lib/db';
import { describeDatabaseError } from '@/lib/db/migrate';
import { listSources, setSourceEnabled, syncSources } from '@/lib/news/sources';
import { timeAgo } from '@/lib/time';

/**
 * `npm run sources -- <command>`: manage news sources without an admin UI.
 *
 *   list            every source with its state and last fetch
 *   enable <id>     include a curated source in ingestion again
 *   disable <id>    stop fetching a source (kept across syncs and deploys)
 *   sync            upsert the curated list from src/lib/news/feeds.ts
 */

const USAGE = 'Usage: npm run sources -- list | enable <id> | disable <id> | sync';

async function list(): Promise<void> {
  const rows = await listSources();
  if (rows.length === 0) {
    console.log('No sources yet. Run "npm run sources -- sync" (or "npm run db:seed").');
    return;
  }
  const now = Date.now();
  const table = rows.map((row) => ({
    id: row.id,
    category: row.category,
    enabled: row.enabled ? 'yes' : 'no',
    curated: row.curated ? 'yes' : 'no (never fetched)',
    'last fetched': row.lastFetchedAt ? timeAgo(row.lastFetchedAt.getTime(), now) : 'never',
    'last error': row.lastError ?? '',
  }));
  console.table(table);
}

async function toggle(id: string | undefined, enabled: boolean): Promise<void> {
  if (!id) throw new Error(USAGE);
  const found = await setSourceEnabled(id, enabled);
  if (!found) {
    console.error(`No source with id "${id}". Run "npm run sources -- list" to see the ids.`);
    process.exitCode = 1;
    return;
  }
  console.log(`${id} is now ${enabled ? 'enabled' : 'disabled'}.`);
}

async function main(): Promise<void> {
  const [command, id] = process.argv.slice(2);
  switch (command) {
    case 'list':
    case undefined:
      return list();
    case 'enable':
      return toggle(id, true);
    case 'disable':
      return toggle(id, false);
    case 'sync': {
      const { upserted } = await syncSources();
      console.log(`Upserted ${upserted} curated sources.`);
      return;
    }
    default:
      throw new Error(USAGE);
  }
}

main()
  .catch((error: unknown) => {
    console.error(`[sources] ${describeDatabaseError(error)}`);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
