# Module Contracts: Lane Runner Core Movement (Phase 1)

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-05-16

This is the public-API surface of every module in this slice. Each module's `index.ts` MUST re-export exactly the symbols listed here - nothing more, nothing less. These are the seams that unit tests assert against and that Constitution Principle III (Library-First) enforces.

Module dependency direction (no cycles):

```
phaser/  ──┐
           ├──► renderer/ ──► shared/
main.ts ──┘
           └──► runner-engine/ ─┐
           └──► lane-state/ ────┼─► shared/
           └──► input-adapter/ ─┘
```

Only `renderer/` and `phaser/` may import from the `phaser` npm package. The other modules MUST be importable in a Node test environment with no DOM/canvas.

---

## `shared/` - foundational types + tunables

```ts
// shared/types.ts
export type Lane = 'left' | 'centre' | 'right';
export type Direction = 'left' | 'right';
export type InputSource = 'keyboard' | 'touch';

export interface InputEvent {
  readonly direction: Direction;
  readonly source: InputSource;
  readonly timestampMs: number;
}

export interface PlayerState {
  readonly currentLane: Lane;
  readonly targetLane: Lane | null;
  readonly animProgress: number; // [0, 1]
  readonly bufferedInput: Direction | null;
}

export type RunState = 'pre-run' | 'running' | 'paused';

export interface WorldState {
  readonly runState: RunState;
  readonly speedUnitsPerSec: number;
  readonly distanceUnits: number;
  readonly tickMs: number;
}
```

```ts
// shared/config.ts
export const LANES: readonly Lane[];               // ['left', 'centre', 'right']
export const LANE_X: Record<Lane, number>;         // { left: 180, centre: 360, right: 540 }
export const LOGICAL_WIDTH: 720;
export const LOGICAL_HEIGHT: 1280;
export const RUN_SPEED_UNITS_PER_SEC: 200;
export const LANE_SWITCH_DURATION_MS: 200;
export const SWIPE_MIN_HORIZONTAL_PX: 30;
export const SWIPE_MAX_DURATION_MS: 500;
export const SWIPE_HORIZONTAL_DOMINANCE: 2;        // |dx| must be >= 2 * |dy|
export const INPUT_COALESCE_WINDOW_MS: 50;
export const DEBUG: boolean;                       // true iff URL ?debug=1
```

**Rules**:

- All values are `readonly` / `const`. Game logic NEVER mutates `shared/`.
- `shared/` has zero dependencies on other modules.

---

## `lane-state/` - lane state machine

```ts
// lane-state/index.ts
export function createPlayerState(): PlayerState;

export function applyInput(
  player: PlayerState,
  input: InputEvent
): PlayerState;

export function tickPlayer(
  player: PlayerState,
  dtMs: number
): PlayerState;

export function adjacentLane(
  lane: Lane,
  direction: Direction
): Lane | null;
```

**Behaviour**:

- `createPlayerState()` returns `{ currentLane: 'centre', targetLane: null, animProgress: 0, bufferedInput: null }`.
- `applyInput(player, input)` is pure and total. It follows the transition table in `data-model.md`. Emits `console.debug` events for state transitions.
- `tickPlayer(player, dtMs)` advances `animProgress` by `dtMs / LANE_SWITCH_DURATION_MS`. If it reaches 1.0, the player snaps to `targetLane`, the buffered input (if any) is consumed via a synthesised `InputEvent`, and the resulting state is returned.
- `adjacentLane('left', 'left') === null`; `adjacentLane('centre', 'right') === 'right'`; etc.

**Unit-test obligations** (Constitution II):

- All four transitions in the state machine table.
- Boundary clamping for both ends.
- Buffer overwrite (last-write-wins) during animation.
- Easing function correctness (`easeOutCubic(0) === 0`, `easeOutCubic(1) === 1`, monotonic increasing).

---

## `runner-engine/` - world tick + pause state

```ts
// runner-engine/index.ts
export function createWorldState(): WorldState;

export function startRun(world: WorldState): WorldState;
export function pauseRun(world: WorldState): WorldState;
export function resumeRun(world: WorldState): WorldState;

export function tickWorld(world: WorldState, dtMs: number): WorldState;
```

**Behaviour**:

- `createWorldState()` returns `{ runState: 'pre-run', speedUnitsPerSec: RUN_SPEED_UNITS_PER_SEC, distanceUnits: 0, tickMs: 0 }`.
- `startRun` transitions `'pre-run' -> 'running'`. Idempotent if already running.
- `pauseRun` transitions `'running' -> 'paused'`. No-op from `'pre-run'` or `'paused'`.
- `resumeRun` transitions `'paused' -> 'running'`. No-op otherwise. Cannot restart a `'pre-run'` (use `startRun`).
- `tickWorld(world, dtMs)`:
  - If `runState === 'running'`: increments `tickMs` and `distanceUnits` by `dtMs * speedUnitsPerSec / 1000`.
  - Otherwise: returns `world` unchanged.

**Unit-test obligations**:

- `pauseRun -> tickWorld -> distanceUnits` does not advance.
- Resume after pause continues from saved `distanceUnits`.
- 1000 ms of ticking at default speed produces exactly 200 logical units of distance.

---

## `input-adapter/` - raw events → InputEvent stream

```ts
// input-adapter/index.ts
export interface InputAdapterDeps {
  readonly now: () => number;          // injectable for tests; default: performance.now
  readonly emit: (e: InputEvent) => void;
}

export interface InputAdapter {
  /** Hook a DOM-style keyboard event. Caller bridges from Phaser or the raw DOM. */
  handleKeyDown(e: { key: string; repeat: boolean }): void;
  /** Begin a touch gesture. */
  handlePointerDown(x: number, y: number): void;
  /** Continue a touch gesture (optional; not needed for swipe detection). */
  handlePointerMove(x: number, y: number): void;
  /** End a touch gesture; may emit a swipe InputEvent. */
  handlePointerUp(x: number, y: number): void;
}

export function createInputAdapter(deps: InputAdapterDeps): InputAdapter;
```

**Behaviour**:

- Recognised keys: `ArrowLeft`, `a`, `A` -> direction `'left'`; `ArrowRight`, `d`, `D` -> direction `'right'`. All other keys are ignored.
- `repeat === true` keydown events are dropped (G2 in research.md).
- Swipe recognition (G3): on `handlePointerUp`, compute (dx, dy, dt) from the matching `handlePointerDown`. If thresholds in `shared/config.ts` pass, emit a swipe `InputEvent`.
- Coalesce window (G3): if a same-`direction` event was emitted within `INPUT_COALESCE_WINDOW_MS`, drop the new one.

**Unit-test obligations**:

- Auto-repeat suppression (one event for `down{repeat:false}` + `down{repeat:true}` x N).
- Swipe threshold: 25 px horizontal -> no event; 30 px horizontal -> event.
- Vertical-dominant swipes ignored.
- Coalesce window applies cross-source (keyboard + touch within 50 ms).

```ts
// input-adapter/swipe-detector.ts (internal; not re-exported)
export function detectSwipe(
  start: { x: number; y: number; tMs: number },
  end: { x: number; y: number; tMs: number }
): Direction | null;
```

`detectSwipe` is exported only inside the module for separate unit testing. It is NOT re-exported from `input-adapter/index.ts` - external callers go through the adapter.

---

## `renderer/` - the only module that touches Phaser sprites

```ts
// renderer/index.ts
import type { PlayerState, WorldState } from '../shared/types';

export interface RunnerRenderer {
  /** Called once per Phaser update. Reads state, draws frame. */
  draw(player: PlayerState, world: WorldState): void;
  /** Called on Scale Manager resize. Updates internal display dimensions. */
  resize(widthPx: number, heightPx: number): void;
  /** Tears down created GameObjects on scene exit. */
  destroy(): void;
}

export function createRunnerRenderer(scene: Phaser.Scene): RunnerRenderer;

export interface DebugOverlay {
  update(player: PlayerState, world: WorldState, lastInput?: InputEvent): void;
  destroy(): void;
}

export function createDebugOverlay(scene: Phaser.Scene): DebugOverlay;
```

**Behaviour**:

- `createRunnerRenderer(scene)` instantiates Phaser GameObjects (three lane rectangles + one player rectangle) parented to `scene`.
- `draw(player, world)` reads logical lane positions, maps them to scene coordinates, sets the player sprite's x. Does NOT mutate inputs.
- `createDebugOverlay` returns a no-op stub when `DEBUG === false`; otherwise creates a small text overlay top-left.
- `RunnerRenderer` and `DebugOverlay` MUST own their Phaser GameObjects and tear them down on `destroy()` to avoid leaks across scene transitions.

**Test obligations**: smoke test only (mounts the renderer in a JSDOM-backed Phaser headless mode and asserts no errors). Per Constitution II, visual code is exempt from strict TDD.

---

## `phaser/` - Scenes (integration glue)

```ts
// phaser/phaser-config.ts
export const GAME_CONFIG: Phaser.Types.Core.GameConfig;

// phaser/scenes/boot-scene.ts
export class BootScene extends Phaser.Scene { ... }

// phaser/scenes/start-scene.ts
export class StartScene extends Phaser.Scene { ... }

// phaser/scenes/run-scene.ts
export class RunScene extends Phaser.Scene { ... }
```

**Rules**:

- Scenes MUST NOT contain game logic. They:
  1. Instantiate the relevant pure modules (`createPlayerState()`, `createWorldState()`, `createInputAdapter(...)`).
  2. Bridge Phaser input events into `input-adapter.handleKeyDown` / `handlePointerDown` / etc.
  3. Call `tickPlayer` and `tickWorld` each Phaser update tick, using `delta` from `update(time, delta)`.
  4. Call `renderer.draw(player, world)`.
- Scenes MAY import from `renderer/` and from any `*/index.ts` re-export.
- Scenes MUST NOT mutate `PlayerState` or `WorldState` directly - they replace them by reassigning the result of pure-module calls.

---

## `main.ts` - entrypoint

```ts
// main.ts
// 1. Read DEBUG from URL query.
// 2. Create the Phaser game with GAME_CONFIG.
// 3. Wire `window.addEventListener('visibilitychange', ...)` -> pause/resume.
// No exports.
```

This is the only place that ties the modules together at runtime. It is intentionally tiny.

---

## Boundary enforcement (lint rule sketch)

The `.eslintrc.cjs` adds a `no-restricted-imports` configuration roughly equivalent to:

```js
rules: {
  'no-restricted-imports': ['error', {
    patterns: [
      { group: ['phaser', 'phaser/*'], message: 'Only renderer/ and phaser/ may import from Phaser.' },
      { group: ['*/runner-engine/!(index)', '*/lane-state/!(index)', '*/input-adapter/!(index)', '*/renderer/!(index)'],
        message: 'Import from a module via its index.ts only.' },
    ],
  }],
},
overrides: [
  { files: ['src/renderer/**', 'src/phaser/**', 'src/main.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      // remove the phaser ban for these files
      { group: ['*/runner-engine/!(index)', '*/lane-state/!(index)', '*/input-adapter/!(index)', '*/renderer/!(index)'],
        message: 'Import from a module via its index.ts only.' },
    ]}] },
  },
],
```

The exact wording will be tuned in implementation; the *intent* (Phaser is allowed only in the integration layer; pure modules expose only `index.ts`) is the contract.
