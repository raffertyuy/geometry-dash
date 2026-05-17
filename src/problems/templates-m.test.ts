import { describe, expect, it } from 'vitest';
import { PROBLEM_TEMPLATES_M } from './templates-m';
import type { Problem } from '../shared/types';

const ALL_SEEDS_RANGE = 1000;

function parseFloatLoose(s: string): number {
  // Accepts "12", "12.5", "12√2", "-3" etc. Returns NaN if not parseable.
  const m = s.match(/^(-?\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]!) : NaN;
}

function parseSqrtLiteral(s: string): { coef: number; radicand: number } | null {
  // Matches "N√M" or "N√M.M" or just "√M". Returns { coef, radicand }.
  const m = s.match(/^(-?\d+(?:\.\d+)?)?√(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const coef = m[1] === undefined || m[1] === '' ? 1 : parseFloat(m[1]);
  const radicand = parseFloat(m[2]!);
  return { coef, radicand };
}

// ---- Structural invariants common to every template -------------------

describe('PROBLEM_TEMPLATES_M structural invariants', () => {
  it(`contains at least 12 templates (got ${PROBLEM_TEMPLATES_M.length})`, () => {
    expect(PROBLEM_TEMPLATES_M.length).toBeGreaterThanOrEqual(12);
  });

  it('every template has a unique id', () => {
    const ids = new Set(PROBLEM_TEMPLATES_M.map((t) => t.id));
    expect(ids.size).toBe(PROBLEM_TEMPLATES_M.length);
  });

  it('every template declares difficulty M', () => {
    for (const t of PROBLEM_TEMPLATES_M) {
      expect(t.difficulty).toBe('M');
    }
  });

  it('every template generate() is deterministic (same seed → same Problem)', () => {
    for (const t of PROBLEM_TEMPLATES_M) {
      for (let seed = 1; seed <= 5; seed++) {
        const a = t.generate(seed).problem;
        const b = t.generate(seed).problem;
        expect(a.prompt).toBe(b.prompt);
        expect(a.choices.map((c) => c.text)).toEqual(
          b.choices.map((c) => c.text),
        );
        expect(a.correctIndex).toBe(b.correctIndex);
      }
    }
  });

  it(`every template produces a valid Problem across ${ALL_SEEDS_RANGE} seeds`, () => {
    const failures: string[] = [];
    for (const t of PROBLEM_TEMPLATES_M) {
      for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
        const { problem } = t.generate(seed);
        expect(problem.difficulty).toBe('M');
        expect(problem.prompt.length).toBeGreaterThan(0);
        expect(problem.choices.length).toBe(3);
        expect([0, 1, 2]).toContain(problem.correctIndex);
        for (const ch of problem.choices) {
          expect(ch.text.length).toBeGreaterThan(0);
        }
        // Pairwise-distinct choice texts.
        const texts = problem.choices.map((c) => c.text);
        if (new Set(texts).size !== 3) {
          failures.push(
            `${t.id} seed=${seed} prompt="${problem.prompt}" choices=[${texts.join('|')}]`,
          );
        }
      }
    }
    if (failures.length > 0) {
      throw new Error(`Duplicate choices in ${failures.length} cases:\n${failures.slice(0, 5).join('\n')}`);
    }
  });
});

// ---- Independent-formula verification per template -------------------
//
// For each template we parse the prompt back to its parameters, compute
// the expected correct answer using an INDEPENDENT formula (Math.hypot,
// Math.sqrt, etc.), and assert it matches the text the template marked
// as correct. This catches: wrong formula in the template, wrong
// implementation, distractor accidentally becoming correct.

function correctText(p: Problem): string {
  return p.choices[p.correctIndex]!.text;
}

describe('m-pythagoras-hypotenuse: correct = √(a²+b²)', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-pythagoras-hypotenuse')!;
  it('matches Math.hypot for every seed in [0,1000)', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/legs (\d+) and (\d+)/);
      expect(m).not.toBeNull();
      const a = parseInt(m![1]!, 10);
      const b = parseInt(m![2]!, 10);
      const expected = Math.hypot(a, b);
      const actual = parseFloat(correctText(problem));
      expect(actual).toBeCloseTo(expected, 5);
    }
  });
});

describe('m-square-perimeter: correct = 4·s', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-square-perimeter')!;
  it('matches 4·s', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/side (\d+)/);
      expect(m).not.toBeNull();
      const s = parseInt(m![1]!, 10);
      expect(parseFloat(correctText(problem))).toBe(4 * s);
    }
  });
});

describe('m-square-area: correct = s²', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-square-area')!;
  it('matches s²', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/side (\d+)/);
      const s = parseInt(m![1]!, 10);
      expect(parseFloat(correctText(problem))).toBe(s * s);
    }
  });
});

describe('m-rectangle-perimeter: correct = 2(w+h)', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-rectangle-perimeter')!;
  it('matches 2(w+h)', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/width (\d+) and height (\d+)/);
      const w = parseInt(m![1]!, 10);
      const h = parseInt(m![2]!, 10);
      expect(parseFloat(correctText(problem))).toBe(2 * (w + h));
    }
  });
});

describe('m-rectangle-area: correct = w·h', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-rectangle-area')!;
  it('matches w·h', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/width (\d+) and height (\d+)/);
      const w = parseInt(m![1]!, 10);
      const h = parseInt(m![2]!, 10);
      expect(parseFloat(correctText(problem))).toBe(w * h);
    }
  });
});

describe('m-triangle-area-bh: correct = b·h/2', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-triangle-area-bh')!;
  it('matches b·h/2', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/base (\d+) and height (\d+)/);
      const b = parseInt(m![1]!, 10);
      const h = parseInt(m![2]!, 10);
      expect(parseFloat(correctText(problem))).toBe((b * h) / 2);
    }
  });
});

describe('m-circle-area: correct ≈ π·r² (π=3.14)', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-circle-area')!;
  it('matches 3.14·r²', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/radius (\d+)/);
      const r = parseInt(m![1]!, 10);
      expect(parseFloat(correctText(problem))).toBeCloseTo(3.14 * r * r, 5);
    }
  });
});

describe('m-circle-circumference: correct ≈ 2·π·r', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-circle-circumference')!;
  it('matches 2·3.14·r', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/radius (\d+)/);
      const r = parseInt(m![1]!, 10);
      expect(parseFloat(correctText(problem))).toBeCloseTo(2 * 3.14 * r, 5);
    }
  });
});

describe('m-polygon-interior-angle-sum: correct = (n−2)·180', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-polygon-interior-angle-sum')!;
  it('matches (n−2)·180°', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/(\d+)-sided polygon/);
      const n = parseInt(m![1]!, 10);
      const expected = (n - 2) * 180;
      // Correct answer is "Xdeg" or "X°" — parse the numeric portion.
      expect(parseFloat(correctText(problem))).toBe(expected);
    }
  });
});

describe('m-cube-volume: correct = s³', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-cube-volume')!;
  it('matches s³', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/side (\d+)/);
      const s = parseInt(m![1]!, 10);
      expect(parseFloat(correctText(problem))).toBe(s * s * s);
    }
  });
});

describe('m-cube-surface-area: correct = 6·s²', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-cube-surface-area')!;
  it('matches 6·s²', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/side (\d+)/);
      const s = parseInt(m![1]!, 10);
      expect(parseFloat(correctText(problem))).toBe(6 * s * s);
    }
  });
});

describe('m-trapezoid-area: correct = (a+b)·h/2', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-trapezoid-area')!;
  it('matches (a+b)·h/2', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/sides (\d+) and (\d+), height (\d+)/);
      const a = parseInt(m![1]!, 10);
      const b = parseInt(m![2]!, 10);
      const h = parseInt(m![3]!, 10);
      expect(parseFloat(correctText(problem))).toBe(((a + b) * h) / 2);
    }
  });
});

describe('m-equilateral-perimeter: correct = 3·s', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-equilateral-perimeter')!;
  it('matches 3·s', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/side (\d+)/);
      const s = parseInt(m![1]!, 10);
      expect(parseFloat(correctText(problem))).toBe(3 * s);
    }
  });
});

describe('m-isosceles-right-hypotenuse: correct = leg·√2', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-isosceles-right-hypotenuse')!;
  it('correct text is in the form "N√2"', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/legs (\d+)/);
      const leg = parseInt(m![1]!, 10);
      const parsed = parseSqrtLiteral(correctText(problem));
      expect(parsed).not.toBeNull();
      expect(parsed!.coef).toBe(leg);
      expect(parsed!.radicand).toBe(2);
    }
  });
});

describe('m-rect-prism-volume: correct = l·w·h', () => {
  const t = PROBLEM_TEMPLATES_M.find((x) => x.id === 'm-rect-prism-volume')!;
  it('matches l·w·h', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/prism (\d+) × (\d+) × (\d+)/);
      const l = parseInt(m![1]!, 10);
      const w = parseInt(m![2]!, 10);
      const h = parseInt(m![3]!, 10);
      expect(parseFloat(correctText(problem))).toBe(l * w * h);
    }
  });
});

// Silence unused warning for parseFloatLoose (kept for future use).
void parseFloatLoose;
