import Phaser from 'phaser';
import { createInputAdapter, type InputAdapter } from '../../input-adapter';
import { applyInput, createPlayerState, tickPlayer } from '../../lane-state';
import {
  createWorldState,
  pauseRun,
  resumeRun,
  startRun,
  tickWorld,
} from '../../runner-engine';
import {
  createDebugOverlay,
  createRunnerRenderer,
  type DebugOverlay,
  type RunnerRenderer,
} from '../../renderer';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../../shared/config';
import type { InputEvent, PlayerState, WorldState } from '../../shared/types';

interface RunSceneState {
  player: PlayerState;
  world: WorldState;
  lastInput?: InputEvent;
}

export class RunScene extends Phaser.Scene {
  private runnerRenderer!: RunnerRenderer;
  private overlay!: DebugOverlay;
  private adapter!: InputAdapter;
  private state!: RunSceneState;

  private pauseOverlay!: Phaser.GameObjects.Container;
  private isAwaitingResume = false;

  constructor() {
    super({ key: 'RunScene' });
  }

  create(): void {
    this.state = {
      player: createPlayerState(),
      world: startRun(createWorldState()),
    };
    this.isAwaitingResume = false;

    this.adapter = createInputAdapter({
      now: () => performance.now(),
      emit: (e) => {
        this.state.lastInput = e;
        this.state.player = applyInput(this.state.player, e);
      },
    });

    this.runnerRenderer = createRunnerRenderer(this);
    this.overlay = createDebugOverlay(this);

    this.buildPauseOverlay();

    // Bridge Phaser keyboard events to either resume-from-pause or the input-adapter.
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.isAwaitingResume) {
        this.resumeFromPause();
        return;
      }
      this.adapter.handleKeyDown({ key: event.key, repeat: event.repeat });
    });

    // Bridge Phaser pointer events. handlePointerUp completes a swipe gesture.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isAwaitingResume) {
        this.resumeFromPause();
        return;
      }
      this.adapter.handlePointerDown(pointer.x, pointer.y);
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isAwaitingResume) return;
      this.adapter.handlePointerUp(pointer.x, pointer.y);
    });

    // Tab visibility / focus -> pause when leaving, await-resume when returning.
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.handleHidden, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.handleHidden, this);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.handleReturned, this);
    this.game.events.on(Phaser.Core.Events.FOCUS, this.handleReturned, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  override update(_time: number, delta: number): void {
    if (this.isAwaitingResume) return; // Frozen on the pause screen.

    const dtMs = delta;
    this.state.player = tickPlayer(this.state.player, dtMs);
    this.state.world = tickWorld(this.state.world, dtMs);
    this.runnerRenderer.draw(this.state.player, this.state.world);
    this.overlay.update(this.state.player, this.state.world, this.state.lastInput);
  }

  private buildPauseOverlay(): void {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;

    const bg = this.add.rectangle(
      cx,
      cy,
      LOGICAL_WIDTH,
      LOGICAL_HEIGHT,
      0x000000,
      0.7,
    );

    const title = this.add
      .text(cx, cy - 40, 'Paused', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '72px',
        color: '#e8e8ef',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(cx, cy + 60, 'Tap or press any key to resume', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '32px',
        color: '#9090a0',
      })
      .setOrigin(0.5);

    this.pauseOverlay = this.add.container(0, 0, [bg, title, hint]);
    this.pauseOverlay.setDepth(2000);
    this.pauseOverlay.setVisible(false);
  }

  private handleHidden(): void {
    // Tab is now hidden / window blurred. Pause the world; user can't see the
    // overlay yet but it will be ready for them when they return.
    if (this.state.world.runState === 'running') {
      this.state.world = pauseRun(this.state.world);
      this.pauseOverlay.setVisible(true);
    }
  }

  private handleReturned(): void {
    // Tab visible / window focused again. Stay paused; require an input gesture
    // to resume. This satisfies spec FR-011: resume requires a focus-receiving
    // event from the player.
    if (this.state.world.runState === 'paused') {
      this.isAwaitingResume = true;
    }
  }

  private resumeFromPause(): void {
    this.state.world = resumeRun(this.state.world);
    this.pauseOverlay.setVisible(false);
    this.isAwaitingResume = false;
  }

  private shutdown(): void {
    this.runnerRenderer.destroy();
    this.overlay.destroy();
    this.pauseOverlay.destroy();
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.handleHidden, this);
    this.game.events.off(Phaser.Core.Events.BLUR, this.handleHidden, this);
    this.game.events.off(Phaser.Core.Events.VISIBLE, this.handleReturned, this);
    this.game.events.off(Phaser.Core.Events.FOCUS, this.handleReturned, this);
  }
}
