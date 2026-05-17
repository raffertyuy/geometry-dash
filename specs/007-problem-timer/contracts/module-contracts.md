# Module Contracts: Problem Gate Countdown Timer

**Slice**: 007-problem-timer · **Date**: 2026-05-17

This slice does not introduce any new module. It modifies the public surface of one existing module (`src/renderer/problem-modal.ts`), adds one shared type, and adjusts one call site in `src/game/game-loop.ts`.

---

## 1. `src/renderer/problem-modal.ts` (modified)

### 1.1 `ProblemModal.show` — callback contract

**Before**:

```ts
show(problem: Problem, onResolve: (choiceIndex: 0 | 1 | 2) => void): void;
```

**After**:

```ts
show(problem: Problem, onResolve: (result: AnswerResult) => void): void;
```

Where `AnswerResult` is imported from `src/shared/types.ts` (see §3).

**Behaviour added**:

- On `show`, the modal starts a question countdown of duration `QUESTION_TIMER_MS_BY_DIFFICULTY[problem.difficulty]` and renders it in a new `.countdown-question` DOM element inside the modal body (positioned above the answer choices).
- The countdown is wall-clock-driven via `performance.now()`. Display refreshes every `QUESTION_TIMER_DISPLAY_INTERVAL_MS` (= 250 ms) using a `setInterval`, and additionally on every `requestAnimationFrame` while the document is foregrounded. Internal `remainingMs` is *computed*, never *decremented*.
- When `remainingMs ≤ QUESTION_TIMER_URGENCY_MS` (= 10 000 ms), the `.countdown-question--urgent` class is toggled on the element and its `textContent` is prefixed `Hurry! `. The class triggers a 1 Hz CSS pulse animation and a red colour.
- When the player picks an answer, the countdown stops immediately (status → `'stopped-by-answer'`) and the existing `pick(choiceIndex)` review flow runs unchanged. `onResolve` will eventually be called with `{ kind: 'pick', choiceIndex }` when the review window's 3 s auto-continue resolves.
- When the countdown reaches 0 with no pick, the modal transitions internally to `'reviewing'` with `pickedIndex = null` (existing field, type widened to `0 | 1 | 2 | null`) and starts the existing review-state 3 s countdown. When that 3 s ends, `onResolve` is called with `{ kind: 'timeout' }`.

**Backwards compatibility**: This is a breaking shape change to one public callback. The only caller is `game-loop.ts`, which is updated in lockstep (see §2). No other module references `ProblemModal.show`.

### 1.2 Review-state rendering when `pickedIndex === null`

`syncReviewingFeedback` is extended so that when `pickedIndex === null`:

- `host` still receives `is-reviewing` and `is-incorrect` (timeouts are wrong answers per FR-007).
- The correct option still receives `is-correct-answer` (so the player sees what they should have picked).
- No option receives `is-wrong-pick` (because no pick was made).
- The feedback text reads `"Time's up"` instead of `"Incorrect"` so the player understands what happened. This is a UX nicety, not a spec requirement.

### 1.3 Debug accessor (test-only seam)

A non-exported `getDebugSnapshot()` is added inside the module closure and stashed on the modal instance under a non-enumerable symbol-keyed property, used by `debug-overlay.ts` and by tests. This is the lightest weight escape hatch — no public type change.

---

## 2. `src/game/game-loop.ts` (modified)

### 2.1 `problemModal.show` call site

**Before**:

```ts
problemModal.show(gate.problem, (choiceIndex) => {
  const isCorrect = choiceIndex === gate.problem.correctIndex;
  world = resolveAnswer(world, isCorrect, points);
  floatingScore.pop(isCorrect ? `+${points}` : `-${points}`, isCorrect ? 'green' : 'red');
  // ... score-below-zero check, hide, game-over check ...
});
```

**After**:

```ts
problemModal.show(gate.problem, (result) => {
  const isCorrect =
    result.kind === 'pick' && result.choiceIndex === gate.problem.correctIndex;
  world = resolveAnswer(world, isCorrect, points);
  floatingScore.pop(isCorrect ? `+${points}` : `-${points}`, isCorrect ? 'green' : 'red');
  // ... score-below-zero check, hide, game-over check ... (UNCHANGED)
});
```

This is the **only** change to game-loop. Score deduction, life loss, game-over checks, and the "+N / -N" floating score all flow through the existing `resolveAnswer` and existing `floatingScore.pop` calls unchanged — timeouts are wrong answers, full stop. This satisfies SC-006 ("100% of timeout events route through the same wrong-answer code path") and FR-008 (no extra penalty).

### 2.2 No other game-loop changes

- `runner-engine` already pauses on `runState === 'answering'`; the timer never affects the run loop directly. ✓
- The 3-second-respawn-invincibility window is already triggered by `resolveAnswer` on a life-losing wrong answer; timeouts inherit it for free. ✓

---

## 3. `src/shared/types.ts` (modified)

Add the `AnswerResult` type per [data-model.md §1](../data-model.md). Export from the existing types module — no new index file.

---

## 4. `src/shared/config.ts` (modified)

Add four constants per [data-model.md §3](../data-model.md): `QUESTION_TIMER_MS_B`, `QUESTION_TIMER_MS_M`, `QUESTION_TIMER_MS_A`, `QUESTION_TIMER_MS_BY_DIFFICULTY`, `QUESTION_TIMER_URGENCY_MS`, `QUESTION_TIMER_DISPLAY_INTERVAL_MS`. No validation/assertion needed — these are static.

---

## 5. `src/renderer/debug-overlay.ts` (modified, small)

When `?debug=1` is active and the modal is open, render one extra line: `Q-Timer: <remaining seconds, 1 decimal>`. Reads via the modal's debug-snapshot seam (§1.3). If the modal is closed, the line is omitted (no stale value).

---

## 6. CSS (modified — single style block, location TBD by where the modal styles already live)

```css
.countdown-question {
  font-variant-numeric: tabular-nums; /* monospaced digits so '1:00' → '0:59' doesn't jitter */
  /* sizing/positioning to match existing modal type scale */
}

.countdown-question--urgent {
  color: var(--gate-red, #ff4455);
  animation: question-countdown-pulse 1s ease-in-out infinite;
}

@keyframes question-countdown-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.05); opacity: 0.85; }
}
```

The pulse animation pairs with the `Hurry!` text prefix so the urgency cue is conveyed by colour + label + motion (three redundant channels), satisfying the constitution's no-colour-alone accessibility rule.

---

## 7. Out of scope (explicitly)

- No new module index, no new public package boundary.
- No persistence (no localStorage; not even the `autoContinuePref` precedent applies here — durations are not user-tunable in this slice).
- No SFX hooks (the project has no SFX layer yet; debug events provide future hook points).
- No per-user "give me more time" accessibility override.
- No mid-question pause UI affordance (the spec's pause requirement is satisfied by *coupling* — there is no global pause source today; the state machine is wired to handle one if it appears).
