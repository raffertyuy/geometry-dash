import type { Lane } from './types';

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

function readDebugFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

export const DEBUG: boolean = readDebugFlag();
