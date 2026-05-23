import type { LeaderboardEntry } from '../shared/leaderboard-types';
import type { FetchStatus, PersonalBestSurface } from '../leaderboard';

export interface LeaderboardPanelSnapshot {
  readonly fetch: FetchStatus;
  readonly personalBestSurface: PersonalBestSurface;
}

export interface LeaderboardPanel {
  render(snapshot: LeaderboardPanelSnapshot): void;
  setHostVisibility(visible: boolean): void;
  destroy(): void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  // Accept any ISO 8601 string; fall back to "—" on bad input. Only the
  // YYYY-MM-DD portion is shown — the leaderboard cares about which day,
  // not which second.
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  } catch {
    return '—';
  }
}

function formatScore(score: number): string {
  return score.toLocaleString();
}

/**
 * Renders the global leaderboard table (or its empty / offline state) plus
 * an optional personal-best surface. Pure-DOM adapter — no internal state
 * beyond the last-rendered snapshot, no fetch / network logic.
 *
 * Click events inside the host do NOT bubble up to the window-level
 * "tap to start" handler — taps within the panel are absorbed by attaching
 * `data-no-game-start="true"` and stopPropagation on pointerdown / pointerup.
 */
export function createLeaderboardPanel(host: HTMLElement): LeaderboardPanel {
  const doc = host.ownerDocument;
  let destroyed = false;

  host.setAttribute('data-no-game-start', 'true');
  host.classList.add('leaderboard-panel');

  function stopPointer(event: Event): void {
    event.stopPropagation();
  }
  host.addEventListener('pointerdown', stopPointer);
  host.addEventListener('pointerup', stopPointer);

  function buildHeading(text: string): HTMLElement {
    const h = doc.createElement('h2');
    h.className = 'leaderboard-panel__heading';
    h.textContent = text;
    return h;
  }

  function buildMessage(text: string, cls: string): HTMLElement {
    const p = doc.createElement('p');
    p.className = `leaderboard-panel__message ${cls}`;
    p.textContent = text;
    return p;
  }

  function buildRow(
    rank: number | null,
    entry: LeaderboardEntry,
    options: { highlighted?: boolean; pinned?: boolean } = {},
  ): HTMLElement {
    const row = doc.createElement('tr');
    row.className = 'leaderboard-panel__row';
    if (options.highlighted) row.setAttribute('data-highlighted', 'true');
    if (options.pinned) row.setAttribute('data-pinned', 'true');

    const cells = [
      rank === null ? '—' : `#${rank}`,
      entry.initials,
      formatScore(entry.score),
      formatTime(entry.timeMs),
      formatDate(entry.submittedAt),
    ];
    const cellClasses = ['rank', 'initials', 'score', 'time', 'date'];
    cells.forEach((text, i) => {
      const td = doc.createElement('td');
      td.className = `leaderboard-panel__cell leaderboard-panel__cell--${cellClasses[i]}`;
      td.textContent = text;
      row.appendChild(td);
    });
    return row;
  }

  function buildTable(
    entries: readonly LeaderboardEntry[],
    surface: PersonalBestSurface,
  ): HTMLElement {
    const table = doc.createElement('table');
    table.className = 'leaderboard-panel__table';

    const thead = doc.createElement('thead');
    const headRow = doc.createElement('tr');
    ['#', 'Initials', 'Score', 'Time', 'Date'].forEach((label, i) => {
      const th = doc.createElement('th');
      th.scope = 'col';
      th.className = `leaderboard-panel__head leaderboard-panel__head--${['rank', 'initials', 'score', 'time', 'date'][i]}`;
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = doc.createElement('tbody');
    if (surface.kind === 'pinned') {
      tbody.appendChild(buildRow(null, surface.entry, { pinned: true }));
    }
    entries.forEach((entry, i) => {
      const highlighted = surface.kind === 'highlighted' && surface.atIndex === i;
      tbody.appendChild(buildRow(i + 1, entry, { highlighted }));
    });
    table.appendChild(tbody);
    return table;
  }

  function render(snapshot: LeaderboardPanelSnapshot): void {
    if (destroyed) return;
    host.innerHTML = '';
    host.appendChild(buildHeading('Leaderboard'));

    const { fetch, personalBestSurface } = snapshot;
    if (fetch.kind === 'idle' || fetch.kind === 'loading') {
      host.appendChild(buildMessage('Loading leaderboard…', 'leaderboard-panel__message--loading'));
      return;
    }
    if (fetch.kind === 'offline') {
      host.appendChild(
        buildMessage('Leaderboard offline', 'leaderboard-panel__message--offline'),
      );
      return;
    }
    // fetch.kind === 'success'
    if (fetch.entries.length === 0 && personalBestSurface.kind !== 'pinned') {
      host.appendChild(
        buildMessage(
          'Be the first to claim a spot.',
          'leaderboard-panel__message--empty',
        ),
      );
      return;
    }
    host.appendChild(buildTable(fetch.entries, personalBestSurface));
  }

  function setHostVisibility(visible: boolean): void {
    if (destroyed) return;
    host.classList.toggle('hidden', !visible);
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    host.removeEventListener('pointerdown', stopPointer);
    host.removeEventListener('pointerup', stopPointer);
    host.innerHTML = '';
  }

  return { render, setHostVisibility, destroy };
}
