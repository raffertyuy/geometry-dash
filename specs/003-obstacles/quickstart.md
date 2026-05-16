# Quickstart: Random Geometric Obstacles

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-16

Delta over the existing slice-1 quickstart. Full setup (Node, npm install, dev server, Cloudflare deploy) is documented in [`specs/001-lane-runner/quickstart.md`](../001-lane-runner/quickstart.md).

## What's new in this slice

- `src/obstacles/` - a new pure-logic module (catalogue + spawn generator + collision predicate).
- `src/obstacles/obstacle-spawn.test.ts`, `src/obstacles/obstacle-collision.test.ts` - unit tests.
- Extensions to `src/runner-engine/runner-engine.ts` (and its tests) for `endRun` and `restartRun`, plus the new `'game-over'` `RunState` value.
- Extension to `src/game/game-loop.ts` to spawn / scroll / collide / restart.
- Extension to `src/renderer/three-renderer.ts` for the obstacle mesh pool (six variants, 12 instances each).
- `<div id="game-over-overlay">` + matching CSS in `index.html`.
- `src/main.ts` resolves the three new DOM elements (`#game-over-overlay`, `#game-over-score`, `#game-over-timer`) and passes them to `createGameLoop`.

No new dependencies.

## Run the slice locally

```powershell
npm install      # only if package-lock.json changed
npm run dev      # localhost:5173 with HMR
npm test
npm run typecheck
npm run lint
npm run build
```

## Validate the slice (US1 - dodge, die, restart)

1. `npm run dev`, open the page on desktop.
2. Press a key to begin. The runner starts moving forward as before.
3. Within ~1-2 seconds you should see the first obstacle group ahead of you. It blocks either one or two of the three lanes; at least one lane is open.
4. Switch lanes (Arrow keys / WASD or swipe on mobile) to be in a non-blocked lane when the obstacle reaches you. You pass safely.
5. The score and timer continue to advance.
6. Now intentionally fail: stay in a blocked lane. When the obstacle reaches you, the run MUST end within a fraction of a second.
7. A "Game Over" overlay appears, showing the final score (matches the `#score` value at the moment of impact) and the final time (matches `#timer`).
8. Press any key OR tap the screen. The run restarts immediately: score `0`, timer `0:00`, player in the centre lane, no obstacles visible (until the first new one spawns), no return to the original title screen.
9. Verify FR-013: when restarting, the directional key/tap you used does NOT also drive a lane change in the new run.

## Validate the slice (US2 - visual variety)

1. Play a single 60-second run, surviving as long as you can.
2. Pay attention to the obstacle shapes you encounter.
3. You should see at least five distinct 3D primitives: cubes, tall pillars, wide horizontal bars (across two lanes), cylinders, spheres, trapezoidal prisms.
4. The wide-bar variant ALWAYS occupies two adjacent lanes (left+centre or centre+right) - never two non-adjacent lanes.
5. The same shape can appear back-to-back (it's random sampling with replacement). What matters is that across the run you saw variety.

## Validate the pause behaviour interaction

1. Start a run, dodge a few obstacles to get a score of ~50.
2. Switch to another browser tab for ~5 seconds, then come back.
3. The pause overlay appears (existing behaviour from 001).
4. Tap or press a key to resume. The run continues from where it left off; obstacles continue to advance from their pre-blur positions; no jumps.
5. The pause overlay and the game-over overlay are mutually exclusive (only one is ever visible at a time).

## Validate the 320 px viewport

1. Chrome DevTools -> Device Toolbar -> 320 px wide preset.
2. The game-over overlay's content must remain readable (font size >= 16 CSS px at that width).
3. The game-over overlay's content must not visually overlap the score or timer HUD elements.

## Definition of done

- [ ] All unit tests green (`npm test` exit 0; includes the new tests in `src/obstacles/` and the extension to `runner-engine.test.ts` and `tests/integration/lane-switch-flow.test.ts`).
- [ ] `npm run typecheck` exits 0.
- [ ] `npm run lint` exits 0 (the boundary rule MUST refuse a `three` import in `src/obstacles/`).
- [ ] `npm run build` passes; total gzipped JS still under 500 KB.
- [ ] US1 acceptance scenarios all pass on a real desktop browser.
- [ ] US2 acceptance scenarios all pass.
- [ ] HUD + game-over overlay layout passes the 320 px viewport check.
- [ ] Pause behaviour from 001 continues to work alongside the new game-over flow.
