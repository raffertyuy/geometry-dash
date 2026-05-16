import { RUN_SPEED_UNITS_PER_SEC } from '../shared/config';
import type { WorldState } from '../shared/types';

export function createWorldState(): WorldState {
  return {
    runState: 'pre-run',
    speedUnitsPerSec: RUN_SPEED_UNITS_PER_SEC,
    distanceUnits: 0,
    tickMs: 0,
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
  };
}
