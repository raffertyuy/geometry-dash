# Quickstart: Scoring HUD

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-16

This is a delta over [`specs/001-lane-runner/quickstart.md`](../001-lane-runner/quickstart.md). The full project setup (Node, npm install, dev server, Cloudflare deploy) is already documented there - no changes here.

## What's new in this slice

- `src/score/` - a new pure-logic module with two formatter functions.
- `src/score/score.test.ts` - unit tests for those functions.
- `<div id="hud">` + `<div id="timer">` + `<div id="score">` in `index.html`, plus CSS in the same `<style>` block.
- `src/main.ts` resolves `#timer` and `#score` and passes them to `createGameLoop(...)`.
- `src/game/game-loop.ts` writes `textContent` on both elements every frame.

No new dependencies, no new dev-tools, no new scripts.

## Run the slice locally

After `git pull` / branch checkout, the existing commands still work:

```powershell
npm install      # only if package-lock.json changed (it should not in this slice)
npm run dev      # opens localhost:5173 with HMR
npm test         # 59 existing tests + ~12 new score tests + 1 new integration case
npm run typecheck
npm run lint
npm run build
```

## Validate the slice (US1 - score readout)

1. `npm run dev`, open the page in a desktop browser.
2. On the start screen, you should already see `0:00` (timer) and `0` (score) visible at the top of the viewport.
3. Press any key to begin the run.
4. The score must start ticking up by 1 every 0.1 seconds. After ~3 seconds it should read around `30`. After ~10 seconds it should read close to `100`.
5. Switch to another tab for 5 seconds, switch back.
6. While paused (overlay visible), the score is unchanged.
7. Tap or press any key to resume - the score continues from where it was, no jump or doubling.
8. Refresh the page. From the start screen, the score reads `0` again - no carryover.

## Validate the slice (US2 - timer)

1. Continue from the previous run, or start a new one.
2. The timer must start at `0:00` and increment in step with real seconds.
3. After approximately 65 seconds of continuous running, the timer should read `1:05` (±1 second).
4. Pause via tab-switch and verify the timer freezes.
5. Resume and verify the timer continues at the right cadence.
6. (Optional, time-permitting) Verify the M:SS -> MM:SS transition by leaving the game running for 10 minutes. The timer should read `9:59` -> `10:00` without layout shifting.

## Validate the HUD layout on a narrow viewport

1. Chrome DevTools -> Device Toolbar -> choose "iPhone SE" or any 320 px wide preset.
2. The timer should still be centred at the top and the score still in the top-right corner.
3. Both readouts must be at least 16 CSS pixels tall (clearly readable).
4. Tapping or clicking on the HUD area itself must NOT consume the input - the runner should still respond as if the canvas was clicked.

## Definition of done

The slice ships when ALL of these are true:

- [ ] All unit tests green (`npm test` exit 0; includes ~12 new tests in `src/score/score.test.ts`).
- [ ] `npm run typecheck` exits 0.
- [ ] `npm run lint` exits 0.
- [ ] `npm run build` passes; total gzipped JS still under 500 KB.
- [ ] All US1 acceptance scenarios in [spec.md](./spec.md) pass on a real desktop browser.
- [ ] All US2 acceptance scenarios pass.
- [ ] HUD layout validation on 320 px viewport passes.
- [ ] Pause behaviour: both readouts freeze on tab blur; resume continues without drift.
