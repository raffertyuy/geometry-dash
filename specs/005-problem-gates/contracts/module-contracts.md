# Module Contracts: Problem Gates with Lives and Multi-strike Game Over (Phase 1)

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-05-17

This slice adds **two new pure-logic modules** (`src/problem-gates/`, `src/problems/`), **three new renderer-side DOM helpers** (`src/renderer/problem-modal.ts`, `lives-hud.ts`, `floating-score.ts`), extends **`src/runner-engine/`** with four new transition functions and updates `tickWorld` + lifecycle helpers, and adds an optional parameter to **`src/score/`**'s `computeScore`. It also extends the Three.js renderer with a `updateGates(gates)` method. No existing module is removed.

Module dependency direction (after this slice):

```
game/    ──┐
           ├──► renderer/ ─────────────► shared/
main.ts ──┘                              ▲
           │                             │
           ├──► runner-engine/ ──────────┤
           ├──► lane-state/ ─────────────┤
           ├──► input-adapter/ ──────────┤
           ├──► score/ ──────────────────┤
           ├──► obstacles/ ──────────────┤
           ├──► escalation/ ─────────────┤
           ├──► problem-gates/ ──────────┤  NEW
           └──► problems/ ───────────────┘  NEW
```

`problem-gates/` and `problems/` are pure-logic modules — **MUST NOT** import `three`, `three/*`, or any DOM types. ESLint `no-restricted-imports` enforces this; the rule covers the new directories automatically.

---

## `problem-gates/` — gate catalogue, spawn augmentation, collision

```ts
// problem-gates/index.ts
export {
  GATE_CATALOGUE,
  augmentRowWithGates,
  gateCollidesAt,
  type GateDifficulty,
} from './problem-gates';
```

### `GATE_CATALOGUE`

A constant lookup table from difficulty to display + scoring metadata.

```ts
export type GateDifficulty = 'B' | 'M' | 'A';

export const GATE_CATALOGUE: Readonly<Record<GateDifficulty, {
  readonly points: number;     // ±1000 / ±5000 / ±10000
  readonly colorHex: string;   // muted green / orange / red
  readonly label: string;      // 'Basic' / 'Medium' / 'Advanced'
}>>;
```

### `augmentRowWithGates(blockedLanes, rng) → ProblemGate[]`

- **Input**:
  - `blockedLanes`: `readonly Lane[]` — the obstacle's blocked lanes (from `ObstacleGroup.blockedLanes`).
  - `rng`: a stateful generator providing four 32-bit draws (the same `mulberry32Step` flavour used by `obstacles/`, threaded by the caller).
- **Output**: an array of zero or more `ProblemGate`s — one per non-obstacle lane that the per-lane roll selected as `B`/`M`/`A` (lanes rolled `empty` produce no gate).
- **Behaviour**: For each lane in `{left, centre, right}` not present in `blockedLanes`, draw a 4-way uniform value; if the value selects `B`/`M`/`A`, construct a `ProblemGate` with that difficulty, the lane, the spawn `worldZ` (matches the row's worldZ), and a `Problem` payload chosen by calling `selectPlaceholderProblem(difficulty, rng)` from `problems/`.
- **Invariants**:
  - Returned gates' lanes are pairwise distinct.
  - Returned gates' lanes are disjoint from `blockedLanes`.
  - Returned array length is in `[0, 3 - blockedLanes.length]`.
- **Total function**: never throws when given valid inputs; for an empty `blockedLanes` (zero obstacles in row) it may return up to 3 gates.

### `gateCollidesAt(player, gate) → boolean`

- **Input**: `PlayerState` and a `ProblemGate`.
- **Output**: `true` iff the gate has just crossed the player's z plane this frame AND the player's effective lane (per `effectiveLane` from `obstacles/`) equals `gate.lane`.
- **Behaviour**: Identical predicate shape to `obstacles/collidesAt`, but `blockedLanes` is replaced by a single-lane check. Emits `console.debug({ event: 'gate_hit', ... })` on positive.
- **Total function**: no exceptions.

**Unit-test obligations** (Constitution II):

- `GATE_CATALOGUE`: all three difficulties present; points are exactly 1000/5000/10000; colours match the spec's muted palette intent (regex-checkable as hex strings in the desaturated band).
- `augmentRowWithGates`:
  - With a 1-obstacle row, returns ≤ 2 gates, none in the obstacle's lane.
  - With a 2-obstacle row, returns ≤ 1 gate, in the only free lane.
  - With a 0-obstacle row, can return up to 3 gates.
  - Threads the rng deterministically (same seed → same gate sequence).
  - Over 1000 sampled lanes, the four outcomes converge to ~25% each (±10pp).
- `gateCollidesAt`:
  - True when `previousWorldZ < 0 && worldZ >= 0 && player.effectiveLane === gate.lane`.
  - False on any of: gate not yet crossed; gate already past; lane mismatch.
  - Half-progress lane switch: respects the 0.5-progress cutover rule.

---

## `problems/` — placeholder problem pool

```ts
// problems/index.ts
export {
  selectPlaceholderProblem,
  type Problem,
  type AnswerChoice,
} from './problems';
```

### `selectPlaceholderProblem(difficulty, rng) → Problem`

- **Input**: `difficulty: 'B' | 'M' | 'A'` and a stateful rng (one draw).
- **Output**: a `Problem` whose `difficulty` matches the requested value.
- **Behaviour**: Draws a uniform value, indexes into the difficulty-specific pool. The pool for each difficulty is a `readonly Problem[]` of ~10–15 hand-authored placeholders.
- **Invariants**:
  - Returned problem's `difficulty` equals the requested difficulty.
  - Returned problem is well-formed (three choices, valid `correctIndex`, non-empty strings).
- **Throws**: if the requested difficulty's pool is empty (developer-time guard, not a runtime situation).

**Unit-test obligations**:

- All three pools are non-empty.
- Every problem in every pool has exactly three choices with non-empty texts and a `correctIndex` in `[0, 2]`.
- `selectPlaceholderProblem('B', rng)` always returns a problem with `difficulty === 'B'`; same for M and A.
- Deterministic with a fixed rng seed.

---

## `runner-engine/` — lifecycle + new transitions

```ts
// runner-engine/index.ts
export {
  createWorldState,
  startRun,
  pauseRun,
  resumeRun,
  endRun,
  restartRun,
  tickWorld,
  // NEW exports
  consumeLife,
  enterAnswering,
  resolveAnswer,
  tickInvincibility,
} from './runner-engine';
```

### Updated existing functions

#### `createWorldState() → WorldState`

Now returns a `WorldState` with the four new fields initialised:

```ts
{
  runState: 'pre-run',
  speedUnitsPerSec: RUN_SPEED_UNITS_PER_SEC,
  distanceUnits: 0,
  tickMs: 0,
  lives: MAX_LIVES,                       // 3
  invincibilityRemainingMs: 0,
  scoreDelta: 0,
  activeGate: null,
}
```

#### `restartRun(world) → WorldState`

Now resets all four new fields:

```ts
{
  runState: 'running',
  speedUnitsPerSec: world.speedUnitsPerSec,   // preserved across runs
  distanceUnits: 0,
  tickMs: 0,
  lives: MAX_LIVES,
  invincibilityRemainingMs: 0,
  scoreDelta: 0,
  activeGate: null,
}
```

#### `tickWorld(world, dtMs, speedOverride?) → WorldState`

The early-return guard is extended:

```ts
if (world.runState !== 'running') return world;
```

— so `'answering'` (and the existing `'paused'` / `'game-over'` / `'pre-run'`) all freeze the world. No other behavioural change.

### New transitions

#### `consumeLife(world, cause) → WorldState`

- **Input**: `world: WorldState`, `cause: 'obstacle' | 'wrong-answer'`.
- **Output**: a new `WorldState` with `lives` decremented by 1 and (if `lives` was > 1) `invincibilityRemainingMs = INVINCIBILITY_DURATION_MS`. If the new `lives === 0`, transitions `runState` to `'game-over'` (and does NOT set invincibility — the run is over).
- **Behaviour**:
  - When `lives > 1`: returns `{ ...world, lives: lives - 1, invincibilityRemainingMs: 3000 }`.
  - When `lives === 1`: returns `{ ...world, lives: 0, runState: 'game-over' }`. Emits `console.debug({ event: 'run_ended', cause, tickMs })`.
  - Emits `console.debug({ event: 'life_consumed', cause, livesAfter })`.
  - Emits `console.debug({ event: 'invincibility_started', durationMs })` when invincibility is set.
- **Total function**: callers should not invoke when `runState !== 'running'` and not while `invincibilityRemainingMs > 0`; the function asserts these in debug builds but returns the world unchanged in production.

#### `enterAnswering(world, gate) → WorldState`

- **Input**: `world: WorldState`, `gate: ProblemGate`.
- **Output**: a new `WorldState` with `runState: 'answering'` and `activeGate: { gateId, difficulty, problem }` constructed from the gate.
- **Behaviour**: Emits `console.debug({ event: 'gate_hit', id, difficulty, playerLane })`.
- **Total function**: no-op if `runState !== 'running'`.

#### `resolveAnswer(world, isCorrect, points) → WorldState`

- **Input**: `world: WorldState`, `isCorrect: boolean`, `points: number` (the magnitude — `GATE_POINTS_*`).
- **Output**: a new `WorldState` with:
  - `scoreDelta` updated to `scoreDelta + (isCorrect ? +points : -points)`.
  - `activeGate: null`.
  - `runState: 'running'` initially.
  - If `!isCorrect`, `lives` decremented (delegate to `consumeLife`-style logic; transitions to `'game-over'` when lives reach 0).
  - Else if `(computeScore(tickMs) + new scoreDelta) < 0`, `runState: 'game-over'`.
- **Behaviour**:
  - Emits `console.debug({ event: 'gate_answered', id, difficulty, isCorrect, scoreDelta: newDelta, livesAfter })`.
  - Emits `console.debug({ event: 'score_went_negative', tickMs, scoreDelta, totalScore })` if the total dips below 0.
  - The order of checks matters: lives-zero check fires first; if not, score-below-zero check fires; if neither, return to running.
- **Total function**: no-op if `runState !== 'answering'`.

#### `tickInvincibility(world, dtMs) → WorldState`

- **Input**: `world: WorldState`, `dtMs: number`.
- **Output**: a new `WorldState` with `invincibilityRemainingMs` decremented by `dtMs`, clamped to ≥ 0. Emits `console.debug({ event: 'invincibility_ended', tickMs })` the first frame it transitions from > 0 to 0.
- **Behaviour**: No-op if `runState !== 'running'` or if `invincibilityRemainingMs === 0`.
- **Total function**: never throws.

**Unit-test obligations** (Constitution II):

- `createWorldState()`: returns the four new fields at their initial values.
- `restartRun(world)`: returns the four new fields at their initial values regardless of input's values.
- `tickWorld(...)`:
  - With `runState: 'answering'`, returns `world` unchanged (existing 14+ tests pass).
- `consumeLife({ lives: 3, ... }, 'obstacle')` → `{ lives: 2, invincibilityRemainingMs: 3000, ... }`.
- `consumeLife({ lives: 1, ... }, 'wrong-answer')` → `{ lives: 0, runState: 'game-over', invincibilityRemainingMs: 0, ... }`.
- `enterAnswering({ runState: 'running', ... }, gate)` → `{ runState: 'answering', activeGate: { ... }, ... }`.
- `enterAnswering({ runState: 'paused', ... }, gate)` → unchanged (paused world doesn't enter answering).
- `resolveAnswer(... , true,  1000)` from `runState: 'answering'`, `lives: 3`, `scoreDelta: 0`, `tickMs: 10_000`: returns `runState: 'running', scoreDelta: 1000`, `lives: 3`.
- `resolveAnswer(... , false, 5000)` with `lives: 1`, `scoreDelta: 0`, `tickMs: 4_000`: returns `runState: 'game-over'` via the lives-zero path. The score-below-zero path would have fired anyway (`40 - 5000 = -4960 < 0`); the order rule is documented.
- `resolveAnswer(... , false, 5000)` with `lives: 2`, `scoreDelta: 0`, `tickMs: 4_000`: returns `runState: 'game-over'` via the score-below-zero path; `lives: 1`.
- `tickInvincibility({ invincibilityRemainingMs: 1000, ... }, 500)` → `{ invincibilityRemainingMs: 500, ... }`.
- `tickInvincibility({ invincibilityRemainingMs: 100, ... }, 500)` → `{ invincibilityRemainingMs: 0, ... }`.

---

## `score/` — `computeScore` signature extension

```ts
// score/index.ts (signature change)
export function computeScore(tickMs: number, scoreDelta?: number): number;
export { formatScore, formatTimer } from './score';
```

### `computeScore(tickMs, scoreDelta = 0) → number`

- **Behaviour**: Returns the closed-form tick-derived value (existing slice-004 formula) plus `scoreDelta`. With `scoreDelta` omitted or `0`, behaviour is identical to the previous slice.
- **Total function**: no exceptions.

**Unit-test obligations**:

- All existing tests pass unchanged (they invoke `computeScore(tickMs)` without a second argument; default `0` preserves behaviour).
- `computeScore(10_000, 1000) === 1100` (tier 0 ticking + a B correct answer).
- `computeScore(10_000, -5000) === -4900` (tier 0 ticking + an M wrong answer that goes negative).
- `computeScore(0, 0) === 0`.
- `computeScore(60_000, +10_000) === 19_000` (slice-004 score 9000 + an A correct).

---

## `renderer/` — three new DOM-helper adapter factories

```ts
// renderer/index.ts (adds)
export { createProblemModal, type ProblemModal } from './problem-modal';
export { createLivesHud,    type LivesHud    } from './lives-hud';
export { createFloatingScore, type FloatingScore } from './floating-score';
```

### `createProblemModal(host: HTMLElement) → ProblemModal`

```ts
interface ProblemModal {
  show(problem: Problem, onCommit: (choiceIndex: 0 | 1 | 2) => void): void;
  hide(): void;
  destroy(): void;
}
```

- **Behaviour**:
  - `show(problem, onCommit)`: populates the modal DOM (problem text, three choices), highlights the first choice by default, registers keyboard / click / touch listeners, removes the `.hidden` class on the host.
  - Arrow keys / WASD navigate the highlight; Enter commits the highlighted choice; click / tap on a choice commits it.
  - On commit: invokes `onCommit(choiceIndex)`, removes its listeners. The caller is expected to then call `hide()`.
  - `hide()`: re-adds `.hidden`, clears DOM content (so it's empty on next `show`).
  - `destroy()`: removes any lingering listeners; idempotent.
- **Constraints**: must not depend on game-loop internals. Keyboard listeners use `window.addEventListener` and are scoped to the modal's open period (registered in `show`, unregistered on commit / hide / destroy).

**Smoke-test obligations** (jsdom):

- `show` populates DOM elements; `hide` clears them.
- Arrow-right moves highlight from index 0 to 1; arrow-left from 1 to 0; wraps at boundaries.
- Enter on a highlighted choice commits that choice's index.
- Click on a non-highlighted choice commits its index directly (no highlight step needed).

### `createLivesHud(host: HTMLElement) → LivesHud`

```ts
interface LivesHud {
  set(lives: number): void;
  destroy(): void;
}
```

- **Behaviour**: On creation, populates the host with three `<span class="heart">` SVG elements. `set(lives)` flips the first `lives` of them to filled and the rest to `.empty`. `set(2)` leaves heart-0 and heart-1 filled, marks heart-2 `.empty`.

**Smoke-test obligations**:

- After `createLivesHud(host)`, host has exactly 3 `.heart` children.
- After `set(3)`, no child has `.empty`.
- After `set(0)`, all 3 children have `.empty`.

### `createFloatingScore(host: HTMLElement) → FloatingScore`

```ts
interface FloatingScore {
  pop(text: string, color: 'green' | 'red'): void;
  destroy(): void;
}
```

- **Behaviour**: `pop(text, color)` spawns a transient `<span class="floating-score floating-score--${color}">${text}</span>` child, triggers a CSS transition (translateY upward + opacity 1 → 0), removes the child on transition-end. Lifespan ~ 1 s.
- **Lifecycle**: `destroy()` removes any in-flight children + listener.

**Smoke-test obligations**:

- `pop('+1000', 'green')` creates one child with the right text and a green colour class.
- The child is removed on `transitionend`.

### `three-renderer.ts` — `updateGates(gates)` extension

The existing `ThreeRenderer` interface gains:

```ts
updateGates(gates: readonly ProblemGate[]): void;
```

- **Behaviour**: creates / repositions / disposes subdivided-cube meshes (`BoxGeometry` with internal `lines` for the 3×3 face grid) matching the gates array. Cube colour from `GATE_CATALOGUE[difficulty].colorHex`; same bloom pipeline as obstacles.
- **No new shader code**: a vanilla BoxGeometry with an `EdgesGeometry`-style overlay rendered as `LineSegments2` (same approach as obstacle outlines). Cube subdivision is achieved by overlaying four `LineSegments2` on each face (horizontal + vertical thirds).
- **No collision data exposed**: `updateGates` is render-only; collision lives in `problem-gates/`.

---

## `game/game-loop.ts` — wiring (modified)

The game-loop gains these responsibilities (declared here, implemented in tasks):

1. Maintain a `gates: ProblemGate[]` array alongside `obstacles[]`.
2. After each `nextObstacleGroup(...)` call, also call `augmentRowWithGates(obstacleGroup.blockedLanes, rng)` and push results into `gates`.
3. Each frame in `'running'`:
   - Advance every gate's `worldZ` by `distanceDelta` (same loop as obstacles).
   - For each gate, check `gateCollidesAt(player, gate)`. If true and `invincibilityRemainingMs === 0`, call `world = enterAnswering(world, gate)` AND open the modal AND despawn the gate.
   - If invincible, despawn the gate without firing the modal (silent pass-through).
   - Tick invincibility countdown via `tickInvincibility(world, dtMs)`.
   - For each obstacle, check `collidesAt(player, obstacle)`. If true and `invincibilityRemainingMs === 0`, call `world = consumeLife(world, 'obstacle')` + reposition the player to centre. If `runState` is now `'game-over'`, trigger the existing game-over overlay path.
   - If invincible, treat obstacle as passed.
   - Cull gates whose `worldZ > OBSTACLE_CULL_Z` (same threshold as obstacles).
4. Frame in `'answering'`: skip the entire running-state block (since `tickWorld` no-ops anyway). Renderer continues to draw the last frame + modal.
5. Modal commit (callback from `problem-modal`): `world = resolveAnswer(world, isCorrect, points)`. Call `floatingScore.pop(...)`. If `runState` is now `'game-over'`, trigger game-over overlay path. Else `modal.hide()` and continue.
6. On `restartFromInput`: reset `gates = []`, reset the lives HUD via `livesHud.set(MAX_LIVES)`, the existing renderer reset already clears caches.
7. Render path: `renderer.updateObstacles(obstacles)`, `renderer.updateGates(gates)`, `livesHud.set(world.lives)`, `host.score.textContent = formatScore(computeScore(world.tickMs, world.scoreDelta))`. Floating-score `pop` calls happen only on commit, not per frame.

---

## DOM contract additions (in `index.html`)

```html
<!-- HUD: existing #timer + #score, plus a new lives row -->
<div id="hud">
  <div id="timer">0:00</div>
  <div id="lives-hud" aria-label="Lives"></div>
  <div id="score">0</div>
</div>

<!-- Floating-score host, positioned over the score readout via CSS -->
<div id="floating-scores"></div>

<!-- Modal overlay, hidden until a gate is hit -->
<div id="problem-modal" class="overlay hidden" role="dialog" aria-modal="true">
  <div class="problem-text"></div>
  <ul class="answer-choices">
    <li class="answer-choice" data-idx="0"></li>
    <li class="answer-choice" data-idx="1"></li>
    <li class="answer-choice" data-idx="2"></li>
  </ul>
</div>
```

CSS additions (inline `<style>` in `index.html`, matching the existing pattern):

- `.heart` / `.heart.empty`: low-poly SVG heart styling with `--heart-red` / outline-only.
- `.floating-score`: absolutely positioned over `#score`; CSS transition `translateY(-60px) + opacity 0` over 1 s.
- `#problem-modal`: reuses the `.overlay` base class; the `.answer-choice.is-highlighted` class adds a Tron-cyan outline + brighter background.

No JS DOM creation outside of the renderer adapter factories. All static structure lives in `index.html`.
