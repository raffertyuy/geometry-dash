# Implementation Plan: How-to-Play Modal & In-Game Pause

**Branch**: `008-how-to-play` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-how-to-play/spec.md`

## Summary

Replace the existing "Problem Credits" link (which lives on both the start screen and the game-over screen) with a single "How to Play" link that opens a new three-section modal: General Rules, Problem Cubes (one row per difficulty with a colour swatch, label, description, points, and countdown), and Credits (the same CC-BY source list the old panel rendered). Add a Pause button at the top of the playfield that is rendered only during an active run, enabled only when the run is actually running with no problem-gate modal open and no respawn invincibility blinking. When the player triggers Pause (touch, mouse, ESC, or SPACE), the world is paused via the existing `pauseRun` / `resumeRun` transitions and the same How-to-Play modal opens; closing the modal (X / ESC / SPACE) calls `resumeRun`.

Technical approach: introduce **one new module** `src/renderer/how-to-play-modal.ts` that fully subsumes the existing `credits-panel.ts` (the latter is deleted; its lone consumer in `game-loop.ts` is rewired to the new modal). The new modal carries an internal "open mode" of `entry` (no run to resume) vs. `pause` (close → resume), set by the caller at `show()` time. A tiny `pause-button.ts` renderer adapter handles the Pause control's enable/disable visual + click dispatch. `game-loop.ts` gains a `pauseFromInput()` companion to the existing `pauseFromBlur()` and the existing ESC/SPACE listeners gain a "running → open pause modal" branch. No new dependency; the Problem-Cubes section's cube swatches reuse the existing `GATE_CATALOGUE[difficulty].colorHex` values so the in-modal swatch always matches the in-world cube.

## Technical Context

**Language/Version**: TypeScript 5.6, ES2022 target, strict mode (unchanged).

**Primary Dependencies**: Three.js 0.184 (renderer; untouched by this slice — Pause button is a DOM element, not a Three.js mesh), Vite 6 (build), Vitest 2 + jsdom 25 (tests). No new runtime dependencies.

**Storage**: N/A. Modal state lives in closure; no persistence.

**Testing**: Vitest unit + integration; new tests cover modal section structure, dismissal trio, mode (entry vs. pause) dismissal behaviour, Pause button state matrix (4 disabled scenarios + enabled scenario), and the pause → resume round-trip via game-loop integration.

**Target Platform**: Static web app (evergreen browsers, mobile-first from 320 px).

**Project Type**: Single static web project.

**Performance Goals**: Modal open/close runs once per click; no per-frame work. Pause button state evaluation runs once per frame in the HUD update path and must be O(1).

**Constraints**: Bundle delta target < 2 KB gzipped (one new module + a few CSS rules + removal of the old credits-panel cancels much of it out). No regression in the existing 60 FPS desktop / 30 FPS mobile budgets. CC-BY attribution coverage MUST NOT regress (constitution-adjacent: this slice carries a legal-compliance constraint).

**Scale/Scope**: One modal, one pause button, one removed module (credits-panel), three swatch-rendering snippets, ~12 acceptance tests. Estimate ~250 net LOC including tests and CSS.

## Constitution Check

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Simplicity & YAGNI | **PASS** | Replaces a single-purpose module (`credits-panel`) with a slightly broader-purpose one (`how-to-play-modal`). One extra adapter (`pause-button`) for the button. No new dependency, no feature flag, no premature abstraction. The "open mode" enum has exactly two values (`entry`, `pause`); we resist a generic mode registry. |
| II. Test-First Discipline | **PASS** | Modal rendering, dismissal trio, mode-driven close behaviour, and Pause-button state matrix are all testable in jsdom. Tests authored alongside implementation in each user-story phase. The pause → resume round-trip integrates with the existing `pauseRun` / `resumeRun` reducers, which have their own tests; new test confirms the *integration* (modal-close triggers `resumeRun`). |
| III. Library-First / Modular | **PASS** | New module `src/renderer/how-to-play-modal.ts` with one public entrypoint `createHowToPlayModal()`. New adapter `src/renderer/pause-button.ts` with one public entrypoint `createPauseButton()`. Both are pure-DOM, no Three.js coupling. The credits-panel module is removed — its sole consumer is rewired. No new shared types are needed beyond what already exists (`ProblemSource`, `GateDifficulty`, `WorldState`). |
| IV. Observability & Debuggability | **PASS** | New `console.debug` events: `how_to_play_opened` (mode), `how_to_play_closed` (mode, resumed?), `pause_button_state_changed` (enabled / disabled with reason). Debug overlay gains no new line (modal/pause state is already self-evident at the DOM level). |
| Platform & Tech Stack | **PASS** | Pure DOM + listeners. Touch tap, mouse click, and keyboard (ESC / SPACE) all wired. Mobile-first; 320 px floor verified in the spec's edge case + this plan's manual smoke. |
| Performance Budget | **PASS** | One additional listener per modal open, removed on close. Pause-button state recomputed once per frame from `world.runState` + `world.invincibilityRemainingMs` + modal visibility — three primitive reads, no allocation. |
| Accessibility & Input | **PASS** | Cube swatches in Problem Cubes section pair colour with a textual label per FR-005 / constitution rule. Dismissal trio (X / ESC / SPACE) gives keyboard users a path that doesn't depend on pointer events. Pause button has an accessible label and an `aria-disabled` attribute when disabled. |

No constitution violations. **Complexity Tracking section omitted.**

## Project Structure

### Documentation (this feature)

```text
specs/008-how-to-play/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── module-contracts.md
└── tasks.md          # generated by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── renderer/
│   ├── how-to-play-modal.ts         # NEW: 3-section modal, entry|pause mode
│   ├── how-to-play-modal.test.ts    # NEW: section render, dismissal trio, mode behaviour
│   ├── pause-button.ts              # NEW: enable/disable adapter + click dispatch
│   ├── pause-button.test.ts         # NEW: state matrix tests
│   ├── credits-panel.ts             # DELETED
│   ├── credits-panel.test.ts        # DELETED
│   └── index.ts                     # MODIFIED: replace credits-panel export with how-to-play-modal
├── game/
│   └── game-loop.ts                 # MODIFIED: rewire links to "How to Play", add pauseFromInput, add Pause button wiring
└── shared/
    └── (no changes)

index.html                            # MODIFIED: rename .credits-link labels to "How to Play"; add #pause-button element + CSS rules for the modal sections + Pause button
src/main.ts                           # MODIFIED: pass the renamed elements to GameLoopHostElements (creditsLinkStart → howToPlayLinkStart, etc.) and add the new pauseButton host
README.md                             # MODIFIED: one-line entry in "What's in it (so far)"
```

**Structure Decision**: Reuse the existing single-project layout. The modal is a new renderer module mirroring the shape of `credits-panel.ts` (which it replaces); the Pause button is a tiny sibling adapter. No new top-level directory. The deletion of `credits-panel.ts` cancels out most of the new module's footprint.

## Phase 0: Outline & Research — Pointer

See [research.md](./research.md) for: why a full module replacement (not a credits-panel extension), modal "open mode" design, Pause button state-table derivation, ESC/SPACE handling vs. existing key handlers, and cube-swatch implementation choice (CSS, not SVG).

## Phase 1: Design & Contracts — Pointer

- [data-model.md](./data-model.md) — `HowToPlayMode` enum + `PauseButtonState` derivation rules + constants for section headings.
- [contracts/module-contracts.md](./contracts/module-contracts.md) — Public surfaces for `createHowToPlayModal()` and `createPauseButton()`, `GameLoopHostElements` updates, deletions of credits-panel.
- [quickstart.md](./quickstart.md) — Slice-specific manual + automated validation.

## Constitution Re-Check (post-design)

Re-evaluated after Phase 1. The design introduces two new modules and deletes one; no new dependency; no new persistence; observability events covered. All gates still **PASS**. No Complexity Tracking entries needed.
