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
 *   - 'highlighted' → PB matches an entry in the board AND that entry's
 *                     initials match the player's last-used initials.
 *   - 'pinned'      → PB exists but is not visible in the top-N (or the
 *                     initials don't match a top-N entry); render a
 *                     separate "Your best" row above the board.
 *
 * The (initials, score, timeMs) triple is the highlight key. If the player
 * has been changing initials each run, only the most-recent submitted run
 * shows as "yours" — intentional, per data-model §2.
 */
export function derivePersonalBestSurface(
  board: readonly LeaderboardEntry[],
  personalBest: PersonalBest | null,
  lastInitials: string,
): PersonalBestSurface {
  if (personalBest === null) return { kind: 'absent' };

  const matchIndex = board.findIndex(
    (entry) =>
      entry.score === personalBest.score &&
      entry.timeMs === personalBest.timeMs &&
      entry.initials === lastInitials,
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
