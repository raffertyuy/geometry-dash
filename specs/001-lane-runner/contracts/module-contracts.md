# Module Contracts: Lane Runner Core Movement (Phase 1)

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-05-16

This is the public-API surface of every module in this slice. Each module's `index.ts` MUST re-export exactly the symbols listed here - nothing more, nothing less. These are the seams that unit tests assert against and that Constitution Principle III (Library-First) enforces.

Module dependency direction (no cycles):

```
game/    ──┐
           ├──► renderer/ ──► shared/
main.ts ──┘
           └──► runner-engine/ ─┐
           └──► lane-state/ ────┼─► shared/
           └──► input-adapter/ ─┘
```

Only `renderer/` and `game/` may import from the `three` npm package. The other modules MUST be importable in a Node test environment with no DOM/canvas.

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
export const LANE_X: Record<Lane, number>;         // 3D world units: { left: -2, centre: 0, right: 2 }
export const RUN_SPEED_UNITS_PER_SEC: 6;           // world units per second (was 200 logical-px/sec in the 2D era)
export const LANE_SWITCH_DURATION_MS: 200;
export const SWIPE_MIN_HORIZONTAL_PX: 30;          // screen pixels (not world units) - swipes are read from the DOM
export const SWIPE_MAX_DURATION_MS: 500;
export const SWIPE_HORIZONTAL_DOMINANCE: 2;        // |dx| must be >= 2 * |dy|
export const INPUT_COALESCE_WINDOW_MS: 50;
export const DEBUG: boolean;                       // true iff URL ?debug=1
```

Post-pivot the 2D logical canvas constants (`LOGICAL_WIDTH=720`, `LOGICAL_HEIGHT=1280`) are gone - Three.js uses a true 3D world space, not a fixed-resolution canvas. Swipe thresholds remain in screen pixels because they describe a user's finger gesture, which is a DOM concept.

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

## `renderer/` - the only module that touches Three.js

```ts
// renderer/index.ts
import type { PlayerState, WorldState, InputEvent } from '../shared/types';

export interface ThreeRenderer {
  /** Called once per requestAnimationFrame tick. Reads state, mutates the scene, calls renderer.render. */
  draw(player: PlayerState, world: WorldState): void;
  /** Called from a window resize listener. Updates camera aspect + renderer size. */
  resize(widthPx: number, heightPx: number): void;
  /** Tears down GPU resources on shutdown. */
  destroy(): void;
}

export function createThreeRenderer(canvas: HTMLCanvasElement): ThreeRenderer;

export interface DebugOverlay {
  update(player: PlayerState, world: WorldState, lastInput?: InputEvent): void;
  destroy(): void;
}

export function createDebugOverlay(host: HTMLElement): DebugOverlay;
```

**Behaviour**:

- `createThreeRenderer(canvas)` attaches a WebGL renderer to the given canvas, builds a 3D scene (perspective camera, ambient + directional lights, ground plane, lane dividers, scrolling rungs, player mesh), and returns a controller.
- `draw(player, world)` reads `LANE_X` world positions, interpolates `mesh.position.x` via `easeOutCubic(animProgress)`, advances the scrolling rungs in Z by the distance delta, and calls `renderer.render(scene, camera)`. Does NOT mutate inputs.
- `createDebugOverlay(host)` returns a no-op stub when `DEBUG === false`; otherwise toggles visibility on a DOM element with `id="debug-overlay"` (it does NOT create the element - that lives in `index.html`).
- `ThreeRenderer` and `DebugOverlay` MUST own their GPU resources / DOM mutations and tear them down on `destroy()`.

**Test obligations**: smoke test only - currently DEFERRED because Three.js requires a real WebGL context which jsdom does not provide and node-canvas needs Windows native build tools. Per Constitution II, visual code is exempt from strict TDD; manual validation in T028/T036 covers this.

---

## `game/` - integration glue (was `phaser/` pre-pivot)

```ts
// game/game-loop.ts
export interface GameLoopHandles {
  /** Tears down listeners + the renderer. */
  dispose(): void;
}

export interface GameLoopHostElements {
  readonly canvas: HTMLCanvasElement;
  readonly startScreen: HTMLElement;
  readonly pauseOverlay: HTMLElement;
  readonly debugOverlay: HTMLElement;
}

export function createGameLoop(host: GameLoopHostElements): GameLoopHandles;
```

**Rules**:

- The game loop MUST NOT contain game logic. It:
  1. Instantiates the relevant pure modules (`createPlayerState()`, `createWorldState()`, `createInputAdapter(...)`, `createThreeRenderer(canvas)`, `createDebugOverlay(debugOverlay)`).
  2. Owns scene state: `'start-screen' | 'running' | 'paused'`. Initial state is `'start-screen'`.
  3. Bridges DOM keyboard + pointer events into `input-adapter.handleKeyDown` / `handlePointerDown` / `handlePointerUp`. The first key/pointer event in `'start-screen'` state hides the start overlay and transitions to `'running'`.
  4. Runs a `requestAnimationFrame` loop. Each frame computes `dtMs = now - lastNow` (capped at 100 ms), and only when state is `'running'` it calls `tickPlayer`, `tickWorld`, `renderer.draw`, `debugOverlay.update`.
  5. Wires `document.visibilitychange` and `window.blur` -> `pauseRun` + show pause overlay; on visible/focus, set `isAwaitingResume = true` and require any input to resume.
  6. Wires `window.resize` -> `renderer.resize`.
- MAY import from `renderer/`, `three`, and from any `*/index.ts` re-export.
- MUST NOT mutate `PlayerState` or `WorldState` directly - replaces them by reassigning the result of pure-module calls.

---

## `main.ts` - entrypoint

```ts
// main.ts
// 1. Read DEBUG from URL query (already done by shared/config).
// 2. Resolve canvas + overlay DOM elements by id.
// 3. Call createGameLoop({ canvas, startScreen, pauseOverlay, debugOverlay }).
// No exports.
```

This is the only place that ties the DOM to the game-loop module. It is intentionally tiny.

---

## Boundary enforcement (lint rule sketch)

The `eslint.config.js` (flat config) adds a `no-restricted-imports` configuration roughly equivalent to:

```js
rules: {
  'no-restricted-imports': ['error', {
    patterns: [
      { group: ['three', 'three/*'], message: 'Only src/renderer/ and src/game/ may import from Three.js.' },
      { group: ['*/runner-engine/!(index)', '*/lane-state/!(index)', '*/input-adapter/!(index)', '*/renderer/!(index)'],
        message: 'Import from a module via its index.ts only.' },
    ],
  }],
},
overrides: [
  { files: ['src/renderer/**', 'src/game/**', 'src/main.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      // remove the three ban for these files; keep the index.ts-only rule
      { group: ['*/runner-engine/!(index)', '*/lane-state/!(index)', '*/input-adapter/!(index)', '*/renderer/!(index)'],
        message: 'Import from a module via its index.ts only.' },
    ]}] },
  },
],
```

The exact wording will be tuned in implementation; the *intent* (Three.js is allowed only in the integration layer; pure modules expose only `index.ts`) is the contract.
