/**
 * The pen (DESIGN §8): seeded, deterministic path generators. Isomorphic (no
 * DOM, no server-only), rounded to 0.1 so the server and the client produce
 * identical strings. Generate once on the server and pass `d` strings down;
 * client code calls the same functions only for marks the student creates.
 */

export type Point = [number, number];

export const fnv1a = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** 0.1 precision: identical strings on server and client. */
export const r1 = (n: number): number => Math.round(n * 10) / 10;

export function smooth(pts: Point[]): string {
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    d += `Q${r1(x)} ${r1(y)} ${r1((x + nx) / 2)} ${r1((y + ny) / 2)}`;
  }
  const l = pts[pts.length - 1];
  return `${d}L${r1(l[0])} ${r1(l[1])}`;
}

/** Same word in the same story → same mark; another story → a sibling mark. */
export const penSeed = (kind: string, text: string, scope = ''): number =>
  fnv1a(`${kind}:${text.toLowerCase()}:${scope}`);

export interface PenGeometry {
  viewBox: string;
  d: string[];
}

/**
 * How far the loop's spiral tail climbs out past its start, per context.
 * Display headlines (display-xl, line height 1.04) have almost no gap between
 * lines, so a full-size tail reaches the line above; there the tail stays
 * close to the loop (DESIGN §0, §8.3: never on a neighbour).
 */
export const LOOP_OVERSHOOT = { default: 1, display: 0.2 } as const;

export interface LoopOptions {
  /** Scales the spiral tail's outward climb (1 = reading text, 0.2 = display headlines). */
  overshoot?: number;
}

/**
 * Word loop: a hand-drawn rounded rectangle in an aspect-aware box. Straight
 * runs hug the word, corners stay tight, and the spiral overshoot finishes
 * above the word, never on a neighbour. `aspect` = box width / height.
 */
export function loopPath(seed: number, aspect = 3, { overshoot = LOOP_OVERSHOOT.default }: LoopOptions = {}): PenGeometry {
  const r = mulberry32(seed);
  const H = 100;
  const W = Math.max(110, Math.round(100 * aspect));
  const m = 4;
  const A = W / 2 - m;
  const B = H / 2 - m;
  const rad = Math.min(B * (0.74 + r() * 0.12), A * 0.5);
  const sx = A - rad;
  const sy = B - rad;
  const q = (Math.PI * rad) / 2;
  const cx = W / 2;
  const cy = H / 2;
  const segs = [2 * sx, q, 2 * sy, q, 2 * sx, q, 2 * sy, q];
  const P = segs.reduce((a, b) => a + b, 0);
  const at = (s: number): [number, number, number, number, number] => {
    s = ((s % P) + P) % P;
    let i = 0;
    while (s > segs[i]) {
      s -= segs[i];
      i++;
    }
    const u = segs[i] ? s / segs[i] : 0;
    switch (i) {
      case 0:
        return [cx - sx + 2 * sx * u, cy - B, 0, -1, u];
      case 2:
        return [cx + A, cy - sy + 2 * sy * u, 1, 0, u];
      case 4:
        return [cx + sx - 2 * sx * u, cy + B, 0, 1, u];
      case 6:
        return [cx - A, cy + sy - 2 * sy * u, -1, 0, u];
      default: {
        const k = (i - 1) / 2;
        const a = -Math.PI / 2 + k * (Math.PI / 2) + u * (Math.PI / 2);
        const ox = [cx + sx, cx + sx, cx - sx, cx - sx][k];
        const oy = [cy - sy, cy + sy, cy + sy, cy - sy][k];
        return [ox + rad * Math.cos(a), oy + rad * Math.sin(a), Math.cos(a), Math.sin(a), -1];
      }
    }
  };
  const s0 = sx * (1.45 + r() * 0.3);
  const sweep = P * (1.07 + r() * 0.03);
  const ph = r() * 6;
  const bow = 2 + r() * 1.5;
  const pts: Point[] = [];
  for (let i = 0; i <= 96; i++) {
    const t = i / 96;
    const [x, y, nx, ny, u] = at(s0 + sweep * t);
    const off = (u >= 0 ? bow * Math.sin(Math.PI * u) : 0) + 1.2 * Math.sin(t * 9 + ph) + t * 5 * overshoot;
    pts.push([x + nx * off, y + ny * off]);
  }
  return { viewBox: `0 0 ${W} ${H}`, d: [smooth(pts)] };
}

/** Open ellipse for letters and numbers (answer letters). */
export function ringPath(seed: number): PenGeometry {
  const r = mulberry32(seed);
  const start = -Math.PI * (0.3 + r() * 0.08);
  const sweep = Math.PI * 2 * (1.06 + r() * 0.03);
  const ph = r() * 6;
  const pts: Point[] = [];
  for (let i = 0; i <= 52; i++) {
    const t = i / 52;
    const a = start + sweep * t;
    const k = 1 + 0.028 * Math.sin(a * 2 + ph) + (t - 0.5) * 0.06;
    pts.push([50 + 46 * k * Math.cos(a), 50 + 44 * k * Math.sin(a)]);
  }
  return { viewBox: '0 0 100 100', d: [smooth(pts)] };
}

/** A seal ring in the 120×120 stamp box (outer rx 56 / ry 55, inner disc 45 / 44). */
export function sealRing(seed: number, rx: number, ry: number, cx = 60, cy = 60): string {
  const r = mulberry32(seed);
  const start = -Math.PI * (0.3 + r() * 0.1);
  const sweep = Math.PI * 2 * (1.04 + r() * 0.03);
  const ph = r() * 6;
  const pts: Point[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const a = start + sweep * t;
    const k = 1 + 0.02 * Math.sin(a * 3 + ph) + (t - 0.5) * 0.035;
    pts.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]);
  }
  return smooth(pts);
}

export function squigglePath(seed: number, chars: number): PenGeometry {
  const r = mulberry32(seed);
  const waves = Math.max(3, Math.min(16, Math.round(chars * 0.9)));
  const w = 100 / waves;
  let d = 'M0 5';
  let x = 0;
  let up = true;
  for (let i = 0; i < waves; i++) {
    const nx = Math.min(100, x + w);
    d += `Q${r1(x + w / 2)} ${r1(5 + (up ? -3.6 : 3.6) * (0.8 + r() * 0.4))} ${r1(nx)} ${r1(5 + (r() - 0.5))}`;
    x = nx;
    up = !up;
  }
  return { viewBox: '0 0 100 10', d: [d] };
}

export const underlinePath = (seed: number): PenGeometry => {
  const r = mulberry32(seed);
  return {
    viewBox: '0 0 100 10',
    d: [`M${r1(1 + r() * 2)} ${r1(4 + r() * 2)}Q50 ${r1(6 + r() * 2.5)} ${r1(97 + r() * 2)} ${r1(3 + r() * 2)}`],
  };
};

export const doublePath = (seed: number): PenGeometry => {
  const r = mulberry32(seed);
  return {
    viewBox: '0 0 100 14',
    d: [
      `M${r1(1 + r() * 2)} ${r1(3 + r())}Q50 ${r1(5 + r() * 2)} 98 ${r1(2.5 + r())}`,
      `M${r1(6 + r() * 4)} ${r1(10 + r())}Q52 ${r1(12 + r() * 1.5)} ${r1(92 + r() * 4)} ${r1(9.5 + r())}`,
    ],
  };
};

/** A hand strike through a word (optional editorial use; quiz answers use CSS line-through). */
export const strikePath = (seed: number): PenGeometry => {
  const r = mulberry32(seed);
  return {
    viewBox: '0 0 100 10',
    d: [`M${r1(0.5 + r() * 2)} ${r1(5.5 + r() * 1.5)}C30 ${r1(3.5 + r() * 2)} 62 ${r1(6 + r() * 2)} ${r1(98 + r() * 1.5)} ${r1(4 + r() * 1.5)}`],
  };
};

/** Tick, viewBox 0 0 30 26. */
export const TICK = 'M2.5 14.5C5.8 16.4 8.6 19.6 10.8 23.6 15.6 13.2 21.8 6.2 28 2.2';
/** Caret, viewBox 0 0 14 12. */
export const CARET = 'M1.5 11L7 1.8L12.5 11';
/** Small tick for chips, checklists and "Read" markers, viewBox 0 0 16 14. */
export const MINI_TICK = 'M1.5 7.5L6 12L14.5 1.5';
/** Tick inside a 22px meter box, viewBox 0 0 22 22. */
export const BOX_TICK = 'M5 11.5C7 12.6 8.4 14.4 9.6 17 12.4 10.4 15.6 6.2 20 3.2';
/** Active-tab pen underline, viewBox 0 0 28 6. */
export const TAB_UNDERLINE = 'M1.5 3.6C9 2 19 2.2 26.5 3';
/** Hand-drawn arrows for handwritten asides, viewBox 0 0 52 40. */
export const ASIDE_ARROW = {
  down: 'M6 4c10 2 18 10 20 26M20 24l6 8 6-8',
  right: 'M3 8c8 18 24 24 44 20M40 21l8 7-9 5',
} as const;
/** The same marks at icon size for feedback notes, viewBox 0 0 28 18. */
export const NOTE_MARK_ICON = {
  loop: 'M3 9c0-5 6-7 11-7s11 2 11 7-6 7-11 7S3 14 3 9Z',
  double: 'M2 8c8-1 16-1 24 0M4 13c7-1 13-1 20 0',
  caret: 'M8 16L14 4L20 16',
  underline: 'M2 10c8-1.4 16-1.2 24-.2',
  squiggle: 'M2 9c2-4 4-4 6 0s4 4 6 0 4-4 6 0 4 4 6 0',
} as const;

export const crossPath = (seed: number): PenGeometry => {
  const r = mulberry32(seed);
  const j = () => (r() - 0.5) * 3;
  return {
    viewBox: '0 0 40 40',
    d: [
      `M${r1(9 + j())} ${r1(9 + j())}C18 18 24 25 ${r1(31 + j())} ${r1(32 + j())}`,
      `M${r1(31 + j())} ${r1(8 + j())}C23 16 17 24 ${r1(9 + j())} ${r1(32 + j())}`,
    ],
  };
};

/** Empty meter box, viewBox 0 0 22 22. */
export const boxPath = (seed: number): string => {
  const r = mulberry32(seed);
  const j = () => (r() - 0.5) * 1.6;
  return `M${r1(3 + j())} ${r1(3.5 + j())}L${r1(19 + j())} ${r1(3 + j())}L${r1(19.2 + j())} ${r1(19 + j())}L${r1(3.2 + j())} ${r1(19.4 + j())}Z`;
};

/**
 * Pen line for a progress track, viewBox 0 0 100 `height`. Draws from x = 1 to
 * x = 1 + 98 × value with a slight hand wobble. Returns '' at 0 (no fake progress).
 */
export function progressPath(value: number, seed = 7, height = 12): string {
  const v = Math.max(0, Math.min(1, value));
  if (v <= 0) return '';
  const r = mulberry32(seed);
  const mid = height / 2;
  const end = 1 + 98 * v;
  const len = end - 1;
  const y0 = mid + 0.4 + r() * 0.4;
  const c1 = mid - 0.9 + r() * 0.6;
  const c2 = mid + 0.6 + r() * 0.6;
  const y1 = mid - 0.4 - r() * 0.4;
  return `M1 ${r1(y0)}C${r1(1 + len * 0.33)} ${r1(c1)} ${r1(1 + len * 0.66)} ${r1(c2)} ${r1(end)} ${r1(y1)}`;
}

export interface TallyStroke {
  d: string;
  /** Today's stroke, still waiting: dashed 2 6 in --ink-3. */
  pending: boolean;
}

export interface TallyGeometry {
  viewBox: string;
  width: number;
  height: number;
  strokes: TallyStroke[];
}

/**
 * Reading days in groups of five (DESIGN §11.13): strokes 14 apart, four
 * uprights plus a diagonal, 30 between groups, 72 tall. With `pending`, one
 * extra dashed stroke stands for today.
 */
export function tallyPaths(count: number, { pending = true, seed = 21 }: { pending?: boolean; seed?: number } = {}): TallyGeometry {
  const n = Math.max(0, Math.floor(count));
  const total = n + (pending ? 1 : 0);
  const r = mulberry32(seed);
  const H = 72;
  const sp = 14;
  const gap = 30;
  const strokes: TallyStroke[] = [];
  let x = 10;
  const groups = Math.max(1, Math.ceil(total / 5));
  for (let g = 0; g < groups; g++) {
    const gx = x;
    for (let i = 0; i < 4; i++) {
      const idx = g * 5 + i;
      if (idx >= total) break;
      const tx = x + (r() - 0.5) * 2.4;
      const top = 6 + r() * 6;
      const bot = H - 6 - r() * 6;
      strokes.push({
        d: `M${r1(tx)} ${r1(top)}Q${r1(tx + (r() - 0.5) * 5)} ${r1(H / 2)} ${r1(tx + (r() - 0.5) * 3)} ${r1(bot)}`,
        pending: idx === n,
      });
      x += sp;
    }
    const slashIdx = g * 5 + 4;
    if (slashIdx < total) {
      strokes.push({
        d: `M${r1(gx - 10)} ${r1(H - 16 + r() * 4)}Q${r1(gx + sp * 1.4)} ${r1(H / 2 + 6)} ${r1(gx + sp * 3 + 10)} ${r1(14 + r() * 4)}`,
        pending: slashIdx === n,
      });
    }
    x = gx + sp * 4 + gap;
  }
  const width = Math.max(40, Math.round(groups * (sp * 4 + gap) - gap + 10));
  return { viewBox: `0 0 ${width} ${H}`, width, height: H, strokes };
}

/** Compact tally for the Today strip (22px tall): strokes 5 apart, 30 per group. */
export function miniTallyPaths(count: number, seed = 5): { viewBox: string; width: number; d: string } {
  const n = Math.max(0, Math.floor(count));
  const r = mulberry32(seed);
  let d = '';
  const groups = Math.max(1, Math.ceil(n / 5));
  for (let g = 0; g < groups; g++) {
    const gx = 4 + g * 30;
    for (let i = 0; i < 4; i++) {
      const idx = g * 5 + i;
      if (idx >= n) break;
      const x = gx + i * 5;
      d += `M${r1(x)} ${r1(2 + r() * 0.6)}v${r1(17.4 + r() * 0.6)}`;
    }
    if (g * 5 + 4 < n) d += `M${r1(gx - 3)} ${r1(17 + r() * 0.6)}L${r1(gx + 18)} ${r1(5 + r() * 0.4)}`;
  }
  const width = Math.max(8, groups * 30 - 8);
  return { viewBox: `0 0 ${width} 22`, width, d };
}

/** The three bracket pieces of a margin note (12 wide; the middle stretches). */
export const BRACKET = {
  top: 'M10 1.6C5.2 1.8 3.6 4 3.5 13.5',
  mid: 'M3.5 0C3.1 30 3.9 70 3.4 100',
  bottom: 'M3.4 .5C3.5 10 5 12.2 10.2 12.4',
} as const;

/**
 * Leader arrow from a margin note back to its word (desktop only). Coordinates
 * are in the overlay's own space: from the note (x1, yNote) to the word's
 * line end (x2, yWord). Returns null when there is no room to draw one.
 */
export function leaderPath(x1: number, yNote: number, x2: number, yWord: number): { line: string; head: string } | null {
  const l = x1 - x2;
  if (l < 16) return null;
  const line = `M${r1(x1)} ${r1(yNote)}C${r1(x1 - l * 0.4)} ${r1(yNote)} ${r1(x2 + l * 0.45)} ${r1(yWord + 4)} ${r1(x2)} ${r1(yWord)}`;
  const ang = Math.atan2(yWord - (yWord + 4), x2 - (x2 + l * 0.45));
  const h1: Point = [x2 + 10 * Math.cos(ang + 0.5 + Math.PI), yWord + 10 * Math.sin(ang + 0.5 + Math.PI)];
  const h2: Point = [x2 + 10 * Math.cos(ang - 0.5 + Math.PI), yWord + 10 * Math.sin(ang - 0.5 + Math.PI)];
  const head = `M${r1(h1[0])} ${r1(h1[1])}L${r1(x2)} ${r1(yWord)}L${r1(h2[0])} ${r1(h2[1])}`;
  return { line, head };
}
