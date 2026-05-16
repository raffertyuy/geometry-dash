import {
  ESCALATION_SPEED_MULTIPLIER_PER_TIER,
  ESCALATION_TIER_DURATION_MS,
} from '../shared/config';

/**
 * Pure derivations from `WorldState.tickMs` that drive the per-tier
 * difficulty escalation. The tier is shared by both the run-speed scaling
 * (handled by the game-loop via tickWorld's optional speedOverride
 * parameter) and the score-per-tick scaling (handled inside src/score/
 * computeScore).
 *
 * No state of its own - pause / resume / restart behaviour comes for free
 * because tickMs already freezes outside of the 'running' state.
 *
 * The tier duration and speed multiplier per tier are configurable via
 * src/shared/config.ts; see ESCALATION_TIER_DURATION_MS and
 * ESCALATION_SPEED_MULTIPLIER_PER_TIER.
 */

/**
 * The current difficulty tier (a non-negative integer) derived from
 * elapsed running time. Tier 0: tickMs in [0, ESCALATION_TIER_DURATION_MS).
 * Tier 1: [ESCALATION_TIER_DURATION_MS, 2 * ESCALATION_TIER_DURATION_MS).
 * And so on indefinitely.
 */
export function currentTier(tickMs: number): number {
  return Math.floor(tickMs / ESCALATION_TIER_DURATION_MS);
}

/**
 * The run-speed multiplier for a given tier. Compounds
 * ESCALATION_SPEED_MULTIPLIER_PER_TIER per tier:
 *   speedMultiplier(0) === 1
 *   speedMultiplier(1) === ESCALATION_SPEED_MULTIPLIER_PER_TIER
 *   speedMultiplier(2) === ESCALATION_SPEED_MULTIPLIER_PER_TIER^2
 *   ...
 *
 * No upper bound is enforced.
 */
export function speedMultiplier(tier: number): number {
  return Math.pow(ESCALATION_SPEED_MULTIPLIER_PER_TIER, tier);
}
