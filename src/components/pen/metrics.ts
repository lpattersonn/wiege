import advances from './bodoni-advances.json';

/**
 * Server-side text metrics for the pen (DESIGN §8.3, §8.9). Isomorphic.
 *
 * `bodoni-advances.json` holds Bodoni Moda advance widths in em for weights
 * 700 and 900 (the widest value across optical sizes 20–96, so a fitted word
 * never overflows). Regenerate from the font file with fontTools if the font
 * version changes.
 */

type AdvanceTable = Record<string, number>;
const TABLES = advances.wght as unknown as Record<'700' | '900', AdvanceTable>;

/** Unknown characters get a wide advance: fitting errs on the side of never cropping. */
const UNKNOWN_ADVANCE = 0.72;

/** Width of `text` in em for Bodoni Moda, including letter-spacing between letters. */
export function bodoniEm(text: string, { weight = 900, tracking = -0.025 }: { weight?: 700 | 800 | 900; tracking?: number } = {}): number {
  const table = weight === 700 ? TABLES['700'] : TABLES['900'];
  const chars = Array.from(text);
  let sum = 0;
  for (const ch of chars) sum += table[ch] ?? UNKNOWN_ADVANCE;
  return sum + Math.max(0, chars.length - 1) * tracking;
}

/** Average advance per character (em) for fonts without a table (DESIGN §8.3). */
export const AVERAGE_ADVANCE = {
  literata400: 0.5,
  bodoni700: 0.58,
  bodoni900: 0.62,
  atkinson400: 0.52,
} as const;

export type PenFont = 'read' | 'display-700' | 'display-800' | 'display-900' | 'ui';

/** Approximate width in em of `text` set in a given role. */
export function textEm(text: string, font: PenFont, tracking = 0): number {
  switch (font) {
    case 'display-700':
      return bodoniEm(text, { weight: 700, tracking });
    case 'display-800':
    case 'display-900':
      return bodoniEm(text, { weight: 900, tracking });
    case 'ui':
      return Array.from(text).length * AVERAGE_ADVANCE.atkinson400;
    case 'read':
    default:
      return Array.from(text).length * AVERAGE_ADVANCE.literata400;
  }
}

/** Loop insets per context (DESIGN §8.4), in em. */
export const LOOP_INSETS = {
  read: { lt: 0.2, lb: 0.14, lx: 0.11, lineBox: 1.2 },
  display: { lt: 0.06, lb: 0.04, lx: 0.14, lineBox: 1.04 },
  list: { lt: 0.06, lb: 0.04, lx: 0.15, lineBox: 1.2 },
  cover: { lt: 0.06, lb: 0.04, lx: 0.17, lineBox: 0.9 },
  default: { lt: 0.06, lb: 0.04, lx: 0.17, lineBox: 1.2 },
} as const;

export type LoopContext = keyof typeof LOOP_INSETS;

/**
 * Aspect of the loop box for a word on the server:
 * `(chars × adv + 2 × lx) / (lineBox + lt + lb)`. The client may refine it
 * from the measured box; the SVG is absolutely positioned, so that never
 * shifts layout.
 */
export function loopAspect(text: string, font: PenFont = 'read', context: LoopContext = 'default'): number {
  const inset = LOOP_INSETS[context];
  const width = textEm(text, font) + 2 * inset.lx;
  return width / (inset.lineBox + inset.lt + inset.lb);
}
