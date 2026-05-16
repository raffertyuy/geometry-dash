import Phaser from 'phaser';
import { easeOutCubic } from '../lane-state';
import { LANE_X, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../shared/config';
import type { Lane, PlayerState, WorldState } from '../shared/types';

const LANE_FILL_COLOURS: Readonly<Record<Lane, number>> = {
  left: 0x2a2a3a,
  centre: 0x32323e,
  right: 0x2a2a3a,
};

const LANE_WIDTH = 200;
const PLAYER_SIZE = 80;
const PLAYER_Y = Math.round(LOGICAL_HEIGHT * 0.78);

export interface RunnerRenderer {
  draw(player: PlayerState, world: WorldState): void;
  resize(widthPx: number, heightPx: number): void;
  destroy(): void;
}

export function createRunnerRenderer(scene: Phaser.Scene): RunnerRenderer {
  // Lane backgrounds.
  const laneStrips: Phaser.GameObjects.Rectangle[] = (
    ['left', 'centre', 'right'] as const
  ).map((lane) =>
    scene.add.rectangle(
      LANE_X[lane],
      LOGICAL_HEIGHT / 2,
      LANE_WIDTH,
      LOGICAL_HEIGHT,
      LANE_FILL_COLOURS[lane],
    ),
  );

  // Animated scrolling stripes that hint at forward motion.
  const stripeCount = 12;
  const stripeSpacing = LOGICAL_HEIGHT / stripeCount;
  const stripes: Phaser.GameObjects.Rectangle[] = [];
  for (let i = 0; i < stripeCount; i++) {
    const stripe = scene.add.rectangle(
      LOGICAL_WIDTH / 2,
      i * stripeSpacing,
      LANE_WIDTH * 3 - 6,
      6,
      0x444458,
      0.6,
    );
    stripes.push(stripe);
  }

  // Player avatar.
  const player = scene.add.rectangle(
    LANE_X.centre,
    PLAYER_Y,
    PLAYER_SIZE,
    PLAYER_SIZE,
    0x22cc88,
  );
  player.setStrokeStyle(4, 0x1f1f29);

  let lastDistance = 0;

  function draw(p: PlayerState, world: WorldState): void {
    // Position the player x by interpolating from current to target lane.
    const fromX = LANE_X[p.currentLane];
    const toX = p.targetLane !== null ? LANE_X[p.targetLane] : fromX;
    const t = easeOutCubic(p.animProgress);
    player.x = fromX + (toX - fromX) * t;

    // Scroll the stripes downward to imply forward motion.
    const distanceDelta = world.distanceUnits - lastDistance;
    lastDistance = world.distanceUnits;
    for (const stripe of stripes) {
      stripe.y = (stripe.y + distanceDelta) % LOGICAL_HEIGHT;
      if (stripe.y < 0) stripe.y += LOGICAL_HEIGHT;
    }
  }

  function resize(_widthPx: number, _heightPx: number): void {
    // Scale Manager handles screen-space scaling. No-op for logical-space objects.
  }

  function destroy(): void {
    player.destroy();
    for (const lane of laneStrips) lane.destroy();
    for (const stripe of stripes) stripe.destroy();
  }

  return { draw, resize, destroy };
}
