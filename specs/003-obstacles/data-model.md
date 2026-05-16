# Data Model: Random Geometric Obstacles (Phase 1)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-16

This slice adds one new value to an existing union type (`RunState`) plus three new pure data shapes. All new types live in `src/shared/types.ts` or in `src/obstacles/`; the runner-engine and game-loop reference them but do not redefine them.

## Atoms

```ts
// Already exported from shared/types.ts: Lane = 'left' | 'centre' | 'right';
// Extended in this slice:
export type RunState = 'pre-run' | 'running' | 'paused' | 'game-over';

// Obstacle variant id - one per entry in the catalogue.
export type ObstacleVariantId =
  | 'cube'
  | 'pillar'
  | 'cylinder'
  | 'sphere'
  | 'trapezoid-prism'
  | 'wide-bar';
```

## Entities

### ObstacleVariant

Catalogue entry describing one 3D primitive. Pure metadata; no geometry references.

| Field         | Type                | Rules / Notes                                                                 |
|---------------|---------------------|--------------------------------------------------------------------------------|
| `id`          | `ObstacleVariantId` | Stable identifier; used by the renderer to look up the matching mesh factory. |
| `laneCount`   | `1 \| 2`            | Number of lanes this variant occupies. Spawn generator never places a `laneCount: 2` variant in a single-lane group, and vice versa. |

The catalogue is a flat const map: `ObstacleVariantId` → `ObstacleVariant`. Defined in `src/obstacles/obstacle-catalogue.ts`.

### ObstacleGroup

A single obstacle placement on the track. Pure data; the renderer maps id+lanes → mesh.

| Field             | Type                          | Rules / Notes                                                                     |
|-------------------|-------------------------------|------------------------------------------------------------------------------------|
| `id`              | `number`                      | Monotonically-increasing run-local id (for debug logs / equality checks).         |
| `variant`         | `ObstacleVariantId`           | Selects which mesh the renderer draws.                                            |
| `blockedLanes`    | `readonly Lane[]`             | 1 or 2 entries. Never 0, never 3. Two-lane masks MUST be adjacent (no `['left', 'right']` skipping the centre). |
| `worldZ`          | `number`                      | Position along the track in world units. Decreases (moves toward camera) each frame as the world scrolls. Starts at the spawn z and crosses 0 when the obstacle is at the player. |

**Invariants** (each is a unit-test assertion):

- `blockedLanes.length` ∈ {1, 2}.
- If `blockedLanes.length === 2`, then `blockedLanes` is one of `['left', 'centre']` or `['centre', 'right']`. Never `['left', 'right']`.
- The `variant` field's `laneCount` matches `blockedLanes.length`. A `laneCount: 2` variant (`wide-bar`) is only used with a 2-lane mask, and vice versa.

### ObstacleSpawnSchedule

State held by the game-loop to drive the spawn generator. Resets to initial on each new run.

| Field             | Type     | Rules / Notes                                                                |
|-------------------|----------|-------------------------------------------------------------------------------|
| `nextSpawnZ`      | `number` | World z at which the next obstacle group should be spawned. Initial: a value far ahead of the player at run start (~ -34 in world coords, given player at z=0 and camera at z=6, so the player sees ~ -200 to z=14). |
| `seed`            | `number` | Current state of the seeded RNG (`mulberry32`). Advances on every random draw. |
| `lastSpawnedId`   | `number` | Monotonic id for the next-spawned group; assigned then incremented.            |

## State machine: Run lifecycle

`RunState` transitions for this slice:

| From state         | Event                          | New state          | Side effect                                                  |
|--------------------|--------------------------------|--------------------|--------------------------------------------------------------|
| `'running'`        | collision detected             | `'game-over'`      | freeze world; show game-over overlay; await restart input    |
| `'game-over'`      | restart input received         | `'running'`        | reset score / timer / player / obstacle pool; respawn schedule from fresh seed |

The pre-existing transitions (`'pre-run' → 'running'`, `'running' ↔ 'paused'`) are unchanged.

## Effective-lane derivation (collision input)

```text
effectiveLane(player) =
  player.targetLane === null
    ? player.currentLane
    : player.animProgress < 0.5
      ? player.currentLane
      : player.targetLane
```

Pure function of `(currentLane, targetLane, animProgress)`. Lives in `src/obstacles/obstacle-collision.ts`. Unit-tested at the 0.5 boundary on both sides.

## Collision check (high level)

```text
collidesAt(player, group) =
  group.worldZ has just crossed 0 (the player's z)
  AND
  group.blockedLanes contains effectiveLane(player)
```

A group "just crossed 0" means: this frame's z is ≤ 0 AND the previous frame's z was > 0. (Equivalently: the obstacle entered the collision band this frame.)

This is a simple lane-equality test - no bounding-box math.

## Run reset (on restart)

`restartRun(world)` returns:

```ts
{
  runState: 'running',
  speedUnitsPerSec: world.speedUnitsPerSec,   // unchanged
  distanceUnits: 0,
  tickMs: 0,
}
```

The game-loop, after calling `restartRun`, also:

- Recreates `player` via `createPlayerState()`.
- Resets `obstacles: ObstacleGroup[] = []`.
- Resets `spawnSchedule` to its initial state with a fresh seed (`performance.now() ^ 0x9e3779b9`).
- Hides the game-over overlay.
- Resets the trail buffer.

Score and timer derive from `tickMs`, so they snap back to `0` automatically once `tickMs === 0`.
