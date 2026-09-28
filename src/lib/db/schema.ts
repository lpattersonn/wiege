import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Relative imports: drizzle-kit loads this file without the `@/*` alias.
import { CATEGORY_SLUGS, type CategorySlug } from '../categories';
import type { Definition, LessonContent } from '../literacy/types';

/**
 * Shared content only (SPEC §3). No student data is ever stored here.
 * Everything lives in the dedicated `wiege` schema, which Supabase's Data API
 * does not expose; a follow-up migration also enables RLS on every table.
 */
export const wiege = pgSchema('wiege');

export const ARTICLE_STATUSES = ['pending', 'ready', 'rejected', 'failed'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const LESSON_GENERATORS = ['claude', 'heuristic', 'seed'] as const;
export type LessonGenerator = (typeof LESSON_GENERATORS)[number];

export const INGEST_TRIGGERS = ['cron', 'scheduler', 'manual', 'cli'] as const;
export type IngestRunTrigger = (typeof INGEST_TRIGGERS)[number];

export const INGEST_RUN_STATUSES = ['running', 'ok', 'partial', 'failed'] as const;
export type IngestRunStatus = (typeof INGEST_RUN_STATUSES)[number];

export type SafetyMethod = 'blocklist' | 'claude' | 'seed';
export interface ArticleSafety {
  safe: boolean;
  reasons: string[];
  method: SafetyMethod;
}

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

// Only ever called with the constant lists above, so inlining them as SQL literals is safe.
const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '));

export const sources = wiege.table(
  'sources',
  {
    /** Stable slug, e.g. `bbc-newsround`. */
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    feedUrl: text('feed_url').notNull().unique(),
    homepage: text('homepage').notNull(),
    category: text('category').$type<CategorySlug>().notNull(),
    enabled: boolean('enabled').notNull().default(true),
    lastFetchedAt: timestamptz('last_fetched_at'),
    lastError: text('last_error'),
    /** Validators for conditional GET (If-None-Match / If-Modified-Since). */
    etag: text('etag'),
    lastModified: text('last_modified'),
  },
  (t) => [check('sources_category_check', sql`${t.category} in (${inList(CATEGORY_SLUGS)})`)],
);

export const articles = wiege.table(
  'articles',
  {
    id: text('id').primaryKey(),
    /** Kebab-case title plus a 6-character hash. */
    slug: text('slug').notNull().unique(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    category: text('category').$type<CategorySlug>().notNull(),
    title: text('title').notNull(),
    url: text('url').notNull().unique(),
    author: text('author'),
    /** Plain text, at most 600 characters. */
    excerpt: text('excerpt').notNull(),
    publishedAt: timestamptz('published_at').notNull(),
    fetchedAt: timestamptz('fetched_at').notNull().defaultNow(),
    status: text('status').$type<ArticleStatus>().notNull().default('pending'),
    safety: jsonb('safety').$type<ArticleSafety>().notNull(),
    contentHash: text('content_hash').notNull(),
    isSample: boolean('is_sample').notNull().default(false),
  },
  (t) => [
    index('articles_status_category_published_idx').on(t.status, t.category, t.publishedAt.desc()),
    index('articles_status_published_idx').on(t.status, t.publishedAt.desc()),
    index('articles_content_hash_idx').on(t.contentHash),
    check('articles_status_check', sql`${t.status} in (${inList(ARTICLE_STATUSES)})`),
    check('articles_category_check', sql`${t.category} in (${inList(CATEGORY_SLUGS)})`),
  ],
);

export const lessons = wiege.table(
  'lessons',
  {
    articleId: text('article_id')
      .primaryKey()
      .references(() => articles.id, { onDelete: 'cascade' }),
    content: jsonb('content').$type<LessonContent>().notNull(),
    generator: text('generator').$type<LessonGenerator>().notNull(),
    model: text('model'),
    readingGrade: real('reading_grade').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [check('lessons_generator_check', sql`${t.generator} in (${inList(LESSON_GENERATORS)})`)],
);

export const definitions = wiege.table('definitions', {
  /** Lower-case headword. */
  word: text('word').primaryKey(),
  /** `null` caches "no definition found" so a miss is not refetched every time. */
  data: jsonb('data').$type<Definition | null>(),
  source: text('source').notNull(),
  fetchedAt: timestamptz('fetched_at').notNull().defaultNow(),
});

export const ingestRuns = wiege.table(
  'ingest_runs',
  {
    id: text('id').primaryKey(),
    trigger: text('trigger').$type<IngestRunTrigger>().notNull(),
    startedAt: timestamptz('started_at').notNull().defaultNow(),
    finishedAt: timestamptz('finished_at'),
    status: text('status').$type<IngestRunStatus>().notNull().default('running'),
    stats: jsonb('stats').$type<Record<string, unknown>>().notNull().default({}),
    error: text('error'),
  },
  (t) => [
    index('ingest_runs_started_idx').on(t.startedAt.desc()),
    // At most one run may be `running`: a second insert fails atomically, which is the ingest lock.
    uniqueIndex('ingest_runs_single_running_idx')
      .on(t.status)
      .where(sql`${t.status} = 'running'`),
    check('ingest_runs_trigger_check', sql`${t.trigger} in (${inList(INGEST_TRIGGERS)})`),
    check('ingest_runs_status_check', sql`${t.status} in (${inList(INGEST_RUN_STATUSES)})`),
  ],
);

export const rateLimits = wiege.table(
  'rate_limits',
  {
    /** e.g. `feedback:ip:<sha256>` or `feedback:global:2026-09-27`. Never a raw IP. */
    key: text('key').primaryKey(),
    count: integer('count').notNull(),
    resetAt: timestamptz('reset_at').notNull(),
  },
  (t) => [index('rate_limits_reset_idx').on(t.resetAt)],
);

export type SourceRow = typeof sources.$inferSelect;
export type NewSourceRow = typeof sources.$inferInsert;
export type ArticleRow = typeof articles.$inferSelect;
export type NewArticleRow = typeof articles.$inferInsert;
export type LessonRow = typeof lessons.$inferSelect;
export type NewLessonRow = typeof lessons.$inferInsert;
export type DefinitionRow = typeof definitions.$inferSelect;
export type IngestRunRow = typeof ingestRuns.$inferSelect;
export type RateLimitRow = typeof rateLimits.$inferSelect;
