// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createLeaderboardPanel } from './leaderboard-panel';
import type { LeaderboardEntry } from '../shared/leaderboard-types';
import type { PersonalBestSurface } from '../leaderboard';

function entry(score: number, initials = 'RAF'): LeaderboardEntry {
  return { initials, score, timeMs: 1000, submittedAt: '2026-05-23T00:00:00.000Z' };
}

const ABSENT: PersonalBestSurface = { kind: 'absent' };

let host: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<section id="panel"></section>';
  host = document.querySelector<HTMLElement>('#panel')!;
});

describe('createLeaderboardPanel', () => {
  it('sets data-no-game-start="true" on the host', () => {
    createLeaderboardPanel(host);
    expect(host.getAttribute('data-no-game-start')).toBe('true');
  });

  it('renders the loading state on idle', () => {
    const panel = createLeaderboardPanel(host);
    panel.render({ fetch: { kind: 'idle' }, personalBestSurface: ABSENT });
    expect(host.querySelector('.leaderboard-panel__message--loading')).not.toBeNull();
    expect(host.querySelector('table')).toBeNull();
  });

  it('renders the loading state on loading', () => {
    const panel = createLeaderboardPanel(host);
    panel.render({ fetch: { kind: 'loading' }, personalBestSurface: ABSENT });
    expect(host.querySelector('.leaderboard-panel__message--loading')).not.toBeNull();
  });

  it('renders the empty state on success with 0 entries', () => {
    const panel = createLeaderboardPanel(host);
    panel.render({
      fetch: { kind: 'success', entries: [] },
      personalBestSurface: ABSENT,
    });
    expect(host.querySelector('.leaderboard-panel__message--empty')).not.toBeNull();
    expect(host.querySelector('table')).toBeNull();
  });

  it('renders exactly N rows on success with N entries', () => {
    const panel = createLeaderboardPanel(host);
    const entries = [entry(100), entry(80), entry(60)];
    panel.render({
      fetch: { kind: 'success', entries },
      personalBestSurface: ABSENT,
    });
    const rows = host.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });

  it('wraps the table in a scroll container so the heading can stay fixed', () => {
    const panel = createLeaderboardPanel(host);
    panel.render({
      fetch: { kind: 'success', entries: [entry(100)] },
      personalBestSurface: ABSENT,
    });
    const scroll = host.querySelector('.leaderboard-panel__scroll');
    expect(scroll).not.toBeNull();
    expect(scroll?.querySelector('table')).not.toBeNull();
  });

  it('renders rank starting at #1', () => {
    const panel = createLeaderboardPanel(host);
    panel.render({
      fetch: { kind: 'success', entries: [entry(100), entry(80)] },
      personalBestSurface: ABSENT,
    });
    const firstRank = host.querySelector('tbody tr td.leaderboard-panel__cell--rank');
    expect(firstRank?.textContent).toBe('#1');
  });

  it('renders the offline state', () => {
    const panel = createLeaderboardPanel(host);
    panel.render({
      fetch: { kind: 'offline', reason: 'network' },
      personalBestSurface: ABSENT,
    });
    expect(host.querySelector('.leaderboard-panel__message--offline')).not.toBeNull();
    expect(host.querySelector('table')).toBeNull();
  });

  it('highlights the row at the personal-best index', () => {
    const panel = createLeaderboardPanel(host);
    panel.render({
      fetch: { kind: 'success', entries: [entry(100), entry(80), entry(60)] },
      personalBestSurface: { kind: 'highlighted', atIndex: 1 },
    });
    const rows = host.querySelectorAll('tbody tr');
    expect(rows[0]?.getAttribute('data-highlighted')).toBeNull();
    expect(rows[1]?.getAttribute('data-highlighted')).toBe('true');
    expect(rows[2]?.getAttribute('data-highlighted')).toBeNull();
  });

  it('shows a pinned row above the table when surface is pinned', () => {
    const panel = createLeaderboardPanel(host);
    panel.render({
      fetch: { kind: 'success', entries: [entry(100), entry(80)] },
      personalBestSurface: { kind: 'pinned', entry: entry(50, 'YOU') },
    });
    const rows = host.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    expect(rows[0]?.getAttribute('data-pinned')).toBe('true');
    expect(rows[0]?.querySelector('.leaderboard-panel__cell--rank')?.textContent).toBe('—');
    expect(rows[0]?.querySelector('.leaderboard-panel__cell--initials')?.textContent).toBe('YOU');
  });

  it('shows the pinned row even when the global board is empty', () => {
    const panel = createLeaderboardPanel(host);
    panel.render({
      fetch: { kind: 'success', entries: [] },
      personalBestSurface: { kind: 'pinned', entry: entry(50, 'YOU') },
    });
    const pinned = host.querySelector('tbody tr[data-pinned="true"]');
    expect(pinned).not.toBeNull();
    expect(host.querySelector('.leaderboard-panel__message--empty')).toBeNull();
  });

  it('pointer events inside the panel are absorbed (stopPropagation)', () => {
    createLeaderboardPanel(host);
    let bubbled = false;
    window.addEventListener('pointerdown', () => {
      bubbled = true;
    });
    const evt = new Event('pointerdown', { bubbles: true });
    host.dispatchEvent(evt);
    expect(bubbled).toBe(false);
  });

  it('destroy clears the host and removes listeners', () => {
    const panel = createLeaderboardPanel(host);
    panel.render({
      fetch: { kind: 'success', entries: [entry(100)] },
      personalBestSurface: ABSENT,
    });
    panel.destroy();
    expect(host.innerHTML).toBe('');
    let bubbled = false;
    window.addEventListener('pointerdown', () => {
      bubbled = true;
    });
    host.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(bubbled).toBe(true);
  });

  it('setHostVisibility toggles the hidden class', () => {
    const panel = createLeaderboardPanel(host);
    panel.setHostVisibility(false);
    expect(host.classList.contains('hidden')).toBe(true);
    panel.setHostVisibility(true);
    expect(host.classList.contains('hidden')).toBe(false);
  });
});
