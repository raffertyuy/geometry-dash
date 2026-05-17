# Data Model: Problem Gates with Lives and Multi-strike Game Over (Phase 1)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-17

This slice introduces three new entity types (`ProblemGate`, `Problem`, `AnswerChoice`), four new `WorldState` fields, and one new `RunState` value. No persistent state — everything is in-memory and resets on `restartRun`.

---

## New entities

### `Problem`

A placeholder question-and-answer payload. Owned by `src/problems/`.

```ts
interface AnswerChoice {
  readonly text: string;      // user-visible answer text
}

interface Problem {
  readonly id: string;                    // stable identifier within the pool
  readonly difficulty: 'B' | 'M' | 'A';
  readonly prompt: string;                 // user-visible question text
  readonly choices: readonly [
    AnswerChoice,
    AnswerChoice,
    AnswerChoice,
  ];                                       // exactly three choices
  readonly correctIndex: 0 | 1 | 2;        // which choice is correct
}
```

Invariants:

- Exactly three choices.
- `correctIndex` is within `[0, 2]`.
- `prompt`, `choices[*].text` are non-empty strings.
- `id` is unique within each difficulty pool.

The slice ships ~10–15 placeholder problems per difficulty in `src/problems/problems.ts`. Real geometry problems with diagrams come in a later slice.

### `ProblemGate`

A single-lane collidable that, when struck, triggers the answer modal. Owned by `src/problem-gates/`.

```ts
interface ProblemGate {
  readonly id: number;                    // unique within a run
  readonly difficulty: 'B' | 'M' | 'A';
  readonly lane: Lane;                    // 'left' | 'centre' | 'right'
  readonly problem: Problem;              // attached at spawn time
  worldZ: number;
  previousWorldZ: number;
}
```

Invariants:

- `id` unique within a run; sequential.
- `lane` is a single lane (gates do not span lanes).
- `problem.difficulty === gate.difficulty` (catalogue consistency).
- `worldZ` and `previousWorldZ` are mutated each frame by the game-loop as the world scrolls, exactly like `ObstacleGroup`.

### `GATE_CATALOGUE` (constant data, not an entity per se)

A lookup table from difficulty → metadata, owned by `src/problem-gates/`.

```ts
const GATE_CATALOGUE: Readonly<Record<'B' | 'M' | 'A', {
  readonly points: number;       // ±1000 / ±5000 / ±10000
  readonly colorHex: string;     // muted green / orange / red
  readonly label: string;        // "Basic" / "Medium" / "Advanced"
}>> = {
  B: { points:  1_000, colorHex: '#3da06a', label: 'Basic'    },
  M: { points:  5_000, colorHex: '#c08a3a', label: 'Medium'   },
  A: { points: 10_000, colorHex: '#a64141', label: 'Advanced' },
};
```

The hex values are deliberately desaturated relative to the obstacle palette to read as power-ups rather than warnings.

---

## `WorldState` extensions

The existing `WorldState` (from slice 004) gains four fields and one new `runState` value.

```ts
// shared/types.ts (after this slice)

export type RunState =
  | 'pre-run'
  | 'running'
  | 'paused'
  | 'answering'   // NEW
  | 'game-over';

export interface WorldState {
  readonly runState: RunState;
  readonly speedUnitsPerSec: number;
  readonly distanceUnits: number;
  readonly tickMs: number;
  readonly lives: number;                       // NEW: 0..3
  readonly invincibilityRemainingMs: number;    // NEW: 0 when not invincible
  readonly scoreDelta: number;                  // NEW: signed sum of answer-driven changes
  readonly activeGate: ActiveGateRef | null;    // NEW: present only while runState === 'answering'
}

export interface ActiveGateRef {
  readonly gateId: number;
  readonly difficulty: 'B' | 'M' | 'A';
  readonly problem: Problem;
}
```

Properties:

- `lives` starts at `MAX_LIVES = 3` on `createWorldState` and `restartRun`; decreases by 1 per `consumeLife` call; transitions the run to `'game-over'` when it would go below 0.
- `invincibilityRemainingMs` starts at 0; set to `INVINCIBILITY_DURATION_MS = 3000` on each `consumeLife` call; decreases each frame by `dtMs` until it hits 0 (clamped). **While `invincibilityRemainingMs > 0`, BOTH obstacle and problem-gate collisions are absorbed**: obstacles do not decrement `lives`; problem gates do NOT transition the run to `'answering'` and do NOT change `scoreDelta` — the gate is silently consumed (per spec FR-012, US2 scenario 3, SC-004).
- `scoreDelta` starts at 0; mutated only by `resolveAnswer` (adds `+points` or `-points`). The displayed cumulative score is `computeScore(tickMs, scoreDelta)`.
- `activeGate` is `null` when not in `'answering'` state; populated by `enterAnswering`; cleared by `resolveAnswer`.

---

## Run lifecycle (extended)

The state machine gains one new state and four new transitions.

```text
                                          consumeLife (lives > 0)
                                          ┌─────────────────────┐
                                          │                     │
   ┌─────────┐  start  ┌─────────┐ pause  ┌─────────┐  resume  ┌─────────┐
   │ pre-run │────────►│ running │───────►│ paused  │─────────►│ running │
   └─────────┘         └────┬────┘        └─────────┘          └─────────┘
                            │
                            │ enterAnswering(gate)
                            ▼
                       ┌─────────────┐
                       │  answering  │
                       └──────┬──────┘
                              │ resolveAnswer (lives > 0, total >= 0)
                              ▼
                       ┌─────────┐
                       │ running │
                       └────┬────┘
                            │
                            │ consumeLife (lives === 0)
                            │ OR resolveAnswer (total < 0)
                            │ OR resolveAnswer (lives === 0)
                            ▼
                       ┌───────────┐  restart  ┌─────────┐
                       │ game-over │──────────►│ running │
                       └───────────┘           └─────────┘
```

State details:

- `'pre-run'` → `'running'` on `startRun` (unchanged).
- `'running'` → `'paused'` on `pauseRun` (tab blur, unchanged).
- `'paused'` → `'running'` on `resumeRun` (unchanged).
- `'running'` → `'answering'` on `enterAnswering(world, gate)` — called by game-loop on gate collision (only when not invincible).
- `'answering'` → `'running'` on `resolveAnswer(world, isCorrect, points)` when the answer doesn't end the run.
- `'running'` OR `'answering'` → `'game-over'` on:
  - `consumeLife` driving `lives` from 1 to 0.
  - `resolveAnswer` wrong + driving `lives` from 1 to 0.
  - `resolveAnswer` wrong + driving the total score below 0.
- `'game-over'` → `'running'` on `restartRun` (resets `lives = 3`, `invincibilityRemainingMs = 0`, `scoreDelta = 0`, `activeGate = null`).

While in `'answering'`:

- `tickWorld` is a no-op (no `tickMs` advance, no `distanceUnits` advance).
- `tickInvincibility` is a no-op (invincibility doesn't tick down during a modal).
- The game-loop does NOT advance obstacles or gates, does NOT spawn new ones, does NOT animate the player figure.
- The renderer continues to draw the last frame's scene + the modal overlay on top.

---

## Derived values

### Cumulative score (signed)

```text
totalScore(tickMs, scoreDelta) = computeScore(tickMs) + scoreDelta
```

Where `computeScore(tickMs)` is the closed-form tick-based formula from slice 004 (unchanged), and `scoreDelta` is the running sum of all `±points` events from `resolveAnswer` calls in the current run.

Properties:

- Non-negative when `scoreDelta >= 0` (correct-answer rich runs).
- Can be negative if `scoreDelta < -computeScore(tickMs)` — this is the game-over-from-score trigger.
- Reset to 0 on `restartRun` (because both terms reset).

### Visible HUD readouts

```text
score readout text  = formatScore(totalScore(world.tickMs, world.scoreDelta))
timer readout text  = formatTimer(world.tickMs)                              # unchanged
lives icons         = render([0..MAX_LIVES-1].map(i => i < world.lives ? 'filled' : 'empty'))
floating score      = transient DOM element spawned per resolveAnswer call,
                       text = `${scoreDelta >= 0 ? '+' : ''}${scoreDelta}`,
                       colour = green (correct) or red (wrong),
                       lifespan ≈ 1 s
```

---

## Worked examples

### Example A — A correct B gate after 10 seconds

| Step | `tickMs` | `scoreDelta` | `lives` | Total |
|------|---------:|-------------:|--------:|------:|
| Start                | 0       | 0     | 3 | 0    |
| 10 s into running    | 10_000  | 0     | 3 | 100  |
| Hit B gate, modal opens | 10_000 (frozen) | 0 | 3 | 100 |
| Answer correct (+1000) | 10_000  | +1000 | 3 | 1100 |
| Resume; 5 s more     | 15_000  | +1000 | 3 | 1150 |

### Example B — A wrong M gate that drops the score below zero

| Step | `tickMs` | `scoreDelta` | `lives` | Total | State |
|------|---------:|-------------:|--------:|------:|------|
| Start                | 0      | 0     | 3 | 0    | running |
| 4 s in               | 4_000  | 0     | 3 | 40   | running |
| Hit M gate           | 4_000 (frozen) | 0 | 3 | 40 | answering |
| Answer wrong (-5000) | 4_000  | -5000 | 2 | -4960| game-over (immediately) |

`resolveAnswer` produced `lives = 2` (still positive) but `totalScore = -4960 < 0`, so the run is over via the score-below-zero condition.

### Example C — Obstacle collisions consuming hearts with invincibility windows

| Step | `tickMs` | `lives` | `invincRem` | State | Note |
|------|---------:|--------:|------------:|-------|------|
| Start                       | 0       | 3 | 0    | running   | |
| Hit obstacle at 5 s         | 5_000   | 2 | 3000 | running   | respawn centre lane |
| 1 s into invincibility      | 6_000   | 2 | 2000 | running   | obstacles pass through |
| Another obstacle at 6.2 s   | 6_200   | 2 | 1800 | running   | NO-OP (invincible) |
| Invincibility ends at 8 s   | 8_000   | 2 | 0    | running   | |
| Hit obstacle at 12 s        | 12_000  | 1 | 3000 | running   | second life gone |
| Hit obstacle at 16 s        | 16_000  | 0 | 0    | game-over | last life — invincibility set then immediately overridden by game-over |

In the final row, the spec is silent on whether the 3-second window is "set then immediately game-over" or "skipped." The implementation should call `consumeLife` first; if it returns a state with `lives === 0`, the game-loop transitions to game-over and the invincibility window is moot (no further frames advance).

---

## Constants in `shared/config.ts` (additions)

```ts
// Lives + invincibility tunables
export const MAX_LIVES = 3;
export const INVINCIBILITY_DURATION_MS = 3000;

// Problem-gate tunables
export const GATE_POINTS_B = 1_000;
export const GATE_POINTS_M = 5_000;
export const GATE_POINTS_A = 10_000;

// Per-lane gate distribution: each non-obstacle lane is independently sampled
// from {empty, B, M, A}. Equal weighting per the spec — no balancing.
// (No "minimum variety" constraint; all-same-difficulty rows like A-A-A are valid.)
export const GATE_LANE_PROBABILITY_EMPTY = 0.25;
export const GATE_LANE_PROBABILITY_B     = 0.25;
export const GATE_LANE_PROBABILITY_M     = 0.25;
export const GATE_LANE_PROBABILITY_A     = 0.25;
// (These sum to 1.0 exactly; assert in a startup check.)
```

---

## Debug observability

New `console.debug` events (payloads):

- `gate_spawned`         `{ id, lane, difficulty, worldZ }`
- `gate_hit`             `{ id, difficulty, playerLane }`
- `gate_answered`        `{ id, difficulty, isCorrect, scoreDelta, livesAfter }`
- `life_consumed`        `{ cause: 'obstacle' | 'wrong-answer', livesAfter }`
- `invincibility_started`{ durationMs }`
- `invincibility_ended`  `{ tickMs }`
- `score_went_negative`  `{ tickMs, scoreDelta, totalScore }`

Existing events unchanged: `run_started`, `run_paused`, `run_resumed`, `run_ended`, `run_restarted`, `obstacle_spawned`, `collision_detected`, `tier_advanced`.

The `?debug=1` overlay gains four rows: `lives`, `invinc`, `gate`, `delta`. Each is a single line; layout is unchanged.
