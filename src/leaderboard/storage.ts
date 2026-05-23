import {
  LEADERBOARD_DEFAULT_INITIALS,
  LEADERBOARD_STORAGE_KEY_LAST_INITIALS,
  LEADERBOARD_STORAGE_KEY_PERSONAL_BEST,
} from '../shared/config';
import type { PersonalBest } from './types';

/**
 * Per-device persisted state for the leaderboard slice. Reads are
 * corruption-tolerant; writes never throw (quota errors are swallowed
 * silently — the game keeps working, just without persistence).
 */
export interface LeaderboardStorage {
  /** Returns the last-used initials, or LEADERBOARD_DEFAULT_INITIALS if empty / corrupt. */
  getLastInitials(): string;
  /** Coerces to uppercase, truncates to 3 chars, persists. */
  setLastInitials(initials: string): void;
  /** Returns the PersonalBest record, or null if empty / corrupt. */
  getPersonalBest(): PersonalBest | null;
  /** Persists the PersonalBest record. */
  setPersonalBest(personalBest: PersonalBest): void;
}

type Backing = Pick<Storage, 'getItem' | 'setItem'>;

function defaultBacking(): Backing | null {
  // In Node / tests we may be called without window; the storage adapter
  // then degrades to a no-op (writes go nowhere, reads return defaults).
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isValidInitials(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{1,3}$/.test(value);
}

function isValidPersonalBest(value: unknown): value is PersonalBest {
  if (value === null || typeof value !== 'object') return false;
  const pb = value as Record<string, unknown>;
  return (
    typeof pb['score'] === 'number' &&
    Number.isFinite(pb['score']) &&
    typeof pb['timeMs'] === 'number' &&
    Number.isFinite(pb['timeMs']) &&
    typeof pb['achievedAt'] === 'string'
  );
}

export function createLeaderboardStorage(
  backing: Backing | null = defaultBacking(),
): LeaderboardStorage {
  function safeRead(key: string): string | null {
    if (!backing) return null;
    try {
      return backing.getItem(key);
    } catch {
      return null;
    }
  }
  function safeWrite(key: string, value: string): void {
    if (!backing) return;
    try {
      backing.setItem(key, value);
    } catch {
      // Quota / privacy mode / disabled storage — silently ignore.
    }
  }

  return {
    getLastInitials(): string {
      const raw = safeRead(LEADERBOARD_STORAGE_KEY_LAST_INITIALS);
      if (raw === null) return LEADERBOARD_DEFAULT_INITIALS;
      // Raw is a literal string, NOT JSON-encoded. This matches the
      // existing audio / autoContinue persistence style in the project.
      const candidate = raw.toUpperCase();
      return isValidInitials(candidate) ? candidate : LEADERBOARD_DEFAULT_INITIALS;
    },
    setLastInitials(initials: string): void {
      const normalised = initials.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
      if (normalised.length === 0) return;
      safeWrite(LEADERBOARD_STORAGE_KEY_LAST_INITIALS, normalised);
    },
    getPersonalBest(): PersonalBest | null {
      const raw = safeRead(LEADERBOARD_STORAGE_KEY_PERSONAL_BEST);
      if (raw === null) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        return isValidPersonalBest(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    setPersonalBest(personalBest: PersonalBest): void {
      safeWrite(
        LEADERBOARD_STORAGE_KEY_PERSONAL_BEST,
        JSON.stringify(personalBest),
      );
    },
  };
}
