# Module Contracts: Real Geometry Problems with Diagrams (Phase 1)

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md) | **Date**: 2026-05-17

This slice adds **one new pure-logic module** (`src/diagrams/`), **expands the existing `src/problems/` module** with new internal files (pool-b, sources, templates-m, templates-a) while preserving the public surface from slice 005, adds **one new renderer DOM adapter** (`src/renderer/credits-panel.ts`), extends **`src/renderer/problem-modal.ts`** with figure injection, and extends the `Problem` interface in **`src/shared/types.ts`** with two optional fields. It changes no Three.js rendering code in `src/renderer/three-renderer.ts`.

Module dependency direction (after this slice):

```
game/    ──┐
           ├──► renderer/ ─────────────► shared/
main.ts ──┘                              ▲
           │                             │
           ├──► runner-engine/ ──────────┤
           ├──► lane-state/ ─────────────┤
           ├──► input-adapter/ ──────────┤
           ├──► score/ ──────────────────┤
           ├──► obstacles/ ──────────────┤
           ├──► escalation/ ─────────────┤
           ├──► problem-gates/ ──────────┤
           ├──► problems/ ──┬───────────►┤
           └──► diagrams/ ◄─┘  (NEW)     │
                                         │
                                         ▼
                                       shared/
```

`src/diagrams/` and the new files in `src/problems/` are pure-logic — **MUST NOT** import `three`, `three/*`, or any DOM types. `src/problems/` depends on `src/diagrams/` (templates produce figures via archetypes). ESLint `no-restricted-imports` already covers both directories via the catch-all on three.

---

## `diagrams/` — SVG primitives and archetype generators

```ts
// diagrams/index.ts
export {
  // primitives
  svg,
  line,
  polygon,
  circle,
  label,
  // archetypes
  rightTriangle,
  triangleGeneric,
  trapezoid,
  circleFigure,
  regularPolygonFigure,
  coordinatePlane,
  sphereSilhouette,
  cylinderSilhouette,
  coneSilhouette,
  pyramidSilhouette,
  rectangularPrismSilhouette,
  compositeRectangleTriangle,
  circleInscribedInSquare,
  quadrilateralLabelled,
  // …additional archetypes as needed
} from './primitives';
export type { SvgAttrs, SvgStyle, SvgLabelStyle } from './primitives';
```

### Primitives (`primitives.ts`)

```ts
export interface SvgAttrs {
  readonly width?: number;
  readonly height?: number;
  readonly className?: string;
}

export interface SvgStyle {
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly fill?: string;
  readonly opacity?: number;
}

export interface SvgLabelStyle extends SvgStyle {
  readonly fontSize?: number;
  readonly anchor?: 'start' | 'middle' | 'end';
}

export function svg(viewBox: string, content: string, attrs?: SvgAttrs): string;
export function line(
  x1: number, y1: number, x2: number, y2: number,
  style?: SvgStyle,
): string;
export function polygon(
  points: ReadonlyArray<readonly [number, number]>,
  style?: SvgStyle,
): string;
export function circle(
  cx: number, cy: number, r: number,
  style?: SvgStyle,
): string;
export function label(
  x: number, y: number, text: string,
  style?: SvgLabelStyle,
): string;
```

Behaviour:

- Each function returns a well-formed XML string fragment.
- `svg(viewBox, content)` returns `<svg viewBox="..." xmlns="http://www.w3.org/2000/svg">${content}</svg>`. Without explicit `xmlns`, browsers still render inline SVG, but XML parsers fail; including it keeps tests robust.
- Style defaults (drawn against a dark Tron-themed modal background): stroke `'#e8e8ef'` (light grey, matches existing modal text colour), strokeWidth `1.5`, fill `'none'` (outline-only diagrams). Each style argument overrides individual properties.
- Label default `fontSize` 14, `fill` `'#e8e8ef'`.

**Unit-test obligations:**

- `svg('0 0 320 240', '<line x1=...>')` returns a string starting with `<svg viewBox="0 0 320 240"` and containing the inner content; parses as XML.
- `line(0, 0, 320, 240)` returns `<line x1="0" y1="0" x2="320" y2="240" ...></line>` with default style attributes.
- `polygon([[0, 0], [320, 0], [160, 240]])` returns `<polygon points="0,0 320,0 160,240" ...>`.
- `circle(160, 120, 80)` returns `<circle cx="160" cy="120" r="80" ...>`.
- `label(10, 20, 'A')` returns `<text x="10" y="20" ...>A</text>` (escaped if `<` / `&` appear in text).

### Archetypes (`archetypes.ts`)

Each archetype is a pure function from a parameter object to a complete SVG string (i.e., it calls `svg(...)` internally to wrap the figure). Contract per archetype:

#### `rightTriangle(params)`

```ts
interface RightTriangleParams {
  readonly legA: number;
  readonly legB: number;
  readonly labelA?: string;
  readonly labelB?: string;
  readonly labelHyp?: string;
  readonly viewBox?: string;
}

export function rightTriangle(p: RightTriangleParams): string;
```

- Draws a right triangle with the right angle at the bottom-left; legs along the bottom (length scaled to legA / legB) and left edge.
- Labels: `labelA` (default `String(legA)`) along the bottom leg; `labelB` along the left leg; `labelHyp` (often `'?'` for find-the-hypotenuse problems) along the hypotenuse.
- Small square at the right angle indicates the 90° corner.
- Auto-scales the triangle to fit the viewBox while preserving the legA:legB aspect ratio.

#### `trapezoid(params)`

```ts
interface TrapezoidParams {
  readonly topSide: number;
  readonly bottomSide: number;
  readonly height: number;
  readonly labels?: { top?: string; bottom?: string; height?: string };
}
```

- Draws an isosceles trapezoid with the longer parallel side at the bottom. Labels the parallel sides and the height (with a dashed altitude line from one parallel side to the other).

#### `circleFigure(params)`

```ts
interface CircleFigureParams {
  readonly radius: number;
  readonly labelRadius?: string;
  readonly labelDiameter?: string;
}
```

- Draws a circle centred in the viewBox with a labelled radius arrow from the centre to the edge. If `labelDiameter` is set instead, draws a labelled diameter line through the centre.

#### `regularPolygonFigure(params)`

```ts
interface RegularPolygonFigureParams {
  readonly sides: number;       // n ∈ [3, 12] typically
  readonly sideLength?: number;
  readonly label?: string;      // overlay text (often the side count or 'n=N')
}
```

#### `coordinatePlane(params)`

```ts
interface CoordinatePlaneParams {
  readonly xRange: readonly [number, number];
  readonly yRange: readonly [number, number];
  readonly points: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly label?: string;
  }>;
  readonly drawLineBetweenFirstTwo?: boolean; // for slope / distance problems
}
```

- Draws gridlines, axes with arrow heads, labelled points (e.g., "A (1, 2)").

#### Other archetypes

Listed in [data-model.md](../data-model.md): `triangleGeneric`, `sphereSilhouette`, `cylinderSilhouette`, `coneSilhouette`, `pyramidSilhouette`, `rectangularPrismSilhouette`, `compositeRectangleTriangle`, `circleInscribedInSquare`, `quadrilateralLabelled`. Each has the same shape: pure function from numeric parameters + optional labels to an SVG string.

**Unit-test obligations (per archetype):**

- Output parses as well-formed XML (use a lightweight XML-parse check; `DOMParser` if running in jsdom or a regex-based well-formedness sanity check).
- Output contains the expected `viewBox` attribute.
- Output contains label text matching the input parameters where applicable.
- Output is non-empty.
- Property test (10+ random valid parameter combinations per archetype): all produce well-formed SVG.

---

## `problems/` — pool + templates + sources (expanded internals, preserved public surface)

```ts
// problems/index.ts
export { selectPlaceholderProblem } from './problems';
export { PROBLEM_SOURCES, type ProblemSource } from './sources';
export type { AnswerChoice, Problem } from '../shared/types';
```

The public function `selectPlaceholderProblem(difficulty, uniform01)` is preserved from slice 005 — same signature, same return type. Internally it now dispatches across `pool-b.ts`, `templates-m.ts`, or `templates-a.ts` based on the difficulty.

### `problems/sources.ts`

```ts
export interface ProblemSource {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly license: 'CC BY 4.0';
  readonly attribution: string;
}

export const PROBLEM_SOURCES: readonly ProblemSource[];
```

Populated with (at minimum) the two initial sources from [data-model.md](../data-model.md). Tests assert:

- `PROBLEM_SOURCES.length >= 2`.
- All entries have well-formed `https://` URLs.
- All entries have non-empty `attribution`.
- All `id` values are unique.

### `problems/pool-b.ts`

```ts
export const POOL_B: readonly Problem[];
```

Each entry is a fully-populated `Problem` with `difficulty: 'B'` and a `sourceRef` matching one of the `PROBLEM_SOURCES` entries. Tests assert:

- `POOL_B.length >= 80` (target ~100).
- Every entry has 3 pairwise-distinct choice texts.
- Every entry's `correctIndex` is in `[0, 2]`.
- Every entry's `sourceRef` resolves in `PROBLEM_SOURCES`.
- All `id` values are unique within the pool.

### `problems/templates-m.ts` and `templates-a.ts`

```ts
export interface Template {
  readonly id: string;
  readonly difficulty: 'M' | 'A';
  generate(seed: number): { problem: Problem; nextSeed: number };
}

export const PROBLEM_TEMPLATES_M: readonly Template[];
export const PROBLEM_TEMPLATES_A: readonly Template[];
```

`templates-m.ts` exports ≥ 12 templates; `templates-a.ts` exports ≥ 10. Each template is implemented as a top-level `const` of type `Template` with an inline arrow function for `generate`.

**Unit-test obligations (per template):**

- `template.generate(seed).problem.difficulty === template.difficulty`.
- Same seed produces identical Problems (deterministic).
- 1000-seed property test: every produced Problem has 3 pairwise-distinct choices, valid correctIndex, non-empty prompt, and (if `figure` is set) a well-formed SVG figure.
- At least 70 % of templates in each family ship with a non-undefined `figure` field.

### `problems/problems.ts` (dispatch logic — see [data-model.md](../data-model.md) for the body)

`selectPlaceholderProblem(difficulty, uniform01)` dispatches:

- `'B'`: indexes into `POOL_B` by `uniform01`.
- `'M'` / `'A'`: picks a template from the difficulty's family by `uniform01`, then calls the template's `generate(seed)` with `seed = Math.floor(uniform01 * 0xffffffff)`.

The contract preserves slice-005 behaviour: same difficulty + same uniform01 → same Problem.

---

## `renderer/credits-panel.ts` — new DOM adapter

```ts
// renderer/credits-panel.ts
import type { ProblemSource } from '../problems';

export interface CreditsPanel {
  show(): void;
  hide(): void;
  isVisible(): boolean;
  destroy(): void;
}

export function createCreditsPanel(
  host: HTMLElement,
  sources: readonly ProblemSource[],
  onClose?: () => void,
): CreditsPanel;
```

Behaviour:

- On creation: populates `host` once with a heading + a list of source entries (each entry = source name + URL link + licence + attribution string). Sets `.hidden` class on host initially.
- `show()`: removes `.hidden`. Registers window-level Escape listener + click-outside listener. Invokes `onClose` (if provided) when the panel is dismissed.
- `hide()`: adds `.hidden`. Unregisters listeners.
- `isVisible()`: returns `!host.classList.contains('hidden')`.
- `destroy()`: unregisters lingering listeners and clears the host.

**Smoke-test obligations** (jsdom):

- `createCreditsPanel(host, PROBLEM_SOURCES)` populates host with one `<li>` (or similar) per source.
- After `show()`, the host has no `.hidden` class.
- After `show()` followed by an Escape keydown on the window, the host has `.hidden` again AND `onClose` was invoked.
- Click outside the panel body triggers the same hide.
- `destroy()` is idempotent; calling it twice doesn't throw.

---

## `renderer/problem-modal.ts` — figure-injection extension

The existing `createProblemModal(host)` from slice 005 gains one line in its `show(problem, onCommit)` body:

```ts
// inside buildBody(problem) (or equivalent):
const figure = doc.createElement('div');
figure.className = 'problem-figure';
if (problem.figure) {
  figure.innerHTML = problem.figure; // SVG markup is trusted (we generated it)
}
host.appendChild(figure);
```

Existing CSS rule `.problem-figure:empty { display: none }` keeps the slot hidden when `problem.figure` is undefined.

**Unit-test obligations** (jsdom):

- When `show(problem)` is called with a `problem.figure` set, the `.problem-figure` element contains the figure's SVG content.
- When `show(problem)` is called with no `problem.figure`, the `.problem-figure` element is present but has no inner content (CSS hides it via `:empty`).
- Repeated `show / hide` cycles don't accumulate stale figure content.

---

## `shared/types.ts` — Problem extension

```ts
// shared/types.ts (post-slice)

export interface Problem {
  readonly id: string;
  readonly difficulty: GateDifficulty;
  readonly prompt: string;
  readonly choices: readonly [
    AnswerChoice,
    AnswerChoice,
    AnswerChoice,
  ];
  readonly correctIndex: 0 | 1 | 2;
  readonly figure?: string;     // NEW: inline SVG markup
  readonly sourceRef?: string;  // NEW: matches a ProblemSource.id
}
```

Backward compatibility: both new fields are optional. Existing Problem consumers handle missing fields as "text-only" / "no source".

---

## `game/game-loop.ts` — credits-panel wiring (extension)

Modifications:

- `GameLoopHostElements` interface gains `creditsOverlay: HTMLElement` and `creditsLinkStart: HTMLElement` (and optionally `creditsLinkGameOver` if the game-over screen also gets a link).
- Instantiate `creditsPanel = createCreditsPanel(host.creditsOverlay, PROBLEM_SOURCES)` at top of `createGameLoop`.
- Bind click handler on `creditsLinkStart` to call `creditsPanel.show()`.
- (Optional) Same on `creditsLinkGameOver`.
- `dispose()` calls `creditsPanel.destroy()` for symmetry with the other adapters.

---

## DOM contract additions (in `index.html`)

```html
<!-- In #start-screen, alongside the existing instructions: -->
<button id="credits-link-start" class="credits-link">Problem credits</button>

<!-- In #game-over-overlay, beneath the restart hint: -->
<button id="credits-link-game-over" class="credits-link">Problem credits</button>

<!-- New top-level overlay (sibling to #problem-modal, #pause-overlay, etc.): -->
<div id="credits-overlay" class="overlay hidden" role="dialog" aria-modal="true" aria-label="Problem credits"></div>
```

CSS additions (inline in `index.html` `<style>`, matching existing pattern):

- `.credits-link`: small text button, Tron-cyan styled, minimal padding, doesn't dominate the parent overlay.
- `#credits-overlay`: reuses `.overlay` base; centred flex; max-width similar to the problem modal.
- `#credits-overlay h2`: panel heading.
- `#credits-overlay .source-entry`: a flex column entry per source with `.source-name`, `.source-url` (link), `.source-license`, `.source-attribution` (small italic text).
- `#credits-overlay .close-button`: optional explicit X / Close in the corner.

---

## `LICENSES.md` (repo root)

A markdown file at the repo root listing every CC-BY-licensed source. Format (one section per source):

```markdown
# Problem Source Licences

This project incorporates geometry problems adapted from open-licensed educational
sources. Each source is listed here with the required attribution per its licence.

## OpenStax Contemporary Mathematics, Chapter 10 Geometry

- **URL**: https://openstax.org/details/books/contemporary-mathematics
- **Licence**: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
- **Attribution**: Basic problems adapted from OpenStax Contemporary Mathematics,
  Chapter 10. © OpenStax 2023, used under CC BY 4.0.

## Illustrative Mathematics K-8 Geometry

- **URL**: https://illustrativemathematics.org/
- **Licence**: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
- **Attribution**: Basic problems adapted from Illustrative Mathematics K-8
  Geometry. © Illustrative Mathematics 2019, used under CC BY 4.0.
```

A test in `src/problems/sources.test.ts` reads the file content and asserts that every `PROBLEM_SOURCES[i].name` appears in `LICENSES.md` (substring match). This catches the "added a source to PROBLEM_SOURCES but forgot LICENSES.md" failure mode at test time, before shipping.
