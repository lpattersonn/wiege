import { describe, expect, it, vi } from 'vitest';

import {
  FetchError,
  MAX_REDIRECTS,
  detectCharset,
  extractArticleText,
  fetchArticleText,
  fetchFeed,
  mapWithConcurrency,
  readTextCapped,
  userAgent,
  type FetchImpl,
} from './fetch';

const UA = userAgent('https://wiege.example');
const NO_VALIDATORS = { etag: null, lastModified: null };

function respond(body: BodyInit | null, init: ResponseInit & { url?: string } = {}): Response {
  const response = new Response(body, init);
  if (init.url) Object.defineProperty(response, 'url', { value: init.url });
  return response;
}

/** A body that streams `chunks` of `size` bytes each, with no Content-Length. */
function streamingBody(chunks: number, size: number): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (sent >= chunks) return controller.close();
      sent += 1;
      controller.enqueue(new Uint8Array(size).fill(65));
    },
  });
}

async function fetchError(promise: Promise<unknown>): Promise<FetchError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof FetchError) return error;
    throw error;
  }
  throw new Error('expected a FetchError');
}

describe('fetchFeed', () => {
  it('identifies itself and sends conditional-GET validators', async () => {
    let seen: Headers | null = null;
    const fetchImpl: FetchImpl = async (_url, init) => {
      seen = new Headers(init.headers);
      return respond('<rss/>', { headers: { etag: '"v2"', 'last-modified': 'Sat, 26 Sep 2026 10:00:00 GMT' } });
    };
    const result = await fetchFeed('https://feeds.example/rss', { etag: '"v1"', lastModified: 'Fri, 25 Sep 2026 10:00:00 GMT' }, { userAgent: UA, fetchImpl });
    expect(seen!.get('user-agent')).toBe('WiegeBot/1.0 (+https://wiege.example/about)');
    expect(seen!.get('if-none-match')).toBe('"v1"');
    expect(seen!.get('if-modified-since')).toBe('Fri, 25 Sep 2026 10:00:00 GMT');
    expect(result).toEqual({
      status: 'ok',
      body: '<rss/>',
      validators: { etag: '"v2"', lastModified: 'Sat, 26 Sep 2026 10:00:00 GMT' },
    });
  });

  it('omits validators it does not have', async () => {
    let seen: Headers | null = null;
    await fetchFeed('https://feeds.example/rss', NO_VALIDATORS, {
      userAgent: UA,
      fetchImpl: async (_url, init) => {
        seen = new Headers(init.headers);
        return respond('<rss/>');
      },
    });
    expect(seen!.has('if-none-match')).toBe(false);
    expect(seen!.has('if-modified-since')).toBe(false);
  });

  it('reports 304 as not modified', async () => {
    const result = await fetchFeed('https://feeds.example/rss', NO_VALIDATORS, {
      userAgent: UA,
      fetchImpl: async () => respond(null, { status: 304 }),
    });
    expect(result).toEqual({ status: 'not-modified' });
  });

  it('turns HTTP errors, network errors and timeouts into FetchError', async () => {
    const http = await fetchError(
      fetchFeed('https://feeds.example/rss', NO_VALIDATORS, { userAgent: UA, fetchImpl: async () => respond('nope', { status: 503 }) }),
    );
    expect([http.code, http.status, http.message]).toEqual(['http', 503, 'HTTP 503']);

    const network = await fetchError(
      fetchFeed('https://feeds.example/rss', NO_VALIDATORS, {
        userAgent: UA,
        fetchImpl: async () => {
          throw new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND feeds.example') });
        },
      }),
    );
    expect(network.code).toBe('network');
    expect(network.message).toContain('ENOTFOUND');

    const hanging: FetchImpl = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    const timeout = await fetchError(fetchFeed('https://feeds.example/rss', NO_VALIDATORS, { userAgent: UA, timeoutMs: 20, fetchImpl: hanging }));
    expect(timeout.code).toBe('timeout');
  });

  it('refuses responses over the size cap, declared or streamed', async () => {
    const declared = await fetchError(
      fetchFeed('https://feeds.example/rss', NO_VALIDATORS, {
        userAgent: UA,
        maxBytes: 1000,
        fetchImpl: async () => respond('x', { headers: { 'content-length': '5000000' } }),
      }),
    );
    expect(declared.code).toBe('too-large');

    const streamed = await fetchError(
      fetchFeed('https://feeds.example/rss', NO_VALIDATORS, {
        userAgent: UA,
        maxBytes: 1000,
        fetchImpl: async () => respond(streamingBody(50, 100)),
      }),
    );
    expect(streamed.code).toBe('too-large');
  });
});

describe('redirects', () => {
  const redirect = (location: string, status = 301) => respond(null, { status, headers: { location } });

  it('follows redirects within the feed host, including http to https', async () => {
    const seen: string[] = [];
    const result = await fetchFeed('http://feeds.example.com/old', NO_VALIDATORS, {
      userAgent: UA,
      fetchImpl: async (url, init) => {
        seen.push(url);
        expect(init.redirect).toBe('manual');
        if (url === 'http://feeds.example.com/old') return redirect('https://feeds.example.com/old');
        if (url === 'https://feeds.example.com/old') return redirect('/new', 308);
        return respond('<rss/>');
      },
    });
    expect(result.status).toBe('ok');
    expect(seen).toEqual(['http://feeds.example.com/old', 'https://feeds.example.com/old', 'https://feeds.example.com/new']);
  });

  it('refuses a redirect to another host, a missing Location and redirect loops', async () => {
    const offSite = await fetchError(
      fetchFeed('https://feeds.example.com/rss', NO_VALIDATORS, { userAgent: UA, fetchImpl: async () => redirect('https://evil.example/rss') }),
    );
    expect([offSite.code, offSite.message]).toEqual(['off-site-redirect', 'redirected off-site to evil.example']);

    const noLocation = await fetchError(
      fetchFeed('https://feeds.example.com/rss', NO_VALIDATORS, { userAgent: UA, fetchImpl: async () => respond(null, { status: 302 }) }),
    );
    expect(noLocation.code).toBe('http');

    let hops = 0;
    const loop = await fetchError(
      fetchFeed('https://feeds.example.com/rss', NO_VALIDATORS, {
        userAgent: UA,
        fetchImpl: async () => {
          hops += 1;
          return redirect(`https://feeds.example.com/rss?hop=${hops}`);
        },
      }),
    );
    expect(loop.message).toBe(`more than ${MAX_REDIRECTS} redirects`);
    expect(hops).toBe(MAX_REDIRECTS + 1);
  });
});

describe('readTextCapped', () => {
  it('reads a streamed body under the cap', async () => {
    await expect(readTextCapped(respond(streamingBody(3, 4)), 100)).resolves.toBe('AAAAAAAAAAAA');
  });

  it('decodes the charset from the header or the XML declaration', async () => {
    const latin1 = new Uint8Array([0x63, 0x61, 0x66, 0xe9]); // "café" in ISO-8859-1
    await expect(readTextCapped(respond(latin1, { headers: { 'content-type': 'text/xml; charset=ISO-8859-1' } }), 100)).resolves.toBe('café');
    const prolog = new TextEncoder().encode('<?xml version="1.0" encoding="ISO-8859-1"?><t>');
    const withProlog = new Uint8Array([...prolog, 0xe9]);
    await expect(readTextCapped(respond(withProlog), 1000)).resolves.toBe('<?xml version="1.0" encoding="ISO-8859-1"?><t>é');
  });
});

describe('detectCharset', () => {
  it('falls back to utf-8 for unknown labels', () => {
    expect(detectCharset('text/xml; charset=made-up', new Uint8Array())).toBe('utf-8');
    expect(detectCharset(null, new Uint8Array())).toBe('utf-8');
  });
});

describe('article text', () => {
  const paragraph = 'Students at the school built a robot that sorts recycling, and they spent a whole term testing it. ';
  const page = `<!doctype html><html><head><title>Robot</title><script>track()</script></head><body>
    <nav>Home | News | Sport</nav>
    <article><h1>Robot sorts recycling</h1><p>${paragraph.repeat(4)}</p><p>${paragraph.repeat(3)}</p></article>
    <footer>Copyright</footer></body></html>`;

  it('extracts the readable text of a page', () => {
    const text = extractArticleText(page);
    expect(text).toContain('built a robot that sorts recycling');
    expect(text).not.toContain('track()');
  });

  it('returns null for pages without enough text, and caps long text', () => {
    expect(extractArticleText('<html><body><p>Too short.</p></body></html>')).toBeNull();
    expect(extractArticleText(page, 250)?.length).toBe(250);
  });

  it('fetches, checks hosts and content type, and never throws', async () => {
    const ok = await fetchArticleText('https://www.bbc.co.uk/news/a', ['bbc.co.uk'], {
      userAgent: UA,
      fetchImpl: async () => respond(page, { headers: { 'content-type': 'text/html; charset=utf-8' }, url: 'https://www.bbc.co.uk/news/a' }),
    });
    expect(ok).toContain('sorts recycling');

    const offSite = await fetchArticleText('https://www.bbc.co.uk/news/a', ['bbc.co.uk'], {
      userAgent: UA,
      fetchImpl: async (url) =>
        url.startsWith('https://www.bbc.co.uk')
          ? respond(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } })
          : respond(page, { headers: { 'content-type': 'text/html' } }),
    });
    expect(offSite).toBeNull();

    const notAllowed = vi.fn(async () => respond(page, { headers: { 'content-type': 'text/html' } }));
    expect(await fetchArticleText('https://evil.example/a', ['bbc.co.uk'], { userAgent: UA, fetchImpl: notAllowed })).toBeNull();
    expect(notAllowed).not.toHaveBeenCalled();

    const pdf = await fetchArticleText('https://www.bbc.co.uk/news/a', ['bbc.co.uk'], {
      userAgent: UA,
      fetchImpl: async () => respond('%PDF', { headers: { 'content-type': 'application/pdf' } }),
    });
    expect(pdf).toBeNull();

    const failing = await fetchArticleText('https://www.bbc.co.uk/news/a', ['bbc.co.uk'], {
      userAgent: UA,
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    });
    expect(failing).toBeNull();
  });
});

describe('mapWithConcurrency', () => {
  it('keeps order and never exceeds the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await mapWithConcurrency([5, 1, 4, 2, 3, 0], 2, async (value) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, value));
      inFlight -= 1;
      return value * 10;
    });
    expect(results).toEqual([50, 10, 40, 20, 30, 0]);
    expect(peak).toBe(2);
  });

  it('handles an empty list', async () => {
    await expect(mapWithConcurrency([], 4, async () => 1)).resolves.toEqual([]);
  });
});
