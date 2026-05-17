import { describe, expect, it } from 'vitest';
import {
  consumeLife,
  createWorldState,
  startRun,
  tickInvincibility,
  tickWorld,
} from '../../src/runner-engine';
import {
  INVINCIBILITY_DURATION_MS,
  MAX_LIVES,
} from '../../src/shared/config';

/**
 * End-to-end pure-logic exercise of the lives + invincibility flow:
 * obstacle hit -> life lost + 3-second invincibility window -> obstacles
 * during the window are silently absorbed -> window expires -> next
 * obstacle costs another life -> third strike ends the run. Pure logic
 * only: no game-loop instance, no DOM, no Three.js. The game-loop's
 * collision-check + respawn glue is exercised separately by manual
 * validation (T040).
 */

describe('lives flow: obstacle hits cost a life + grant a 3s invincibility window', () => {
  it('first obstacle hit drops lives 3 -> 2 and grants INVINCIBILITY_DURATION_MS of invincibility', () => {
    const world0 = startRun(createWorldState());
    expect(world0.lives).toBe(MAX_LIVES);
    expect(world0.invincibilityRemainingMs).toBe(0);

    const afterHit = consumeLife(world0, 'obstacle');
    expect(afterHit.lives).toBe(MAX_LIVES - 1);
    expect(afterHit.invincibilityRemainingMs).toBe(INVINCIBILITY_DURATION_MS);
    expect(afterHit.runState).toBe('running');
  });

  it('a second obstacle hit DURING the invincibility window is absorbed by the game-loop (no further life loss)', () => {
    // The runner-engine's consumeLife is the canonical decrement; the
    // game-loop is the one that checks invincibilityRemainingMs first and
    // chooses to call consumeLife OR silently consume the obstacle. Simulate
    // the game-loop's logic here.
    let world = startRun(createWorldState());
    world = consumeLife(world, 'obstacle');

    // Tick 1500ms — still invincible (1500 ms remaining of 3000).
    world = tickInvincibility(world, 1500);
    expect(world.invincibilityRemainingMs).toBe(
      INVINCIBILITY_DURATION_MS - 1500,
    );

    // Game-loop equivalent: another obstacle collision arrives.
    // invincibilityRemainingMs > 0 → game-loop drops the obstacle without
    // calling consumeLife. World is unchanged apart from the invincibility
    // countdown, which keeps running.
    const livesBefore = world.lives;
    if (world.invincibilityRemainingMs > 0) {
      // skip consumeLife
    } else {
      world = consumeLife(world, 'obstacle');
    }
    expect(world.lives).toBe(livesBefore); // no change
  });

  it('after the invincibility window ends, the next obstacle hit drops another life', () => {
    let world = startRun(createWorldState());
    world = consumeLife(world, 'obstacle');
    // Drain invincibility.
    world = tickInvincibility(world, INVINCIBILITY_DURATION_MS);
    expect(world.invincibilityRemainingMs).toBe(0);
    // Now another obstacle hit costs a life.
    world = consumeLife(world, 'obstacle');
    expect(world.lives).toBe(MAX_LIVES - 2);
    expect(world.invincibilityRemainingMs).toBe(INVINCIBILITY_DURATION_MS);
  });

  it('the third life loss transitions to game-over with invincibilityRemainingMs reset to 0', () => {
    let world = startRun(createWorldState());
    world = consumeLife(world, 'obstacle');
    world = tickInvincibility(world, INVINCIBILITY_DURATION_MS);
    world = consumeLife(world, 'obstacle');
    world = tickInvincibility(world, INVINCIBILITY_DURATION_MS);
    expect(world.lives).toBe(1);
    world = consumeLife(world, 'obstacle');
    expect(world.lives).toBe(0);
    expect(world.runState).toBe('game-over');
    expect(world.invincibilityRemainingMs).toBe(0);
  });
});

describe('lives flow: tickInvincibility threading', () => {
  it('the invincibility countdown advances with each tickInvincibility call', () => {
    let world = startRun(createWorldState());
    world = consumeLife(world, 'obstacle');
    expect(world.invincibilityRemainingMs).toBe(INVINCIBILITY_DURATION_MS);

    let remainingExpected = INVINCIBILITY_DURATION_MS;
    for (let i = 0; i < 6; i++) {
      world = tickInvincibility(world, 500);
      remainingExpected = Math.max(0, remainingExpected - 500);
      expect(world.invincibilityRemainingMs).toBe(remainingExpected);
    }
    expect(world.invincibilityRemainingMs).toBe(0);
  });

  it('tickInvincibility does NOT advance tickWorld; the two countdowns are independent', () => {
    let world = startRun(createWorldState());
    world = consumeLife(world, 'obstacle');
    const tickBefore = world.tickMs;
    world = tickInvincibility(world, 500);
    expect(world.tickMs).toBe(tickBefore); // unchanged
  });

  it('tickInvincibility is a no-op outside the running state (paused / game-over freeze it)', () => {
    let world = startRun(createWorldState());
    world = consumeLife(world, 'obstacle');
    const invincBefore = world.invincibilityRemainingMs;
    const paused = { ...world, runState: 'paused' as const };
    const after = tickInvincibility(paused, 1000);
    expect(after.invincibilityRemainingMs).toBe(invincBefore);
  });
});

describe('lives flow: wrong-answer life loss is independent of obstacle invincibility', () => {
  it("wrong-answer life loss does NOT set invincibility (cause is 'wrong-answer')", () => {
    let world = startRun(createWorldState());
    world = consumeLife(world, 'wrong-answer');
    expect(world.lives).toBe(MAX_LIVES - 1);
    expect(world.invincibilityRemainingMs).toBe(0);
  });

  it('mixed obstacle + wrong-answer losses still reach game-over at 0 lives', () => {
    let world = startRun(createWorldState());
    world = consumeLife(world, 'obstacle'); // 3 -> 2, invinc=3000
    world = tickInvincibility(world, INVINCIBILITY_DURATION_MS); // invinc=0
    world = consumeLife(world, 'wrong-answer'); // 2 -> 1, invinc unchanged
    expect(world.invincibilityRemainingMs).toBe(0);
    world = consumeLife(world, 'obstacle'); // 1 -> 0, game-over
    expect(world.lives).toBe(0);
    expect(world.runState).toBe('game-over');
  });
});

describe('lives flow: restart fully resets lives + invincibility', () => {
  it('after restart, lives is back to MAX_LIVES and invincibility is cleared', async () => {
    const { restartRun } = await import('../../src/runner-engine');
    let world = startRun(createWorldState());
    world = consumeLife(world, 'obstacle');
    expect(world.lives).toBe(2);
    expect(world.invincibilityRemainingMs).toBeGreaterThan(0);
    const restarted = restartRun(world);
    expect(restarted.lives).toBe(MAX_LIVES);
    expect(restarted.invincibilityRemainingMs).toBe(0);
    expect(restarted.scoreDelta).toBe(0);
    expect(restarted.activeGate).toBeNull();
  });
});

describe('lives flow: world advance is unaffected by life losses', () => {
  it('consumeLife does not change tickMs or distanceUnits', () => {
    let world = startRun(createWorldState());
    world = tickWorld(world, 5_000);
    const tickBefore = world.tickMs;
    const distBefore = world.distanceUnits;
    world = consumeLife(world, 'obstacle');
    expect(world.tickMs).toBe(tickBefore);
    expect(world.distanceUnits).toBe(distBefore);
  });
});
