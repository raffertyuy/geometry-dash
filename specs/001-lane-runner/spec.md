# Feature Specification: Lane Runner Core Movement

**Feature Branch**: `001-lane-runner`

**Created**: 2026-05-16

**Status**: Draft

**Input**: User description: "Core endless-runner movement (no gates, no questions, no score yet). The player character runs forward at a constant speed along a track with three parallel lanes (left, centre, right), starting in the centre lane. The player can switch one lane at a time using keyboard arrow keys (Left/Right), WASD (A/D), or a left/right touch swipe on a mobile/touch device. Lane changes should feel responsive: a single key press or swipe moves the character one lane in that direction and the character snaps cleanly to that lane (no skipping past lanes from a held key). The player cannot move off the leftmost or rightmost lane. The world/track scrolls toward the player to convey forward motion; the player character stays at a fixed Y position on screen. The runner is endless: distance accrues over time as the player keeps moving, and there is no current 'fail' state because there are no obstacles yet."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play the runner on desktop with keyboard (Priority: P1)

A first-time player loads the game in a desktop browser, taps any key to start, and is dropped into an endless forward-running scene with their character in the centre of three lanes. They can press Left/Right arrow keys (or A/D) to move one lane at a time, and they get an immediate, snappy sense of switching lanes back and forth. They cannot move past the leftmost or rightmost lane. Nothing kills them - the run just continues.

**Why this priority**: This is the smallest demonstrable slice that validates the entire runner foundation - input, lane state, world scrolling, and the playable feel. Without this working on desktop, the rest of the game cannot be built.

**Independent Test**: Open the build on a desktop browser, press any key to begin, then verify that arrow-key and WASD presses move the character one lane at a time, that the world appears to scroll past the player, and that the character cannot be moved off-track.

**Acceptance Scenarios**:

1. **Given** the title/start screen is shown, **When** the player presses any key, **Then** the run begins with the character centred in the middle lane and the world scrolling toward the player.
2. **Given** the character is in the centre lane and a run is in progress, **When** the player presses Left Arrow once, **Then** the character moves to the left lane and stops cleanly there.
3. **Given** the character is in the centre lane, **When** the player presses 'D' once, **Then** the character moves to the right lane and stops cleanly there.
4. **Given** the character is already in the leftmost lane, **When** the player presses Left Arrow or 'A', **Then** the character does not move and no error occurs.
5. **Given** the character is in the centre lane, **When** the player holds the Right Arrow key continuously for 5 seconds, **Then** the character ends up in the right lane and not in the rightmost lane (a held key produces at most one lane change per press).
6. **Given** a run is in progress, **When** the player does nothing for 30 seconds, **Then** the run continues and the character remains in its current lane with the world still scrolling (no fail state).

---

### User Story 2 - Play the runner on mobile with swipes (Priority: P2)

A player on a mobile browser loads the same page, taps to start, and plays the runner using horizontal swipe gestures (left to move left a lane, right to move right a lane). The control feel matches the keyboard experience.

**Why this priority**: Mobile reach is a stated target for the project, but the desktop slice (US1) is sufficient as a standalone MVP. This story adds the touch input adapter on top of the same runner core, with no new game logic.

**Independent Test**: Open the build on a touch device (or browser devtools with touch emulation), tap to start, and verify that horizontal swipes move the character one lane at a time. Vertical or very short gestures are ignored.

**Acceptance Scenarios**:

1. **Given** a run is in progress on a touch device, **When** the player swipes right (≥ 30 px horizontal, completed in < 500 ms, with horizontal component dominant), **Then** the character moves one lane to the right.
2. **Given** a run is in progress, **When** the player swipes left, **Then** the character moves one lane to the left.
3. **Given** a run is in progress, **When** the player performs a mostly-vertical swipe or a horizontal swipe under 30 px, **Then** the character does not move.
4. **Given** the character is in the rightmost lane, **When** the player swipes right, **Then** the character does not move and no error occurs.

---

### Edge Cases

- **Simultaneous opposing inputs**: If Left and Right are pressed within the same frame (e.g., 16 ms window), the inputs cancel and no lane change occurs.
- **Mid-animation input**: If the player presses a lane-change key while the character is still animating to a previous target lane, the new input is queued and applied as soon as the current animation completes. Only one pending input is buffered; further inputs during the same animation overwrite the buffered one.
- **Window/tab loses focus**: When the page loses focus, the run pauses and an overlay invites the player to tap or press a key to resume. Inputs that arrived while paused are discarded.
- **Very rapid alternating taps**: Repeatedly pressing Left/Right faster than the animation duration must not place the character outside the three lanes or in a partial-lane state at rest.
- **Touch + keyboard at the same time**: If both a key press and a swipe complete within a small debounce window (~50 ms) and would both trigger a lane change in the same direction, only one lane change occurs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST present a start screen that the player can dismiss with any keyboard key, mouse click, or touch tap to begin a run.
- **FR-002**: When a run begins, the character MUST appear in the centre of the three lanes and the world MUST begin scrolling toward the player at a constant configured speed.
- **FR-003**: The player character MUST always be visually in exactly one of three lane positions (or animating between two adjacent ones); it MUST never come to rest off-lane.
- **FR-004**: A single keyboard event (Left Arrow, 'A', Right Arrow, or 'D') MUST move the character one lane in the corresponding direction, unless it is already at the leftmost (for left) or rightmost (for right) lane.
- **FR-005**: A horizontal touch swipe gesture (≥ 30 px horizontal displacement, completed within 500 ms, horizontal component at least twice the vertical component) MUST move the character one lane in the swipe direction, subject to the same lane-boundary rule.
- **FR-006**: Holding a directional key down MUST produce at most one lane change per press - the player MUST release and press again to move another lane. Keyboard auto-repeat MUST NOT trigger additional lane changes.
- **FR-007**: A lane-change animation MUST complete in under 250 ms on desktop and under 350 ms on a 3-year-old mobile device, measured from input acceptance to the character visually centred in the new lane.
- **FR-008**: While a lane-change animation is in flight, a new lane-change input in either direction MUST be buffered (one slot, last-write-wins) and applied immediately when the current animation completes.
- **FR-009**: The world/track MUST visually scroll past the player at the configured run speed; the player character MUST remain at a fixed Y screen position throughout the run.
- **FR-010**: The run MUST be endless: there is no fail state, game-over screen, or fixed end condition in this slice. Distance travelled accrues continuously over wall-clock time spent in the run.
- **FR-011**: When the browser tab/window loses focus, the run MUST pause: the world stops scrolling, inputs are not consumed, and an overlay invites the player to resume. Resuming any focus-receiving event (key press, click, tap) MUST continue the run from the same state.
- **FR-012**: The game MUST be playable, with no installation required, in current versions of major desktop and mobile web browsers (Chrome, Firefox, Safari, Edge).
- **FR-013**: All UI text shown in this slice (e.g., start screen prompt, paused overlay) MUST remain legible on screens as small as 320 px wide.

### Key Entities

- **Player Character**: The on-screen avatar the player controls. Holds *current lane* (left | centre | right), *movement state* (idle in a lane | animating to a target lane), and an *animation progress* value used to interpolate position.
- **Track / World**: The scrolling environment surrounding the player. Holds the run's *speed* (units per second), *elapsed distance*, and the three lane X-positions on screen.
- **Input Event**: A normalised representation of a player intent. Holds *source* (keyboard | touch), *direction* (left | right), and a *timestamp*. Multiple raw events that resolve to the same lane-change intent within the debounce window are coalesced into one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new player, with no instructions beyond what the start screen shows, can begin a run and successfully switch into both the left and right lanes within their first 10 seconds of play.
- **SC-002**: A lane change initiated by player input completes (character visually centred in the target lane) within 250 ms on a typical desktop and within 350 ms on a 3-year-old mid-range mobile device.
- **SC-003**: During informal play testing, 9 out of 10 testers describe the lane-switching feel as "responsive" or "snappy" rather than "laggy", "sticky", or "missed inputs".
- **SC-004**: The game sustains visually smooth motion (no perceived stutter longer than 100 ms) over a continuous 60-second run on the target hardware classes (typical desktop and 3-year-old mobile).
- **SC-005**: Across a sample of 20 horizontal swipe gestures performed by a single tester on at least one mobile browser (iOS Safari or Android Chrome), at least 90 % are correctly recognised as a lane change, and no more than 2 in 20 deliberately-vertical swipes are misrecognised as lane changes.
- **SC-006**: When a tester holds either directional key continuously for at least 5 seconds, the character changes lane exactly once and does not skip past the lane boundary.
- **SC-007**: Loading the game over a typical broadband connection delivers a playable start screen within 3 seconds.

## Assumptions

- The visual style of the player character, the track, and the surrounding environment is unspecified in this slice; placeholder shapes/colours that allow the player to perceive their lane and forward motion are acceptable.
- Run speed is a fixed constant for this slice; speed ramps and difficulty curves are deferred to a later slice.
- Distance travelled accrues internally but is NOT shown to the player in this slice; the user explicitly excluded any scoring/UI.
- Audio is out of scope for this slice; the game ships silent.
- On window/tab blur, the default behaviour is to pause and require an input to resume (chosen because uninterrupted play with no visible window risks "the run drifted while I wasn't looking").
- Mid-animation input is buffered (one slot) rather than discarded, on the judgement that buffering matches player expectations from comparable endless-runner games and produces a more forgiving feel. If informal testing shows this causes "over-shooting" complaints, it can be changed to "ignore mid-animation inputs" without changing other behaviour.
- Touch swipe thresholds (≥ 30 px horizontal, < 500 ms, horizontal-dominant) are reasonable defaults derived from common mobile gesture libraries; they can be tuned during informal play testing.
- Keyboard auto-repeat is treated as held-key behaviour and suppressed; only the initial keydown counts as input.
- The build is delivered as a static web page reachable via a single URL; no account, login, or backend service is required to play.
