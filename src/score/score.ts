/**
 * Pure derivations from the runner-engine's `WorldState.tickMs`. No state of
 * their own - pause / resume / reset behaviour comes for free from the
 * runner-engine, which already pauses tickMs accumulation on blur.
 */

const SCORE_TICK_MS = 100;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MM_SS_THRESHOLD_MINUTES = 10;

/**
 * Integer score derived from elapsed running time. Increments by one for
 * every full 100 ms of tickMs.
 *
 * Examples:
 *   computeScore(0)   -> 0
 *   computeScore(99)  -> 0
 *   computeScore(100) -> 1
 *   computeScore(10_000) -> 100
 */
export function computeScore(tickMs: number): number {
  return Math.floor(tickMs / SCORE_TICK_MS);
}

/**
 * Display formatting for the score. Currently a simple `String(score)` with
 * no thousands separators. Locale-aware formatting can swap in here without
 * touching call sites.
 */
export function formatScore(score: number): string {
  return String(score);
}

/**
 * Formatted timer string derived from elapsed running time.
 *
 *   M:SS  while minutes < 10 (e.g. "0:00", "0:42", "9:59")
 *   MM:SS at and beyond 10 minutes (e.g. "10:00", "99:59", "100:00")
 *
 * No decimals, no hour rollover - minutes just keep counting.
 */
export function formatTimer(tickMs: number): string {
  const totalSeconds = Math.floor(tickMs / MS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const secondsStr = seconds < 10 ? `0${seconds}` : String(seconds);
  const minutesStr =
    minutes < MM_SS_THRESHOLD_MINUTES ? String(minutes) : String(minutes);
  return `${minutesStr}:${secondsStr}`;
}
