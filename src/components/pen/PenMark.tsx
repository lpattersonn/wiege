import type { CSSProperties } from 'react';

import { DrawIn } from './DrawIn';
import { loopAspect, type LoopContext, type PenFont } from './metrics';
import {
  CARET,
  boxPath,
  crossPath,
  doublePath,
  loopPath,
  LOOP_OVERSHOOT,
  penSeed,
  ringPath,
  squigglePath,
  strikePath,
  TICK,
  underlinePath,
  type PenGeometry,
} from './pen';

/**
 * <PenMark>: the one pen primitive (DESIGN §8.1). An inline SVG stroke,
 * seeded (identical on every render), server-rendered in its final state,
 * `aria-hidden`. Place it inside a positioned word box (`.marked` or `.tap`);
 * the `.pm--{kind}` class positions it (§8.4). Pass `animate` only for marks
 * the student just created; the draw-in runs client-side and is skipped under
 * reduced motion.
 */
export type PenKind = 'loop' | 'ring' | 'squiggle' | 'underline' | 'double' | 'tick' | 'cross' | 'caret' | 'box' | 'strike';

export interface PenMarkProps {
  kind: PenKind;
  /** Explicit seed. Otherwise derived from `word` + `scope` via penSeed(). */
  seed?: number;
  /** The marked text (seeds the mark; sizes loops and squiggles). */
  word?: string;
  /** Seed scope, normally the story slug. */
  scope?: string;
  /** Loop box aspect (width / height). Defaults to an estimate from `word`. */
  aspect?: number;
  /** Font the word is set in, for the loop aspect estimate. */
  font?: PenFont;
  /** Inset context for the loop aspect estimate. */
  context?: LoopContext;
  /** Stroke multiplier (`--pen-scale`): 1.05 reading, 1.6 covers, 1.75 hero, 1.4 tally, 1.1 seals. */
  scale?: number;
  /** Render in flow (block SVG) instead of absolutely positioned on a word. */
  standalone?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Draw in on mount (client). Only for marks created by a student action. */
  animate?: boolean;
  delay?: number;
  duration?: number;
}

const MEET: ReadonlySet<PenKind> = new Set(['tick', 'cross', 'caret', 'box']);

export function penGeometry(kind: PenKind, seed: number, { aspect = 3, chars = 8, overshoot }: { aspect?: number; chars?: number; overshoot?: number } = {}): PenGeometry {
  switch (kind) {
    case 'loop':
      return loopPath(seed, aspect, { overshoot });
    case 'ring':
      return ringPath(seed);
    case 'squiggle':
      return squigglePath(seed, chars);
    case 'underline':
      return underlinePath(seed);
    case 'double':
      return doublePath(seed);
    case 'tick':
      return { viewBox: '0 0 30 26', d: [TICK] };
    case 'cross':
      return crossPath(seed);
    case 'caret':
      return { viewBox: '0 0 14 12', d: [CARET] };
    case 'box':
      return { viewBox: '0 0 22 22', d: [boxPath(seed)] };
    case 'strike':
      return strikePath(seed);
  }
}

export function PenMark({
  kind,
  seed,
  word = '',
  scope = '',
  aspect,
  font = 'read',
  context = 'default',
  scale,
  standalone = false,
  className,
  style,
  animate = false,
  delay,
  duration,
}: PenMarkProps) {
  const s = seed ?? penSeed(kind, word || kind, scope);
  const geometry = penGeometry(kind, s, {
    aspect: aspect ?? (kind === 'loop' ? loopAspect(word || 'word', font, context) : undefined),
    chars: Array.from(word).length || 8,
    // Display headlines have no line gap: keep the loop's tail off the line above (DESIGN §0).
    overshoot: context === 'display' ? LOOP_OVERSHOOT.display : undefined,
  });
  const svg = (
    <svg
      className={`${standalone ? 'pm-static' : 'pm'} pm--${kind}${className ? ` ${className}` : ''}`}
      viewBox={geometry.viewBox}
      preserveAspectRatio={MEET.has(kind) ? 'xMidYMid meet' : 'none'}
      aria-hidden="true"
      focusable="false"
      style={scale ? ({ ...style, '--pen-scale': scale } as CSSProperties) : style}
    >
      {geometry.d.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
  return animate ? (
    <DrawIn delay={delay} duration={duration ?? (kind === 'tick' || kind === 'caret' || kind === 'underline' || kind === 'box' ? 260 : 420)}>
      {svg}
    </DrawIn>
  ) : (
    svg
  );
}

type NamedMarkProps = Omit<PenMarkProps, 'kind'>;

/** "This word." Tapped word, and mastery 5 ("Know it cold"). */
export const Loop = (props: NamedMarkProps) => <PenMark kind="loop" {...props} />;
/** Open ellipse around an answer letter. */
export const Ring = (props: NamedMarkProps) => <PenMark kind="ring" {...props} />;
/** Mastery 2 ("Seen it"). */
export const Squiggle = (props: NamedMarkProps) => <PenMark kind="squiggle" {...props} />;
/** Mastery 3 ("Getting there"); a cover mark; quiz evidence. */
export const Underline = (props: NamedMarkProps) => <PenMark kind="underline" {...props} />;
/** Mastery 4 ("Nearly"); a strong phrase in the student's writing. */
export const DoubleUnderline = (props: NamedMarkProps) => <PenMark kind="double" {...props} />;
/** Correct; used a vocabulary word; step done. */
export const Tick = (props: NamedMarkProps) => <PenMark kind="tick" {...props} />;
/** First-try wrong answer, over the letter. */
export const Cross = (props: NamedMarkProps) => <PenMark kind="cross" {...props} />;
/** "Add something here" in writing feedback. */
export const Caret = (props: NamedMarkProps) => <PenMark kind="caret" {...props} />;
/** A hand strike through a word. */
export const Strike = (props: NamedMarkProps) => <PenMark kind="strike" {...props} />;
/** An empty meter box. */
export const Box = (props: NamedMarkProps) => <PenMark kind="box" {...props} />;
