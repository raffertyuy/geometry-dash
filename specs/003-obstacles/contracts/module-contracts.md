# Module Contracts: Random Geometric Obstacles (Phase 1)

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-05-16

This slice adds **one new pure-logic module** (`src/obstacles/`) and **one new DOM overlay** (`#game-over-overlay`). It extends two existing modules (`src/runner-engine/` and `src/game/game-loop.ts`) and the renderer (`src/renderer/three-renderer.ts`).

Module dependency direction (after this slice):

```
game/    ──┐
           ├──► renderer/ ──► shared/
main.ts ──┘
           │
           ├──► runner-engine/ ─┐
           ├──► lane-state/ ────┤
           ├──► input-adapter/ ─┤─► shared/
           ├──► score/ ─────────┤
           └──► obstacles/ ─────┘
```

The `obstacles/` module sits at the same layer as the other pure-logic modules. ESLint boundary: `obstacles/` is a pure-logic module - **MUST NOT** import `three`, `three/*`, or any DOM types. The existing `no-restricted-imports` rule already forbids this; no rule change needed.

---

## `obstacles/` - spawn + collision + variant catalogue

```ts
// obstacles/index.ts
export { OBSTACLE_VARIANTS } from './obstacle-catalogue';
export type { ObstacleVariant } from './obstacle-catalogue';
export {
  createSpawnSchedule,
  nextObstacleGroup,
  type ObstacleSpawnSchedule,
} from './obstacle-spawn';
export {
  collidesAt,
  effectiveLane,
} from './obstacle-collision';
```

### Catalogue (`obstacle-catalogue.ts`)

```ts
import type { ObstacleVariantId } from '../shared/types';

export interface ObstacleVariant {
  readonly id: ObstacleVariantId;
  readonly laneCount: 1 | 2;
}

export const OBSTACLE_VARIANTS: Readonly<Record<ObstacleVariantId, ObstacleVariant>>;
//   'cube'            -> { id: 'cube',             laneCount: 1 }
//   'pillar'          -> { id: 'pillar',           laneCount: 1 }
//   'cylinder'        -> { id: 'cylinder',         laneCount: 1 }
//   'sphere'          -> { id: 'sphere',           laneCount: 1 }
//   'trapezoid-prism' -> { id: 'trapezoid-prism',  laneCount: 1 }
//   'wide-bar'        -> { id: 'wide-bar',         laneCount: 2 }
```

### Spawn generator (`obstacle-spawn.ts`)

```ts
import type { ObstacleGroup } from '../shared/types';

export interface ObstacleSpawnSchedule {
  readonly nextSpawnZ: number;
  readonly seed: number;
  readonly lastSpawnedId: number;
}

export function createSpawnSchedule(initialSeed: number): ObstacleSpawnSchedule;

export function nextObstacleGroup(
  schedule: ObstacleSpawnSchedule,
): { group: ObstacleGroup; schedule: ObstacleSpawnSchedule };
```

**Behaviour**:

- `createSpawnSchedule(seed)` returns the initial schedule with `nextSpawnZ` set to `OBSTACLES_INITIAL_SPAWN_Z` (a constant in `shared/config.ts`, default `-34`).
- `nextObstacleGroup(schedule)`:
  1. Generates a `gap` in `[OBSTACLES_MIN_GAP, OBSTACLES_MAX_GAP]` using the seeded RNG.
  2. Decides `laneCount` (1 or 2) with a configurable probability (default 80 % single-lane).
  3. Picks blocked lane(s) randomly:
     - `laneCount === 1`: one of `['left', 'centre', 'right']` uniformly.
     - `laneCount === 2`: one of `[['left', 'centre'], ['centre', 'right']]` uniformly.
  4. Picks a variant matching `laneCount` from the catalogue uniformly.
  5. Returns `{ group: ObstacleGroup, schedule: ObstacleSpawnSchedule }` - the new group with `worldZ = schedule.nextSpawnZ - gap` (further ahead) and an advanced schedule with the next `nextSpawnZ`, `seed`, and `lastSpawnedId`.

**Unit-test obligations** (Constitution II):

- Given a fixed seed, two `nextObstacleGroup` calls return identical groups.
- Gap is always in `[MIN_GAP, MAX_GAP]`, asserted over 1000 draws.
- `blockedLanes.length` is always 1 or 2, never 0 or 3, over 1000 draws.
- Two-lane masks are always adjacent: `['left', 'centre']` or `['centre', 'right']`. Never `['left', 'right']`.
- Variant's `laneCount` matches `blockedLanes.length`.

### Collision predicate (`obstacle-collision.ts`)

```ts
import type { Lane, ObstacleGroup, PlayerState } from '../shared/types';

export function effectiveLane(player: PlayerState): Lane;

export function collidesAt(
  player: PlayerState,
  group: ObstacleGroup,
  previousGroupZ: number,
): boolean;
```

**Behaviour**:

- `effectiveLane(player)`: returns `player.targetLane !== null && player.animProgress >= 0.5 ? player.targetLane : player.currentLane`.
- `collidesAt(player, group, previousGroupZ)`: returns `true` iff:
  - `group.worldZ <= 0 && previousGroupZ > 0` (the group crossed the player this frame), AND
  - `group.blockedLanes.includes(effectiveLane(player))`.

**Unit-test obligations**:

- Player in lane `'centre'`, group blocks `['left']`, group at z=0, previous z=0.5 → `false`.
- Player in lane `'centre'`, group blocks `['centre']`, group at z=0, previous z=0.5 → `true`.
- Player mid-animation centre→right, animProgress=0.4, group blocks `['centre']` → collides (still in centre).
- Player mid-animation centre→right, animProgress=0.5, group blocks `['centre']` → does NOT collide (target is right).
- Player mid-animation centre→right, animProgress=0.5, group blocks `['right']` → collides (target is right).
- Group hasn't crossed yet (worldZ=0.1, prev=0.5): no collision regardless of lane.

---

## `runner-engine/` - extended

```ts
// New function additions (exports added to index.ts):
export function endRun(world: WorldState): WorldState;
export function restartRun(world: WorldState): WorldState;
```

**Behaviour**:

- `endRun(world)`: returns `{ ...world, runState: 'game-over' }` if `runState === 'running'`; otherwise returns `world` unchanged. Emits `console.debug({ event: 'run_ended', tickMs, distanceUnits })`.
- `restartRun(world)`: returns a fresh `WorldState` with `runState: 'running'`, `tickMs: 0`, `distanceUnits: 0`. Preserves `speedUnitsPerSec`. Emits `console.debug({ event: 'run_restarted' })`.

`tickWorld` is unchanged - its existing `runState === 'running'` guard already short-circuits on `'game-over'`.

**Unit-test obligations**:

- `endRun` flips `running` → `game-over` once; further `endRun` calls are no-ops.
- `endRun` from `'paused'` returns input unchanged (only `'running'` can be ended this slice).
- `restartRun` from `'game-over'` returns `runState: 'running', tickMs: 0, distanceUnits: 0`.
- `tickWorld(world, 1000)` while `runState === 'game-over'` does NOT advance `tickMs` or `distanceUnits`.

---

## `game/game-loop.ts` - extended

The `GameLoopHostElements` interface gains one field:

```ts
export interface GameLoopHostElements {
  readonly canvas: HTMLCanvasElement;
  readonly startScreen: HTMLElement;
  readonly pauseOverlay: HTMLElement;
  readonly debugOverlay: HTMLElement;
  readonly score: HTMLElement;
  readonly timer: HTMLElement;
  readonly gameOverOverlay: HTMLElement;   // NEW
  readonly gameOverScore: HTMLElement;     // NEW - child of gameOverOverlay; final score
  readonly gameOverTimer: HTMLElement;     // NEW - child of gameOverOverlay; final time
}
```

Internal state added:

```ts
let obstacles: ObstacleGroup[] = [];
let spawnSchedule: ObstacleSpawnSchedule = createSpawnSchedule(performance.now() ^ 0x9e3779b9);
let isAwaitingRestart = false;
```

Per-frame logic (added inside the rAF loop, in the `'running'` branch):

1. Advance `obstacles[i].worldZ += distanceDelta` for all active groups.
2. If the closest unpassed group has `worldZ <= 0` and the previous frame's z was > 0:
   - Run `collidesAt(player, group, previousZ)`.
   - If true: call `world = endRun(world)`, show the game-over overlay, set `isAwaitingRestart = true`.
3. If `spawnSchedule.nextSpawnZ - distanceTravelled > some threshold`, call `nextObstacleGroup(spawnSchedule)` and push the new group.
4. Cull obstacles with `worldZ > TRACK_NEAR_Z + 10` (past camera).
5. Call `renderer.updateObstacles(obstacles)`.

Input handling additions:

- When `isAwaitingRestart === true` and an input event arrives: call `restartRun(world)`, reset `obstacles`, `spawnSchedule`, hide the game-over overlay, clear `isAwaitingRestart`, return early (don't forward the input to the input-adapter).

---

## `renderer/three-renderer.ts` - extended

New public method:

```ts
export interface ThreeRenderer {
  draw(player: PlayerState, world: WorldState): void;
  resize(widthPx: number, heightPx: number): void;
  destroy(): void;
  updateObstacles(groups: readonly ObstacleGroup[]): void;   // NEW
}
```

`updateObstacles(groups)` walks the pool, assigning visible/positioned meshes for each group from the pool and hiding the rest.

**Rules**:

- Each variant has its own pre-allocated pool of 12 meshes.
- The pool meshes use emissive materials at intensity 0.6-0.8 (lower than the runner's 0.85-1.1 so the runner stays the brightest object on screen).
- The `wide-bar` variant geometry spans exactly two adjacent lane centres: width = `LANE_X.right - LANE_X.left = 4` units; positioned at `x = (LANE_X[leftLane] + LANE_X[rightLane]) / 2` for the two blocked lanes.
- Single-lane variants are positioned at `x = LANE_X[blockedLane]`.
- Y position: half the variant's bounding-box height, so each obstacle sits on the ground.

---

## DOM contract (added to `index.html`)

```html
<div id="game-over-overlay" class="overlay hidden">
  <h1>Game Over</h1>
  <p class="hud-label">Score</p>
  <p class="game-over-stat" id="game-over-score">0</p>
  <p class="hud-label">Time</p>
  <p class="game-over-stat" id="game-over-timer">0:00</p>
  <p class="hint">Tap or press any key to play again</p>
</div>
```

**Rules**:

- `.overlay.hidden` reuses the existing class system from the start screen and pause overlay.
- `#game-over-score` and `#game-over-timer` are updated via `textContent` from `game-loop.ts` at the moment of `endRun`.
- The overlay's CSS lives in the same `<style>` block as the existing overlays. Pointer-events on the backing div: `none` (so taps pass through to the canvas → input listener); on the content (`h1`, `p`) implicit `auto` is fine but the visible content does not itself listen to clicks (the input is captured at the window level).
