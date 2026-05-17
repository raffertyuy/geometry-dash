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

## Tooling latitude

You have standing permission to evolve the dev environment when it helps the work — no need to ask first:

- Edit `CLAUDE.md` to keep instructions accurate as the project changes.
- Author new Claude Code skills (under `.claude/skills/` or `~/.claude/skills/`) when a repeated workflow would benefit.
- Configure new MCP servers when they unlock useful capabilities (e.g. docs, design refs, deployment).

Still narrate what you're changing and why, and roll changes back if they don't earn their keep.

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
- `README.md` - the human-facing introduction to the project for junior developers. **Keep this in sync** when shipping new features: each completed slice should update the "What's in it (so far)" section with a one-line summary of the new capability. The README also flags that the project is 100% vibe-coded with the Spec Kit, so the section list itself is part of the story.

<!-- SPECKIT START -->
**Active feature**: `005-problem-gates` — Question-answer "problem gates" (B/M/A difficulty, glowing Rubik's-cube meshes in muted green/orange/red) co-spawn with obstacles; collision opens a modal with three answer choices; correct/wrong = ±1k/5k/10k points + (on wrong) −1 life. 3 lives per run (geometric heart icons in HUD); obstacle hits now cost a life + respawn in centre lane with 3 s blinking invincibility. Game-over on either 0 lives or score < 0. Placeholder problems for now.

For technologies, architecture, dependencies, project structure, shell commands, and the constitution-check gates for the active feature, read the current plan:

- `specs/005-problem-gates/plan.md` (technical context + constitution check + project tree)
- `specs/005-problem-gates/spec.md` (user stories, requirements, success criteria)
- `specs/005-problem-gates/research.md` (Phase 0 decisions for this slice)
- `specs/005-problem-gates/data-model.md` (new entities, WorldState extensions, lifecycle with the new `'answering'` state)
- `specs/005-problem-gates/contracts/module-contracts.md` (new `src/problem-gates/` + `src/problems/` modules + renderer DOM helpers + runner-engine transitions + `computeScore` parameter extension)
- `specs/005-problem-gates/quickstart.md` (slice-specific validation steps)

The foundational architecture is captured in `specs/001-lane-runner/`, `specs/002-scoring-hud/`, `specs/003-obstacles/`, and `specs/004-difficulty-escalation/`. This slice introduces the game's first **question-answer mechanic** and the **lives system** that makes the runner game survivable across more than one mistake.
<!-- SPECKIT END -->
