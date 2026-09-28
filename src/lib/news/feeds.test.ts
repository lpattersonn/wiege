import { describe, expect, it } from 'vitest';

import { CATEGORY_SLUGS } from '@/lib/categories';

import { CATEGORY_KEYWORDS, FEEDS, getFeed, isAllowedHost, isCuratedFeed, routeCategory } from './feeds';

describe('curated feed list', () => {
  it('has unique ids and feed URLs, all https', () => {
    expect(new Set(FEEDS.map((feed) => feed.id)).size).toBe(FEEDS.length);
    expect(new Set(FEEDS.map((feed) => feed.feedUrl)).size).toBe(FEEDS.length);
    for (const feed of FEEDS) {
      expect(feed.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(new URL(feed.feedUrl).protocol).toBe('https:');
      expect(new URL(feed.homepage).protocol).toBe('https:');
      expect(feed.why.length).toBeGreaterThan(40);
    }
  });

  it("keeps each feed's own URLs on its allowed hosts", () => {
    for (const feed of FEEDS) {
      expect(isAllowedHost(new URL(feed.homepage).hostname, feed.allowedHosts)).toBe(true);
      expect(isAllowedHost(new URL(feed.feedUrl).hostname, feed.allowedHosts) || feed.id.startsWith('bbc-')).toBe(true);
    }
  });

  it('offers two to four sources for every category', () => {
    for (const category of CATEGORY_SLUGS) {
      const contributing = FEEDS.filter((feed) =>
        feed.routing.kind === 'fixed' ? feed.category === category : feed.routing.categories.includes(category),
      );
      expect(contributing.length, category).toBeGreaterThanOrEqual(2);
      expect(contributing.length, category).toBeLessThanOrEqual(4);
    }
  });

  it('lists a keyword-routed feed under one of its own categories', () => {
    for (const feed of FEEDS) {
      if (feed.routing.kind === 'keywords') expect(feed.routing.categories).toContain(feed.category);
    }
  });

  it('looks feeds up by id', () => {
    expect(getFeed('bbc-sport')?.name).toBe('BBC Sport');
    expect(isCuratedFeed('wiege-practice')).toBe(false);
  });
});

describe('isAllowedHost', () => {
  it('accepts the host and its subdomains only', () => {
    expect(isAllowedHost('bbc.co.uk', ['bbc.co.uk'])).toBe(true);
    expect(isAllowedHost('www.bbc.co.uk', ['bbc.co.uk'])).toBe(true);
    expect(isAllowedHost('WWW.BBC.CO.UK.', ['bbc.co.uk'])).toBe(true);
    expect(isAllowedHost('notbbc.co.uk', ['bbc.co.uk'])).toBe(false);
    expect(isAllowedHost('bbc.co.uk.evil.example', ['bbc.co.uk'])).toBe(false);
  });
});

describe('routeCategory', () => {
  const mixed = { category: 'writing' as const, routing: { kind: 'keywords' as const, categories: [...CATEGORY_SLUGS] } };

  it('returns the fixed category for single-topic feeds', () => {
    expect(routeCategory({ category: 'games', routing: { kind: 'fixed' } }, { title: 'Anything', excerpt: '' })).toBe('games');
  });

  it('routes on title keywords', () => {
    expect(routeCategory(mixed, { title: 'Netball team wins silver', excerpt: 'A great day.' })).toBe('sports');
    expect(routeCategory(mixed, { title: 'New Pokémon game revealed', excerpt: '' })).toBe('games');
    expect(routeCategory(mixed, { title: 'Street art festival returns', excerpt: '' })).toBe('art');
    expect(routeCategory(mixed, { title: 'Poet laureate visits school', excerpt: '' })).toBe('writing');
  });

  it('needs two body hits when the title has none', () => {
    expect(routeCategory(mixed, { title: 'A big day out', excerpt: 'They visited a museum.' })).toBeNull();
    expect(routeCategory(mixed, { title: 'A big day out', excerpt: 'They visited a museum and a gallery.' })).toBe('art');
  });

  it('uses feed tags as body evidence', () => {
    expect(routeCategory(mixed, { title: 'A quiet corner', excerpt: 'Somewhere to sit.', tags: ['Libraries', 'Books'] })).toBe('writing');
  });

  it('picks the strongest category and breaks ties by the feed order', () => {
    expect(
      routeCategory(mixed, { title: 'Footballer writes a novel', excerpt: 'The book is about football and a new author.' }),
    ).toBe('writing');
    expect(routeCategory(mixed, { title: 'Chess and tennis', excerpt: '' })).toBe('games');
  });

  it('respects the categories a feed may route to', () => {
    const artOrSport = { category: 'art' as const, routing: { kind: 'keywords' as const, categories: ['art', 'sports'] as const } };
    expect(routeCategory({ ...artOrSport, routing: { kind: 'keywords', categories: [...artOrSport.routing.categories] } }, {
      title: 'Author signs books',
      excerpt: 'A novel event.',
    })).toBeNull();
  });

  it('does not match inside longer words', () => {
    expect(routeCategory(mixed, { title: 'Martian artifacts puzzle', excerpt: '' })).toBeNull();
  });

  it('has keywords for every category', () => {
    for (const category of CATEGORY_SLUGS) expect(CATEGORY_KEYWORDS[category].length).toBeGreaterThan(10);
  });
});
