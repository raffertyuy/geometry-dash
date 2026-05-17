# Feature Specification: Problem Gates with Lives and Multi-strike Game Over

**Feature Branch**: `005-problem-gates`

**Created**: 2026-05-17

**Status**: Draft

**Input**: User description: "Instead of geometry gates, I want to call these **problem gates**. The game currently has obstacles, with empty lanes alongside them. I want us to generate problem gates in these empty lanes — placement is random, so there will occasionally still be an empty lane. Only `O O O` (all three lanes blocked by obstacles) is disallowed. Problem gates are glowing, floating Rubik's-cube-style meshes in a single muted colour: green = B (basic), orange = M (medium), red = A (advanced); the aesthetic reads as a power-up, not a warning. On collision the run pauses and a modal popup appears with a geometry problem at the top and three answer choices below, selectable by arrow keys / WASD + Enter, mouse, or touch tap. The world (timer, score, scrolling, escalation) is frozen while the modal is open. Correct answer = +points with a green floating `+N` animation on the score readout; wrong answer = -points with a red floating `-N` animation AND -1 life. Magnitudes: B = ±1,000, M = ±5,000, A = ±10,000. The player starts each run with 3 lives, shown as three geometric-shaped red hearts at the top of the HUD; consumed hearts switch from filled to outlined. Obstacle collisions also cost 1 life and respawn the runner in the centre lane, blinking and invincible for 3 seconds. Two game-over conditions: (a) all 3 lives lost, or (b) score drops below zero. Placeholder problems for now — real geometry diagrams and equation typesetting come in a later slice."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Answer problem gates to win or lose big chunks of score (Priority: P1)

A player is mid-run, dodging the familiar Tron-coloured obstacle blocks, when a glowing muted-green Rubik's-cube shape floats into view in the lane next to an obstacle. They steer into it. The world freezes; a modal panel appears in the centre of the screen with a geometry problem at the top and three answer choices below. The player picks the right answer with arrow keys + Enter; the modal closes, the world resumes, and a green "+1,000" floats up from the score readout. A few seconds later they hit an orange cube, choose the wrong answer this time, and a red "-5,000" drifts up from the score while one of the hearts in their HUD switches from filled to outlined.

**Why this priority**: This is the slice's defining mechanic. Without spawning, the modal, scoring on answer, and the floating animation, the slice ships nothing observable to the player. P2 (lives) is the supporting scaffolding for the wrong-answer penalty in this story; P3 (game-over rules) refines when the run ends. Story 1 is the centrepiece.

**Independent Test**: Play a single run, encounter at least one B / M / A problem gate, collide with it, verify the modal appears and the world is frozen (timer, score-ticking, scrolling, escalation all paused). Answer once correctly and once incorrectly across the run; verify a green "+N" floats from the score for a correct answer and a red "-N" for a wrong one, with N matching the gate's difficulty value (1,000 / 5,000 / 10,000). Verify mouse-click and touch-tap selection both close the modal the same way arrow + Enter does.

**Acceptance Scenarios**:

1. **Given** the obstacle generator emits a row with 0, 1, or 2 obstacle lanes, **When** the spawner runs, **Then** each non-obstacle lane independently becomes either empty, a B gate, an M gate, or an A gate.
2. **Given** the existing obstacle invariant, **When** the spawner runs, **Then** no row ever has 3 obstacles (`O O O` forbidden, unchanged from slice 003).
3. **Given** a problem gate is in the player's effective lane, **When** the gate reaches the player's track position, **Then** the world freezes (`tickMs` and scrolling pause, the per-100 ms score tick suspends, escalation does not advance) and the modal opens with the gate's problem text and three answer choices visible.
4. **Given** the modal is open, **When** the player presses left, right, up, or down (or A / W / D / S), **Then** the highlighted answer choice changes; **When** they press Enter, **Then** the highlighted answer commits.
5. **Given** the modal is open, **When** the player clicks an answer with a mouse OR taps it on a touch screen, **Then** that answer commits immediately (without a separate Enter press).
6. **Given** the modal commits the correct answer, **When** the result resolves, **Then** the modal closes, the world resumes from the same instant it paused, the cumulative score increases by the difficulty's reward (B = 1,000 / M = 5,000 / A = 10,000), and a green "+N" floating-text animation appears at the score readout and fades upward.
7. **Given** the modal commits an incorrect answer, **When** the result resolves, **Then** the modal closes, the world resumes, the cumulative score decreases by the same magnitude, a red "-N" floats up from the score readout, AND one life is consumed.
8. **Given** the world has resumed after answering a problem gate, **When** the next 100 ms tick fires, **Then** the score-ticking and the escalation timer resume from exactly where they froze (the modal-open interval does not count toward elapsed running time).
9. **Given** a B / M / A gate is on screen, **When** the player observes it, **Then** it is a single Rubik's-cube-style mesh (a subdivided cube with a visible 3×3 face grid), glowing, in muted green / orange / red respectively — readably distinct from the more saturated Tron-coloured obstacles in the same scene.

---

### User Story 2 - Three lives and a grace window soften the obstacle game (Priority: P2)

A player begins a run and sees three red heart icons at the top of the HUD. They take a sloppy line and collide with an obstacle; one heart switches to outlined, the runner reappears in the centre lane, and the runner figure blinks for three seconds — obstacles passing through during that window cause no harm. After three life-costing events (any mix of obstacle collisions and wrong answers), the run ends from depleted hearts.

**Why this priority**: Lives are mandatory scaffolding for the wrong-answer penalty in Story 1, but they also stand alone as a meaningful tuning improvement on the existing obstacle game from slice 003 — even without problem gates, "three strikes plus a grace period" is materially different from "one mistake and done". This story could ship in isolation as a difficulty-relaxing tweak.

**Independent Test**: Start a run, ignore problem gates if any are on screen, deliberately collide with obstacles three times spaced more than 3 seconds apart. Observe: each collision flips one HUD heart from filled to outlined and respawns the runner in the centre lane with a visible 3-second blinking + invincibility window during which obstacles cause no harm. On the third collision the run ends; on restart, all three hearts return filled.

**Acceptance Scenarios**:

1. **Given** a fresh run begins, **When** the HUD draws, **Then** three filled red heart icons appear at the top of the screen.
2. **Given** the runner collides with an obstacle while no invincibility window is active, **When** the collision resolves, **Then** one heart in the HUD changes from filled to outlined, the runner is repositioned to the centre lane, and the run continues.
3. **Given** a post-collision respawn has just happened, **When** the next 3 seconds of game time elapse, **Then** the runner figure visibly blinks (alternating visible and dim, or visible and hidden) AND both obstacle collisions and problem-gate collisions during this window are ignored — no further heart consumed, no further respawn, no modal opened, no score awarded or deducted.
4. **Given** the 3-second invincibility window expires, **When** the next obstacle reaches the runner's lane, **Then** a normal collision occurs (one heart consumed, respawn in centre, new 3-second blink window).
5. **Given** the player has exactly 1 heart remaining, **When** an obstacle collision OR a wrong gate answer occurs, **Then** the run ends immediately with the game-over overlay visible.
6. **Given** a run ends and the player presses any key or taps to restart, **When** the new run begins, **Then** three filled hearts appear in the HUD and the runner is in the centre lane with no pre-armed invincibility.

---

### User Story 3 - The run ends when lives OR score run out (Priority: P3)

The player has accumulated 700 points and 2 hearts remaining when they hit an M gate. They answer wrong; their score drops to -4,300. Even though they still have a heart left, the run ends immediately because the score went below zero. The game-over overlay shows the negative final score, making the rule visible.

**Why this priority**: A second ending condition adds strategic depth to gate-difficulty selection — players quickly learn that risky A gates (±10,000) early in a run are a much bigger bet than they look. It's small in implementation but distinct enough in player-visible behaviour to merit its own story; it also documents the user's explicit "two ways to lose" requirement.

**Independent Test**: Start a fresh run and immediately approach the first M or A problem gate before earning much score (under 30 seconds in, so the natural tick has only awarded ~300 points). Answer wrong. Verify the run ends and the game-over overlay shows a negative final score (e.g., "-4,300" or "-9,300") even though hearts remain.

**Acceptance Scenarios**:

1. **Given** the player has hearts remaining, **When** their score drops below zero from a wrong-answer penalty, **Then** the run ends immediately with the game-over overlay.
2. **Given** the run ended via score-below-zero, **When** the game-over overlay shows the final score, **Then** the displayed value is the negative number (no clamping to zero).
3. **Given** the player has 0 hearts remaining (from any combination of obstacle collisions and wrong answers), **When** any further life-costing event would occur OR has just occurred, **Then** the run ends immediately.
4. **Given** the natural per-100 ms score tick is always additive, **When** the player runs without hitting any gate, **Then** the run NEVER ends from score-below-zero — only wrong-answer penalties can drive the score below zero.
5. **Given** a game-over from either condition, **When** the player restarts, **Then** lives reset to 3 and the cumulative score resets to 0.

---

### Edge Cases

- **A problem gate is in the lane the player respawns into after an obstacle collision.** The world is already running at the moment of respawn, so the gate continues to scroll toward the player. The runner is in the centre lane, blinking and invincible to *both obstacles and gates*; the gate passes harmlessly through, the modal does not open, and no score is awarded or deducted. After the 3-second window expires, normal collision rules resume on any subsequent gate or obstacle.
- **A row has all three lanes blocked by gates** (e.g., `A A A` or `B M A`). The player MUST hit one — no avoidance is possible. Spec-compliant: the player commits to whichever lane they're in (or steer to) and accepts the answer challenge.
- **A wrong answer drops the score below zero AND consumes the last heart simultaneously.** Both game-over conditions trigger; the final overlay is the same either way. The displayed final score is the resulting negative number.
- **The player switches lanes through a gate.** The slice-003 lane-cross rule applies: the player's effective lane during a lane-change is the source lane until 50 % progress and the target lane from 50 % onward. A gate in the half-passed target lane fires the modal only after the lane-change crosses the halfway point.
- **Two same-colour gates appear side-by-side in adjacent lanes** (e.g., a row spawns `B B _`). They look like one wide mesh from a distance but are independent collidables — hitting one fires its own modal; the other can be re-encountered (or avoided) on the same frame depending on lane.
- **The modal opens just as the player switches browser tabs.** Tab-blur produces the usual pause; on return, the pause continues until any input. Since the modal already freezes the world, the tab-blur pause is effectively redundant — the modal still requires an answer to dismiss.
- **The 3-second invincibility blink expires while the runner is still overlapping an obstacle's volume** (e.g., the runner respawned into a centre lane that still had a wide bar mid-sweep). The next frame's collision check fires; one heart is consumed; the runner respawns in the centre lane again with a fresh 3-second invincibility window. Chain collisions are rare given typical spawn cadence but allowed by the rules.
- **The lifetime of an unconsumed `+N` / `-N` floating animation outlives the run** (the player dies while a floating animation is still fading). The animation completes its fade on top of the game-over overlay, then disappears; it does not block restart input.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: For every row produced by the existing obstacle generator, the spawner MUST additionally select an independent per-lane choice from `{empty, B problem gate, M problem gate, A problem gate}` for every lane in that row that is NOT occupied by an obstacle. The obstacle-occupied lanes are unchanged.
- **FR-002**: The per-lane outcome MUST be sampled independently and uniformly at random from `{empty, B, M, A}` for each non-obstacle lane. No balancing or variety constraint is imposed: any resulting row is valid, including all-same-difficulty rows (`A A A`, `B B B`, `M M M`), mixed rows (`B M A`), and (rarely, under uniform sampling) all-empty rows (`_ _ _`). The only forbidden row remains `O O O`, which the existing obstacle invariant already prevents.
- **FR-003**: A problem gate MUST render as a single subdivided-cube (Rubik's-cube-style) mesh — a cube whose faces show a visible 3×3 grid — glowing, in **muted** green (B), muted orange (M), or muted red (A). The palette MUST read as power-up / collectible rather than warning signal, distinctly less saturated than the bright Tron-coloured obstacles in the same scene.
- **FR-004**: A problem gate MUST occupy exactly one lane. Multi-lane gates are out of scope for this slice.
- **FR-005**: When the runner's effective lane (per the slice-003 lane-cross rule) overlaps a problem gate at the moment the gate reaches the runner's track position, the run state MUST transition into a "modal-open" state in which all of the following are true:
  - `tickMs` does NOT advance.
  - The world does NOT scroll (obstacles, gates, ground rungs, trail all stay still).
  - The per-100 ms score tick does NOT fire.
  - The escalation tier does NOT progress.
  - Lane-change input does NOT move the runner.
  - The modal panel is visible and on top of the running scene.
- **FR-006**: The modal panel MUST display the problem gate's problem text at the top and three answer choices below. Selection MUST be supported via all three of:
  - Keyboard: arrow keys (or A / W / D / S) to highlight an answer; Enter to commit.
  - Mouse: a single click on any answer commits it immediately.
  - Touch: a single tap on any answer commits it immediately.
- **FR-007**: When an answer is committed correctly, the modal MUST close, the world MUST resume from the same instant it paused, the displayed cumulative score MUST increase by the difficulty's reward value (1,000 for B; 5,000 for M; 10,000 for A), AND a green "+N" floating-text animation MUST appear at the score readout and fade upward over ~1 second before disappearing.
- **FR-008**: When an answer is committed incorrectly, the modal MUST close, the world MUST resume, the displayed cumulative score MUST decrease by the same magnitude as the reward, a red "-N" floating-text animation MUST appear at the score readout and fade upward, AND one life MUST be deducted.
- **FR-009**: The player MUST begin every run with exactly **3 lives**. Lives MUST be displayed at the top of the HUD as three heart-shaped icons in red, rendered with a faceted / geometric silhouette consistent with the Tron visual language. A live heart is filled; a consumed heart is outlined (transparent fill, glowing outline retained).
- **FR-010**: Obstacle collisions MUST now deduct one life and trigger a respawn instead of ending the run directly. On a non-final-life obstacle collision: the runner is repositioned to the centre lane immediately, enters a 3-second invincibility window, and the run continues. (Game-over only fires from an obstacle collision when the deducted life was the player's last — see FR-013.)
- **FR-011**: During the post-respawn invincibility window the runner figure MUST visibly blink (alternating visible / dim, or visible / hidden, at a perceptible cadence). Obstacle collisions during this window MUST NOT be registered: no life is deducted, no further respawn occurs, and the runner passes through any obstacle mesh harmlessly.
- **FR-012**: The post-respawn invincibility window applies to **both obstacle and problem-gate collisions**. During the window: obstacles pass harmlessly through the runner; problem gates ALSO pass harmlessly through — the modal does NOT open, no score is awarded for the skipped gate, no penalty is applied, and no life is consumed. A gate that has passed the runner's track position during invincibility is treated as consumed (despawns normally) and is not re-presented later.
- **FR-013**: A game-over MUST be triggered immediately when **either** of these conditions becomes true:
  - The life count reaches 0 (from any combination of obstacle collisions and wrong answers).
  - The displayed cumulative score drops below 0 (from a wrong-answer penalty).
- **FR-014**: The natural per-100 ms score tick MUST always be additive (positive). The displayed cumulative score MUST NOT be brought to or below zero by ticking alone — only wrong-answer penalties can drive it below zero.
- **FR-015**: When game-over fires from the score-below-zero condition, the game-over overlay MUST display the actual negative final score (e.g., "Final score: -4,300"). Clamping the displayed value to zero is forbidden.
- **FR-016**: On restart from game-over, all of the following MUST happen: lives reset to 3; cumulative score resets to 0; all on-screen problem gates and obstacles despawn (extending the slice-003 obstacle-despawn behaviour to also cover gates); the runner is in the centre lane with no lane-change in flight; the invincibility window is inactive (the new runner is not pre-armed with invincibility).
- **FR-017**: Project documentation MUST be updated to reflect that the question-bearing collidables introduced in this slice are called **"problem gates"** (not "geometry gates"). At minimum, `CLAUDE.md` and `README.md` MUST use this terminology going forward. Internal module naming (e.g., a `problem-gates/` source folder) is a planning-level decision, not a spec requirement.

### Key Entities *(include if feature involves data)*

- **Problem Gate**: A single-lane collidable that, when struck, triggers the answer modal. Holds *track position* (z), *occupied lane* (one of `left` / `centre` / `right`), *difficulty* (`B` / `M` / `A`), and a *problem reference* (an index into the placeholder problem pool, or the literal problem payload).
- **Problem (placeholder)**: A unit of question content. Holds *prompt text*, *three answer choices*, and *which choice is correct*. The first slice uses a small hand-authored pool; a future slice will introduce real geometry problems with diagrams and equation typesetting.
- **Lives Counter**: A non-negative integer in `{0, 1, 2, 3}`. Initialised to 3 on run start; decremented by 1 on obstacle collision (outside invincibility) and on wrong gate answer; transitions the run to game-over at zero. Visible in the HUD as three heart icons.
- **Invincibility Timer**: A countdown in milliseconds. Set to 3000 on respawn-from-obstacle-collision, decreases with `tickMs`, suppresses obstacle collisions while > 0. Reset to 0 on run start.
- **Floating Score Animation**: A transient HUD element spawned at each answer event. Holds *text* (e.g., "+1000" or "-5000"), *colour* (green or red), and *age in ms* so it can translate upward and fade out over its ~1-second lifetime. Removed once age exceeds the lifetime.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across a 60-second run with normal-paced play, the player encounters problem gates in at least 5 distinct spawn rows.
- **SC-002**: A correct answer on a B gate raises the displayed cumulative score by exactly 1,000 in 100 % of observed cases (matching values for M = 5,000 and A = 10,000).
- **SC-003**: A wrong answer on an M gate lowers the displayed cumulative score by exactly 5,000 AND consumes exactly one heart from the HUD in 100 % of observed cases.
- **SC-004**: During the post-respawn 3-second blink window, both obstacles and problem gates that would otherwise interact with the runner are observed to pass harmlessly through (no life consumed, no modal opened, no score change) in 100 % of in-window encounters.
- **SC-005**: After three obstacle collisions in a single run, each separated by at least 3 seconds so their invincibility windows don't overlap, the run ends within 200 ms of the third collision and the game-over overlay shows three outlined hearts.
- **SC-006**: A player at a +700 score who answers an M gate incorrectly sees the game-over overlay within 200 ms with a final-score display of "-4300" (or equivalent negative value), even though hearts remain.
- **SC-007**: While the modal is open, the timer display, the cumulative-score readout, and the visible scroll of the world remain frozen for the full duration the modal is on screen (verifiable by reading the timer pre-modal and post-modal and confirming the gap is zero).
- **SC-008**: Arrow-key + Enter, mouse-click, and touch-tap answer selection all close the modal and resolve the answer identically — no method is faster, more reliable, or feels "newer" than the others to a tester running them side by side.
- **SC-009**: The per-lane difficulty selection is uniform random with no balancing constraint applied — any output row is valid output (`A A A`, `B B B`, `_ B _`, `M A B`, etc.). Across 100 sampled non-obstacle lanes, the observed frequency of each outcome in `{empty, B, M, A}` deviates by less than ~10 percentage points from the expected 25 % (a consistency check on the sampler, NOT a constraint on any single run).
- **SC-010**: A new tester, given the game without prior briefing, identifies "I have 3 lives and there are two ways to lose" within their first three runs (informal: 9 of 10 testers describe both rules unprompted after playing).

## Assumptions

- **Difficulty distribution**: each non-obstacle lane is sampled independently and uniformly at random from `{empty, B, M, A}`. The spec imposes no balancing or variety constraint — all-same-difficulty rows (`A A A`, `B B B`, `M M M`) and rare all-empty rows are valid output. Tier-aware difficulty curves (e.g., more A gates at higher escalation tiers) are deferred to a later slice.
- **Invincibility absorbs problem gates as well as obstacles.** During the 3-second post-collision window, gates in the runner's lane pass harmlessly through: the modal does not open, no score is awarded for the skipped gate, no penalty is applied. Side effect: a player can in principle take a deliberate obstacle hit to skip a feared A gate they're heading toward — but at the cost of −1 heart it's a strategic tradeoff, not a degenerate exploit (the lives budget is too tight to chain it indefinitely).
- **Heart icon shape**: a faceted / low-poly heart silhouette in red, drawn as a flat HUD element (not a 3D mesh) so it reads at any screen size. Tron aesthetic carries over: a thin glowing outline plus a solid red fill when alive, the same outline + transparent fill when consumed.
- **Floating "+N" / "-N" animation**: spawns at the score readout's screen position, translates ~50–80 pixels upward, fades from full opacity to zero, and completes in ~1 second total. Green matches the existing HUD's "positive" green tone; red matches the heart-icon red.
- **Modal answer-selection initial focus**: the first (left-most or top-most) answer choice is highlighted by default. Highlighted means a visible outline or brighter background; selection commits on Enter / click / tap.
- **Modal input capture**: while the modal is open, arrow keys / WASD do NOT move the runner — they navigate the answer-choice highlight. Mouse and touch events outside the modal area are ignored. Tab-blur still pauses the run, but since the modal already freezes the world the redundant pause-overlay is suppressed.
- **Placeholder problems are text-only.** A small hand-authored pool per difficulty (~10–20 entries per difficulty) exercises the right vs. wrong code paths without diagrams or equations. A future slice will introduce real geometry problems, SVG diagram primitives, and equation typesetting (likely a math-rendering library such as KaTeX or MathJax).
- **Visual coexistence with existing obstacles**: bright saturated Tron-coloured obstacle blocks (slice 003) and muted Rubik's-cube-style problem gates (this slice) must read as visually distinct categories at first glance. The muted-vs-saturated palette difference is the primary distinguisher; the subdivided 3×3 face grid on gate cubes is the secondary one.
- **Tier-aware difficulty curve is deferred** — the B / M / A selection in this slice is independent of the current escalation tier from slice 004. Tying difficulty to tier (e.g., more A gates at tier 5+) is a later polish slice.
- **No persistence** — best score, best lives remaining, best surviving-tier across runs are NOT stored. Every run starts fresh at 3 lives, 0 score, tier 0.
- **No audio cues** for life lost / right answer / wrong answer in this slice. The game remains silent.
- **No combo / streak / multiplier scoring**. Each answer is independent and resolves to the flat ±1,000 / ±5,000 / ±10,000 value.
- **Tier escalation is paused while the modal is open** — `tickMs` doesn't advance, so the 30-second tier boundary is naturally postponed by the time the modal sits on screen. This matches how tab-blur pauses interact with escalation today.
- **Game-over from score-below-zero displays the negative score** in the overlay — clamping would hide the rule from the player and obscure why the run ended.
- **Terminology**: this slice replaces "geometry gates" with "problem gates" in user-facing documentation (CLAUDE.md, README) because the gate content may later be algebra, arithmetic, or other problem types, not strictly geometry.
