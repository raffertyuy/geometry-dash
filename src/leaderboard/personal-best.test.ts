import { describe, expect, it } from 'vitest';
import { derivePersonalBestSurface, shouldUpdatePersonalBest } from './personal-best';
import type { PersonalBest } from './types';
import type { LeaderboardEntry } from '../shared/leaderboard-types';

const pb = (score: number, timeMs = 60_000): PersonalBest => ({
  score,
  timeMs,
  achievedAt: '2026-05-23T00:00:00.000Z',
});

const entry = (
  score: number,
  initials: string,
  timeMs = 60_000,
): LeaderboardEntry => ({
  initials,
  score,
  timeMs,
  submittedAt: '2026-05-23T00:00:00.000Z',
});

describe('shouldUpdatePersonalBest', () => {
  it('returns true on first non-zero score', () => {
    expect(shouldUpdatePersonalBest(null, 1, 1000)).toBe(true);
  });

  it('returns false on first zero score', () => {
    expect(shouldUpdatePersonalBest(null, 0, 1000)).toBe(false);
  });

  it('returns true when current PB is lower', () => {
    expect(shouldUpdatePersonalBest(pb(100), 200, 1000)).toBe(true);
  });

  it('returns false on ties', () => {
    expect(shouldUpdatePersonalBest(pb(100), 100, 1000)).toBe(false);
  });

  it('returns false when current PB is higher', () => {
    expect(shouldUpdatePersonalBest(pb(200), 100, 1000)).toBe(false);
  });
});

describe('derivePersonalBestSurface', () => {
  it('returns absent when no PB', () => {
    const result = derivePersonalBestSurface([], null, 'RAF');
    expect(result).toEqual({ kind: 'absent' });
  });

  it('returns highlighted when PB matches a board entry on (initials, score, timeMs)', () => {
    const board: LeaderboardEntry[] = [entry(200, 'AAA'), entry(100, 'RAF')];
    const result = derivePersonalBestSurface(board, pb(100), 'RAF');
    expect(result).toEqual({ kind: 'highlighted', atIndex: 1 });
  });

  it('returns pinned when PB exists but is not visible in the top-N', () => {
    const board: LeaderboardEntry[] = [entry(1000, 'TOP'), entry(500, 'MID')];
    const result = derivePersonalBestSurface(board, pb(100), 'RAF');
    expect(result.kind).toBe('pinned');
    if (result.kind === 'pinned') {
      expect(result.entry.initials).toBe('RAF');
      expect(result.entry.score).toBe(100);
    }
  });

  it('returns highlighted when (score, timeMs) match — even if initials differ', () => {
    // Player previously submitted as 'OTH', set a PB, then changed to 'RAF'.
    // The board still has the OTH entry; the player IS represented by that
    // row, so we highlight it rather than pin a confusing duplicate.
    const board: LeaderboardEntry[] = [entry(100, 'OTH')];
    const result = derivePersonalBestSurface(board, pb(100), 'RAF');
    expect(result).toEqual({ kind: 'highlighted', atIndex: 0 });
  });

  it('returns pinned when score matches an entry but timeMs differs', () => {
    // Coincidental same-score from a faster / slower run — the player's
    // best is not represented on the board.
    const board: LeaderboardEntry[] = [entry(100, 'RAF', 5000)];
    const result = derivePersonalBestSurface(board, pb(100, 9999), 'RAF');
    expect(result.kind).toBe('pinned');
  });

  it('uses the pinned entry submittedAt = PB.achievedAt', () => {
    const result = derivePersonalBestSurface([], pb(50), 'RAF');
    if (result.kind === 'pinned') {
      expect(result.entry.submittedAt).toBe('2026-05-23T00:00:00.000Z');
    }
  });
});
