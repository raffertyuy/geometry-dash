import { describe, expect, it } from 'vitest';
import { PROBLEM_TEMPLATES_A } from './templates-a';
import type { Problem } from '../shared/types';

const ALL_SEEDS_RANGE = 1000;
const PI = 3.14;

function correctText(p: Problem): string {
  return p.choices[p.correctIndex]!.text;
}

// ---- Structural invariants ---------------------------------------------

describe('PROBLEM_TEMPLATES_A structural invariants', () => {
  it(`contains at least 10 templates (got ${PROBLEM_TEMPLATES_A.length})`, () => {
    expect(PROBLEM_TEMPLATES_A.length).toBeGreaterThanOrEqual(10);
  });

  it('every template has a unique id', () => {
    const ids = new Set(PROBLEM_TEMPLATES_A.map((t) => t.id));
    expect(ids.size).toBe(PROBLEM_TEMPLATES_A.length);
  });

  it('every template declares difficulty A', () => {
    for (const t of PROBLEM_TEMPLATES_A) {
      expect(t.difficulty).toBe('A');
    }
  });

  it('every template generate() is deterministic', () => {
    for (const t of PROBLEM_TEMPLATES_A) {
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
    for (const t of PROBLEM_TEMPLATES_A) {
      for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
        const { problem } = t.generate(seed);
        expect(problem.difficulty).toBe('A');
        expect(problem.prompt.length).toBeGreaterThan(0);
        expect(problem.choices.length).toBe(3);
        expect([0, 1, 2]).toContain(problem.correctIndex);
        for (const ch of problem.choices) {
          expect(ch.text.length).toBeGreaterThan(0);
        }
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

// ---- Independent-formula verification per template --------------------

describe('a-sphere-volume: correct = (4/3)·π·r³', () => {
  const t = PROBLEM_TEMPLATES_A.find((x) => x.id === 'a-sphere-volume')!;
  it('matches (4/3)·π·r³', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/radius (\d+)/);
      const r = parseInt(m![1]!, 10);
      const expected = (4 / 3) * PI * r * r * r;
      expect(parseFloat(correctText(problem))).toBeCloseTo(expected, 1);
    }
  });
});

describe('a-sphere-surface-area: correct = 4·π·r²', () => {
  const t = PROBLEM_TEMPLATES_A.find((x) => x.id === 'a-sphere-surface-area')!;
  it('matches 4·π·r²', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/radius (\d+)/);
      const r = parseInt(m![1]!, 10);
      expect(parseFloat(correctText(problem))).toBeCloseTo(4 * PI * r * r, 1);
    }
  });
});

describe('a-cylinder-volume: correct = π·r²·h', () => {
  const t = PROBLEM_TEMPLATES_A.find((x) => x.id === 'a-cylinder-volume')!;
  it('matches π·r²·h', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/radius (\d+), height (\d+)/);
      const r = parseInt(m![1]!, 10);
      const h = parseInt(m![2]!, 10);
      expect(parseFloat(correctText(problem))).toBeCloseTo(PI * r * r * h, 1);
    }
  });
});

describe('a-cylinder-surface-area: correct = 2π·r² + 2π·r·h', () => {
  const t = PROBLEM_TEMPLATES_A.find((x) => x.id === 'a-cylinder-surface-area')!;
  it('matches 2π·r² + 2π·r·h', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/radius (\d+), height (\d+)/);
      const r = parseInt(m![1]!, 10);
      const h = parseInt(m![2]!, 10);
      const expected = 2 * PI * r * r + 2 * PI * r * h;
      expect(parseFloat(correctText(problem))).toBeCloseTo(expected, 1);
    }
  });
});

describe('a-cone-volume: correct = (1/3)·π·r²·h', () => {
  const t = PROBLEM_TEMPLATES_A.find((x) => x.id === 'a-cone-volume')!;
  it('matches (1/3)·π·r²·h', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/radius (\d+), height (\d+)/);
      const r = parseInt(m![1]!, 10);
      const h = parseInt(m![2]!, 10);
      expect(parseFloat(correctText(problem))).toBeCloseTo((1 / 3) * PI * r * r * h, 1);
    }
  });
});

describe('a-pyramid-volume: correct = a²·h/3', () => {
  const t = PROBLEM_TEMPLATES_A.find((x) => x.id === 'a-pyramid-volume')!;
  it('matches a²·h/3', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/base side (\d+), height (\d+)/);
      const a = parseInt(m![1]!, 10);
      const h = parseInt(m![2]!, 10);
      expect(parseFloat(correctText(problem))).toBeCloseTo((a * a * h) / 3, 1);
    }
  });
});

describe('a-heron-area: correct = √(s(s-a)(s-b)(s-c))', () => {
  const t = PROBLEM_TEMPLATES_A.find((x) => x.id === 'a-heron-area')!;
  it('matches Heron formula', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/sides (\d+), (\d+), (\d+)/);
      const a = parseInt(m![1]!, 10);
      const b = parseInt(m![2]!, 10);
      const c = parseInt(m![3]!, 10);
      const s = (a + b + c) / 2;
      const expected = Math.sqrt(s * (s - a) * (s - b) * (s - c));
      expect(parseFloat(correctText(problem))).toBeCloseTo(expected, 1);
    }
  });
});

describe('a-distance-formula: correct = √(dx²+dy²)', () => {
  const t = PROBLEM_TEMPLATES_A.find((x) => x.id === 'a-distance-formula')!;
  it('matches Math.hypot', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/\((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)/);
      const x1 = parseInt(m![1]!, 10);
      const y1 = parseInt(m![2]!, 10);
      const x2 = parseInt(m![3]!, 10);
      const y2 = parseInt(m![4]!, 10);
      const expected = Math.hypot(x2 - x1, y2 - y1);
      expect(parseFloat(correctText(problem))).toBeCloseTo(expected, 5);
    }
  });
});

describe('a-midpoint-formula: correct = ((x1+x2)/2, (y1+y2)/2)', () => {
  const t = PROBLEM_TEMPLATES_A.find((x) => x.id === 'a-midpoint-formula')!;
  it('correct text matches the midpoint formula string', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/\((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)/);
      const x1 = parseInt(m![1]!, 10);
      const y1 = parseInt(m![2]!, 10);
      const x2 = parseInt(m![3]!, 10);
      const y2 = parseInt(m![4]!, 10);
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      expect(correctText(problem)).toBe(`(${mx}, ${my})`);
    }
  });
});

describe('a-slope-formula: correct = (y2-y1)/(x2-x1)', () => {
  const t = PROBLEM_TEMPLATES_A.find((x) => x.id === 'a-slope-formula')!;
  it('matches dy/dx', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/\((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)/);
      const x1 = parseInt(m![1]!, 10);
      const y1 = parseInt(m![2]!, 10);
      const x2 = parseInt(m![3]!, 10);
      const y2 = parseInt(m![4]!, 10);
      const expected = (y2 - y1) / (x2 - x1);
      expect(parseFloat(correctText(problem))).toBeCloseTo(expected, 5);
    }
  });
});

describe('a-rect-prism-surface-area: correct = 2(lw+lh+wh)', () => {
  const t = PROBLEM_TEMPLATES_A.find((x) => x.id === 'a-rect-prism-surface-area')!;
  it('matches 2(lw+lh+wh)', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/prism (\d+) × (\d+) × (\d+)/);
      const l = parseInt(m![1]!, 10);
      const w = parseInt(m![2]!, 10);
      const h = parseInt(m![3]!, 10);
      const expected = 2 * (l * w + l * h + w * h);
      expect(parseFloat(correctText(problem))).toBe(expected);
    }
  });
});

describe('a-30-60-90-trig: short leg = hypotenuse/2', () => {
  const t = PROBLEM_TEMPLATES_A.find((x) => x.id === 'a-30-60-90-trig')!;
  it('matches h/2', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/hypotenuse is (\d+)/);
      const h = parseInt(m![1]!, 10);
      expect(parseFloat(correctText(problem))).toBeCloseTo(h / 2, 5);
    }
  });
});

describe('a-45-45-90-trig: hypotenuse = leg√2', () => {
  const t = PROBLEM_TEMPLATES_A.find((x) => x.id === 'a-45-45-90-trig')!;
  it('correct text matches "L√2" pattern', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/leg is (\d+)/);
      const leg = parseInt(m![1]!, 10);
      expect(correctText(problem)).toBe(`${leg}√2`);
    }
  });
});

describe('a-composite-rect-triangle: correct = w·h + w·t/2', () => {
  const t = PROBLEM_TEMPLATES_A.find((x) => x.id === 'a-composite-rect-triangle')!;
  it('matches w·h + w·t/2', () => {
    for (let seed = 0; seed < ALL_SEEDS_RANGE; seed++) {
      const { problem } = t.generate(seed);
      const m = problem.prompt.match(/(\d+) × (\d+) rectangle.*triangle height (\d+)/);
      const w = parseInt(m![1]!, 10);
      const h = parseInt(m![2]!, 10);
      const tt = parseInt(m![3]!, 10);
      const expected = w * h + (w * tt) / 2;
      expect(parseFloat(correctText(problem))).toBe(expected);
    }
  });
});
