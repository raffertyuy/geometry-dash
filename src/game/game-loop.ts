import { createInputAdapter, type InputAdapter } from '../input-adapter';
import { applyInput, createPlayerState, tickPlayer } from '../lane-state';
import {
  createWorldState,
  pauseRun,
  resumeRun,
  startRun,
  tickWorld,
} from '../runner-engine';
import {
  createDebugOverlay,
  createThreeRenderer,
  type DebugOverlay,
  type ThreeRenderer,
} from '../renderer';
import type { InputEvent, PlayerState, WorldState } from '../shared/types';

const MAX_FRAME_DT_MS = 100;

export interface GameLoopHostElements {
  readonly canvas: HTMLCanvasElement;
  readonly startScreen: HTMLElement;
  readonly pauseOverlay: HTMLElement;
  readonly debugOverlay: HTMLElement;
}

export interface GameLoopHandles {
  dispose(): void;
}

type LoopState = 'start-screen' | 'running' | 'paused';

export function createGameLoop(host: GameLoopHostElements): GameLoopHandles {
  let player: PlayerState = createPlayerState();
  let world: WorldState = createWorldState();
  let lastInput: InputEvent | undefined;
  let loopState: LoopState = 'start-screen';
  let isAwaitingResume = false;

  const adapter: InputAdapter = createInputAdapter({
    now: () => performance.now(),
    emit: (e) => {
      lastInput = e;
      player = applyInput(player, e);
    },
  });

  const renderer: ThreeRenderer = createThreeRenderer(host.canvas);
  const debugOverlay: DebugOverlay = createDebugOverlay(host.debugOverlay);

  function showStartScreen(visible: boolean): void {
    host.startScreen.classList.toggle('hidden', !visible);
  }

  function showPauseOverlay(visible: boolean): void {
    host.pauseOverlay.classList.toggle('hidden', !visible);
  }

  function beginRun(): void {
    loopState = 'running';
    world = startRun(world);
    showStartScreen(false);
  }

  function pauseFromBlur(): void {
    if (loopState !== 'running') return;
    world = pauseRun(world);
    loopState = 'paused';
    showPauseOverlay(true);
  }

  function markAwaitingResume(): void {
    if (loopState === 'paused') {
      isAwaitingResume = true;
    }
  }

  function resumeFromInput(): void {
    world = resumeRun(world);
    loopState = 'running';
    isAwaitingResume = false;
    showPauseOverlay(false);
  }

  // ---- DOM event bridging ----

  function onKeyDown(event: KeyboardEvent): void {
    if (loopState === 'start-screen') {
      beginRun();
      return; // do not also drive lane-state with the press that started the run
    }
    if (isAwaitingResume) {
      resumeFromInput();
      return;
    }
    adapter.handleKeyDown({ key: event.key, repeat: event.repeat });
  }

  function onPointerDown(event: PointerEvent): void {
    if (loopState === 'start-screen') {
      beginRun();
      return;
    }
    if (isAwaitingResume) {
      resumeFromInput();
      return;
    }
    adapter.handlePointerDown(event.clientX, event.clientY);
  }

  function onPointerUp(event: PointerEvent): void {
    if (isAwaitingResume || loopState !== 'running') return;
    adapter.handlePointerUp(event.clientX, event.clientY);
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      pauseFromBlur();
    } else {
      markAwaitingResume();
    }
  }

  function onBlur(): void {
    pauseFromBlur();
  }

  function onFocus(): void {
    markAwaitingResume();
  }

  function onResize(): void {
    renderer.resize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Sync renderer to actual viewport size at start (the canvas attribute size
  // may differ from CSS size until the first resize call).
  renderer.resize(window.innerWidth, window.innerHeight);

  // Ensure start screen is visible up-front, pause overlay hidden.
  showStartScreen(true);
  showPauseOverlay(false);

  // ---- rAF loop ----

  let lastTimeMs = performance.now();
  let rafId = 0;
  let disposed = false;

  function frame(nowMs: number): void {
    if (disposed) return;
    rafId = requestAnimationFrame(frame);

    const rawDt = nowMs - lastTimeMs;
    lastTimeMs = nowMs;
    const dtMs = Math.min(rawDt, MAX_FRAME_DT_MS);

    if (loopState === 'running' && !isAwaitingResume) {
      player = tickPlayer(player, dtMs);
      world = tickWorld(world, dtMs);
    }

    renderer.draw(player, world);
    debugOverlay.update(player, world, lastInput);
  }

  rafId = requestAnimationFrame(frame);

  function dispose(): void {
    disposed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    debugOverlay.destroy();
    renderer.destroy();
  }

  return { dispose };
}
