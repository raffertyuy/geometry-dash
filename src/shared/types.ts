export type Lane = 'left' | 'centre' | 'right';
export type Direction = 'left' | 'right';
export type InputSource = 'keyboard' | 'touch';
export type RunState =
  | 'pre-run'
  | 'running'
  | 'paused'
  | 'answering'
  | 'game-over';

export type ObstacleVariantId =
  | 'cube'
  | 'pillar'
  | 'cylinder'
  | 'sphere'
  | 'trapezoid-prism'
  | 'wide-bar';

export type ObstacleColorVariant = 'red' | 'blue' | 'green';

export type GateDifficulty = 'B' | 'M' | 'A';

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

export interface AnswerChoice {
  readonly text: string;
}

/**
 * Outcome the problem-gate modal reports to its caller. `pick` carries the
 * player's chosen index; `timeout` means the per-question countdown reached
 * zero with no pick — the game-loop treats it identically to a wrong pick.
 */
export type AnswerResult =
  | { readonly kind: 'pick'; readonly choiceIndex: 0 | 1 | 2 }
  | { readonly kind: 'timeout' };

export interface Problem {
  readonly id: string;
  readonly difficulty: GateDifficulty;
  readonly prompt: string;
  readonly choices: readonly [AnswerChoice, AnswerChoice, AnswerChoice];
  readonly correctIndex: 0 | 1 | 2;
  /** Inline SVG markup for templated M/A problems with geometric figures.
      Optional: undefined for B problems and for templates without figures. */
  readonly figure?: string;
  /** Source identifier matching a ProblemSource.id, for CC-BY-curated B problems. */
  readonly sourceRef?: string;
}

/**
 * A single-lane collidable that, when struck, opens the problem modal.
 * Mirrors the ObstacleGroup mutation pattern: `id`, `difficulty`, `lane`,
 * and `problem` are stable for the gate's lifetime; `worldZ` and
 * `previousWorldZ` are mutated each frame by the game-loop as the world
 * scrolls toward the camera.
 */
export interface ProblemGate {
  readonly id: number;
  readonly difficulty: GateDifficulty;
  readonly lane: Lane;
  readonly problem: Problem;
  worldZ: number;
  previousWorldZ: number;
}

/**
 * Payload stored on WorldState while runState === 'answering'. Captures
 * the gate identity + the problem the player must answer. Cleared back
 * to null when the run transitions out of 'answering'.
 */
export interface ActiveGateRef {
  readonly gateId: number;
  readonly difficulty: GateDifficulty;
  readonly problem: Problem;
}

export interface WorldState {
  readonly runState: RunState;
  readonly speedUnitsPerSec: number;
  readonly distanceUnits: number;
  readonly tickMs: number;
  /** 0..MAX_LIVES; decremented by consumeLife; transitions run to 'game-over' at 0. */
  readonly lives: number;
  /** Countdown in milliseconds; > 0 means obstacle AND gate collisions pass harmlessly. */
  readonly invincibilityRemainingMs: number;
  /** Signed running sum of answer-driven point changes. Total score = computeScore(tickMs, scoreDelta). */
  readonly scoreDelta: number;
  /** Populated only while runState === 'answering'; null otherwise. */
  readonly activeGate: ActiveGateRef | null;
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
