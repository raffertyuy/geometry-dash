---
description: "Dependency-ordered tasks for the Real Geometry Problems slice (006-geometry-problems)"
---

# Tasks: Real Geometry Problems with Diagrams

**Input**: Design documents from `specs/006-geometry-problems/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/module-contracts.md](./contracts/module-contracts.md), [research.md](./research.md), [quickstart.md](./quickstart.md)

**Tests**: REQUIRED. Constitution Principle II (Test-First) — new pure functions in `src/diagrams/` and the new internal files in `src/problems/` (`pool-b`, `sources`, `templates-m`, `templates-a`), the `credits-panel` DOM adapter, and the modal figure-injection extension each get their unit tests written before the implementation lands. A `LICENSES.md` ↔ `PROBLEM_SOURCES` consistency test catches the "added a source but forgot to attribute it" failure mode.

**Organization**: Three user stories per spec.md:

- **US1 (P1)** — Real geometry problems: ~80-100 hand-curated Basic problems from CC-BY textbooks; ≥12 Medium templates and ≥10 Advanced templates; deterministic per-template generators with computed correct answer + plausible distractors; preserved public surface (`selectPlaceholderProblem`) dispatching internally.
- **US2 (P2)** — Parameterised SVG diagrams: new `src/diagrams/` module with primitives + ~20-30 archetype generators; templates extended to attach figures; modal renders the figure in the reserved `.problem-figure` slot.
- **US3 (P3)** — Source attribution: `LICENSES.md` at repo root + in-app "Problem credits" panel reachable from start / game-over.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared incomplete dependencies).
- **[Story]**: `[US1]`, `[US2]`, `[US3]`. Setup, Foundational, and Polish phases carry no story label.
- File paths in descriptions are exact and align with the project structure in [plan.md](./plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

This slice inherits all setup from 001–005. No project-level setup work required.

*(no tasks)*

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Land the shared type extension and the `PROBLEM_SOURCES` + `LICENSES.md` attribution surfaces that every user story depends on.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T001 [P] Extend `src/shared/types.ts`: add optional `figure?: string` field (SVG markup) and optional `sourceRef?: string` field (matches a `ProblemSource.id`) to the `Problem` interface. Keep both fields `readonly`. Other consumers (problem-gates, problem-modal, runner-engine) MUST handle missing fields as text-only / no source — no other changes required in this task.
- [X] T002 [P] Write `src/problems/sources.test.ts`: assert `PROBLEM_SOURCES.length >= 2`; every entry has well-formed `https://` URL; every entry has non-empty `attribution` text; every `id` is unique within the list; the file content of `LICENSES.md` at the repo root contains each `PROBLEM_SOURCES[i].name` as a substring (consistency check). Test must read `LICENSES.md` via `fs.readFileSync` relative to the project root.
- [X] T003 Implement `src/problems/sources.ts`: define the `ProblemSource` interface with `id`, `name`, `url`, `license: 'CC BY 4.0'`, `attribution` fields. Export `PROBLEM_SOURCES` array with at least two entries: `openstax-cm-ch10` (OpenStax Contemporary Mathematics Ch. 10 Geometry) and `illustrative-math-k8` (Illustrative Mathematics K-8 Geometry). Each `attribution` field follows the CC BY 4.0 attribution format with `©` symbol, year, and licence reference per [data-model.md](./data-model.md). Makes the structural part of T002 green. **Blocked by**: T002.
- [X] T004 [P] Create `LICENSES.md` at the repo root. Format per [contracts/module-contracts.md](./contracts/module-contracts.md) "LICENSES.md (repo root)" section. One markdown section per source, each listing the source name (matching `PROBLEM_SOURCES[i].name` verbatim), URL, licence (`CC BY 4.0` with link to the canonical CC URL), and the required attribution text. Make the file scannable: lead with a short paragraph explaining "this project incorporates problems adapted from open-licensed educational sources." Once this lands, the substring consistency assertion in T002 turns green.
- [X] T005 Update `src/problems/index.ts` to re-export `PROBLEM_SOURCES` and the `ProblemSource` type alongside the existing `selectPlaceholderProblem` and `Problem` / `AnswerChoice` re-exports. **Blocked by**: T003.

**Checkpoint**: Shared types extended; sources + attribution surfaces (`LICENSES.md` at repo root + `PROBLEM_SOURCES`) land with a consistency check. All user-story phases can now build on this foundation in parallel.

---

## Phase 3: User Story 1 — Real geometry problems replace the placeholder pool (Priority: P1) 🎯 MVP

**Goal**: Replace the 15-per-difficulty placeholder pool from slice 005 with a real-content system: ~80-100 hand-curated Basic problems with source attribution + ≥12 Medium templates + ≥10 Advanced templates that compute correct answers and plausible distractors. Preserved public surface (`selectPlaceholderProblem`) dispatches internally to either pool-b or the difficulty's template family. Templates initially ship text-only (no `figure`); US2 adds figures on top.

**Independent Test**: Per spec.md User Story 1 + [quickstart.md](./quickstart.md) §3-8. Play a 5-minute run; encounter at least 30 distinct prompts; no two prompts have identical text; all answer choices are pairwise distinct; correct answers earn +1k/+5k/+10k; wrong answers cost the same magnitude + a heart.

### Tests for User Story 1 (write FIRST, assert red, then implement)

- [X] T006 [P] [US1] Write `src/problems/pool-b.test.ts` (jsdom not required — pure logic): assert `POOL_B.length >= 80`; every entry has 3 pairwise-distinct choice texts; every `correctIndex` is in `[0, 2]`; every `prompt` non-empty; every `sourceRef` is defined AND resolves to a `PROBLEM_SOURCES[i].id`; every `id` unique within `POOL_B`. Property test over a sample of 30 entries to sanity-check the invariants.
- [X] T007 [P] [US1] Write `src/problems/templates-m.test.ts`: for each template in `PROBLEM_TEMPLATES_M`, assert `template.difficulty === 'M'` and `generate(seed).problem.difficulty === 'M'`. Determinism test: `generate(s).problem` equals `generate(s).problem` (same seed → same Problem). Property test: across 1000 random seeds, every produced Problem has 3 pairwise-distinct choices + `correctIndex` in `[0, 2]` + non-empty prompt. Library count: `PROBLEM_TEMPLATES_M.length >= 12`. (The figure-presence assertion is added in T026 once US2 lands.)
- [X] T008 [P] [US1] Write `src/problems/templates-a.test.ts`: same shape as T007 for the Advanced library. `PROBLEM_TEMPLATES_A.length >= 10`.
- [X] T009 [P] [US1] Update `src/problems/problems.test.ts`: add cases for the new dispatch behaviour. `selectPlaceholderProblem('B', uniform01)` returns an entry from `POOL_B`; `selectPlaceholderProblem('M', uniform01)` returns a Problem with `difficulty === 'M'` produced by a template from `PROBLEM_TEMPLATES_M`; `selectPlaceholderProblem('A', uniform01)` returns one from `PROBLEM_TEMPLATES_A`. Determinism preserved (same uniform01 → same Problem). Existing 5 selectPlaceholderProblem tests stay green.

### Implementation for User Story 1

- [X] T010 [US1] Implement `src/problems/pool-b.ts`: hand-curate ~80-100 Basic problems sourced from OpenStax Contemporary Mathematics Ch. 10 Geometry and Illustrative Mathematics K-8 geometry units. Cover the recall topics listed in spec.md FR-001: polygon side / vertex / face counts, common 3D-solid face counts, angle types (right / straight / supplementary / complementary), triangle / quadrilateral subtypes, circle terminology, 2D-vs-3D, basic angle facts. Every entry: stable `id` (e.g., `'b-os-001'`), 3 pairwise-distinct choices, valid `correctIndex`, non-empty `prompt`, `difficulty: 'B'`, `sourceRef` matching `PROBLEM_SOURCES[i].id`. Makes T006 green. **Blocked by**: T001, T003.
- [X] T011 [P] [US1] Implement `src/problems/templates-m.ts` with ≥ 12 Medium templates covering: Pythagorean hypotenuse (from Pythagorean triples 3-4-5, 5-12-13, 8-15-17, 7-24-25, 9-40-41, 20-21-29 + small scalings), square perimeter, square area, rectangle perimeter, rectangle area, triangle area from base + height, circle area (integer radius), circle circumference, polygon interior-angle sum, cube volume, cube surface area, equilateral-triangle area (√3 in answer), isosceles-right-triangle hypotenuse (√2 answers), trapezoid area. Each template is a top-level `Template` const with a deterministic `generate(seed)` that uses the slice-005 mulberry32 pattern. Each template owns its own distractor recipe (near-miss arithmetic, unit-confusion, common-student-error patterns). Generators MUST avoid duplicate-answer collisions (re-pick if any choice equals another). **Initially ship without `figure` field; US2 extends to add figures.** Export `PROBLEM_TEMPLATES_M: readonly Template[]`. Makes the structural part of T007 green. **Blocked by**: T001, T007.
- [X] T012 [P] [US1] Implement `src/problems/templates-a.ts` with ≥ 10 Advanced templates covering: sphere volume (with π), sphere surface area, cone volume, cone surface area, cylinder volume, cylinder surface area, pyramid volume, Heron's triangle area (integer triangles with clean Heron output: 5-5-6, 6-6-8, 5-12-13, 7-15-20, 9-10-17), distance from coordinates (clean Pythagorean coordinate-pairs), midpoint from coordinates, slope from coordinates, composite rectangle + triangle area, surface area of rectangular prism, 30-60-90 right-triangle trig (sin / cos / tan with clean answers), 45-45-90 right-triangle trig. Same template shape as T011. **Initially ship without figures; US2 extends.** Export `PROBLEM_TEMPLATES_A: readonly Template[]`. Makes the structural part of T008 green. **Blocked by**: T001, T008.
- [X] T013 [US1] Refactor `src/problems/problems.ts`: rewrite `selectPlaceholderProblem(difficulty, uniform01)` to dispatch — for `'B'`, index into `POOL_B`; for `'M'` / `'A'`, pick a template from the appropriate family by `uniform01` then call `template.generate(Math.floor(uniform01 * 0xffffffff)).problem`. Preserve the existing public-surface signature (same return type, same behavior contract — given same inputs, return same Problem). Remove the old hard-coded `PLACEHOLDER_POOL_B/M/A` arrays from this file (their content lives in `pool-b.ts` / `templates-m.ts` / `templates-a.ts` now). Makes T009 green. **Blocked by**: T010, T011, T012.
- [X] T014 [US1] Run full test suite: `npm test`. Expected: existing 248 tests still pass + new tests from T006-T009 pass. Resolve any failures. **Blocked by**: T010-T013.
- [X] T015 [US1] Manual desktop validation per [quickstart.md](./quickstart.md) §3-8: open `localhost:5173`, play a run for ~5 minutes, count distinct prompts (target ≥30). Verify Basic problems read as real recall questions; Medium problems are numerical calculations; Advanced problems are multi-step. Correct / wrong answers update score + lives per spec FR.

**Checkpoint**: Real problems ship across all three difficulties. Templates and pool are deterministic + well-tested. The slice's MVP value (real geometry problems) is on screen. Diagrams come next in US2; attribution surfaces follow in US3.

---

## Phase 4: User Story 2 — Parameterised SVG diagrams render in the modal (Priority: P2)

**Goal**: Add a new `src/diagrams/` pure-logic module with primitives + ~20-30 archetype generators. Extend the templates from US1 to attach a parameterised SVG figure (where geometrically meaningful — target ≥70% of M and A templates). Extend the modal's `show()` to inject the figure into the reserved `.problem-figure` slot.

**Independent Test**: Per spec.md User Story 2 + [quickstart.md](./quickstart.md) §4-5. Hit a Medium or Advanced gate with a geometric problem; verify a clear SVG diagram appears in the modal's top half with labels matching the prompt. Hit a Basic gate; the figure slot stays hidden (CSS `:empty`).

### Tests for User Story 2 (write FIRST, assert red, then implement)

- [X] T016 [P] [US2] Write `src/diagrams/primitives.test.ts`: each primitive (`svg`, `line`, `polygon`, `circle`, `label`) produces a non-empty string fragment matching the expected XML structure. `svg('0 0 320 240', '<line ...>')` returns `<svg viewBox="0 0 320 240" xmlns="http://www.w3.org/2000/svg">` opener + content + `</svg>` closer. `line(0, 0, 100, 100)` returns `<line x1="0" y1="0" x2="100" y2="100" ...></line>` with default style attributes (stroke / stroke-width). `polygon([[0,0], [100,0], [50,100]])` returns `<polygon points="0,0 100,0 50,100" ...>`. `circle(50, 50, 30)` returns `<circle cx="50" cy="50" r="30" ...>`. `label(10, 20, 'A')` returns `<text x="10" y="20" ...>A</text>`. Use `DOMParser` (available in jsdom) to assert the full `svg(...)` output parses as a valid XML document.
- [X] T017 [P] [US2] Write `src/diagrams/archetypes.test.ts`: for each archetype function (`rightTriangle`, `triangleGeneric`, `trapezoid`, `circleFigure`, `regularPolygonFigure`, `coordinatePlane`, `sphereSilhouette`, `cylinderSilhouette`, `coneSilhouette`, `pyramidSilhouette`, `rectangularPrismSilhouette`, `compositeRectangleTriangle`, `circleInscribedInSquare`, `quadrilateralLabelled`), assert: output parses as well-formed XML; contains a `viewBox` attribute; contains the expected label text where applicable (e.g., `rightTriangle({ legA: 8, legB: 15 })` output contains `>8<` and `>15<`); output is non-empty. Property test: 10 random valid parameter combinations per archetype, all produce well-formed SVG.
- [X] T018 [P] [US2] Extend `src/renderer/problem-modal.test.ts`: assert that when `show(problem, onCommit)` is called with `problem.figure` set to a sample SVG string, the host's `.problem-figure` element contains that SVG (innerHTML matches the figure). Assert that when `problem.figure` is omitted, the `.problem-figure` element is created but empty (CSS `:empty` rule will hide it visually; the test only checks DOM structure).
- [X] T019 [P] [US2] Extend `tests/integration/problem-gate-flow.test.ts` with a case: construct a synthetic Problem with `difficulty: 'M'`, a non-empty `figure` SVG string, three answer choices. Inject as a `ProblemGate`. Run the gate-collides → enter-answering → resolve-answer flow. Assert the Problem flows through unchanged (the runner-engine doesn't care about figure). The modal-side rendering is covered in T018.

### Implementation for User Story 2

- [X] T020 [P] [US2] Implement `src/diagrams/primitives.ts`: `svg`, `line`, `polygon`, `circle`, `label` functions per [contracts/module-contracts.md](./contracts/module-contracts.md). Use the default Tron-aware styling: `stroke: '#e8e8ef'` (modal text colour), `stroke-width: 1.5`, `fill: 'none'`. `label` default `fill: '#e8e8ef'`, `font-size: 14`, `text-anchor: 'middle'`. All return strings; XML-escape any special characters in `label` text. Makes T016 green. **Blocked by**: T016.
- [X] T021 [US2] Implement `src/diagrams/archetypes.ts` with the ~20-30 archetype functions enumerated in [contracts/module-contracts.md](./contracts/module-contracts.md): `rightTriangle({legA, legB, labels?})`, `triangleGeneric({a, b, c, labels?})`, `trapezoid({top, bottom, h, labels?})`, `circleFigure({radius, labelRadius?})`, `regularPolygonFigure({sides, sideLength?, label?})`, `coordinatePlane({xRange, yRange, points, drawLineBetweenFirstTwo?})`, `sphereSilhouette({r, labelR})`, `cylinderSilhouette({r, h, labels})`, `coneSilhouette({r, h, labels?})`, `pyramidSilhouette({baseEdge, h, labels?})`, `rectangularPrismSilhouette({l, w, h, labels?})`, `compositeRectangleTriangle({...})`, `circleInscribedInSquare({s, labels?})`, `quadrilateralLabelled({a, b, c, d, labels})`. Each calls `svg(viewBox, content)` from primitives + composes line/polygon/circle/label calls. Default viewBox 320x240; archetypes may override for tall figures (vertical cone, vertical pyramid). Makes T017 green. **Blocked by**: T017, T020.
- [X] T022 [US2] Implement `src/diagrams/index.ts` as the public barrel: re-export every primitive + archetype function + the `SvgAttrs` / `SvgStyle` / `SvgLabelStyle` types. **Blocked by**: T020, T021.
- [X] T023 [US2] Extend `src/problems/templates-m.ts`: for each template with geometric structure, import the appropriate archetype from `src/diagrams` and set `problem.figure` on the returned Problem to the archetype's SVG output (parameters matching the prompt). Target: ≥ 70% of M templates ship with a figure. Templates that don't have a meaningful figure (e.g., polygon-interior-angle-sum is a pure formula) legitimately ship without one. **Blocked by**: T011, T022.
- [X] T024 [US2] Extend `src/problems/templates-a.ts`: same as T023 for A. Target: ≥ 70% of A templates ship with a figure. **Blocked by**: T012, T022.
- [X] T025 [US2] Update `src/problems/templates-m.test.ts` and `src/problems/templates-a.test.ts`: add an aggregate assertion that ≥ 70% of templates in each library produce a Problem with a defined `figure` field. For templates that DO produce figures, assert the figure parses as well-formed XML and has a valid `viewBox`. **Blocked by**: T023, T024.
- [X] T026 [US2] Update `src/renderer/problem-modal.ts`: in `buildBody(problem)`, when constructing the `.problem-figure` element, if `problem.figure` is a non-empty string, set the element's `innerHTML` to the figure SVG. (The element is always created; it's the CSS `:empty` rule from slice 005 that hides it when no figure is present.) Makes T018 green. **Blocked by**: T018.
- [X] T027 [US2] Run full test suite: `npm test`. Expected: 248 baseline + US1's new tests + US2's new tests all pass. Resolve any failures. **Blocked by**: T020-T026.
- [ ] T028 [US2] Manual desktop validation per [quickstart.md](./quickstart.md) §4-5: hit Medium and Advanced gates; verify clear SVG diagrams render in the modal with labels matching the prompt. Hit Basic gates; verify the figure slot stays empty (CSS `:empty` hides it).

**Checkpoint**: Problem cubes now show geometric diagrams alongside the question text where geometrically meaningful. The slice's full visual ambition is delivered.

---

## Phase 5: User Story 3 — Source attribution surface (Priority: P3)

**Goal**: Add an in-app "Problem credits" panel reachable from the start screen and game-over screen. Panel lists every source in `PROBLEM_SOURCES` (name + URL + licence + attribution). `LICENSES.md` at the repo root (already landed in Phase 2 foundational) provides the same information for developers / compliance reviewers.

**Independent Test**: Per spec.md User Story 3. Open the start screen; click "Problem credits"; the credits panel opens listing every source. Close with Escape / click-outside / close-button. Open from game-over screen too. Re-confirm `LICENSES.md` lists every source from `PROBLEM_SOURCES` (this is enforced by the consistency test from T002).

### Tests for User Story 3 (write FIRST, assert red, then implement)

- [X] T029 [P] [US3] Write `src/renderer/credits-panel.test.ts` (jsdom): `createCreditsPanel(host, PROBLEM_SOURCES)` populates the host with one entry per source containing the source's name, URL, licence, and attribution text. `show()` removes the `.hidden` class. After `show()`, dispatching an Escape `keydown` on the window calls the `onClose` callback AND adds `.hidden` back. Clicking outside the panel body (on the backdrop) also closes. `hide()` is idempotent. `destroy()` removes lingering listeners (no callbacks fire after destroy).
- [X] T030 [P] [US3] Write a small smoke test in `src/renderer/credits-panel.test.ts`: the `href` of each source's URL anchor matches `PROBLEM_SOURCES[i].url`.

### Implementation for User Story 3

- [X] T031 [US3] Implement `src/renderer/credits-panel.ts`: factory `createCreditsPanel(host, sources, onClose?)` returns `{ show, hide, isVisible, destroy }` per [contracts/module-contracts.md](./contracts/module-contracts.md). On creation: populate host with a heading (`<h2>Problem credits</h2>`), an intro paragraph ("This game incorporates geometry problems adapted from open-licensed sources. Required attribution:" or similar), an `<ul>` of source entries (each entry = `<li>` with name, URL link, licence, and italic attribution text), and an optional close button. Set `.hidden` class initially. `show()` removes `.hidden`, registers `window.keydown` (Escape) + `host.click` (backdrop click outside the panel body) listeners. `hide()` adds `.hidden`, unregisters listeners. `destroy()` removes any lingering listeners. Makes T029 + T030 green. **Blocked by**: T029, T030.
- [X] T032 [US3] Re-export `createCreditsPanel` and `type CreditsPanel` from `src/renderer/index.ts`. **Blocked by**: T031.
- [X] T033 [US3] Extend `index.html`: add a `<button id="credits-link-start" class="credits-link">Problem credits</button>` inside `#start-screen` (beneath the existing instructions). Add the same button as `#credits-link-game-over` inside `#game-over-overlay` (beneath the restart hint). Add a new top-level overlay element: `<div id="credits-overlay" class="overlay hidden" role="dialog" aria-modal="true" aria-label="Problem credits"></div>`. CSS additions inside the existing `<style>` block: `.credits-link` (small Tron-cyan text button styled to fit the existing overlay aesthetic; pointer-events: auto so it's clickable even within the .overlay's pointer-events: none parent); `#credits-overlay h2` (panel heading); `#credits-overlay .source-entry` (flex column with `.source-name` bold, `.source-url` (cyan link), `.source-license`, `.source-attribution` italic); `#credits-overlay .close-button` (X in the corner, optional).
- [X] T034 [US3] Extend `src/main.ts` to query the new DOM elements (`#credits-overlay`, `#credits-link-start`, `#credits-link-game-over`); add bootstrap error guards; pass them through `GameLoopHostElements`. **Blocked by**: T033.
- [X] T035 [US3] Extend `src/game/game-loop.ts`: extend `GameLoopHostElements` interface with `creditsOverlay: HTMLElement`, `creditsLinkStart: HTMLElement`, `creditsLinkGameOver: HTMLElement` fields. Instantiate `creditsPanel = createCreditsPanel(host.creditsOverlay, PROBLEM_SOURCES)` at the top of `createGameLoop` (alongside the other adapters). Bind a `click` handler on each of the two `credits-link-*` elements that calls `creditsPanel.show()`. In `dispose()`, call `creditsPanel.destroy()`. **Blocked by**: T031, T032, T034.
- [X] T036 [US3] Run full test suite: `npm test`. Expected: all baseline + US1 + US2 + US3 tests pass. **Blocked by**: T029-T035.
- [ ] T037 [US3] Manual desktop validation: open `localhost:5173`; on the start screen, click "Problem credits"; verify the panel opens with all sources; close with Escape; reopen; close with click-outside; reopen; close with the close button (if implemented). Trigger a game-over (lose all 3 lives); verify the link is also visible there; same dismissal paths work.

**Checkpoint**: Attribution is visible in two surfaces (in-app + repo). CC BY 4.0 compliance requirements are met. The slice is feature-complete; only polish remains.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T038 [P] Update `README.md`: add a new bullet to the "What's in it (so far)" section summarising the slice. Suggested wording: "**Real geometry problems + diagrams**: ~100 hand-curated Basic problems from OpenStax + Illustrative Mathematics (CC BY 4.0); ~12-15 Medium templates + ~10-15 Advanced templates with computed correct answers + plausible distractors + parameterised inline-SVG diagrams (right triangles, trapezoids, coordinate planes, sphere / cone / cylinder silhouettes, etc.). Unicode-only equation rendering keeps the bundle under 200 KB gzipped. In-app 'Problem credits' panel + `LICENSES.md` for CC-BY attribution."
- [X] T039 [P] Confirm `CLAUDE.md` top-of-file project description still reads correctly (no changes needed for this slice; the SPECKIT block was already updated by `/speckit-plan`).
- [X] T040 Run `npm run typecheck`. Resolve any TypeScript errors. The new `figure?` and `sourceRef?` optional fields may surface narrowing issues in templates / consumers — fix at the call sites.
- [X] T041 Run `npm run lint`. Resolve any boundary violations. The new `src/diagrams/` module MUST NOT import `three` or DOM types; the existing `no-restricted-imports` rule catches this. New files in `src/problems/` also MUST stay pure.
- [X] T042 Run `npm run build`. Verify the production bundle stays under 500 KB gzipped (current ~152 KB; this slice expects ~20-25 KB gzipped growth for problem text + SVG generators + helpers; budget headroom ~325 KB).
- [ ] T043 320 px viewport validation: open Chrome DevTools → Device Toolbar → iPhone SE preset. Verify the modal with a diagram + three answer choices fits without horizontal overflow on a 320 × 568 portrait phone. Open the credits panel; verify source entries stack vertically with readable text + tappable links. The diagram does not push the answer rows below the fold.
- [ ] T044 Mobile-device validation on a real iOS Safari and/or Android Chrome device on the same LAN: open `localhost:5173`; play a run with ≥ 3 gate hits including at least one with a diagram; verify the diagram is sharp at the device's DPI; tap to commit answers; open the credits panel via tap. No `console.error` or unhandled rejections.
- [ ] T045 Final end-to-end validation per [quickstart.md](./quickstart.md) "Definition of done" checklist — tick every box.
- [X] T046 [P] Implement `src/renderer/math-text.ts` + `math-text.test.ts` per spec FR-010 (added during /speckit-analyze remediation). Helper exports `mathText(input: string): string` that walks the input and wraps:
  - Trailing or embedded `^{N}` patterns (e.g., `x^{11}`) into `<sup>11</sup>`.
  - `_{N}` patterns into `<sub>N</sub>`.
  - Returns HTML-safe output (escapes `<`, `>`, `&` in non-tag spans).
  Update `src/renderer/problem-modal.ts` `buildBody` to apply `mathText()` to `problem.prompt` via `innerHTML` instead of `textContent`. Smoke tests in jsdom: plain text passes through unchanged; `^{11}` becomes `<sup>11</sup>`; `_{n}` becomes `<sub>n</sub>`; mixed cases work; HTML special characters are escaped. Note: the current B / M / A pool + templates use Unicode glyphs only (², ³, ₀..₉) so this helper is forward-looking — no current prompt triggers a wrap.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: empty.
- **Foundational (Phase 2)**: T001 || T002 || T004 in parallel (three different files); T003 after T002 (test → impl); T005 after T003. Phase 2 BLOCKS all user-story phases.
- **User Story 1 (Phase 3)**: T006-T009 are tests in parallel (four independent test files); T010-T012 are implementations with the dependencies declared in each task; T013 follows T010-T012; T014 + T015 verify. Phase 3 can start once Phase 2 completes.
- **User Story 2 (Phase 4)**: T016-T019 are tests in parallel; T020 → T021 → T022 (primitives → archetypes → barrel); T023 + T024 extend US1's templates (so they depend on US1 having landed via Phase 3); T025 updates US1 template tests; T026 modifies the modal renderer; T027 + T028 verify. Phase 4 depends on US1's Phase 3 (templates exist to extend with figures).
- **User Story 3 (Phase 5)**: T029-T030 tests in parallel; T031 implementation; T032-T035 are DOM + main + game-loop wiring; T036 + T037 verify. Phase 5 is independent of Phase 4 (the credits panel doesn't depend on diagrams) but depends on Phase 2 (PROBLEM_SOURCES + LICENSES.md).
- **Polish (Phase 6)**: depends on US1 + US2 + US3 complete; tasks within Phase 6 are mostly independent.

### Within Phase 3 (User Story 1)

- Tests (T006-T009) can be written in parallel — four independent test files.
- Implementations:
  - T010 (pool-b) depends on T001 (types) + T003 (sources).
  - T011 (templates-m) depends on T001 + T007 (its test).
  - T012 (templates-a) depends on T001 + T008.
  - T013 (dispatch refactor) depends on T010 + T011 + T012.
  - T014 (npm test) depends on T013.
  - T015 (manual) depends on T014.

### Within Phase 4 (User Story 2)

- T016 || T017 || T018 || T019 (tests, different files).
- T020 → T021 → T022 (primitives → archetypes → barrel).
- T023 + T024 (extend templates with figures) depend on T022 + Phase 3 templates existing.
- T025 (template tests update) depends on T023 + T024.
- T026 (modal extension) depends on T018.
- T027 + T028 verify.

### Within Phase 5 (User Story 3)

- T029 + T030 (tests, possibly in the same file but split for parallelism).
- T031 (credits-panel impl) follows T029 + T030.
- T032 (barrel re-export) follows T031.
- T033 (HTML) is sequential; T034 (main) follows T033; T035 (game-loop) follows T031 + T032 + T034.
- T036 + T037 verify.

### Parallel Opportunities

- **Phase 2**: T001 || T002 || T004 (three independent files), then T003 (depends on T002).
- **Phase 3 tests**: T006 || T007 || T008 || T009 (four independent files).
- **Phase 3 implementations**: T010 ‖ T011 ‖ T012 (three independent files; each waits only on its own test + foundational types).
- **Phase 4 tests**: T016 || T017 || T018 || T019.
- **Phase 4 implementations**: T020 → T021 (sequential within diagrams module); T023 ‖ T024 can run in parallel once T022 lands (they touch different template files).
- **Phase 6 polish**: T038 || T039 (docs, different files), then T040 → T041 → T042 (build chain), then T043 || T044 (manual).

---

## Parallel Example: User Story 1

```text
# Stage 1: write tests in parallel (four files)
T006 - src/problems/pool-b.test.ts
T007 - src/problems/templates-m.test.ts
T008 - src/problems/templates-a.test.ts
T009 - src/problems/problems.test.ts (extend)

# Stage 2: implementations in parallel (three independent files)
T010 - src/problems/pool-b.ts
T011 - src/problems/templates-m.ts
T012 - src/problems/templates-a.ts

# Stage 3: dispatch refactor (sequential, integrates all three sources)
T013 - src/problems/problems.ts (refactor selectPlaceholderProblem)

# Stage 4: verify
T014 - npm test
T015 - browser at localhost:5173
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1: Setup — no work.
2. Phase 2: Foundational (T001-T005) — types extension, sources, LICENSES.md.
3. Phase 3: US1 end-to-end (T006-T015) — real Basic / Medium / Advanced problems shipping with text. Templates produce no figures yet.
4. **STOP and VALIDATE**: real problems on screen. The slice already delivers significant value vs. slice 005's placeholder pool — players see real content even without diagrams or in-app credits.

### Incremental delivery

1. MVP ships → US2 (T016-T028) adds the SVG diagrams for templated M/A problems → ship.
2. → US3 (T029-T037) adds the attribution surfaces → ship (CC BY 4.0 compliance achieved).
3. → Phase 6 polish (T038-T045) → final ship.

### Parallel team strategy

With multiple developers after Phase 2 completes:

- Developer A: US1 (pool-b + templates) in `src/problems/`.
- Developer B: US3 (credits panel + DOM updates) — almost entirely independent of US1.
- Then once US1 lands and US2 can start: Developer A or B picks up US2 (`src/diagrams/` + template figure extensions + modal injection).

---

## Notes

- `[P]` = different files, no incomplete-task dependencies.
- Tests MUST be red before the matching implementation lands (Constitution II). The 1000-seed property tests for templates (T007 / T008) catch edge cases that hand-written tests would miss.
- Commit at every logical group — e.g., one commit per task or one per `[P]` cluster within a phase. Match the prior slices' `impl(006): ...` convention.
- Avoid: importing `three` or DOM types into `src/diagrams/` or `src/problems/` (ESLint boundary rule catches this); coupling templates to specific archetype internals (templates use the archetype's public function signature only); rendering anything other than SVG in the `.problem-figure` slot.
- Per-template distractor logic is the implementer's discretion; aim for "plausible wrong answers a student would actually pick" rather than random noise. Each template's distractor recipe should be documented in a short comment above the template definition.
- The 70% figure-coverage target on M/A templates is a soft floor; templates without an obvious geometric figure (e.g., polygon-interior-angle-sum, isosceles-right-triangle-hypotenuse without a specific configuration) legitimately ship without figures. The 70% accommodates this.
- Manual validation steps (T015, T028, T037, T043, T044) require a live browser; checkpoint your work before each so a regression is easy to isolate.
