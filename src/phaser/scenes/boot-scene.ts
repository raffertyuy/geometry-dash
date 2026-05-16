import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // No assets to preload in this slice. Move directly to the start screen.
    this.scene.start('StartScene');
  }
}
