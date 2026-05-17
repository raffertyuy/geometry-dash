---
description: "Dependency-ordered tasks for the Problem Gates slice (005-problem-gates)"
---

# Tasks: Problem Gates with Lives and Multi-strike Game Over

**Input**: Design documents from `specs/005-problem-gates/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/module-contracts.md](./contracts/module-contracts.md), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. Constitution Principle II (Test-First) — new pure functions in `src/problem-gates/`, `src/problems/`, the new `runner-engine` transitions (`consumeLife`, `enterAnswering`, `resolveAnswer`, `tickInvincibility`), and the `computeScore` parameter extension each get unit tests written before implementation lands. Two new integration tests cover the gate-collision round-trip and the lives + invincibility chain. Renderer DOM helpers get jsdom smoke tests; the Three.js cube-mesh rendering is exempt (visual code).

**Organization**: Three user stories per spec.md:

- **US1 (P1)** — Problem gates Q&A: gates spawn, modal opens on collision, ±score with floating animation, wrong answer also decrements lives.
- **US2 (P2)** — Three lives + softer obstacles + invincibility: obstacle hits now cost a life + respawn in centre lane + 3 s blinking grace window.
- **US3 (P3)** — Two game-over conditions: lives reach 0 OR cumulative score drops below 0; final score displayed verbatim (no clamping).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared incomplete dependencies).
- **[Story]**: `[US1]`, `[US2]`, `[US3]`. Setup, Foundational, and Polish phases carry no story label.
- File paths in descriptions are exact and align with the project structure in [plan.md](./plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

This slice inherits all setup from 001–004. No project-level setup work required.

*(no tasks)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the shared type / constant / WorldState changes that EVERY user story builds on, plus the lives-HUD scaffolding so US1's wrong-answer life-loss is visible immediately rather than only after US2 ships.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T001 [P] Extend `src/shared/types.ts`: add `ProblemGate`, `Problem`, `AnswerChoice`, `ActiveGateRef` interface definitions per [data-model.md](./data-model.md). Add `'answering'` to the `RunState` union. Add four new fields to `WorldState`: `lives: number`, `invincibilityRemainingMs: number`, `scoreDelta: number`, `activeGate: ActiveGateRef | null`. Keep all fields `readonly`.
- [X] T002 [P] Extend `src/shared/config.ts`: add `MAX_LIVES = 3`, `INVINCIBILITY_DURATION_MS = 3000`, `GATE_POINTS_B = 1_000`, `GATE_POINTS_M = 5_000`, `GATE_POINTS_A = 10_000`, `GATE_LANE_PROBABILITY_EMPTY = 0.25`, `GATE_LANE_PROBABILITY_B = 0.25`, `GATE_LANE_PROBABILITY_M = 0.25`, `GATE_LANE_PROBABILITY_A = 0.25`. Add a startup `console.assert` that the four GATE_LANE_PROBABILITY_* values sum to 1.0.
- [X] T003 Write test cases in `src/runner-engine/runner-engine.test.ts` for the foundational WorldState changes: `createWorldState()` returns the four new fields at initial values (`lives === MAX_LIVES`, `invincibilityRemainingMs === 0`, `scoreDelta === 0`, `activeGate === null`); `restartRun(world)` resets all four new fields regardless of input values; `tickWorld(world, dtMs)` early-returns when `world.runState === 'answering'` (no tickMs advance, no distanceUnits advance). Existing 14+ test cases that don't reference the new fields continue to pass. **Blocked by**: T001, T002.
- [X] T004 Update `src/runner-engine/runner-engine.ts`: `createWorldState` populates the four new fields with their initial values; `restartRun` resets them too; extend the `tickWorld` runState guard to early-return on `'answering'` as well as the existing freeze states. Makes T003 tests green. **Blocked by**: T003.
- [X] T005 Write test cases in `src/score/score.test.ts` for the new optional `scoreDelta` parameter: existing single-arg calls return the same value as before (default 0); `computeScore(0, 0) === 0`; `computeScore(10_000, 1000) === 1100`; `computeScore(10_000, -5000) === -4900`; `computeScore(60_000, 10_000) === 19_000` (or recompute for the active accelerated test config — see slice-004 score.ts for the live formula). **Blocked by**: T001.
- [X] T006 Update `src/score/score.ts`: change `computeScore` signature to `computeScore(tickMs: number, scoreDelta: number = 0): number`; return the existing piecewise tick value + `scoreDelta`. Keep `formatScore` + `formatTimer` exports unchanged. Makes T005 tests green. **Blocked by**: T005.
- [X] T007 [P] Write `src/renderer/lives-hud.test.ts` (jsdom): `createLivesHud(host)` populates host with exactly 3 `.heart` children; `set(3)` → no child has `.empty`; `set(0)` → all 3 children have `.empty`; `set(2)` → child 2 has `.empty`, children 0 and 1 do not. Idempotent across repeated `set(N)` calls.
- [X] T008 Implement `src/renderer/lives-hud.ts`: `createLivesHud(host)` returns `{ set, destroy }`. On creation, populate `host` with 3 inline-SVG hearts (low-poly polygon path, red fill `var(--heart-red)`, glowing outline via the existing text-shadow / drop-shadow approach). `set(lives)` flips the first `lives` of them to filled and the rest to `.empty` (transparent fill, outline retained). `destroy()` clears the host. Makes T007 tests green. **Blocked by**: T007.
- [X] T009 Re-export `createLivesHud` + `type LivesHud` from `src/renderer/index.ts`. **Blocked by**: T008.
- [X] T010 Extend `index.html`: insert `<div id="lives-hud" aria-label="Lives"></div>` into the `#hud` flex row between `#timer` (centre, order 2) and `#score` (right, order 3). Add CSS for `.heart` (inline-block sizing, ~24 px tall, glow via `filter: drop-shadow(...)`, red fill `--heart-red: #ff3360` or similar Tron-pink) and `.heart.empty` (transparent fill, outline retained). The lives-hud container is `order: 3` and `flex: 0 0 auto`; bump `#score`'s `order` to 4. Update the `#hud::before` spacer width to balance the score on the left.
- [X] T011 Extend `src/main.ts` to query `#lives-hud` and pass it through `GameLoopHostElements`. Add the bootstrap error guard for the new element (same pattern as `#game-over-overlay`). **Blocked by**: T010.
- [X] T012 Extend `src/game/game-loop.ts` `GameLoopHostElements` interface to include `livesHud: HTMLElement`; instantiate `livesHud = createLivesHud(host.livesHud)` at the top of `createGameLoop`; call `livesHud.set(MAX_LIVES)` initially and in `restartFromInput`. Each frame call `livesHud.set(world.lives)` after the world advances. **Blocked by**: T004, T009, T011.

**Checkpoint**: Shared types/constants land, WorldState has the new shape, tickWorld respects the new freeze state, computeScore handles scoreDelta, lives HUD renders 3 hearts at run start and tracks `world.lives`. Both US1 and US2 can now build on this foundation in parallel.

---

## Phase 3: User Story 1 — Answer problem gates to win or lose big chunks of score (Priority: P1) 🎯 MVP

**Goal**: Gates spawn alongside the existing obstacles. Colliding with a gate freezes the world and opens a modal with a placeholder geometry problem and three answer choices. Selecting via arrow keys + Enter, mouse, or touch commits the answer; correct = +1k/5k/10k with a green floating "+N" on the score readout; wrong = -1k/5k/10k with a red "-N" AND one heart consumed. Difficulty distribution is uniform random per non-obstacle lane (no balancing — `A A A` rows are valid).

**Independent Test**: Per spec.md User Story 1 + [quickstart.md](./quickstart.md) §3–5. Start a run, hit a B/M/A gate, verify modal opens with frozen world (timer, scrolling, score-tick, escalation all paused); answer correct and wrong; verify score animation, lives-HUD update on wrong, world resumes from the same instant.

### Tests for User Story 1 (write FIRST, assert red, then implement)

- [ ] T013 [P] [US1] Write `src/problems/problems.test.ts`: all three difficulty pools (B/M/A) are non-empty; every problem is well-formed (exactly three choices with non-empty texts, `correctIndex` in `[0, 2]`, `difficulty` field matches the pool); `selectPlaceholderProblem('B', rng)` always returns a problem with `difficulty === 'B'` (same for M and A); deterministic with a fixed rng seed; throws if asked for a difficulty whose pool was somehow emptied (dev-time guard).
- [ ] T014 [P] [US1] Write `src/problem-gates/problem-gates.test.ts`: `GATE_CATALOGUE` exposes all three difficulties with exact `points` values (1000 / 5000 / 10000) and muted hex colours (regex-check `#[0-9a-f]{6}` in the desaturated band, e.g., max channel ≤ 0xC0); `augmentRowWithGates(['centre'], rng)` returns ≤ 2 `ProblemGate`s in `{left, right}` only; `augmentRowWithGates(['left', 'centre'], rng)` returns ≤ 1 gate in `right` only; `augmentRowWithGates([], rng)` may return 0..3 gates; deterministic with fixed seed; over 1000 sampled non-obstacle lanes the distribution converges to ~25% each (±10pp tolerance per spec SC-009). `gateCollidesAt(player, gate)` fires when `previousWorldZ < 0 && worldZ >= 0 && player.effectiveLane === gate.lane`; respects the 0.5-progress lane-cross rule from slice 003.
- [ ] T015 [P] [US1] Extend `src/runner-engine/runner-engine.test.ts` with `enterAnswering` + `resolveAnswer` cases: `enterAnswering(runningWorld, gate)` returns `{ runState: 'answering', activeGate: { gateId, difficulty, problem }, ... }`; `enterAnswering(pausedWorld, gate)` is a no-op; `resolveAnswer(answeringWorld, true, 1000)` from `lives: 3, scoreDelta: 0, tickMs: 10_000` returns `{ runState: 'running', scoreDelta: 1000, activeGate: null, lives: 3 }`; `resolveAnswer(..., false, 5000)` decrements lives by 1 and writes `scoreDelta -= 5000`; with `lives: 1`, wrong-answer transitions to `'game-over'`; with `lives: 2` + `tickMs: 4000` + `scoreDelta: 0` + wrong M (points 5000), transitions to `'game-over'` via the score-below-zero path even though `lives` is still 1.
- [ ] T016 [P] [US1] Write `tests/integration/problem-gate-flow.test.ts`: construct a fresh world; manually inject a `ProblemGate` at the player's lane and `worldZ = -0.5`; tick one frame so it crosses to `worldZ >= 0`; assert `gateCollidesAt` fires; call `enterAnswering`; assert subsequent `tickWorld` calls are no-ops (no `tickMs` advance); call `resolveAnswer(world, true, 1000)`; assert world is back to `'running'` and `computeScore(world.tickMs, world.scoreDelta) === <tickDerived> + 1000`. Pure-logic only; no DOM / canvas.
- [ ] T017 [P] [US1] Write `src/renderer/problem-modal.test.ts` (jsdom): `show(problem, onCommit)` populates `.problem-text` and three `.answer-choice` elements with `data-idx` values 0/1/2; the first choice gains `.is-highlighted` by default; ArrowRight moves highlight to idx 1, ArrowLeft wraps from 0 to 2 (or stays at 0 — choose one and document, default: wrap); Enter on highlighted commits its index via `onCommit`; clicking a non-highlighted choice commits its index directly. `hide()` removes `.hidden` toggle and clears the host content.
- [ ] T018 [P] [US1] Write `src/renderer/floating-score.test.ts` (jsdom): `pop('+1000', 'green')` appends one `.floating-score.floating-score--green` child with text `'+1000'`; firing a synthetic `transitionend` on the child removes it from the DOM; `destroy()` clears any in-flight children.

### Implementation for User Story 1

- [ ] T019 [US1] Implement `src/problems/problems.ts`: hand-author `PLACEHOLDER_POOL_B`, `PLACEHOLDER_POOL_M`, `PLACEHOLDER_POOL_A` arrays each with ~10–15 entries. Text-only problems (no diagrams yet). Suggested topics: B = basic angles / shape identification ("How many sides does a hexagon have?" with 3 plausible numbers); M = perimeter / simple area / Pythagorean ("Right triangle with legs 3 and 4 has hypotenuse: 5 / 6 / 7"); A = multi-step area / surface area / volume / circle geometry ("Area of a circle with radius 5 is approximately: 79 / 31 / 157"). `selectPlaceholderProblem(difficulty, rng)`: one rng draw, indexes into the matching pool; throws `Error('No problems available for difficulty: <X>')` if the pool is empty. Makes T013 tests green. **Blocked by**: T013.
- [ ] T020 [US1] Implement `src/problems/index.ts`: re-export `selectPlaceholderProblem` and the `Problem`, `AnswerChoice` types. **Blocked by**: T019.
- [ ] T021 [US1] Implement `src/problem-gates/problem-gates.ts`: define `GATE_CATALOGUE` constant with muted hex colours (suggested: B `#3da06a`, M `#c08a3a`, A `#a64141` — verify against design intent during T028 manual validation). Implement `augmentRowWithGates(blockedLanes, rng)`: for each of `{left, centre, right}` not in `blockedLanes`, draw a uniform value (via the same `mulberry32Step` pattern used in `obstacles/obstacle-spawn.ts`), compare against the four cumulative thresholds from `GATE_LANE_PROBABILITY_*`, and either emit nothing (empty roll) or construct a `ProblemGate` with `selectPlaceholderProblem(difficulty, rng)` attached. Sequential gate `id` per call (caller threads the counter). Emit `console.debug({ event: 'gate_spawned', id, lane, difficulty, worldZ })` on creation. Implement `gateCollidesAt(player, gate)` mirroring the obstacle predicate: emits `console.debug({ event: 'gate_hit', id, difficulty, playerLane })` on positive. Makes T014 tests green. **Blocked by**: T014, T019.
- [ ] T022 [US1] Implement `src/problem-gates/index.ts`: re-export `GATE_CATALOGUE`, `augmentRowWithGates`, `gateCollidesAt`, and the `GateDifficulty` type. **Blocked by**: T021.
- [ ] T023 [US1] Implement `enterAnswering(world, gate)` and `resolveAnswer(world, isCorrect, points)` in `src/runner-engine/runner-engine.ts`. `enterAnswering`: returns `{ ...world, runState: 'answering', activeGate: { gateId: gate.id, difficulty: gate.difficulty, problem: gate.problem } }`; no-op when `world.runState !== 'running'`. `resolveAnswer`: writes `scoreDelta += (isCorrect ? +points : -points)`; on wrong, decrements `lives`; **order of game-over checks**: lives-zero first (transitions to `'game-over'` if `lives` reaches 0), THEN score-below-zero (transitions to `'game-over'` if `computeScore(tickMs, newScoreDelta) < 0`); otherwise sets `runState: 'running'` and `activeGate: null`. Emits `console.debug({ event: 'gate_answered', id, difficulty, isCorrect, scoreDelta: newDelta, livesAfter })`; emits `console.debug({ event: 'score_went_negative', tickMs, scoreDelta, totalScore })` only when the score-below-zero path fires; emits `console.debug({ event: 'run_ended', cause: 'wrong-answer', tickMs })` when either game-over path fires. Makes T015 tests green. **Blocked by**: T004, T006, T015.
- [ ] T024 [P] [US1] Implement `src/renderer/problem-modal.ts`: `createProblemModal(host)` returns `{ show, hide, destroy }`. `show(problem, onCommit)`: clears host; injects `.problem-text` with `problem.prompt`, then three `<li class="answer-choice" data-idx="N">${problem.choices[N].text}</li>`; sets `.is-highlighted` on choice 0; removes `.hidden` from host. Registers a `window.keydown` listener that recognises ArrowLeft/A/H (highlight−1), ArrowRight/D/L (highlight+1), ArrowUp/W/K (highlight−1), ArrowDown/S/J (highlight+1), Enter (commit highlighted), plus per-choice `click` and `pointerdown` listeners that commit `data-idx`. On commit: invokes `onCommit(choiceIndex as 0|1|2)`, unregisters its listeners. `hide()`: re-adds `.hidden`, clears the host's inner content. `destroy()`: removes any lingering listeners. Makes T017 tests green. **Blocked by**: T017.
- [ ] T025 [P] [US1] Implement `src/renderer/floating-score.ts`: `createFloatingScore(host)` returns `{ pop, destroy }`. `pop(text, color)`: creates `<span class="floating-score floating-score--${color}">${text}</span>`, appends to host, schedules removal via a `transitionend` listener (one-shot); the CSS class handles the translate-Y-up + opacity-0 transition over ~1 s. `destroy()`: clears any in-flight children. Makes T018 tests green. **Blocked by**: T018.
- [ ] T026 [US1] Extend `src/renderer/three-renderer.ts` with `updateGates(gates: readonly ProblemGate[]): void`. Creates / repositions / disposes a subdivided-cube mesh per gate. Geometry: `BoxGeometry(1, 1, 1)` plus four `LineSegments2`-based grid overlays on each face (horizontal + vertical thirds), positioned at `(LANE_X[gate.lane], 0.5, gate.worldZ)`. Material: same flat-shaded approach as obstacles but with `GATE_CATALOGUE[difficulty].colorHex` and slightly lower emissive intensity (the muted-vs-saturated distinction matters here). Reuse the existing bloom pipeline. Disposal pattern mirrors the obstacle mesh tracking — keep a `Map<gateId, Mesh>` so updates are O(active gates).
- [ ] T027 [US1] Re-export `createProblemModal`, `type ProblemModal`, `createFloatingScore`, `type FloatingScore` from `src/renderer/index.ts`. **Blocked by**: T024, T025.
- [ ] T028 [US1] Extend `index.html`: add `#problem-modal` overlay element with `<div class="problem-text"></div>` + `<ul class="answer-choices">` containing three `<li class="answer-choice" data-idx="0/1/2"></li>`; add `<div id="floating-scores"></div>` as a sibling host positioned near `#score`. CSS additions inside the existing `<style>` block: `#problem-modal .problem-text` (large readable font, 24 px+ on mobile); `.answer-choices` (no list-style, vertical stack on narrow viewports); `.answer-choice` (44 px+ tap target, padding, rounded corners, Tron-cyan border); `.answer-choice.is-highlighted` (brighter background + bolder border); `.floating-score` (`position: absolute`, top: 0, right: 0 anchored to `#floating-scores`, `transition: transform 1s ease-out, opacity 1s ease-out`, default state `transform: translateY(0) opacity: 1`, target state class triggered on append `transform: translateY(-60px) opacity: 0`); `.floating-score--green { color: #22cc88; }`; `.floating-score--red { color: #ff5a5a; }`.
- [ ] T029 [US1] Extend `src/main.ts` to query `#problem-modal` and `#floating-scores`; add bootstrap guards; pass both through to `createGameLoop` via the `GameLoopHostElements` interface. **Blocked by**: T028.
- [ ] T030 [US1] Wire gate spawning + collision + modal in `src/game/game-loop.ts`:
  - Add `let gates: ProblemGate[] = []` and `let lastSpawnedGateId = 0` alongside the existing `obstacles` state.
  - Instantiate `problemModal = createProblemModal(host.problemModal)` and `floatingScore = createFloatingScore(host.floatingScores)` at the top of `createGameLoop`.
  - After each `nextObstacleGroup(...)` call inside the spawn loop, also call `augmentRowWithGates(obstacleGroup.blockedLanes, rng)` and push results into `gates` (thread the rng / `lastSpawnedGateId`). Use the same `OBSTACLES_INITIAL_SPAWN_Z` as the initial `worldZ`.
  - Each frame in `'running'`, after advancing obstacle `worldZ`s: iterate `gates` and advance each by `distanceDelta`; for each gate run `gateCollidesAt(player, gate)`. If positive AND `world.invincibilityRemainingMs === 0`: call `world = enterAnswering(world, gate)`, remove that gate from `gates`, call `problemModal.show(gate.problem, onModalCommit)`. If positive AND invincibility > 0: remove the gate silently (no modal).
  - Cull gates whose `worldZ > OBSTACLE_CULL_Z` (same threshold as obstacles).
  - `onModalCommit(choiceIndex)`: compute `isCorrect = (choiceIndex === gate.problem.correctIndex)`; `world = resolveAnswer(world, isCorrect, GATE_CATALOGUE[gate.difficulty].points)`; call `floatingScore.pop(\`${isCorrect ? '+' : '-'}${GATE_CATALOGUE[gate.difficulty].points}\`, isCorrect ? 'green' : 'red')`; if `world.runState === 'game-over'` call `triggerGameOver()` (the existing helper); else call `problemModal.hide()`.
  - Each frame call `renderer.updateGates(gates)` alongside `renderer.updateObstacles(obstacles)`.
  - On `restartFromInput`: reset `gates = []`, `lastSpawnedGateId = 0`, `problemModal.hide()`.
  - Update score readout to use `formatScore(computeScore(world.tickMs, world.scoreDelta))`.
  **Blocked by**: T012, T020, T022, T023, T026, T027, T029.
- [ ] T031 [US1] Confirm all US1 tests + the foundational tests are green. Run `npm test`. Expected: 10+ test files, 150+ tests, all passing. **Blocked by**: T013–T030.
- [ ] T032 [US1] Manual desktop validation per [quickstart.md](./quickstart.md) §3–5: hit a B / M / A gate; verify modal opens with the world visibly frozen (timer paused, no scrolling); answer correct and verify +1000/+5000/+10000 with green float; answer wrong on subsequent gate and verify -N red float AND one heart in the HUD switches to outlined. Test all three input modes (arrow + Enter, mouse click, touch tap on a touch device or via DevTools touch emulation).

**Checkpoint**: Gates spawn alongside obstacles; modal flow works end-to-end; world freezes/resumes correctly; wrong answers visibly consume a life; all three input modes commit identically. Score readout updates instantly; floating animations are visible.

---

## Phase 4: User Story 2 — Three lives and a grace window soften the obstacle game (Priority: P2)

**Goal**: Obstacle collisions now cost one life rather than ending the run; on collision the runner respawns in the centre lane and blinks invincibly for 3 seconds during which obstacles AND gates pass harmlessly through. The third life loss ends the run (any mix of obstacle hits + wrong answers).

**Independent Test**: Per spec.md User Story 2 + [quickstart.md](./quickstart.md) §6. Deliberately collide with obstacles three times (spaced > 3 s apart). Observe each heart turn outlined + respawn + blink + 3 s of harmless obstacle pass-through. Confirm the third strike triggers game-over.

### Tests for User Story 2

- [ ] T033 [P] [US2] Extend `src/runner-engine/runner-engine.test.ts` with `consumeLife` + `tickInvincibility` cases: `consumeLife({ lives: 3, ... }, 'obstacle')` → `{ lives: 2, invincibilityRemainingMs: 3000, runState: 'running' }`; `consumeLife({ lives: 1, ... }, 'obstacle')` → `{ lives: 0, runState: 'game-over', invincibilityRemainingMs: 0 }` (no invincibility set when life loss ends the run); `tickInvincibility({ invincibilityRemainingMs: 1000, ... }, 500)` → `{ invincibilityRemainingMs: 500 }`; `tickInvincibility({ invincibilityRemainingMs: 100, ... }, 500)` → `{ invincibilityRemainingMs: 0 }` (clamped); `tickInvincibility` is a no-op when `runState !== 'running'` and when `invincibilityRemainingMs === 0`. Emits `console.debug` events: `life_consumed` on consume, `invincibility_started` when invincibility set, `invincibility_ended` on the transition-to-0 frame.
- [ ] T034 [P] [US2] Write `tests/integration/lives-flow.test.ts`: construct a fresh world (`lives: 3`); inject an obstacle at the player's lane crossing `worldZ = 0`; simulate one collision frame; assert `lives === 2`, `invincibilityRemainingMs === 3000`, `runState === 'running'`. Tick 1500 ms of frames; assert `invincibilityRemainingMs === 1500`. Inject a second obstacle in the player's current lane; simulate collision; assert NO life consumed, NO new invincibility window — gate passes through. Tick 2000 ms more; assert `invincibilityRemainingMs === 0`. Inject a third obstacle; collision fires normally; `lives === 1`. Then `lives === 0`; assert `runState === 'game-over'`. Pure-logic only; no DOM.

### Implementation for User Story 2

- [ ] T035 [US2] Implement `consumeLife(world, cause)` and `tickInvincibility(world, dtMs)` in `src/runner-engine/runner-engine.ts`. `consumeLife`: when `lives === 1`, returns `{ ...world, lives: 0, runState: 'game-over', invincibilityRemainingMs: 0 }` and emits `run_ended` + `life_consumed`; otherwise returns `{ ...world, lives: lives - 1, invincibilityRemainingMs: cause === 'obstacle' ? INVINCIBILITY_DURATION_MS : world.invincibilityRemainingMs }` and emits `life_consumed`; when invincibility is set, also emits `invincibility_started`. NOTE: per spec FR-011, invincibility is only granted as the post-obstacle-collision grace — wrong-answer life loss does NOT set invincibility. `tickInvincibility`: when `invincibilityRemainingMs > 0`, returns `{ ...world, invincibilityRemainingMs: Math.max(0, world.invincibilityRemainingMs - dtMs) }`; emits `invincibility_ended` when the new value is 0 and the old was > 0. No-op outside `'running'`. Makes T033 tests green. **Blocked by**: T033.
- [ ] T036 [US2] Update `src/runner-engine/runner-engine.ts` `resolveAnswer` from US1 (T023) to delegate the life-decrement to `consumeLife(world, 'wrong-answer')` when `isCorrect === false`. This preserves the "wrong answer does not grant invincibility" rule via consumeLife's cause-gated behaviour. Re-verify T015 tests pass; no test change needed because the observable state (lives decremented + maybe game-over) is unchanged. **Blocked by**: T023, T035.
- [ ] T037 [US2] Wire obstacle-collision-now-costs-a-life + respawn + invincibility countdown in `src/game/game-loop.ts`:
  - Replace the current `triggerGameOver()` call inside the obstacle-collision loop. The new flow: if `world.invincibilityRemainingMs === 0` AND `collidesAt(player, obstacle)` fires, call `world = consumeLife(world, 'obstacle')`, reposition the player via `player = createPlayerState()` (centre lane), and remove that obstacle from `obstacles`. If `world.runState === 'game-over'` after that, call `triggerGameOver()`; otherwise continue running.
  - If invincibility > 0 and a collision would fire, silently remove the obstacle from `obstacles` without consuming a life.
  - Each frame in `'running'`: call `world = tickInvincibility(world, dtMs)` after `tickWorld`.
  - On `restartFromInput`: existing state reset already handles lives via `restartRun`; gates list reset is from T030.
  **Blocked by**: T030, T035, T036.
- [ ] T038 [US2] Implement runner blink during invincibility: in `src/renderer/three-renderer.ts`, extend `draw(player, world, ...)` to accept (or read from `world`) the invincibility flag. When `world.invincibilityRemainingMs > 0`, oscillate the runner mesh's material opacity (and trail's brightness) at ~6 Hz between `1.0` and `0.4` (or fully visible / hidden). Effect ends when `invincibilityRemainingMs` reaches 0. No alloc per frame — reuse a precomputed phase value or `Math.sin(performance.now() / freqMs)`.
- [ ] T039 [US2] Confirm all US2 tests green; full test suite passes. Run `npm test`. Expected: 11+ test files, 165+ tests. **Blocked by**: T033–T038.
- [ ] T040 [US2] Manual desktop validation per [quickstart.md](./quickstart.md) §6: deliberately drive into an obstacle; one heart switches to outlined; runner respawns in centre + blinks for ~3 s; during the blink, drive into another obstacle — passes harmlessly; during the blink, drive into a gate — passes harmlessly with no modal and no score change (per spec FR-012). After the blink ends, the next obstacle collision costs another heart. Lose the third heart → game-over overlay appears immediately.

**Checkpoint**: Lives + invincibility flow is fully functional. The game has shifted from "one obstacle kills you" to "three-strike survival with recovery windows."

---

## Phase 5: User Story 3 — The run ends when lives OR score run out (Priority: P3)

**Goal**: Two explicit game-over conditions: lives reach 0 (covered by Phases 3+4) OR cumulative score drops below 0. The final score is displayed as the actual negative number when score-below-zero ends the run (no clamping).

**Independent Test**: Per spec.md User Story 3 + [quickstart.md](./quickstart.md) §7. Start a fresh run; before earning much score (< 30 s, tick-derived ~300), hit an M gate (-5000 penalty) and answer wrong; verify the run ends and the game-over overlay shows a negative final score (e.g., `-4700`) even though hearts remain.

### Tests for User Story 3

- [ ] T041 [P] [US3] Extend `src/runner-engine/runner-engine.test.ts` with explicit score-below-zero cases: `resolveAnswer` wrong with `tickMs: 4000, scoreDelta: 0, lives: 3, points: 5000` returns `runState: 'game-over'` via the score-below-zero path (assert `computeScore(world.tickMs, world.scoreDelta) < 0`); `lives: 2` (still positive — verifies it was the score-below-zero condition that fired, not the lives-zero one); `score_went_negative` `console.debug` event fired. Compare with `resolveAnswer` wrong with `tickMs: 100_000, scoreDelta: 0, lives: 3, points: 1000` — does NOT end the run (total stays positive: 100_000-derived score ≫ 1000 penalty).

### Implementation for User Story 3

- [ ] T042 [US3] Update `triggerGameOver()` in `src/game/game-loop.ts` to use the two-arg `computeScore(world.tickMs, world.scoreDelta)` when populating `host.gameOverScore.textContent` so the negative number is rendered verbatim. If `formatScore` clamps or strips the minus sign, update `src/score/score.ts` `formatScore` to preserve it (`String(score)` does this naturally; verify no thousands-separator helper introduces clamping). **Blocked by**: T030, T037.
- [ ] T043 [US3] Confirm T041 test green; full suite passes. Run `npm test`. **Blocked by**: T041, T042.
- [ ] T044 [US3] Manual desktop validation per [quickstart.md](./quickstart.md) §7: start fresh run; within first ~20 s hit an M gate and answer wrong; verify game-over overlay appears immediately even though hearts remain; verify final score reads a negative number (e.g., `"-4700"`).

**Checkpoint**: Both game-over conditions verifiable and visually distinct. The two-ways-to-lose rule is fully wired and player-visible.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T045 [P] Update `CLAUDE.md` top-of-file project description: replace "geometry-question gates" with "problem gates" in the opening paragraph; preserve the difficulty-colour-and-label rule. The `<!-- SPECKIT START -->` block was already updated by `/speckit-plan` and does not need further changes.
- [ ] T046 [P] Update `README.md`: replace "geometry-question gates" in the opening paragraph with "problem gates" (matching the spec's FR-017 terminology); add one new bullet to the "What's in it (so far)" section summarising the slice — suggested wording: "**Problem gates + lives**: B/M/A glowing Rubik's-cube gates spawn alongside obstacles; collision opens a modal with three answer choices; correct = +1k/5k/10k, wrong = -same + −1 life. 3 lives per run displayed as geometric hearts; obstacle hits now cost a life and respawn the runner with 3 s blinking invincibility. Game over on either 0 lives or score < 0."
- [ ] T047 Run `npm run typecheck`. Resolve any TypeScript errors. The four new WorldState fields + `'answering'` runState union extension may surface narrowing issues at switch sites or destructuring assignments — fix by adding the missing cases.
- [ ] T048 Run `npm run lint`. Resolve any boundary violations. The new `src/problem-gates/` and `src/problems/` modules MUST NOT import `three` or DOM types — the existing `no-restricted-imports` rule catches this if it's configured against the directory pattern (verify the rule's allowlist covers the new directories, extend if needed).
- [ ] T049 Run `npm run build`. Verify the production bundle still gzips to under 500 KB (current ~145 KB; this slice adds ~5–8 KB across new modules + DOM helpers + placeholder problem text).
- [ ] T050 320 px viewport validation: open Chrome DevTools → Device Toolbar → iPhone SE (or any 320 px wide preset). Verify the `#hud` row fits the timer + lives-HUD + score without overflow. Open the modal; verify problem text wraps and the three answer choices stack vertically with ≥ 44 px tap targets. Trigger a floating score `+1000` and verify it doesn't overflow the right edge.
- [ ] T051 Mobile-device validation on a real iOS Safari and / or Android Chrome device on the same LAN: swipe lane-changes during running mode still work; tap on a modal answer commits; swipes during modal mode are ignored (no accidental commits). Verify no `console.error` or unhandled promise rejections during a 60 s run that includes ≥ 3 gate hits and ≥ 1 obstacle collision.
- [ ] T052 Final end-to-end validation per [quickstart.md](./quickstart.md) "Definition of done" checklist — tick every box.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: empty.
- **Foundational (Phase 2)**: T001 || T002 (parallel — different files); T003 sequential after both; T004 after T003; T005 after T001; T006 after T005; T007 sequential; T008 after T007; T009 after T008; T010 sequential (HTML); T011 after T010; T012 after T004 + T009 + T011. Phase 2 BLOCKS all user-story phases.
- **User Story 1 (Phase 3)**: T013–T018 are tests in parallel across different files; T019–T028 are implementations with the dependencies declared in each task; T030 is the integration ceiling (depends on most of the prior work). Phase 3 can start once Phase 2 completes.
- **User Story 2 (Phase 4)**: T033 + T034 tests in parallel; T035 implements both new transitions; T036 updates resolveAnswer to use consumeLife; T037 wires obstacle behaviour; T038 adds the blink visual. Phase 4 depends on T030 (US1's game-loop changes) since both stories modify the same file.
- **User Story 3 (Phase 5)**: T041 test; T042 implementation; T043–T044 verify. Depends on T030 + T037 (both stories' game-loop changes must be live first).
- **Polish (Phase 6)**: depends on US1 + US2 + US3 complete; tasks within Phase 6 are mostly independent.

### Within Phase 3 (User Story 1)

- Tests (T013, T014, T015, T016, T017, T018) can be written in parallel — six independent files.
- Implementations:
  - T019 → T020 (problems module + barrel) — sequential, both small.
  - T021 → T022 (problem-gates module + barrel) — sequential; T021 needs T019.
  - T023 (runner-engine transitions) — depends on foundational T004 + T006, on test T015. Can run alongside T019/T021 if developers are separate.
  - T024 (problem-modal) and T025 (floating-score) — parallel renderer helpers, each blocked only by its test.
  - T026 (Three.js gates rendering) — independent except for the type imports.
  - T027 (renderer barrel) — sequential after T024 + T025.
  - T028 (index.html) — sequential.
  - T029 (main.ts wiring) — after T028.
  - T030 (game-loop wiring) — sequential at the end of US1; depends on most prior implementation tasks.

### Within Phase 4 (User Story 2)

- T033 || T034 (tests, different files).
- T035 → T036 (transitions then wiring update). T037 follows T036.
- T038 (renderer blink) is independent of T035–T037 but is conceptually paired.

### Parallel Opportunities

- **Phase 2**: T001 || T002, then T005 || T007 (T005 needs T001, T007 is independent), then implementations land in parallel where the test dependencies allow.
- **Phase 3 tests**: T013 || T014 || T015 || T016 || T017 || T018 (six files).
- **Phase 3 implementations**: T019 ‖ T024 ‖ T025 ‖ T026 (problems pool / modal / floating-score / Three.js gates render — four independent files). T021 needs T019 to land first.
- **Phase 4 tests**: T033 || T034.
- **Phase 6 polish**: T045 || T046 (docs), then T047 → T048 → T049 (sequential build chain), then T050 || T051 (manual).

---

## Parallel Example: User Story 1

```text
# Stage 1: write tests in parallel (six files)
T013 - src/problems/problems.test.ts
T014 - src/problem-gates/problem-gates.test.ts
T015 - src/runner-engine/runner-engine.test.ts (extend with enterAnswering + resolveAnswer)
T016 - tests/integration/problem-gate-flow.test.ts
T017 - src/renderer/problem-modal.test.ts
T018 - src/renderer/floating-score.test.ts

# Stage 2: implementations in parallel where possible
T019 - src/problems/problems.ts
T024 - src/renderer/problem-modal.ts (parallel with T019)
T025 - src/renderer/floating-score.ts (parallel)
T026 - src/renderer/three-renderer.ts updateGates (parallel)

# Stage 3: implementations that depend on Stage 2
T020 - src/problems/index.ts (after T019)
T021 - src/problem-gates/problem-gates.ts (after T019)
T023 - src/runner-engine/runner-engine.ts enterAnswering + resolveAnswer (after foundational)

# Stage 4: barrels + DOM + main
T022 - src/problem-gates/index.ts
T027 - src/renderer/index.ts re-exports
T028 - index.html (modal + floating-scores DOM)
T029 - src/main.ts wiring

# Stage 5: game-loop wiring (sequential, integrates everything)
T030 - src/game/game-loop.ts

# Stage 6: confirm tests + manual acceptance
T031 - npm test
T032 - browser at localhost:5173
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1: Setup — no work.
2. Phase 2: Foundational (T001–T012) — types, constants, WorldState, lives-HUD scaffolding.
3. Phase 3: US1 end-to-end (T013–T032) — gates, modal, scoring with delta, floating animation, wrong-answer life loss.
4. **STOP and VALIDATE**: gate Q&A flow works on its own. Obstacle collisions still end the run instantly (slice-003 behaviour) — that's fine for MVP. The wrong-answer life-loss makes the lives HUD already meaningful.

### Incremental delivery

1. MVP ships → US2 (T033–T040) adds the lives-aware obstacle collision + invincibility + blink → "soft" obstacles → ship.
2. → US3 (T041–T044) adds the explicit two-game-over-conditions verification + negative-score display polish → ship.
3. → Phase 6 polish (T045–T052) is the docs + final verification pass → final ship.

### Parallel team strategy

With two developers after Phase 2 completes:

- Developer A: US1 (modal + gates + score flow).
- Developer B: US2 (lives + obstacle change + invincibility) — note that B must coordinate on `game-loop.ts` since both stories modify it; consider B branching off A's WIP rather than off the foundational tip.

---

## Notes

- `[P]` = different files, no incomplete-task dependencies.
- Tests MUST be red before the matching implementation lands (Constitution II). The pure-logic tests (T013–T015, T033, T041) are the highest-value test layer; renderer DOM smoke tests (T017, T018, T007) are lighter weight.
- Commit at every logical group — e.g., one commit per task or one per `[P]` cluster within a phase. Match the prior slices' `impl(005): ...` convention.
- Avoid: importing `three` or DOM types into `src/problem-gates/` or `src/problems/` (will fail the ESLint boundary rule); putting the lives HUD update or modal in pure-logic modules; mixing US2's obstacle-respawn change into T030 (US1 task) — it belongs in T037 (US2).
- The contracts file mentions `consumeLife(world, cause)` but doesn't gate the invincibility-setting on `cause`; the implementation (T035) makes this explicit: invincibility is only granted on `cause === 'obstacle'`, per spec FR-011. If a future test catches the contracts-file ambiguity, update `contracts/module-contracts.md` to match the implementation.
- Manual validation steps (T032, T040, T044, T050, T051) require a live browser; checkpoint your work before each so a regression is easy to isolate.
