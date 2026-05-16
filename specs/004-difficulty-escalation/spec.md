# Feature Specification: Difficulty Escalation by Tier

**Feature Branch**: `004-difficulty-escalation`

**Created**: 2026-05-16

**Status**: Draft

**Input**: User description: "I want it to everything 10% faster every 30 seconds, that also means that every 30 seconds the score per 0.1 seconds increases by +1 per increment (e.g. on 31-60 seconds, each 0.1 seconds is 2 points, on 61-90 seconds, each 0.1 seconds is 3 points, and so on..)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The run gets faster and more rewarding every 30 seconds (Priority: P1)

A player begins a run at the baseline speed and watches their score tick up at the familiar rate (one point every tenth of a second). After 30 continuous seconds, the world visibly speeds up - obstacles and scenery now pass roughly 10 % faster than before - and their score readout starts ticking up twice as fast as it did at the start. After another 30 seconds, things speed up by another 10 % and the score increment rate jumps to three points per tenth of a second. The pattern continues for as long as the run lasts, raising both stakes and reward in step.

**Why this priority**: This is the entire feature. Speed and score are two halves of the same difficulty curve - faster gameplay is more difficult to survive and rewarding the player for surviving it scales the meaningful chase number. Splitting them would not produce a coherent slice. This is also the slice that turns the obstacle-dodging game (003) from a constant-difficulty exercise into a progression with a real endgame.

**Independent Test**: Open the build, start a run, and look at the timer and score readouts. Verify: at 0-30 s, the score advances by 1 point every 0.1 s (~10 points per second). At exactly 30 s, the world visibly accelerates and the score starts advancing by 2 points every 0.1 s (~20 points per second). At 60 s the world speeds up again and the score advances by 3 / 0.1 s. The pattern continues. Pause for any duration mid-run; on resume, the tier remains the same as it was when the pause began (paused time does NOT count toward the next tier boundary). Restart from game-over; the new run begins at the baseline speed and the slowest score rate.

**Acceptance Scenarios**:

1. **Given** a fresh run is just beginning, **When** the player observes the score ticking up for the first 30 seconds, **Then** the score advances by approximately 10 points per second (1 point every 0.1 s), in a steady cadence.
2. **Given** a run that has been continuously active for slightly over 30 seconds, **When** the player observes the score, **Then** the score now advances by approximately 20 points per second (2 points every 0.1 s).
3. **Given** the same run continuously active for slightly over 60 seconds, **When** the player observes the score, **Then** the score advances by approximately 30 points per second.
4. **Given** the run just crossed the 30-second mark, **When** the player observes the moving world (obstacles, ground stripes, trail), **Then** everything visibly scrolls past faster than before; the speed-up is roughly 10 % at the 30 s boundary and another 10 % at each subsequent 30 s boundary.
5. **Given** a run that has reached the 30-second mark, **When** the player pauses for any amount of time and then resumes, **Then** on resume the tier is unchanged from when the pause began, and the score continues to climb at the rate appropriate for that tier.
6. **Given** a run ends from a collision and the player presses any key to restart, **When** the new run begins, **Then** the speed is back at the baseline AND the score increment rate is back at 1 point per 0.1 s.
7. **Given** the player observes the cumulative score at the moment a tier boundary is crossed, **When** they compare against the expected total, **Then** the score equals the expected sum of all per-tier contributions (300 from tier 0 at 30 s, +600 from tier 1 at 60 s, +900 from tier 2 at 90 s, etc.).

---

### Edge Cases

- **Player crosses a tier boundary mid-frame**: The 100-millisecond score increments that fired before the boundary use the OLD tier's rate; increments that fire after the boundary use the NEW tier's rate. No partial-tick "half credit" - each increment counts at exactly one tier's rate.
- **Player pauses immediately before a tier boundary**: When they resume, the tickMs counter continues from where it left off. The tier transition happens at whatever wall-clock moment that pause-corrected tickMs reaches 30 000 ms - not at the wall-clock 30 s mark.
- **Player dies on the tier-boundary moment**: The final score correctly reflects whichever tier the player was in at the instant of the collision. If they hit the wall at exactly 30 000 ms, they are in tier 1 (since tier 1 begins at tickMs >= 30 000).
- **Player runs for a very long time** (hundreds of seconds): The tier just keeps climbing. There is no upper bound and no special behaviour at "round" tier numbers. Speed compounds 1.10x per tier, so by tier 20 the world is roughly 6.7x faster than baseline and by tier 40 it is about 45x faster - effectively unplayable, by design.
- **Score precision over a very long run**: After ~1 000 tiers (about 8 hours of continuous running) the score still uses ordinary integers. There is no overflow risk and no rounding at any threshold visible to the player.
- **Tab blur during a tier**: Same as any pause - tickMs freezes, and the tier does not advance. On return + resume input, the tier picks up where it left off.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST maintain a notion of the current "difficulty tier" derived from the elapsed running time since the current run began.
- **FR-002**: Tier 0 MUST be active for the first 30 000 milliseconds of elapsed running time (from 0 ms up to but not including 30 000 ms). Tier 1 MUST be active from 30 000 ms up to but not including 60 000 ms. Generally, tier N MUST be active from `N * 30 000 ms` up to but not including `(N + 1) * 30 000 ms`.
- **FR-003**: The run speed in tier N MUST equal the baseline run speed multiplied by `1.10` raised to the power `N`. Tier 0: baseline. Tier 1: baseline x 1.10. Tier 2: baseline x 1.21. Tier 3: baseline x 1.331. And so on, with no upper bound.
- **FR-004**: The score increment per 100 millisecond interval in tier N MUST equal `N + 1` points. Tier 0: 1 point / 0.1 s. Tier 1: 2 points / 0.1 s. Tier 2: 3 points / 0.1 s. Tier N: `N + 1` points / 0.1 s.
- **FR-005**: The displayed cumulative score at any moment MUST equal the sum of all per-tier score contributions up to that moment, where each 100-millisecond tick contributes the rate appropriate to the tier it fell in.
- **FR-006**: The tier MUST NOT advance while the game is in the `paused` or `game-over` state. The tier value is a pure function of `elapsed running time` (the existing `tickMs` counter), which already freezes outside of `running`.
- **FR-007**: On restart from `game-over`, the tier MUST return to 0 and the run speed and score increment rate MUST return to their tier-0 values. (This is automatic if tickMs returns to 0 on restart - which it already does.)
- **FR-008**: The speed transition between adjacent tiers MUST be instantaneous - the world does not gradually accelerate; at one frame the speed is `baseline * 1.10^N`, at the next it is `baseline * 1.10^(N+1)`.
- **FR-009**: The score increment-rate transition between adjacent tiers MUST be instantaneous - one 100-millisecond tick adds `N + 1` points, the next adds `N + 2` points if the second one occurred after the boundary.
- **FR-010**: The timer display MUST continue to show real elapsed running time (the existing `M:SS` / `MM:SS` format from the scoring HUD slice), unaffected by speed scaling. Speed scaling alters how far the world has scrolled and how fast the score climbs - it does NOT alter the clock.

### Key Entities

- **Difficulty Tier**: A non-negative integer that names the current "level" of escalation. Derived from `tickMs` as `floor(tickMs / 30 000)`. Determines both the run-speed multiplier (`1.10 ^ tier`) and the per-100-millisecond score increment (`tier + 1`).

No new persistent state is introduced. The tier is a pure derived value from the existing `WorldState.tickMs` (already maintained by the runner-engine and already paused/reset correctly for this slice's purposes).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new player can identify that the run got faster within five seconds of crossing a tier boundary (informal: 9 out of 10 testers report "it sped up" without prompting).
- **SC-002**: At exactly 10 seconds of continuous running, the displayed score reads `100` (+/- 2) - same as the baseline established in slice 002.
- **SC-003**: At exactly 30 seconds of continuous running, the displayed score reads `300` (+/- 2).
- **SC-004**: At exactly 35 seconds of continuous running, the displayed score reads `400` (+/- 2). (300 from tier 0 fully + 5 s of tier 1 at 20 pts/s = 300 + 100 = 400.)
- **SC-005**: At exactly 60 seconds of continuous running, the displayed score reads `900` (+/- 2). (300 + 600.)
- **SC-006**: At exactly 90 seconds of continuous running, the displayed score reads `1800` (+/- 2). (300 + 600 + 900.)
- **SC-007**: Across a 60-second run with a 10-second pause inserted at the 25-second mark, the displayed tier on resume equals the displayed tier at pause; both readings correspond to tier 0 (since 25 s < 30 s and the 10 s of paused time did NOT accumulate).
- **SC-008**: After a game-over and a restart, the first 30 seconds of the new run produces a score increment rate of 1 point per 0.1 s, NOT carried over from the previous run.
- **SC-009**: The visible scroll speed of the world (rate at which ground stripes / track rungs pass by) measurably increases by approximately 10 % at each tier boundary (verifiable by counting rungs-per-second in screen recordings before and after the 30-second mark).

## Assumptions

- The speed and score escalation kicks in instantaneously at each tier boundary - no warning, no animation, no "Tier 2!" announcement on screen. Adding a visual or audio indicator is deferred to a polish slice.
- There is no upper bound on the tier. The game can run forever; by tier ~20 the world will be effectively unplayable (~6.7x baseline speed), which the design accepts as the natural endgame.
- The obstacle spawn gap (`OBSTACLES_MIN_GAP` = 14 world units) is NOT scaled down with the tier. The fixed gap was calibrated against the baseline run speed for a worst-case two-lane dodge; at higher tiers the player has proportionally less reaction time per obstacle, which is the design intent.
- The lane-switch animation duration (`LANE_SWITCH_DURATION_MS` = 200 ms) is NOT scaled with the tier. Lane changes take the same wall-clock time at every tier; what changes is how much world distance the player has covered during a lane change.
- The trail behind the runner, the scrolling rungs, the speed lines, and any other distance-driven scenery automatically inherit the new speed because they all derive their motion from `world.distanceUnits` (which is `tickMs * speed`).
- The score formula's piecewise-linear nature creates a small, deterministic "jump" at each tier boundary equal to one additional tick of the OLD tier's value (e.g. +1 point at the 30 s mark, +2 at the 60 s mark, etc.). This is mathematically correct (each tier accounts for 300 complete 100 ms ticks); the player will likely not notice these single-point bumps amid the per-100-ms ticking.
- No persistence: best score across runs is NOT stored anywhere in this slice. Each run starts at tier 0 with score 0.
