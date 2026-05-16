# Data Model: Scoring HUD (Phase 1)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-16

This slice intentionally adds NO new persistent state. The score and timer readouts are pure derived values from the existing `WorldState.tickMs` (defined in 001-lane-runner's `src/shared/types.ts`).

## Derived readouts

### Score

```text
ScoreReadout := integer score value, ≥ 0
```

Derivation:

```text
score = Math.floor(tickMs / 100)
```

Properties:

- **Initial**: `computeScore(0) === 0`.
- **Monotonic**: for any `tickMs2 >= tickMs1`, `computeScore(tickMs2) >= computeScore(tickMs1)`.
- **Exact tick boundary**: `computeScore(99) === 0`, `computeScore(100) === 1`, `computeScore(199) === 1`, `computeScore(200) === 2`.
- **Pause-frozen**: because `runner-engine.tickWorld` does not advance `tickMs` while `runState !== 'running'`, the score is frozen during pause automatically. Validated in the integration test (no extra logic needed).
- **Reset on new run**: when the game-loop creates a fresh `WorldState` (via `createWorldState()`), `tickMs === 0`, so the score is 0. Automatic.

### Timer (formatted)

```text
TimerReadout := formatted "M:SS" or "MM:SS" string, never empty
```

Derivation:

```text
totalSeconds = Math.floor(tickMs / 1000)
minutes      = Math.floor(totalSeconds / 60)
seconds      = totalSeconds % 60
formatted    = minutes < 10
             ? `${minutes}:${pad2(seconds)}`
             : `${minutes}:${pad2(seconds)}`     // ten-minute mark is also "MM:SS"
where pad2(n) = (n < 10 ? '0' : '') + n
```

Properties:

- **Initial**: `formatTimer(0) === '0:00'`.
- **Padding**: seconds are always two digits (`0:00`, `0:09`, `0:59`).
- **Minute width**: one digit for `0..9` minutes, two digits at `10` and beyond (`9:59` -> `10:00`).
- **Long-run upper bound**: `formatTimer(5_999_999) === '99:59'`, `formatTimer(6_000_000) === '100:00'`. No formal cap; we just keep showing minutes.
- **Pause-frozen and reset-on-new-run**: same as the score, by virtue of deriving from `tickMs`.

## Score → display

The HUD displays the score as a plain integer string. `formatScore(score)` returns `String(score)` (no comma separators in this slice). Reason: a player completing a one-hour run sees `36000` - readable without thousands separators. We can introduce locale-aware formatting later if a slice ever needs it.

## Pause / resume / reset behaviour (no new logic; inherited)

| Run state transition         | Effect on `tickMs`          | Effect on displayed score / timer       |
|------------------------------|-----------------------------|------------------------------------------|
| `'pre-run'` -> `'running'`   | `tickMs` starts at 0        | Score `0`, timer `0:00`                  |
| `'running'` continues        | `tickMs += dtMs` each frame | Score and timer advance per derivation   |
| `'running'` -> `'paused'`    | `tickMs` frozen             | Score and timer frozen at last value     |
| `'paused'` -> `'running'`    | `tickMs` resumes accumulating | Score and timer resume from frozen value |
| New `WorldState`             | `tickMs = 0`                | Score `0`, timer `0:00`                  |

All five rows are correct *by construction* - no scoring-specific code handles them.

## DOM-side state

Two `HTMLElement` references resolved at game-loop creation, then written via `textContent` every frame:

- `#score`: the score readout. The game-loop sets `element.textContent = formatScore(score)` each frame.
- `#timer`: the timer readout. The game-loop sets `element.textContent = formatTimer(world.tickMs)` each frame.

Idempotency: writing the same string each frame is a no-op for the browser layout engine (the DOM diff is empty). Even at 60 FPS, two `textContent` writes per frame is well under any meaningful perf threshold.
