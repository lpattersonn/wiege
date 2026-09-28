import './load-env';

import { z } from 'zod';

import { closeDb } from '@/lib/db';
import { describeDatabaseError } from '@/lib/db/migrate';
import { runIngest } from '@/lib/news/ingest';

/**
 * `npm run ingest`: one full ingest run (SPEC §5) with no time limit, e.g.
 * from GitHub Actions. Pages are not revalidated from here (no Next.js
 * server); POST `/api/cron/ingest?revalidateOnly=1` afterwards, or let ISR
 * refresh them within 10 minutes.
 *
 *   npm run ingest                      # unlimited budget
 *   npm run ingest -- --budget 20000    # stop starting lessons after 20 s
 *   npm run ingest -- --json            # print the run stats as JSON
 */

const USAGE = 'Usage: npm run ingest [-- --budget <milliseconds>] [--json]';

const ArgsSchema = z.object({
  budgetMs: z.coerce.number().int().positive().optional(),
  json: z.boolean(),
});

function parseArgs(argv: string[]): z.infer<typeof ArgsSchema> {
  let budget: string | undefined;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') json = true;
    else if (arg === '--budget') budget = argv[++i];
    else if (arg.startsWith('--budget=')) budget = arg.slice('--budget='.length);
    else throw new Error(`Unknown argument "${arg}". ${USAGE}`);
  }
  const parsed = ArgsSchema.safeParse({ budgetMs: budget, json });
  if (!parsed.success) throw new Error(`--budget must be a positive whole number of milliseconds. ${USAGE}`);
  return parsed.data;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await runIngest({ trigger: 'cli', budgetMs: args.budgetMs });
  if (args.json) console.log(JSON.stringify(result, null, 2));
  if (result.status === 'skipped') console.log('[ingest] another run is in progress; nothing to do');
  if (result.status === 'failed') process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(`[ingest] failed: ${describeDatabaseError(error)}`);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
