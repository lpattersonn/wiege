import { FREE_WRITE_MIN_WORDS } from '@/lib/progress/xp';
import { tokenizeWords } from '@/lib/progress/text';
import { isFunctionWord } from '@/lib/literacy/function-words';
import { splitSentences } from '@/lib/literacy/readability';
import type { GradeBand, RubricScores, WritingFeedback, WritingPromptKind } from '@/lib/literacy/types';
import { baseCandidates, normalizeWordToken } from '@/lib/literacy/word-forms';

/**
 * Writing statistics and instant, offline feedback (SPEC §6). Isomorphic: it
 * runs in the browser while the student writes, and is the fallback whenever AI
 * feedback is off, unavailable or over its limits. Deterministic: the same
 * text always gets the same feedback. It quotes the student but never rewrites
 * their work, and it comments only on the writing.
 */

export interface FeedbackInput {
  prompt: string;
  text: string;
  gradeBand: GradeBand;
  /** The story's vocabulary words (chips in the editor). */
  vocabulary: string[];
  /** The prompt's target range. Free writes default to 50 words and no maximum. */
  minWords?: number;
  maxWords?: number;
  promptKind?: WritingPromptKind | 'free';
}

// --- statistics ------------------------------------------------------------------

const LONG_WORD_LETTERS = 7;
const LETTERS = new RegExp('\\p{L}', 'gu');

function letterCount(word: string): number {
  return word.match(LETTERS)?.length ?? 0;
}

const round = (n: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
};

export function computeWritingStats(text: string): WritingFeedback['stats'] {
  const words = tokenizeWords(text);
  const sentences = splitSentences(text).length;
  const unique = new Set(words.map((w) => normalizeWordToken(w))).size;
  return {
    words: words.length,
    sentences,
    avgSentenceLength: sentences === 0 ? 0 : round(words.length / sentences, 1),
    uniqueWordRatio: words.length === 0 ? 0 : round(unique / words.length, 2),
    longWords: words.filter((w) => letterCount(w) >= LONG_WORD_LETTERS).length,
  };
}

/**
 * The vocabulary words `text` uses in any form ("revealed" counts for
 * "reveal", "significantly" for "significant"). Multi-word items must appear as
 * a phrase. Returns the items as given, in the given order, without duplicates.
 */
export function findUsedVocabulary(text: string, vocabulary: readonly string[]): string[] {
  const tokens = tokenizeWords(text);
  const bases = new Set<string>();
  for (const token of tokens) for (const c of baseCandidates(token, { derivations: true })) bases.add(c.base);
  const normalizedText = ` ${tokens.map(normalizeWordToken).join(' ')} `;

  const seen = new Set<string>();
  const used: string[] = [];
  for (const item of vocabulary) {
    const itemTokens = tokenizeWords(item);
    const key = itemTokens.map(normalizeWordToken).join(' ');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const matches =
      itemTokens.length > 1
        ? normalizedText.includes(` ${key} `)
        : baseCandidates(itemTokens[0], { derivations: true }).some((c) => bases.has(c.base));
    if (matches) used.push(item);
  }
  return used;
}

// --- analysis ---------------------------------------------------------------------

interface SentenceInfo {
  text: string;
  words: string[];
  startsLowercase: boolean;
  endsWithPunctuation: boolean;
  isQuestion: boolean;
}

const FIRST_LETTER = new RegExp('\\p{L}', 'u');
const LOWERCASE_LETTER = new RegExp('^\\p{Ll}$', 'u');
const TERMINAL = /[.!?…]["'”’)\]]*$/;
// A lower-case "i" used as a word, including i'm / i've / i'll / i'd.
const LOWERCASE_I = new RegExp("(^|[^\\p{L}\\p{N}'’])i(?:['’](?:m|ve|ll|d))?(?=$|[^\\p{L}\\p{N}'’])", 'gu');
const DIGIT = /\d/;

function describeSentence(text: string): SentenceInfo {
  const firstLetter = FIRST_LETTER.exec(text)?.[0] ?? '';
  return {
    text,
    words: tokenizeWords(text),
    startsLowercase: LOWERCASE_LETTER.test(firstLetter),
    endsWithPunctuation: TERMINAL.test(text),
    isQuestion: /\?["'”’)\]]*$/.test(text),
  };
}

const LINKING_PHRASES = [
  'because', 'however', 'although', 'therefore', 'as a result', 'for example', 'for instance', 'first', 'firstly',
  'secondly', 'next', 'finally', 'in addition', 'also', 'but', 'since', 'while', 'instead', 'meanwhile', 'overall',
  'in conclusion', 'on the other hand', 'this means', 'so that', 'even though', 'after that', 'later', 'eventually',
] as const;

const REASON_PHRASES = ['because', 'since', 'as a result', 'for example', 'for instance', 'this shows', 'the reason', 'so that', 'which means'];

/** Vague, overused words and what to reach for instead. */
const TIRED_WORDS: Readonly<Record<string, string>> = {
  very: 'a stronger single word',
  really: 'a stronger single word',
  good: 'a word that says exactly how it was good',
  bad: 'a word that says exactly what was wrong',
  nice: 'a more precise describing word',
  thing: 'the actual name of the thing',
  things: 'the actual names of the things',
  stuff: 'the actual names of what you mean',
  lot: 'an exact amount or a stronger word',
  lots: 'an exact amount or a stronger word',
  got: 'a more exact verb',
  get: 'a more exact verb',
  big: 'a word that shows the size',
  great: 'a word that says what made it great',
  awesome: 'a word that says what made it special',
  cool: 'a word that says what made it special',
};

function containsPhrase(normalized: string, phrase: string): boolean {
  return normalized.includes(` ${phrase} `);
}

interface Analysis {
  stats: WritingFeedback['stats'];
  words: string[];
  promptWords: string[];
  sentences: SentenceInfo[];
  paragraphs: number;
  minWords: number;
  maxWords: number | null;
  usedVocabulary: string[];
  unusedVocabulary: string[];
  missingEndPunctuation: SentenceInfo[];
  lowercaseStarts: SentenceInfo[];
  lowercaseI: number;
  longSentenceLimit: number;
  longestSentence: SentenceInfo | null;
  repeatedWord: { word: string; count: number } | null;
  tiredWords: Array<{ word: string; count: number }>;
  linkingWords: string[];
  hasReason: boolean;
  detailSentence: SentenceInfo | null;
  wantsOpinion: boolean;
  kind: WritingPromptKind | 'free';
  sameOpener: { word: string; count: number } | null;
  sentenceLengthSpread: number;
}

function analyse(input: FeedbackInput): Analysis {
  const text = input.text.normalize('NFC');
  const stats = computeWritingStats(text);
  const words = tokenizeWords(text);
  const sentences = splitSentences(text).map(describeSentence);
  const normalized = ` ${words.map(normalizeWordToken).join(' ')} `;
  const promptWords = new Set(tokenizeWords(input.prompt).map(normalizeWordToken));
  const usedVocabulary = findUsedVocabulary(text, input.vocabulary);
  const usedKeys = new Set(usedVocabulary.map((v) => v.toLowerCase()));
  const unusedVocabulary = input.vocabulary.filter((v) => v.trim() && !usedKeys.has(v.toLowerCase()));

  const counts = new Map<string, number>();
  for (const word of words) {
    const key = normalizeWordToken(word);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const vocabularyKeys = new Set(input.vocabulary.map((v) => normalizeWordToken(v)));
  let repeatedWord: Analysis['repeatedWord'] = null;
  for (const [word, count] of counts) {
    if (count < 3 || count / Math.max(1, words.length) < 0.04) continue;
    if (isFunctionWord(word) || word.length < 3 || promptWords.has(word) || vocabularyKeys.has(word) || DIGIT.test(word)) continue;
    if (Object.hasOwn(TIRED_WORDS, word)) continue;
    if (!repeatedWord || count > repeatedWord.count || (count === repeatedWord.count && word < repeatedWord.word)) {
      repeatedWord = { word, count };
    }
  }

  const tiredWords = Object.keys(TIRED_WORDS)
    .map((word) => ({ word, count: counts.get(word) ?? 0 }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));

  const openers = new Map<string, number>();
  for (const s of sentences) {
    const first = s.words[0] ? normalizeWordToken(s.words[0]) : '';
    if (first) openers.set(first, (openers.get(first) ?? 0) + 1);
  }
  let sameOpener: Analysis['sameOpener'] = null;
  for (const [word, count] of openers) {
    if (count >= 3 && count / sentences.length >= 0.5 && (!sameOpener || count > sameOpener.count)) sameOpener = { word, count };
  }

  const lengths = sentences.map((s) => s.words.length);
  const mean = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  const spread = Math.sqrt(lengths.reduce((sum, n) => sum + (n - mean) ** 2, 0) / Math.max(1, lengths.length));

  const longestSentence = sentences.reduce<SentenceInfo | null>(
    (best, s) => (!best || s.words.length > best.words.length ? s : best),
    null,
  );

  const detailSentence =
    sentences.find((s) => DIGIT.test(s.text) || hasProperNoun(s)) ??
    sentences.find((s) => REASON_PHRASES.some((p) => containsPhrase(` ${s.words.map(normalizeWordToken).join(' ')} `, p))) ??
    null;

  const kind = input.promptKind;
  const wantsOpinion =
    kind === 'opinion' ||
    (kind === undefined && /\b(opinion|agree|disagree|do you think|should|would you|why)\b/i.test(input.prompt));

  return {
    stats,
    words,
    promptWords: [...promptWords],
    sentences,
    paragraphs: text.split(/\n\s*\n/).filter((p) => tokenizeWords(p).length > 0).length,
    minWords: Math.max(1, Math.floor(input.minWords ?? FREE_WRITE_MIN_WORDS)),
    maxWords: input.maxWords && input.maxWords > 0 ? Math.floor(input.maxWords) : null,
    usedVocabulary,
    unusedVocabulary,
    missingEndPunctuation: sentences.filter((s) => !s.endsWithPunctuation && s.words.length >= 4),
    lowercaseStarts: sentences.filter((s) => s.startsLowercase),
    lowercaseI: text.match(LOWERCASE_I)?.length ?? 0,
    longSentenceLimit: input.gradeBand === '9-10' ? 35 : 30,
    longestSentence,
    repeatedWord,
    tiredWords,
    linkingWords: LINKING_PHRASES.filter((p) => containsPhrase(normalized, p)),
    hasReason: REASON_PHRASES.some((p) => containsPhrase(normalized, p)),
    detailSentence,
    wantsOpinion,
    kind: kind ?? 'free',
    sameOpener,
    sentenceLengthSpread: spread,
  };
}

const CAPITALISED = new RegExp('^\\p{Lu}', 'u');

// Words most prompts contain, so echoing them says nothing about staying on task.
const GENERIC_PROMPT_WORDS = new Set([
  'story', 'stories', 'write', 'writing', 'words', 'word', 'sentence', 'sentences', 'think', 'explain', 'describe',
  'would', 'could', 'should', 'about', 'your', 'reader', 'readers', 'friend', 'something', 'someone', 'people',
  'give', 'reason', 'reasons', 'detail', 'details', 'opinion', 'summary', 'summarise', 'summarize', 'headline',
  'letter', 'news', 'article', 'what', 'which', 'many', 'from', 'with', 'this', 'that', 'they', 'them',
]);

// Long words that are everyday or vague, so they are not praised as precise choices.
const VAGUE_LONG_WORDS = new Set([
  'everything', 'everyone', 'everybody', 'something', 'someone', 'somebody', 'anything', 'anyone', 'anywhere',
  'everywhere', 'somewhere', 'sometimes', 'definitely', 'basically', 'literally', 'actually', 'obviously',
  'different', 'important', 'beautiful', 'wonderful', 'interesting', 'especially', 'probably', 'together',
  'yesterday', 'tomorrow', 'themselves', 'ourselves', 'yourself', 'understand', 'understood', 'incredible',
  'awesomely', 'extremely', 'certainly', 'completely', 'absolutely', 'favourite', 'favorite',
]);

/** A capitalised word that is not the sentence's first word and not "I" (a name, place or title). */
function hasProperNoun(sentence: SentenceInfo): boolean {
  return sentence.words.slice(1).some((w) => CAPITALISED.test(w) && w !== 'I' && !/^I['’]/.test(w));
}

// --- quoting ----------------------------------------------------------------------

const WORD_WITH_INDEX = new RegExp("[\\p{L}\\p{N}]+(?:['’-][\\p{L}\\p{N}]+)*", 'gu');

/** The student's own words: the start of `sentence`, at most `maxWords` words, exactly as written. */
export function quoteStart(sentence: string, maxWords = 10): string {
  const clean = sentence.replace(/\s+/g, ' ').trim();
  WORD_WITH_INDEX.lastIndex = 0;
  let count = 0;
  let end = clean.length;
  let match: RegExpExecArray | null;
  while ((match = WORD_WITH_INDEX.exec(clean)) !== null) {
    count += 1;
    if (count === maxWords) {
      end = match.index + match[0].length;
      break;
    }
  }
  const truncated = end < clean.length;
  const quote = clean.slice(0, end).replace(/[\s,;:–—-]+$/, '');
  return truncated ? `${quote}…` : quote;
}

/** The end of `sentence` (its last `maxWords` words), for pointing at a missing full stop. */
function quoteEnd(sentence: string, maxWords = 6): string {
  const words = sentence.replace(/\s+/g, ' ').trim().split(' ');
  return words.length <= maxWords ? words.join(' ') : `…${words.slice(-maxWords).join(' ')}`;
}

/** The part of a sentence around `phrase`, as written. */
function quoteAround(sentence: string, phrase: string, maxWords = 10): string {
  const lower = sentence.toLowerCase();
  const at = lower.indexOf(phrase.toLowerCase());
  if (at <= 0) return quoteStart(sentence, maxWords);
  const before = sentence.slice(0, at).trim().split(/\s+/);
  const lead = before.slice(-3).join(' ');
  const quote = quoteStart(`${lead} ${sentence.slice(at)}`.trim(), maxWords);
  return before.length > 3 ? `…${quote}` : quote;
}

function sentenceContaining(sentences: SentenceInfo[], word: string): SentenceInfo | undefined {
  const target = new Set(baseCandidates(word, { derivations: true }).map((c) => c.base));
  return sentences.find((s) => s.words.some((w) => baseCandidates(w, { derivations: true }).some((c) => target.has(c.base))));
}

function firstWordFamilyMatch(sentence: SentenceInfo, word: string): string {
  const target = new Set(baseCandidates(word, { derivations: true }).map((c) => c.base));
  return sentence.words.find((w) => baseCandidates(w, { derivations: true }).some((c) => target.has(c.base))) ?? word;
}

// --- feedback ---------------------------------------------------------------------

interface Note {
  id: string;
  text: string;
}

/** A quote set inside a sentence: drop its final full stop or comma so punctuation does not double up. */
function embed(quote: string): string {
  return quote.replace(/[.,;:]+$/, '');
}

function glowNotes(a: Analysis): Note[] {
  const notes: Note[] = [];
  const { sentences } = a;

  const vocab = a.usedVocabulary[0];
  const vocabSentence = vocab ? sentenceContaining(sentences, vocab) : undefined;
  if (vocab && vocabSentence) {
    const used = firstWordFamilyMatch(vocabSentence, vocab);
    notes.push({
      id: 'vocab',
      text: `You used the story word "${used}" in "${embed(quoteAround(vocabSentence.text, used))}". Using new words in your own sentences is how they stick.`,
    });
  }

  if (a.detailSentence) {
    notes.push({
      id: 'detail',
      text: `You back up your ideas with a specific detail: "${embed(quoteStart(a.detailSentence.text, 12))}". Details like this make writing convincing.`,
    });
  }

  const question = sentences.find((s) => s.isQuestion && s.words.length >= 3);
  if (question) {
    notes.push({ id: 'question', text: `Your question "${quoteStart(question.text, 12)}" invites the reader to think along with you.` });
  }

  const link = a.linkingWords.find((w) => !['also', 'but', 'later', 'first', 'next'].includes(w)) ?? a.linkingWords[0];
  if (link && a.sentences.length >= 2) {
    const sentence = sentences.find((s) => ` ${s.words.map(normalizeWordToken).join(' ')} `.includes(` ${link} `));
    if (sentence) {
      notes.push({
        id: 'linking',
        text: `Linking words like "${link}" in "${embed(quoteAround(sentence.text, link))}" help the reader follow how your ideas connect.`,
      });
    }
  }

  if (sentences.length >= 3 && a.sentenceLengthSpread >= 4) {
    const shortest = sentences.reduce((best, s) => (s.words.length < best.words.length ? s : best));
    notes.push({
      id: 'variety',
      text: `You mix short and long sentences. A short one like "${embed(quoteStart(shortest.text, 8))}" gives the reader a pause and adds punch.`,
    });
  }

  if (a.stats.words >= a.minWords && (a.maxWords === null || a.stats.words <= a.maxWords)) {
    notes.push({
      id: 'length',
      text:
        a.maxWords === null
          ? `You wrote ${a.stats.words} words, reaching the target of ${a.minWords}. That gives your ideas room to grow.`
          : `You wrote ${a.stats.words} words, right inside the target of ${a.minWords} to ${a.maxWords}.`,
    });
  }

  if (sentences.length >= 3 && a.lowercaseStarts.length === 0 && a.missingEndPunctuation.length === 0 && a.lowercaseI === 0) {
    notes.push({
      id: 'conventions',
      text: 'Every sentence starts with a capital letter and ends with punctuation, which makes your writing easy to read.',
    });
  }

  const promptWords = new Set(a.promptWords);
  const echoed = a.words.find((w) => {
    const key = normalizeWordToken(w);
    return promptWords.has(key) && !isFunctionWord(key) && !GENERIC_PROMPT_WORDS.has(key) && letterCount(key) >= 4;
  });
  const echoSentence = echoed ? sentences.find((s) => s.words.includes(echoed)) : undefined;
  if (echoed && echoSentence) {
    notes.push({
      id: 'on-task',
      text: `You keep to the task: "${embed(quoteAround(echoSentence.text, echoed))}" answers what the prompt asks about.`,
    });
  }

  const precise = a.words
    .filter(
      (w) =>
        letterCount(w) >= 9 &&
        !CAPITALISED.test(w) &&
        !VAGUE_LONG_WORDS.has(normalizeWordToken(w)) &&
        !a.usedVocabulary.some((v) => normalizeWordToken(v) === normalizeWordToken(w)),
    )
    .sort((x, y) => letterCount(y) - letterCount(x) || x.localeCompare(y))[0];
  const preciseSentence = precise ? sentences.find((s) => s.words.includes(precise)) : undefined;
  if (precise && preciseSentence) {
    notes.push({
      id: 'precise',
      text: `You reach for specific words, such as "${precise}" in "${embed(quoteAround(preciseSentence.text, precise))}".`,
    });
  }

  if (sentences.length > 0) {
    notes.push({
      id: 'opening',
      text: `You open with "${embed(quoteStart(sentences[0].text, 10))}", which gives the reader a clear place to start.`,
    });
  }
  notes.push({
    id: 'effort',
    text: `You wrote ${a.stats.words} words of your own, which gives you real material to shape and improve.`,
  });
  return notes;
}

/** How to add more, by kind of writing. */
const EXPAND_HINTS: Readonly<Record<WritingPromptKind | 'free', string>> = {
  summary: 'adding the most important detail you left out',
  headline: 'adding a sentence that explains why your headline fits the story',
  opinion: 'adding a reason and an example from the story',
  creative: 'showing what happens next, or what someone sees, hears or feels',
  letter: 'telling the reader one thing you noticed in the story and asking them a question',
  free: 'explaining one idea with a detail from the story',
};

const EXPAND_STEPS: Readonly<Record<WritingPromptKind | 'free', string>> = {
  summary: 'Add one sentence with the most important detail from the story that is still missing.',
  headline: 'Add one sentence that explains why your headline fits the story.',
  opinion: 'Add two sentences now: one with a reason, and one with an example from the story that supports it.',
  creative: 'Write two more sentences that show what happens next.',
  letter: 'Add two sentences: one about something you noticed in the story and one question for the reader.',
  free: 'Add two sentences now: one with a detail from the story and one that says why it matters.',
};

function growNotes(a: Analysis): Note[] {
  const notes: Note[] = [];
  const { stats, sentences } = a;

  if (stats.words < a.minWords) {
    const missing = a.minWords - stats.words;
    notes.push({
      id: 'too-short',
      text: `You have ${stats.words} ${stats.words === 1 ? 'word' : 'words'} so far; aim for at least ${a.minWords}. Add about ${missing} more by ${EXPAND_HINTS[a.kind]}.`,
    });
  }

  if (a.maxWords !== null && stats.words > a.maxWords) {
    notes.push({
      id: 'too-long',
      text: `You wrote ${stats.words} words; the target is at most ${a.maxWords}. Cut any sentence that repeats an idea you have already made.`,
    });
  }

  if (a.wantsOpinion && !a.hasReason && stats.words >= 10) {
    notes.push({
      id: 'reason',
      text: 'Back up your opinion with a reason: add a sentence that uses "because" and points to something from the story.',
    });
  }

  if (a.longestSentence && a.longestSentence.words.length > a.longSentenceLimit) {
    notes.push({
      id: 'run-on',
      text: `Your sentence starting "${quoteStart(a.longestSentence.text, 6)}" runs for ${a.longestSentence.words.length} words. Read it aloud and split it where you pause or where a new idea begins.`,
    });
  }

  const unpunctuated = a.missingEndPunctuation[a.missingEndPunctuation.length - 1];
  if (unpunctuated) {
    notes.push({
      id: 'end-punctuation',
      text: `End every sentence with a full stop, question mark or exclamation mark. Check the one ending "${quoteEnd(unpunctuated.text)}".`,
    });
  }

  if (a.lowercaseStarts.length > 0) {
    notes.push({
      id: 'capitals',
      text: `Start every sentence with a capital letter. Look at the one beginning "${quoteStart(a.lowercaseStarts[0].text, 5)}".`,
    });
  }

  if (a.lowercaseI > 0) {
    notes.push({ id: 'capital-i', text: 'When you write about yourself, "I" is always a capital letter, even in the middle of a sentence.' });
  }

  const tiredTotal = a.tiredWords.reduce((sum, t) => sum + t.count, 0);
  if (a.tiredWords.length > 0 && (tiredTotal >= 3 || a.tiredWords[0].count >= 2)) {
    const top = a.tiredWords[0];
    const also = a.tiredWords[1] ? ` and "${a.tiredWords[1].word}"` : '';
    notes.push({
      id: 'tired-words',
      text: `Words like "${top.word}"${also} are a bit vague. Swap one of them for ${TIRED_WORDS[top.word]}.`,
    });
  }

  if (a.repeatedWord) {
    notes.push({
      id: 'repeated',
      text: `You used "${a.repeatedWord.word}" ${a.repeatedWord.count} times. Keep it where it matters most and try a different word or phrase elsewhere.`,
    });
  }

  if (a.usedVocabulary.length === 0 && a.unusedVocabulary.length > 0 && stats.words >= 5) {
    const examples = a.unusedVocabulary.slice(0, 2).map((w) => `"${w}"`).join(' or ');
    notes.push({ id: 'vocabulary', text: `Try using one of the story's words, such as ${examples}, in a sentence of your own.` });
  }

  if (sentences.length >= 4 && stats.avgSentenceLength < 6) {
    notes.push({
      id: 'choppy',
      text: 'Many of your sentences are very short. Join two that belong together with "and", "but" or "because".',
    });
  }

  if (a.sameOpener) {
    const opener = a.sameOpener.word === 'i' ? 'I' : a.sameOpener.word;
    notes.push({
      id: 'openers',
      text: `${a.sameOpener.count} of your sentences start with "${opener}". Begin one or two in a different way, for example with a time, a place or a feeling.`,
    });
  }

  if (a.paragraphs <= 1 && stats.words > 150) {
    notes.push({ id: 'paragraphs', text: 'Break your writing into paragraphs: start a new one each time you move to a new idea.' });
  }

  if (sentences.length >= 4 && a.linkingWords.length === 0) {
    notes.push({ id: 'linking', text: 'Link your ideas with words such as "because", "however" or "as a result" so the reader can follow your thinking.' });
  }

  notes.push({ id: 'detail', text: 'Add one more specific detail from the story, such as a name, a number or a place, to support your main point.' });
  notes.push({ id: 'read-aloud', text: 'Read your writing aloud and fix any spot where you stumble or run out of breath.' });
  return notes;
}

const NEXT_STEPS: Readonly<Record<string, string>> = {
  'end-punctuation': 'Read your writing from the end to the start, one sentence at a time, and add any missing full stops.',
  'run-on': 'Find your longest sentence and split it into two.',
  reason: 'Write one sentence that begins with "This matters because" and finish it with a detail from the story.',
  capitals: 'Check the first letter of every sentence and make it a capital.',
  'capital-i': 'Search your writing for "i" on its own and change it to "I".',
  'tired-words': 'Circle one vague word and replace it with a more exact one.',
  repeated: 'Change one of your repeated words to a different word or phrase.',
  vocabulary: 'Write one new sentence that uses a word from the story.',
  choppy: 'Join two of your short sentences with "because" or "but".',
  openers: 'Rewrite the start of one sentence so it begins with when or where something happened.',
  paragraphs: 'Press Enter twice where your writing moves to a new idea to start a new paragraph.',
  'too-long': 'Cut one sentence that repeats something you have already said.',
  linking: 'Add a linking word such as "because" or "however" between two of your ideas.',
  detail: 'Add one sentence with a specific detail from the story.',
  'read-aloud': 'Read your writing aloud once and fix the first place where you stumble.',
};

function nextStepFor(a: Analysis, topGrow: Note): string {
  if (topGrow.id === 'too-short') return EXPAND_STEPS[a.kind];
  return NEXT_STEPS[topGrow.id] ?? NEXT_STEPS.detail;
}

function pickDistinct(notes: Note[], count: number): Note[] {
  const picked: Note[] = [];
  const texts = new Set<string>();
  for (const note of notes) {
    if (picked.length === count) break;
    if (picked.some((p) => p.id === note.id) || texts.has(note.text)) continue;
    picked.push(note);
    texts.add(note.text);
  }
  return picked;
}

const clampScore = (n: number) => Math.min(4, Math.max(1, Math.round(n)));

function scoreRubric(a: Analysis): RubricScores {
  const { stats, sentences } = a;
  if (stats.words < 5) return { ideas: 1, organization: 1, wordChoice: 1, conventions: 1 };

  const ratio = stats.words / a.minWords;
  const detailSignals =
    Number(a.detailSentence !== null) + Number(a.hasReason) + Number(a.usedVocabulary.length > 0) + Number(sentences.some((s) => s.isQuestion));
  let ideas = ratio < 0.5 ? 1 : ratio < 1 ? 2 : 3;
  if (ideas === 3 && detailSignals >= 2) ideas = 4;
  if (a.wantsOpinion && !a.hasReason) ideas -= 1;

  const runOn = a.longestSentence !== null && a.longestSentence.words.length > a.longSentenceLimit;
  let organization = sentences.length >= 3 ? 3 : sentences.length === 2 ? 2 : 1;
  if (organization === 3 && a.linkingWords.length >= 2 && (stats.words <= 150 || a.paragraphs > 1)) organization = 4;
  if (runOn) organization -= 1;
  if (a.paragraphs <= 1 && stats.words > 150) organization -= 1;

  const longRatio = stats.longWords / Math.max(1, stats.words);
  const tiredTotal = a.tiredWords.reduce((sum, t) => sum + t.count, 0);
  let wordChoice = 2;
  if (a.usedVocabulary.length > 0 || longRatio >= 0.15) wordChoice += 1;
  if (stats.uniqueWordRatio >= 0.6 && tiredTotal <= 1 && (a.usedVocabulary.length >= 2 || longRatio >= 0.2)) wordChoice += 1;
  if (tiredTotal >= 3 || a.repeatedWord !== null) wordChoice -= 1;

  let conventions = 4;
  if (a.missingEndPunctuation.length > 0) conventions -= 1;
  if (a.lowercaseStarts.length > 0) conventions -= 1;
  if (a.lowercaseI > 0) conventions -= 1;
  if (!sentences.some((s) => s.endsWithPunctuation) && stats.words >= 15) conventions -= 1;

  return {
    ideas: clampScore(ideas),
    organization: clampScore(organization),
    wordChoice: clampScore(wordChoice),
    conventions: clampScore(conventions),
  };
}

function emptyFeedback(a: Analysis): WritingFeedback {
  const hasWords = a.stats.words > 0;
  const start = hasWords ? quoteStart(a.sentences[0]?.text ?? a.words.join(' '), 8) : '';
  return {
    glow: hasWords
      ? [`You have made a start: "${start}". Getting the first words down is often the hardest part.`, 'You have a whole story to draw on, so you are not starting from nothing.']
      : ['You have the prompt and a whole story to draw on, so you are not starting from nothing.', 'Every piece of writing begins as a blank page, so this is the normal place to start.'],
    grow: [
      `Write at least one full sentence that answers the prompt in your own words; aim for ${a.minWords} words in total.`,
      'Add a detail from the story, such as a name, a number or a place, to support your answer.',
    ],
    nextStep: 'Write your first sentence now: say who or what the story is about and why it matters.',
    rubric: { ideas: 1, organization: 1, wordChoice: 1, conventions: 1 },
    usedVocabulary: a.usedVocabulary,
    stats: a.stats,
    generator: 'heuristic',
  };
}

/**
 * Instant heuristic feedback: two strengths that quote the student, two
 * specific improvements, one next step and a 1–4 rubric. Always schema-valid.
 */
export function heuristicFeedback(input: FeedbackInput): WritingFeedback {
  const a = analyse(input);
  if (a.stats.words < 5) return emptyFeedback(a);

  const glow = pickDistinct(glowNotes(a), 2);
  const grow = pickDistinct(growNotes(a), 2);
  return {
    glow: glow.map((n) => n.text),
    grow: grow.map((n) => n.text),
    nextStep: nextStepFor(a, grow[0]),
    rubric: scoreRubric(a),
    usedVocabulary: a.usedVocabulary,
    stats: a.stats,
    generator: 'heuristic',
  };
}
