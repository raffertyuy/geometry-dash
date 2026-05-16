# Module Contracts: Scoring HUD (Phase 1)

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-05-16

The scoring HUD slice adds **one new pure-logic module** (`src/score/`) and **two new DOM elements** (`#score`, `#timer`). It does NOT change any existing module's public API.

Module dependency direction (after this slice):

```
game/    ──┐
           ├──► renderer/ ──► shared/
main.ts ──┘
           │
           ├──► runner-engine/ ─┐
           ├──► lane-state/ ────┤
           ├──► input-adapter/ ─┤─► shared/
           └──► score/ ─────────┘
```

The `score/` module sits at the same layer as `lane-state`, `runner-engine`, `input-adapter`. It depends only on `shared/types.ts` (for the `WorldState` type signature) and is consumable by `game/game-loop.ts`.

ESLint boundary: `score/` is a pure-logic module - **MUST NOT** import `three`, `three/*`, or any DOM types. The existing `no-restricted-imports` rule already forbids this; no rule change needed.

---

## `score/` - pure score and timer derivations

```ts
// score/index.ts
export { computeScore, formatScore, formatTimer } from './score';

// score/score.ts (signatures)
export function computeScore(tickMs: number): number;
export function formatScore(score: number): string;
export function formatTimer(tickMs: number): string;
```

### `computeScore(tickMs)`

- **Input**: `tickMs` (non-negative number, accumulated running time in ms).
- **Output**: integer score (≥ 0).
- **Behaviour**: returns `Math.floor(tickMs / 100)`.
- **Invariants**:
  - `computeScore(0) === 0`
  - `computeScore(99) === 0`
  - `computeScore(100) === 1`
  - For any `a ≤ b`: `computeScore(a) ≤ computeScore(b)`.
- **Total function**: no exceptions; negative or fractional inputs are tolerated (they produce a non-positive or floored integer respectively), although the caller is expected to pass a non-negative integer-ms value.

### `formatScore(score)`

- **Input**: integer score.
- **Output**: string representation, currently `String(score)` with no thousands separator.
- **Rationale for the separate function**: gives a single point of change for future locale-aware formatting without touching the game-loop call site.

### `formatTimer(tickMs)`

- **Input**: `tickMs` (non-negative number, accumulated running time in ms).
- **Output**: formatted time string in `M:SS` form (for minutes 0-9) or `MM:SS` form (for minutes 10+).
- **Invariants**:
  - `formatTimer(0) === '0:00'`
  - `formatTimer(999) === '0:00'` (sub-second values round down to `0:00`).
  - `formatTimer(1_000) === '0:01'`
  - `formatTimer(59_999) === '0:59'`
  - `formatTimer(60_000) === '1:00'`
  - `formatTimer(599_999) === '9:59'`
  - `formatTimer(600_000) === '10:00'` (M:SS -> MM:SS transition)
  - `formatTimer(5_999_999) === '99:59'`
  - `formatTimer(6_000_000) === '100:00'`
- **Total function**: no exceptions.

**Unit-test obligations** (Constitution II):

- The 9 explicit invariants above are individual test cases.
- Plus: monotonicity sweep - 0 to 700_000 ms in 100 ms steps, asserting `computeScore` is non-decreasing.
- Plus: confirming the per-100-ms increment never skips a value (no duplicate or missing integers in the score sequence).

---

## DOM contract (added to `index.html`)

Two new elements inside a single `#hud` container:

```html
<div id="hud" class="hud">
  <div id="timer" class="hud-timer">0:00</div>
  <div id="score" class="hud-score">0</div>
</div>
```

**Rules**:

- `#hud` MUST have `position: fixed`, `top: 0`, full-viewport width, and `pointer-events: none` so taps on it pass through to the canvas.
- `#timer` MUST be horizontally centred at the top of the viewport.
- `#score` MUST be right-aligned at the top-right corner.
- Both children MUST have `font-size: clamp(1rem, 2.5vw, 1.5rem)` (or equivalent) so the readouts scale legibly between 320 px phones and 4K monitors.
- Both children MUST use the project's existing system-ui font stack (inherited from `<body>`).

**Initial content**: `#timer` starts at `0:00`, `#score` starts at `0`. The first frame after game-loop init overwrites both via `textContent`, so the initial values are also valid for testers who load the page on the start screen.

---

## `game/game-loop.ts` integration (delta)

The existing `GameLoopHostElements` interface gains two fields:

```ts
export interface GameLoopHostElements {
  readonly canvas: HTMLCanvasElement;
  readonly startScreen: HTMLElement;
  readonly pauseOverlay: HTMLElement;
  readonly debugOverlay: HTMLElement;
  readonly score: HTMLElement;   // NEW
  readonly timer: HTMLElement;   // NEW
}
```

Inside the rAF loop, after `tickWorld` and `renderer.draw`, two lines are added:

```ts
host.score.textContent = formatScore(computeScore(world.tickMs));
host.timer.textContent = formatTimer(world.tickMs);
```

(Equivalent positions: also OK to write them before the renderer.draw call - they're independent of the 3D scene.)

`src/main.ts` resolves the two new elements via `document.querySelector('#score')` and `document.querySelector('#timer')` and passes them into `createGameLoop`. Existing bootstrap-error path covers the missing-element case.
