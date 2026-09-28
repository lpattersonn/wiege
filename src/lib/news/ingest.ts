import 'server-only';

import { randomUUID } from 'node:crypto';

import { and, asc, count, desc, eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';

import { aiAvailable } from '@/lib/ai/client';
import { CATEGORY_SLUGS, type CategorySlug } from '@/lib/categories';
import { getDb, type Database } from '@/lib/db';
import { describeDatabaseError } from '@/lib/db/migrate';
import { articles, ingestRuns, lessons, sources, type ArticleSafety, type NewArticleRow } from '@/lib/db/schema';
import { siteUrl } from '@/lib/env';
import { generateLesson, type GenerateLessonOptions, type GeneratedLesson, type LessonSourceInput } from '@/lib/literacy/generate';
import { LessonContent, lessonContentProblems } from '@/lib/literacy/types';

import {
  DEFAULT_ITEM_ESTIMATE_MS,
  FINISH_RESERVE_MS,
  canStart,
  deadlineFrom,
  nextAverage,
  timeoutWithin,
} from './budget';
import {
  CLASSIFY_MIN_TIME_MS,
  CLASSIFY_TIMEOUT_MS,
  classifyBatch,
  type ClassifiableItem,
  type ClassificationOutcome,
} from './classify';
import { runCleanup, type CleanupStats } from './cleanup';
import { getFeed, type FeedDefinition } from './feeds';
import {
  FEED_TIMEOUT_MS,
  MAX_FEEDS_IN_FLIGHT,
  fetchArticleText,
  fetchFeed,
  mapWithConcurrency,
  userAgent,
  type FeedFetchResult,
  type FeedValidators,
} from './fetch';
import { acquireIngestLock, finishRun, heartbeat } from './lock';
import { normalizeItem, parseFeed, type CandidateItem, type SkipReason } from './parse';
import { scanItem, scanLesson } from './safety';
import { activeFeeds, recordSourceFetch, syncSources, type ActiveFeed } from './sources';

/**
 * News ingestion (SPEC §5), resumable and time-budgeted:
 *
 * 1. lock (one run at a time), 2. fetch every enabled curated feed, 3. parse
 * and de-duplicate, 4. safety: blocklist, then one batched Claude review when
 * available; safe items are stored `pending` straight away, unsafe ones
 * `rejected`, 5. enrich `pending` items oldest-first while the budget allows,
 * 6. publish (`ready`), 7. clean up and record the run.
 *
 * Every step after the lock is fail-soft per source and per item; only a
 * database failure aborts a run. Revalidating pages is the caller's job (the
 * cron route does it; see revalidate.ts).
 */

export type IngestTrigger = 'cron' | 'scheduler' | 'manual' | 'cli';

export type IngestResult = {
  status: 'ok' | 'partial' | 'failed' | 'skipped';
  runId: string | null;
  stats: Record<string, unknown>;
};

/** New safe items taken per category per run (newest first, spread across sources). */
export const PER_CATEGORY_INTAKE = 6;
/** No new intake for a category while this many of its items still wait for a lesson. */
export const MAX_PENDING_PER_CATEGORY = 18;
export const ENRICH_CONCURRENCY = 2;
export const MAX_ENRICH_PER_RUN = 60;
const SIBLING_TITLES = 5;
/**
 * An item still pending after this long has missed at least one unlimited run
 * (e.g. no GitHub Actions ingest is configured). A budgeted run then starts it
 * even when the usual estimate does not fit, with the Claude call cut to the
 * time left: `generateLesson` falls back to the offline engine, so it finishes.
 */
export const OVERDUE_PENDING_MS = 6 * 60 * 60 * 1000;
/** Less time than this is not worth a bounded attempt. */
export const MIN_BOUNDED_ITEM_MS = 5_000;

type SourceStatus = 'ok' | 'not-modified' | 'error' | 'skipped';

export type SourceStats = {
  status: SourceStatus;
  items: number;
  new: number;
  pending: number;
  rejected: number;
  deferred: number;
  skipped: Partial<Record<SkipReason, number>>;
  error?: string;
};

export type IngestStats = {
  trigger: IngestTrigger;
  budgetMs: number | null;
  aiEnabled: boolean;
  classifier: 'claude' | 'claude-refused' | 'blocklist-only' | 'deferred' | 'not-needed';
  classifierNote?: string;
  sources: number;
  sourceErrors: number;
  /** Sources not fetched because too little of the budget was left; fetched again next run. */
  sourcesSkipped: number;
  /** Items read from feeds. */
  fetched: number;
  /** Items not seen before. */
  new: number;
  /** Stored as rejected (at intake, or when the generated lesson failed the re-scan). */
  rejected: number;
  /** Stored as pending this run. */
  pending: number;
  /** New items not stored this run (intake cap or classifier unavailable); retried next run. */
  deferred: number;
  ready: number;
  failed: number;
  /** Overdue items started with a time-limited lesson call. */
  bounded: number;
  /** Pending items left for the next run. */
  backlog: number;
  stoppedBy: 'done' | 'budget' | 'lost-lock' | null;
  /** Moving average of one enrichment, carried into the next run's estimate. */
  avgItemMs: number | null;
  cleanup: CleanupStats | null;
  cleanupError?: string;
  bySource: Record<string, SourceStats>;
  durationMs: number;
  heartbeatAt?: string;
  error?: string;
};

export interface IngestLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Everything the pipeline touches outside itself, injectable for tests. */
export interface IngestDeps {
  db: Database;
  now: () => Date;
  aiEnabled: boolean;
  fetchFeed: (url: string, validators: FeedValidators, timeoutMs: number) => Promise<FeedFetchResult>;
  fetchArticleText: (url: string, allowedHosts: readonly string[]) => Promise<string | null>;
  classify: (items: ClassifiableItem[], timeoutMs: number) => Promise<ClassificationOutcome>;
  generateLesson: (input: LessonSourceInput, opts: GenerateLessonOptions) => Promise<GeneratedLesson>;
  log: IngestLogger;
}

export function defaultIngestDeps(): IngestDeps {
  const agent = userAgent(siteUrl());
  return {
    db: getDb(),
    now: () => new Date(),
    aiEnabled: aiAvailable(),
    fetchFeed: (url, validators, timeoutMs) => fetchFeed(url, validators, { userAgent: agent, timeoutMs }),
    fetchArticleText: (url, allowedHosts) => fetchArticleText(url, allowedHosts, { userAgent: agent }),
    // A retry only fits when the call is not squeezed into a short budget.
    classify: (items, timeoutMs) => classifyBatch(items, { timeoutMs, maxRetries: timeoutMs < CLASSIFY_TIMEOUT_MS ? 0 : 1 }),
    generateLesson: (input, opts) => generateLesson(input, opts),
    log: console,
  };
}

export async function runIngest(opts: { trigger: IngestTrigger; budgetMs?: number }): Promise<IngestResult> {
  return runIngestWith(defaultIngestDeps(), opts);
}

/** One line for logs and stats. Zod errors carry a multi-line JSON message, so they are summarised by path instead. */
export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    const issues = error.issues.slice(0, 3).map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
    return `invalid lesson (${issues.join('; ')})`.slice(0, 300);
  }
  return (error instanceof Error ? error.message.split('\n')[0] : String(error)).slice(0, 300);
}

function emptySourceStats(status: SourceStatus): SourceStats {
  return { status, items: 0, new: 0, pending: 0, rejected: 0, deferred: 0, skipped: {} };
}

// --- steps 2-3: fetch, parse, normalise ----------------------------------------------------

interface FetchedSource {
  active: ActiveFeed;
  candidates: CandidateItem[];
  /** Validators from this response (status ok only). */
  validators: FeedValidators | null;
}

async function fetchSources(deps: IngestDeps, feeds: ActiveFeed[], deadline: number, stats: IngestStats): Promise<FetchedSource[]> {
  return mapWithConcurrency(feeds, MAX_FEEDS_IN_FLIGHT, async (active) => {
    const { feed } = active;
    const now = deps.now();
    const timeoutMs = timeoutWithin(deadline, now.getTime(), FEED_TIMEOUT_MS);
    if (timeoutMs < 1_000) {
      stats.bySource[feed.id] = emptySourceStats('skipped');
      stats.sourcesSkipped += 1;
      return { active, candidates: [], validators: null };
    }
    try {
      const response = await deps.fetchFeed(feed.feedUrl, active.validators, timeoutMs);
      if (response.status === 'not-modified') {
        stats.bySource[feed.id] = emptySourceStats('not-modified');
        await recordSourceFetch(deps.db, feed.id, { at: now, error: null });
        return { active, candidates: [], validators: null };
      }
      const raw = await parseFeed(response.body);
      const sourceStats = emptySourceStats('ok');
      sourceStats.items = raw.length;
      const candidates: CandidateItem[] = [];
      for (const entry of raw) {
        const result = normalizeItem(entry, feed, now);
        if (result.ok) candidates.push(result.item);
        else sourceStats.skipped[result.reason] = (sourceStats.skipped[result.reason] ?? 0) + 1;
      }
      stats.bySource[feed.id] = sourceStats;
      stats.fetched += raw.length;
      return { active, candidates, validators: response.validators };
    } catch (error) {
      const message = errorMessage(error);
      stats.bySource[feed.id] = { ...emptySourceStats('error'), error: message };
      stats.sourceErrors += 1;
      deps.log.warn(`[ingest] ${feed.id}: ${message}`);
      await recordSourceFetch(deps.db, feed.id, { at: now, error: message });
      return { active, candidates: [], validators: null };
    }
  });
}

/** Drops repeats within the run (same URL or same content under another URL); first wins. */
export function dedupeCandidates(items: readonly CandidateItem[]): CandidateItem[] {
  const urls = new Set<string>();
  const hashes = new Set<string>();
  const unique: CandidateItem[] = [];
  for (const item of items) {
    if (urls.has(item.url) || hashes.has(item.contentHash)) continue;
    urls.add(item.url);
    hashes.add(item.contentHash);
    unique.push(item);
  }
  return unique;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Items whose URL, content hash or slug is already stored (in any status) are not new. */
async function withoutStored(db: Database, items: CandidateItem[]): Promise<CandidateItem[]> {
  const urls = new Set<string>();
  const hashes = new Set<string>();
  const slugs = new Set<string>();
  for (const group of chunk(items, 200)) {
    const rows = await db
      .select({ url: articles.url, contentHash: articles.contentHash, slug: articles.slug })
      .from(articles)
      .where(
        or(
          inArray(articles.url, group.map((item) => item.url)),
          inArray(articles.contentHash, group.map((item) => item.contentHash)),
          inArray(articles.slug, group.map((item) => item.slug)),
        ),
      );
    for (const row of rows) {
      urls.add(row.url);
      hashes.add(row.contentHash);
      slugs.add(row.slug);
    }
  }
  return items.filter((item) => !urls.has(item.url) && !hashes.has(item.contentHash) && !slugs.has(item.slug));
}

// --- step 4: intake cap ----------------------------------------------------------------------

/**
 * Picks at most `allowance[category]` items per category, newest first, taking
 * turns between sources so one busy feed cannot fill a category.
 */
export function selectForIntake(
  items: readonly CandidateItem[],
  allowance: Readonly<Record<CategorySlug, number>>,
): { selected: CandidateItem[]; overflow: CandidateItem[] } {
  const selected: CandidateItem[] = [];
  const overflow: CandidateItem[] = [];
  for (const category of CATEGORY_SLUGS) {
    const bySource = new Map<string, CandidateItem[]>();
    for (const item of items) {
      if (item.category !== category) continue;
      const queue = bySource.get(item.sourceId) ?? [];
      queue.push(item);
      bySource.set(item.sourceId, queue);
    }
    const queues = [...bySource.values()].map((queue) =>
      [...queue].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()),
    );
    let taken = 0;
    const limit = Math.max(0, allowance[category]);
    for (let round = 0; queues.some((queue) => queue.length > 0); round++) {
      // Within a round, the source with the newest remaining item goes first.
      queues.sort((a, b) => (b[0]?.publishedAt.getTime() ?? 0) - (a[0]?.publishedAt.getTime() ?? 0));
      for (const queue of queues) {
        const next = queue.shift();
        if (!next) continue;
        if (taken < limit) {
          selected.push(next);
          taken += 1;
        } else {
          overflow.push(next);
        }
      }
    }
  }
  return { selected, overflow };
}

async function pendingByCategory(db: Database): Promise<Record<CategorySlug, number>> {
  const rows = await db
    .select({ category: articles.category, n: count() })
    .from(articles)
    .where(and(eq(articles.status, 'pending'), eq(articles.isSample, false)))
    .groupBy(articles.category);
  const counts = Object.fromEntries(CATEGORY_SLUGS.map((category) => [category, 0])) as Record<CategorySlug, number>;
  for (const row of rows) counts[row.category] = row.n;
  return counts;
}

// --- step 4 storage -----------------------------------------------------------------------------

function articleRow(item: CandidateItem, status: 'pending' | 'rejected', safety: ArticleSafety, now: Date): NewArticleRow {
  return {
    id: randomUUID(),
    slug: item.slug,
    sourceId: item.sourceId,
    category: item.category,
    title: item.title,
    url: item.url,
    author: item.author,
    excerpt: item.excerpt,
    publishedAt: item.publishedAt,
    fetchedAt: now,
    status,
    safety,
    contentHash: item.contentHash,
    isSample: false,
  };
}

/** Inserts rows, skipping any that collide with a stored one; returns the source ids of inserted rows. */
async function insertArticles(db: Database, rows: NewArticleRow[]): Promise<string[]> {
  const inserted: string[] = [];
  for (const group of chunk(rows, 100)) {
    const result = await db.insert(articles).values(group).onConflictDoNothing().returning({ sourceId: articles.sourceId });
    inserted.push(...result.map((row) => row.sourceId));
  }
  return inserted;
}

// --- step 5: enrichment ------------------------------------------------------------------------

interface PendingItem {
  id: string;
  fetchedAt: Date;
  title: string;
  excerpt: string;
  url: string;
  category: CategorySlug;
  sourceId: string;
  sourceName: string;
}

const PreviousRunStats = z.object({ avgItemMs: z.number().positive(), aiEnabled: z.boolean() });

/** The last measured average for the same engine, so the first item of a run is estimated well. */
async function previousAverage(db: Database, aiEnabled: boolean): Promise<number | null> {
  const rows = await db
    .select({ stats: ingestRuns.stats })
    .from(ingestRuns)
    .where(inArray(ingestRuns.status, ['ok', 'partial']))
    .orderBy(desc(ingestRuns.startedAt))
    .limit(10);
  for (const row of rows) {
    const parsed = PreviousRunStats.safeParse(row.stats);
    if (parsed.success && parsed.data.aiEnabled === aiEnabled) return parsed.data.avgItemMs;
  }
  return null;
}

async function loadPending(db: Database): Promise<PendingItem[]> {
  return db
    .select({
      id: articles.id,
      fetchedAt: articles.fetchedAt,
      title: articles.title,
      excerpt: articles.excerpt,
      url: articles.url,
      category: articles.category,
      sourceId: articles.sourceId,
      sourceName: sources.name,
    })
    .from(articles)
    .innerJoin(sources, eq(sources.id, articles.sourceId))
    .where(and(eq(articles.status, 'pending'), eq(articles.isSample, false)))
    .orderBy(asc(articles.fetchedAt), asc(articles.publishedAt), asc(articles.id))
    .limit(MAX_ENRICH_PER_RUN);
}

/** Recent headlines per category, for the heuristic quiz's "which headline fits?" question. */
async function recentTitles(db: Database): Promise<Map<CategorySlug, string[]>> {
  const rows = await db
    .select({ title: articles.title, category: articles.category })
    .from(articles)
    .where(and(eq(articles.isSample, false), inArray(articles.status, ['ready', 'pending'])))
    .orderBy(desc(articles.publishedAt))
    .limit(120);
  const byCategory = new Map<CategorySlug, string[]>();
  for (const row of rows) {
    const titles = byCategory.get(row.category) ?? [];
    titles.push(row.title);
    byCategory.set(row.category, titles);
  }
  return byCategory;
}

const ReadingGrade = z.number().finite();

type EnrichOutcome = 'ready' | 'rejected' | 'failed';

/**
 * One lesson. Within a budget the lesson call gets the time left (minus the
 * reserve) so it cannot overrun; `bounded` attempts also skip fetching the
 * article, leaving that time to the lesson.
 */
async function enrichOne(
  deps: IngestDeps,
  item: PendingItem,
  opts: { siblingTitles: string[]; deadline: number; bounded: boolean },
): Promise<EnrichOutcome> {
  const { db } = deps;
  const stillPending = and(eq(articles.id, item.id), eq(articles.status, 'pending'));
  try {
    const feed: FeedDefinition | undefined = getFeed(item.sourceId);
    const fullText = deps.aiEnabled && feed && !opts.bounded ? await deps.fetchArticleText(item.url, feed.allowedHosts) : null;
    const timeLeft = timeoutWithin(opts.deadline, deps.now().getTime(), Number.POSITIVE_INFINITY);
    const generated = await deps.generateLesson(
      {
        title: item.title,
        excerpt: item.excerpt,
        ...(fullText ? { fullText } : {}),
        category: item.category,
        sourceName: item.sourceName,
        url: item.url,
      },
      { siblingTitles: opts.siblingTitles, ...(Number.isFinite(timeLeft) ? { timeoutMs: Math.max(1_000, timeLeft) } : {}) },
    );
    const content = LessonContent.parse(generated.content);
    const problems = lessonContentProblems(content);
    if (problems.length > 0) throw new Error(`incomplete lesson: ${problems.join('; ')}`);
    const readingGrade = ReadingGrade.parse(generated.readingGrade);

    const scan = scanLesson(content);
    if (!scan.safe) {
      const safety: ArticleSafety = { safe: false, reasons: scan.reasons.map((reason) => `lesson ${reason}`), method: 'blocklist' };
      await db.update(articles).set({ status: 'rejected', safety }).where(stillPending);
      deps.log.warn(`[ingest] generated lesson for "${item.title}" failed the safety re-scan`);
      return 'rejected';
    }

    await db.transaction(async (tx) => {
      const lesson = { content, generator: generated.generator, model: generated.model, readingGrade, createdAt: deps.now() };
      await tx
        .insert(lessons)
        .values({ articleId: item.id, ...lesson })
        .onConflictDoUpdate({ target: lessons.articleId, set: lesson });
      await tx.update(articles).set({ status: 'ready' }).where(stillPending);
    });
    return 'ready';
  } catch (error) {
    deps.log.warn(`[ingest] lesson for "${item.title}" failed: ${errorMessage(error)}`);
    await db.update(articles).set({ status: 'failed' }).where(stillPending);
    return 'failed';
  }
}

async function enrichPending(deps: IngestDeps, runId: string, deadline: number, stats: IngestStats): Promise<void> {
  const queue = await loadPending(deps.db);
  if (queue.length === 0) {
    stats.stoppedBy = 'done';
    return;
  }
  const titles = await recentTitles(deps.db);
  let estimate = await previousAverage(deps.db, deps.aiEnabled);
  const fallbackEstimate = deps.aiEnabled ? DEFAULT_ITEM_ESTIMATE_MS.ai : DEFAULT_ITEM_ESTIMATE_MS.offline;
  let stop: IngestStats['stoppedBy'] = null;

  const worker = async () => {
    while (!stop) {
      const nowMs = deps.now().getTime();
      const next = queue[0];
      if (!next) return;
      // Oldest first, so an overdue item is always at the front of the queue.
      let bounded = false;
      if (!canStart({ nowMs, deadline, estimateMs: estimate ?? fallbackEstimate, reserveMs: FINISH_RESERVE_MS })) {
        const overdue = nowMs - next.fetchedAt.getTime() >= OVERDUE_PENDING_MS;
        if (!overdue || timeoutWithin(deadline, nowMs, Number.POSITIVE_INFINITY) < MIN_BOUNDED_ITEM_MS) {
          stop = 'budget';
          return;
        }
        bounded = true;
      }
      const item = queue.shift();
      if (!item) return;
      if (!(await heartbeat(deps.db, runId, new Date(nowMs)))) {
        stop = 'lost-lock';
        return;
      }
      const siblingTitles = (titles.get(item.category) ?? []).filter((title) => title !== item.title).slice(0, SIBLING_TITLES);
      const outcome = await enrichOne(deps, item, { siblingTitles, deadline, bounded });
      // A cut-short attempt says nothing about how long a normal one takes.
      if (!bounded) estimate = nextAverage(estimate, deps.now().getTime() - nowMs);
      if (bounded) stats.bounded += 1;
      if (outcome === 'ready') stats.ready += 1;
      else if (outcome === 'rejected') stats.rejected += 1;
      else stats.failed += 1;
    }
  };

  await Promise.all(Array.from({ length: ENRICH_CONCURRENCY }, worker));
  stats.stoppedBy = stop ?? 'done';
  stats.avgItemMs = estimate === null ? null : Math.round(estimate);
}

// --- run -------------------------------------------------------------------------------------------

function runStatus(stats: IngestStats, fatal: boolean): 'ok' | 'partial' | 'failed' {
  if (fatal) return 'failed';
  if (stats.sources > 0 && stats.sourceErrors === stats.sources && stats.ready === 0) return 'failed';
  if (
    stats.sourceErrors > 0 ||
    stats.sourcesSkipped > 0 ||
    stats.failed > 0 ||
    stats.classifier === 'deferred' ||
    stats.stoppedBy === 'lost-lock' ||
    stats.cleanupError !== undefined
  ) {
    return 'partial';
  }
  return 'ok';
}

async function countBacklog(db: Database): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(articles)
    .where(and(eq(articles.status, 'pending'), eq(articles.isSample, false)));
  return row?.n ?? 0;
}

/** `runIngest` with injectable dependencies. Never throws. */
export async function runIngestWith(deps: IngestDeps, opts: { trigger: IngestTrigger; budgetMs?: number }): Promise<IngestResult> {
  const { db, log } = deps;
  const startedAt = deps.now();
  const budgetMs = opts.budgetMs === undefined ? undefined : Math.max(0, Math.floor(opts.budgetMs));
  const deadline = deadlineFrom(startedAt.getTime(), budgetMs);

  let runId: string | null;
  try {
    runId = await acquireIngestLock(db, { trigger: opts.trigger, now: startedAt });
  } catch (error) {
    const message = describeDatabaseError(error);
    log.error(`[ingest] could not start a run: ${message}`);
    return { status: 'failed', runId: null, stats: { trigger: opts.trigger, error: message } };
  }
  if (!runId) {
    log.info('[ingest] skipped: another run is in progress');
    return { status: 'skipped', runId: null, stats: { trigger: opts.trigger, reason: 'another ingest run is in progress' } };
  }

  const stats: IngestStats = {
    trigger: opts.trigger,
    budgetMs: budgetMs ?? null,
    aiEnabled: deps.aiEnabled,
    classifier: 'not-needed',
    sources: 0,
    sourceErrors: 0,
    sourcesSkipped: 0,
    fetched: 0,
    new: 0,
    rejected: 0,
    pending: 0,
    deferred: 0,
    ready: 0,
    failed: 0,
    bounded: 0,
    backlog: 0,
    stoppedBy: null,
    avgItemMs: null,
    cleanup: null,
    bySource: {},
    durationMs: 0,
  };
  let fatal = false;

  try {
    await syncSources(db);
    const feeds = await activeFeeds(db);
    stats.sources = feeds.length;

    // Steps 2-3.
    const fetched = await fetchSources(deps, feeds, deadline, stats);
    const fresh = await withoutStored(db, dedupeCandidates(fetched.flatMap((source) => source.candidates)));
    stats.new = fresh.length;
    for (const item of fresh) stats.bySource[item.sourceId].new += 1;

    // Step 4a: blocklist.
    const now = deps.now();
    const rows: NewArticleRow[] = [];
    const blocklistSafe: CandidateItem[] = [];
    for (const item of fresh) {
      const scan = scanItem(item);
      if (scan.safe) blocklistSafe.push(item);
      else rows.push(articleRow(item, 'rejected', { safe: false, reasons: scan.reasons, method: 'blocklist' }, now));
    }

    // Step 4b: intake cap, so classification and enrichment stay bounded.
    const backlog = await pendingByCategory(db);
    const allowance = Object.fromEntries(
      CATEGORY_SLUGS.map((category) => [category, Math.min(PER_CATEGORY_INTAKE, MAX_PENDING_PER_CATEGORY - backlog[category])]),
    ) as Record<CategorySlug, number>;
    const { selected, overflow } = selectForIntake(blocklistSafe, allowance);
    const deferred: CandidateItem[] = [...overflow];

    // Step 4c: one Claude review for the whole batch.
    if (selected.length > 0) {
      const timeoutMs = timeoutWithin(deadline, deps.now().getTime(), CLASSIFY_TIMEOUT_MS);
      const outcome: ClassificationOutcome = !deps.aiEnabled
        ? { kind: 'unavailable' }
        : timeoutMs < CLASSIFY_MIN_TIME_MS
          ? { kind: 'deferred', reason: 'not enough time left in this run' }
          : await deps.classify(
              selected.map((item) => ({
                key: item.url,
                title: item.title,
                excerpt: item.excerpt,
                category: item.category,
                sourceName: getFeed(item.sourceId)?.name ?? item.sourceId,
              })),
              timeoutMs,
            );
      if (outcome.kind === 'unavailable') {
        stats.classifier = 'blocklist-only';
        for (const item of selected) rows.push(articleRow(item, 'pending', { safe: true, reasons: [], method: 'blocklist' }, now));
      } else if (outcome.kind === 'deferred') {
        stats.classifier = 'deferred';
        stats.classifierNote = outcome.reason;
        deferred.push(...selected);
      } else {
        stats.classifier = outcome.refused ? 'claude-refused' : 'claude';
        for (const item of selected) {
          const decision = outcome.decisions.get(item.url) ?? { safe: false, reasons: ['classifier returned no verdict'] };
          rows.push(
            decision.safe
              ? articleRow(item, 'pending', { safe: true, reasons: [], method: 'claude' }, now)
              : articleRow(item, 'rejected', { safe: false, reasons: decision.reasons, method: 'claude' }, now),
          );
        }
      }
    }

    const insertedPending = await insertArticles(db, rows.filter((row) => row.status === 'pending'));
    const insertedRejected = await insertArticles(db, rows.filter((row) => row.status === 'rejected'));
    stats.pending = insertedPending.length;
    stats.rejected = insertedRejected.length;
    stats.deferred = deferred.length;
    for (const sourceId of insertedPending) stats.bySource[sourceId].pending += 1;
    for (const sourceId of insertedRejected) stats.bySource[sourceId].rejected += 1;
    for (const item of deferred) stats.bySource[item.sourceId].deferred += 1;

    // Validators are kept only when every new item of a feed was handled; otherwise the
    // next run must re-read the whole feed to find the deferred items again.
    for (const source of fetched) {
      if (!source.validators) continue;
      const complete = stats.bySource[source.active.feed.id].deferred === 0;
      await recordSourceFetch(db, source.active.feed.id, { at: now, error: null, validators: complete ? source.validators : null });
    }

    // Steps 5-6.
    await enrichPending(deps, runId, deadline, stats);
    stats.backlog = await countBacklog(db);

    // Step 7.
    try {
      stats.cleanup = await runCleanup(db, deps.now());
    } catch (error) {
      stats.cleanupError = describeDatabaseError(error);
    }
  } catch (error) {
    fatal = true;
    stats.error = describeDatabaseError(error);
    log.error(`[ingest] run ${runId} failed: ${stats.error}`);
  }

  const finishedAt = deps.now();
  stats.durationMs = finishedAt.getTime() - startedAt.getTime();
  const status = runStatus(stats, fatal);
  try {
    const recorded = await finishRun(db, runId, { status, stats, error: stats.error ?? null, now: finishedAt });
    if (!recorded) log.warn(`[ingest] run ${runId} had been marked stale before it finished`);
  } catch (error) {
    log.error(`[ingest] could not record run ${runId}: ${describeDatabaseError(error)}`);
  }
  log.info(
    `[ingest] ${status} (${opts.trigger}, ${(stats.durationMs / 1000).toFixed(1)} s): fetched ${stats.fetched}, new ${stats.new}, ` +
      `pending ${stats.pending}, rejected ${stats.rejected}, deferred ${stats.deferred}, ready ${stats.ready}, ` +
      `failed ${stats.failed}, backlog ${stats.backlog}, source errors ${stats.sourceErrors}/${stats.sources}` +
      (stats.sourcesSkipped > 0 ? `, sources skipped for time ${stats.sourcesSkipped}` : ''),
  );
  return { status, runId, stats };
}
