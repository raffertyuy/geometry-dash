import type { ObstacleVariantId } from '../shared/types';

export interface ObstacleVariant {
  readonly id: ObstacleVariantId;
  readonly laneCount: 1 | 2;
}

/**
 * The full set of obstacle visual variants the game can spawn. Each entry
 * declares whether the variant occupies one lane or two adjacent lanes;
 * the spawn generator uses this to filter candidates when picking a shape
 * to match a chosen blocked-lane count.
 *
 * Geometry for each variant lives in the renderer; this module only
 * carries the bookkeeping.
 */
export const OBSTACLE_VARIANTS: Readonly<Record<ObstacleVariantId, ObstacleVariant>> = {
  cube: { id: 'cube', laneCount: 1 },
  pillar: { id: 'pillar', laneCount: 1 },
  cylinder: { id: 'cylinder', laneCount: 1 },
  sphere: { id: 'sphere', laneCount: 1 },
  'trapezoid-prism': { id: 'trapezoid-prism', laneCount: 1 },
  'wide-bar': { id: 'wide-bar', laneCount: 2 },
};
