# Data Model: Lane Runner Core Movement (Phase 1)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-16

This file describes the pure data shapes the game manipulates in this slice. None of these types reference Phaser - they live in `src/shared/types.ts` and are imported by every module. State machines are documented as transition tables; the public API surface of each module is in [contracts/module-contracts.md](./contracts/module-contracts.md).

## Atoms

```ts
type Lane      = 'left' | 'centre' | 'right';
type Direction = 'left' | 'right';
type InputSource = 'keyboard' | 'touch';
```

- **`Lane`** has exactly three valid values; the type system makes "off-track" unrepresentable.
- **`Direction`** is the *intent* of an input. It does NOT include "up" / "down" - those are dropped at the input-adapter boundary in this slice.
- **`InputSource`** identifies where an event originated, used only for the coalesce-window logic (see G3 in research.md).

## Entities

### Player

Represents the player character's current lane and the in-flight animation toward a new lane.

| Field            | Type                            | Rules / Notes                                                                  |
|------------------|---------------------------------|--------------------------------------------------------------------------------|
| `currentLane`    | `Lane`                          | The lane the character is *visually* in or animating *from*. Initial: `'centre'`. |
| `targetLane`     | `Lane \| null`                  | The lane the character is animating *toward*. `null` when idle.               |
| `animProgress`   | `number`                        | 0.0 - 1.0. 0 = at `currentLane`. 1 = at `targetLane`. Must be 0 when `targetLane` is `null`. |
| `bufferedInput`  | `Direction \| null`             | One-slot buffer for a lane-change input received during an in-flight animation. Last-write-wins. |

**Invariants** (each is a unit-test assertion):

- `targetLane === null  ⇔  animProgress === 0`
- `targetLane !== null  ⇒  targetLane` is adjacent to `currentLane` (no skipping)
- `bufferedInput !== null  ⇒  targetLane !== null` (no buffering when nothing is in flight)

**Lane adjacency**:

| currentLane | left of it | right of it |
|-------------|------------|-------------|
| `left`      | -          | `centre`    |
| `centre`    | `left`     | `right`     |
| `right`     | `centre`   | -           |

A `Direction = 'left'` move from the `left` lane is *clamped* (no-op + structured debug log); same for `'right'` from the `right` lane.

### World

Represents the run as a whole: how fast it is going and how much ground has been covered.

| Field             | Type     | Rules / Notes                                                       |
|-------------------|----------|---------------------------------------------------------------------|
| `runState`        | `'pre-run' \| 'running' \| 'paused'` | `'pre-run'` until the player dismisses the start screen; `'running'` while playing; `'paused'` while tab blurred or focus lost. |
| `speedUnitsPerSec`| `number` | Constant for this slice. Default `200` (logical units per second).  |
| `distanceUnits`   | `number` | Accumulates only while `runState === 'running'`. Never decreases.   |
| `tickMs`          | `number` | Wall-clock ms accumulated this run (excludes paused time).          |

**Invariants**:

- `distanceUnits === tickMs / 1000 * speedUnitsPerSec` (within floating-point tolerance)
- `runState === 'paused'  ⇒  tickMs` is frozen during a `tick(dt)` call.

### InputEvent

The normalised event emitted by `input-adapter` after suppressing keyboard auto-repeat, recognising swipes, and coalescing same-direction events within the 50 ms debounce window.

| Field        | Type           | Rules / Notes                                            |
|--------------|----------------|----------------------------------------------------------|
| `direction`  | `Direction`    | Always `'left'` or `'right'` in this slice.              |
| `source`     | `InputSource`  | For diagnostics + coalesce-window logic.                  |
| `timestampMs`| `number`       | `performance.now()` reading at the moment of recognition. |

**Validation rules**:

- Events with `source === 'keyboard'` are emitted only when `KeyboardEvent.repeat === false`.
- Events with `source === 'touch'` are emitted only when the gesture satisfies all of:
  - horizontal displacement >= 30 px in logical units
  - total duration <= 500 ms
  - `|deltaX| >= 2 * |deltaY|` (horizontal-dominant)
- A second event in the same `direction` within 50 ms of the previous one is suppressed.

## State machine: Lane transitions

The lane-state module owns this state machine. All transitions are pure functions over `(Player, input, dt)`.

### States

- **`idle-in-lane`**: `targetLane === null`, `animProgress === 0`.
- **`transitioning`**: `targetLane !== null`, `animProgress in (0, 1)`.

### Transition table

| From state         | Event                                        | New state          | Side effect                                                  |
|--------------------|----------------------------------------------|--------------------|--------------------------------------------------------------|
| `idle-in-lane`     | `InputEvent { direction }`, adjacent lane exists | `transitioning`    | `targetLane := adjacent(currentLane, direction)`, `animProgress := 0`, debug `lane_change_requested` |
| `idle-in-lane`     | `InputEvent { direction }`, no adjacent lane | `idle-in-lane`     | clamp; debug `lane_change_clamped` with current lane + direction |
| `transitioning`    | `tick(dt)`                                   | `transitioning` or `idle-in-lane` | advance `animProgress`; if `animProgress >= 1`, snap: `currentLane := targetLane`, `targetLane := null`, `animProgress := 0`, debug `lane_change_applied`; then if `bufferedInput !== null`, immediately consume it as a new InputEvent (recursive, max depth 1) |
| `transitioning`    | `InputEvent { direction }`                   | `transitioning`    | overwrite `bufferedInput := direction`; debug `lane_change_buffered` |
| `idle-in-lane`     | `tick(dt)`                                   | `idle-in-lane`     | no-op                                                        |

### Animation easing

- Easing function: `easeOutCubic(t) = 1 - (1 - t)^3` applied to `animProgress` before computing the rendered x-position.
- Animation duration: 200 ms (well under the 250 ms desktop / 350 ms mobile FR-007 budgets).

## Lane → screen coordinate mapping (rendering-only concern)

These constants live in `shared/config.ts` but are listed here because they bridge the data model and the renderer.

| Lane     | Logical x (in a 720 px wide logical canvas) |
|----------|----------------------------------------------|
| `left`   | 180                                          |
| `centre` | 360                                          |
| `right`  | 540                                          |

The rendered player x is:

```text
x = laneX(currentLane) +
    (laneX(targetLane) - laneX(currentLane)) * easeOutCubic(animProgress)
```

When `targetLane` is `null`, the second term is zero by definition.
