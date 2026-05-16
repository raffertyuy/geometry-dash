import { describe, expect, it } from 'vitest';
import { currentTier, speedMultiplier } from './escalation';
import {
  ESCALATION_SPEED_MULTIPLIER_PER_TIER,
  ESCALATION_TIER_DURATION_MS,
} from '../shared/config';

describe('currentTier', () => {
  it('returns 0 at tickMs 0', () => {
    expect(currentTier(0)).toBe(0);
  });

  it('stays at 0 just before the first tier boundary', () => {
    expect(currentTier(ESCALATION_TIER_DURATION_MS - 1)).toBe(0);
  });

  it('flips to 1 at exactly the tier duration', () => {
    expect(currentTier(ESCALATION_TIER_DURATION_MS)).toBe(1);
  });

  it('stays at 1 just before the second boundary', () => {
    expect(currentTier(2 * ESCALATION_TIER_DURATION_MS - 1)).toBe(1);
  });

  it('flips to 2 at 2 x tier duration', () => {
    expect(currentTier(2 * ESCALATION_TIER_DURATION_MS)).toBe(2);
  });

  it('returns N at N x tier duration for N = 0..10', () => {
    for (let N = 0; N <= 10; N++) {
      expect(currentTier(N * ESCALATION_TIER_DURATION_MS)).toBe(N);
    }
  });

  it('returns 100 at 100 x tier duration (large value sanity)', () => {
    expect(currentTier(100 * ESCALATION_TIER_DURATION_MS)).toBe(100);
  });

  it('is monotonically non-decreasing over a 12-tier sweep', () => {
    let prev = -1;
    for (let t = 0; t <= 12 * ESCALATION_TIER_DURATION_MS; t += 100) {
      const tier = currentTier(t);
      expect(tier).toBeGreaterThanOrEqual(prev);
      prev = tier;
    }
  });
});

describe('speedMultiplier', () => {
  it('returns exactly 1 at tier 0', () => {
    expect(speedMultiplier(0)).toBe(1);
  });

  it('returns the configured per-tier multiplier at tier 1', () => {
    expect(speedMultiplier(1)).toBeCloseTo(
      ESCALATION_SPEED_MULTIPLIER_PER_TIER,
      10,
    );
  });

  it('returns multiplier^2 at tier 2', () => {
    expect(speedMultiplier(2)).toBeCloseTo(
      ESCALATION_SPEED_MULTIPLIER_PER_TIER ** 2,
      10,
    );
  });

  it('returns multiplier^N for N = 0..10', () => {
    for (let N = 0; N <= 10; N++) {
      expect(speedMultiplier(N)).toBeCloseTo(
        ESCALATION_SPEED_MULTIPLIER_PER_TIER ** N,
        10,
      );
    }
  });

  it('is strictly increasing across tiers 0..30 (any multiplier > 1)', () => {
    if (ESCALATION_SPEED_MULTIPLIER_PER_TIER <= 1) {
      // skip when the multiplier is 1 or less - not strict-increasing then
      return;
    }
    let prev = -Infinity;
    for (let tier = 0; tier <= 30; tier++) {
      const m = speedMultiplier(tier);
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
  });

  it('returns a finite value at very high tiers (sanity)', () => {
    expect(Number.isFinite(speedMultiplier(100))).toBe(true);
    expect(speedMultiplier(100)).toBeGreaterThan(0);
  });
});
