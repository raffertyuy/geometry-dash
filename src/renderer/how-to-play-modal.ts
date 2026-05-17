import {
  GATE_POINTS_A,
  GATE_POINTS_B,
  GATE_POINTS_M,
  QUESTION_TIMER_MS_A,
  QUESTION_TIMER_MS_B,
  QUESTION_TIMER_MS_M,
} from '../shared/config';
import { GATE_CATALOGUE } from '../problem-gates';
import type { ProblemSource } from '../problems/sources';
import type { GateDifficulty } from '../shared/types';

export interface HowToPlayModal {
  show(mode: 'entry' | 'pause'): void;
  close(): void;
  isVisible(): boolean;
  destroy(): void;
}

type HowToPlayMode = 'entry' | 'pause';

interface CubeRow {
  readonly difficulty: GateDifficulty;
  readonly label: string;
  readonly description: string;
  readonly pointsLabel: string;
  readonly countdownLabel: string;
}

const CUBE_ROWS: readonly CubeRow[] = [
  {
    difficulty: 'B',
    label: 'Basic',
    description:
      'Quick recall problems on shape names, vertex / face counts, and basic terminology.',
    pointsLabel: `±${GATE_POINTS_B.toLocaleString()}`,
    countdownLabel: `${QUESTION_TIMER_MS_B / 1000} s`,
  },
  {
    difficulty: 'M',
    label: 'Medium',
    description:
      'Mid-difficulty problems with diagrams — perimeter, area, Pythagoras, simple angles.',
    pointsLabel: `±${GATE_POINTS_M.toLocaleString()}`,
    countdownLabel: `${QUESTION_TIMER_MS_M / 1000} s`,
  },
  {
    difficulty: 'A',
    label: 'Advanced',
    description:
      'Harder problems — volume / surface area, coordinate geometry, trig with special angles.',
    pointsLabel: `±${GATE_POINTS_A.toLocaleString()}`,
    countdownLabel: `${QUESTION_TIMER_MS_A / 1000} s`,
  },
];

/**
 * Three-section tutorial modal — General Rules, Problem Cubes, Credits.
 * Opens in 'entry' mode from start/game-over screen links, or 'pause' mode
 * from the in-game Pause button. The two modes differ only on dismissal:
 * 'pause' invokes the construction-time `onResume` callback so the
 * game-loop can resumeRun().
 */
export function createHowToPlayModal(
  host: HTMLElement,
  sources: readonly ProblemSource[],
  onResume?: () => void,
): HowToPlayModal {
  const doc = host.ownerDocument;
  const win = doc.defaultView ?? window;

  let visible = false;
  let destroyed = false;
  let currentMode: HowToPlayMode = 'entry';
  let bodyBuilt = false;
  let closeBtn: HTMLButtonElement | null = null;

  function buildBody(): void {
    host.innerHTML = '';
    const body = doc.createElement('div');
    body.className = 'how-to-play-body';

    closeBtn = doc.createElement('button');
    closeBtn.className = 'close-button';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    body.appendChild(closeBtn);

    const heading = doc.createElement('h2');
    heading.textContent = 'How to Play';
    body.appendChild(heading);

    body.appendChild(buildGeneralRules());
    body.appendChild(buildProblemCubes());
    body.appendChild(buildCredits());

    host.appendChild(body);
    bodyBuilt = true;
  }

  function buildGeneralRules(): HTMLElement {
    const section = doc.createElement('section');
    section.className = 'htp-section htp-general-rules';
    const h3 = doc.createElement('h3');
    h3.textContent = 'General Rules';
    section.appendChild(h3);
    const ul = doc.createElement('ul');
    const bullets = [
      'Endless 3-lane runner — your job is to dodge the obstacle blocks and answer the glowing question cubes.',
      'Switch lanes with Arrow keys, WASD, or a touch swipe (left / right).',
      'You start with 3 lives. Hitting an obstacle costs a life and gives you a 3-second blinking invincibility window when you respawn.',
      'You can lose in two ways: drop to zero lives, or let your score fall below zero.',
    ];
    for (const text of bullets) {
      const li = doc.createElement('li');
      li.textContent = text;
      ul.appendChild(li);
    }
    section.appendChild(ul);
    return section;
  }

  function buildProblemCubes(): HTMLElement {
    const section = doc.createElement('section');
    section.className = 'htp-section htp-problem-cubes';
    const h3 = doc.createElement('h3');
    h3.textContent = 'Problem Cubes';
    section.appendChild(h3);
    const intro = doc.createElement('p');
    intro.className = 'htp-cubes-intro';
    intro.textContent =
      'When you hit a question cube, the run pauses and a multiple-choice problem opens. A wrong answer (or letting the per-question timer run out) costs the cube’s points and one life.';
    section.appendChild(intro);
    const list = doc.createElement('ul');
    list.className = 'htp-cube-rows';
    for (const row of CUBE_ROWS) {
      const li = doc.createElement('li');
      li.className = `htp-cube-row htp-cube-row--${row.difficulty.toLowerCase()}`;
      li.setAttribute('data-difficulty', row.difficulty);

      const swatch = doc.createElement('span');
      swatch.className = 'cube-swatch';
      swatch.setAttribute('aria-hidden', 'true');
      swatch.style.backgroundColor = GATE_CATALOGUE[row.difficulty].colorHex;
      li.appendChild(swatch);

      const text = doc.createElement('div');
      text.className = 'htp-cube-text';

      const label = doc.createElement('div');
      label.className = 'htp-cube-label';
      label.textContent = row.label;
      text.appendChild(label);

      const desc = doc.createElement('p');
      desc.className = 'htp-cube-description';
      desc.textContent = row.description;
      text.appendChild(desc);

      const stats = doc.createElement('div');
      stats.className = 'htp-cube-stats';
      stats.textContent = `${row.pointsLabel} pts · ${row.countdownLabel} to answer`;
      text.appendChild(stats);

      li.appendChild(text);
      list.appendChild(li);
    }
    section.appendChild(list);
    return section;
  }

  function buildCredits(): HTMLElement {
    const section = doc.createElement('section');
    section.className = 'htp-section htp-credits';
    const h3 = doc.createElement('h3');
    h3.textContent = 'Credits';
    section.appendChild(h3);
    const intro = doc.createElement('p');
    intro.className = 'credits-intro';
    intro.textContent =
      'This game incorporates geometry problems adapted from open-licensed sources. Per CC BY 4.0 attribution:';
    section.appendChild(intro);
    const list = doc.createElement('ul');
    list.className = 'credits-list';
    for (const src of sources) {
      const li = doc.createElement('li');
      li.className = 'source-entry';

      const name = doc.createElement('div');
      name.className = 'source-name';
      name.textContent = src.name;
      li.appendChild(name);

      const link = doc.createElement('a');
      link.className = 'source-url';
      link.href = src.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = src.url;
      li.appendChild(link);

      const license = doc.createElement('div');
      license.className = 'source-license';
      license.textContent = `Licence: ${src.license}`;
      li.appendChild(license);

      const attr = doc.createElement('div');
      attr.className = 'source-attribution';
      attr.textContent = src.attribution;
      li.appendChild(attr);

      list.appendChild(li);
    }
    section.appendChild(list);
    return section;
  }

  function onKeyDown(event: Event): void {
    if (!visible) return;
    const ke = event as KeyboardEvent;
    if (ke.key === 'Escape' || ke.key === ' ') {
      ke.preventDefault?.();
      ke.stopPropagation?.();
      close();
    }
  }

  function onHostClick(event: Event): void {
    if (!visible) return;
    // Backdrop-only close; clicks inside .how-to-play-body do not close.
    if (event.target === host) {
      close();
    }
  }

  function onCloseButtonClick(event: Event): void {
    event.stopPropagation();
    close();
  }

  function show(mode: HowToPlayMode): void {
    if (destroyed) return;
    if (visible) return; // idempotent — see FR-016
    if (!bodyBuilt) buildBody();
    currentMode = mode;
    visible = true;
    host.classList.remove('hidden');
    win.addEventListener('keydown', onKeyDown, true);
    host.addEventListener('click', onHostClick);
    closeBtn?.addEventListener('click', onCloseButtonClick);
    console.debug({ event: 'how_to_play_opened', mode });
  }

  function close(): void {
    if (!visible) return;
    const mode = currentMode;
    visible = false;
    host.classList.add('hidden');
    win.removeEventListener('keydown', onKeyDown, true);
    host.removeEventListener('click', onHostClick);
    closeBtn?.removeEventListener('click', onCloseButtonClick);
    const resumed = mode === 'pause' && !!onResume;
    console.debug({ event: 'how_to_play_closed', mode, resumed });
    if (resumed) onResume!();
  }

  function isVisible(): boolean {
    return visible;
  }

  function destroy(): void {
    destroyed = true;
    if (visible) close();
    host.innerHTML = '';
    bodyBuilt = false;
    closeBtn = null;
  }

  return { show, close, isVisible, destroy };
}
