import { describe, expect, it } from 'vitest';
import {
  createWorldState,
  pauseRun,
  resumeRun,
  startRun,
  tickWorld,
} from './index';
import { RUN_SPEED_UNITS_PER_SEC } from '../shared/config';

describe('createWorldState', () => {
  it('starts in pre-run with zero distance and tickMs', () => {
    const w = createWorldState();
    expect(w.runState).toBe('pre-run');
    expect(w.speedUnitsPerSec).toBe(RUN_SPEED_UNITS_PER_SEC);
    expect(w.distanceUnits).toBe(0);
    expect(w.tickMs).toBe(0);
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
});
