// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMuteButton } from './mute-button';

function makeHost(): HTMLButtonElement {
  document.body.innerHTML = '';
  const btn = document.createElement('button');
  btn.id = 'mute-button';
  btn.className = 'mute-button';
  btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-label', 'Mute audio');
  btn.textContent = '🔊';
  document.body.appendChild(btn);
  return btn;
}

let host: HTMLButtonElement;
beforeEach(() => {
  host = makeHost();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('createMuteButton', () => {
  it('setMuted(true) flips aria-pressed, icon, and aria-label', () => {
    const btn = createMuteButton(host, () => undefined);
    btn.setMuted(true);
    expect(host.getAttribute('aria-pressed')).toBe('true');
    expect(host.classList.contains('is-muted')).toBe(true);
    expect(host.textContent).toBe('🔇');
    expect(host.getAttribute('aria-label')).toBe('Unmute audio');
    btn.destroy();
  });

  it('setMuted(false) restores un-muted visuals', () => {
    const btn = createMuteButton(host, () => undefined);
    btn.setMuted(true);
    btn.setMuted(false);
    expect(host.getAttribute('aria-pressed')).toBe('false');
    expect(host.classList.contains('is-muted')).toBe(false);
    expect(host.textContent).toBe('🔊');
    expect(host.getAttribute('aria-label')).toBe('Mute audio');
    btn.destroy();
  });

  it('click fires onToggle once per click', () => {
    const onToggle = vi.fn();
    const btn = createMuteButton(host, onToggle);
    host.click();
    host.click();
    host.click();
    expect(onToggle).toHaveBeenCalledTimes(3);
    btn.destroy();
  });

  it('destroy() removes the click listener', () => {
    const onToggle = vi.fn();
    const btn = createMuteButton(host, onToggle);
    btn.destroy();
    host.click();
    expect(onToggle).not.toHaveBeenCalled();
  });
});
