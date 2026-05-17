export interface MuteButton {
  setMuted(muted: boolean): void;
  destroy(): void;
}

/**
 * Audio mute toggle. Pure DOM adapter; the game-loop pushes the latest
 * mute state once per frame (cheap) so the button never drifts from the
 * engine's state. Click fires `onToggle` once per actual click.
 */
export function createMuteButton(
  host: HTMLButtonElement,
  onToggle: () => void,
): MuteButton {
  let destroyed = false;

  function onClick(event: Event): void {
    if (destroyed) return;
    event.stopPropagation();
    onToggle();
  }
  host.addEventListener('click', onClick);

  function setMuted(muted: boolean): void {
    if (destroyed) return;
    host.setAttribute('aria-pressed', muted ? 'true' : 'false');
    host.classList.toggle('is-muted', muted);
    host.textContent = muted ? '🔇' : '🔊';
    host.setAttribute(
      'aria-label',
      muted ? 'Unmute audio' : 'Mute audio',
    );
  }

  function destroy(): void {
    destroyed = true;
    host.removeEventListener('click', onClick);
  }

  return { setMuted, destroy };
}
