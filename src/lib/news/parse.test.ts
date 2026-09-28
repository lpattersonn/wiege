import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { getFeed, type FeedDefinition } from './feeds';
import {
  EXCERPT_MAX_CHARS,
  FeedParseError,
  asText,
  contentHash,
  htmlToText,
  makeExcerpt,
  makeSlug,
  normalizeItem,
  normalizeLink,
  parseFeed,
  truncateText,
  type CandidateItem,
  type NormalizeResult,
} from './parse';

const NOW = new Date('2026-09-27T12:00:00Z');

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), 'utf8');

function feed(id: string): FeedDefinition {
  const found = getFeed(id);
  if (!found) throw new Error(`missing feed ${id}`);
  return found;
}

const testGamesFeed: FeedDefinition = {
  id: 'test-games',
  name: 'Example Games News',
  feedUrl: 'https://games.example.com/feed',
  homepage: 'https://games.example.com',
  category: 'games',
  routing: { kind: 'fixed' },
  allowedHosts: ['games.example.com'],
  why: 'test',
};

const testBooksFeed: FeedDefinition = {
  id: 'test-books',
  name: 'Example Books',
  feedUrl: 'https://books.example.org/books/rss',
  homepage: 'https://books.example.org/books',
  category: 'writing',
  routing: { kind: 'keywords', categories: ['writing', 'art'] },
  allowedHosts: ['books.example.org'],
  why: 'test',
};

async function normalizeFixture(name: string, def: FeedDefinition): Promise<NormalizeResult[]> {
  const raw = await parseFeed(fixture(name));
  return raw.map((item) => normalizeItem(item, def, NOW));
}

const items = (results: NormalizeResult[]): CandidateItem[] =>
  results.flatMap((result) => (result.ok ? [result.item] : []));
const reasons = (results: NormalizeResult[]) => results.flatMap((result) => (result.ok ? [] : [result.reason]));

describe('parseFeed', () => {
  it('reads RSS 2.0 items with CDATA', async () => {
    const raw = await parseFeed(fixture('newsround.xml'));
    expect(raw).toHaveLength(10);
    expect(raw[1]).toMatchObject({
      title: 'Teen author wins prize for her first novel about a lighthouse',
      link: 'https://www.bbc.co.uk/newsround/articles/c0author01o?at_medium=RSS&at_campaign=rss',
    });
  });

  it('reads Atom entries', async () => {
    const raw = await parseFeed(fixture('atom.xml'));
    expect(raw).toHaveLength(2);
    expect(raw[0].link).toBe('https://games.example.com/news/zelda-puzzle?ref=rss');
  });

  it('turns attribute-carrying categories into plain tags', async () => {
    const [item] = await parseFeed(fixture('guardian.xml'));
    expect(item.tags).toEqual(['Libraries', "Children's books"]);
  });

  it('throws FeedParseError for malformed XML and for non-feeds', async () => {
    await expect(parseFeed(fixture('malformed.xml'))).rejects.toBeInstanceOf(FeedParseError);
    await expect(parseFeed('<html><body>Not a feed</body></html>')).rejects.toBeInstanceOf(FeedParseError);
  });
});

describe('normalizeItem: mixed feed routed by keywords (BBC Newsround)', () => {
  it('routes items to categories and drops the rest with reasons', async () => {
    const results = await normalizeFixture('newsround.xml', feed('bbc-newsround'));
    const routed = items(results).map((item) => [item.title, item.category]);
    expect(routed).toEqual([
      ['Teen author wins prize for her first novel about a lighthouse', 'writing'],
      ['Lionesses name squad for autumn matches', 'sports'],
      ['Minecraft is getting its first new dimension in 14 years', 'games'],
      ["Seven-year-old's painting to hang in national gallery", 'art'],
      ['Two teenagers arrested after stabbing near football ground', 'sports'],
    ]);
    expect(reasons(results).sort()).toEqual(['media-link', 'media-link', 'no-category', 'no-link', 'too-old'].sort());
  });

  it('strips tracking parameters and keeps links canonical', async () => {
    const [first] = items(await normalizeFixture('newsround.xml', feed('bbc-newsround')));
    expect(first.url).toBe('https://www.bbc.co.uk/newsround/articles/c0author01o');
    expect(first.slug).toMatch(/^teen-author-wins-prize-for-her-first-novel-about-a-lighthouse-[0-9a-f]{6}$/);
    expect(first.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.publishedAt.toISOString()).toBe('2026-09-26T15:10:00.000Z');
    expect(first.sourceId).toBe('bbc-newsround');
  });
});

describe('normalizeItem: WordPress feed (Colossal)', () => {
  it('removes images, membership plugs and "appeared first on" lines', async () => {
    const [plants] = items(await normalizeFixture('wordpress.xml', feed('colossal')));
    expect(plants.title).toBe('Fantastic Plants Spring from an Illustrator’s Digital Drawings');
    expect(plants.excerpt).toBe(
      'An illustrator reimagines the plants living in her apartment, beginning with leaves and stems before venturing into surreal terrain.',
    );
    expect(plants.author).toBe('Grace Ebert');
    expect(plants.url).toBe('https://www.thisiscolossal.com/2026/09/fantastic-plants-illustration/');
    expect(plants.category).toBe('art');
  });

  it('never keeps script or style text and decodes entities', async () => {
    const paper = items(await normalizeFixture('wordpress.xml', feed('colossal')))[1];
    expect(paper.excerpt).toBe(
      'Using only a scalpel and sheets of coloured paper, the artist builds tiny foxes, owls & deer that seem to move in the light.',
    );
  });

  it('uses the full content only when there is no summary, and never stores more than an excerpt', async () => {
    const all = items(await normalizeFixture('wordpress.xml', feed('colossal')));
    expect(all.map((item) => item.excerpt).join(' ')).not.toContain('must never be stored');
    const mural = all.find((item) => item.title.startsWith('Only the Full Content'));
    expect(mural?.excerpt).toMatch(/^A giant mural of swirling birds/);
  });
});

describe('normalizeItem: Atom and attribute-rich RSS', () => {
  it('strips markup from titles and resolves relative links', async () => {
    const [zelda, relative] = items(await normalizeFixture('atom.xml', testGamesFeed));
    expect(zelda.title).toBe('Nintendo announces a new Zelda puzzle game');
    expect(zelda.url).toBe('https://games.example.com/news/zelda-puzzle');
    expect(zelda.excerpt).toBe('The puzzle game lets players rearrange rooms of a castle to guide a sleepy knight home.');
    expect(relative.url).toBe('https://games.example.com/news/relative-link');
  });

  it('decodes escaped HTML descriptions, drops "Continue reading" and uses tags for routing', async () => {
    const [library] = items(await normalizeFixture('guardian.xml', testBooksFeed));
    expect(library.excerpt).toBe(
      'The town’s library has reopened after two years with a garden where children can read outdoors in summer.',
    );
    expect(library.category).toBe('writing');
    expect(library.author).toBe('Sam Jones');
  });
});

describe('normalizeItem: hostile input', () => {
  it('refuses off-site, script, lookalike and credential links, bad dates and empty text', async () => {
    const results = await normalizeFixture('hostile.xml', feed('nintendo-life'));
    expect(reasons(results)).toEqual([
      'off-site-link',
      'bad-link',
      'off-site-link',
      'bad-link',
      'future-date',
      'no-date',
      'no-excerpt',
    ]);
  });

  it('strips markup, embeds, tracking and template placeholders from what it keeps', async () => {
    const [kept] = items(await normalizeFixture('hostile.xml', feed('nintendo-life')));
    expect(kept.title).toBe('Mario Kart gets new tracks');
    expect(kept.url).toBe('https://www.nintendolife.com/news/mario-kart-tracks?page=2');
    expect(kept.excerpt).toBe(
      'Four new tracks arrive next week, including one set on a giant birthday cake with candles to dodge.',
    );
  });

  it('clamps a slightly-future date to now', () => {
    const result = normalizeItem(
      {
        title: 'Clock skew',
        link: 'https://www.nintendolife.com/news/skew',
        guid: '',
        date: '2026-09-27T14:00:00Z',
        author: '',
        summaryHtml: 'A publisher clock running two hours fast should not push the story into the future.',
        contentHtml: '',
        tags: [],
      },
      feed('nintendo-life'),
      NOW,
    );
    expect(result.ok && result.item.publishedAt.toISOString()).toBe(NOW.toISOString());
  });
});

describe('normalizeItem: recurring trade columns', () => {
  const entry = (title: string) => ({
    title,
    link: `https://www.publishersweekly.com/pw/by-topic/childrens/${encodeURIComponent(title)}.html`,
    guid: '',
    date: '2026-09-26T10:00:00Z',
    author: '',
    summaryHtml: 'A paragraph long enough to count as an excerpt for this Publishers Weekly item about children’s books.',
    contentHtml: '',
    tags: [],
  });

  it.each([
    'Rights Report: Week of September 21, 2026',
    'In Brief: September 24, 2026',
    'Children’s Job Moves: August 2026',
    'Licensing Hotline: September 2026',
    'New Kids’ and YA Books: Week of September 28, 2026',
    'World Kid Lit Month 2026: All Our Coverage',
    'Spring 2027 Children’s Sneak Peek',
  ])('skips "%s" as a roundup', (title) => {
    expect(normalizeItem(entry(title), feed('pw-childrens'), NOW)).toEqual({ ok: false, reason: 'roundup' });
  });

  it.each(['Dog Man at 10: Dav Pilkey Grows His Fan-Favorite Series', 'In Conversation: Veronica Roth and Chloe Gong'])(
    'keeps "%s"',
    (title) => {
      expect(normalizeItem(entry(title), feed('pw-childrens'), NOW).ok).toBe(true);
    },
  );
});

describe('text helpers', () => {
  it('asText handles the shapes xml2js produces', () => {
    expect(asText('plain')).toBe('plain');
    expect(asText({ _: 'text', $: { domain: 'x' } })).toBe('text');
    expect(asText([{ _: 'first' }, 'second'])).toBe('first');
    expect(asText({ $: { href: 'https://example.com' } })).toBe('https://example.com');
    expect(asText(undefined)).toBe('');
    expect(asText({ unexpected: true })).toBe('');
  });

  it('htmlToText keeps block boundaries as line breaks', () => {
    expect(htmlToText('<p>One</p><p>Two &amp; three</p>')).toBe('One\nTwo & three');
    expect(htmlToText('Plain   text\n\n with  spaces')).toBe('Plain text\nwith spaces');
  });

  it('truncateText prefers sentence, then word boundaries', () => {
    const sentences = 'First sentence is here. Second sentence is a good deal longer than the first one.';
    expect(truncateText(sentences, 36)).toBe('First sentence is here.');
    expect(truncateText(sentences, 40)).toBe('First sentence is here. Second…');
    expect(truncateText('word '.repeat(30).trim(), 40)).toMatch(/^(word ){6}word…$/);
    expect(truncateText('short', 40)).toBe('short');
  });

  it('makeExcerpt caps at 600 characters', () => {
    const long = `<p>${'A sentence about art. '.repeat(60)}</p>`;
    const excerpt = makeExcerpt(long, { title: 'x' });
    expect(excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
    expect(excerpt.endsWith('.')).toBe(true);
  });

  it('makeExcerpt drops a first line that repeats the title', () => {
    expect(makeExcerpt('<h2>Big News Today</h2><p>The body of the story.</p>', { title: 'Big news today' })).toBe(
      'The body of the story.',
    );
  });

  it('makeSlug is kebab-case ASCII with a stable URL hash', () => {
    const slug = makeSlug('Pokémon’s Café: A “Big” Day!', 'https://example.com/a');
    expect(slug).toMatch(/^pokemons-cafe-a-big-day-[0-9a-f]{6}$/);
    expect(makeSlug('Pokémon’s Café: A “Big” Day!', 'https://example.com/a')).toBe(slug);
    expect(makeSlug('Same title', 'https://example.com/a')).not.toBe(makeSlug('Same title', 'https://example.com/b'));
    expect(makeSlug('!!!', 'https://example.com/a')).toMatch(/^story-[0-9a-f]{6}$/);
    expect(makeSlug('word '.repeat(40), 'https://example.com/a').length).toBeLessThanOrEqual(87);
  });

  it('contentHash ignores case and punctuation but not words', () => {
    expect(contentHash('Big News!', 'The body.')).toBe(contentHash('big news', 'the body'));
    expect(contentHash('Big News', 'The body.')).not.toBe(contentHash('Big News', 'Another body.'));
  });

  it('normalizeLink upgrades to https and removes ports, fragments and tracking', () => {
    const def = { homepage: 'https://www.bbc.co.uk', allowedHosts: ['bbc.co.uk'] };
    expect(normalizeLink('http://www.bbc.co.uk:80/news/a?utm_source=x&id=7#top', def)).toEqual({
      ok: true,
      url: 'https://www.bbc.co.uk/news/a?id=7',
    });
    expect(normalizeLink('  ', def)).toEqual({ ok: false, reason: 'no-link' });
    expect(normalizeLink('ftp://www.bbc.co.uk/file', def)).toEqual({ ok: false, reason: 'bad-link' });
    expect(normalizeLink('https://bbc.co.uk.evil.example/', def)).toEqual({ ok: false, reason: 'off-site-link' });
  });
});
