import { LEADERBOARD_MAX_ENTRIES } from '../shared/config';
import type { LeaderboardEntry } from '../shared/leaderboard-types';

/**
 * Returns true iff a run that ended with the given score should prompt
 * the player to submit. The predicate is local — the server is the
 * authority and may reject the submission for other reasons.
 *
 * Rules:
 *   - score === 0 never prompts (asking for initials on a 0-score is bad UX
 *     even on a completely empty board).
 *   - score > 0 + board has < MAX_ENTRIES entries → prompt.
 *   - score > 0 + board is full + score > 20th place's score → prompt.
 *   - otherwise → no prompt.
 */
export function shouldPromptForSubmission(
  board: readonly LeaderboardEntry[],
  runScore: number,
): boolean {
  if (runScore <= 0) return false;
  if (board.length < LEADERBOARD_MAX_ENTRIES) return true;
  const cutoff = board[board.length - 1];
  if (!cutoff) return true; // unreachable but keeps TS happy under noUncheckedIndexedAccess
  return runScore > cutoff.score;
}
