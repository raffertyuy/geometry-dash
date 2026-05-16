---
description: "Dependency-ordered tasks for the Lane Runner Core Movement slice (001-lane-runner)"
---

# Tasks: Lane Runner Core Movement

**Input**: Design documents from `specs/001-lane-runner/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/module-contracts.md](./contracts/module-contracts.md), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. Constitution Principle II (Test-First Discipline) mandates that pure game logic (lane state, scoring, input recognition, world tick) MUST have unit tests, and cross-cutting flows MUST have an integration test. Test tasks for each module are written BEFORE the implementation tasks they cover; assert tests red before implementing.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently. US1 (P1) is the MVP; US2 (P2) is the touch-input extension.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared incomplete dependencies)
- **[Story]**: `[US1]` or `[US2]`. Setup, Foundational, and Polish phases have no story label.
- File paths in descriptions are exact and align with the project structure in [plan.md](./plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring the Vite + TypeScript + Phaser + Vitest project to life. After this phase, `npm test` and `npm run dev` work, even though no game code exists yet.

- [ ] T001 Initialize `package.json` at repo root with dependencies `phaser ^3.85`, `vite ^6`, `typescript ^5`, `vitest ^2`, `eslint ^9`, `@types/node ^22`, and npm scripts: `dev` (`vite`), `build` (`vite build`), `preview` (`vite preview`), `test` (`vitest run`), `test:watch` (`vitest`), `test:coverage` (`vitest run --coverage`), `typecheck` (`tsc --noEmit`), `lint` (`eslint . --ext .ts`). File: `package.json`
- [ ] T002 [P] Add strict TypeScript config: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `lib: ["ES2022", "DOM"]`, `isolatedModules: true`. File: `tsconfig.json`
- [ ] T003 [P] Add Vite config (no extra plugins yet; defaults are sufficient). File: `vite.config.ts`
- [ ] T004 [P] Add Vitest config: `environment: 'node'` by default; renderer test files override to `'jsdom'`. File: `vitest.config.ts`
- [ ] T005 [P] Add ESLint config with `no-restricted-imports` rules per `contracts/module-contracts.md` (Phaser banned outside `renderer/` and `phaser/`; cross-module imports must use `index.ts`). File: `.eslintrc.cjs`
- [ ] T006 [P] Add `index.html` at repo root with a `<div id="game"></div>` host and a `<script type="module" src="/src/main.ts"></script>` entry. File: `index.html`
- [ ] T007 [P] Add `.gitignore` covering `node_modules/`, `dist/`, `.vite/`, `coverage/`. File: `.gitignore`
- [ ] T008 [P] Add a placeholder favicon (32x32 coloured square SVG). File: `public/favicon.svg`
- [ ] T009 Run `npm install` and verify no errors. Manual / shell step (no file).

**Checkpoint**: `npm test` exits 0 with "no test files found"; `npm run dev` opens an empty page at `localhost:5173`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared types and constants that every game module depends on. Nothing builds on top of `src/` until this phase is complete.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [ ] T010 Create `src/shared/types.ts` exporting `Lane`, `Direction`, `InputSource`, `InputEvent`, `PlayerState`, `RunState`, `WorldState` per `data-model.md`. All fields `readonly`. File: `src/shared/types.ts`
- [ ] T011 Create `src/shared/config.ts` exporting `LANES`, `LANE_X`, `LOGICAL_WIDTH=720`, `LOGICAL_HEIGHT=1280`, `RUN_SPEED_UNITS_PER_SEC=200`, `LANE_SWITCH_DURATION_MS=200`, `SWIPE_MIN_HORIZONTAL_PX=30`, `SWIPE_MAX_DURATION_MS=500`, `SWIPE_HORIZONTAL_DOMINANCE=2`, `INPUT_COALESCE_WINDOW_MS=50`, and `DEBUG` (parses `?debug=1` once at module load, defaults `false` in non-browser env). File: `src/shared/config.ts`

**Checkpoint**: Foundation ready - user-story implementation can now begin.

---

## Phase 3: User Story 1 - Desktop keyboard lane runner (Priority: P1) 🎯 MVP

**Goal**: A player on a desktop browser can press any key on a start screen, then keyboard-arrow / WASD their way between three lanes while the world scrolls past. No touch input yet (that is US2).

**Independent Test**: Open `npm run dev` on a desktop, dismiss the start screen, and verify all six acceptance scenarios in [spec.md](./spec.md) §"User Story 1" pass, including the held-key-does-not-skip-lanes check and the tab-blur pause/resume.

### Tests for User Story 1 (write FIRST, assert red, then implement)

- [ ] T012 [P] [US1] Write unit tests for the lane-state machine covering all transitions in `data-model.md` §"State machine: Lane transitions": initial state, single-input lane change, clamp at left boundary, clamp at right boundary, buffer-during-animation, buffer-overwrite (last-write-wins), and `easeOutCubic(0) === 0`, `easeOutCubic(1) === 1`, monotonic. File: `src/lane-state/lane-state.test.ts`
- [ ] T013 [P] [US1] Write unit tests for `runner-engine` covering: `createWorldState` initial values; `startRun` from `'pre-run'`; `pauseRun` then `tickWorld(1000)` does NOT advance `distanceUnits`; `resumeRun` then `tickWorld(1000)` advances `distanceUnits` by exactly `RUN_SPEED_UNITS_PER_SEC`; `pauseRun` is no-op from `'pre-run'`. File: `src/runner-engine/runner-engine.test.ts`
- [ ] T014 [P] [US1] Write unit tests for `input-adapter` keyboard path covering: `ArrowLeft` and `'a'` emit direction `'left'`; `ArrowRight` and `'d'` emit `'right'`; unrecognised keys are ignored; `KeyboardEvent.repeat === true` events are dropped; two same-direction keyboard events within `INPUT_COALESCE_WINDOW_MS` produce one normalised `InputEvent`. Use the injected `now` clock from `InputAdapterDeps` for deterministic timestamps. File: `src/input-adapter/input-adapter.test.ts`
- [ ] T015 [P] [US1] Write an integration test asserting the cross-module flow: an input event flows through `input-adapter.emit` into `applyInput` (mocked emit collector), `tickPlayer(200)` advances animation, `tickWorld(200)` advances distance, and the renderer would be called with the resulting state. Uses real `lane-state` + `runner-engine` modules; mocks renderer. File: `tests/integration/lane-switch-flow.test.ts`

### Implementation for User Story 1

- [ ] T016 [P] [US1] Implement the lane-state module with the public API in `contracts/module-contracts.md` §`lane-state/`: `createPlayerState`, `applyInput`, `tickPlayer`, `adjacentLane`. Emit `console.debug` events for `lane_change_requested`, `lane_change_applied`, `lane_change_clamped`, `lane_change_buffered`. File: `src/lane-state/lane-state.ts` and `src/lane-state/index.ts`
- [ ] T017 [P] [US1] Implement the runner-engine module with the public API in `contracts/module-contracts.md` §`runner-engine/`: `createWorldState`, `startRun`, `pauseRun`, `resumeRun`, `tickWorld`. Emit `console.debug` events for `run_started`, `run_paused`, `run_resumed`. File: `src/runner-engine/runner-engine.ts` and `src/runner-engine/index.ts`
- [ ] T018 [P] [US1] Implement the input-adapter module (keyboard path only) with the public API in `contracts/module-contracts.md` §`input-adapter/`: `createInputAdapter({ now, emit })`, `handleKeyDown`. Recognise `ArrowLeft`/`a`/`A` and `ArrowRight`/`d`/`D`. Drop `repeat === true`. Enforce the 50 ms cross-source coalesce window. File: `src/input-adapter/input-adapter.ts` and `src/input-adapter/index.ts`
- [ ] T019 [US1] Make all unit tests from T012, T013, T014 pass. Iterate on the implementation files from T016, T017, T018 only until green. **Blocked by**: T012, T013, T014, T016, T017, T018.
- [ ] T020 [US1] Make the integration test from T015 pass. **Blocked by**: T015, T016, T017, T018, T019 (each unit test must be green individually before the integration test runs).
- [ ] T021 [P] [US1] Implement `src/renderer/runner-renderer.ts`: creates three lane rectangles + player rectangle as Phaser GameObjects; `draw(player, world)` maps `currentLane` + `targetLane` + `easeOutCubic(animProgress)` to logical x using `LANE_X`; `resize(w, h)` updates internal scale factor; `destroy()` removes GameObjects from the scene. Re-export via `src/renderer/index.ts`. File: `src/renderer/runner-renderer.ts` and `src/renderer/index.ts`
- [ ] T022 [P] [US1] Implement `src/renderer/debug-overlay.ts`: when `DEBUG === false`, return a no-op object. When `DEBUG === true`, create a Phaser Text GameObject top-left showing `lane`, `animProgress`, `speed`, `distance`, `lastInput`. File: `src/renderer/debug-overlay.ts`
- [ ] T023 [P] [US1] Implement Phaser game config with `Scale.FIT`, `Scale.CENTER_BOTH`, `width: LOGICAL_WIDTH`, `height: LOGICAL_HEIGHT`, `physics: undefined`, `backgroundColor: '#1f1f29'`, `parent: 'game'`. File: `src/phaser/phaser-config.ts`
- [ ] T024 [P] [US1] Implement `BootScene`: no asset loading needed in this slice; `create()` immediately starts `StartScene`. File: `src/phaser/scenes/boot-scene.ts`
- [ ] T025 [P] [US1] Implement `StartScene`: draw centered text "Press any key or tap to start"; on first `keydown` or `pointerdown`, transition to `RunScene`. File: `src/phaser/scenes/start-scene.ts`
- [ ] T026 [US1] Implement `RunScene`: in `create()`, instantiate `createPlayerState`, `createWorldState`, `createInputAdapter({ now: performance.now, emit: applyInputToPlayer })`, the renderer, and the debug overlay; bridge Phaser's `input.keyboard.on('keydown', ...)` to `inputAdapter.handleKeyDown`; in `update(time, delta)` call `tickPlayer` then `tickWorld` then `renderer.draw` then `debugOverlay.update`; start the run via `startRun(world)` on scene entry. File: `src/phaser/scenes/run-scene.ts`
- [ ] T027 [US1] Implement `src/main.ts`: read `DEBUG` from URL; `new Phaser.Game(GAME_CONFIG)`; register `document.addEventListener('visibilitychange', ...)` and `window.addEventListener('blur'/'focus', ...)` to call `runner-engine.pauseRun` / `resumeRun` through a shared state holder. File: `src/main.ts`
- [ ] T028 [US1] Manual validation per [quickstart.md](./quickstart.md) §"Validate the slice (US1 - desktop keyboard)" - all six acceptance scenarios must pass on a real desktop browser at `localhost:5173`.

**Checkpoint**: US1 is fully functional - desktop keyboard lane runner playable end-to-end; tests green; tab-blur pause works; debug overlay visible with `?debug=1`. This is shippable as the MVP.

---

## Phase 4: User Story 2 - Mobile / touch swipe (Priority: P2)

**Goal**: Layer touch-swipe input on top of the runner so it is also playable on mobile browsers.

**Independent Test**: With the dev server running, either on an actual phone via LAN IP or in Chrome DevTools device emulation, the four acceptance scenarios in [spec.md](./spec.md) §"User Story 2" pass.

### Tests for User Story 2

- [ ] T029 [P] [US2] Write unit tests for `swipe-detector.detectSwipe(start, end)`: 35 px horizontal swipe in 200 ms returns `'right'`; 25 px horizontal swipe returns `null` (too short); vertical-dominant swipe returns `null`; 600 ms swipe returns `null` (too slow); left swipe returns `'left'`. File: `src/input-adapter/swipe-detector.test.ts`
- [ ] T030 [P] [US2] Extend `src/input-adapter/input-adapter.test.ts` with: a `pointerdown` followed by `pointerup` 200 ms later, 50 px to the right, emits one `'right'` InputEvent; a same-direction swipe within 50 ms of a prior keyboard event is suppressed by the coalesce window (covers G3 cross-source).
- [ ] T031 [P] [US2] Extend `tests/integration/lane-switch-flow.test.ts` with a touch-driven path: pointer events end-to-end produce the same observable downstream effect as a keyboard input.

### Implementation for User Story 2

- [ ] T032 [P] [US2] Implement `src/input-adapter/swipe-detector.ts`: pure function `detectSwipe(start, end): Direction | null` applying the thresholds in `shared/config.ts`. Not re-exported from `input-adapter/index.ts`. File: `src/input-adapter/swipe-detector.ts`
- [ ] T033 [US2] Extend the input-adapter to wire pointer events through swipe-detector: `handlePointerDown` records start; `handlePointerUp` calls `detectSwipe(start, end)` and, on non-null result, emits the InputEvent (subject to the same coalesce window). File: `src/input-adapter/input-adapter.ts`
- [ ] T034 [US2] Make the new tests from T029, T030, T031 pass. Iterate only on T032 and T033 implementations.
- [ ] T035 [US2] Extend `RunScene.create()` to bridge `scene.input.on('pointerdown', ...)` and `scene.input.on('pointerup', ...)` to `inputAdapter.handlePointerDown` / `handlePointerUp`. File: `src/phaser/scenes/run-scene.ts`
- [ ] T036 [US2] Manual validation per [quickstart.md](./quickstart.md) §"Validate the slice (US2 - mobile/touch)" - all four US2 acceptance scenarios pass on either a real phone or Chrome DevTools touch emulation.

**Checkpoint**: US1 AND US2 both work independently. Game is playable end-to-end on desktop AND mobile.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verify quality gates and definition-of-done, then ship the preview.

- [ ] T037 [P] Add a smoke test that boots a headless Phaser game with `BootScene` and asserts no errors are emitted. Uses Vitest's `'jsdom'` environment for this single file. File: `src/phaser/scenes/boot-scene.test.ts`
- [ ] T038 Run `npm run typecheck`; resolve any TypeScript errors that surface.
- [ ] T039 Run `npm run lint`; resolve any boundary violations (the `no-restricted-imports` rule should NOT fire if Phase 3+4 followed the contracts).
- [ ] T040 Run `npm run build`; verify `dist/` contains the production bundle and that the gzipped size of `dist/assets/index-*.js` is under 500 KB. Manual / shell step.
- [ ] T041 Final end-to-end validation per [quickstart.md](./quickstart.md) §"Definition of done for this slice" - tick every checkbox.
- [ ] T042 Deploy a Cloudflare Pages preview from this branch per [quickstart.md](./quickstart.md) §"Deploy to Cloudflare Pages" - confirm the preview URL is playable on both desktop and a mobile browser.
- [ ] T043 [P] Run a 60-second profile of a continuous run using the browser's Performance panel (Chrome DevTools or equivalent) on a typical desktop and on a 3-year-old mid-range mobile. Record any long task > 100 ms or any FPS drop below 60 (desktop) / 30 (mobile). Closes spec.md SC-004 and FR-007 measurement gap. No file output; capture findings in PR description.
- [ ] T044 Run Lighthouse (mobile profile, slow 4G throttle) against the Cloudflare preview URL from T042; assert Time-to-Interactive < 3 s and First Contentful Paint < 1.8 s. Closes spec.md SC-007. No file output; capture findings in PR description.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T001 must complete first; T002-T008 may run in parallel after T001; T009 (`npm install`) must run after T001 and before any module work in later phases (because tests import deps).
- **Foundational (Phase 2)**: Depends on Setup. T010 must complete before T011 (config imports types).
- **User Story 1 (Phase 3)**: Depends on Foundational. Tests (T012-T015) may be written before any implementation. Implementation tasks within US1 honour module-level parallelism (see "Within Each User Story" below).
- **User Story 2 (Phase 4)**: Depends on US1 completion (US2 extends `input-adapter` and `run-scene`, both authored in US1).
- **Polish (Phase 5)**: Depends on US1 (T038-T041) and US2 (T042). T037 may be written any time after T024.

### User Story Dependencies

- **US1 (P1)**: Independent. Can be tested and shipped alone as the MVP.
- **US2 (P2)**: Soft-depends on US1 because it extends the input-adapter and RunScene, but the touch path is independently testable.

### Within Each User Story

- **Tests MUST be written and FAIL before implementation** (Constitution II).
- Pure modules first (lane-state, runner-engine, input-adapter), then renderer + Phaser Scenes, then `main.ts` last.
- Across modules: pure modules T016, T017, T018 run in parallel because they only depend on `shared/`.
- Renderer (T021, T022), Phaser config (T023), and BootScene/StartScene (T024, T025) can run in parallel.
- RunScene (T026) joins everything together and must come after T016-T025.

### Parallel Opportunities

- All [P] tasks in Phase 1 (after T001).
- All four test tasks T012-T015 within US1.
- The three implementation tasks T016, T017, T018 within US1.
- Renderer + game-config + boot-scene + start-scene (T021-T025) within US1.
- All [P] tasks in Phase 4 (T029-T032).

---

## Parallel Example: User Story 1

```text
# Stage 1: write tests in parallel (all in different files)
T012 - src/lane-state/lane-state.test.ts
T013 - src/runner-engine/runner-engine.test.ts
T014 - src/input-adapter/input-adapter.test.ts
T015 - tests/integration/lane-switch-flow.test.ts

# Stage 2: implement pure modules in parallel
T016 - src/lane-state/lane-state.ts
T017 - src/runner-engine/runner-engine.ts
T018 - src/input-adapter/input-adapter.ts

# Stage 3 (after tests + pure modules green): renderer + Phaser plumbing in parallel
T021 - src/renderer/runner-renderer.ts
T022 - src/renderer/debug-overlay.ts
T023 - src/phaser/phaser-config.ts
T024 - src/phaser/scenes/boot-scene.ts
T025 - src/phaser/scenes/start-scene.ts

# Stage 4: integrate and entrypoint (sequential)
T026 - src/phaser/scenes/run-scene.ts
T027 - src/main.ts

# Stage 5: manual acceptance
T028 - browser at localhost:5173
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup.
2. Phase 2 Foundational.
3. Phase 3 User Story 1.
4. **STOP and VALIDATE**: complete T028 manual acceptance on desktop.
5. Deploy a Cloudflare Pages preview of this branch (T042 can run early just for US1).
6. Demo / play test the MVP. If satisfactory, proceed.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add US1 → test independently → preview deploy → "lane runner on desktop, MVP".
3. Add US2 → test independently on a phone → preview deploy → "lane runner everywhere".
4. Polish → ship to `main`.

---

## Notes

- `[P]` tasks touch different files and have no incomplete-task dependencies; safe to do in parallel by a team or in interleaved order by a solo dev.
- `[Story]` label maps each task back to a user story for traceability into [spec.md](./spec.md).
- Tests MUST fail before the matching implementation lands (Constitution II).
- Commit at every checkpoint or logical group; the git extension auto-commit hooks are available.
- Avoid: changing file paths from those listed in this file (would invalidate the contracts in `module-contracts.md`); slipping game logic into Scene classes (violates the ESLint boundary rule).
