import Phaser from 'phaser';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../../shared/config';

export class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StartScene' });
  }

  create(): void {
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2;

    this.add
      .text(cx, cy - 100, 'The Real Geometry Dash', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '56px',
        color: '#22cc88',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 20, 'Press any key or tap to start', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '36px',
        color: '#e8e8ef',
      })
      .setOrigin(0.5);

    this.add
      .text(
        cx,
        cy + 100,
        'Use Arrow keys / WASD on desktop\nSwipe left/right on mobile',
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '24px',
          color: '#9090a0',
          align: 'center',
        },
      )
      .setOrigin(0.5);

    // Any keyboard or pointer event begins the run.
    const begin = (): void => {
      this.scene.start('RunScene');
    };

    this.input.keyboard?.once('keydown', begin);
    this.input.once('pointerdown', begin);
  }
}
