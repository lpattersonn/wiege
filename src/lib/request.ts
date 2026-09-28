import 'server-only';

import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

import { ipSalt, siteUrl } from '@/lib/env';

/**
 * Request helpers for route handlers (SPEC §9): client IP → salted hash (raw IPs
 * are never stored or logged) and a same-origin check for POST routes.
 */

/**
 * Most trustworthy first: Netlify sets `x-nf-client-connection-ip` itself;
 * Vercel and most proxies overwrite `x-real-ip`; `x-forwarded-for` can carry
 * client-supplied entries, so it is only the last resort.
 */
const IP_HEADERS = ['x-nf-client-connection-ip', 'x-real-ip', 'x-forwarded-for'] as const;

const IPV4_WITH_PORT = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/;
const BRACKETED_IPV6 = /^\[([^\]]+)\](?::\d{1,5})?$/;
const IPV4_MAPPED_IPV6 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/** Canonical form of one header value (strips ports, zone ids, IPv4-mapped prefixes), or null. */
export function normalizeIp(raw: string): string | null {
  let value = raw.trim().replace(/^"|"$/g, '');
  if (!value) return null;
  const bracketed = BRACKETED_IPV6.exec(value);
  if (bracketed) value = bracketed[1];
  const withPort = IPV4_WITH_PORT.exec(value);
  if (withPort) value = withPort[1];
  value = value.replace(/%[\w.-]+$/, '');
  const mapped = IPV4_MAPPED_IPV6.exec(value);
  if (mapped) value = mapped[1];
  const version = isIP(value);
  if (version === 4) return value;
  if (version === 6) return value.toLowerCase();
  return null;
}

export function getClientIp(headers: Headers): string | null {
  for (const name of IP_HEADERS) {
    const raw = headers.get(name);
    if (!raw) continue;
    const candidate = name === 'x-forwarded-for' ? raw.split(',')[0] : raw;
    const ip = normalizeIp(candidate);
    if (ip) return ip;
  }
  return null;
}

/** The eight 16-bit groups of a valid IPv6 address. */
function ipv6Groups(ip: string): number[] {
  let address = ip;
  const embedded = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
  if (embedded) {
    const [a, b, c, d] = embedded[1].split('.').map(Number);
    address = `${address.slice(0, embedded.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const missing = tail === undefined ? 0 : 8 - left.length - right.length;
  return [...left, ...Array<string>(missing).fill('0'), ...right].map((group) => parseInt(group, 16));
}

/**
 * What a rate limit counts: an IPv4 address, or an IPv6 /64 network (one
 * household or device usually owns a whole /64 and can rotate within it).
 */
export function rateLimitSubject(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  return `${ipv6Groups(ip)
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(':')}::/64`;
}

/** `sha256(WIEGE_IP_SALT + ip)` as hex (SPEC §9). */
export function hashIp(ip: string, salt: string = ipSalt()): string {
  return createHash('sha256').update(salt + ip).digest('hex');
}

/** Salted hash identifying the requester for rate limits; requests without an IP share one bucket. */
export function clientKey(headers: Headers, salt: string = ipSalt()): string {
  const ip = getClientIp(headers);
  return hashIp(ip ? rateLimitSubject(ip) : 'unknown', salt);
}

function toOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * True when a state-changing request comes from this site. Browsers always
 * send `Origin` on cross-origin POSTs and page scripts cannot forge it (nor
 * `Host`), so the Origin must equal the configured site origin or the origin
 * the request was addressed to (deploy previews, localhost ports). Without an
 * Origin, only an explicit `Sec-Fetch-Site: same-origin` is accepted.
 */
export function isSameOriginRequest(request: Request, opts: { siteUrl?: string } = {}): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return request.headers.get('sec-fetch-site') === 'same-origin';
  const actual = toOrigin(origin);
  if (!actual) return false;

  const allowed = new Set<string>();
  const configured = toOrigin(opts.siteUrl ?? siteUrl());
  if (configured) allowed.add(configured);
  const requestOrigin = toOrigin(request.url);
  if (requestOrigin) allowed.add(requestOrigin);
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host');
  if (host) {
    const fallbackProto = requestOrigin ? requestOrigin.slice(0, requestOrigin.indexOf(':')) : 'https';
    const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || fallbackProto;
    const forwarded = toOrigin(`${proto}://${host}`);
    if (forwarded) allowed.add(forwarded);
  }
  return allowed.has(actual);
}

/**
 * Reads a request body as UTF-8 text, stopping as soon as it exceeds
 * `maxBytes` (a declared Content-Length is checked first). Returns null when
 * the body is too large, so a chunked upload cannot exhaust memory.
 */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
