import { describe, expect, it } from 'vitest';
import {
  consumeLife,
  createWorldState,
  enterAnswering,
  resolveAnswer,
  startRun,
  tickWorld,
} from '../../src/runner-engine';
import { createPlayerState } from '../../src/lane-state';
import { computeScore } from '../../src/score';
import {
  GATE_CATALOGUE,
  augmentRowWithGates,
  createGateSpawnState,
  gateCollidesAt,
} from '../../src/problem-gates';
import { GATE_POINTS_A, GATE_POINTS_M } from '../../src/shared/config';
import type { ProblemGate } from '../../src/shared/types';

/**
 * End-to-end pure-logic exercise of the problem-gate flow:
 * spawn -> advance -> collide -> enter answering -> world freezes ->
 * resolve answer -> return to running with updated scoreDelta. No DOM,
 * no Three.js, no game-loop instance — only the public APIs of the
 * pure modules.
 */

function advanceGate(gate: ProblemGate, dz: number): void {
  gate.previousWorldZ = gate.worldZ;
  gate.worldZ += dz;
}

describe('problem-gate flow: collision -> modal -> answer commit', () => {
  it('a correct answer adds +points to scoreDelta and returns runState to running', () => {
    let world = startRun(createWorldState());
    world = tickWorld(world, 10_000); // 10s into the run
    const baseTickScore = computeScore(world.tickMs, world.scoreDelta);

    // Place a B gate in the player's lane, just behind the player's z plane.
    const gate: ProblemGate = {
      id: 1,
      difficulty: 'B',
      lane: 'centre',
      problem: {
        id: 'b-test',
        difficulty: 'B',
        prompt: 'test',
        choices: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] as const,
        correctIndex: 0,
      },
      worldZ: -0.5,
      previousWorldZ: -1,
    };
    advanceGate(gate, 0.7); // crosses z=0 this frame

    const player = createPlayerState(); // centre lane, no anim
    expect(gateCollidesAt(player, gate)).toBe(true);

    world = enterAnswering(world, gate);
    expect(world.runState).toBe('answering');
    expect(world.activeGate?.gateId).toBe(1);

    // World freezes during answering: tickWorld is a no-op.
    const tickAtFreeze = world.tickMs;
    world = tickWorld(world, 5_000);
    expect(world.tickMs).toBe(tickAtFreeze);

    // Commit the correct answer (index 0 in our test problem).
    world = resolveAnswer(world, true, GATE_CATALOGUE.B.points);
    expect(world.runState).toBe('running');
    expect(world.activeGate).toBeNull();
    expect(world.scoreDelta).toBe(GATE_CATALOGUE.B.points);
    expect(world.lives).toBe(3); // unchanged on correct

    // Computed score reflects the +1000 boost.
    const totalAfter = computeScore(world.tickMs, world.scoreDelta);
    expect(totalAfter).toBe(baseTickScore + GATE_CATALOGUE.B.points);
  });

  it('a wrong answer subtracts points AND consumes a life', () => {
    let world = startRun(createWorldState());
    world = tickWorld(world, 60_000); // accumulate plenty of tick score
    const livesBefore = world.lives;

    const gate: ProblemGate = {
      id: 2,
      difficulty: 'M',
      lane: 'centre',
      problem: {
        id: 'm-test',
        difficulty: 'M',
        prompt: 'test',
        choices: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] as const,
        correctIndex: 0,
      },
      worldZ: 0,
      previousWorldZ: -1,
    };

    world = enterAnswering(world, gate);
    world = resolveAnswer(world, false, GATE_POINTS_M);
    expect(world.runState).toBe('running');
    expect(world.scoreDelta).toBe(-GATE_POINTS_M);
    expect(world.lives).toBe(livesBefore - 1);
    // Wrong answer doesn't set invincibility — that's reserved for obstacles.
    expect(world.invincibilityRemainingMs).toBe(0);
  });

  it('a wrong answer that drives the total score below zero leaves the runner-engine in running; the game-over check is the caller s job', () => {
    let world = startRun(createWorldState());
    world = tickWorld(world, 2_000); // ~20 points of tick score (default config)
    const tickScore = computeScore(world.tickMs, world.scoreDelta);
    expect(tickScore).toBeGreaterThanOrEqual(0);
    expect(tickScore).toBeLessThan(GATE_POINTS_A); // tick < penalty

    const gate: ProblemGate = {
      id: 3,
      difficulty: 'A',
      lane: 'centre',
      problem: {
        id: 'a-test',
        difficulty: 'A',
        prompt: 'test',
        choices: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] as const,
        correctIndex: 0,
      },
      worldZ: 0,
      previousWorldZ: -1,
    };

    world = enterAnswering(world, gate);
    world = resolveAnswer(world, false, GATE_POINTS_A);
    // resolveAnswer leaves runState='running' because the score-below-zero
    // game-over rule is the game-loop's responsibility (it owns the score
    // module dependency). Lives went 3 -> 2.
    expect(world.runState).toBe('running');
    expect(world.lives).toBe(2);

    // Caller-side score-below-zero check (mirroring the game-loop):
    const total = computeScore(world.tickMs, world.scoreDelta);
    expect(total).toBeLessThan(0);
  });

  it('a wrong answer on the last life transitions to game-over via consumeLife', () => {
    let world = startRun(createWorldState());
    world = { ...world, lives: 1 };

    const gate: ProblemGate = {
      id: 4,
      difficulty: 'B',
      lane: 'centre',
      problem: {
        id: 'b-test',
        difficulty: 'B',
        prompt: 'test',
        choices: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] as const,
        correctIndex: 0,
      },
      worldZ: 0,
      previousWorldZ: -1,
    };

    world = enterAnswering(world, gate);
    world = resolveAnswer(world, false, GATE_CATALOGUE.B.points);
    expect(world.runState).toBe('game-over');
    expect(world.lives).toBe(0);
  });
});

describe('problem-gate flow: invincibility absorbs gates', () => {
  it('during the post-obstacle invincibility window, a gate collision is a no-op (caller despawns silently)', () => {
    let world = startRun(createWorldState());
    world = consumeLife(world, 'obstacle');
    expect(world.invincibilityRemainingMs).toBeGreaterThan(0);

    const gate: ProblemGate = {
      id: 5,
      difficulty: 'A',
      lane: 'centre',
      problem: {
        id: 'a-test',
        difficulty: 'A',
        prompt: 'test',
        choices: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] as const,
        correctIndex: 0,
      },
      worldZ: 0,
      previousWorldZ: -1,
    };

    // gateCollidesAt fires (the lane + z conditions are met) — the
    // invincibility-gating happens at the game-loop level, NOT inside
    // gateCollidesAt. Verify the predicate still returns true so the
    // game-loop knows to silently consume the gate.
    const player = createPlayerState();
    expect(gateCollidesAt(player, gate)).toBe(true);

    // Game-loop equivalent: detect collision + invincibility -> drop gate
    // without entering answering. World state is unchanged apart from the
    // invincibility countdown (which the game-loop's tickInvincibility
    // separately advances).
    if (world.invincibilityRemainingMs > 0) {
      // Skip enterAnswering — gate is silently consumed.
    } else {
      world = enterAnswering(world, gate);
    }
    expect(world.runState).toBe('running');
    expect(world.activeGate).toBeNull();
    expect(world.scoreDelta).toBe(0);
  });
});

describe('problem-gate flow: row augmentation respects obstacle lane occupancy', () => {
  it('gates spawn only in non-obstacle lanes', () => {
    let state = createGateSpawnState(20250517);
    for (let i = 0; i < 50; i++) {
      // 1-obstacle row in 'centre'.
      const r = augmentRowWithGates(['centre'], -34, state);
      state = r.state;
      for (const g of r.gates) {
        expect(g.lane).not.toBe('centre');
      }
    }
  });

  it('the augmented gates inherit the row worldZ', () => {
    const state = createGateSpawnState(42);
    const r = augmentRowWithGates([], -28, state);
    for (const g of r.gates) {
      expect(g.worldZ).toBe(-28);
      expect(g.previousWorldZ).toBe(-28);
    }
  });
});
