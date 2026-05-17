# Feature Specification: Audio (Background Music + Sound Effects)

**Feature Branch**: `009-audio`

**Created**: 2026-05-17

**Status**: Draft

**Input**: User description: "Add background music + SFX for obstacle hit, problem-cube hit, lane change, correct answer, life lost, last-10-seconds countdown tick, and game over. Audio must pause when the run pauses and resume when it resumes. Mute toggle in the HUD. Mobile autoplay must be respected — sounds start only after first user gesture. Asset budget ≤ 5 MB total, BGM ≤ 500 KB."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Game has an audible backbone (Priority: P1) 🎯 MVP

When the player starts a run, a looping **default** background-music track plays — unobtrusive, low- to mid-volume, tron aesthetic. While the player is answering a problem-cube (the gate modal is open), the music **switches to a different "math contest / battle of the brains"-style track**: more tense, with a clear time-pressure feel, that loops underneath the question while the player is thinking. When the gate modal closes (correct, wrong, or timeout), the audio switches back to the default track. Whenever the run is suspended without a gate modal — Pause button → How-to-Play modal, or browser tab loses focus — the music pauses entirely; on resume it picks up where it left off.

**Why this priority**: A running game without any audio feels like a tech demo. Background music is the single largest perceptual lift and is the foundation other sounds layer on top of. The default ↔ contest swap also makes the gate modal feel like the moment of high stakes it is. This story also forces the audio-pipeline scaffolding to exist (asset loading, user-gesture unlocking, pause coupling, mute, multi-track), so subsequent SFX user stories become small additions.

**Independent Test**: Open the game, dismiss the start screen with a tap (the required user gesture), confirm the default BGM begins playing within 1 second. Hit a problem cube — within ~500 ms the audio swaps to the contest theme; the default BGM is no longer audible. Close the modal — within ~500 ms the audio swaps back to the default BGM. Open the Pause button → How-to-Play modal; audio fully pauses (neither track). Close it; audio resumes the default track. Switch tabs; on return audio resumes. Reload the page; audio is silent until the next user gesture.

**Acceptance Scenarios**:

1. **Given** the start screen is visible, **When** the player taps or presses any key to begin the run, **Then** the default BGM begins playing within 1 second and continues to loop seamlessly.
2. **Given** the default BGM is playing during a run, **When** the player opens the Pause button → How-to-Play modal, **Then** the music pauses within 200 ms.
3. **Given** the How-to-Play modal is open with music paused, **When** the player closes the modal, **Then** the music resumes from the exact position it paused at (no restart, no skip).
4. **Given** the default BGM is playing during a run, **When** the player hits a problem-gate cube and the gate modal opens, **Then** within ~500 ms the audio switches to the contest theme (default track stops or fades out; contest track starts).
5. **Given** the contest theme is playing while the gate modal is open, **When** the gate modal closes for any reason (correct / wrong / timeout), **Then** within ~500 ms the audio switches back to the default BGM. The default BGM MAY restart from its loop point — exact position-preservation across the swap is NOT required (the swap is intentionally a "track change", not a "pause").
6. **Given** background music is playing, **When** the browser tab loses focus, **Then** the music pauses (matching the existing pause-on-blur behaviour); **When** focus returns and the player presses a key, **Then** the music resumes the same track that was active at blur (default or contest).
7. **Given** the page has just been loaded with no prior user interaction, **When** the page renders, **Then** no music plays (mobile autoplay policy is respected).
8. **Given** the player reaches game-over, **When** the game-over overlay appears, **Then** all background music stops (the game-over SFX takes over — see US4).

---

### User Story 2 — Player actions and gameplay events have feedback (Priority: P1)

Each gameplay event triggers a short sound effect:

- **Lane change**: a short, low-energy blip when the player swipes or presses an arrow key that successfully starts a lane change.
- **Obstacle hit**: a percussive "thud" when the runner collides with an obstacle (i.e., a life is consumed by collision).
- **Problem-cube hit**: a chime when the runner collides with a problem-gate cube and the gate modal is about to open.
- **Correct answer**: a positive bell / chord on a correct gate answer.
- **Life lost**: a descending tone on any life loss (obstacle hit OR wrong / timed-out answer).

These sounds are short (≤ 500 ms each, except optional reverb tails), play at most once per event, and never queue up so densely they distort. Multiple simultaneous events (e.g. life lost + game over) layer cleanly.

**Why this priority**: P1 because gameplay feedback is the second-most-perceptible audio layer after BGM. Without these, only the music exists and the game still feels muted. These also exercise the SFX-channel side of the audio pipeline that the simpler SFX (US3) will reuse.

**Independent Test**: For each of the five SFX, perform the trigger action in a dev build and confirm the sound plays. Verify volume balance: every SFX should be audible over the BGM but not painfully loud. Verify de-duplication: rapidly hitting two obstacles in quick succession produces two distinct sounds without one cutting the other off jarringly.

**Acceptance Scenarios**:

1. **Given** the runner is in the left lane, **When** the player presses ArrowRight (and a lane change actually starts), **Then** a short lane-change blip plays; pressing ArrowRight again at the wall lane (no change occurs) plays no sound.
2. **Given** invincibility is inactive, **When** the runner collides with an obstacle, **Then** an obstacle-hit SFX plays followed by the life-lost SFX (both audible distinct events).
3. **Given** a problem-cube is in the runner's lane, **When** the runner collides with it, **Then** a problem-cube-hit SFX plays and the gate modal opens.
4. **Given** the gate modal is open, **When** the player picks the correct answer, **Then** a correct-answer SFX plays.
5. **Given** the gate modal is open, **When** the player picks the wrong answer OR lets the countdown expire, **Then** the life-lost SFX plays (no separate "wrong-answer" sound — the life-loss IS the wrong-answer signal; this matches the constitution's preference for not adding sounds without a clear semantic role).
6. **Given** sound is enabled, **When** any of the above events fire, **Then** the SFX volume is balanced so the BGM remains audible underneath (SFX peaks within −6 dB of BGM peak, qualitatively).

---

### User Story 3 — Countdown urgency tick (Priority: P2)

While a problem-gate countdown is in its final 10 seconds (matching the existing visual urgency cue), a per-second tick plays — one per visible-second-boundary transition. The tick stops the instant the player answers OR the countdown reaches zero (the game-over / wrong-answer sound takes over from there). The tick is subtle: a short, soft click that adds time pressure without being annoying.

**Why this priority**: P2 because US1 + US2 cover the core audio loop. The countdown tick is a polish layer that strengthens the existing urgency UX from slice 007. It's the only audio event tied to in-modal state, so it exercises the modal-audio integration path.

**Independent Test**: Open a Basic gate (60 s), wait passively, and confirm: silence for the first 50 seconds; at the 10-second mark a tick fires; ticks continue at one-per-second cadence until either the player answers (ticks stop immediately) or time expires (the final tick at `0:01 → 0:00` may be omitted in favour of the timeout sound). Repeat with Medium and Advanced — the cadence and threshold are independent of difficulty.

**Acceptance Scenarios**:

1. **Given** a problem-gate countdown is at `0:11`, **When** the second elapses, **Then** the displayed time becomes `0:10` AND a single tick plays.
2. **Given** the countdown is in the last 10 seconds and is ticking audibly, **When** the player picks an answer, **Then** the tick stops immediately and no more ticks play for that gate.
3. **Given** the countdown reaches `0:00` without an answer, **When** the timeout fires, **Then** ticking stops and the life-lost SFX (US2) plays once.
4. **Given** sound is muted (US5), **When** the countdown enters its last 10 seconds, **Then** no ticks play.

---

### User Story 4 — Game-over sound (Priority: P2)

When the run ends (zero lives reached), a distinct game-over sound plays once and the background music stops. The game-over sound is short enough to finish before the player presses a key to restart (≤ 2 seconds).

**Why this priority**: P2 because it's a polish event with a single firing point. It depends on the BGM-stop logic from US1, so it lands naturally after that.

**Independent Test**: Cause a game-over (drain lives by hitting obstacles or wrong answers). Confirm BGM stops within 100 ms of the game-over transition; a distinct game-over sound plays once and finishes within 2 seconds; restarting the run starts the BGM fresh from its loop start.

**Acceptance Scenarios**:

1. **Given** the player has 1 life remaining, **When** they lose that last life, **Then** the BGM stops and the game-over SFX plays exactly once.
2. **Given** the game-over SFX is mid-playback, **When** the player taps or presses a key to restart, **Then** the SFX may either finish or be cut off (either is acceptable); the new run's BGM starts from its loop start, not from where it was when the previous run ended.
3. **Given** the game-over screen is visible, **When** the player opens the How-to-Play modal, **Then** no new audio plays (How-to-Play modal does NOT trigger BGM resume; the run isn't running).

---

### User Story 5 — Mute toggle in the HUD (Priority: P1)

A single mute button is rendered in the HUD, near the existing score / timer / lives controls. Tapping it (or pressing the keyboard shortcut `M`) toggles all audio — BGM, SFX, and the countdown tick — between on and off. The toggle's visual state reflects the current mute state. The mute preference persists for the rest of the browser session (no reload required to keep the setting, but a reload resets to default — un-muted).

**Why this priority**: P1 because audio in games without an obvious mute is a hostile UX, especially for desktop players in shared spaces. Must ship in the same slice as the first audible sound.

**Independent Test**: Start a run; BGM plays. Click the mute button; BGM goes silent within 200 ms; no SFX play for any subsequent event (lane change, obstacle, gate). Click again; BGM resumes from where it would have been (i.e., the mute behaves as a master gain to zero, not a pause). Press `M` on the keyboard; same toggle behaviour. Reload the page; mute starts off again.

**Acceptance Scenarios**:

1. **Given** a run is in progress with BGM playing, **When** the player clicks the mute button, **Then** all audio output silences within 200 ms.
2. **Given** the game is muted, **When** any event fires that would normally play an SFX, **Then** no sound is produced.
3. **Given** the game is muted, **When** the player un-mutes during a run, **Then** BGM resumes audibly at its current playback position (no restart).
4. **Given** the page is reloaded mid-game, **When** the next run starts, **Then** audio is un-muted by default.
5. **Given** the mute button is visible, **When** the player views it, **Then** its icon clearly differentiates the muted state from the un-muted state (e.g., 🔊 vs 🔇 plus a clear `aria-label`).
6. **Given** the player presses `M`, **When** the game is in any state (start screen, running, paused via modal, game-over), **Then** the toggle still works (mute is a top-level preference, not gated on the run state).

---

### Edge Cases

- **First page load, no user gesture yet**: No sound plays until the player's first tap / keypress (which is also the "press anything to start" gesture for the run). Mobile and desktop browsers both honour this — no special-casing needed.
- **Page hidden via tab switch or minimise**: The existing pause-on-blur behaviour stops the world; this slice ensures the audio context also pauses so the player doesn't get phantom BGM coming from a hidden tab.
- **Rapid lane-change spam (3+ key presses in 100 ms)**: Each successful lane-change start fires its blip. If the input adapter rejects a press (e.g., already at wall, or mid-animation), no sound plays for that press. Worst case: 3 distinct blips audible in quick succession; volume balance must prevent clipping.
- **Simultaneous obstacle-hit AND game-over**: Last-life-obstacle-hit produces obstacle-hit + life-lost + game-over sounds layered. Playback order: obstacle-hit (instant), life-lost (instant or slight delay), game-over (after life-lost finishes is fine — total perceived duration ~2 s). All three may overlap.
- **Mute during BGM mid-track**: BGM (whichever of default / contest is active) internally keeps playing under a zero-gain master; un-muting at any time resumes audibly without restarting the track. Implication: the BGM track is *not* stopped on mute (avoids the user-gesture replay requirement on un-mute).
- **Rapid gate-on, gate-off, gate-on**: each transition completes within 500 ms. If the player triggers the second transition before the first finishes, the engine cancels the in-flight swap and starts the next one — no track-stacking, no double-playback.
- **Countdown tick crosses second boundary at the exact moment of pick**: Tick may or may not play that final time. Both behaviours acceptable as long as no double-tick fires for the same second.
- **Browser doesn't support Web Audio**: This is a constitution-level platform constraint — "modern evergreen browsers" all support Web Audio. Graceful degradation: a missing audio context means silent gameplay with no errors thrown.
- **The player has system audio at 0%**: Not the game's problem; the in-game mute toggle is independent of system volume.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST play a looping **default** background-music track while the run is active (loopState === 'running') AND no problem-gate modal is open.
- **FR-001a**: The system MUST play a looping **contest** background-music track (different from the default — math-contest / battle-of-the-brains style) while a problem-gate modal is open. Track changes between default and contest MUST complete within ~500 ms of the modal opening or closing.
- **FR-001b**: Position preservation IS required across pause / resume of the same track (FR-002); position preservation IS NOT required across the default ↔ contest swap — each track may restart from its own loop start when activated.
- **FR-002**: The system MUST pause ALL background music whenever the run is suspended by a non-gate source (Pause-button → How-to-Play modal, blur-driven pause) and resume the same track that was active at pause from the same playback position.
- **FR-003**: The system MUST stop all background music when the run ends (game-over) and start the default track fresh from its loop beginning when a new run starts.
- **FR-004**: The system MUST play a distinct short sound effect for each of: (a) successful lane change start, (b) obstacle collision (excluding invincibility passes), (c) problem-cube collision, (d) correct answer, (e) life-loss (obstacle OR wrong-answer OR timeout), (f) game-over.
- **FR-005**: The system MUST play a countdown tick once per visible second-boundary transition for the final 10 seconds of every problem-gate countdown; ticking MUST stop the instant the player answers or the countdown reaches zero.
- **FR-006**: The system MUST NOT initiate any audio playback before the user's first interaction with the page; the first user gesture (tap, click, or keypress) unlocks audio.
- **FR-007**: The system MUST provide a single mute toggle accessible from the HUD that silences all audio output (BGM + SFX + tick) when active. The toggle MUST be operable via mouse click, touch tap, AND the keyboard shortcut `M`.
- **FR-008**: The mute state MUST persist across run boundaries within the same browser session but MUST reset to un-muted on page reload.
- **FR-009**: The mute toggle's visual state MUST distinguish muted from un-muted without relying on colour alone (icon swap + `aria-label`).
- **FR-010**: When muted, un-muting MUST resume background music audibly from its current playback position (i.e., the underlying BGM source continues running under a zero gain; mute is a master-gain switch, not a stop).
- **FR-011**: Total audio asset weight MUST remain within the constitution's 5 MB total-asset budget. Each of the two BGM files (default + contest) MUST be ≤ 500 KB; combined BGM ≤ 1 MB. Each SFX file SHOULD be ≤ 30 KB. (Where SFX are generated procedurally — implementation decision — the per-SFX file budget is moot.)
- **FR-012**: Significant audio state transitions (gesture-unlock, BGM start / pause / resume, mute toggle, SFX play failures) MUST emit structured `console.debug` events consistent with the project's observability convention.
- **FR-013**: A missing or non-functional audio context MUST NOT throw user-visible errors; gameplay continues silently and a single debug-level warning is logged.
- **FR-014**: SFX volume MUST be balanced so the BGM remains audible underneath (no SFX peak more than 6 dB above the BGM peak). Levels are tuned in implementation, not configured by the player.
- **FR-015**: When the page is reloaded mid-run, all audio state MUST reset (no SFX plays from before the reload).

### Key Entities *(include if feature involves data)*

- **Audio engine**: A single, app-wide service that owns the audio context, loads and decodes the SFX + BGM assets, exposes `play(sfxName)`, `startBgm()`, `pauseBgm()`, `resumeBgm()`, `stopBgm()`, `setMuted(bool)`, and `isMuted()`. Internally tracks the gesture-unlock latch (no audio plays until unlocked).
- **Mute toggle button**: A HUD affordance with two visible states (muted, un-muted) wired to the engine's `setMuted` and reading `isMuted()` for its display.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the first user-gesture that starts a run, background music begins playing within 1 second.
- **SC-002**: When the run pauses (any source), background music silences within 200 ms; when it resumes, music continues from the same playback position without restart.
- **SC-003**: Each of the 6 SFX (lane change, obstacle hit, problem-cube hit, correct answer, life lost, game over) plays exactly once per triggering event with under 100 ms perceived latency between event and sound.
- **SC-004**: The countdown tick plays exactly 10 times during a problem-gate countdown that runs from full duration to expiry without interruption (one tick per second from `0:10` to `0:01` inclusive).
- **SC-005**: Toggling mute silences ALL audio output (BGM + any in-progress SFX) within 200 ms.
- **SC-006**: First-page-load with no user interaction produces zero audio output (mobile autoplay compliance verified on iOS Safari and Android Chrome).
- **SC-007**: Total compressed audio asset weight is ≤ 5 MB; each BGM file (default + contest) is ≤ 500 KB.
- **SC-009**: When a problem-gate modal opens, the audio switches from default to contest BGM within 500 ms; on close, switches back within 500 ms.
- **SC-008**: A reload mid-run results in a clean reset — no music, no SFX, no state leakage.

## Assumptions

- The project will source audio assets under permissive open licences (CC0 / CC-BY) the same way it sources problem text, OR use procedural / synthesised audio that lives entirely in code. The choice is a planning decision, not a spec decision.
- The audio context can be a single shared instance across the page lifetime; no per-run teardown is needed.
- Volume tuning is done by ear during implementation; no exposed slider in this slice. A future slice could add per-channel volume controls.
- Mute persistence beyond the session (e.g., `localStorage`) is explicitly out of scope; the existing project convention (no client storage) holds.
- The keyboard `M` shortcut for mute does not conflict with any existing key handler. (Existing: Arrows / WASD for lanes, Enter / SPACE / ESC for modals, any-key for start-and-restart.) `M` is free.
- Lane-change blip fires on the input adapter's `emit` callback for direction inputs, NOT on every keydown event — so holding a key down or pressing an already-walled direction does not flood the audio channel.
- The "life-lost" SFX is the single sound for ALL life-losing events; there is no separate "wrong-answer" sound and no separate "timeout" sound. This keeps the audio vocabulary small.
- The game-over sound layers on top of the just-played life-lost sound when the final life is consumed; no special chord is composed for that combined event.
