import { describe, expect, it } from 'vitest';
import { OBSTACLE_VARIANTS } from './obstacle-catalogue';
import type { ObstacleVariantId } from '../shared/types';

const ALL_IDS: readonly ObstacleVariantId[] = [
  'cube',
  'pillar',
  'cylinder',
  'sphere',
  'trapezoid-prism',
  'wide-bar',
];

describe('OBSTACLE_VARIANTS catalogue', () => {
  it('contains an entry for every ObstacleVariantId in the union', () => {
    for (const id of ALL_IDS) {
      expect(OBSTACLE_VARIANTS[id]).toBeDefined();
    }
  });

  it('has matching id and key for every entry', () => {
    for (const id of ALL_IDS) {
      expect(OBSTACLE_VARIANTS[id].id).toBe(id);
    }
  });

  it('every laneCount is either 1 or 2', () => {
    for (const id of ALL_IDS) {
      const lc = OBSTACLE_VARIANTS[id].laneCount;
      expect([1, 2]).toContain(lc);
    }
  });

  it('has exactly one two-lane variant (wide-bar)', () => {
    const twoLaneIds = ALL_IDS.filter(
      (id) => OBSTACLE_VARIANTS[id].laneCount === 2,
    );
    expect(twoLaneIds).toEqual(['wide-bar']);
  });

  it('has exactly five single-lane variants', () => {
    const singleLaneIds = ALL_IDS.filter(
      (id) => OBSTACLE_VARIANTS[id].laneCount === 1,
    );
    expect(singleLaneIds).toHaveLength(5);
    expect(singleLaneIds).toEqual(
      expect.arrayContaining(['cube', 'pillar', 'cylinder', 'sphere', 'trapezoid-prism']),
    );
  });
});
