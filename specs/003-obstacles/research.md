# Research: Random Geometric Obstacles (Phase 0)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-16

No `[NEEDS CLARIFICATION]` markers remained in the spec. Tech-stack questions are answered by the previous two slices. This Phase 0 captures the design choices specific to obstacles.

---

## Decisions

### Seeded random number generator (deterministic spawn for tests)

- **Decision**: Use a tiny inline `mulberry32` PRNG (32-bit state, ~10 lines of code). Each run seeds it from `performance.now() ^ 0x9e3779b9` at run start; tests pass an explicit seed for determinism.
- **Rationale**:
  - The spawn generator MUST be deterministic per (seed, sequence) - the spec implies this via FR-014 ("Random distances and shape choices within a single run MUST NOT depend on persistent state from previous runs") AND via SC-008 ("no two runs replay the exact same sequence"). Both require a seedable RNG, not `Math.random()`.
  - `Math.random()` cannot be seeded in JavaScript. Using it would mean we can't write deterministic spawn tests, and would mean the spawn generator can't be unit-tested at all - violating Constitution II.
  - `mulberry32` is good enough: passes basic statistical tests, 10 lines of code, no library, MIT-equivalent terms. It's the standard "fits in a tweet" PRNG.
- **Alternatives considered**:
  - **Use `Math.random()`** for runtime + a fixed `Math.random` stub in tests. Brittle; stubs are spooky; deterministic-replay debugging dies.
  - **Pull in a library** (`seedrandom` etc.). Two-digit kilobytes of code for one PRNG; overkill for our needs.
  - **xoshiro128**. Higher quality than mulberry32 but ~3x more code. We're spawning a few thousand obstacles total over a session; mulberry32 quality is fine.

### `'game-over'` as a fourth `RunState`, not an `isDead: boolean` flag

- **Decision**: Extend `RunState` to `'pre-run' | 'running' | 'paused' | 'game-over'`.
- **Rationale**:
  - The state space genuinely has four distinct user-visible states. `'pre-run'` shows the title screen; `'running'` ticks the world; `'paused'` freezes (tab-blur); `'game-over'` freezes AND shows the game-over overlay AND consumes the next input as a restart.
  - A boolean `isDead` next to the existing tri-state would create two state variables that must be kept in sync ("if `isDead && runState === 'paused'`, which overlay shows?"). One enum keeps the state machine legible.
  - The existing `tickWorld` already short-circuits on `runState !== 'running'`. Adding a new value to that union extends the same guard for free - tickMs / distanceUnits / score / timer all freeze on game-over by construction.
- **Alternatives considered**:
  - **`isDead: boolean` plus the existing tri-state.** Creates a 2x3 state space with several unreachable combinations and a "which-overlay" lookup. Rejected: more code, less clear.
  - **A separate `phase: 'in-game' | 'game-over'` field alongside runState.** Same problem as the boolean.

### Effective-lane rule during a lane-change animation

- **Decision**: Player is in the source lane while `animProgress < 0.5`, and in the target lane while `animProgress >= 0.5`. Collision check uses this effective lane.
- **Rationale**:
  - Halfway-crossover matches the visible character position (lane-change animation eases from source X to target X; the character is visually in the new lane by the midpoint).
  - Reproducible and unit-testable: `effectiveLane(player)` is a pure function of `(currentLane, targetLane, animProgress)`.
  - Gives the player a fair chance to commit a dodge mid-animation: if they swipe right and the right lane is open, they'll be considered "in" right after only 100 ms (half of the 200 ms animation duration), not 200 ms.
- **Alternatives considered**:
  - **Always source until animProgress = 1.** Strict / unforgiving; mid-animation dodges that would feel "made it" actually fail. Bad feel.
  - **Always target from the moment input is accepted.** Most forgiving; but a player whose torso is still mostly in the source lane visually passes through obstacles that were "in the way" - reads as a phantom collision avoidance.
  - **Bounding-box-perfect collision.** Out of scope for this slice (no per-pixel hit testing); over-engineered for a lane-based game.

### Obstacle mesh pool size

- **Decision**: One mesh pool of 12 instances per variant (so for 6 variants, 72 meshes total). Pool size 12 because the maximum number of simultaneously visible groups - given the min spacing of ~22 world units and the visible track length of ~200 world units - is `floor(200 / 22) + 1 = 10`, plus a 20 % buffer.
- **Rationale**:
  - Pre-allocating pools is standard for game-dev hot-path performance. The constitution Performance Goals explicitly say "no per-frame allocations in the run loop". A mesh pool meets that bar.
  - Per-variant pools simplify the renderer: each variant has its own geometry + material, instantiated once; instances re-use the same geometry/material under the hood.
  - 72 meshes is trivial for Three.js - the scene already has ~50 meshes (rungs, dividers, runner figure, speed lines, player trail).
- **Alternatives considered**:
  - **One large pool of generic meshes that get re-keyed each frame.** Forces re-uploading geometry on each re-use; defeats the point of pooling.
  - **Instanced meshes (`InstancedMesh`).** Higher performance ceiling, more complex to reason about. Overkill at our scale.
  - **No pool - create + destroy meshes on the fly.** GC pressure during a run; visible jank possible on lower-end mobile. Rejected.

### Restart input consumption: same pattern as resume-from-pause

- **Decision**: While the game-over overlay is visible, the first keydown or pointerdown event triggers `restartRun(world)` and is NOT additionally forwarded to the input-adapter for lane-change processing.
- **Rationale**:
  - Exactly the same pattern as the existing pause-resume input (from the 001-lane-runner slice's `isAwaitingResume` gate). Re-using the pattern keeps the input-handling layer consistent across all "the game pauses, then the next input has a special meaning" interactions.
  - Avoids the surprise of "I just pressed left to restart and my character moved one lane left on the fresh run".
- **Alternatives considered**:
  - **Forward the restart input to the input-adapter as well.** Surprising; rejected.
  - **Require a dedicated "RESTART" button on the overlay.** More clicks, worse UX on mobile.

### Obstacle visual variants - which five for the MVP

- **Decision**: Six shape variants for slight headroom over the spec's "at least 5" floor:
  1. `cube` - 1.4 wide × 1.4 tall × 1.4 deep, single lane.
  2. `pillar` - 1.0 wide × 2.6 tall × 1.0 deep, single lane.
  3. `cylinder` - radius 0.7, height 1.6, single lane.
  4. `sphere` - radius 0.8, single lane.
  5. `trapezoid-prism` - 1.4 wide bottom / 1.0 wide top, 1.6 tall, 1.0 deep, single lane.
  6. `wide-bar` - 4.0 wide × 1.2 tall × 1.0 deep, TWO lanes (the only two-lane variant).
- **Rationale**: gives the game-loop a 5:1 ratio of single-lane variants to two-lane variants when spawning is unweighted, which feels like a reasonable single-vs-double mix (roughly 80 % single-lane / 20 % two-lane). All variants fit visually inside a lane (lane width = 2.0 world units; widest single-lane mesh is the cube/trapezoid at 1.4 wide).
- **Alternatives considered**:
  - **Three variants only (cube, pillar, bar)** to ship the MVP faster. Rejected: the spec already calls for "at least five", and adding the extra three (cylinder, sphere, trapezoid) is one constructor call each plus a one-line catalogue entry.
  - **More than six variants** (octahedron, torus, cone, etc.). Diminishing visual return for added catalogue work. Six is enough for "feels varied".

### Spawn timing: distance-based, not time-based

- **Decision**: The spawn generator emits the next group's z-position based on the **previous group's z plus a random gap** (in world units). NOT based on wall-clock time elapsed.
- **Rationale**:
  - At constant run speed, the two are equivalent. But coupling spawn to world-distance keeps the dependency on `runner-engine.distanceUnits` rather than `Date.now()`, which means the spawner correctly freezes on pause (distanceUnits doesn't advance while paused) for free.
  - Future-proofs against the day we add speed variation (already foreseen in plan.md's "Difficulty escalation is explicitly out of scope" - but if/when it lands, distance-based spawn still gives the right cadence regardless of speed).
- **Alternatives considered**:
  - **Time-based spawn** (`setInterval` or wall-clock). Drifts under load, doesn't pause cleanly, couples gameplay state to JS timing primitives.

---

## No-changes inherited from earlier slices

- TypeScript strictness profile.
- Vite + Vitest configurations.
- ESLint flat config + `no-restricted-imports` boundary rule (the new `src/obstacles/` module is automatically covered by the existing rules - it's not in the allowlist for `three` imports, so any accidental dep on Three.js fails CI).
- Pause-on-blur behaviour, DOM-overlay layering pattern, score / timer derivations from `tickMs`.
- Constitution v1.0.0 - no amendments needed for this slice.
