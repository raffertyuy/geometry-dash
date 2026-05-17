# The Real Geometry Dash

A 3D, Tron-themed, Subway-Surfers-style endless runner where the obstacle field is punctuated by **problem gates** — glowing Rubik's-cube collidables that pause the run and ask a multiple-choice question. Built as a static web app with TypeScript + Three.js + Vite.

> [!IMPORTANT]
> **This project is 100% vibe-coded.** Every spec, plan, task list, test, and line of code was generated through a conversation with [Claude](https://www.anthropic.com/claude) using the [GitHub Spec Kit](https://github.com/github/spec-kit) workflow. A human guided design decisions in plain English; the AI wrote everything. The `specs/NNN-*/` folders are deliberately preserved as a record of how each feature was specified and built — they're useful if you're studying spec-driven AI development end to end.

## What's in it (so far)

- **3-lane endless runner** with keyboard (Arrows / WASD) and mobile swipe input. Pause on tab blur, resume on input.
- **Tron 3D visuals**: dark blue floor with glowing cyan grid lines, magenta sun, scrolling rungs, parallax speed lines, an amber running-man figure with a glowing trail.
- **Scoring HUD**: live score (top-right, amber) and elapsed timer (top-centre, cyan) derived from a single `tickMs` source so they stay in sync.
- **Random obstacles**: six 3D shape variants (cube, pillar, cylinder, icosahedron, trapezoid prism, wide bar) in three Tron colors (red, blue, green) with glowing edge outlines. Block one or two lanes; at least one lane is always passable.
- **Game-over + restart**: hit an obstacle and the world freezes; an overlay shows your final score and time; tap or press any key to restart.
- **Difficulty escalation**: every N seconds the run speed multiplies by a configurable factor and the score-per-100 ms increment grows by a configurable amount. Spec defaults are 30 s / +1 / 1.10×; three knobs in `src/shared/config.ts` (`ESCALATION_TIER_DURATION_MS`, `ESCALATION_SCORE_INCREMENT_PER_TIER`, `ESCALATION_SPEED_MULTIPLIER_PER_TIER`) let you retune without code changes. Currently set to an accelerated test config (10 s / +10 / 2.00×) so the progression is feel-able in a short session.
- **Problem gates + lives**: glowing **Rubik's-cube** collidables in muted green / orange / red co-spawn with obstacles. Collision pauses the run and opens a modal with a placeholder geometry question + three answer choices (arrow keys / WASD + Enter, mouse click, or touch tap all commit). Correct = +1k / +5k / +10k with a green floating "+N"; wrong = the same magnitude in red AND one heart lost. The runner now starts each run with **3 lives** displayed as faceted heart icons; obstacle hits also cost a life and respawn the runner in the centre lane with a 3-second blinking invincibility window (which absorbs both obstacles and gates). Two game-over conditions: zero lives, or score drops below zero (a wrong A gate on a small-score run is enough).
- **Real geometry problems + diagrams**: ~80 hand-curated **Basic** problems sourced from OpenStax Contemporary Mathematics + Illustrative Mathematics K-8 (both CC BY 4.0) covering shape names, side / vertex / face counts, angle definitions, terminology. **15 Medium** + **14 Advanced** templates parameterise problems (Pythagoras, perimeter / area / volume / surface area, Heron's formula, distance / midpoint / slope on a coordinate plane, special-angle trig) and compute their own correct answers + two plausible distractors per seed — a property-based test sweeps 1000 seeds per template to verify no correct / distractor collisions. Medium and Advanced problems carry a **parameterised inline-SVG diagram** (right triangles, trapezoids, circles, regular polygons, coordinate planes, sphere / cone / cylinder / pyramid / rectangular prism silhouettes, composite shapes) generated entirely in TypeScript at render time — no image assets, no MathJax / KaTeX. Equations use Unicode glyphs (√, π, ², ³, °, ½) so the bundle stays under 160 KB gzipped. Modal flow now has a two-stage **answer → review** flow: the panel tints green / red after you pick, highlights the correct answer (and your wrong pick if any), and counts down 3 s to resume — with an in-modal **Continue** button and an **Auto-continue (1 s)** toggle that persists for the session. A **Problem credits** panel listing the CC BY 4.0 sources opens from the start screen and game-over screen; full attribution is also in `LICENSES.md`.
- **Per-question countdown timer**: every problem-gate modal now shows a visible difficulty-scaled countdown (Basic = 60 s, Medium = 120 s, Advanced = 180 s). The clock is wall-clock-driven via `performance.now()` so backgrounding the tab can't buy extra time. In the last 10 seconds the timer turns red, prepends "Hurry!", and pulses. If you run out of time, the question routes through the existing wrong-answer flow — you lose the difficulty's points, lose a life, see the correct answer highlighted, and get the same 3-second auto-continue before resuming.

## Getting started

### Prerequisites

- **Node.js** 20 or 22 (LTS). Check with `node --version`.
- **npm** 10+ (ships with Node 20+). Check with `npm --version`.
- A modern desktop browser for development (Chrome / Firefox / Safari / Edge).
- For mobile testing: any reasonably modern phone on the same Wi-Fi as your dev machine.

### Install and run

```bash
git clone https://github.com/raffertyuy/geometry-dash.git
cd geometry-dash
npm install
npm run dev
```

The Vite dev server opens at `http://localhost:5173`. Press any key (or tap on mobile) to dismiss the start screen and begin running.

Append `?debug=1` to the URL to see a small overlay with the current run state, lane, animation progress, distance, score, etc.

### Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot module reload. |
| `npm run preview` | Serve the production `dist/` locally — catches "works in dev, breaks in build" issues. |
| `npm run build` | Production build to `dist/` (~140 KB gzipped JS at the time of writing). |
| `npm test` | Run all unit + integration tests once (Vitest, node environment). |
| `npm run test:watch` | Same, in watch mode. |
| `npm run test:coverage` | Tests plus a V8 coverage report. |
| `npm run typecheck` | `tsc --noEmit` — strict type check, no output. |
| `npm run lint` | ESLint with the project's library-first boundary rules. |

### Playing on mobile

1. Find your machine's LAN IP — `ipconfig` on Windows, `ifconfig` (or `ip a`) on macOS / Linux. Look for an address like `192.168.x.x` on your Wi-Fi adapter.
2. From a phone on the same Wi-Fi, open `http://<your-ip>:5173`.
3. Tap to start; swipe left or right to switch lanes.

## Project layout

```
geometry-dash/
├── .specify/                          Spec Kit scaffolding (templates, scripts, extensions)
├── specs/                             Feature specs, one folder per shipped slice
│   ├── 001-lane-runner/               Core 3-lane endless runner
│   ├── 002-scoring-hud/               Live score + elapsed timer HUD
│   ├── 003-obstacles/                 Random geometric obstacles + game-over + restart
│   ├── 004-difficulty-escalation/     Every-30s speed and scoring escalation
│   ├── 005-problem-gates/             Problem-gate cubes + answer modal + lives system
│   └── 006-geometry-problems/         Real geometry problems + SVG diagrams + credits
├── src/
│   ├── shared/                        Types + tunable constants (Lane, RunState, LANE_X, …)
│   ├── lane-state/                    Pure logic: 3-lane state machine + animation
│   ├── runner-engine/                 Pure logic: world tick, distance, run lifecycle
│   ├── input-adapter/                 Pure logic: keyboard + swipe → normalised events
│   ├── score/                         Pure logic: score + timer derivations from tickMs
│   ├── obstacles/                     Pure logic: spawn generator, collision predicate, shape catalogue
│   ├── escalation/                    Pure logic: tier + speed-multiplier derivations
│   ├── problem-gates/                 Pure logic: gate spawn state + catalogue + collision
│   ├── problems/                      Pure logic: Basic problem pool + Medium/Advanced templates + sources
│   ├── diagrams/                      Pure logic: SVG primitives + parameterised archetypes
│   ├── renderer/                      Three.js scene + DOM overlays (modal, credits panel, HUD, debug)
│   ├── game/                          Integration glue: rAF loop, DOM event bridging, state machine
│   └── main.ts                        Entry point
├── tests/
│   └── integration/                   Cross-module flow tests
├── index.html                         Canvas + DOM overlays (start, pause, game-over, HUD)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── eslint.config.js                   Includes the library-first import-boundary rule
```

### Architecture in one paragraph

Every game subsystem is a self-contained pure-logic module in `src/<module>/` with a single `index.ts` entrypoint. The pure-logic modules — `lane-state`, `runner-engine`, `input-adapter`, `score`, `obstacles`, `escalation` — never import Three.js or touch the DOM, so their unit tests run in Node in milliseconds. `src/renderer/` and `src/game/` are the only folders allowed to talk to Three.js; ESLint enforces this. The game-loop in `src/game/game-loop.ts` wires everything together each frame: read input → mutate state via pure functions → ask the renderer to draw.

## Reading the spec-kit artifacts

Each feature folder under `specs/NNN-name/` contains a consistent set of documents:

- **`spec.md`** — user stories, functional requirements, success criteria. Written for non-technical stakeholders.
- **`plan.md`** — tech stack, architecture decisions, constitution-check gates, source-tree map.
- **`research.md`** — Phase 0 design decisions with rationale + alternatives considered.
- **`data-model.md`** — entities, derived values, state transitions.
- **`contracts/module-contracts.md`** — public APIs of every module the slice touches.
- **`quickstart.md`** — slice-specific dev / test / validate runbook.
- **`tasks.md`** — dependency-ordered implementation tasks.
- **`checklists/requirements.md`** — spec quality gate.

If you want to understand WHY a piece of code exists, start with `specs/NNN-name/spec.md` (the human-readable story) and follow the trail through `plan.md` and `research.md`.

## Adding a feature

This project uses the [GitHub Spec Kit](https://github.com/github/spec-kit) workflow for spec-driven development. To add a feature, run the `/speckit-*` commands in your AI assistant:

```
/speckit-specify "<a paragraph describing what the feature does and what's out of scope>"
/speckit-plan      [tech-stack guidance and architectural notes]
/speckit-tasks     [usually no args; generates the dependency-ordered task list]
/speckit-implement [usually no args; executes the tasks one phase at a time]
```

Each command writes artifacts under `specs/NNN-<short-name>/` and (for `/speckit-specify`) auto-creates a git feature branch via the `before_specify` extension hook. The `.specify/memory/constitution.md` document lists the four binding project principles every slice must respect.

## Project rules (constitution)

The binding rules live in `.specify/memory/constitution.md`. Short summary:

1. **Simplicity & YAGNI** — smallest design that works; no speculative abstractions; new dependencies require justification.
2. **Test-First Discipline** — non-trivial game logic gets unit tests written before / alongside the code (asserted red first, then green).
3. **Library-First / Modular Design** — each subsystem is its own folder with one public entrypoint; only `renderer/` and `game/` may import Three.js; cross-module imports go through `index.ts`.
4. **Observability & Debuggability** — significant state transitions emit structured `console.debug` events; a debug overlay is available via `?debug=1`.

## Tech stack

- **Language**: TypeScript 5.x (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **Bundler / dev server**: Vite 6
- **3D rendering**: Three.js 0.184, with `EffectComposer` + `UnrealBloomPass` (for the Tron glow) and `LineSegments2` (for thick glowing obstacle outlines)
- **Tests**: Vitest 2 (node environment for pure modules, jsdom override available for renderer tests)
- **Linter**: ESLint 9 (flat config) + `typescript-eslint`, enforcing the import-boundary rule
- **Hosting target**: Cloudflare Pages (static deploy from `dist/`)
- **Backend**: none — game runs entirely in the browser; no accounts, no persistence yet

## Useful Spec Kit links

- [GitHub Spec Kit on GitHub](https://github.com/github/spec-kit) — the workflow this project follows
- [Spec Kit's docs and quickstart](https://github.com/github/spec-kit#quickstart) — how `/speckit-*` commands work in your AI assistant of choice
- [Anthropic Claude](https://www.anthropic.com/claude) — the assistant used to build this project

## License

Not yet set. Treat as "all rights reserved by the author" until a LICENSE file lands.
