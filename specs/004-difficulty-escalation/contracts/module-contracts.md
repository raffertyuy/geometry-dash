# Module Contracts: Difficulty Escalation (Phase 1)

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-05-16

This slice adds **one new pure-logic module** (`src/escalation/`) and modifies two existing modules' public contracts (`src/score/`'s `computeScore` behaviour changes, `src/runner-engine/`'s `tickWorld` gains an optional parameter). It changes no DOM, no Three.js code, no runtime state shapes.

Module dependency direction (after this slice):

```
game/    ──┐
           ├──► renderer/ ──► shared/
main.ts ──┘
           │
           ├──► runner-engine/ ─┐
           ├──► lane-state/ ────┤
           ├──► input-adapter/ ─┤
           ├──► score/ ─────────┼─► shared/
           ├──► obstacles/ ─────┤
           └──► escalation/ ────┘
```

`escalation/` is a pure-logic module - **MUST NOT** import `three`, `three/*`, or any DOM types. The existing ESLint `no-restricted-imports` rule already forbids this.

---

## `escalation/` - tier derivation

```ts
// escalation/index.ts
export { currentTier, speedMultiplier } from './escalation';

// escalation/escalation.ts (signatures)
export function currentTier(tickMs: number): number;
export function speedMultiplier(tier: number): number;
```

### `currentTier(tickMs)`

- **Input**: `tickMs` (non-negative number, accumulated running time in ms).
- **Output**: integer tier index (`>= 0`).
- **Behaviour**: returns `Math.floor(tickMs / 30000)`.
- **Invariants**:
  - `currentTier(0) === 0`
  - `currentTier(29999) === 0`
  - `currentTier(30000) === 1`
  - `currentTier(59999) === 1`
  - `currentTier(60000) === 2`
  - Monotonic non-decreasing.
- **Total function**: no exceptions; negative inputs produce `-1` or lower (caller should not pass negatives, but the function is total).

### `speedMultiplier(tier)`

- **Input**: integer tier (`>= 0`).
- **Output**: positive real (`>= 1`).
- **Behaviour**: returns `Math.pow(1.10, tier)`.
- **Invariants**:
  - `speedMultiplier(0) === 1`
  - `speedMultiplier(1) === 1.10` (within float epsilon)
  - `speedMultiplier(2)` is approximately `1.21` (epsilon: `1e-10`)
  - Strictly increasing in `tier`.
- **Total function**: no exceptions; returns `Infinity` only for extremely high tiers (~7400+), well beyond playable range.

**Unit-test obligations** (Constitution II):

- `currentTier`: boundary at each transition (0, 29999, 30000, 59999, 60000, 89999, 90000); monotonicity over 0..600_000 ms sweep.
- `speedMultiplier`: exact values at tier 0 and 1; epsilon-bounded values at tiers 2..10; strict monotonicity over tiers 0..50.

---

## `score/` - `computeScore` BEHAVIOUR CHANGE

The exports are unchanged:

```ts
// score/index.ts (signatures unchanged)
export function computeScore(tickMs: number): number;
export function formatScore(score: number): string;
export function formatTimer(tickMs: number): string;
```

The BEHAVIOUR of `computeScore` changes. The previous slice (002) defined `computeScore(tickMs) = Math.floor(tickMs / 100)`. This slice rewrites it to the piecewise formula in `data-model.md`.

`formatScore` and `formatTimer` are unchanged.

**Unit-test obligations**:

The existing tests for `computeScore` (in `src/score/score.test.ts`) are REWRITTEN:

- `computeScore(0) === 0` (unchanged)
- `computeScore(99) === 0` (unchanged - still tier 0, partial first tick)
- `computeScore(100) === 1` (unchanged - tier 0)
- `computeScore(10_000) === 100` (unchanged - tier 0, full 100 ticks)
- `computeScore(29_900) === 299` (NEW boundary case - still tier 0 just before the flip)
- `computeScore(30_000) === 300` (NEW - tier 1 starts, tier 0 contributed 300)
- `computeScore(30_100) === 302` (NEW - tier 1's first tick adds 2 points)
- `computeScore(35_000) === 400` (NEW - matches spec SC-004)
- `computeScore(60_000) === 900` (NEW - matches spec SC-005)
- `computeScore(90_000) === 1800` (NEW - matches spec SC-006)
- `computeScore(120_000) === 3000` (NEW)
- Monotonicity sweep over 0..600_000 ms in 100 ms steps; no decreases anywhere.

Some of the old "naive formula" tests (e.g., assuming `computeScore(100_000) === 1000`) need to be removed - the new formula returns `2000` at `tickMs = 100_000` (because tiers 0+1+2 have completed plus 10s into tier 3 at rate 4 = 300+600+900 + 100*4 = 1800+400 = wait that doesn't sum right). Let me recompute: at `tickMs = 100000`, tier = 3 (since 90000 <= 100000 < 120000). Completed = 300 * 3 * 4 / 2 = 1800. Current = floor(10000/100) * 4 = 100 * 4 = 400. Total = 2200. So `computeScore(100_000) === 2200`.

---

## `runner-engine/` - `tickWorld` SIGNATURE EXTENDED

```ts
// runner-engine/index.ts (export shape unchanged; the function signature gains an optional param)
export function tickWorld(
  world: WorldState,
  dtMs: number,
  speedOverride?: number,
): WorldState;
```

- **Input**: `world` (current world state), `dtMs` (frame delta), `speedOverride` (optional positive number).
- **Output**: new `WorldState`.
- **Behaviour**:
  - When `speedOverride` is omitted: identical to the previous slice's behaviour; uses `world.speedUnitsPerSec`.
  - When `speedOverride` is supplied: uses `speedOverride` instead of `world.speedUnitsPerSec` to compute the distance gained this frame.
  - The `runState === 'running'` guard is unchanged - `tickWorld` is still a no-op outside of `running`.
- **WorldState mutation**: none. The returned WorldState's `speedUnitsPerSec` is unchanged from the input (we don't write the override into the state, since it would change frame-to-frame).

**Unit-test obligations**:

The existing tests for `tickWorld` (12+ cases) all continue to pass with no modification (they don't supply the third argument). New tests:

- `tickWorld(world, 1000, RUN_SPEED_UNITS_PER_SEC * 1.10)` produces `distanceUnits === RUN_SPEED_UNITS_PER_SEC * 1.10` (i.e. the override is used).
- `tickWorld(world, 1000, RUN_SPEED_UNITS_PER_SEC * 1.21).distanceUnits === RUN_SPEED_UNITS_PER_SEC * 1.21`.
- `tickWorld({...world, runState: 'paused'}, 1000, 9999)` does NOT advance `distanceUnits` (the guard still applies).

---

## `game/game-loop.ts` - WIRING ADDED

Inside the per-frame `'running'` branch:

```ts
import { currentTier, speedMultiplier } from '../escalation';
import { RUN_SPEED_UNITS_PER_SEC } from '../shared/config';

// ... inside the rAF loop:

const tier = currentTier(world.tickMs);
const effectiveSpeed = RUN_SPEED_UNITS_PER_SEC * speedMultiplier(tier);
const previousDistance = world.distanceUnits;
world = tickWorld(world, dtMs, effectiveSpeed);
const distanceDelta = world.distanceUnits - previousDistance;

// emit tier_advanced if tier changed this frame (track in a local variable)
```

A new local variable `lastObservedTier: number` is tracked at the game-loop level. When `tier !== lastObservedTier`, emit `console.debug({ event: 'tier_advanced', previousTier: lastObservedTier, newTier: tier, tickMs: world.tickMs })` and update `lastObservedTier`. On restart, `lastObservedTier` is reset to 0.

---

## DOM contract

**No changes.** `#score` continues to display whatever `formatScore(computeScore(world.tickMs))` returns. `#timer` is unchanged. The game-over overlay's score / time readouts use the same formulas.

The debug overlay (`#debug-overlay`, shown when `?debug=1`) MAY be extended to also display the current tier and effective speed alongside the existing readouts. This is implementation polish and not contractually required - the spec's success criteria are testable without it.
