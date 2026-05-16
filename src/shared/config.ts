import type { Lane } from './types';

export const LANES: readonly Lane[] = ['left', 'centre', 'right'] as const;

export const LANE_X: Readonly<Record<Lane, number>> = {
  left: 180,
  centre: 360,
  right: 540,
};

export const LOGICAL_WIDTH = 720;
export const LOGICAL_HEIGHT = 1280;

export const RUN_SPEED_UNITS_PER_SEC = 200;
export const LANE_SWITCH_DURATION_MS = 200;

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
