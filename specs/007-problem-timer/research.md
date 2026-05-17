# Research: Problem Gate Countdown Timer

**Slice**: 007-problem-timer · **Date**: 2026-05-17

This document captures the Phase 0 decisions that resolve every unknown surfaced in the Technical Context of [plan.md](./plan.md). The spec emitted zero `[NEEDS CLARIFICATION]` markers, so the research effort is concentrated on architecture choices, not on filling in missing user-facing decisions.

---

## R1. Clock source: monotonic wall-clock, not interval-tick counting

**Decision**: The countdown's remaining time is computed as `initialDurationMs - (performance.now() - startedAtMs - pausedAccumulatedMs)`. Display updates run via `requestAnimationFrame` plus a 250 ms `setInterval` fallback for the rare frames where the rAF callback hasn't fired. The interval never advances state — it just reads the clock and writes `textContent`.

**Rationale**:

- Spec FR-004 requires monotonic wall-clock decrement so background-tab throttling, missed frames, or device clock changes cannot grant the player extra time.
- `performance.now()` is monotonic across all evergreen browsers and is unaffected by user-level clock changes (Date.now would be vulnerable).
- The existing modal already uses `setInterval` for the 3-second auto-continue countdown; we mirror that style for the visible-update half but reject *tick-counting* as the source of truth (which is what the existing 3 s countdown does — that one is acceptable there because 3 s is short and the visible-tick cadence is the user-perceptible behaviour, not a real-time guarantee).
- The 250 ms display cadence (4 Hz) is enough to keep `M:SS` display reasonable; we don't need 60 Hz since the visible unit is seconds.

**Alternatives considered**:

- *Decrement-on-interval-tick*: Simpler, but violates FR-004; an iOS Safari tab in background can fire `setInterval` at ~1 Hz max, which would silently grant ~85% extra time on a 60 s Basic gate. Rejected.
- *requestAnimationFrame-only*: rAF pauses entirely in background tabs on most browsers. Pairing rAF with a fallback interval keeps the display updating in foreground while keeping the *math* honest in background. Accepted as the combined approach.
- *Web Workers + `postMessage`*: Workers are not throttled the same way, but introducing a worker for one countdown is far heavier than `performance.now()` arithmetic. Rejected on YAGNI.

---

## R2. No new `question-timer` module

**Decision**: Keep the countdown logic inside `src/renderer/problem-modal.ts`. Do not introduce a `src/question-timer/` module.

**Rationale**:

- The constitution's Principle III asks for modules with one entrypoint **when there is something to reuse or test in isolation**. The countdown has one consumer (the modal), no headless use case, and is tightly coupled to the modal's state machine (`choosing` → `reviewing`).
- Principle I (Simplicity & YAGNI) explicitly says: don't introduce abstraction layers before a second concrete use case exists. There is no second use case.
- The function can still be unit-tested headlessly because the modal already runs under jsdom; we just inject a fake `performance.now()` and `requestAnimationFrame`.

**Alternatives considered**:

- *Standalone `question-timer` module exporting `createQuestionTimer({ durationMs, onTick, onExpire })`*: Cleaner separation, but pure speculation — no other consumer is on the roadmap. Adds an index file, a public type, and an import without paying its own way. Rejected; revisit if a second timer use case appears (e.g., a daily-challenge mode).

---

## R3. `onResolve` callback contract: tagged union, not sentinel index

**Decision**: Change the `ProblemModal.show` callback from `(choiceIndex: 0 | 1 | 2) => void` to `(result: AnswerResult) => void`, where:

```ts
export type AnswerResult =
  | { readonly kind: 'pick'; readonly choiceIndex: 0 | 1 | 2 }
  | { readonly kind: 'timeout' };
```

Game-loop reads `result.kind`. On `'timeout'`, `isCorrect = false` and the floating "-N" / life loss / score-negativity path runs unchanged.

**Rationale**:

- Spec FR-007 + FR-008 require timeout to route through the existing wrong-answer pipeline with the *same* point/life consequences and *no extra* penalty. A tagged union makes "no pick happened" explicit and impossible to miscompute.
- Alternative: pass `(correctIndex + 1) % 3` as a fake choice. Works for scoring, but contaminates the review state — it would render an `is-wrong-pick` highlight on a choice the player never touched. Spec edge-case "Timer expires while review state is already showing" plus the assumption "the timeout's review state will render exactly like a wrong answer with no 'your pick' marker" both argue against the sentinel hack.
- The modal already has internal state to handle a `null` pickedIndex during reviewing — only the public contract needs widening.

**Alternatives considered**:

- *Boolean second argument `(choiceIndex, wasTimeout)`*: Saves four lines but loses the type-system guarantee that timeout cannot carry a `choiceIndex`. Rejected.
- *Two separate callbacks*: Adds API surface; doesn't earn its keep. Rejected.

---

## R4. Urgency threshold of 10 seconds

**Decision**: The countdown enters "urgent" visual state when remaining time drops to `≤ 10_000 ms`. The urgent state is conveyed by a red colour *and* a label flip from `0:42` → `Hurry! 0:09` *and* a 1 Hz pulse animation. Returning to `> 10_000 ms` cannot happen (the timer only decreases), so the cue is one-shot.

**Rationale**:

- Spec FR-012 + US3 require a non-colour-only cue per the constitution's Accessibility rule. Red alone is not allowed.
- 10 s gives ~16% of the Basic gate's time as urgent (60 s total) and ~5% of an Advanced gate's time (180 s) — proportional to player perception that "the last bit is critical". Picking a single threshold instead of per-difficulty thresholds is simpler and was not contested in the spec.
- Pulse + label gives two redundant non-colour cues, satisfying motion-sensitivity concerns if a future user disables animations (label alone is still distinct).

**Alternatives considered**:

- *Per-difficulty urgency thresholds (e.g., last 10% of duration)*: More elegant but introduces a config knob (Principle I). Rejected.
- *Audible tick*: SFX are out of scope for this project today; the timer's debug events provide a hook point if SFX are added later.

---

## R5. Pause coupling — subscribe to the modal's active state, do not invent new semantics

**Decision**: The countdown ticks while `state === 'choosing'`. It freezes on `state === 'reviewing'` (which is what "an answer was registered" already means) and on `state === 'closed'`. No new pause API; no listening to document visibility or any global pause channel.

**Rationale**:

- Spec FR-011 explicitly says the timer must follow the modal's existing active state, not introduce its own pause semantics.
- The current modal does not implement document-visibility pause; the run loop's pause behaviour during `'answering'` is "stop the world but keep the modal interactive", which is the desired UX (the player can still answer in a backgrounded tab, but the timer keeps running — and that is also what spec FR-004 demands).
- If a future slice introduces a global "pause the modal" toggle, the timer subscribes to whatever flag that slice exposes. Out of scope today.

**Alternatives considered**:

- *Pause on `document.visibilityState === 'hidden'`*: Would be a gift to the player and a contradiction of FR-004. Rejected.

---

## R6. Test strategy

**Decision**: Vitest with `vi.useFakeTimers()` and a stubbed `performance.now()`. Tests advance fake time, then assert: display text, internal remaining-ms state, and the eventual `onResolve` call payload (`{ kind: 'timeout' }` or `{ kind: 'pick', choiceIndex }`).

**Rationale**:

- The modal test file already uses jsdom and Vitest fake timers for the existing 3 s auto-continue countdown — the same harness extends naturally.
- The single non-fake-time concern is `requestAnimationFrame`, which Vitest+jsdom can mock with `vi.stubGlobal('requestAnimationFrame', ...)`. We do not need real rAF in tests because we are asserting time-driven state, not rendering.

**Alternatives considered**:

- *Playwright end-to-end timed test*: Reliable but slow (60 s actual wait per Basic-gate test). Rejected unless we discover a flake the unit test cannot reproduce.

---

## R7. Bundle-size impact

**Decision**: Add only what is needed. New code estimate:

- `problem-modal.ts`: ~70 lines (start/stop, urgency state, display update, debug events).
- `game-loop.ts`: ~8 lines (callback shape adaptation).
- `shared/types.ts`: ~6 lines (the `AnswerResult` type).
- `shared/config.ts`: 4 lines (3 durations + 1 urgency threshold).
- CSS: ~12 lines (one urgent rule, one keyframe).

Total ≈ 100 net source lines; gzipped impact well under 1 KB. Constitution's 500 KB initial-payload budget is not threatened.

**Alternatives considered**: None — keeping the diff small is itself the goal.
