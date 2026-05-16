export type Lane = 'left' | 'centre' | 'right';
export type Direction = 'left' | 'right';
export type InputSource = 'keyboard' | 'touch';
export type RunState = 'pre-run' | 'running' | 'paused' | 'game-over';

export type ObstacleVariantId =
  | 'cube'
  | 'pillar'
  | 'cylinder'
  | 'sphere'
  | 'trapezoid-prism'
  | 'wide-bar';

export type ObstacleColorVariant = 'red' | 'blue' | 'green';

export interface InputEvent {
  readonly direction: Direction;
  readonly source: InputSource;
  readonly timestampMs: number;
}

export interface PlayerState {
  readonly currentLane: Lane;
  readonly targetLane: Lane | null;
  readonly animProgress: number;
  readonly bufferedInput: Direction | null;
}

export interface WorldState {
  readonly runState: RunState;
  readonly speedUnitsPerSec: number;
  readonly distanceUnits: number;
  readonly tickMs: number;
}

/**
 * A single obstacle placed on the track. `worldZ` and `previousWorldZ` are
 * mutated each frame by the game-loop as the world scrolls; `id`, `variant`,
 * and `blockedLanes` are stable for the obstacle's lifetime.
 */
export interface ObstacleGroup {
  readonly id: number;
  readonly variant: ObstacleVariantId;
  readonly colorVariant: ObstacleColorVariant;
  readonly blockedLanes: readonly Lane[];
  worldZ: number;
  previousWorldZ: number;
}
