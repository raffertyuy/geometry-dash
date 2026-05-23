import { describe, expect, it } from 'vitest';
import { LEADERBOARD_RATE_LIMIT_PER_HOUR } from '../shared/config';
import { createInMemoryKVAdapter } from './kv-adapter';
import { checkAndIncrement, rateLimitKey } from './rate-limit';

describe('rateLimitKey', () => {
  it('formats correctly', () => {
    expect(rateLimitKey('1.2.3.4', 471234)).toBe('rl:1.2.3.4:471234');
  });
});

describe('checkAndIncrement', () => {
  it('allows the first submission in a bucket', async () => {
    const kv = createInMemoryKVAdapter();
    const result = await checkAndIncrement(kv, '1.1.1.1', new Date('2026-05-23T12:00:00Z'));
    expect(result).toEqual({ kind: 'allowed' });
  });

  it('allows up to LEADERBOARD_RATE_LIMIT_PER_HOUR submissions in the same bucket', async () => {
    const kv = createInMemoryKVAdapter();
    const at = new Date('2026-05-23T12:00:00Z');
    for (let i = 0; i < LEADERBOARD_RATE_LIMIT_PER_HOUR; i += 1) {
      const r = await checkAndIncrement(kv, '1.1.1.1', at);
      expect(r.kind).toBe('allowed');
    }
  });

  it('rejects the (N+1)th submission in the same bucket with a positive retryAfterSeconds', async () => {
    const kv = createInMemoryKVAdapter();
    const at = new Date('2026-05-23T12:30:00Z');
    for (let i = 0; i < LEADERBOARD_RATE_LIMIT_PER_HOUR; i += 1) {
      await checkAndIncrement(kv, '1.1.1.1', at);
    }
    const result = await checkAndIncrement(kv, '1.1.1.1', at);
    expect(result.kind).toBe('rejected');
    if (result.kind === 'rejected') {
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      // 12:30:00 → next boundary 13:00:00 → 1800 seconds.
      expect(result.retryAfterSeconds).toBe(1800);
    }
  });

  it('resets in the next hour bucket', async () => {
    const kv = createInMemoryKVAdapter();
    const at = new Date('2026-05-23T12:00:00Z');
    for (let i = 0; i < LEADERBOARD_RATE_LIMIT_PER_HOUR; i += 1) {
      await checkAndIncrement(kv, '1.1.1.1', at);
    }
    expect((await checkAndIncrement(kv, '1.1.1.1', at)).kind).toBe('rejected');
    const nextHour = new Date('2026-05-23T13:00:00Z');
    expect((await checkAndIncrement(kv, '1.1.1.1', nextHour)).kind).toBe('allowed');
  });

  it('tracks different IPs independently', async () => {
    const kv = createInMemoryKVAdapter();
    const at = new Date('2026-05-23T12:00:00Z');
    for (let i = 0; i < LEADERBOARD_RATE_LIMIT_PER_HOUR; i += 1) {
      await checkAndIncrement(kv, '1.1.1.1', at);
    }
    expect((await checkAndIncrement(kv, '2.2.2.2', at)).kind).toBe('allowed');
  });

  it('null IP falls back to a shared "unknown" bucket', async () => {
    const kv = createInMemoryKVAdapter();
    const at = new Date('2026-05-23T12:00:00Z');
    for (let i = 0; i < LEADERBOARD_RATE_LIMIT_PER_HOUR; i += 1) {
      await checkAndIncrement(kv, null, at);
    }
    expect((await checkAndIncrement(kv, null, at)).kind).toBe('rejected');
  });
});
