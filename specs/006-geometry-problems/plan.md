# Implementation Plan: Real Geometry Problems with Diagrams

**Branch**: `006-geometry-problems` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-geometry-problems/spec.md`

**Note**: Companion artifacts: [research.md](./research.md), [data-model.md](./data-model.md), [contracts/module-contracts.md](./contracts/module-contracts.md), [quickstart.md](./quickstart.md).

## Summary

Replaces the slice-005 placeholder problem pool (15 hand-authored text-only problems per difficulty) with a real geometry-problem system: ~100 hand-curated Basic problems from CC-BY 4.0 textbooks (OpenStax Contemporary Mathematics Ch. 10 + Illustrative Mathematics K-8), ~12-15 parameterised Medium templates, and ~10-15 parameterised Advanced templates. Templated problems render parameterised inline-SVG diagrams in the modal's reserved `.problem-figure` slot (already present from slice 005). Equation text uses Unicode glyphs only — no KaTeX / MathJax dependency, since adding KaTeX would single-handedly break the constitution's 500 KB gzipped budget. CC-BY attribution lands in a `LICENSES.md` at the repo root plus an in-app credits panel reachable from the start / game-over screens.

**Approach**: Two new pure-logic modules and one new renderer DOM helper:

1. **`src/diagrams/`** — primitives (`svg`, `line`, `polygon`, `circle`, `label`) + ~20-30 archetype generators (`rightTriangle`, `trapezoid`, `circleFigure`, `coordinatePlane`, `regularPolygon`, `sphereSilhouette`, `cylinderSilhouette`, `cone`, `pyramid`, `rectangularPrism`, etc.). Each archetype returns a well-formed SVG string from numeric parameters.
2. **`src/problems/`** expanded — replaces the inline pool with: `pool-b.ts` (hand-curated B problems with per-problem `sourceRef`), `templates-m.ts` (Medium template generators), `templates-a.ts` (Advanced template generators), `sources.ts` (the canonical `PROBLEM_SOURCES` list consumed by both the credits panel and `LICENSES.md`-consistency tests). The existing `selectPlaceholderProblem(difficulty, rng)` function stays as the public API but dispatches internally to either the B pool or a difficulty-appropriate template chosen by the rng.
3. **`src/renderer/credits-panel.ts`** — new DOM-adapter factory mirroring the existing `createProblemModal` / `createDebugOverlay` shape. Renders the source list into a host element with show / hide / destroy lifecycle.

The `Problem` interface in `src/shared/types.ts` gains an optional `figure?: string` (SVG markup) and an optional `sourceRef?: string` (source id for B problems). Existing consumers (modal renderer, problem-gates module, runner-engine tests) handle missing fields as "text-only / no source". The slice-005 modal already reserves the `.problem-figure` slot with `:empty { display: none }`; the modal renderer adds one line to inject `problem.figure` into that slot when present.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) — unchanged.

**Primary Dependencies**: No new runtime npm dependencies. Existing Three.js + Vite + Vitest. Specifically NOT adding KaTeX or MathJax — both would put the bundle over budget. The Unicode glyph set covers every archetype in the M and A template library.

**Storage**: None. Problems, templates, source records, and SVG markup are all bundled at build time as TypeScript modules. No localStorage, no IndexedDB, no fetch().

**Testing**: Vitest in the `node` environment for the new pure-logic modules (`diagrams`, `problems`, template generators). Vitest with jsdom for `credits-panel` (DOM adapter) and the modal-figure extension. All existing 248 tests from prior slices remain unchanged.

**Target Platform**: Same as previous slices — modern evergreen desktop + mobile browsers, mobile-first.

**Project Type**: Single project — static web app.

**Performance Goals**: Same 60 FPS / 30 FPS budgets. Per-frame additions are negligible (template generation runs only on gate-modal-open, not per frame; SVG markup is a string assignment to `innerHTML`). The bloom / Three.js scene is unaffected.

**Constraints**:

- Critical JS budget: ≤ 500 KB gzipped. Current ~152 KB; this slice expects ~20-25 KB gzipped growth (problem text + SVG generators + helpers); budget headroom ~325 KB.
- Boundary: `src/diagrams/` and the new files in `src/problems/` MUST be pure logic. No `three`, no DOM imports. The existing ESLint `no-restricted-imports` rule already covers `src/diagrams/` via its catch-all pattern on three.
- Offline-capable: no runtime network fetches. All content bundled at build time.
- All template generators MUST be deterministic — same seed produces the same Problem. Mirrors slice-005's mulberry32 threading convention.
- Backward compatibility: existing Problem consumers (modal show, problem-gates, runner-engine tests) MUST handle `figure?: string` and `sourceRef?: string` as optional. No breaking changes to slice-005 callers.

**Scale/Scope**: ~3300 LOC of new and modified code total:

- `src/diagrams/` — ~700 LOC source + ~400 LOC tests = ~1100 LOC.
- `src/problems/` — `pool-b.ts` ~300 LOC (~100 problems × ~3 lines each); `sources.ts` ~30 LOC; `templates-m.ts` ~600 LOC; `templates-a.ts` ~500 LOC; `problems.ts` ~50 LOC of refactor; tests across the four files ~400 LOC = ~1880 LOC.
- `src/renderer/credits-panel.ts` + test = ~150 LOC.
- `src/renderer/problem-modal.ts` + test extension = ~25 LOC.
- `src/game/game-loop.ts` credits-panel wiring = ~25 LOC.
- `index.html` + CSS = ~40 LOC.
- `LICENSES.md` = ~40 LOC.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0.

### Principle I — Simplicity & YAGNI

- [x] **No new runtime npm dependencies.** All problem content + SVG markup + equation glyphs are bundled at build time as TypeScript. KaTeX / MathJax explicitly rejected — would consume ~430 KB gzipped, breaking the budget single-handedly.
- [x] **No external SVG library.** The archetype set is ~20-30 functions, each a hand-rolled string builder. JSXGraph / Snap.svg / SVG.js would each add 10-200+ KB for sugar over `document.createElementNS` that we don't need (write-once-discard rendering).
- [x] **Reuse existing modal-figure slot from slice 005.** The DOM is already reserved with `:empty { display: none }`; the modal renderer adds one line of code.
- [x] **Hand-maintained `LICENSES.md` (not generated).** A test verifies it stays consistent with `PROBLEM_SOURCES`. Adding a generation script would be premature; the source list is small and changes rarely.
- [x] **Per-template distractor logic (no shared distractor framework).** Each template owns its own distractor recipe. A unifying framework would be speculative scaffolding for a problem we don't have yet.
- [x] **Single-file template libraries** (`templates-m.ts`, `templates-a.ts`) rather than one file per template. The threshold for splitting is "the file gets unwieldy" (>1000 LOC); we won't be there. If we do hit it later, split is mechanical.

### Principle II — Test-First Discipline

- [x] **All new pure functions have declared unit-test obligations:**
  - `src/diagrams/primitives.ts`: each primitive produces a valid SVG fragment string; XML well-formedness for the top-level `svg()` wrapper.
  - `src/diagrams/archetypes.ts`: each archetype's output parses as valid SVG, has the expected `viewBox`, contains the expected label values.
  - `src/problems/templates-m.ts` + `templates-a.ts`: every template generator produces a Problem with 3 pairwise-distinct choices, `correctIndex ∈ {0, 1, 2}`, non-empty prompt, `difficulty` matching the template family. Property test over 1000 random seeds per template asserts the invariants hold across the parameter space.
  - `src/problems/pool-b.ts`: every entry has 3 choices, valid correctIndex, non-empty prompt + sourceRef; every sourceRef exists in `PROBLEM_SOURCES`.
  - `src/problems/sources.ts`: every PROBLEM_SOURCES entry is well-formed; `LICENSES.md` mentions every source id (file-content test reads `LICENSES.md` and looks for each source name).
- [x] **Integration test extension:**
  - `tests/integration/problem-gate-flow.test.ts` extended — when a Problem with a figure is enterAnswering'd and resolveAnswer'd, the world flow still works; spawning a M / A gate produces a Problem with the `figure` field populated.
- [x] **Renderer DOM helpers** (`credits-panel.ts`, `problem-modal.ts` extension) get jsdom smoke tests: show / hide / Escape-to-close / click-outside-to-close; the modal's figure slot fills with the SVG when `problem.figure` is set.
- [x] **Visual code exempt.** Per Constitution II, the *visual look* of the SVG diagrams (do the labels look pretty? do the proportions feel right?) is exempt from strict TDD; only well-formedness + structural assertions are tested.

### Principle III — Library-First / Modular Design

- [x] **`src/diagrams/`** is a new pure-logic module with a single `index.ts` public entrypoint exporting primitives + archetypes. Depends only on basic numbers — no `three`, no DOM, no other game module. Self-testable in isolation.
- [x] **`src/problems/`** stays a pure-data module (no DOM, no three). Internal files reorganise (pool-b / templates-m / templates-a / sources) but the public surface (`selectPlaceholderProblem`, `Problem` type re-export) is preserved. Consumers downstream (problem-gates, game-loop, problem-modal) need NO API changes — they continue calling `selectPlaceholderProblem(difficulty, rng)`.
- [x] **`src/renderer/credits-panel.ts`** lives next to `problem-modal.ts` / `lives-hud.ts` / `floating-score.ts`. Same factory-adapter pattern (`createCreditsPanel(host) → { show, hide, destroy }`). DOM-only; no game-loop coupling. Game-loop wires the show / hide events the same way it wires the problem modal.
- [x] **No module reaches into another's internals.** Every import is via `index.ts` barrels. ESLint `no-restricted-imports` rule already enforces this for the existing modules; the new `src/diagrams/` and `src/problems/` files follow the same convention.
- [x] **Cross-module shared types stay in `src/shared/types.ts`.** The Problem extension (`figure?: string`, `sourceRef?: string`) lands there, not in a sub-module.

### Principle IV — Observability & Debuggability

- [x] **No new `console.debug` event types are strictly required** — this slice is content + rendering rather than state transitions. But for debugging template generation, each template MAY emit a `template_generated` event payload `{ templateId, difficulty, seed }` during development. Gated behind `?debug=1` like the rest of the observability surface.
- [x] **Per-problem source attribution is queryable** via the `Problem.sourceRef` field on hand-curated entries. Useful for in-game debugging ("which textbook did this question come from?") and for the LICENSES.md consistency test.
- [x] **Errors carry context.** Template generators that fail their internal invariants (e.g., distractor collision after N retries) throw with a message including the templateId + seed, so the failing case is reproducible.
- [x] **Existing debug overlay continues to show runState / lives / scoreDelta / activeGate / invincibility.** No new fields needed; the active problem's source / template id is available via `world.activeGate?.problem` if a developer wants to surface it later.

**Result**: ✅ All gates pass on initial check. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/006-geometry-problems/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── contracts/
│   └── module-contracts.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md   (created by /speckit-tasks)
```

### Source Code (repository root)

```text
geometry-dash/
├── LICENSES.md                          # NEW: CC-BY source attribution at repo root
├── index.html                           # MODIFIED: + #credits-overlay, "Problem credits" link in start / game-over
├── src/
│   ├── diagrams/                        # NEW pure-logic module
│   │   ├── index.ts                     # re-exports
│   │   ├── primitives.ts                # svg, line, polygon, circle, label
│   │   ├── primitives.test.ts
│   │   ├── archetypes.ts                # rightTriangle, trapezoid, circleFigure, etc. (~20-30 funcs)
│   │   └── archetypes.test.ts
│   ├── problems/                        # MODIFIED (significant refactor of internals)
│   │   ├── index.ts                     # re-exports (public surface preserved)
│   │   ├── problems.ts                  # selectPlaceholderProblem dispatches to pool-b OR templates
│   │   ├── problems.test.ts             # extended: dispatch correctness, deterministic seeding
│   │   ├── pool-b.ts                    # NEW: ~100 hand-curated B problems with sourceRef
│   │   ├── pool-b.test.ts               # NEW: pool integrity (counts, well-formedness, source refs)
│   │   ├── sources.ts                   # NEW: PROBLEM_SOURCES list (OpenStax + IM + others)
│   │   ├── sources.test.ts              # NEW: LICENSES.md ↔ PROBLEM_SOURCES consistency
│   │   ├── templates-m.ts               # NEW: ~12-15 Medium template generators
│   │   ├── templates-m.test.ts          # NEW: per-template invariants + 1000-seed property tests
│   │   ├── templates-a.ts               # NEW: ~10-15 Advanced template generators
│   │   └── templates-a.test.ts
│   ├── shared/
│   │   └── types.ts                     # MODIFIED: Problem + figure? + sourceRef?
│   ├── renderer/
│   │   ├── index.ts                     # MODIFIED: re-export credits-panel
│   │   ├── problem-modal.ts             # MODIFIED: inject problem.figure into .problem-figure slot
│   │   ├── problem-modal.test.ts        # MODIFIED: figure-rendered + figure-empty smoke tests
│   │   ├── credits-panel.ts             # NEW DOM adapter
│   │   └── credits-panel.test.ts
│   ├── game/
│   │   └── game-loop.ts                 # MODIFIED: credits-panel show / hide wiring
│   ├── main.ts                          # MODIFIED: query #credits-overlay + #credits-link
│   ├── problem-gates/                   # UNCHANGED (consumes Problem; figure flows through transparently)
│   ├── runner-engine/                   # UNCHANGED
│   ├── lane-state/                      # UNCHANGED
│   ├── input-adapter/                   # UNCHANGED
│   ├── obstacles/                       # UNCHANGED
│   ├── escalation/                      # UNCHANGED
│   └── score/                           # UNCHANGED
└── tests/
    └── integration/
        ├── problem-gate-flow.test.ts    # MODIFIED: + figure-renders-in-modal case
        └── lives-flow.test.ts           # UNCHANGED
```

**Structure Decision**: Single-project static web app, layout unchanged at top level. Two new pure-logic modules (`src/diagrams/` for SVG generation, expanded `src/problems/` for content + templates) and one new renderer DOM adapter (`credits-panel.ts`). The Problem entity gains two optional fields; no breaking changes. The existing modal-figure slot from slice 005 fills automatically.

## Phase 0 — Outline & Research

See [research.md](./research.md). Slice-specific decisions, most of which were converged before `/speckit-specify` ran via a research-agent dispatch:

- **Why no external SVG library** (vs JSXGraph, Snap.svg, SVG.js, D3).
- **Why no KaTeX / MathJax** (bundle budget) and what Unicode covers.
- **Module organisation: `src/diagrams/` separate from `src/problems/`** (vs merging).
- **Pool-b as one file vs many per-problem files** (one wins).
- **Single-file template libraries** (`templates-m.ts`, `templates-a.ts`) vs per-template files.
- **Hand-maintained `LICENSES.md` vs generated** (hand wins for now).
- **Per-template distractor logic vs shared framework** (per wins).
- **Determinism convention** (mulberry32 threaded seeds, same as slice 005).
- **Diagram aspect ratio default** (320 × 240 viewBox; templates may override).
- **Credits panel UX** (DOM overlay matching the existing pattern; reachable from start + game-over screens).

## Phase 1 — Design & Contracts

See [data-model.md](./data-model.md) and [contracts/module-contracts.md](./contracts/module-contracts.md).

- **Entities**: `Problem` extended with optional `figure?: string` and `sourceRef?: string`. New `ProblemSource` interface (`id`, `name`, `url`, `license`, `attribution`). New `Template` shape (a function from `seed` to `{ problem, nextSeed }`). New SVG archetype shape (pure functions from numeric parameters to SVG strings).
- **Module contracts**:
  - `src/diagrams/`: primitives + ~20-30 archetypes, all pure functions returning SVG strings.
  - `src/problems/`: public surface (`selectPlaceholderProblem`, `Problem`, `AnswerChoice` re-export) preserved; internal restructure into pool-b + templates + sources.
  - `src/renderer/credits-panel.ts`: standard factory adapter.
  - `src/renderer/problem-modal.ts`: one-line extension to inject `problem.figure`.
- **DOM contract additions** (in `index.html`):
  - `#credits-overlay` overlay element (hidden by default), reuses the `.overlay` CSS class.
  - A small "Problem credits" link in `#start-screen` and `#game-over-overlay`.
  - CSS for the credits-panel layout (compact list of source name + URL + attribution lines).

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1.*

- [x] `src/diagrams/` and the new `src/problems/` files live in pure-logic territory with the same boundary rules as the existing pure modules. **Principle III holds.**
- [x] No new runtime dependencies; no speculative abstractions; reuse of slice-005 modal-figure slot. **Principle I holds.**
- [x] Every new function carries declared test obligations; templates have property-test coverage over 1000 seeds. **Principle II holds.**
- [x] Per-problem `sourceRef` + per-template id give downstream debuggers a path to "which problem was this?". **Principle IV holds.**

**Result**: ✅ Post-design re-check passes.

## Complexity Tracking

> Fill ONLY if Constitution Key has violations that must be justified.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)*  | -          | -                                    |
