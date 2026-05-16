import { describe, expect, it } from 'vitest';
import {
  applyInput,
  createPlayerState,
  tickPlayer,
} from '../../src/lane-state';
import {
  createWorldState,
  startRun,
  tickWorld,
} from '../../src/runner-engine';
import { createInputAdapter } from '../../src/input-adapter';
import type { InputEvent, PlayerState, WorldState } from '../../src/shared/types';
import { RUN_SPEED_UNITS_PER_SEC } from '../../src/shared/config';

describe('lane-switch flow: keyboard input -> lane-state -> renderer call', () => {
  it('moves the character through a full keyboard-driven lane change while distance accumulates', () => {
    let player: PlayerState = createPlayerState();
    let world: WorldState = startRun(createWorldState());

    let now = 0;
    const drawCalls: Array<{ player: PlayerState; world: WorldState }> = [];
    const drawMock = (p: PlayerState, w: WorldState): void => {
      drawCalls.push({ player: p, world: w });
    };

    const inputs: InputEvent[] = [];
    const adapter = createInputAdapter({
      now: () => now,
      emit: (e) => {
        inputs.push(e);
        player = applyInput(player, e);
      },
    });

    // Frame 0: pre-input.
    drawMock(player, world);
    expect(drawCalls[0]?.player.currentLane).toBe('centre');
    expect(drawCalls[0]?.player.targetLane).toBeNull();

    // User presses ArrowRight at t=16ms.
    now = 16;
    adapter.handleKeyDown({ key: 'ArrowRight', repeat: false });
    expect(inputs).toHaveLength(1);
    expect(player.targetLane).toBe('right');
    expect(player.animProgress).toBe(0);

    // Frame 1: 100ms elapsed during animation.
    player = tickPlayer(player, 100);
    world = tickWorld(world, 100);
    drawMock(player, world);
    expect(player.animProgress).toBeCloseTo(0.5, 5);
    expect(world.distanceUnits).toBeCloseTo(20, 5); // 100ms @ 200 u/s

    // Frame 2: animation completes at 200ms total.
    player = tickPlayer(player, 100);
    world = tickWorld(world, 100);
    drawMock(player, world);
    expect(player.currentLane).toBe('right');
    expect(player.targetLane).toBeNull();
    expect(world.distanceUnits).toBeCloseTo(40, 5);

    // Renderer was called three times with monotonically-non-decreasing distance.
    expect(drawCalls).toHaveLength(3);
    expect(drawCalls[2]!.world.distanceUnits).toBeGreaterThan(
      drawCalls[1]!.world.distanceUnits,
    );
    expect(drawCalls[1]!.world.distanceUnits).toBeGreaterThan(
      drawCalls[0]!.world.distanceUnits,
    );
  });

  it('clamping at the left boundary does not produce a transition and renderer state is unchanged', () => {
    let player: PlayerState = { ...createPlayerState(), currentLane: 'left' };
    const world: WorldState = startRun(createWorldState());

    const now = 0;
    const adapter = createInputAdapter({
      now: () => now,
      emit: (e) => {
        player = applyInput(player, e);
      },
    });

    adapter.handleKeyDown({ key: 'ArrowLeft', repeat: false });
    expect(player.currentLane).toBe('left');
    expect(player.targetLane).toBeNull();

    const ticked = tickPlayer(player, 200);
    expect(ticked).toEqual(player); // truly idle, no animation

    // World still advances independently.
    const w2 = tickWorld(world, 1000);
    expect(w2.distanceUnits).toBeCloseTo(RUN_SPEED_UNITS_PER_SEC, 5);
  });
});
