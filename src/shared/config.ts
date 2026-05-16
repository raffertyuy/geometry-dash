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

function readDebugFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

export const DEBUG: boolean = readDebugFlag();
