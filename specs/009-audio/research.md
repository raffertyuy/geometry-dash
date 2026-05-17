# Research: Audio (Background Music + Sound Effects)

**Slice**: 009-audio · **Date**: 2026-05-17

Captures the Phase 0 decisions resolving every architectural question in [plan.md](./plan.md). The spec emitted zero `[NEEDS CLARIFICATION]` markers; research is concentrated on tech choices.

---

## R1. Procedural SFX via Web Audio oscillators (NOT sourced files)

**Decision**: All six SFX (lane change, obstacle hit, gate hit, correct answer, life lost, game over) + the countdown tick are generated procedurally at fire-time using `OscillatorNode` + `GainNode` envelopes. No SFX asset files exist in the repo.

**Rationale**:

- **Bundle size**: zero bytes added for SFX. The remaining 5 MB asset budget is reserved entirely for BGM (≤ 500 KB) with comfortable headroom for a future second BGM track or per-difficulty stings.
- **Licensing**: no CC-BY attribution work, no curation, no risk of accidentally shipping an incorrectly licensed file. This matches the project's hard-won discipline around problem-text attribution.
- **Aesthetic fit**: the game's visual identity is tron-style synth wireframes. Square-wave / triangle-wave / FM oscillator sounds are *the* canonical synth language for this look. Sourced "thud" / "chime" files would tend toward Foley realism that fights the aesthetic.
- **Per-SFX cost**: ~10 lines of code per synth function. Six functions = ~60 LOC. Compare to a 1.5 MB SFX bundle for sourced equivalents.
- **Testability**: each synth function is pure — given an AudioContext and a `currentTime`, it produces a `{ source, gain, durationMs }` shape. Tests assert the shape, not the audio.

**Specific synth recipes**:

- **lane-change**: 80 ms triangle-wave blip, 800 Hz → 1200 Hz frequency ramp, exponential gain decay.
- **obstacle-hit**: 250 ms square-wave thump, 120 Hz → 60 Hz pitch drop, fast attack + slow decay.
- **gate-hit**: 200 ms two-oscillator chime (sine 880 + sine 1320, slight detune), bell-like envelope.
- **correct-answer**: 400 ms ascending arpeggio (sine 523 → 659 → 784 — C5 E5 G5 major triad), each ~120 ms.
- **life-lost**: 350 ms descending sine, 660 Hz → 220 Hz, hint of sawtooth blend for texture.
- **game-over**: 1.2 s descending minor third arpeggio (E5 → C5 → A4 → F4), each note ~250 ms with reverb-like tail via gain envelope.
- **countdown-tick**: 40 ms short sine 1500 Hz, sharp attack + decay.

**Alternatives considered**:

- *Sourced CC0 SFX from freesound.org or zapsplat*: ~1–2 MB for six sounds, plus per-file attribution lines in LICENSES.md, plus curation effort. Rejected on bundle / licensing / aesthetic grounds.
- *Tone.js or Howler.js library*: would simplify the API but adds a runtime dependency (Tone.js is ~50 KB gzipped). Web Audio's built-in primitives are sufficient. Rejected on Principle I.

---

## R2. BGM as two small sourced files (default + contest)

**Decision**: Two looping BGM tracks sourced from a CC0 or CC-BY library (likely freesound.org, OpenGameArt.org, or a music subreddit's CC0 weekly post), encoded as Opus or AAC at ~96 kbps, ≤ 500 KB each, ~30–45 seconds loop length. Files live at `public/audio/bgm-default.opus` (calm tron ambient, plays while running) and `public/audio/bgm-contest.opus` (math-contest / battle-of-the-brains style, plays while a problem-gate modal is open).

Track switching: hard-cut — stop the current source, start the requested source. No crossfading. Position is NOT preserved across the swap (per spec FR-001b).

**Rationale**:

- Procedural BGM (multi-track sequenced synthesis) is an entire side-project on its own. Out of scope for this slice.
- One file under the constitution's 500 KB budget is straightforward.
- Opus is supported in every evergreen browser; AAC is the universal fallback if a specific browser has trouble. Plan picks Opus first; manual smoke verifies cross-browser playback.
- Looping is handled by setting `AudioBufferSourceNode.loop = true` after `decodeAudioData`.

**Sourcing rule** (for the implementer):

- Tracks MUST be CC0 OR CC-BY 4.0.
- Tracks MUST be downloadable as original files (not re-encoded previews).
- Attribution (if CC-BY) goes into `LICENSES.md` alongside the existing problem-source attributions.
- The default track should be calm / atmospheric — think tron-arcade ambient with a slow synth pad and gentle pulse.
- The contest track should be tense — think quiz-show / brain-battle: ticking percussion, brisk arpeggio, a "thinking under pressure" vibe. Genuine "Are You Smarter Than a 5th Grader" / "Battle of the Brains" themes are NOT public-domain; the implementer must source a CC0/CC-BY alternative that *evokes* the genre rather than copy any branded piece.
- If implementing under time pressure and no real tracks are at hand, both files may be placeholder synth loops generated via `ffmpeg` (different timbres so the swap is audible); real CC0 tracks can replace them later without API changes.

**Alternatives considered**:

- *Procedural BGM via tone-sequencer code*: would be very cool and would push the asset budget to 0 bytes total. Rejected for this slice — would dominate the implementation. Tracked as a possible future slice.
- *Multiple BGM tracks per difficulty tier*: speculative complexity (Principle I). One track is enough for an endless runner of this scope.

---

## R3. Gesture-latch unlock pattern

**Decision**: The audio engine's constructor does NOT create the AudioContext. Instead, it registers a one-time `pointerdown` + `keydown` listener on the window. On the first event, the engine creates `new AudioContext()`, fetches + decodes the BGM file, sets the master gain to its initial value, removes the latch listener, and emits `audio_unlocked`.

**Rationale**:

- Mobile Safari and most desktop browsers reject `AudioContext` operations outside a user-gesture handler. Creating the context lazily ON the gesture is the canonical workaround.
- The first gesture is ALWAYS the "press anything to start" that begins the run, so this is invisible to the user — by the time they've started the run, audio is unlocked.
- Pre-decoded BGM means the BGM-start call (on `loopState → running`) is instant.

**Alternatives considered**:

- *Create the AudioContext eagerly and call `.resume()` on first gesture*: works on most browsers but mobile Safari is finicky. The lazy-creation pattern is more bulletproof.
- *A "click to enable audio" prompt*: user-hostile and unnecessary for this game (the first click already starts the run).

---

## R4. Mute as master-gain switch, NOT a stop

**Decision**: The audio engine maintains a `masterGain: GainNode` between every source and the destination. Mute sets `masterGain.gain.value = 0`; un-mute sets it back to the configured base value (e.g., 0.7). The BGM source continues playing under the zero gain.

**Rationale**:

- Un-muting from a stopped state would require another user gesture on some browsers — bad UX. With this pattern, un-mute is silent (no gesture needed).
- The cost of running an inaudible BGM source is negligible.
- Mute toggle latency is essentially instant (a `setValueAtTime` call).

**Alternatives considered**:

- *Stop BGM on mute, restart on un-mute*: would lose playback position and require a gesture. Rejected.
- *Two-layer gain (master + per-SFX)*: useful for per-channel volume sliders, which are out of scope here. Punt.

---

## R5. Lane-change SFX wiring via the input adapter's emit callback

**Decision**: The `input-adapter` module's `emit` callback (already used by `game-loop` to update the player state) gains an optional `onLaneChangeAttempt(direction)` callback that fires **only when the adapter accepts the input** (i.e., direction was valid AND a lane change actually started). The audio engine subscribes via this callback.

**Rationale**:

- The input adapter is the single source of truth for "a lane change actually happened". Listening at the keydown level would fire on key repeat and on walled directions.
- The callback is opt-in (optional parameter), so existing callers are not affected.

**Alternatives considered**:

- *Listen on `applyInput` in `lane-state`*: works but reaches into the wrong module. The input adapter is already the orchestrator.
- *Subscribe to a hypothetical event bus*: no event bus exists in the project; introducing one for one consumer is over-engineering (Principle I).

---

## R6. Countdown-tick wiring inside `problem-modal.ts`

**Decision**: The existing `refreshQuestionCountdownDisplay()` function (from slice 007) already detects whole-second-boundary transitions for the textContent rewrite. It gains a parallel side-effect: on every second-transition where `remainingMs ≤ QUESTION_TIMER_URGENCY_MS` AND `> 0`, call `audioEngine.play('countdown-tick')`.

**Rationale**:

- The "did the second change" check is already implemented for the visible-text update — re-using it costs nothing.
- The condition `≤ URGENCY_MS && > 0` matches the visible urgency band exactly, so audio and visual cues are synchronised.

**Alternatives considered**:

- *A separate `setInterval(tick, 1000)` keyed off `startQuestionTimer`*: would drift over time, would need its own pause integration. The boundary-detect-in-refresh approach is precise and free.

---

## R7. Pause coupling — engine subscribes to game-loop, not the other way around

**Decision**: The game-loop calls `audioEngine.pauseBgm()` / `resumeBgm()` whenever it transitions `loopState` between `'running'` and `'paused'` (or when problem-modal opens / closes). The engine has no awareness of game state; it just turns BGM on / off when told.

**Rationale**:

- Game-loop already controls every pause source (Pause button, problem modal, blur). Adding a single `audioEngine.pauseBgm()` call at each transition is trivial.
- The engine remains pure and reusable; testing it doesn't require a game-loop.

**Alternatives considered**:

- *Engine subscribes to a hypothetical world-state observable*: no such observable exists. Rejected.

---

## R8. Bundle-size impact

**Decision**: Budget breakdown:

- New `src/audio/` source code: ~250 LOC (engine 120, synth 80, tests 50). Estimated +2 KB gzipped JS.
- New `src/renderer/mute-button.ts`: ~50 LOC. +0.5 KB gzipped.
- BGM file: ≤ 500 KB. Lazy-loaded — does not affect initial bundle size.
- CSS for mute button: ~15 lines. Negligible.

**Initial JS bundle delta**: ~3 KB gzipped. Well under any concern threshold.

**Asset weight**: BGM is the only audio asset, ≤ 500 KB. Total asset budget 5 MB; comfortable.

---

## R9. Test strategy for an untestable subsystem

**Decision**: We test the **state machine** of the engine (mute toggle, gesture latch, pause / resume gating, mute-during-BGM behaviour), the **integration points** (each event handler in game-loop / problem-modal calls the right `play(name)`), and the **synth-function shape** (each procedural-SFX function returns valid Web Audio nodes given a stub context). We do NOT test that audio is actually produced.

Tests run against a stubbed `AudioContext` in `audio-engine.test.ts`:

```ts
function makeStubContext(): { ctx: StubAudioContext; events: string[] } {
  const events: string[] = [];
  const ctx = {
    createGain: () => ({ gain: { value: 1, setValueAtTime: () => events.push('gain-set') }, connect: () => undefined }),
    createOscillator: () => ({ frequency: { value: 0, setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined }, type: 'sine' as OscillatorType, connect: () => undefined, start: () => events.push('osc-start'), stop: () => events.push('osc-stop') }),
    createBufferSource: () => ({ buffer: null, loop: false, connect: () => undefined, start: () => events.push('bgm-start'), stop: () => events.push('bgm-stop') }),
    decodeAudioData: () => Promise.resolve({} as AudioBuffer),
    destination: {},
    currentTime: 0,
    state: 'running' as AudioContextState,
    resume: () => Promise.resolve(),
  };
  return { ctx, events };
}
```

We do NOT subclass / construct `AudioContext` in tests — jsdom doesn't provide it. The engine's public surface accepts an `AudioContext`-shaped factory and tests inject the stub.

**Alternatives considered**:

- *Use a real headless browser for audio tests*: Playwright with a fixture page. Overkill for this slice; manual smoke covers it.
