import type { CSSProperties, ReactNode } from 'react';

import type { LoopContext, PenFont } from './metrics';
import { PenMark, type PenKind } from './PenMark';

/**
 * Mastery = the pen mark (DESIGN §8.8), 1:1 with the Leitner box. The mark
 * changes only when the box changes; redraw it with `animate` when a grade
 * moves it up ("Again" returns to the dotted underline with no animation).
 */
export type MasteryLevel = 1 | 2 | 3 | 4 | 5;
export type WordMarkStyle = 'dotted' | 'squiggle' | 'underline' | 'double' | 'loop' | 'none';

export interface MasteryInfo {
  level: MasteryLevel;
  mark: Exclude<WordMarkStyle, 'none'>;
  label: string;
  /** When the next practice is, as shown under the label. */
  next: string;
}

export const MASTERY_LEVELS: readonly MasteryInfo[] = [
  { level: 1, mark: 'dotted', label: 'Just met', next: 'Practise today' },
  { level: 2, mark: 'squiggle', label: 'Seen it', next: 'Next: tomorrow' },
  { level: 3, mark: 'underline', label: 'Getting there', next: 'Next: in 3 days' },
  { level: 4, mark: 'double', label: 'Nearly', next: 'Next: in a week' },
  { level: 5, mark: 'loop', label: 'Know it cold', next: 'Next: in 16 days' },
];

export function masteryInfo(box: number): MasteryInfo {
  const level = Math.min(5, Math.max(1, Math.round(box))) as MasteryLevel;
  return MASTERY_LEVELS[level - 1];
}

interface MarkOptions {
  /** The word being marked (seeds the mark, sizes loops and squiggles). */
  word: string;
  /** Seed scope, e.g. the story slug. Leave empty for word lists and flashcards. */
  scope?: string;
  font?: PenFont;
  context?: LoopContext;
  scale?: number;
  animate?: boolean;
  delay?: number;
}

/** The SVG for a mastery level, to place inside a positioned word box. Level 1 draws nothing (the box gets `.dotted`). */
export function MasteryMark({ level, ...options }: MarkOptions & { level: number }) {
  const { mark } = masteryInfo(level);
  if (mark === 'dotted') return null;
  return <PenMark kind={mark} {...options} />;
}

export interface MarkedWordProps extends MarkOptions {
  /** Which mark to draw. Use `level` instead for mastery. */
  mark?: WordMarkStyle;
  /** Mastery level 1–5 (overrides `mark`). */
  level?: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * A word wearing a pen mark: `<MarkedWord level={2} word="stamina" />`.
 * Renders an inline-block box the mark is positioned against.
 */
export function MarkedWord({ mark, level, word, children, className = '', style, context = 'list', font = 'display-700', ...options }: MarkedWordProps) {
  const kind: WordMarkStyle = level !== undefined ? masteryInfo(level).mark : (mark ?? 'none');
  return (
    <span className={`marked${kind === 'dotted' ? ' dotted' : ''}${className ? ` ${className}` : ''}`} data-pen-context={context} style={style}>
      {children ?? word}
      {kind !== 'dotted' && kind !== 'none' ? (
        <PenMark kind={kind as PenKind} word={word} context={context} font={font} {...options} />
      ) : null}
    </span>
  );
}
