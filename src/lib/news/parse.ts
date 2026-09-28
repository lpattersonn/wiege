import 'server-only';

import { createHash } from 'node:crypto';

import { parseHTML } from 'linkedom';
import Parser from 'rss-parser';
import { z } from 'zod';

import type { CategorySlug } from '@/lib/categories';

import { isAllowedHost, routeCategory, type FeedDefinition } from './feeds';

/**
 * Feed parsing and normalisation (SPEC §5 step 3). Feeds are untrusted input:
 * every field is validated, converted to plain text and length-capped, and
 * links must stay on the feed's own hosts. Only the title, a short excerpt and
 * the link are ever kept (copyright: we attribute and link, never republish).
 */

export const MAX_ITEMS_PER_FEED = 100;
export const EXCERPT_MAX_CHARS = 600;
export const TITLE_MAX_CHARS = 300;
export const AUTHOR_MAX_CHARS = 120;
/** Shorter descriptions cannot carry a lesson. */
export const EXCERPT_MIN_CHARS = 40;
export const MAX_ITEM_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Publishers' clocks drift; anything further ahead than this is rejected as bogus. */
export const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/** One feed entry with every field reduced to plain strings. */
export interface RawFeedItem {
  title: string;
  link: string;
  guid: string;
  date: string;
  author: string;
  /** Description or summary (HTML allowed). */
  summaryHtml: string;
  /** Full content (`content:encoded`), used only when there is no summary. */
  contentHtml: string;
  tags: string[];
}

export interface CandidateItem {
  sourceId: string;
  category: CategorySlug;
  title: string;
  url: string;
  excerpt: string;
  author: string | null;
  publishedAt: Date;
  contentHash: string;
  slug: string;
}

export type SkipReason =
  | 'no-title'
  | 'no-link'
  | 'bad-link'
  | 'off-site-link'
  | 'media-link'
  | 'roundup'
  | 'no-date'
  | 'too-old'
  | 'future-date'
  | 'no-excerpt'
  | 'no-category';

export type NormalizeResult = { ok: true; item: CandidateItem } | { ok: false; reason: SkipReason };

export class FeedParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedParseError';
  }
}

// --- raw feed -> RawFeedItem ------------------------------------------------------

const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'dcCreator'],
      ['description', 'description'],
    ],
  },
});

/** xml2js yields strings, `{ _: text, $: attrs }` objects or arrays of either. */
export function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length > 0 ? asText(value[0]) : '';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record._ === 'string') return record._;
    if (typeof record.href === 'string') return record.href;
    if (record.$ && typeof record.$ === 'object' && typeof (record.$ as Record<string, unknown>).href === 'string') {
      return (record.$ as Record<string, string>).href;
    }
    if (typeof record.name === 'string') return record.name;
  }
  return '';
}

function asTextList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return values.map(asText).map((tag) => tag.trim()).filter(Boolean).slice(0, 30);
}

// Every field is optional: feeds omit whatever they like.
const optional = z.unknown().optional();
const RawEntrySchema = z.looseObject({
  title: optional,
  link: optional,
  guid: optional,
  id: optional,
  isoDate: optional,
  pubDate: optional,
  creator: optional,
  dcCreator: optional,
  author: optional,
  description: optional,
  summary: optional,
  content: optional,
  contentEncoded: optional,
  categories: optional,
});

function toRawItem(entry: unknown): RawFeedItem | null {
  const parsed = RawEntrySchema.safeParse(entry);
  if (!parsed.success) return null;
  const e = parsed.data;
  const summaryHtml = asText(e.description) || asText(e.summary) || asText(e.content);
  return {
    title: asText(e.title),
    link: asText(e.link),
    guid: asText(e.guid) || asText(e.id),
    date: asText(e.isoDate) || asText(e.pubDate),
    author: asText(e.dcCreator) || asText(e.creator) || asText(e.author),
    summaryHtml,
    contentHtml: asText(e.contentEncoded),
    tags: asTextList(e.categories),
  };
}

/** Parses RSS 2.0, RSS 1.0 or Atom. Throws `FeedParseError` for anything else. */
export async function parseFeed(xml: string): Promise<RawFeedItem[]> {
  let output: { items?: unknown };
  try {
    output = await parser.parseString(xml);
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new FeedParseError(`could not parse feed: ${message}`);
  }
  const items = Array.isArray(output.items) ? output.items : [];
  return items
    .slice(0, MAX_ITEMS_PER_FEED)
    .map(toRawItem)
    .filter((item): item is RawFeedItem => item !== null);
}

// --- text -------------------------------------------------------------------------

const BLOCK_END = /<\/(?:p|div|li|ul|ol|h[1-6]|blockquote|figcaption|figure|tr|table|section|article|header|footer)\s*>|<br\s*\/?>/gi;

/**
 * HTML (or plain text with entities) to plain text. Scripts, styles and
 * embeds are dropped; block boundaries become line breaks so boilerplate
 * lines can be removed before the text is collapsed.
 */
export function htmlToText(html: string): string {
  if (!/[<&]/.test(html)) return collapseLines(html);
  const { document } = parseHTML(`<!doctype html><html><body>${html.replace(BLOCK_END, '$&\n')}</body></html>`);
  for (const node of document.querySelectorAll('script, style, noscript, template, iframe, object, embed, svg, form')) {
    node.remove();
  }
  return collapseLines(document.body?.textContent ?? '');
}

function collapseLines(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t\f\v ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export const collapseWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Cuts `text` to at most `max` characters, preferring a sentence end, then a word end. */
export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const sentenceEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (sentenceEnd >= max * 0.6) return slice.slice(0, sentenceEnd + 1);
  const wordEnd = slice.lastIndexOf(' ');
  return `${(wordEnd >= max * 0.6 ? slice.slice(0, wordEnd) : slice).replace(/[\s,;:–—-]+$/, '')}…`;
}

const GENERIC_BOILERPLATE: readonly RegExp[] = [
  /(?:^|\n)(?:The post|The article) [^\n]{0,400}? appeared first on [^\n]{0,200}$/i,
  /\s*(?:…|\.\.\.)?\s*\[\s*(?:more|read more)\s*\]\s*$/i,
  /\s*(?:Continue reading|Read more|Read the full (?:story|article))\b[^\n]*$/i,
  // "by Author Name" bylines that open some blog feeds.
  /^by [^\n]{1,80}\n/i,
];

/** Plain-text excerpt: boilerplate removed, a repeated title dropped, whitespace collapsed, capped. */
export function makeExcerpt(html: string, opts: { title: string; boilerplate?: readonly RegExp[] }): string {
  let text = htmlToText(html);
  for (const pattern of [...(opts.boilerplate ?? []), ...GENERIC_BOILERPLATE]) text = text.replace(pattern, '');
  // A feed's own "[…]" marks text it cut short; keep that honest with an ellipsis mid-sentence.
  text = text.replace(/\s*\[(?:…|\.\.\.)\]\s*$/, (_match, offset: number) => (/[.!?]$/.test(text.slice(0, offset)) ? '' : '…'));
  const lines = text.split('\n');
  if (lines.length > 1 && normalizeForHash(lines[0]) === normalizeForHash(opts.title)) lines.shift();
  return truncateText(collapseWhitespace(lines.join('\n')), EXCERPT_MAX_CHARS);
}

// --- urls, hashes, slugs ------------------------------------------------------------

const TRACKING_PARAM = /^(?:utm_\w+|at_\w+|fbclid|gclid|dclid|mc_cid|mc_eid|adt_\w+|ocid|cmpid|xtor|ito|_ga|s_cid|ref|ref_src|src|campaign_id)$/i;

/**
 * Canonical https link on one of the feed's hosts with tracking parameters
 * (and unfilled `{{ template }}` placeholders) removed, or a skip reason.
 */
export function normalizeLink(
  raw: string,
  feed: Pick<FeedDefinition, 'homepage' | 'allowedHosts'>,
): { ok: true; url: string } | { ok: false; reason: 'no-link' | 'bad-link' | 'off-site-link' } {
  const value = raw.trim();
  if (!value) return { ok: false, reason: 'no-link' };
  let url: URL;
  try {
    url = new URL(value, feed.homepage);
  } catch {
    return { ok: false, reason: 'bad-link' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: 'bad-link' };
  if (url.username || url.password) return { ok: false, reason: 'bad-link' };
  if (!isAllowedHost(url.hostname, feed.allowedHosts)) return { ok: false, reason: 'off-site-link' };
  url.protocol = 'https:';
  url.port = '';
  url.hash = '';
  for (const [key, paramValue] of [...url.searchParams]) {
    if (TRACKING_PARAM.test(key) || paramValue.includes('{{')) url.searchParams.delete(key);
  }
  const href = url.toString();
  return href.length > 2000 ? { ok: false, reason: 'bad-link' } : { ok: true, url: href };
}

// Built with RegExp() because the tsconfig target (ES2017) rejects \p{...} in literals.
const NON_WORD_RUN = new RegExp('[^\\p{L}\\p{N}]+', 'gu');
const COMBINING_MARKS = new RegExp('\\p{M}+', 'gu');

export function normalizeForHash(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(NON_WORD_RUN, ' ').trim();
}

/** Identifies the same story syndicated under different URLs. */
export function contentHash(title: string, excerpt: string): string {
  return createHash('sha256')
    .update(`${normalizeForHash(title)}\n${normalizeForHash(excerpt).slice(0, 300)}`)
    .digest('hex');
}

const SLUG_WORDS_MAX_CHARS = 80;

/** Kebab-case title plus a 6-character hash of the URL, e.g. `minecraft-gets-a-new-dimension-3f9a1c`. */
export function makeSlug(title: string, url: string): string {
  const words = title
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  let base = words.slice(0, SLUG_WORDS_MAX_CHARS);
  if (words.length > SLUG_WORDS_MAX_CHARS && base.includes('-')) base = base.slice(0, base.lastIndexOf('-'));
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 6);
  return `${base || 'story'}-${hash}`;
}

// --- item normalisation ---------------------------------------------------------------

function parseDate(value: string): Date | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time) : null;
}

/** Turns one raw entry into a candidate article, or says why it is skipped. */
export function normalizeItem(raw: RawFeedItem, feed: FeedDefinition, now: Date): NormalizeResult {
  const title = truncateText(collapseWhitespace(htmlToText(raw.title)), TITLE_MAX_CHARS);
  if (!title) return { ok: false, reason: 'no-title' };
  if (feed.skipTitles?.some((pattern) => pattern.test(title))) return { ok: false, reason: 'roundup' };

  // A permalink guid stands in for a missing <link>.
  const link = normalizeLink(raw.link || (/^https?:\/\//i.test(raw.guid) ? raw.guid : ''), feed);
  if (!link.ok) return { ok: false, reason: link.reason };
  if (feed.skipLinks?.some((pattern) => pattern.test(link.url))) return { ok: false, reason: 'media-link' };

  const published = parseDate(raw.date);
  if (!published) return { ok: false, reason: 'no-date' };
  const age = now.getTime() - published.getTime();
  if (age > MAX_ITEM_AGE_MS) return { ok: false, reason: 'too-old' };
  if (age < -FUTURE_TOLERANCE_MS) return { ok: false, reason: 'future-date' };
  const publishedAt = age < 0 ? now : published;

  const excerpt = makeExcerpt(raw.summaryHtml || raw.contentHtml, { title, boilerplate: feed.excerptBoilerplate });
  if (excerpt.length < EXCERPT_MIN_CHARS) return { ok: false, reason: 'no-excerpt' };

  const category = routeCategory(feed, { title, excerpt, tags: raw.tags });
  if (!category) return { ok: false, reason: 'no-category' };

  const author = truncateText(collapseWhitespace(htmlToText(raw.author)), AUTHOR_MAX_CHARS) || null;
  return {
    ok: true,
    item: {
      sourceId: feed.id,
      category,
      title,
      url: link.url,
      excerpt,
      author,
      publishedAt,
      contentHash: contentHash(title, excerpt),
      slug: makeSlug(title, link.url),
    },
  };
}
