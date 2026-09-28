import type { CSSProperties } from 'react';

import { CategoryGlyph } from '@/components/glyphs/CategoryGlyph';

import { DrawIn } from './DrawIn';
import {
  ASIDE_ARROW,
  BOX_TICK,
  BRACKET,
  MINI_TICK,
  NOTE_MARK_ICON,
  TAB_UNDERLINE,
  boxPath,
  fnv1a,
  miniTallyPaths,
  progressPath,
  sealRing,
  tallyPaths,
} from './pen';

/* Composite pen marks: tally, seal, progress line, meter, bracket, arrows.
   All server-safe; client islands pass `animate` for marks the student made. */

const penStroke = (scale: number): CSSProperties => ({ '--pen-scale': scale }) as CSSProperties;

/* -------------------------------------------------------------------------- */

export interface TallyProps {
  /** Reading days already counted. */
  count: number;
  /** Today's stroke is still waiting (drawn dashed in --ink-3). */
  pending?: boolean;
  /** Accessible label. Defaults to "12 tally marks. Today's mark is waiting." */
  label?: string;
  /** Rendered height in px (72 big form). */
  height?: number;
  /** Redraw the newest stroke with the pen (today's first read just completed). */
  animateLast?: boolean;
  className?: string;
}

/** Reading days in groups of five (DESIGN §11.13). role="img" with a text label. */
export function Tally({ count, pending = true, label, height = 72, animateLast = false, className = '' }: TallyProps) {
  const g = tallyPaths(count, { pending });
  const text =
    label ??
    `${count} tally mark${count === 1 ? '' : 's'}.${pending ? ' Today’s mark is waiting.' : ''}`;
  const lastSolid = animateLast && !pending ? g.strokes.length - 1 : -1;
  const svg = (
    <svg
      viewBox={g.viewBox}
      width={(g.width * height) / g.height}
      height={height}
      role="img"
      aria-label={text}
      className={`pm-static ${className}`}
      style={penStroke(1.4)}
    >
      {g.strokes.map((s, i) =>
        s.pending ? (
          <path key={i} d={s.d} style={{ stroke: 'var(--ink-3)', strokeDasharray: '2 6', strokeWidth: 2 }} />
        ) : (
          <path key={i} d={s.d} data-draw={i === lastSolid ? '' : undefined} />
        ),
      )}
    </svg>
  );
  return lastSolid >= 0 ? (
    <DrawIn duration={260} only="[data-draw]">
      {svg}
    </DrawIn>
  ) : (
    svg
  );
}

/** Compact tally for the Today strip: 22px tall, aria-hidden (the text beside it carries the number). */
export function MiniTally({ count, className = '' }: { count: number; className?: string }) {
  const g = miniTallyPaths(count);
  return (
    <svg viewBox={g.viewBox} width={g.width} height={22} aria-hidden="true" focusable="false" className={`pm-static ${className}`}>
      <path d={g.d} style={{ strokeWidth: 2 }} />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

export interface SealProps {
  /** Numeral or short text ("1", "10", "5/5"), or "quill" for the quill glyph. */
  face: string;
  earned: boolean;
  /** Seeds the hand-drawn rings; use the stamp id. */
  seed: string | number;
  /** Accessible label, e.g. "Stamp earned: 7 days in a row". */
  label: string;
  /** Rendered size in px (96). */
  size?: number;
  /** Play the thunk (240ms) — only right after the stamp is earned. */
  animate?: boolean;
  className?: string;
}

/** A pen-drawn stamp seal (DESIGN §11.15): outer ring + inner disc, filled when earned. */
export function Seal({ face, earned, seed, label, size = 96, animate = false, className = '' }: SealProps) {
  const n = typeof seed === 'number' ? seed : fnv1a(seed);
  const outer = sealRing(n * 7 + 3, 56, 55);
  const inner = sealRing(n * 13 + 1, 45, 44);
  const fontSize = face.length > 2 ? 32 : face.length > 1 ? 42 : 50;
  const lockedStroke: CSSProperties = { stroke: 'var(--ink-3)', strokeDasharray: '3 6' };
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={`pm-static${animate ? ' thunk' : ''} ${className}`}
      style={{ ...penStroke(1.1), transform: animate ? 'rotate(-2deg)' : undefined }}
    >
      <path d={outer} style={earned ? undefined : lockedStroke} />
      {earned ? <path d={`${inner}Z`} className="pm-fill" style={{ fill: 'currentColor', stroke: 'none' }} /> : <path d={inner} style={lockedStroke} />}
      {face === 'quill' ? (
        <g transform="translate(38 38)" style={{ color: earned ? 'var(--paper)' : 'var(--ink-3)' }}>
          <CategoryGlyph glyph="quill" size={44} strokeWidth={earned ? 2.2 : 1.6} />
        </g>
      ) : (
        <text
          x={60}
          y={60}
          dy={fontSize * 0.35}
          textAnchor="middle"
          fontSize={fontSize}
          style={{
            fontFamily: 'var(--font-ui)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums lining-nums',
            fill: earned ? 'var(--paper)' : 'none',
            stroke: earned ? 'none' : 'var(--ink-3)',
            strokeWidth: earned ? 0 : 1.2,
            vectorEffect: 'none',
          }}
        >
          {face}
        </text>
      )}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

export interface ProgressLineProps {
  /** 0–1. Zero draws the dotted track only (never pre-filled). */
  value: number;
  /** Width in px, or '100%' (default 240). */
  width?: number | string;
  /** Track height in px (12; 10 in compact rows). */
  height?: number;
  seed?: number;
  animate?: boolean;
  className?: string;
}

/** A pen line over a dotted track (DESIGN §11.11). Visual only — wrap with <ProgressBar> for semantics. */
export function ProgressLine({ value, width = 240, height = 12, seed = 7, animate = false, className = '' }: ProgressLineProps) {
  const d = progressPath(value, seed, height);
  const mid = height / 2;
  const svg = (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={`pm-static ${className}`}
      style={{ width, height, maxWidth: '100%' }}
    >
      <path d={`M1 ${mid}H99`} style={{ stroke: 'var(--line-control)', strokeWidth: 1.5, strokeDasharray: '1 5' }} />
      {d ? <path d={d} data-draw="" style={{ strokeWidth: 3 }} /> : null}
    </svg>
  );
  return animate && d ? (
    <DrawIn duration={260} only="[data-draw]">
      {svg}
    </DrawIn>
  ) : (
    svg
  );
}

/* -------------------------------------------------------------------------- */

export interface WordsKeptMeterProps {
  /** Words kept so far. */
  kept: number;
  /** Size of the set (3 on the landing hero). */
  total?: number;
  /** Index of a box whose tick should draw in now (the word just saved). */
  animateIndex?: number;
  seed?: number;
  className?: string;
}

/** "0 of 3 words kept": three 22px pen boxes that get a tick per saved word (DESIGN §11.21). */
export function WordsKeptMeter({ kept, total = 3, animateIndex, seed = 40, className = '' }: WordsKeptMeterProps) {
  const done = Math.max(0, Math.min(total, kept));
  const text = done >= total ? `All ${total} kept. They’re in your words.` : null;
  return (
    <p className={`flex items-center gap-3 text-small font-semibold text-ink-2 ${className}`}>
      <span className="inline-flex gap-2" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const tick = (
            <svg viewBox="0 0 22 22" className="absolute inset-0 size-[22px]" style={{ strokeWidth: 2.4 }}>
              <path d={BOX_TICK} style={{ strokeWidth: 2.4 }} />
            </svg>
          );
          return (
            <span key={i} className="pm-static relative size-[22px]">
              <svg viewBox="0 0 22 22" className="absolute inset-0 size-[22px]">
                <path d={boxPath(seed + i)} style={{ strokeWidth: 1.6 }} />
              </svg>
              {i < done ? (i === animateIndex ? <DrawIn duration={260}>{tick}</DrawIn> : tick) : null}
            </span>
          );
        })}
      </span>
      <span aria-live="polite">
        {text ?? (
          <>
            <b className="num font-extrabold text-ink">{done}</b> of {total} words kept
          </>
        )}
      </span>
    </p>
  );
}

/* -------------------------------------------------------------------------- */

/** The three-piece bracket down the left edge of a margin note (26px left padding on the note). */
export function Bracket({ className = '' }: { className?: string }) {
  const style: CSSProperties = { strokeWidth: 'calc(var(--pen-w) * .9)' };
  return (
    <span aria-hidden="true" className={`pm-static absolute top-0 bottom-0 left-0 flex w-3 flex-col ${className}`}>
      <svg viewBox="0 0 12 14" width={12} height={14} className="block shrink-0">
        <path d={BRACKET.top} style={style} />
      </svg>
      <svg viewBox="0 0 12 100" preserveAspectRatio="none" width={12} className="block min-h-0 flex-1">
        <path d={BRACKET.mid} style={style} />
      </svg>
      <svg viewBox="0 0 12 14" width={12} height={14} className="block shrink-0">
        <path d={BRACKET.bottom} style={style} />
      </svg>
    </span>
  );
}

/** Hand-drawn arrow for a handwritten aside ("try it: tap a dotted word"). */
export function AsideArrow({ direction = 'down', className = '' }: { direction?: 'down' | 'right'; className?: string }) {
  return (
    <svg viewBox="0 0 52 40" width={52} height={40} aria-hidden="true" focusable="false" className={`pm-static shrink-0 ${className}`}>
      <path d={ASIDE_ARROW[direction]} style={{ strokeWidth: 1.8 }} />
    </svg>
  );
}

/** Pen underline for the active mobile tab (28×6). */
export function TabUnderline({ animate = false, className = '' }: { animate?: boolean; className?: string }) {
  const svg = (
    <svg viewBox="0 0 28 6" width={28} height={6} aria-hidden="true" focusable="false" className={`pm-static ${className}`}>
      <path d={TAB_UNDERLINE} style={{ strokeWidth: 2.2 }} />
    </svg>
  );
  return animate ? <DrawIn duration={200}>{svg}</DrawIn> : svg;
}

/** Small tick (16×14) for chips, checklists and "Read" markers. */
export function MiniTick({ size = 16, animate = false, className = '' }: { size?: number; animate?: boolean; className?: string }) {
  const svg = (
    <svg viewBox="0 0 16 14" width={size} height={(size * 14) / 16} aria-hidden="true" focusable="false" className={`pm-static shrink-0 ${className}`}>
      <path d={MINI_TICK} style={{ strokeWidth: 2 }} />
    </svg>
  );
  return animate ? <DrawIn duration={260}>{svg}</DrawIn> : svg;
}

/** The 28×18 mark icon that heads a writing-feedback note. */
export function NoteMarkIcon({ kind, className = '' }: { kind: keyof typeof NOTE_MARK_ICON; className?: string }) {
  return (
    <svg viewBox="0 0 28 18" width={28} height={18} aria-hidden="true" focusable="false" className={`pm-static shrink-0 ${className}`}>
      <path d={NOTE_MARK_ICON[kind]} style={{ strokeWidth: 2 }} />
    </svg>
  );
}
