export interface FloatingScore {
  /**
   * Spawn a transient floating-score badge in the host. `text` is the user-
   * visible label (e.g., "+1000", "-5000"). `color` selects the CSS variant
   * class (.floating-score--green / .floating-score--red). The badge fades
   * upward via a CSS transition and removes itself on transitionend.
   */
  pop(text: string, color: 'green' | 'red'): void;
  destroy(): void;
}

/**
 * Manages a transient stack of "+N" / "-N" badges that float upward from
 * the score readout when a problem gate resolves. Each badge is appended
 * to the host and removed once its CSS transition completes (~1 second).
 * No allocation in the run loop other than the per-event DOM element.
 */
export function createFloatingScore(host: HTMLElement): FloatingScore {
  const doc = host.ownerDocument;
  // Track in-flight elements so destroy() can clean them up without waiting
  // for the transition.
  const inflight = new Set<HTMLElement>();

  function pop(text: string, color: 'green' | 'red'): void {
    const el = doc.createElement('span');
    el.className = `floating-score floating-score--${color}`;
    el.textContent = text;
    host.appendChild(el);
    inflight.add(el);

    function cleanup(): void {
      if (el.parentNode === host) host.removeChild(el);
      inflight.delete(el);
      el.removeEventListener('transitionend', cleanup);
    }
    el.addEventListener('transitionend', cleanup);

    // Trigger the transition: append in baseline state, then on the next
    // animation frame add the .floating-score--rising class which the CSS
    // animates to translateY upward + opacity 0.
    const raf =
      (host.ownerDocument.defaultView ?? globalThis)
        .requestAnimationFrame ??
      ((cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16));
    raf(() => {
      el.classList.add('floating-score--rising');
    });
  }

  function destroy(): void {
    for (const el of inflight) {
      if (el.parentNode === host) host.removeChild(el);
    }
    inflight.clear();
  }

  return { pop, destroy };
}
