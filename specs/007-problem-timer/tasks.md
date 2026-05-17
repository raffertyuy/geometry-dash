---

description: "Task list for feature 007 — Problem Gate Countdown Timer"
---

# Tasks: Problem Gate Countdown Timer

**Input**: Design documents from `/specs/007-problem-timer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/module-contracts.md, quickstart.md

**Tests**: Required — Constitution Principle II (Test-First Discipline) makes scoring/answer-routing changes a tests-mandatory area. Each user story has tests authored before/alongside implementation.

**Organization**: Tasks are grouped by user story per [spec.md](./spec.md). US1 (P1) and US2 (P1) together form the MVP; US3 (P3) is polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps task to user story (US1, US2, US3)

## Path Conventions

- Single web project (per [plan.md](./plan.md)). Source under `src/`; tests are colocated as `*.test.ts` files alongside their modules.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Nothing to scaffold — the project already exists and this slice adds no new files. This phase is intentionally empty.

*(No tasks. Proceed to Phase 2.)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared type + config constants used by every user story below. These are read by `problem-modal.ts` (US1, US3) and by `game-loop.ts` (US2). Must land first; everything after depends on them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 [P] Add `AnswerResult` tagged-union type to `src/shared/types.ts` per [data-model.md §1](./data-model.md). Export alongside the existing types. No internal callers updated yet — that happens in US2.
- [ ] T002 [P] Add countdown constants to `src/shared/config.ts`: `QUESTION_TIMER_MS_B = 60_000`, `QUESTION_TIMER_MS_M = 120_000`, `QUESTION_TIMER_MS_A = 180_000`, `QUESTION_TIMER_MS_BY_DIFFICULTY` (Readonly Record), `QUESTION_TIMER_URGENCY_MS = 10_000`, `QUESTION_TIMER_DISPLAY_INTERVAL_MS = 250`. Match [data-model.md §3](./data-model.md) exactly so tests can assert against the constants directly.

**Checkpoint**: Foundational types + constants exist. `npm run typecheck` passes (no consumers yet — `AnswerResult` is declared but unused, which is fine).

---

## Phase 3: User Story 1 — Visible countdown pressures the player (Priority: P1) 🎯 MVP

**Goal**: A clearly readable countdown is rendered in the problem-gate modal, showing the difficulty-specific initial duration (60/120/180 s) and ticking down once per second. The countdown freezes immediately when the player picks an answer; existing pick → review-state → 3 s auto-continue flow is unchanged.

**Independent Test**: Open a Basic gate, see `1:00`, watch it tick to `0:59` etc., pick an answer, confirm freeze and that existing scoring/review flow runs. Repeat for Medium (`2:00`) and Advanced (`3:00`). This story alone delivers value: even without timeout consequences, the player feels time pressure and the visible countdown is itself a UX improvement.

### Tests for User Story 1 (write first; verify they FAIL before implementation)

- [ ] T003 [P] [US1] In `src/renderer/problem-modal.test.ts`, add a `describe('question countdown — display')` block with tests that mount the modal, call `show()` with a stub Problem for each difficulty, advance fake timers, and assert the `.countdown-question` element's `textContent`:
  - Initial render: `1:00` / `2:00` / `3:00` for B / M / A.
  - After advancing 1 s of fake time + flushing `QUESTION_TIMER_DISPLAY_INTERVAL_MS`: `0:59` / `1:59` / `2:59`.
  - After advancing 15 s: `0:45` / `1:45` / `2:45`.
- [ ] T004 [P] [US1] In the same file, add a `describe('question countdown — stop on pick')` block: call `show()` for a Basic gate, advance fake time by 20 s, programmatically click choice A, assert `.countdown-question` `textContent` does not change after a further 30 s of fake time, and assert no `gate_timer_expired` debug event was emitted.
- [ ] T005 [P] [US1] In the same file, add a drift test (`describe('question countdown — drift')`): for a Basic gate, stub `performance.now()` to advance non-uniformly (e.g. one big jump of 59_999 ms, then another of 1 ms), and assert the internal `remainingMs` getter (exposed via the debug-snapshot seam from contract §1.3) returns exactly 0 at the end — NOT a `setInterval`-tick-count remainder. (FR-004, SC-004)

### Implementation for User Story 1

- [ ] T006 [US1] In `src/renderer/problem-modal.ts`, add the `.countdown-question` DOM element inside `buildBody()` between the difficulty badge and the prompt. Render the initial `M:SS` string from the new constants.
- [ ] T007 [US1] In `src/renderer/problem-modal.ts`, add closure-scoped `QuestionTimerState` (`startedAtMs`, `pausedAccumulatedMs`, `pausedAtMs`, `status`, `rafId`, `displayIntervalId`, `lastDisplayedSeconds`, `lastDisplayedUrgent`) per [data-model.md §2](./data-model.md). Add a private `remainingMs()` getter that computes `max(0, initialDurationMs - (now - startedAtMs - pausedAccumulatedMs))` where `now = pausedAtMs ?? performance.now()`.
- [ ] T008 [US1] In `src/renderer/problem-modal.ts`, add `startQuestionTimer(durationMs, gateId, difficulty)` and `stopQuestionTimer(reason)` helpers. `start`: set state, emit `gate_timer_started`, schedule `setInterval` at `QUESTION_TIMER_DISPLAY_INTERVAL_MS`, and chain `requestAnimationFrame`. `stop`: clear both, set `status`, emit `gate_timer_stopped_by_answer` (with `remainingMs` payload). The display callback reads `remainingMs()`, formats `M:SS`, and writes to `.countdown-question.textContent` only when the displayed-seconds value changes (use `lastDisplayedSeconds`).
- [ ] T009 [US1] In `src/renderer/problem-modal.ts`, wire `startQuestionTimer` into `show()` (read `QUESTION_TIMER_MS_BY_DIFFICULTY[problem.difficulty]`) and call `stopQuestionTimer('answered')` at the top of `pick()`. Also call `stopQuestionTimer('closed')` in `hide()` and `destroy()` to guarantee no orphan timers.
- [ ] T010 [US1] In `src/renderer/problem-modal.ts`, expose a `getDebugSnapshot()` accessor (closure function returning `{ remainingMs, status, urgent }`) via a `Symbol`-keyed non-enumerable property on the returned `ProblemModal` so tests (T005) and the debug overlay (T020) can read internal state without widening the public surface.
- [ ] T011 [US1] In CSS (where the existing modal rules live — search for `.problem-modal` to find the file), add the `.countdown-question` rule with `font-variant-numeric: tabular-nums` and inherit-friendly sizing per [contracts/module-contracts.md §6](./contracts/module-contracts.md). No urgent rule yet — that's US3.

**Checkpoint**: User Story 1 is fully functional. A player sees the countdown, watches it tick, and picks an answer — the existing flow runs unchanged. Timeout still has no consequence (modal sits at `0:00` doing nothing); US2 fixes that. Tests T003–T005 pass.

---

## Phase 4: User Story 2 — Running out of time counts as a wrong answer (Priority: P1)

**Goal**: When the countdown reaches zero with no pick, the game treats it exactly like a wrong answer: deduct the difficulty's points, lose a life, highlight the correct answer in review state, run the existing 3 s auto-continue. After the modal closes, the runner respawns with the existing 3 s invincibility window.

**Independent Test**: Open a Basic gate, do nothing, wait 60 s, confirm: score `-1000`, one heart lost, review-state shows the correct answer highlighted (no "your pick" highlight), 3 s auto-continue fires, runner respawns blinking. Repeat for M (`-5000`) and A (`-10000`). End-of-run via score-below-zero or zero-lives still works when caused by a timeout.

### Tests for User Story 2 (write first; verify they FAIL before implementation)

- [ ] T012 [P] [US2] In `src/renderer/problem-modal.test.ts`, add `describe('question countdown — timeout')`: for each difficulty, call `show()` with a spy `onResolve`, advance fake time past the initial duration AND past the existing 3 s auto-continue, then assert `onResolve` was called exactly once with `{ kind: 'timeout' }`. Confirm `gate_timer_expired` debug event fired with `{ difficulty }`.
- [ ] T013 [P] [US2] In the same file, add a test that times out a Basic gate and then queries the DOM mid-review-state (before the 3 s auto-continue resolves): assert `is-reviewing` and `is-incorrect` classes on the host, `is-correct-answer` on the correct-index choice, NO `is-wrong-pick` on any choice, and the `.review-feedback` text is `Time's up`.
- [ ] T014 [P] [US2] In `src/game/game-loop.ts` integration tests (or in `problem-modal.test.ts` if no game-loop test file is touched), add a test that drives `showProblemModal` with a Basic gate, lets the modal time out, and asserts: `world.lives` decremented by 1, `world.scoreDelta` reduced by 1000, `floatingScore.pop` was called with `('-1000', 'red')`. Confirm 100% of the wrong-answer code path was taken (SC-006). If `game-loop.ts` has no test file yet, the modal-test variant is acceptable provided it stubs the resolve callback and asserts the contract that game-loop will receive.

### Implementation for User Story 2

- [ ] T015 [US2] In `src/renderer/problem-modal.ts`, widen the `pickedIndex` field type from `0 | 1 | 2 | null` (it is already `0 | 1 | 2 | null` — confirm) to ensure `null` is a first-class value during reviewing. Add a private `handleTimeout()` that: sets `pickedIndex = null`, transitions `state` to `'reviewing'`, emits `gate_timer_expired`, calls a small variant of `syncReviewingFeedback()` that branches on `pickedIndex === null` (no `is-wrong-pick`, feedback text `"Time's up"`), then calls the existing `startCountdown()` (the 3 s auto-continue countdown — distinct from the question countdown).
- [ ] T016 [US2] In `src/renderer/problem-modal.ts`, change `ProblemModal.show`'s signature to `(problem, onResolve: (result: AnswerResult) => void)`. Update `resolve()` to call `cb({ kind: 'pick', choiceIndex: idx })` on the normal path and `cb({ kind: 'timeout' })` when `pickedIndex === null` at resolve time. Wire `handleTimeout()` to fire when `remainingMs()` hits 0 in the display-update callback (T008) — once per modal life, guarded by `status !== 'expired'`.
- [ ] T017 [US2] In `src/renderer/problem-modal.ts`, update `syncReviewingFeedback()` to branch on `pickedIndex === null`: skip the `isCorrect` calculation, set `is-incorrect` on the host, set `is-correct-answer` only on the correct choice, leave all other choices clean (no `is-wrong-pick`), and write `Time's up` into `.review-feedback`. Existing pick-path behaviour is preserved.
- [ ] T018 [US2] In `src/game/game-loop.ts`, update the `problemModal.show(gate.problem, ...)` call site per [contracts/module-contracts.md §2.1](./contracts/module-contracts.md): rename the parameter to `result`, compute `isCorrect = result.kind === 'pick' && result.choiceIndex === gate.problem.correctIndex`. Every downstream branch (score, lives, floating "+N"/"-N", score-below-zero check, game-over) flows through the existing `resolveAnswer` / `floatingScore.pop` calls unchanged.

**Checkpoint**: MVP complete. Timeouts behave identically to manual wrong answers. Tests T012–T014 pass. The slice is shippable; US3 only adds polish.

---

## Phase 5: User Story 3 — Final-seconds urgency cue (Priority: P3)

**Goal**: In the last 10 s before timeout, the countdown turns red, prefixes `Hurry! `, and pulses at 1 Hz. The cue stops the instant the player answers or the modal closes. Multiple redundant non-colour cues satisfy the constitution's no-colour-alone accessibility rule.

**Independent Test**: Open a Basic gate. Until `0:11` the countdown is calm. From `0:10` onward it is red, prefixed `Hurry!`, and pulses. Pick an answer mid-urgency: the cue stops immediately.

### Tests for User Story 3 (write first; verify they FAIL before implementation)

- [ ] T019 [P] [US3] In `src/renderer/problem-modal.test.ts`, add `describe('question countdown — urgency')`:
  - For a Basic gate, advance fake time so `remainingMs > 10_000`; assert `.countdown-question` does NOT carry `countdown-question--urgent` and its text matches `^\d:\d\d$`.
  - Advance fake time until `remainingMs <= 10_000`; assert the class IS present and the text starts with `Hurry! `.
  - Click an answer; assert the class is removed on the next display tick.

### Implementation for User Story 3

- [ ] T020 [US3] In `src/renderer/problem-modal.ts`, extend the display callback in `startQuestionTimer` (T008) to compute `urgent = remainingMs() <= QUESTION_TIMER_URGENCY_MS`. Toggle the `.countdown-question--urgent` class only when `urgent !== lastDisplayedUrgent`. When `urgent`, prepend `Hurry! ` to the displayed `M:SS` text. Make sure `stopQuestionTimer` removes the class.
- [ ] T021 [US3] In CSS, add `.countdown-question--urgent { color: var(--gate-red, #ff4455); animation: question-countdown-pulse 1s ease-in-out infinite; }` and the `@keyframes question-countdown-pulse` block per [contracts/module-contracts.md §6](./contracts/module-contracts.md).

**Checkpoint**: All three user stories are functional and independently testable. Tests T019 passes alongside T003–T014.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Observability, documentation, and final validation per the constitution and the README-currency rule.

- [ ] T022 [P] In `src/renderer/debug-overlay.ts`, add one line `Q-Timer: <ss.s> s` while a modal is open, reading via the modal's debug-snapshot seam from T010. Omit the line when the modal is closed (no stale value).
- [ ] T023 [P] Update `README.md`'s "What's in it (so far)" section with a one-line entry for slice 007 along the lines of: "**Question timer (slice 007)** — every problem gate now has a visible per-difficulty countdown (B=60 s, M=120 s, A=180 s); running out of time counts as a wrong answer."
- [ ] T024 Run the full automated suite and confirm green: `npm run typecheck`, `npm run lint`, `npm test`. Fix any drift introduced during implementation.
- [ ] T025 Run the manual smoke checklist in [quickstart.md](./quickstart.md) — confirm B/M/A initial values, mid-countdown pick freeze, full timeout → wrong-answer flow, urgency cue at 10 s, debug overlay line under `?debug=1`, and bundle-size impact < 1 KB gzipped.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: empty.
- **Phase 2 (Foundational)**: blocks everything below. T001 and T002 are both `[P]` — can run in parallel.
- **Phase 3 (US1)**: depends on Phase 2. Tests T003/T004/T005 can be authored in parallel before implementation; implementation T006–T011 has internal ordering noted below.
- **Phase 4 (US2)**: depends on Phase 2 + T010 (debug snapshot is reused for the timeout flow). Phase 4 can begin in parallel with the later half of Phase 3 once the modal scaffolding from T006/T007 lands, but for clarity ship US1 then US2.
- **Phase 5 (US3)**: depends on Phase 3 (specifically T008 and T011). Cannot start until US1 is functional.
- **Phase 6 (Polish)**: depends on Phases 3–5 complete.

### Within Each User Story

- US1: T003/T004/T005 (tests, parallel) → T006 → T007 → T008 → T009 → T010 → T011. T006 and T007 are sequential (T007 references DOM elements created by T006). T011 (CSS) is independent of T006–T010 and can land in parallel with the implementation tasks.
- US2: T012/T013/T014 (tests, parallel) → T015 → T016 → T017 → T018. T015–T017 are sequential within `problem-modal.ts`; T018 (game-loop) is `[P]`-eligible with T017 only after the `AnswerResult` shape is locked in T016.
- US3: T019 (test) → T020 → T021. T020 and T021 can land in parallel (different files).

### Parallel Opportunities

- T001 and T002 (different files, both Foundational).
- All test-authoring tasks within a story: T003 + T004 + T005; T012 + T013 + T014; T019.
- T011 (CSS) can run alongside US1 implementation tasks T006–T010.
- T022 (debug overlay) and T023 (README) in Phase 6.

---

## Parallel Example: User Story 1 test authoring

```bash
# Author all three US1 tests together (all in the same file but at different
# describe-block scopes; Vitest allows the file to be edited concurrently
# in separate worktrees if desired):
Task: "Display-text tests across difficulties — src/renderer/problem-modal.test.ts"
Task: "Stop-on-pick test — src/renderer/problem-modal.test.ts"
Task: "Drift / monotonic-clock test — src/renderer/problem-modal.test.ts"
```

---

## Implementation Strategy

### MVP first (US1 + US2)

Per spec: US1 and US2 are both P1. Together they form the shippable feature — countdown visible + timeout consequences. US3 is P3 and can ship in a follow-up commit if time-pressured.

1. Foundational (T001–T002).
2. US1 (T003–T011): countdown renders and stops on pick. Validate by playing.
3. US2 (T012–T018): timeouts route through wrong-answer pipeline. Validate via quickstart.
4. **STOP and VALIDATE**: MVP complete. Commit + (optionally) ship.
5. US3 (T019–T021): urgency cue.
6. Polish (T022–T025): observability + README + final automated and manual sweeps.

### Single-developer linear flow (recommended for this slice)

Given the slice is ~100 net LOC and one engineer, the cleanest sequence is strictly T001 → T025 in numerical order. The `[P]` markers above remain useful for the test-authoring batches.

---

## Notes

- Tests for this slice are not optional — Principle II covers scoring/answer logic.
- Every task names exact files and references the relevant contract or data-model section so an implementing LLM can act without rereading the whole feature pack.
- The slice introduces no new module, no new dependency, no persistence — the simplicity bar is set high in `plan.md` and these tasks honour it.
- Commit after each phase boundary at minimum (Phase 2, end of US1, end of US2, end of US3, end of Polish) per the project's autonomous-flow convention.
