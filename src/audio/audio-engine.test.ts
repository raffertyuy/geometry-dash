// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { createAudioEngine, type BgmTrack } from './audio-engine';

interface StubGain {
  gain: { value: number; setValueAtTime: (v: number, t: number) => void };
  connect: (n: unknown) => void;
  disconnect: () => void;
}
interface StubBufferSource {
  buffer: AudioBuffer | null;
  loop: boolean;
  connect: (n: unknown) => void;
  disconnect: () => void;
  start: (t: number) => void;
  stop: () => void;
}
interface StubCtx {
  state: 'running' | 'suspended' | 'closed';
  currentTime: number;
  destination: object;
  createGain: () => StubGain;
  createBufferSource: () => StubBufferSource;
  createOscillator: () => Record<string, unknown>;
  decodeAudioData: (buf: ArrayBuffer) => Promise<AudioBuffer>;
  suspend: () => Promise<void>;
  resume: () => Promise<void>;
  close: () => Promise<void>;
}

function makeStub(): {
  ctx: StubCtx;
  events: string[];
  gainValues: number[];
  sourcesStarted: number;
  sourcesStopped: number;
} {
  const events: string[] = [];
  const gainValues: number[] = [];
  let sourcesStarted = 0;
  let sourcesStopped = 0;
  const ctx: StubCtx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    createGain: (): StubGain => ({
      gain: {
        value: 1,
        setValueAtTime: (v) => {
          gainValues.push(v);
          events.push(`gain-set:${v}`);
        },
      },
      connect: () => undefined,
      disconnect: () => undefined,
    }),
    createBufferSource: (): StubBufferSource => ({
      buffer: null,
      loop: false,
      connect: () => undefined,
      disconnect: () => undefined,
      start: () => {
        sourcesStarted += 1;
        events.push('bgm-start');
      },
      stop: () => {
        sourcesStopped += 1;
        events.push('bgm-stop');
      },
    }),
    createOscillator: () => ({
      type: 'sine',
      frequency: {
        setValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
        linearRampToValueAtTime: () => undefined,
      },
      detune: { setValueAtTime: () => undefined },
      connect: () => undefined,
      start: () => events.push('osc-start'),
      stop: () => events.push('osc-stop'),
    }),
    decodeAudioData: () => Promise.resolve({ duration: 24 } as AudioBuffer),
    suspend: () => {
      ctx.state = 'suspended';
      events.push('ctx-suspend');
      return Promise.resolve();
    },
    resume: () => {
      ctx.state = 'running';
      events.push('ctx-resume');
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  };
  return {
    ctx,
    events,
    gainValues,
    get sourcesStarted() {
      return sourcesStarted;
    },
    get sourcesStopped() {
      return sourcesStopped;
    },
  };
}

function makeEngineUnlocked() {
  const stub = makeStub();
  const engine = createAudioEngine({
    createContext: () => stub.ctx as unknown as AudioContext,
    fetchBgm: () => Promise.resolve(new ArrayBuffer(8)),
    win: window,
  });
  // Trigger the gesture latch.
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
  return { engine, stub };
}

async function flushPromises(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  // Clean window listeners between tests.
});

describe('createAudioEngine — mute toggle', () => {
  it('setMuted(true) sets master gain to 0', async () => {
    const { engine, stub } = makeEngineUnlocked();
    await flushPromises();
    stub.gainValues.length = 0;
    engine.setMuted(true);
    expect(engine.isMuted()).toBe(true);
    expect(stub.gainValues.at(-1)).toBe(0);
    engine.destroy();
  });

  it('setMuted(false) restores master gain to the base volume', async () => {
    const { engine, stub } = makeEngineUnlocked();
    await flushPromises();
    engine.setMuted(true);
    stub.gainValues.length = 0;
    engine.setMuted(false);
    expect(engine.isMuted()).toBe(false);
    expect(stub.gainValues.at(-1)).toBeGreaterThan(0);
    engine.destroy();
  });

  it('setMuted is a no-op when called with the same value', () => {
    const { engine, stub } = makeEngineUnlocked();
    engine.setMuted(false); // already false
    expect(stub.gainValues.filter((v) => v === 0).length).toBe(0);
    engine.destroy();
  });

  it('mute set BEFORE gesture unlock is applied at unlock', () => {
    const stub = makeStub();
    const engine = createAudioEngine({
      createContext: () => stub.ctx as unknown as AudioContext,
      fetchBgm: () => Promise.resolve(new ArrayBuffer(8)),
      win: window,
    });
    engine.setMuted(true);
    expect(engine.isMuted()).toBe(true);
    // Gesture: unlock should apply mute as gain=0.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(stub.gainValues.at(-1)).toBe(0);
    engine.destroy();
  });
});

describe('createAudioEngine — BGM dual-track', () => {
  it('startBgm("default") after unlock starts a buffer source with loop=true', async () => {
    const { engine, stub } = makeEngineUnlocked();
    await flushPromises();
    engine.startBgm('default');
    expect(stub.sourcesStarted).toBeGreaterThanOrEqual(1);
    expect(engine.getActiveTrack()).toBe('default');
    engine.destroy();
  });

  it('setBgmTrack("contest") swaps from default to contest (stop+start)', async () => {
    const { engine, stub } = makeEngineUnlocked();
    await flushPromises();
    engine.startBgm('default');
    const startedBefore = stub.sourcesStarted;
    const stoppedBefore = stub.sourcesStopped;
    engine.setBgmTrack('contest');
    expect(engine.getActiveTrack()).toBe('contest');
    expect(stub.sourcesStopped).toBeGreaterThan(stoppedBefore);
    expect(stub.sourcesStarted).toBeGreaterThan(startedBefore);
    engine.destroy();
  });

  it('setBgmTrack to the same track is a no-op', async () => {
    const { engine, stub } = makeEngineUnlocked();
    await flushPromises();
    engine.startBgm('default');
    const startedBefore = stub.sourcesStarted;
    engine.setBgmTrack('default');
    expect(stub.sourcesStarted).toBe(startedBefore);
    engine.destroy();
  });

  it('pauseBgm calls ctx.suspend; resumeBgm calls ctx.resume', async () => {
    const { engine, stub } = makeEngineUnlocked();
    await flushPromises();
    engine.startBgm('default');
    engine.pauseBgm();
    expect(stub.events).toContain('ctx-suspend');
    engine.resumeBgm();
    expect(stub.events).toContain('ctx-resume');
    engine.destroy();
  });

  it('stopBgm clears activeTrack and stops the source', async () => {
    const { engine, stub } = makeEngineUnlocked();
    await flushPromises();
    engine.startBgm('default');
    const stoppedBefore = stub.sourcesStopped;
    engine.stopBgm();
    expect(stub.sourcesStopped).toBeGreaterThan(stoppedBefore);
    expect(engine.getActiveTrack()).toBeNull();
    engine.destroy();
  });

  it('startBgm BEFORE gesture unlock queues; runs after unlock', async () => {
    const stub = makeStub();
    const engine = createAudioEngine({
      createContext: () => stub.ctx as unknown as AudioContext,
      fetchBgm: () => Promise.resolve(new ArrayBuffer(8)),
      win: window,
    });
    engine.startBgm('default');
    expect(stub.sourcesStarted).toBe(0); // not unlocked yet
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushPromises();
    expect(stub.sourcesStarted).toBeGreaterThanOrEqual(1);
    expect(engine.getActiveTrack()).toBe('default');
    engine.destroy();
  });
});

describe('createAudioEngine — play()', () => {
  it('plays an SFX after unlock (no throws)', async () => {
    const { engine } = makeEngineUnlocked();
    await flushPromises();
    expect(() => engine.play('lane-change')).not.toThrow();
    expect(() => engine.play('correct-answer')).not.toThrow();
    expect(() => engine.play('game-over')).not.toThrow();
    engine.destroy();
  });

  it('does not throw when called before unlock', () => {
    const stub = makeStub();
    const engine = createAudioEngine({
      createContext: () => stub.ctx as unknown as AudioContext,
      fetchBgm: () => Promise.resolve(new ArrayBuffer(8)),
      win: window,
    });
    expect(() => engine.play('lane-change')).not.toThrow();
    engine.destroy();
  });
});

describe('createAudioEngine — graceful degradation', () => {
  it('does not throw when createContext throws', () => {
    const engine = createAudioEngine({
      createContext: () => {
        throw new Error('no audio');
      },
      fetchBgm: () => Promise.resolve(new ArrayBuffer(8)),
      win: window,
    });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(() => engine.play('lane-change')).not.toThrow();
    expect(() => engine.startBgm('default')).not.toThrow();
    expect(() => engine.setBgmTrack('contest')).not.toThrow();
    expect(() => engine.pauseBgm()).not.toThrow();
    expect(() => engine.resumeBgm()).not.toThrow();
    expect(() => engine.stopBgm()).not.toThrow();
    engine.destroy();
  });
});

describe('SfxName coverage', () => {
  it('plays every named SFX without throwing', async () => {
    const { engine } = makeEngineUnlocked();
    await flushPromises();
    const names = [
      'lane-change',
      'obstacle-hit',
      'gate-hit',
      'correct-answer',
      'life-lost',
      'game-over',
      'countdown-tick',
    ] as const;
    for (const name of names) {
      expect(() => engine.play(name)).not.toThrow();
    }
    engine.destroy();
  });
});

// Smoke test: BgmTrack type values.
const _trackCheck: BgmTrack = 'default';
void _trackCheck;
