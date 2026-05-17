// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { createFloatingScore } from './floating-score';

function makeHost(): HTMLDivElement {
  document.body.innerHTML = '';
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}

describe('createFloatingScore.pop', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
  });

  it('appends a .floating-score child with the given text and colour class', () => {
    const fs = createFloatingScore(host);
    fs.pop('+1000', 'green');
    const el = host.querySelector('.floating-score') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.textContent).toBe('+1000');
    expect(el.classList.contains('floating-score--green')).toBe(true);
    expect(el.classList.contains('floating-score--red')).toBe(false);
  });

  it('uses .floating-score--red for the red variant', () => {
    const fs = createFloatingScore(host);
    fs.pop('-5000', 'red');
    const el = host.querySelector('.floating-score') as HTMLElement;
    expect(el.classList.contains('floating-score--red')).toBe(true);
    expect(el.classList.contains('floating-score--green')).toBe(false);
  });

  it('removes the child on transitionend', () => {
    const fs = createFloatingScore(host);
    fs.pop('+1000', 'green');
    const el = host.querySelector('.floating-score') as HTMLElement;
    el.dispatchEvent(new Event('transitionend', { bubbles: true }));
    expect(host.querySelector('.floating-score')).toBeNull();
  });

  it('multiple pops accumulate independently before transitionend', () => {
    const fs = createFloatingScore(host);
    fs.pop('+1000', 'green');
    fs.pop('+5000', 'green');
    fs.pop('-10000', 'red');
    expect(host.querySelectorAll('.floating-score').length).toBe(3);
  });

  it('destroy() removes any in-flight badges immediately', () => {
    const fs = createFloatingScore(host);
    fs.pop('+1000', 'green');
    fs.pop('-5000', 'red');
    expect(host.querySelectorAll('.floating-score').length).toBe(2);
    fs.destroy();
    expect(host.querySelectorAll('.floating-score').length).toBe(0);
  });
});
