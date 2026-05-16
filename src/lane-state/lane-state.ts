import { LANES, LANE_SWITCH_DURATION_MS } from '../shared/config';
import type {
  Direction,
  InputEvent,
  Lane,
  PlayerState,
} from '../shared/types';

export function createPlayerState(): PlayerState {
  return {
    currentLane: 'centre',
    targetLane: null,
    animProgress: 0,
    bufferedInput: null,
  };
}

export function adjacentLane(lane: Lane, direction: Direction): Lane | null {
  const index = LANES.indexOf(lane);
  const target = direction === 'left' ? index - 1 : index + 1;
  if (target < 0 || target >= LANES.length) return null;
  const next = LANES[target];
  return next ?? null;
}

export function applyInput(
  player: PlayerState,
  input: InputEvent,
): PlayerState {
  if (player.targetLane !== null) {
    console.debug({
      event: 'lane_change_buffered',
      direction: input.direction,
      currentLane: player.currentLane,
      targetLane: player.targetLane,
    });
    return { ...player, bufferedInput: input.direction };
  }

  const target = adjacentLane(player.currentLane, input.direction);
  if (target === null) {
    console.debug({
      event: 'lane_change_clamped',
      lane: player.currentLane,
      direction: input.direction,
    });
    return player;
  }

  console.debug({
    event: 'lane_change_requested',
    from: player.currentLane,
    to: target,
    source: input.source,
  });
  return {
    currentLane: player.currentLane,
    targetLane: target,
    animProgress: 0,
    bufferedInput: null,
  };
}

export function tickPlayer(player: PlayerState, dtMs: number): PlayerState {
  if (player.targetLane === null) return player;

  const newProgress = player.animProgress + dtMs / LANE_SWITCH_DURATION_MS;
  if (newProgress < 1) {
    return { ...player, animProgress: newProgress };
  }

  // Animation complete - snap to target.
  const landedAt: Lane = player.targetLane;
  console.debug({ event: 'lane_change_applied', lane: landedAt });

  if (player.bufferedInput === null) {
    return {
      currentLane: landedAt,
      targetLane: null,
      animProgress: 0,
      bufferedInput: null,
    };
  }

  // Consume the buffered input as the next intent.
  const nextTarget = adjacentLane(landedAt, player.bufferedInput);
  if (nextTarget === null) {
    console.debug({
      event: 'lane_change_clamped',
      lane: landedAt,
      direction: player.bufferedInput,
      source: 'buffered',
    });
    return {
      currentLane: landedAt,
      targetLane: null,
      animProgress: 0,
      bufferedInput: null,
    };
  }

  console.debug({
    event: 'lane_change_requested',
    from: landedAt,
    to: nextTarget,
    source: 'buffered',
  });
  return {
    currentLane: landedAt,
    targetLane: nextTarget,
    animProgress: 0,
    bufferedInput: null,
  };
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
