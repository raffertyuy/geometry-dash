import { describe, expect, it } from 'vitest';
import { LEADERBOARD_MAX_ENTRIES } from '../shared/config';
import { shouldPromptForSubmission } from './gate';
import type { LeaderboardEntry } from '../shared/leaderboard-types';

function entry(score: number, initials = 'AAA'): LeaderboardEntry {
  return { initials, score, timeMs: 1000, submittedAt: '2026-05-23T00:00:00.000Z' };
}

describe('shouldPromptForSubmission', () => {
  it('returns false for score 0 even on an empty board', () => {
    expect(shouldPromptForSubmission([], 0)).toBe(false);
  });

  it('returns false for a negative score', () => {
    expect(shouldPromptForSubmission([], -1)).toBe(false);
  });

  it('returns true for a positive score on an empty board', () => {
    expect(shouldPromptForSubmission([], 1)).toBe(true);
  });

  it('returns true for a positive score when board has fewer than MAX_ENTRIES', () => {
    const board = Array.from({ length: LEADERBOARD_MAX_ENTRIES - 1 }, (_, i) =>
      entry(100 - i),
    );
    expect(shouldPromptForSubmission(board, 50)).toBe(true);
  });

  it('returns true when board is full and score exceeds the bottom entry', () => {
    const board = Array.from({ length: LEADERBOARD_MAX_ENTRIES }, (_, i) =>
      entry(1000 - i * 50),
    );
    // Bottom entry has score 1000 - 19 * 50 = 50.
    expect(shouldPromptForSubmission(board, 51)).toBe(true);
  });

  it('returns false when board is full and score equals the bottom entry', () => {
    const board = Array.from({ length: LEADERBOARD_MAX_ENTRIES }, (_, i) =>
      entry(1000 - i * 50),
    );
    expect(shouldPromptForSubmission(board, 50)).toBe(false);
  });

  it('returns false when board is full and score is less than the bottom entry', () => {
    const board = Array.from({ length: LEADERBOARD_MAX_ENTRIES }, (_, i) =>
      entry(1000 - i * 50),
    );
    expect(shouldPromptForSubmission(board, 49)).toBe(false);
  });
});
