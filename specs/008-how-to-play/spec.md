# Feature Specification: How-to-Play Modal & In-Game Pause

**Feature Branch**: `008-how-to-play`

**Created**: 2026-05-17

**Status**: Draft

**Input**: User description: "Replace the 'Problem Credits' link on the landing/start screen and game-over screen with a 'How to Play' link that opens a new How-to-Play modal. Three sections: General Rules, Problem Cubes (per-difficulty 2-column rows with cube graphic + description + points + countdown), Credits. Modal dismissed via X / ESC / SPACE. Also add an in-game Pause button at top, enabled only while running, that opens the same modal and pauses the run; closing the modal resumes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Replace "Problem Credits" with "How to Play" on the entry screens (Priority: P1) 🎯 MVP

When the player lands on the start screen or hits a game-over screen, they no longer see a "Problem Credits" link. Instead they see a "How to Play" link in the same position. Clicking / tapping the link opens a modal that explains how the game works in three clearly labelled sections: General Rules, Problem Cubes, and Credits. The Credits section continues to satisfy the CC-BY attribution obligation that the old Problem Credits panel covered.

**Why this priority**: Without it, the existing Problem Credits link is in the wrong place and the player has no in-app explanation of the rules. This is also the smallest deliverable: build the modal once and swap the entry-screen affordance.

**Independent Test**: Open the start screen, see "How to Play" (not "Problem Credits"), click it, see the three sections rendered in order. Close via X, ESC, and SPACE — all three dismissals return to the start screen unchanged. Trigger game-over, see the same link, repeat. Read the Credits section and confirm every CC-BY source that was previously shown is still listed.

**Acceptance Scenarios**:

1. **Given** the start screen is visible, **When** the player loads the page, **Then** a link labelled "How to Play" is present where "Problem Credits" used to be; no link labelled "Problem Credits" remains visible anywhere on the start screen.
2. **Given** the start screen is visible, **When** the player clicks "How to Play", **Then** a modal opens with three sections in order: "General Rules", "Problem Cubes", "Credits"; the start screen is dimmed/disabled behind it; keyboard focus moves into the modal.
3. **Given** the How-to-Play modal is open, **When** the player presses ESC, presses SPACE, or clicks the X close button, **Then** the modal closes and the previous screen (start or game-over) regains focus exactly as it was.
4. **Given** the game-over screen is visible, **When** the player loads it, **Then** "How to Play" is present in the same position the old "Problem Credits" link occupied; the open / close behaviour matches the start-screen path.
5. **Given** the Credits section is visible, **When** the player reads it, **Then** every source that previously appeared in the Problem Credits panel (with title, author/org, licence, and link) is still represented.

---

### User Story 2 - Explain the gameplay clearly on first read (Priority: P1)

The How-to-Play modal teaches a brand-new player how to play in under a minute. The "General Rules" section explains the runner, the lane controls, the life count, and the two losing conditions. The "Problem Cubes" section lays out each difficulty as a two-column row — column 1 is a visual swatch of the cube; column 2 is the description, point value, and countdown duration. The visual + label pairing satisfies the constitution's accessibility requirement (difficulty is never conveyed by colour alone).

**Why this priority**: P1 because this is the actual content the modal exists to deliver. Without it the modal in US1 is an empty shell.

**Independent Test**: Open the modal cold (no prior gameplay). Read top to bottom in ~60 s. Without playing, the reader can answer: "How do I move?" (Arrows / WASD / swipe), "How many lives do I start with?" (3), "What ends the run?" (zero lives OR score below zero), "What does each cube colour mean?" (Basic 1k / Medium 5k / Advanced 10k), "How long do I have to answer?" (60 / 120 / 180 s). The Problem Cubes section's three rows are recognisable as Basic-green, Medium-yellow, Advanced-red by the swatch *and* the label.

**Acceptance Scenarios**:

1. **Given** the modal is open, **When** the player reads the "General Rules" section, **Then** it covers: the endless-runner concept, lane movement controls (Arrows, WASD, and touch swipe), the starting 3 lives, and the two end-of-run conditions (zero lives OR score below zero).
2. **Given** the modal is open, **When** the player reads the "Problem Cubes" section, **Then** they see exactly three rows — one per difficulty (B/M/A) — in difficulty order; each row has a visible cube swatch in column 1 and a label, description, point value, and countdown duration in column 2.
3. **Given** the Problem Cubes section, **When** the player inspects any row, **Then** the swatch's colour is paired with an explicit textual label ("Basic" / "Medium" / "Advanced") so colour-blind users can still tell them apart.
4. **Given** the modal is open on a 320 px-wide viewport (mobile floor), **When** the player scrolls, **Then** every section is readable without horizontal overflow; the cube swatch + description stay in two columns or stack gracefully.

---

### User Story 3 - Pause the run mid-game via a top-of-screen Pause button (Priority: P1)

A new Pause button is rendered at the top of the screen while the player is actively running. Tapping it (or pressing ESC / SPACE) pauses the world, opens the same How-to-Play modal, and freezes every time-based system (gate countdowns, obstacle motion, score accrual). Closing the modal (X, ESC, or SPACE) resumes the run from exactly where it left off. The Pause button is intentionally disabled while a problem-gate modal is open, while the runner has respawn invincibility blinking, on the start screen, and on the game-over screen — so it cannot be used to dodge a question, escape a near-miss, or otherwise distort the run.

**Why this priority**: P1 because pause-during-run is the second user-facing affordance the request explicitly calls out, and many players will use it before they ever see a game-over screen. It depends on US1 (the modal must exist) but is independent of US2 (the modal would still be useful even if its body were placeholder copy).

**Independent Test**: Start a run, see the Pause button. Tap it; the run freezes (track stops scrolling; gate countdown if any would freeze — but this affordance is disabled while a gate modal is open, so this case won't arise); the How-to-Play modal opens. Close it; the run resumes seamlessly. Try to use the Pause button on the start screen, on the game-over screen, while a gate modal is open, and while the respawn invincibility window is blinking — all four cases keep the button visually disabled and ignore the click. ESC and SPACE behave identically when the Pause is enabled and the player is not already inside another modal.

**Acceptance Scenarios**:

1. **Given** the run is actively running with no problem-gate modal open and no respawn invincibility active, **When** the player taps the Pause button, **Then** the world freezes within 100 ms and the How-to-Play modal opens. While paused, no obstacle / cube positions advance, no time-based score increment accrues, and no question countdown ticks (none are active in this scenario anyway).
2. **Given** the How-to-Play modal was opened via Pause, **When** the player closes it via X, ESC, or SPACE, **Then** the run resumes from exactly the world state and tick value it had at pause; no jump forward, no jitter.
3. **Given** a problem-gate modal is currently open, **When** the player looks at the Pause button area, **Then** the Pause button is visibly disabled (greyed out / non-interactive) and tapping it / pressing ESC or SPACE does not open the How-to-Play modal. ESC and SPACE keep their existing in-modal behaviour.
4. **Given** the runner is in the respawn invincibility blinking window after losing a life, **When** the player taps the Pause button, **Then** nothing happens (the button is disabled until invincibility ends).
5. **Given** the start screen or game-over screen is visible, **When** the player looks at the Pause button position, **Then** no Pause button is rendered (those screens already have their own input affordances and a "How to Play" link).
6. **Given** the run is actively running, **When** the player presses ESC or SPACE, **Then** the Pause button's action fires (same as tapping it). When the modal is then open, ESC / SPACE close it (consistent with US1's modal-dismissal contract).

---

### Edge Cases

- **Pause spam**: If the player taps Pause repeatedly or hammers ESC/SPACE, the modal opens once; subsequent triggers while it is open are absorbed by the modal's own dismissal handler. There is no risk of double-pause or double-resume.
- **Pause during gate countdown urgency**: The Pause button is disabled while any problem-gate modal is open, so this combination cannot occur. The question countdown is bound to the gate-modal lifecycle, not to a global pause channel.
- **Tab loses focus while paused via How-to-Play**: The run is already paused, so the existing "pause on blur" behaviour has nothing extra to do. On refocus, the run remains paused until the player closes the modal.
- **Tab loses focus mid-run with no modal open**: Existing behaviour unchanged (the project already pauses on blur). The Pause button is not part of that path.
- **Mobile keyboard absent**: ESC/SPACE shortcuts are noops on touch-only devices; the Pause button itself remains the canonical mobile entrypoint.
- **Modal opened via Pause vs. via start-screen link**: Same modal, same content. The only difference is what happens on dismissal — Pause-mode dismissal resumes the run; entry-screen dismissal just hides the modal. The modal must remember which mode it is in so the close action does the right thing.
- **Credits attribution must remain visible**: Removing the old Problem Credits panel cannot reduce the visibility of CC-BY attribution. The Credits section of the How-to-Play modal is the new home; the in-repo `LICENSES.md` is unchanged.
- **Game-over screen dismisses How-to-Play before restart**: If the player has the modal open on the game-over screen and then presses any input that would normally restart, the input must be absorbed by the modal's dismissal first, then the restart happens on the next input. (No surprise restarts from inside the modal.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The "Problem Credits" link MUST be removed from the start screen and the game-over screen. A "How to Play" link MUST take its position on both screens.
- **FR-002**: Clicking / tapping "How to Play" MUST open a modal that renders three sections in this order: "General Rules", "Problem Cubes", and "Credits".
- **FR-003**: The "General Rules" section MUST cover (at minimum): the endless-runner objective, the lane controls (Arrows, WASD, touch swipe), the starting life count of 3, and the two end-of-run conditions (zero lives OR score below zero).
- **FR-004**: The "Problem Cubes" section MUST render three rows — one per difficulty — in B → M → A order. Each row MUST have a visual cube swatch in column 1 and the following in column 2: the difficulty label ("Basic" / "Medium" / "Advanced"), a short description, the point value (±1,000 / ±5,000 / ±10,000), and the question countdown duration (60 s / 120 s / 180 s).
- **FR-005**: Cube colour MUST always be paired with a textual difficulty label so the section is intelligible without colour vision (per the constitution's accessibility rule).
- **FR-006**: The "Credits" section MUST list every CC-BY source that the previous Problem Credits panel listed, with at least the same fields (title, author / organisation, licence, link).
- **FR-007**: The modal MUST be dismissible via three independent mechanisms: an X close control in the modal's top corner, the ESC key, and the SPACE key. All three MUST behave identically.
- **FR-008**: On dismissal from the start screen or game-over screen, the modal MUST hide and return the player to the screen that opened it, in the exact state it was in (no run started, no fields cleared, no focus loss elsewhere).
- **FR-009**: A Pause button MUST be rendered at the top of the playfield while a run is in progress. The button MUST be enabled only when the run is actively running and no problem-gate modal is open and the runner is not currently in a respawn invincibility window. On the start screen and game-over screen the Pause button MUST NOT be rendered.
- **FR-010**: Pressing the enabled Pause button (via touch, mouse, ESC key, or SPACE key) MUST pause the run and open the same How-to-Play modal used by the entry screens. The run pause MUST freeze: obstacle motion, gate motion, and time-based score accrual.
- **FR-011**: Closing the How-to-Play modal that was opened via Pause MUST resume the run from the exact tick value at which it was paused. No catch-up tick, no skipped frame, no jitter.
- **FR-012**: While a problem-gate modal is open, the Pause button MUST be visibly disabled and MUST NOT respond to clicks, taps, or ESC / SPACE. ESC and SPACE while a gate modal is open retain their existing gate-modal behaviour.
- **FR-013**: While the runner is in the respawn invincibility blinking window, the Pause button MUST be disabled. As soon as the invincibility window ends, the Pause button MUST re-enable.
- **FR-014**: The modal MUST be readable at the project's minimum supported viewport width (320 px) without horizontal scrolling. The two-column rows in Problem Cubes MAY stack to single-column on narrow viewports.
- **FR-015**: Significant state transitions (modal opened from entry, modal opened from pause, modal closed → resume, modal closed → no-op) MUST emit structured `console.debug` events consistent with the project's observability convention.
- **FR-016**: Pause-driven modal openings MUST be idempotent — repeated triggers while the modal is open MUST NOT stack additional pause requests; the existing modal absorbs the input.

### Key Entities *(include if feature involves data)*

- **How-to-Play modal**: A single, reusable modal instance with three labelled body sections and a dismissal trio (X / ESC / SPACE). Carries a runtime "open mode" of either `entry` (no run to resume) or `pause` (close → resume run); the mode is private state used only to decide what happens on dismissal.
- **Pause button**: A top-of-playfield UI affordance with two visible states: `enabled` (running, no gate modal, no invincibility) and `disabled` (any of those conditions false). On the start/game-over screens it does not render at all (no third "hidden" visible state).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of "Problem Credits" link occurrences on the start and game-over screens are replaced by a "How to Play" link of identical position and prominence (verified by DOM inspection in a smoke test).
- **SC-002**: A first-time reader can answer the five comprehension questions in US2's Independent Test (controls, life count, end conditions, per-cube point value, per-cube countdown) by reading only the How-to-Play modal, in under 60 seconds.
- **SC-003**: Every CC-BY source previously listed in the Problem Credits panel remains visible and credited in the Credits section of the new modal (no regressions in attribution coverage).
- **SC-004**: When the player triggers Pause from a steady run, the world freezes within 100 ms of the input. When the modal is closed, the run resumes with a tick-value delta from pause of less than one animation frame (≤ 17 ms), measured against the wall-clock-recorded pause moment.
- **SC-005**: The Pause button's disabled state is correct in 100% of the four blocked scenarios — start screen, game-over screen, gate modal open, respawn invincibility — verified by a state-table integration test.
- **SC-006**: The modal renders without horizontal overflow at viewport widths from 320 px up to 1920 px (verified by visual smoke at 320, 768, and 1920).

## Assumptions

- The existing Problem Credits panel implementation is the source of truth for the CC-BY attribution list; the Credits section of the new modal reuses (or shares) that data so attributions cannot drift between two surfaces.
- A simple, single-modal mechanism is sufficient — there is no need for a stack of nested modals. The Pause action is only available when no other modal is open, so the How-to-Play modal is always the top-most when it is open.
- The Pause button uses an existing on-screen control style consistent with the score / timer HUD (i.e., not a separate design system). Colour + icon (e.g. ⏸) + accessible label is acceptable.
- ESC and SPACE share Pause-button semantics during a run because both are already idle keys on this codebase's keyboard map outside of gate modals.
- Touch users have an explicit on-screen Pause button (the ESC/SPACE keys are desktop-only fallbacks).
- The project's existing pause-on-blur behaviour is independent of this feature and remains unchanged. The new Pause affordance is an *explicit* pause-by-input that opens the modal; blur pauses the world without opening a modal.
- No persistence is needed — closing the modal forgets all state. The next time the player opens it, the same content is shown from scratch.
- No localisation in scope. All copy is English.
- No analytics / telemetry layer is introduced for this feature; the `console.debug` events are sufficient for live debugging.
