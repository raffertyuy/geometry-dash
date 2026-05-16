import { OBSTACLE_VARIANTS } from './obstacle-catalogue';
import {
  OBSTACLES_INITIAL_SPAWN_Z,
  OBSTACLES_MAX_GAP,
  OBSTACLES_MIN_GAP,
  OBSTACLES_SINGLE_LANE_PROBABILITY,
} from '../shared/config';
import type {
  Lane,
  ObstacleColorVariant,
  ObstacleGroup,
  ObstacleVariantId,
} from '../shared/types';

const COLOR_VARIANTS: readonly ObstacleColorVariant[] = ['red', 'blue', 'green'];

export interface ObstacleSpawnSchedule {
  readonly nextSpawnDistance: number;
  readonly seed: number;
  readonly lastSpawnedId: number;
}

/**
 * Pure single-step mulberry32 PRNG. Given a seed, returns the next pseudo-
 * random value in [0, 1) AND the seed to use for the next draw. Inline so
 * the obstacles module stays dependency-free.
 */
function mulberry32Step(seed: number): { value: number; nextSeed: number } {
  const s = (seed + 0x6d2b79f5) | 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return {
    value: ((t ^ (t >>> 14)) >>> 0) / 4294967296,
    nextSeed: s,
  };
}

const SINGLE_LANES: readonly Lane[] = ['left', 'centre', 'right'];
const ADJACENT_TWO_LANE_PAIRS: readonly (readonly Lane[])[] = [
  ['left', 'centre'],
  ['centre', 'right'],
];

export function createSpawnSchedule(initialSeed: number): ObstacleSpawnSchedule {
  return {
    nextSpawnDistance: 0,
    seed: initialSeed,
    lastSpawnedId: 0,
  };
}

/**
 * Pure function that derives the next obstacle group from a schedule and
 * returns the advanced schedule. Caller threads the new schedule into the
 * next call.
 */
export function nextObstacleGroup(
  schedule: ObstacleSpawnSchedule,
): { group: ObstacleGroup; schedule: ObstacleSpawnSchedule } {
  // 4 random draws: gap size, lane count, lane choice, variant choice.
  const r1 = mulberry32Step(schedule.seed);
  const gap =
    OBSTACLES_MIN_GAP + r1.value * (OBSTACLES_MAX_GAP - OBSTACLES_MIN_GAP);

  const r2 = mulberry32Step(r1.nextSeed);
  const laneCount: 1 | 2 = r2.value < OBSTACLES_SINGLE_LANE_PROBABILITY ? 1 : 2;

  const r3 = mulberry32Step(r2.nextSeed);
  let blockedLanes: readonly Lane[];
  if (laneCount === 1) {
    const idx = Math.min(
      SINGLE_LANES.length - 1,
      Math.floor(r3.value * SINGLE_LANES.length),
    );
    blockedLanes = [SINGLE_LANES[idx]!];
  } else {
    const idx = Math.min(
      ADJACENT_TWO_LANE_PAIRS.length - 1,
      Math.floor(r3.value * ADJACENT_TWO_LANE_PAIRS.length),
    );
    blockedLanes = ADJACENT_TWO_LANE_PAIRS[idx]!;
  }

  const r4 = mulberry32Step(r3.nextSeed);
  const candidates: ObstacleVariantId[] = [];
  for (const id of Object.keys(OBSTACLE_VARIANTS) as ObstacleVariantId[]) {
    if (OBSTACLE_VARIANTS[id].laneCount === laneCount) candidates.push(id);
  }
  const variantIdx = Math.min(
    candidates.length - 1,
    Math.floor(r4.value * candidates.length),
  );
  const variant = candidates[variantIdx]!;

  const r5 = mulberry32Step(r4.nextSeed);
  const colorIdx = Math.min(
    COLOR_VARIANTS.length - 1,
    Math.floor(r5.value * COLOR_VARIANTS.length),
  );
  const colorVariant = COLOR_VARIANTS[colorIdx]!;

  const id = schedule.lastSpawnedId + 1;
  const group: ObstacleGroup = {
    id,
    variant,
    colorVariant,
    blockedLanes,
    worldZ: OBSTACLES_INITIAL_SPAWN_Z,
    previousWorldZ: OBSTACLES_INITIAL_SPAWN_Z,
  };

  console.debug({
    event: 'obstacle_spawned',
    id,
    variant,
    colorVariant,
    blockedLanes,
    worldZ: group.worldZ,
  });

  return {
    group,
    schedule: {
      nextSpawnDistance: schedule.nextSpawnDistance + gap,
      seed: r5.nextSeed,
      lastSpawnedId: id,
    },
  };
}
