import type { LessonContent } from '@/lib/literacy/types';

/**
 * Kid-safety blocklist (SPEC §5 step 4b, §9). Pure and isomorphic so the
 * literacy engine can re-scan generated text with the same rules.
 *
 * Fail-closed by design: a match anywhere in the title or excerpt rejects the
 * item. Losing a harmless story ("Singer dies aged 90", "Man City found
 * guilty of breaking rules") is the accepted cost; the Claude classifier runs
 * afterwards only on items that pass this list, never to rescue rejected ones.
 *
 * Terms are regular-expression fragments matched case-insensitively as whole
 * words (letters and digits count as word characters, so "Pokémon" and
 * "Scunthorpe" behave). Words that sports and games use figuratively all the
 * time ("battle", "attack", "fight", "shot", "strike", "brawl", "gamble") are
 * deliberately not listed; war and crime stories are caught by more specific
 * terms. `ALLOWED_PHRASES` removes known false positives before matching.
 */

export const SAFETY_CATEGORIES = [
  'violence',
  'war-terror',
  'death-injury',
  'sexual',
  'drugs-alcohol',
  'gambling',
  'self-harm',
  'crime',
  'profanity',
  'horror',
  'mature-games',
  'politics',
  'hate',
] as const;
export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];

export const BLOCKLIST: Record<SafetyCategory, readonly string[]> = {
  violence: [
    'kill(?:s|ed|ing|ings|er|ers)?',
    'murder(?:s|ed|er|ers|ous)?',
    'homicides?',
    'manslaughter',
    'massacre[sd]?',
    'slaughter(?:ed)?',
    'stab(?:s|bed|bing|bings)?',
    'shootings?',
    'shooters?',
    'shoot-?outs?',
    'gunm[ae]n',
    'gunfire',
    'gunshots?',
    'gunpoint',
    'shot dead',
    'shot and killed',
    '(?:was|were|been|being|fatally) shot',
    'guns?',
    'firearms?',
    'rifles?',
    'pistols?',
    'handguns?',
    'shotguns?',
    'ammunition',
    'knife',
    'knives',
    'machetes?',
    'weapons?',
    'weaponry',
    'assassins?',
    'assassinat(?:e|ed|ion|ions)',
    'violence',
    'violent(?:ly)?',
    'assault(?:s|ed)?',
    'tortur(?:e|ed|es|ing)',
    'riot(?:s|ing|ers)?',
    'hostages?',
    'kidnap(?:s|ped|ping)?',
    'abduct(?:ed|ion)',
    'ufc',
    'mma',
    'mixed martial arts',
    'cage fight(?:s|ing|er|ers)?',
    'fistfights?',
  ],
  'war-terror': [
    'wars?',
    'wartime',
    'warfare',
    'troops',
    'soldiers?',
    'military',
    'air ?strikes?',
    'missiles?',
    'bomb(?:s|ed|er|ers|ing|ings)?',
    'bombardment',
    'grenades?',
    'explosives?',
    'landmines?',
    'invasion',
    'invade[sd]?',
    'terror',
    'terrorism',
    'terrorists?',
    'jihad(?:i|ist|ists)?',
    'extremists?',
    'genocide',
    'ethnic cleansing',
    'hamas',
    'hezbollah',
    'isis',
    'taliban',
    'al-qaeda',
    'gaza',
    'ceasefire',
    'casualties',
    'death toll',
  ],
  'death-injury': [
    'death',
    'deaths',
    'dead',
    'die',
    'dies',
    'died',
    'dying',
    'passed away',
    'fatal(?:ly|ity|ities)?',
    'corpses?',
    'funerals?',
    'gruesome',
    'horrific injur(?:y|ies)',
    'life-threatening',
    'critical condition',
    'life support',
    'coma',
  ],
  sexual: [
    'sex',
    'sexual(?:ly|ity)?',
    'sexy',
    'sexuali[sz]ed',
    'porn(?:o|ography|ographic)?',
    'nudes?',
    'nudity',
    'naked',
    'erotic(?:a)?',
    'explicit',
    'rap(?:e|ed|es|ist|ists)',
    'prostitut(?:e|es|ion)',
    'strip clubs?',
    'strippers?',
    'brothels?',
    'onlyfans',
    'lingerie',
    'topless',
    'p(?:a)?edophil(?:e|es|ia)',
    'child grooming',
    'grooming gangs?',
    'incest',
    'harassment',
    'condoms?',
    'contracept(?:ion|ive|ives)',
    'fetish(?:es)?',
    'orgy',
    'misconduct',
    'andrew tate',
  ],
  'drugs-alcohol': [
    'drugs?',
    'cocaine',
    'heroin',
    'meth(?:amphetamine)?',
    'cannabis',
    'marijuana',
    'ketamine',
    'fentanyl',
    'opioids?',
    'overdos(?:e|es|ed)',
    'narcotics?',
    'lsd',
    'magic mushrooms?',
    'doping',
    'steroids?',
    'alcohol(?:ic|ism)?',
    'beers?',
    'wines?',
    'vodka',
    'whisk(?:e)?y',
    'tequila',
    'champagne',
    'cocktails?',
    'drunk(?:en)?',
    'booz(?:e|y)',
    'hangovers?',
    'brewer(?:y|ies)',
    'binge drinking',
    'underage drinking',
    'drink-?driv(?:ing|er|ers)',
    'smoking',
    'cigarettes?',
    'cigars?',
    'tobacco',
    'nicotine',
    'vap(?:e|es|ing|er|ers)',
    'e-cigarettes?',
    'juul',
  ],
  gambling: [
    'gambling',
    'gamblers?',
    'betting',
    'bet365',
    'bookmakers?',
    'bookies',
    'sportsbooks?',
    'casinos?',
    'poker',
    'blackjack',
    'roulette',
    'jackpots?',
    'slot machines?',
    'lotter(?:y|ies)',
    'wager(?:s|ed|ing)?',
    'loot box(?:es)?',
    'free spins',
    'coin master',
    'bingo',
    'parlays?',
  ],
  'self-harm': [
    'suicid(?:e|es|al)',
    'self[- ]?harm(?:ing)?',
    'self[- ]?injur(?:y|ies)',
    'eating disorders?',
    'anorexi(?:a|c)',
    'bulimi(?:a|c)',
    'kill(?:ed|s)? (?:himself|herself|themselves)',
    'took (?:his|her|their) own life',
  ],
  crime: [
    'crimes?',
    'criminals?',
    'arrest(?:s|ed|ing)?',
    'charged with',
    'been charged',
    'court case',
    'in court',
    '(?:crown|magistrates\'?|high|supreme|district|federal|family|youth) court',
    'court hearing',
    'on trial',
    'stands? trial',
    'criminal trial',
    'guilty',
    'jail(?:s|ed)?',
    'prisons?',
    'prisoners?',
    'imprison(?:ed|ment)',
    'sentenced',
    'convicted',
    'life sentence',
    'death penalty',
    'death row',
    'police',
    'robber(?:y|ies|s)?',
    'burglar(?:y|ies|s)?',
    'theft',
    'thie(?:f|ves)',
    'stolen',
    'fraud(?:ulent)?',
    'scam(?:s|mer|mers)?',
    'money laundering',
    'brib(?:e|es|ery)',
    'corruption',
    'smuggl(?:e|ed|er|ers|ing)',
    'traffick(?:ing|ed|ers)',
    'gang(?:s|ster|sters)?',
    'mafia',
    'cartels?',
    'abus(?:e|ed|er|ers|es|ive)',
    'vandal(?:s|ism|ised|ized)?',
    'allegations?',
    'alleged(?:ly)?',
  ],
  profanity: [
    'fuck\\p{L}*',
    'shit\\p{L}*',
    'bitch(?:es|y)?',
    'bastards?',
    'damn(?:ed|it)?',
    'goddamn',
    'crap(?:py)?',
    'piss(?:ed)?',
    'arse(?:hole)?',
    'ass(?:hole|holes)?',
    'badass',
    'cunts?',
    'sluts?',
    'whores?',
    'bollocks',
    'wankers?',
    'twats?',
    'motherf\\p{L}*',
    'wtf',
    'hell',
    // Masked swearing such as "f***", "s**t" or "f*ck".
    '\\p{L}+(?:\\*{2,}\\p{L}*|\\*\\p{L}+)',
  ],
  horror: [
    'horrors?',
    'gore',
    'gory',
    'grisly',
    'blood(?:y|ied|shed|bath|thirsty)?',
    'zombies?',
    'demon(?:s|ic)?',
    'satan(?:ic|ism)?',
    'occult',
    'exorcis(?:m|t|ts)',
    'slashers?',
    'cannibal(?:s|ism)?',
    'decapitat(?:e|ed|ion)',
    'dismember(?:ed|ment)?',
    'mutilat(?:e|ed|ion)',
    'disembowel(?:ed|led)?',
    'hellraiser',
    'chainsaw',
  ],
  'mature-games': [
    'grand theft auto',
    'gta(?: ?(?:v|vi|iv|5|6|online))?',
    'call of duty',
    'warzone',
    'mortal kombat',
    'resident evil',
    'the last of us',
    'doom',
    'cyberpunk',
    'witcher',
    'god of war',
    'gears of war',
    'dead space',
    'silent hill',
    'outlast',
    'bloodborne',
    'elden ring',
    'dark souls',
    'manhunt',
    'hitman',
    'far cry',
    'red dead',
    'assassin\'?s creed',
    'saints row',
    'dying light',
    'dead island',
    'callisto protocol',
    'evil within',
    'until dawn',
    'hellblade',
    'diablo',
    'counter-? ?strike',
    'rainbow six',
    'battlefield',
    'metal gear',
    'bioshock',
    'fallout',
    'dead by daylight',
    'onimusha',
    'ninja gaiden',
    'devil may cry',
    'bayonetta',
    'marvel\'?s wolverine',
    'alan wake',
    'sniper elite',
    'hotline miami',
    'left 4 dead',
    'dishonored',
    'starfield',
    'baldur\'?s gate',
    'persona [345]',
    'rated m',
    'm-rated',
    'mature 17\\+',
    'pegi 18',
    'rated 18',
    '18-rated',
    '18\\+',
    'adults[- ]only',
    'nsfw',
  ],
  politics: [
    'elections?',
    'electoral',
    'ballots?',
    'polling stations?',
    'referendum',
    'campaign trail',
    'republicans?',
    'democrats?',
    'democratic party',
    'labour party',
    'conservative party',
    'lib dems?',
    'reform uk',
    'tor(?:y|ies)',
    'prime minister',
    'trump',
    'biden',
    'white house',
    'congress(?:ional)?',
    'senators?',
    'senate',
    'parliament(?:ary)?',
    'downing street',
    'politicians?',
    'political',
    'politics',
  ],
  hate: [
    'racis(?:t|m|ts)',
    'slurs?',
    'homophob(?:ic|ia)',
    'transphob(?:ic|ia)',
    'antisemit(?:ic|ism)',
    'islamophob(?:ic|ia)',
    'nazi(?:s|sm)?',
    'hitler',
    'swastikas?',
    'white supremac(?:y|ist|ists)',
    'hate crimes?',
    'hate speech',
    'kkk',
    'ku klux',
    'bigot(?:s|ry|ed)?',
    'misogyn(?:y|ist|istic)',
  ],
};

export interface AllowedPhrase {
  /** Regular-expression fragment, matched as whole words like the blocklist. */
  pattern: string;
  why: string;
}

/**
 * Explicit, reviewed exceptions. Each one is removed from the text before the
 * blocklist runs, so only the listed phrase is excused: "killer serve" passes
 * but "serial killer" still fails.
 */
export const ALLOWED_PHRASES: readonly AllowedPhrase[] = [
  { pattern: 'shooting guards?', why: 'Basketball position.' },
  { pattern: 'three-point shooting|shooting percentage', why: 'Basketball statistics.' },
  { pattern: 'shooting stars?', why: 'Meteors, and the idiom.' },
  {
    pattern: 'penalty shoot-?outs?|shoot-?out (?:win|wins|victory|defeat|loss|success|heartbreak)|(?:win|wins|won|lose|loses|lost|beat|beats|beaten) (?:in|on) (?:a |the )?shoot-?out',
    why: 'Decided on penalties (football, hockey). A bare "shootout" stays blocked because it can mean a gunfight.',
  },
  { pattern: 'killer serves?', why: 'Tennis: an unreturnable serve.' },
  { pattern: 'killer (?:pass|passes|ball|balls)', why: 'Football: a decisive pass.' },
  { pattern: 'killer instinct', why: 'Sports idiom for ruthlessness, and a fighting game rated 12+/Teen.' },
  {
    pattern: 'pok[eé]mon battles?',
    why: 'Decision: allowed. Pokémon battles are turn-based and rated for everyone. ("battle" alone is not blocked; this keeps the decision explicit.)',
  },
  {
    pattern: 'battle royales?',
    why: 'Decision: allowed as a games genre (e.g. Fortnite, PEGI 12 / Teen), appropriate for 12–15. Mature titles in the genre are caught by name (Call of Duty: Warzone), and the classifier reviews the rest.',
  },
  {
    pattern: '(?:first|third)[- ]person shooters?|hero shooters?|arena shooters?|twin-stick shooters?',
    why: 'Games genre names (Splatoon is a third-person shooter rated for everyone). Mature shooters are caught by name.',
  },
  { pattern: 'star wars', why: 'Film and toy franchise.' },
  { pattern: 'console wars?|price wars?|bidding wars?|tug[- ]of[- ]war', why: 'Business and playground idioms ("transfer tug-of-war").' },
  { pattern: 'war horse', why: "Michael Morpurgo's children's novel and play." },
  { pattern: 'secret weapons?', why: 'Sports idiom for a key player.' },
  { pattern: 'starting guns?', why: 'Athletics.' },
  { pattern: 'big guns|young guns', why: 'Idioms for leading or promising players.' },
  { pattern: 'trouble-?shooting', why: 'Fixing a problem.' },
  { pattern: 'top gun', why: 'Film title rated PG / 12.' },
  { pattern: 'sudden death', why: 'Tie-break format in sport.' },
  { pattern: 'dead heats?|dead[- ]ball|dead rubbers?', why: 'Sports terms (a tie; a stopped ball; a match with nothing at stake).' },
  { pattern: 'death star', why: 'Star Wars toy and film prop.' },
  { pattern: 'death mountain', why: 'A volcano level in The Legend of Zelda (rated for everyone / 12+).' },
  { pattern: 'death cab for cutie', why: 'Indie rock band, named in festival line-ups.' },
  { pattern: 'die-cast|die-hard', why: 'Toy models; loyal fans.' },
  { pattern: 'roll (?:a|the) die|(?:six|6|ten|10|twenty|20)-sided die', why: 'Board games.' },
  { pattern: 'blood moons?', why: 'Lunar eclipse.' },
  { pattern: 'plants vs\\.? zombies', why: 'Cartoon strategy game rated for everyone / 10+.' },
  { pattern: 'national lottery|lottery[- ]fund(?:ed|ing)', why: 'UK grants for sport and the arts, not gambling.' },
  { pattern: 'riot of colou?rs?', why: 'Art idiom.' },
  { pattern: 'pitch invasions?|pitch invaders?', why: 'Football fans running onto the pitch.' },
  { pattern: 'stolen bases?', why: 'Baseball statistic.' },
  { pattern: 'guilty pleasures?', why: 'Idiom.' },
  { pattern: 'trump cards?|no trumps?', why: 'Card and board game terms.' },
  { pattern: 'ottawa senators', why: 'Ice hockey team.' },
  { pattern: 'court of arbitration for sport', why: 'Sports tribunal; its rulings are sports news.' },
];

export interface ScanResult {
  safe: boolean;
  /** Human-readable, e.g. `violence: "shooting"`. Empty when safe. */
  reasons: string[];
}

const MAX_REASONS = 6;

// Text is whitespace-collapsed before matching, so a space in a term matches exactly one space.
const wholeWords = (fragment: string, flags: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${fragment})(?![\\p{L}\\p{N}])`, flags);

const categoryPatterns: ReadonlyArray<readonly [SafetyCategory, RegExp]> = SAFETY_CATEGORIES.map(
  (category) => [category, wholeWords(BLOCKLIST[category].join('|'), 'giu')] as const,
);

const allowedPattern = wholeWords(ALLOWED_PHRASES.map((phrase) => phrase.pattern).join('|'), 'giu');

/** Unicode-normalised, lower-case, with typographic apostrophes and dashes made plain. */
export function normalizeForScan(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'")
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Scans free text against the blocklist (after removing allowed phrases). */
export function scanText(text: string): ScanResult {
  const cleaned = normalizeForScan(text).replace(allowedPattern, ' ');
  const reasons: string[] = [];
  for (const [category, pattern] of categoryPatterns) {
    const terms = new Set<string>();
    for (const match of cleaned.matchAll(pattern)) terms.add(match[0].replace(/\s+/g, ' '));
    for (const term of terms) {
      if (reasons.length >= MAX_REASONS) break;
      reasons.push(`${category}: "${term}"`);
    }
  }
  return { safe: reasons.length === 0, reasons };
}

/** Scans an article's title and excerpt together. */
export function scanItem(item: { title: string; excerpt: string }): ScanResult {
  return scanText(`${item.title}\n${item.excerpt}`);
}

/** Every piece of student-facing text in a lesson, for re-scanning generated content. */
export function lessonText(content: LessonContent): string {
  const parts: string[] = [content.keyIdea];
  for (const level of Object.values(content.levels)) parts.push(level.title, ...level.paragraphs);
  for (const item of content.vocabulary) parts.push(item.word, item.definition, item.example);
  for (const question of content.quiz) parts.push(question.question, ...question.choices, question.explanation);
  for (const prompt of content.writingPrompts) parts.push(prompt.prompt, ...prompt.tips);
  parts.push(...content.discussion);
  return parts.join('\n');
}

export function scanLesson(content: LessonContent): ScanResult {
  return scanText(lessonText(content));
}
