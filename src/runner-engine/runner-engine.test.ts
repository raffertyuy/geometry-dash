import { describe, expect, it } from 'vitest';
import {
  consumeLife,
  createWorldState,
  endRun,
  enterAnswering,
  pauseRun,
  resolveAnswer,
  restartRun,
  resumeRun,
  startRun,
  tickInvincibility,
  tickWorld,
} from './index';
import {
  INVINCIBILITY_DURATION_MS,
  MAX_LIVES,
  RUN_SPEED_UNITS_PER_SEC,
} from '../shared/config';
import type { ProblemGate } from '../shared/types';

function makeGate(
  id = 1,
  difficulty: 'B' | 'M' | 'A' = 'B',
  lane: 'left' | 'centre' | 'right' = 'centre',
): ProblemGate {
  return {
    id,
    difficulty,
    lane,
    problem: {
      id: `${difficulty.toLowerCase()}-test`,
      difficulty,
      prompt: 'test',
      choices: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] as const,
      correctIndex: 0,
    },
    worldZ: 0,
    previousWorldZ: -1,
  };
}

describe('createWorldState', () => {
  it('starts in pre-run with zero distance and tickMs', () => {
    const w = createWorldState();
    expect(w.runState).toBe('pre-run');
    expect(w.speedUnitsPerSec).toBe(RUN_SPEED_UNITS_PER_SEC);
    expect(w.distanceUnits).toBe(0);
    expect(w.tickMs).toBe(0);
  });

  it('initialises lives to MAX_LIVES with no invincibility, no scoreDelta, no activeGate', () => {
    const w = createWorldState();
    expect(w.lives).toBe(MAX_LIVES);
    expect(w.invincibilityRemainingMs).toBe(0);
    expect(w.scoreDelta).toBe(0);
    expect(w.activeGate).toBeNull();
  });
});

describe('startRun', () => {
  it('transitions pre-run to running', () => {
    expect(startRun(createWorldState()).runState).toBe('running');
  });

  it('is idempotent when already running', () => {
    const w = startRun(createWorldState());
    const again = startRun(w);
    expect(again.runState).toBe('running');
    expect(again.distanceUnits).toBe(w.distanceUnits);
  });
});

describe('pauseRun', () => {
  it('transitions running to paused', () => {
    const w = startRun(createWorldState());
    expect(pauseRun(w).runState).toBe('paused');
  });

  it('is a no-op from pre-run', () => {
    const w = createWorldState();
    expect(pauseRun(w).runState).toBe('pre-run');
  });

  it('is a no-op when already paused', () => {
    const w = pauseRun(startRun(createWorldState()));
    expect(pauseRun(w).runState).toBe('paused');
  });
});

describe('resumeRun', () => {
  it('transitions paused to running', () => {
    const w = pauseRun(startRun(createWorldState()));
    expect(resumeRun(w).runState).toBe('running');
  });

  it('is a no-op from pre-run (use startRun to begin)', () => {
    const w = createWorldState();
    expect(resumeRun(w).runState).toBe('pre-run');
  });

  it('is a no-op when already running', () => {
    const w = startRun(createWorldState());
    expect(resumeRun(w).runState).toBe('running');
  });
});

describe('tickWorld', () => {
  it('does not advance distance from pre-run', () => {
    const w = tickWorld(createWorldState(), 1000);
    expect(w.distanceUnits).toBe(0);
    expect(w.tickMs).toBe(0);
  });

  it('advances distanceUnits by exactly speedUnitsPerSec in 1000 ms when running', () => {
    let w = startRun(createWorldState());
    w = tickWorld(w, 1000);
    expect(w.distanceUnits).toBeCloseTo(RUN_SPEED_UNITS_PER_SEC, 5);
    expect(w.tickMs).toBe(1000);
  });

  it('does not advance distance while paused', () => {
    let w = startRun(createWorldState());
    w = tickWorld(w, 500); // run for 500ms
    const distAtPause = w.distanceUnits;
    const tickAtPause = w.tickMs;
    w = pauseRun(w);
    w = tickWorld(w, 1000); // attempt to tick while paused
    expect(w.distanceUnits).toBe(distAtPause);
    expect(w.tickMs).toBe(tickAtPause);
  });

  it('continues from the saved distance after resume', () => {
    let w = startRun(createWorldState());
    w = tickWorld(w, 500); // 100 units
    w = pauseRun(w);
    w = tickWorld(w, 1000); // ignored
    w = resumeRun(w);
    w = tickWorld(w, 500); // another 100 units
    expect(w.distanceUnits).toBeCloseTo(RUN_SPEED_UNITS_PER_SEC, 5); // 200
    expect(w.tickMs).toBe(1000);
  });

  it('accumulates over many small ticks deterministically', () => {
    let w = startRun(createWorldState());
    for (let i = 0; i < 1000; i++) {
      w = tickWorld(w, 1); // 1ms ticks for 1 second total
    }
    expect(w.distanceUnits).toBeCloseTo(RUN_SPEED_UNITS_PER_SEC, 3);
    expect(w.tickMs).toBe(1000);
  });

  it('does not advance distance from game-over state', () => {
    let w = startRun(createWorldState());
    w = tickWorld(w, 500);
    const distAtEnd = w.distanceUnits;
    const tickAtEnd = w.tickMs;
    w = endRun(w);
    w = tickWorld(w, 1000);
    expect(w.distanceUnits).toBe(distAtEnd);
    expect(w.tickMs).toBe(tickAtEnd);
  });

  it("does not advance distance or tickMs from the 'answering' state", () => {
    // World gets into 'answering' via enterAnswering during a real run; here
    // we construct that shape directly to keep this test scoped to the guard.
    let w = startRun(createWorldState());
    w = tickWorld(w, 1234);
    const distBefore = w.distanceUnits;
    const tickBefore = w.tickMs;
    const answering = { ...w, runState: 'answering' as const };
    const afterTick = tickWorld(answering, 1000);
    expect(afterTick.distanceUnits).toBe(distBefore);
    expect(afterTick.tickMs).toBe(tickBefore);
  });

  it('honours the optional speedOverride parameter when supplied', () => {
    let w = startRun(createWorldState());
    // 1.10x baseline override
    w = tickWorld(w, 1000, RUN_SPEED_UNITS_PER_SEC * 1.10);
    expect(w.distanceUnits).toBeCloseTo(RUN_SPEED_UNITS_PER_SEC * 1.10, 5);
  });

  it('the speedOverride is used instead of world.speedUnitsPerSec, not in addition', () => {
    let w = startRun(createWorldState());
    // 1.21x baseline override; world.speedUnitsPerSec is unchanged.
    w = tickWorld(w, 1000, RUN_SPEED_UNITS_PER_SEC * 1.21);
    expect(w.distanceUnits).toBeCloseTo(RUN_SPEED_UNITS_PER_SEC * 1.21, 5);
    expect(w.speedUnitsPerSec).toBe(RUN_SPEED_UNITS_PER_SEC); // unchanged
  });

  it('the runState guard still applies when speedOverride is supplied', () => {
    let w = pauseRun(startRun(createWorldState()));
    // Override is large but should not move tickMs / distanceUnits while paused.
    w = tickWorld(w, 1000, 9999);
    expect(w.tickMs).toBe(0);
    expect(w.distanceUnits).toBe(0);
  });
});

describe('endRun', () => {
  it('transitions running to game-over', () => {
    const w = startRun(createWorldState());
    expect(endRun(w).runState).toBe('game-over');
  });

  it('is a no-op from pre-run', () => {
    const w = createWorldState();
    expect(endRun(w)).toEqual(w);
  });

  it('is a no-op from paused', () => {
    const w = pauseRun(startRun(createWorldState()));
    expect(endRun(w).runState).toBe('paused');
  });

  it('is idempotent (a second endRun on a game-over world is a no-op)', () => {
    const w = endRun(startRun(createWorldState()));
    expect(endRun(w).runState).toBe('game-over');
  });

  it('preserves accumulated tickMs and distanceUnits at the moment of end', () => {
    let w = startRun(createWorldState());
    w = tickWorld(w, 1234);
    const distBefore = w.distanceUnits;
    const tickBefore = w.tickMs;
    w = endRun(w);
    expect(w.distanceUnits).toBe(distBefore);
    expect(w.tickMs).toBe(tickBefore);
  });
});

describe('restartRun', () => {
  it('returns a fresh running state with zero distance and zero tickMs', () => {
    let w = startRun(createWorldState());
    w = tickWorld(w, 5000);
    w = endRun(w);
    const restarted = restartRun(w);
    expect(restarted.runState).toBe('running');
    expect(restarted.distanceUnits).toBe(0);
    expect(restarted.tickMs).toBe(0);
  });

  it('preserves speedUnitsPerSec', () => {
    let w = startRun(createWorldState());
    w = endRun(w);
    expect(restartRun(w).speedUnitsPerSec).toBe(w.speedUnitsPerSec);
  });

  it('a tickWorld after restart re-starts distance accumulation from zero', () => {
    let w = startRun(createWorldState());
    w = tickWorld(w, 2000);
    w = endRun(w);
    w = restartRun(w);
    w = tickWorld(w, 1000);
    expect(w.distanceUnits).toBeCloseTo(RUN_SPEED_UNITS_PER_SEC, 5);
    expect(w.tickMs).toBe(1000);
  });

  it('resets lives back to MAX_LIVES even after lives were consumed in the previous run', () => {
    const w = startRun(createWorldState());
    const drained = { ...w, lives: 1, invincibilityRemainingMs: 1500 };
    const restarted = restartRun(drained);
    expect(restarted.lives).toBe(MAX_LIVES);
    expect(restarted.invincibilityRemainingMs).toBe(0);
  });

  it('resets scoreDelta and activeGate on restart', () => {
    const w = startRun(createWorldState());
    const drained = {
      ...w,
      scoreDelta: -5000,
      activeGate: {
        gateId: 7,
        difficulty: 'M' as const,
        problem: {
          id: 'm-test',
          difficulty: 'M' as const,
          prompt: 'p',
          choices: [
            { text: 'a' },
            { text: 'b' },
            { text: 'c' },
          ] as const,
          correctIndex: 0 as const,
        },
      },
    };
    const restarted = restartRun(drained);
    expect(restarted.scoreDelta).toBe(0);
    expect(restarted.activeGate).toBeNull();
  });
});

describe('enterAnswering', () => {
  it('transitions running -> answering with the gate stored on activeGate', () => {
    const w = startRun(createWorldState());
    const gate = makeGate(7, 'M', 'left');
    const next = enterAnswering(w, gate);
    expect(next.runState).toBe('answering');
    expect(next.activeGate).not.toBeNull();
    expect(next.activeGate!.gateId).toBe(7);
    expect(next.activeGate!.difficulty).toBe('M');
    expect(next.activeGate!.problem.id).toBe('m-test');
  });

  it('is a no-op when world is paused', () => {
    const w = pauseRun(startRun(createWorldState()));
    const next = enterAnswering(w, makeGate());
    expect(next).toEqual(w);
  });

  it('is a no-op when world is already answering', () => {
    const w = startRun(createWorldState());
    const onceAnswering = enterAnswering(w, makeGate(1));
    const twice = enterAnswering(onceAnswering, makeGate(2));
    expect(twice).toEqual(onceAnswering);
  });

  it('is a no-op when world is game-over', () => {
    const w = endRun(startRun(createWorldState()));
    expect(enterAnswering(w, makeGate())).toEqual(w);
  });
});

describe('consumeLife', () => {
  it("with 'obstacle' cause and lives > 1: decrements lives, sets the invincibility window", () => {
    const w = startRun(createWorldState());
    const next = consumeLife(w, 'obstacle');
    expect(next.lives).toBe(MAX_LIVES - 1);
    expect(next.invincibilityRemainingMs).toBe(INVINCIBILITY_DURATION_MS);
    expect(next.runState).toBe('running');
  });

  it("with 'wrong-answer' cause and lives > 1: decrements lives, does NOT set invincibility", () => {
    const w = startRun(createWorldState());
    const next = consumeLife(w, 'wrong-answer');
    expect(next.lives).toBe(MAX_LIVES - 1);
    expect(next.invincibilityRemainingMs).toBe(0);
    expect(next.runState).toBe('running');
  });

  it("with 'obstacle' cause on the LAST life: transitions to game-over, no invincibility", () => {
    let w = startRun(createWorldState());
    w = { ...w, lives: 1 };
    const next = consumeLife(w, 'obstacle');
    expect(next.lives).toBe(0);
    expect(next.runState).toBe('game-over');
    expect(next.invincibilityRemainingMs).toBe(0);
  });

  it("with 'wrong-answer' cause on the LAST life: transitions to game-over", () => {
    let w = startRun(createWorldState());
    w = { ...w, lives: 1 };
    const next = consumeLife(w, 'wrong-answer');
    expect(next.lives).toBe(0);
    expect(next.runState).toBe('game-over');
  });

  it('is a no-op when lives is already 0 (no double-decrement)', () => {
    const w = { ...startRun(createWorldState()), lives: 0 };
    const next = consumeLife(w, 'obstacle');
    expect(next).toEqual(w);
  });
});

describe('resolveAnswer', () => {
  function enterAnsweringHelper(
    lives = MAX_LIVES,
    scoreDelta = 0,
    tickMs = 10_000,
  ) {
    let w = startRun(createWorldState());
    w = tickWorld(w, tickMs);
    w = { ...w, lives, scoreDelta };
    return enterAnswering(w, makeGate(1, 'B', 'centre'));
  }

  it('on correct answer: adds +points to scoreDelta, returns to running, lives unchanged', () => {
    const w = enterAnsweringHelper(3, 0);
    const next = resolveAnswer(w, true, 1000);
    expect(next.scoreDelta).toBe(1000);
    expect(next.runState).toBe('running');
    expect(next.activeGate).toBeNull();
    expect(next.lives).toBe(3);
  });

  it('on wrong answer with lives > 1: subtracts points AND decrements lives, returns to running', () => {
    const w = enterAnsweringHelper(3, 0);
    const next = resolveAnswer(w, false, 5000);
    expect(next.scoreDelta).toBe(-5000);
    expect(next.lives).toBe(2);
    expect(next.runState).toBe('running');
    expect(next.activeGate).toBeNull();
  });

  it('on wrong answer with lives === 1: transitions to game-over via consumeLife', () => {
    const w = enterAnsweringHelper(1, 0);
    const next = resolveAnswer(w, false, 1000);
    expect(next.lives).toBe(0);
    expect(next.runState).toBe('game-over');
    expect(next.activeGate).toBeNull();
  });

  it("on wrong answer: does NOT set invincibility (cause is 'wrong-answer')", () => {
    const w = enterAnsweringHelper(3, 0);
    const next = resolveAnswer(w, false, 5000);
    expect(next.invincibilityRemainingMs).toBe(0);
  });

  it('accumulates scoreDelta across multiple answers', () => {
    let w = enterAnsweringHelper(3, 0);
    w = resolveAnswer(w, true, 1000); // +1000
    w = enterAnswering(w, makeGate(2, 'M', 'centre'));
    w = resolveAnswer(w, false, 5000); // -5000
    expect(w.scoreDelta).toBe(-4000);
  });

  it('is a no-op when world is not in answering state', () => {
    const w = startRun(createWorldState());
    expect(resolveAnswer(w, true, 1000)).toEqual(w);
  });
});

describe('tickInvincibility', () => {
  it('decrements invincibilityRemainingMs by dtMs', () => {
    const w = consumeLife(startRun(createWorldState()), 'obstacle');
    expect(w.invincibilityRemainingMs).toBe(INVINCIBILITY_DURATION_MS);
    const after = tickInvincibility(w, 500);
    expect(after.invincibilityRemainingMs).toBe(INVINCIBILITY_DURATION_MS - 500);
  });

  it('clamps to 0 when dtMs exceeds remaining time', () => {
    let w = consumeLife(startRun(createWorldState()), 'obstacle');
    w = { ...w, invincibilityRemainingMs: 200 };
    const after = tickInvincibility(w, 500);
    expect(after.invincibilityRemainingMs).toBe(0);
  });

  it('is a no-op when invincibilityRemainingMs is already 0', () => {
    const w = startRun(createWorldState());
    expect(w.invincibilityRemainingMs).toBe(0);
    const after = tickInvincibility(w, 1000);
    expect(after).toEqual(w);
  });

  it('is a no-op outside the running state', () => {
    let w = consumeLife(startRun(createWorldState()), 'obstacle');
    w = pauseRun(w);
    const after = tickInvincibility(w, 500);
    expect(after).toEqual(w);
  });
});
