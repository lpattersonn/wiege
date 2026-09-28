import { describe, expect, it } from 'vitest';

import type { LessonContent } from '@/lib/literacy/types';

import { ALLOWED_PHRASES, BLOCKLIST, SAFETY_CATEGORIES, normalizeForScan, scanItem, scanLesson, scanText } from './safety';

/** The category names found in a scan, for readable assertions. */
const categories = (text: string) => [...new Set(scanText(text).reasons.map((reason) => reason.split(':')[0]))];

describe('blocklist: unsafe headlines are rejected', () => {
  const cases: Array<[string, string]> = [
    ['Two people killed in shooting at shopping centre', 'violence'],
    ['Man charged with murder after stabbing in city centre', 'violence'],
    ['Gunman opens fire outside nightclub', 'violence'],
    ['Police hunt knife attacker after street assault', 'violence'],
    ['UFC star wins title fight in first round', 'violence'],
    ['Troops advance as air strikes hit the capital', 'war-terror'],
    ['Terror attack suspect named by investigators', 'war-terror'],
    ['Missile lands near border town, officials say', 'war-terror'],
    ['Singer dies aged 76 after short illness', 'death-injury'],
    ['Climber found dead on mountain after storm', 'death-injury'],
    ['Rider in critical condition after crash at the circuit', 'death-injury'],
    ['Nude portrait sells for a record price', 'sexual'],
    ['Film star faces sexual misconduct claims', 'sexual'],
    ['Striker banned after failed drugs test', 'drugs-alcohol'],
    ['Champagne celebrations as Norris wins in Monza', 'drugs-alcohol'],
    ['New vape flavours to be banned near schools', 'drugs-alcohol'],
    ['Winger banned for drink-driving', 'drugs-alcohol'],
    ['Fans could soon be allowed alcohol in the stands', 'drugs-alcohol'],
    ['Premier League club signs new betting sponsor', 'gambling'],
    ['Casino-style loot boxes face ban in games', 'gambling'],
    ['Deckbuilder inspired by poker comes to phones', 'gambling'],
    ['Author opens up about her battle with anorexia', 'self-harm'],
    ['Charity warns of rise in self-harm among teenagers', 'self-harm'],
    ['Footballer arrested on suspicion of fraud', 'crime'],
    ['Club found guilty of breaking financial rules', 'crime'],
    ['Former coach jailed for six years', 'crime'],
    ['What the f*** was that, asks furious manager', 'profanity'],
    ['Star says the defeat was "bloody awful"', 'horror'],
    ['Five horror novels to read this autumn', 'horror'],
    ['Zombie survival game gets a sequel', 'horror'],
    ['Grand Theft Auto 6 trailer breaks viewing records', 'mature-games'],
    ['Resident Evil Requiem gets a release date', 'mature-games'],
    ['Call of Duty: Warzone adds a new map', 'mature-games'],
    ['This shooter is rated M for Mature', 'mature-games'],
    ['Election results: who won the most seats?', 'politics'],
    ['Prime Minister visits school to launch reading plan', 'politics'],
    ['MLB asks White House about holding a game in a national park', 'politics'],
    ['Painting looted by the Nazis returned to family', 'hate'],
    ['Player receives racist abuse online after match', 'hate'],
  ];

  it.each(cases)('%s', (headline, category) => {
    const result = scanText(headline);
    expect(result.safe).toBe(false);
    expect(categories(headline)).toContain(category);
  });
});

describe('blocklist: harmless headlines pass', () => {
  const cases: string[] = [
    // Sports language that sounds violent but is not.
    "Curry's backup shooting guard steps up in playoff win",
    'England beat Spain in a penalty shootout to reach the final',
    'Rangers win in a shootout after a goalless draw',
    "Alcaraz's killer serve powers him into the semi-finals",
    'Midfielder picks out a killer pass to set up the winner',
    'The battle to be England’s number one goalkeeper is on',
    'GB women denied in first shot at an Olympic place',
    'Heroic York rearguard stuns Wigan in the Grand Final',
    'Chelsea’s secret weapon in the title race',
    'Sprinter false-starts before the starting gun',
    'Olympic champion and rival finish in a dead heat',
    'Arsenal win in sudden death after extra time',
    'Box Art Brawl: which Dragon Quest cover is best?',
    'The team fought hard to strike back in the second half',
    "There's excitement surrounding the team's young guns",
    // Games.
    'Pokémon battle tournament comes to Europe',
    'Pokemon Battles get a new ranked mode',
    "Fortnite's battle royale mode gets a new island",
    'Splatoon 4 is a colourful third-person shooter for all ages',
    'LEGO Star Wars set is a hit with fans',
    'Plants vs. Zombies 3 arrives on Switch',
    'Designer diary: roll the die and build a city',
    'Minecraft gets its first new dimension in 14 years',
    'How to fix it: troubleshooting your controller',
    "This time, it's Death Mountain's turn in our Ocarina of Time replay",
    // Art and writing.
    'Artist paints a riot of colour on city walls',
    'Monet exhibition opens at Tate Modern',
    'Author wins Carnegie Medal for debut novel',
    'Photographer captures shooting stars over the desert',
    'Michael Morpurgo’s War Horse returns to the stage',
    'Festival line-up includes Turnstile, Death Cab for Cutie and Lucy Dacus',
    'Young talent at the centre of a transfer tug-of-war',
    'Schools compete in a tug of war on sports day',
    // Words that merely contain blocked words.
    'Scunthorpe United sign a new striker',
    'Essex and Sussex share the points at Chelmsford',
    'Arsenal and Hancock win again',
    'Therapist-approved journaling tips for students',
    'Skilled players shine at the Warwick chess festival',
    'Grapes and drugstore snacks for the long journey',
    'Bassist and classmates form a school band',
    // UK arts funding is not gambling.
    'National Lottery funding helps grassroots clubs',
    'Lottery-funded gallery opens in Hull',
  ];

  it.each(cases)('%s', (headline) => {
    expect(scanText(headline)).toEqual({ safe: true, reasons: [] });
  });
});

describe('allowlist is narrow', () => {
  it('excuses only the listed phrase, not nearby words', () => {
    expect(scanText('A serial killer serves a life sentence').safe).toBe(false);
    expect(scanText('Police shootout leaves two injured').safe).toBe(false);
    expect(scanText('Star Wars actor arrested').safe).toBe(false);
    expect(scanText('Battle royale game rated 18+').safe).toBe(false);
    expect(scanText('Warzone battle royale gets a new map').safe).toBe(false);
    expect(scanText('Hiker died on Death Mountain').safe).toBe(false);
    expect(scanText('Tug-of-war ends in war of words and a knife attack').safe).toBe(false);
  });

  it('keeps a reason for every blocked category it finds', () => {
    const result = scanText('Gunman shot dead by police after bank robbery');
    expect(result.safe).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining(['violence: "gunman"', 'violence: "shot dead"', 'crime: "police"', 'crime: "robbery"']),
    );
  });

  it('caps the number of reasons', () => {
    const result = scanText('kill murder stab gun knife bomb war death sex drugs beer casino suicide police hell horror');
    expect(result.reasons.length).toBeLessThanOrEqual(6);
  });
});

describe('normalisation', () => {
  it('treats typographic apostrophes, dashes and case like plain text', () => {
    expect(normalizeForScan('Assassin’s Creed – Shadows')).toBe("assassin's creed - shadows");
    expect(scanText('ASSASSIN’S CREED SHADOWS on sale').safe).toBe(false);
    expect(scanText('Self‐harm awareness week').safe).toBe(false);
  });

  it('catches masked swearing', () => {
    expect(scanText('He said s**t on air').safe).toBe(false);
    expect(scanText('What the f*ck, fans asked').safe).toBe(false);
    expect(scanText('Price includes VAT*').safe).toBe(true);
  });

  it('scans the title and the excerpt together', () => {
    expect(scanItem({ title: 'Big win for the home side', excerpt: 'Fans celebrated with beer in the town square.' }).safe).toBe(false);
    expect(scanItem({ title: 'Big win for the home side', excerpt: 'Fans celebrated in the town square.' }).safe).toBe(true);
  });
});

describe('rule tables', () => {
  it('every category has terms and every pattern compiles', () => {
    for (const category of SAFETY_CATEGORIES) {
      expect(BLOCKLIST[category].length).toBeGreaterThan(0);
      for (const term of BLOCKLIST[category]) expect(() => new RegExp(term, 'u')).not.toThrow();
    }
    for (const phrase of ALLOWED_PHRASES) {
      expect(() => new RegExp(phrase.pattern, 'u')).not.toThrow();
      expect(phrase.why.length).toBeGreaterThan(3);
    }
  });

  it('documents the explicit decisions the spec asks for', () => {
    const decided = ['shooting guard', 'penalty shootout', 'killer serve', 'pokémon battle', 'battle royale'];
    for (const phrase of decided) {
      expect(ALLOWED_PHRASES.some((entry) => new RegExp(`^(?:${entry.pattern})$`, 'iu').test(phrase))).toBe(true);
    }
  });
});

describe('scanLesson', () => {
  const lesson = (paragraph: string): LessonContent => ({
    keyIdea: 'A town opens a new library.',
    levels: {
      '7-8': { title: 'A new library', paragraphs: [paragraph] },
      '9-10': { title: 'A new library opens', paragraphs: ['The town celebrated.'] },
    },
    vocabulary: [{ word: 'civic', partOfSpeech: 'adjective', definition: 'about a town', example: 'A civic hall.', band: 'both' }],
    quiz: [{ id: 'q1', skill: 'detail', question: 'What opened?', choices: ['A library', 'A pool', 'A park', 'A shop'], answerIndex: 0, explanation: 'The story says so.' }],
    writingPrompts: [{ id: 'p1', kind: 'summary', prompt: 'Summarise it.', minWords: 40, maxWords: 80, tips: ['Be brief.'] }],
    discussion: ['Why do libraries matter?', 'What would you add?'],
  });

  it('passes clean lessons and flags generated text that slipped', () => {
    expect(scanLesson(lesson('Readers queued before the doors opened.')).safe).toBe(true);
    expect(scanLesson(lesson('Readers queued with beer before the doors opened.')).safe).toBe(false);
  });
});
