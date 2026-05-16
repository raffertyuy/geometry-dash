# Quickstart: Difficulty Escalation by Tier

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-16

Delta over [`specs/001-lane-runner/quickstart.md`](../001-lane-runner/quickstart.md). Full setup is documented there.

## What's new in this slice

- `src/escalation/` - new pure-logic module with `currentTier` and `speedMultiplier`.
- `src/escalation/escalation.test.ts` - unit tests.
- `src/score/score.ts`'s `computeScore` rewritten to the piecewise formula. Tests in `src/score/score.test.ts` updated to match.
- `src/runner-engine/runner-engine.ts`'s `tickWorld` gains an optional third parameter `speedOverride?: number`. Existing tests pass unchanged; new tests added for the override behaviour.
- `src/game/game-loop.ts` computes `effectiveSpeed = RUN_SPEED_UNITS_PER_SEC * speedMultiplier(currentTier(world.tickMs))` each frame and passes it to `tickWorld`. Also tracks the last observed tier and emits a `tier_advanced` `console.debug` event when it changes.

No new dependencies; no DOM changes.

## Run the slice locally

```powershell
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

## Validate the slice on desktop

1. Open `localhost:5173` and begin a run.
2. Watch the timer and score for the first 30 seconds. The score should advance at ~10 points per second (1 / 0.1 s). Confirm by reading the score at 10 s = `100`, 20 s = `200`, 29 s = `290`.
3. At exactly 30 s the score jumps to `300` and the increment rate doubles. From 30 s onwards the score advances ~20 pts/s. At 35 s read `400`. At 60 s read `900`.
4. The world also visibly speeds up at 30 s, 60 s, 90 s. The scrolling rungs move past faster; the player's trail is left behind faster. Side-by-side comparison: count the rungs that pass under the player in a 5-second window at 25-30 s vs 30-35 s - the second window should be roughly 10 % more rungs.
5. Open DevTools console with `?debug=1` and watch for `tier_advanced` messages at the 30 s, 60 s, 90 s marks.
6. Verify the pause behaviour: tab-switch away at 25 s for 10 s, return. On resume, the tier is still 0 (since accumulated `tickMs` is still 25 000 ms < 30 000). The 10 s of paused time did NOT count.
7. Die intentionally at any time. Press a key to restart. The new run begins at tier 0; the first 30 s score at 1 point / 0.1 s.

## Validate the slice on a narrow viewport

No change from the scoring-HUD slice. The HUD readouts still need to be legible at 320 px wide, and the score numbers can grow to 5-6 digits over a long run - check the alignment doesn't overflow.

## Definition of done

- [ ] All unit tests green (`npm test` exit 0; +escalation tests, rewritten score tests, +tickWorld override tests, +cross-tier integration test).
- [ ] `npm run typecheck` exits 0.
- [ ] `npm run lint` exits 0 - especially: `src/escalation/` MUST NOT import `three` or DOM types (existing boundary rule catches this).
- [ ] `npm run build` passes; gzipped JS still under 500 KB.
- [ ] All seven acceptance scenarios from spec.md §"User Story 1" pass on a real desktop browser.
- [ ] The `tier_advanced` console.debug events fire at the 30 s, 60 s, 90 s marks during a live run.
