/**
 * Time-budget arithmetic for resumable ingestion (SPEC §5). Pure functions:
 * the caller supplies the clock. An unlimited budget is an infinite deadline.
 */

/** Kept free at the end of a budgeted run to clean up and record the run. */
export const FINISH_RESERVE_MS = 2_000;

/** First guess for one enrichment before any duration has been measured. */
export const DEFAULT_ITEM_ESTIMATE_MS = {
  /** Fetching the article plus a Claude lesson takes tens of seconds. */
  ai: 45_000,
  /**
   * The offline heuristic engine measured about 6 ms per lesson (plus database
   * writes) on the live feeds; 500 ms leaves headroom while still letting a
   * short budget make progress before any duration has been measured.
   */
  offline: 500,
} as const;

/** Weight of the newest sample in the moving average. */
export const AVERAGE_WEIGHT = 0.3;

export function deadlineFrom(startedAtMs: number, budgetMs: number | undefined): number {
  return budgetMs === undefined ? Number.POSITIVE_INFINITY : startedAtMs + Math.max(0, budgetMs);
}

export function remainingMs(deadline: number, nowMs: number): number {
  return Math.max(0, deadline - nowMs);
}

/** True when work estimated at `estimateMs` can finish before the deadline, keeping `reserveMs` spare. */
export function canStart(opts: { nowMs: number; deadline: number; estimateMs: number; reserveMs?: number }): boolean {
  return opts.nowMs + opts.estimateMs + (opts.reserveMs ?? FINISH_RESERVE_MS) <= opts.deadline;
}

/** Exponential moving average of item durations; the first sample is taken as-is. */
export function nextAverage(previous: number | null, sampleMs: number, weight = AVERAGE_WEIGHT): number {
  if (previous === null || !Number.isFinite(previous)) return sampleMs;
  return previous + weight * (sampleMs - previous);
}

/** Largest timeout that still leaves the reserve, capped at `capMs`; 0 when nothing is left. */
export function timeoutWithin(deadline: number, nowMs: number, capMs: number, reserveMs = FINISH_RESERVE_MS): number {
  return Math.max(0, Math.min(capMs, deadline - nowMs - reserveMs));
}
