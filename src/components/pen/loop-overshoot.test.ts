import { describe, expect, it } from 'vitest';

import { loopPath, LOOP_OVERSHOOT } from './pen';

/**
 * DESIGN §0/§8.3: a loop's spiral tail lands above the word, never on a
 * neighbour. In display-xl (Bodoni Moda 900, line height 1.04) the line above
 * sits its baseline 0.16em above this line's top (measured: font ascent
 * 1.119em, descent 0.399em, so half-leading is −0.239em). The display loop box
 * starts .06em above the line (--lt) and its 100 viewBox units span 1.14em.
 */
const EM_PER_UNIT = 1.14 / 100;
const SVG_TOP_EM = -0.06;
const PREVIOUS_BASELINE_EM = -0.16;
/** Half the hero stroke (3.5px at 78px). */
const HALF_STROKE_EM = 0.0225;

/** Highest point of the path in viewBox units (control points bound the curve). */
function minY(d: string): number {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  let min = Infinity;
  for (let i = 1; i < numbers.length; i += 2) min = Math.min(min, numbers[i]);
  return min;
}

function worstInkTopEm(overshoot: number): number {
  let worst = Infinity;
  for (let s = 1; s <= 600; s++) {
    for (const aspect of [1.2, 2, 3, 4.5, 6]) {
      const y = minY(loopPath((s * 2654435761) >>> 0, aspect, { overshoot }).d[0]);
      worst = Math.min(worst, y);
    }
  }
  return SVG_TOP_EM + worst * EM_PER_UNIT - HALF_STROKE_EM;
}

describe('loop overshoot', () => {
  it('keeps the default loop unchanged', () => {
    expect(loopPath(12345, 3)).toEqual(loopPath(12345, 3, { overshoot: LOOP_OVERSHOOT.default }));
  });

  it('keeps the display tail at least 0.05em clear of the line above', () => {
    const clearance = worstInkTopEm(LOOP_OVERSHOOT.display) - PREVIOUS_BASELINE_EM;
    expect(clearance).toBeGreaterThanOrEqual(0.05);
  });

  it('shows why: the full-size tail reaches the line above in display type', () => {
    const clearance = worstInkTopEm(LOOP_OVERSHOOT.default) - PREVIOUS_BASELINE_EM;
    expect(clearance).toBeLessThan(0.03);
  });
});
