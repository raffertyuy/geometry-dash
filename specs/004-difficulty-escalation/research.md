# Research: Difficulty Escalation by Tier (Phase 0)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-16

No `[NEEDS CLARIFICATION]` markers; the spec was mathematically precise. Phase 0 captures the implementation choices.

---

## Decisions

### `src/escalation/` as its own module (not folded into `score/` or `runner-engine/`)

- **Decision**: A new top-level module `src/escalation/` that exports `currentTier(tickMs)` and `speedMultiplier(tier)`. Three lines of arithmetic spread across two named functions, deliberately lifted out of any other module.
- **Rationale**:
  - The tier value is *shared* between two consumers: the score formula and the run-speed scaler. Putting it inside `score/` would force `runner-engine/` (via the game-loop) to import from `score/` to scale speed - a backwards coupling. Putting it inside `runner-engine/` would force `score/` to import from `runner-engine/` for the same reason.
  - A neutral module is the textbook Library-First decomposition: the shared concept gets its own folder; the two consumers each depend only on that module.
  - Two named functions are more searchable / less magic than two unnamed `Math.floor(t/30000)` / `Math.pow(1.10, tier)` calls scattered across the codebase. They also pin the semantics so the next person who wonders "what's `t/30000`?" finds a line of documentation, not just a literal.
- **Alternatives considered**:
  - **Inline both expressions in `game-loop.ts`.** Loses testability (no unit tests for boundary cases) and re-implements the tier math in three places (game-loop, score formula, debug overlay).
  - **Put in `shared/config.ts`.** Constants live there; functions don't. The Library-First principle treats subsystems as folders, not as buckets in a config file.
  - **Generic "balancing" module** that absorbs future difficulty-related concerns (faster spawns, harder masks, etc.). Speculative scaffolding; rejected by Principle I. We can rename `escalation/` to `balancing/` later if more knobs land.

### Optional `speedOverride` parameter on `tickWorld` (not WorldState mutation)

- **Decision**: Extend `tickWorld(world, dtMs)` to `tickWorld(world, dtMs, speedOverride?)`. Default behaviour - using `world.speedUnitsPerSec` - is unchanged when the third argument is omitted, so all existing tests pass without modification.
- **Rationale**:
  - `WorldState` is and should stay an immutable record. Mutating `world.speedUnitsPerSec` each frame from the game-loop would break the "WorldState is replaced, never mutated" invariant used throughout 001-003.
  - The override approach localises the tier-coupling to the single line in the game-loop that supplies the multiplier. The runner-engine itself stays tier-agnostic.
  - Function-parameter polymorphism is one of TypeScript's simplest forms of variation. No subclass, no strategy object, no event bus.
- **Alternatives considered**:
  - **Mutate `world.speedUnitsPerSec`** before each tickWorld call. Loses immutability; future modules that "snapshot" WorldState would silently capture a stale value. Rejected.
  - **A `tickWorldAtSpeed(world, dtMs, speed)` companion function** that ignores `world.speedUnitsPerSec` entirely. Two names for nearly identical behaviour creates a "which do I call?" footgun. The optional parameter is one name with a clear default.
  - **Wrap WorldState in a Box (`world.derivedSpeed`)** that the game-loop sets. Adds a field that means the same as the override; loses the optional-parameter advantage of "I don't need to know about this field unless I want to use it."

### Closed-form score formula (O(1) per frame)

- **Decision**: `computeScore(tickMs)` is a closed-form expression: `300 * N*(N+1)/2 + floor((tickMs - N*30000)/100) * (N+1)` where `N = floor(tickMs / 30000)`. Computed in O(1) for any tickMs, regardless of how long the run has lasted.
- **Rationale**:
  - The naive alternative (accumulate a running total each 100 ms tick) is O(time) for the per-frame computation - over a long run the cost grows. The closed form is constant time.
  - Closed form is also stateless: any module can ask "what's the score at tickMs X?" without first asking "what was the score 100 ms ago?". This is the same nice property `computeScore` had with the pre-escalation formula.
- **Alternatives considered**:
  - **Accumulator stored in WorldState (`world.score`)**. Adds state we don't need; loses the derived-from-tickMs invariant that made the previous slice clean.
  - **Memoised lookup table** keyed by tier. Premature optimisation; the closed form is already O(1) and ~6 arithmetic ops.

### Floor-based tier boundaries

- **Decision**: `currentTier(tickMs) = Math.floor(tickMs / 30000)`. Tier 0: tickMs in [0, 30000). Tier 1: tickMs in [30000, 60000). Boundary is exclusive at the high end.
- **Rationale**:
  - `Math.floor(30000 / 30000) === 1`, so the tier flips at exactly the millisecond `tickMs = 30000`. Matches the spec's wording ("tier 1 active from 30000 ms up to but not including 60000 ms").
  - JavaScript's `Math.floor` on positive integer inputs is fully deterministic and avoids floating-point surprises.
- **Alternatives considered**:
  - **Inclusive upper boundary** (tier 0: [0, 30000] inclusive). Creates an off-by-one moment where the 30000.0001 ms tick is "still tier 0"; harder to reason about. Floor is the right tool.

### No upper bound on tier or speed

- **Decision**: Don't clamp. `currentTier` returns 1000 for `tickMs = 30_000_000` (8.3 hours); `speedMultiplier` returns `1.10^1000 ≈ 2.5e41`. Both finite.
- **Rationale**:
  - Spec is explicit: no cap.
  - `Math.pow(1.10, tier)` in IEEE 754 double precision stays finite until about tier 7400 (where it would exceed `Number.MAX_VALUE ≈ 1.8e308`). The player will never reach that tier; the game becomes unplayable by tier ~20 (10.8x baseline speed).
  - Adding a cap would be future-work scaffolding for a concern the player will never feel.
- **Alternatives considered**:
  - **Cap at tier 50 or similar**. Saves a couple of `Math.pow` cycles in pathological cases. Adds a magic number; rejected.

---

## No-changes inherited from earlier slices

- TypeScript strict config, Vite, Vitest.
- ESLint flat config + `no-restricted-imports` boundary rule.
- WorldState immutability + the existing `tickWorld`-on-running-only guard.
- Pause / blur / resume input behaviour.
- Constitution v1.0.0.
