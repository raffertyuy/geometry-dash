import { GATE_CATALOGUE } from '../problem-gates';
import {
  QUESTION_TIMER_DISPLAY_INTERVAL_MS,
  QUESTION_TIMER_MS_BY_DIFFICULTY,
  QUESTION_TIMER_URGENCY_MS,
} from '../shared/config';
import type { AnswerResult, Problem } from '../shared/types';
import { mathText } from './math-text';

export interface ProblemModal {
  show(problem: Problem, onResolve: (result: AnswerResult) => void): void;
  hide(): void;
  destroy(): void;
  /** Test/debug-only seam. Returns null when no modal is open. */
  getDebugSnapshot(): {
    readonly remainingMs: number;
    readonly status: 'running' | 'stopped-by-answer' | 'expired';
    readonly urgent: boolean;
  } | null;
}

const KEY_NAV_PREV = new Set(['ArrowLeft', 'ArrowUp', 'a', 'A', 'w', 'W']);
const KEY_NAV_NEXT = new Set(['ArrowRight', 'ArrowDown', 'd', 'D', 's', 'S']);
const KEY_COMMIT = new Set(['Enter', ' ']);

const COUNTDOWN_DEFAULT_MS = 3000;
const COUNTDOWN_AUTO_MS = 1000;
const COUNTDOWN_TICK_MS = 100;

/**
 * Module-level auto-continue preference. Resets on page reload (no
 * localStorage — Constitution rule on offline-capable + no persistence
 * in this slice). Survives across modal opens within the same session.
 */
let autoContinuePref = false;

/**
 * Problem-gate answer modal with a two-stage flow:
 *
 *   1. CHOOSING — player navigates with keyboard / picks via click /
 *      tap. The world stays in 'answering' (frozen). On commit, the
 *      modal transitions to REVIEWING without yet calling back to the
 *      game-loop.
 *
 *   2. REVIEWING — modal panel turns green (correct) or red (incorrect);
 *      the correct answer is highlighted; if the player picked wrong,
 *      their pick is marked. A countdown ticks down (3 s default, 1 s
 *      with auto-continue on); a "Continue" button skips. Auto-continue
 *      toggle persists in-memory across modal opens. When the countdown
 *      hits zero or the player clicks Continue, the modal calls
 *      onResolve(choiceIndex) and the game-loop completes the answer
 *      (score / lives update + world transitions back to running).
 *
 * The world stays in 'answering' the entire time — runner-engine's
 * tickWorld early-returns for 'answering' so the run is properly
 * paused throughout the review window. This means no runner-engine
 * refactor is needed; the modal absorbs the review delay.
 */
export interface ProblemModalDeps {
  readonly onCountdownTick?: () => void;
  /**
   * Fired the instant the player commits — pick OR timeout — BEFORE the
   * review-state auto-continue countdown starts. `isCorrect` is computed
   * by the modal against the current problem. Used for the answer SFX so
   * the audio feedback is immediate, not delayed until Continue.
   */
  readonly onAnswerCommitted?: (isCorrect: boolean) => void;
}

export function createProblemModal(
  host: HTMLElement,
  deps: ProblemModalDeps = {},
): ProblemModal {
  const doc = host.ownerDocument;
  const win = doc.defaultView ?? window;

  type State = 'closed' | 'choosing' | 'reviewing';
  let state: State = 'closed';
  let highlight: 0 | 1 | 2 = 0;
  let pickedIndex: 0 | 1 | 2 | null = null;
  let currentProblem: Problem | null = null;
  let onResolveCb: ((result: AnswerResult) => void) | null = null;
  let countdownIntervalId: ReturnType<typeof setInterval> | null = null;
  let countdownRemainingMs = 0;
  let choiceElements: HTMLElement[] = [];
  let continueButton: HTMLButtonElement | null = null;
  let autoContinueCheckbox: HTMLInputElement | null = null;
  let countdownDisplay: HTMLElement | null = null;

  // ---- Question countdown (per-difficulty: 60/120/180 s) -----------------
  // Separate from the review-state auto-continue countdown above. This one
  // is wall-clock-driven via performance.now() so background-tab throttling
  // cannot grant the player extra time. See specs/007-problem-timer.
  let qTimerInitialMs = 0;
  let qTimerStartedAtMs = 0;
  let qTimerPausedAccumulatedMs = 0;
  let qTimerPausedAtMs: number | null = null;
  let qTimerStatus: 'idle' | 'running' | 'stopped-by-answer' | 'expired' = 'idle';
  let qTimerDisplayIntervalId: ReturnType<typeof setInterval> | null = null;
  let qTimerRafId: number | null = null;
  let qTimerLastDisplayedSeconds = -1;
  let qTimerLastDisplayedUrgent = false;
  let questionCountdownEl: HTMLElement | null = null;

  function questionTimerRemainingMs(): number {
    if (qTimerStatus === 'idle') return 0;
    const now = qTimerPausedAtMs ?? performance.now();
    const elapsed = now - qTimerStartedAtMs - qTimerPausedAccumulatedMs;
    return Math.max(0, qTimerInitialMs - elapsed);
  }

  function formatMSS(ms: number): string {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec - m * 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function refreshQuestionCountdownDisplay(): void {
    if (!questionCountdownEl || qTimerStatus !== 'running') return;
    const remaining = questionTimerRemainingMs();
    const urgent = remaining <= QUESTION_TIMER_URGENCY_MS;
    const totalSecondsLeft = Math.ceil(remaining / 1000);
    const secondsChanged = totalSecondsLeft !== qTimerLastDisplayedSeconds;
    if (secondsChanged || urgent !== qTimerLastDisplayedUrgent) {
      qTimerLastDisplayedSeconds = totalSecondsLeft;
      qTimerLastDisplayedUrgent = urgent;
      const base = formatMSS(remaining);
      questionCountdownEl.textContent = urgent ? `Hurry! ${base}` : base;
      questionCountdownEl.classList.toggle('countdown-question--urgent', urgent);
    }
    // Per-second tick in the urgency band — fires once per second-boundary
    // transition while remaining is between 0 and the urgency threshold.
    if (secondsChanged && urgent && remaining > 0) {
      deps.onCountdownTick?.();
    }
    if (remaining <= 0) {
      handleQuestionTimeout();
    }
  }

  function scheduleQuestionTimerRaf(): void {
    if (qTimerStatus !== 'running') return;
    const raf =
      win.requestAnimationFrame ??
      ((cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
    qTimerRafId = raf(() => {
      qTimerRafId = null;
      refreshQuestionCountdownDisplay();
      scheduleQuestionTimerRaf();
    });
  }

  function startQuestionTimer(): void {
    if (!currentProblem) return;
    qTimerInitialMs = QUESTION_TIMER_MS_BY_DIFFICULTY[currentProblem.difficulty];
    qTimerStartedAtMs = performance.now();
    qTimerPausedAccumulatedMs = 0;
    qTimerPausedAtMs = null;
    qTimerStatus = 'running';
    qTimerLastDisplayedSeconds = -1;
    qTimerLastDisplayedUrgent = false;
    // Eager initial render so the modal shows the exact starting M:SS within
    // milliseconds of becoming visible (spec SC-001 ±100 ms).
    refreshQuestionCountdownDisplay();
    qTimerDisplayIntervalId = setInterval(
      refreshQuestionCountdownDisplay,
      QUESTION_TIMER_DISPLAY_INTERVAL_MS,
    );
    scheduleQuestionTimerRaf();
    console.debug({
      event: 'gate_timer_started',
      problemId: currentProblem?.id,
      difficulty: currentProblem.difficulty,
      durationMs: qTimerInitialMs,
    });
  }

  function stopQuestionTimer(
    reason: 'stopped-by-answer' | 'expired' | 'closed',
  ): void {
    const wasRunning = qTimerStatus === 'running';
    if (qTimerDisplayIntervalId !== null) {
      clearInterval(qTimerDisplayIntervalId);
      qTimerDisplayIntervalId = null;
    }
    if (qTimerRafId !== null) {
      const caf = win.cancelAnimationFrame ?? clearTimeout;
      caf(qTimerRafId);
      qTimerRafId = null;
    }
    if (wasRunning && reason !== 'closed') {
      qTimerStatus = reason === 'expired' ? 'expired' : 'stopped-by-answer';
      if (reason === 'stopped-by-answer') {
        console.debug({
          event: 'gate_timer_stopped_by_answer',
          problemId: currentProblem?.id,
          choiceIndex: pickedIndex,
          remainingMs: questionTimerRemainingMs(),
        });
      }
    } else if (reason === 'closed') {
      qTimerStatus = 'idle';
    }
  }

  function handleQuestionTimeout(): void {
    if (qTimerStatus !== 'running' || state !== 'choosing') return;
    stopQuestionTimer('expired');
    console.debug({
      event: 'gate_timer_expired',
      problemId: currentProblem?.id,
      difficulty: currentProblem?.difficulty,
    });
    state = 'reviewing';
    pickedIndex = null;
    syncReviewingFeedback();
    deps.onAnswerCommitted?.(false); // timeout is always wrong
    startCountdown();
  }

  function clearReviewCountdown(): void {
    if (countdownIntervalId !== null) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }
  }

  function clearTimers(): void {
    clearReviewCountdown();
    stopQuestionTimer('closed');
  }

  function buildBody(problem: Problem): void {
    host.innerHTML = '';
    host.classList.remove('is-choosing', 'is-reviewing', 'is-correct', 'is-incorrect');

    const difficultyBadge = doc.createElement('div');
    const dInfo = GATE_CATALOGUE[problem.difficulty];
    difficultyBadge.className = `problem-difficulty problem-difficulty--${problem.difficulty.toLowerCase()}`;
    difficultyBadge.style.color = dInfo.colorHex;
    difficultyBadge.textContent = `${dInfo.label} · ±${dInfo.points} pts`;
    host.appendChild(difficultyBadge);

    // Per-question countdown (B=60s / M=120s / A=180s). Wall-clock-driven.
    questionCountdownEl = doc.createElement('div');
    questionCountdownEl.className = 'countdown-question';
    questionCountdownEl.textContent = formatMSS(
      QUESTION_TIMER_MS_BY_DIFFICULTY[problem.difficulty],
    );
    host.appendChild(questionCountdownEl);

    const prompt = doc.createElement('div');
    prompt.className = 'problem-text';
    // mathText escapes HTML first, then expands ^{N} / _{N} into <sup> /
    // <sub>; current prompts use Unicode-only glyphs so the result is
    // identical to textContent assignment for them.
    prompt.innerHTML = mathText(problem.prompt);
    host.appendChild(prompt);

    // Figure slot. Empty when problem has no figure; CSS `:empty` hides it.
    const figure = doc.createElement('div');
    figure.className = 'problem-figure';
    if (problem.figure) {
      figure.innerHTML = problem.figure;
    }
    host.appendChild(figure);

    const list = doc.createElement('ul');
    list.className = 'answer-choices';
    choiceElements = [];
    for (let i = 0; i < 3; i++) {
      const li = doc.createElement('li');
      li.className = 'answer-choice';
      li.setAttribute('data-idx', String(i));
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      const letter = doc.createElement('span');
      letter.className = 'answer-letter';
      letter.textContent = ['A', 'B', 'C'][i]!;
      const text = doc.createElement('span');
      text.className = 'answer-text';
      text.textContent = problem.choices[i]!.text;
      li.appendChild(letter);
      li.appendChild(text);
      list.appendChild(li);
      choiceElements.push(li);
    }
    host.appendChild(list);

    // Review controls panel — hidden during choosing, visible during reviewing.
    const reviewControls = doc.createElement('div');
    reviewControls.className = 'review-controls';

    const feedback = doc.createElement('div');
    feedback.className = 'review-feedback';
    reviewControls.appendChild(feedback);

    continueButton = doc.createElement('button');
    continueButton.className = 'continue-button';
    continueButton.type = 'button';
    continueButton.textContent = 'Continue';
    reviewControls.appendChild(continueButton);

    const autoLabel = doc.createElement('label');
    autoLabel.className = 'auto-continue-label';
    autoContinueCheckbox = doc.createElement('input');
    autoContinueCheckbox.type = 'checkbox';
    autoContinueCheckbox.className = 'auto-continue-checkbox';
    autoContinueCheckbox.checked = autoContinuePref;
    autoLabel.appendChild(autoContinueCheckbox);
    const autoLabelText = doc.createElement('span');
    autoLabelText.textContent = 'Auto-continue (1 s)';
    autoLabel.appendChild(autoLabelText);
    reviewControls.appendChild(autoLabel);

    countdownDisplay = doc.createElement('div');
    countdownDisplay.className = 'countdown-display';
    reviewControls.appendChild(countdownDisplay);

    host.appendChild(reviewControls);
  }

  function syncHighlight(): void {
    for (let i = 0; i < choiceElements.length; i++) {
      choiceElements[i]!.classList.toggle('is-highlighted', i === highlight);
    }
  }

  function syncReviewingFeedback(): void {
    if (currentProblem === null) return;
    const isTimeout = pickedIndex === null;
    const isCorrect = !isTimeout && pickedIndex === currentProblem.correctIndex;
    host.classList.remove('is-choosing');
    host.classList.add('is-reviewing');
    host.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
    for (let i = 0; i < choiceElements.length; i++) {
      const el = choiceElements[i]!;
      el.classList.remove('is-highlighted');
      el.classList.toggle('is-correct-answer', i === currentProblem.correctIndex);
      el.classList.toggle(
        'is-wrong-pick',
        !isTimeout && !isCorrect && i === pickedIndex,
      );
    }
    const feedback = host.querySelector('.review-feedback');
    if (feedback instanceof HTMLElement) {
      feedback.textContent = isTimeout
        ? "Time's up"
        : isCorrect
          ? 'Correct!'
          : 'Incorrect';
    }
  }

  function updateCountdownDisplay(): void {
    if (!countdownDisplay) return;
    const secs = Math.max(0, countdownRemainingMs) / 1000;
    countdownDisplay.textContent = `Resuming in ${secs.toFixed(1)} s`;
  }

  function startCountdown(): void {
    countdownRemainingMs = autoContinuePref ? COUNTDOWN_AUTO_MS : COUNTDOWN_DEFAULT_MS;
    updateCountdownDisplay();
    clearReviewCountdown();
    countdownIntervalId = setInterval(() => {
      countdownRemainingMs -= COUNTDOWN_TICK_MS;
      if (countdownRemainingMs <= 0) {
        resolve();
      } else {
        updateCountdownDisplay();
      }
    }, COUNTDOWN_TICK_MS);
  }

  function pick(choiceIndex: 0 | 1 | 2): void {
    if (state !== 'choosing') return;
    pickedIndex = choiceIndex;
    stopQuestionTimer('stopped-by-answer');
    state = 'reviewing';
    syncReviewingFeedback();
    if (currentProblem) {
      deps.onAnswerCommitted?.(choiceIndex === currentProblem.correctIndex);
    }
    startCountdown();
  }

  function resolve(): void {
    if (state !== 'reviewing') return;
    const cb = onResolveCb;
    const idx = pickedIndex;
    state = 'closed';
    pickedIndex = null;
    onResolveCb = null;
    clearTimers();
    teardownListeners();
    if (cb) {
      cb(idx === null ? { kind: 'timeout' } : { kind: 'pick', choiceIndex: idx });
    }
  }

  function onKeyDown(event: Event): void {
    if (state === 'closed') return;
    const ke = event as KeyboardEvent;
    if (state === 'choosing') {
      if (KEY_NAV_PREV.has(ke.key)) {
        highlight = ((highlight + 2) % 3) as 0 | 1 | 2;
        syncHighlight();
        ke.preventDefault?.();
        return;
      }
      if (KEY_NAV_NEXT.has(ke.key)) {
        highlight = ((highlight + 1) % 3) as 0 | 1 | 2;
        syncHighlight();
        ke.preventDefault?.();
        return;
      }
      if (KEY_COMMIT.has(ke.key)) {
        ke.preventDefault?.();
        pick(highlight);
        return;
      }
    }
    if (state === 'reviewing') {
      // Any commit key during reviewing triggers Continue.
      if (KEY_COMMIT.has(ke.key)) {
        ke.preventDefault?.();
        resolve();
      }
    }
  }

  function onChoiceClick(event: Event): void {
    if (state !== 'choosing') return;
    const target = event.target as HTMLElement | null;
    const el = target?.closest?.('.answer-choice') as HTMLElement | null;
    if (!el) return;
    const idxAttr = el.getAttribute('data-idx');
    if (idxAttr === null) return;
    const idx = Number(idxAttr);
    if (idx !== 0 && idx !== 1 && idx !== 2) return;
    pick(idx as 0 | 1 | 2);
  }

  function onContinueClick(): void {
    if (state === 'reviewing') resolve();
  }

  function onAutoContinueChange(): void {
    if (!autoContinueCheckbox) return;
    autoContinuePref = autoContinueCheckbox.checked;
    // If currently reviewing, retime the countdown to the new total.
    if (state === 'reviewing') {
      startCountdown();
    }
  }

  function setupListeners(): void {
    win.addEventListener('keydown', onKeyDown, true);
    host.addEventListener('click', onChoiceClick);
    host.addEventListener('pointerdown', onChoiceClick);
    continueButton?.addEventListener('click', onContinueClick);
    autoContinueCheckbox?.addEventListener('change', onAutoContinueChange);
  }

  function teardownListeners(): void {
    win.removeEventListener('keydown', onKeyDown, true);
    host.removeEventListener('click', onChoiceClick);
    host.removeEventListener('pointerdown', onChoiceClick);
    continueButton?.removeEventListener('click', onContinueClick);
    autoContinueCheckbox?.removeEventListener('change', onAutoContinueChange);
  }

  function show(
    problem: Problem,
    onResolve: (result: AnswerResult) => void,
  ): void {
    currentProblem = problem;
    onResolveCb = onResolve;
    highlight = 0;
    pickedIndex = null;
    state = 'choosing';
    buildBody(problem);
    syncHighlight();
    host.classList.add('is-choosing');
    host.classList.remove('hidden');
    setupListeners();
    startQuestionTimer();
  }

  function hide(): void {
    clearTimers();
    teardownListeners();
    host.classList.add('hidden');
    host.classList.remove('is-choosing', 'is-reviewing', 'is-correct', 'is-incorrect');
    host.innerHTML = '';
    choiceElements = [];
    continueButton = null;
    autoContinueCheckbox = null;
    countdownDisplay = null;
    questionCountdownEl = null;
    state = 'closed';
    currentProblem = null;
    onResolveCb = null;
    pickedIndex = null;
  }

  function destroy(): void {
    clearTimers();
    teardownListeners();
    host.innerHTML = '';
    choiceElements = [];
    continueButton = null;
    autoContinueCheckbox = null;
    countdownDisplay = null;
    questionCountdownEl = null;
    onResolveCb = null;
  }

  function getDebugSnapshot(): {
    readonly remainingMs: number;
    readonly status: 'running' | 'stopped-by-answer' | 'expired';
    readonly urgent: boolean;
  } | null {
    if (qTimerStatus === 'idle') return null;
    const remainingMs = questionTimerRemainingMs();
    return {
      remainingMs,
      status: qTimerStatus,
      urgent: remainingMs <= QUESTION_TIMER_URGENCY_MS,
    };
  }

  return { show, hide, destroy, getDebugSnapshot };
}
