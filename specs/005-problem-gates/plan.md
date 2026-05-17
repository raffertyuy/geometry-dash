# Implementation Plan: Problem Gates with Lives and Multi-strike Game Over

**Branch**: `005-problem-gates` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-problem-gates/spec.md`

**Note**: Companion artifacts: [research.md](./research.md), [data-model.md](./data-model.md), [contracts/module-contracts.md](./contracts/module-contracts.md), [quickstart.md](./quickstart.md).

## Summary

The slice introduces (a) problem gates as a sibling collidable to obstacles with a placeholder geometry-question modal, (b) a 3-lives system with a 3-second post-respawn invincibility window, and (c) two game-over conditions — zero lives OR negative cumulative score. Two new pure-logic modules: `src/problem-gates/` (gate catalogue, per-row spawn augmentation, gate-collision predicate) and `src/problems/` (placeholder question pool + selection). Three new renderer-side DOM helpers under `src/renderer/`: `problem-modal.ts` (modal adapter), `lives-hud.ts` (heart icons), `floating-score.ts` (+N/-N animations). `WorldState` gains four fields (`lives`, `invincibilityRemainingMs`, `scoreDelta`, `activeGate`) and a new `runState` value `'answering'`. The score formula gains an optional `scoreDelta` parameter. No new npm dependencies — placeholder problems are inline TypeScript data.

**Approach**: Every row produced by the existing obstacle generator is augmented with per-lane gate decisions via `augmentRowWithGates(...)` from `problem-gates/`. Gates and obstacles share the same `worldZ` scrolling and culling logic. On an obstacle collision, the game-loop checks `invincibilityRemainingMs > 0` first; if not invincible it calls `consumeLife(world, 'obstacle')`. On a gate collision it calls `enterAnswering(world, gate)` which freezes the world (`tickWorld` no-ops in `'answering'`) and stores the active gate. The modal adapter shows the placeholder problem and waits for an answer commit; on commit the game-loop calls `resolveAnswer(world, isCorrect, points)` which writes `scoreDelta`, decrements lives on wrong, transitions back to `'running'`. Two game-over checks fire at the end of `consumeLife` and `resolveAnswer`: lives reaching 0, or `(tickDerived + scoreDelta) < 0`. Floating +N/-N animations are spawned renderer-side on each answer commit.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) — unchanged.

**Primary Dependencies**: No new runtime dependencies. Three.js, Vite, Vitest as before. The spec acknowledges real diagrams + equation typesetting (e.g. KaTeX, SVG primitives) come in a later slice; this slice's placeholder pool is text-only.

**Storage**: None. All new state is in-memory `WorldState` fields, reset on every `restartRun`.

**Testing**: Vitest in the `node` environment for all pure-logic modules (problem-gates, problems, runner-engine, score). The new renderer DOM helpers follow the existing `debug-overlay.ts` pattern; DOM-state tests use the existing jsdom override. Three.js cube-mesh rendering is exempt from strict tests per Principle II (visual code is smoke-tested only).

**Target Platform**: Same as previous slices — modern evergreen desktop + mobile browsers, mobile-first.

**Project Type**: Single project — static web app.

**Performance Goals**: Same 60 FPS / 30 FPS budgets. Per-frame additions are small:

- Gate list advance + cull + collision check: O(active gates), bounded by the cull distance and spawn cadence (identical envelope to obstacles).
- `invincibilityRemainingMs` countdown: one subtraction per frame while > 0.
- Score formula adds a constant `scoreDelta` — one extra addition per frame.
- Modal-open frames skip the entire running-loop block (`tickWorld` early-returns), so they're cheaper than running frames.

No measurable perf impact at the 60 FPS target.

**Constraints**:

- Critical JS budget: ≤ 500 KB gzipped (current ~145 KB; this slice adds ~5–8 KB across new modules + renderer helpers + placeholder problem text).
- Boundary: `src/problem-gates/` and `src/problems/` MUST be pure logic — no `three`, no DOM imports. Existing ESLint `no-restricted-imports` rule applies.
- WorldState stays immutable. New fields follow the existing "create-replace, never-mutate" pattern; transition functions return new `WorldState` instances.
- Renderer helpers may touch DOM but MUST NOT depend on game-loop internals — they expose factory-adapter pairs (same shape as `createDebugOverlay`).
- Placeholder problem pool is inline TypeScript data, not loaded from JSON or fetched — keeps the offline-capable guarantee from the constitution.

**Scale/Scope**: ~250 LOC new logic (problem-gates + problems + runner-engine extensions + score parameter), ~250 LOC renderer additions (3 DOM helpers + cube mesh integration), ~100 LOC game-loop integration, ~350 LOC tests. Total: ~950 LOC.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0.

### Principle I — Simplicity & YAGNI

- [x] **No new npm dependencies.** Placeholder problems are inline TS data; the modal is a DOM overlay; the cube mesh is a vanilla Three.js `BoxGeometry` with the existing bloom pipeline.
- [x] **No standalone `lives/` module.** Two fields (`lives`, `invincibilityRemainingMs`) + two constants in `shared/config.ts` is below the threshold for a dedicated module. If lives ever acquires power-ups or multiple decrement reasons beyond the two listed in the spec, we extract a module then.
- [x] **No standalone "modal state-machine" abstraction.** The modal has three states (closed / showing / committed) and is driven by a single adapter. No state-pattern, no event bus.
- [x] **Optional `scoreDelta` parameter on `computeScore`** instead of a parallel `computeTotalScore` function. Default 0 keeps all existing tests + call sites unchanged.
- [x] **Reuse existing DOM-overlay pattern** for the modal: same `.overlay` CSS class, same `.hidden` toggle, same z-stack as start / pause / game-over.
- [x] **Reuse existing obstacle scroll + cull loop** for gates. Gates use the same `worldZ` / `previousWorldZ` mechanism and the same cull threshold.

### Principle II — Test-First Discipline

- [x] **All new pure functions get unit tests written before implementation:**
  - `src/problem-gates/`: `augmentRowWithGates(blockedLanes, rng) → gates per non-obstacle lane`; `gateCollidesAt(player, gate)`; gate-catalogue lookups (`difficultyOf(gate.difficulty)`, color, point value).
  - `src/problems/`: `selectPlaceholderProblem(difficulty, rng) → Problem` (pool exhaustiveness, well-formed-payload guard).
  - `src/runner-engine/`: `consumeLife`, `enterAnswering`, `resolveAnswer`, `tickInvincibility` (or whatever the countdown helper is named), updated `restartRun` resetting all new fields, `tickWorld` early-returning on `'answering'`.
  - `src/score/`: `computeScore(tickMs, scoreDelta) === computeScore(tickMs) + scoreDelta`; existing single-arg tests pass unchanged.
- [x] **Integration tests:**
  - `tests/integration/problem-gate-flow.test.ts`: gate collision → modal open → world frozen → correct-answer commit → world resumes → score increased by +1000/+5000/+10000. Mirror with a wrong-answer case asserting life decrement.
  - `tests/integration/lives-flow.test.ts`: obstacle collision → life lost → respawn in centre lane → 3-second invincibility → second obstacle passes harmlessly → invincibility expires → next obstacle costs a life. Final test case: all 3 lives gone → game-over with overlay visible.
- [x] **Renderer DOM helpers** (`problem-modal.ts`, `lives-hud.ts`, `floating-score.ts`) get jsdom smoke tests verifying DOM-node creation and commit-event wiring. Three.js cube-mesh rendering is exempt per the constitution (visual code).

### Principle III — Library-First / Modular Design

- [x] **Two new pure-logic modules** (`src/problem-gates/`, `src/problems/`), each in its own folder with a single `index.ts` public entry. No internal coupling.
  - `problem-gates/` depends only on `shared/` types. It does NOT import `obstacles/`, `score/`, `lane-state/`, `runner-engine/`, or renderer.
  - `problems/` depends on nothing — pure data + selection.
- [x] **No module reaches into another's internals.** Renderer helpers consume `WorldState` snapshots; runner-engine doesn't know the modal exists; problem-gates doesn't know about lives.
- [x] **No new Three.js / DOM imports in pure-logic modules.** ESLint `no-restricted-imports` enforces; no rule change needed.
- [x] **Renderer module gains DOM-overlay helpers** consistent with the existing `debug-overlay.ts`. The constitution allows `renderer/` and `game/` to touch Three.js and DOM.

### Principle IV — Observability & Debuggability

- [x] **Structured `console.debug` events at every meaningful transition:**
  - `gate_spawned` `{ id, lane, difficulty, worldZ }`
  - `gate_hit` `{ id, difficulty, playerLane }`
  - `gate_answered` `{ id, difficulty, isCorrect, scoreDelta, livesAfter }`
  - `life_consumed` `{ cause: 'obstacle' | 'wrong-answer', livesAfter }`
  - `invincibility_started` `{ durationMs }`
  - `invincibility_ended` `{ tickMs }`
  - `score_went_negative` `{ tickMs, scoreDelta, totalScore }` — fires the frame the game-over from negative score is triggered
- [x] **Debug overlay extended** to display: lives count, invincibility remaining (when active), active gate (difficulty + lane, when modal is open), running `scoreDelta`. One-line addition per field; no layout reflow.
- [x] **Errors carry context.** The placeholder-problem catalogue throws with a clear message if any difficulty has zero entries; the modal adapter throws if `show()` is called without a problem payload.

**Result**: ✅ All gates pass on initial check. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/005-problem-gates/
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
├── index.html                          # MODIFIED: + #problem-modal overlay, #lives-hud, #floating-scores host
├── src/
│   ├── problem-gates/                  # NEW pure-logic module
│   │   ├── index.ts                    # re-exports
│   │   ├── problem-gates.ts            # augmentRowWithGates, gateCollidesAt, GATE_CATALOGUE
│   │   └── problem-gates.test.ts
│   ├── problems/                       # NEW pure-data module
│   │   ├── index.ts                    # re-exports
│   │   ├── problems.ts                 # PLACEHOLDER_POOL + selectPlaceholderProblem
│   │   └── problems.test.ts
│   ├── shared/
│   │   ├── config.ts                   # MODIFIED: + MAX_LIVES, INVINCIBILITY_DURATION_MS, GATE_POINTS_*, GATE_LANE_PROBABILITY (~25% each)
│   │   └── types.ts                    # MODIFIED: + ProblemGate, Problem, AnswerChoice; + WorldState fields (lives, invincibilityRemainingMs, scoreDelta, activeGate); + RunState 'answering'
│   ├── score/
│   │   ├── score.ts                    # MODIFIED: computeScore gains optional scoreDelta param
│   │   └── score.test.ts               # MODIFIED: + scoreDelta tests
│   ├── runner-engine/
│   │   ├── runner-engine.ts            # MODIFIED: createWorldState + restartRun fill new fields; tickWorld early-returns on 'answering'; + consumeLife, enterAnswering, resolveAnswer, tickInvincibility
│   │   └── runner-engine.test.ts       # MODIFIED: + new transition tests; + 'answering' freeze test; + invincibility countdown tests
│   ├── obstacles/                      # UNCHANGED (gates are a sibling, sharing only the row trigger)
│   ├── lane-state/                     # UNCHANGED
│   ├── input-adapter/                  # UNCHANGED — modal owns its own DOM event listeners
│   ├── escalation/                     # UNCHANGED
│   ├── renderer/
│   │   ├── index.ts                    # MODIFIED: re-exports the three new helpers
│   │   ├── three-renderer.ts           # MODIFIED: + updateGates(gates) with subdivided BoxGeometry cube meshes
│   │   ├── debug-overlay.ts            # MODIFIED: + lives / invincibility / activeGate / scoreDelta rows
│   │   ├── problem-modal.ts            # NEW DOM adapter
│   │   ├── problem-modal.test.ts
│   │   ├── lives-hud.ts                # NEW DOM helper (3 hearts, filled / outlined)
│   │   ├── lives-hud.test.ts
│   │   ├── floating-score.ts           # NEW DOM helper (+N / -N animations)
│   │   └── floating-score.test.ts
│   ├── game/
│   │   └── game-loop.ts                # MODIFIED: gates spawn + advance + cull; gate collision → enterAnswering; modal commit → resolveAnswer; obstacle collision now checks invincibility + lives; restart resets new state; negative-score check fires game-over; emits new console.debug events
│   └── main.ts                         # MODIFIED: bootstraps new DOM refs (#problem-modal, #lives-hud, #floating-scores)
└── tests/
    └── integration/
        ├── lane-switch-flow.test.ts    # UNCHANGED (the cross-tier check from slice 004)
        ├── problem-gate-flow.test.ts   # NEW: collision → modal → commit round-trip
        └── lives-flow.test.ts          # NEW: respawn + invincibility chain
```

**Structure Decision**: Single-project static web app, layout unchanged at top level. Two new pure-logic modules sit alongside the existing siblings. The renderer module gains three small DOM-helper files, each following the `debug-overlay.ts` factory-adapter pattern. WorldState gains fields rather than being decomposed.

## Phase 0 — Outline & Research

See [research.md](./research.md). Slice-specific decisions:

- **`problem-gates/` as a separate module** (vs extending `obstacles/`).
- **`problems/` as a separate pure-data module** (vs inlining the pool in `problem-gates/`).
- **`scoreDelta` field + optional `computeScore` parameter** (vs replacing the closed-form formula with an accumulator).
- **New `RunState` value `'answering'`** (vs a side-channel `activeGate` field that pauses ticking).
- **Modal as `src/renderer/problem-modal.ts` adapter** (vs inline DOM in game-loop, vs top-level `src/modal/`).
- **Lives as two WorldState fields** (vs a dedicated module).
- **Gates piggy-back on the obstacle row trigger** (vs an independent gate spawner with its own cadence).
- **Invincibility duration = 3000 ms constant** (not tunable in this slice).
- **Heart icon shape**: an inline SVG polygon (low-poly heart silhouette) rendered as an HTML `<span class="heart">`, switched to `.heart.empty` when consumed.

## Phase 1 — Design & Contracts

See [data-model.md](./data-model.md) and [contracts/module-contracts.md](./contracts/module-contracts.md).

- **Entities**: `ProblemGate`, `Problem`, `AnswerChoice` (all new); four new `WorldState` fields; one new `RunState` value (`'answering'`). No persistent state — everything resets on `restartRun`.
- **Module contracts**:
  - `src/problem-gates/`: three pure functions + the gate metadata catalogue.
  - `src/problems/`: one selection function + the placeholder pool data.
  - `src/runner-engine/`: four new transition functions + updated lifecycle functions.
  - `src/score/`: `computeScore` gains an optional `scoreDelta` parameter (default 0).
  - `src/renderer/`: three new DOM-adapter factories + `updateGates` extension on the Three.js renderer.
- **DOM contract additions** (in `index.html`):
  - `#problem-modal` overlay with `.problem-text`, three `.answer-choice` elements, a `.is-highlighted` class for keyboard focus.
  - `#lives-hud` HUD region with three `<span class="heart">` elements that gain `.empty` when consumed.
  - `#floating-scores` host element positioned near `#score`; renderer creates `+N` / `-N` children dynamically and removes them after the CSS transition finishes.
- **Terminology**: CLAUDE.md and README updated to use "problem gates" rather than "geometry gates" (FR-017).

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1.*

- [x] `src/problem-gates/` and `src/problems/` live in pure-logic territory with the same boundary rules as the existing pure modules. **Principle III holds.**
- [x] No standalone "lives" module — two fields + two constants. WorldState immutability + closed-form score preserved. **Principle I holds.**
- [x] Every new function carries a declared test obligation; renderer DOM helpers have jsdom smoke tests; pure logic has full unit coverage. **Principle II holds.**
- [x] Seven new `console.debug` event types plus extended debug overlay. **Principle IV holds.**

**Result**: ✅ Post-design re-check passes.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)*  | -          | -                                    |
