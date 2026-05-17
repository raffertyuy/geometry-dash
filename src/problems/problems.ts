import type { AnswerChoice, GateDifficulty, Problem } from '../shared/types';

/**
 * Placeholder problem pool for the problem-gates slice. Text-only — no
 * diagrams, no equation typesetting yet (that's a future slice). Each
 * difficulty has ~15 hand-authored entries with exactly three answer
 * choices and exactly one correct answer. The pool is shuffled at boot
 * by selectPlaceholderProblem's RNG-indexing.
 */

type ChoiceTuple = readonly [AnswerChoice, AnswerChoice, AnswerChoice];

function c(a: string, b: string, c: string): ChoiceTuple {
  return [{ text: a }, { text: b }, { text: c }] as const;
}

const POOL_B: readonly Problem[] = [
  { id: 'b01', difficulty: 'B', prompt: 'How many sides does a hexagon have?', choices: c('5', '6', '7'), correctIndex: 1 },
  { id: 'b02', difficulty: 'B', prompt: 'How many vertices does a cube have?', choices: c('6', '8', '12'), correctIndex: 1 },
  { id: 'b03', difficulty: 'B', prompt: 'Sum of interior angles of a triangle?', choices: c('180°', '360°', '90°'), correctIndex: 0 },
  { id: 'b04', difficulty: 'B', prompt: 'How many right angles in a square?', choices: c('2', '4', '8'), correctIndex: 1 },
  { id: 'b05', difficulty: 'B', prompt: 'A shape with 5 equal sides and 5 equal angles is a…', choices: c('Pentagon', 'Hexagon', 'Octagon'), correctIndex: 0 },
  { id: 'b06', difficulty: 'B', prompt: 'How many sides does an octagon have?', choices: c('6', '7', '8'), correctIndex: 2 },
  { id: 'b07', difficulty: 'B', prompt: 'A polygon with 3 sides is called a…', choices: c('Triangle', 'Trapezoid', 'Pentagon'), correctIndex: 0 },
  { id: 'b08', difficulty: 'B', prompt: 'How many faces does a cube have?', choices: c('4', '6', '8'), correctIndex: 1 },
  { id: 'b09', difficulty: 'B', prompt: 'Which shape is a quadrilateral?', choices: c('Square', 'Triangle', 'Hexagon'), correctIndex: 0 },
  { id: 'b10', difficulty: 'B', prompt: 'How many edges does a tetrahedron have?', choices: c('4', '6', '8'), correctIndex: 1 },
  { id: 'b11', difficulty: 'B', prompt: 'How many corners (vertices) does a circle have?', choices: c('0', '1', 'Infinite'), correctIndex: 0 },
  { id: 'b12', difficulty: 'B', prompt: 'A right angle measures…', choices: c('45°', '90°', '180°'), correctIndex: 1 },
  { id: 'b13', difficulty: 'B', prompt: 'How many sides does a pentagon have?', choices: c('4', '5', '6'), correctIndex: 1 },
  { id: 'b14', difficulty: 'B', prompt: 'Each angle of an equilateral triangle equals…', choices: c('30°', '45°', '60°'), correctIndex: 2 },
  { id: 'b15', difficulty: 'B', prompt: 'Which of these is NOT a polygon?', choices: c('Triangle', 'Circle', 'Square'), correctIndex: 1 },
];

const POOL_M: readonly Problem[] = [
  { id: 'm01', difficulty: 'M', prompt: 'A right triangle with legs 3 and 4 has hypotenuse…', choices: c('5', '6', '7'), correctIndex: 0 },
  { id: 'm02', difficulty: 'M', prompt: 'A square with side 6 has perimeter…', choices: c('12', '24', '36'), correctIndex: 1 },
  { id: 'm03', difficulty: 'M', prompt: 'A 5 × 3 rectangle has area…', choices: c('8', '15', '30'), correctIndex: 1 },
  { id: 'm04', difficulty: 'M', prompt: 'Circle circumference, radius 7 (π ≈ 3.14)…', choices: c('21.98', '43.96', '153.86'), correctIndex: 1 },
  { id: 'm05', difficulty: 'M', prompt: 'Sum of interior angles of a quadrilateral?', choices: c('180°', '360°', '540°'), correctIndex: 1 },
  { id: 'm06', difficulty: 'M', prompt: 'Equilateral triangle with side 6, perimeter…', choices: c('12', '18', '24'), correctIndex: 1 },
  { id: 'm07', difficulty: 'M', prompt: 'Right triangle with legs 5 and 12, hypotenuse…', choices: c('13', '15', '17'), correctIndex: 0 },
  { id: 'm08', difficulty: 'M', prompt: 'Sum of interior angles of a pentagon?', choices: c('360°', '540°', '720°'), correctIndex: 1 },
  { id: 'm09', difficulty: 'M', prompt: 'Circle area with radius 4 (π ≈ 3.14)…', choices: c('12.56', '25.12', '50.24'), correctIndex: 2 },
  { id: 'm10', difficulty: 'M', prompt: 'Diagonal of a unit square…', choices: c('1', '√2', '2'), correctIndex: 1 },
  { id: 'm11', difficulty: 'M', prompt: 'Triangle base 8, height 4, area…', choices: c('12', '16', '32'), correctIndex: 1 },
  { id: 'm12', difficulty: 'M', prompt: 'Volume of a cube with side 3?', choices: c('9', '18', '27'), correctIndex: 2 },
  { id: 'm13', difficulty: 'M', prompt: 'Sum of interior angles of a hexagon?', choices: c('540°', '720°', '900°'), correctIndex: 1 },
  { id: 'm14', difficulty: 'M', prompt: 'Trapezoid parallel sides 5, 7, height 4. Area…', choices: c('24', '32', '48'), correctIndex: 0 },
  { id: 'm15', difficulty: 'M', prompt: 'A triangle has angles 90° and 30°. The third angle is…', choices: c('60°', '90°', '120°'), correctIndex: 0 },
];

const POOL_A: readonly Problem[] = [
  { id: 'a01', difficulty: 'A', prompt: 'Sphere volume, radius 3 (π ≈ 3.14)…', choices: c('37.68', '113.04', '148.0'), correctIndex: 1 },
  { id: 'a02', difficulty: 'A', prompt: 'Triangle with sides 6, 8, 10. Area…', choices: c('24', '30', '48'), correctIndex: 0 },
  { id: 'a03', difficulty: 'A', prompt: 'Cylinder radius 2, height 5. Volume (π ≈ 3.14)…', choices: c('31.4', '62.8', '125.6'), correctIndex: 1 },
  { id: 'a04', difficulty: 'A', prompt: 'Cone radius 3, height 4. Volume (π ≈ 3.14)…', choices: c('37.68', '75.36', '113.04'), correctIndex: 0 },
  { id: 'a05', difficulty: 'A', prompt: 'Surface area of a cube with side 4?', choices: c('24', '64', '96'), correctIndex: 2 },
  { id: 'a06', difficulty: 'A', prompt: 'Distance between (1, 2) and (4, 6)?', choices: c('4', '5', '7'), correctIndex: 1 },
  { id: 'a07', difficulty: 'A', prompt: 'Regular hexagon with side 6, area ≈…', choices: c('62.4', '93.5', '108'), correctIndex: 1 },
  { id: 'a08', difficulty: 'A', prompt: 'Pyramid: square base side 6, height 10. Volume…', choices: c('60', '120', '180'), correctIndex: 1 },
  { id: 'a09', difficulty: 'A', prompt: 'Sphere with diameter 6. Surface area (π ≈ 3.14)…', choices: c('37.68', '113.04', '452.16'), correctIndex: 1 },
  { id: 'a10', difficulty: 'A', prompt: 'Triangle, sides 5 and 7 with a 90° angle between. Area…', choices: c('17.5', '25', '35'), correctIndex: 0 },
  { id: 'a11', difficulty: 'A', prompt: 'Volume of a 3 × 4 × 5 rectangular prism?', choices: c('12', '60', '120'), correctIndex: 1 },
  { id: 'a12', difficulty: 'A', prompt: 'Triangle sides 7, 8, 9. Area ≈ (Heron’s formula)…', choices: c('21', '27', '36'), correctIndex: 1 },
  { id: 'a13', difficulty: 'A', prompt: 'Circle inscribed in square of side 8. Area of circle (π ≈ 3.14)…', choices: c('12.56', '50.24', '200.96'), correctIndex: 1 },
  { id: 'a14', difficulty: 'A', prompt: 'Cuboid 4 × 6 × 8. Surface area…', choices: c('96', '192', '208'), correctIndex: 2 },
  { id: 'a15', difficulty: 'A', prompt: 'Equilateral triangle with side 4. Area ≈…', choices: c('≈ 4', '≈ 7', '≈ 14'), correctIndex: 1 },
];

const POOL_BY_DIFFICULTY: Readonly<Record<GateDifficulty, readonly Problem[]>> = {
  B: POOL_B,
  M: POOL_M,
  A: POOL_A,
};

/**
 * Returns a Problem at the requested difficulty. The rng input is consumed
 * by a single uniform draw; the caller is expected to thread the resulting
 * seed for determinism (see problem-gates/augmentRowWithGates).
 *
 * The function is pure: same inputs → same output. Throws (developer-time
 * guard, not a runtime situation) if a difficulty pool is somehow empty.
 */
export function selectPlaceholderProblem(
  difficulty: GateDifficulty,
  uniform01: number,
): Problem {
  const pool = POOL_BY_DIFFICULTY[difficulty];
  if (pool.length === 0) {
    throw new Error(`No problems available for difficulty: ${difficulty}`);
  }
  const idx = Math.min(pool.length - 1, Math.floor(uniform01 * pool.length));
  return pool[idx]!;
}

export type { AnswerChoice, Problem } from '../shared/types';
