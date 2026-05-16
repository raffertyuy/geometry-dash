import {
  SWIPE_HORIZONTAL_DOMINANCE,
  SWIPE_MAX_DURATION_MS,
  SWIPE_MIN_HORIZONTAL_PX,
} from '../shared/config';
import type { Direction } from '../shared/types';

export interface SwipePoint {
  readonly x: number;
  readonly y: number;
  readonly tMs: number;
}

export function detectSwipe(start: SwipePoint, end: SwipePoint): Direction | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dt = end.tMs - start.tMs;

  if (dt > SWIPE_MAX_DURATION_MS) return null;
  if (Math.abs(dx) < SWIPE_MIN_HORIZONTAL_PX) return null;
  if (Math.abs(dx) < SWIPE_HORIZONTAL_DOMINANCE * Math.abs(dy)) return null;

  return dx > 0 ? 'right' : 'left';
}
