// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createProblemModal } from './problem-modal';
import type { Problem } from '../shared/types';

function makeHost(): HTMLDivElement {
  document.body.innerHTML = '';
  const host = document.createElement('div');
  host.classList.add('hidden');
  document.body.appendChild(host);
  return host;
}

const TEST_PROBLEM: Problem = {
  id: 'b01',
  difficulty: 'B',
  prompt: 'How many sides does a hexagon have?',
  choices: [{ text: '5' }, { text: '6' }, { text: '7' }] as const,
  correctIndex: 1,
};

function dispatchKey(host: HTMLElement, key: string): void {
  const event = new (host.ownerDocument.defaultView!.KeyboardEvent as typeof KeyboardEvent)(
    'keydown',
    { key, bubbles: true, cancelable: true },
  );
  host.ownerDocument.defaultView!.dispatchEvent(event);
}

describe('createProblemModal.show', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
  });

  it('populates host with problem text and three .answer-choice elements', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    expect(host.querySelector('.problem-text')?.textContent).toBe(
      TEST_PROBLEM.prompt,
    );
    const choices = host.querySelectorAll('.answer-choice');
    expect(choices.length).toBe(3);
    expect(choices[0]!.getAttribute('data-idx')).toBe('0');
    expect(choices[2]!.getAttribute('data-idx')).toBe('2');
    modal.destroy();
  });

  it('removes the .hidden class from the host on show', () => {
    const modal = createProblemModal(host);
    expect(host.classList.contains('hidden')).toBe(true);
    modal.show(TEST_PROBLEM, () => undefined);
    expect(host.classList.contains('hidden')).toBe(false);
    modal.destroy();
  });

  it('highlights the first choice by default', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    const choices = host.querySelectorAll('.answer-choice');
    expect(choices[0]!.classList.contains('is-highlighted')).toBe(true);
    expect(choices[1]!.classList.contains('is-highlighted')).toBe(false);
    expect(choices[2]!.classList.contains('is-highlighted')).toBe(false);
    modal.destroy();
  });
});

describe('createProblemModal keyboard navigation', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
  });

  it('ArrowRight moves highlight from 0 to 1', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    dispatchKey(host, 'ArrowRight');
    const choices = host.querySelectorAll('.answer-choice');
    expect(choices[1]!.classList.contains('is-highlighted')).toBe(true);
    expect(choices[0]!.classList.contains('is-highlighted')).toBe(false);
    modal.destroy();
  });

  it('ArrowRight wraps from 2 back to 0', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    dispatchKey(host, 'ArrowRight');
    dispatchKey(host, 'ArrowRight');
    dispatchKey(host, 'ArrowRight'); // wraps
    const choices = host.querySelectorAll('.answer-choice');
    expect(choices[0]!.classList.contains('is-highlighted')).toBe(true);
    modal.destroy();
  });

  it('ArrowLeft wraps from 0 to 2', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    dispatchKey(host, 'ArrowLeft');
    const choices = host.querySelectorAll('.answer-choice');
    expect(choices[2]!.classList.contains('is-highlighted')).toBe(true);
    modal.destroy();
  });

  it('WASD keys navigate equivalently to arrow keys', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    dispatchKey(host, 'd'); // right
    const choices = host.querySelectorAll('.answer-choice');
    expect(choices[1]!.classList.contains('is-highlighted')).toBe(true);
    dispatchKey(host, 'a'); // left
    expect(choices[0]!.classList.contains('is-highlighted')).toBe(true);
    modal.destroy();
  });

  it('Enter commits the highlighted answer', () => {
    const modal = createProblemModal(host);
    const onCommit = vi.fn();
    modal.show(TEST_PROBLEM, onCommit);
    dispatchKey(host, 'ArrowRight'); // move to 1
    dispatchKey(host, 'Enter');
    expect(onCommit).toHaveBeenCalledWith(1);
    modal.destroy();
  });
});

describe('createProblemModal mouse + touch input', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
  });

  it('clicking a non-highlighted choice commits that index directly', () => {
    const modal = createProblemModal(host);
    const onCommit = vi.fn();
    modal.show(TEST_PROBLEM, onCommit);
    const second = host.querySelectorAll('.answer-choice')[2] as HTMLElement;
    second.click();
    expect(onCommit).toHaveBeenCalledWith(2);
    modal.destroy();
  });

  it('pointerdown on a choice commits that index (touch path)', () => {
    const modal = createProblemModal(host);
    const onCommit = vi.fn();
    modal.show(TEST_PROBLEM, onCommit);
    const first = host.querySelectorAll('.answer-choice')[1] as HTMLElement;
    // jsdom lacks a PointerEvent constructor — the modal's listener only
    // reads .target.closest, so a generic bubbling Event suffices for the
    // touch-path smoke test.
    first.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onCommit).toHaveBeenCalledWith(1);
    modal.destroy();
  });
});

describe('createProblemModal lifecycle', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
  });

  it('hide() restores the .hidden class and clears the host', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    modal.hide();
    expect(host.classList.contains('hidden')).toBe(true);
    expect(host.innerHTML).toBe('');
  });

  it('commit fires the callback exactly once even with rapid input', () => {
    const modal = createProblemModal(host);
    const onCommit = vi.fn();
    modal.show(TEST_PROBLEM, onCommit);
    dispatchKey(host, 'Enter');
    dispatchKey(host, 'Enter');
    dispatchKey(host, 'Enter');
    expect(onCommit).toHaveBeenCalledTimes(1);
    modal.destroy();
  });

  it('after commit, further keyboard input does not re-commit', () => {
    const modal = createProblemModal(host);
    const onCommit = vi.fn();
    modal.show(TEST_PROBLEM, onCommit);
    dispatchKey(host, 'Enter');
    dispatchKey(host, 'ArrowRight');
    dispatchKey(host, 'Enter');
    expect(onCommit).toHaveBeenCalledTimes(1);
    modal.destroy();
  });

  it('destroy() removes lingering listeners (no callbacks after destroy)', () => {
    const modal = createProblemModal(host);
    const onCommit = vi.fn();
    modal.show(TEST_PROBLEM, onCommit);
    modal.destroy();
    dispatchKey(host, 'Enter');
    expect(onCommit).not.toHaveBeenCalled();
  });
});
