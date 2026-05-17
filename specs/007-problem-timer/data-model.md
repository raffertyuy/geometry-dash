# Data Model: Problem Gate Countdown Timer

**Slice**: 007-problem-timer · **Date**: 2026-05-17

This slice is logic-and-UI only. There is no persisted data, no new long-lived entity, and no schema migration. The "data model" is the small set of in-memory shapes and constants that the modal and game-loop exchange.

---

## 1. `AnswerResult` (new type, `src/shared/types.ts`)

Tagged union returned by the modal to the game-loop. Replaces the bare `0 | 1 | 2` choice-index parameter so that "no answer was given" is a first-class case.

```ts
export type AnswerResult =
  | { readonly kind: 'pick'; readonly choiceIndex: 0 | 1 | 2 }
  | { readonly kind: 'timeout' };
```

**Why a tagged union and not a nullable index**:

- `null` for the index would force every game-loop comparison (`choiceIndex === correctIndex`) to also null-check first. The tag is self-documenting.
- A future variant — e.g. `{ kind: 'cancelled' }` if a global pause is added — is a one-line extension.

**Validity rules**:

- `kind === 'pick'` ⇔ `choiceIndex` is exactly one of 0, 1, 2 (TypeScript enforces).
- `kind === 'timeout'` carries no other fields.

**State transitions** *(not stored — only emitted)*:

```text
[modal opened, choosing] ──player picks──▶ [reviewing, kind='pick']
                         └──timer expires─▶ [reviewing, kind='timeout']

[reviewing] ──countdown elapses OR Continue clicked──▶ onResolve(AnswerResult)
                                                       (then modal closes)
```

---

## 2. `QuestionTimerState` (internal to `problem-modal.ts`, not exported)

The countdown's runtime state. Lives in closure scope inside `createProblemModal`. Never serialised, never escapes the modal.

| Field | Type | Notes |
|-------|------|-------|
| `initialDurationMs` | `number` | Set at modal open from `QUESTION_TIMER_MS_BY_DIFFICULTY[problem.difficulty]`. |
| `startedAtMs` | `number` | `performance.now()` at modal open. |
| `pausedAccumulatedMs` | `number` | Time spent paused. Currently always 0 in this slice (no pause source yet); the field exists so a future global-pause slice can mutate it without re-architecting. |
| `pausedAtMs` | `number \| null` | When non-null, the timer is paused; on resume, `pausedAccumulatedMs += now - pausedAtMs`. |
| `status` | `'running' \| 'paused' \| 'stopped-by-answer' \| 'expired'` | State machine; only `'running'` and `'expired'` are reachable in this slice (no pause source yet). |
| `rafId` | `number \| null` | Current `requestAnimationFrame` handle so we can cancel on stop. |
| `displayIntervalId` | `ReturnType<typeof setInterval> \| null` | 250 ms display-tick fallback. |
| `lastDisplayedSeconds` | `number` | Last whole-second value written to the DOM. Used to skip redundant `textContent` writes when the second hasn't changed (perf, not correctness). |
| `lastDisplayedUrgent` | `boolean` | Last urgency-class value written. Avoids re-toggling the class every frame. |

**Derived value** (computed on every read, never stored):

```text
remainingMs = max(0, initialDurationMs - (now - startedAtMs - pausedAccumulatedMs))
              where now = pausedAtMs ?? performance.now()
```

**State transitions**:

```text
                      ┌─────► stopped-by-answer  (terminal)
                      │       (player picked)
running ──────────────┤
   ▲                  │
   │ resume            └─────► expired           (terminal)
   │                          (remainingMs === 0)
paused ◄──── pause ── (not used in this slice; reserved for future)
```

---

## 3. Constants (added to `src/shared/config.ts`)

```ts
export const QUESTION_TIMER_MS_B = 60_000;
export const QUESTION_TIMER_MS_M = 120_000;
export const QUESTION_TIMER_MS_A = 180_000;

export const QUESTION_TIMER_MS_BY_DIFFICULTY: Readonly<Record<GateDifficulty, number>> = {
  B: QUESTION_TIMER_MS_B,
  M: QUESTION_TIMER_MS_M,
  A: QUESTION_TIMER_MS_A,
};

/**
 * Threshold below which the countdown enters its urgent visual state
 * (red + "Hurry!" label + pulse). One-shot — the timer only decreases.
 */
export const QUESTION_TIMER_URGENCY_MS = 10_000;

/**
 * Display refresh cadence for the question countdown. 4 Hz is plenty
 * for `M:SS` rendering; finer resolution would just churn textContent
 * for no perceptible gain.
 */
export const QUESTION_TIMER_DISPLAY_INTERVAL_MS = 250;
```

**Why constants and not inline literals**:

- Tests assert the exact values via these constants (avoids drift between test and prod).
- Future tuning (e.g. raising Basic to 90 s) becomes a single-line change.
- The spec's Success Criteria SC-001 (exact initial-display values) is grounded against these constants in the modal test.

---

## 4. Debug-event payloads (informational; emitted via `console.debug`)

All events follow the project-wide `{ event: '...', ... }` shape. None of these are persisted; they exist only for live debugging and for the `?debug=1` overlay.

| Event name | Payload | When |
|------------|---------|------|
| `gate_timer_started` | `{ event, gateId, difficulty, durationMs }` | Modal opens. |
| `gate_timer_stopped_by_answer` | `{ event, gateId, choiceIndex, remainingMs }` | Player picks an answer with time remaining. |
| `gate_timer_expired` | `{ event, gateId, difficulty }` | Countdown reaches 0 with no pick. |
| `gate_timer_paused` | `{ event, gateId, remainingMs }` | (Reserved for future global-pause slice — not emitted today.) |
| `gate_timer_resumed` | `{ event, gateId, remainingMs }` | (Reserved for future global-pause slice — not emitted today.) |

The `?debug=1` overlay adds one line: `Q-Timer: <ss.s> s` while a modal is open; the overlay reads `remainingMs` from a getter the modal exposes for debug only.
