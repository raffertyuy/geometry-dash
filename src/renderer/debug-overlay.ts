import Phaser from 'phaser';
import { DEBUG } from '../shared/config';
import type { InputEvent, PlayerState, WorldState } from '../shared/types';

export interface DebugOverlay {
  update(player: PlayerState, world: WorldState, lastInput?: InputEvent): void;
  destroy(): void;
}

export function createDebugOverlay(scene: Phaser.Scene): DebugOverlay {
  if (!DEBUG) {
    return { update: () => undefined, destroy: () => undefined };
  }

  const text = scene.add
    .text(16, 16, '', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#e8e8ef',
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      padding: { x: 8, y: 6 },
    })
    .setDepth(1000);

  function update(
    p: PlayerState,
    w: WorldState,
    lastInput?: InputEvent,
  ): void {
    const lines = [
      `lane:      ${p.currentLane}${p.targetLane ? ` -> ${p.targetLane}` : ''}`,
      `animProg:  ${p.animProgress.toFixed(3)}`,
      `buffered:  ${p.bufferedInput ?? '-'}`,
      `runState:  ${w.runState}`,
      `speed:     ${w.speedUnitsPerSec} u/s`,
      `distance:  ${w.distanceUnits.toFixed(1)}`,
      `tickMs:    ${w.tickMs.toFixed(0)}`,
      `lastInput: ${lastInput ? `${lastInput.direction} (${lastInput.source})` : '-'}`,
    ];
    text.setText(lines.join('\n'));
  }

  function destroy(): void {
    text.destroy();
  }

  return { update, destroy };
}
