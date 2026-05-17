import { DEBUG } from '../shared/config';
import type { InputEvent, PlayerState, WorldState } from '../shared/types';

export interface DebugOverlay {
  update(
    player: PlayerState,
    world: WorldState,
    lastInput?: InputEvent,
    questionTimer?: { remainingMs: number; urgent: boolean } | null,
  ): void;
  destroy(): void;
}

export function createDebugOverlay(host: HTMLElement | null): DebugOverlay {
  if (!DEBUG || host === null) {
    return { update: () => undefined, destroy: () => undefined };
  }

  host.classList.remove('hidden');
  host.textContent = '';

  function update(
    p: PlayerState,
    w: WorldState,
    lastInput?: InputEvent,
    questionTimer?: { remainingMs: number; urgent: boolean } | null,
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
    if (questionTimer) {
      lines.push(
        `Q-Timer:   ${(questionTimer.remainingMs / 1000).toFixed(1)} s${questionTimer.urgent ? ' (urgent)' : ''}`,
      );
    }
    // host is captured by closure.
    (host as HTMLElement).textContent = lines.join('\n');
  }

  function destroy(): void {
    host?.classList.add('hidden');
    if (host) host.textContent = '';
  }

  return { update, destroy };
}
