# Feature Specification: Scoring HUD

**Feature Branch**: `002-scoring-hud`

**Created**: 2026-05-16

**Status**: Draft

**Input**: User description: "Scoring HUD slice. Add two on-screen indicators while a run is in progress: (1) a timer at the top of the screen that displays the elapsed running time since the current run began, updated continuously; (2) a score readout (also on screen) that increases by one point every 100 milliseconds (0.1 seconds) while the run is active. Both indicators are visible from the moment the run starts. Both pause when the run pauses (tab blur / pause overlay) and resume on un-pause, so the timer and score reflect only actual playing time. Both reset to zero when a new run begins from the start screen. The HUD is part of the DOM overlay layered over the WebGL canvas, consistent with the existing start screen and pause overlay; it must remain legible on small mobile screens (320 px wide minimum)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a live score while running (Priority: P1)

A player dismisses the start screen and begins a run. They immediately see a score readout on the screen that starts at 0 and ticks upward by one point every tenth of a second. The score lets the player feel a sense of progression and gives them a number to chase across runs.

**Why this priority**: This is the "scoring" half of the slice's name and the gameplay-relevant feedback loop. Without a visible score, the player has no quantitative signal that the run is rewarding them for surviving. Every later slice (gates, difficulty escalation, multipliers) hangs off this counter.

**Independent Test**: Open the build, start a run, watch the score readout. It MUST start at 0, must visibly increment at a rate of about ten points per second, and must hold steady when the player tab-switches away and returns.

**Acceptance Scenarios**:

1. **Given** the start screen is shown, **When** the player presses a key to begin, **Then** the score readout appears reading exactly `0`.
2. **Given** the run has been active for ten seconds without interruption, **When** the player observes the score, **Then** it reads close to `100` (±2 to account for browser frame-rate jitter).
3. **Given** a run is in progress at score `S`, **When** the player tab-switches away, waits five seconds, and tab-switches back, **Then** on the moment of return the score still reads `S` (not `S + 50`).
4. **Given** a run is in progress, **When** the player taps or presses a key after returning from a tab-switch (consuming the resume input), **Then** the score begins incrementing again from `S`.
5. **Given** any run has ended and the player has reloaded the page to the start screen, **When** they begin a new run, **Then** the score readout reads `0` again (no carryover from the previous run).

---

### User Story 2 - See how long the current run has lasted (Priority: P2)

A player on a run can glance at the top of the screen at any time and see a clock showing how long this run has been going (e.g. `0:47`, `2:13`). The clock lets the player measure stamina runs against each other independently of the score.

**Why this priority**: Adds polish and a second axis of self-measurement (time vs points). Independent of US1 - even if the score readout were omitted, the timer alone would still give the player meaningful feedback.

**Independent Test**: Open the build, start a run, watch the timer. It MUST start at `0:00`, must tick forward in step with real seconds, must freeze during pause, and must read `1:05` give or take one second after a continuous 65-second run.

**Acceptance Scenarios**:

1. **Given** the player begins a run, **When** the first frame of the run renders, **Then** the timer reads `0:00`.
2. **Given** the run has been active for one minute and five seconds continuously, **When** the player observes the timer, **Then** it reads `1:05` (±1 second).
3. **Given** a run is in progress at timer value `T`, **When** the player tab-switches away, waits ten seconds, and returns, **Then** on the moment of return the timer still reads `T` (not `T + 10s`).
4. **Given** a run lasts long enough to cross the ten-minute mark, **When** the timer ticks past `9:59`, **Then** the next displayed value is `10:00` (two-digit minutes, no overflow or weird formatting).

---

### Edge Cases

- **Score read at the boundary**: If the player looks at the score exactly when a 100 ms tick fires, they see the new (incremented) value, not the previous one - the readout never displays a "stale" tick.
- **Sub-100 ms run end**: The run can be paused or ended before the first 100 ms tick fires. In that case, the score is still `0` and the timer is still `0:00`. No partial points and no rounding up.
- **Long run**: After an hour of unbroken play the timer reads `60:00` and the score reads roughly `36000`. Both must still display without overflowing the HUD area or wrapping awkwardly.
- **Narrow viewport (320 px wide)**: The HUD MUST NOT overlap the player character or obscure significant parts of the track. The two readouts together occupy at most a single line of HUD area at the top of the screen.
- **Pause overlay covers the canvas**: While paused, the HUD MAY be visible underneath the pause overlay, but it MUST NOT keep incrementing - both readouts are frozen at their pre-pause values.
- **High device pixel ratios (retina, ultra-wide)**: The HUD scales appropriately - it does not become microscopically small on a 4K screen nor enormous on a 320 px phone.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A score readout MUST be visible on screen at all times while a run is in the `running` state.
- **FR-002**: The score MUST increment by exactly one point for every 100 ms of elapsed running time. Over any continuous one-second interval of running, the score MUST advance by 10 points (±1 to allow for the partial-tick boundary).
- **FR-003**: A timer readout MUST be visible on screen at all times while a run is in the `running` state.
- **FR-004**: The timer MUST display elapsed running time in `M:SS` format for runs under ten minutes and `MM:SS` for runs at or beyond ten minutes (e.g. `0:00`, `0:42`, `9:59`, `10:00`).
- **FR-005**: When the run enters the `paused` state (tab blur, pause overlay), both the score and the timer MUST stop advancing within the same frame. While paused, both readouts MUST display the value they held at the moment of pause.
- **FR-006**: When the run resumes from `paused` back to `running`, both readouts MUST continue advancing from where they left off, with no skipped or doubled ticks.
- **FR-007**: When a new run begins from the start screen, both readouts MUST reset to their initial values (score `0`, timer `0:00`).
- **FR-008**: The HUD MUST remain readable on viewport widths as small as 320 px. Each readout's font size MUST be at least 16 CSS pixels at that width.
- **FR-009**: The HUD MUST NOT consume player input. Tapping or clicking on the area occupied by the score or timer MUST pass through to the game (i.e., MUST behave the same as tapping the canvas behind it).
- **FR-010**: The HUD MUST be visually consistent with the existing start-screen and pause-overlay text (matching font family and overall styling) so it reads as part of the same game UI.

### Key Entities

- **Run Score**: The point total accumulated during the current run. Holds *value* (integer ≥ 0) and *last-tick boundary* (the elapsed-ms value at which the most recent increment fired). Both reset on a new run.
- **Run Timer**: The elapsed running time of the current run. Holds *elapsed milliseconds* and exposes a *formatted display string* derived from it. Resets on a new run.

Both entities derive their advancement from the existing run-state's elapsed running time (the same `tickMs` already maintained by the runner-engine, so timer and score remain mathematically in sync).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new player can identify both the score readout and the timer readout on screen within their first three seconds of play.
- **SC-002**: At ten continuous seconds into a run, the displayed score reads `100` ± 2 in 95 % of measurements across three test runs.
- **SC-003**: At one minute continuous into a run, the displayed timer reads `1:00` ± 1 second in 95 % of measurements.
- **SC-004**: After a five-second tab-switch interruption, both the score and the timer show no advancement relative to their pre-blur values.
- **SC-005**: On a 320 px wide viewport, both readouts are legible without zooming (informal: at least 8 of 10 testers can read the values from a typical phone-holding distance).
- **SC-006**: Across a 60-second continuous run on a typical desktop, the score advances monotonically with no observable backsliding or freezing (other than at pause), and the timer advances at the same pace as a wall clock (drift ≤ 1 % of elapsed time).

## Assumptions

- The HUD lives in the DOM as an overlay over the WebGL canvas, consistent with the existing start screen, pause overlay, and debug overlay. Rendering the HUD inside the 3D scene is out of scope.
- The score advances purely as a function of elapsed running time (one point per 100 ms). It is NOT a function of distance travelled, lane changes, or any other in-world event. Distance- or event-driven scoring (e.g. bonus points for correctly answering a gate's question) is deferred to later slices.
- The timer format is `M:SS` while minutes are a single digit, switching to `MM:SS` at and after ten minutes. Hours are out of scope - a run lasting 60+ minutes will simply continue showing minutes (e.g. `99:59`, `100:00`).
- Both readouts are derived from a single elapsed-running-time source so they cannot diverge from each other even if the rendering frame rate jitters.
- The HUD's visual style (font, colour, exact position) matches the existing start-screen and pause-overlay typography. Specific design polish (icons, units, decorative framing) is out of scope for this slice.
- No persistence: high scores, best times, or any cross-run statistics are NOT stored to `localStorage` or any backend in this slice. Each refresh starts fresh.
- No end-of-run summary or "game over" screen is added in this slice. The run is still endless (no fail state yet).
