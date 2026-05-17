// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { createLivesHud } from './lives-hud';
import { MAX_LIVES } from '../shared/config';

function makeHost(): HTMLDivElement {
  document.body.innerHTML = '';
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}

describe('createLivesHud', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
  });

  it(`populates the host with exactly ${MAX_LIVES} .heart children`, () => {
    createLivesHud(host);
    expect(host.querySelectorAll('.heart').length).toBe(MAX_LIVES);
  });

  it('marks the host with the lives-hud class and an aria-label', () => {
    createLivesHud(host);
    expect(host.classList.contains('lives-hud')).toBe(true);
    expect(host.getAttribute('aria-label')).toBe('Lives');
  });

  it('after set(MAX_LIVES), no child has the .empty class', () => {
    const hud = createLivesHud(host);
    hud.set(MAX_LIVES);
    expect(host.querySelectorAll('.heart.empty').length).toBe(0);
  });

  it('after set(0), all children have the .empty class', () => {
    const hud = createLivesHud(host);
    hud.set(0);
    expect(host.querySelectorAll('.heart.empty').length).toBe(MAX_LIVES);
  });

  it('after set(2) with MAX_LIVES=3, child 2 has .empty and 0,1 do not', () => {
    const hud = createLivesHud(host);
    hud.set(2);
    const children = host.querySelectorAll('.heart');
    expect(children[0]!.classList.contains('empty')).toBe(false);
    expect(children[1]!.classList.contains('empty')).toBe(false);
    expect(children[2]!.classList.contains('empty')).toBe(true);
  });

  it('is idempotent across repeated set(N) calls', () => {
    const hud = createLivesHud(host);
    hud.set(2);
    hud.set(2);
    hud.set(2);
    expect(host.querySelectorAll('.heart.empty').length).toBe(1);
  });

  it('handles set being called with values larger than MAX_LIVES (clamps)', () => {
    const hud = createLivesHud(host);
    hud.set(MAX_LIVES + 10);
    expect(host.querySelectorAll('.heart.empty').length).toBe(0);
  });

  it('handles set being called with negative values (clamps to 0)', () => {
    const hud = createLivesHud(host);
    hud.set(-5);
    expect(host.querySelectorAll('.heart.empty').length).toBe(MAX_LIVES);
  });

  it('destroy() empties the host', () => {
    const hud = createLivesHud(host);
    hud.destroy();
    expect(host.children.length).toBe(0);
  });

  it('contains an SVG inside each .heart child for vector rendering', () => {
    createLivesHud(host);
    const hearts = host.querySelectorAll('.heart');
    hearts.forEach((h) => {
      expect(h.querySelector('svg')).not.toBeNull();
    });
  });
});
