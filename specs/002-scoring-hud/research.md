# Research: Scoring HUD (Phase 0)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-16

The spec has no `[NEEDS CLARIFICATION]` markers. The 001-lane-runner slice already settled all tech-stack questions (TypeScript + Vite + Vitest, Three.js for the 3D scene, DOM overlays for non-3D UI). This Phase 0 captures only the few small design choices that are specific to this slice.

---

## Decisions

### Derive the score from `tickMs`, do NOT maintain a separate `ScoreState`

- **Decision**: Both the score readout (integer) and the timer readout (formatted string) are pure functions of `WorldState.tickMs`. No new persistent state.
- **Rationale**:
  - The runner-engine already maintains `tickMs` as the elapsed running time and already pauses it correctly on tab blur. Re-using it means pause/resume/reset behaviour for the HUD comes for free.
  - Two independent state values that "should be in sync" is a classic bug nursery (e.g., score increments while paused because someone forgot to gate it on `runState === 'running'`). One source eliminates the class entirely.
  - Constitution Principle I (Simplicity / YAGNI) - no new state when the existing state already encodes what we need.
- **Alternatives considered**:
  - **A `ScoreState` with its own tick + pause logic.** Rejected: duplicates a subset of `runner-engine`'s responsibility.
  - **An event-bus-based score**, where `runner-engine` emits `tick` events and a score listener accumulates points. Rejected: more moving parts, harder to test (have to construct an event sequence), and easy to get out of sync with the run state on pause.

### HUD position: timer top-centre, score top-right

- **Decision**: Two readouts sit at the top of the viewport. Timer is centred horizontally; score is top-right with right-aligned text.
- **Rationale**:
  - **Readability hierarchy**: the timer is the more "ambient" reading (you glance at it occasionally), while the score is the "chase number" (you want to see it grow). Putting the score at top-right matches the convention from runners like Subway Surfers and Geometry Dash itself.
  - **Mobile-friendly**: top-centre + top-right both stay out of the player's hand-zone (bottom of screen) on a phone held in portrait.
  - **Glanceable**: both readouts in the top band reduces the player's eye movement when checking progress mid-run.
- **Alternatives considered**:
  - **Score top-centre, timer top-right.** Symmetric but inverts the convention; the chase number is harder to find at-a-glance when it's centred among other UI later (gates / questions).
  - **Both readouts top-centre stacked.** Wastes vertical space the player needs to see the upcoming track.
  - **Bottom corners.** Conflicts with the hand-zone on mobile; harder to keep the player's eyes near the track.

### Timer format: `M:SS` under 10 min, `MM:SS` at or after

- **Decision**: `M:SS` for one-digit minute values (`0:00`, `0:42`, `9:59`); auto-switches to `MM:SS` at the 10-minute boundary (`10:00`, `99:59`). No hours, no decimals.
- **Rationale**:
  - `M:SS` is the most readable form for the common case (most runs are under 10 minutes). Switching to `MM:SS` avoids a layout shift when the time crosses the boundary in long runs (the digit always sits in the same column once minutes hit two digits).
  - No decimals: 100 ms precision in the score readout already covers "current play feels accurate"; a decimal seconds readout would be visual noise.
  - No hours: even a marathon run does not need `H:MM:SS`. If a player ever runs for 100 minutes, the timer shows `100:00` and keeps counting.
- **Alternatives considered**:
  - **Always `MM:SS`** (e.g., `00:42`). Marginally more consistent but reads less naturally at low values.
  - **`MM:SS.s` (with tenths of a second)**. More precise but visually busier; the score readout (also derived from `tickMs`) already gives sub-second feedback.

### Score advancement model: integer division of `tickMs / 100`

- **Decision**: `computeScore(tickMs) = Math.floor(tickMs / 100)`. The score is exactly the count of 100 ms ticks elapsed.
- **Rationale**:
  - Simple, deterministic, and trivially testable.
  - Aligns with the spec's wording ("increments by one point every 100 milliseconds").
  - The render frame rate is decoupled: even at 30 FPS (33 ms per frame), the score is correct - it just doesn't visibly advance every frame, but the value is right whenever the player looks.
- **Alternatives considered**:
  - **Continuous fractional score (`tickMs / 100`).** Means the score visibly jitters as the frame rate jitters - readability hit, no upside.
  - **A separate ticker that fires every 100 ms via `setInterval` and increments a counter.** Drifts under load (`setInterval` is not frame-synchronised) and introduces the very same "out-of-sync state" the derive-from-tickMs choice avoids.

### Pure module rather than inline calculation in `game-loop.ts`

- **Decision**: `computeScore` and `formatTimer` live in `src/score/` with their own tests.
- **Rationale**:
  - **Testability boundary**: a pure function next to its tests catches edge cases (`100` -> `1`, `99` -> `0`, `599_999` vs `600_000` for the M:SS to MM:SS boundary) without ever booting the game.
  - **Constitution Principle III alignment**: every other game-logic concept (lane state, runner engine, input adapter, swipe detector) is its own module. Putting scoring in its own module preserves the pattern.
  - **Future extensibility**: when gates land and we add bonus scoring (e.g., +50 for a correct answer), the score derivation has a single, obvious home to extend.
- **Alternatives considered**:
  - **Inline `gameLoop.ts` arithmetic.** Saves one folder but spreads game-logic decisions across the integration layer.
  - **Add to `runner-engine/`.** Possible, but conflates "advance the world" with "shape what to display" - the latter is presentation-adjacent.

---

## No-changes inherited from 001-lane-runner

These are explicitly NOT re-decided in this slice (referenced for traceability):

- TypeScript strictness profile (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Vite + Vitest configurations.
- ESLint flat config with the `no-restricted-imports` boundary rule (the rule's allowlist already excludes `src/score/`, so the new module is naturally framework-free).
- The pause-on-blur / await-resume-input behaviour - already implemented in `src/game/game-loop.ts`; the HUD just inherits the right pause behaviour because it reads from `tickMs`.
- The DOM-overlay pattern (HUD, start screen, pause overlay all live as DOM children of `<body>` layered over the canvas).
