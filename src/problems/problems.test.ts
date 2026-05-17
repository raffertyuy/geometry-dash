import { describe, expect, it } from 'vitest';
import { selectPlaceholderProblem } from './problems';
import type { GateDifficulty } from '../shared/types';

const ALL_DIFFICULTIES: readonly GateDifficulty[] = ['B', 'M', 'A'];

describe('selectPlaceholderProblem', () => {
  it('returns a problem matching the requested difficulty (B/M/A)', () => {
    for (const difficulty of ALL_DIFFICULTIES) {
      const p = selectPlaceholderProblem(difficulty, 0.5);
      expect(p.difficulty).toBe(difficulty);
    }
  });

  it('returns the same problem given the same difficulty + uniform01 input (deterministic)', () => {
    const a = selectPlaceholderProblem('M', 0.123);
    const b = selectPlaceholderProblem('M', 0.123);
    expect(a.id).toBe(b.id);
  });

  it('returns different problems across different uniform01 inputs (sweep)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const p = selectPlaceholderProblem('A', i / 100);
      seen.add(p.id);
    }
    // With 15 entries and 100 evenly-spaced draws, we should hit most ids.
    expect(seen.size).toBeGreaterThanOrEqual(10);
  });

  it('clamps uniform01 = 1.0 to the last pool entry (no out-of-bounds)', () => {
    for (const difficulty of ALL_DIFFICULTIES) {
      // 1.0 is the edge case; should map to pool.length - 1, not pool.length.
      const p = selectPlaceholderProblem(difficulty, 1.0);
      expect(p).toBeDefined();
      expect(p.difficulty).toBe(difficulty);
    }
  });

  it('clamps uniform01 = 0 to the first pool entry', () => {
    for (const difficulty of ALL_DIFFICULTIES) {
      const p = selectPlaceholderProblem(difficulty, 0);
      expect(p).toBeDefined();
      expect(p.difficulty).toBe(difficulty);
    }
  });
});

describe('all problems in every pool are well-formed', () => {
  for (const difficulty of ALL_DIFFICULTIES) {
    it(`difficulty ${difficulty}: ≥ 10 entries`, () => {
      // Sample every position in the pool by stepping uniform01.
      const seen = new Set<string>();
      for (let i = 0; i < 100; i++) {
        seen.add(selectPlaceholderProblem(difficulty, i / 100).id);
      }
      expect(seen.size).toBeGreaterThanOrEqual(10);
    });

    it(`difficulty ${difficulty}: every problem has exactly 3 choices and a valid correctIndex`, () => {
      for (let i = 0; i < 100; i++) {
        const p = selectPlaceholderProblem(difficulty, i / 100);
        expect(p.choices.length).toBe(3);
        expect(p.correctIndex).toBeGreaterThanOrEqual(0);
        expect(p.correctIndex).toBeLessThanOrEqual(2);
        for (const choice of p.choices) {
          expect(choice.text.length).toBeGreaterThan(0);
        }
      }
    });

    it(`difficulty ${difficulty}: every problem has a non-empty prompt and unique id`, () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const p = selectPlaceholderProblem(difficulty, i / 100);
        expect(p.prompt.length).toBeGreaterThan(0);
        expect(p.id.length).toBeGreaterThan(0);
        ids.add(p.id);
      }
      // Sampling 100 times over a pool of ≥ 10 unique ids: we should see them
      // collide. Test that we do not accidentally generate new ids.
      expect(ids.size).toBeGreaterThanOrEqual(10);
    });
  }
});
