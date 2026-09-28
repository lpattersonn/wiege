import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { articles, ingestRuns, lessons, sources } from '@/lib/db/schema';
import { createTestDb, type TestDb } from '@/lib/db/testing';
import type { GenerateLessonOptions, LessonSourceInput } from '@/lib/literacy/generate';
import type { LessonContent } from '@/lib/literacy/types';

import type { ClassifiableItem, ClassificationOutcome } from './classify';
import { getFeed } from './feeds';
import { FetchError, type FeedFetchResult, type FeedValidators } from './fetch';
import { PER_CATEGORY_INTAKE, runIngestWith, selectForIntake, dedupeCandidates, type IngestDeps, type IngestStats } from './ingest';
import type { CandidateItem } from './parse';

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.close();
});

const NOW = new Date('2026-09-27T12:00:00Z');
const HOUR = 60 * 60 * 1000;

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), 'utf8');
const feedUrl = (id: string) => getFeed(id)!.feedUrl;

interface FeedItemSpec {
  title: string;
  path: string;
  hoursAgo: number;
  description?: string;
}

function rss(host: string, items: FeedItemSpec[]): string {
  const entries = items
    .map(
      (item) => `<item><title><![CDATA[${item.title}]]></title><link>https://${host}${item.path}</link>
        <description><![CDATA[${item.description ?? `${item.title}: a calm and friendly story written for this test feed.`}]]></description>
        <pubDate>${new Date(NOW.getTime() - item.hoursAgo * HOUR).toUTCString()}</pubDate></item>`,
    )
    .join('\n');
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title>${entries}</channel></rss>`;
}

const EMPTY_FEED = '<?xml version="1.0"?><rss version="2.0"><channel><title>Empty</title></channel></rss>';

function lessonFor(input: LessonSourceInput, paragraph = `${input.title}. ${input.excerpt}`): LessonContent {
  return {
    keyIdea: `What happened: ${input.title}`,
    levels: {
      '7-8': { title: input.title, paragraphs: [paragraph] },
      '9-10': { title: input.title, paragraphs: [paragraph] },
    },
    vocabulary: ['calm', 'friendly', 'written', 'story', 'feed'].map((word) => ({
      word,
      partOfSpeech: 'adjective',
      definition: `the meaning of ${word}`,
      example: `A ${word} example.`,
      band: 'both' as const,
    })),
    quiz: Array.from({ length: 5 }, (_, i) => ({
      id: `q${i + 1}`,
      skill: 'detail' as const,
      question: `Question ${i + 1}?`,
      choices: ['One', 'Two', 'Three', 'Four'],
      answerIndex: 1,
      explanation: 'Because the story says so.',
    })),
    writingPrompts: Array.from({ length: 3 }, (_, i) => ({
      id: `p${i + 1}`,
      kind: 'summary' as const,
      prompt: 'Summarise the story.',
      minWords: 40,
      maxWords: 90,
      tips: ['Start with the main idea.'],
    })),
    discussion: ['What did you learn?', 'What would you do?'],
  };
}

interface Harness {
  deps: IngestDeps;
  lessonOptions: GenerateLessonOptions[];
  feeds: Map<string, () => FeedFetchResult>;
  classifyCalls: ClassifiableItem[][];
  lessonCalls: LessonSourceInput[];
  articleFetches: string[];
  fetchValidators: Map<string, FeedValidators>;
  logs: string[];
  advance(ms: number): void;
  nowMs(): number;
}

function harness(opts: {
  aiEnabled?: boolean;
  classify?: (items: ClassifiableItem[], timeoutMs: number) => ClassificationOutcome;
  lesson?: (input: LessonSourceInput) => LessonContent | Error | Promise<LessonContent | Error>;
  lessonMs?: number;
} = {}): Harness {
  let clock = NOW.getTime();
  const feeds = new Map<string, () => FeedFetchResult>();
  const classifyCalls: ClassifiableItem[][] = [];
  const lessonCalls: LessonSourceInput[] = [];
  const lessonOptions: GenerateLessonOptions[] = [];
  const articleFetches: string[] = [];
  const fetchValidators = new Map<string, FeedValidators>();
  const logs: string[] = [];
  const log = (message: string) => void logs.push(message);
  const deps: IngestDeps = {
    db: testDb.db,
    now: () => new Date(clock),
    aiEnabled: opts.aiEnabled ?? false,
    fetchFeed: async (url, validators) => {
      fetchValidators.set(url, validators);
      const make = feeds.get(url);
      return make ? make() : { status: 'ok', body: EMPTY_FEED, validators: { etag: null, lastModified: null } };
    },
    fetchArticleText: async (url) => {
      articleFetches.push(url);
      return 'The full article text, used only as context.';
    },
    classify: async (items, timeoutMs) => {
      classifyCalls.push(items);
      if (opts.classify) return opts.classify(items, timeoutMs);
      return { kind: 'classified', refused: false, decisions: new Map(items.map((item) => [item.key, { safe: true, reasons: [] }])) };
    },
    generateLesson: async (input, lessonOpts) => {
      lessonCalls.push(input);
      lessonOptions.push(lessonOpts);
      clock += opts.lessonMs ?? 10;
      const result = opts.lesson ? await opts.lesson(input) : lessonFor(input);
      if (result instanceof Error) throw result;
      return { content: result, generator: 'heuristic', model: null, readingGrade: 7.4 };
    },
    log: { info: log, warn: log, error: log },
  };
  return {
    deps,
    lessonOptions,
    feeds,
    classifyCalls,
    lessonCalls,
    articleFetches,
    fetchValidators,
    logs,
    advance: (ms) => void (clock += ms),
    nowMs: () => clock,
  };
}

const ok = (body: string, etag: string | null = null): (() => FeedFetchResult) => () => ({
  status: 'ok',
  body,
  validators: { etag, lastModified: null },
});

const stats = (result: { stats: Record<string, unknown> }) => result.stats as IngestStats;

async function allArticles() {
  return testDb.db
    .select({ title: articles.title, status: articles.status, category: articles.category, sourceId: articles.sourceId, safety: articles.safety })
    .from(articles)
    .orderBy(asc(articles.title));
}

const byStatus = async (status: string) => (await allArticles()).filter((row) => row.status === status).map((row) => row.title);

beforeEach(async () => {
  await testDb.truncateAll();
});

describe('runIngestWith: the full pipeline', () => {
  it('stores safe items, rejects unsafe ones, publishes lessons and records the run', async () => {
    const h = harness();
    h.feeds.set(feedUrl('bbc-newsround'), ok(fixture('newsround.xml'), '"nr-1"'));
    h.feeds.set(feedUrl('colossal'), ok(fixture('wordpress.xml'), '"co-1"'));

    const result = await runIngestWith(h.deps, { trigger: 'cli' });

    expect(result.status).toBe('ok');
    const s = stats(result);
    expect(s).toMatchObject({ classifier: 'blocklist-only', new: 9, pending: 7, rejected: 2, ready: 7, failed: 0, backlog: 0, stoppedBy: 'done' });
    expect(await byStatus('rejected')).toEqual(['A Nude Figure Study Tops the Auction Charts', 'Two teenagers arrested after stabbing near football ground']);
    expect(await byStatus('ready')).toHaveLength(7);
    const rejected = (await allArticles()).find((row) => row.status === 'rejected')!;
    expect(rejected.safety).toMatchObject({ safe: false, method: 'blocklist' });
    expect(rejected.safety.reasons.length).toBeGreaterThan(0);

    expect(await testDb.db.select().from(lessons)).toHaveLength(7);
    const [run] = await testDb.db.select().from(ingestRuns);
    expect(run).toMatchObject({ id: result.runId, status: 'ok', trigger: 'cli', error: null });
    expect(run.stats).toMatchObject({ ready: 7 });

    const [colossal] = await testDb.db.select().from(sources).where(eq(sources.id, 'colossal'));
    expect(colossal).toMatchObject({ etag: '"co-1"', lastError: null });
    expect(colossal.lastFetchedAt).not.toBeNull();
    // Without Claude the article page is never fetched.
    expect(h.articleFetches).toEqual([]);
    expect(h.lessonCalls.find((call) => call.title.startsWith('Teen author'))).toMatchObject({ category: 'writing', sourceName: 'BBC Newsround' });
  });

  it('finds nothing new on the next run, and de-duplicates the same story under another URL', async () => {
    const h = harness();
    h.feeds.set(feedUrl('bbc-newsround'), ok(fixture('newsround.xml')));
    await runIngestWith(h.deps, { trigger: 'cli' });
    h.advance(HOUR);
    const syndicated = rss('www.bbc.co.uk', [
      {
        title: 'Lionesses name squad for autumn matches',
        path: '/sport/football/articles/syndicated',
        hoursAgo: 20,
        description: "England's women's football team have named three new players in their squad ahead of two friendly matches next month.",
      },
    ]);
    h.feeds.set(feedUrl('bbc-sport'), ok(syndicated));

    const second = await runIngestWith(h.deps, { trigger: 'cli' });

    expect(stats(second)).toMatchObject({ new: 0, pending: 0, rejected: 0 });
    expect(second.status).toBe('ok');
  });

  it('asks for the page only when the previous response is unchanged (conditional GET)', async () => {
    const h = harness();
    h.feeds.set(feedUrl('colossal'), ok(fixture('wordpress.xml'), '"v1"'));
    await runIngestWith(h.deps, { trigger: 'cli' });
    h.feeds.set(feedUrl('colossal'), () => ({ status: 'not-modified' }));

    const second = await runIngestWith(h.deps, { trigger: 'cli' });

    expect(h.fetchValidators.get(feedUrl('colossal'))).toEqual({ etag: '"v1"', lastModified: null });
    expect(stats(second).bySource.colossal.status).toBe('not-modified');
    const [row] = await testDb.db.select().from(sources).where(eq(sources.id, 'colossal'));
    expect(row.etag).toBe('"v1"');
  });
});

describe('runIngestWith: failures stay contained', () => {
  it('marks the run partial when some sources fail, and records their errors', async () => {
    const h = harness();
    h.feeds.set(feedUrl('colossal'), ok(fixture('wordpress.xml')));
    h.feeds.set(feedUrl('espn'), () => {
      throw new FetchError('timed out after 10000 ms', 'timeout');
    });
    h.feeds.set(feedUrl('pocket-gamer'), ok(fixture('malformed.xml')));

    const result = await runIngestWith(h.deps, { trigger: 'cron' });

    expect(result.status).toBe('partial');
    expect(stats(result)).toMatchObject({ sourceErrors: 2, ready: 3 });
    expect(stats(result).bySource.espn).toMatchObject({ status: 'error', error: 'timed out after 10000 ms' });
    const [espn] = await testDb.db.select().from(sources).where(eq(sources.id, 'espn'));
    expect(espn.lastError).toBe('timed out after 10000 ms');
    const [pocket] = await testDb.db.select().from(sources).where(eq(sources.id, 'pocket-gamer'));
    expect(pocket.lastError).toMatch(/could not parse feed/);
  });

  it('fails the run when every source fails', async () => {
    const h = harness();
    h.deps.fetchFeed = async () => {
      throw new FetchError('network error: offline', 'network');
    };
    const result = await runIngestWith(h.deps, { trigger: 'cron' });
    expect(result.status).toBe('failed');
    const [run] = await testDb.db.select().from(ingestRuns);
    expect(run.status).toBe('failed');
  });

  it('skips when another run holds the lock', async () => {
    await testDb.db.insert(ingestRuns).values({ id: 'busy', trigger: 'cli', status: 'running', startedAt: NOW });
    const h = harness();
    const result = await runIngestWith(h.deps, { trigger: 'cron' });
    expect(result).toEqual({ status: 'skipped', runId: null, stats: { trigger: 'cron', reason: 'another ingest run is in progress' } });
  });

  it('marks items whose lesson fails as failed, and rejects lessons that fail the safety re-scan', async () => {
    const h = harness({
      lesson: (input) => {
        if (input.title.startsWith('Paper Cut')) return new Error('model unavailable');
        if (input.title.startsWith('Only the Full')) return lessonFor(input, 'The artist celebrated with a beer afterwards.');
        if (input.title.startsWith('Fantastic')) return { ...lessonFor(input), quiz: [] };
        return lessonFor(input);
      },
    });
    h.feeds.set(feedUrl('colossal'), ok(fixture('wordpress.xml')));

    const result = await runIngestWith(h.deps, { trigger: 'cli' });

    expect(result.status).toBe('partial');
    expect(stats(result)).toMatchObject({ ready: 0, failed: 2, rejected: 2 });
    expect(await byStatus('failed')).toEqual(['Fantastic Plants Spring from an Illustrator’s Digital Drawings', 'Paper Cut Woodland Creatures Fill an Imaginary Forest']);
    const mural = (await allArticles()).find((row) => row.title.startsWith('Only the Full'))!;
    expect(mural.status).toBe('rejected');
    expect(mural.safety.reasons[0]).toMatch(/^lesson drugs-alcohol/);
    expect(await testDb.db.select().from(lessons)).toHaveLength(0);
  });

  it('stops enriching when its lock was taken over', async () => {
    let first = true;
    const h = harness({
      lesson: async (input) => {
        if (first) {
          first = false;
          // Another trigger decides this run is stale while it is still working.
          await testDb.db.update(ingestRuns).set({ status: 'failed' }).where(eq(ingestRuns.status, 'running'));
        }
        return lessonFor(input);
      },
      lessonMs: 50,
    });
    h.feeds.set(feedUrl('colossal'), ok(fixture('wordpress.xml')));

    const result = await runIngestWith(h.deps, { trigger: 'cli' });

    expect(stats(result).stoppedBy).toBe('lost-lock');
    expect(stats(result).backlog).toBeGreaterThan(0);
    expect(h.logs.some((line) => line.includes('marked stale'))).toBe(true);
  });
});

describe('runIngestWith: Claude safety review', () => {
  it('reviews all new items in one call and stores its verdicts', async () => {
    const h = harness({
      aiEnabled: true,
      classify: (items) => ({
        kind: 'classified',
        refused: false,
        decisions: new Map(
          items.map((item) => [
            item.key,
            item.title.startsWith('Paper Cut') ? { safe: false, reasons: ['frightening imagery'] } : { safe: true, reasons: [] },
          ]),
        ),
      }),
    });
    h.feeds.set(feedUrl('colossal'), ok(fixture('wordpress.xml')));
    h.feeds.set(feedUrl('bbc-newsround'), ok(fixture('newsround.xml')));

    const result = await runIngestWith(h.deps, { trigger: 'cli' });

    expect(h.classifyCalls).toHaveLength(1);
    // Blocklist rejects never reach the classifier.
    expect(h.classifyCalls[0].map((item) => item.title)).not.toContain('A Nude Figure Study Tops the Auction Charts');
    expect(h.classifyCalls[0]).toHaveLength(7);
    expect(stats(result)).toMatchObject({ classifier: 'claude', rejected: 3, ready: 6 });
    const paper = (await allArticles()).find((row) => row.title.startsWith('Paper Cut'))!;
    expect(paper).toMatchObject({ status: 'rejected', safety: { safe: false, reasons: ['frightening imagery'], method: 'claude' } });
    const ready = (await allArticles()).find((row) => row.status === 'ready')!;
    expect(ready.safety.method).toBe('claude');
    // With Claude on, the article text is fetched as context for the lesson.
    expect(h.articleFetches).toHaveLength(6);
    expect(h.lessonCalls.every((call) => call.fullText === 'The full article text, used only as context.')).toBe(true);
  });

  it('rejects the whole batch when the classifier refuses', async () => {
    const h = harness({
      aiEnabled: true,
      classify: (items) => ({
        kind: 'classified',
        refused: true,
        decisions: new Map(items.map((item) => [item.key, { safe: false, reasons: ['classifier declined to review this batch'] }])),
      }),
    });
    h.feeds.set(feedUrl('colossal'), ok(fixture('wordpress.xml')));

    const result = await runIngestWith(h.deps, { trigger: 'cli' });

    expect(stats(result)).toMatchObject({ classifier: 'claude-refused', pending: 0, ready: 0, rejected: 4 });
  });

  it('stores nothing when the review fails, clears validators, and retries next run', async () => {
    let fail = true;
    const h = harness({
      aiEnabled: true,
      classify: (items) =>
        fail
          ? { kind: 'deferred', reason: 'Claude request timed out' }
          : { kind: 'classified', refused: false, decisions: new Map(items.map((item) => [item.key, { safe: true, reasons: [] }])) },
    });
    h.feeds.set(feedUrl('colossal'), ok(fixture('wordpress.xml'), '"v1"'));

    const first = await runIngestWith(h.deps, { trigger: 'cli' });

    expect(first.status).toBe('partial');
    expect(stats(first)).toMatchObject({ classifier: 'deferred', classifierNote: 'Claude request timed out', pending: 0, deferred: 3, rejected: 1 });
    const [row] = await testDb.db.select().from(sources).where(eq(sources.id, 'colossal'));
    expect(row.etag).toBeNull();

    fail = false;
    const second = await runIngestWith(h.deps, { trigger: 'cli' });
    expect(stats(second)).toMatchObject({ classifier: 'claude', new: 3, ready: 3 });
  });

  it('does not start a review that cannot fit in the budget', async () => {
    const h = harness({ aiEnabled: true });
    h.feeds.set(feedUrl('colossal'), ok(fixture('wordpress.xml')));
    const result = await runIngestWith(h.deps, { trigger: 'cron', budgetMs: 4_000 });
    expect(h.classifyCalls).toHaveLength(0);
    expect(stats(result)).toMatchObject({ classifier: 'deferred', classifierNote: 'not enough time left in this run', pending: 0 });
  });
});

describe('runIngestWith: intake cap and time budget', () => {
  const colossalItems = Array.from({ length: 8 }, (_, i) => ({
    title: `Colossal gallery story ${i + 1}`,
    path: `/2026/09/story-${i + 1}/`,
    hoursAgo: 2 + i * 3,
  }));
  const mmmItems = Array.from({ length: 3 }, (_, i) => ({
    title: `Photography exhibition ${i + 1}`,
    path: `/exhibition-${i + 1}/`,
    hoursAgo: 1 + i * 3,
    description: 'A new photography exhibition by an artist opens at a gallery this week, with prints on every wall.',
  }));

  it(`takes at most ${PER_CATEGORY_INTAKE} per category, alternating sources, and defers the rest`, async () => {
    const h = harness();
    h.feeds.set(feedUrl('colossal'), ok(rss('www.thisiscolossal.com', colossalItems), '"c"'));
    h.feeds.set(feedUrl('my-modern-met'), ok(rss('mymodernmet.com', mmmItems), '"m"'));

    const result = await runIngestWith(h.deps, { trigger: 'cli' });

    expect(stats(result)).toMatchObject({ new: 11, pending: 6, deferred: 5, ready: 6 });
    const readySources = (await allArticles()).filter((row) => row.status === 'ready').map((row) => row.sourceId);
    expect(readySources.filter((id) => id === 'colossal')).toHaveLength(3);
    expect(readySources.filter((id) => id === 'my-modern-met')).toHaveLength(3);
    // Deferred items must be found again, so both feeds lose their validators.
    const rows = await testDb.db.select({ id: sources.id, etag: sources.etag }).from(sources);
    expect(rows.find((row) => row.id === 'colossal')?.etag).toBeNull();

    const second = await runIngestWith(h.deps, { trigger: 'cli' });
    expect(stats(second)).toMatchObject({ new: 5, pending: 5, deferred: 0 });
    const [colossal] = await testDb.db.select().from(sources).where(eq(sources.id, 'colossal'));
    expect(colossal.etag).toBe('"c"');
  });

  it('never starts an item that cannot finish, leaves the rest pending, and resumes oldest-first', async () => {
    const h = harness({ lessonMs: 4_000 });
    h.feeds.set(feedUrl('colossal'), ok(rss('www.thisiscolossal.com', colossalItems.slice(0, 6))));
    const starts: number[] = [];
    const generate = h.deps.generateLesson;
    h.deps.generateLesson = async (input, opts) => {
      starts.push(h.nowMs());
      return generate(input, opts);
    };

    const budgetMs = 12_000;
    const first = await runIngestWith(h.deps, { trigger: 'cron', budgetMs });

    const s = stats(first);
    expect(s.stoppedBy).toBe('budget');
    expect(s.ready).toBeGreaterThan(0);
    expect(s.ready + s.backlog).toBe(6);
    expect(s.avgItemMs).toBeGreaterThan(0);
    // Every item started early enough to finish, keeping the 2 s reserve, by the estimate at that time.
    for (const start of starts) expect(start).toBeLessThanOrEqual(NOW.getTime() + budgetMs - 2_000);

    const doneFirst = h.lessonCalls.map((call) => call.title);
    // Oldest first: the six items are 2, 5, 8, 11, 14 and 17 hours old.
    expect(doneFirst[0]).toBe('Colossal gallery story 6');

    h.advance(HOUR);
    const second = await runIngestWith(h.deps, { trigger: 'cli' });
    expect(stats(second)).toMatchObject({ backlog: 0, stoppedBy: 'done' });
    expect(new Set(h.lessonCalls.map((call) => call.title)).size).toBe(6);
  });

  it('with a 3 s budget: fetches, leaves a backlog, then a run too short to fetch still finishes pending lessons', async () => {
    const h = harness({ lessonMs: 200 });
    h.feeds.set(feedUrl('colossal'), ok(rss('www.thisiscolossal.com', colossalItems.slice(0, 6))));

    const first = await runIngestWith(h.deps, { trigger: 'cron', budgetMs: 3_000 });
    const s1 = stats(first);
    expect(s1).toMatchObject({ new: 6, pending: 6, sourcesSkipped: 0, stoppedBy: 'budget' });
    expect(s1.ready).toBeGreaterThan(0);
    expect(s1.backlog).toBe(6 - s1.ready);

    h.advance(HOUR);
    const second = await runIngestWith(h.deps, { trigger: 'cron', budgetMs: 2_500 });
    const s2 = stats(second);
    // No time to fetch (the fetch timeout would be under 1 s), so every source is skipped and the run is partial...
    expect(second.status).toBe('partial');
    expect(s2.sourcesSkipped).toBe(s2.sources);
    expect(s2.fetched).toBe(0);
    // ...but the average measured last run (well under 500 ms) lets it keep working through the backlog.
    expect(s2.ready).toBeGreaterThan(0);

    h.advance(HOUR);
    const third = await runIngestWith(h.deps, { trigger: 'cli' });
    expect(third.status).toBe('ok');
    expect(stats(third)).toMatchObject({ new: 0, backlog: 0, stoppedBy: 'done' });
    expect(await byStatus('ready')).toHaveLength(6);
  });

  it('uses the last measured duration to decide, so a slow engine waits for an unlimited run', async () => {
    await testDb.db.insert(ingestRuns).values({
      id: 'previous',
      trigger: 'cli',
      status: 'ok',
      startedAt: new Date(NOW.getTime() - HOUR),
      finishedAt: new Date(NOW.getTime() - HOUR),
      stats: { avgItemMs: 50_000, aiEnabled: false },
    });
    const h = harness();
    h.feeds.set(feedUrl('colossal'), ok(fixture('wordpress.xml')));

    const result = await runIngestWith(h.deps, { trigger: 'cron', budgetMs: 20_000 });

    expect(h.lessonCalls).toHaveLength(0);
    expect(stats(result)).toMatchObject({ pending: 3, ready: 0, backlog: 3, stoppedBy: 'budget' });
    expect(result.status).toBe('ok');
  });

  it('gives lesson calls the time left in a budget, and no limit otherwise', async () => {
    const budgeted = harness();
    budgeted.feeds.set(feedUrl('colossal'), ok(fixture('wordpress.xml')));
    await runIngestWith(budgeted.deps, { trigger: 'cron', budgetMs: 20_000 });
    expect(budgeted.lessonOptions.length).toBeGreaterThan(0);
    for (const options of budgeted.lessonOptions) {
      expect(options.timeoutMs).toBeGreaterThan(0);
      expect(options.timeoutMs).toBeLessThanOrEqual(18_000);
      expect(options.siblingTitles).toBeDefined();
    }

    await testDb.truncateAll();
    const unlimited = harness();
    unlimited.feeds.set(feedUrl('colossal'), ok(fixture('wordpress.xml')));
    await runIngestWith(unlimited.deps, { trigger: 'cli' });
    expect(unlimited.lessonOptions.every((options) => options.timeoutMs === undefined)).toBe(true);
  });

  it('starts an overdue item with a time-limited call even when the usual estimate does not fit', async () => {
    await testDb.db.insert(ingestRuns).values({
      id: 'previous',
      trigger: 'cli',
      status: 'ok',
      startedAt: new Date(NOW.getTime() - HOUR),
      stats: { avgItemMs: 45_000, aiEnabled: true },
    });
    await testDb.db.insert(sources).values({ id: 'colossal', name: 'Colossal', feedUrl: feedUrl('colossal'), homepage: 'https://www.thisiscolossal.com', category: 'art' });
    await testDb.db.insert(articles).values({
      id: 'overdue',
      slug: 'overdue',
      sourceId: 'colossal',
      category: 'art',
      title: 'Waiting since this morning',
      url: 'https://www.thisiscolossal.com/overdue',
      excerpt: 'A story that has waited for a lesson since this morning.',
      publishedAt: new Date(NOW.getTime() - 9 * HOUR),
      fetchedAt: new Date(NOW.getTime() - 8 * HOUR),
      status: 'pending',
      safety: { safe: true, reasons: [], method: 'claude' },
      contentHash: 'overdue',
    });
    const h = harness({ aiEnabled: true, lessonMs: 1_000 });

    const result = await runIngestWith(h.deps, { trigger: 'cron', budgetMs: 20_000 });

    expect(stats(result)).toMatchObject({ bounded: 1, ready: 1, backlog: 0 });
    expect(h.lessonCalls.map((call) => call.title)).toEqual(['Waiting since this morning']);
    // The bounded attempt skips the article fetch to leave the time to the lesson.
    expect(h.articleFetches).toEqual([]);
    expect(h.lessonOptions[0].timeoutMs).toBeLessThanOrEqual(18_000);
  });

  it('counts the backlog against the intake cap', async () => {
    await testDb.db.insert(sources).values({ id: 'colossal', name: 'Colossal', feedUrl: feedUrl('colossal'), homepage: 'https://www.thisiscolossal.com', category: 'art' });
    await testDb.db.insert(articles).values(
      Array.from({ length: 16 }, (_, i) => ({
        id: `waiting-${i}`,
        slug: `waiting-${i}`,
        sourceId: 'colossal',
        category: 'art' as const,
        title: `Waiting ${i}`,
        url: `https://www.thisiscolossal.com/waiting-${i}`,
        excerpt: 'Waiting for a lesson.',
        publishedAt: new Date(NOW.getTime() - 30 * HOUR),
        status: 'pending' as const,
        safety: { safe: true, reasons: [], method: 'blocklist' as const },
        contentHash: `waiting-${i}`,
      })),
    );
    await testDb.db.insert(ingestRuns).values({
      id: 'previous',
      trigger: 'cli',
      status: 'ok',
      startedAt: new Date(NOW.getTime() - HOUR),
      stats: { avgItemMs: 50_000, aiEnabled: false },
    });
    const h = harness();
    h.feeds.set(feedUrl('colossal'), ok(rss('www.thisiscolossal.com', colossalItems)));

    const result = await runIngestWith(h.deps, { trigger: 'cron', budgetMs: 20_000 });

    // 18 may wait per category and 16 already do, so only 2 new items are taken.
    expect(stats(result)).toMatchObject({ new: 8, pending: 2, deferred: 6, ready: 0, backlog: 18 });
  });

  it('cleans up as part of the run', async () => {
    await testDb.db.insert(sources).values({ id: 'colossal', name: 'Colossal', feedUrl: feedUrl('colossal'), homepage: 'https://www.thisiscolossal.com', category: 'art' });
    await testDb.db.insert(articles).values({
      id: 'old-rejected',
      slug: 'old-rejected',
      sourceId: 'colossal',
      category: 'art',
      title: 'Old rejected',
      url: 'https://www.thisiscolossal.com/old',
      excerpt: 'x',
      publishedAt: new Date(NOW.getTime() - 60 * 24 * HOUR),
      fetchedAt: new Date(NOW.getTime() - 60 * 24 * HOUR),
      status: 'rejected',
      safety: { safe: false, reasons: ['x'], method: 'blocklist' },
      contentHash: 'old',
    });
    const h = harness();
    const result = await runIngestWith(h.deps, { trigger: 'cli' });
    expect(stats(result).cleanup).toMatchObject({ rejected: 1 });
  });
});

describe('pure helpers', () => {
  const candidate = (overrides: Partial<CandidateItem>): CandidateItem => ({
    sourceId: 'colossal',
    category: 'art',
    title: 't',
    url: 'https://example.com/a',
    excerpt: 'e',
    author: null,
    publishedAt: NOW,
    contentHash: 'h',
    slug: 's',
    ...overrides,
  });

  it('dedupeCandidates keeps the first of repeated URLs or content', () => {
    const items = [
      candidate({ url: 'https://example.com/1', contentHash: 'a' }),
      candidate({ url: 'https://example.com/1', contentHash: 'b' }),
      candidate({ url: 'https://example.com/2', contentHash: 'a' }),
      candidate({ url: 'https://example.com/3', contentHash: 'c' }),
    ];
    expect(dedupeCandidates(items).map((item) => item.url)).toEqual(['https://example.com/1', 'https://example.com/3']);
  });

  it('selectForIntake respects each allowance and takes newest first', () => {
    const at = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * HOUR);
    const items = [
      candidate({ url: 'a1', sourceId: 'a', publishedAt: at(5) }),
      candidate({ url: 'a2', sourceId: 'a', publishedAt: at(1) }),
      candidate({ url: 'b1', sourceId: 'b', publishedAt: at(3) }),
      candidate({ url: 's1', sourceId: 'c', category: 'sports', publishedAt: at(2) }),
    ];
    const { selected, overflow } = selectForIntake(items, { art: 2, sports: 0, games: 6, writing: 6 });
    expect(selected.map((item) => item.url)).toEqual(['a2', 'b1']);
    expect(overflow.map((item) => item.url).sort()).toEqual(['a1', 's1']);
  });
});
