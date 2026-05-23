import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEADERBOARD_DEFAULT_INITIALS,
  LEADERBOARD_STORAGE_KEY_LAST_INITIALS,
  LEADERBOARD_STORAGE_KEY_PERSONAL_BEST,
} from '../shared/config';
import { createLeaderboardStorage } from './storage';
import type { PersonalBest } from './types';

function createStubBacking(): { backing: Pick<Storage, 'getItem' | 'setItem'>; store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    backing: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      },
    },
    store,
  };
}

describe('createLeaderboardStorage', () => {
  describe('getLastInitials', () => {
    it('returns the default when empty', () => {
      const { backing } = createStubBacking();
      const storage = createLeaderboardStorage(backing);
      expect(storage.getLastInitials()).toBe(LEADERBOARD_DEFAULT_INITIALS);
    });

    it('returns the persisted value', () => {
      const { backing, store } = createStubBacking();
      store.set(LEADERBOARD_STORAGE_KEY_LAST_INITIALS, 'RAF');
      const storage = createLeaderboardStorage(backing);
      expect(storage.getLastInitials()).toBe('RAF');
    });

    it('uppercases a lowercase persisted value', () => {
      const { backing, store } = createStubBacking();
      store.set(LEADERBOARD_STORAGE_KEY_LAST_INITIALS, 'raf');
      const storage = createLeaderboardStorage(backing);
      expect(storage.getLastInitials()).toBe('RAF');
    });

    it('returns the default when the stored value contains non-letters', () => {
      const { backing, store } = createStubBacking();
      store.set(LEADERBOARD_STORAGE_KEY_LAST_INITIALS, 'R3F');
      const storage = createLeaderboardStorage(backing);
      expect(storage.getLastInitials()).toBe(LEADERBOARD_DEFAULT_INITIALS);
    });

    it('returns the default when the stored value is too long', () => {
      const { backing, store } = createStubBacking();
      store.set(LEADERBOARD_STORAGE_KEY_LAST_INITIALS, 'WXYZ');
      const storage = createLeaderboardStorage(backing);
      expect(storage.getLastInitials()).toBe(LEADERBOARD_DEFAULT_INITIALS);
    });
  });

  describe('setLastInitials', () => {
    it('persists an uppercase 3-char value as-is', () => {
      const { backing, store } = createStubBacking();
      const storage = createLeaderboardStorage(backing);
      storage.setLastInitials('RAF');
      expect(store.get(LEADERBOARD_STORAGE_KEY_LAST_INITIALS)).toBe('RAF');
    });

    it('uppercases a lowercase value', () => {
      const { backing, store } = createStubBacking();
      const storage = createLeaderboardStorage(backing);
      storage.setLastInitials('raf');
      expect(store.get(LEADERBOARD_STORAGE_KEY_LAST_INITIALS)).toBe('RAF');
    });

    it('strips non-letters', () => {
      const { backing, store } = createStubBacking();
      const storage = createLeaderboardStorage(backing);
      storage.setLastInitials('R3F!');
      expect(store.get(LEADERBOARD_STORAGE_KEY_LAST_INITIALS)).toBe('RF');
    });

    it('truncates to 3 characters', () => {
      const { backing, store } = createStubBacking();
      const storage = createLeaderboardStorage(backing);
      storage.setLastInitials('RAFFY');
      expect(store.get(LEADERBOARD_STORAGE_KEY_LAST_INITIALS)).toBe('RAF');
    });

    it('does not persist an empty (post-normalisation) value', () => {
      const { backing, store } = createStubBacking();
      const storage = createLeaderboardStorage(backing);
      storage.setLastInitials('!!!');
      expect(store.has(LEADERBOARD_STORAGE_KEY_LAST_INITIALS)).toBe(false);
    });

    it('absorbs setItem quota errors silently', () => {
      const throwingBacking: Pick<Storage, 'getItem' | 'setItem'> = {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      };
      const storage = createLeaderboardStorage(throwingBacking);
      expect(() => storage.setLastInitials('RAF')).not.toThrow();
    });
  });

  describe('getPersonalBest', () => {
    it('returns null when empty', () => {
      const { backing } = createStubBacking();
      const storage = createLeaderboardStorage(backing);
      expect(storage.getPersonalBest()).toBeNull();
    });

    it('round-trips a valid record', () => {
      const { backing, store } = createStubBacking();
      const pb: PersonalBest = {
        score: 4200,
        timeMs: 180_000,
        achievedAt: '2026-05-23T14:55:21.123Z',
      };
      store.set(LEADERBOARD_STORAGE_KEY_PERSONAL_BEST, JSON.stringify(pb));
      const storage = createLeaderboardStorage(backing);
      expect(storage.getPersonalBest()).toEqual(pb);
    });

    it('returns null when the stored JSON is malformed', () => {
      const { backing, store } = createStubBacking();
      store.set(LEADERBOARD_STORAGE_KEY_PERSONAL_BEST, '{not json');
      const storage = createLeaderboardStorage(backing);
      expect(storage.getPersonalBest()).toBeNull();
    });

    it('returns null when the stored record is missing fields', () => {
      const { backing, store } = createStubBacking();
      store.set(LEADERBOARD_STORAGE_KEY_PERSONAL_BEST, JSON.stringify({ score: 100 }));
      const storage = createLeaderboardStorage(backing);
      expect(storage.getPersonalBest()).toBeNull();
    });

    it('returns null when fields are the wrong type', () => {
      const { backing, store } = createStubBacking();
      store.set(
        LEADERBOARD_STORAGE_KEY_PERSONAL_BEST,
        JSON.stringify({ score: 'a lot', timeMs: 1, achievedAt: 'now' }),
      );
      const storage = createLeaderboardStorage(backing);
      expect(storage.getPersonalBest()).toBeNull();
    });
  });

  describe('setPersonalBest', () => {
    it('writes JSON-encoded data', () => {
      const { backing, store } = createStubBacking();
      const storage = createLeaderboardStorage(backing);
      const pb: PersonalBest = { score: 1, timeMs: 2, achievedAt: 'iso' };
      storage.setPersonalBest(pb);
      expect(JSON.parse(store.get(LEADERBOARD_STORAGE_KEY_PERSONAL_BEST)!)).toEqual(pb);
    });
  });

  describe('null backing', () => {
    let storage: ReturnType<typeof createLeaderboardStorage>;
    beforeEach(() => {
      storage = createLeaderboardStorage(null);
    });

    it('returns defaults on read', () => {
      expect(storage.getLastInitials()).toBe(LEADERBOARD_DEFAULT_INITIALS);
      expect(storage.getPersonalBest()).toBeNull();
    });

    it('does not throw on write', () => {
      expect(() => storage.setLastInitials('RAF')).not.toThrow();
      expect(() =>
        storage.setPersonalBest({ score: 1, timeMs: 1, achievedAt: 'iso' }),
      ).not.toThrow();
    });
  });
});
