import { wordBoundsAt } from './text';

/**
 * Browser-only helpers over the server-rendered story text: character
 * offsets ↔ DOM ranges (the text of a paragraph is exactly the lesson's
 * paragraph string, with tap words as buttons inside it) and the word under a
 * pointer. Call only from effects and event handlers.
 */

/** Text nodes under `root` in document order, skipping hidden pen marks (they hold no text anyway). */
function textNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) out.push(node as Text);
  return out;
}

/** A Range over characters [start, end) of `root.textContent`. */
export function rangeFromOffsets(root: Node, start: number, end: number): Range | null {
  const range = document.createRange();
  let pos = 0;
  let started = false;
  for (const node of textNodes(root)) {
    const len = node.data.length;
    if (!started && start <= pos + len) {
      range.setStart(node, Math.max(0, start - pos));
      started = true;
    }
    if (started && end <= pos + len) {
      range.setEnd(node, Math.max(0, end - pos));
      return range;
    }
    pos += len;
  }
  return null;
}

/** Offset of (node, offset) within `root.textContent`, or -1. */
export function offsetWithin(root: Node, target: Node, offset: number): number {
  let pos = 0;
  for (const node of textNodes(root)) {
    if (node === target) return pos + offset;
    pos += node.data.length;
  }
  return -1;
}

interface CaretHit {
  node: Node;
  offset: number;
}

type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

function caretAt(x: number, y: number): CaretHit | null {
  const doc = document as CaretDocument;
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y);
    return pos ? { node: pos.offsetNode, offset: pos.offset } : null;
  }
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y);
    return range ? { node: range.startContainer, offset: range.startOffset } : null;
  }
  return null;
}

export interface WordHit {
  word: string;
  range: Range;
  /** The paragraph element (`[data-para]`) the word is in. */
  paragraph: HTMLElement;
  /** Offset of the word in the paragraph's text. */
  index: number;
}

/**
 * The word under a pointer inside `scope` (SPEC §8: no per-word spans).
 * Null over whitespace, punctuation, numbers, buttons and links, or when the
 * caret snapped to a word the pointer isn't actually on.
 */
export function wordAtPoint(x: number, y: number, scope: HTMLElement): WordHit | null {
  const hit = caretAt(x, y);
  if (!hit || hit.node.nodeType !== Node.TEXT_NODE) return null;
  const node = hit.node as Text;
  const parent = node.parentElement;
  if (!parent || !scope.contains(parent) || parent.closest('button, a, [aria-hidden="true"]')) return null;
  const paragraph = parent.closest<HTMLElement>('[data-para]');
  if (!paragraph) return null;
  const bounds = wordBoundsAt(node.data, hit.offset);
  if (!bounds) return null;
  const range = document.createRange();
  range.setStart(node, bounds[0]);
  range.setEnd(node, bounds[1]);
  // caretPositionFromPoint snaps to the nearest character: make sure the pointer is on the word.
  const inside = Array.from(range.getClientRects()).some((r) => x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2);
  if (!inside) return null;
  return { word: node.data.slice(bounds[0], bounds[1]), range, paragraph, index: offsetWithin(paragraph, node, bounds[0]) };
}

/** Line boxes of a range relative to `container` (for pen marks drawn in an overlay). */
export function rectsWithin(range: Range, container: HTMLElement): Array<{ left: number; top: number; width: number; height: number }> {
  const base = container.getBoundingClientRect();
  const lines: Array<{ left: number; top: number; width: number; height: number }> = [];
  for (const r of Array.from(range.getClientRects())) {
    if (r.width < 1 || r.height < 1) continue;
    const last = lines[lines.length - 1];
    // Merge fragments on the same line (text nodes split by tap words).
    if (last && Math.abs(last.top - (r.top - base.top)) < 4) {
      const right = Math.max(last.left + last.width, r.right - base.left);
      last.left = Math.min(last.left, r.left - base.left);
      last.width = right - last.left;
      continue;
    }
    lines.push({ left: r.left - base.left, top: r.top - base.top, width: r.width, height: r.height });
  }
  return lines;
}

/** Stored pref? Scroll smoothly only when the student hasn't asked for reduced motion. */
export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
