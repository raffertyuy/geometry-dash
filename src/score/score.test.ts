import { describe, expect, it } from 'vitest';
import { computeScore, formatScore, formatTimer } from './index';
import {
  ESCALATION_SCORE_INCREMENT_PER_TIER,
  ESCALATION_TIER_DURATION_MS,
} from '../shared/config';

// Reference implementation: a slow O(tier) loop that computes the
// cumulative score by summing per-tier contributions one tier at a time.
// computeScore uses a closed-form O(1) expression; comparing the two
// catches any algebra mistakes in the closed form.
function expectedScoreViaLoop(tickMs: number): number {
  const TICK_MS = 100;
  const ticksPerTier = ESCALATION_TIER_DURATION_MS / TICK_MS;
  const N = Math.floor(tickMs / ESCALATION_TIER_DURATION_MS);
  let total = 0;
  for (let k = 0; k < N; k++) {
    total += ticksPerTier * (1 + k * ESCALATION_SCORE_INCREMENT_PER_TIER);
  }
  const currentTicks = Math.floor(
    (tickMs - N * ESCALATION_TIER_DURATION_MS) / TICK_MS,
  );
  total += currentTicks * (1 + N * ESCALATION_SCORE_INCREMENT_PER_TIER);
  return total;
}

describe('computeScore', () => {
  it('starts at zero for zero elapsed time', () => {
    expect(computeScore(0)).toBe(0);
  });

  it('stays at zero up to the first 100 ms tick', () => {
    expect(computeScore(99)).toBe(0);
  });

  it('flips to 1 at exactly 100 ms (tier 0, base rate)', () => {
    expect(computeScore(100)).toBe(1);
  });

  it('stays at 1 from 100 ms until just before 200 ms', () => {
    expect(computeScore(199)).toBe(1);
  });

  it('flips to 2 at exactly 200 ms', () => {
    expect(computeScore(200)).toBe(2);
  });

  it('is monotonically non-decreasing over a long sweep across many tier boundaries', () => {
    let prev = -1;
    const sweepMs = 10 * ESCALATION_TIER_DURATION_MS;
    for (let tickMs = 0; tickMs <= sweepMs; tickMs += 100) {
      const score = computeScore(tickMs);
      expect(score).toBeGreaterThanOrEqual(prev);
      prev = score;
    }
  });

  it('matches the looping reference implementation across all tier boundaries (0..10)', () => {
    for (let N = 0; N <= 10; N++) {
      const t = N * ESCALATION_TIER_DURATION_MS;
      expect(computeScore(t)).toBe(expectedScoreViaLoop(t));
    }
  });

  it('matches the looping reference implementation mid-tier (0..10, +5s into each)', () => {
    for (let N = 0; N <= 10; N++) {
      const t = N * ESCALATION_TIER_DURATION_MS + Math.floor(ESCALATION_TIER_DURATION_MS / 2);
      expect(computeScore(t)).toBe(expectedScoreViaLoop(t));
    }
  });

  it('matches the reference at 100 random offsets within the first 10 tiers', () => {
    for (let i = 0; i < 100; i++) {
      const t = Math.floor(Math.random() * 10 * ESCALATION_TIER_DURATION_MS);
      expect(computeScore(t)).toBe(expectedScoreViaLoop(t));
    }
  });
});

describe('computeScore - piecewise tier rate semantics', () => {
  it('rate in tier 0 is exactly 1 point per 100 ms', () => {
    // 0..(TIER_DURATION_MS-1) is tier 0 at the base rate.
    expect(computeScore(100) - computeScore(0)).toBe(1);
    expect(computeScore(200) - computeScore(100)).toBe(1);
    expect(computeScore(1000) - computeScore(900)).toBe(1);
  });

  it('rate in tier 1 is (1 + INCREMENT) points per 100 ms', () => {
    const tier1Start = ESCALATION_TIER_DURATION_MS;
    const expectedRate = 1 + ESCALATION_SCORE_INCREMENT_PER_TIER;
    expect(computeScore(tier1Start + 100) - computeScore(tier1Start)).toBe(
      expectedRate,
    );
    expect(
      computeScore(tier1Start + 200) - computeScore(tier1Start + 100),
    ).toBe(expectedRate);
  });

  it('rate in tier 2 is (1 + 2 * INCREMENT) points per 100 ms', () => {
    const tier2Start = 2 * ESCALATION_TIER_DURATION_MS;
    const expectedRate = 1 + 2 * ESCALATION_SCORE_INCREMENT_PER_TIER;
    expect(computeScore(tier2Start + 100) - computeScore(tier2Start)).toBe(
      expectedRate,
    );
  });

  it('rate in tier N is (1 + N * INCREMENT) for N = 0..5', () => {
    for (let N = 0; N <= 5; N++) {
      const start = N * ESCALATION_TIER_DURATION_MS;
      const expectedRate = 1 + N * ESCALATION_SCORE_INCREMENT_PER_TIER;
      expect(computeScore(start + 100) - computeScore(start)).toBe(
        expectedRate,
      );
    }
  });
});

describe('computeScore - optional scoreDelta parameter', () => {
  it('returns the same value as the single-arg form when scoreDelta is omitted', () => {
    expect(computeScore(0)).toBe(0);
    expect(computeScore(10_000)).toBe(computeScore(10_000, 0));
    expect(computeScore(60_000)).toBe(computeScore(60_000, 0));
  });

  it('returns the same value when scoreDelta is explicitly 0', () => {
    expect(computeScore(10_000, 0)).toBe(computeScore(10_000));
  });

  it('adds a positive scoreDelta on top of the tick-derived score', () => {
    const base = computeScore(10_000);
    expect(computeScore(10_000, 1000)).toBe(base + 1000);
    expect(computeScore(10_000, 5000)).toBe(base + 5000);
    expect(computeScore(10_000, 10_000)).toBe(base + 10_000);
  });

  it('subtracts a negative scoreDelta from the tick-derived score', () => {
    const base = computeScore(10_000);
    expect(computeScore(10_000, -1000)).toBe(base - 1000);
    expect(computeScore(10_000, -5000)).toBe(base - 5000);
  });

  it('allows the total to go negative when scoreDelta exceeds the tick-derived score', () => {
    // Tier 0 at low elapsed time: tick score is small, so a wrong A answer
    // (-10_000) drives the total well below zero. This is the FR-013 (b)
    // condition: score < 0 triggers game-over.
    const base = computeScore(1_000); // small (~10 in default config)
    expect(computeScore(1_000, -10_000)).toBe(base - 10_000);
    expect(computeScore(1_000, -10_000)).toBeLessThan(0);
  });

  it('the tick-derived component is unaffected by scoreDelta (additivity)', () => {
    const a = computeScore(30_000);
    const b = computeScore(30_000, 1234);
    const c = computeScore(30_000, -1234);
    expect(b - a).toBe(1234);
    expect(c - a).toBe(-1234);
  });
});

describe('formatScore', () => {
  it('formats zero as "0"', () => {
    expect(formatScore(0)).toBe('0');
  });

  it('formats small numbers without padding', () => {
    expect(formatScore(42)).toBe('42');
  });

  it('formats large numbers without thousands separators', () => {
    expect(formatScore(100000)).toBe('100000');
  });
});

describe('formatTimer', () => {
  it('formats zero as "0:00"', () => {
    expect(formatTimer(0)).toBe('0:00');
  });

  it('floors sub-second values to "0:00"', () => {
    expect(formatTimer(999)).toBe('0:00');
  });

  it('flips to "0:01" at exactly 1 second', () => {
    expect(formatTimer(1_000)).toBe('0:01');
  });

  it('formats 59 seconds with two-digit padding', () => {
    expect(formatTimer(59_999)).toBe('0:59');
  });

  it('formats one minute as "1:00"', () => {
    expect(formatTimer(60_000)).toBe('1:00');
  });

  it('formats 9:59 just before the MM:SS boundary', () => {
    expect(formatTimer(599_999)).toBe('9:59');
  });

  it('crosses the M:SS to MM:SS boundary at exactly 10 minutes', () => {
    expect(formatTimer(600_000)).toBe('10:00');
  });

  it('formats 99 minutes 59 seconds as "99:59"', () => {
    expect(formatTimer(5_999_999)).toBe('99:59');
  });

  it('keeps showing minutes past 100 (no hour overflow)', () => {
    expect(formatTimer(6_000_000)).toBe('100:00');
  });
});
