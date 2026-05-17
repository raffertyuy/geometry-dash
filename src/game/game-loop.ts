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
  GATE_CATALOGUE,
  augmentRowWithGates,
  createGateSpawnState,
  gateCollidesAt,
  type GateSpawnState,
} from '../problem-gates';
import {
  consumeLife,
  createWorldState,
  endRun,
  enterAnswering,
  pauseRun,
  resolveAnswer,
  restartRun,
  resumeRun,
  startRun,
  tickInvincibility,
  tickWorld,
} from '../runner-engine';
import { PROBLEM_SOURCES } from '../problems/sources';
import {
  createDebugOverlay,
  createFloatingScore,
  createHowToPlayModal,
  createLivesHud,
  createMuteButton,
  createPauseButton,
  createProblemModal,
  createThreeRenderer,
  type DebugOverlay,
  type FloatingScore,
  type HowToPlayModal,
  type LivesHud,
  type MuteButton,
  type PauseButton,
  type ProblemModal,
  type ThreeRenderer,
} from '../renderer';
import { createAudioEngine, type AudioEngine } from '../audio';
import { computeScore, formatScore, formatTimer } from '../score';
import { MAX_LIVES, RUN_SPEED_UNITS_PER_SEC } from '../shared/config';
import type {
  InputEvent,
  ObstacleGroup,
  PlayerState,
  ProblemGate,
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
  readonly livesHud: HTMLElement;
  readonly gameOverOverlay: HTMLElement;
  readonly gameOverScore: HTMLElement;
  readonly gameOverTimer: HTMLElement;
  readonly problemModal: HTMLElement;
  readonly floatingScores: HTMLElement;
  readonly howToPlayOverlay: HTMLElement;
  readonly howToPlayLinkStart: HTMLElement;
  readonly howToPlayLinkGameOver: HTMLElement;
  readonly pauseButton: HTMLButtonElement;
  readonly muteButton: HTMLButtonElement;
}

/**
 * Resolve a gate answer + apply the score-floor rule.
 *
 * A wrong answer always costs exactly one life (via `resolveAnswer`).
 * If that life-loss already transitioned to game-over (lives reached
 * zero), return as-is. Otherwise, if the resulting score is below
 * zero, clamp the score back to zero by bumping `scoreDelta` so the
 * tick-derived score plus the new delta equals zero. The run
 * continues; only zero-lives ends the game.
 *
 * Pure function — extracted so the rule is unit-testable.
 */
export function applyAnswerToWorld(
  world: WorldState,
  isCorrect: boolean,
  points: number,
): WorldState {
  const next = resolveAnswer(world, isCorrect, points);
  if (next.runState === 'game-over') return next;
  const total = computeScore(next.tickMs, next.scoreDelta);
  if (total < 0) {
    // Clamp to exactly 0: new scoreDelta such that tickScore + delta = 0.
    return { ...next, scoreDelta: next.scoreDelta - total };
  }
  return next;
}

/**
 * Pure derivation of the Pause button's display state from the world state
 * + modal visibility. Exposed for testing per spec SC-005 / data-model §2.
 */
export function derivePauseButtonState(
  loopState: LoopState,
  world: WorldState,
  howToPlayModalVisible: boolean,
): { readonly visible: boolean; readonly enabled: boolean } {
  const visible = loopState === 'running';
  const enabled =
    visible &&
    world.runState === 'running' &&
    world.invincibilityRemainingMs === 0 &&
    !howToPlayModalVisible;
  return { visible, enabled };
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
  let gates: ProblemGate[] = [];
  let spawnSchedule: ObstacleSpawnSchedule = createSpawnSchedule(freshSeed());
  let gateSpawnState: GateSpawnState = createGateSpawnState(freshSeed());
  let lastObservedTier = 0;

  const audioEngine: AudioEngine = createAudioEngine();

  const adapter: InputAdapter = createInputAdapter({
    now: () => performance.now(),
    emit: (e) => {
      lastInput = e;
      player = applyInput(player, e);
    },
    onLaneChangeAttempt: () => audioEngine.play('lane-change'),
  });

  const renderer: ThreeRenderer = createThreeRenderer(host.canvas);
  const debugOverlay: DebugOverlay = createDebugOverlay(host.debugOverlay);
  const livesHud: LivesHud = createLivesHud(host.livesHud);
  const problemModal: ProblemModal = createProblemModal(host.problemModal, {
    onCountdownTick: () => audioEngine.play('countdown-tick'),
    onAnswerCommitted: (isCorrect) =>
      audioEngine.play(isCorrect ? 'correct-answer' : 'life-lost'),
  });
  const floatingScore: FloatingScore = createFloatingScore(host.floatingScores);
  function resumeFromPauseButton(): void {
    if (loopState !== 'paused') return;
    world = resumeRun(world);
    loopState = 'running';
    audioEngine.resumeBgm();
  }
  const howToPlayModal: HowToPlayModal = createHowToPlayModal(
    host.howToPlayOverlay,
    PROBLEM_SOURCES,
    resumeFromPauseButton,
  );
  function openHowToPlayEntry(event: Event): void {
    event.stopPropagation();
    howToPlayModal.show('entry');
  }
  function stopHowToPlayLinkPointer(event: Event): void {
    // The window-level onPointerDown handler would otherwise read this
    // bubble and call beginRun() / restartFromInput() before our click
    // listener fires. Swallow it so the link tap is only a link tap.
    event.stopPropagation();
  }
  host.howToPlayLinkStart.addEventListener('click', openHowToPlayEntry);
  host.howToPlayLinkGameOver.addEventListener('click', openHowToPlayEntry);
  host.howToPlayLinkStart.addEventListener('pointerdown', stopHowToPlayLinkPointer);
  host.howToPlayLinkGameOver.addEventListener('pointerdown', stopHowToPlayLinkPointer);
  host.howToPlayLinkStart.addEventListener('pointerup', stopHowToPlayLinkPointer);
  host.howToPlayLinkGameOver.addEventListener('pointerup', stopHowToPlayLinkPointer);

  function onPauseButtonPressed(): void {
    if (loopState !== 'running') return;
    if (howToPlayModal.isVisible()) return;
    world = pauseRun(world);
    loopState = 'paused';
    audioEngine.pauseBgm();
    howToPlayModal.show('pause');
    console.debug({
      event: 'pause_button_pressed',
      source: 'click',
      tickMs: world.tickMs,
    });
  }
  const pauseButton: PauseButton = createPauseButton(
    host.pauseButton,
    onPauseButtonPressed,
  );
  const muteButton: MuteButton = createMuteButton(host.muteButton, () => {
    audioEngine.setMuted(!audioEngine.isMuted());
    muteButton.setMuted(audioEngine.isMuted());
  });
  muteButton.setMuted(audioEngine.isMuted());
  livesHud.set(MAX_LIVES);

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
    audioEngine.startBgm('default');
  }

  function triggerGameOver(): void {
    // endRun is a no-op when world.runState is already 'game-over' (the
    // typical case after consumeLife or the score-below-zero check
    // transitioned us). The call stays for the legacy path where some
    // future code might still rely on triggerGameOver to do the transition.
    world = endRun(world);
    loopState = 'game-over';
    isAwaitingRestart = true;
    audioEngine.stopBgm();
    audioEngine.play('game-over');
    // Display the TOTAL score (tick-derived + scoreDelta). For the score-
    // below-zero game-over path this is negative; per spec FR-015 we show
    // the actual value verbatim with the minus sign, no clamping.
    host.gameOverScore.textContent = formatScore(
      computeScore(world.tickMs, world.scoreDelta),
    );
    host.gameOverTimer.textContent = formatTimer(world.tickMs);
    showGameOverOverlay(true);
  }

  function restartFromInput(): void {
    world = restartRun(world);
    player = createPlayerState();
    obstacles = [];
    gates = [];
    spawnSchedule = createSpawnSchedule(freshSeed());
    gateSpawnState = createGateSpawnState(freshSeed());
    lastInput = undefined;
    lastObservedTier = 0;
    loopState = 'running';
    isAwaitingRestart = false;
    showGameOverOverlay(false);
    problemModal.hide();
    livesHud.set(world.lives);
    // Reset renderer's per-run caches (lastDistance, rung positions, trail
    // buffer) so the world doesn't "rewind" hugely on the first frame after
    // restart.
    renderer.reset();
    audioEngine.startBgm('default');
  }

  function pauseFromBlur(): void {
    if (loopState !== 'running') return;
    world = pauseRun(world);
    loopState = 'paused';
    audioEngine.pauseBgm();
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
    audioEngine.resumeBgm();
    showPauseOverlay(false);
  }

  // Shows the answer modal for the given gate and registers a commit
  // callback that (a) writes the answer-driven score change via
  // resolveAnswer, (b) pops the floating "+N" / "-N" badge, (c) checks the
  // score-below-zero game-over condition (spec FR-013(b)) which lives in
  // the game-loop since it needs computeScore from the score module.
  function showProblemModal(gate: ProblemGate): void {
    const points = GATE_CATALOGUE[gate.difficulty].points;
    audioEngine.play('gate-hit');
    audioEngine.setBgmTrack('contest');
    problemModal.show(gate.problem, (result) => {
      const isCorrect =
        result.kind === 'pick' && result.choiceIndex === gate.problem.correctIndex;
      world = applyAnswerToWorld(world, isCorrect, points);
      floatingScore.pop(
        isCorrect ? `+${points}` : `-${points}`,
        isCorrect ? 'green' : 'red',
      );
      // Note: answer SFX already played on commit via onAnswerCommitted
      // (modal deps). Don't double-play it here.
      // Push the new lives count to the HUD immediately so the player
      // sees the deduction even when game-over fires on the same tick
      // and short-circuits the per-frame HUD update.
      livesHud.set(world.lives);
      if (world.runState === 'game-over' && !isCorrect) {
        console.debug({
          event: 'run_ended',
          cause: 'wrong-answer',
          tickMs: world.tickMs,
        });
      }
      problemModal.hide();
      if (world.runState === 'game-over') {
        triggerGameOver();
      } else {
        // Run continues — swap back to default BGM.
        audioEngine.setBgmTrack('default');
      }
    });
  }

  // ---- DOM event bridging ----

  function onKeyDown(event: KeyboardEvent): void {
    // Mute toggle is global — works in every loop state regardless of any
    // modal being open.
    if (event.key === 'm' || event.key === 'M') {
      audioEngine.setMuted(!audioEngine.isMuted());
      muteButton.setMuted(audioEngine.isMuted());
      return;
    }
    // How-to-Play modal owns the keyboard while visible (its own ESC/SPACE
    // capture listener closes it). Don't let stray keystrokes start or
    // restart the run behind it.
    if (howToPlayModal.isVisible()) return;
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
    // ESC / SPACE during an actively running run → open pause-mode How-to-Play.
    if (
      loopState === 'running' &&
      pauseButton.isEnabled() &&
      (event.key === 'Escape' || event.key === ' ')
    ) {
      onPauseButtonPressed();
      return;
    }
    // Modal owns its own keyboard listeners (window-level) while open; the
    // game-loop ignores lane-change keys during 'answering' so a stray
    // arrow-key doesn't steer the runner into a wall on resume.
    if (world.runState === 'answering') return;
    adapter.handleKeyDown({ key: event.key, repeat: event.repeat });
  }

  function onPointerDown(event: PointerEvent): void {
    // While the How-to-Play modal is up, taps either land inside its body
    // or hit the backdrop. The modal's own click handler closes on backdrop
    // hits; the game-loop should not also start or restart the run.
    if (howToPlayModal.isVisible()) return;
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
    // The modal owns its own click/pointerdown listeners scoped to its host.
    // Pointer events anywhere else are ignored while answering so a stray
    // tap doesn't trigger a swipe gesture.
    if (world.runState === 'answering') return;
    adapter.handlePointerDown(event.clientX, event.clientY);
  }

  function onPointerUp(event: PointerEvent): void {
    if (isAwaitingResume || isAwaitingRestart || loopState !== 'running') return;
    if (world.runState === 'answering') return;
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

    // The per-frame world update runs only while truly running. 'answering'
    // (modal open) and 'paused' / 'game-over' all skip the block.
    if (
      loopState === 'running' &&
      !isAwaitingResume &&
      world.runState === 'running'
    ) {
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
      world = tickInvincibility(world, dtMs);
      const distanceDelta = world.distanceUnits - previousDistance;

      // Advance each obstacle's worldZ; track previousWorldZ for collision.
      for (const obstacle of obstacles) {
        obstacle.previousWorldZ = obstacle.worldZ;
        obstacle.worldZ += distanceDelta;
      }
      // Advance each gate's worldZ; same mechanism as obstacles.
      for (const gate of gates) {
        gate.previousWorldZ = gate.worldZ;
        gate.worldZ += distanceDelta;
      }

      // Gate collisions run before obstacle collisions: a gate hit freezes
      // the world via enterAnswering, after which the per-frame loop will
      // skip further updates until the modal commits.
      const consumedGateIds = new Set<number>();
      for (const gate of gates) {
        if (!gateCollidesAt(player, gate)) continue;
        if (world.invincibilityRemainingMs > 0) {
          // Invincibility absorbs gates too (per spec FR-012): no modal,
          // no score change. The gate is silently consumed.
          consumedGateIds.add(gate.id);
          continue;
        }
        // First gate hit this frame: enter answering + show modal.
        consumedGateIds.add(gate.id);
        world = enterAnswering(world, gate);
        showProblemModal(gate);
        break;
      }
      if (consumedGateIds.size > 0) {
        gates = gates.filter((g) => !consumedGateIds.has(g.id));
      }

      // Obstacle collisions. If invincibility is active they pass harmlessly.
      // Otherwise consume a life and (if lives remain) respawn the runner
      // in the centre lane; the centre-lane respawn is handled by
      // re-initialising the player state.
      if (world.runState === 'running') {
        const consumedObstacleIds = new Set<number>();
        for (const obstacle of obstacles) {
          if (!collidesAt(player, obstacle)) continue;
          if (world.invincibilityRemainingMs > 0) {
            consumedObstacleIds.add(obstacle.id);
            continue;
          }
          consumedObstacleIds.add(obstacle.id);
          audioEngine.play('obstacle-hit');
          world = consumeLife(world, 'obstacle');
          if (world.runState === 'game-over') {
            triggerGameOver();
            break;
          }
          audioEngine.play('life-lost');
          // Respawn in centre lane; obstacle is despawned so the same hit
          // doesn't re-fire next frame.
          player = createPlayerState();
        }
        if (consumedObstacleIds.size > 0) {
          obstacles = obstacles.filter((o) => !consumedObstacleIds.has(o.id));
        }
      }

      // Spawn the next obstacle row whenever the player has run past the
      // schedule's next-distance marker. Each row is augmented with gates
      // in any non-obstacle lanes.
      while (
        loopState === 'running' &&
        world.runState === 'running' &&
        world.distanceUnits >= spawnSchedule.nextSpawnDistance
      ) {
        const result = nextObstacleGroup(spawnSchedule);
        obstacles.push(result.group);
        spawnSchedule = result.schedule;

        const aug = augmentRowWithGates(
          result.group.blockedLanes,
          result.group.worldZ,
          gateSpawnState,
        );
        for (const g of aug.gates) gates.push(g);
        gateSpawnState = aug.state;
      }

      // Cull obstacles AND gates that have scrolled behind the camera.
      obstacles = obstacles.filter((o) => o.worldZ <= OBSTACLE_CULL_Z);
      gates = gates.filter((g) => g.worldZ <= OBSTACLE_CULL_Z);
    }

    renderer.updateObstacles(obstacles);
    renderer.updateGates(gates, world.tickMs);
    renderer.draw(player, world);
    debugOverlay.update(player, world, lastInput, problemModal.getDebugSnapshot());
    livesHud.set(world.lives);
    const pbState = derivePauseButtonState(loopState, world, howToPlayModal.isVisible());
    pauseButton.setVisible(pbState.visible);
    pauseButton.setEnabled(pbState.enabled);
    muteButton.setMuted(audioEngine.isMuted());
    host.score.textContent = formatScore(
      computeScore(world.tickMs, world.scoreDelta),
    );
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
    host.howToPlayLinkStart.removeEventListener('click', openHowToPlayEntry);
    host.howToPlayLinkGameOver.removeEventListener('click', openHowToPlayEntry);
    host.howToPlayLinkStart.removeEventListener('pointerdown', stopHowToPlayLinkPointer);
    host.howToPlayLinkGameOver.removeEventListener('pointerdown', stopHowToPlayLinkPointer);
    host.howToPlayLinkStart.removeEventListener('pointerup', stopHowToPlayLinkPointer);
    host.howToPlayLinkGameOver.removeEventListener('pointerup', stopHowToPlayLinkPointer);
    howToPlayModal.destroy();
    pauseButton.destroy();
    muteButton.destroy();
    audioEngine.destroy();
    problemModal.destroy();
    floatingScore.destroy();
    livesHud.destroy();
    debugOverlay.destroy();
    renderer.destroy();
  }

  return { dispose };
}
