# Feature Specification: Problem Gate Countdown Timer

**Feature Branch**: `007-problem-timer`

**Created**: 2026-05-17

**Status**: Draft

**Input**: User description: "Add a per-question countdown timer to the problem-gate modal. Basic gates get 60 seconds, Medium gets 120 seconds, Advanced gets 180 seconds. The timer starts when the modal opens (run is already paused) and is visible to the player. If the player runs out of time before selecting an answer, treat it exactly like a wrong answer: deduct the difficulty's point value (1k/5k/10k), cost a life, highlight the correct answer in the review state, and trigger the same 3-second auto-continue (or manual continue) behavior. If the player answers before the timer expires, the timer stops and existing correct/wrong handling applies as today. The timer should be paused if the modal can be paused for any reason, but otherwise runs continuously while the modal is open."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visible countdown pressures the player to commit (Priority: P1)

When the runner hits a problem gate, the multiple-choice modal opens with a visible countdown showing the remaining time. The player sees the seconds ticking down and chooses an answer under that pressure. If they answer before the clock hits zero, the run resumes as today. The countdown duration depends on difficulty: Basic gives 60s, Medium gives 120s, Advanced gives 180s.

**Why this priority**: This is the core of the feature. Without a visible, ticking timer, time pressure does not exist and nothing else in this slice has meaning. It is also the simplest deliverable: render a countdown in the modal and let the existing answer-selection flow stop it.

**Independent Test**: Open a Basic gate in a dev build, observe a clearly readable countdown starting at 1:00 in the modal, watch it tick at one-second granularity, pick any answer before it expires, and confirm the modal proceeds to its existing review state with the run resuming normally. Repeat with Medium (starts at 2:00) and Advanced (starts at 3:00).

**Acceptance Scenarios**:

1. **Given** a Basic problem gate has just opened, **When** the modal is visible, **Then** a countdown is displayed prominently showing `1:00` and decreasing once per second.
2. **Given** a Medium problem gate has just opened, **When** the modal is visible, **Then** the countdown shows `2:00` and decreases once per second.
3. **Given** an Advanced problem gate has just opened, **When** the modal is visible, **Then** the countdown shows `3:00` and decreases once per second.
4. **Given** the countdown is running, **When** the player selects an answer, **Then** the countdown freezes immediately and the existing correct/wrong handling runs unchanged.
5. **Given** the countdown is running with more than 10 seconds remaining, **When** the player observes it, **Then** the display is calm and unambiguous (e.g., neutral colour, monospaced digits so it does not jitter).

---

### User Story 2 - Running out of time counts as a wrong answer (Priority: P1)

If the player fails to select an answer before the countdown reaches zero, the system treats the question as if they had chosen a wrong answer. They lose the difficulty's point value (1,000 / 5,000 / 10,000 for B/M/A), they lose a life, the correct answer is highlighted in the same review state used for wrong answers, and the same 3-second auto-continue (or manual continue) behaviour fires. The runner respawns with the usual 3-second blinking invincibility window once the modal closes.

**Why this priority**: This is the only consequence the timer has. Without it the countdown is decorative. It is also tightly coupled to US1 because the timer must report timeout to the existing answer-handling pipeline.

**Independent Test**: Open a Basic gate, do nothing, wait 60 seconds, and confirm: score decreased by 1,000 (not below zero handling aside), one life lost, correct answer highlighted in review state, the same 3-second auto-continue plays as a wrong manual answer, and the runner respawns with invincibility blinking. Repeat for Medium (180s wait → 5k loss) and Advanced (180s wait → 10k loss). Cross-check that ending the game by score-below-zero or zero-lives still works when timeout causes the losing condition.

**Acceptance Scenarios**:

1. **Given** a Basic gate's modal is open with no answer selected, **When** the countdown reaches `0:00`, **Then** the system treats it as a wrong answer: score decreases by 1,000, one life is lost, the correct option is highlighted in review state, and a 3-second auto-continue countdown begins (player may still tap/click to continue immediately).
2. **Given** a Medium gate times out, **When** zero is reached, **Then** the player loses 5,000 points and one life with the same review/auto-continue behaviour.
3. **Given** an Advanced gate times out, **When** zero is reached, **Then** the player loses 10,000 points and one life with the same review/auto-continue behaviour.
4. **Given** a timeout happens, **When** the modal closes and the run resumes, **Then** the runner respawns with the same 3-second blinking invincibility window granted after any other life-losing event.
5. **Given** a timeout would drop score below zero or lives to zero, **When** it occurs, **Then** the existing game-over flow fires unchanged (timeout is not a special case for end-of-run).
6. **Given** a timeout fired, **When** the next problem gate is encountered, **Then** the new modal opens with a fresh countdown for that gate's difficulty (timeouts do not persist any penalty beyond the standard wrong-answer penalty).

---

### User Story 3 - Final-seconds urgency cue (Priority: P3)

In the last several seconds before timeout, the countdown shifts into a more urgent visual treatment (e.g., red colour paired with a label change or pulse animation) so the player notices without needing to stare at the clock. This is a polish layer on top of US1 — the timer is fully functional without it — but it materially improves the "feels fair" perception of timeouts.

**Why this priority**: P3 because US1 + US2 already deliver the feature. Urgency styling is quality-of-life polish that can be added after the core loop works.

**Independent Test**: Open a Basic gate, wait until the countdown reaches the urgency threshold (last 10 seconds), and confirm the visual treatment changes (colour shift plus a non-colour-only cue such as a label or pulse, per constitution's colour+label pairing rule). Confirm the urgency cue ends as soon as the player answers or the modal closes.

**Acceptance Scenarios**:

1. **Given** the countdown has more than 10 seconds remaining, **When** the player observes the timer, **Then** it uses the neutral/calm visual treatment.
2. **Given** the countdown has 10 seconds or fewer remaining, **When** the player observes the timer, **Then** the timer adopts an urgent visual treatment that does not rely on colour alone (e.g., red plus a pulse animation or "Hurry!" label).
3. **Given** the urgency cue is showing, **When** the player selects an answer, **Then** the cue stops immediately along with the countdown.

---

### Edge Cases

- **Modal paused mid-question**: If the modal supports any kind of pause (e.g., a future global pause, browser tab loses focus and the run pause hook fires), the countdown must pause with it and resume from the same remaining time when the modal unpauses. The countdown is wall-clock-driven only while the modal is actively "ticking".
- **Tab loses focus / window minimised**: If the underlying run loop pauses (existing behaviour), the countdown pauses with it; if the run loop keeps running while the modal is open, the countdown keeps running. The countdown follows whatever the modal's existing "is the question active" state already is — it does not introduce its own pause semantics.
- **Player clicks an answer at the exact moment of expiry**: A submitted answer wins over a timeout. If the player's selection is registered, treat it as a normal answer regardless of how close to zero the timer is.
- **Timer expires while review state is already showing**: Cannot happen — the timer stops the instant an answer is registered, and review state is only entered after a registered answer (or after a timeout, which itself is the registered "answer").
- **System clock changes / device throttling**: The countdown must measure elapsed wall-clock time monotonically, not by counting `setInterval` ticks, so background-tab throttling or clock skew does not let the player gain extra time.
- **Resize / re-open**: The modal cannot be re-opened mid-question; once a gate is resolved (correct, wrong, or timeout) it is done. No state to preserve across re-openings.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The problem-gate modal MUST display a per-question countdown timer that is visible to the player from the moment the modal opens until either an answer is registered or the countdown reaches zero.
- **FR-002**: The initial countdown duration MUST be 60 seconds for Basic gates, 120 seconds for Medium gates, and 180 seconds for Advanced gates.
- **FR-003**: The countdown MUST start at the difficulty's initial duration when the modal opens (no warm-up, no head start).
- **FR-004**: The countdown MUST decrement using monotonic elapsed wall-clock time so that background-tab throttling, missed animation frames, or device clock changes cannot grant the player extra time.
- **FR-005**: The displayed countdown MUST update at least once per second and MUST format remaining time in a way that is unambiguous at a glance (e.g., `M:SS`).
- **FR-006**: When the player selects an answer before the countdown reaches zero, the system MUST stop the countdown immediately and route the answer through the existing correct/wrong evaluation pipeline unchanged.
- **FR-007**: When the countdown reaches zero with no answer registered, the system MUST treat the question as a wrong answer for all downstream effects: it MUST deduct the difficulty's point value (1,000 / 5,000 / 10,000 for B/M/A), MUST cost the player one life, MUST highlight the correct option in the existing review state, and MUST trigger the existing 3-second auto-continue (with manual continue still allowed) before the modal closes.
- **FR-008**: A timeout MUST NOT impose any penalty beyond the existing wrong-answer penalty (no bonus deduction, no extra life lost, no carry-over to the next gate).
- **FR-009**: After a timeout-induced life loss, the runner MUST respawn with the same 3-second blinking invincibility window granted by any other life-losing event.
- **FR-010**: A timeout MUST be able to trigger game-over via the existing terminal conditions (score below zero or zero lives) without any special-case handling.
- **FR-011**: The countdown MUST pause whenever the modal's active state pauses (e.g., a global pause, run-loop pause hook) and MUST resume from the same remaining time when the modal becomes active again. The countdown MUST NOT introduce its own pause semantics independent of the modal.
- **FR-012**: In the final 10 seconds the countdown MUST shift into an urgent visual treatment that is distinguishable without relying on colour alone (per the constitution: colour pairs with a label, icon, or motion cue).
- **FR-013**: The countdown timer MUST emit structured `console.debug` events at significant transitions (start, timeout, paused, resumed, stopped-by-answer) consistent with the project's observability convention, and these events MUST be visible in the debug overlay when `?debug=1` is active.
- **FR-014**: All countdown-related logic MUST be testable headlessly (i.e., independent of real wall-clock waits) so unit tests can simulate elapsed time deterministically.

### Key Entities *(include if feature involves data)*

- **Question Timer**: A per-modal countdown bound to one problem gate. Has an initial duration (driven by gate difficulty), a remaining duration (driven by elapsed wall-clock time minus paused intervals), and a status (`running`, `paused`, `stopped-by-answer`, `expired`). Emits a single terminal event — either "answer recorded in time" or "timed out" — that downstream answer-handling consumes. Has no persistence beyond the modal's lifetime.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a Basic / Medium / Advanced gate opens, the displayed initial time is exactly `1:00` / `2:00` / `3:00` respectively, within ±100 ms of the modal becoming visible.
- **SC-002**: When the player selects an answer with any time remaining, the countdown freezes within 100 ms of the selection and no further decrement is visible.
- **SC-003**: When no answer is selected and the displayed countdown shows `0:00`, the same review state shown for wrong manual answers begins within 200 ms, and the score, lives, correct-answer highlight, and 3-second auto-continue all behave identically to a manually wrong answer of the same difficulty.
- **SC-004**: The countdown's drift over its full duration is under 500 ms relative to wall-clock time on a 60 FPS desktop and on a 3-year-old reference mobile device, even when the tab is briefly backgrounded mid-question.
- **SC-005**: In quick playtests, players consistently report that they noticed the countdown without being prompted (qualitative: 4 of 5 testers mention it unprompted when asked what changed).
- **SC-006**: 100% of timeout events route through the same wrong-answer code path used by manual wrong answers (verified by unit test, not by visual parity alone) — meaning future changes to wrong-answer behaviour automatically apply to timeouts.

## Assumptions

- The existing problem-gate modal exposes (or can be cheaply extended to expose) the hook needed to (a) inject a countdown UI into its existing layout and (b) deliver a "timeout" event into the existing answer-handling pipeline using the same `Wrong` answer outcome shape used today.
- The existing wrong-answer review state already supports a "no answer was selected" path (i.e., it can highlight the correct answer without needing to render a selected-but-wrong indicator). If it cannot, the timeout's review state will render exactly like a wrong answer with no "your pick" marker.
- The existing 3-second auto-continue affordance is already a single, reusable affordance in the modal; the timer simply triggers it on expiry rather than introducing a parallel mechanism.
- The existing pause behaviour for the modal (if any) is the single source of truth for "is the question active". The timer subscribes to that state rather than implementing its own.
- Mobile and desktop have the same countdown durations; difficulty is the only axis. No accessibility "give me more time" affordance is in scope for this slice.
- Sound effects for ticking / timeout are out of scope for this slice (the project currently has no SFX layer); if SFX are introduced later, the timer's structured debug events provide the hook points.
- The countdown does not award any score bonus for finishing quickly — speed is its own reward via more gates per run. Score remains driven by correct/wrong only.
