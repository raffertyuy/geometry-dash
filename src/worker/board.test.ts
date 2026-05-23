import { describe, expect, it } from 'vitest';
import { LEADERBOARD_MAX_ENTRIES } from '../shared/config';
import { cracksTopN, insertEntry } from './board';
import type { LeaderboardEntry } from '../shared/leaderboard-types';

function entry(
  score: number,
  initials = 'AAA',
  submittedAt = '2026-05-23T00:00:00.000Z',
): LeaderboardEntry {
  return { initials, score, timeMs: 1000, submittedAt };
}

describe('insertEntry', () => {
  it('inserts into an empty board', () => {
    const result = insertEntry([], entry(100, 'RAF'));
    expect(result).toEqual([entry(100, 'RAF')]);
  });

  it('sorts by score descending', () => {
    const board = [entry(80), entry(50)];
    const result = insertEntry(board, entry(100, 'NEW'));
    expect(result.map((e) => e.score)).toEqual([100, 80, 50]);
  });

  it('puts a tie-score candidate AFTER the existing entry (earlier wins)', () => {
    const board = [entry(80, 'OLD', '2026-01-01T00:00:00.000Z')];
    const result = insertEntry(board, entry(80, 'NEW', '2026-05-23T00:00:00.000Z'));
    expect(result[0]?.initials).toBe('OLD');
    expect(result[1]?.initials).toBe('NEW');
  });

  it('puts a tie-score candidate BEFORE the existing entry if its submittedAt is earlier', () => {
    const board = [entry(80, 'LATER', '2026-05-23T00:00:00.000Z')];
    const result = insertEntry(board, entry(80, 'EARLY', '2026-01-01T00:00:00.000Z'));
    expect(result[0]?.initials).toBe('EARLY');
    expect(result[1]?.initials).toBe('LATER');
  });

  it('truncates to MAX_ENTRIES', () => {
    const full = Array.from({ length: LEADERBOARD_MAX_ENTRIES }, (_, i) =>
      entry(LEADERBOARD_MAX_ENTRIES * 100 - i * 100),
    );
    const result = insertEntry(full, entry(LEADERBOARD_MAX_ENTRIES * 100 + 1, 'TOP'));
    expect(result.length).toBe(LEADERBOARD_MAX_ENTRIES);
    expect(result[0]?.initials).toBe('TOP');
  });

  it('evicts the lowest-score entry when full', () => {
    const full = Array.from({ length: LEADERBOARD_MAX_ENTRIES }, (_, i) =>
      entry(1000 - i, `R${i.toString().padStart(2, '0').slice(-2)}`),
    );
    // bottom entry has score 1000 - (MAX-1)
    const before = full[full.length - 1]!;
    const result = insertEntry(full, entry(9999, 'WIN'));
    expect(result.find((e) => e.initials === before.initials && e.score === before.score)).toBeUndefined();
    expect(result.find((e) => e.initials === 'WIN')).toBeDefined();
  });
});

describe('cracksTopN', () => {
  it('returns true for an empty board', () => {
    expect(cracksTopN([], { score: 1 })).toBe(true);
  });

  it('returns true when there is room', () => {
    const board = [entry(100), entry(80)];
    expect(cracksTopN(board, { score: 1 })).toBe(true);
  });

  it('returns true when full and score > bottom', () => {
    const full = Array.from({ length: LEADERBOARD_MAX_ENTRIES }, (_, i) => entry(1000 - i));
    // bottom score = 1000 - 19 = 981
    expect(cracksTopN(full, { score: 982 })).toBe(true);
  });

  it('returns false when full and score == bottom', () => {
    const full = Array.from({ length: LEADERBOARD_MAX_ENTRIES }, (_, i) => entry(1000 - i));
    expect(cracksTopN(full, { score: 981 })).toBe(false);
  });

  it('returns false when full and score < bottom', () => {
    const full = Array.from({ length: LEADERBOARD_MAX_ENTRIES }, (_, i) => entry(1000 - i));
    expect(cracksTopN(full, { score: 100 })).toBe(false);
  });
});
