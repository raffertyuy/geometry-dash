# The Real Geometry Dash

A web-based endless runner in the spirit of Subway Surfers, where collidable **problem gates** punctuate the obstacle field. The player runs forward, swipes/keys between lanes, and may hit a glowing Rubik's-cube-style gate that pauses the run and asks a multiple-choice question (initially geometry placeholders; future slices will introduce real diagrams + equation typesetting). Gate colour signals difficulty: muted green = Basic, muted orange = Medium, muted red = Advanced. Correct answers earn ±1k/5k/10k points (B/M/A); wrong answers cost the same magnitude AND a life. The runner starts with 3 lives shown as faceted heart icons; obstacle hits also cost a life and respawn the runner with a 1.5-second blinking invincibility window. The score floors at zero — wrong answers still cost the difficulty's points, but they cannot drive the displayed score below zero. The only end-of-run condition is zero lives. (Slice 005 originally had a second "score below zero" end condition; it was retired in the 008 follow-up because it punished early-game wrong answers too aggressively.)

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

## Public repo / secrets policy

This codebase is published to a **public GitHub repo** (`raffertyuy/geometry-dash`). Everything checked in is world-readable. Before committing, audit for accidental secrets.

**Safe to commit** (per Cloudflare's own published examples — these are identifiers, not credentials):

- Cloudflare KV namespace IDs, D1 database IDs, R2 bucket names, Queue names.
- Worker name, binding names, route patterns, custom domain (`trgd.raztype.com`).
- Cloudflare account ID — technically non-sensitive but keep it OUT of the repo as a defence-in-depth measure; let `wrangler` pick it up from the local session or CI env.

**Never commit — must live in Cloudflare Worker secrets or GitHub Actions secrets**:

- Cloudflare API tokens (`CLOUDFLARE_API_TOKEN`) → GitHub repo settings → Secrets and variables → Actions, for any CI-driven `wrangler deploy`.
- HMAC / JWT signing keys, OAuth client secrets, third-party API keys, DB passwords, encryption keys → `wrangler secret put NAME` (or dashboard → Worker → Settings → Variables → Encrypt) so they're available as `env.NAME` at runtime but never in source.
- Anything in a `.env*` file that isn't `.env.example`. The repo's `.gitignore` should ignore real `.env*`; only `.env.example` (with dummy values) is committable.

**When introducing a new feature that needs a secret**: surface it in the slice's `spec.md` / `plan.md`, list the required secret names + where they live (Worker secret vs. GitHub Actions secret), and document the bootstrap step in `quickstart.md` so a fresh contributor can run the project. Never paste real values into Spec Kit artifacts — even committed plans go public.

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
**Active feature**: `010-leaderboard` — Add a global top-20 leaderboard backed by a single Cloudflare Worker handler that reads / writes one JSON blob in a Cloudflare KV namespace (`geometry-dash-leaderboard`, binding `LEADERBOARD`). The client gains a new `src/leaderboard/` pure-logic module (fetch, submission gating, personal-best derivation, localStorage adapter), a DOM panel on the start + game-over screens, and a 3-letter-initials submission form that opens only when a run cracks the top 20. Anti-abuse for v1 is intentionally light: server-side payload validation, a fixed-window per-IP rate limit (10/hour), a small embedded profanity wordlist, and a generous time-based score plausibility bound. No HMAC signing for v1, but the endpoint shape keeps a future `SIGNING_KEY` Worker-secret upgrade additive. Infrastructure-as-code lands in a new `wrangler.toml` at the repo root.

For technologies, architecture, dependencies, project structure, shell commands, and the constitution-check gates for the active feature, read the current plan:

- `specs/010-leaderboard/plan.md` (technical context + constitution check + project tree)
- `specs/010-leaderboard/spec.md` (user stories, requirements, success criteria)
- `specs/010-leaderboard/research.md` (KV-over-D1 decision, wrangler-format choice, rate-limit strategy, score plausibility formula, dev story, signing-key upgrade path)
- `specs/010-leaderboard/data-model.md` (`LeaderboardEntry` + `SubmissionRequest/Response` + `PersonalBest` + `RateLimitBucket` + new `src/shared/config.ts` constants)
- `specs/010-leaderboard/contracts/module-contracts.md` (new `src/leaderboard/` + `src/worker/` modules + renderer + game-loop integration)
- `specs/010-leaderboard/contracts/api.md` (HTTP contract for GET/POST `/api/leaderboard` + forward-compat notes)
- `specs/010-leaderboard/quickstart.md` (slice-specific validation, abuse-vector pass, operator playbook)

The foundational architecture is captured in `specs/001-lane-runner/` through `specs/009-audio/`. This slice introduces the first backend subsystem; new devDependencies are `wrangler` (CLI + types) and `@cloudflare/workers-types`. No new client runtime dependency.
<!-- SPECKIT END -->
