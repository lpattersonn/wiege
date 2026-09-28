import { getCategory, type CategorySlug } from '@/lib/categories';
import { tokenizeWords } from '@/lib/progress/text';
import { quoteStart } from '@/lib/literacy/feedback-core';
import { isFunctionWord } from '@/lib/literacy/function-words';
import { splitSentences } from '@/lib/literacy/readability';
import type { LessonContent, QuizQuestion, VocabularyItem, WritingPrompt } from '@/lib/literacy/types';
import { baseCandidates, containsWord, normalizeWordToken } from '@/lib/literacy/word-forms';
import { COMMON_LONG_WORDS, TIER2_WORDS, tier2Entry, type WordListEntry } from '@/lib/literacy/wordlists';

/**
 * The offline lesson generator (SPEC §6): deterministic (seeded by the story's
 * URL and title), needs no network and always returns a complete lesson. It
 * works only from the title and the short excerpt, which already passed the
 * safety filter, plus reviewed templates. The retelling is the cleaned excerpt
 * (long sentences split for Grade 7–8) followed by a short reading guide whose
 * wording guarantees enough tier-2 vocabulary for every lesson.
 */

export interface HeuristicSourceInput {
  title: string;
  excerpt: string;
  category: CategorySlug;
  sourceName: string;
  url: string;
}

// --- deterministic randomness ---------------------------------------------------------

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// --- cleaning -------------------------------------------------------------------------

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The headline without a trailing " - Source" / " | Source" and without a final full stop. */
export function cleanTitle(title: string, sourceName: string): string {
  let clean = title.replace(/\s+/g, ' ').trim();
  if (sourceName.trim()) {
    clean = clean.replace(new RegExp(`\\s+[-–—|:]\\s+${escapeRegExp(sourceName.trim())}\\s*$`, 'i'), '');
  }
  clean = clean.replace(/[.\s]+$/, '');
  if (clean.length > 120) clean = `${clean.slice(0, 120).replace(/\s+\S*$/, '')}…`;
  return clean || 'A story from the news';
}

const BOILERPLATE = [
  /The post .{1,300}? appeared first on .{1,200}?\.?\s*$/i,
  /\b(?:Continue reading|Read more|Read the full (?:story|article))\b.*$/i,
  /\[(?:…|\.\.\.)\]|\(more…\)/g,
  /https?:\/\/\S+/g,
];

/** Plain excerpt text without feed boilerplate, links or a sentence cut off mid-way. */
export function cleanExcerpt(excerpt: string): string {
  let text = excerpt.replace(/\s+/g, ' ').trim();
  for (const pattern of BOILERPLATE) text = text.replace(pattern, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  if (/(?:…|\.\.\.)$/.test(text)) {
    const sentences = splitSentences(text);
    if (sentences.length > 1) text = sentences.slice(0, -1).join(' ');
    else text = text.replace(/\s*(?:…|\.\.\.)$/, '…');
  }
  return text;
}

// --- retelling ------------------------------------------------------------------------

const MAX_JUNIOR_SENTENCE_WORDS = 20;
const MIN_PART_WORDS = 6;

const SPLIT_POINTS: ReadonlyArray<{ separator: string; lead: string }> = [
  { separator: '; ', lead: '' },
  { separator: ' – ', lead: '' },
  { separator: ' — ', lead: '' },
  { separator: ', but ', lead: 'But ' },
  { separator: ', and ', lead: '' },
  { separator: ', so ', lead: 'So ' },
];

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Splits a long sentence once at the most central clause boundary, for Grade 7–8. */
export function splitLongSentence(sentence: string, depth = 0): string[] {
  const words = tokenizeWords(sentence).length;
  if (words <= MAX_JUNIOR_SENTENCE_WORDS || depth > 1 || /["“”]/.test(sentence)) return [sentence];
  const ending = /[.!?…]["'”’)]*$/.exec(sentence)?.[0] ?? '.';
  const body = sentence.slice(0, sentence.length - (/[.!?…]["'”’)]*$/.test(sentence) ? ending.length : 0));

  let best: { index: number; separator: string; lead: string; distance: number } | null = null;
  for (const { separator, lead } of SPLIT_POINTS) {
    let index = body.indexOf(separator);
    while (index !== -1) {
      const left = tokenizeWords(body.slice(0, index)).length;
      const right = tokenizeWords(body.slice(index + separator.length)).length;
      if (left >= MIN_PART_WORDS && right >= MIN_PART_WORDS) {
        const distance = Math.abs(left - right);
        if (!best || distance < best.distance) best = { index, separator, lead, distance };
      }
      index = body.indexOf(separator, index + 1);
    }
  }
  if (!best) return [sentence];
  const left = `${body.slice(0, best.index).replace(/[,;:\s]+$/, '')}.`;
  const rightText = body.slice(best.index + best.separator.length).trim();
  const right = `${best.lead ? best.lead + rightText : capitalise(rightText)}${ending}`;
  return [...splitLongSentence(left, depth + 1), ...splitLongSentence(right, depth + 1)];
}

function paragraphs(sentences: string[], perParagraph: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += perParagraph) out.push(sentences.slice(i, i + perParagraph).join(' '));
  return out;
}

/**
 * A short reading guide per category, one version per level. Each version
 * contains at least five tier-2 words that also appear in the other version,
 * so every lesson has enough vocabulary with real definitions.
 */
const READING_GUIDES: Readonly<Record<CategorySlug, { junior: (source: string) => string[]; senior: (source: string) => string }>> = {
  writing: {
    junior: (source) => [
      `This story comes from ${source}.`,
      'Reports about books and writers often describe how one idea can inspire many readers.',
      'As you read, notice the details the writer chose to include.',
      "Think about the writer's perspective, too.",
    ],
    senior: (source) =>
      `${source} published this report. Coverage of books and writing often sets out to describe how a single idea can inspire a whole community of readers; as you read, notice the details the writer chose to include and consider what perspective they reflect.`,
  },
  games: {
    junior: (source) => [
      `This story comes from ${source}.`,
      'Games news often explains how designers build new challenges for players.',
      'As you read, notice the details that reveal why this news is significant.',
      'Think about who the audience for this story is.',
    ],
    senior: (source) =>
      `${source} published this report. Games coverage often explains the decisions designers make when they build challenges for players; as you read, notice the details that reveal why this news could be significant, and consider which audience it is written for.`,
  },
  art: {
    junior: (source) => [
      `This story comes from ${source}.`,
      'Articles about art often describe how artists express ideas and feelings.',
      'As you read, notice the details that help you picture the work.',
      'Think about the impact it might have on the people who see it.',
    ],
    senior: (source) =>
      `${source} published this report. Writing about art often tries to describe how an artist chose to express an idea; as you read, notice the details that help you picture the work, and consider the impact it might have on the people who encounter it.`,
  },
  sports: {
    junior: (source) => [
      `This story comes from ${source}.`,
      'Sports news often describes how athletes and teams prepare, compete and improve.',
      'As you read, notice the details that show their strategy and determination.',
      'Think about what the result means to fans.',
    ],
    senior: (source) =>
      `${source} published this report. Sports coverage often describes how athletes and teams prepare, compete and improve; as you read, notice the details that reveal their strategy and determination, and consider what the outcome means to supporters.`,
  },
};

// --- vocabulary -----------------------------------------------------------------------

const WORD_BOUNDARY = '[^\\p{L}\\p{N}]';

interface VocabularyMatch {
  surface: string;
  entry: WordListEntry | null;
  exact: boolean;
  sentence: string;
}

function tier2Matches(sentences: string[]): VocabularyMatch[] {
  const matches: VocabularyMatch[] = [];
  for (const sentence of sentences) {
    for (const token of tokenizeWords(sentence)) {
      for (const candidate of baseCandidates(token)) {
        const entry = tier2Entry(candidate.base);
        if (!entry || (candidate.classes !== null && !candidate.classes.includes(entry.partOfSpeech))) continue;
        matches.push({ surface: normalizeWordToken(token), entry, exact: candidate.classes === null, sentence });
        break;
      }
    }
  }
  return matches;
}

const LETTER = new RegExp('\\p{L}', 'gu');
const UPPERCASE_START = new RegExp('^\\p{Lu}', 'u');

function guessPartOfSpeech(word: string): string {
  if (/(?:tion|sion|ment|ness|ity|ance|ence|ship|ism|ist|er|or)s?$/.test(word)) return 'noun';
  if (/ly$/.test(word)) return 'adverb';
  if (/(?:ous|ful|ive|able|ible|al|ic|less|ish)$/.test(word)) return 'adjective';
  if (/(?:ise|ize|ate|ify|ed|ing)$/.test(word)) return 'verb';
  return 'word';
}

/** Long words that are not everyday words or names, for stories with few tier-2 words. */
function rareWordMatches(sentences: string[]): VocabularyMatch[] {
  const text = sentences.join(' ');
  const out: VocabularyMatch[] = [];
  for (const sentence of sentences) {
    for (const token of tokenizeWords(sentence)) {
      const word = normalizeWordToken(token);
      if ((token.match(LETTER)?.length ?? 0) < 8 || /\d|-/.test(token) || isFunctionWord(word)) continue;
      // Skip names: capitalised and never written in lower case in the story.
      if (UPPERCASE_START.test(token) && !containsWordCaseSensitive(text, word)) continue;
      if (baseCandidates(word, { derivations: true }).some((c) => COMMON_LONG_WORDS.has(c.base))) continue;
      // A long inflection of a short everyday root ("bringing", "floating") is not a vocabulary word.
      if (baseCandidates(word).some((c) => c.classes !== null && c.base.length <= 5)) continue;
      out.push({ surface: word, entry: null, exact: true, sentence });
    }
  }
  return out;
}

function containsWordCaseSensitive(text: string, word: string): boolean {
  return containsWord(text, word, { caseSensitive: true });
}

const MAX_VOCABULARY = 7;
const MIN_STORY_TIER2 = 3;
const MAX_RARE_WORDS = 2;

function chooseVocabulary(storySentences: string[], guideSentences: string[], juniorText: string, seniorText: string): VocabularyItem[] {
  const fromStory = tier2Matches(storySentences).sort((a, b) => Number(b.exact) - Number(a.exact));
  const pool: VocabularyMatch[] = [...fromStory];
  const storyEntries = new Set(fromStory.map((m) => m.entry?.word));
  if (storyEntries.size < MIN_STORY_TIER2) pool.push(...rareWordMatches(storySentences).slice(0, MAX_RARE_WORDS));
  pool.push(...tier2Matches(guideSentences));

  const chosen: VocabularyItem[] = [];
  const seen = new Set<string>();
  for (const match of pool) {
    if (chosen.length >= MAX_VOCABULARY) break;
    const key = match.entry?.word ?? match.surface;
    if (seen.has(key) || seen.has(match.surface)) continue;
    const inJunior = containsWord(juniorText, match.surface);
    const inSenior = containsWord(seniorText, match.surface);
    if (!inJunior && !inSenior) continue;
    seen.add(key);
    seen.add(match.surface);
    chosen.push({
      word: match.surface,
      partOfSpeech: match.entry?.partOfSpeech ?? guessPartOfSpeech(match.surface),
      definition: match.entry
        ? capitalise(match.entry.definition)
        : 'A less common word from this story. Use the sentence around it to work out what it means.',
      example: match.entry ? match.entry.example : match.sentence,
      band: inJunior && inSenior ? 'both' : inJunior ? '7-8' : '9-10',
    });
  }
  return chosen;
}

// --- quiz -----------------------------------------------------------------------------

function choiceQuestion(
  id: string,
  skill: QuizQuestion['skill'],
  question: string,
  correct: string,
  distractors: string[],
  explanation: string,
  random: () => number,
): QuizQuestion {
  const unique: string[] = [];
  for (const option of [correct, ...distractors]) {
    if (unique.length === 4) break;
    if (!unique.some((u) => u.toLowerCase() === option.toLowerCase())) unique.push(option);
  }
  const choices = shuffled(unique, random);
  return { id, skill, question, choices, answerIndex: choices.indexOf(correct), explanation };
}

const DECOY_HEADLINES: Readonly<Record<CategorySlug, readonly string[]>> = {
  writing: [
    'School poetry club publishes its first book',
    'Students swap letters with pen pals in another country',
    'New comic series follows a team of young inventors',
    'Spelling contest crowns a new champion',
    'Library opens a reading garden for the summer',
    'Museum shows handwritten drafts of famous stories',
  ],
  games: [
    'Puzzle game adds a level editor for players',
    'Board game café opens in the city centre',
    'Racing game gets a new track by the sea',
    'Students design a video game about recycling',
    'Volunteers restore a classic arcade machine',
    'Chess club doubles in size after a tournament win',
  ],
  art: [
    'Giant mural brightens a school playground',
    'Museum opens a gallery of ancient pottery',
    'Young photographers win a wildlife picture prize',
    'Sculpture made from recycled bottles goes on show',
    'Artists paint a train station with local legends',
    'Paper-cut exhibition travels to five cities',
  ],
  sports: [
    'Local swimmer breaks a club record',
    'Netball team wins its first national title',
    'Cyclists ride coast to coast for charity',
    'New skate park opens after years of planning',
    'Rowing crew trains at dawn for a big race',
    'Table tennis star visits school clubs',
  ],
};

function headlineQuestion(input: HeuristicSourceInput, title: string, siblingTitles: readonly string[], random: () => number): QuizQuestion {
  const siblings = shuffled(
    [...new Set(siblingTitles.map((t) => cleanTitle(t, '')).filter((t) => t.length >= 10 && t.toLowerCase() !== title.toLowerCase()))],
    random,
  );
  const decoys = shuffled(DECOY_HEADLINES[input.category], random);
  return choiceQuestion(
    'q1',
    'main-idea',
    'Which headline fits this story best?',
    title,
    [...siblings, ...decoys],
    `"${title}" matches what the story reports. The other headlines are about different stories.`,
    random,
  );
}

const NUMBER = /\b\d{1,3}(?:,\d{3})+\b|\b\d+\b/;
const CAPITALISED_WORD = new RegExp("^\\p{Lu}[\\p{L}'’-]*$", 'u');

interface ClozeTarget {
  sentence: string;
  answer: string;
  distractors: string[];
}

function numberDistractors(value: string): string[] {
  const n = Number(value.replace(/,/g, ''));
  if (!Number.isFinite(n)) return [];
  const format = (x: number) => (value.includes(',') ? x.toLocaleString('en-GB') : String(x));
  const options = [n + 1, n * 2, n + 10, Math.round(n / 2), n - 1].filter((x) => x > 0 && x !== n);
  return [...new Set(options)].map(format);
}

function clozeTarget(storySentences: string[], random: () => number): ClozeTarget | null {
  const allText = storySentences.join(' ');
  for (const sentence of storySentences) {
    const number = NUMBER.exec(sentence)?.[0];
    if (number && tokenizeWords(sentence).length >= 5) {
      const distractors = numberDistractors(number);
      if (distractors.length >= 3) return { sentence, answer: number, distractors };
    }
  }

  // Capitalised words after the first word of a sentence are names, places and titles.
  const namesIn = (sentence: string) =>
    tokenizeWords(sentence)
      .slice(1)
      .filter((w) => CAPITALISED_WORD.test(w) && w !== 'I' && w.length >= 3);
  const names = [...new Set(storySentences.flatMap(namesIn))];
  for (const sentence of storySentences) {
    const name = namesIn(sentence)[0];
    if (!name) continue;
    const others = names.filter((n) => n !== name && !containsWordCaseSensitive(sentence, n));
    if (others.length >= 3) return { sentence, answer: name, distractors: shuffled(others, random) };
  }

  const contentWords = (text: string) =>
    tokenizeWords(text).filter((w) => (w.match(LETTER)?.length ?? 0) >= 5 && !isFunctionWord(w) && !CAPITALISED_WORD.test(w) && !/\d/.test(w));
  const sentence = [...storySentences].sort((a, b) => contentWords(b).length - contentWords(a).length)[0];
  if (!sentence) return null;
  const answer = [...contentWords(sentence)].sort((a, b) => b.length - a.length || a.localeCompare(b))[0];
  if (!answer) return null;
  const fromText = [...new Set(contentWords(allText).map((w) => w.toLowerCase()))].filter((w) => w !== answer.toLowerCase() && !containsWord(sentence, w));
  // Tier-2 words closest in length to the answer, so no choice stands out by its size.
  const fromList = TIER2_WORDS.map((e) => e.word)
    .filter((w) => !containsWord(allText, w))
    .sort((a, b) => Math.abs(a.length - answer.length) - Math.abs(b.length - answer.length) || a.localeCompare(b))
    .slice(0, 24);
  return { sentence, answer, distractors: [...shuffled(fromText, random), ...shuffled(fromList, random)] };
}

function clozeQuestion(storySentences: string[], random: () => number): QuizQuestion | null {
  const target = clozeTarget(storySentences, random);
  if (!target) return null;
  const blanked = target.sentence.replace(
    new RegExp(`(^|${WORD_BOUNDARY})${escapeRegExp(target.answer)}(?=$|${WORD_BOUNDARY})`, 'u'),
    '$1_____',
  );
  if (blanked === target.sentence) return null;
  return choiceQuestion(
    'q2',
    'detail',
    `Which word completes this sentence from the story? "${blanked}"`,
    target.answer,
    target.distractors,
    `The story says: "${target.sentence}"`,
    random,
  );
}

function vocabularyQuestion(vocabulary: VocabularyItem[], sentences: string[], random: () => number): QuizQuestion {
  const item = vocabulary.find((v) => tier2Entry(v.word) || !v.definition.startsWith('A less common word')) ?? vocabulary[0];
  const lessonWords = new Set(vocabulary.map((v) => v.word));
  const samePart = TIER2_WORDS.filter(
    (e) => e.partOfSpeech === item.partOfSpeech && !lessonWords.has(e.word) && capitalise(e.definition) !== item.definition,
  );
  const others = TIER2_WORDS.filter((e) => !lessonWords.has(e.word));
  const distractors = [...shuffled(samePart, random), ...shuffled(others, random)].map((e) => capitalise(e.definition));
  const sentence = sentences.find((s) => containsWord(s, item.word));
  return choiceQuestion(
    'q3',
    'vocabulary',
    `In the story, what does "${item.word}" mean?`,
    item.definition,
    distractors,
    sentence ? `"${item.word}" here means: ${lowerFirst(item.definition)}. The story says: "${sentence}"` : `"${item.word}" means: ${lowerFirst(item.definition)}.`,
    random,
  );
}

const OTHER_SOURCES = ['A school newsletter', 'A cookery magazine', 'A travel guide', 'A weather forecast', 'A science podcast'];

function sourceQuestion(source: string, random: () => number): QuizQuestion {
  return choiceQuestion(
    'q2',
    'detail',
    'Where does this story come from?',
    source,
    shuffled(OTHER_SOURCES, random),
    `The story says it comes from ${source}.`,
    random,
  );
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

const PURPOSE_ANSWERS: Readonly<Record<CategorySlug, string>> = {
  writing: 'To inform readers about news from the world of books and writing',
  games: 'To inform readers about news from the world of games',
  art: 'To inform readers about news from the world of art',
  sports: 'To inform readers about news from the world of sport',
};

function purposeQuestion(input: HeuristicSourceInput, random: () => number): QuizQuestion {
  return choiceQuestion(
    'q4',
    'purpose',
    'What is the main purpose of this story?',
    PURPOSE_ANSWERS[input.category],
    ['To persuade readers to buy a product', 'To entertain readers with a made-up adventure', 'To teach readers how to do a task step by step'],
    `It is a news report from ${input.sourceName}: it tells readers about real events, rather than selling something, telling an invented story or giving instructions.`,
    random,
  );
}

function sequenceQuestion(juniorSentences: string[], random: () => number): QuizQuestion {
  const [first, ...rest] = juniorSentences;
  const others = [...new Map(rest.map((s) => [s.toLowerCase(), s] as const)).values()].filter((s) => s.toLowerCase() !== first.toLowerCase());
  const pick = [first, ...shuffled(others, random).slice(0, 3)];
  const distinct = (labels: string[]) => new Set(labels.map((l) => l.toLowerCase())).size === labels.length;
  // Quote more of any sentences that start the same way, up to the whole sentence.
  let labels = pick.map((s) => quoteStart(s, 8));
  for (let words = 12; !distinct(labels) && words <= 40; words += 4) labels = pick.map((s) => quoteStart(s, words));
  if (!distinct(labels)) labels = [...pick];
  return choiceQuestion(
    'q5',
    'sequence',
    'Which of these sentences comes first in the story?',
    labels[0],
    labels.slice(1),
    `The story begins: "${first}"`,
    random,
  );
}

// --- writing prompts and discussion ------------------------------------------------------

const SUMMARY_PROMPT: WritingPrompt = {
  id: 'p1',
  kind: 'summary',
  prompt: 'Summarise this story in three or four sentences for a friend who has not read it. Say what happened, who was involved and why it matters.',
  minWords: 40,
  maxWords: 90,
  tips: ['Start with who and what.', 'Use your own words instead of copying sentences.', 'End with why it matters.'],
};

const CATEGORY_PROMPTS: Readonly<Record<CategorySlug, readonly [Omit<WritingPrompt, 'id'>, Omit<WritingPrompt, 'id'>]>> = {
  writing: [
    {
      kind: 'opinion',
      prompt: 'Would you like to read, write or take part in what this story describes? Give your opinion and two reasons.',
      minWords: 60,
      maxWords: 150,
      tips: ['State your opinion in the first sentence.', 'Give each reason its own sentence, using "because".', 'Include one detail from the story.'],
    },
    {
      kind: 'creative',
      prompt: 'Write the opening of a short story inspired by this news. Introduce a character who notices something unusual.',
      minWords: 80,
      maxWords: 200,
      tips: ['Start in the middle of the action.', 'Use at least two senses: what can your character see, hear or feel?', 'End on a question that makes the reader want more.'],
    },
  ],
  games: [
    {
      kind: 'opinion',
      prompt: 'Is this good news for players? Give your opinion and back it up with two reasons from the story.',
      minWords: 60,
      maxWords: 150,
      tips: ['State your opinion in the first sentence.', 'Use "because" to explain each reason.', 'Think about players who might see it differently.'],
    },
    {
      kind: 'headline',
      prompt: 'Write two new headlines for this story, one serious and one playful. Then explain in a sentence which one fits better.',
      minWords: 15,
      maxWords: 50,
      tips: ['Keep each headline under 12 words.', 'Use a strong verb.', 'Make sure both headlines are accurate.'],
    },
  ],
  art: [
    {
      kind: 'letter',
      prompt: 'Write a short letter to the people behind the art or event in this story. Tell them what caught your attention and ask them one question.',
      minWords: 60,
      maxWords: 150,
      tips: ['Start with a greeting.', 'Mention one specific detail from the story.', 'Ask a question you would really like answered.'],
    },
    {
      kind: 'creative',
      prompt: 'Imagine you are standing in front of the art or scene in this story. Describe what you notice, using at least two senses.',
      minWords: 80,
      maxWords: 200,
      tips: ['Start with the first thing that catches your eye.', 'Use precise words for colour, shape and texture.', 'End with what the scene makes you think about.'],
    },
  ],
  sports: [
    {
      kind: 'opinion',
      prompt: 'What does this story show about practice, teamwork or determination? Explain your view with a detail from the story.',
      minWords: 60,
      maxWords: 150,
      tips: ['Pick one quality and name it in your first sentence.', 'Support it with a detail from the story.', 'Explain why that quality matters.'],
    },
    {
      kind: 'letter',
      prompt: 'Write a short message to someone in this story to congratulate or encourage them. Mention one specific thing they did.',
      minWords: 60,
      maxWords: 150,
      tips: ['Start with a greeting.', 'Mention one specific moment from the story.', 'Finish with a question or a good wish.'],
    },
  ],
};

const DISCUSSION: Readonly<Record<CategorySlug, readonly [string, string]>> = {
  writing: [
    'Why do you think people still care so much about books and stories?',
    'If you could ask one person in this story a question, what would it be, and why?',
  ],
  games: ['What makes a game worth playing again and again?', 'Who do you think this news matters to most, and why?'],
  art: ['Does art have to be beautiful to be good? Why or why not?', 'Where do you see art in your everyday life, outside galleries and museums?'],
  sports: [
    'What can people learn from sport that helps them in other parts of life?',
    'Is winning the most important part of sport? Why or why not?',
  ],
};

// --- lesson ---------------------------------------------------------------------------

export function heuristicLesson(input: HeuristicSourceInput, opts: { siblingTitles?: readonly string[] } = {}): LessonContent {
  const random = seededRandom(fnv1a(`${input.url}\n${input.title}`));
  const source = input.sourceName.trim() || getCategory(input.category).name;
  const title = cleanTitle(input.title, source);

  let storySentences = splitSentences(cleanExcerpt(input.excerpt)).filter((s) => s.toLowerCase() !== title.toLowerCase());
  if (storySentences.length === 0) storySentences = [`${title}.`];
  const juniorStory = storySentences.flatMap((s) => splitLongSentence(s));

  const guide = READING_GUIDES[input.category];
  const juniorGuide = guide.junior(source);
  const seniorGuide = guide.senior(source);

  const juniorParagraphs = [...paragraphs(juniorStory, 3), juniorGuide.join(' ')];
  const seniorParagraphs = [...paragraphs(storySentences, 4), seniorGuide];
  const juniorText = juniorParagraphs.join('\n\n');
  const seniorText = seniorParagraphs.join('\n\n');

  const vocabulary = chooseVocabulary(juniorStory, [...juniorGuide, ...splitSentences(seniorGuide)], juniorText, seniorText);
  const juniorSentences = [...juniorStory, ...juniorGuide];

  const quiz: QuizQuestion[] = [
    headlineQuestion(input, title, opts.siblingTitles ?? [], random),
    clozeQuestion(juniorStory, random) ?? clozeQuestion(juniorSentences, random) ?? sourceQuestion(source, random),
    vocabularyQuestion(vocabulary, juniorSentences, random),
    purposeQuestion(input, random),
    sequenceQuestion(juniorSentences, random),
  ].filter((q): q is QuizQuestion => q !== null);

  const [second, third] = CATEGORY_PROMPTS[input.category];
  const firstSentence = storySentences[0];
  const firstWords = tokenizeWords(firstSentence).length;

  return {
    keyIdea: firstWords >= 6 && firstWords <= 30 && firstSentence !== `${title}.` ? firstSentence : `${title}.`,
    levels: {
      '7-8': { title, paragraphs: juniorParagraphs },
      '9-10': { title, paragraphs: seniorParagraphs },
    },
    vocabulary,
    quiz,
    writingPrompts: [SUMMARY_PROMPT, { id: 'p2', ...second }, { id: 'p3', ...third }],
    discussion: [...DISCUSSION[input.category]],
  };
}

