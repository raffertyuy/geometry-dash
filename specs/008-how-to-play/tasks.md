---

description: "Task list for feature 008 — How-to-Play Modal & In-Game Pause"
---

# Tasks: How-to-Play Modal & In-Game Pause

**Input**: Design documents from `/specs/008-how-to-play/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/module-contracts.md, quickstart.md

**Tests**: Required — Constitution Principle II covers the pause↔resume integration and any UI affordance that affects scoring/lives gating. Tests are authored before/alongside implementation.

**Organization**: Grouped by user story. US1 (modal swap) + US3 (Pause button) are P1 and form the MVP together. US2 (modal *content*) is also P1 — without it the modal is empty.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no dependencies on incomplete tasks → parallelizable
- **[Story]**: US1 / US2 / US3 ; foundational and polish tasks have no story label

## Path Conventions

- Single web project (per [plan.md](./plan.md)). Source under `src/`; tests colocated as `*.test.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

*(Empty — no new directories, no new tooling. Proceed to Phase 2.)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Stand up the new module file skeletons + delete the obsolete credits-panel + rename DOM IDs and CSS classes. After this phase the project still type-checks (because the new modules export the same shape the game-loop will use) but the modal body is empty.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — every story below depends on the module file existing.

- [ ] T001 [P] Create `src/renderer/how-to-play-modal.ts` with the `HowToPlayModal` interface + a stub `createHowToPlayModal()` per [contracts/module-contracts.md §1](./contracts/module-contracts.md). The stub renders no body yet — just exports a shape that compiles. Construction wires the `onResume` parameter into a closure variable; `show()` is a no-op; `close()` calls `onResume()` only when `mode === 'pause'`.
- [ ] T002 [P] Create `src/renderer/pause-button.ts` with the `PauseButton` interface + a stub `createPauseButton()` per [contracts/module-contracts.md §2](./contracts/module-contracts.md). Stub implements `setVisible`, `setEnabled`, `isEnabled`, `destroy` against an `HTMLButtonElement`. Click listener fires `onPress` only when enabled.
- [ ] T003 [P] In `src/renderer/index.ts`, replace the `createCreditsPanel` re-export with `createHowToPlayModal` and add `createPauseButton`. Delete `src/renderer/credits-panel.ts` and `src/renderer/credits-panel.test.ts`.
- [ ] T004 [P] In `index.html`, rename the two start-screen and game-over-screen buttons from `id="credits-link-…" class="credits-link"` with text "Problem credits" to `id="how-to-play-link-…" class="how-to-play-link"` with text "How to Play". Rename `#credits-overlay` to `#how-to-play-overlay`. Add a new `<button id="pause-button" class="pause-button hidden" type="button" aria-label="Pause">⏸</button>` element positioned in the HUD layer at the top of the playfield. Rename `.credits-link` CSS class to `.how-to-play-link` (same styling).
- [ ] T005 In `src/main.ts`, rename the three queries (`#credits-overlay`, `#credits-link-start`, `#credits-link-game-over`) to their how-to-play equivalents. Add a `#pause-button` query. Pass all four through to `createGameLoop` as new `GameLoopHostElements` keys (`howToPlayOverlay`, `howToPlayLinkStart`, `howToPlayLinkGameOver`, `pauseButton`).
- [ ] T006 In `src/game/game-loop.ts`, update the `GameLoopHostElements` interface: rename `creditsOverlay → howToPlayOverlay`, `creditsLinkStart → howToPlayLinkStart`, `creditsLinkGameOver → howToPlayLinkGameOver`, and add `pauseButton: HTMLButtonElement`. Replace `CreditsPanel` / `createCreditsPanel` imports with `HowToPlayModal` / `createHowToPlayModal` and add `PauseButton` / `createPauseButton`. Rewire the modal construction and the two link-click handlers from `creditsPanel.show()` to `howToPlayModal.show('entry')`. Replace the lone `creditsPanel.isVisible()` guard at the top of `onKeyDown` / `onPointerDown` with `howToPlayModal.isVisible()` (same semantics). Construct `pauseButton` with an `onPress: onPauseButtonPressed` stub (defined empty in this task; filled in US3). Call `pauseButton.destroy()` and `howToPlayModal.destroy()` in `dispose`.

**Checkpoint**: `npm run typecheck` passes. `npm run lint` passes. `npm test` passes (with credits-panel tests removed and no how-to-play tests yet — slice tests come in US phases). Visually: the "How to Play" buttons exist on the start and game-over screens but clicking them does nothing yet; the Pause button renders as ⏸ but is permanently hidden.

---

## Phase 3: User Story 1 — Entry-screen link swap + modal shell + dismissal (Priority: P1) 🎯 MVP

**Goal**: Clicking "How to Play" from the start or game-over screen opens a real modal with the three section headings visible (body content still placeholder). Pressing ESC, SPACE, or clicking the X dismisses the modal and returns the player to the prior screen unchanged.

**Independent Test**: From the start screen, click "How to Play"; modal opens; press ESC → modal closes, start screen intact. Repeat with SPACE and X. Verify on game-over screen too. Verify that SPACE inside the modal does NOT also trigger the game-over restart on the next event-loop tick (capture-phase stopPropagation).

### Tests for US1

- [ ] T007 [P] [US1] In `src/renderer/how-to-play-modal.test.ts`, write tests for:
  - `show('entry')` adds the host's visible classes and renders the modal body with three `<section>` elements whose headings are "General Rules", "Problem Cubes", "Credits" in that order.
  - X close button → `close()` and `isVisible()` becomes false. `onResume` callback is NOT invoked in entry mode.
  - ESC key while open → close.
  - SPACE key while open → close.
  - ESC/SPACE listeners are registered at capture phase with `preventDefault + stopPropagation` (verify by dispatching a keydown and observing the propagation is halted).
  - Backdrop click closes; click inside the body does NOT close.
  - `show('entry')` while already visible is a no-op (no duplicate body).

### Implementation for US1

- [ ] T008 [US1] In `src/renderer/how-to-play-modal.ts`, implement the body builder per [contracts/module-contracts.md §1](./contracts/module-contracts.md) "Body structure": render the heading "How to Play", three empty `<section class="htp-section htp-…">` blocks each with its `<h3>` heading, and the X close button. Wire show/close listeners (window-level keydown capture for ESC + SPACE; click on host backdrop; click on close-button with `stopPropagation`). Mode is set on every `show()`; `close()` reads it.
- [ ] T009 [US1] In `index.html`, add the modal-shell CSS rules: `#how-to-play-overlay`, `.how-to-play-body`, `.htp-section`, `.htp-section h3`, `.close-button` (reuse credits panel's existing `.close-button` styling), and the responsive single-column-at-320 px adjustment. The backdrop dim + centred body should mirror the old credits-panel layout exactly so the slot the player sees is familiar.
- [ ] T010 [US1] In `src/game/game-loop.ts`, finish the entry-link wiring by confirming `howToPlayModal.show('entry')` is called from both `host.howToPlayLinkStart` and `host.howToPlayLinkGameOver` click listeners (the rename in T006 should already have left this in place). Add `console.debug({ event: 'how_to_play_opened', mode: 'entry' })` / `'how_to_play_closed'` events around the calls if not emitted by the modal itself (the modal owns these per [data-model.md §5](./data-model.md)).

**Checkpoint**: US1 functional. Modal opens from start and game-over screens with three section headings. Dismissal trio works. SPACE-then-game-over-restart edge case verified manually. Tests T007 pass.

---

## Phase 4: User Story 2 — Modal content (general rules + cube rows + credits) (Priority: P1)

**Goal**: A new player can read the modal top to bottom in under a minute and learn: lane controls, life count, end conditions, per-cube difficulty colour + label + points + countdown, and the CC-BY source list.

**Independent Test**: Open the modal cold; from text alone the reader can answer the five comprehension questions from spec SC-002 / US2 in under 60 seconds. The Problem Cubes section has three rows with both colour swatches and textual labels (Basic / Medium / Advanced). Credits section shows every source from the deleted credits-panel.

### Tests for US2

- [ ] T011 [P] [US2] In `src/renderer/how-to-play-modal.test.ts`, add a `describe('content')` block with tests for:
  - General Rules section contains at least one element mentioning each of: "Arrows", "WASD", "swipe", "3 lives", "score" (as a substring of an end-condition explanation), "0" / "zero" (the other end condition).
  - Problem Cubes section renders exactly three `.htp-cube-row` items in B/M/A order (use `data-difficulty` attribute or class suffix to assert).
  - Each row contains a `.cube-swatch` element with the `GATE_CATALOGUE[difficulty].colorHex` as its inline `background-color` style.
  - Each row contains the visible label "Basic" / "Medium" / "Advanced" so colour is not the only difficulty cue.
  - Each row contains the points text (`±1,000` / `±5,000` / `±10,000`) and the countdown text (`60 s` / `120 s` / `180 s`) — read from `GATE_POINTS_*` and `QUESTION_TIMER_MS_*` so the test fails if those constants drift.
  - Credits section renders one `<li class="source-entry">` per source passed in, with `.source-name`, `.source-url`, `.source-license`, `.source-attribution` children (matches the deleted credits-panel structure so attribution is identical).

### Implementation for US2

- [ ] T012 [US2] In `src/renderer/how-to-play-modal.ts`, fill the General Rules `<section>` body with a static `<ul>` of bullet points covering: endless runner with lane changes, controls (Arrows / WASD / touch swipe), 3 starting lives + obstacle/wrong-answer cost 1 life + respawn invincibility, end conditions (zero lives OR score below zero).
- [ ] T013 [US2] In `src/renderer/how-to-play-modal.ts`, render the Problem Cubes section: an `<ul class="htp-cube-rows">` with one `<li class="htp-cube-row htp-cube-row--{b|m|a}" data-difficulty="{B|M|A}">` per row. Each row has the `.cube-swatch` (inline background-color from `GATE_CATALOGUE[difficulty].colorHex`) + `.htp-cube-text` containing label, description, and stats line. Read points from `GATE_POINTS_*` and countdown from `QUESTION_TIMER_MS_*` constants and format as `±{points.toLocaleString()}` and `${ms/1000} s`.
- [ ] T014 [US2] In `src/renderer/how-to-play-modal.ts`, render the Credits section using the existing `ProblemSource[]` passed at construction time — emit the same DOM shape the old credits-panel produced (`<ul class="credits-list">` with `<li class="source-entry">` rows containing `.source-name` / `.source-url` / `.source-license` / `.source-attribution`). This guarantees no attribution regression per SC-003.
- [ ] T015 [US2] In `index.html`, add the content CSS: `.htp-cube-rows` (2-column grid: 40 px swatch + flexible text), `.htp-cube-row`, `.cube-swatch` (square, the GATE colour-Hex applied inline, plus a faint border to match the in-world neon-edge look), `.htp-cube-label`, `.htp-cube-stats`, `.credits-list` (keep the deleted credits-panel's existing rules — they should already be present from before). At 320 px, the cube row stacks to single-column (`flex-direction: column` or `grid-template-columns: 1fr`).

**Checkpoint**: Modal is fully fleshed out. Tests T011 pass. Reading the modal answers all five US2 comprehension questions in under 60 s.

---

## Phase 5: User Story 3 — Pause button & in-game pause (Priority: P1)

**Goal**: A Pause button appears at the top of the playfield during a run. It enables only when the player is actually running (no gate modal open, no respawn invincibility). Pressing it (or ESC / SPACE) pauses the world and opens the same How-to-Play modal in pause mode; closing the modal resumes the run.

**Independent Test**: Start a run; verify the Pause button is visible and enabled. Tap it; world freezes within 100 ms; modal opens. Press ESC; world resumes from exact tick. Repeat for SPACE and X. Hit a gate; while gate modal is open the Pause button is greyed out and unresponsive. Lose a life (wrong gate); during the blinking invincibility, the Pause button is greyed out; once blinking stops, it re-enables.

### Tests for US3

- [ ] T016 [P] [US3] In `src/renderer/pause-button.test.ts`, write tests for the state matrix:
  - `setVisible(true) + setEnabled(true)`: host has no `.hidden`, no `disabled` attribute, no `aria-disabled`; click fires `onPress`.
  - `setVisible(true) + setEnabled(false)`: host visible but `disabled=true`, `aria-disabled='true'`, `.is-disabled` class; click does NOT fire `onPress`.
  - `setVisible(false)`: host has `.hidden` class; click does not fire even if internally enabled.
  - `destroy()` removes the click listener (verify by clicking after destroy and asserting `onPress` not called).
- [ ] T017 [P] [US3] In `src/game/game-loop.ts`'s test file (create `src/game/game-loop.test.ts` if it doesn't exist — check first; if it doesn't, add the tests as integration tests inside `src/renderer/how-to-play-modal.test.ts` against a stub game-loop, or create the new game-loop test file). Test the state-derivation matrix per [data-model.md §2](./data-model.md): five scenarios (start screen, running, running+gate-modal, running+invincibility, game-over) all produce the correct `{ visible, enabled }` for the Pause button. If creating a full game-loop test file is heavy, an acceptable simpler alternative is to extract the derivation into a pure function `derivePauseButtonState(loopState, world, howToPlayModalVisible)` exported from `game-loop.ts` and test that function directly.

### Implementation for US3

- [ ] T018 [US3] In `src/renderer/pause-button.ts`, finish the implementation: `setVisible` toggles `.hidden`; `setEnabled` toggles `disabled` attribute + `aria-disabled` + `.is-disabled` class; the click listener checks `enabled` before calling `onPress`; `destroy()` removes the listener.
- [ ] T019 [US3] In `src/game/game-loop.ts`, define `onPauseButtonPressed()`: `world = pauseRun(world); loopState = 'paused'; howToPlayModal.show('pause'); console.debug({ event: 'pause_button_pressed', source: 'click', tickMs: world.tickMs })`. Define `resumeFromPauseButton()` (the `onResume` callback passed to the modal at construction time): `world = resumeRun(world); loopState = 'running'`. Update the `createHowToPlayModal` construction to pass `resumeFromPauseButton` as the third argument.
- [ ] T020 [US3] In `src/game/game-loop.ts`, extend `onKeyDown`: after the existing credits-panel guard (already renamed to howToPlayModal in T006) and BEFORE the lane-adapter handoff, add a branch: if `loopState === 'running'` AND the key is `'Escape'` OR `' '` (space) AND `pauseButton.isEnabled()`, call `onPauseButtonPressed()` and return. (The modal's own ESC/SPACE handler takes care of the close path when the modal is open — capture-phase stopPropagation means this branch never fires while the modal is up.)
- [ ] T021 [US3] In `src/game/game-loop.ts`, in the per-frame block where `livesHud.set(world.lives)` is called (around line 475), compute and apply the Pause button state per [data-model.md §2](./data-model.md):

  ```ts
  const pbVisible = loopState === 'running';
  const pbEnabled =
    pbVisible
    && world.runState === 'running'
    && world.invincibilityRemainingMs === 0
    && !howToPlayModal.isVisible();
  pauseButton.setVisible(pbVisible);
  pauseButton.setEnabled(pbEnabled);
  ```

- [ ] T022 [US3] In `index.html`, add the Pause button CSS: position absolutely at top-centre (or top-right, matching the existing HUD aesthetic — check the score / timer / lives positions in `#hud` and place the button consistently). Add styles for `disabled` / `aria-disabled='true'` (greyed out + non-clickable cursor) and the `.hidden` class (display:none). The ⏸ glyph is the button's content; no icon font dependency.

**Checkpoint**: Pause button works end-to-end. Tests T016 + T017 pass. The four blocked scenarios behave correctly (verified manually + via T017's state-matrix test).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T023 [P] Update `README.md`'s "What's in it (so far)" section with a one-line entry for slice 008, e.g.: "**How-to-Play modal + Pause button (slice 008)** — the old 'Problem credits' link is now a 'How to Play' link that opens a tutorial modal (rules, cube-by-difficulty reference, credits). During a run, a top-of-screen Pause button (also triggered by ESC / SPACE) opens the same modal and freezes the world; closing resumes seamlessly."
- [ ] T024 Run the full automated sweep: `npm run typecheck`, `npm run lint`, `npm test`. Fix any drift introduced during implementation. All prior tests + the new ones must pass.
- [ ] T025 Run the manual quickstart checklist in [quickstart.md](./quickstart.md). Confirm: link replacement, dismissal trio, all three sections render, mobile 320 px width has no horizontal overflow, Pause button shows/enables/disables across the five states, ESC/SPACE bypasses on game-over screen (modal close first, then second SPACE restarts), pause-on-blur path still uses the old pause overlay (NOT the new modal), `?debug=1` shows the three new debug events.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: empty.
- **Phase 2 (Foundational)**: T001 / T002 / T003 / T004 parallelisable. T005 depends on T004 (DOM IDs must be renamed first). T006 depends on T001, T002, T003 (interface shapes must exist), T005 (host element keys), and the `index.html` change in T004.
- **Phase 3 (US1)**: Depends on Phase 2. T007 (tests) authored first (will fail). T008–T010 land the implementation.
- **Phase 4 (US2)**: Depends on Phase 3 (modal shell must exist). T011 authored first; T012/T013/T014/T015 land content. T012–T014 modify the same file (`how-to-play-modal.ts`) so they're sequential; T015 is CSS — parallel-eligible.
- **Phase 5 (US3)**: Depends on Phase 2 (button + modal shells must exist). Independent of Phase 4 content (the button just opens the modal). T016 / T017 authored in parallel. T018 (button impl), T019–T022 (game-loop wiring + CSS). T019, T020, T021 all touch `game-loop.ts` so they're sequential.
- **Phase 6 (Polish)**: Depends on Phases 3–5 complete.

### Within each user story

- US1: T007 → T008 → T009 → T010.
- US2: T011 → T012 → T013 → T014 (parallel to T015).
- US3: T016 / T017 (parallel) → T018 → T019 → T020 → T021 → T022.

### Parallel opportunities

- T001 + T002 + T003 + T004 (foundational, different files).
- T007 / T011 / T016 / T017 (story tests, different scopes).
- T015 (US2 CSS) can land alongside T012–T014.
- T022 (US3 CSS) can land alongside T018–T021.
- T023 (README) and T025 (manual smoke) in polish.

---

## Implementation Strategy

### Recommended linear flow (single engineer)

1. Phase 2 foundational (T001–T006).
2. Phase 3 US1 (T007–T010) — modal opens but body is empty placeholders.
3. Phase 4 US2 (T011–T015) — modal content fleshed out.
4. Phase 5 US3 (T016–T022) — Pause button live.
5. Phase 6 polish (T023–T025).

### MVP boundary

After T010, the entry-screen swap is complete: players can open the modal (even with empty sections) and dismiss it; no broken UI. That's a valid checkpoint to commit and ship the swap as a partial slice if needed.

### Test-first discipline

- T007, T011, T016, T017 are written BEFORE their corresponding implementation tasks and will FAIL initially. This is the constitution's Principle II in practice.

---

## Notes

- The slice deletes one module and adds two — net source line count is roughly even. The bundle delta target is < 1 KB gzipped.
- The slice does not touch `runner-engine`, `obstacles`, `problem-gates`, `score`, `lives-hud`, or any non-modal renderer. The world-state effect is mediated entirely by the existing `pauseRun` / `resumeRun` reducers.
- Commit at each phase boundary at minimum (end of Phase 2, end of US1, end of US2, end of US3, end of Polish) per the project's autonomous-flow convention.
