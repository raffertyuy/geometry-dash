import type { AnswerChoice, Problem } from '../shared/types';

/**
 * Shape of a Medium / Advanced problem template. Each template is a pure
 * generator from a seed to a Problem + the advanced seed. Same seed →
 * same Problem (deterministic, per spec FR-004).
 */
export interface Template {
  readonly id: string;
  readonly difficulty: 'M' | 'A';
  generate(seed: number): { problem: Problem; nextSeed: number };
}

/**
 * mulberry32 single-step PRNG. Same algorithm and threading convention as
 * problem-gates.ts. Each draw advances the seed; templates thread the
 * resulting seed through multiple draws to produce deterministic output.
 */
export function mulberry32(seed: number): { value: number; nextSeed: number } {
  const s = (seed + 0x6d2b79f5) | 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return {
    value: ((t ^ (t >>> 14)) >>> 0) / 4294967296,
    nextSeed: s,
  };
}

/** Pick one item from a list using a uniform-01 value. */
export function pickOne<T>(items: readonly T[], r: number): T {
  return items[Math.min(items.length - 1, Math.floor(r * items.length))]!;
}

/** Pick an integer from [lo, hi] inclusive using a uniform-01 value. */
export function pickInt(lo: number, hi: number, r: number): number {
  return Math.min(hi, lo + Math.floor(r * (hi - lo + 1)));
}

/**
 * Build a Problem with three answer choices. The correct answer is placed
 * at a seed-derived index; distractors fill the other slots. Caller
 * guarantees the three texts are pairwise-distinct (if any collide, the
 * template should re-pick before calling). Returns the built Problem +
 * the advanced seed.
 */
export function buildProblem(
  id: string,
  difficulty: 'M' | 'A',
  prompt: string,
  correctText: string,
  distractor1: string,
  distractor2: string,
  seed: number,
  figure?: string,
): { problem: Problem; nextSeed: number } {
  const r = mulberry32(seed);
  const correctIndex = (Math.min(2, Math.floor(r.value * 3))) as 0 | 1 | 2;
  const choices: [AnswerChoice, AnswerChoice, AnswerChoice] = [
    { text: '' },
    { text: '' },
    { text: '' },
  ];
  choices[correctIndex] = { text: correctText };
  const others = ([0, 1, 2] as const).filter((i) => i !== correctIndex);
  choices[others[0]!] = { text: distractor1 };
  choices[others[1]!] = { text: distractor2 };

  const problem: Problem = figure
    ? { id, difficulty, prompt, choices, correctIndex, figure }
    : { id, difficulty, prompt, choices, correctIndex };

  return { problem, nextSeed: r.nextSeed };
}

/**
 * True if any two of the three texts are equal. Templates should re-pick
 * before calling buildProblem if this returns true.
 */
export function hasDuplicateChoices(
  a: string,
  b: string,
  c: string,
): boolean {
  return a === b || a === c || b === c;
}
