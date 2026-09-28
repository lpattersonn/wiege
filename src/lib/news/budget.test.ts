import { describe, expect, it } from 'vitest';

import { FINISH_RESERVE_MS, canStart, deadlineFrom, nextAverage, remainingMs, timeoutWithin } from './budget';

describe('time budget', () => {
  it('an undefined budget never runs out', () => {
    const deadline = deadlineFrom(1_000, undefined);
    expect(deadline).toBe(Number.POSITIVE_INFINITY);
    expect(canStart({ nowMs: 10 ** 12, deadline, estimateMs: 10 ** 9 })).toBe(true);
    expect(timeoutWithin(deadline, 0, 10_000)).toBe(10_000);
  });

  it('starts an item only if it can finish with the reserve to spare', () => {
    const deadline = deadlineFrom(0, 20_000);
    expect(canStart({ nowMs: 0, deadline, estimateMs: 18_000 })).toBe(true);
    expect(canStart({ nowMs: 1, deadline, estimateMs: 18_000 })).toBe(false);
    expect(canStart({ nowMs: 15_000, deadline, estimateMs: 3_000, reserveMs: 0 })).toBe(true);
    expect(FINISH_RESERVE_MS).toBe(2_000);
  });

  it('remaining time never goes negative', () => {
    expect(remainingMs(100, 50)).toBe(50);
    expect(remainingMs(100, 500)).toBe(0);
  });

  it('timeouts fit inside the budget, keeping the reserve', () => {
    expect(timeoutWithin(20_000, 5_000, 10_000)).toBe(10_000);
    expect(timeoutWithin(20_000, 12_000, 10_000)).toBe(6_000);
    expect(timeoutWithin(20_000, 19_000, 10_000)).toBe(0);
  });

  it('moving average starts at the first sample and follows later ones', () => {
    expect(nextAverage(null, 1_000)).toBe(1_000);
    expect(nextAverage(1_000, 2_000)).toBe(1_300);
    expect(nextAverage(1_000, 2_000, 1)).toBe(2_000);
    let average: number | null = null;
    for (let i = 0; i < 30; i++) average = nextAverage(average, 5_000);
    expect(average).toBe(5_000);
  });
});
