# Feature Specification: Real Geometry Problems with Diagrams

**Feature Branch**: `006-geometry-problems`

**Created**: 2026-05-17

**Status**: Draft

**Input**: User description: "Real geometry problems with parameterised SVG diagrams and Unicode-rendered equations, replacing the 15-per-difficulty text-only placeholder pool from slice 005. ~100 hand-curated Basic problems from OpenStax + Illustrative Mathematics (CC BY 4.0). ~12-15 Medium templates (Pythagoras, perimeter/area, circle, polygon angles, simple volume) and ~10-15 Advanced templates (sphere/cone/cylinder/pyramid volume + SA, Heron, distance/midpoint/slope, composite areas, special-angle trig). Each templated problem renders a parameterised SVG diagram in the modal's reserved `.problem-figure` slot. Unicode-only equation rendering — no KaTeX/MathJax (would break the 500 KB bundle budget). LICENSES.md + in-app credits panel for CC-BY attribution."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real, varied geometry problems replace the placeholder pool (Priority: P1)

A player starts a run, hits a green Basic gate, and reads a real geometry recall question: "How many faces does a regular icosahedron have?" with three plausible answers. They answer correctly, +1000 points float up, and a few seconds later they hit an orange Medium gate showing a Pythagorean-triple right triangle with labelled legs 8 and 15 and a "find the hypotenuse" prompt. They answer wrong, lose 5000 points and one heart. The next gate is a red Advanced gate with a sphere-volume problem: "Sphere with radius 6, volume?" plus a small circle-with-radius-arrow diagram. Across the next five minutes the player encounters 30+ distinct problems without seeing the exact same wording twice.

**Why this priority**: This is the slice's defining value. Without real problems, the gates remain decorative — they look good (post-005) but the player's actual choice is meaningless trivia. Real graded problems turn each gate into a moment of cognitive engagement, which is the whole point of the runner-with-Q&A genre. The 15-per-difficulty placeholder pool from slice 005 is small enough to feel repetitive within a single 2-minute session; this slice solves that by scale (~100 B) and combinatorial templating (~25 M+A templates × many parameter values each).

**Independent Test**: Open `localhost:5173`, start a fresh run, and play for five minutes. Count the distinct problem prompts encountered. At least 30 unique prompts should appear; no two should be exact-text duplicates. Hit problems at all three difficulties; each should read as a legitimate geometry question (not "How many sides does a pentagon have?" repeated). Wrong answers correctly deduct points and (if not the last life) a heart.

**Acceptance Scenarios**:

1. **Given** a fresh run begins, **When** the player hits the first Basic gate, **Then** the modal opens with a recall-style geometry question — shape names, polygon side counts, 3D-solid face counts, angle terminology, or similar — sourced from a hand-curated pool of approximately 100 problems.
2. **Given** the player hits a Medium gate, **When** the modal opens, **Then** the problem is a single-formula geometry calculation (Pythagoras, area, perimeter, circle area, polygon angle sum, simple volume, etc.) with a numerically clean correct answer and three distinct answer choices.
3. **Given** the player hits an Advanced gate, **When** the modal opens, **Then** the problem is a multi-step geometry calculation (sphere/cone/cylinder/pyramid volume, Heron, distance / midpoint / slope, composite area, special-angle trig) with a clean correct answer and three distinct choices.
4. **Given** the player hits two Medium gates in a row, **When** they read both problems, **Then** the two problems are not the exact same text (templates pick different parameter values per spawn).
5. **Given** the player plays for five minutes, **When** they tally the distinct problem prompts they encountered, **Then** at least 30 unique prompts appeared.
6. **Given** a templated problem is generated, **When** the modal shows it, **Then** exactly three answer choices appear, one is correct, and the correct answer's index is in `{0, 1, 2}`.
7. **Given** any answer commit, **When** the score and lives update, **Then** the existing rules from slice 005 still apply: correct = +1000/+5000/+10000, wrong = same magnitude penalty + −1 life, two-condition game-over (0 lives OR score < 0), invincibility absorbs both obstacles and gates.

---

### User Story 2 - Parameterised SVG diagrams render alongside Medium and Advanced problems (Priority: P2)

A player hits a Medium right-triangle gate. The modal opens and beside the question prompt there's a clear, sharp diagram: a right triangle with the two legs labelled "8" and "15", a small square in the right-angle corner, and the hypotenuse drawn unlabelled (because the answer is what's asked). They glance at the diagram, do the Pythagorean computation, and pick "17". On a later Advanced sphere-volume gate, the diagram shows a small circle with a labelled radius arrow. On a coordinate-geometry distance problem, a small coordinate plane shows the two points and the line between them. Every templated problem with geometric structure has a matching diagram derived from the same parameter values.

**Why this priority**: Diagrams transform "solve a generic word problem" into "see and reason about a specific configuration." For geometry specifically, the diagram is often the problem — a text-only "find the area of a trapezoid with parallel sides 6 and 10 and height 4" is much harder to picture than a visible labelled trapezoid. Independent value from US1: even with text-only problems shipping, adding diagrams later would noticeably improve solvability and engagement. Could ship in isolation if the M/A templates already existed; in practice it ships alongside US1.

**Independent Test**: Encounter a Medium or Advanced problem with geometric structure (right triangle, trapezoid, circle, coordinate plane, sphere, cylinder, etc.). Verify a clear SVG diagram appears in the modal's reserved figure slot (top half of the modal panel). The diagram's labels match the problem text exactly (e.g., if the prompt says "legs 8 and 15", the SVG labels show those numbers). Resize the browser to 320 px wide; the diagram scales down without overflowing the modal panel. The slot stays hidden (no empty white box) for Basic problems and any Medium/Advanced problems that don't have a meaningful geometric figure (e.g., "What is the sum of interior angles of a 12-gon?" — no specific figure needed beyond rendering a generic 12-gon, which is the implementer's call).

**Acceptance Scenarios**:

1. **Given** a templated Medium or Advanced problem with geometric structure (right triangle, trapezoid, circle, coordinate plane, regular polygon, sphere, cone, cylinder, pyramid, or composite figure), **When** the modal opens, **Then** an inline SVG diagram appears in the reserved figure slot showing the configuration with labels matching the problem text.
2. **Given** a Basic problem (text-only recall question with no specific geometric configuration to illustrate), **When** the modal opens, **Then** the figure slot stays hidden (no empty box, no broken-image icon, no leftover whitespace).
3. **Given** a problem whose figure parameters change between two spawns (e.g., a rectangle template producing different W × H values), **When** the player encounters both, **Then** the two diagrams are visibly different — the rectangles have proportionally different aspect ratios that match the parameter values.
4. **Given** the modal opens on a 320 px-wide mobile viewport, **When** the player views the diagram, **Then** it fits within the modal panel without horizontal overflow; the three answer choices below remain tappable with 44+ px hit targets.
5. **Given** an SVG diagram renders, **When** the SVG source is inspected, **Then** it has a valid `viewBox` attribute, labels are positioned correctly, and the entire string parses as well-formed XML.

---

### User Story 3 - Source attribution is visible (Priority: P3)

A curious player taps "Problem credits" from the start screen and sees a simple panel listing every source: "Basic problems sourced from OpenStax Contemporary Mathematics, Chapter 10 (CC BY 4.0)" with a link, "Basic problems sourced from Illustrative Mathematics K-8 Geometry (CC BY 4.0)" with another link, and a short statement that templated Medium and Advanced problems are original to this project. The player closes the panel and returns to the game. A future developer cloning the repo opens `LICENSES.md` at the root and sees the same source list plus the full required CC BY 4.0 attribution lines.

**Why this priority**: CC BY 4.0 is a legal compliance requirement — using OpenStax / Illustrative Mathematics content without visible attribution is a licence violation. Both surfaces (in-app for players, repo for downstream developers and crawlers) are required to satisfy "in any reasonable manner" attribution per the licence terms. Independent of US1 and US2 in that it could ship even if no real problems shipped (an empty LICENSES.md and credits panel are easy to create) — but legally REQUIRED if US1 ships, so functionally it must accompany US1.

**Independent Test**: Open the start screen on a fresh load. A "Problem credits" link / button is visible. Tap / click it; a panel opens listing each problem source by name, URL, and attribution statement. Close the panel; the game resumes the start-screen state. From the repo, open `LICENSES.md` at the root; it lists the same sources with full CC BY 4.0-required text.

**Acceptance Scenarios**:

1. **Given** the player is on the start screen, **When** they look for a credits link, **Then** a "Problem credits" (or equivalent) button / link is visible without scrolling.
2. **Given** the player opens the credits panel, **When** they read it, **Then** every source from which Basic problems were curated is named, with its URL and required attribution text.
3. **Given** the repo is cloned fresh, **When** the developer opens `LICENSES.md` at the root, **Then** the file lists every CC-BY-licensed source with URL and attribution text, in a format suitable for compliance review.
4. **Given** a hand-curated Basic problem is in the pool, **When** the developer inspects its metadata, **Then** the source URL or textbook reference is recorded per-problem so individual problems trace back to their textbook origin (useful for compliance audits and for generating `LICENSES.md`).
5. **Given** the credits panel is open, **When** the player taps outside it or presses Escape, **Then** the panel closes and the start screen is restored.

---

### Edge Cases

- **A template's parameter selection happens to produce a wrong-answer distractor that equals the correct answer.** The generator must detect the collision and re-pick the distractor (or the correct value's place in the answer list) before returning the Problem. No problem with duplicate answer choices ever reaches the player.
- **A Basic problem references a shape that isn't easily depictable in text (e.g., "How many faces does a dodecahedron have?").** No diagram is shown — Basic problems default to text-only; the figure slot stays hidden via CSS `:empty`.
- **Two consecutive gates produce the same template result (rare but possible if the rng happens to repeat).** Deterministic templating means same seed → same problem; but the spawner's seed advances each call, so consecutive spawns get different seeds and (with overwhelming probability) different parameters. The implementation may additionally guard against exact-text duplicates within a short recent-history window if needed.
- **A diagram label overlaps another label at small parameter values (e.g., a tiny triangle).** SVG positions are computed from parameters; the template should normalise the diagram's bounding box and pad labels so they don't collide at any valid parameter value. Template tests should include extreme-parameter cases.
- **The player encounters a problem that requires multi-digit superscripts (e.g., x¹² where Unicode lacks the glyph).** The `mathText()` helper falls back to `<sup>` / `<sub>` DOM elements so the text always renders.
- **An Advanced template's "clean answer" calculation produces an irrational that doesn't simplify nicely.** Templates choose parameter values from curated lists that yield clean answers (Pythagorean triples, perfect squares, π · integer, √3 / √2 multiples). If a generator-time check finds a messy answer, the generator should re-pick parameters before returning.
- **The modal opens on a portrait phone (320 × 568 minimum target).** The diagram + question + three answer rows must fit; if the diagram is tall (e.g., a vertical cone), it may need a maximum-height cap so the answer rows remain visible above the fold.
- **`LICENSES.md` exists but is missing a required source.** A test asserts every source in the per-problem metadata appears in `LICENSES.md`. If a source is added to a problem but not to LICENSES.md, the test fails.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Basic problem pool MUST contain at least 80 hand-curated entries (target ~100), sourced from CC BY 4.0 textbooks (OpenStax Contemporary Mathematics Chapter 10 Geometry and Illustrative Mathematics K-8 geometry units).
- **FR-002**: The Medium template library MUST contain at least 12 distinct templates covering the listed archetype set: Pythagorean hypotenuse (from Pythagorean triples and small scalings), perimeter and area of square / rectangle / triangle / trapezoid / regular polygon, circle area and circumference (integer radius), polygon interior-angle sum, cube volume and surface area, equilateral-triangle area, isosceles-right-triangle hypotenuse, simple triangle area from base + height.
- **FR-003**: The Advanced template library MUST contain at least 10 distinct templates covering the listed archetype set: sphere / cone / cylinder / pyramid volume and surface area, Heron's-formula triangle area, distance / midpoint / slope from coordinate-pair inputs, composite areas, surface area of rectangular prism, right-triangle trigonometry restricted to 30-60-90 / 45-45-90 special angles.
- **FR-004**: Every template generator MUST be **deterministic**: given the same seed, it MUST produce the same Problem (same prompt text, same answer choices in the same order, same `correctIndex`, same figure if any).
- **FR-005**: Every generated Problem MUST satisfy the existing Problem contract from slice 005: exactly three answer choices, `correctIndex` in `{0, 1, 2}`, non-empty `prompt`, `difficulty` matching the generator's declared difficulty.
- **FR-006**: Templated problems MUST select three answer choices where the correct answer and both distractors are pairwise distinct (no two of the three answer texts are equal). If a randomly-picked distractor collides with the correct answer or another distractor, the generator MUST re-pick.
- **FR-007**: At least 70 % of Medium templates AND at least 70 % of Advanced templates MUST produce a parameterised SVG figure alongside the problem text. (Some templates legitimately ship without a figure — e.g., the polygon-interior-angle-sum template doesn't need a specific N-gon drawing; it's a pure formula. Designer's discretion within the threshold.)
- **FR-008**: When a templated problem includes an SVG figure, the figure MUST be a well-formed `<svg>...</svg>` string with a valid `viewBox` attribute, parseable as XML, and the labels visible in the SVG MUST match the parameter values in the problem prompt.
- **FR-009**: Equation text in problem prompts MUST render as readable glyphs without any external typesetting library. The Unicode glyph set (`√`, `π`, `°`, `·`, `²`, `³`, fraction glyphs, superscripts ⁰..⁹, subscripts ₀..₉) MUST cover all problems in the M and A template library.
- **FR-010**: For cases where Unicode lacks a needed glyph (e.g., multi-digit superscripts like x¹¹), a small DOM helper MUST be available that wraps the text in `<sup>` / `<sub>` HTML elements.
- **FR-011**: A `LICENSES.md` file MUST exist at the repository root listing every source from which Basic problems were curated, with each entry containing: source name, source URL, licence (CC BY 4.0), and the required attribution text per the licence.
- **FR-012**: An in-app "Problem credits" surface MUST be accessible from at least one menu screen (start screen and/or game-over screen). When opened, it MUST display the same source list as `LICENSES.md` in a player-readable format.
- **FR-013**: The credits panel MUST be dismissible by tapping outside it, pressing Escape, or tapping a close button.
- **FR-014**: Each hand-curated Basic problem MUST carry per-problem source-attribution metadata (a source identifier or URL) so individual problems can be traced back to their textbook origin. This metadata is used to verify that every source referenced by a Basic problem appears in `LICENSES.md` (auditable via a test).
- **FR-015**: The Problem entity MUST gain an optional `figure` field of string type carrying the SVG markup. Existing consumers (modal renderer, problem-gates module, tests) MUST handle a missing `figure` as "text-only — no diagram".
- **FR-016**: The modal MUST render the figure inline in the `.problem-figure` slot (already reserved in slice 005) when present. When the field is absent or empty, the slot remains hidden (the existing CSS `:empty` rule handles this).
- **FR-017**: The slice MUST NOT add any runtime npm dependencies. All problem content and diagram rendering MUST be bundled at build time as TypeScript modules.
- **FR-018**: The production bundle MUST stay under 500 KB gzipped after this slice (per constitution constraint).
- **FR-019**: The diagram + question + three answer choices in the modal MUST fit within a 320 px-wide viewport (minimum mobile target) without horizontal overflow. The diagram MUST NOT push the answer choices below the fold on a 568 px-tall portrait phone (the smallest typical viewport).
- **FR-020**: Existing 248 tests from prior slices MUST continue to pass without modification. New tests MUST cover: every template generator produces a valid Problem (3 choices, correctIndex 0/1/2, non-empty prompt, no duplicate choices); every SVG archetype function produces a well-formed `<svg>` string with a valid viewBox; the per-problem-source-metadata is consistent with LICENSES.md.

### Key Entities *(include if feature involves data)*

- **Basic Problem (hand-curated)**: A static `Problem` record with `prompt`, three `choices`, `correctIndex`, `difficulty: 'B'`, and a new `sourceRef` field carrying the source identifier (e.g., "openstax-cm-10.2" or a URL fragment).
- **Medium Template / Advanced Template**: A function-shaped entity: takes a seed (PRNG state), returns a `{ problem: Problem, nextSeed: number }` pair. The Problem includes `prompt`, three `choices`, `correctIndex`, `difficulty: 'M' | 'A'`, and an optional `figure` (SVG string) if the archetype has a geometric figure.
- **Problem (entity extension)**: The existing `Problem` interface from slice 005 gains an optional `figure?: string` field. Existing fields are unchanged.
- **SVG Archetype**: A pure function in `src/diagrams/` that takes archetype-specific parameters (e.g., `rightTriangle(a, b, hypotenuseLabel?)`) and returns a well-formed SVG string. ~20-30 archetypes total covering right triangles, generic triangles, trapezoids, circles, regular polygons, coordinate planes with labelled points, 3D-solid silhouettes (sphere, cone, cylinder, pyramid, rectangular prism), and composite figures.
- **Problem Source**: A record `{ id: string, name: string, url: string, license: 'CC BY 4.0', attribution: string }` listing one source. Lives in a small data file consumed by both the credits panel and `LICENSES.md`-generation tooling (or hand-written `LICENSES.md` if the audit is cheaper).
- **Credits Panel**: A DOM overlay similar to the existing start/pause/game-over overlays, displaying the source list. Closable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The hand-curated Basic problem pool ships with at least 80 problems (target ~100), each with source-attribution metadata.
- **SC-002**: The Medium template library ships with at least 12 distinct templates; the Advanced library with at least 10.
- **SC-003**: At least 70 % of Medium templates and 70 % of Advanced templates ship with parameterised SVG figures.
- **SC-004**: Every SVG diagram in the library parses as well-formed XML and has a valid `viewBox` attribute (verifiable by unit test).
- **SC-005**: Every template generator is deterministic — same seed produces the same Problem across repeated calls.
- **SC-006**: Every generated Problem has three pairwise-distinct answer choices and a `correctIndex` in `{0, 1, 2}` (verifiable by unit test over 1000+ random seeds per template).
- **SC-007**: A 5-minute play session encounters at least 30 distinct problem prompts without exact-text repetition.
- **SC-008**: The production bundle stays under 500 KB gzipped (current ~152 KB; this slice expects ~50-80 KB raw growth, well within budget).
- **SC-009**: On a 320 × 568 viewport (minimum mobile target), the modal with a diagram + three answer choices fits without horizontal overflow and without the answer choices being pushed below the fold.
- **SC-010**: `LICENSES.md` at the repo root lists every CC-BY source referenced by the per-problem metadata; a test verifies this consistency.
- **SC-011**: The in-app credits panel is reachable from at least one menu screen (start or game-over) in ≤ 2 taps.
- **SC-012**: All 248 existing tests from prior slices pass unchanged.

## Assumptions

- **Problem framing variety**: roughly 30 % of templates MAY include multiple framings within one template (e.g., "find area given W and H" vs. "find W given area and H"). It's not a hard contract — implementer's discretion based on which framings produce well-formed problems with computable distractors.
- **Distractor recipes**: each template chooses its own distractor algorithm. Common patterns: near-miss arithmetic (correct ± 1, swapped operands, missing factor of 2 / π / √3), unit confusion (radius for diameter), and common student errors (forgot the /2 in triangle area, used 2π·r instead of π·r²). Implementer's discretion.
- **Parameter range curation**: each template hand-picks parameter ranges that yield clean answers (integer Pythagorean triples, integer radii, special-angle trig, etc.). If a parameter combination would produce a messy answer (e.g., a Heron triangle with a non-integer area), the generator re-picks.
- **Diagram aspect ratio**: a default 320 × 240 viewBox is used for most archetypes; templates may override if their figure naturally needs taller / wider proportions (e.g., a vertical cone). The CSS `.problem-figure` slot has `max-height: 40vh` from slice 005, so the figure scales to fit regardless.
- **B problems are text-only by default**: most Basic problems (recall: "how many sides does a hexagon have?") don't need a specific figure. A subset of B problems MAY include a small figure (e.g., "Identify this shape" with a shape silhouette); these are the implementer's call and are not in the FR-007 70% threshold.
- **The credits panel is a simple static list with hyperlinks**, not an interactive contributor wall or licence-text viewer. CC BY 4.0 requires a "reasonable" attribution format; a clean list with name + URL + licence + attribution-line suffices.
- **`LICENSES.md` is hand-maintained** (low rate of source changes); a test verifies it stays consistent with per-problem metadata. If a future slice introduces many new sources, a generation script can replace the hand-maintained file.
- **The 70 % diagram-coverage target on M and A templates is a soft floor**: templates whose archetypes don't have a specific figure to draw (e.g., polygon-interior-angle-sum is a pure formula; no canonical figure) legitimately ship without diagrams. The 70 % accounts for this without making "include a figure" mandatory for every template.
- **Unicode glyph reachability**: the slice's authors ensure all problem texts use only glyphs that render reliably in standard system fonts (no obscure mathematical-operators block characters that might fall back to a placeholder square in some browsers). The set is bounded and small enough to audit by hand.
- **No content fetched at runtime**: all problems, templates, diagrams, and credits text are bundled at build time. The game is offline-capable per constitution.
- **No persistence across sessions**: per-session randomness means the same player encounters different problem sequences each run. No "spaced repetition" or "track which problems were seen" logic in this slice — that's a future-work item.
- **Existing modal layout adapts**: slice 005's modal CSS already includes the `.problem-figure` slot with `max-height: 40vh` and `:empty { display: none }`. This slice only fills the slot with content; no further CSS changes are required (though minor tuning to spacing or font sizes may happen if the figure pushes the layout).
- **Template tests use deterministic seeds**: tests pass a fixed seed and assert specific expected outputs. Property-based testing (sweep across N seeds, assert invariants) is also used to catch parameter-value edge cases.
