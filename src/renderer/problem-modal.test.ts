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

const TEST_PROBLEM_WITH_FIGURE: Problem = {
  ...TEST_PROBLEM,
  figure: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>',
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

  it('removes the .hidden class and adds .is-choosing on show', () => {
    const modal = createProblemModal(host);
    expect(host.classList.contains('hidden')).toBe(true);
    modal.show(TEST_PROBLEM, () => undefined);
    expect(host.classList.contains('hidden')).toBe(false);
    expect(host.classList.contains('is-choosing')).toBe(true);
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

  it('injects problem.figure into the .problem-figure slot when present', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM_WITH_FIGURE, () => undefined);
    const figure = host.querySelector('.problem-figure');
    expect(figure).not.toBeNull();
    expect(figure!.querySelector('svg')).not.toBeNull();
    modal.destroy();
  });

  it('leaves the .problem-figure slot empty when problem.figure is absent', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    const figure = host.querySelector('.problem-figure');
    expect(figure).not.toBeNull();
    expect(figure!.innerHTML).toBe('');
    modal.destroy();
  });
});

describe('createProblemModal keyboard navigation (CHOOSING state)', () => {
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
    dispatchKey(host, 'ArrowRight');
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
    dispatchKey(host, 'd');
    const choices = host.querySelectorAll('.answer-choice');
    expect(choices[1]!.classList.contains('is-highlighted')).toBe(true);
    dispatchKey(host, 'a');
    expect(choices[0]!.classList.contains('is-highlighted')).toBe(true);
    modal.destroy();
  });
});

describe('createProblemModal pick → review flow', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
  });

  it('Enter on the highlighted choice transitions to REVIEWING (does NOT immediately resolve)', () => {
    const modal = createProblemModal(host);
    const onResolve = vi.fn();
    modal.show(TEST_PROBLEM, onResolve);
    dispatchKey(host, 'ArrowRight'); // move to 1 (the correct answer)
    dispatchKey(host, 'Enter');
    // Modal entered reviewing — host gets the .is-reviewing class.
    expect(host.classList.contains('is-reviewing')).toBe(true);
    expect(host.classList.contains('is-correct')).toBe(true);
    // Callback NOT yet fired.
    expect(onResolve).not.toHaveBeenCalled();
    modal.destroy();
  });

  it('a wrong answer adds the .is-incorrect class to host', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    dispatchKey(host, 'Enter'); // pick index 0 ('5'), wrong (correct is 1)
    expect(host.classList.contains('is-incorrect')).toBe(true);
    expect(host.classList.contains('is-correct')).toBe(false);
    modal.destroy();
  });

  it('clicking a choice transitions to REVIEWING with that pick', () => {
    const modal = createProblemModal(host);
    const onResolve = vi.fn();
    modal.show(TEST_PROBLEM, onResolve);
    const second = host.querySelectorAll('.answer-choice')[2] as HTMLElement;
    second.click();
    expect(host.classList.contains('is-reviewing')).toBe(true);
    expect(onResolve).not.toHaveBeenCalled();
    // index 2 ('7') is wrong, correct is 1.
    expect(host.classList.contains('is-incorrect')).toBe(true);
    modal.destroy();
  });

  it('marks the correct answer with .is-correct-answer in REVIEWING', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    dispatchKey(host, 'Enter'); // pick index 0
    const choices = host.querySelectorAll('.answer-choice');
    expect(choices[1]!.classList.contains('is-correct-answer')).toBe(true);
    expect(choices[0]!.classList.contains('is-wrong-pick')).toBe(true);
    modal.destroy();
  });
});

describe('createProblemModal Continue / countdown resolves the answer', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
  });

  it('clicking Continue while reviewing calls onResolve with the pick index', () => {
    const modal = createProblemModal(host);
    const onResolve = vi.fn();
    modal.show(TEST_PROBLEM, onResolve);
    dispatchKey(host, 'ArrowRight'); // move to 1
    dispatchKey(host, 'Enter'); // pick 1
    const continueBtn = host.querySelector('.continue-button') as HTMLButtonElement;
    expect(continueBtn).not.toBeNull();
    continueBtn.click();
    expect(onResolve).toHaveBeenCalledWith(1);
    modal.destroy();
  });

  it('Enter while reviewing also resolves (acts as Continue)', () => {
    const modal = createProblemModal(host);
    const onResolve = vi.fn();
    modal.show(TEST_PROBLEM, onResolve);
    dispatchKey(host, 'Enter'); // pick 0
    dispatchKey(host, 'Enter'); // resolve
    expect(onResolve).toHaveBeenCalledWith(0);
    modal.destroy();
  });

  it('countdown timer expiring resolves automatically', async () => {
    vi.useFakeTimers();
    const modal = createProblemModal(host);
    const onResolve = vi.fn();
    modal.show(TEST_PROBLEM, onResolve);
    dispatchKey(host, 'Enter'); // pick 0
    expect(onResolve).not.toHaveBeenCalled();
    // Default countdown is 3000 ms; tick past it.
    vi.advanceTimersByTime(3000);
    expect(onResolve).toHaveBeenCalledWith(0);
    modal.destroy();
    vi.useRealTimers();
  });

  it('toggling auto-continue shortens the countdown to ~1 s', async () => {
    vi.useFakeTimers();
    const modal = createProblemModal(host);
    const onResolve = vi.fn();
    modal.show(TEST_PROBLEM, onResolve);
    dispatchKey(host, 'Enter'); // pick 0 (enters reviewing, 3s countdown)
    const checkbox = host.querySelector('.auto-continue-checkbox') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    // Now the countdown restarts at 1000 ms.
    vi.advanceTimersByTime(1000);
    expect(onResolve).toHaveBeenCalledWith(0);
    modal.destroy();
    vi.useRealTimers();
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

  it('hide() clears review-state classes', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    dispatchKey(host, 'Enter'); // enter reviewing
    expect(host.classList.contains('is-reviewing')).toBe(true);
    modal.hide();
    expect(host.classList.contains('is-reviewing')).toBe(false);
    expect(host.classList.contains('is-incorrect')).toBe(false);
  });

  it('resolve fires the callback exactly once even with rapid Continue clicks', () => {
    const modal = createProblemModal(host);
    const onResolve = vi.fn();
    modal.show(TEST_PROBLEM, onResolve);
    dispatchKey(host, 'Enter'); // pick 0, enter reviewing
    const continueBtn = host.querySelector('.continue-button') as HTMLButtonElement;
    continueBtn.click();
    continueBtn.click();
    continueBtn.click();
    expect(onResolve).toHaveBeenCalledTimes(1);
    modal.destroy();
  });

  it('destroy() removes lingering listeners', () => {
    const modal = createProblemModal(host);
    const onResolve = vi.fn();
    modal.show(TEST_PROBLEM, onResolve);
    modal.destroy();
    dispatchKey(host, 'Enter');
    expect(onResolve).not.toHaveBeenCalled();
  });
});
