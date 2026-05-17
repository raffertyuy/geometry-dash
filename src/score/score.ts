import {
  ESCALATION_SCORE_INCREMENT_PER_TIER,
  ESCALATION_TIER_DURATION_MS,
} from '../shared/config';

/**
 * Pure derivations from the runner-engine's `WorldState.tickMs`. No state of
 * their own - pause / resume / reset behaviour comes for free from the
 * runner-engine, which already pauses tickMs accumulation on blur.
 *
 * Tier-related values are configurable via src/shared/config.ts; see
 * ESCALATION_TIER_DURATION_MS and ESCALATION_SCORE_INCREMENT_PER_TIER.
 */

const SCORE_TICK_MS = 100;
const BASE_SCORE_RATE = 1; // points per 100 ms in tier 0
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MM_SS_THRESHOLD_MINUTES = 10;

/**
 * Integer score derived from elapsed running time PLUS an optional signed
 * scoreDelta from answer-driven events. Piecewise-linear in tickMs: each
 * 100 ms tick within tier N contributes
 *   BASE_SCORE_RATE + N * ESCALATION_SCORE_INCREMENT_PER_TIER
 * points. A fully completed tier N contributes
 *   ticksPerTier * (BASE_SCORE_RATE + N * INCREMENT)
 * points, where `ticksPerTier = ESCALATION_TIER_DURATION_MS / 100`.
 *
 * Cumulative tick-derived score at time `tickMs` is the closed-form sum:
 *   N         = floor(tickMs / ESCALATION_TIER_DURATION_MS)
 *   completed = ticksPerTier * (N + INCREMENT * N * (N - 1) / 2)
 *   current   = floor((tickMs - N * ESCALATION_TIER_DURATION_MS) / 100)
 *               * (BASE_SCORE_RATE + N * INCREMENT)
 *   tickScore = completed + current
 *   total     = tickScore + scoreDelta
 *
 * `scoreDelta` is the signed running sum of answer-driven changes from
 * problem gates (+/-1000/5000/10000). With `scoreDelta` omitted or 0 the
 * function returns the pure tick-derived value (behaviour unchanged from
 * slice 004). The tick-derived component is ALWAYS additive — only
 * `scoreDelta` can drive the total below zero (per spec FR-014).
 *
 * For the spec's default config (TIER=30_000 ms, INCREMENT=1, base=1):
 *   computeScore(0)              -> 0
 *   computeScore(30_000)         -> 300
 *   computeScore(60_000)         -> 900
 *   computeScore(10_000, 1000)   -> 1100  (tier 0 + correct B answer)
 *   computeScore(10_000, -5000)  -> -4900 (tier 0 + wrong M answer)
 */
export function computeScore(tickMs: number, scoreDelta = 0): number {
  const ticksPerTier = ESCALATION_TIER_DURATION_MS / SCORE_TICK_MS;
  const N = Math.floor(tickMs / ESCALATION_TIER_DURATION_MS);
  const completed =
    ticksPerTier *
    (N * BASE_SCORE_RATE +
      (ESCALATION_SCORE_INCREMENT_PER_TIER * N * (N - 1)) / 2);
  const currentRate = BASE_SCORE_RATE + N * ESCALATION_SCORE_INCREMENT_PER_TIER;
  const currentTicks = Math.floor(
    (tickMs - N * ESCALATION_TIER_DURATION_MS) / SCORE_TICK_MS,
  );
  return completed + currentTicks * currentRate + scoreDelta;
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
