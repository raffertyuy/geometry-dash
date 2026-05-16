import type {
  Lane,
  ObstacleGroup,
  PlayerState,
} from '../shared/types';

/**
 * The lane the player is treated as occupying for collision purposes, taking
 * the in-flight lane-change animation into account. Source lane while
 * animProgress < 0.5; target lane from 0.5 onward. Idle players are simply
 * in their currentLane.
 */
export function effectiveLane(player: PlayerState): Lane {
  if (player.targetLane !== null && player.animProgress >= 0.5) {
    return player.targetLane;
  }
  return player.currentLane;
}

/**
 * True iff the obstacle has just crossed the player's z plane this frame AND
 * the player's effective lane is in the obstacle's blocked-lane set.
 *
 * Coordinate convention: obstacles spawn at large negative z (far ahead of
 * the player along the track), then their worldZ INCREASES each frame as
 * the world scrolls toward the camera. Player is at z=0. An obstacle "just
 * crossed" means previousWorldZ < 0 (was ahead of the player last frame)
 * AND worldZ >= 0 (is at or past the player this frame).
 */
export function collidesAt(player: PlayerState, group: ObstacleGroup): boolean {
  if (group.worldZ < 0 || group.previousWorldZ >= 0) return false;
  const lane = effectiveLane(player);
  if (!group.blockedLanes.includes(lane)) return false;
  console.debug({
    event: 'collision_detected',
    playerLane: lane,
    obstacleId: group.id,
    blockedLanes: group.blockedLanes,
  });
  return true;
}
