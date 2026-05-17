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
**Active feature**: `004-difficulty-escalation` — Every 30 seconds run speed scales by 1.10x and the score per 0.1s increases by 1.

For technologies, architecture, dependencies, project structure, shell commands, and the constitution-check gates for the active feature, read the current plan:

- `specs/004-difficulty-escalation/plan.md` (technical context + constitution check + project tree)
- `specs/004-difficulty-escalation/spec.md` (user stories, requirements, success criteria)
- `specs/004-difficulty-escalation/research.md` (Phase 0 decisions for this slice)
- `specs/004-difficulty-escalation/data-model.md` (derived tier + piecewise score formula)
- `specs/004-difficulty-escalation/contracts/module-contracts.md` (new `src/escalation/` module API + `computeScore` rewrite + `tickWorld` optional param)
- `specs/004-difficulty-escalation/quickstart.md` (slice-specific validation steps)

The foundational architecture is captured in `specs/001-lane-runner/`, `specs/002-scoring-hud/`, and `specs/003-obstacles/`. This slice introduces the game's first **progression curve** — by tier ~20 the world becomes effectively unsurvivable, which is the natural endgame.
<!-- SPECKIT END -->
