---
description: "Dependency-ordered tasks for the Random Geometric Obstacles slice (003-obstacles)"
---

# Tasks: Random Geometric Obstacles

**Input**: Design documents from `specs/003-obstacles/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/module-contracts.md](./contracts/module-contracts.md), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. Constitution Principle II (Test-First) - every new pure function (spawn, collision, effectiveLane, endRun, restartRun) gets a unit test written before its implementation. The new integration case (obstacle reaches player → game-over → restart) is also written first.

**Organization**: Tasks are grouped by user story. US1 (P1) ships the full dodge-and-die loop with two obstacle variants (cube + wide-bar) - the smallest playable slice. US2 (P2) adds four more shape variants for visual variety on top of the same mechanics.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared incomplete dependencies).
- **[Story]**: `[US1]` or `[US2]`. Setup, Foundational, and Polish phases have no story label.
- File paths in descriptions are exact and align with the project structure in [plan.md](./plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

This slice inherits all setup from 001-lane-runner + 002-scoring-hud. No project-level setup work is required.

*(no tasks)*

---

## Phase 2: Foundational (Blocking Prerequisites)

The shared types and constants that every later task depends on. Both tasks may run in parallel - they touch different files.

- [X] T001 [P] Extend `src/shared/types.ts`: add `'game-over'` to the existing `RunState` union; add `export type ObstacleVariantId = 'cube' | 'pillar' | 'cylinder' | 'sphere' | 'trapezoid-prism' | 'wide-bar'`; add the `ObstacleGroup` interface per `data-model.md` (`id: number`, `variant: ObstacleVariantId`, `blockedLanes: readonly Lane[]`, `worldZ: number`). All fields `readonly`. File: `src/shared/types.ts`.
- [X] T002 [P] Extend `src/shared/config.ts`: add obstacle tunables - `OBSTACLES_MIN_GAP = 22` (world units), `OBSTACLES_MAX_GAP = 50`, `OBSTACLES_INITIAL_SPAWN_Z = -34` (start the first spawn ~1.4 s ahead of the player at the current run speed), `OBSTACLES_SINGLE_LANE_PROBABILITY = 0.8` (probability that a spawn is a single-lane group vs a two-lane bar). File: `src/shared/config.ts`.

**Checkpoint**: Types and constants are in place; user-story work can begin.

---

## Phase 3: User Story 1 - Dodge, die, restart (Priority: P1) 🎯 MVP

**Goal**: Random obstacles spawn ahead, the player must dodge them by switching lanes, hitting one ends the run with a game-over overlay showing final score + time, and the next input restarts the run from scratch. Two visual variants in this phase (cube + wide-bar) so both single-lane and two-lane obstacles work; the other four shape variants land in US2.

**Independent Test**: `npm run dev`, start a run, dodge obstacles, intentionally fail by staying in a blocked lane, verify the game-over overlay shows the right score/time, press any key to restart, verify a fresh run begins with 0 score / 0 time / centre lane / no carry-over obstacles.

### Tests for User Story 1 (write FIRST, assert red, then implement)

- [X] T003 [P] [US1] Write unit tests for the obstacle catalogue: every entry in `OBSTACLE_VARIANTS` has a `laneCount` of 1 or 2; the union of catalogue keys equals the union of `ObstacleVariantId`; the `wide-bar` variant has `laneCount === 2`; all other catalogue entries that exist at this phase have `laneCount === 1`. File: `src/obstacles/obstacle-catalogue.test.ts`.
- [X] T004 [P] [US1] Write unit tests for the spawn generator: with a fixed seed, two calls to `nextObstacleGroup` from the same schedule produce identical groups (determinism); over 1000 successive calls the `gap` between consecutive `worldZ` values is always within `[OBSTACLES_MIN_GAP, OBSTACLES_MAX_GAP]`; `blockedLanes.length` is always 1 or 2 (never 0, never 3) across 1000 draws; two-lane masks are always one of `['left', 'centre']` or `['centre', 'right']` (no `['left', 'right']` skipping); the chosen variant's `laneCount` always matches `blockedLanes.length`. File: `src/obstacles/obstacle-spawn.test.ts`.
- [X] T005 [P] [US1] Write unit tests for `effectiveLane(player)` and `collidesAt(player, group, previousGroupZ)`: idle player → returns `player.currentLane`; mid-animation centre→right with `animProgress = 0.49` → returns `'centre'`; with `animProgress = 0.50` → returns `'right'`; collision-true case (player effective lane `'centre'`, group blocks `['centre']`, `worldZ = 0`, `previousGroupZ = 0.5`); collision-false case (player effective lane `'left'`, group blocks `['centre']`); collision-false when the group hasn't crossed yet (`worldZ = 0.2`, `previousGroupZ = 0.5`). File: `src/obstacles/obstacle-collision.test.ts`.
- [X] T006 [P] [US1] Extend `src/runner-engine/runner-engine.test.ts` with cases for `endRun` and `restartRun`: `endRun` from `'running'` transitions to `'game-over'`; `endRun` from `'paused'` or `'pre-run'` is a no-op; second `endRun` from `'game-over'` is a no-op; `restartRun` from `'game-over'` returns a fresh state with `runState: 'running'`, `tickMs: 0`, `distanceUnits: 0`, preserved `speedUnitsPerSec`; `tickWorld(world, 1000)` while `runState === 'game-over'` does NOT advance `tickMs` or `distanceUnits`.
- [X] T007 [P] [US1] Extend `tests/integration/lane-switch-flow.test.ts` with a case: start a run, spawn an obstacle group blocking the centre lane, tick the world until the group's `worldZ` crosses 0 with the player still in centre, assert that `collidesAt` returns true and `endRun(world).runState === 'game-over'`; then call `restartRun(world)` and assert the returned state has `runState: 'running'`, `tickMs: 0`, `distanceUnits: 0`.

### Implementation for User Story 1

- [X] T008 [P] [US1] Implement `src/obstacles/obstacle-catalogue.ts`: export `OBSTACLE_VARIANTS` as a `Readonly<Record<ObstacleVariantId, ObstacleVariant>>`. For this phase, include only `cube` (laneCount: 1) and `wide-bar` (laneCount: 2). The other four ids exist in the type union from T001 but are NOT yet in the catalogue map. File: `src/obstacles/obstacle-catalogue.ts`.
- [X] T009 [P] [US1] Implement `src/obstacles/obstacle-spawn.ts`: inline `mulberry32` PRNG (32-bit state); `createSpawnSchedule(initialSeed: number): ObstacleSpawnSchedule` returns `{ nextSpawnZ: OBSTACLES_INITIAL_SPAWN_Z, seed: initialSeed, lastSpawnedId: 0 }`; `nextObstacleGroup(schedule)` advances the seed, picks a gap in `[MIN_GAP, MAX_GAP]`, picks `laneCount` (1 with probability `OBSTACLES_SINGLE_LANE_PROBABILITY`, else 2), picks `blockedLanes` (uniform over the valid lane sets for that count - single-lane uniform over `['left', 'centre', 'right']`; two-lane uniform over `[['left', 'centre'], ['centre', 'right']]`), picks a `variant` uniformly from catalogue entries matching `laneCount`, increments `lastSpawnedId`, returns `{ group, schedule }`. Emits `console.debug({ event: 'obstacle_spawned', id, variant, blockedLanes, worldZ })`. File: `src/obstacles/obstacle-spawn.ts`.
- [X] T010 [P] [US1] Implement `src/obstacles/obstacle-collision.ts`: `effectiveLane(player)` per the contract (target lane when `animProgress >= 0.5`, else current); `collidesAt(player, group, previousGroupZ)` returns true iff `group.worldZ <= 0 && previousGroupZ > 0 && group.blockedLanes.includes(effectiveLane(player))`. Emits `console.debug({ event: 'collision_detected', playerLane, obstacleId, blockedLanes })` on a true result. File: `src/obstacles/obstacle-collision.ts`.
- [X] T011 [US1] Implement `src/obstacles/index.ts` as the public barrel: re-exports `OBSTACLE_VARIANTS` + the `ObstacleVariant` type from the catalogue, `createSpawnSchedule` + `nextObstacleGroup` + the `ObstacleSpawnSchedule` type from spawn, `effectiveLane` + `collidesAt` from collision. **Blocked by**: T008, T009, T010.
- [X] T012 [US1] Extend `src/runner-engine/runner-engine.ts`: add `endRun(world)` returning `{ ...world, runState: 'game-over' }` only when `runState === 'running'` (else returns unchanged), with `console.debug({ event: 'run_ended', tickMs, distanceUnits })`; add `restartRun(world)` returning `{ runState: 'running', speedUnitsPerSec: world.speedUnitsPerSec, distanceUnits: 0, tickMs: 0 }` with `console.debug({ event: 'run_restarted' })`. Re-export both from `src/runner-engine/index.ts`. Makes T006 + T007 tests green. **Blocked by**: T001, T006.
- [X] T013 [US1] Extend `src/renderer/three-renderer.ts` with the obstacle mesh pool and `updateObstacles(groups)` method: pre-allocate 12 `THREE.Mesh` instances each for the `cube` and `wide-bar` variants (24 meshes total at this phase). Cube: `BoxGeometry(1.4, 1.4, 1.4)` with emissive cyan/blue material (intensity ~0.65). Wide-bar: `BoxGeometry(4.0, 1.2, 1.0)` with the same material family. `updateObstacles(groups)` walks the pool, sets `mesh.position.x = LANE_X[blockedLane]` for single-lane variants (or the midpoint of the two adjacent `LANE_X` values for the wide-bar), `mesh.position.y = boundingHeight / 2`, `mesh.position.z = group.worldZ`, `mesh.visible = true` for active groups, hides the rest. Add `updateObstacles` to the `ThreeRenderer` interface. **Blocked by**: T001.
- [X] T014 [US1] Extend `index.html`: add `<div id="game-over-overlay" class="overlay hidden">` with the layout from `contracts/module-contracts.md` (h1 "Game Over"; labels + values for `#game-over-score` and `#game-over-timer`; restart prompt). Add CSS rules to the existing `<style>` block matching the existing overlay typography. File: `index.html`.
- [X] T015 [US1] Extend `src/game/game-loop.ts`: add `obstacles: ObstacleGroup[]` and `spawnSchedule: ObstacleSpawnSchedule` to the per-run state. In `create`, call `createSpawnSchedule(performance.now() ^ 0x9e3779b9)`. Each frame in the `'running'` branch: (a) advance `obstacles[i].worldZ += distanceDelta`; (b) if `obstacles[0]` (or the nearest unpassed) has `worldZ <= 0 && previousWorldZ > 0`, run `collidesAt` - on true, call `world = endRun(world)`, write the final score + time into `#game-over-score` + `#game-over-timer`, show the `#game-over-overlay`, set `isAwaitingRestart = true`; (c) while `spawnSchedule.nextSpawnZ - <total scrolled distance> >= 0` (the spawn point has entered the visible region), call `nextObstacleGroup`, push the new group, update the schedule; (d) cull `worldZ > TRACK_NEAR_Z + 10` from the list; (e) call `renderer.updateObstacles(obstacles)`. Add input bridging: when `isAwaitingRestart` is true, a keydown / pointerdown calls `restartRun(world)` + resets the obstacle list + resets the spawn schedule with a fresh seed + hides the overlay + clears `isAwaitingRestart` + returns early so the input is NOT forwarded to the input-adapter. **Blocked by**: T011, T012, T013, T014.
- [X] T016 [US1] Update `src/main.ts`: resolve `#game-over-overlay`, `#game-over-score`, and `#game-over-timer` via `document.querySelector`; validate non-null; pass them to `createGameLoop` as `gameOverOverlay`, `gameOverScore`, and `gameOverTimer` in `GameLoopHostElements`. File: `src/main.ts`. **Blocked by**: T014, T015.
- [ ] T017 [US1] Manual validation per [quickstart.md](./quickstart.md) §"Validate the slice (US1 - dodge, die, restart)" - all eight US1 acceptance scenarios in spec.md pass on a real desktop browser at `localhost:5173`.

**Checkpoint**: US1 ships a playable game with collision + game-over + restart. The slice is shippable as the MVP even if US2 is deferred (just visually monotonous).

---

## Phase 4: User Story 2 - Visual shape variety (Priority: P2)

**Goal**: Add four more single-lane shape variants (`pillar`, `cylinder`, `sphere`, `trapezoid-prism`) so a single run shows at least five visually distinct obstacles. Mechanics unchanged; the spawn generator already samples uniformly from the catalogue, so adding catalogue entries automatically widens the visual pool.

**Independent Test**: Play a single 60-second run. At least five distinct 3D primitives appear on screen.

### Implementation for User Story 2

- [X] T018 [P] [US2] Extend `src/obstacles/obstacle-catalogue.ts` with four single-lane entries: `pillar` (laneCount: 1), `cylinder` (laneCount: 1), `sphere` (laneCount: 1), `trapezoid-prism` (laneCount: 1). File: `src/obstacles/obstacle-catalogue.ts`.
- [X] T019 [P] [US2] Extend `src/renderer/three-renderer.ts` with mesh-pool entries for the four new variants: `pillar` → `BoxGeometry(1.0, 2.6, 1.0)`; `cylinder` → `CylinderGeometry(0.7, 0.7, 1.6, 16)`; `sphere` → `SphereGeometry(0.8, 24, 16)`; `trapezoid-prism` → a custom `BufferGeometry` formed from a trapezoidal cross-section (1.4 wide bottom / 1.0 wide top, 1.6 tall) extruded 1.0 deep. Each variant gets its own pool of 12 instances; all four use the same emissive material as the `cube`. **Blocked by**: T018.
- [X] T020 [US2] Update the catalogue test (T003) to assert that all 6 catalogue keys are now present and `laneCount` values are correct. **Blocked by**: T018.
- [ ] T021 [US2] Manual validation per [quickstart.md](./quickstart.md) §"Validate the slice (US2 - visual variety)" - all four US2 acceptance scenarios in spec.md pass.

**Checkpoint**: Five distinct shape variants visible per minute of play. The game now has the full visual variety promised by the spec.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T022 Run `npm run typecheck`; resolve any TypeScript errors that surface.
- [X] T023 Run `npm run lint`; resolve any boundary violations. The `src/obstacles/` module MUST NOT import `three` or any DOM types - the existing `no-restricted-imports` rule catches this.
- [X] T024 Run `npm run build`; verify `dist/` contains the production bundle and that the gzipped size of `dist/assets/index-*.js` is still under the 500 KB Constitution budget (current 134.41 KB; new module + extensions add an estimated ~6-8 KB).
- [ ] T025 Validate the HUD + game-over overlay on a 320 px viewport (Chrome DevTools → Device Toolbar → "iPhone SE" or any 320 px wide preset). Both score / timer HUD and the game-over overlay MUST remain legible (font size >= 16 CSS px) and MUST NOT visually overlap.
- [ ] T026 Final end-to-end validation per [quickstart.md](./quickstart.md) §"Definition of done" - tick every checkbox.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: empty - no work required (inherits from 001 + 002).
- **Foundational (Phase 2)**: T001 + T002 must complete before any user-story work touches the shared types or constants.
- **User Story 1 (Phase 3)**: depends on Foundational. Most internal dependencies are noted with explicit **Blocked by** entries in the task descriptions.
- **User Story 2 (Phase 4)**: depends on US1 because it extends the same catalogue file (T008) and the same renderer mesh-pool code (T013). T018 + T019 + T020 are mechanically independent of US1's gameplay tests but cannot land until US1's files exist.
- **Polish (Phase 5)**: depends on US1 + US2.

### User Story Dependencies

- **US1 (P1)**: standalone. Shippable as MVP.
- **US2 (P2)**: extends US1's files; cannot ship before US1.

### Within Each User Story

- Tests written BEFORE their matching implementations (Constitution II).
- Pure-logic modules (catalogue, spawn, collision) first, then runner-engine extension, then the renderer + DOM, then the game-loop wiring, then `main.ts`, then manual acceptance.
- `src/obstacles/index.ts` (T011) is sequential after T008-T010 because it re-exports them.
- `src/game/game-loop.ts` (T015) is the last code change before `main.ts` because it depends on every prior obstacle / runner-engine / renderer change.

### Parallel Opportunities

- T001 || T002 (different files in `src/shared/`).
- T003 || T004 || T005 || T006 || T007 (five separate test files; all writeable in parallel).
- T008 || T009 || T010 (three separate files in `src/obstacles/`).
- T013 || T014 (renderer extension vs index.html; different files).
- T018 || T019 (catalogue vs renderer pool; different files).

---

## Parallel Example: User Story 1

```text
# Stage 1: tests in parallel (5 different files)
T003 - src/obstacles/obstacle-catalogue.test.ts
T004 - src/obstacles/obstacle-spawn.test.ts
T005 - src/obstacles/obstacle-collision.test.ts
T006 - src/runner-engine/runner-engine.test.ts (extension)
T007 - tests/integration/lane-switch-flow.test.ts (extension)

# Stage 2: pure-logic modules in parallel
T008 - src/obstacles/obstacle-catalogue.ts
T009 - src/obstacles/obstacle-spawn.ts
T010 - src/obstacles/obstacle-collision.ts

# Stage 3: barrel re-export + runner-engine extension (sequential after Stage 2)
T011 - src/obstacles/index.ts
T012 - src/runner-engine/runner-engine.ts (extension)

# Stage 4: renderer + DOM in parallel
T013 - src/renderer/three-renderer.ts (extension)
T014 - index.html (extension)

# Stage 5: integrate + entrypoint (sequential)
T015 - src/game/game-loop.ts (extension)
T016 - src/main.ts (extension)

# Stage 6: manual acceptance
T017 - browser at localhost:5173
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 2 Foundational (T001 + T002).
2. Phase 3 US1 (T003-T017).
3. **STOP and VALIDATE**: complete T017 manual acceptance on desktop.
4. Optional: ship US1 alone as a playable but visually-monotonous slice. The game has full mechanics (dodge / collide / game-over / restart) even if only two shapes appear.

### Incremental Delivery

1. Foundational → ready.
2. US1 → test → demo (dodge-and-die game with cube + wide-bar obstacles).
3. US2 → test → demo (full visual variety: cube, pillar, cylinder, sphere, trapezoid-prism, wide-bar).
4. Polish → typecheck / lint / build / 320 px / DoD → merge to main.

---

## Notes

- `[P]` tasks touch different files and have no incomplete-task dependencies.
- `[Story]` label maps each task to its user story for traceability.
- Tests MUST be red before the matching implementation lands (Constitution II). The spawn-generator determinism test (T004) and the collision predicate test (T005) are particularly important - they pin down the corner cases the gameplay depends on.
- Commit at every checkpoint or logical group.
- Avoid: changing file paths from those listed here; importing `three` or DOM types into `src/obstacles/` (will fail the ESLint boundary rule).
