import type { ProblemSource } from '../problems/sources';

export interface CreditsPanel {
  show(): void;
  hide(): void;
  isVisible(): boolean;
  destroy(): void;
}

/**
 * "Problem credits" attribution panel — a stand-alone overlay listing
 * every CC-BY-licensed source used by the curated Basic problem pool.
 * Required by the CC BY 4.0 licence terms; surfaces both on the start
 * screen and on the game-over screen via wiring in game-loop.
 *
 * Dismissal paths: Escape key, click on the dimmed backdrop outside the
 * panel body, and (optionally) a small close button inside the panel.
 * All three call the same internal close() which fires the onClose
 * callback if provided.
 */
export function createCreditsPanel(
  host: HTMLElement,
  sources: readonly ProblemSource[],
  onClose?: () => void,
): CreditsPanel {
  const doc = host.ownerDocument;
  const win = doc.defaultView ?? window;

  let visible = false;
  let destroyed = false;

  // ----- Build DOM -----
  host.innerHTML = '';
  const body = doc.createElement('div');
  body.className = 'credits-body';

  const closeBtn = doc.createElement('button');
  closeBtn.className = 'close-button';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';
  body.appendChild(closeBtn);

  const heading = doc.createElement('h2');
  heading.textContent = 'Problem credits';
  body.appendChild(heading);

  const intro = doc.createElement('p');
  intro.className = 'credits-intro';
  intro.textContent =
    'This game incorporates geometry problems adapted from open-licensed sources. Per CC BY 4.0 attribution requirements:';
  body.appendChild(intro);

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
  body.appendChild(list);

  host.appendChild(body);

  // ----- Event handlers -----
  function close(): void {
    if (!visible || destroyed) return;
    hide();
    if (onClose) onClose();
  }

  function onKeyDown(event: Event): void {
    if (!visible) return;
    const ke = event as KeyboardEvent;
    if (ke.key === 'Escape') {
      ke.preventDefault?.();
      close();
    }
  }

  function onHostClick(event: Event): void {
    if (!visible) return;
    // Close only when click hits the backdrop (host itself), not the
    // panel body or any descendant of it.
    if (event.target === host) {
      close();
    }
  }

  function onCloseButtonClick(event: Event): void {
    event.stopPropagation();
    close();
  }

  // ----- Public API -----
  function show(): void {
    if (destroyed) return;
    visible = true;
    host.classList.remove('hidden');
    win.addEventListener('keydown', onKeyDown, true);
    host.addEventListener('click', onHostClick);
    closeBtn.addEventListener('click', onCloseButtonClick);
  }

  function hide(): void {
    visible = false;
    host.classList.add('hidden');
    win.removeEventListener('keydown', onKeyDown, true);
    host.removeEventListener('click', onHostClick);
    closeBtn.removeEventListener('click', onCloseButtonClick);
  }

  function isVisible(): boolean {
    return visible;
  }

  function destroy(): void {
    destroyed = true;
    hide();
    host.innerHTML = '';
  }

  return { show, hide, isVisible, destroy };
}
