import { describe, expect, it } from 'vitest';
import { POOL_B } from './pool-b';
import { PROBLEM_SOURCES } from './sources';

describe('POOL_B structural invariants', () => {
  it('contains at least 80 problems', () => {
    expect(POOL_B.length).toBeGreaterThanOrEqual(80);
  });

  it('every problem has difficulty "B"', () => {
    for (const p of POOL_B) {
      expect(p.difficulty).toBe('B');
    }
  });

  it('every problem has 3 choices', () => {
    for (const p of POOL_B) {
      expect(p.choices.length).toBe(3);
    }
  });

  it('every problem has correctIndex in {0, 1, 2}', () => {
    for (const p of POOL_B) {
      expect([0, 1, 2]).toContain(p.correctIndex);
    }
  });

  it('every problem has a non-empty prompt', () => {
    for (const p of POOL_B) {
      expect(p.prompt.length).toBeGreaterThan(0);
    }
  });

  it('every problem has 3 pairwise-distinct choice texts', () => {
    const failures: string[] = [];
    for (const p of POOL_B) {
      const set = new Set(p.choices.map((c) => c.text));
      if (set.size !== 3) {
        failures.push(`${p.id}: ${p.choices.map((c) => c.text).join(' | ')}`);
      }
      for (const c of p.choices) {
        expect(c.text.length).toBeGreaterThan(0);
      }
    }
    expect(failures).toEqual([]);
  });

  it('every problem id is unique', () => {
    const ids = new Set(POOL_B.map((p) => p.id));
    expect(ids.size).toBe(POOL_B.length);
  });

  it('every problem has a sourceRef that resolves in PROBLEM_SOURCES', () => {
    const validIds = new Set(PROBLEM_SOURCES.map((s) => s.id));
    const unresolved: string[] = [];
    for (const p of POOL_B) {
      expect(p.sourceRef).toBeDefined();
      if (!validIds.has(p.sourceRef!)) {
        unresolved.push(`${p.id} → ${p.sourceRef}`);
      }
    }
    expect(unresolved).toEqual([]);
  });
});

// Spot-check tests for specific known-correct answers. These act as a
// regression net: if a future edit accidentally changes one of these
// answers, the test fails.
describe('POOL_B spot checks (AI-verified known answers)', () => {
  function findById(id: string) {
    const p = POOL_B.find((q) => q.id === id);
    expect(p).toBeDefined();
    return p!;
  }
  function correctOf(id: string): string {
    const p = findById(id);
    return p.choices[p.correctIndex]!.text;
  }

  it('hexagon has 6 sides', () => {
    expect(correctOf('b-poly-hex-sides')).toBe('6');
  });

  it('octagon has 8 sides', () => {
    expect(correctOf('b-poly-oct-sides')).toBe('8');
  });

  it('cube has 6 faces, 8 vertices, 12 edges', () => {
    expect(correctOf('b-cube-faces')).toBe('6');
    expect(correctOf('b-cube-vertices')).toBe('8');
    expect(correctOf('b-cube-edges')).toBe('12');
  });

  it('tetrahedron has 4 faces, 4 vertices, 6 edges', () => {
    expect(correctOf('b-tetra-faces')).toBe('4');
    expect(correctOf('b-tetra-vertices')).toBe('4');
    expect(correctOf('b-tetra-edges')).toBe('6');
  });

  it('icosahedron has 20 faces and 12 vertices', () => {
    expect(correctOf('b-icos-faces')).toBe('20');
    expect(correctOf('b-icos-vertices')).toBe('12');
  });

  it('right angle = 90°, straight = 180°, full = 360°', () => {
    expect(correctOf('b-right-angle-deg')).toBe('90°');
    expect(correctOf('b-straight-angle-deg')).toBe('180°');
    expect(correctOf('b-full-rev-deg')).toBe('360°');
  });

  it('triangle interior angle sum = 180°', () => {
    expect(correctOf('b-tri-angle-sum')).toBe('180°');
  });

  it('pentagon interior angle sum = 540°', () => {
    expect(correctOf('b-pent-angle-sum')).toBe('540°');
  });

  it('equilateral triangle interior angle = 60°', () => {
    expect(correctOf('b-equilat-angle')).toBe('60°');
  });

  it('supplementary angles sum to 180°, complementary to 90°', () => {
    expect(correctOf('b-supplementary')).toBe('180°');
    expect(correctOf('b-complementary')).toBe('90°');
  });

  it('square has 4 lines of symmetry; circle has infinite', () => {
    expect(correctOf('b-sym-square')).toBe('4');
    expect(correctOf('b-sym-circle')).toBe('Infinite');
  });

  it('parallel lines never intersect; perpendicular at 90°', () => {
    expect(correctOf('b-parallel-lines')).toBe('Never intersect');
    expect(correctOf('b-perpendicular-lines')).toBe('90°');
  });
});
