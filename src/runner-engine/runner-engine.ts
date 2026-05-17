import {
  INVINCIBILITY_DURATION_MS,
  MAX_LIVES,
  RUN_SPEED_UNITS_PER_SEC,
} from '../shared/config';
import type { ProblemGate, WorldState } from '../shared/types';

export function createWorldState(): WorldState {
  return {
    runState: 'pre-run',
    speedUnitsPerSec: RUN_SPEED_UNITS_PER_SEC,
    distanceUnits: 0,
    tickMs: 0,
    lives: MAX_LIVES,
    invincibilityRemainingMs: 0,
    scoreDelta: 0,
    activeGate: null,
  };
}

export function startRun(world: WorldState): WorldState {
  if (world.runState === 'running') return world;
  if (world.runState === 'paused') return world; // use resumeRun instead
  console.debug({ event: 'run_started' });
  return { ...world, runState: 'running' };
}

export function pauseRun(world: WorldState): WorldState {
  if (world.runState !== 'running') return world;
  console.debug({
    event: 'run_paused',
    tickMs: world.tickMs,
    distanceUnits: world.distanceUnits,
  });
  return { ...world, runState: 'paused' };
}

export function resumeRun(world: WorldState): WorldState {
  if (world.runState !== 'paused') return world;
  console.debug({ event: 'run_resumed', tickMs: world.tickMs });
  return { ...world, runState: 'running' };
}

/**
 * Advances the world one frame. `speedOverride`, when supplied, replaces
 * `world.speedUnitsPerSec` for the distance calculation only - the returned
 * WorldState's `speedUnitsPerSec` is unchanged. Used by the game-loop to
 * apply the tier-multiplied effective speed each frame without mutating the
 * stored baseline.
 *
 * The `runState === 'running'` guard always applies; a paused or game-over
 * world does not advance regardless of the override.
 */
export function tickWorld(
  world: WorldState,
  dtMs: number,
  speedOverride?: number,
): WorldState {
  if (world.runState !== 'running') return world;
  const speed = speedOverride ?? world.speedUnitsPerSec;
  return {
    ...world,
    tickMs: world.tickMs + dtMs,
    distanceUnits: world.distanceUnits + (dtMs * speed) / 1000,
  };
}

export function endRun(world: WorldState): WorldState {
  if (world.runState !== 'running') return world;
  console.debug({
    event: 'run_ended',
    tickMs: world.tickMs,
    distanceUnits: world.distanceUnits,
  });
  return { ...world, runState: 'game-over' };
}

export function restartRun(world: WorldState): WorldState {
  console.debug({ event: 'run_restarted' });
  return {
    runState: 'running',
    speedUnitsPerSec: world.speedUnitsPerSec,
    distanceUnits: 0,
    tickMs: 0,
    lives: MAX_LIVES,
    invincibilityRemainingMs: 0,
    scoreDelta: 0,
    activeGate: null,
  };
}

/**
 * Transitions running -> answering and stores the active gate identity
 * on the world. Called by the game-loop when a problem-gate collision
 * fires (outside the invincibility window). The world is frozen while
 * runState === 'answering' (tickWorld no-ops in that state).
 */
export function enterAnswering(
  world: WorldState,
  gate: ProblemGate,
): WorldState {
  if (world.runState !== 'running') return world;
  return {
    ...world,
    runState: 'answering',
    activeGate: {
      gateId: gate.id,
      difficulty: gate.difficulty,
      problem: gate.problem,
    },
  };
}

/**
 * Decrements `lives` by 1 and (for `cause === 'obstacle'`) grants a fresh
 * 3-second invincibility window. Transitions to 'game-over' when the
 * decrement drives lives to zero. The cause is also threaded into the
 * `run_ended` payload so observability can distinguish obstacle deaths
 * from wrong-answer deaths.
 *
 * Callers should check `world.invincibilityRemainingMs === 0` before
 * invoking for an obstacle collision; this function does not re-guard.
 */
export function consumeLife(
  world: WorldState,
  cause: 'obstacle' | 'wrong-answer',
): WorldState {
  if (world.lives <= 0) return world; // already game-over; no double-decrement
  const livesAfter = world.lives - 1;
  if (livesAfter === 0) {
    console.debug({ event: 'life_consumed', cause, livesAfter });
    console.debug({ event: 'run_ended', cause, tickMs: world.tickMs });
    return {
      ...world,
      lives: 0,
      runState: 'game-over',
      invincibilityRemainingMs: 0,
    };
  }
  const setInvincibility = cause === 'obstacle';
  console.debug({ event: 'life_consumed', cause, livesAfter });
  if (setInvincibility) {
    console.debug({
      event: 'invincibility_started',
      durationMs: INVINCIBILITY_DURATION_MS,
    });
  }
  return {
    ...world,
    lives: livesAfter,
    invincibilityRemainingMs: setInvincibility
      ? INVINCIBILITY_DURATION_MS
      : world.invincibilityRemainingMs,
  };
}

/**
 * Resolves an answer-modal commit: writes the signed scoreDelta and
 * (on wrong) consumes one life via `consumeLife('wrong-answer')`. The
 * lives-zero path transitions to 'game-over' inside consumeLife; the
 * score-below-zero game-over rule (spec FR-013 condition b) is checked
 * by the game-loop after this returns, since it requires `computeScore`
 * from the score module.
 */
export function resolveAnswer(
  world: WorldState,
  isCorrect: boolean,
  points: number,
): WorldState {
  if (world.runState !== 'answering') return world;
  const newScoreDelta = world.scoreDelta + (isCorrect ? points : -points);
  const activeGateAtCommit = world.activeGate;
  let next: WorldState = {
    ...world,
    scoreDelta: newScoreDelta,
    activeGate: null,
    runState: 'running',
  };
  if (!isCorrect) {
    next = consumeLife(next, 'wrong-answer');
    // consumeLife may transition to 'game-over' when lives reaches 0.
  }
  console.debug({
    event: 'gate_answered',
    id: activeGateAtCommit?.gateId,
    difficulty: activeGateAtCommit?.difficulty,
    isCorrect,
    scoreDelta: next.scoreDelta,
    livesAfter: next.lives,
  });
  return next;
}

/**
 * Counts the invincibility timer down by `dtMs`, clamped to >= 0. No-op
 * outside 'running' (so the timer effectively pauses while the modal is
 * open and during tab-blur). Emits an `invincibility_ended` event on the
 * first frame it transitions from > 0 to 0.
 */
export function tickInvincibility(
  world: WorldState,
  dtMs: number,
): WorldState {
  if (world.runState !== 'running') return world;
  if (world.invincibilityRemainingMs <= 0) return world;
  const newRemaining = Math.max(0, world.invincibilityRemainingMs - dtMs);
  if (newRemaining === 0) {
    console.debug({ event: 'invincibility_ended', tickMs: world.tickMs });
  }
  return { ...world, invincibilityRemainingMs: newRemaining };
}
