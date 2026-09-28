import { describe, expect, it } from 'vitest';

import { CATEGORY_SLUGS } from '@/lib/categories';
import { FEEDS, type FeedDefinition } from '@/lib/news/feeds';

import { infoMetadata } from './metadata';
import { feedCategories, sourceSummaries } from './sources';
import { curlyQuotes, splitNumerals } from './typography';

const feed = (over: Partial<FeedDefinition>): FeedDefinition => ({
  id: 'x',
  name: 'X',
  feedUrl: 'https://x.example/feed',
  homepage: 'https://www.x.example/news',
  category: 'art',
  routing: { kind: 'fixed' },
  allowedHosts: ['x.example'],
  why: 'Because.',
  ...over,
});

describe('feedCategories', () => {
  it('returns the fixed category for fixed feeds', () => {
    expect(feedCategories(feed({ category: 'games' }))).toEqual(['games']);
  });

  it('returns every routed category, de-duplicated, in site order', () => {
    const routed = feed({ category: 'art', routing: { kind: 'keywords', categories: ['sports', 'art', 'writing', 'art'] } });
    expect(feedCategories(routed)).toEqual(['writing', 'art', 'sports']);
  });
});

describe('sourceSummaries', () => {
  it('lists every curated feed exactly once', () => {
    const list = sourceSummaries();
    expect(list).toHaveLength(FEEDS.length);
    expect(new Set(list.map((s) => s.id))).toEqual(new Set(FEEDS.map((f) => f.id)));
  });

  it('groups by main category in site order and keeps list order within a group', () => {
    const list = sourceSummaries();
    const mainIndex = list.map((s) => CATEGORY_SLUGS.indexOf(FEEDS.find((f) => f.id === s.id)!.category));
    expect(mainIndex).toEqual([...mainIndex].sort((a, b) => a - b));
    const writing = list.filter((s) => FEEDS.find((f) => f.id === s.id)!.category === 'writing').map((s) => s.id);
    expect(writing).toEqual(FEEDS.filter((f) => f.category === 'writing').map((f) => f.id));
  });

  it('shows a clean host and keeps the reason', () => {
    const [only] = sourceSummaries([feed({ id: 'a', homepage: 'https://www.bbc.co.uk/sport', why: 'Broad.' })]);
    expect(only).toMatchObject({ id: 'a', host: 'bbc.co.uk', why: 'Broad.', categories: ['art'] });
  });

  it('every curated source has a homepage link and a reason', () => {
    for (const source of sourceSummaries()) {
      expect(source.homepage).toMatch(/^https:\/\//);
      expect(source.why.length).toBeGreaterThan(20);
      expect(source.categories.length).toBeGreaterThan(0);
    }
  });
});

describe('curlyQuotes', () => {
  it('curls apostrophes inside and after words, and paired double quotes', () => {
    expect(curlyQuotes("The BBC's news for children's books")).toBe('The BBC’s news for children’s books');
    expect(curlyQuotes("the players' union")).toBe('the players’ union');
    expect(curlyQuotes('a "kid reporter" wrote it')).toBe('a “kid reporter” wrote it');
  });

  it('leaves text without quotes alone', () => {
    expect(curlyQuotes('Plain text.')).toBe('Plain text.');
  });
});

describe('splitNumerals', () => {
  it('splits numbers, ranges, decimals, separators and a trailing plus', () => {
    const runs = splitNumerals('about 20 items, ages 10–14, 42.195 km, 6,000 characters, rated 12+ here');
    expect(runs.filter((r) => r.numeral).map((r) => r.text)).toEqual(['20', '10–14', '42.195', '6,000', '12+']);
  });

  it('round-trips the input', () => {
    const text = 'GTA 6, The Last of Us, and 2024.';
    expect(
      splitNumerals(text)
        .map((r) => r.text)
        .join(''),
    ).toBe(text);
  });

  it('returns one plain run when there are no digits', () => {
    expect(splitNumerals('No numbers.')).toEqual([{ text: 'No numbers.', numeral: false }]);
  });
});

describe('infoMetadata', () => {
  it('sets title, description, canonical and matching social fields with the share image', () => {
    const meta = infoMetadata({ path: '/about', title: 'About', description: 'What Wiege is.' });
    expect(meta.title).toBe('About');
    expect(meta.description).toBe('What Wiege is.');
    expect(meta.alternates?.canonical).toBe('/about');
    expect(meta.openGraph).toMatchObject({ url: '/about', title: 'About – Wiege', description: 'What Wiege is.', siteName: 'Wiege' });
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image', title: 'About – Wiege' });
    const images = meta.openGraph?.images;
    expect(Array.isArray(images) ? images[0] : images).toMatchObject({ url: '/opengraph-image', width: 1200, height: 630 });
  });
});
