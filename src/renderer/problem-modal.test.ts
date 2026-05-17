// @vitest-environment jsdom
import { afterEach, describe, expect, it, beforeEach, vi } from 'vitest';
import { createProblemModal } from './problem-modal';
import {
  QUESTION_TIMER_MS_A,
  QUESTION_TIMER_MS_B,
  QUESTION_TIMER_MS_M,
} from '../shared/config';
import type { Problem } from '../shared/types';

const PROBLEM_M: Problem = {
  id: 'm01',
  difficulty: 'M',
  prompt: 'Medium placeholder',
  choices: [{ text: 'x' }, { text: 'y' }, { text: 'z' }] as const,
  correctIndex: 2,
};
const PROBLEM_A: Problem = {
  id: 'a01',
  difficulty: 'A',
  prompt: 'Advanced placeholder',
  choices: [{ text: 'p' }, { text: 'q' }, { text: 'r' }] as const,
  correctIndex: 0,
};

function makeHost(): HTMLDivElement {
  document.body.innerHTML = '';
  // Reset persisted prefs so each test starts with auto-continue off.
  try {
    globalThis.localStorage?.clear();
  } catch {
    // jsdom may not always have localStorage; ignore.
  }
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
    expect(onResolve).toHaveBeenCalledWith({ kind: 'pick', choiceIndex: 1 });
    modal.destroy();
  });

  it('Enter while reviewing also resolves (acts as Continue)', () => {
    const modal = createProblemModal(host);
    const onResolve = vi.fn();
    modal.show(TEST_PROBLEM, onResolve);
    dispatchKey(host, 'Enter'); // pick 0
    dispatchKey(host, 'Enter'); // resolve
    expect(onResolve).toHaveBeenCalledWith({ kind: 'pick', choiceIndex: 0 });
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
    expect(onResolve).toHaveBeenCalledWith({ kind: 'pick', choiceIndex: 0 });
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
    expect(onResolve).toHaveBeenCalledWith({ kind: 'pick', choiceIndex: 0 });
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

// ---------- Slice 007: per-question countdown timer -----------------------

describe('question countdown — display', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  });
  afterEachReset();

  function readDisplay(): string {
    return host.querySelector('.countdown-question')?.textContent ?? '';
  }

  it('shows 1:00 / 2:00 / 3:00 on initial render for B / M / A', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    expect(readDisplay()).toBe('1:00');
    modal.destroy();

    modal.show = createProblemModal(host).show; // fresh
    const m2 = createProblemModal(host);
    m2.show(PROBLEM_M, () => undefined);
    expect(readDisplay()).toBe('2:00');
    m2.destroy();

    const m3 = createProblemModal(host);
    m3.show(PROBLEM_A, () => undefined);
    expect(readDisplay()).toBe('3:00');
    m3.destroy();
  });

  it('decrements at 1 Hz across difficulties', () => {
    const cases: ReadonlyArray<{ problem: Problem; afterOneSec: string; after15Sec: string }> = [
      { problem: TEST_PROBLEM, afterOneSec: '0:59', after15Sec: '0:45' },
      { problem: PROBLEM_M, afterOneSec: '1:59', after15Sec: '1:45' },
      { problem: PROBLEM_A, afterOneSec: '2:59', after15Sec: '2:45' },
    ];
    for (const { problem, afterOneSec, after15Sec } of cases) {
      host = makeHost();
      const modal = createProblemModal(host);
      modal.show(problem, () => undefined);
      vi.advanceTimersByTime(1000);
      expect(readDisplay()).toBe(afterOneSec);
      vi.advanceTimersByTime(14_000);
      expect(readDisplay()).toBe(after15Sec);
      modal.destroy();
    }
  });
});

describe('question countdown — stop on pick', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  });
  afterEachReset();

  it('freezes the displayed text immediately after a pick', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    vi.advanceTimersByTime(20_000); // 0:40
    expect(host.querySelector('.countdown-question')?.textContent).toBe('0:40');
    dispatchKey(host, 'Enter'); // pick choice 0 — stops the timer
    const frozen = host.querySelector('.countdown-question')?.textContent;
    vi.advanceTimersByTime(30_000); // would normally tick to 0:10
    expect(host.querySelector('.countdown-question')?.textContent).toBe(frozen);
    modal.destroy();
  });

  it('does NOT emit gate_timer_expired when answered in time', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    vi.advanceTimersByTime(10_000);
    dispatchKey(host, 'Enter');
    vi.advanceTimersByTime(120_000);
    const calls = debugSpy.mock.calls.flat() as Array<Record<string, unknown>>;
    expect(calls.some((c) => c && c['event'] === 'gate_timer_expired')).toBe(false);
    modal.destroy();
    debugSpy.mockRestore();
  });
});

describe('question countdown — monotonic-clock drift', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  });
  afterEachReset();

  it('reports exact monotonic remaining time after non-uniform clock jumps', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    // Big jump, then small jump — verifies math uses elapsed wall-clock,
    // not a per-tick decrement count. Stop short of timeout to keep the
    // timer in 'running' state for inspection.
    vi.advanceTimersByTime(QUESTION_TIMER_MS_B - 5_000);
    expect(modal.getDebugSnapshot()!.remainingMs).toBe(5_000);
    vi.advanceTimersByTime(1);
    expect(modal.getDebugSnapshot()!.remainingMs).toBe(4_999);
    modal.destroy();
  });

  it('clamps the displayed countdown at 0:00 when fully consumed', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    // Advance just past the exact duration so the next interval/rAF tick
    // observes remaining <= 0 and fires the timeout, then assert the
    // displayed text never went negative.
    vi.advanceTimersByTime(QUESTION_TIMER_MS_B + 100);
    const text = host.querySelector('.countdown-question')?.textContent ?? '';
    expect(text === "Hurry! 0:00" || text === '0:00').toBe(true);
    modal.destroy();
  });
});

describe('question countdown — timeout routes to wrong-answer', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  });
  afterEachReset();

  function runTimeout(problem: Problem, durationMs: number): ReturnType<typeof vi.fn> {
    const modal = createProblemModal(host);
    const onResolve = vi.fn();
    modal.show(problem, onResolve);
    // Past the question countdown into the 3 s review auto-continue.
    vi.advanceTimersByTime(durationMs + 3_500);
    modal.destroy();
    return onResolve;
  }

  it('calls onResolve with { kind: "timeout" } for Basic gates', () => {
    const onResolve = runTimeout(TEST_PROBLEM, QUESTION_TIMER_MS_B);
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith({ kind: 'timeout' });
  });

  it('calls onResolve with { kind: "timeout" } for Medium gates', () => {
    const onResolve = runTimeout(PROBLEM_M, QUESTION_TIMER_MS_M);
    expect(onResolve).toHaveBeenCalledWith({ kind: 'timeout' });
  });

  it('calls onResolve with { kind: "timeout" } for Advanced gates', () => {
    const onResolve = runTimeout(PROBLEM_A, QUESTION_TIMER_MS_A);
    expect(onResolve).toHaveBeenCalledWith({ kind: 'timeout' });
  });

  it('emits gate_timer_expired on the timeout transition', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    vi.advanceTimersByTime(QUESTION_TIMER_MS_B + 100);
    const calls = debugSpy.mock.calls.flat() as Array<Record<string, unknown>>;
    expect(
      calls.some(
        (c) =>
          c &&
          c['event'] === 'gate_timer_expired' &&
          c['difficulty'] === 'B',
      ),
    ).toBe(true);
    modal.destroy();
    debugSpy.mockRestore();
  });

  it('shows the timeout review state: correct answer highlighted, no wrong-pick marker, "Time\'s up" feedback', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    vi.advanceTimersByTime(QUESTION_TIMER_MS_B + 50); // past timeout, before auto-continue
    expect(host.classList.contains('is-reviewing')).toBe(true);
    expect(host.classList.contains('is-incorrect')).toBe(true);
    expect(host.classList.contains('is-correct')).toBe(false);
    const choices = host.querySelectorAll('.answer-choice');
    expect(choices[TEST_PROBLEM.correctIndex]!.classList.contains('is-correct-answer')).toBe(
      true,
    );
    for (const el of Array.from(choices)) {
      expect(el.classList.contains('is-wrong-pick')).toBe(false);
    }
    expect(host.querySelector('.review-feedback')?.textContent).toBe("Time's up");
    modal.destroy();
  });
});

describe('question countdown — urgency cue', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  });
  afterEachReset();

  it('is calm above 10 s and urgent at or below 10 s', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    const el = host.querySelector('.countdown-question') as HTMLElement;
    expect(el.classList.contains('countdown-question--urgent')).toBe(false);
    expect(el.textContent).toMatch(/^\d:\d\d$/);

    // Advance to 11 s remaining — still calm.
    vi.advanceTimersByTime(QUESTION_TIMER_MS_B - 11_000);
    expect(el.classList.contains('countdown-question--urgent')).toBe(false);

    // Advance one more second — exactly 10 s remaining, urgent threshold tripped.
    vi.advanceTimersByTime(1_000);
    expect(el.classList.contains('countdown-question--urgent')).toBe(true);
    expect(el.textContent?.startsWith('Hurry! ')).toBe(true);

    modal.destroy();
  });

  it('reports stopped-by-answer status when the player answers during urgency', () => {
    const modal = createProblemModal(host);
    modal.show(TEST_PROBLEM, () => undefined);
    vi.advanceTimersByTime(QUESTION_TIMER_MS_B - 5_000); // urgent
    const el = host.querySelector('.countdown-question') as HTMLElement;
    expect(el.classList.contains('countdown-question--urgent')).toBe(true);
    dispatchKey(host, 'Enter');
    const snap = modal.getDebugSnapshot();
    expect(snap).not.toBeNull();
    expect(snap!.status).toBe('stopped-by-answer');
    modal.destroy();
  });
});

// Each new describe block calls this in its beforeEach scope so fake timers
// are reset between tests without leaking into earlier suites.
function afterEachReset(): void {
  afterEach(() => {
    vi.useRealTimers();
  });
}
