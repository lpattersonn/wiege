/**
 * Client-only pen drawing (DESIGN §8.5). Under `vector-effect:
 * non-scaling-stroke` dashes are measured in screen space, so the on-screen
 * length is measured rather than using pathLength="1". Browser only: call from
 * effects or event handlers. Does nothing under reduced motion.
 */

export const PEN_DURATION = { short: 260, pen: 420, arrow: 320, arrowHead: 140, arrowDelay: 380 } as const;
export const PEN_EASING = 'cubic-bezier(.6,.04,.28,1)';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : true;
}

function screenLength(path: SVGGeometryElement, sx: number, sy: number): number {
  const total = path.getTotalLength();
  let prev: [number, number] | null = null;
  let len = 0;
  for (let k = 0; k <= 80; k++) {
    const pt = path.getPointAtLength((total * k) / 80);
    const q: [number, number] = [pt.x * sx, pt.y * sy];
    if (prev) len += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
    prev = q;
  }
  return len + 2;
}

export interface DrawOptions {
  delay?: number;
  duration?: number;
  /** Delay between successive paths, as a fraction of `duration` (default 0.6). */
  stagger?: number;
  /** Only draw paths matching this selector (e.g. "[data-draw]"). */
  only?: string;
}

/** Animates every path in `svg` from nothing to its final stroke. */
export function drawIn(svg: SVGSVGElement, { delay = 0, duration = PEN_DURATION.pen, stagger = 0.6, only }: DrawOptions = {}): Animation[] {
  if (prefersReducedMotion() || typeof svg.getBoundingClientRect !== 'function') return [];
  const box = svg.getBoundingClientRect();
  const vb = svg.viewBox?.baseVal;
  const sx = vb && vb.width ? box.width / vb.width : 1;
  const sy = vb && vb.height ? box.height / vb.height : 1;
  const animations: Animation[] = [];
  svg.querySelectorAll<SVGPathElement>(only ? `path${only}` : 'path').forEach((p, i) => {
    if (p.classList.contains('pm-fill')) {
      animations.push(p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: duration * 0.5, delay: delay + duration * 0.8, easing: 'ease-out', fill: 'backwards' }));
      return;
    }
    const len = screenLength(p, sx, sy);
    p.style.strokeDasharray = `${len} ${len}`;
    const anim = p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
      duration,
      delay: delay + i * duration * stagger,
      easing: PEN_EASING,
      fill: 'backwards',
    });
    anim.addEventListener('finish', () => {
      // Hand back to the stylesheet (dashed pending strokes keep their own dasharray).
      p.style.strokeDasharray = '';
    });
    animations.push(anim);
  });
  return animations;
}

/** Draws one path (e.g. a leader line) whose own coordinates are screen pixels. */
export function drawPath(path: SVGPathElement, { delay = 0, duration = PEN_DURATION.arrow }: DrawOptions = {}): Animation | null {
  if (prefersReducedMotion()) return null;
  const len = path.getTotalLength() + 2;
  path.style.strokeDasharray = `${len} ${len}`;
  const anim = path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration, delay, easing: PEN_EASING, fill: 'backwards' });
  anim.addEventListener('finish', () => {
    path.style.strokeDasharray = '';
  });
  return anim;
}
