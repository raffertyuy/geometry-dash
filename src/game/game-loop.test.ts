import { describe, expect, it } from 'vitest';
import { derivePauseButtonState } from './game-loop';
import { createWorldState } from '../runner-engine';
import { INVINCIBILITY_DURATION_MS } from '../shared/config';
import type { WorldState } from '../shared/types';

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
