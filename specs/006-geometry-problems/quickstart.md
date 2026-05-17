# Quickstart: Real Geometry Problems with Diagrams

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-17

Delta over earlier slices. Full setup is in [`specs/001-lane-runner/quickstart.md`](../001-lane-runner/quickstart.md).

## What's new in this slice

- `src/diagrams/` — new pure-logic module: SVG primitives (`svg`, `line`, `polygon`, `circle`, `label`) + ~20-30 archetype generators (`rightTriangle`, `trapezoid`, `circleFigure`, `coordinatePlane`, `regularPolygonFigure`, `sphereSilhouette`, `cylinderSilhouette`, etc.). Pure functions, deterministic, return SVG strings.
- `src/problems/` — significant internal refactor while preserving the public surface from slice 005:
  - `pool-b.ts`: ~100 hand-curated Basic problems with per-problem `sourceRef` metadata.
  - `sources.ts`: `PROBLEM_SOURCES` list (OpenStax + Illustrative Mathematics, both CC BY 4.0).
  - `templates-m.ts`: ≥ 12 parameterised Medium template generators.
  - `templates-a.ts`: ≥ 10 parameterised Advanced template generators.
  - `problems.ts`: `selectPlaceholderProblem(difficulty, rng)` dispatches to pool-b or templates.
- `src/renderer/credits-panel.ts` — new DOM adapter: `createCreditsPanel(host, sources)` returns `{ show, hide, isVisible, destroy }`. Displays the source list as an overlay; closes on Escape, click-outside, or close-button.
- `src/renderer/problem-modal.ts` — extended `show()` injects `problem.figure` SVG into the modal's reserved `.problem-figure` slot when present.
- `src/shared/types.ts` — `Problem` interface gains optional `figure?: string` and `sourceRef?: string` fields.
- `src/game/game-loop.ts` — wires the credits panel show / hide from "Problem credits" links on the start screen and game-over screen.
- `index.html` — `#credits-overlay` element + "Problem credits" links in `#start-screen` and `#game-over-overlay`; CSS for the panel.
- `LICENSES.md` at the repo root — lists each CC-BY source with attribution required by the licence.

No new npm dependencies. No KaTeX, no MathJax — Unicode glyphs cover every archetype's equation needs.

## Run the slice locally

```powershell
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

## Validate the slice on desktop

1. Open `localhost:5173` and begin a run. Confirm the lives HUD, score, timer all still show — slice 005 behaviour intact.
2. Click "Problem credits" on the start screen. The credits overlay opens with at least two source entries (OpenStax + Illustrative Mathematics). Each entry has a working link, the licence ("CC BY 4.0"), and the attribution text. Close with Escape, then again with click-outside, then again with the close button — all three dismissal paths work.
3. Begin a run. On the first **Basic** gate, observe a real geometry recall question (not "Test problem 4"). Read the prompt; it should be a recall-style fact ("How many sides does an octagon have?", "What is the sum of angles in a triangle?", etc.).
4. On the first **Medium** gate, observe a numerical geometry calculation. Look at the modal — there should be a diagram in the figure slot showing the configuration described in the prompt. For example, a Pythagorean problem with legs 8 and 15 should render a labelled right triangle with those leg values shown.
5. Verify the diagram's labels match the prompt: if the prompt says "leg A = 8", the SVG label reads "8" not something else.
6. Answer a few Medium problems; for each, verify the floating "+5000" or "-5000" animation, the lives-HUD update on wrong, the score-readout change.
7. On the first **Advanced** gate, observe a multi-step calculation. The diagram (sphere, cone, coordinate plane, etc.) should be visible. The correct answer should be in the choices.
8. Play for 5 minutes (or simulate one by spawning many gates rapidly). Tally distinct problem prompts — at least 30 different prompts should appear.
9. Confirm the equation glyphs render correctly: Unicode `√`, `π`, `°`, `·`, `²`, `³`, fraction glyphs, superscripts / subscripts.
10. Cause a game-over (lose all 3 lives or drop score below zero). On the game-over screen, "Problem credits" link should also be visible and functional.

## Validate the slice on a narrow viewport (320 px mobile)

1. Open Chrome DevTools → Device Toolbar → iPhone SE.
2. The credits overlay scales: source entries stack vertically, links remain tappable, panel fits within the 320 px width.
3. The problem modal with a diagram + 3 answer choices fits without horizontal overflow. The diagram doesn't push the answer rows below the fold on a 568 px-tall portrait phone.
4. Equation glyphs (especially superscripts / subscripts) remain legible.

## Validate the slice on mobile (real device)

1. Same flow as desktop, but **tap to answer**. Each answer-choice tappable region must remain ≥ 44 px tall.
2. The credits panel opens and closes via tap; tap-outside dismisses.

## Validate licensing compliance

1. Open `LICENSES.md` at the repo root. Confirm it lists every source from `PROBLEM_SOURCES` (the file-content test verifies this; manually skim too).
2. Each source entry in `LICENSES.md` has: source name, URL, licence ("CC BY 4.0"), and the required attribution text.

## Definition of done

- [ ] All unit + integration tests green (`npm test` exit 0); ≥ 248 baseline tests + new tests for primitives, archetypes, pool-b, sources, templates-m, templates-a, credits-panel, modal-figure extension, integration figure-renders cases.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm run lint` exits 0. `src/diagrams/` and `src/problems/*` MUST NOT import three or DOM types; the existing no-restricted-imports rule catches this.
- [ ] `npm run build` passes; gzipped JS stays under 500 KB (current ~152 KB; expected growth ~20-25 KB).
- [ ] `POOL_B.length >= 80` and at least 12 M templates / 10 A templates exist.
- [ ] At least 70 % of M templates AND 70 % of A templates ship with a non-undefined `figure` field.
- [ ] `LICENSES.md` exists at the repo root with ≥ 2 entries; the consistency test passes.
- [ ] The in-app "Problem credits" surface is reachable from at least one menu screen.
- [ ] Acceptance scenarios from spec.md User Stories 1, 2, 3 pass on a real desktop browser.
- [ ] Mobile validation passes on at least one iOS Safari and one Android Chrome device.
- [ ] README.md gains a new "What's in it (so far)" bullet for the slice.
