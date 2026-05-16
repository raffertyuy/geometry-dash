import { describe, expect, it } from 'vitest';
import {
  adjacentLane,
  applyInput,
  createPlayerState,
  easeOutCubic,
  tickPlayer,
} from './index';
import type { InputEvent } from '../shared/types';

function input(direction: 'left' | 'right', timestampMs = 0): InputEvent {
  return { direction, source: 'keyboard', timestampMs };
}

describe('createPlayerState', () => {
  it('starts in the centre lane, idle, no animation, no buffered input', () => {
    expect(createPlayerState()).toEqual({
      currentLane: 'centre',
      targetLane: null,
      animProgress: 0,
      bufferedInput: null,
    });
  });
});

describe('adjacentLane', () => {
  it('returns the lane to the left or right of the given lane', () => {
    expect(adjacentLane('centre', 'left')).toBe('left');
    expect(adjacentLane('centre', 'right')).toBe('right');
    expect(adjacentLane('left', 'right')).toBe('centre');
    expect(adjacentLane('right', 'left')).toBe('centre');
  });

  it('returns null when there is no adjacent lane in the asked direction', () => {
    expect(adjacentLane('left', 'left')).toBeNull();
    expect(adjacentLane('right', 'right')).toBeNull();
  });
});

describe('applyInput', () => {
  it('starts a transition from idle to an adjacent lane', () => {
    const start = createPlayerState();
    const next = applyInput(start, input('right'));
    expect(next.currentLane).toBe('centre');
    expect(next.targetLane).toBe('right');
    expect(next.animProgress).toBe(0);
    expect(next.bufferedInput).toBeNull();
  });

  it('clamps and is a no-op when there is no adjacent lane (left from leftmost)', () => {
    const onLeft = { ...createPlayerState(), currentLane: 'left' as const };
    expect(applyInput(onLeft, input('left'))).toEqual(onLeft);
  });

  it('clamps and is a no-op when there is no adjacent lane (right from rightmost)', () => {
    const onRight = { ...createPlayerState(), currentLane: 'right' as const };
    expect(applyInput(onRight, input('right'))).toEqual(onRight);
  });

  it('buffers a new input received during an in-flight animation', () => {
    const transitioning = applyInput(createPlayerState(), input('right'));
    expect(transitioning.targetLane).toBe('right');

    const buffered = applyInput(transitioning, input('left'));
    // animation continues; bufferedInput is set
    expect(buffered.currentLane).toBe('centre');
    expect(buffered.targetLane).toBe('right');
    expect(buffered.bufferedInput).toBe('left');
  });

  it('overwrites the buffer when a second mid-animation input arrives (last-write-wins)', () => {
    const transitioning = applyInput(createPlayerState(), input('right'));
    const first = applyInput(transitioning, input('left'));
    const second = applyInput(first, input('right'));
    expect(second.bufferedInput).toBe('right');
  });
});

describe('tickPlayer', () => {
  it('does nothing when player is idle (no animation in flight)', () => {
    const idle = createPlayerState();
    expect(tickPlayer(idle, 16)).toEqual(idle);
  });

  it('advances animProgress linearly during an animation', () => {
    const transitioning = applyInput(createPlayerState(), input('right'));
    const after100ms = tickPlayer(transitioning, 100);
    // 100ms / 200ms duration = 0.5
    expect(after100ms.animProgress).toBeCloseTo(0.5, 5);
    expect(after100ms.targetLane).toBe('right');
    expect(after100ms.currentLane).toBe('centre');
  });

  it('snaps to target and clears state when animProgress reaches 1', () => {
    const transitioning = applyInput(createPlayerState(), input('right'));
    const completed = tickPlayer(transitioning, 200);
    expect(completed.currentLane).toBe('right');
    expect(completed.targetLane).toBeNull();
    expect(completed.animProgress).toBe(0);
    expect(completed.bufferedInput).toBeNull();
  });

  it('snaps and immediately consumes a buffered input when animation completes', () => {
    let p = createPlayerState();
    p = applyInput(p, input('right')); // start centre -> right
    p = applyInput(p, input('right')); // buffer another 'right' (right -> off the track... but buffered)
    p = tickPlayer(p, 250); // complete the first animation
    // After completion, currentLane is 'right'. The buffered 'right' would try to go off the right
    // edge - it must clamp, so we end idle at right.
    expect(p.currentLane).toBe('right');
    expect(p.targetLane).toBeNull();
    expect(p.bufferedInput).toBeNull();
  });

  it('snaps and starts the next transition when the buffered input is a valid lane change', () => {
    let p = createPlayerState();
    p = applyInput(p, input('right')); // centre -> right
    p = applyInput(p, input('left')); // buffer a left (will go right -> centre)
    p = tickPlayer(p, 250); // complete the first animation
    expect(p.currentLane).toBe('right'); // landed at right
    expect(p.targetLane).toBe('centre'); // immediately transitioning back to centre
    expect(p.animProgress).toBe(0);
    expect(p.bufferedInput).toBeNull();
  });
});

describe('easeOutCubic', () => {
  it('maps 0 to 0 and 1 to 1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('is monotonically increasing on [0, 1]', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = easeOutCubic(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('eases out (early values rise faster than late ones)', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});
