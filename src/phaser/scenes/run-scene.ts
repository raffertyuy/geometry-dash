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

  constructor() {
    super({ key: 'RunScene' });
  }

  create(): void {
    this.state = {
      player: createPlayerState(),
      world: startRun(createWorldState()),
    };

    this.adapter = createInputAdapter({
      now: () => performance.now(),
      emit: (e) => {
        this.state.lastInput = e;
        this.state.player = applyInput(this.state.player, e);
      },
    });

    this.runnerRenderer = createRunnerRenderer(this);
    this.overlay = createDebugOverlay(this);

    // Bridge Phaser keyboard events to the input-adapter.
    this.input.keyboard?.on(
      'keydown',
      (event: KeyboardEvent) => {
        this.adapter.handleKeyDown({ key: event.key, repeat: event.repeat });
      },
    );

    // Bridge Phaser pointer events to the input-adapter (touch path is a no-op
    // until US2 wires the swipe-detector).
    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer) => {
        this.adapter.handlePointerDown(pointer.x, pointer.y);
      },
    );
    this.input.on(
      'pointerup',
      (pointer: Phaser.Input.Pointer) => {
        this.adapter.handlePointerUp(pointer.x, pointer.y);
      },
    );

    // Tab visibility -> pause/resume.
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.handleHidden, this);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.handleVisible, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.handleHidden, this);
    this.game.events.on(Phaser.Core.Events.FOCUS, this.handleVisible, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  override update(_time: number, delta: number): void {
    const dtMs = delta;
    this.state.player = tickPlayer(this.state.player, dtMs);
    this.state.world = tickWorld(this.state.world, dtMs);
    this.runnerRenderer.draw(this.state.player, this.state.world);
    this.overlay.update(this.state.player, this.state.world, this.state.lastInput);
  }

  private handleHidden(): void {
    this.state.world = pauseRun(this.state.world);
  }

  private handleVisible(): void {
    this.state.world = resumeRun(this.state.world);
  }

  private shutdown(): void {
    this.runnerRenderer.destroy();
    this.overlay.destroy();
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.handleHidden, this);
    this.game.events.off(Phaser.Core.Events.VISIBLE, this.handleVisible, this);
    this.game.events.off(Phaser.Core.Events.BLUR, this.handleHidden, this);
    this.game.events.off(Phaser.Core.Events.FOCUS, this.handleVisible, this);
  }
}
