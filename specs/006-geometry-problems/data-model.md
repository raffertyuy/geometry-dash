# Data Model: Real Geometry Problems with Diagrams (Phase 1)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-05-17

This slice introduces two new entity types (`ProblemSource`, `Template`) and extends one existing entity (`Problem`) with two optional fields. No persistent state — all data is bundled at build time as TypeScript modules; nothing is fetched at runtime or stored across sessions.

---

## Extended entity: `Problem`

The slice-005 `Problem` interface gains two optional fields:

```ts
// shared/types.ts (after this slice)

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
  /** Inline SVG markup. Populated by templated M / A problems with geometric figures;
      optional for B problems and for M / A templates that don't have a meaningful figure. */
  readonly figure?: string;
  /** Source identifier (matches a ProblemSource.id). Populated for hand-curated B problems
      sourced from CC-BY textbooks. Optional for templated problems (M / A) where the
      template generator is original to the project. */
  readonly sourceRef?: string;
}
```

Invariants (existing + new):

- Existing: exactly three choices; `correctIndex` is in `[0, 2]`; `prompt` and `choices[*].text` are non-empty.
- Existing: `id` is unique within each pool / template family.
- New: `figure`, if present, parses as well-formed XML with a top-level `<svg>` element and a `viewBox` attribute.
- New: `sourceRef`, if present, matches some `ProblemSource.id` in `PROBLEM_SOURCES`.
- New: the three answer choices are pairwise distinct (no two have identical `text`).

Backward compatibility: existing consumers (modal renderer, problem-gates, runner-engine tests) see no breakage — both new fields are optional, and slice-005's modal already reserves the `.problem-figure` slot with CSS `:empty { display: none }`.

---

## New entity: `ProblemSource`

```ts
// problems/sources.ts

export interface ProblemSource {
  readonly id: string;          // stable kebab-case id, e.g. 'openstax-cm-ch10'
  readonly name: string;        // human-readable, e.g. 'OpenStax Contemporary Mathematics, Ch. 10'
  readonly url: string;         // canonical URL
  readonly license: 'CC BY 4.0';
  readonly attribution: string; // exact attribution text required by the licence
}

export const PROBLEM_SOURCES: readonly ProblemSource[];
```

Invariants:

- `id` is unique across the list.
- `url` is a fully-qualified https URL.
- `license` is `'CC BY 4.0'` for both initial sources; the field is fixed-value for now but typed to allow future additions.
- `attribution` is a non-empty string. The credits panel and `LICENSES.md` both render it verbatim.

Initial population (the slice ships with these two; further sources can be added in future slices):

```ts
PROBLEM_SOURCES = [
  {
    id: 'openstax-cm-ch10',
    name: 'OpenStax Contemporary Mathematics, Chapter 10 Geometry',
    url: 'https://openstax.org/details/books/contemporary-mathematics',
    license: 'CC BY 4.0',
    attribution: 'Basic problems adapted from OpenStax Contemporary Mathematics, Chapter 10. © OpenStax 2023, used under CC BY 4.0.',
  },
  {
    id: 'illustrative-math-k8',
    name: 'Illustrative Mathematics K-8 Geometry',
    url: 'https://illustrativemathematics.org/',
    license: 'CC BY 4.0',
    attribution: 'Basic problems adapted from Illustrative Mathematics K-8 Geometry. © Illustrative Mathematics 2019, used under CC BY 4.0.',
  },
];
```

---

## New entity shape: `Template`

A Template is a function-shaped entity, not a stored record. Each template lives in `src/problems/templates-m.ts` or `templates-a.ts` as a top-level exported function:

```ts
export interface Template {
  readonly id: string;          // stable kebab-case id, e.g. 'right-triangle-pythagoras'
  readonly difficulty: 'M' | 'A';
  /** Pure generator: same seed → same Problem. */
  generate(seed: number): { problem: Problem; nextSeed: number };
}
```

Invariants:

- `generate(seed)` is **deterministic** — repeated calls with the same seed produce identical Problems (same prompt, same answer-choice texts, same order, same correctIndex, same figure SVG bytes).
- `generate(seed).problem` always satisfies the Problem contract (3 choices, correctIndex 0/1/2, non-empty prompt, pairwise-distinct answers).
- `generate(seed).problem.difficulty` matches `template.difficulty`.
- `generate(seed).nextSeed` is a different value from `seed` (PRNG state advanced).
- For templates with geometric figures: `generate(seed).problem.figure` is a well-formed `<svg>` string parseable as XML, with a valid `viewBox`.

Each template encapsulates its own:
- **Parameter range** (e.g., a Pythagorean template picks from the curated list of triples 3-4-5, 5-12-13, 8-15-17, 7-24-25, 9-40-41, 20-21-29 and their small scalings).
- **Problem framing** (e.g., a rectangle template may roll among "find area from W and H", "find W from area and H", "find perimeter from area and W" — three framings within one template).
- **Distractor recipe** (e.g., the right-triangle hypotenuse template's distractors are commonly "A + B", "|A − B|", "(A + B) / 2", "A·B / 2"; the template picks 2 distractors per problem and ensures pairwise-distinctness from the correct answer).
- **Figure generator** (the call into `src/diagrams/` archetypes with parameter values matching the prompt).

Template family expectations:

- **`templates-m.ts`** exports ≥ 12 templates covering: Pythagorean hypotenuse, perimeter / area of square / rectangle / triangle / trapezoid / regular polygon, circle area / circumference, polygon interior-angle sum, cube volume + surface area, equilateral-triangle area, isosceles-right-triangle hypotenuse, simple triangle area from base + height.
- **`templates-a.ts`** exports ≥ 10 templates covering: sphere / cone / cylinder / pyramid volume + surface area, Heron's formula triangle area, distance / midpoint / slope from coordinate-pair inputs, composite areas (rectangle + triangle, circle inscribed in square, etc.), surface area of rectangular prism, right-triangle trigonometry with 30-60-90 / 45-45-90 special angles.
- **`PROBLEM_TEMPLATES_M: readonly Template[]`** and **`PROBLEM_TEMPLATES_A: readonly Template[]`** are exported lists used by `selectPlaceholderProblem` for dispatch.
- At least 70 % of M templates AND at least 70 % of A templates ship with a figure-producing `generate` (per spec FR-007 / SC-003).

---

## SVG archetype shape

```ts
// diagrams/archetypes.ts

interface RightTriangleParams {
  readonly legA: number;
  readonly legB: number;
  readonly labelA?: string;   // text shown alongside leg A (default: String(legA))
  readonly labelB?: string;   // text shown alongside leg B
  readonly labelHyp?: string; // optional hypotenuse label (often '?' when unknown)
}

export function rightTriangle(params: RightTriangleParams): string;
```

Each archetype is a pure function from a parameter object to an SVG string. Archetypes covered (subset; full list in [contracts/module-contracts.md](./contracts/module-contracts.md)):

- `rightTriangle({ legA, legB, ... })`
- `triangleGeneric({ a, b, c, ... })`  (for Heron-style triangles)
- `trapezoid({ a, b, h, ... })`
- `circleFigure({ r, labelR?, labelD? })`
- `regularPolygonFigure({ n, side, ... })`
- `coordinatePlane({ points: [{x, y, label}], drawLine? })`
- `sphereSilhouette({ r, labelR })`
- `cylinderSilhouette({ r, h, labelR, labelH })`
- `coneSilhouette({ r, h, ... })`
- `pyramidSilhouette({ baseEdge, h, ... })`
- `rectangularPrismSilhouette({ l, w, h, ... })`
- `compositeRectangleTriangle({ ... })`
- `circleInscribedInSquare({ s, ... })`
- `quadrilateralLabelled({ a, b, c, d, labels })`

Default viewBox is `'0 0 320 240'`; archetypes may override (e.g., `'0 0 240 320'` for a vertical cone).

---

## Pool-b shape

```ts
// problems/pool-b.ts

export const POOL_B: readonly Problem[];
```

Each Problem in POOL_B has:
- `id`: stable kebab-case (e.g., `'b-openstax-001'`).
- `difficulty: 'B'`.
- `prompt`: recall-style geometry question (1-2 sentences).
- `choices`: three answer texts (correct + two distractors), pairwise-distinct.
- `correctIndex`: 0, 1, or 2.
- `sourceRef`: matches a `ProblemSource.id`.
- `figure`: usually undefined for B problems; rare exceptions may include a small silhouette for shape-identification problems.

Pool size: ≥ 80 entries at spec acceptance (target ~100). Each entry has its source recorded; a test (`pool-b.test.ts`) asserts every `sourceRef` resolves in `PROBLEM_SOURCES`.

---

## Dispatch logic

```ts
// problems/problems.ts (post-slice)

import { POOL_B } from './pool-b';
import { PROBLEM_TEMPLATES_M } from './templates-m';
import { PROBLEM_TEMPLATES_A } from './templates-a';
import type { GateDifficulty, Problem } from '../shared/types';

export function selectPlaceholderProblem(
  difficulty: GateDifficulty,
  uniform01: number,
): Problem {
  if (difficulty === 'B') {
    const idx = Math.min(POOL_B.length - 1, Math.floor(uniform01 * POOL_B.length));
    return POOL_B[idx]!;
  }
  const family = difficulty === 'M' ? PROBLEM_TEMPLATES_M : PROBLEM_TEMPLATES_A;
  const tIdx = Math.min(family.length - 1, Math.floor(uniform01 * family.length));
  const template = family[tIdx]!;
  // Single draw to pick a template; the template's own generate() handles
  // its parameter rolls. Since callers (problem-gates/augmentRowWithGates)
  // only pass one uniform01 value, we synthesise a seed from it for the
  // template's internal draws. The exact seed-synthesis convention is
  // documented in the module contract.
  const seed = Math.floor(uniform01 * 0xffffffff);
  return template.generate(seed).problem;
}
```

The public-surface signature is preserved from slice 005 (`selectPlaceholderProblem(difficulty, uniform01)`), so problem-gates and tests continue calling it the same way. The internal dispatch is new.

---

## Run lifecycle (unchanged)

No new run-state transitions in this slice. The Problem entity gains optional fields; the runner-engine state machine, the modal show/commit flow, the obstacle / lives / invincibility logic — all unchanged from slice 005. The slice is content + rendering, not gameplay mechanics.

---

## Debug observability

The slice introduces no new mandatory `console.debug` events. As an OPTIONAL development aid, templates MAY emit a `template_generated` event payload `{ templateId, difficulty, seed }` when running in `?debug=1` mode. This is implementer's discretion — the spec doesn't require it.

The existing `?debug=1` overlay continues to show runState / lives / scoreDelta / activeGate / invincibility. For the active answering session, `world.activeGate?.problem` is available; a future debug-polish slice could surface `problem.sourceRef` and `problem.id` to help test-driving content correctness.
