import type { Problem } from '../shared/types';

/**
 * Hand-curated Basic-difficulty problems. Each entry's answer has been
 * AI-verified for geometric correctness; the distractors are plausible
 * student errors (neighboring integers, common-confusion swaps such as
 * faces ↔ vertices ↔ edges, or formula-swap errors).
 *
 * Source attribution lives in `sources.ts` (PROBLEM_SOURCES); each
 * problem's `sourceRef` matches one of those ids. `LICENSES.md` at the
 * repo root carries the required CC-BY 4.0 attribution lines.
 */

function b(
  id: string,
  prompt: string,
  c0: string,
  c1: string,
  c2: string,
  correctIndex: 0 | 1 | 2,
  sourceRef: string,
): Problem {
  return {
    id,
    difficulty: 'B',
    prompt,
    choices: [{ text: c0 }, { text: c1 }, { text: c2 }] as const,
    correctIndex,
    sourceRef,
  };
}

const OS = 'openstax-cm-ch10';
const IM = 'illustrative-math-k8';

export const POOL_B: readonly Problem[] = [
  // --- Polygon side counts -------------------------------------------------
  b('b-poly-tri-sides', 'How many sides does a triangle have?', '2', '3', '4', 1, OS),
  b('b-poly-quad-sides', 'How many sides does a quadrilateral have?', '3', '4', '5', 1, OS),
  b('b-poly-pent-sides', 'How many sides does a pentagon have?', '4', '5', '6', 1, OS),
  b('b-poly-hex-sides', 'How many sides does a hexagon have?', '5', '6', '7', 1, OS),
  b('b-poly-hept-sides', 'How many sides does a heptagon have?', '6', '7', '8', 1, OS),
  b('b-poly-oct-sides', 'How many sides does an octagon have?', '7', '8', '9', 1, OS),
  b('b-poly-non-sides', 'How many sides does a nonagon have?', '8', '9', '10', 1, OS),
  b('b-poly-dec-sides', 'How many sides does a decagon have?', '9', '10', '11', 1, OS),
  b('b-poly-dodec-sides', 'How many sides does a dodecagon have?', '10', '12', '14', 1, OS),

  // --- 3D solid counts ----------------------------------------------------
  b('b-cube-faces', 'How many faces does a cube have?', '4', '6', '8', 1, OS),
  b('b-cube-vertices', 'How many vertices does a cube have?', '6', '8', '12', 1, OS),
  b('b-cube-edges', 'How many edges does a cube have?', '8', '12', '24', 1, OS),
  b('b-tetra-faces', 'How many faces does a tetrahedron have?', '4', '6', '8', 0, OS),
  b('b-tetra-vertices', 'How many vertices does a tetrahedron have?', '3', '4', '6', 1, OS),
  b('b-tetra-edges', 'How many edges does a tetrahedron have?', '4', '6', '8', 1, OS),
  b('b-octa-faces', 'How many faces does an octahedron have?', '6', '8', '12', 1, OS),
  b('b-octa-vertices', 'How many vertices does an octahedron have?', '6', '8', '12', 0, OS),
  b('b-octa-edges', 'How many edges does an octahedron have?', '8', '10', '12', 2, OS),
  b('b-dodec-faces', 'How many faces does a dodecahedron have?', '8', '12', '20', 1, OS),
  b('b-dodec-vertices', 'How many vertices does a dodecahedron have?', '12', '20', '30', 1, OS),
  b('b-icos-faces', 'How many faces does an icosahedron have?', '12', '20', '30', 1, OS),
  b('b-icos-vertices', 'How many vertices does an icosahedron have?', '12', '20', '30', 0, OS),
  b('b-sq-pyramid-faces', 'How many faces does a square-based pyramid have?', '4', '5', '6', 1, OS),
  b('b-sq-pyramid-vertices', 'How many vertices does a square-based pyramid have?', '4', '5', '8', 1, OS),
  b('b-tri-prism-faces', 'How many faces does a triangular prism have?', '4', '5', '6', 1, OS),
  b('b-tri-prism-vertices', 'How many vertices does a triangular prism have?', '5', '6', '9', 1, OS),
  b('b-tri-prism-edges', 'How many edges does a triangular prism have?', '6', '9', '12', 1, OS),
  b('b-cone-vertices', 'How many vertices does a cone have? (the apex)', '0', '1', '2', 1, OS),
  b('b-cylinder-flat-faces', 'How many flat faces does a cylinder have?', '0', '2', '3', 1, OS),
  b('b-sphere-vertices', 'How many vertices does a sphere have?', '0', '1', '2', 0, OS),
  b('b-hex-pyramid-vertices', 'How many vertices does a hexagonal pyramid have?', '6', '7', '12', 1, OS),

  // --- Angle facts --------------------------------------------------------
  b('b-right-angle-deg', 'A right angle measures how many degrees?', '45°', '90°', '180°', 1, OS),
  b('b-straight-angle-deg', 'A straight angle measures how many degrees?', '90°', '180°', '360°', 1, OS),
  b('b-full-rev-deg', 'A full revolution is how many degrees?', '180°', '270°', '360°', 2, OS),
  b('b-tri-angle-sum', 'Sum of the interior angles of a triangle?', '90°', '180°', '360°', 1, OS),
  b('b-quad-angle-sum', 'Sum of the interior angles of a quadrilateral?', '180°', '270°', '360°', 2, OS),
  b('b-pent-angle-sum', 'Sum of the interior angles of a pentagon?', '360°', '540°', '720°', 1, OS),
  b('b-hex-angle-sum', 'Sum of the interior angles of a hexagon?', '540°', '720°', '900°', 1, OS),
  b('b-equilat-angle', 'Each interior angle of an equilateral triangle?', '45°', '60°', '90°', 1, OS),
  b('b-square-angle', 'Each interior angle of a square?', '60°', '90°', '120°', 1, OS),
  b('b-supplementary', 'Two angles are supplementary when their sum is…', '90°', '180°', '360°', 1, OS),
  b('b-complementary', 'Two angles are complementary when their sum is…', '45°', '90°', '180°', 1, OS),
  b('b-vertical-angles', 'Vertical angles are…', 'Always equal', 'Always supplementary', 'Always 90°', 0, IM),

  // --- Triangle subtypes --------------------------------------------------
  b('b-tri-3-equal-sides', 'A triangle with 3 equal sides is called…', 'Scalene', 'Isosceles', 'Equilateral', 2, IM),
  b('b-tri-2-equal-sides', 'A triangle with exactly 2 equal sides is called…', 'Equilateral', 'Isosceles', 'Scalene', 1, IM),
  b('b-tri-3-diff-sides', 'A triangle with 3 different side lengths is called…', 'Equilateral', 'Isosceles', 'Scalene', 2, IM),
  b('b-tri-one-90', 'A triangle with one 90° angle is called…', 'Acute', 'Obtuse', 'Right', 2, IM),
  b('b-tri-all-acute', 'A triangle where all angles are less than 90° is called…', 'Acute', 'Obtuse', 'Right', 0, IM),
  b('b-tri-one-obtuse', 'A triangle with one angle greater than 90° is called…', 'Acute', 'Obtuse', 'Right', 1, IM),

  // --- Quadrilateral subtypes ---------------------------------------------
  b('b-quad-4-eq-90', 'A quadrilateral with 4 equal sides AND 4 right angles is a…', 'Rhombus', 'Rectangle', 'Square', 2, IM),
  b('b-quad-rectangle', 'A quadrilateral with 4 right angles and opposite sides equal is a…', 'Rhombus', 'Trapezoid', 'Rectangle', 2, IM),
  b('b-quad-rhombus', 'A quadrilateral with 4 equal sides (but not necessarily right angles) is a…', 'Square', 'Rhombus', 'Trapezoid', 1, IM),
  b('b-quad-trapezoid', 'A quadrilateral with exactly one pair of parallel sides is a…', 'Parallelogram', 'Trapezoid', 'Rhombus', 1, IM),
  b('b-quad-parallelogram', 'A quadrilateral with two pairs of parallel sides is a…', 'Trapezoid', 'Kite', 'Parallelogram', 2, IM),
  b('b-quad-kite', 'A quadrilateral with two pairs of adjacent equal sides is a…', 'Kite', 'Trapezoid', 'Parallelogram', 0, IM),

  // --- Circle terminology -------------------------------------------------
  b('b-circle-diameter', 'The diameter of a circle equals…', 'Half the radius', 'Twice the radius', 'The circumference', 1, OS),
  b('b-circle-radius', 'The radius of a circle is a line segment from…', 'Two points on the edge', 'The center to the edge', 'Touches the edge once', 1, OS),
  b('b-circle-chord', 'A chord of a circle is a line segment that…', 'Connects two points on the circle', 'Goes from the center to the edge', 'Touches the circle at one point', 0, OS),
  b('b-circle-tangent', 'A tangent to a circle is a line that…', 'Connects two points on the circle', 'Passes through the center', 'Touches the circle at exactly one point', 2, OS),
  b('b-circle-arc', 'An arc of a circle is…', 'A portion of the circumference', 'The diameter', 'A straight chord', 0, OS),
  b('b-circle-sector', 'A sector of a circle looks like a…', 'Straight line', 'Pie slice', 'Square corner', 1, OS),
  b('b-circle-circumference', 'The distance around a circle is called the…', 'Diameter', 'Radius', 'Circumference', 2, OS),
  b('b-circle-center', 'In a circle, every point on the edge is equidistant from the…', 'Diameter', 'Center', 'Tangent', 1, OS),
  b('b-circle-degrees', 'How many degrees in a full circle?', '180°', '270°', '360°', 2, OS),

  // --- Lines --------------------------------------------------------------
  b('b-parallel-lines', 'Parallel lines…', 'Intersect at right angles', 'Never intersect', 'Always cross at the origin', 1, OS),
  b('b-perpendicular-lines', 'Perpendicular lines intersect at…', '45°', '60°', '90°', 2, OS),
  b('b-line-segment', 'A line segment has…', 'No endpoints', 'One endpoint', 'Two endpoints', 2, OS),
  b('b-ray', 'A ray has…', 'No endpoints', 'One endpoint', 'Two endpoints', 1, OS),
  b('b-transversal', 'A transversal is a line that…', 'Bisects a triangle', 'Crosses two or more other lines', 'Has no endpoints', 1, OS),

  // --- 2D vs 3D -----------------------------------------------------------
  b('b-2d-polygon', 'A polygon is a…', '2D shape', '3D shape', 'Curve', 0, IM),
  b('b-3d-polyhedron', 'A polyhedron is a…', '2D shape', '3D shape', 'Type of angle', 1, IM),
  b('b-cube-classification', 'A cube is a…', 'Polygon', 'Polyhedron', 'Plane figure', 1, IM),
  b('b-triangle-classification', 'A triangle is a…', 'Polygon', 'Polyhedron', '3D solid', 0, IM),
  b('b-area-vs-volume', 'Area is measured for which kind of figure?', '1D', '2D', '3D', 1, IM),
  b('b-volume-3d', 'Volume is measured for which kind of figure?', '1D', '2D', '3D', 2, IM),

  // --- Lines of symmetry --------------------------------------------------
  b('b-sym-square', 'How many lines of symmetry does a square have?', '2', '4', '8', 1, IM),
  b('b-sym-equilat', 'How many lines of symmetry does an equilateral triangle have?', '1', '3', '6', 1, IM),
  b('b-sym-rectangle', 'How many lines of symmetry does a non-square rectangle have?', '0', '2', '4', 1, IM),
  b('b-sym-circle', 'How many lines of symmetry does a circle have?', '0', '4', 'Infinite', 2, IM),
  b('b-sym-reg-hex', 'How many lines of symmetry does a regular hexagon have?', '3', '6', '12', 1, IM),
  b('b-sym-isosceles', 'How many lines of symmetry does an isosceles (non-equilateral) triangle have?', '0', '1', '3', 1, IM),

  // --- Misc terminology --------------------------------------------------
  b('b-regular-polygon', 'A regular polygon has…', 'All sides equal but angles vary', 'All angles equal but sides vary', 'All sides AND all angles equal', 2, IM),
  b('b-square-classification', 'A square is also a…', 'Triangle', 'Rectangle', 'Pentagon', 1, IM),
  b('b-equilat-also', 'An equilateral triangle is also…', 'Scalene', 'A right triangle', 'Isosceles', 2, IM),
];
