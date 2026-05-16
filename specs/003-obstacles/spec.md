# Feature Specification: Random Geometric Obstacles

**Feature Branch**: `003-obstacles`

**Created**: 2026-05-16

**Status**: Draft

**Input**: User description: "let's start to have random obstacles (these are not problem gates yet, but simply obstacles that need to be avoided.) The obstacles should be generated randomly, and there should always be a way for the player to avoid (meaning out of the 3 lanes, there should be at least 1 lane that is passable). Since this is a geometry dash game, the obstacles should be geometric shapes: 3d versions of squares, vertical rectangles, horizontal rectangles covering 2 lanes, circles, trapezoids, etc. the distances of the obstacles should be random, but the shortest distance should give the player enough time to move 2 lanes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dodge obstacles and die when you hit one (Priority: P1)

A player runs forward and sees geometric obstacles approaching ahead of them along the track. Each obstacle group blocks one or two of the three lanes but never all three, so a safe lane always exists. The player switches lanes to thread through the gaps. If they hit an obstacle, the run ends immediately: the world halts, the runner figure stops, and a game-over screen appears showing their final score and elapsed time. A tap or any key press from the game-over screen instantly starts a new run with everything reset.

**Why this priority**: This is the entire feature. Random spawning, collision, game over, and restart together form the smallest mechanic that turns the runner into a game with a fail state. Without any one of these four pieces (spawn, collide, game over, restart), the slice is not playable.

**Independent Test**: Open the build, begin a run, watch obstacles appear ahead, switch lanes to avoid them. Verify: at least one lane is always passable, the minimum gap between obstacles is large enough to traverse two lanes (left to right or vice versa), colliding with an obstacle stops the world and shows a game-over panel with the final score and time, and the first input after game-over starts a fresh run with score `0` and timer `0:00`.

**Acceptance Scenarios**:

1. **Given** a fresh run has just begun, **When** the player looks ahead on the track, **Then** the first obstacle group is far enough away that the player has at least one full second to identify it before it reaches them.
2. **Given** an obstacle group appears with two lanes blocked, **When** the player observes the group, **Then** exactly one of the three lanes is open (passable).
3. **Given** two consecutive obstacle groups, **When** the player measures the gap between them in time, **Then** the gap is no shorter than a window long enough for the player to traverse from the leftmost lane to the rightmost lane (or vice versa) with normal lane-switch animation.
4. **Given** the player is in a lane that an approaching obstacle does NOT block, **When** the obstacle reaches the player's position on the track, **Then** the player passes safely, the run continues, and the score and timer keep advancing.
5. **Given** the player is in a lane that an approaching obstacle DOES block, **When** the obstacle reaches the player's position on the track, **Then** the run ends within a fraction of a second: the world stops scrolling, the runner stops, and the game-over screen is visible.
6. **Given** the game-over screen is visible, **When** the player looks at it, **Then** they can read their final score and the elapsed time of the run that just ended.
7. **Given** the game-over screen is visible, **When** the player presses any key or taps the screen, **Then** a fresh run begins immediately with the score reset to `0`, the timer reset to `0:00`, the player back in the centre lane, no obstacles visible (until the first one of the new run spawns), and no return to the original title screen.
8. **Given** the game-over screen is visible, **When** the player presses a lane-change key during it, **Then** that key press is consumed by the restart (does NOT also drive a lane change in the new run).

---

### User Story 2 - Visual variety in obstacle shapes (Priority: P2)

A player on a single run encounters a mix of different 3D geometric shapes as obstacles - cubes, tall pillars, double-lane horizontal bars, cylinders, spheres, trapezoidal prisms - rather than the same shape repeating. The variety makes each run feel visually fresh and matches the "geometry dash" identity of the game.

**Why this priority**: Independent of the core dodge-and-die mechanic. A player can have a perfectly playable game (US1) with only one shape; visual variety is polish that makes the game feel like a real product. Keeping it separate also keeps the MVP slice from getting blocked on shape art.

**Independent Test**: Play a single 60-second run. Count the distinct visual shapes encountered. There MUST be at least five different recognisable geometric primitives (e.g., cube, pillar, wide bar, cylinder/sphere/dome, trapezoidal prism). The shape selection is random rather than cycled.

**Acceptance Scenarios**:

1. **Given** the player begins a run, **When** the first ten obstacle groups have spawned, **Then** at least three distinct visual shapes appear among them.
2. **Given** an obstacle group that covers two lanes, **When** the player sees it, **Then** it is rendered as a single connected horizontal bar (a wide rectangular prism), not as two side-by-side single-lane shapes - the visual reads as "this is one big obstacle".
3. **Given** an obstacle group that covers one lane, **When** the player sees it, **Then** it is rendered as one of the single-lane shape variants (cube, pillar, cylinder, sphere/dome, trapezoidal prism). The choice is random across the available variants.
4. **Given** a single run lasts long enough for at least 20 obstacle groups, **When** the player tallies the shapes used, **Then** at least five distinct shape variants appear.

---

### Edge Cases

- **The player is already in the safe lane when the obstacle reaches them.** No movement is required and the obstacle passes harmlessly; the run continues.
- **The player switches lanes immediately before an obstacle reaches them.** The collision rule uses the player's "effective lane" during a lane-change animation: while the lane-change animation is less than half-complete, the player is treated as being in the source lane; from the halfway point onward, the player is treated as being in the target lane. This rule means a player who commits to a dodge in the last moments has a fair chance to make it; it also means a player who starts a dodge but is still mostly in the old lane can still be hit if the old lane was blocked.
- **Two obstacle groups are visible on screen at once.** This is normal at high run speeds - the player can see multiple groups ahead. The minimum-gap rule guarantees they can dodge each one in sequence.
- **The player loses on the very first obstacle.** The game-over screen still appears with the partial score and short elapsed time. The run is just very short.
- **A player who never dodges.** The run will end at the first obstacle that the player happens to be in the wrong lane for (typically within ~5 seconds at the current run speed).
- **Restart input happens while the game-over screen is animating in.** The very first input received after a collision restarts the run, even if the overlay is mid-fade. No "double-input" required.
- **The same shape variant happens to appear back-to-back.** Allowed: variants are sampled with replacement. Over a long run the distribution evens out without artificial constraints.
- **The browser tab is hidden during a run.** Same as before: the run pauses, no obstacles advance, the score and timer freeze. Resume requires a focus-receiving input. (Existing pause behaviour from the lane-runner slice is unaffected.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Obstacle groups MUST spawn ahead of the player on the track at random intervals while the run state is `running`.
- **FR-002**: Each obstacle group MUST block exactly one or exactly two of the three lanes. Three-lane (impassable) groups MUST NOT spawn.
- **FR-003**: At least one lane of each obstacle group MUST remain passable, so a sufficiently skilled player can always avoid every obstacle without taking damage.
- **FR-004**: The MINIMUM gap between any two consecutive obstacle groups MUST be large enough that the player can traverse from the leftmost lane to the rightmost lane (or vice versa) at the current run speed. At the present configuration (run speed ~24 world units per second, lane-switch animation duration 200 ms), this minimum gap is approximately one full second of running (~22 world units), plus a reaction-time buffer.
- **FR-005**: The MAXIMUM gap between consecutive obstacle groups MUST be bounded so the run never has long empty stretches. Empty stretches longer than three times the minimum gap MUST NOT occur.
- **FR-006**: The first obstacle group of a new run MUST appear far enough from the player at run start that the player has at least one full second to recognise and react to it before it arrives.
- **FR-007**: Obstacles MUST be visually distinct from the player runner and from the floor grid, so the player can identify them from any reasonable viewing distance.
- **FR-008**: At least five visually distinct obstacle shape variants MUST be available. Each spawned obstacle group MUST pick its shape randomly from the variants compatible with its lane count (one-lane variants for single-lane groups; the wide horizontal bar variant for two-lane groups).
- **FR-009**: A collision MUST be detected when an obstacle group's position on the track passes through the player's position, AND the player's effective lane (per the edge-case rule) overlaps the blocked lane(s) of that group.
- **FR-010**: When a collision is detected, the run MUST transition out of `running` into a `game-over` state within 200 ms. In the `game-over` state the world stops scrolling, the runner figure stops animating its stride, the score and timer freeze at their collision-moment values, and lane-change inputs are not consumed against the (frozen) player position.
- **FR-011**: The game-over overlay MUST appear when the run enters `game-over` and MUST display the final score and the final elapsed-time value plus a prompt to restart. Its visual style MUST match the existing start-screen and pause-overlay overlays (same DOM-overlay pattern, same font family, same backdrop treatment).
- **FR-012**: From the `game-over` state, the next user input event (keyboard `keydown` or pointer `pointerdown`) MUST restart the run by performing all of: clearing every existing obstacle from the world; resetting the score and timer to zero; placing the player at the centre lane with no lane-change animation in flight; transitioning the run state to `running` (NOT back to the start screen); and beginning fresh obstacle spawning.
- **FR-013**: The restart input MUST be consumed by the restart itself and MUST NOT additionally drive a lane-change in the new run, even if it happened to be a left/right directional key.
- **FR-014**: Random distances and shape choices within a single run MUST NOT depend on persistent state from previous runs. Each new run starts with a fresh stream of randomness so a player who dies and restarts does NOT see the same exact obstacle sequence again.

### Key Entities *(include if feature involves data)*

- **Obstacle Group**: A unit of obstacle placement along the track. Holds *track position* (z), the *set of blocked lanes* (a non-empty proper subset of {`left`, `centre`, `right`}; size 1 or 2), and a *shape variant identifier* that determines its rendered appearance.
- **Obstacle Shape Variant**: A catalogue entry describing one distinct 3D primitive (e.g., "cube", "pillar", "double-lane bar", "cylinder", "sphere", "trapezoid prism"). Each variant declares whether it represents a single-lane or two-lane obstacle.
- **Spawn Schedule**: The state determining when the next obstacle group should spawn. Holds the *next-spawn z-position* (computed from the previous group's z + a random gap drawn from the allowed range) so spawning is deterministic given the random number stream.
- **Run Lifecycle (extended)**: The existing run state gains a new `game-over` value alongside the existing `pre-run` | `running` | `paused`. State transitions specific to this slice: `running` → `game-over` (on collision); `game-over` → `running` (on restart input).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player beginning a fresh run can identify the first obstacle group on screen before it is within one second of impact, in 100 % of observed first-obstacle spawns.
- **SC-002**: Across 20 consecutive obstacle groups in a single run, exactly 0 of them block all three lanes.
- **SC-003**: At the minimum permitted spacing, a tester who actively dodges in either direction can avoid the next obstacle group in at least 9 of 10 attempts.
- **SC-004**: Across a continuous 90-second run, the player encounters obstacles in at least 8 of the 9 ten-second intervals (no twenty-plus-second empty stretches).
- **SC-005**: In any 30-second run, an informal tester observes at least 5 distinct obstacle shape variants on screen.
- **SC-006**: When a collision happens, the game-over screen is visible to the player in under 200 ms in 100 % of observed collisions.
- **SC-007**: Restarting from the game-over screen produces a playable new run on screen within 500 ms in 100 % of observed restarts.
- **SC-008**: Across ten independent runs from a single browser session, no two runs replay the exact same obstacle sequence (shape variants and lane-blocking patterns).

## Assumptions

- The collision-edge-case rule about the player's effective lane during a lane-change animation (source lane while animation progress < 0.5, target lane from 0.5 onward) is a "fair-feel" default. It can be tightened (always source until complete) or relaxed (always target from input acceptance) in a follow-up if play testing flags it as off.
- Obstacle shapes are drawn from a fixed pre-defined catalogue. Procedurally generated obstacle geometry is out of scope - every shape that appears in this slice was authored at build time.
- The game-over overlay shows only the final score, elapsed time, and a restart prompt in this slice. A best-score tally, a "share your run" affordance, or animated end-of-run statistics are out of scope.
- Restart skips the title screen because the player has already committed to playing. Returning to the title screen would feel like noise after the first time.
- Difficulty is constant across the run. The obstacle frequency, the proportion of two-lane vs. one-lane groups, the run speed, and the lane-switch animation duration are all fixed. Difficulty escalation (faster speeds, denser obstacles, larger blocked-lane counts) is deferred to a later slice.
- No audio feedback for spawn, near-miss, or collision in this slice. The game remains silent.
- Pause behaviour from the lane-runner slice carries over unchanged: tab blur pauses the run, the next user input resumes. Obstacle scrolling and collision detection halt during pause.
- The collision check is resolved at lane granularity, not at pixel-perfect bounding boxes. A player whose torso clips a corner of an obstacle's mesh but whose effective lane is open is NOT considered to have collided.
- The game-over overlay does NOT show any spectator-mode replay of the last collision. The world simply freezes; the overlay sits on top.
