import type { GateDifficulty, Lane } from './types';

export const LANES: readonly Lane[] = ['left', 'centre', 'right'] as const;

// 3D world-space X positions for each lane (Three.js scene coordinates).
// Player size is 1 unit; lane spacing is 2 units, so adjacent lanes do not
// overlap visually.
export const LANE_X: Readonly<Record<Lane, number>> = {
  left: -2,
  centre: 0,
  right: 2,
};

// Forward run speed in world units per second. "Dash" feel - the camera and
// scenery should fly past quickly enough to give the player a sense of urgency.
// Currently tuned for Tron-style sprint feel.
export const RUN_SPEED_UNITS_PER_SEC = 24;

export const LANE_SWITCH_DURATION_MS = 200;

// Touch-swipe thresholds. Pixel-space values (read from raw pointer events),
// not world units - they describe a finger gesture on the screen.
export const SWIPE_MIN_HORIZONTAL_PX = 30;
export const SWIPE_MAX_DURATION_MS = 500;
export const SWIPE_HORIZONTAL_DOMINANCE = 2;
export const INPUT_COALESCE_WINDOW_MS = 50;

// Obstacle tunables. Distances are in world units; OBSTACLES_INITIAL_SPAWN_Z
// places the first obstacle ~1.4 s of running ahead of the player at the
// current RUN_SPEED_UNITS_PER_SEC. MIN_GAP is the smallest acceptable gap
// between successive groups; at the current run speed (24 u/s) and 200 ms
// lane-switch duration, 14 world units is ~583 ms of running time, which
// covers a full two-lane dodge (400 ms) plus ~183 ms of reaction time.
export const OBSTACLES_MIN_GAP = 14;
export const OBSTACLES_MAX_GAP = 28;
export const OBSTACLES_INITIAL_SPAWN_Z = -34;
export const OBSTACLES_SINGLE_LANE_PROBABILITY = 0.8;

// Difficulty-escalation tunables. Three knobs the player progression hangs off.
// At tier N: per-100ms score rate = 1 + N * ESCALATION_SCORE_INCREMENT_PER_TIER.
// At tier N: run speed = baseline * ESCALATION_SPEED_MULTIPLIER_PER_TIER^N.
//
// These are the SPEC DEFAULTS (matching spec.md's success criteria). To
// retune for testing or balancing, edit these three numbers and Vite's HMR
// picks up the change instantly. Example accelerated test config:
//   ESCALATION_TIER_DURATION_MS         = 10_000  (new tier every 10 s)
//   ESCALATION_SCORE_INCREMENT_PER_TIER = 10      (rate jumps by +10 per tier)
//   ESCALATION_SPEED_MULTIPLIER_PER_TIER = 2.0    (speed doubles per tier)
export const ESCALATION_TIER_DURATION_MS = 30_000;
export const ESCALATION_SCORE_INCREMENT_PER_TIER = 1;
export const ESCALATION_SPEED_MULTIPLIER_PER_TIER = 1.10;

// Lives + invincibility tunables. The player begins each run with MAX_LIVES
// hearts; each obstacle collision OR wrong-answer life loss decrements by 1.
// Only obstacle collisions grant the post-respawn invincibility window
// (per spec FR-010/FR-011). Wrong-answer life loss is instantaneous.
export const MAX_LIVES = 3;
export const INVINCIBILITY_DURATION_MS = 3_000;

// Problem-gate scoring. Each gate's reward magnitude doubles as its penalty
// magnitude: correct answer = +N points; wrong answer = -N points AND -1 life.
export const GATE_POINTS_B = 1_000;
export const GATE_POINTS_M = 5_000;
export const GATE_POINTS_A = 10_000;

// Per-question countdown in the gate modal. Difficulty-scaled so harder
// problems get proportionally more thinking time. Timeout routes through
// the existing wrong-answer pipeline (see src/renderer/problem-modal.ts).
export const QUESTION_TIMER_MS_B = 60_000;
export const QUESTION_TIMER_MS_M = 120_000;
export const QUESTION_TIMER_MS_A = 180_000;
export const QUESTION_TIMER_MS_BY_DIFFICULTY: Readonly<
  Record<GateDifficulty, number>
> = {
  B: QUESTION_TIMER_MS_B,
  M: QUESTION_TIMER_MS_M,
  A: QUESTION_TIMER_MS_A,
};

// Threshold (in remaining ms) below which the countdown enters its urgent
// visual state. One-shot — the timer only decreases.
export const QUESTION_TIMER_URGENCY_MS = 10_000;

// Display refresh cadence (Hz=4). Fine enough for M:SS rendering without
// per-frame textContent churn.
export const QUESTION_TIMER_DISPLAY_INTERVAL_MS = 250;

// Per-lane gate distribution. For every non-obstacle lane in a spawned
// obstacle row, the spawner independently samples a uniform value from
// {empty, B, M, A} weighted by these constants. The four values MUST sum
// to 1.0; the spec imposes no balancing constraint, so all-same-difficulty
// rows like A-A-A or all-empty rows are valid output.
export const GATE_LANE_PROBABILITY_EMPTY = 0.25;
export const GATE_LANE_PROBABILITY_B = 0.25;
export const GATE_LANE_PROBABILITY_M = 0.25;
export const GATE_LANE_PROBABILITY_A = 0.25;

if (
  Math.abs(
    GATE_LANE_PROBABILITY_EMPTY +
      GATE_LANE_PROBABILITY_B +
      GATE_LANE_PROBABILITY_M +
      GATE_LANE_PROBABILITY_A -
      1.0,
  ) > 1e-9
) {
  console.warn(
    'GATE_LANE_PROBABILITY_* values do not sum to 1.0; gate-spawn distribution will be biased.',
  );
}

function readDebugFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

export const DEBUG: boolean = readDebugFlag();
