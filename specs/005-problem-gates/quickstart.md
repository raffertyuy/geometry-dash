# Quickstart: Problem Gates with Lives and Multi-strike Game Over

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-17

Delta over earlier slices. Full setup is in [`specs/001-lane-runner/quickstart.md`](../001-lane-runner/quickstart.md).

## What's new in this slice

- `src/problem-gates/` — new pure-logic module: gate catalogue + per-row spawn augmentation + collision predicate.
- `src/problems/` — new pure-data module: placeholder problem pool + selection.
- `src/runner-engine/` — four new transition functions (`consumeLife`, `enterAnswering`, `resolveAnswer`, `tickInvincibility`), `tickWorld` no-ops in the new `'answering'` state, `createWorldState` + `restartRun` populate the four new `WorldState` fields.
- `src/score/score.ts` — `computeScore` gains an optional `scoreDelta` parameter (default 0); existing tests pass unchanged.
- `src/renderer/` — three new DOM-adapter factories: `createProblemModal`, `createLivesHud`, `createFloatingScore`. Three.js renderer gains `updateGates(gates)`.
- `src/game/game-loop.ts` — wires gates spawning + collision; modal commit; obstacle-collision-now-costs-a-life; restart resets lives + scoreDelta + gates list; game-over fires on either 0 lives OR negative total score.
- `index.html` — `#lives-hud` row in the HUD, `#floating-scores` host, `#problem-modal` overlay; CSS for `.heart`, `.heart.empty`, `.floating-score`, `.answer-choice`, `.is-highlighted`.
- `CLAUDE.md` and `README.md` — terminology updated from "geometry gates" to "problem gates" (FR-017).

No new npm dependencies. Placeholder problems are inline TS data.

## Run the slice locally

```powershell
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

## Validate the slice on desktop

1. Open `localhost:5173` and begin a run. Confirm three filled red heart icons appear in the HUD next to the score / timer.
2. Run forward a few seconds. Look for **glowing muted-coloured cubes** (green / orange / red) appearing in the lanes alongside the existing Tron-coloured obstacle blocks. They should read as power-ups, not warnings — distinctly less saturated than the obstacles.
3. **Hit a B gate**: steer into a green cube. The world should freeze (timer stops; obstacles stop scrolling) and the modal should appear with a problem and three answer choices. Use arrow keys to highlight a choice and Enter to commit. Verify:
   - Correct answer → modal closes, world resumes, a green "+1000" floats up from the score readout for ~1 s, the score increases by 1000.
   - Wrong answer → modal closes, world resumes, a red "-1000" floats up, the score decreases by 1000, and one heart switches from filled to outlined.
4. **Hit an M gate or A gate**: same flow, but the score moves by 5000 / 10000 respectively. The floating animation displays "+5000" / "-5000" / "+10000" / "-10000".
5. **Mouse + touch input**: re-open `localhost:5173`, hit a gate, click an answer with the mouse — the modal should commit immediately without an Enter press. Repeat from a touch device — tap commits.
6. **Lives flow**:
   - Deliberately collide with an obstacle. One heart switches to outlined; the player respawns in the centre lane and **blinks for 3 seconds** (alternating visibility).
   - During the blink, drive into another obstacle in centre lane — it should pass harmlessly (no heart consumed, blink continues).
   - During the blink, drive into a problem gate in centre lane — it should also pass harmlessly (no modal, no score change). The next gate after the blink fires the modal normally.
   - Lose all three hearts (obstacle hits, wrong answers, or a mix). The game-over overlay should appear immediately on the third strike.
7. **Score-below-zero game-over**: start a fresh run. Within the first 30 seconds (before the score has accumulated past ~300), hit an M gate (-5000 penalty) and answer wrong. The game-over overlay should appear immediately, even though hearts remain. **Verify the final score displays as a negative number** (e.g., "-4700"), NOT clamped to zero.
8. **Restart**: from any game-over, press any key / tap. The new run starts fresh: 3 filled hearts, score `0`, timer `0:00`, no gates / obstacles on screen.
9. **Tier escalation still works during a run with gates**: run for 30 s with no gate hits. Confirm the world speeds up and the score tick rate doubles at the 30-second mark (the slice-004 mechanic should be unaffected by the new gate state).
10. **Console.debug events** (with DevTools open and `?debug=1`): on each gate hit / answer / life lost, the corresponding structured event (`gate_hit`, `gate_answered`, `life_consumed`, etc.) should appear in the console.

## Validate the slice on a narrow viewport (320 px mobile)

1. The lives HUD should fit in the top row without overflowing. The 3 heart icons sit between the timer (centre) and score (right).
2. The modal should be readable: problem text wraps, three answer-choice rows are tappable (each ≥ 44 px tall).
3. Floating "+1000" / "-5000" animations should not overflow the viewport; they translate ~60 px upward and fade.

## Validate the slice on mobile (real device)

1. Same flow as desktop, but **tap to answer**. Each answer-choice tappable region must be large enough to hit reliably; no accidental modal-commit from a swipe.
2. Swipe lane-changes during running mode should work as before. Swipes outside the modal should not trigger lane changes during `'answering'`.

## Definition of done

- [ ] All unit tests green (`npm test` exit 0): +problem-gates tests, +problems tests, +runner-engine transition tests, score scoreDelta tests, renderer DOM-helper smoke tests, +2 integration tests.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm run lint` exits 0. `src/problem-gates/` and `src/problems/` MUST NOT import `three` or DOM types — the existing boundary rule catches this; verify the rule covers the new directories.
- [ ] `npm run build` passes; gzipped JS still under 500 KB.
- [ ] All acceptance scenarios from spec.md `User Story 1`, `User Story 2`, `User Story 3` pass on a real desktop browser.
- [ ] Mobile validation passes on at least one iOS Safari and one Android Chrome device.
- [ ] CLAUDE.md and README.md use "problem gates" (not "geometry gates"); README's "What's in it (so far)" gets a one-line summary of the new capability.
- [ ] No `console.error` or unhandled rejections during a typical 60-second run that includes ≥ 3 gate hits and ≥ 1 obstacle collision.
