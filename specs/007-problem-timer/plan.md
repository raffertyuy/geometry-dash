# Implementation Plan: Problem Gate Countdown Timer

**Branch**: `007-problem-timer` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-problem-timer/spec.md`

## Summary

Add a visible per-question countdown to the problem-gate modal: 60s for Basic, 120s for Medium, 180s for Advanced. The countdown starts when the modal opens (the run is already paused via `runState === 'answering'`), updates at least once per second, and stops the instant the player picks an answer. If the timer reaches zero with no pick, the modal routes the gate through the existing wrong-answer pipeline — losing the difficulty's points (1k/5k/10k), losing a life, highlighting the correct answer in the same review state used today, and triggering the same 3-second auto-continue. The final 10 seconds adopt an urgent visual treatment (red + pulse, paired with a label per the constitution's colour-isn't-alone rule).

Technical approach: the timer lives **inside** `src/renderer/problem-modal.ts` (no new module — YAGNI). It is wall-clock-driven via `performance.now()` with a `requestAnimationFrame` poll plus a 250 ms fallback `setInterval` for visible-only updates, so background-tab throttling cannot grant extra time. The modal's `onResolve` callback contract is extended from a bare `choiceIndex` to a tagged `AnswerResult` so timeout can be signalled to the game-loop without inventing a sentinel index; the game-loop treats `{ kind: 'timeout' }` as `isCorrect = false` and routes through the existing `resolveAnswer` path. No changes are needed to `runner-engine`, `problem-gates`, `score`, `lives-hud`, or any other module.

## Technical Context

**Language/Version**: TypeScript 5.6, ES2022 target, strict mode

**Primary Dependencies**: Three.js 0.184 (renderer only — not touched by this slice), Vite 6 (build), Vitest 2 + jsdom 25 (tests). No new runtime dependencies.

**Storage**: N/A — no persistence in this slice. Timer state is per-modal and dies with it.

**Testing**: Vitest unit + integration tests under `src/**/*.test.ts`, executed via `npm test`. New tests will run headlessly with `vi.useFakeTimers()` plus a stubbed `performance.now()` so countdown drift, expiry, and pause/resume are deterministic.

**Target Platform**: Static web app deployed to Cloudflare Pages; evergreen browsers (Chrome/Firefox/Safari/Edge); mobile-first (iOS Safari + Android Chrome from 320 px wide).

**Project Type**: Single static web project (mirrors slices 001-006).

**Performance Goals**: Modal must continue to meet the 60 FPS desktop / 30 FPS reference-mobile budget. Countdown updates run at most every animation frame; no per-frame allocations in the modal hot path once the modal is open (timer reads `performance.now()` and mutates a number — no object churn).

**Constraints**: No new dependencies; total bundle increase target < 1 KB gzipped (the timer is logic-only + a small CSS rule for the urgency style). Countdown must drift < 500 ms over its full duration vs. wall-clock, including a brief tab background, per spec SC-004.

**Scale/Scope**: One countdown active at a time (problem gates are mutually exclusive with the run). Three difficulty values. Zero persistence. ~80 net LOC across `problem-modal.ts`, `game-loop.ts`, and one CSS block, plus tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Simplicity & YAGNI | **PASS** | No new module, no new dependency, no feature flag. Timer lives inside the existing modal where it is consumed. The `AnswerResult` tagged-union upgrade replaces a bare `0\|1\|2` with `pick \| timeout` — the smallest contract change that handles the new "no answer" case without sentinel-index hacks. |
| II. Test-First Discipline | **PASS** | All new logic is testable headlessly. New tests cover: per-difficulty initial duration, monotonic-clock-driven decrement, timeout-routes-to-wrong-answer, pause-then-resume preserves remaining time, urgency threshold transitions. Tests written before/alongside `problem-modal.ts` changes. |
| III. Library-First / Modular Design | **PASS** | Countdown is internal to `problem-modal.ts`; no cross-module reach-in. The only external surface change is the `onResolve` callback shape (a public modal export), updated in lockstep with its sole consumer (game-loop). Game-loop did not previously couple to timer details and still does not. |
| IV. Observability & Debuggability | **PASS** | New `console.debug` events on `gate_timer_started`, `gate_timer_paused`, `gate_timer_resumed`, `gate_timer_stopped_by_answer`, and `gate_timer_expired`. The debug overlay (`?debug=1`) gains a single line showing remaining ms when a modal is open. |
| Platform & Tech Stack | **PASS** | Pure DOM + `performance.now()` + `requestAnimationFrame`. No backend, no new asset, no polyfill. Mobile-safe — the countdown is text rendered in the existing modal layout. |
| Performance Budget | **PASS** | One `requestAnimationFrame` callback while the modal is open (modal itself doesn't drive the run loop) and one `setInterval` at 250 ms for display update. No per-frame allocations: countdown updates mutate a primitive number; display update writes `textContent`. |
| Accessibility & Input | **PASS** | Urgency state pairs colour (red) with a non-colour cue (label change to "Hurry!" + a CSS pulse animation), per the constitution rule that colour alone is forbidden. Countdown text is rendered at the modal's existing readable size. |

**Re-check after Phase 1 design** (see end of file): still PASS — design did not introduce abstractions or new dependencies beyond what is listed above.

No constitution violations. **Complexity Tracking section omitted** (no justifications needed).

## Project Structure

### Documentation (this feature)

```text
specs/007-problem-timer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── module-contracts.md  # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── renderer/
│   ├── problem-modal.ts        # MODIFIED: add question-countdown logic + urgency state + AnswerResult callback
│   ├── problem-modal.test.ts   # MODIFIED: new tests for B/M/A durations, timeout, pause/resume, urgency threshold
│   └── debug-overlay.ts        # MODIFIED (small): add remaining-ms line when a modal is open
├── game/
│   └── game-loop.ts            # MODIFIED: update onResolve handler to read AnswerResult.kind; map timeout → isCorrect=false
├── shared/
│   ├── config.ts               # MODIFIED: add QUESTION_TIMER_MS_B/M/A and TIMER_URGENCY_MS constants
│   └── types.ts                # MODIFIED: add AnswerResult tagged-union type
└── styles/ or index.css         # MODIFIED: add `.countdown-question` + `.countdown-question--urgent` rules

(No new files. No new modules. Test stays colocated with the modified module.)
```

**Structure Decision**: Reuse the existing single-project layout. The countdown is implemented entirely inside `src/renderer/problem-modal.ts`; the only cross-module ripples are (a) two constants + one type added to `shared/`, and (b) a one-call-site update in `src/game/game-loop.ts`. No new directory, no new module index. This keeps the change footprint small and matches the YAGNI principle.

## Phase 0: Outline & Research — Pointer

See [research.md](./research.md) for: monotonic-clock decision, why no new timer module, AnswerResult contract choice, urgency-threshold default of 10 seconds, pause-coupling choice, and rejected alternatives.

## Phase 1: Design & Contracts — Pointer

- [data-model.md](./data-model.md) — `AnswerResult` tagged union, `QuestionTimerState` shape, configuration constants, urgency threshold.
- [contracts/module-contracts.md](./contracts/module-contracts.md) — Updated `ProblemModal.show` callback contract; `game-loop`'s answer-handler contract update; debug-overlay extension.
- [quickstart.md](./quickstart.md) — Manual + automated validation steps specific to this slice.

## Constitution Re-Check (post-design)

Re-evaluated after Phase 1 design is captured. No new modules, no new dependencies, no new persistence layer. The tagged-union upgrade to `onResolve` keeps the modal's public surface narrow (one function with a slightly richer return-shape). All constitution gates still **PASS**. No Complexity Tracking entries needed.
