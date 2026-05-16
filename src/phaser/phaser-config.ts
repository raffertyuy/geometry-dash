import Phaser from 'phaser';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../shared/config';
import { BootScene } from './scenes/boot-scene';
import { RunScene } from './scenes/run-scene';
import { StartScene } from './scenes/start-scene';

export const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1f1f29',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
  },
  scene: [BootScene, StartScene, RunScene],
  fps: { target: 60, smoothStep: true },
  render: {
    pixelArt: false,
    antialias: true,
  },
};
