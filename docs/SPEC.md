# Wiege — product & system specification

Wiege (German for "cradle", where things begin) is a web app that helps students aged 12–15 (grades 7–10, girls and boys) improve their literature skills — reading comprehension, vocabulary and writing — by reading recent, kid-safe news in four categories: **Writing, Games, Art, Sports**. Every story becomes a short literacy lesson. News is pulled automatically every 4 hours.

**There is no login.** Anyone can open Wiege and use everything immediately. There are no accounts, no sign-up, no passwords and no cookies. A student's progress (words, journal, streak, quiz results, stamps, preferences) lives **on their own device** in the browser, and can be exported to a backup file and imported on another device.

This document is the contract every contributor builds against. `docs/DESIGN.md` is the visual/interaction contract. When the two disagree on visuals, DESIGN.md wins; on behaviour, data, architecture or scope (including "no login"), this file wins — ignore any login/sign-up/account screens DESIGN.md may describe.

**Quality bar (non-negotiable):** every page scores **100 in all four Lighthouse categories (Performance, Accessibility, Best Practices, SEO) on both the mobile and desktop presets**, has zero blockers on Sentinel's `audit_mobile` (360/390/768px) and `audit_accessibility` (WCAG 2.2 AA), and targets 100 on Sentinel `score_design`. Measure — never estimate.

---

## 1. Decisions (and why)

| Decision | Choice | Why |
|---|---|---|
| Framework | Next.js 16.3 App Router, React 19.2, TypeScript strict | Owner requirement (next.js). |
| Accounts | **None.** No login, sign-up, sessions, cookies or user table | Owner requirement. Also the most private design for minors: the server never holds a student's data. |
| Student data | Local-first: a versioned, zod-validated store in `localStorage` (key `wiege:v1`), cross-tab synced, with export/import of a JSON backup and "clear my data" | Works instantly with no account; nothing personal leaves the device except writing the student explicitly sends for AI feedback (not stored). |
| Rendering | Every page statically rendered / ISR from the shared news database; personal bits (continue reading, streak, word counts) are small client islands that hydrate from the local store into reserved space (no layout shift) | Fast everywhere → Lighthouse 100; the same HTML is served to everyone. |
| Caching model | Classic (no `cacheComponents`). Time-based ISR (`revalidate = 600`) plus on-demand revalidation after each ingest | Read `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` and `incremental-static-regeneration.md`. |
| Styling | Tailwind CSS v4 (CSS-first `@theme` in `src/app/globals.css`) + CSS custom properties from DESIGN.md | Tokens in one place. |
| Motion | CSS + Web Animations API first; `motion` (`motion/react`, `LazyMotion` + `m`) only where layout animation is genuinely needed, in client islands | Tiny JS budget for Lighthouse 100. |
| Database | **Postgres on Supabase** (owner's choice) via Drizzle ORM + `postgres` (postgres.js) — **only shared content** (sources, articles, lessons, definitions, ingest runs, rate limits). Local development runs a real Postgres 17 via `embedded-postgres` (no Docker); unit tests use in-memory PGlite | Same database engine and driver everywhere; zero-setup locally; Supabase in production. |
| Supabase hardening | All tables live in a dedicated **`wiege` Postgres schema** (not exposed by Supabase's Data API) **and** have Row Level Security enabled with no policies; the app connects server-side only, never with the anon key; no Supabase client library in the browser | Nothing is reachable through PostgREST even if the schema were exposed later. |
| Hosting | Host-agnostic Next.js; first-class support for **Netlify** (owner has a Netlify token) and Vercel | Scheduling and time limits below are designed for serverless limits. |
| News source | Curated RSS/Atom feeds per category, verified live, plus a fail-closed kid-safety filter | Free, no API keys; the allowlist is the first safety layer. |
| Images | **No third-party photos shown to students.** Each story gets deterministic generative monochrome ink art (inline SVG seeded by slug + category glyph) | Feed images are unmoderated, colourful (brand is B&W) and heavy. |
| Literacy engine | Claude API when `ANTHROPIC_API_KEY` is set; a deterministic heuristic engine otherwise | Works fully offline for development and for owners without a key. |
| Claude model | `claude-opus-5` (override `WIEGE_AI_MODEL`), `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`, structured outputs via `client.beta.messages.parse` + `betaZodOutputFormat` | Current recommended model; server-side fallback on refusals; schema-validated JSON. |
| Abuse protection (no accounts) | Per-IP rate limits (IP stored only as a salted SHA-256 hash, keys expire) + a global daily cap on AI feedback calls; `Origin` check on POST routes | Protects the AI budget without identifying anyone. |
| Scheduling | Every 4 hours. Ingestion is **resumable and time-budgeted**: a run fetches + safety-checks quickly, stores new items as `pending`, then enriches as many pending items as fit in its budget; the next run continues. Triggers: (a) **Netlify Scheduled Function** `netlify/functions/ingest-schedule.mts` (`schedule: "0 */4 * * *"`) → `POST /api/cron/ingest`; (b) **GitHub Actions** cron running the full CLI ingest (no time limit — recommended when Claude is enabled, since lesson generation takes tens of seconds per story); (c) `vercel.json` cron for Vercel; (d) in-process scheduler for self-hosting (`instrumentation.ts`) | Works within serverless limits on any host. A DB lock prevents overlapping runs. |
| Third-party scripts | None. No analytics, ads, trackers, social embeds or chat | Child privacy + performance. |
| Dictionary | lesson vocabulary → `definitions` cache table → Free Dictionary API (`https://api.dictionaryapi.dev/api/v2/entries/en/<word>`) server-side, CDN-cacheable responses | Free, keyless; each word fetched once. |
| Admin UI | None. Operations via CLI scripts + `/api/health` (public status, no secrets) | No login means no safe admin screen; CLI is enough. |

---

## 2. Directory layout & ownership

```
docs/SPEC.md, docs/DESIGN.md, docs/ARCHITECTURE.md (diagram + ops runbook), README.md
drizzle/                      generated SQL migrations (drizzle-kit)
drizzle.config.ts
scripts/
  migrate.ts                  apply migrations
  seed.ts                     sources + practice stories (idempotent)
  ingest.ts                   run one ingest from the CLI
  sources.ts                  list / enable / disable sources from the CLI
  dev/screenshot.mjs          visual QA helper (exists)
  dev/lighthouse.mjs          Lighthouse mobile+desktop gate (exists)
src/
  instrumentation.ts          migrations-on-boot (opt-out) + 4h scheduler (self-host)
  app/
    layout.tsx, globals.css, not-found.tsx, error.tsx, global-error.tsx
    icon.svg, apple-icon.png|tsx, opengraph-image.tsx, manifest.ts, robots.ts, sitemap.ts
    page.tsx                  landing  "/"
    today/page.tsx
    c/page.tsx                explore: the four categories
    c/[category]/page.tsx
    read/[slug]/page.tsx
    words/page.tsx, words/practice/page.tsx
    journal/page.tsx, journal/new/page.tsx, journal/[id]/page.tsx
    me/page.tsx               progress, stamps, calendar
    settings/page.tsx         reading prefs, theme, grade, AI feedback toggle, backup export/import, clear data
    about/page.tsx, privacy/page.tsx, parents/page.tsx
    api/cron/ingest/route.ts, api/define/route.ts, api/feedback/route.ts, api/health/route.ts
    (route groups are allowed if they help share layouts — URLs above are what matter)
  components/
    ui/                       primitives (Button, Input, Segmented, Chip, Popover, Sheet, Toast, Skeleton, ...)
    ink/                      signature marks + generative story art + category glyphs
    layout/                   SiteNav, TabBar, Footer, Drawer
    story/                    StoryCard, CategoryTile, StoryArt, ...
    reader/, quiz/, words/, journal/, progress/   feature components
  lib/
    env.ts                    typed env access (zod)
    categories.ts             the 4 categories (slug, name, description, glyph key)
    db/index.ts, db/schema.ts, db/migrate.ts
    stories.ts                cached read queries for articles + lessons (tagged for revalidation)
    rate-limit.ts             IP-hash rate limiter + global caps
    request.ts                client IP extraction + salted hash, same-origin check
    progress/                 PURE, isomorphic: xp.ts, levels.ts, streak.ts, badges.ts, leitner.ts, stats.ts
    local/                    client store: schema.ts (zod, versioned), reducers.ts (pure), store.ts (useSyncExternalStore hooks), backup.ts (export/import/merge)
    news/                     feeds.ts, sources.ts, fetch.ts, parse.ts, safety.ts, ingest.ts, lock.ts, cleanup.ts, scheduler.ts, status.ts, revalidate.ts
    literacy/                 types.ts (zod), generate.ts, claude.ts, heuristic.ts, feedback-core.ts (isomorphic stats + heuristic feedback), feedback.ts (server, AI), readability.ts, wordlists.ts, samples.ts, seed.ts, prompts.ts
    ai/client.ts              Anthropic client factory + availability check
    dictionary.ts             define(word) with cache
    time.ts                   local-day math (IANA timezone, DST-safe) — isomorphic
  *.test.ts                   vitest unit tests next to modules
e2e/                          Playwright smoke tests (channel: 'chrome')
netlify.toml, netlify/functions/ingest-schedule.mts, vercel.json, .github/workflows/ingest.yml, .env.example
```

Parallel build rule: each builder owns the files listed in its brief. **Never run `npm install`** (all dependencies are installed; if something is truly missing, stop and report it). Never run `next build` during parallel feature work; a shared `next dev` server may be provided for visual checks. Type-check with `npx tsc --noEmit -p .` filtered to your files; run unit tests with `npx vitest run <path>`.

Installed: next 16.3.6, react 19.2.8, tailwindcss 4, drizzle-orm 0.45, drizzle-kit 0.31, postgres 3.4 (postgres.js), @electric-sql/pglite 0.5 (tests only), embedded-postgres 17.10 (dev only), zod 4, @anthropic-ai/sdk 0.128, rss-parser, @mozilla/readability, linkedom, motion 13, lucide-react, server-only, tsx, vitest 5, vite-tsconfig-paths, @playwright/test (use `channel: 'chrome'`), lighthouse 13.

---

## 3. Shared content database (Drizzle, Postgres / Supabase)

The server stores **no student data**. All tables are declared with `pgSchema('wiege')`. Ids are `text` (`crypto.randomUUID()`), timestamps `timestamp with time zone` (`mode: 'date'`), JSON columns `jsonb` with `$type<>()`.

Connection (`src/lib/db/index.ts`, `server-only`, singleton that survives HMR via `globalThis`): always `drizzle-orm/postgres-js` with `postgres(DATABASE_URL, { prepare: false, max: 5 })` (`prepare: false` is required for Supabase's transaction pooler on port 6543).
- **Production**: Supabase. Wiege **shares** the owner's existing Supabase project `sentinel-design-agent` (ref `<project-ref>`, eu-central-1, Postgres 17.6) with another app, isolated by a dedicated least-privilege login role **`wiege_app`** (no superuser, no BYPASSRLS, connection limit 20, `search_path = wiege`, `statement_timeout = 30s`) that owns schema **`wiege`** and has no access to any other schema's tables (verified). Connect through the pooler as user `wiege_app.<project-ref>`: `DATABASE_URL` = transaction pooler (port 6543), `MIGRATION_DATABASE_URL` = session pooler (port 5432), both `?sslmode=require`. The ready-made values are in the local `.env` as `WIEGE_SUPABASE_DATABASE_URL` / `WIEGE_SUPABASE_MIGRATION_URL` (not named `DATABASE_URL`, so local development is never pointed at production by accident).
- **Shared-database rules (critical)**: the other app already uses Drizzle with the default `drizzle.__drizzle_migrations` table. Wiege's migration history **must** live in its own schema: `drizzle.config.ts` → `migrations: { schema: 'wiege', table: '__wiege_migrations' }` and the runtime migrator → `migrate(db, { migrationsFolder: 'drizzle', migrationsSchema: 'wiege', migrationsTable: '__wiege_migrations' })`. The schema already exists in production (owned by `wiege_app`), so migrations must use `CREATE SCHEMA IF NOT EXISTS "wiege"`. Never reference objects outside `wiege`, never create extensions, roles or anything in `public`.
- **Local development**: a real Postgres 17 via the `embedded-postgres` dev dependency (no Docker needed). `scripts/dev/db.mjs start|stop|status|reset` initialises `./data/postgres` once (initdb flags `--encoding=UTF8 --locale=C`, user/password `postgres`), starts it **detached** with the bundled `pg_ctl` on port **54329**, creates database `wiege` if missing, and is idempotent. `npm run dev` ensures the DB is running first. When `DATABASE_URL` is unset and `NODE_ENV !== 'production'`, `lib/env.ts` defaults to `postgres://postgres:postgres@localhost:54329/wiege`.
- **Unit tests**: in-memory PGlite (`@electric-sql/pglite` + `drizzle-orm/pglite`) per test file with migrations applied — no server needed. A small `src/lib/db/testing.ts` helper creates it.
- Migrations (`drizzle-kit`, dialect `postgresql`, `schemaFilter: ['wiege']`) run with `MIGRATION_DATABASE_URL` if set (Supabase session pooler, port 5432), else `DATABASE_URL`. The first migration creates the schema; a follow-up SQL migration enables RLS on every table (`alter table wiege.<t> enable row level security;`) and revokes all on schema `wiege` from `anon, authenticated` (guarded with `do $$ ... if exists (select from pg_roles where rolname = 'anon') ... $$` so it also runs on PGlite).

- **sources**: `id` pk (slug) · `name` · `feedUrl` unique · `homepage` · `category` · `enabled` bool · `lastFetchedAt` · `lastError`.
- **articles**: `id` pk · `slug` unique (kebab title + 6-char hash) · `sourceId` fk · `category` · `title` · `url` unique · `author` nullable · `excerpt` (plain text ≤ 600 chars) · `publishedAt` · `fetchedAt` · `status` (`'pending'|'ready'|'rejected'|'failed'`) · `safety` json `{ safe, reasons: string[], method: 'blocklist'|'claude'|'seed' }` · `contentHash` · `isSample` bool default false. Indexes `(status, category, publishedAt desc)`, `(status, publishedAt desc)`.
- **lessons**: `articleId` pk fk (cascade) · `content` json `LessonContent` · `generator` (`'claude'|'heuristic'|'seed'`) · `model` nullable · `readingGrade` real · `createdAt`.
- **definitions**: `word` pk · `data` json `Definition | null` · `source` · `fetchedAt`.
- **ingestRuns**: `id` pk · `trigger` (`'cron'|'scheduler'|'manual'|'cli'`) · `startedAt` · `finishedAt` nullable · `status` (`'running'|'ok'|'partial'|'failed'`) · `stats` json · `error` nullable.
- **rateLimits**: `key` pk (e.g. `feedback:ip:<hash>`, `feedback:global:<day>`) · `count` · `resetAt`.

Migrations: `drizzle-kit generate` into `drizzle/`; `npm run db:migrate` applies them with the matching drizzle migrator (postgres-js or pglite); `instrumentation.ts` applies them on boot unless `WIEGE_AUTO_MIGRATE=0`. `npm run setup` = migrate + seed. `prebuild` runs migrate + seed (idempotent) because static pages read the DB at build time. Static pages must also build when the DB is empty (render honest empty states, never crash).

---

## 4. Local-first student data (no accounts)

`src/lib/local/schema.ts` defines the whole on-device state with zod, versioned (`version: 1`) with a migration hook:

```ts
LocalState = {
  version: 1
  createdAt: number
  prefs: { gradeBand: '7-8' | '9-10' | null, readingFont: 'book'|'clear', textSize: 's'|'m'|'l'|'xl',
           lineSpacing: 'normal'|'relaxed'|'loose', theme: 'system'|'light'|'dark', aiFeedback: boolean,
           readAloudRate: number, timezone: string }
  reads: Record<slug, { title, category, level, startedAt, completedAt?: number, quiz?: { score, total, answers: number[] } }>
  words: Record<word, { word, definition, example?, partOfSpeech?, storySlug?, storyTitle?, box: 1-5, dueAt, reviews, lapses, createdAt }>
  journal: Record<id, { id, storySlug?, storyTitle?, promptKind, prompt, body, wordCount, feedback?: WritingFeedback, createdAt, updatedAt }>
  activity: Array<{ day: 'YYYY-MM-DD', kind: 'read'|'quiz'|'word'|'review'|'journal', xp, ref?, at }>   // capped (e.g. last 400 days)
  badges: Record<badgeId, { awardedAt }>
  xp: number
  longestStreak: number
}
```

- `reducers.ts`: pure functions `(state, action, now) => { state, events }` for every mutation: `startRead`, `completeRead`, `submitQuiz`, `saveWord`, `removeWord`, `restoreWord`, `reviewWord`, `saveEntry`, `deleteEntry`, `setPrefs`, `importBackup`, `clearAll`. Awards (XP, streak, badges, levels per §7) are applied inside reducers and returned as `events` (`{ xpGained, newBadges, levelUp }`) so the UI can celebrate.
- `store.ts` (`'use client'`): loads/saves `localStorage['wiege:v1']` with try/catch; falls back to an in-memory store (and exposes `persistent: false` so the UI can say "Progress can't be saved in this browser mode"); debounced writes; cross-tab sync via the `storage` event; `useLocal(selector)` built on `useSyncExternalStore` with a server snapshot of `null` (= not hydrated yet — islands render a same-size placeholder); `dispatch(action)`.
- `backup.ts`: `exportBackup(state) → Blob` (`wiege-backup-YYYY-MM-DD.json`), `parseBackup(file)` (size cap 2 MB, zod-validated, version-migrated), `mergeBackups(a, b)` (union by key, newest `updatedAt` wins, XP recomputed from activity).
- Default timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Grade band: asked once, lightly (a two-option chip on Today and in the reader's level toggle); until chosen the reader shows Grade 7–8.

---

## 5. News ingestion (every 4 hours)

`runIngest({ trigger })` in `lib/news/ingest.ts`:
1. **Lock**: insert an `ingestRuns` row with `status='running'` only if no other run is `running` and younger than 20 minutes (stale ones → `failed`), atomically. Return `skipped` if locked.
2. **Fetch** every enabled source (10 s timeout, User-Agent `WiegeBot/1.0 (+<WIEGE_SITE_URL>/about)`, conditional GET where possible, ≤ 4 in flight, response size cap).
3. **Parse** with `rss-parser`; normalise to plain text (decode entities, strip tags via linkedom, collapse whitespace, excerpt ≤ 600 chars). Skip items older than 7 days, without a link, or already stored (URL or content hash).
4. **Safety** (`lib/news/safety.ts`, fail-closed): (a) source allowlist; (b) categorised word-boundary blocklist over title + excerpt (violence/weapons/war/terror, death/injury detail, sexual content, drugs/alcohol/vaping, gambling/betting/odds, self-harm, crime/court detail, profanity, horror/gore, mature-rated games, election politics) with an explicit, documented allowlist for sports/games false positives; (c) when Claude is available, a structured classification `{ suitableFor12to15, reasons }` — anything not clearly suitable is rejected. Rejected items are stored `status='rejected'` with reasons and never re-evaluated.
5. **Enrich**: new safe items (cap **6 per category per run**, newest first); optionally fetch the article page (5 s, ≤ 1.5 MB) and extract text with Readability + linkedom **for the model's context only — never stored or shown**; `generateLesson()`; concurrency 2; fall back to heuristic; else `failed`.
6. **Publish**: `status='ready'`; update source `lastFetchedAt/lastError`; finish the run with stats `{ fetched, new, rejected, ready, failed, bySource }`; trigger revalidation of `/`, `/today`, `/c/*` (tag `stories`) — `lib/news/revalidate.ts` (works when called inside the Next server; CLI runs rely on time-based ISR, or POST to the cron endpoint).
7. **Cleanup**: delete `rejected` articles older than 30 days and `ready` news older than 120 days (students' local journal/words keep title snapshots; a removed story's page shows a friendly "This story has moved on" 404).

**Time budget & resumability**: `runIngest({ trigger, budgetMs })`. Steps 1–4 are fast; new safe items are inserted as `pending` immediately. Step 5 enriches `pending` items oldest-first until the budget is spent (default: unlimited for `cli`/`scheduler`, `WIEGE_INGEST_BUDGET_MS` ≈ 20 000 for `cron` on serverless hosts), stopping before starting an item it can't finish. Claude safety classification is **batched** (one call for all new items of a run). Items left `pending` are picked up by the next run; `pending` items are never shown to students.

Triggers: `GET|POST /api/cron/ingest` (requires `Authorization: Bearer $CRON_SECRET`; in development allowed from localhost without a secret) · Netlify Scheduled Function `netlify/functions/ingest-schedule.mts` (calls the endpoint with the secret) · GitHub Actions `.github/workflows/ingest.yml` (every 4 hours: `npm ci && npm run ingest` with `DATABASE_URL`/`ANTHROPIC_API_KEY` secrets, then `POST` the cron endpoint with `?revalidateOnly=1` so pages refresh) · `vercel.json` cron · `scripts/ingest.ts` · `lib/news/scheduler.ts` started from `instrumentation.ts` when `WIEGE_SCHEDULER` is not `0` and not on a serverless host (`NETLIFY`, `VERCEL`), aligned to 00/04/08/12/16/20 UTC.

Curated feeds (`lib/news/feeds.ts`) — **each verified live by the ingestion builder**; keep 2–4 working, family-friendly sources per category and document why. Candidates: Writing — BBC Newsround, The Guardian Books, Book Riot, Publishers Weekly (children's); Games — Nintendo Life, Pocket Gamer, Push Square; Art — Colossal, My Modern Met, Smithsonian (arts & culture); Sports — BBC Sport, BBC Newsround sport, ESPN. Copyright: store only title, short excerpt, link; always attribute and link ("Read the original at <Source>").

---

## 6. Literacy engine

`lib/literacy/types.ts` — zod schemas, the single source of truth, also used for Claude structured outputs (closed objects, no numeric min/max):

```ts
GradeBand = '7-8' | '9-10'
LessonContent = {
  keyIdea: string
  levels: Record<GradeBand, { title: string; paragraphs: string[] }>   // original retelling; 180–260 words (7-8), 240–340 (9-10)
  vocabulary: Array<{ word, partOfSpeech, definition, example, band: GradeBand | 'both' }>   // 5–8 tier-2 words present in the retelling
  quiz: Array<{ id, skill: 'main-idea'|'detail'|'inference'|'vocabulary'|'purpose'|'sequence', question, choices: string[] /*4*/, answerIndex, explanation }>   // exactly 5
  writingPrompts: Array<{ id, kind: 'summary'|'headline'|'opinion'|'creative'|'letter', prompt, minWords, maxWords, tips: string[] }>   // exactly 3
  discussion: string[]   // 2
}
WritingFeedback = { glow: string[2], grow: string[2], nextStep, rubric: { ideas, organization, wordChoice, conventions } /*1-4*/,
                    usedVocabulary: string[], stats: { words, sentences, avgSentenceLength, uniqueWordRatio, longWords }, generator: 'claude'|'heuristic' }
Definition = { word, phonetic?, audioUrl?, meanings: [{ partOfSpeech, definitions: [{ definition, example? }] }] }
```

- **Claude path** (`literacy/claude.ts`): `client.beta.messages.parse({ model, max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { effort: 'medium', format: betaZodOutputFormat(Schema) }, system: [stable prompt], messages })`. Check `stop_reason` (`refusal` → heuristic; `max_tokens` → one retry with a trimmed source) before `parsed_output`; re-validate with zod; typed error handling (`Anthropic.RateLimitError`, `Anthropic.APIConnectionError`, `Anthropic.APIError`); never throw AI problems to callers. Article text is untrusted: wrap in `<article>` and tell the model to ignore instructions inside. Original retelling, accurate, warm not childish, suitable for 12–15. Re-scan generated text with the safety blocklist.
- **Heuristic path** (`literacy/heuristic.ts`, deterministic, offline, always schema-valid): retelling from the cleaned excerpt (7–8 splits long sentences); vocabulary from an embedded tier-2 word list (~400 words with kid-friendly definitions in `wordlists.ts`), falling back to long low-frequency words; quiz = vocabulary-in-context, cloze, headline match (vs. sibling titles), purpose/category, detail; prompts templated per category.
- **Writing feedback**: `feedback-core.ts` (isomorphic, runs in the browser) computes stats and a heuristic glow/grow/next step instantly and offline. `POST /api/feedback` (server, stateless, stores nothing): body `{ prompt, text, gradeBand, vocabulary }` (zod, text ≤ 6,000 chars), same-origin check, per-IP-hash limit (default 60/day — schools share IPs) and global cap `WIEGE_FEEDBACK_DAILY_CAP` (default 2000/day); if Claude is unavailable, over the cap, or the student turned AI feedback off, the client uses the heuristic result. Claude feedback: 2 glows quoting the student, 2 specific doable grows, 1 next step, rubric 1–4; never rewrites their work; never comments on identity. While waiting, the UI shows the **real** steps (labor illusion, honest): "Counting sentences" → "Checking your vocabulary words" → "Reading for ideas" → "Writing notes".
- **Readability**: syllables, Flesch–Kincaid grade, reading minutes (200 wpm 7–8, 230 wpm 9–10).
- **Practice stories** (`samples.ts`, seeded `isSample=true`, `generator='seed'`, source "Wiege practice"): 12 hand-written, evergreen, factually careful explainers (3 per category) with complete LessonContent. Labelled "Practice story" — never presented as news. `getLandingDemoStory()` returns one statically for the landing hero.

---

## 7. Progress, streaks, stamps (pure functions in `lib/progress`, applied on-device)

- **XP**: finish a story +10 · each correct quiz answer +5 · perfect quiz +5 bonus · save a word +2 (max 10/day) · flashcard review +1 (max 20/day) · journal entry reaching its prompt's `minWords` +15 (once per entry).
- **Levels**: Scribbler 0 · Reader 100 · Storyteller 300 · Wordsmith 700 · Editor 1500 · Author 3000 · Laureate 6000.
- **Streak**: a reading day = any `read` or `journal` activity in the device timezone. Current streak = consecutive reading days ending today, or ending yesterday. No guilt copy when it breaks — "Welcome back. Start a new streak today."
- **Stamps** (badges): first-story, first-word, words-10, words-50, first-entry, perfect-quiz, streak-3, streak-7, streak-30, all-four (a story from every category), writer-5, reviewer-50. Locked stamps show as outlines with how to earn them.
- **Leitner flashcards**: boxes 1–5, intervals 0, 1, 3, 7, 16 days. Again → box 1 due now; Hard → same box, half interval; Good → box+1; Easy → box+2 (max 5).

---

## 8. Pages (behaviour; visuals per DESIGN.md)

Everyone sees the same site; no page is gated. Global nav destinations: **Today, Explore, Words, Journal, Me** (desktop top nav; mobile bottom tab bar on app pages). The landing page's primary CTA is **Start reading** → `/today`.

- **`/` landing** — hero with a working tap-a-word demo on a practice story (value first), the four categories, a live preview of today's stories (ISR), how a story becomes a lesson (a real sequence), what you collect (words, streak, journal, stamps), privacy promises ("No accounts. No tracking. Your words and writing stay on your device."), closing CTA band ("Start reading" + "Free. No sign-up."), footer. No fabricated testimonials, counts or logos.
- **`/today`** — (static shell + islands) greeting; streak + words count from the local store; **Continue reading** (1–3 unfinished, from local reads) first; **Today's story** (from the server's newest-per-category set, the client picks the category read least); latest 3 per category with "See all"; flashcards due ("Practice 5 words"); honest freshness line from the last ingest ("Updated 2 hours ago"). Empty/first-visit state is onboarding: pick your grade (optional), start with today's story.
- **`/c`** explore (four category tiles with a line each + latest headline) · **`/c/[category]`** — ready stories newest first (static first page of 12, "Load more" via a small JSON route or server action), completed markers from local reads, practice stories after news. Unknown slug → 404.
- **`/read/[slug]`** — the core experience (static per story; `generateStaticParams` for recent stories, others rendered on demand and cached):
  - Header: category, level-adapted title, source attribution + original link, reading minutes, **level toggle** (Grade 7–8 / 9–10), **reading settings** (font Book/Clear, size S–XL, line spacing), **Listen** (Web Speech API read-aloud; current word highlighted with the CSS Custom Highlight API where supported; hidden if unsupported).
  - Body: vocabulary words are `<button>`s with the signature ink treatment → definition popover (bottom sheet on mobile) with example, part of speech, pronunciation audio if available, **Save to my words**. **Any other word**: tap/click resolves the word under the pointer (`document.caretPositionFromPoint` / `caretRangeFromPoint`, no per-word spans) → same popover via `/api/define`. Keyboard users: a "Look up a word" field, and selecting text shows a "Define" button. Desktop shows margin notes beside the paragraph containing each vocabulary word.
  - Quiz ("Check your understanding"): one question at a time, large choice cards, immediate feedback (right/wrong shown without colour) + explanation, "2 of 5", summary with XP and any new stamp. Submitting completes the story; "I finished reading" completes without the quiz.
  - Write: 3 prompt cards → inline editor (shared `WritingEditor`) with target range, vocabulary chips that tick when used, autosave to the local journal, "Get feedback".
  - "Talk about it" questions and "Read the original at <Source>".
- **`/words`** — saved words (search, sort A–Z / newest / due), due count, **Practice** → `/words/practice`: flip cards (Space flips, 1–4 grade), up to 20 due, summary. Remove with undo toast. Empty state teaches how to collect words and links to Today.
- **`/journal`** — entries newest first (story, prompt kind, word count, feedback status); **New entry** (free write or from a prompt); **`/journal/[id]`** editor with autosave, word count, feedback panel, delete with confirm. (Data is local, so these pages are static shells that render from the store.)
- **`/me`** — level + XP to next level, stat tiles (stories read, words collected, journal entries, best streak), 12-week reading calendar, stamps wall, link to Settings, backup reminder.
- **`/settings`** — grade band, reading prefs, theme, AI feedback toggle (with a plain explanation of what is sent), **Save a backup** (download), **Restore from a backup** (merge or replace, with preview of counts), **Clear everything on this device** (type-to-confirm).
- **`/about`, `/privacy`** (plain language: we have no accounts and store nothing about you; your progress lives in this browser; what is sent when you ask for AI feedback and that it isn't stored; how to back up, move or delete your data), **`/parents`** (for parents & teachers: how it works, safety filtering, sources, how progress stays on the device, contact via `WIEGE_CONTACT_EMAIL`).
- **404 / error** — on-brand, helpful, one action back.

Route handlers: `GET /api/define?w=` (public, zod-validated single word ≤ 40 chars, per-IP-hash limit 120/min, `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`), `POST /api/feedback` (above), `GET|POST /api/cron/ingest` (bearer secret, then revalidate), `GET /api/health` (DB ping, last ingest time/status/counts; no secrets).

---

## 9. Security, safety & privacy

- No accounts, no cookies, no PII. The server never stores student writing, words or progress. IP addresses are never stored raw — only `sha256(WIEGE_IP_SALT + ip)` inside expiring rate-limit keys.
- Validate every input with zod; parameterised queries only (Drizzle). POST route handlers verify `Origin` matches the site.
- Security headers in `next.config.ts`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/microphone/geolocation off), `X-Frame-Options: DENY`, `Strict-Transport-Security` in production; `poweredByHeader: false`.
- Kid-safety pipeline (§5) is fail-closed; generated text is re-scanned. Dictionary senses flagged vulgar/offensive/slang are dropped.
- AI feedback sends only the prompt, the text and the grade band — disclosed on /privacy and next to the button; can be turned off in Settings.
- Local store is validated on load and on import (never trust a backup file); render all student text as text (no `dangerouslySetInnerHTML`).
- Secrets only via env; `.env.example` documents every variable; `lib/env.ts` validates at boot.

## 10. Performance, SEO, accessibility

- Server Components by default; client islands only for interactivity. Keep per-route JS minimal; nothing heavy on the landing page.
- Fonts via `next/font/google` (self-hosted, `display: 'swap'`, `latin`, only the weights DESIGN.md lists).
- No layout shift: fixed aspect-ratio art, reserved space for local-store islands, skeletons that match final layout.
- Metadata on every page (title, description, canonical via `metadataBase` from `WIEGE_SITE_URL`, Open Graph + Twitter, monochrome `opengraph-image.tsx`), `robots.ts` (allow content pages; disallow `/api`, `/settings`, `/journal`, `/words`, `/me`), `sitemap.ts` (landing, info pages, category pages, recent stories), `manifest.ts`, `icon.svg` + apple icon, `theme-color` for light and dark, `lang="en"`. Personal pages (`/words`, `/journal`, `/me`, `/settings`) are `noindex`.
- WCAG 2.2 AA: landmarks, one `h1` per page, logical headings, labels on every control, visible focus, 44×44 targets, `prefers-reduced-motion`, computed contrast, skip link, `aria-live` for quiz feedback/toasts/autosave, no information by colour alone.

## 11. Testing & verification

- Unit (vitest): readability; heuristic lesson generator (always schema-valid); feedback-core stats; safety blocklist (true and false positives, explicit decisions for "shooting guard", "penalty shootout", "killer serve", "Pokémon battle", "battle royale"); feed normalisation with fixtures; time/streak math across timezones and DST; Leitner; XP caps; stamps; local-store reducers; backup parse/migrate/merge (malformed and hostile files); rate limiter; IP hashing; origin check.
- E2E (Playwright, `channel: 'chrome'`): open `/` → tap a word in the hero → Start reading → Today → open a story → tap a word → save it → quiz → write & autosave → Words practice → Me shows progress → Settings export → clear → import restores.
- Visual QA: `node scripts/dev/screenshot.mjs` at 360, 390, 768, 1440 (light + dark).
- Lighthouse: `node scripts/dev/lighthouse.mjs --strict` (mobile + desktop) on every page against a production build (`next build && next start`). All four categories must be 100.

## 12. Environment variables (`.env.example`)

`DATABASE_URL` (Supabase transaction pooler `postgresql://postgres.<ref>:<password>@<pooler-host>:6543/postgres`; unset in development → local embedded Postgres `postgres://postgres:postgres@localhost:54329/wiege`) · `MIGRATION_DATABASE_URL` (Supabase session pooler, port 5432; optional) · `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` (provisioning only, never read by the app) · `WIEGE_INGEST_BUDGET_MS` (default 20000 for serverless cron) · `ANTHROPIC_API_KEY` (optional) · `WIEGE_AI_MODEL` (default `claude-opus-5`) · `WIEGE_FEEDBACK_DAILY_CAP` (default 2000) · `WIEGE_IP_SALT` · `CRON_SECRET` · `WIEGE_SCHEDULER` (`1`/`0`) · `WIEGE_AUTO_MIGRATE` (`1`/`0`) · `WIEGE_SITE_URL` (default `http://localhost:3000`) · `WIEGE_CONTACT_EMAIL`.

## 13. Conventions

- Read the relevant guide in `node_modules/next/dist/docs/` before using any Next API — this is Next 16 (async `params`/`searchParams`, `after()`, ISR/revalidation, `instrumentation.ts`, etc.).
- `import 'server-only'` in every module that touches the DB, secrets or Claude. Modules in `lib/progress`, `lib/local` (except `store.ts` which is `'use client'`), `lib/time.ts`, `lib/literacy/feedback-core.ts`, `lib/literacy/readability.ts`, `lib/literacy/types.ts` and `lib/categories.ts` must stay isomorphic (no server-only imports).
- Named exports; files kebab-case except React components (PascalCase). Path alias `@/*` → `src/*`.
- Copy: sentence case, plain verbs, student's point of view, errors say what happened and how to fix it (see DESIGN.md voice rules). Never mention accounts, logging in or signing up.
