# Research: How-to-Play Modal & In-Game Pause

**Slice**: 008-how-to-play · **Date**: 2026-05-17

Captures the Phase 0 decisions resolving every architectural question in [plan.md](./plan.md). The spec emitted zero `[NEEDS CLARIFICATION]` markers, so research is concentrated on architecture, not on filling in user-facing gaps.

---

## R1. Full module replacement, not credits-panel extension

**Decision**: Delete `src/renderer/credits-panel.ts` and its test file. Build a new `src/renderer/how-to-play-modal.ts` that subsumes the credits surface as one of three sections.

**Rationale**:

- The new modal's responsibilities (three sections, dismissal trio including SPACE, mode-aware dismissal) are different enough from the old credits panel that re-using the existing surface would mean either (a) renaming it and gutting it (effectively a rewrite) or (b) keeping two overlapping modules. Both are worse than a clean replacement.
- The credits-panel module's tests are coupled to the "Problem credits" heading, the single-section body, and ESC-only dismissal — they'd all be rewritten anyway.
- Removing credits-panel cancels out roughly half the new module's footprint, keeping the slice's net LOC small.

**Alternatives considered**:

- *Generalise credits-panel into a sections-of-content modal and reuse*: technically possible but introduces a config-driven abstraction (Principle I violation — no second consumer yet).
- *Wrap credits-panel as the "Credits" section of a new outer modal*: composition over replacement. Rejected because the outer wrapper still owns the dismissal trio, focus management, and mode behaviour — the wrapped panel becomes a sub-shell of itself.

---

## R2. Modal "open mode" — closure state, not callback variants

**Decision**: `createHowToPlayModal(host, sources)` returns `{ show(mode: 'entry' | 'pause'), close(), isVisible(), destroy() }`. Internally a single closure variable `currentMode` is set on `show()`. `close()` reads it to decide whether to call the optional `onResume` callback (registered at construction time, for the pause-mode case).

**Rationale**:

- Spec FR-008 and FR-011 require different post-dismissal behaviour depending on how the modal was opened. The simplest way to communicate this is to set the mode at open time rather than swapping callbacks or stashing the resume function per-open.
- Construction-time `onResume` keeps the public surface narrow: callers don't have to thread the resume function through each `show()` call, and tests can mount the modal once and exercise both modes.
- A future "challenge" or "achievements" section would extend the enum, not the public API.

**Alternatives considered**:

- *Two methods: `showFromEntry()` and `showFromPause()`*: doubles the public surface; the mode information is duplicated in the method name and the call site. Rejected.
- *Pass `onClose` callback per `show()`*: works but loses the symmetry with `createProblemModal` (which already uses a single `show(problem, onResolve)` shape) and means a stale closure if the caller forgets to update it.

---

## R3. Pause button state derived purely from world state + modal visibility

**Decision**: Each frame, `game-loop` calls `pauseButton.setState({ visible, enabled })` where:

```text
visible = loopState === 'running'   // matches existing HUD-show rules
enabled = visible
       && world.runState === 'running'
       && world.invincibilityRemainingMs === 0
       && !problemModal.isOpen()      // see R5
       && !howToPlayModal.isVisible()
```

`pause-button.ts` does not own any state of its own; it just renders.

**Rationale**:

- Spec FR-009, FR-012, FR-013 all phrase the Pause button's gating in terms of *current world state and modal visibility*, never in terms of "was it just pressed". So the simplest model is to recompute per-frame and let the button mirror the truth.
- This avoids state synchronization bugs (button stuck enabled after invincibility ends, etc.) entirely — there's no state to drift.
- O(1) per frame; the four read-only checks are primitive comparisons.

**Alternatives considered**:

- *Event-driven enable / disable via observers*: the existing game-loop already controls all four inputs, so the per-frame poll is equivalent and simpler.

---

## R4. ESC / SPACE shared with existing keyboard handlers

**Decision**: The game-loop's existing top-level `onKeyDown` handler grows one new branch: if `loopState === 'running'` AND `pauseButton.isEnabled()` AND the key is ESC or SPACE, trigger pause-and-open-modal. Otherwise existing behaviour is unchanged. The modal's own ESC/SPACE handler operates inside its lifetime — when active, it takes priority because it listens at the `capture` phase (matching `problem-modal.ts`'s pattern).

**Rationale**:

- Spec FR-007 and FR-010 explicitly couple ESC/SPACE to both the modal-dismissal AND the pause-trigger paths. Capture-phase listeners with synchronous `stopPropagation` are the established pattern in this codebase (see `problem-modal.ts`).
- The start-screen `beginRun()` path already consumes Enter / Space / Arrow keys for "press anything to start"; this slice does NOT change that. Pause-on-SPACE only applies once the loop state is `'running'`.
- Game-over restart input shares the same pattern: a single `restartFromInput()` consuming any key. We do NOT add Pause behaviour on the game-over screen because FR-009 explicitly forbids it.

**Alternatives considered**:

- *Reserve a different key (P)*: rejected — the spec lists ESC and SPACE explicitly.

---

## R5. `ProblemModal.isOpen()` — minimal additional public surface

**Decision**: Extend `ProblemModal` with an `isOpen(): boolean` accessor (returns true while the closure's `state !== 'closed'`). This is the smallest hook the pause-button-state derivation needs to know whether a gate modal is currently up.

**Rationale**:

- The game-loop already tracks `world.runState === 'answering'`, which is equivalent to "gate modal is open". Using `world.runState` would work without modifying `ProblemModal`. **Picked**: use `world.runState === 'answering'`, NOT a new modal accessor. This keeps the modal's public surface unchanged.

**Update**: After looking at the existing game-loop code, `world.runState` is the right signal. Cancelling the addition to ProblemModal. The plan / contracts use `world.runState === 'answering'` instead.

---

## R6. Cube swatch rendering — CSS, not SVG

**Decision**: Each row's cube swatch is a small `<div class="cube-swatch cube-swatch--b">` (etc.) styled with the difficulty's `GATE_CATALOGUE[difficulty].colorHex` as a background colour plus a CSS `border` mimicking the neon-cube edge glow. The class name is the textual difficulty marker for screen-readers (paired with the adjacent label text).

**Rationale**:

- An SVG cube would add complexity (three-axis projection, faces, edges) without buying meaningful visual fidelity at the row's size (~40 px). A CSS coloured tile is recognisable and consistent with the modal's existing flat aesthetic.
- The colour comes from the existing source-of-truth (`GATE_CATALOGUE`), so a future palette change in the game automatically propagates to the modal.
- Tests can assert the swatch element exists and has the right class without rendering pixel-accurate CSS.

**Alternatives considered**:

- *Inline SVG cube*: rejected — bytes spent for no clarity gain at this size.
- *Static PNG*: rejected — would require a new asset (constitution's 5 MB asset budget is fine but this is unnecessary).

---

## R7. Pause-on-blur vs. pause-via-button — keep them separate

**Decision**: The existing `pauseFromBlur()` path stays as-is and continues to use the pause-overlay HUD. The new `pauseFromInput()` path opens the How-to-Play modal. Both go through the same `pauseRun` reducer in `runner-engine`, so the world state machine is identical regardless of trigger. Only the UI surface differs.

**Rationale**:

- Spec assumption: the existing pause-on-blur behaviour is independent of this feature. We don't want a blur-then-refocus to autonomously open a tutorial modal — that would surprise the player.
- Both paths share the same world-state effect, which keeps the resume contract identical (`resumeRun` on input).
- Two separate UI surfaces (pause overlay vs. how-to-play modal) reflect intent: blur is involuntary, button-press is voluntary.

**Alternatives considered**:

- *Unify both into a single "paused-with-modal" experience*: rejected — players who switch tabs briefly would be forced to dismiss a tutorial modal on return. Bad UX.

---

## R8. Modal closes itself before game-loop sees the next input

**Decision**: The modal's keyboard handler runs at the `capture` phase and calls `event.preventDefault()` + `event.stopPropagation()` on ESC / SPACE. The X close button's click handler also stops propagation. This guarantees the next "restart on any input" or "start on any input" reads doesn't fire when the player merely dismisses the tutorial on the game-over or start screen (spec edge case 5).

**Rationale**:

- Matches the existing `problem-modal.ts` pattern for keyboard-event capture.
- Without this, a player on the game-over screen would press SPACE to close the modal, the game would interpret SPACE as "restart", and the player would be in a fresh run before they could react. Bad UX, and explicitly called out in the spec's edge cases.

**Alternatives considered**:

- *Restart guard inside the game-loop that ignores inputs for N ms after modal close*: rejected — race condition prone, and a per-input guard at the modal level is cleaner.

---

## R9. Bundle-size impact

**Decision**: Allow up to 2 KB gzipped net. Net contributors:

- New `how-to-play-modal.ts`: ~120 lines.
- New `pause-button.ts`: ~40 lines.
- Deleted `credits-panel.ts`: ~149 lines (saving).
- Net source LOC: roughly even.
- CSS: ~50 net lines (Pause button + modal section styles + cube swatches + the existing credits-link → how-to-play-link block can be renamed in place, saving lines).

Estimated gzipped delta: **< 1 KB**.
