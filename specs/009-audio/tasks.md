---

description: "Task list for feature 009 — Audio (BGM + SFX + mute toggle)"
---

# Tasks: Audio

**Input**: Design documents from `/specs/009-audio/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/module-contracts.md, quickstart.md

**Tests**: Required for engine state machine, synth function shapes, and mute-button matrix. Audio output itself is not automated (manual smoke covers it).

**Organization**: Grouped by user story. US1 (BGM + dual-track) + US2 (gameplay SFX) + US5 (mute toggle) together form the MVP — without all three, the slice ships an incomplete experience. US3 (countdown tick) and US4 (game-over SFX) are P2 polish on top.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no dependencies on incomplete tasks → parallelizable
- **[Story]**: US1 / US2 / US3 / US4 / US5; foundational and polish tasks have no story label

## Path Conventions

- Single web project (per [plan.md](./plan.md)). Source under `src/`; tests colocated as `*.test.ts`. Assets under `public/audio/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Add a `public/audio/` directory containing two placeholder loop files: `bgm-default.opus` and `bgm-contest.opus`. Until real CC0 / CC-BY tracks are sourced, generate placeholders with `ffmpeg` (different timbres so the dual-track swap is audible during smoke). Each ≤ 500 KB. Commit a `public/audio/README.md` noting "placeholder — replace with real CC0/CC-BY tracks per spec R2 sourcing rule".

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Stand up the engine + synth + types skeleton. After this phase the project still typechecks, but no sound plays anywhere.

- [ ] T002 [P] Add audio constants to `src/shared/config.ts`: `AUDIO_MASTER_BASE_VOLUME = 0.7`, `AUDIO_SFX_BASE_VOLUME = 0.35`, `AUDIO_BGM_URLS = { default: '/audio/bgm-default.opus', contest: '/audio/bgm-contest.opus' }`. See [data-model.md §4](./data-model.md).
- [ ] T003 [P] Create `src/audio/sfx-synth.ts` exporting `SfxName` type + `playSfx(ctx, destination, name)` function with all 7 synth recipes from [research.md §R1](./research.md) (lane-change, obstacle-hit, gate-hit, correct-answer, life-lost, game-over, countdown-tick). Each branch constructs the right oscillators + gain envelope and returns `{ source, durationMs }`. Pure function — no engine state touched.
- [ ] T004 [P] Create `src/audio/audio-engine.ts` per [contracts/module-contracts.md §1](./contracts/module-contracts.md). Export `BgmTrack` type, `AudioEngine` interface, and `createAudioEngine()` factory. Implement: gesture latch (pointerdown + keydown on window, capture phase), lazy `AudioContext` creation, parallel decode of both BGM files, master gain, mute as master-gain switch, `play(name)` delegating to `sfx-synth.playSfx`, `startBgm(track)`, `setBgmTrack(track)`, `pauseBgm`/`resumeBgm` via `ctx.suspend/resume`, `stopBgm`, `setMuted`, `isMuted`, `destroy`. All operations exception-safe — log `audio_context_unavailable` and degrade silently if any Web Audio call throws.
- [ ] T005 [P] Create `src/audio/index.ts` re-exporting `createAudioEngine`, `AudioEngine`, `BgmTrack`, and `SfxName`.

**Checkpoint**: `npm run typecheck` passes. No runtime change yet.

---

## Phase 3: User Story 5 — Mute toggle in the HUD (Priority: P1)

**Goal**: Player can mute / un-mute via a HUD button or the keyboard `M` shortcut. State persists across the session; reload resets to un-muted. **Done before US1 so the audio scaffolding for "mute = master gain to 0" can be exercised before any sound actually plays.**

### Tests for US5

- [ ] T006 [P] [US5] Create `src/audio/audio-engine.test.ts` with a stubbed `AudioContext` factory (per [research.md §R9](./research.md)). Tests:
  - `setMuted(true)` after the gesture latch opens calls `masterGain.gain.setValueAtTime(0, ...)`.
  - `setMuted(false)` restores the master gain to `AUDIO_MASTER_BASE_VOLUME`.
  - `isMuted()` reflects the last `setMuted` call.
  - `setMuted` BEFORE the gesture latch opens does NOT throw; the value is applied when the context unlocks.
  - `audio_mute_toggled` debug events fire with `{ muted }`.
- [ ] T007 [P] [US5] Create `src/renderer/mute-button.test.ts`. State matrix tests:
  - `setMuted(true)` updates `aria-pressed="true"`, swaps icon to 🔇.
  - `setMuted(false)` updates `aria-pressed="false"`, swaps icon to 🔊.
  - Click fires `onToggle` once.
  - `destroy()` removes the click listener.

### Implementation for US5

- [ ] T008 [US5] Create `src/renderer/mute-button.ts` per [contracts/module-contracts.md §4](./contracts/module-contracts.md): pure DOM adapter with `setMuted`, `destroy`. Click listener calls `onToggle()`.
- [ ] T009 [US5] In `src/renderer/index.ts`, export `createMuteButton` + type `MuteButton`.
- [ ] T010 [US5] In `index.html`, add `<button id="mute-button" class="mute-button" type="button" aria-label="Mute audio" aria-pressed="false">🔊</button>` to the HUD near the score / timer / lives. Add CSS: position consistent with the existing HUD (top-right area, fits alongside the pause button); cursor pointer; `aria-pressed="true"` styled with reduced opacity to indicate muted state.
- [ ] T011 [US5] In `src/main.ts`, query `#mute-button` (HTMLButtonElement) and pass through to `createGameLoop` as a new `muteButton` host element.
- [ ] T012 [US5] In `src/game/game-loop.ts`, add `muteButton: HTMLButtonElement` to `GameLoopHostElements`. Construct `const audioEngine = createAudioEngine()` and `const muteButton = createMuteButton(host.muteButton, () => { audioEngine.setMuted(!audioEngine.isMuted()); muteButton.setMuted(audioEngine.isMuted()); })`. In `onKeyDown`, add a top-priority branch: if `event.key === 'm' || event.key === 'M'`, toggle mute (same code path as the button) and return. Push `muteButton.setMuted(audioEngine.isMuted())` once per frame for state consistency. Call `audioEngine.destroy()` + `muteButton.destroy()` in `dispose()`.

**Checkpoint**: Mute button visible + functional. Tests pass. No sound plays yet because we haven't wired any `play` calls — that's US1 + US2.

---

## Phase 4: User Story 1 — BGM with dual-track gate-modal swap (Priority: P1)

**Goal**: Default BGM plays during running; contest BGM plays while the gate modal is open; both pause on Pause-button / blur; game-over stops BGM.

### Tests for US1

- [ ] T013 [P] [US1] Extend `src/audio/audio-engine.test.ts` with BGM tests against the stubbed context:
  - `startBgm('default')` after unlock creates a buffer source for the default buffer with `loop=true`.
  - `setBgmTrack('contest')` while default is playing stops the current source and starts the contest source.
  - `setBgmTrack('default')` from contest swaps back.
  - `setBgmTrack(currentTrack)` is a no-op (no stop / start).
  - `pauseBgm()` calls `ctx.suspend()`; `resumeBgm()` calls `ctx.resume()`.
  - `stopBgm()` stops the source and clears `activeTrack`.
  - Calls BEFORE the gesture latch opens queue / no-op silently — no throws.
  - `audio_bgm_started`, `audio_bgm_track_changed`, `audio_bgm_paused`, `audio_bgm_resumed`, `audio_bgm_stopped` debug events fire with the right payloads.

### Implementation for US1

- [ ] T014 [US1] In `src/game/game-loop.ts`, wire BGM transitions:
  - In `beginRun()` and `restartFromInput()` (right after the world transitions to running): `audioEngine.startBgm('default')`.
  - In `pauseFromBlur()` and `onPauseButtonPressed()`: `audioEngine.pauseBgm()`.
  - In `resumeFromInput()` and `resumeFromPauseButton()`: `audioEngine.resumeBgm()`.
  - In `showProblemModal(gate)` immediately before `problemModal.show(...)`: `audioEngine.setBgmTrack('contest')`.
  - In the resolve callback inside `showProblemModal`, after `problemModal.hide()` and only if `world.runState !== 'game-over'`: `audioEngine.setBgmTrack('default')`.
  - In `triggerGameOver()`: `audioEngine.stopBgm()`.

**Checkpoint**: Manual smoke: BGM plays on run start, swaps to contest on gate hit, swaps back on modal close, pauses on Pause button, stops on game-over. Tests T013 pass.

---

## Phase 5: User Story 2 — Gameplay event SFX (Priority: P1)

**Goal**: All five gameplay events emit their distinct SFX.

### Tests for US2

- [ ] T015 [P] [US2] Create `src/audio/sfx-synth.test.ts`. For each of the 7 `SfxName` values, call `playSfx(stubContext, stubDestination, name)` and assert: returned `source` is non-null; `durationMs > 0 && durationMs <= 2000`; no exceptions thrown.
- [ ] T016 [P] [US2] Extend `src/audio/audio-engine.test.ts`: `play(name)` after unlock invokes the synth function (delegate is reached); `play` BEFORE unlock no-ops without throwing (verified by spying on the synth function — should NOT be called). `audio_sfx_played` event fires with `{ name }` after unlock.
- [ ] T017 [P] [US2] In `src/input-adapter/input-adapter.test.ts` (if exists; otherwise extend the lane-state test or add a new file): verify that the new `onLaneChangeAttempt` callback fires exactly once per accepted direction input, and NOT for rejected inputs (walls, key repeats).

### Implementation for US2

- [ ] T018 [US2] In `src/input-adapter/input-adapter.ts`, add an optional `onLaneChangeAttempt?: (direction: Direction) => void` to the factory options. Call it from the same code path that currently invokes `emit(InputEvent)` — i.e., only when a real lane change actually starts.
- [ ] T019 [US2] In `src/game/game-loop.ts`, pass `onLaneChangeAttempt: () => audioEngine.play('lane-change')` to `createInputAdapter({ now, emit, onLaneChangeAttempt })`.
- [ ] T020 [US2] In `src/game/game-loop.ts`, inside the obstacle-collision block: when `world.invincibilityRemainingMs === 0` and the collision will be consumed, call `audioEngine.play('obstacle-hit')` immediately before `consumeLife(world, 'obstacle')`. After consumeLife, if `world.runState !== 'game-over'`, call `audioEngine.play('life-lost')` (the life-lost SFX layers on top of the obstacle-hit; if game-over fires the game-over SFX from US4 takes precedence).
- [ ] T021 [US2] In `src/game/game-loop.ts`, inside the gate-collision block (where `gateCollidesAt` returns true): call `audioEngine.play('gate-hit')` right before `showProblemModal(gate)` is invoked (or before `enterAnswering` — wherever the gate-hit is "committed" — verify by reading the existing flow).
- [ ] T022 [US2] In `src/game/game-loop.ts`'s `showProblemModal` resolve callback: after `applyAnswerToWorld(world, isCorrect, points)` runs, call `audioEngine.play(isCorrect ? 'correct-answer' : 'life-lost')`. This handles wrong-answer + timeout (both route through `isCorrect === false`).

**Checkpoint**: Every gameplay event emits its SFX. Manual smoke verifies audibly. Tests T015–T017 pass.

---

## Phase 6: User Story 3 — Countdown tick (Priority: P2)

**Goal**: Per-second tick during the final 10 seconds of any problem-gate countdown.

### Tests for US3

- [ ] T023 [P] [US3] Extend `src/renderer/problem-modal.test.ts` with countdown-tick tests using fake timers + a spy on the `onCountdownTick` callback:
  - For a Basic gate, `onCountdownTick` is called 0 times during the first 50 seconds.
  - Continuing past 50 seconds, `onCountdownTick` is called exactly once per second-boundary transition for the final 10 seconds (allowing for the rare case where the test's advance crosses 0:00 — the final tick at 0:01 → 0:00 may or may not fire; assert `>= 9` and `<= 10` calls).
  - On `pick()`, no further `onCountdownTick` calls fire.

### Implementation for US3

- [ ] T024 [US3] In `src/renderer/problem-modal.ts`, change `createProblemModal(host)` to `createProblemModal(host, audio?: { onCountdownTick: () => void })`. Inside `refreshQuestionCountdownDisplay`, when the displayed-seconds value changes (`totalSecondsLeft !== qTimerLastDisplayedSeconds`) AND `remainingMs <= QUESTION_TIMER_URGENCY_MS && remainingMs > 0`, call `audio?.onCountdownTick()` exactly once for that transition.
- [ ] T025 [US3] In `src/game/game-loop.ts`, update the `createProblemModal(host.problemModal)` call to `createProblemModal(host.problemModal, { onCountdownTick: () => audioEngine.play('countdown-tick') })`.

**Checkpoint**: Last 10 seconds of any gate countdown ticks audibly. Tests pass.

---

## Phase 7: User Story 4 — Game-over SFX (Priority: P2)

**Goal**: Distinct game-over sound plays on the game-over transition (BGM stop is already wired in US1; only the SFX play is new here).

### Tests for US4

- [ ] T026 [P] [US4] Extend `src/game/game-loop.test.ts` if a `triggerGameOver` path is testable; otherwise note in the test file that this is manual-only. (Game-over is mostly DOM-side; a pure-function test isn't natural here.)

### Implementation for US4

- [ ] T027 [US4] In `src/game/game-loop.ts`'s `triggerGameOver()`, after `audioEngine.stopBgm()` (added in US1), add `audioEngine.play('game-over')`. The order matters: stop first (immediate silence of BGM), then play game-over (which is heard against silence).

**Checkpoint**: Reaching game-over plays the distinct arpeggio. BGM is silent. Manual smoke.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T028 [P] Update `LICENSES.md` with attribution lines for the two BGM tracks (if CC-BY). If the placeholders from T001 are still in place, add a `TODO: replace with real attribution when CC0/CC-BY tracks land` note.
- [ ] T029 [P] Update `README.md`'s "What's in it (so far)" with a one-line entry for slice 009: "**Audio (slice 009)** — looping default BGM during running, a tense math-contest theme while a problem cube is open, procedural SFX for lane changes, hits, answers, life losses, the countdown's last 10 seconds, and game over; HUD mute button (or press M) silences everything in one tap; first user gesture unlocks audio so mobile autoplay policy is respected."
- [ ] T030 Run the full automated sweep: `npm run typecheck`, `npm run lint`, `npm test`. Fix any drift.
- [ ] T031 Run the manual quickstart checklist in [quickstart.md](./quickstart.md). Confirm: gesture-unlock, BGM swap on gate, BGM pause on Pause / blur, six SFX audible, countdown tick at 0:10, game-over arpeggio, mute toggle (button + 'M'), bundle size, cross-browser smoke if possible.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: T001 must land first — the engine's `decodeAudioData` calls will fail without the files. Use placeholders.
- **Phase 2 (Foundational)**: T002–T005 parallelizable. All must land before any wiring.
- **Phase 3 (US5)**: depends on Phase 2. T006–T012.
- **Phase 4 (US1)**: depends on Phase 2 + the mute toggle being in place so the player can silence the BGM during testing if it's annoying.
- **Phase 5 (US2)**: depends on Phase 2 + US1 (BGM scaffolding). T015–T022.
- **Phase 6 (US3)**: depends on Phase 2 + US2 (needs a `play` call site that works).
- **Phase 7 (US4)**: depends on US1 (stopBgm path).
- **Phase 8 (Polish)**: depends on Phases 3–7.

### Parallel opportunities

- T002 + T003 + T004 + T005 in foundational (4 different files).
- T006 + T007 in US5 (different test files).
- T015 + T016 + T017 in US2 (different test files / scopes).
- T028 + T029 in polish.

---

## Implementation Strategy

### Recommended linear flow

1. Phase 1 (T001) — placeholder audio files.
2. Phase 2 (T002–T005) — engine + synth scaffolding.
3. Phase 3 (T006–T012) — mute toggle so you can silence the test loop if needed.
4. Phase 4 (T013–T014) — BGM with dual-track swap.
5. Phase 5 (T015–T022) — gameplay SFX.
6. Phase 6 (T023–T025) — countdown tick.
7. Phase 7 (T026–T027) — game-over SFX.
8. Phase 8 (T028–T031) — polish + validation.

### MVP boundary

US1 + US2 + US5 (BGM + gameplay SFX + mute). At the end of Phase 5 the game has its full audio character; US3 and US4 are polish on top.

### Test-first discipline

T006, T007, T013, T015, T016, T017, T023 are written BEFORE their corresponding implementation tasks and will FAIL initially.

---

## Notes

- BGM track switching is a hard cut (no crossfade) per spec FR-001b and research R2. Don't over-engineer.
- Mute is a master-gain switch (not a stop) per research R4 — un-muting never requires a fresh user gesture.
- All Web Audio interactions degrade silently on failure: a single `audio_context_unavailable` debug log + permanent no-op. Gameplay never blocks on audio.
- The 'life-lost' SFX is the single sound for every life-losing event (obstacle hit, wrong answer, timeout) — no per-cause variants.
- Bundle delta target: ≤ 5 KB gzipped JS + ≤ 1 MB combined BGM assets.
- Commit at each phase boundary at minimum (end of Phase 2, end of US5, end of US1, end of US2, end of US3/US4, end of Polish).
