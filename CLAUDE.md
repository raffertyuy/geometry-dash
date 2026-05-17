# The Real Geometry Dash

A web-based endless runner in the spirit of Subway Surfers, where collidable **problem gates** punctuate the obstacle field. The player runs forward, swipes/keys between lanes, and may hit a glowing Rubik's-cube-style gate that pauses the run and asks a multiple-choice question (initially geometry placeholders; future slices will introduce real diagrams + equation typesetting). Gate colour signals difficulty: muted green = Basic, muted orange = Medium, muted red = Advanced. Correct answers earn ±1k/5k/10k points (B/M/A); wrong answers cost the same magnitude AND a life. The runner starts with 3 lives shown as faceted heart icons; obstacle hits also cost a life and respawn the runner with a 3-second blinking invincibility window. The score floors at zero — wrong answers still cost the difficulty's points, but they cannot drive the displayed score below zero. The only end-of-run condition is zero lives. (Slice 005 originally had a second "score below zero" end condition; it was retired in the 008 follow-up because it punished early-game wrong answers too aggressively.)

## Working in this repo

This project uses **GitHub Spec Kit** for spec-driven development. Before writing code for any non-trivial feature:

1. `/speckit-specify "<feature description>"` - creates a feature branch and `specs/<###-name>/spec.md`.
2. `/speckit-clarify` - asks targeted questions and folds answers back into the spec.
3. `/speckit-plan` - generates `plan.md` (tech context, architecture, project structure).
4. `/speckit-tasks` - generates dependency-ordered `tasks.md`.
5. `/speckit-analyze` - cross-checks spec/plan/tasks for inconsistencies (optional but recommended).
6. `/speckit-implement` - executes tasks one by one.

Auxiliary skills: `/speckit-checklist`, `/speckit-constitution`, `/speckit-taskstoissues`.

## Autonomous workflow

Drive the full Spec Kit chain end-to-end without per-step confirmation: `/speckit-specify` → `/speckit-clarify` (only if there are genuinely open spec questions) → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`. Commit at every natural artifact boundary using the project's conventional message style (`feat(spec):`, `plan(NNN):`, `tasks(NNN):`, `impl(NNN):`, etc.). Fix every issue surfaced by `/speckit-analyze` and during implementation without asking — the spec, the constitution-check gate in `plan.md`, and `/speckit-analyze` itself are the safety net.

Pause to ask only when:

- A spec ambiguity materially affects user experience and has no clear default.
- A constitution violation needs justification in `plan.md` (Complexity Tracking).
- A destructive / hard-to-reverse action would help (force push, branch delete, dependency removal).
- An external-visible action would help (PR creation, deploy, posting to a chat).

Narrate concisely as you go so the user can interrupt if something looks off.

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
**Active feature**: `008-how-to-play` — Replace the "Problem Credits" link on the start and game-over screens with a single "How to Play" link that opens a new three-section modal (General Rules / Problem Cubes / Credits). The Problem Cubes section renders one row per difficulty with a coloured swatch + label + description + point value + countdown. Credits inherits the CC-BY source list from the deleted `credits-panel` module. Also add a top-of-playfield **Pause button** that is rendered only while a run is in progress and enabled only when the run is actively running with no gate modal open and no respawn invincibility blinking. Pressing the button (or ESC / SPACE) pauses the run via the existing `pauseRun` reducer and opens the same How-to-Play modal in pause-mode; closing the modal (X / ESC / SPACE) calls `resumeRun`.

For technologies, architecture, dependencies, project structure, shell commands, and the constitution-check gates for the active feature, read the current plan:

- `specs/008-how-to-play/plan.md` (technical context + constitution check + project tree)
- `specs/008-how-to-play/spec.md` (user stories, requirements, success criteria)
- `specs/008-how-to-play/research.md` (module-replacement decision, mode-as-closure-state, pause-button derivation, ESC/SPACE capture)
- `specs/008-how-to-play/data-model.md` (`HowToPlayMode` + Pause-button derivation rules)
- `specs/008-how-to-play/contracts/module-contracts.md` (new `how-to-play-modal` + `pause-button` modules; deleted `credits-panel`)
- `specs/008-how-to-play/quickstart.md` (slice-specific validation steps)

The foundational architecture is captured in `specs/001-lane-runner/` through `specs/007-problem-timer/`. This slice replaces the existing credits panel with a richer tutorial modal and adds the first in-game pause affordance with a UI surface (separate from the existing pause-on-blur path).
<!-- SPECKIT END -->
