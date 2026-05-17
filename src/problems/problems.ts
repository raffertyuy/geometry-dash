import type { GateDifficulty, Problem } from '../shared/types';
import { POOL_B } from './pool-b';
import { PROBLEM_TEMPLATES_M } from './templates-m';
import { PROBLEM_TEMPLATES_A } from './templates-a';

/**
 * Slice-006 dispatch: replaces the inline placeholder pools from slice 005
 * with real content. Basic difficulty indexes into the hand-curated
 * `POOL_B`; Medium and Advanced pick a template at random from the
 * appropriate family and call its deterministic `generate(seed)` function.
 * Public surface unchanged from slice 005 — same `selectPlaceholderProblem`
 * signature, same return type — so callers (problem-gates / game-loop)
 * keep working with no API changes.
 */
export function selectPlaceholderProblem(
  difficulty: GateDifficulty,
  uniform01: number,
): Problem {
  if (difficulty === 'B') {
    if (POOL_B.length === 0) {
      throw new Error('No problems available for difficulty: B');
    }
    const idx = Math.min(POOL_B.length - 1, Math.floor(uniform01 * POOL_B.length));
    return POOL_B[idx]!;
  }

  const family =
    difficulty === 'M' ? PROBLEM_TEMPLATES_M : PROBLEM_TEMPLATES_A;
  if (family.length === 0) {
    throw new Error(`No templates available for difficulty: ${difficulty}`);
  }
  const tIdx = Math.min(family.length - 1, Math.floor(uniform01 * family.length));
  const template = family[tIdx]!;
  // Synthesise a 32-bit seed from the uniform01 input. The template's own
  // generate function uses this as the start of its threaded mulberry32
  // sequence, so deterministic input → deterministic output.
  const seed = Math.floor(uniform01 * 0xffffffff);
  return template.generate(seed).problem;
}

export type { AnswerChoice, Problem } from '../shared/types';
