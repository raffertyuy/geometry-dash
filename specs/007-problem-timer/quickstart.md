# Quickstart: Problem Gate Countdown Timer

**Slice**: 007-problem-timer · **Date**: 2026-05-17

Use this checklist after implementation to validate the slice against its spec. All paths are repo-relative.

---

## Automated checks

```powershell
npm run typecheck
npm run lint
npm test
```

All three must pass with zero errors/failures before manual validation.

The new tests live in `src/renderer/problem-modal.test.ts` and cover:

1. Basic gate opens with displayed time `1:00`; Medium with `2:00`; Advanced with `3:00`. (SC-001)
2. Advancing fake time by 1 s and pumping the display interval shows `0:59` / `1:59` / `2:59`. (FR-005)
3. Calling `pick(1)` at any moment freezes the countdown and the existing review flow runs; `onResolve` eventually fires with `{ kind: 'pick', choiceIndex: 1 }`. (FR-006, SC-002)
4. Advancing fake time past the initial duration without picking triggers `{ kind: 'timeout' }` after the existing 3 s review window elapses. (FR-007)
5. The `is-correct-answer` class is set on the correct choice and no choice receives `is-wrong-pick` after timeout. (FR-007 review-state behaviour)
6. With `remainingMs > QUESTION_TIMER_URGENCY_MS`, `.countdown-question--urgent` is absent; once `remainingMs ≤ 10000`, the class is present and the displayed text is prefixed `Hurry!`. (FR-012, US3)
7. Drift test: advance fake time by `initialDurationMs - 1` ms, assert `remainingMs` is exactly 1 ms (not off by an interval-tick remainder). (FR-004, SC-004)
8. `gate_timer_started` and `gate_timer_expired` debug events fire with the expected payload shape. (FR-013)

---

## Manual smoke (run in browser)

```powershell
npm run dev
```

1. Open `http://localhost:5173/` and start a run.
2. Steer into a **Basic** (green) cube. Expected:
   - Modal opens with a clearly visible countdown reading `1:00`.
   - The countdown ticks down once per second.
   - Wait until the countdown shows `0:10` — the countdown should turn red, prefix `Hurry!`, and pulse.
3. Let the countdown reach `0:00` without picking. Expected:
   - Modal switches to its review state.
   - Feedback reads `Time's up`.
   - The correct answer is highlighted in green; no other choice has a "your pick" highlight.
   - Score badge floats `-1000`; one heart goes dark.
   - The existing 3-second auto-continue countdown runs; the modal closes and the runner respawns blinking (invincible for 3 s).
4. Start another run. Hit a **Medium** (yellow) cube and verify initial display `2:00`. Pick an answer at `1:45`. Expected:
   - Countdown freezes immediately; review state shows your pick and the correct answer; existing 3 s auto-continue plays; score updates by ±5000.
5. Hit an **Advanced** (red cube — note this is the gate red, distinct from the timer urgency red) and verify initial display `3:00`. Let it time out. Expected: -10000 points, one life lost, modal behaves identically to step 3.
6. With `?debug=1` in the URL, hit a gate. Expected: the debug overlay shows a `Q-Timer:` line that updates while the modal is open and disappears once the modal closes.
7. Cause a timeout that drops the score below zero (e.g., bottom out a run on hard difficulty). Expected: the existing game-over flow fires — no special-case message, no double penalty.

---

## Smoke-check — bundle size

```powershell
npm run build
```

Confirm the built `dist/assets/*.js` size grew by < 1 KB gzipped versus `main` (use `git stash` + `npm run build` + a copy of the prior size to diff, or just eyeball — this slice should be near-zero bundle impact).

---

## Out-of-scope reminders

If during manual play you notice any of the following, **do not** add them in this slice — they belong to a future spec:

- A "give me more time" accessibility setting.
- An audible tick or timeout SFX.
- A pause button in the modal that stops the countdown.
- Per-user countdown duration tuning.
