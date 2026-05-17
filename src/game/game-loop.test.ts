import { describe, expect, it } from 'vitest';
import { applyAnswerToWorld, derivePauseButtonState } from './game-loop';
import { createWorldState } from '../runner-engine';
import {
  GATE_POINTS_A,
  GATE_POINTS_B,
  INVINCIBILITY_DURATION_MS,
  MAX_LIVES,
  RUN_SPEED_UNITS_PER_SEC,
} from '../shared/config';
import type { Problem, WorldState } from '../shared/types';

function world(overrides: Partial<WorldState>): WorldState {
  return { ...createWorldState(), ...overrides };
}

describe('derivePauseButtonState', () => {
  it('start-screen: not visible, not enabled', () => {
    const s = derivePauseButtonState('start-screen', world({ runState: 'pre-run' }), false);
    expect(s).toEqual({ visible: false, enabled: false });
  });

  it('game-over: not visible, not enabled', () => {
    const s = derivePauseButtonState('game-over', world({ runState: 'game-over' }), false);
    expect(s).toEqual({ visible: false, enabled: false });
  });

  it('running, no gate modal, no invincibility, no how-to-play: visible AND enabled', () => {
    const s = derivePauseButtonState(
      'running',
      world({ runState: 'running', invincibilityRemainingMs: 0 }),
      false,
    );
    expect(s).toEqual({ visible: true, enabled: true });
  });

  it('running but gate modal open (runState === answering): visible, NOT enabled', () => {
    const s = derivePauseButtonState(
      'running',
      world({ runState: 'answering', invincibilityRemainingMs: 0 }),
      false,
    );
    expect(s).toEqual({ visible: true, enabled: false });
  });

  it('running with respawn invincibility active: visible, NOT enabled', () => {
    const s = derivePauseButtonState(
      'running',
      world({ runState: 'running', invincibilityRemainingMs: INVINCIBILITY_DURATION_MS }),
      false,
    );
    expect(s).toEqual({ visible: true, enabled: false });
  });

  it('running with how-to-play modal already open: visible, NOT enabled', () => {
    const s = derivePauseButtonState(
      'running',
      world({ runState: 'running', invincibilityRemainingMs: 0 }),
      true,
    );
    expect(s).toEqual({ visible: true, enabled: false });
  });

  it('paused (via pauseRun): not visible (loopState gates the render)', () => {
    const s = derivePauseButtonState(
      'paused',
      world({ runState: 'paused', invincibilityRemainingMs: 0 }),
      false,
    );
    expect(s).toEqual({ visible: false, enabled: false });
  });
});

describe('applyAnswerToWorld — wrong-answer + score-below-zero is a single penalty', () => {
  const STUB_PROBLEM: Problem = {
    id: 'b01',
    difficulty: 'B',
    prompt: 'p',
    choices: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] as const,
    correctIndex: 0,
  };

  function answeringWorld(initialLives: number, initialScoreDelta: number): WorldState {
    return {
      runState: 'answering',
      speedUnitsPerSec: RUN_SPEED_UNITS_PER_SEC,
      distanceUnits: 0,
      tickMs: 0,
      lives: initialLives,
      invincibilityRemainingMs: 0,
      scoreDelta: initialScoreDelta,
      activeGate: { gateId: 1, difficulty: STUB_PROBLEM.difficulty, problem: STUB_PROBLEM },
    };
  }

  it('correct answer: no life lost, score increases, run continues', () => {
    const w = answeringWorld(MAX_LIVES, 0);
    const next = applyAnswerToWorld(w, true, GATE_POINTS_B);
    expect(next.lives).toBe(MAX_LIVES);
    expect(next.scoreDelta).toBe(GATE_POINTS_B);
    expect(next.runState).toBe('running');
  });

  it('wrong answer that keeps score >= 0: deducts exactly 1 life, run continues', () => {
    const w = answeringWorld(MAX_LIVES, GATE_POINTS_B * 5); // plenty of buffer
    const next = applyAnswerToWorld(w, false, GATE_POINTS_B);
    expect(next.lives).toBe(MAX_LIVES - 1);
    expect(next.scoreDelta).toBe(GATE_POINTS_B * 4);
    expect(next.runState).toBe('running');
  });

  it('wrong answer that drives score below zero: NO life deducted (refunded), game-over fires', () => {
    const w = answeringWorld(MAX_LIVES, 0); // any wrong Advanced answer will go below 0
    const next = applyAnswerToWorld(w, false, GATE_POINTS_A);
    expect(next.lives).toBe(MAX_LIVES); // refunded
    expect(next.scoreDelta).toBe(-GATE_POINTS_A);
    expect(next.runState).toBe('game-over');
  });

  it('wrong answer at lives === 1 (score still non-negative): consumeLife transitions to game-over with 0 lives', () => {
    const w = answeringWorld(1, GATE_POINTS_B * 5);
    const next = applyAnswerToWorld(w, false, GATE_POINTS_B);
    expect(next.lives).toBe(0);
    expect(next.runState).toBe('game-over');
    // No refund here — game-over came from zero lives, not from score-below-zero.
  });

  it('wrong answer at lives === 2 that ALSO drops score below zero: lives refunded to 2 (not 1, not 0)', () => {
    const w = answeringWorld(2, 0);
    const next = applyAnswerToWorld(w, false, GATE_POINTS_A);
    expect(next.lives).toBe(2);
    expect(next.runState).toBe('game-over');
  });
});
