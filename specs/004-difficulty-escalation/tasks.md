---
description: "Dependency-ordered tasks for the Difficulty Escalation slice (004-difficulty-escalation)"
---

# Tasks: Difficulty Escalation by Tier

**Input**: Design documents from `specs/004-difficulty-escalation/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/module-contracts.md](./contracts/module-contracts.md), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. Constitution Principle II (Test-First) - the new pure functions in `src/escalation/`, the rewritten `computeScore`, and the extended `tickWorld` signature each get their unit tests written before their implementations land. The new integration case (cross-tier speed change) is also written first.

**Organization**: One user story (P1) covering both speed and score escalation; they share the tier derivation and would be artificial to split.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared incomplete dependencies).
- **[Story]**: `[US1]`. Setup, Foundational, and Polish phases carry no story label.
- File paths in descriptions are exact and align with the project structure in [plan.md](./plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

This slice inherits all setup from 001-003. No project-level setup work required.

*(no tasks)*

---

## Phase 2: Foundational (Blocking Prerequisites)

No new shared types, constants, or modules need to land before the user-story work. The tier is derived purely from `WorldState.tickMs` (already in `src/shared/types.ts` since 001), and `RUN_SPEED_UNITS_PER_SEC` (already in `src/shared/config.ts`) is the baseline the escalation multiplies against.

*(no tasks)*

---

## Phase 3: User Story 1 - Speed and score escalate every 30 seconds (Priority: P1) 🎯 MVP

**Goal**: Every 30 seconds of running time the game enters the next "tier": run speed multiplies by 1.10x; score-per-100ms increases by +1. Pause / restart / game-over behaviour comes for free because the tier is derived from the existing `tickMs` counter.

**Independent Test**: `npm run dev`, begin a run. Read the score at 10 s (`100`), at 30 s (`300`), at 35 s (`400`), at 60 s (`900`), at 90 s (`1800`). Visually confirm the world speeds up at each 30-second mark. Pause for any duration mid-run; on resume, the tier matches the moment of pause.

### Tests for User Story 1 (write FIRST, assert red, then implement)

- [X] T001 [P] [US1] Write unit tests for `currentTier` and `speedMultiplier` in a new file. Cases: `currentTier(0) === 0`, `currentTier(29_999) === 0`, `currentTier(30_000) === 1`, `currentTier(59_999) === 1`, `currentTier(60_000) === 2`, `currentTier(89_999) === 2`, `currentTier(90_000) === 3`, `currentTier(120_000) === 4`; monotonicity sweep 0..120_000 ms in 100 ms steps asserting non-decreasing output. For `speedMultiplier`: `speedMultiplier(0) === 1`, `speedMultiplier(1)` within 1e-10 of `1.1`, `speedMultiplier(2)` within 1e-10 of `1.21`, `speedMultiplier(3)` within 1e-10 of `1.331`, strict-monotonic sweep across tiers 0..30. File: `src/escalation/escalation.test.ts`.
- [X] T002 [P] [US1] Rewrite the `computeScore` test cases in `src/score/score.test.ts` for the new piecewise formula. **Drop** the "no-skip-or-duplicate" sweep (the new formula's sequence has +(tier+1) jumps at boundaries, which would fail a strict 0,1,2,... assertion). **Keep** tickMs-0..29_900 cases (still in tier 0, behaviour unchanged: 0, 0, 1, 1, 2, 100, 299). **Add** new piecewise cases per spec SC: `computeScore(30_000) === 300`, `computeScore(30_100) === 302`, `computeScore(35_000) === 400`, `computeScore(60_000) === 900`, `computeScore(89_900) === 1797`, `computeScore(90_000) === 1800`, `computeScore(120_000) === 3000`. Keep a coarser monotonicity sweep 0..600_000 ms in 100 ms steps (no decreases). File: `src/score/score.test.ts`.
- [X] T003 [P] [US1] Extend `src/runner-engine/runner-engine.test.ts` with two cases for `tickWorld`'s new optional `speedOverride` parameter: (a) when supplied (e.g. `tickWorld(world, 1000, RUN_SPEED_UNITS_PER_SEC * 1.10)`), the resulting `distanceUnits` MUST equal `RUN_SPEED_UNITS_PER_SEC * 1.10` (the override is honoured, not `world.speedUnitsPerSec`); (b) when supplied AND `runState !== 'running'`, the `tickWorld` is still a no-op (the runState guard still applies, overriding has no effect on a paused/game-over world).
- [X] T004 [P] [US1] Extend `tests/integration/lane-switch-flow.test.ts` with a case that starts a run, calls `tickWorld(world, dtMs, effectiveSpeed)` for ~31 seconds of simulated time (where `effectiveSpeed = baseline * speedMultiplier(currentTier(world.tickMs))` per frame), and asserts: at `tickMs = 25_000` the per-frame distance gain is `baseline * 1`; at `tickMs = 35_000` it is `baseline * 1.10`; at `tickMs = 65_000` it is `baseline * 1.21`. Pure-logic test - no DOM / canvas needed.

### Implementation for User Story 1

- [X] T005 [P] [US1] Implement `src/escalation/escalation.ts`: export `currentTier(tickMs)` returning `Math.floor(tickMs / 30_000)` and `speedMultiplier(tier)` returning `Math.pow(1.10, tier)`. Both pure, total, no side effects. File: `src/escalation/escalation.ts`.
- [X] T006 [US1] Implement `src/escalation/index.ts` as the public barrel: `export { currentTier, speedMultiplier } from './escalation';`. **Blocked by**: T005.
- [X] T007 [US1] Rewrite `computeScore` in `src/score/score.ts` to the closed-form piecewise formula per `data-model.md`. New body: `const N = Math.floor(tickMs / 30_000); const completed = 300 * N * (N + 1) / 2; const current = Math.floor((tickMs - N * 30_000) / 100) * (N + 1); return completed + current;`. Keep the function signature and the existing `formatScore` + `formatTimer` exports unchanged. Makes T002 tests green. **Blocked by**: T002.
- [X] T008 [US1] Extend `tickWorld` in `src/runner-engine/runner-engine.ts` with an optional `speedOverride?: number` parameter. When omitted, behaviour is unchanged from prior slices. When supplied, the per-frame distance gain uses `speedOverride` in place of `world.speedUnitsPerSec`. The existing `runState === 'running'` guard still applies. Makes T003 tests green. **Blocked by**: T003.
- [X] T009 [US1] Wire escalation into `src/game/game-loop.ts`: import `currentTier` + `speedMultiplier` from `../escalation`; in the per-frame `'running'` branch compute `const tier = currentTier(world.tickMs); const effectiveSpeed = RUN_SPEED_UNITS_PER_SEC * speedMultiplier(tier);` and pass `effectiveSpeed` as the third arg to `tickWorld`. Track `lastObservedTier: number` at the game-loop level (initial 0); when `tier !== lastObservedTier` emit `console.debug({ event: 'tier_advanced', previousTier: lastObservedTier, newTier: tier, tickMs: world.tickMs })` and update `lastObservedTier`. Reset `lastObservedTier = 0` in `restartFromInput`. **Blocked by**: T005, T007, T008.
- [X] T010 [US1] Confirm all four test files (T001-T004) are green after T005-T009 land. Run `npm test`; expected: 9+ test files, 130+ tests, all passing. **Blocked by**: T005-T009.
- [ ] T011 [US1] Manual desktop validation per [quickstart.md](./quickstart.md) §"Validate the slice on desktop" - all seven US1 acceptance scenarios in spec.md pass on `localhost:5173`. Watch the score at 10 s = `100`, 30 s = `300`, 35 s = `400`, 60 s = `900`, 90 s = `1800`. Verify visible speed-up at each 30 s mark.

**Checkpoint**: Difficulty escalation is fully functional. The game has its first progression curve; speed and score both scale every 30 seconds.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T012 Run `npm run typecheck`; resolve any TypeScript errors.
- [X] T013 Run `npm run lint`; resolve any boundary violations. The new `src/escalation/` module MUST NOT import `three` or any DOM types - the existing `no-restricted-imports` rule catches this.
- [X] T014 Run `npm run build`; verify `dist/` contains the production bundle and that the gzipped JS is still under the 500 KB Constitution budget (current 145.31 KB; new module + small score change should add only ~1-2 KB).
- [ ] T015 Validate the HUD on a 320 px viewport (Chrome DevTools -> Device Toolbar -> "iPhone SE" or any 320 px wide preset). The score readout grows to 4-5 digits within the first minute and 5-6 digits over a long run; verify alignment doesn't overflow the right edge.
- [ ] T016 Final end-to-end validation per [quickstart.md](./quickstart.md) §"Definition of done" - tick every checkbox.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: empty.
- **Foundational (Phase 2)**: empty.
- **User Story 1 (Phase 3)**: T001-T004 are tests (independent of each other - different files); T005, T007, T008 are implementations (different files); T006 depends on T005; T009 depends on T005, T007, T008; T010 depends on T005-T009; T011 is manual.
- **Polish (Phase 4)**: depends on US1.

### Within Phase 3

- Tests (T001-T004) can be written in parallel.
- Pure-logic implementations (T005, T007, T008) can be written in parallel.
- Barrel re-export (T006) is sequential after T005.
- Game-loop wiring (T009) is sequential after the implementations.

### Parallel Opportunities

- T001 || T002 || T003 || T004 (four independent test files).
- T005 || T007 || T008 (three independent implementation files: escalation.ts, score.ts, runner-engine.ts).

---

## Parallel Example: User Story 1

```text
# Stage 1: write tests in parallel
T001 - src/escalation/escalation.test.ts
T002 - src/score/score.test.ts (rewrite cases)
T003 - src/runner-engine/runner-engine.test.ts (extend)
T004 - tests/integration/lane-switch-flow.test.ts (extend)

# Stage 2: implementations in parallel
T005 - src/escalation/escalation.ts
T007 - src/score/score.ts (rewrite computeScore)
T008 - src/runner-engine/runner-engine.ts (add speedOverride param)

# Stage 3: barrel + wiring (sequential)
T006 - src/escalation/index.ts
T009 - src/game/game-loop.ts (effectiveSpeed + tier_advanced event)

# Stage 4: confirm tests + manual acceptance
T010 - npm test
T011 - browser at localhost:5173
```

---

## Implementation Strategy

This is a single-story slice; MVP and complete slice are the same thing.

1. Phase 3 US1 end-to-end (T001-T011).
2. Phase 4 Polish (T012-T016) to ship.

---

## Notes

- `[P]` tasks touch different files and have no incomplete-task dependencies.
- Tests MUST be red before the matching implementation lands (Constitution II). The `computeScore` rewrite (T007) is the highest-risk change: it materially alters the function's output values past 30 seconds. The 2 existing test cases that this breaks (the old simple-formula assumption) are rewritten in T002 BEFORE the implementation changes in T007.
- Commit at every logical group.
- Avoid: changing file paths from those listed here; importing `three` or DOM types into `src/escalation/` (will fail the ESLint boundary rule).
