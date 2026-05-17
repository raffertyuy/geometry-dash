import { GATE_CATALOGUE } from '../problem-gates';
import type { Problem } from '../shared/types';

export interface ProblemModal {
  show(problem: Problem, onCommit: (choiceIndex: 0 | 1 | 2) => void): void;
  hide(): void;
  destroy(): void;
}

const KEY_NAVIGATE_PREV = new Set([
  'ArrowLeft',
  'ArrowUp',
  'a',
  'A',
  'w',
  'W',
]);
const KEY_NAVIGATE_NEXT = new Set([
  'ArrowRight',
  'ArrowDown',
  'd',
  'D',
  's',
  'S',
]);
const KEY_COMMIT = new Set(['Enter', ' ']);

/**
 * DOM adapter for the problem-gate answer modal. Mirrors the factory-
 * adapter shape used by createDebugOverlay / createLivesHud / etc.
 *
 * On show(): populates the host with problem text + three answer
 * choices, removes the .hidden class, registers keyboard / click /
 * touch listeners scoped to the modal-open period. Highlights the
 * first choice by default; arrow keys / WASD navigate; Enter (or
 * Space) commits the highlighted choice. Mouse click and touch tap
 * on a choice commit that choice immediately.
 *
 * On commit: invokes onCommit(choiceIndex), then unregisters all
 * listeners but does NOT auto-hide — the game-loop calls hide() after
 * resolveAnswer + the floating-score animation, so the dismiss timing
 * stays in the game-loop's control.
 */
export function createProblemModal(host: HTMLElement): ProblemModal {
  const doc = host.ownerDocument;
  const win = doc.defaultView ?? window;

  let active = false;
  let highlight: 0 | 1 | 2 = 0;
  let committed = false;
  let onCommitCallback: ((choiceIndex: 0 | 1 | 2) => void) | null = null;
  let choiceElements: HTMLElement[] = [];

  function buildBody(problem: Problem): void {
    host.innerHTML = '';
    const difficultyBadge = doc.createElement('div');
    difficultyBadge.className = `problem-difficulty problem-difficulty--${problem.difficulty.toLowerCase()}`;
    difficultyBadge.style.color = GATE_CATALOGUE[problem.difficulty].colorHex;
    difficultyBadge.textContent = `${GATE_CATALOGUE[problem.difficulty].label} · ${
      GATE_CATALOGUE[problem.difficulty].points >= 0
        ? `±${GATE_CATALOGUE[problem.difficulty].points}`
        : `${GATE_CATALOGUE[problem.difficulty].points}`
    } pts`;
    host.appendChild(difficultyBadge);

    const prompt = doc.createElement('div');
    prompt.className = 'problem-text';
    prompt.textContent = problem.prompt;
    host.appendChild(prompt);

    // Reserved slot for a geometry diagram. Left empty for the current
    // placeholder-problem pool; future slices that add real problems with
    // SVG figures will populate this element. CSS hides it via :empty so
    // text-only problems don't get a stray box.
    const figure = doc.createElement('div');
    figure.className = 'problem-figure';
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
      const label = doc.createElement('span');
      label.className = 'answer-letter';
      label.textContent = ['A', 'B', 'C'][i]!;
      const text = doc.createElement('span');
      text.className = 'answer-text';
      text.textContent = problem.choices[i]!.text;
      li.appendChild(label);
      li.appendChild(text);
      list.appendChild(li);
      choiceElements.push(li);
    }
    host.appendChild(list);
  }

  function syncHighlight(): void {
    for (let i = 0; i < choiceElements.length; i++) {
      choiceElements[i]!.classList.toggle('is-highlighted', i === highlight);
    }
  }

  function commit(idx: 0 | 1 | 2): void {
    if (committed) return;
    committed = true;
    const cb = onCommitCallback;
    teardownListeners();
    onCommitCallback = null;
    if (cb) cb(idx);
  }

  function onKeyDown(event: Event): void {
    if (!active) return;
    const ke = event as KeyboardEvent;
    if (KEY_NAVIGATE_PREV.has(ke.key)) {
      highlight = ((highlight + 2) % 3) as 0 | 1 | 2;
      syncHighlight();
      ke.preventDefault?.();
      return;
    }
    if (KEY_NAVIGATE_NEXT.has(ke.key)) {
      highlight = ((highlight + 1) % 3) as 0 | 1 | 2;
      syncHighlight();
      ke.preventDefault?.();
      return;
    }
    if (KEY_COMMIT.has(ke.key)) {
      ke.preventDefault?.();
      commit(highlight);
      return;
    }
  }

  function onChoiceClick(event: Event): void {
    if (!active) return;
    const target = event.target as HTMLElement | null;
    const el = target?.closest?.('.answer-choice') as HTMLElement | null;
    if (!el) return;
    const idxAttr = el.getAttribute('data-idx');
    if (idxAttr === null) return;
    const idx = Number(idxAttr);
    if (idx !== 0 && idx !== 1 && idx !== 2) return;
    commit(idx as 0 | 1 | 2);
  }

  function teardownListeners(): void {
    active = false;
    win.removeEventListener('keydown', onKeyDown, true);
    host.removeEventListener('click', onChoiceClick);
    host.removeEventListener('pointerdown', onChoiceClick);
  }

  function show(
    problem: Problem,
    onCommit: (choiceIndex: 0 | 1 | 2) => void,
  ): void {
    onCommitCallback = onCommit;
    highlight = 0;
    committed = false;
    buildBody(problem);
    syncHighlight();
    host.classList.remove('hidden');
    active = true;
    win.addEventListener('keydown', onKeyDown, true);
    host.addEventListener('click', onChoiceClick);
    host.addEventListener('pointerdown', onChoiceClick);
  }

  function hide(): void {
    teardownListeners();
    host.classList.add('hidden');
    host.innerHTML = '';
    choiceElements = [];
    onCommitCallback = null;
    committed = false;
  }

  function destroy(): void {
    teardownListeners();
    host.innerHTML = '';
    choiceElements = [];
    onCommitCallback = null;
  }

  return { show, hide, destroy };
}
