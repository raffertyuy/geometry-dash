<!--
SYNC IMPACT REPORT
Version change: TEMPLATE (uninitialized) -> 1.0.0
Modified principles: N/A (initial ratification)
Added sections:
  - Principle I: Simplicity & YAGNI
  - Principle II: Test-First Discipline
  - Principle III: Library-First / Modular Design
  - Principle IV: Observability & Debuggability
  - Additional Constraints (platform & tech stack, performance budget, accessibility & input)
  - Development Workflow (spec-driven via Spec Kit, review & quality gates)
Removed sections:
  - 5th principle slot (template provided 5; project uses 4 with rationale)
Templates requiring updates:
  - .specify/templates/plan-template.md (no rename needed; Constitution Check is principle-agnostic)
  - .specify/templates/spec-template.md (no constitution-specific anchors)
  - .specify/templates/tasks-template.md (task categorization compatible)
  - CLAUDE.md (pending: add project gist + workflow pointer in same change)
Follow-up TODOs: none
-->

# The Real Geometry Dash Constitution

## Core Principles

### I. Simplicity & YAGNI

Start with the smallest design that delivers the feature. Code, abstractions, and dependencies MUST be justified by current requirements - not anticipated ones.

Concrete rules:

- Prefer three similar lines over a premature abstraction; refactor when the third or fourth duplicate appears, not earlier.
- New dependencies MUST be evaluated against a "could we do this with the standard library or existing deps?" check; record the decision in `plan.md`.
- Feature flags, configuration knobs, and abstraction layers SHOULD NOT be introduced until a second concrete use case exists.

**Rationale**: This is a small game and a learning-friendly codebase. Speculative complexity costs more in onboarding and maintenance than it saves.

### II. Test-First Discipline

For any non-trivial logic - scoring, lane mechanics, question selection, difficulty progression - tests MUST be written before or alongside the implementation, and MUST be red before they go green.

Concrete rules:

- Pure game logic (scoring, collision detection, question pools, difficulty curves) MUST have unit tests.
- Cross-cutting flows (e.g. player answers a gate -> score updates -> next gate spawns) MUST have an integration test that exercises the real modules together.
- Visual/rendering code is exempt from strict TDD but SHOULD have a smoke test that confirms the canvas/DOM initialises.
- A PR that adds or changes game logic without accompanying tests is a constitution violation and MUST be flagged in review.

**Rationale**: Bugs in scoring, input handling, and question correctness directly break player trust. Tests are the cheapest way to keep those areas honest as the game grows.

### III. Library-First / Modular Design

Game subsystems MUST be implemented as self-contained modules with clear public interfaces, importable without pulling in unrelated parts of the codebase.

Concrete rules:

- Each subsystem (e.g. `runner-engine`, `question-bank`, `input-adapter`, `score`, `renderer`) MUST live in its own folder/module with a single public entrypoint.
- Modules MUST NOT reach into each other's internals; they communicate through documented exports or an event bus.
- A module MUST be testable in isolation - pure-logic modules MUST NOT require the DOM or a canvas to run their tests.
- Cross-module shared types MUST live in a dedicated `types/` or `shared/` module - not duplicated.

**Rationale**: A modular structure lets us swap implementations (e.g., question bank source, renderer) and keeps the test surface small. It also makes the codebase legible to newcomers.

### IV. Observability & Debuggability

The game MUST be debuggable in development without attaching tooling beyond the browser devtools.

Concrete rules:

- Significant game state transitions (lane change, gate hit, question answered, game over) MUST emit structured log events (e.g., `console.debug({ event: 'gate_answered', correct: true, difficulty: 'green' })`).
- A development-only debug overlay SHOULD display current speed, score, active difficulty band, and last input.
- Errors MUST include enough context to reproduce (input event, current state slice) - never silently swallowed.
- Logging MUST be controlled by a single switch (e.g. `?debug=1` query flag or build-time env flag) so production builds stay quiet.

**Rationale**: Endless-runner timing bugs are notoriously hard to reproduce. Cheap, structured logging is what turns "weird, happened once" reports into fixable issues.

## Additional Constraints

### Platform & Tech Stack

- The game MUST run in modern evergreen browsers (latest Chrome, Firefox, Safari, Edge). No IE / legacy polyfills.
- Mobile browser support is a first-class target: touch (swipe) input MUST work on iOS Safari and Android Chrome at minimum.
- The deliverable is a static web app (HTML/JS/CSS + assets). Backend services, if any, MUST be optional - the core game MUST be playable offline once loaded.

### Performance Budget

- Target 60 FPS on a mid-range laptop and at least 30 FPS on a 3-year-old mobile device.
- Initial page weight (HTML + critical JS/CSS) SHOULD stay under 500 KB gzipped; total asset weight SHOULD stay under 5 MB.
- Lane switches and score updates MUST be O(1) per frame; question lookups MUST be O(1) amortised. No per-frame allocations in hot paths once a run is active.

### Accessibility & Input

- Input MUST be supported via: keyboard arrow keys, WASD, and touch swipe (left/right). Additional schemes MAY be added.
- Question prompts MUST be readable at small screen sizes (min 320 px wide) and MUST NOT rely on colour alone - difficulty colour (green/orange/red) MUST be paired with a textual label or distinguishing shape.

## Development Workflow

### Spec-Driven via Spec Kit

- Every non-trivial feature MUST start with `/speckit-specify` producing a `spec.md` on its own feature branch.
- Underspecified specs MUST be sharpened via `/speckit-clarify` before planning.
- Implementation MUST follow a `plan.md` (via `/speckit-plan`) and a `tasks.md` (via `/speckit-tasks`).
- `/speckit-analyze` SHOULD be run before significant implementation work to catch spec/plan/task drift.

### Review & Quality Gates

- Every PR MUST link to the spec/plan/tasks it implements.
- A PR is blocked if: tests are missing for changed game logic, the Constitution Check in `plan.md` was skipped, or new modules violate the library-first boundaries.
- Performance-sensitive changes (renderer, input loop, question pipeline) SHOULD include a before/after measurement note in the PR description.

## Governance

This constitution supersedes ad-hoc conventions when they conflict. Amendments follow these rules:

- Any amendment MUST be made via `/speckit-constitution` and committed with a Sync Impact Report.
- Versioning follows semver applied to governance: MAJOR for backward-incompatible principle removals/redefinitions; MINOR for added principles or materially expanded guidance; PATCH for clarifications or wording fixes.
- PRs MUST verify compliance with this constitution; deviations MUST be called out and justified in the PR description (or in `plan.md` under "Complexity Tracking").
- When in doubt, prefer the simpler interpretation aligned with Principle I.

**Version**: 1.0.0 | **Ratified**: 2026-05-16 | **Last Amended**: 2026-05-16
