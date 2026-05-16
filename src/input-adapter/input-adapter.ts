import { INPUT_COALESCE_WINDOW_MS } from '../shared/config';
import type { Direction, InputEvent, InputSource } from '../shared/types';

export interface InputAdapterDeps {
  readonly now: () => number;
  readonly emit: (e: InputEvent) => void;
}

export interface InputAdapter {
  handleKeyDown(e: { key: string; repeat: boolean }): void;
  handlePointerDown(x: number, y: number): void;
  handlePointerMove(x: number, y: number): void;
  handlePointerUp(x: number, y: number): void;
}

const LEFT_KEYS = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT_KEYS = new Set(['ArrowRight', 'd', 'D']);

function recogniseKey(key: string): Direction | null {
  if (LEFT_KEYS.has(key)) return 'left';
  if (RIGHT_KEYS.has(key)) return 'right';
  return null;
}

export function createInputAdapter(deps: InputAdapterDeps): InputAdapter {
  const { now, emit } = deps;
  let lastEmitTimeMs: number | null = null;
  let lastEmitDirection: Direction | null = null;

  function tryEmit(direction: Direction, source: InputSource): void {
    const timestampMs = now();
    if (
      lastEmitTimeMs !== null &&
      lastEmitDirection === direction &&
      timestampMs - lastEmitTimeMs < INPUT_COALESCE_WINDOW_MS
    ) {
      // Coalesced: drop duplicate.
      return;
    }
    lastEmitTimeMs = timestampMs;
    lastEmitDirection = direction;
    emit({ direction, source, timestampMs });
  }

  return {
    handleKeyDown(e) {
      if (e.repeat) return;
      const dir = recogniseKey(e.key);
      if (dir === null) return;
      tryEmit(dir, 'keyboard');
    },
    handlePointerDown(_x, _y) {
      // Touch path is implemented in US2 (T032/T033). No-op for now.
    },
    handlePointerMove(_x, _y) {
      // No-op; swipe is end-to-end and does not require move samples.
    },
    handlePointerUp(_x, _y) {
      // Touch path is implemented in US2.
    },
  };
}
