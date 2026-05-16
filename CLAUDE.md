# The Real Geometry Dash

A web-based endless runner in the spirit of Subway Surfers, where the obstacles are **geometry-question gates**. The player runs forward, swipes/keys between lanes, and must answer a multiple-choice geometry question (one of three options) to pass through a gate. Gate colour signals difficulty: green (basic), orange (intermediate), red (advanced). Score grows with distance travelled.

## Working in this repo

This project uses **GitHub Spec Kit** for spec-driven development. Before writing code for any non-trivial feature:

1. `/speckit-specify "<feature description>"` - creates a feature branch and `specs/<###-name>/spec.md`.
2. `/speckit-clarify` - asks targeted questions and folds answers back into the spec.
3. `/speckit-plan` - generates `plan.md` (tech context, architecture, project structure).
4. `/speckit-tasks` - generates dependency-ordered `tasks.md`.
5. `/speckit-analyze` - cross-checks spec/plan/tasks for inconsistencies (optional but recommended).
6. `/speckit-implement` - executes tasks one by one.

Auxiliary skills: `/speckit-checklist`, `/speckit-constitution`, `/speckit-taskstoissues`.

## Project rules

The project **constitution** lives at `.specify/memory/constitution.md` and is binding. Summary of v1.0.0:

- **Simplicity & YAGNI** - smallest design that works; no speculative abstractions.
- **Test-First** - game logic (scoring, lanes, questions, difficulty) has tests written before/with the code.
- **Library-First / Modular** - subsystems (`runner-engine`, `question-bank`, `input-adapter`, `score`, `renderer`, ...) are self-contained modules with one public entrypoint each.
- **Observability** - significant state transitions emit structured `console.debug` events; debug overlay gated behind `?debug=1`.

Constraints to keep in mind:

- Static web app (HTML/JS/CSS), evergreen browsers, mobile-first.
- 60 FPS desktop / 30 FPS 3-yr-old mobile; no per-frame allocations in the run loop.
- Input: keyboard arrows + WASD + touch swipe. Difficulty colours are paired with labels (never colour-alone).

## Layout

- `.specify/` - Spec Kit templates, scripts, extensions. Don't edit by hand; use the `/speckit-*` skills.
- `.specify/memory/constitution.md` - binding principles.
- `specs/<###-name>/` - per-feature artifacts: `spec.md`, `plan.md`, `tasks.md`, etc. (created by skills, one folder per feature branch).

<!-- SPECKIT START -->
**Active feature**: `003-obstacles` — Random geometric obstacles with collision, game-over, and restart.

For technologies, architecture, dependencies, project structure, shell commands, and the constitution-check gates for the active feature, read the current plan:

- `specs/003-obstacles/plan.md` (technical context + constitution check + project tree)
- `specs/003-obstacles/spec.md` (user stories, requirements, success criteria)
- `specs/003-obstacles/research.md` (Phase 0 decisions for this slice)
- `specs/003-obstacles/data-model.md` (new ObstacleGroup / ObstacleVariant / spawn schedule + `'game-over'` RunState)
- `specs/003-obstacles/contracts/module-contracts.md` (new `src/obstacles/` module API + runner-engine extensions + DOM overlay contract)
- `specs/003-obstacles/quickstart.md` (slice-specific validation steps)

The foundational architecture (Three.js scene + DOM overlays + library-first modules + the lane-runner mechanics) is captured in `specs/001-lane-runner/` and `specs/002-scoring-hud/`. This slice introduces the **first fail state** in the game.
<!-- SPECKIT END -->
