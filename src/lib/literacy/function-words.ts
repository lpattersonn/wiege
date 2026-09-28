/**
 * Small, isomorphic list of English function words (articles, pronouns,
 * auxiliaries, prepositions, conjunctions). Kept separate from `wordlists.ts`
 * so browser code (writing feedback) can use it without pulling in the large
 * vocabulary tables.
 */

const FUNCTION_WORD_LIST = `
a an the this that these those there here
i me my mine myself you your yours yourself yourselves he him his himself she her hers herself
it its itself we us our ours ourselves they them their theirs themselves one ones
who whom whose which what when where why how whoever whatever
am is are was were be been being do does did doing done have has had having
will would shall should can could may might must ought
not no nor yes
and or but so yet if then than because since unless until while although though
as at by for from in into of off on onto out over under up down with within without
about above across after against along among around before behind below beneath beside between beyond
during except inside near outside past through throughout toward towards upon via
to too also just only very really quite rather
all any both each either every few many more most much neither none other others own same several some such
again ever never always often still even already else
im i'm you're we're they're it's isn't aren't wasn't weren't don't doesn't didn't can't couldn't won't wouldn't
`;

export const FUNCTION_WORDS: ReadonlySet<string> = new Set(FUNCTION_WORD_LIST.split(/\s+/).filter(Boolean));

export function isFunctionWord(word: string): boolean {
  return FUNCTION_WORDS.has(word.toLowerCase().replace(/’/g, "'"));
}
