import { describe, expect, it } from 'vitest';
import { createInputAdapter } from './index';
import type { InputEvent } from '../shared/types';

function makeAdapter(initialNowMs = 0) {
  let now = initialNowMs;
  const emitted: InputEvent[] = [];
  const adapter = createInputAdapter({
    now: () => now,
    emit: (e) => emitted.push(e),
  });
  return {
    adapter,
    emitted,
    advance(ms: number) {
      now += ms;
    },
    setNow(ms: number) {
      now = ms;
    },
  };
}

describe('input-adapter keyboard path', () => {
  it('recognises ArrowLeft as direction left', () => {
    const { adapter, emitted } = makeAdapter();
    adapter.handleKeyDown({ key: 'ArrowLeft', repeat: false });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.direction).toBe('left');
    expect(emitted[0]?.source).toBe('keyboard');
  });

  it('recognises ArrowRight as direction right', () => {
    const { adapter, emitted } = makeAdapter();
    adapter.handleKeyDown({ key: 'ArrowRight', repeat: false });
    expect(emitted[0]?.direction).toBe('right');
  });

  it("recognises 'a' and 'A' as direction left", () => {
    const { adapter: a1, emitted: e1 } = makeAdapter();
    a1.handleKeyDown({ key: 'a', repeat: false });
    expect(e1[0]?.direction).toBe('left');

    const { adapter: a2, emitted: e2 } = makeAdapter();
    a2.handleKeyDown({ key: 'A', repeat: false });
    expect(e2[0]?.direction).toBe('left');
  });

  it("recognises 'd' and 'D' as direction right", () => {
    const { adapter: a1, emitted: e1 } = makeAdapter();
    a1.handleKeyDown({ key: 'd', repeat: false });
    expect(e1[0]?.direction).toBe('right');

    const { adapter: a2, emitted: e2 } = makeAdapter();
    a2.handleKeyDown({ key: 'D', repeat: false });
    expect(e2[0]?.direction).toBe('right');
  });

  it('ignores unrecognised keys', () => {
    const { adapter, emitted } = makeAdapter();
    adapter.handleKeyDown({ key: 'q', repeat: false });
    adapter.handleKeyDown({ key: 'ArrowUp', repeat: false });
    adapter.handleKeyDown({ key: 'Space', repeat: false });
    expect(emitted).toHaveLength(0);
  });

  it('suppresses keyboard auto-repeat events (repeat === true)', () => {
    const { adapter, emitted, advance } = makeAdapter();
    adapter.handleKeyDown({ key: 'ArrowRight', repeat: false });
    advance(50);
    adapter.handleKeyDown({ key: 'ArrowRight', repeat: true });
    advance(50);
    adapter.handleKeyDown({ key: 'ArrowRight', repeat: true });
    expect(emitted).toHaveLength(1);
  });

  it('stamps the emitted event with the injected now()', () => {
    const { adapter, emitted, setNow } = makeAdapter();
    setNow(12345);
    adapter.handleKeyDown({ key: 'ArrowRight', repeat: false });
    expect(emitted[0]?.timestampMs).toBe(12345);
  });
});

describe('input-adapter coalesce window', () => {
  it('coalesces two same-direction events within 50 ms into one', () => {
    const { adapter, emitted, advance } = makeAdapter();
    adapter.handleKeyDown({ key: 'ArrowRight', repeat: false });
    advance(30);
    adapter.handleKeyDown({ key: 'd', repeat: false });
    expect(emitted).toHaveLength(1);
  });

  it('emits both when the same-direction events are > 50 ms apart', () => {
    const { adapter, emitted, advance } = makeAdapter();
    adapter.handleKeyDown({ key: 'ArrowRight', repeat: false });
    advance(60);
    adapter.handleKeyDown({ key: 'd', repeat: false });
    expect(emitted).toHaveLength(2);
  });

  it('does NOT coalesce opposite-direction events within 50 ms', () => {
    const { adapter, emitted, advance } = makeAdapter();
    adapter.handleKeyDown({ key: 'ArrowRight', repeat: false });
    advance(30);
    adapter.handleKeyDown({ key: 'ArrowLeft', repeat: false });
    expect(emitted).toHaveLength(2);
    expect(emitted[0]?.direction).toBe('right');
    expect(emitted[1]?.direction).toBe('left');
  });
});

describe('input-adapter touch path', () => {
  it('emits a right swipe InputEvent when pointer travels >= 30 px right within 500 ms', () => {
    const { adapter, emitted, advance } = makeAdapter();
    adapter.handlePointerDown(100, 500);
    advance(200);
    adapter.handlePointerUp(150, 500);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.direction).toBe('right');
    expect(emitted[0]?.source).toBe('touch');
  });

  it('emits a left swipe InputEvent when pointer travels >= 30 px left within 500 ms', () => {
    const { adapter, emitted, advance } = makeAdapter();
    adapter.handlePointerDown(150, 500);
    advance(200);
    adapter.handlePointerUp(100, 500);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.direction).toBe('left');
    expect(emitted[0]?.source).toBe('touch');
  });

  it('does not emit when the gesture is too short (< 30 px)', () => {
    const { adapter, emitted, advance } = makeAdapter();
    adapter.handlePointerDown(100, 500);
    advance(200);
    adapter.handlePointerUp(120, 500);
    expect(emitted).toHaveLength(0);
  });

  it('does not emit when the gesture is too slow (> 500 ms)', () => {
    const { adapter, emitted, advance } = makeAdapter();
    adapter.handlePointerDown(100, 500);
    advance(600);
    adapter.handlePointerUp(200, 500);
    expect(emitted).toHaveLength(0);
  });

  it('does not emit when the gesture is mostly vertical', () => {
    const { adapter, emitted, advance } = makeAdapter();
    adapter.handlePointerDown(100, 500);
    advance(200);
    adapter.handlePointerUp(150, 560); // 50 px horizontal vs 60 px vertical
    expect(emitted).toHaveLength(0);
  });

  it('ignores pointer-up with no preceding pointer-down', () => {
    const { adapter, emitted } = makeAdapter();
    adapter.handlePointerUp(200, 500);
    expect(emitted).toHaveLength(0);
  });

  it('coalesces a touch swipe within 50 ms of a same-direction keyboard input', () => {
    const { adapter, emitted, advance } = makeAdapter();
    adapter.handleKeyDown({ key: 'ArrowRight', repeat: false });
    advance(20);
    adapter.handlePointerDown(100, 500);
    advance(10); // total 30 ms since keyboard event
    adapter.handlePointerUp(150, 500);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.source).toBe('keyboard');
  });

  it('does NOT coalesce a touch swipe with an opposite-direction keyboard input', () => {
    const { adapter, emitted, advance } = makeAdapter();
    adapter.handleKeyDown({ key: 'ArrowRight', repeat: false });
    advance(20);
    adapter.handlePointerDown(150, 500);
    advance(10);
    adapter.handlePointerUp(100, 500); // left swipe
    expect(emitted).toHaveLength(2);
    expect(emitted[0]?.direction).toBe('right');
    expect(emitted[1]?.direction).toBe('left');
    expect(emitted[1]?.source).toBe('touch');
  });
});
