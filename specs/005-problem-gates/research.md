# Research: Problem Gates with Lives and Multi-strike Game Over (Phase 0)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-17

No `[NEEDS CLARIFICATION]` markers — both open questions from spec drafting were resolved inline by the user (uniform per-lane gate difficulty with no balancing; invincibility absorbs gates as well as obstacles). Phase 0 captures the implementation choices.

---

## Decisions

### `src/problem-gates/` as its own module (not folded into `obstacles/`)

- **Decision**: A new top-level pure-logic module `src/problem-gates/` that exports `augmentRowWithGates`, `gateCollidesAt`, and a `GATE_CATALOGUE` data table. Gates live alongside — not inside — `obstacles/`.
- **Rationale**:
  - Gates and obstacles have **different collision behaviour** (gate → modal; obstacle → life-decrement / respawn / invincibility) and **different rendering** (subdivided cube vs. existing primitive variants). Folding them into `obstacles/` would mean a `Collidable = Obstacle | ProblemGate` discriminator in every function, growing two responsibilities in one module.
  - Library-First treats subsystems as folders. The gate concept is a discrete subsystem with its own data, its own spawn rule, and its own collision-result type.
  - The two share only the row trigger from the spawner — that coupling lives in the game-loop, not in either module.
- **Alternatives considered**:
  - **Extend `obstacles/`** with a tagged-union `Collidable`. Rejected — couples two responsibilities, makes obstacle tests more complex, undermines the read-the-file-name-and-know-what's-in-it property of the existing layout.
  - **A `src/collidables/` umbrella module** that owns both. Premature abstraction; no third collidable on the horizon.

### `src/problems/` as a separate pure-data module (not folded into `problem-gates/`)

- **Decision**: A second new module `src/problems/` that owns the placeholder pool and the `selectPlaceholderProblem` function. `problem-gates/` references `problems/` only at the point of gate creation (to attach a `Problem` payload).
- **Rationale**:
  - The placeholder pool is a stand-in for a much larger future surface (real geometry problems, diagram primitives, equation typesetting). Isolating it now means the future swap is a single-module replacement, not surgery across `problem-gates/`.
  - The pool is also independently testable: "every difficulty has at least one problem; every problem has exactly one correct answer; selection by difficulty returns a problem with that difficulty" — orthogonal to gate spawning.
- **Alternatives considered**:
  - **Inline the pool in `problem-gates/problem-gates.ts`.** Smallest right now, but bakes in a future migration cost. The added module is a single file plus its test — under YAGNI's threshold for "premature."
  - **Inline in `shared/`.** `shared/` is for cross-cutting types and constants, not domain data.

### `scoreDelta` field + optional `computeScore` parameter (not a running accumulator)

- **Decision**: Add `scoreDelta: number` (signed, default 0) to `WorldState`. `computeScore(tickMs, scoreDelta = 0)` returns the existing closed-form tick-derived value plus `scoreDelta`. Each answer commit writes a new `WorldState` with `scoreDelta = previous + ±N`.
- **Rationale**:
  - **Preserves the derived-from-tickMs property** the score has had since slice 002. The new total score is still computable from a snapshot: `total = computeScore(world.tickMs, world.scoreDelta)`. No iteration over history required.
  - **Smallest possible API change**: default-zero parameter, all existing tests and call sites pass unchanged.
  - **Plays well with the negative-score game-over rule**. The check is `total < 0` after each answer commit — a single conditional.
- **Alternatives considered**:
  - **Replace closed-form with `world.score` accumulator** updated each tick + each event. Loses the derived-from-tickMs property; requires changing every existing score-related test that asserts `computeScore(N) === expected`; introduces a "score advanced twice on the same frame" race risk if the per-tick add and an event add land on the same frame.
  - **Two separate score values** (`tickScore` and `eventScore`) shown in the HUD. Splits the UX cognitively; clamping logic for the negative-score rule becomes "is one of them too low or is their sum?" — fragile.

### New `RunState` value `'answering'` (not a side-channel "modal-open" flag)

- **Decision**: Extend the existing `RunState` union to `'pre-run' | 'running' | 'paused' | 'answering' | 'game-over'`. `tickWorld` early-returns on `'answering'`, same as `'paused'` and `'game-over'`.
- **Rationale**:
  - **Symmetry with the existing freeze states.** `'paused'` and `'game-over'` both stop `tickMs`/`distanceUnits` advance — the modal needs identical behaviour. Adding a state to the union reuses the existing `tickWorld` guard with a one-line union extension.
  - **Single source of truth**: there's no "is the modal open?" question that could ever disagree with a separate boolean. Everywhere that branches on `runState` will now see `'answering'` as an explicit state.
  - **Debug-overlay friendly**: the current run state is already shown; adding `'answering'` as a value gives the player / dev a visible cue.
- **Alternatives considered**:
  - **`world.modalOpen: boolean`** alongside `runState: 'running'`. Two flags that mean "world is frozen" creates the "are these in sync?" footgun.
  - **`world.activeGate: ActiveGate | null`** as a pause-indicator on its own. Couples "is the modal showing?" to "do we have a gate object?" which gets confusing during the brief commit-but-not-yet-resumed window.

### Modal as `src/renderer/problem-modal.ts` (not inline DOM, not top-level module)

- **Decision**: A new DOM-adapter file inside `src/renderer/` exposing `createProblemModal(host)` that returns an adapter with `show(problem, onCommit)` / `hide()` / `destroy()`. Mirrors the `createDebugOverlay` and `createInputAdapter` patterns.
- **Rationale**:
  - **DOM helpers belong in `renderer/`** per the constitution — `renderer/` and `game/` are the only modules allowed to touch Three.js or DOM. `debug-overlay.ts` already lives here; the modal fits the same shape.
  - **Adapter factory keeps modal state out of the game-loop.** The game-loop just calls `modal.show(problem, onCommit)` and gets a callback when the player commits an answer.
  - **Keyboard / mouse / touch input is encapsulated in the modal**, not in the input-adapter. The input-adapter remains a single-purpose lane-input thing.
- **Alternatives considered**:
  - **Inline DOM manipulation in game-loop.** Bloats the game-loop with three layers of concern (game logic, DOM bridging, modal-specific input handling).
  - **Top-level `src/modal/` module.** A modal is a renderer concern; promoting it to a top-level module overstates its weight (it's ~80 LOC).

### Lives as two WorldState fields, not a dedicated module

- **Decision**: Add `lives: number` and `invincibilityRemainingMs: number` to `WorldState`. Two constants in `shared/config.ts`: `MAX_LIVES = 3`, `INVINCIBILITY_DURATION_MS = 3000`. Transition functions (`consumeLife`, `tickInvincibility`) live in `runner-engine/`.
- **Rationale**:
  - **Below the module threshold.** A "lives module" would contain two constants and three small functions, all of which live naturally next to WorldState.
  - **Co-location**. The lives + invincibility state IS run-lifecycle state; placing it inside `runner-engine/` keeps the lifecycle helpers (`startRun`, `pauseRun`, `endRun`, `restartRun`) and the new `consumeLife` together.
  - **YAGNI** — if future slices add health regen, power-up lives, or other lives-related behaviours, we extract a module then. Three lines of arithmetic don't merit a folder.
- **Alternatives considered**:
  - **`src/lives/` module** containing the two constants and three functions. Adds ceremony with no clear benefit.
  - **Lives in PlayerState rather than WorldState.** PlayerState is currently lane / animation state — adding lives there mixes "where am I in the lane?" with "how many lives do I have?" Two unrelated lifetimes.

### Gates piggy-back on the obstacle row trigger (not an independent spawner)

- **Decision**: The existing obstacle spawn loop in `game-loop.ts` calls `nextObstacleGroup(...)` once per row threshold. After receiving the group, the loop additionally calls `augmentRowWithGates(group.blockedLanes, rng)` from `problem-gates/` and pushes any resulting `ProblemGate`s into a sibling array.
- **Rationale**:
  - **Matches the spec's wording** ("Every time the existing obstacle generator emits a row, the spawner additionally chooses..."). One row trigger; per-lane decisions for the non-obstacle lanes.
  - **Keeps the existing obstacle gap rules (MIN/MAX_GAP) authoritative.** Gates don't have their own gap; they share the obstacle row's z position.
  - **Two-list rendering** (obstacles list + gates list) is simpler than a single merged list with a discriminator — every operation either iterates one list or the other.
- **Alternatives considered**:
  - **Independent gate spawner** with its own cadence and seed. Risks two collidables landing at the same z + lane, creating ambiguous collision priority.
  - **Single merged spawner** that produces a per-row `{ lane → (Obstacle | Gate | empty) }` map. Larger refactor of obstacles/; rejected — gates inherit the row, not the row's structure.

### Invincibility = 3000 ms constant, not a tunable

- **Decision**: `INVINCIBILITY_DURATION_MS = 3000` in `shared/config.ts`. No URL param, no debug-mode override.
- **Rationale**:
  - Spec explicitly says "3 seconds." No reason to make it a knob until a second concrete tuning need appears.
  - Existing knobs in `shared/config.ts` (`ESCALATION_*`, `OBSTACLES_*`) are there because each was actively tuned during development. The 3 s window is a feel-of-respawn-grace number; it'll stay 3 s unless playtest says otherwise.
- **Alternatives considered**:
  - **`?invincibility=N` URL param** for debug. Premature; the DEBUG flag is enough leverage to add it later if needed.

### Heart icon: inline SVG polygon, not an emoji or PNG

- **Decision**: Each heart is a `<span class="heart"><svg viewBox="0 0 24 24"><path d="..."/></svg></span>`. The SVG path is a low-poly heart silhouette (one closed polygon, ~10 vertices). Filled-red via `fill: var(--heart-red); stroke: var(--heart-outline); stroke-width: 1.5`. The `.heart.empty` modifier swaps `fill: transparent` while keeping the stroke.
- **Rationale**:
  - **Vector at any DPI** — no bitmap blurriness at 320 px mobile or 4K desktop.
  - **No new asset pipeline** — SVG inline in `index.html` template or generated by `lives-hud.ts` at boot.
  - **Tron aesthetic matches** — the glowing outline lines up with the existing obstacle line work via the same `text-shadow` / filter approach.
  - **Low-poly polygon** reads as "geometric" per the spec, not "cute cartoon heart."
- **Alternatives considered**:
  - **Unicode `♥`**. Renders differently per font; can't control the polygon style.
  - **Emoji `❤️`**. Even more variation; clashes with the Tron palette.
  - **PNG / WebP**. Asset pipeline cost; raster scaling issues.

---

## No-changes inherited from earlier slices

- TypeScript strict config; Vite; Vitest in `node` environment with jsdom override for renderer tests.
- ESLint flat config + `no-restricted-imports` import-boundary rule.
- WorldState immutability + the `runState`-guarded `tickWorld`.
- Pause / blur / resume input behaviour for tab switching.
- The closed-form score formula from slice 004 (extended with `scoreDelta`, not replaced).
- The tier escalation from slice 004 (paused naturally during `'answering'` because `tickMs` doesn't advance).
- Constitution v1.0.0.

## Open follow-ups (NOT in this slice)

- Real geometry problems with SVG diagrams + equation typesetting (KaTeX or MathJax).
- Tier-aware gate difficulty distribution (more A gates at higher escalation tiers).
- Audio cues on life lost / right / wrong.
- Best-score persistence.
- Combo / streak multipliers.
