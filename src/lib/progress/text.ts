/** Isomorphic text helpers shared by progress rules and writing stats. */

// Built with RegExp() because the tsconfig target (ES2017) rejects \p{...} in literals.
const WORD_PATTERN = "[\\p{L}\\p{N}]+(?:['’-][\\p{L}\\p{N}]+)*";

/** Words in `text`: letters/digits, keeping contractions ("don't") and hyphenated words together. */
export function tokenizeWords(text: string): string[] {
  return text.match(new RegExp(WORD_PATTERN, 'gu')) ?? [];
}

export function countWords(text: string): number {
  return tokenizeWords(text).length;
}
