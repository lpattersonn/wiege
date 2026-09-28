import 'server-only';

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { getDb, isDatabaseUnavailableError, type Database } from '@/lib/db';
import { definitions } from '@/lib/db/schema';
import { siteUrl } from '@/lib/env';
import { Definition, type DefinitionMeaning } from '@/lib/literacy/types';
import { baseCandidates } from '@/lib/literacy/word-forms';
import { scanText } from '@/lib/news/safety';

/**
 * Word lookups for the reader (SPEC §1, §8, §9): the `definitions` cache table
 * first, then the free, keyless Free Dictionary API. Every word is fetched at
 * most once (misses are cached for a week). Senses labelled vulgar, offensive
 * or slang, and senses the kid-safety list flags as sexual, profane, hateful or
 * about self-harm, are dropped before anything is cached or shown.
 */

export const DICTIONARY_SOURCE = 'dictionaryapi.dev';
const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const TIMEOUT_MS = 3_000;
const MAX_RESPONSE_CHARS = 512 * 1024;
export const NEGATIVE_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

const MAX_MEANINGS = 4;
const MAX_SENSES_PER_MEANING = 3;
const MAX_DEFINITION_CHARS = 300;
const MAX_EXAMPLE_CHARS = 200;
/** How many dictionary forms ("discovery" for "discoveries") to try after a miss. */
const MAX_BASE_FORM_TRIES = 2;

export const MAX_WORD_LENGTH = 40;
// Letters joined by apostrophes or hyphens: "curious", "don't", "well-known", "café".
const LOOKUP_WORD = new RegExp("^\\p{L}+(?:['-]\\p{L}+)*$", 'u');

/** The cache key for a word typed or tapped by a student, or null if it is not a single word. */
export function normalizeLookupWord(raw: string): string | null {
  const word = raw.normalize('NFC').trim().replace(/[’‘]/g, "'").toLowerCase();
  if (!word || word.length > MAX_WORD_LENGTH || !LOOKUP_WORD.test(word)) return null;
  return word;
}

// --- upstream response ------------------------------------------------------------

const optionalText = z.string().nullish();

const UpstreamEntry = z.object({
  word: z.string(),
  phonetic: optionalText,
  phonetics: z.array(z.object({ text: optionalText, audio: optionalText })).nullish(),
  meanings: z
    .array(
      z.object({
        partOfSpeech: optionalText,
        definitions: z.array(z.object({ definition: optionalText, example: optionalText })).nullish(),
      }),
    )
    .nullish(),
});
const UpstreamResponse = z.array(UpstreamEntry);
type UpstreamEntry = z.infer<typeof UpstreamEntry>;

// Wiktionary-style usage labels that mark a sense as unsuitable for students.
const FLAGGED_LABEL = /\b(?:vulgar|offensive|slang|derogatory|pejorative|obscene|slur|profan\w*|taboo|ethnic)\b/i;
const BLOCKED_SAFETY_CATEGORIES = ['sexual', 'profanity', 'hate', 'self-harm'] as const;

function hasBlockedContent(text: string): boolean {
  return scanText(text).reasons.some((reason) => BLOCKED_SAFETY_CATEGORIES.some((category) => reason.startsWith(`${category}:`)));
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function httpsAudio(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const absolute = url.startsWith('//') ? `https:${url}` : url;
  return /^https:\/\/[^\s]+$/.test(absolute) ? absolute : undefined;
}

/**
 * Normalises Free Dictionary entries into one kid-safe `Definition`: meanings
 * merged by part of speech (at most 4, 3 senses each), flagged senses dropped,
 * a pronunciation and https audio when available. Null when nothing is left.
 */
export function normalizeEntries(requested: string, entries: readonly UpstreamEntry[]): Definition | null {
  if (entries.length === 0) return null;
  const headword = entries[0].word.trim().toLowerCase() || requested;
  if (hasBlockedContent(headword) || hasBlockedContent(requested)) return null;

  const meanings: DefinitionMeaning[] = [];
  for (const entry of entries) {
    for (const meaning of entry.meanings ?? []) {
      const partOfSpeech = meaning.partOfSpeech?.trim().toLowerCase() || 'word';
      let target = meanings.find((m) => m.partOfSpeech === partOfSpeech);
      for (const sense of meaning.definitions ?? []) {
        const definition = sense.definition?.trim();
        if (!definition) continue;
        const example = sense.example?.trim() || undefined;
        const combined = `${definition} ${example ?? ''}`;
        if (FLAGGED_LABEL.test(combined) || hasBlockedContent(combined)) continue;
        if (!target) {
          if (meanings.length >= MAX_MEANINGS) break;
          target = { partOfSpeech, definitions: [] };
          meanings.push(target);
        }
        if (target.definitions.length >= MAX_SENSES_PER_MEANING) break;
        target.definitions.push({
          definition: clip(definition, MAX_DEFINITION_CHARS),
          ...(example ? { example: clip(example, MAX_EXAMPLE_CHARS) } : {}),
        });
      }
    }
  }
  if (meanings.length === 0) return null;

  const phonetics = entries.flatMap((e) => e.phonetics ?? []);
  const phonetic = entries.find((e) => e.phonetic?.trim())?.phonetic?.trim() || phonetics.find((p) => p.text?.trim())?.text?.trim();
  const audios = phonetics.map((p) => httpsAudio(p.audio)).filter((a): a is string => Boolean(a));
  const audioUrl = audios.find((a) => /-uk\.mp3$/.test(a)) ?? audios[0];

  const parsed = Definition.safeParse({
    word: headword,
    ...(phonetic ? { phonetic: clip(phonetic, 80) } : {}),
    ...(audioUrl ? { audioUrl } : {}),
    meanings,
  });
  return parsed.success ? parsed.data : null;
}

// --- fetching ---------------------------------------------------------------------

export type LookupResult = { status: 'found'; definition: Definition } | { status: 'not-found' } | { status: 'unavailable' };

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface LookupOptions {
  db?: Database;
  fetch?: FetchLike;
  now?: Date;
}

async function fetchUpstream(word: string, fetchImpl: FetchLike): Promise<LookupResult> {
  try {
    const response = await fetchImpl(`${API_BASE}${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json', 'user-agent': `WiegeBot/1.0 (+${siteUrl()}/about)` },
      cache: 'no-store',
    });
    if (response.status === 404) return { status: 'not-found' };
    if (!response.ok) return { status: 'unavailable' };
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > MAX_RESPONSE_CHARS) return { status: 'unavailable' };
    const body = await response.text();
    if (body.length > MAX_RESPONSE_CHARS) return { status: 'unavailable' };
    const parsed = UpstreamResponse.safeParse(JSON.parse(body));
    if (!parsed.success) return { status: 'unavailable' };
    const definition = normalizeEntries(word, parsed.data);
    return definition ? { status: 'found', definition } : { status: 'not-found' };
  } catch (error) {
    console.warn(`[dictionary] lookup failed for a word: ${error instanceof Error ? error.name : 'error'}`);
    return { status: 'unavailable' };
  }
}

type CacheHit = { status: 'found'; definition: Definition } | { status: 'not-found' } | null;

async function readCache(db: Database, word: string, now: Date): Promise<CacheHit> {
  try {
    const [row] = await db
      .select({ data: definitions.data, fetchedAt: definitions.fetchedAt })
      .from(definitions)
      .where(eq(definitions.word, word))
      .limit(1);
    if (!row) return null;
    if (row.data === null) return now.getTime() - row.fetchedAt.getTime() < NEGATIVE_CACHE_MS ? { status: 'not-found' } : null;
    const parsed = Definition.safeParse(row.data);
    return parsed.success ? { status: 'found', definition: parsed.data } : null;
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) console.error('[dictionary] cache read failed', error);
    return null;
  }
}

async function writeCache(db: Database, word: string, data: Definition | null, now: Date): Promise<void> {
  try {
    await db
      .insert(definitions)
      .values({ word, data, source: DICTIONARY_SOURCE, fetchedAt: now })
      .onConflictDoUpdate({ target: definitions.word, set: { data, source: DICTIONARY_SOURCE, fetchedAt: now } });
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) console.error('[dictionary] cache write failed', error);
  }
}

async function lookupOne(db: Database, word: string, fetchImpl: FetchLike, now: Date): Promise<LookupResult> {
  const cached = await readCache(db, word, now);
  if (cached) return cached;
  const result = await fetchUpstream(word, fetchImpl);
  if (result.status !== 'unavailable') await writeCache(db, word, result.status === 'found' ? result.definition : null, now);
  return result;
}

/**
 * Looks a word up: cache, then the Free Dictionary API, then (after a miss)
 * up to two dictionary forms such as "discovery" for "discoveries". Upstream
 * failures are reported as `unavailable` and are not cached.
 */
export async function lookupDefinition(word: string, opts: LookupOptions = {}): Promise<LookupResult> {
  const normalized = normalizeLookupWord(word);
  if (!normalized) return { status: 'not-found' };
  const db = opts.db ?? getDb();
  const fetchImpl = opts.fetch ?? fetch;
  const now = opts.now ?? new Date();

  const direct = await lookupOne(db, normalized, fetchImpl, now);
  if (direct.status !== 'not-found') return direct;

  const bases = [...new Set(baseCandidates(normalized).slice(1).map((c) => c.base))].slice(0, MAX_BASE_FORM_TRIES);
  for (const base of bases) {
    const result = await lookupOne(db, base, fetchImpl, now);
    if (result.status === 'found') {
      await writeCache(db, normalized, result.definition, now);
      return result;
    }
  }
  return direct;
}

/** Looks a word up via the `definitions` cache, then the Free Dictionary API. */
export async function define(word: string, opts: LookupOptions = {}): Promise<Definition | null> {
  const result = await lookupDefinition(word, opts);
  return result.status === 'found' ? result.definition : null;
}
