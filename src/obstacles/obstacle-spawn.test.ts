import { describe, expect, it } from 'vitest';
import { createSpawnSchedule, nextObstacleGroup } from './obstacle-spawn';
import { OBSTACLE_VARIANTS } from './obstacle-catalogue';
import {
  OBSTACLES_INITIAL_SPAWN_Z,
  OBSTACLES_MAX_GAP,
  OBSTACLES_MIN_GAP,
} from '../shared/config';
import type { Lane } from '../shared/types';

const SEED = 12345;

describe('createSpawnSchedule', () => {
  it('returns an initial schedule with the seed and the documented defaults', () => {
    const s = createSpawnSchedule(SEED);
    expect(s.seed).toBe(SEED);
    expect(s.nextSpawnDistance).toBe(0);
    expect(s.lastSpawnedId).toBe(0);
  });
});

describe('nextObstacleGroup determinism', () => {
  it('with a fixed seed, two independent runs produce the same sequence', () => {
    const a = createSpawnSchedule(SEED);
    const b = createSpawnSchedule(SEED);

    let sa = a;
    let sb = b;
    for (let i = 0; i < 50; i++) {
      const ra = nextObstacleGroup(sa);
      const rb = nextObstacleGroup(sb);
      expect(ra.group.variant).toBe(rb.group.variant);
      expect(ra.group.blockedLanes).toEqual(rb.group.blockedLanes);
      expect(ra.group.worldZ).toBe(rb.group.worldZ);
      expect(ra.schedule.nextSpawnDistance).toBe(rb.schedule.nextSpawnDistance);
      sa = ra.schedule;
      sb = rb.schedule;
    }
  });
});

describe('nextObstacleGroup gap bounds', () => {
  it('every gap between consecutive nextSpawnDistance values is in [MIN, MAX]', () => {
    let schedule = createSpawnSchedule(SEED);
    let previousDistance = schedule.nextSpawnDistance;
    for (let i = 0; i < 1000; i++) {
      const result = nextObstacleGroup(schedule);
      const gap = result.schedule.nextSpawnDistance - previousDistance;
      expect(gap).toBeGreaterThanOrEqual(OBSTACLES_MIN_GAP);
      expect(gap).toBeLessThanOrEqual(OBSTACLES_MAX_GAP);
      previousDistance = result.schedule.nextSpawnDistance;
      schedule = result.schedule;
    }
  });
});

describe('nextObstacleGroup lane-mask invariants', () => {
  it('blockedLanes.length is always 1 or 2 (never 0, never 3)', () => {
    let schedule = createSpawnSchedule(SEED);
    for (let i = 0; i < 1000; i++) {
      const { group, schedule: nextSchedule } = nextObstacleGroup(schedule);
      expect([1, 2]).toContain(group.blockedLanes.length);
      schedule = nextSchedule;
    }
  });

  it('two-lane masks are always adjacent: left+centre OR centre+right, never left+right', () => {
    const validTwoLane: readonly (readonly Lane[])[] = [
      ['left', 'centre'],
      ['centre', 'right'],
    ];
    let schedule = createSpawnSchedule(SEED);
    let twoLaneCount = 0;
    for (let i = 0; i < 1000; i++) {
      const { group, schedule: nextSchedule } = nextObstacleGroup(schedule);
      if (group.blockedLanes.length === 2) {
        twoLaneCount++;
        const isValid = validTwoLane.some(
          (pair) =>
            pair.length === group.blockedLanes.length &&
            pair.every((l, idx) => l === group.blockedLanes[idx]),
        );
        expect(isValid).toBe(true);
      }
      schedule = nextSchedule;
    }
    // Sanity: we did encounter some two-lane groups (single-lane prob is 0.8,
    // so ~200 two-lane in 1000 draws).
    expect(twoLaneCount).toBeGreaterThan(50);
  });

  it("variant.laneCount always matches blockedLanes.length", () => {
    let schedule = createSpawnSchedule(SEED);
    for (let i = 0; i < 1000; i++) {
      const { group, schedule: nextSchedule } = nextObstacleGroup(schedule);
      const variant = OBSTACLE_VARIANTS[group.variant];
      expect(variant.laneCount).toBe(group.blockedLanes.length);
      schedule = nextSchedule;
    }
  });

  it('colorVariant is always one of red / blue / green', () => {
    let schedule = createSpawnSchedule(SEED);
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const { group, schedule: nextSchedule } = nextObstacleGroup(schedule);
      expect(['red', 'blue', 'green']).toContain(group.colorVariant);
      seen.add(group.colorVariant);
      schedule = nextSchedule;
    }
    // Sanity: across 1000 draws we should see all three colours at least once.
    expect(seen.has('red')).toBe(true);
    expect(seen.has('blue')).toBe(true);
    expect(seen.has('green')).toBe(true);
  });
});

describe('nextObstacleGroup worldZ', () => {
  it('every newly spawned obstacle is initialised at OBSTACLES_INITIAL_SPAWN_Z', () => {
    let schedule = createSpawnSchedule(SEED);
    for (let i = 0; i < 50; i++) {
      const { group, schedule: nextSchedule } = nextObstacleGroup(schedule);
      expect(group.worldZ).toBe(OBSTACLES_INITIAL_SPAWN_Z);
      expect(group.previousWorldZ).toBe(OBSTACLES_INITIAL_SPAWN_Z);
      schedule = nextSchedule;
    }
  });

  it('lastSpawnedId is monotonically increasing', () => {
    let schedule = createSpawnSchedule(SEED);
    let lastId = 0;
    for (let i = 0; i < 50; i++) {
      const { group, schedule: nextSchedule } = nextObstacleGroup(schedule);
      expect(group.id).toBe(lastId + 1);
      expect(nextSchedule.lastSpawnedId).toBe(group.id);
      lastId = group.id;
      schedule = nextSchedule;
    }
  });
});
