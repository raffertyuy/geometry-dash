# Data Model: Audio (Background Music + Sound Effects)

**Slice**: 009-audio · **Date**: 2026-05-17

Pure runtime feature — no persisted data, no schema. The "data model" is the small set of in-memory shapes the engine + mute button use.

---

## 1. `SfxName` (exported from `src/audio/`)

```ts
export type SfxName =
  | 'lane-change'
  | 'obstacle-hit'
  | 'gate-hit'
  | 'correct-answer'
  | 'life-lost'
  | 'game-over'
  | 'countdown-tick';
```

The seven discrete sound events. Each maps to one procedural-synth function in `sfx-synth.ts`. Callers pass the name to `audioEngine.play(name)`.

---

## 2. `BgmTrack` (exported)

```ts
export type BgmTrack = 'default' | 'contest';
```

- `'default'` — the calm tron ambient loop, active during running.
- `'contest'` — the math-contest / battle-of-the-brains loop, active while a problem-gate modal is open.

## 3. `AudioEngineState` (internal to `audio-engine.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `ctx` | `AudioContext \| null` | Created lazily on first user gesture. `null` until then. |
| `masterGain` | `GainNode \| null` | Sits between every source and `ctx.destination`. Mute toggles its value. |
| `bgmSource` | `AudioBufferSourceNode \| null` | The currently-playing BGM source. Replaced (not paused) on each `startBgm` / `setBgmTrack` invocation; pause is implemented via `ctx.suspend()`. |
| `bgmBuffers` | `Readonly<Record<BgmTrack, AudioBuffer \| null>>` | Decoded BGM buffers keyed by track name. |
| `bgmLoadedPromise` | `Promise<void> \| null` | The in-flight decode for either track; subsequent `startBgm` / `setBgmTrack` calls await this. |
| `activeTrack` | `BgmTrack \| null` | The track currently played by `bgmSource`. `null` when BGM is stopped. |
| `muted` | `boolean` | Mute state; initial value `false`. |
| `baseVolume` | `number` | Configured baseline master gain (e.g., 0.7). Mute restores to this on un-mute. |
| `unlocked` | `boolean` | True after the first user gesture has created the context. |

State transitions:

```text
[idle, unlocked=false] ──first user gesture──▶ [unlocked=true, ctx live, BOTH BGM tracks decoding…]

[unlocked, BGM decoded] ──game-loop: run started──▶ [activeTrack='default', playing]
[default playing] ──game-loop: gate modal opens──▶ [activeTrack='contest', playing]
[contest playing] ──game-loop: gate modal closes──▶ [activeTrack='default', playing]
[playing (either)] ──game-loop: non-gate pause──▶ [ctx.suspend(), activeTrack preserved]
[paused] ──game-loop: pause cleared──▶ [ctx.resume(), same activeTrack]
[playing] ──game-loop: game-over──▶ [activeTrack=null, sources disposed]
```

Mute is orthogonal to all of these:

```text
muted=false ⇄ muted=true   (master gain switches 0 ⇄ baseVolume)
```

---

## 3. `MuteButtonState` (derived per HUD update; not stored)

```text
visible = always (the mute button is always reachable, even on start / game-over screens)
muted   = audioEngine.isMuted()
```

The button has two display variants: `un-muted` (🔊 icon, `aria-pressed="false"`) and `muted` (🔇 icon, `aria-pressed="true"`). No "disabled" state — muting is always allowed.

---

## 4. Constants (added to `src/shared/config.ts`)

```ts
// Master baseline volume — un-mute restores to this value. Tuned by ear
// during implementation; SFX peaks must stay within ±6 dB of this (FR-014).
export const AUDIO_MASTER_BASE_VOLUME = 0.7;

// Per-SFX volume floor. Each SFX may scale this further internally to
// keep the mix balanced (e.g., the lane-change blip is quieter than the
// game-over arpeggio).
export const AUDIO_SFX_BASE_VOLUME = 0.35;

// Paths to the BGM files. Served from /public/audio/.
export const AUDIO_BGM_URLS: Readonly<Record<'default' | 'contest', string>> = {
  default: '/audio/bgm-default.opus',
  contest: '/audio/bgm-contest.opus',
};
```

The constants are read by `audio-engine.ts` only; no other module needs them.

---

## 5. Debug-event payloads

| Event name | Payload | When |
|------------|---------|------|
| `audio_unlocked` | `{ event }` | First user gesture creates the context. |
| `audio_bgm_decoded` | `{ event, track, durationSec }` | After `decodeAudioData` resolves for each track. |
| `audio_bgm_started` | `{ event, track }` | `startBgm(track)` actually starts playback. |
| `audio_bgm_track_changed` | `{ event, from, to }` | `setBgmTrack(...)` actually swapped tracks. |
| `audio_bgm_paused` | `{ event, track }` | `pauseBgm()` → `ctx.suspend()`. |
| `audio_bgm_resumed` | `{ event, track }` | `resumeBgm()` → `ctx.resume()`. |
| `audio_bgm_stopped` | `{ event }` | Game-over path. |
| `audio_sfx_played` | `{ event, name }` | One per `play(name)` call (after the gesture latch is open). |
| `audio_sfx_skipped_locked` | `{ event, name }` | One per `play(name)` call before the gesture latch opens (debug-only — silent in production). |
| `audio_mute_toggled` | `{ event, muted }` | `setMuted(...)` actually changed state. |
| `audio_context_unavailable` | `{ event, error }` | Browser refused to create an `AudioContext`; engine degrades silently for the rest of the page lifetime. |
