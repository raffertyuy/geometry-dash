import {
  circleFigure,
  cubeSilhouette,
  equilateralTriangleFigure,
  rectangleFigure,
  rectangularPrismSilhouette,
  regularPolygonFigure,
  rightTriangle,
  squareFigure,
  trapezoid,
  triangleBaseHeight,
} from '../diagrams';
import {
  buildProblem,
  hasDuplicateChoices,
  mulberry32,
  pickOne,
  type Template,
} from './template-utils';

export type { Template };

// Pythagorean triples used by the hypotenuse template. Hand-curated for
// clean integer outputs.
const PYTH_TRIPLES: readonly { a: number; b: number; c: number }[] = [
  { a: 3, b: 4, c: 5 },
  { a: 5, b: 12, c: 13 },
  { a: 8, b: 15, c: 17 },
  { a: 7, b: 24, c: 25 },
  { a: 9, b: 40, c: 41 },
  { a: 20, b: 21, c: 29 },
  { a: 6, b: 8, c: 10 }, // scaling of 3-4-5
  { a: 9, b: 12, c: 15 }, // scaling of 3-4-5
];

// Parameter lists curated per-template to avoid collisions between the
// correct answer and either distractor. The collisions are surfaced by
// the verification tests (templates-m.test.ts) which assert no template
// produces a duplicate-choice problem across 1000 seeds.
const SQUARE_PERIMETER_SIDES = [3, 5, 6, 7, 8, 9, 10, 12] as const; // 2: 2s=s²; 4: 4s=s²
const SQUARE_AREA_SIDES = [3, 5, 6, 7, 8, 9, 10, 12] as const;       // 2: s²=2s; 4: s²=4s
const EQUILATERAL_SIDES = [4, 5, 6, 7, 8, 9, 10, 12] as const;       // 2: 2s=s²; 3: 3s=s²
const CUBE_VOLUME_SIDES = [2, 3, 4, 5, 7, 8, 10, 12] as const;       // 6: 6s² = s³
const CUBE_SA_SIDES = [2, 3, 5, 7, 8, 10, 12] as const;              // 4: s³ = 4s²; 6: 6s² = s³
const RECTANGLE_SIDES = [3, 4, 5, 6, 7, 8, 9, 10] as const;
const POLYGON_SIDES = [3, 4, 5, 6, 7, 8, 9, 10, 12] as const;
const CIRCLE_RADII = [3, 4, 5, 6, 7, 8, 10] as const;                // 1,2: πr² ≈ 2πr or πr
const PRISM_VOLUME_SIDES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12] as const;
const TRAPEZOID_PAIRS: readonly { a: number; b: number; h: number; area: number }[] = [
  { a: 5, b: 7, h: 4, area: 24 },
  { a: 3, b: 7, h: 4, area: 20 },
  { a: 4, b: 8, h: 6, area: 36 },
  { a: 6, b: 10, h: 4, area: 32 },
  { a: 5, b: 9, h: 6, area: 42 },
  { a: 3, b: 5, h: 8, area: 32 },
  { a: 7, b: 11, h: 6, area: 54 },
];

const PI_APPROX = 3.14;

function fmt(n: number): string {
  // Display floats with at most 2 decimal places; integers without.
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// ---- Templates ---------------------------------------------------------

const T_PYTHAGORAS: Template = {
  id: 'm-pythagoras-hypotenuse',
  difficulty: 'M',
  generate(seed) {
    const r1 = mulberry32(seed);
    const triple = pickOne(PYTH_TRIPLES, r1.value);
    const correct = String(triple.c);
    const d1 = String(triple.a + triple.b);
    const d2 = String(Math.abs(triple.b - triple.a) + 1);
    if (hasDuplicateChoices(correct, d1, d2)) {
      return T_PYTHAGORAS.generate(r1.nextSeed);
    }
    return buildProblem(
      'm-pythagoras-hypotenuse',
      'M',
      `Right triangle with legs ${triple.a} and ${triple.b}. Hypotenuse?`,
      correct,
      d1,
      d2,
      r1.nextSeed,
      rightTriangle({ legA: triple.a, legB: triple.b, labelHyp: '?' }),
    );
  },
};

const T_SQUARE_PERIMETER: Template = {
  id: 'm-square-perimeter',
  difficulty: 'M',
  generate(seed) {
    const r1 = mulberry32(seed);
    const s = pickOne(SQUARE_PERIMETER_SIDES, r1.value);
    return buildProblem(
      'm-square-perimeter',
      'M',
      `Square with side ${s}. Perimeter?`,
      String(4 * s),
      String(2 * s),
      String(s * s),
      r1.nextSeed,
      squareFigure(s),
    );
  },
};

const T_SQUARE_AREA: Template = {
  id: 'm-square-area',
  difficulty: 'M',
  generate(seed) {
    const r1 = mulberry32(seed);
    const s = pickOne(SQUARE_AREA_SIDES, r1.value);
    return buildProblem(
      'm-square-area',
      'M',
      `Square with side ${s}. Area?`,
      String(s * s),
      String(4 * s),
      String(2 * s),
      r1.nextSeed,
      squareFigure(s),
    );
  },
};

// Re-roll the (w, h) pair if it produces a duplicate choice. (3,6) and
// (6,3) satisfy 2(w+h) = wh which makes correct == d1 for both rectangle
// templates. Bounded retry; the probability of N consecutive bad pairs
// is ~ (2/64)^N which is negligible for N > 2.
function pickRectangleDimensions(
  seed: number,
): { w: number; h: number; nextSeed: number } {
  let current = seed;
  for (let attempt = 0; attempt < 16; attempt++) {
    const r1 = mulberry32(current);
    const w = pickOne(RECTANGLE_SIDES, r1.value);
    const r2 = mulberry32(r1.nextSeed);
    const h = pickOne(RECTANGLE_SIDES, r2.value);
    // Reject equal sides (visually less interesting) and the (3,6)/(6,3)
    // pair (which would produce 2(w+h) == wh, making correct == d1).
    if (h === w || (w * h === 2 * (w + h))) {
      current = r2.nextSeed;
      continue;
    }
    return { w, h, nextSeed: r2.nextSeed };
  }
  // Should never reach here given the parameter space; fail loudly.
  throw new Error('pickRectangleDimensions: 16 retries failed');
}

const T_RECTANGLE_PERIMETER: Template = {
  id: 'm-rectangle-perimeter',
  difficulty: 'M',
  generate(seed) {
    const { w, h, nextSeed } = pickRectangleDimensions(seed);
    return buildProblem(
      'm-rectangle-perimeter',
      'M',
      `Rectangle with width ${w} and height ${h}. Perimeter?`,
      String(2 * (w + h)),
      String(w * h),
      String(w + h),
      nextSeed,
      rectangleFigure(w, h),
    );
  },
};

const T_RECTANGLE_AREA: Template = {
  id: 'm-rectangle-area',
  difficulty: 'M',
  generate(seed) {
    const { w, h, nextSeed } = pickRectangleDimensions(seed);
    return buildProblem(
      'm-rectangle-area',
      'M',
      `Rectangle with width ${w} and height ${h}. Area?`,
      String(w * h),
      String(2 * (w + h)),
      String(w + h),
      nextSeed,
      rectangleFigure(w, h),
    );
  },
};

const T_TRIANGLE_AREA_BASE_HEIGHT: Template = {
  id: 'm-triangle-area-bh',
  difficulty: 'M',
  generate(seed) {
    const r1 = mulberry32(seed);
    const evenProducts: readonly { b: number; h: number }[] = [
      { b: 4, h: 3 }, { b: 6, h: 4 }, { b: 8, h: 5 }, { b: 10, h: 6 },
      { b: 12, h: 5 }, { b: 8, h: 7 }, { b: 6, h: 8 }, { b: 14, h: 4 },
    ];
    const p = pickOne(evenProducts, r1.value);
    return buildProblem(
      'm-triangle-area-bh',
      'M',
      `Triangle with base ${p.b} and height ${p.h}. Area?`,
      String((p.b * p.h) / 2),
      String(p.b * p.h),
      String(p.b + p.h),
      r1.nextSeed,
      triangleBaseHeight(p.b, p.h),
    );
  },
};

const T_CIRCLE_AREA: Template = {
  id: 'm-circle-area',
  difficulty: 'M',
  generate(seed) {
    const r1 = mulberry32(seed);
    const r = pickOne(CIRCLE_RADII, r1.value);
    const area = PI_APPROX * r * r;
    return buildProblem(
      'm-circle-area',
      'M',
      `Circle with radius ${r}. Area? (π ≈ 3.14)`,
      fmt(area),
      fmt(2 * PI_APPROX * r),
      fmt(PI_APPROX * r),
      r1.nextSeed,
      circleFigure(r, `r = ${r}`),
    );
  },
};

const T_CIRCLE_CIRCUMFERENCE: Template = {
  id: 'm-circle-circumference',
  difficulty: 'M',
  generate(seed) {
    const r1 = mulberry32(seed);
    const r = pickOne(CIRCLE_RADII, r1.value);
    const c = 2 * PI_APPROX * r;
    return buildProblem(
      'm-circle-circumference',
      'M',
      `Circle with radius ${r}. Circumference? (π ≈ 3.14)`,
      fmt(c),
      fmt(PI_APPROX * r * r),
      fmt(PI_APPROX * r),
      r1.nextSeed,
      circleFigure(r, `r = ${r}`),
    );
  },
};

const T_POLYGON_ANGLE_SUM: Template = {
  id: 'm-polygon-interior-angle-sum',
  difficulty: 'M',
  generate(seed) {
    const r1 = mulberry32(seed);
    const n = pickOne(POLYGON_SIDES, r1.value);
    return buildProblem(
      'm-polygon-interior-angle-sum',
      'M',
      `Sum of interior angles of a ${n}-sided polygon?`,
      `${(n - 2) * 180}°`,
      `${n * 180}°`,
      `${(n - 2) * 90}°`,
      r1.nextSeed,
      regularPolygonFigure(n, `${n} sides`),
    );
  },
};

const T_CUBE_VOLUME: Template = {
  id: 'm-cube-volume',
  difficulty: 'M',
  generate(seed) {
    const r1 = mulberry32(seed);
    const s = pickOne(CUBE_VOLUME_SIDES, r1.value);
    return buildProblem(
      'm-cube-volume',
      'M',
      `Cube with side ${s}. Volume?`,
      String(s * s * s),
      String(6 * s * s),
      String(s * s),
      r1.nextSeed,
      cubeSilhouette(s),
    );
  },
};

const T_CUBE_SURFACE_AREA: Template = {
  id: 'm-cube-surface-area',
  difficulty: 'M',
  generate(seed) {
    const r1 = mulberry32(seed);
    const s = pickOne(CUBE_SA_SIDES, r1.value);
    return buildProblem(
      'm-cube-surface-area',
      'M',
      `Cube with side ${s}. Surface area?`,
      String(6 * s * s),
      String(s * s * s),
      String(4 * s * s),
      r1.nextSeed,
      cubeSilhouette(s),
    );
  },
};

const T_TRAPEZOID_AREA: Template = {
  id: 'm-trapezoid-area',
  difficulty: 'M',
  generate(seed) {
    const r1 = mulberry32(seed);
    const t = pickOne(TRAPEZOID_PAIRS, r1.value);
    return buildProblem(
      'm-trapezoid-area',
      'M',
      `Trapezoid with parallel sides ${t.a} and ${t.b}, height ${t.h}. Area?`,
      String(t.area),
      String((t.a + t.b) * t.h),
      String(t.a * t.b),
      r1.nextSeed,
      trapezoid({ topSide: t.a, bottomSide: t.b, height: t.h, showAltitude: true }),
    );
  },
};

const T_EQUILATERAL_PERIMETER: Template = {
  id: 'm-equilateral-perimeter',
  difficulty: 'M',
  generate(seed) {
    const r1 = mulberry32(seed);
    const s = pickOne(EQUILATERAL_SIDES, r1.value);
    return buildProblem(
      'm-equilateral-perimeter',
      'M',
      `Equilateral triangle with side ${s}. Perimeter?`,
      String(3 * s),
      String(2 * s),
      String(s * s),
      r1.nextSeed,
      equilateralTriangleFigure(s),
    );
  },
};

const T_ISOSCELES_RIGHT_HYPOTENUSE: Template = {
  id: 'm-isosceles-right-hypotenuse',
  difficulty: 'M',
  generate(seed) {
    const r1 = mulberry32(seed);
    const leg = pickOne([1, 2, 3, 4, 5, 6, 7] as const, r1.value);
    return buildProblem(
      'm-isosceles-right-hypotenuse',
      'M',
      `Isosceles right triangle with legs ${leg}. Hypotenuse?`,
      `${leg}√2`,
      `${2 * leg}`,
      `${leg}√3`,
      r1.nextSeed,
      rightTriangle({ legA: leg, legB: leg, labelHyp: '?' }),
    );
  },
};

const T_RECT_PRISM_VOLUME: Template = {
  id: 'm-rect-prism-volume',
  difficulty: 'M',
  generate(seed) {
    const r1 = mulberry32(seed);
    const cases: readonly { l: number; w: number; h: number }[] = [
      { l: 3, w: 4, h: 5 }, { l: 2, w: 5, h: 6 }, { l: 4, w: 5, h: 6 },
      { l: 2, w: 3, h: 7 }, { l: 5, w: 6, h: 7 }, { l: 3, w: 5, h: 8 },
      { l: 4, w: 4, h: 9 }, { l: 2, w: 7, h: 10 },
    ];
    const c = pickOne(cases, r1.value);
    return buildProblem(
      'm-rect-prism-volume',
      'M',
      `Rectangular prism ${c.l} × ${c.w} × ${c.h}. Volume?`,
      String(c.l * c.w * c.h),
      String(2 * (c.l * c.w + c.l * c.h + c.w * c.h)),
      String(c.l + c.w + c.h),
      r1.nextSeed,
      rectangularPrismSilhouette(c.l, c.w, c.h),
    );
  },
};

// Silence unused-warning if SMALL_INTS-style export was preserved elsewhere.
void PRISM_VOLUME_SIDES;

export const PROBLEM_TEMPLATES_M: readonly Template[] = [
  T_PYTHAGORAS,
  T_SQUARE_PERIMETER,
  T_SQUARE_AREA,
  T_RECTANGLE_PERIMETER,
  T_RECTANGLE_AREA,
  T_TRIANGLE_AREA_BASE_HEIGHT,
  T_CIRCLE_AREA,
  T_CIRCLE_CIRCUMFERENCE,
  T_POLYGON_ANGLE_SUM,
  T_CUBE_VOLUME,
  T_CUBE_SURFACE_AREA,
  T_TRAPEZOID_AREA,
  T_EQUILATERAL_PERIMETER,
  T_ISOSCELES_RIGHT_HYPOTENUSE,
  T_RECT_PRISM_VOLUME,
];
