// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { playSfx, type SfxName } from './sfx-synth';

interface StubOsc {
  type: OscillatorType;
  frequency: {
    setValueAtTime: () => void;
    exponentialRampToValueAtTime: () => void;
    linearRampToValueAtTime: () => void;
  };
  detune: { setValueAtTime: () => void };
  connect: () => void;
  start: () => void;
  stop: () => void;
}

function makeStubCtx(): AudioContext {
  let oscCount = 0;
  const ctx = {
    currentTime: 0,
    createOscillator: (): StubOsc => {
      oscCount += 1;
      return {
        type: 'sine',
        frequency: {
          setValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
          linearRampToValueAtTime: () => undefined,
        },
        detune: { setValueAtTime: () => undefined },
        connect: () => undefined,
        start: () => undefined,
        stop: () => undefined,
      };
    },
    createGain: () => ({
      gain: {
        value: 1,
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: () => undefined,
      disconnect: () => undefined,
    }),
    get oscCount() {
      return oscCount;
    },
  };
  return ctx as unknown as AudioContext;
}

const NAMES: readonly SfxName[] = [
  'lane-change',
  'obstacle-hit',
  'gate-hit',
  'correct-answer',
  'life-lost',
  'game-over',
  'countdown-tick',
];

describe('playSfx — shape invariants', () => {
  for (const name of NAMES) {
    it(`${name}: returns a non-null source and a positive durationMs ≤ 2000`, () => {
      const ctx = makeStubCtx();
      const destination = {
        connect: () => undefined,
      } as unknown as AudioNode;
      const result = playSfx(ctx, destination, name);
      expect(result.source).toBeDefined();
      expect(result.source).not.toBeNull();
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.durationMs).toBeLessThanOrEqual(2000);
    });
  }
});
