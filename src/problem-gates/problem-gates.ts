import {
  GATE_LANE_PROBABILITY_B,
  GATE_LANE_PROBABILITY_EMPTY,
  GATE_LANE_PROBABILITY_M,
  GATE_POINTS_A,
  GATE_POINTS_B,
  GATE_POINTS_M,
} from '../shared/config';
import { effectiveLane } from '../obstacles';
import { selectPlaceholderProblem } from '../problems';
import type {
  GateDifficulty,
  Lane,
  PlayerState,
  ProblemGate,
} from '../shared/types';

const ALL_LANES: readonly Lane[] = ['left', 'centre', 'right'];

/**
 * Muted-palette catalogue keyed by gate difficulty. Hex values are
 * deliberately less saturated than the existing Tron-coloured obstacle
 * palette so the player reads gates as power-ups, not warnings. Every
 * channel sits at or below 0xC0 (192).
 */
export const GATE_CATALOGUE: Readonly<
  Record<
    GateDifficulty,
    {
      readonly points: number;
      readonly colorHex: string;
      readonly label: string;
    }
  >
> = {
  B: { points: GATE_POINTS_B, colorHex: '#3da06a', label: 'Basic' },
  M: { points: GATE_POINTS_M, colorHex: '#c08a3a', label: 'Medium' },
  A: { points: GATE_POINTS_A, colorHex: '#a64141', label: 'Advanced' },
};

export interface GateSpawnState {
  readonly seed: number;
  readonly lastSpawnedGateId: number;
}

export function createGateSpawnState(initialSeed: number): GateSpawnState {
  return { seed: initialSeed, lastSpawnedGateId: 0 };
}

/**
 * Pure single-step mulberry32 PRNG. Identical algorithm to the one in
 * obstacles/obstacle-spawn.ts. Inlined here so problem-gates stays
 * decoupled from obstacles' internal helpers.
 */
function mulberry32Step(seed: number): { value: number; nextSeed: number } {
  const s = (seed + 0x6d2b79f5) | 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return {
    value: ((t ^ (t >>> 14)) >>> 0) / 4294967296,
    nextSeed: s,
  };
}

// Cumulative thresholds derived once at module load. Anything ≥ T_M falls
// into 'A' (the residual mass). config.ts asserts the four probabilities
// sum to 1.0, so the cumulative layout is well-formed.
const T_EMPTY = GATE_LANE_PROBABILITY_EMPTY;
const T_B = T_EMPTY + GATE_LANE_PROBABILITY_B;
const T_M = T_B + GATE_LANE_PROBABILITY_M;

function pickDifficulty(uniform01: number): GateDifficulty | null {
  if (uniform01 < T_EMPTY) return null;
  if (uniform01 < T_B) return 'B';
  if (uniform01 < T_M) return 'M';
  return 'A';
}

/**
 * For each non-obstacle lane in the row (i.e., every lane NOT in
 * `blockedLanes`), independently draws a uniform sample and decides
 * empty / B / M / A per the GATE_LANE_PROBABILITY_* weights. Returns
 * the resulting gates plus a threaded spawn state (advanced seed + last
 * id).
 *
 * The function does not re-check the O-O-O invariant — the obstacle
 * generator already guarantees `blockedLanes.length < 3`.
 */
export function augmentRowWithGates(
  blockedLanes: readonly Lane[],
  worldZ: number,
  state: GateSpawnState,
): { gates: readonly ProblemGate[]; state: GateSpawnState } {
  const blocked = new Set(blockedLanes);
  let seed = state.seed;
  let nextId = state.lastSpawnedGateId;
  const gates: ProblemGate[] = [];

  for (const lane of ALL_LANES) {
    if (blocked.has(lane)) continue;

    // Draw 1: decide empty / B / M / A.
    const decideRoll = mulberry32Step(seed);
    seed = decideRoll.nextSeed;
    const difficulty = pickDifficulty(decideRoll.value);
    if (difficulty === null) continue;

    // Draw 2: pick a problem within the difficulty's pool.
    const problemRoll = mulberry32Step(seed);
    seed = problemRoll.nextSeed;
    const problem = selectPlaceholderProblem(difficulty, problemRoll.value);

    nextId += 1;
    const gate: ProblemGate = {
      id: nextId,
      difficulty,
      lane,
      problem,
      worldZ,
      previousWorldZ: worldZ,
    };
    gates.push(gate);

    console.debug({
      event: 'gate_spawned',
      id: gate.id,
      lane: gate.lane,
      difficulty: gate.difficulty,
      worldZ: gate.worldZ,
    });
  }

  return {
    gates,
    state: { seed, lastSpawnedGateId: nextId },
  };
}

/**
 * True iff the gate has just crossed the player's z plane this frame AND
 * the player's effective lane equals `gate.lane`. Mirrors
 * obstacles/collidesAt but uses single-lane equality and reads its
 * `effectiveLane` helper from `obstacles` (the same source-of-truth used
 * by obstacle collision).
 */
export function gateCollidesAt(
  player: PlayerState,
  gate: ProblemGate,
): boolean {
  if (gate.worldZ < 0 || gate.previousWorldZ >= 0) return false;
  const lane = effectiveLane(player);
  if (lane !== gate.lane) return false;
  console.debug({
    event: 'gate_hit',
    id: gate.id,
    difficulty: gate.difficulty,
    playerLane: lane,
  });
  return true;
}

export type { GateDifficulty } from '../shared/types';
