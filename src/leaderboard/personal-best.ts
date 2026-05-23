import type { LeaderboardEntry } from '../shared/leaderboard-types';
import type { PersonalBest, PersonalBestSurface } from './types';

/**
 * True iff this run's score is a new personal best. Ties don't update;
 * the existing record stays so its `achievedAt` reflects the first time
 * the player reached this score.
 */
export function shouldUpdatePersonalBest(
  current: PersonalBest | null,
  runScore: number,
  _runTimeMs: number,
): boolean {
  if (current === null) return runScore > 0;
  return runScore > current.score;
}

/**
 * Decide how to surface the personal best alongside the global board.
 *
 *   - 'absent'      → no PB recorded yet (first-time player on this device).
 *   - 'highlighted' → PB matches an entry in the board on (score, timeMs).
 *                     We highlight the matching row regardless of its
 *                     initials — the player IS represented there, even
 *                     if they've changed initials since submitting that run.
 *   - 'pinned'      → PB exists but is NOT represented in the top-N at
 *                     all (run was never submitted, or it was evicted).
 *                     Render a separate "Your best" row above the board.
 *
 * The match key is (score, timeMs) only — NOT initials. Earlier iterations
 * required all three to match, but that produced a confusing duplicate row
 * whenever the player switched initials between PB-setting and viewing
 * (the pinned row would carry the new initials with the PB's score, sitting
 * directly above the actual same-numbers entry under the old initials).
 * (score, timeMs) is specific enough in practice to avoid false positives
 * — two distinct players sharing identical score AND elapsed-ms is
 * vanishingly unlikely at the resolutions this game uses.
 */
export function derivePersonalBestSurface(
  board: readonly LeaderboardEntry[],
  personalBest: PersonalBest | null,
  lastInitials: string,
): PersonalBestSurface {
  if (personalBest === null) return { kind: 'absent' };

  const matchIndex = board.findIndex(
    (entry) =>
      entry.score === personalBest.score && entry.timeMs === personalBest.timeMs,
  );
  if (matchIndex >= 0) {
    return { kind: 'highlighted', atIndex: matchIndex };
  }

  return {
    kind: 'pinned',
    entry: {
      initials: lastInitials,
      score: personalBest.score,
      timeMs: personalBest.timeMs,
      submittedAt: personalBest.achievedAt,
    },
  };
}
