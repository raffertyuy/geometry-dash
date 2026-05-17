# Research: Real Geometry Problems with Diagrams (Phase 0)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-17

No `[NEEDS CLARIFICATION]` markers — the scope was converged via a research-agent dispatch before `/speckit-specify` ran. Phase 0 captures the surviving design decisions.

---

## Decisions

### Inline SVG via in-repo helpers (no external SVG library)

- **Decision**: A new `src/diagrams/` module with hand-rolled primitives (`svg`, `line`, `polygon`, `circle`, `label`) and ~20-30 archetype generators (`rightTriangle`, `trapezoid`, `circleFigure`, etc.). Each archetype returns an SVG string. No external library.
- **Rationale**:
  - For ~20-30 fixed archetypes parameterised by 2-5 numbers each, the actual SVG per diagram is ~10-30 lines. A 200-line in-repo helper covers everything.
  - JSXGraph (~80-100 KB gzipped) is designed for interactive constructions, not static figure emission — overkill.
  - Snap.svg (~16 KB gzipped) is Adobe-archived and stale; the DOM-manipulation sugar isn't useful for write-once-discard rendering.
  - D3 / Two.js / SVG.js are renderer-agnostic / animation-focused; none save meaningful code for our fixed archetypes.
- **Alternatives considered**:
  - **JSXGraph**: rejected (overkill + non-trivial bundle hit).
  - **Snap.svg**: rejected (stale + unnecessary).
  - **MathBox**: WebGL, 3D; out of scope.
  - **Pre-rendered image assets**: explicitly out per spec; we want parameterised diagrams driven from the same parameter set as the problem text.

### Unicode-only equation rendering (no KaTeX or MathJax)

- **Decision**: Equation text in problem prompts uses Unicode glyphs (`√`, `π`, `°`, `·`, `²`, `³`, `½`, superscripts `⁰..⁹`, subscripts `₀..₉`). A small `mathText()` DOM helper wraps cases Unicode doesn't cover (e.g., multi-digit exponents like `x¹¹` → `x<sup>11</sup>`).
- **Rationale**:
  - KaTeX adds ~75 KB gzipped JS + ~350 KB gzipped fonts (per docs) for ~430 KB total. Adding this to a current ~152 KB bundle puts us at ~582 KB gzipped, single-handedly **breaking** the 500 KB constitution budget.
  - MathJax is even heavier (~200 KB+ gzipped JS + font costs).
  - The Unicode glyph set covers every archetype in the M and A template library: Pythagoras, areas, volumes, Heron, distance formula, special-angle trig. We controllably author problem text inside the glyph set.
  - The Unicode trade-off (no native equation typesetting for matrices / nested fractions / proofs) is acceptable because the M and A archetypes we're shipping don't need any of those.
- **Alternatives considered**:
  - **KaTeX**: rejected (budget killer; not justified by current archetype needs).
  - **MathJax**: rejected (even heavier).
  - **Lazy-loaded KaTeX**: tempting fallback for a future slice if matrices / proofs ship — load only when the modal opens AND a problem requests math typesetting. Deferred for now.
  - **Inline MathML**: browser support is uneven; Safari has historic gaps; KaTeX is the canonical "render math in web" choice.

### Module organisation: `src/diagrams/` separate from `src/problems/`

- **Decision**: SVG generation lives in its own module `src/diagrams/`. The `src/problems/` module imports archetypes from `src/diagrams/` when constructing templated Problems.
- **Rationale**:
  - Diagrams are reusable across templates (one `rightTriangle` archetype serves the Pythagoras template, the area-of-right-triangle template, special-angle trig templates). Co-locating diagrams in `src/problems/` would force them under a problem-module owner that doesn't reflect reuse.
  - Diagrams have different test obligations (well-formedness, viewBox correctness) than problems (3-choices, correctIndex). Separate modules = separate test suites.
  - The Library-First principle treats subsystems as folders. Two distinct subsystems → two folders.
- **Alternatives considered**:
  - **Inline diagram functions in each template file**: rejected — duplicates the archetype across templates that share it (every right-triangle template, for example, would re-define rightTriangle drawing).
  - **Diagrams inside `src/renderer/`**: rejected — diagrams are pure-logic string builders; they don't touch DOM. Putting them in `renderer/` would imply runtime-DOM dependency.

### Pool-b as one file, templates-m / templates-a as one file each

- **Decision**: All ~100 Basic problems live in a single `src/problems/pool-b.ts`. All Medium templates live in `templates-m.ts`. All Advanced templates live in `templates-a.ts`.
- **Rationale**:
  - One file is easier to grep and refactor than ~125 individual files.
  - A test-time pool import is one barrel; per-template files would force `import.meta.glob` or explicit barrel maintenance.
  - The split threshold is "the file gets unwieldy" (>1000 LOC each). Estimated sizes: pool-b ~300 LOC, templates-m ~600 LOC, templates-a ~500 LOC. All under the threshold.
- **Alternatives considered**:
  - **Per-template files in `src/problems/templates/m/*.ts`**: rejected — premature subdivision. If the threshold gets crossed later, splitting is mechanical.
  - **JSON content + TS loader**: rejected — TypeScript gives us type-checked correctIndex values, distractor-collision tests at compile time for static problems, and tree-shaking for unused templates.

### Hand-maintained `LICENSES.md` (not auto-generated)

- **Decision**: `LICENSES.md` lives at the repo root and is hand-maintained. A test reads its content and verifies every source id from `PROBLEM_SOURCES` is mentioned in the file (substring match).
- **Rationale**:
  - The source list is small (initially 2 sources: OpenStax + Illustrative Mathematics). Hand-maintenance is cheap.
  - The CC BY 4.0 attribution text needs careful phrasing per source — a generation script would just re-format the same hand-written attribution string.
  - The consistency test catches "added a source to PROBLEM_SOURCES but forgot LICENSES.md" before it ships.
- **Alternatives considered**:
  - **Generate `LICENSES.md` from `PROBLEM_SOURCES` at build time**: rejected for now (over-engineering for two sources). A future slice with 10+ sources may revisit.

### Per-template distractor logic (no shared distractor framework)

- **Decision**: Each template owns its own distractor recipe. No shared "distractor strategy" abstraction.
- **Rationale**:
  - Plausible distractors are template-specific. The Pythagoras template's good distractors are "A + B" and "|A − B|"; the circle-area template's good distractors are "2π·r" (mistaken for circumference) or "π·r" (forgot the square). A shared framework would either be too generic (just "correct ± random") or accumulate a long enum of per-template strategy hooks.
  - Per-template code is plain and readable. Each template is ~30-50 LOC including its distractor recipe.
- **Alternatives considered**:
  - **Shared `distractorRecipe(correct, recipe: 'near-miss' | 'unit-confusion' | 'forgot-divide-by-2' | …)` function**: rejected — anticipates strategies we don't have yet. Three lines of inline distractor code beats a premature abstraction.

### Determinism via threaded mulberry32 seeds (same as slice 005)

- **Decision**: Every template generator follows the slice-005 convention: takes a seed, performs N draws via inline mulberry32 stepping, returns `{ problem, nextSeed }`. Same algorithm, same threading.
- **Rationale**:
  - Consistency with slice-005's `augmentRowWithGates` pattern — easier for the game-loop to thread one rng state across spawners and templates.
  - mulberry32 is fast, well-distributed, and ~10 lines of code. No library needed.
  - Determinism enables property-based testing (fixed seed → fixed problem) and reproducible bug reports ("seed X produced a bad distractor").
- **Alternatives considered**:
  - **Math.random()**: rejected (non-deterministic; can't reproduce).
  - **xoshiro / xorshift / sfc32**: also fine, but mulberry32 is already in the codebase; sticking with one PRNG is simpler.

### Diagram aspect ratio: 320 × 240 viewBox default (templates may override)

- **Decision**: Most archetypes use a 320 × 240 viewBox by default. Templates that need taller / wider figures (e.g., a vertical cone, a wide composite figure) override per-archetype.
- **Rationale**:
  - 320 × 240 is a 4:3 aspect ratio that fits comfortably above 3 stacked answer rows on a 320 × 568 portrait phone (the minimum viewport).
  - The CSS `.problem-figure` slot has `max-height: 40vh` (from slice 005), so the figure scales to fit regardless of intrinsic viewBox dimensions.
  - Tall figures (e.g., 240 × 320) are also valid; the CSS scales them.
- **Alternatives considered**:
  - **Per-archetype dynamic viewBox** (fit-to-content): rejected for now — adds complexity to each archetype function and produces inconsistent labels-vs-figure sizing across diagrams. A future polish slice can revisit.

### Credits panel UX (DOM overlay, opens from start + game-over)

- **Decision**: A new `#credits-overlay` element in `index.html`, hidden by default, opens on click of a "Problem credits" link visible in `#start-screen` and `#game-over-overlay`. Closes on Escape, click-outside, or close-button tap. Reuses the existing `.overlay` CSS class for backdrop / dismissal pattern.
- **Rationale**:
  - Visual consistency with existing pause / game-over overlays.
  - Reachable when the player is curious (start screen) AND when they've just finished a run and might want to know "who wrote that question I just got wrong?" (game-over).
  - Not reachable mid-run (the runner doesn't need to read credits while dodging). Could be revisited if a future slice adds a pause menu.
- **Alternatives considered**:
  - **Always-visible "credits" footer link**: rejected — clutters the runner HUD.
  - **Standalone credits page**: rejected — this is a single-page app; navigating away breaks the offline-capable model.

---

## No-changes inherited from earlier slices

- TypeScript strict config; Vite; Vitest in `node` (jsdom for renderer tests).
- ESLint flat config + `no-restricted-imports` boundary rule covers the new `src/diagrams/` and additional `src/problems/` files automatically.
- WorldState immutability + the `runState`-guarded `tickWorld`.
- Pause / blur / resume input behaviour.
- Slice-005 modal CSS (including `.problem-figure { max-height: 40vh; :empty { display: none } }`).
- Slice-005 problem-gate flow (collision → modal → answer → score / lives update).
- Constitution v1.0.0.

## Open follow-ups (NOT in this slice)

- KaTeX / MathJax lazy-load for problems that need matrices, proofs, or nested fractions.
- Per-template SVG variants (e.g., colour-coded triangle edges for different problem framings).
- Diagram interactivity (hover labels, click to highlight).
- Tier-aware difficulty distribution (more A gates at higher escalation tiers).
- Audio cues for life lost / right / wrong answers.
- Localisation: problem texts currently English-only; future slice can add an `i18n` layer.
- Spaced-repetition: track which problems the player has seen and weight the distribution accordingly.
- Best-score / total-correct-answers persistence (localStorage).
- Build-time LLM-generated problem pre-generation (could augment the hand-curated B pool).
