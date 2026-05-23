import type { LeaderboardEntry } from '../shared/leaderboard-types';

/** Per-device personal best, persisted in localStorage. */
export interface PersonalBest {
  readonly score: number;
  readonly timeMs: number;
  /** ISO 8601 timestamp of when this PB was achieved. */
  readonly achievedAt: string;
}

/** Client-side leaderboard fetch state. Drives the panel render. */
export type FetchStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'success'; readonly entries: readonly LeaderboardEntry[] }
  | { readonly kind: 'offline'; readonly reason: 'network' | 'timeout' | 'http' };

/** How the personal best should appear next to the board. */
export type PersonalBestSurface =
  | { readonly kind: 'absent' }
  | { readonly kind: 'pinned'; readonly entry: LeaderboardEntry }
  | { readonly kind: 'highlighted'; readonly atIndex: number };
