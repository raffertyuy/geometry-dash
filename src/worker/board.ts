import { LEADERBOARD_MAX_ENTRIES } from '../shared/config';
import type { LeaderboardEntry } from '../shared/leaderboard-types';

/**
 * Insert `candidate` into the sorted board, truncate to MAX_ENTRIES, return
 * the new board. Pure function. Sort: score descending; ties broken by
 * `submittedAt` ascending (earlier wins).
 */
export function insertEntry(
  board: readonly LeaderboardEntry[],
  candidate: LeaderboardEntry,
): readonly LeaderboardEntry[] {
  const next: LeaderboardEntry[] = [...board, candidate].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Ascending by submittedAt → earlier (smaller ISO string lexicographically
    // for properly-formed UTC instants) ranks higher.
    if (a.submittedAt < b.submittedAt) return -1;
    if (a.submittedAt > b.submittedAt) return 1;
    return 0;
  });
  return next.slice(0, LEADERBOARD_MAX_ENTRIES);
}

/** True iff the candidate would crack the current top-N board. */
export function cracksTopN(
  board: readonly LeaderboardEntry[],
  candidate: Pick<LeaderboardEntry, 'score'>,
  maxEntries: number = LEADERBOARD_MAX_ENTRIES,
): boolean {
  if (board.length < maxEntries) return true;
  const cutoff = board[maxEntries - 1];
  if (!cutoff) return true;
  return candidate.score > cutoff.score;
}
