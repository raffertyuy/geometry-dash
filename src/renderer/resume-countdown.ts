export interface ResumeCountdown {
  /** Show the overlay and render the initial digit. */
  show(seconds: number): void;
  /** Update the displayed digit; re-triggers the pulse animation when it changes. */
  setSecondsRemaining(seconds: number): void;
  /** Hide the overlay and clear its DOM. */
  hide(): void;
  destroy(): void;
}

/**
 * Big "ready-up" countdown shown after a problem-gate modal closes and
 * before the run resumes. Pure DOM adapter — the game-loop owns the timer
 * and pushes the seconds-remaining each frame.
 */
export function createResumeCountdown(host: HTMLElement): ResumeCountdown {
  const doc = host.ownerDocument;
  let digit: HTMLElement | null = null;
  let lastDisplayed = -1;

  function ensureDigit(): HTMLElement {
    if (digit) return digit;
    digit = doc.createElement('div');
    digit.className = 'resume-countdown-digit';
    host.appendChild(digit);
    return digit;
  }

  function renderDigit(seconds: number): void {
    const el = ensureDigit();
    el.textContent = String(seconds);
    el.classList.remove('is-pulsing');
    // Force reflow so the animation restarts when the class is re-added.
    void el.offsetWidth;
    el.classList.add('is-pulsing');
  }

  function show(seconds: number): void {
    host.innerHTML = '';
    digit = null;
    lastDisplayed = seconds;
    host.classList.remove('hidden');
    renderDigit(seconds);
  }

  function setSecondsRemaining(seconds: number): void {
    if (seconds === lastDisplayed) return;
    lastDisplayed = seconds;
    renderDigit(seconds);
  }

  function hide(): void {
    host.classList.add('hidden');
    host.innerHTML = '';
    digit = null;
    lastDisplayed = -1;
  }

  function destroy(): void {
    host.classList.add('hidden');
    host.innerHTML = '';
    digit = null;
    lastDisplayed = -1;
  }

  return { show, setSecondsRemaining, hide, destroy };
}
