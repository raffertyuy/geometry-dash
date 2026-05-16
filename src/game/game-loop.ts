import { currentTier, speedMultiplier } from '../escalation';
import { createInputAdapter, type InputAdapter } from '../input-adapter';
import { applyInput, createPlayerState, tickPlayer } from '../lane-state';
import {
  collidesAt,
  createSpawnSchedule,
  nextObstacleGroup,
  type ObstacleSpawnSchedule,
} from '../obstacles';
import {
  createWorldState,
  endRun,
  pauseRun,
  restartRun,
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
import { computeScore, formatScore, formatTimer } from '../score';
import { RUN_SPEED_UNITS_PER_SEC } from '../shared/config';
import type {
  InputEvent,
  ObstacleGroup,
  PlayerState,
  WorldState,
} from '../shared/types';

const MAX_FRAME_DT_MS = 100;
const OBSTACLE_CULL_Z = 14; // anything past z=14 has scrolled behind the camera

export interface GameLoopHostElements {
  readonly canvas: HTMLCanvasElement;
  readonly startScreen: HTMLElement;
  readonly pauseOverlay: HTMLElement;
  readonly debugOverlay: HTMLElement;
  readonly score: HTMLElement;
  readonly timer: HTMLElement;
  readonly gameOverOverlay: HTMLElement;
  readonly gameOverScore: HTMLElement;
  readonly gameOverTimer: HTMLElement;
}

export interface GameLoopHandles {
  dispose(): void;
}

type LoopState = 'start-screen' | 'running' | 'paused' | 'game-over';

function freshSeed(): number {
  return (performance.now() * 1000) ^ 0x9e3779b9;
}

export function createGameLoop(host: GameLoopHostElements): GameLoopHandles {
  let player: PlayerState = createPlayerState();
  let world: WorldState = createWorldState();
  let lastInput: InputEvent | undefined;
  let loopState: LoopState = 'start-screen';
  let isAwaitingResume = false;
  let isAwaitingRestart = false;
  let obstacles: ObstacleGroup[] = [];
  let spawnSchedule: ObstacleSpawnSchedule = createSpawnSchedule(freshSeed());
  let lastObservedTier = 0;

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

  function showGameOverOverlay(visible: boolean): void {
    host.gameOverOverlay.classList.toggle('hidden', !visible);
  }

  function beginRun(): void {
    loopState = 'running';
    world = startRun(world);
    showStartScreen(false);
  }

  function triggerGameOver(): void {
    world = endRun(world);
    loopState = 'game-over';
    isAwaitingRestart = true;
    host.gameOverScore.textContent = formatScore(computeScore(world.tickMs));
    host.gameOverTimer.textContent = formatTimer(world.tickMs);
    showGameOverOverlay(true);
  }

  function restartFromInput(): void {
    world = restartRun(world);
    player = createPlayerState();
    obstacles = [];
    spawnSchedule = createSpawnSchedule(freshSeed());
    lastInput = undefined;
    lastObservedTier = 0;
    loopState = 'running';
    isAwaitingRestart = false;
    showGameOverOverlay(false);
    // Reset renderer's per-run caches (lastDistance, rung positions, trail
    // buffer) so the world doesn't "rewind" hugely on the first frame after
    // restart.
    renderer.reset();
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
    if (isAwaitingRestart) {
      restartFromInput();
      return; // consumed; no lane change
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
    if (isAwaitingRestart) {
      restartFromInput();
      return;
    }
    if (isAwaitingResume) {
      resumeFromInput();
      return;
    }
    adapter.handlePointerDown(event.clientX, event.clientY);
  }

  function onPointerUp(event: PointerEvent): void {
    if (isAwaitingResume || isAwaitingRestart || loopState !== 'running') return;
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

  // Ensure start screen is visible up-front, other overlays hidden.
  showStartScreen(true);
  showPauseOverlay(false);
  showGameOverOverlay(false);

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
      // Every-30s tier-based escalation: tier rises with elapsed running
      // time; speed scales 1.10x per tier (handled here as a speedOverride);
      // score-per-tick scaling is handled inside computeScore.
      const tier = currentTier(world.tickMs);
      if (tier !== lastObservedTier) {
        console.debug({
          event: 'tier_advanced',
          previousTier: lastObservedTier,
          newTier: tier,
          tickMs: world.tickMs,
        });
        lastObservedTier = tier;
      }
      const effectiveSpeed = RUN_SPEED_UNITS_PER_SEC * speedMultiplier(tier);
      const previousDistance = world.distanceUnits;
      world = tickWorld(world, dtMs, effectiveSpeed);
      const distanceDelta = world.distanceUnits - previousDistance;

      // Advance each obstacle's worldZ; track previousWorldZ for collision.
      for (const obstacle of obstacles) {
        obstacle.previousWorldZ = obstacle.worldZ;
        obstacle.worldZ += distanceDelta;
      }

      // Collision check on the nearest unpassed group (the one with the
      // smallest non-negative worldZ that just crossed, or any candidate).
      for (const obstacle of obstacles) {
        if (collidesAt(player, obstacle)) {
          triggerGameOver();
          break;
        }
      }

      // Spawn the next obstacle group whenever the player has run past the
      // schedule's next-distance marker.
      while (
        loopState === 'running' &&
        world.distanceUnits >= spawnSchedule.nextSpawnDistance
      ) {
        const result = nextObstacleGroup(spawnSchedule);
        obstacles.push(result.group);
        spawnSchedule = result.schedule;
      }

      // Cull obstacles that have scrolled behind the camera.
      obstacles = obstacles.filter((o) => o.worldZ <= OBSTACLE_CULL_Z);
    }

    renderer.updateObstacles(obstacles);
    renderer.draw(player, world);
    debugOverlay.update(player, world, lastInput);
    host.score.textContent = formatScore(computeScore(world.tickMs));
    host.timer.textContent = formatTimer(world.tickMs);
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
