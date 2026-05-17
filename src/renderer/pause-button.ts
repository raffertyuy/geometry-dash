export interface PauseButton {
  setVisible(visible: boolean): void;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  destroy(): void;
}

/**
 * Top-of-playfield Pause button. Pure-DOM adapter — no internal state
 * beyond the latest setVisible / setEnabled values. The game-loop
 * recomputes the desired state every frame and pushes it down, which
 * keeps button state guaranteed to match world state without drift.
 */
export function createPauseButton(
  host: HTMLButtonElement,
  onPress: () => void,
): PauseButton {
  let visible = false;
  let enabled = false;
  let destroyed = false;

  function onClick(event: Event): void {
    if (destroyed || !visible || !enabled) return;
    event.stopPropagation();
    onPress();
  }

  host.addEventListener('click', onClick);

  function syncDom(): void {
    host.classList.toggle('hidden', !visible);
    // Effective enabled state is the conjunction. Always re-apply DOM
    // attributes so transitions between (visible, enabled) combinations
    // can't leave stale attributes behind.
    const effectivelyEnabled = visible && enabled;
    if (effectivelyEnabled) {
      host.removeAttribute('disabled');
      host.removeAttribute('aria-disabled');
      host.classList.remove('is-disabled');
    } else {
      host.setAttribute('disabled', 'true');
      host.setAttribute('aria-disabled', 'true');
      host.classList.add('is-disabled');
    }
  }

  function setVisible(next: boolean): void {
    if (destroyed) return;
    visible = next;
    syncDom();
  }

  function setEnabled(next: boolean): void {
    if (destroyed) return;
    enabled = next;
    syncDom();
  }

  function isEnabled(): boolean {
    return visible && enabled;
  }

  function destroy(): void {
    destroyed = true;
    host.removeEventListener('click', onClick);
  }

  return { setVisible, setEnabled, isEnabled, destroy };
}
