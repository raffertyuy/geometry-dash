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

export function tickWorld(world: WorldState, dtMs: number): WorldState {
  if (world.runState !== 'running') return world;
  return {
    ...world,
    tickMs: world.tickMs + dtMs,
    distanceUnits: world.distanceUnits + (dtMs * world.speedUnitsPerSec) / 1000,
  };
}
