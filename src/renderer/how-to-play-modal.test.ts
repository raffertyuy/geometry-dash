// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHowToPlayModal } from './how-to-play-modal';
import { GATE_CATALOGUE } from '../problem-gates';
import {
  GATE_POINTS_A,
  GATE_POINTS_B,
  GATE_POINTS_M,
  QUESTION_TIMER_MS_A,
  QUESTION_TIMER_MS_B,
  QUESTION_TIMER_MS_M,
} from '../shared/config';
import type { ProblemSource } from '../problems/sources';

const STUB_SOURCES: readonly ProblemSource[] = [
  {
    id: 'src-a',
    name: 'OpenStax — Contemporary Mathematics',
    url: 'https://example.org/a',
    license: 'CC BY 4.0',
    attribution: 'Adapted from OpenStax, CC BY 4.0.',
  },
  {
    id: 'src-b',
    name: 'Illustrative Mathematics',
    url: 'https://example.org/b',
    license: 'CC BY 4.0',
    attribution: 'Adapted from IM, CC BY 4.0.',
  },
];

function makeHost(): HTMLDivElement {
  document.body.innerHTML = '';
  const host = document.createElement('div');
  host.classList.add('hidden');
  document.body.appendChild(host);
  return host;
}

function dispatchKey(target: HTMLElement, key: string): KeyboardEvent {
  const event = new (target.ownerDocument.defaultView!
    .KeyboardEvent as typeof KeyboardEvent)('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  target.ownerDocument.defaultView!.dispatchEvent(event);
  return event;
}

let host: HTMLDivElement;
beforeEach(() => {
  host = makeHost();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('createHowToPlayModal: shell + dismissal trio', () => {
  it('builds three sections in order on show()', () => {
    const modal = createHowToPlayModal(host, STUB_SOURCES);
    modal.show('entry');
    const sections = host.querySelectorAll('.htp-section');
    expect(sections.length).toBe(3);
    const headings = Array.from(sections).map(
      (s) => s.querySelector('h3')?.textContent,
    );
    expect(headings).toEqual(['General Rules', 'Problem Cubes', 'Credits']);
    modal.destroy();
  });

  it('show() removes .hidden; close() restores it', () => {
    const modal = createHowToPlayModal(host, STUB_SOURCES);
    expect(host.classList.contains('hidden')).toBe(true);
    modal.show('entry');
    expect(host.classList.contains('hidden')).toBe(false);
    expect(modal.isVisible()).toBe(true);
    modal.close();
    expect(host.classList.contains('hidden')).toBe(true);
    expect(modal.isVisible()).toBe(false);
    modal.destroy();
  });

  it('X close button closes the modal', () => {
    const modal = createHowToPlayModal(host, STUB_SOURCES);
    modal.show('entry');
    const closeBtn = host.querySelector('.close-button') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();
    expect(modal.isVisible()).toBe(false);
    modal.destroy();
  });

  it('Escape key closes the modal', () => {
    const modal = createHowToPlayModal(host, STUB_SOURCES);
    modal.show('entry');
    dispatchKey(host, 'Escape');
    expect(modal.isVisible()).toBe(false);
    modal.destroy();
  });

  it('Space key closes the modal', () => {
    const modal = createHowToPlayModal(host, STUB_SOURCES);
    modal.show('entry');
    dispatchKey(host, ' ');
    expect(modal.isVisible()).toBe(false);
    modal.destroy();
  });

  it('Escape calls preventDefault + stopPropagation (so the game-loop next-key handler does not fire)', () => {
    const modal = createHowToPlayModal(host, STUB_SOURCES);
    modal.show('entry');
    const evt = dispatchKey(host, 'Escape');
    expect(evt.defaultPrevented).toBe(true);
    modal.destroy();
  });

  it('backdrop click closes; click inside the body does not', () => {
    const modal = createHowToPlayModal(host, STUB_SOURCES);
    modal.show('entry');
    // Click inside body — should NOT close.
    const body = host.querySelector('.how-to-play-body') as HTMLElement;
    body.click();
    expect(modal.isVisible()).toBe(true);
    // Click on host (backdrop) — should close.
    host.click();
    expect(modal.isVisible()).toBe(false);
    modal.destroy();
  });

  it('show() while already visible is a no-op (does not rebuild body or stack)', () => {
    const modal = createHowToPlayModal(host, STUB_SOURCES);
    modal.show('entry');
    const firstBody = host.querySelector('.how-to-play-body');
    modal.show('entry');
    const bodyCount = host.querySelectorAll('.how-to-play-body').length;
    expect(bodyCount).toBe(1);
    expect(host.querySelector('.how-to-play-body')).toBe(firstBody);
    modal.destroy();
  });

  it('does not call onResume in entry mode', () => {
    const onResume = vi.fn();
    const modal = createHowToPlayModal(host, STUB_SOURCES, onResume);
    modal.show('entry');
    modal.close();
    expect(onResume).not.toHaveBeenCalled();
    modal.destroy();
  });

  it('calls onResume on close when opened in pause mode', () => {
    const onResume = vi.fn();
    const modal = createHowToPlayModal(host, STUB_SOURCES, onResume);
    modal.show('pause');
    modal.close();
    expect(onResume).toHaveBeenCalledTimes(1);
    modal.destroy();
  });

  it('emits how_to_play_opened / how_to_play_closed debug events with mode + resumed flag', () => {
    const onResume = vi.fn();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const modal = createHowToPlayModal(host, STUB_SOURCES, onResume);
    modal.show('pause');
    modal.close();
    const events = debugSpy.mock.calls.flat() as Array<Record<string, unknown>>;
    const opened = events.find((e) => e && e['event'] === 'how_to_play_opened');
    const closed = events.find((e) => e && e['event'] === 'how_to_play_closed');
    expect(opened).toBeDefined();
    expect(opened!['mode']).toBe('pause');
    expect(closed).toBeDefined();
    expect(closed!['mode']).toBe('pause');
    expect(closed!['resumed']).toBe(true);
    modal.destroy();
    debugSpy.mockRestore();
  });
});

describe('createHowToPlayModal: General Rules section content', () => {
  it('mentions controls, lives, and end conditions', () => {
    const modal = createHowToPlayModal(host, STUB_SOURCES);
    modal.show('entry');
    const text = (host.querySelector('.htp-general-rules')?.textContent ?? '').toLowerCase();
    expect(text).toContain('arrow');
    expect(text).toContain('wasd');
    expect(text).toContain('swipe');
    expect(text).toContain('3 lives');
    expect(text).toContain('score');
    expect(text.includes('zero') || text.includes('below zero')).toBe(true);
    modal.destroy();
  });
});

describe('createHowToPlayModal: Problem Cubes section content', () => {
  it('renders exactly three cube rows in B / M / A order, each with a tron-style SVG cube icon carrying the GATE_CATALOGUE colour', () => {
    const modal = createHowToPlayModal(host, STUB_SOURCES);
    modal.show('entry');
    const rows = host.querySelectorAll('.htp-cube-row');
    expect(rows.length).toBe(3);
    const diffs = Array.from(rows).map((r) => r.getAttribute('data-difficulty'));
    expect(diffs).toEqual(['B', 'M', 'A']);
    const icons = host.querySelectorAll(
      '.htp-cube-row .cube-icon',
    ) as NodeListOf<HTMLElement>;
    expect(icons.length).toBe(3);
    // Per-row cube icon carries the per-difficulty colour as an inline
    // --cube-color custom property; each icon contains exactly one SVG
    // with the hexagonal outline + a "?" glyph.
    expect(icons[0]!.style.getPropertyValue('--cube-color')).toBe(
      GATE_CATALOGUE.B.colorHex,
    );
    expect(icons[1]!.style.getPropertyValue('--cube-color')).toBe(
      GATE_CATALOGUE.M.colorHex,
    );
    expect(icons[2]!.style.getPropertyValue('--cube-color')).toBe(
      GATE_CATALOGUE.A.colorHex,
    );
    for (const icon of Array.from(icons)) {
      expect(icon.querySelector('svg')).not.toBeNull();
      expect(icon.querySelector('polygon.cube-icon__outline')).not.toBeNull();
      expect(icon.querySelector('.cube-icon__edges')).not.toBeNull();
      const q = icon.querySelector('text.cube-icon__qmark');
      expect(q?.textContent).toBe('?');
    }
  });

  it('pairs each colour with a visible difficulty label (accessibility)', () => {
    const modal = createHowToPlayModal(host, STUB_SOURCES);
    modal.show('entry');
    const labels = Array.from(host.querySelectorAll('.htp-cube-label')).map(
      (n) => n.textContent,
    );
    expect(labels).toEqual(['Basic', 'Medium', 'Advanced']);
  });

  it('renders point values and countdown durations from config constants', () => {
    const modal = createHowToPlayModal(host, STUB_SOURCES);
    modal.show('entry');
    const statsTexts = Array.from(host.querySelectorAll('.htp-cube-stats')).map(
      (n) => n.textContent ?? '',
    );
    expect(statsTexts[0]).toContain(`±${GATE_POINTS_B.toLocaleString()}`);
    expect(statsTexts[1]).toContain(`±${GATE_POINTS_M.toLocaleString()}`);
    expect(statsTexts[2]).toContain(`±${GATE_POINTS_A.toLocaleString()}`);
    expect(statsTexts[0]).toContain(`${QUESTION_TIMER_MS_B / 1000} s`);
    expect(statsTexts[1]).toContain(`${QUESTION_TIMER_MS_M / 1000} s`);
    expect(statsTexts[2]).toContain(`${QUESTION_TIMER_MS_A / 1000} s`);
  });
});

describe('createHowToPlayModal: Credits section content', () => {
  it('renders one source-entry per source with name, url, license, attribution children', () => {
    const modal = createHowToPlayModal(host, STUB_SOURCES);
    modal.show('entry');
    const entries = host.querySelectorAll('.htp-credits .source-entry');
    expect(entries.length).toBe(STUB_SOURCES.length);
    for (let i = 0; i < STUB_SOURCES.length; i++) {
      const entry = entries[i]!;
      expect(entry.querySelector('.source-name')?.textContent).toBe(
        STUB_SOURCES[i]!.name,
      );
      expect(entry.querySelector('.source-url')?.getAttribute('href')).toBe(
        STUB_SOURCES[i]!.url,
      );
      expect(entry.querySelector('.source-license')?.textContent).toContain(
        STUB_SOURCES[i]!.license,
      );
      expect(entry.querySelector('.source-attribution')?.textContent).toBe(
        STUB_SOURCES[i]!.attribution,
      );
    }
  });
});
