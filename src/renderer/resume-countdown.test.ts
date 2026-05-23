// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createResumeCountdown } from './resume-countdown';

function makeHost(): HTMLElement {
  document.body.innerHTML = '';
  const el = document.createElement('div');
  el.id = 'resume-countdown';
  el.className = 'hidden';
  document.body.appendChild(el);
  return el;
}

let host: HTMLElement;
beforeEach(() => {
  host = makeHost();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('createResumeCountdown', () => {
  it('show() unhides the host and renders the starting digit', () => {
    const c = createResumeCountdown(host);
    c.show(3);
    expect(host.classList.contains('hidden')).toBe(false);
    const digit = host.querySelector('.resume-countdown-digit');
    expect(digit).not.toBeNull();
    expect(digit!.textContent).toBe('3');
    expect(digit!.classList.contains('is-pulsing')).toBe(true);
    c.destroy();
  });

  it('setSecondsRemaining() updates the digit text and re-triggers the pulse class', () => {
    const c = createResumeCountdown(host);
    c.show(3);
    c.setSecondsRemaining(2);
    const digit = host.querySelector('.resume-countdown-digit')!;
    expect(digit.textContent).toBe('2');
    expect(digit.classList.contains('is-pulsing')).toBe(true);
    c.setSecondsRemaining(1);
    expect(host.querySelector('.resume-countdown-digit')!.textContent).toBe('1');
    c.destroy();
  });

  it('setSecondsRemaining() with the same value is a no-op (no re-render churn)', () => {
    const c = createResumeCountdown(host);
    c.show(3);
    const digit = host.querySelector('.resume-countdown-digit')!;
    // Strip the class so we can detect whether a re-render happened.
    digit.classList.remove('is-pulsing');
    c.setSecondsRemaining(3);
    expect(digit.classList.contains('is-pulsing')).toBe(false);
    c.destroy();
  });

  it('hide() re-hides the host and clears its DOM', () => {
    const c = createResumeCountdown(host);
    c.show(3);
    c.hide();
    expect(host.classList.contains('hidden')).toBe(true);
    expect(host.querySelector('.resume-countdown-digit')).toBeNull();
    c.destroy();
  });

  it('destroy() cleans up DOM and is safe to call without show()', () => {
    const c = createResumeCountdown(host);
    c.destroy();
    expect(host.querySelector('.resume-countdown-digit')).toBeNull();
  });
});
