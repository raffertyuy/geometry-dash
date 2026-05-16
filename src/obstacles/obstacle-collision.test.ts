import { describe, expect, it } from 'vitest';
import { collidesAt, effectiveLane } from './obstacle-collision';
import type {
  Lane,
  ObstacleGroup,
  PlayerState,
} from '../shared/types';

function player(
  currentLane: Lane,
  targetLane: Lane | null = null,
  animProgress = 0,
): PlayerState {
  return {
    currentLane,
    targetLane,
    animProgress,
    bufferedInput: null,
  };
}

function group(
  blockedLanes: readonly Lane[],
  worldZ: number,
  previousWorldZ: number,
): ObstacleGroup {
  return {
    id: 1,
    variant: blockedLanes.length === 2 ? 'wide-bar' : 'cube',
    blockedLanes,
    worldZ,
    previousWorldZ,
  };
}

describe('effectiveLane', () => {
  it('returns currentLane when player is idle (no target)', () => {
    expect(effectiveLane(player('centre'))).toBe('centre');
    expect(effectiveLane(player('left'))).toBe('left');
    expect(effectiveLane(player('right'))).toBe('right');
  });

  it('returns currentLane while animProgress < 0.5', () => {
    expect(effectiveLane(player('centre', 'right', 0.0))).toBe('centre');
    expect(effectiveLane(player('centre', 'right', 0.49))).toBe('centre');
    expect(effectiveLane(player('right', 'centre', 0.499))).toBe('right');
  });

  it('returns targetLane from animProgress >= 0.5', () => {
    expect(effectiveLane(player('centre', 'right', 0.5))).toBe('right');
    expect(effectiveLane(player('centre', 'right', 0.7))).toBe('right');
    expect(effectiveLane(player('left', 'centre', 0.9))).toBe('centre');
  });
});

describe('collidesAt', () => {
  // Coordinate convention: obstacles approach from negative z and scroll to
  // positive z as the world moves under the player. "Just crossed" means
  // previousWorldZ < 0 AND worldZ >= 0.

  it('returns true when the obstacle just crossed and the player is in a blocked lane', () => {
    const p = player('centre');
    const g = group(['centre'], 0, -0.5); // crossed this frame: -0.5 -> 0
    expect(collidesAt(p, g)).toBe(true);
  });

  it('returns false when the obstacle has not crossed yet (still ahead of player)', () => {
    const p = player('centre');
    const g = group(['centre'], -0.2, -0.5); // both still ahead
    expect(collidesAt(p, g)).toBe(false);
  });

  it('returns false when the obstacle has already passed (both >= 0)', () => {
    const p = player('centre');
    const g = group(['centre'], 1, 2); // both behind player
    expect(collidesAt(p, g)).toBe(false);
  });

  it('returns false when the player is in a non-blocked lane', () => {
    expect(collidesAt(player('left'), group(['centre'], 0, -0.5))).toBe(false);
    expect(collidesAt(player('right'), group(['centre'], 0, -0.5))).toBe(false);
    expect(collidesAt(player('centre'), group(['left'], 0, -0.5))).toBe(false);
  });

  it('returns true when player is mid-animation BEFORE the 50% threshold and the source lane is blocked', () => {
    const p = player('centre', 'right', 0.3);
    const g = group(['centre'], 0, -0.4);
    expect(collidesAt(p, g)).toBe(true);
  });

  it('returns false when player is mid-animation BEFORE the 50% threshold and only the target lane is blocked', () => {
    const p = player('centre', 'right', 0.3);
    const g = group(['right'], 0, -0.4);
    expect(collidesAt(p, g)).toBe(false);
  });

  it('returns false when player is past 50% animation and the source lane is blocked', () => {
    const p = player('centre', 'right', 0.5);
    const g = group(['centre'], 0, -0.4);
    expect(collidesAt(p, g)).toBe(false);
  });

  it('returns true when player is past 50% animation and the target lane is blocked', () => {
    const p = player('centre', 'right', 0.5);
    const g = group(['right'], 0, -0.4);
    expect(collidesAt(p, g)).toBe(true);
  });

  it('two-lane obstacle blocks both lanes', () => {
    const g = group(['left', 'centre'], 0, -0.5);
    expect(collidesAt(player('left'), g)).toBe(true);
    expect(collidesAt(player('centre'), g)).toBe(true);
    expect(collidesAt(player('right'), g)).toBe(false);
  });
});
