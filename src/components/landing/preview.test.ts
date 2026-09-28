import { describe, expect, it } from 'vitest';

import { countNewToday, distinctSummary, pickCoverWord, pickPreview } from './preview';

const NOW = Date.parse('2026-09-27T21:00:00Z');
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * 3_600_000).toISOString();

describe('countNewToday', () => {
  it('counts news from the last 24 hours only, never practice stories', () => {
    const stories = [
      { publishedAt: at(1), isSample: false },
      { publishedAt: at(23.9), isSample: false },
      { publishedAt: at(24.1), isSample: false },
      { publishedAt: at(2), isSample: true },
      { publishedAt: 'not a date', isSample: false },
    ];
    expect(countNewToday(stories, NOW)).toBe(2);
    expect(countNewToday([], NOW)).toBe(0);
  });
});

describe('pickPreview', () => {
  it('puts the newest news first and fills with practice stories', () => {
    const stories = [
      { id: 'practice', publishedAt: at(1000), isSample: true },
      { id: 'old', publishedAt: at(10), isSample: false },
      { id: 'new', publishedAt: at(1), isSample: false },
    ];
    expect(pickPreview(stories).map((s) => s.id)).toEqual(['new', 'old', 'practice']);
    expect(pickPreview(stories, 2).map((s) => s.id)).toEqual(['new', 'old']);
  });
});

describe('pickCoverWord', () => {
  it('takes the first word that fits a cover', () => {
    expect(pickCoverWord([{ word: 'by heart' }, { word: 'extraordinarily' }, { word: 'stamina' }])).toBe('stamina');
    expect(pickCoverWord([{ word: 'shave off' }])).toBeNull();
  });
});

describe('distinctSummary', () => {
  it('drops a summary that only repeats the headline', () => {
    expect(distinctSummary('Opinion: I Played Mario Kart', 'Opinion: I played Mario Kart?.')).toBeNull();
    expect(distinctSummary('Libraries lend more than books', 'Many libraries now lend tools.')).toBe('Many libraries now lend tools.');
    expect(distinctSummary('Title', '  ')).toBeNull();
  });
});
