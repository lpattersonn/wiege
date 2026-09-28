import 'server-only';

import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

import { isAllowedHost } from './feeds';

/**
 * Outbound HTTP for ingestion (SPEC §5 steps 2 and 5): polite, bounded and
 * never trusting the remote side. Every request has a timeout and a response
 * size cap enforced while streaming, so a slow or huge response cannot stall
 * or exhaust a run.
 */

export const FEED_TIMEOUT_MS = 10_000;
export const FEED_MAX_BYTES = 3 * 1024 * 1024;
export const ARTICLE_TIMEOUT_MS = 5_000;
export const ARTICLE_MAX_BYTES = 1.5 * 1024 * 1024;
/** Article text passed to the model is capped; it is never stored or shown. */
export const ARTICLE_TEXT_MAX_CHARS = 20_000;
export const MAX_FEEDS_IN_FLIGHT = 4;

export type FetchErrorCode = 'timeout' | 'too-large' | 'http' | 'network' | 'off-site-redirect';

export class FetchError extends Error {
  constructor(
    message: string,
    readonly code: FetchErrorCode,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export type FetchImpl = (input: string, init: RequestInit) => Promise<Response>;

export function userAgent(siteUrl: string): string {
  return `WiegeBot/1.0 (+${siteUrl}/about)`;
}

export interface FeedValidators {
  etag: string | null;
  lastModified: string | null;
}

export type FeedFetchResult =
  | { status: 'ok'; body: string; validators: FeedValidators }
  | { status: 'not-modified' };

export interface FetchOptions {
  userAgent: string;
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: FetchImpl;
}

/** Feeds may redirect only within their own host (and its subdomains). */
const ownHost = (url: string) => [new URL(url).hostname];

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
export const MAX_REDIRECTS = 5;

/**
 * GET with a timeout that also bounds reading the body. Redirects are
 * followed by hand so every hop must stay on `allowedHosts` (over http or
 * https): an open redirect on a news site cannot send us anywhere else.
 */
async function request(
  url: string,
  init: RequestInit,
  opts: { timeoutMs: number; fetchImpl: FetchImpl; allowedHosts: readonly string[] },
): Promise<Response> {
  const signal = AbortSignal.timeout(opts.timeoutMs);
  let current = url;
  for (let hop = 0; ; hop++) {
    let response: Response;
    try {
      response = await opts.fetchImpl(current, { ...init, redirect: 'manual', signal });
    } catch (error) {
      if (isAbortError(error)) throw new FetchError(`timed out after ${opts.timeoutMs} ms`, 'timeout');
      const reason = error instanceof Error ? (error.cause instanceof Error ? error.cause.message : error.message) : String(error);
      throw new FetchError(`network error: ${reason}`, 'network');
    }
    if (!REDIRECT_STATUSES.has(response.status)) return response;

    await response.body?.cancel().catch(() => {});
    const location = response.headers.get('location');
    if (!location) throw new FetchError(`HTTP ${response.status} without a Location header`, 'http', response.status);
    if (hop >= MAX_REDIRECTS) throw new FetchError(`more than ${MAX_REDIRECTS} redirects`, 'http', response.status);
    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      throw new FetchError('redirected to an invalid URL', 'http', response.status);
    }
    if ((next.protocol !== 'https:' && next.protocol !== 'http:') || !isAllowedHost(next.hostname, opts.allowedHosts)) {
      throw new FetchError(`redirected off-site to ${next.hostname}`, 'off-site-redirect', response.status);
    }
    current = next.toString();
  }
}

/** Charset from `Content-Type`, else from the XML declaration, else UTF-8. */
export function detectCharset(contentType: string | null, head: Uint8Array): string {
  const fromHeader = /charset=["']?([\w.:-]+)/i.exec(contentType ?? '')?.[1];
  const prolog = new TextDecoder('latin1').decode(head.subarray(0, 200));
  const fromProlog = /<\?xml[^>]*encoding=["']([\w.:-]+)["']/i.exec(prolog)?.[1];
  const candidate = (fromHeader ?? fromProlog ?? 'utf-8').toLowerCase();
  try {
    new TextDecoder(candidate);
    return candidate;
  } catch {
    return 'utf-8';
  }
}

/** Reads a response body as text, failing once it grows past `maxBytes`. */
export async function readTextCapped(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new FetchError(`response is ${declared} bytes (limit ${maxBytes})`, 'too-large');
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (response.body) {
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new FetchError(`response exceeded ${maxBytes} bytes`, 'too-large');
        }
        chunks.push(value);
      }
    } catch (error) {
      if (error instanceof FetchError) throw error;
      if (isAbortError(error)) throw new FetchError('timed out while reading the response', 'timeout');
      throw new FetchError(`failed to read the response: ${error instanceof Error ? error.message : String(error)}`, 'network');
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder(detectCharset(response.headers.get('content-type'), bytes)).decode(bytes);
}

/** Fetches a feed with a conditional GET when validators from the last fetch are known. */
export async function fetchFeed(url: string, validators: FeedValidators, opts: FetchOptions): Promise<FeedFetchResult> {
  const headers: Record<string, string> = {
    'User-Agent': opts.userAgent,
    Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5',
  };
  if (validators.etag) headers['If-None-Match'] = validators.etag;
  if (validators.lastModified) headers['If-Modified-Since'] = validators.lastModified;

  const response = await request(url, { headers }, {
    timeoutMs: opts.timeoutMs ?? FEED_TIMEOUT_MS,
    fetchImpl: opts.fetchImpl ?? fetch,
    allowedHosts: ownHost(url),
  });
  if (response.status === 304) {
    await response.body?.cancel().catch(() => {});
    return { status: 'not-modified' };
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new FetchError(`HTTP ${response.status}`, 'http', response.status);
  }
  const body = await readTextCapped(response, opts.maxBytes ?? FEED_MAX_BYTES);
  return {
    status: 'ok',
    body,
    validators: { etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified') },
  };
}

/** Readable text of an HTML page (Readability over linkedom), or null when nothing useful is found. */
export function extractArticleText(html: string, maxChars = ARTICLE_TEXT_MAX_CHARS): string | null {
  const { document } = parseHTML(html);
  // linkedom implements the DOM subset Readability uses; its types differ from lib.dom's.
  const article = new Readability(document as unknown as Document, { charThreshold: 300 }).parse();
  const text = article?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  if (text.length < 200) return null;
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/**
 * The article's own text, used only as context for lesson generation (never
 * stored or shown). Any failure returns null: the lesson then uses the excerpt.
 * Redirects off the feed's own hosts are refused.
 */
export async function fetchArticleText(
  url: string,
  allowedHosts: readonly string[],
  opts: FetchOptions,
): Promise<string | null> {
  try {
    if (!isAllowedHost(new URL(url).hostname, allowedHosts)) return null;
    const response = await request(
      url,
      { headers: { 'User-Agent': opts.userAgent, Accept: 'text/html,application/xhtml+xml;q=0.9' } },
      { timeoutMs: opts.timeoutMs ?? ARTICLE_TIMEOUT_MS, fetchImpl: opts.fetchImpl ?? fetch, allowedHosts },
    );
    if (!response.ok || !/html/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel().catch(() => {});
      return null;
    }
    return extractArticleText(await readTextCapped(response, opts.maxBytes ?? ARTICLE_MAX_BYTES));
  } catch {
    return null;
  }
}

/** Runs `fn` over `items` with at most `limit` calls in flight; results keep input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
