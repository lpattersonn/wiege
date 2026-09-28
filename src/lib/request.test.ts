import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { clientKey, getClientIp, hashIp, isSameOriginRequest, normalizeIp, rateLimitSubject, readBodyCapped } from './request';

const SALT = 'test-salt-0123456789abcdef';

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

function post(url: string, init: Record<string, string> = {}): Request {
  return new Request(url, { method: 'POST', headers: init });
}

describe('client IP', () => {
  it('prefers Netlify, then x-real-ip, then the first x-forwarded-for entry', () => {
    expect(getClientIp(headers({ 'x-forwarded-for': '1.1.1.1', 'x-real-ip': '2.2.2.2', 'x-nf-client-connection-ip': '3.3.3.3' }))).toBe('3.3.3.3');
    expect(getClientIp(headers({ 'x-forwarded-for': '1.1.1.1', 'x-real-ip': '2.2.2.2' }))).toBe('2.2.2.2');
    expect(getClientIp(headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 10.0.0.2' }))).toBe('203.0.113.7');
    expect(getClientIp(headers({}))).toBeNull();
  });

  it('skips garbage and falls through to the next header', () => {
    expect(getClientIp(headers({ 'x-real-ip': 'not-an-ip', 'x-forwarded-for': '198.51.100.4' }))).toBe('198.51.100.4');
    expect(getClientIp(headers({ 'x-forwarded-for': '<script>, 1.2.3.4' }))).toBeNull();
  });

  it('normalises ports, brackets, zone ids, case and IPv4-mapped IPv6', () => {
    expect(normalizeIp('203.0.113.7:51234')).toBe('203.0.113.7');
    expect(normalizeIp('[2001:DB8::1]:443')).toBe('2001:db8::1');
    expect(normalizeIp('fe80::1%eth0')).toBe('fe80::1');
    expect(normalizeIp('::ffff:192.0.2.1')).toBe('192.0.2.1');
    expect(normalizeIp(' "198.51.100.1" ')).toBe('198.51.100.1');
    expect(normalizeIp('999.1.1.1')).toBeNull();
    expect(normalizeIp('')).toBeNull();
  });

  it('groups IPv6 addresses by /64 and leaves IPv4 alone', () => {
    expect(rateLimitSubject('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(rateLimitSubject('2001:db8:1:2:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64');
    expect(rateLimitSubject('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(rateLimitSubject('::1')).toBe('0:0:0:0::/64');
    expect(rateLimitSubject('64:ff9b::192.0.2.33')).toBe('64:ff9b:0:0::/64');
    expect(rateLimitSubject('192.0.2.1')).toBe('192.0.2.1');
  });
});

describe('IP hashing', () => {
  it('is sha256(salt + ip) in hex, and never contains the IP', () => {
    const expected = createHash('sha256').update(`${SALT}203.0.113.7`).digest('hex');
    expect(hashIp('203.0.113.7', SALT)).toBe(expected);
    expect(hashIp('203.0.113.7', SALT)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp('203.0.113.7', SALT)).not.toContain('203');
  });

  it('depends on the salt and the address', () => {
    expect(hashIp('203.0.113.7', SALT)).not.toBe(hashIp('203.0.113.7', `${SALT}x`));
    expect(hashIp('203.0.113.7', SALT)).not.toBe(hashIp('203.0.113.8', SALT));
  });

  it('gives one key per requester (IPv6 /64) and a shared key when there is no IP', () => {
    const a = clientKey(headers({ 'x-real-ip': '2001:db8:1:2::10' }), SALT);
    const b = clientKey(headers({ 'x-real-ip': '2001:db8:1:2::99' }), SALT);
    const c = clientKey(headers({ 'x-real-ip': '2001:db8:1:3::10' }), SALT);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(clientKey(headers({}), SALT)).toBe(hashIp('unknown', SALT));
  });

  it('uses a working salt from the environment by default', () => {
    expect(hashIp('192.0.2.1')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp('192.0.2.1')).toBe(hashIp('192.0.2.1'));
  });
});

describe('isSameOriginRequest', () => {
  const site = 'https://wiege.example';

  it('accepts the configured site origin', () => {
    expect(isSameOriginRequest(post('https://wiege.example/api/feedback', { origin: 'https://wiege.example' }), { siteUrl: site })).toBe(true);
  });

  it('accepts the origin the request was addressed to (deploy previews, localhost)', () => {
    expect(isSameOriginRequest(post('http://localhost:3000/api/feedback', { origin: 'http://localhost:3000' }), { siteUrl: site })).toBe(true);
    expect(
      isSameOriginRequest(
        post('http://internal:8080/api/feedback', {
          origin: 'https://preview--wiege.netlify.app',
          'x-forwarded-host': 'preview--wiege.netlify.app',
          'x-forwarded-proto': 'https',
        }),
        { siteUrl: site },
      ),
    ).toBe(true);
  });

  it('rejects other sites, lookalikes, opaque and malformed origins', () => {
    const url = 'https://wiege.example/api/feedback';
    for (const origin of ['https://evil.example', 'https://wiege.example.evil.test', 'http://wiege.example', 'null', 'wiege.example', 'javascript:alert(1)']) {
      expect(isSameOriginRequest(post(url, { origin }), { siteUrl: site })).toBe(false);
    }
  });

  it('without an Origin header, trusts only Sec-Fetch-Site: same-origin', () => {
    const url = 'https://wiege.example/api/feedback';
    expect(isSameOriginRequest(post(url), { siteUrl: site })).toBe(false);
    expect(isSameOriginRequest(post(url, { 'sec-fetch-site': 'cross-site' }), { siteUrl: site })).toBe(false);
    expect(isSameOriginRequest(post(url, { 'sec-fetch-site': 'same-origin' }), { siteUrl: site })).toBe(true);
  });

  it('normalises default ports and case', () => {
    expect(isSameOriginRequest(post('https://wiege.example/api/x', { origin: 'https://WIEGE.example:443' }), { siteUrl: site })).toBe(true);
  });
});

describe('readBodyCapped', () => {
  const streamed = (chunks: string[]) =>
    new Request('https://wiege.example/api/feedback', {
      method: 'POST',
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
          controller.close();
        },
      }),
      // Required by undici for a streamed body.
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

  it('returns the text of a body within the limit, including multi-byte characters', async () => {
    expect(await readBodyCapped(streamed(['{"text":"Pokémon ', '🎮"}']), 1024)).toBe('{"text":"Pokémon 🎮"}');
    expect(await readBodyCapped(new Request('https://wiege.example/', { method: 'POST' }), 10)).toBe('');
  });

  it('refuses a declared or streamed body over the limit without reading it all', async () => {
    const declared = new Request('https://wiege.example/', { method: 'POST', body: 'x'.repeat(20), headers: { 'content-length': '20' } });
    expect(await readBodyCapped(declared, 10)).toBeNull();
    expect(await readBodyCapped(streamed(['x'.repeat(8), 'x'.repeat(8)]), 10)).toBeNull();
  });
});
