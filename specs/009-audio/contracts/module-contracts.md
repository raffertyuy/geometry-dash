# Module Contracts: Audio

**Slice**: 009-audio · **Date**: 2026-05-17

---

## 1. NEW: `src/audio/audio-engine.ts`

```ts
export interface AudioEngine {
  /**
   * Fire-and-forget SFX trigger. No-ops silently when:
   *   - The gesture latch hasn't opened yet (first user gesture pending).
   *   - The browser refused to create an AudioContext.
   * Never throws.
   */
  play(name: SfxName): void;

  /** Begin BGM playback on the given track. Idempotent — calling while already playing the same track is a no-op. */
  startBgm(track?: BgmTrack): void;

  /** Switch the active BGM track. Stops the current source and starts the requested source from its loop beginning. No-op if already playing the requested track. */
  setBgmTrack(track: BgmTrack): void;

  /** Suspend the audio context so BGM (and any decaying SFX tails) freeze. */
  pauseBgm(): void;

  /** Resume the audio context — same track that was active at pause. */
  resumeBgm(): void;

  /** Stop BGM and dispose the source so a fresh run starts the default track at 0. */
  stopBgm(): void;

  /** Toggle / set master mute. Mute is a master-gain switch — BGM keeps running underneath. */
  setMuted(muted: boolean): void;
  isMuted(): boolean;

  /** Remove window-level latch listeners; only relevant on full game-loop teardown. */
  destroy(): void;
}

export function createAudioEngine(): AudioEngine;
```

**Behaviour**:

- Construction registers a one-time `pointerdown` + `keydown` listener on the window with capture phase. On the first event:
  1. Create `new AudioContext()`.
  2. Set up master gain at `AUDIO_MASTER_BASE_VOLUME` (or 0 if currently muted).
  3. Kick off `fetch` + `decodeAudioData` for BOTH `bgm-default.opus` and `bgm-contest.opus` in parallel. Store the resulting buffers in `bgmBuffers`.
  4. Emit `audio_unlocked`. Remove the latch listeners.
- `play(name)`: if the context is live, invoke the synth function from `sfx-synth.ts`, route through master gain to destination, and let the GC clean up.
- `startBgm(track = 'default')`: if not already running, create a new `AudioBufferSourceNode` from `bgmBuffers[track]` with `loop = true`, route through master gain, call `.start(0)`. Set `activeTrack = track`. Idempotent when called with the currently-active track.
- `setBgmTrack(track)`: if `activeTrack === track`, no-op. Otherwise stop the current source (if any), then `startBgm(track)`. Emit `audio_bgm_track_changed`.
- `pauseBgm()` / `resumeBgm()`: call `ctx.suspend()` / `ctx.resume()`. Freezes ALL audio including any decaying SFX, which is correct for a pause. `activeTrack` is preserved.
- `stopBgm()`: if running, `bgmSource.stop()` + dispose + null out. Set `activeTrack = null`. Emit `audio_bgm_stopped`. The next `startBgm()` creates a fresh source.
- `setMuted(true)`: `masterGain.gain.setValueAtTime(0, ctx.currentTime)`. `setMuted(false)`: restore to `baseVolume`. Both emit `audio_mute_toggled`.
- All operations are exception-safe: if `ctx` is `null` or any Web Audio call throws, log `audio_context_unavailable` once and become a permanent no-op.

---

## 2. NEW: `src/audio/sfx-synth.ts`

```ts
export interface SfxPlayback {
  readonly source: AudioScheduledSourceNode | AudioScheduledSourceNode[];
  readonly durationMs: number;
}

export function playSfx(
  ctx: AudioContext,
  destination: AudioNode,
  name: SfxName,
): SfxPlayback;
```

Pure function. For each `name`, constructs the required oscillators + envelopes per the recipes in [research.md §R1](./research.md), connects them through `destination` (the engine's master gain), schedules start + stop times relative to `ctx.currentTime`, and returns the playback handle. The engine doesn't need to track the handle — Web Audio cleans up nodes once they've stopped.

---

## 3. NEW: `src/audio/index.ts`

```ts
export { createAudioEngine, type AudioEngine, type BgmTrack } from './audio-engine';
export type { SfxName } from './sfx-synth';
```

---

## 4. NEW: `src/renderer/mute-button.ts`

```ts
export interface MuteButton {
  setMuted(muted: boolean): void;
  destroy(): void;
}

export function createMuteButton(
  host: HTMLButtonElement,
  onToggle: () => void,
): MuteButton;
```

**Behaviour**: similar shape to `pause-button.ts`. `setMuted(true)` updates the icon to 🔇 and sets `aria-pressed="true"`; `setMuted(false)` updates to 🔊 and `aria-pressed="false"`. Click listener fires `onToggle` once per click. No internal state derivation — game-loop pushes `setMuted(audioEngine.isMuted())` once per frame (cheap).

---

## 5. MODIFIED: `src/input-adapter/input-adapter.ts`

The `createInputAdapter` factory's options gain an optional `onLaneChangeAttempt?: (direction: Direction) => void` callback. The adapter calls this callback only on the same code path where it currently calls `emit(InputEvent)` — i.e., on inputs that result in a real lane change. The new callback is invoked AFTER `emit` so the audio fires once the game has committed to the move.

---

## 6. MODIFIED: `src/renderer/problem-modal.ts`

`createProblemModal` gains a new optional second parameter:

```ts
export function createProblemModal(
  host: HTMLElement,
  audio?: { onCountdownTick: () => void },
): ProblemModal;
```

Inside `refreshQuestionCountdownDisplay`, when `remainingMs ≤ QUESTION_TIMER_URGENCY_MS && remainingMs > 0` and the displayed-seconds value JUST changed (i.e., the same condition that updates `lastDisplayedSeconds`), call `audio?.onCountdownTick()` exactly once.

The existing `getDebugSnapshot` / no-tick-after-stop semantics are unchanged.

---

## 7. MODIFIED: `src/game/game-loop.ts`

Construction now creates `const audioEngine: AudioEngine = createAudioEngine()`. Each event point gains one new `audioEngine.play(...)` call:

- `beginRun()` / `restartFromInput()`: `audioEngine.startBgm('default')` after the world transitions to running.
- `pauseFromBlur()` / `onPauseButtonPressed()`: `audioEngine.pauseBgm()` (these are non-gate pauses; BGM is suspended).
- `resumeFromInput()` / `resumeFromPauseButton()`: `audioEngine.resumeBgm()`.
- On `problemModal.show(...)`: `audioEngine.setBgmTrack('contest')` (track-swap, NOT a pause).
- On `problemModal.hide()`: `audioEngine.setBgmTrack('default')`.
- `triggerGameOver()`: `audioEngine.stopBgm()` and `audioEngine.play('game-over')`.
- The `applyAnswerToWorld(...)` callback in `showProblemModal`: `audioEngine.play(isCorrect ? 'correct-answer' : 'life-lost')`.
- The obstacle-collision block: `audioEngine.play('obstacle-hit')` immediately before `consumeLife`; `audioEngine.play('life-lost')` after if `runState !== 'game-over'` (skip the duplicate when game-over fires; the game-over sound is enough).
- The gate-collision block (inside the loop before `triggerGameOver` is reachable): `audioEngine.play('gate-hit')` BEFORE the modal opens.

`createInputAdapter` is now constructed with the `onLaneChangeAttempt` callback wired to `audioEngine.play('lane-change')`.

`createProblemModal` is now constructed with `{ onCountdownTick: () => audioEngine.play('countdown-tick') }`.

`GameLoopHostElements` gains `muteButton: HTMLButtonElement`. The mute button is constructed in game-loop and pushes its state once per frame.

`onKeyDown` gains one new branch BEFORE any other handling: if the key is `'m'` or `'M'`, toggle mute and return. (This works in any loop state — start screen, running, paused, game-over — matching FR-007.)

`dispose()` calls `audioEngine.destroy()`.

---

## 8. MODIFIED: `src/main.ts`

Add `const muteButton = document.querySelector<HTMLButtonElement>('#mute-button')` and include it in the `GameLoopHostElements` payload.

---

## 9. MODIFIED: `index.html`

Add a new HUD button: `<button id="mute-button" class="mute-button" type="button" aria-label="Mute audio" aria-pressed="false">🔊</button>`. Position it in the HUD near the existing lives / score / timer block.

Add CSS for the mute button (positioning + click cursor + aria-pressed styling).

---

## 10. NEW: `public/audio/bgm-default.opus` and `public/audio/bgm-contest.opus` (assets)

Two ≤ 500 KB Opus-encoded loopable tracks. The default is a calm tron-ambient piece; the contest track is a tense math-contest / battle-of-the-brains style theme. Sourcing rule per [research.md §R2](./research.md). Until real tracks are sourced, an implementer may commit placeholders generated by `ffmpeg` (different timbres so the swap is audible) and replace them later — the engine doesn't care about content.

---

## 11. MODIFIED: `LICENSES.md`

If the BGM is CC-BY (not CC0), append a new attribution section with title, author, source URL, and licence. CC0 BGM requires no attribution but a courtesy note is welcome.

---

## 12. Out of scope (explicitly)

- No per-channel volume sliders (BGM vs. SFX). One master mute only.
- No mute persistence across reloads (FR-008).
- No per-difficulty BGM tracks.
- No procedural BGM (research R2 punted to a future slice).
- No spatial audio / panning.
- No audio-only accessibility cues — visual cues remain authoritative.
