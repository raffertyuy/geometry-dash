# Data Model: How-to-Play Modal & In-Game Pause

**Slice**: 008-how-to-play · **Date**: 2026-05-17

Pure UI feature — no persisted entities, no schema migration. The "data model" is the small set of in-memory shapes the modal and button use.

---

## 1. `HowToPlayMode` (internal, not exported)

```ts
type HowToPlayMode = 'entry' | 'pause';
```

- `'entry'` — opened from the start screen or game-over screen. Dismissal hides the modal; no run to resume.
- `'pause'` — opened by the in-game Pause button (or ESC / SPACE during a run). Dismissal calls `onResume()` so the game-loop can transition `'paused' → 'running'` and re-show the canvas frame loop.

Lives in closure scope inside `createHowToPlayModal`. Set on every `show(mode)` call. Read once on every dismissal.

---

## 2. `PauseButtonState` (derived per frame; not stored)

```text
visible = (game-loop's loopState === 'running')
enabled = visible
        && world.runState === 'running'
        && world.invincibilityRemainingMs === 0
        && world.runState !== 'answering'   // (subsumed by line above; explicit for the spec)
        && !howToPlayModal.isVisible()
```

The Pause button has only two display variants: enabled and disabled. Hidden = not rendered (controlled by `visible`). The button's own internal state machine is exactly this derivation; there is no event-driven "pressed" state stored — clicks are dispatched immediately to a callback.

---

## 3. Section content (static; constants)

The three section headings and the per-difficulty row contents are static strings + a colour drawn from `GATE_CATALOGUE`:

```ts
const SECTION_HEADINGS = ['General Rules', 'Problem Cubes', 'Credits'] as const;

const PROBLEM_CUBE_ROWS: ReadonlyArray<{
  readonly difficulty: GateDifficulty;
  readonly label: string;
  readonly description: string;
  readonly pointsLabel: string;       // e.g. "±1,000"
  readonly countdownLabel: string;    // e.g. "60 s"
}> = [
  { difficulty: 'B', label: 'Basic',    description: '…', pointsLabel: '±1,000',  countdownLabel: '60 s'  },
  { difficulty: 'M', label: 'Medium',   description: '…', pointsLabel: '±5,000',  countdownLabel: '120 s' },
  { difficulty: 'A', label: 'Advanced', description: '…', pointsLabel: '±10,000', countdownLabel: '180 s' },
];
```

The cube swatch colour at render time is `GATE_CATALOGUE[difficulty].colorHex` — i.e., the existing single source of truth.

The General Rules section content is a small static array of `{ heading?: string; body: string }` items defined inside the module — there is no need to elevate them to `shared/config.ts` since they have no other consumer.

The Credits section reuses `PROBLEM_SOURCES` from `src/problems/sources.ts` (the existing single source of truth used by the old credits-panel). No data duplication.

---

## 4. Constants (not added — content is module-local)

This slice intentionally does NOT add new entries to `src/shared/config.ts`. The strings are user-facing copy and live with the module that displays them; the point values and durations are sourced from existing `shared/config.ts` constants (`GATE_POINTS_B/M/A`, `QUESTION_TIMER_MS_B/M/A`).

---

## 5. Debug-event payloads

| Event name | Payload | When |
|------------|---------|------|
| `how_to_play_opened` | `{ event, mode: 'entry' \| 'pause' }` | `show()` runs. |
| `how_to_play_closed` | `{ event, mode, resumed: boolean }` | `close()` runs. `resumed=true` only when `mode === 'pause'` and the `onResume` callback was invoked. |
| `pause_button_pressed` | `{ event, source: 'click' \| 'key', tickMs: number }` | Button click or ESC/SPACE while enabled. |
