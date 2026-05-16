# Data Model: Difficulty Escalation by Tier (Phase 1)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-16

This slice adds **no new persistent state**. The tier value is a pure derivation from the existing `WorldState.tickMs`.

## Derived values

### Tier (an integer >= 0)

```text
tier(tickMs) = Math.floor(tickMs / 30_000)
```

Properties:

- `tier(0)` = 0
- `tier(29999)` = 0
- `tier(30000)` = 1
- `tier(59999)` = 1
- `tier(60000)` = 2
- Monotonic: for any `a <= b`, `tier(a) <= tier(b)`.
- Pause-frozen: because `tickMs` doesn't advance outside of `running`, the tier doesn't advance either.
- Reset on new run: `restartRun` returns `tickMs = 0`, so tier returns to 0.

### Speed multiplier (a positive real)

```text
speedMultiplier(tier) = Math.pow(1.10, tier)
```

Properties:

- `speedMultiplier(0)` = 1.0 (exact)
- `speedMultiplier(1)` = 1.10 (exact)
- `speedMultiplier(2)` = 1.21 (within float epsilon)
- `speedMultiplier(3)` = 1.331 (within float epsilon)
- Strictly increasing in `tier`.

The game-loop computes an effective speed each frame:

```text
effectiveSpeed = RUN_SPEED_UNITS_PER_SEC * speedMultiplier(tier(tickMs))
```

This is passed to `tickWorld(world, dtMs, effectiveSpeed)` so distance accumulates at the tier-correct rate.

### Cumulative score (an integer >= 0) - REWRITTEN from slice 002

```text
computeScore(tickMs):
  N = floor(tickMs / 30_000)                              # current tier
  completed = 300 * N * (N + 1) / 2                       # sum of full tiers 0..N-1
  current   = floor((tickMs - N * 30_000) / 100) * (N+1)  # partial tier N
  return completed + current
```

`completed` is the contribution from tiers 0 through `N-1`, each having 300 ticks at rate `k+1`. The sum is `300 * (1 + 2 + ... + N) = 300 * N*(N+1)/2`.

`current` is the contribution from tier `N` so far: how many full 100ms ticks have elapsed in tier `N`, each contributing `N+1` points.

Worked examples (matching spec.md success criteria):

| `tickMs`     | tier `N` | completed                | current                                      | total  |
|--------------|----------|--------------------------|----------------------------------------------|--------|
|         0    | 0        | `300 * 0` = 0            | `floor(0/100) * 1`     = 0                   | **0**  |
|     10_000   | 0        | 0                        | `floor(10_000/100) * 1` = 100                | **100** |
|     30_000   | 1        | `300 * 1` = 300          | `floor(0/100) * 2`     = 0                   | **300** |
|     35_000   | 1        | 300                      | `floor(5_000/100) * 2` = 100                 | **400** |
|     60_000   | 2        | `300 * 3` = 900          | 0                                            | **900** |
|     90_000   | 3        | `300 * 6` = 1800         | 0                                            | **1800** |
|    120_000   | 4        | `300 * 10` = 3000        | 0                                            | **3000** |

Properties:

- Monotonic non-decreasing in `tickMs`.
- At tier boundaries, the function "jumps" by exactly `(N+1)` points at `tickMs = (N+1) * 30000` (because tier N's 300th tick is accounted for via the `completed` term once `N+1` is reached, while at `tickMs = (N+1) * 30000 - 1` we still see `floor(29999/100) = 299 * (N+1) = 300(N+1) - (N+1)`). This is mathematically correct - one full tier really does contribute 300 ticks - and produces a +1 / +2 / +3 / ... bump at the boundary.

## Run lifecycle (unchanged)

No new state, no new transitions. The slice plugs into the existing `'pre-run' | 'running' | 'paused' | 'game-over'` machine. Tier is a derived view on `tickMs`; the existing transitions already control whether `tickMs` advances.

## Debug observability

- A `tier_advanced` `console.debug` event is emitted by the game-loop the first frame after `tier(tickMs)` changes from one frame to the next. Payload: `{ previousTier, newTier, tickMs }`.
- The existing debug overlay (`?debug=1`) MAY also display `currentTier` and `effectiveSpeed` (one-line addition); the implementation should do this if cheap. Manual validation can read these values directly.
