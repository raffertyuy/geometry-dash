import { describe, expect, it } from 'vitest';
import { computeScore, formatScore, formatTimer } from './index';

describe('computeScore', () => {
  it('starts at zero for zero elapsed time', () => {
    expect(computeScore(0)).toBe(0);
  });

  it('stays at zero up to the first 100 ms boundary', () => {
    expect(computeScore(99)).toBe(0);
  });

  it('flips to 1 at exactly 100 ms', () => {
    expect(computeScore(100)).toBe(1);
  });

  it('stays at 1 from 100 ms until just before 200 ms', () => {
    expect(computeScore(199)).toBe(1);
  });

  it('flips to 2 at exactly 200 ms', () => {
    expect(computeScore(200)).toBe(2);
  });

  it('reads 100 at 10_000 ms (the spec SC-002 invariant)', () => {
    expect(computeScore(10_000)).toBe(100);
  });

  it('is monotonically non-decreasing over a 700_000 ms sweep', () => {
    let prev = -1;
    for (let tickMs = 0; tickMs <= 700_000; tickMs += 100) {
      const score = computeScore(tickMs);
      expect(score).toBeGreaterThanOrEqual(prev);
      prev = score;
    }
  });

  it('produces the sequence 0, 1, 2, ... with no gaps or duplicates across 100 ms steps', () => {
    for (let n = 0; n <= 600; n++) {
      expect(computeScore(n * 100)).toBe(n);
      expect(computeScore(n * 100 + 50)).toBe(n);
      expect(computeScore(n * 100 + 99)).toBe(n);
    }
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
