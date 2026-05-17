import { describe, expect, it } from 'vitest';
import {
  GATE_CATALOGUE,
  augmentRowWithGates,
  createGateSpawnState,
  gateCollidesAt,
} from './problem-gates';
import { createPlayerState } from '../lane-state';
import {
  GATE_POINTS_A,
  GATE_POINTS_B,
  GATE_POINTS_M,
} from '../shared/config';
import type { GateDifficulty, Lane, ProblemGate } from '../shared/types';

describe('GATE_CATALOGUE', () => {
  it('exposes B, M, A entries with the spec point magnitudes', () => {
    expect(GATE_CATALOGUE.B.points).toBe(GATE_POINTS_B);
    expect(GATE_CATALOGUE.M.points).toBe(GATE_POINTS_M);
    expect(GATE_CATALOGUE.A.points).toBe(GATE_POINTS_A);
    expect(GATE_POINTS_B).toBe(1_000);
    expect(GATE_POINTS_M).toBe(5_000);
    expect(GATE_POINTS_A).toBe(10_000);
  });

  it("each difficulty's colorHex is a valid 6-char hex string", () => {
    for (const d of ['B', 'M', 'A'] as const) {
      expect(/^#[0-9a-fA-F]{6}$/.test(GATE_CATALOGUE[d].colorHex)).toBe(true);
    }
  });

  it('every gate colour has at least one channel ≥ 0xEE (neon palette invariant)', () => {
    // Inverts the original "muted palette" rule: cubes are now the bright
    // visual element of the scene (obstacles are the dark-blue element).
    // Each difficulty colour must have at least one near-saturated channel
    // so it pops against the unified dark-blue obstacle field.
    for (const d of ['B', 'M', 'A'] as const) {
      const hex = GATE_CATALOGUE[d].colorHex.slice(1); // strip '#'
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      expect(Math.max(r, g, b)).toBeGreaterThanOrEqual(0xee);
    }
  });

  it('each difficulty has a human-readable label', () => {
    expect(GATE_CATALOGUE.B.label).toBe('Basic');
    expect(GATE_CATALOGUE.M.label).toBe('Medium');
    expect(GATE_CATALOGUE.A.label).toBe('Advanced');
  });
});

describe('augmentRowWithGates', () => {
  it('with 1-obstacle row, returns ≤ 2 gates, none in the obstacle lane', () => {
    const state = createGateSpawnState(12345);
    const { gates } = augmentRowWithGates(['centre'], -34, state);
    expect(gates.length).toBeLessThanOrEqual(2);
    for (const g of gates) {
      expect(g.lane).not.toBe('centre');
    }
  });

  it('with 2-obstacle row, returns ≤ 1 gate in the only remaining lane', () => {
    const state = createGateSpawnState(99999);
    const { gates } = augmentRowWithGates(['left', 'centre'], -34, state);
    expect(gates.length).toBeLessThanOrEqual(1);
    for (const g of gates) {
      expect(g.lane).toBe('right');
    }
  });

  it('with 0-obstacle row, gate lanes form a subset of {left, centre, right}', () => {
    const state = createGateSpawnState(42);
    const { gates } = augmentRowWithGates([], -34, state);
    expect(gates.length).toBeLessThanOrEqual(3);
    const laneSet = new Set(gates.map((g) => g.lane));
    expect(laneSet.size).toBe(gates.length); // distinct lanes
  });

  it('threads the rng deterministically (same seed → same gate sequence)', () => {
    const s1 = createGateSpawnState(7);
    const s2 = createGateSpawnState(7);
    const r1 = augmentRowWithGates([], -34, s1);
    const r2 = augmentRowWithGates([], -34, s2);
    expect(r1.gates.length).toBe(r2.gates.length);
    for (let i = 0; i < r1.gates.length; i++) {
      expect(r1.gates[i]!.lane).toBe(r2.gates[i]!.lane);
      expect(r1.gates[i]!.difficulty).toBe(r2.gates[i]!.difficulty);
      expect(r1.gates[i]!.problem.id).toBe(r2.gates[i]!.problem.id);
    }
  });

  it('advances the spawn state seed + lastSpawnedGateId between calls', () => {
    let state = createGateSpawnState(1);
    const initialSeed = state.seed;
    const initialId = state.lastSpawnedGateId;
    const r = augmentRowWithGates([], -34, state);
    state = r.state;
    expect(state.seed).not.toBe(initialSeed);
    expect(state.lastSpawnedGateId).toBeGreaterThanOrEqual(initialId);
  });

  it('assigns sequential ids across multiple calls', () => {
    let state = createGateSpawnState(2);
    const allGates: ProblemGate[] = [];
    for (let i = 0; i < 10; i++) {
      const r = augmentRowWithGates([], -34, state);
      allGates.push(...r.gates);
      state = r.state;
    }
    if (allGates.length >= 2) {
      const ids = allGates.map((g) => g.id);
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i]).toBeGreaterThan(ids[i - 1]!);
      }
    }
  });

  it('over 1000 non-obstacle lane samples, the four outcomes each appear roughly 25% of the time', () => {
    let state = createGateSpawnState(98765);
    const counts: Record<'empty' | 'B' | 'M' | 'A', number> = {
      empty: 0,
      B: 0,
      M: 0,
      A: 0,
    };
    // Use 0-obstacle rows: each call samples 3 non-obstacle lanes.
    const calls = 400;
    for (let i = 0; i < calls; i++) {
      const r = augmentRowWithGates([], -34, state);
      state = r.state;
      // Each call sampled exactly 3 lanes; count from the gates we got.
      const present = new Set(r.gates.map((g) => g.lane));
      for (const lane of ['left', 'centre', 'right'] as const) {
        if (!present.has(lane)) {
          counts.empty += 1;
        } else {
          const g = r.gates.find((gg) => gg.lane === lane)!;
          counts[g.difficulty] += 1;
        }
      }
    }
    const totalSamples = calls * 3;
    for (const k of ['empty', 'B', 'M', 'A'] as const) {
      const fraction = counts[k] / totalSamples;
      expect(fraction).toBeGreaterThan(0.15);
      expect(fraction).toBeLessThan(0.35);
    }
  });

  it('gate worldZ + previousWorldZ both initialised to the row worldZ', () => {
    const state = createGateSpawnState(50);
    const { gates } = augmentRowWithGates([], -42, state);
    for (const g of gates) {
      expect(g.worldZ).toBe(-42);
      expect(g.previousWorldZ).toBe(-42);
    }
  });

  it('gate problem difficulty matches the gate difficulty', () => {
    let state = createGateSpawnState(100);
    for (let i = 0; i < 20; i++) {
      const r = augmentRowWithGates([], -34, state);
      state = r.state;
      for (const g of r.gates) {
        expect(g.problem.difficulty).toBe(g.difficulty);
      }
    }
  });
});

describe('gateCollidesAt', () => {
  function makeGate(
    lane: Lane,
    worldZ: number,
    previousWorldZ: number,
    difficulty: GateDifficulty = 'B',
  ): ProblemGate {
    return {
      id: 1,
      difficulty,
      lane,
      problem: {
        id: 'test',
        difficulty,
        prompt: 'test',
        choices: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] as const,
        correctIndex: 0,
      },
      worldZ,
      previousWorldZ,
    };
  }

  it('fires when the gate just crossed z=0 AND player effectiveLane matches', () => {
    const player = createPlayerState(); // currentLane='centre', no animation
    const gate = makeGate('centre', 0.1, -0.1);
    expect(gateCollidesAt(player, gate)).toBe(true);
  });

  it('does not fire if the gate is still ahead of the player', () => {
    const player = createPlayerState();
    const gate = makeGate('centre', -0.5, -1);
    expect(gateCollidesAt(player, gate)).toBe(false);
  });

  it('does not fire if the gate has already passed the player', () => {
    const player = createPlayerState();
    const gate = makeGate('centre', 5, 4); // both >= 0, already past
    expect(gateCollidesAt(player, gate)).toBe(false);
  });

  it('does not fire when player effectiveLane differs from gate lane', () => {
    const player = createPlayerState(); // 'centre'
    const gate = makeGate('left', 0.1, -0.1);
    expect(gateCollidesAt(player, gate)).toBe(false);
  });

  it('respects the slice-003 lane-cross rule: animProgress >= 0.5 uses target lane', () => {
    const player = {
      currentLane: 'centre' as const,
      targetLane: 'right' as const,
      animProgress: 0.6, // past halfway → effective lane is 'right'
      bufferedInput: null,
    };
    const gate = makeGate('right', 0.1, -0.1);
    expect(gateCollidesAt(player, gate)).toBe(true);
  });

  it('respects the slice-003 lane-cross rule: animProgress < 0.5 uses source lane', () => {
    const player = {
      currentLane: 'centre' as const,
      targetLane: 'right' as const,
      animProgress: 0.4, // not yet halfway → effective lane is 'centre'
      bufferedInput: null,
    };
    const gateInRight = makeGate('right', 0.1, -0.1);
    const gateInCentre = makeGate('centre', 0.1, -0.1);
    expect(gateCollidesAt(player, gateInRight)).toBe(false);
    expect(gateCollidesAt(player, gateInCentre)).toBe(true);
  });
});
