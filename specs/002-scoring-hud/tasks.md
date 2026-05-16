---
description: "Dependency-ordered tasks for the Scoring HUD slice (002-scoring-hud)"
---

# Tasks: Scoring HUD

**Input**: Design documents from `specs/002-scoring-hud/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/module-contracts.md](./contracts/module-contracts.md), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. Constitution Principle II (Test-First) - the three pure functions in `src/score/` get unit tests written before their implementations. The new integration case (pause does not advance the score) is also written first.

**Organization**: Tasks are grouped by user story. US1 (P1) is the score readout MVP; US2 (P2) layers the elapsed timer on top of the same module + HUD container.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared incomplete dependencies).
- **[Story]**: `[US1]` or `[US2]`. Setup, Foundational, and Polish phases have no story label.
- File paths in descriptions are exact and align with the project structure in [plan.md](./plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

This slice inherits the full Vite + TypeScript + Vitest + Three.js + ESLint setup from 001-lane-runner. No project-level setup work is required.

*(no tasks)*

---

## Phase 2: Foundational (Blocking Prerequisites)

This slice does NOT introduce any new shared types or new tunables. The existing `WorldState` (from `src/shared/types.ts`) and the existing `tickMs` field are sufficient.

*(no tasks)*

---

## Phase 3: User Story 1 - Live score readout (Priority: P1) 🎯 MVP

**Goal**: A score readout sits in the top-right of the viewport while a run is active, starts at `0`, increments by 1 every 100 ms of running time, freezes on pause, resumes on un-pause, and resets to `0` when a new run begins.

**Independent Test**: `npm run dev`, dismiss the start screen, watch the score. At ten continuous seconds the score reads close to `100`. Tab-switch for five seconds and return: score is unchanged. Resume input: score continues from the same value.

### Tests for User Story 1 (write FIRST, assert red, then implement)

- [ ] T001 [P] [US1] Write unit tests for `computeScore` and `formatScore`: `computeScore(0) === 0`, `computeScore(99) === 0`, `computeScore(100) === 1`, `computeScore(199) === 1`, `computeScore(200) === 2`, `computeScore(10_000) === 100` (spec SC-002 invariant), a monotonicity sweep across 0..700_000 ms in 100 ms steps asserting non-decreasing output, and a no-skip-or-duplicate sweep asserting the score sequence is `0, 1, 2, ...` with no gaps. Plus `formatScore(0) === '0'`, `formatScore(42) === '42'`, `formatScore(100000) === '100000'`. File: `src/score/score.test.ts`.
- [ ] T002 [US1] Extend `tests/integration/lane-switch-flow.test.ts` with a new case: a run is started; tickWorld is called repeatedly; the world is paused via `pauseRun`; tickWorld is called again (large delta) while paused; `computeScore(world.tickMs)` MUST NOT advance. After `resumeRun`, further tickWorld calls advance the score again. This case is the integration-level proof of spec FR-005.

### Implementation for User Story 1

- [ ] T003 [P] [US1] Implement `src/score/score.ts` with `computeScore(tickMs: number): number` returning `Math.floor(tickMs / 100)` and `formatScore(score: number): string` returning `String(score)`. Re-export both from `src/score/index.ts`. File: `src/score/score.ts` and `src/score/index.ts`.
- [ ] T004 [US1] Make all unit tests from T001 pass. Iterate only on T003's implementation files. **Blocked by**: T001, T003.
- [ ] T005 [US1] Make the integration test from T002 pass (will pass automatically once T003 lands, since the score derives from the already-correct `tickMs`). **Blocked by**: T002, T003.
- [ ] T006 [US1] Update `index.html`: add a `<div id="hud">` container (position: fixed, top: 0, pointer-events: none, full-viewport width) and a `<div id="score">0</div>` child inside it (top-right, font-size clamp, monospace-ish). Add the new CSS rules inside the same `<style>` block as the existing overlay styles. File: `index.html`.
- [ ] T007 [US1] Extend `GameLoopHostElements` in `src/game/game-loop.ts` with `readonly score: HTMLElement`. Inside the rAF loop (in the `'running'` branch, after `tickWorld`), add `host.score.textContent = formatScore(computeScore(world.tickMs))`. File: `src/game/game-loop.ts`.
- [ ] T008 [US1] Update `src/main.ts`: resolve `#score` via `document.querySelector('#score')`, validate non-null (log + return on missing), and pass it to `createGameLoop({ ..., score })`. File: `src/main.ts`.
- [ ] T009 [US1] Manual validation per [quickstart.md](./quickstart.md) §"Validate the slice (US1 - score readout)" - all five US1 acceptance scenarios in spec.md pass on a real desktop browser at `localhost:5173`.

**Checkpoint**: US1 is fully functional - the player sees a live, pause-aware score readout. This is shippable as the slice's MVP.

---

## Phase 4: User Story 2 - Elapsed run timer (Priority: P2)

**Goal**: A timer reads `0:00` at the top-centre of the viewport when a run begins, ticks forward in sync with real seconds during running time, freezes on pause, and rolls cleanly from `M:SS` to `MM:SS` at the ten-minute mark.

**Independent Test**: `npm run dev`, start a run, watch the timer. After approximately 65 seconds of continuous running the timer reads `1:05` (±1 second). Tab-switch for ten seconds and return: timer unchanged. Resume: timer continues at the right cadence.

### Tests for User Story 2

- [ ] T010 [P] [US2] Extend `src/score/score.test.ts` with unit tests for `formatTimer`: `formatTimer(0) === '0:00'`, `formatTimer(999) === '0:00'`, `formatTimer(1_000) === '0:01'`, `formatTimer(59_999) === '0:59'`, `formatTimer(60_000) === '1:00'`, `formatTimer(599_999) === '9:59'`, `formatTimer(600_000) === '10:00'` (the M:SS -> MM:SS transition), `formatTimer(5_999_999) === '99:59'`, `formatTimer(6_000_000) === '100:00'`.

### Implementation for User Story 2

- [ ] T011 [US2] Add `formatTimer(tickMs: number): string` to `src/score/score.ts` and re-export from `src/score/index.ts`. Algorithm per data-model.md: `totalSeconds = Math.floor(tickMs / 1000); minutes = Math.floor(totalSeconds / 60); seconds = totalSeconds % 60; pad seconds to 2 digits; pad minutes to 2 digits at minutes >= 10`. **Blocked by**: T010.
- [ ] T012 [US2] Make the new T010 tests pass by iterating on T011's implementation. **Blocked by**: T010, T011.
- [ ] T013 [US2] Update `index.html`: add a `<div id="timer">0:00</div>` child INSIDE the existing `#hud` container (added in T006), positioned top-centre. Add CSS rules for `.hud-timer` (centred, slightly larger font for readability). File: `index.html`.
- [ ] T014 [US2] Extend `GameLoopHostElements` in `src/game/game-loop.ts` with `readonly timer: HTMLElement`. Inside the rAF loop (next to the `host.score.textContent = ...` line from T007), add `host.timer.textContent = formatTimer(world.tickMs)`. File: `src/game/game-loop.ts`.
- [ ] T015 [US2] Update `src/main.ts`: resolve `#timer` via `document.querySelector('#timer')`, validate non-null, pass it into `createGameLoop({ ..., timer })`. File: `src/main.ts`.
- [ ] T016 [US2] Manual validation per [quickstart.md](./quickstart.md) §"Validate the slice (US2 - timer)" - all four US2 acceptance scenarios in spec.md pass on a real desktop browser. Note: the 10-minute boundary check is optional (time-permitting).

**Checkpoint**: US1 AND US2 both work independently. The HUD shows both indicators; both pause cleanly.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Run quality gates, validate the layout at narrow viewports, and confirm definition-of-done.

- [ ] T017 Run `npm run typecheck`; resolve any TypeScript errors that surface.
- [ ] T018 Run `npm run lint`; resolve any boundary violations. The `src/score/` module MUST NOT import `three` or any DOM types - the existing `no-restricted-imports` rule will catch this.
- [ ] T019 Run `npm run build`; verify `dist/` contains the production bundle and that the gzipped size of `dist/assets/index-*.js` is still under the 500 KB Constitution budget. Manual / shell step.
- [ ] T020 Validate the HUD layout on a narrow viewport (Chrome DevTools -> Device Toolbar -> "iPhone SE" or any 320 px wide preset). Both readouts MUST remain legible (font size >= 16 CSS px) and MUST NOT consume pointer events. Per [quickstart.md](./quickstart.md) §"Validate the HUD layout on a narrow viewport".
- [ ] T021 Final end-to-end validation per [quickstart.md](./quickstart.md) §"Definition of done" - tick every checkbox.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: empty - no work required (inherits from 001).
- **Foundational (Phase 2)**: empty - no new shared types or tunables.
- **User Story 1 (Phase 3)**: depends only on the existing `runner-engine` + `game-loop` from 001-lane-runner (already on `main`).
- **User Story 2 (Phase 4)**: soft-depends on US1 because both stories share the `#hud` container in `index.html` and the same `src/score/` module file. T006 (US1) must precede T013 (US2), and T007 (US1) must precede T014 (US2).
- **Polish (Phase 5)**: depends on US1 and US2 being complete.

### User Story Dependencies

- **US1 (P1)**: standalone. Can be tested and demoed alone as the MVP.
- **US2 (P2)**: extends US1's `#hud` container and `src/score/` module. Logically independent (the timer derivation does not touch the score derivation), but the file overlap means US2 should sequence after US1.

### Within Each User Story

- Tests are written BEFORE implementations (Constitution II).
- `src/score/score.ts` is the same file for both stories - the score functions land first, then `formatTimer` is appended.
- `index.html` is edited twice (once in T006 to add `#hud` + `#score`, once in T013 to add `#timer` inside `#hud`).
- `src/game/game-loop.ts` is edited twice (T007 adds the score field + textContent write, T014 adds the timer field + textContent write).
- `src/main.ts` is edited twice (T008 resolves `#score`, T015 resolves `#timer`).

### Parallel Opportunities

- T001 (write score tests) and T003 (implement score) cannot run truly parallel because T003 should land AFTER T001's tests are red; but they can be drafted in parallel by the same author and then sequenced.
- T010 (write timer tests) is `[P]` against any US1 work that is still in flight - timer tests don't import the score code paths.

---

## Parallel Example: User Story 1

```text
# Stage 1: write tests (red)
T001 - src/score/score.test.ts
T002 - tests/integration/lane-switch-flow.test.ts

# Stage 2: implement
T003 - src/score/score.ts + src/score/index.ts

# Stage 3: drive tests green (sequential, by definition)
T004 - confirm T001 green
T005 - confirm T002 green

# Stage 4: HTML / wiring (sequential, all in same files)
T006 - index.html
T007 - src/game/game-loop.ts
T008 - src/main.ts

# Stage 5: manual acceptance
T009 - browser at localhost:5173
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 3 (US1) end-to-end.
2. **STOP and VALIDATE**: complete T009 manual acceptance.
3. Optionally ship US1 alone (the slice still feels meaningful with just the score).

### Incremental Delivery

1. US1 -> test -> demo (live score readout).
2. US2 -> test -> demo (timer added).
3. Polish -> typecheck / lint / build verified -> merge to main.

---

## Notes

- `[P]` tasks touch different files and have no incomplete-task dependencies.
- `[Story]` label maps each task back to a user story for traceability into [spec.md](./spec.md).
- Tests MUST fail before their matching implementation lands (Constitution II).
- Commit at every checkpoint or logical group; the git extension auto-commit hooks are available.
- Avoid: changing file paths from those listed in this file; slipping `three` imports into `src/score/` (will fail the ESLint boundary rule).
