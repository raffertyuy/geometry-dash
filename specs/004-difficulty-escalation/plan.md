# Implementation Plan: Difficulty Escalation by Tier

**Branch**: `004-difficulty-escalation` | **Date**: 2026-05-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-difficulty-escalation/spec.md`

**Note**: Companion artifacts: [research.md](./research.md), [data-model.md](./data-model.md), [contracts/module-contracts.md](./contracts/module-contracts.md), [quickstart.md](./quickstart.md).

## Summary

Every 30 seconds of running time the run speed jumps to 1.10x of the previous tier and the score-per-100ms increment increases by +1. Tier is derived purely from `WorldState.tickMs` so pause / restart behaviour is automatic. Two-function pure module + a piecewise rewrite of `computeScore` + a tiny optional parameter on `tickWorld` + one-line wiring in the game-loop.

**Approach**: A new pure-logic module `src/escalation/` exposes `currentTier(tickMs)` and `speedMultiplier(tier)`. The existing `src/score/score.ts`'s `computeScore` is rewritten as a closed-form piecewise-linear sum over completed tiers + the current tier's partial contribution. The runner-engine's `tickWorld(world, dtMs, speedOverride?)` gains an optional third argument; when supplied, distance accumulates at `speedOverride` rather than `world.speedUnitsPerSec`. The game-loop computes `effective = RUN_SPEED_UNITS_PER_SEC * speedMultiplier(currentTier(world.tickMs))` each frame and passes it as the override. World state stays immutable.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) - unchanged.

**Primary Dependencies**: No new dependencies. Existing only.

**Storage**: None for this slice. Tier is derived; nothing to persist.

**Testing**: Vitest in `node` environment. New tests for the escalation module + rewritten score tests + new runner-engine tickWorld signature tests + new integration case for the cross-tier speed change.

**Target Platform**: Same as previous slices.

**Project Type**: Single project - static web app.

**Performance Goals**: Same 60 FPS / 30 FPS budgets. New per-frame work:
- Two arithmetic ops per frame to compute `effective_speed` (one `Math.floor`, one `Math.pow`).
- Score computation per frame is now `Math.floor` + a few multiplications - negligible.

No measurable perf impact.

**Constraints**:
- Critical JS budget: <= 500 KB gzipped (current 145.31 KB; this slice adds ~1-2 KB).
- Boundary: `src/escalation/` is pure logic; MUST NOT import `three` or DOM. Existing ESLint rule already enforces.
- WorldState stays immutable. Use the `speedOverride` parameter approach rather than mutating `world.speedUnitsPerSec`.
- No upper bound on tier - the formula `Math.pow(1.10, tier)` continues to produce a value even at tier 1000+ (`1.10^1000` is a huge number, but it's still finite). JavaScript's `Math.pow` handles this without overflow until ~tier 7400 (where it'd exceed `Number.MAX_VALUE`); no need to clamp.

**Scale/Scope**: ~50 LOC of new logic (`escalation` module), ~30 LOC of changes to existing `score.ts`, ~15 LOC of changes to `runner-engine.ts` (add optional param), ~3 LOC of changes to `game-loop.ts`. Tests add ~150 LOC across 4 files. Total: ~250 LOC.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0.

### Principle I - Simplicity & YAGNI

- [x] **No new dependencies.** Two new functions + a rewrite of an existing one + one-line wiring.
- [x] **No new persistent state.** Tier is derived from `tickMs`. Adding a `state.tier` field would be redundant and create the "are these two values in sync?" risk class.
- [x] **No event bus, no observer pattern.** Each frame the game-loop calls `currentTier(world.tickMs)` directly. Simple, deterministic, testable.
- [x] **Optional parameter (`speedOverride`) rather than a config flag or strategy pattern.** The default behaviour is unchanged; existing 116 tests pass without modification of their call sites.

### Principle II - Test-First Discipline

- [x] **All new pure functions get unit tests before implementation.**
  - `src/escalation/escalation.test.ts`: `currentTier` boundary cases (0 / 29999 / 30000 / 59999 / 60000 / ...); `speedMultiplier` for tier 0 through 10.
  - `src/score/score.test.ts`: rewritten - the simple-formula tests (e.g. `computeScore(100_000) === 1000`) are dropped; the new piecewise test cases match `spec.md` SC-002..SC-006 by exact integer values. Monotonicity sweep across 0..600_000 ms.
  - `src/runner-engine/runner-engine.test.ts`: `tickWorld(world, dtMs)` continues to work (existing tests); `tickWorld(world, dtMs, speedOverride)` uses the override when supplied.
- [x] **Integration test extended.** A new case in `tests/integration/lane-switch-flow.test.ts` runs the world through the 30 s mark and asserts the per-frame distance gain at `tickMs >= 30000` is roughly 1.10x the gain at `tickMs < 30000`.

### Principle III - Library-First / Modular Design

- [x] **`src/escalation/` is a new self-contained module** with a single public entrypoint (`src/escalation/index.ts`). Two functions; no internal coupling with `src/score/` or `src/runner-engine/`.
- [x] **Why escalation is its own module, not part of `score/`**: the tier derivation is shared by speed scaling (which lives in the runner-engine call path) AND score scaling (which lives in `score/`). Putting it inside either would couple the other to it; a separate module keeps `score/` and `runner-engine/` cleanly separable.
- [x] **`escalation/` MUST NOT import `three` or DOM** - the existing `no-restricted-imports` ESLint rule already enforces this. No rule change.
- [x] **Optional parameter on `tickWorld`** is a backward-compatible extension that does not couple the runner-engine to the escalation concept. The runner-engine remains tier-agnostic; the GAME-LOOP is where the two combine.

### Principle IV - Observability & Debuggability

- [x] **State transitions emit a structured `console.debug` event.** New event: `tier_advanced` (with previous tier, new tier, tickMs at the moment of advancement). Emitted by the game-loop the first frame after a tier boundary is crossed.
- [x] **Existing debug overlay (`?debug=1`)** already shows `tickMs`. Adding the current tier and the effective speed to the overlay is a one-line addition; the player can verify the formula in real time.

**Result**: ✅ All gates pass on initial check. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/004-difficulty-escalation/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── contracts/
│   └── module-contracts.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md   (created by /speckit-tasks)
```

### Source Code (repository root)

```text
geometry-dash/
├── src/
│   ├── escalation/                  # NEW pure-logic module
│   │   ├── index.ts                 # re-exports
│   │   ├── escalation.ts            # currentTier + speedMultiplier
│   │   └── escalation.test.ts
│   ├── score/                       # MODIFIED
│   │   ├── score.ts                 # computeScore rewritten piecewise
│   │   └── score.test.ts            # tests rewritten to match new formula
│   ├── runner-engine/               # MODIFIED
│   │   ├── runner-engine.ts         # tickWorld gains optional speedOverride
│   │   └── runner-engine.test.ts    # extended with override cases
│   ├── game/
│   │   └── game-loop.ts             # uses speedMultiplier each frame; emits tier_advanced
│   ├── renderer/                    # UNCHANGED (reads distance from WorldState)
│   ├── shared/                      # UNCHANGED
│   ├── input-adapter/               # UNCHANGED
│   ├── lane-state/                  # UNCHANGED
│   └── obstacles/                   # UNCHANGED
└── tests/
    └── integration/
        └── lane-switch-flow.test.ts # extended with cross-tier speed check
```

**Structure Decision**: Single-project static web app, unchanged. `escalation/` sits alongside the other pure-logic modules and is the only new folder.

## Phase 0 - Outline & Research

See [research.md](./research.md). Slice-specific decisions:

- **Why `escalation/` as a separate module** (vs folding into `score/` or `runner-engine/`).
- **Optional `speedOverride` parameter** vs mutating `WorldState.speedUnitsPerSec` each frame.
- **Closed-form score formula** (`O(1)` per frame) vs accumulating a running total each tick.
- **Boundary semantics** at exactly `tickMs = 30000`: floor-based tier, so 29999 is tier 0 and 30000 is tier 1.
- **No upper bound on tier**: spec is explicit; `Math.pow(1.10, tier)` is finite until ~tier 7400 even in IEEE 754 double precision.

## Phase 1 - Design & Contracts

See [data-model.md](./data-model.md) and [contracts/module-contracts.md](./contracts/module-contracts.md).

- **Entities**: just one derived value (the `tier` integer). No new persistent type.
- **Module contract**: `src/escalation/` exposes two pure functions. `src/score/score.ts` keeps the same exports (`computeScore`, `formatScore`, `formatTimer`) but `computeScore`'s behaviour changes. `src/runner-engine/runner-engine.ts`'s `tickWorld` signature gains an optional third parameter.
- **No DOM contract changes**: the HUD elements (`#score`, `#timer`) keep displaying whatever the score and timer functions return.

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1.*

- [x] `src/escalation/` lives in pure-logic territory with the same boundary rules as `lane-state`, `runner-engine`, `score`, `obstacles`. **Principle III holds.**
- [x] No new state added; only derived values. **Principle I holds.**
- [x] Test obligations declared up-front for every changed function. **Principle II holds.**
- [x] `tier_advanced` console.debug event preserves observability. **Principle IV holds.**

**Result**: ✅ Post-design re-check passes.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)*  | -          | -                                    |
