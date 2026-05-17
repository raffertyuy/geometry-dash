import { describe, expect, it } from 'vitest';
import {
  createWorldState,
  endRun,
  pauseRun,
  restartRun,
  resumeRun,
  startRun,
  tickWorld,
} from './index';
import { MAX_LIVES, RUN_SPEED_UNITS_PER_SEC } from '../shared/config';

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
    let w = startRun(createWorldState());
    const drained = { ...w, lives: 1, invincibilityRemainingMs: 1500 };
    const restarted = restartRun(drained);
    expect(restarted.lives).toBe(MAX_LIVES);
    expect(restarted.invincibilityRemainingMs).toBe(0);
  });

  it('resets scoreDelta and activeGate on restart', () => {
    let w = startRun(createWorldState());
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
