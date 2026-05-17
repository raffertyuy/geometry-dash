import {
  buildProblem,
  mulberry32,
  pickOne,
  type Template,
} from './template-utils';

const PI_APPROX = 3.14;

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// ---- Advanced templates ------------------------------------------------

const T_SPHERE_VOLUME: Template = {
  id: 'a-sphere-volume',
  difficulty: 'A',
  generate(seed) {
    const r1 = mulberry32(seed);
    // Drop r=3: at that value (4/3)·π·r³ === 4·π·r² (113.04), so the
    // correct answer collides with the surface-area distractor.
    const r = pickOne([6, 9, 12] as const, r1.value);
    const v = (4 / 3) * PI_APPROX * r * r * r;
    return buildProblem(
      'a-sphere-volume',
      'A',
      `Sphere with radius ${r}. Volume? (π ≈ 3.14)`,
      fmt(v),
      fmt(4 * PI_APPROX * r * r), // surface area
      fmt((4 / 3) * r * r * r), // forgot the π
      r1.nextSeed,
    );
  },
};

const T_SPHERE_SURFACE: Template = {
  id: 'a-sphere-surface-area',
  difficulty: 'A',
  generate(seed) {
    const r1 = mulberry32(seed);
    // Drop r=3: same collision as sphere-volume.
    const r = pickOne([6, 9, 12] as const, r1.value);
    const sa = 4 * PI_APPROX * r * r;
    return buildProblem(
      'a-sphere-surface-area',
      'A',
      `Sphere with radius ${r}. Surface area? (π ≈ 3.14)`,
      fmt(sa),
      fmt((4 / 3) * PI_APPROX * r * r * r), // volume
      fmt(2 * PI_APPROX * r * r), // half-sphere SA
      r1.nextSeed,
    );
  },
};

const T_CYLINDER_VOLUME: Template = {
  id: 'a-cylinder-volume',
  difficulty: 'A',
  generate(seed) {
    const r1 = mulberry32(seed);
    // Drop r=2: at that value 2πrh = πr²h, so correct collides with d1.
    const r = pickOne([3, 4, 5] as const, r1.value);
    const r2 = mulberry32(r1.nextSeed);
    const h = pickOne([5, 6, 8, 10] as const, r2.value);
    const v = PI_APPROX * r * r * h;
    return buildProblem(
      'a-cylinder-volume',
      'A',
      `Cylinder with radius ${r}, height ${h}. Volume? (π ≈ 3.14)`,
      fmt(v),
      fmt(2 * PI_APPROX * r * h), // lateral surface
      fmt(PI_APPROX * r * h), // missing the square
      r2.nextSeed,
    );
  },
};

const T_CYLINDER_SURFACE: Template = {
  id: 'a-cylinder-surface-area',
  difficulty: 'A',
  generate(seed) {
    // Drop r=2 (correct=d1) and avoid pair (r=3, h=6) (correct=d1 via
    // (r-2)(h-2)=4 case). Re-roll if the picked pair is the bad one.
    let current = seed;
    for (let attempt = 0; attempt < 16; attempt++) {
      const r1 = mulberry32(current);
      const r = pickOne([3, 4, 5] as const, r1.value);
      const r2 = mulberry32(r1.nextSeed);
      const h = pickOne([5, 6, 8, 10] as const, r2.value);
      // Reject (3,6): 2π·3·(3+6) = 2π·27 = 54π; π·9·6 = 54π. Collision.
      if (r === 3 && h === 6) {
        current = r2.nextSeed;
        continue;
      }
      const sa = 2 * PI_APPROX * r * r + 2 * PI_APPROX * r * h;
      return buildProblem(
        'a-cylinder-surface-area',
        'A',
        `Cylinder with radius ${r}, height ${h}. Surface area? (π ≈ 3.14)`,
        fmt(sa),
        fmt(PI_APPROX * r * r * h), // volume
        fmt(2 * PI_APPROX * r * h), // forgot the end caps
        r2.nextSeed,
      );
    }
    throw new Error('T_CYLINDER_SURFACE: 16 retries exhausted');
  },
};

const T_CONE_VOLUME: Template = {
  id: 'a-cone-volume',
  difficulty: 'A',
  generate(seed) {
    const r1 = mulberry32(seed);
    const r = pickOne([3, 6, 9] as const, r1.value);
    const r2 = mulberry32(r1.nextSeed);
    const h = pickOne([4, 8, 12] as const, r2.value);
    const v = (1 / 3) * PI_APPROX * r * r * h;
    return buildProblem(
      'a-cone-volume',
      'A',
      `Cone with radius ${r}, height ${h}. Volume? (π ≈ 3.14)`,
      fmt(v),
      fmt(PI_APPROX * r * r * h), // cylinder volume (forgot 1/3)
      fmt((1 / 3) * PI_APPROX * r * h), // missing the square
      r2.nextSeed,
    );
  },
};

const T_PYRAMID_VOLUME: Template = {
  id: 'a-pyramid-volume',
  difficulty: 'A',
  generate(seed) {
    const r1 = mulberry32(seed);
    // Drop a=3: at that value a·h = a²·h/3, so correct = d2.
    const a = pickOne([4, 5, 6, 9] as const, r1.value);
    const r2 = mulberry32(r1.nextSeed);
    const h = pickOne([6, 9, 12] as const, r2.value);
    const v = (a * a * h) / 3;
    return buildProblem(
      'a-pyramid-volume',
      'A',
      `Square-based pyramid with base side ${a}, height ${h}. Volume?`,
      fmt(v),
      fmt(a * a * h), // forgot the 1/3
      fmt(a * h), // forgot to square
      r2.nextSeed,
    );
  },
};

const T_HERON_AREA: Template = {
  id: 'a-heron-area',
  difficulty: 'A',
  generate(seed) {
    const r1 = mulberry32(seed);
    // Hand-curated NON-right integer-sided triangles with clean Heron output.
    // Right triangles excluded because base*height/2 (a common-error distractor)
    // would equal the correct area for them.
    const cases: readonly { a: number; b: number; c: number; area: number }[] = [
      { a: 5, b: 5, c: 6, area: 12 },
      { a: 5, b: 5, c: 8, area: 12 },
      { a: 6, b: 6, c: 8, area: 17.89 },
      { a: 10, b: 10, c: 12, area: 48 },
      { a: 10, b: 10, c: 16, area: 48 },
      { a: 7, b: 8, c: 9, area: 26.83 },
      { a: 13, b: 14, c: 15, area: 84 },
    ];
    const c = pickOne(cases, r1.value);
    return buildProblem(
      'a-heron-area',
      'A',
      `Triangle with sides ${c.a}, ${c.b}, ${c.c}. Area? (Heron's formula)`,
      fmt(c.area),
      String((c.a + c.b + c.c) / 2), // semi-perimeter (common confusion)
      String(c.a + c.b + c.c), // perimeter
      r1.nextSeed,
    );
  },
};

const T_DISTANCE_FORMULA: Template = {
  id: 'a-distance-formula',
  difficulty: 'A',
  generate(seed) {
    const r1 = mulberry32(seed);
    // Coordinate pairs giving integer distances (Pythagorean configurations).
    const cases: readonly { x1: number; y1: number; x2: number; y2: number; d: number }[] = [
      { x1: 0, y1: 0, x2: 3, y2: 4, d: 5 },
      { x1: 1, y1: 1, x2: 4, y2: 5, d: 5 },
      { x1: 0, y1: 0, x2: 5, y2: 12, d: 13 },
      { x1: 2, y1: 3, x2: 10, y2: 18, d: 17 },
      { x1: 0, y1: 0, x2: 8, y2: 15, d: 17 },
      { x1: -3, y1: 4, x2: 0, y2: 0, d: 5 },
      { x1: 0, y1: 0, x2: 7, y2: 24, d: 25 },
      { x1: 1, y1: 2, x2: 4, y2: 6, d: 5 },
    ];
    const c = pickOne(cases, r1.value);
    const dx = Math.abs(c.x2 - c.x1);
    const dy = Math.abs(c.y2 - c.y1);
    return buildProblem(
      'a-distance-formula',
      'A',
      `Distance between (${c.x1}, ${c.y1}) and (${c.x2}, ${c.y2})?`,
      String(c.d),
      String(dx + dy), // Manhattan distance (common error)
      String(Math.max(dx, dy)),
      r1.nextSeed,
    );
  },
};

const T_MIDPOINT_FORMULA: Template = {
  id: 'a-midpoint-formula',
  difficulty: 'A',
  generate(seed) {
    const r1 = mulberry32(seed);
    // Even sums for integer midpoint coordinates.
    const cases: readonly { x1: number; y1: number; x2: number; y2: number }[] = [
      { x1: 2, y1: 4, x2: 6, y2: 8 },
      { x1: 0, y1: 0, x2: 4, y2: 6 },
      { x1: -2, y1: 4, x2: 6, y2: 2 },
      { x1: 1, y1: 3, x2: 5, y2: 9 },
      { x1: 0, y1: -2, x2: 4, y2: 6 },
      { x1: 3, y1: 5, x2: 9, y2: 11 },
      { x1: -4, y1: 2, x2: 2, y2: 8 },
    ];
    const c = pickOne(cases, r1.value);
    const mx = (c.x1 + c.x2) / 2;
    const my = (c.y1 + c.y2) / 2;
    return buildProblem(
      'a-midpoint-formula',
      'A',
      `Midpoint of (${c.x1}, ${c.y1}) and (${c.x2}, ${c.y2})?`,
      `(${mx}, ${my})`,
      `(${c.x1 + c.x2}, ${c.y1 + c.y2})`, // forgot to halve
      `(${c.x1}, ${c.y2})`, // swapped-coordinate error
      r1.nextSeed,
    );
  },
};

const T_SLOPE_FORMULA: Template = {
  id: 'a-slope-formula',
  difficulty: 'A',
  generate(seed) {
    const r1 = mulberry32(seed);
    const cases: readonly { x1: number; y1: number; x2: number; y2: number; m: number }[] = [
      { x1: 0, y1: 0, x2: 2, y2: 4, m: 2 },
      { x1: 1, y1: 1, x2: 4, y2: 7, m: 2 },
      { x1: 0, y1: 0, x2: 3, y2: 6, m: 2 },
      { x1: 2, y1: 1, x2: 5, y2: 10, m: 3 },
      { x1: 1, y1: 2, x2: 4, y2: 11, m: 3 },
      { x1: 1, y1: 5, x2: 4, y2: -1, m: -2 },
      { x1: 0, y1: 0, x2: 1, y2: 5, m: 5 },
    ];
    const c = pickOne(cases, r1.value);
    return buildProblem(
      'a-slope-formula',
      'A',
      `Slope of the line through (${c.x1}, ${c.y1}) and (${c.x2}, ${c.y2})?`,
      String(c.m),
      String(-c.m), // negation - sign error
      String(c.m + 1), // off-by-one arithmetic error
      r1.nextSeed,
    );
  },
};

const T_RECT_PRISM_SA: Template = {
  id: 'a-rect-prism-surface-area',
  difficulty: 'A',
  generate(seed) {
    const r1 = mulberry32(seed);
    const cases: readonly { l: number; w: number; h: number }[] = [
      { l: 3, w: 4, h: 5 },
      { l: 2, w: 5, h: 6 },
      { l: 4, w: 5, h: 6 },
      { l: 3, w: 5, h: 7 },
      { l: 4, w: 6, h: 8 },
      { l: 2, w: 3, h: 9 },
      { l: 5, w: 6, h: 10 },
    ];
    const c = pickOne(cases, r1.value);
    const sa = 2 * (c.l * c.w + c.l * c.h + c.w * c.h);
    return buildProblem(
      'a-rect-prism-surface-area',
      'A',
      `Rectangular prism ${c.l} × ${c.w} × ${c.h}. Surface area?`,
      String(sa),
      String(c.l * c.w * c.h), // volume
      String(c.l * c.w + c.l * c.h + c.w * c.h), // forgot the 2
      r1.nextSeed,
    );
  },
};

const T_30_60_90: Template = {
  id: 'a-30-60-90-trig',
  difficulty: 'A',
  generate(seed) {
    const r1 = mulberry32(seed);
    const hyp = pickOne([4, 6, 8, 10, 12, 14] as const, r1.value);
    // 30-60-90: hypotenuse = 2L, short leg (opposite 30°) = L, long leg = L√3.
    const short = hyp / 2;
    return buildProblem(
      'a-30-60-90-trig',
      'A',
      `In a 30-60-90 right triangle, the hypotenuse is ${hyp}. What is the length of the shorter leg (opposite the 30° angle)?`,
      String(short),
      String(hyp / 3),
      `${short}√3`,
      r1.nextSeed,
    );
  },
};

const T_45_45_90: Template = {
  id: 'a-45-45-90-trig',
  difficulty: 'A',
  generate(seed) {
    const r1 = mulberry32(seed);
    const leg = pickOne([3, 4, 5, 6, 7, 8] as const, r1.value);
    // 45-45-90: hypotenuse = leg√2.
    return buildProblem(
      'a-45-45-90-trig',
      'A',
      `In a 45-45-90 right triangle, each leg is ${leg}. Hypotenuse?`,
      `${leg}√2`,
      `${2 * leg}`,
      `${leg}√3`,
      r1.nextSeed,
    );
  },
};

const T_COMPOSITE_RECT_TRIANGLE: Template = {
  id: 'a-composite-rect-triangle',
  difficulty: 'A',
  generate(seed) {
    const r1 = mulberry32(seed);
    // House-shape: rectangle WxH with a triangle on top (same base W, height T).
    const cases: readonly { w: number; h: number; t: number; area: number }[] = [
      { w: 6, h: 4, t: 3, area: 33 }, // 24 + 9
      { w: 8, h: 5, t: 4, area: 56 }, // 40 + 16
      { w: 10, h: 6, t: 4, area: 80 }, // 60 + 20
      { w: 4, h: 5, t: 2, area: 24 }, // 20 + 4
      { w: 6, h: 3, t: 4, area: 30 }, // 18 + 12
    ];
    const c = pickOne(cases, r1.value);
    return buildProblem(
      'a-composite-rect-triangle',
      'A',
      `A "house" shape: a ${c.w} × ${c.h} rectangle with a triangle of equal base on top, triangle height ${c.t}. Total area?`,
      String(c.area),
      String(c.w * c.h + c.w * c.t), // forgot the /2 on triangle
      String(c.w * c.h), // forgot the triangle
      r1.nextSeed,
    );
  },
};

export const PROBLEM_TEMPLATES_A: readonly Template[] = [
  T_SPHERE_VOLUME,
  T_SPHERE_SURFACE,
  T_CYLINDER_VOLUME,
  T_CYLINDER_SURFACE,
  T_CONE_VOLUME,
  T_PYRAMID_VOLUME,
  T_HERON_AREA,
  T_DISTANCE_FORMULA,
  T_MIDPOINT_FORMULA,
  T_SLOPE_FORMULA,
  T_RECT_PRISM_SA,
  T_30_60_90,
  T_45_45_90,
  T_COMPOSITE_RECT_TRIANGLE,
];
