import { MAX_LIVES } from '../shared/config';

export interface LivesHud {
  set(lives: number): void;
  destroy(): void;
}

/**
 * Low-poly heart silhouette in SVG. Faceted (line-only, no curves) to read
 * as "geometric" per spec FR-009 and the Tron visual language. ViewBox is
 * 0 0 24 24 so the 28 px CSS box scales cleanly at any DPI. Filled hearts
 * use the solid red; consumed hearts (.empty) drop fill while keeping the
 * glowing stroke as an outline.
 */
const HEART_SVG = [
  '<svg viewBox="0 0 24 24" aria-hidden="true">',
  '  <path d="M 12 21 L 3 12 L 3 8 L 7 4 L 12 8 L 17 4 L 21 8 L 21 12 Z" />',
  '</svg>',
].join('');

/**
 * Renders MAX_LIVES heart icons into the host element and exposes a
 * `set(n)` method to flip the first `n` of them to filled state and the
 * rest to outlined. Idempotent across repeated `set` calls. `destroy()`
 * clears the host so the lifecycle is symmetric with createDebugOverlay.
 */
export function createLivesHud(host: HTMLElement): LivesHud {
  host.classList.add('lives-hud');
  host.setAttribute('aria-label', 'Lives');
  host.textContent = '';

  const hearts: HTMLSpanElement[] = [];
  for (let i = 0; i < MAX_LIVES; i++) {
    const span = host.ownerDocument.createElement('span');
    span.className = 'heart';
    span.innerHTML = HEART_SVG;
    host.appendChild(span);
    hearts.push(span);
  }

  function set(lives: number): void {
    const clamped = Math.max(0, Math.min(MAX_LIVES, lives | 0));
    for (let i = 0; i < hearts.length; i++) {
      const filled = i < clamped;
      hearts[i]!.classList.toggle('empty', !filled);
    }
  }

  function destroy(): void {
    host.textContent = '';
    hearts.length = 0;
  }

  return { set, destroy };
}
