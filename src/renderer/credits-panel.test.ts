// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createCreditsPanel } from './credits-panel';
import { PROBLEM_SOURCES } from '../problems/sources';

function makeHost(): HTMLDivElement {
  document.body.innerHTML = '';
  const host = document.createElement('div');
  host.classList.add('hidden');
  document.body.appendChild(host);
  return host;
}

function dispatchKey(host: HTMLElement, key: string): void {
  const event = new (host.ownerDocument.defaultView!.KeyboardEvent as typeof KeyboardEvent)(
    'keydown',
    { key, bubbles: true, cancelable: true },
  );
  host.ownerDocument.defaultView!.dispatchEvent(event);
}

describe('createCreditsPanel population', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
  });

  it('populates host with one .source-entry per source', () => {
    createCreditsPanel(host, PROBLEM_SOURCES);
    const entries = host.querySelectorAll('.source-entry');
    expect(entries.length).toBe(PROBLEM_SOURCES.length);
  });

  it('each entry contains the source name, URL, license, and attribution text', () => {
    createCreditsPanel(host, PROBLEM_SOURCES);
    const entries = host.querySelectorAll('.source-entry');
    PROBLEM_SOURCES.forEach((src, i) => {
      const entry = entries[i]!;
      expect(entry.querySelector('.source-name')?.textContent).toContain(src.name);
      const anchor = entry.querySelector<HTMLAnchorElement>('.source-url');
      expect(anchor).not.toBeNull();
      expect(anchor!.getAttribute('href')).toBe(src.url);
      expect(entry.querySelector('.source-license')?.textContent).toContain(src.license);
      expect(entry.querySelector('.source-attribution')?.textContent).toContain(src.attribution);
    });
  });

  it('renders a "Problem credits" heading and intro paragraph', () => {
    createCreditsPanel(host, PROBLEM_SOURCES);
    const heading = host.querySelector('h2');
    expect(heading?.textContent?.toLowerCase()).toContain('credits');
    const intro = host.querySelector('.credits-intro');
    expect(intro).not.toBeNull();
    expect(intro!.textContent!.length).toBeGreaterThan(20);
  });

  it('host starts hidden when initially classed .hidden', () => {
    createCreditsPanel(host, PROBLEM_SOURCES);
    expect(host.classList.contains('hidden')).toBe(true);
  });
});

describe('createCreditsPanel show / hide', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
  });

  it('show() removes the .hidden class', () => {
    const panel = createCreditsPanel(host, PROBLEM_SOURCES);
    panel.show();
    expect(host.classList.contains('hidden')).toBe(false);
    expect(panel.isVisible()).toBe(true);
    panel.destroy();
  });

  it('hide() restores the .hidden class', () => {
    const panel = createCreditsPanel(host, PROBLEM_SOURCES);
    panel.show();
    panel.hide();
    expect(host.classList.contains('hidden')).toBe(true);
    expect(panel.isVisible()).toBe(false);
    panel.destroy();
  });

  it('hide() is idempotent', () => {
    const panel = createCreditsPanel(host, PROBLEM_SOURCES);
    panel.hide();
    panel.hide();
    expect(host.classList.contains('hidden')).toBe(true);
    panel.destroy();
  });

  it('Escape key on the window closes the panel and fires onClose', () => {
    const onClose = vi.fn();
    const panel = createCreditsPanel(host, PROBLEM_SOURCES, onClose);
    panel.show();
    dispatchKey(host, 'Escape');
    expect(host.classList.contains('hidden')).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    panel.destroy();
  });

  it('Escape key when panel is already hidden does nothing', () => {
    const onClose = vi.fn();
    const panel = createCreditsPanel(host, PROBLEM_SOURCES, onClose);
    dispatchKey(host, 'Escape');
    expect(onClose).not.toHaveBeenCalled();
    panel.destroy();
  });

  it('clicking on the backdrop (host itself) closes the panel', () => {
    const onClose = vi.fn();
    const panel = createCreditsPanel(host, PROBLEM_SOURCES, onClose);
    panel.show();
    // Simulate click on the backdrop — the host element directly.
    host.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.classList.contains('hidden')).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    panel.destroy();
  });

  it('clicking inside the panel body does NOT close', () => {
    const onClose = vi.fn();
    const panel = createCreditsPanel(host, PROBLEM_SOURCES, onClose);
    panel.show();
    const body = host.querySelector('.credits-body');
    expect(body).not.toBeNull();
    body!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.classList.contains('hidden')).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    panel.destroy();
  });

  it('clicking the close button closes the panel', () => {
    const onClose = vi.fn();
    const panel = createCreditsPanel(host, PROBLEM_SOURCES, onClose);
    panel.show();
    const closeBtn = host.querySelector<HTMLButtonElement>('.close-button');
    expect(closeBtn).not.toBeNull();
    closeBtn!.click();
    expect(host.classList.contains('hidden')).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    panel.destroy();
  });
});

describe('createCreditsPanel destroy', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
  });

  it('destroy() removes lingering listeners — Escape after destroy does nothing', () => {
    const onClose = vi.fn();
    const panel = createCreditsPanel(host, PROBLEM_SOURCES, onClose);
    panel.show();
    panel.destroy();
    dispatchKey(host, 'Escape');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('destroy() removes lingering listeners — backdrop click after destroy does nothing', () => {
    const onClose = vi.fn();
    const panel = createCreditsPanel(host, PROBLEM_SOURCES, onClose);
    panel.show();
    panel.destroy();
    host.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('createCreditsPanel anchor hrefs (smoke)', () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = makeHost();
  });

  it('each .source-url anchor href matches the corresponding PROBLEM_SOURCES[i].url', () => {
    createCreditsPanel(host, PROBLEM_SOURCES);
    const anchors = host.querySelectorAll<HTMLAnchorElement>('.source-url');
    expect(anchors.length).toBe(PROBLEM_SOURCES.length);
    PROBLEM_SOURCES.forEach((src, i) => {
      expect(anchors[i]!.getAttribute('href')).toBe(src.url);
    });
  });

  it('each .source-url anchor opens in a new tab (target=_blank, rel includes noopener)', () => {
    createCreditsPanel(host, PROBLEM_SOURCES);
    const anchors = host.querySelectorAll<HTMLAnchorElement>('.source-url');
    for (const a of Array.from(anchors)) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel') ?? '').toContain('noopener');
    }
  });
});
