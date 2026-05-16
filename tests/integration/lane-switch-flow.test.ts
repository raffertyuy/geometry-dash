import { describe, expect, it } from 'vitest';
import {
  applyInput,
  createPlayerState,
  tickPlayer,
} from '../../src/lane-state';
import {
  createWorldState,
  endRun,
  pauseRun,
  restartRun,
  resumeRun,
  startRun,
  tickWorld,
} from '../../src/runner-engine';
import { createInputAdapter } from '../../src/input-adapter';
import { computeScore } from '../../src/score';
import { collidesAt } from '../../src/obstacles';
import type {
  InputEvent,
  ObstacleGroup,
  PlayerState,
  WorldState,
} from '../../src/shared/types';
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
    expect(world.distanceUnits).toBeCloseTo(RUN_SPEED_UNITS_PER_SEC * 0.1, 5);

    // Frame 2: animation completes at 200ms total.
    player = tickPlayer(player, 100);
    world = tickWorld(world, 100);
    drawMock(player, world);
    expect(player.currentLane).toBe('right');
    expect(player.targetLane).toBeNull();
    expect(world.distanceUnits).toBeCloseTo(RUN_SPEED_UNITS_PER_SEC * 0.2, 5);

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

  it('score derived from tickMs does not advance while the run is paused (FR-005)', () => {
    let world: WorldState = startRun(createWorldState());

    // Run for 3.4 seconds - score should read 34.
    world = tickWorld(world, 3400);
    expect(computeScore(world.tickMs)).toBe(34);

    // Pause - any further tickWorld must be a no-op for tickMs.
    world = pauseRun(world);
    expect(world.runState).toBe('paused');

    // Simulate the player tabbing away for 60 seconds (no Phaser-like
    // auto-pause; tickWorld is the only thing that could move tickMs).
    world = tickWorld(world, 60_000);
    expect(world.tickMs).toBe(3400); // frozen
    expect(computeScore(world.tickMs)).toBe(34); // unchanged

    // Resume - the score continues from 34 on the next tick.
    world = resumeRun(world);
    world = tickWorld(world, 600); // another 6 score points
    expect(computeScore(world.tickMs)).toBe(40);
  });

  it('obstacle reaches player in blocked lane: collides, run ends, restart resets state', () => {
    let player: PlayerState = createPlayerState();
    let world: WorldState = startRun(createWorldState());

    // Place an obstacle that blocks the centre lane just ahead of the player.
    let obstacle: ObstacleGroup = {
      id: 1,
      variant: 'cube',
      blockedLanes: ['centre'],
      worldZ: -5,
      previousWorldZ: -5,
    };

    // Run for a few hundred ms to accumulate some score.
    world = tickWorld(world, 3000);
    expect(computeScore(world.tickMs)).toBe(30);

    // Scroll the obstacle toward the player frame by frame until it crosses 0.
    let collided = false;
    for (let i = 0; i < 200; i++) {
      const dt = 16;
      world = tickWorld(world, dt);
      const delta = (dt * world.speedUnitsPerSec) / 1000;
      obstacle = {
        ...obstacle,
        previousWorldZ: obstacle.worldZ,
        worldZ: obstacle.worldZ + delta,
      };
      if (collidesAt(player, obstacle)) {
        collided = true;
        break;
      }
    }
    expect(collided).toBe(true);

    // End the run.
    world = endRun(world);
    expect(world.runState).toBe('game-over');

    // Verify the score and tickMs are frozen at the collision moment.
    const distAtEnd = world.distanceUnits;
    const tickAtEnd = world.tickMs;
    world = tickWorld(world, 10000); // big delta while in game-over
    expect(world.distanceUnits).toBe(distAtEnd);
    expect(world.tickMs).toBe(tickAtEnd);

    // Restart: fresh state, zero score, zero timer, still running.
    world = restartRun(world);
    player = createPlayerState();
    expect(world.runState).toBe('running');
    expect(world.distanceUnits).toBe(0);
    expect(world.tickMs).toBe(0);
    expect(computeScore(world.tickMs)).toBe(0);
    expect(player.currentLane).toBe('centre');
  });

  it('a touch swipe drives the same end-to-end effect as a keyboard input', () => {
    let player: PlayerState = createPlayerState();
    let world: WorldState = startRun(createWorldState());

    let now = 0;
    const adapter = createInputAdapter({
      now: () => now,
      emit: (e) => {
        player = applyInput(player, e);
      },
    });

    // User touches at (100, 500), holds 200 ms, lifts at (150, 500) - right swipe.
    now = 16;
    adapter.handlePointerDown(100, 500);
    now = 216;
    adapter.handlePointerUp(150, 500);

    expect(player.targetLane).toBe('right');

    // Animation completes after 200 ms of ticks.
    player = tickPlayer(player, 200);
    world = tickWorld(world, 200);
    expect(player.currentLane).toBe('right');
    expect(player.targetLane).toBeNull();
    expect(world.distanceUnits).toBeCloseTo(RUN_SPEED_UNITS_PER_SEC * 0.2, 5);
  });
});
