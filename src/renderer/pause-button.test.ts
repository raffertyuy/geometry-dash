// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPauseButton } from './pause-button';

function makeHost(): HTMLButtonElement {
  document.body.innerHTML = '';
  const btn = document.createElement('button');
  btn.id = 'pause-button';
  btn.className = 'pause-button hidden';
  btn.setAttribute('disabled', 'true');
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

describe('createPauseButton state matrix', () => {
  it('visible + enabled: host is interactive and click fires onPress', () => {
    const onPress = vi.fn();
    const btn = createPauseButton(host, onPress);
    btn.setVisible(true);
    btn.setEnabled(true);
    expect(host.classList.contains('hidden')).toBe(false);
    expect(host.hasAttribute('disabled')).toBe(false);
    expect(host.hasAttribute('aria-disabled')).toBe(false);
    host.click();
    expect(onPress).toHaveBeenCalledTimes(1);
    btn.destroy();
  });

  it('visible + disabled: host is non-interactive and click does NOT fire onPress', () => {
    const onPress = vi.fn();
    const btn = createPauseButton(host, onPress);
    btn.setVisible(true);
    btn.setEnabled(false);
    expect(host.classList.contains('hidden')).toBe(false);
    expect(host.hasAttribute('disabled')).toBe(true);
    expect(host.getAttribute('aria-disabled')).toBe('true');
    expect(host.classList.contains('is-disabled')).toBe(true);
    host.click();
    expect(onPress).not.toHaveBeenCalled();
    btn.destroy();
  });

  it('hidden: click does NOT fire onPress even if internally enabled', () => {
    const onPress = vi.fn();
    const btn = createPauseButton(host, onPress);
    btn.setEnabled(true);
    btn.setVisible(false);
    expect(host.classList.contains('hidden')).toBe(true);
    host.click();
    expect(onPress).not.toHaveBeenCalled();
    btn.destroy();
  });

  it('isEnabled reports visible AND enabled', () => {
    const btn = createPauseButton(host, () => undefined);
    expect(btn.isEnabled()).toBe(false);
    btn.setEnabled(true);
    expect(btn.isEnabled()).toBe(false); // not visible yet
    btn.setVisible(true);
    expect(btn.isEnabled()).toBe(true);
    btn.setEnabled(false);
    expect(btn.isEnabled()).toBe(false);
    btn.destroy();
  });

  it('destroy() removes the click listener (subsequent clicks do not fire onPress)', () => {
    const onPress = vi.fn();
    const btn = createPauseButton(host, onPress);
    btn.setVisible(true);
    btn.setEnabled(true);
    btn.destroy();
    host.click();
    expect(onPress).not.toHaveBeenCalled();
  });
});
