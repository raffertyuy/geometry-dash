import { describe, expect, it } from 'vitest';
import { LEADERBOARD_MAX_ENTRIES } from '../shared/config';
import { handleGet, handlePost, KV_KEY_TOP20, type HandlerContext } from './handlers';
import { createInMemoryKVAdapter, type KVAdapter } from './kv-adapter';
import type { LeaderboardEntry } from '../shared/leaderboard-types';

function ctxFor(kv: KVAdapter, opts: Partial<HandlerContext> = {}): HandlerContext {
  return {
    kv,
    now: opts.now ?? (() => new Date('2026-05-23T14:00:00.000Z')),
    clientIp: opts.clientIp ?? '1.1.1.1',
    ...(opts.signingKey !== undefined ? { signingKey: opts.signingKey } : {}),
  };
}

async function seedBoard(kv: KVAdapter, entries: readonly LeaderboardEntry[]): Promise<void> {
  await kv.put(KV_KEY_TOP20, { version: 1, entries });
}

describe('handleGet', () => {
  it('returns empty entries when the board is missing', async () => {
    const kv = createInMemoryKVAdapter();
    const result = await handleGet(ctxFor(kv));
    expect(result).toEqual({ entries: [] });
  });

  it('returns the persisted entries when present', async () => {
    const kv = createInMemoryKVAdapter();
    const seed: LeaderboardEntry[] = [
      { initials: 'RAF', score: 1000, timeMs: 60_000, submittedAt: '2026-05-23T13:00:00.000Z' },
    ];
    await seedBoard(kv, seed);
    expect(await handleGet(ctxFor(kv))).toEqual({ entries: seed });
  });
});

describe('handlePost', () => {
  it('rejects malformed payloads with invalid_payload', async () => {
    const kv = createInMemoryKVAdapter();
    const result = await handlePost(ctxFor(kv), null);
    expect(result).toEqual({ accepted: false, error: 'invalid_payload' });
  });

  it('rejects profanity', async () => {
    const kv = createInMemoryKVAdapter();
    const result = await handlePost(ctxFor(kv), {
      initials: 'ass', // lowercase → uppercased → matched against wordlist
      score: 10,
      timeMs: 1000,
    });
    expect(result).toEqual({ accepted: false, error: 'profanity' });
  });

  it('rejects implausible scores', async () => {
    const kv = createInMemoryKVAdapter();
    const result = await handlePost(ctxFor(kv), {
      initials: 'RAF',
      score: 999_999_999,
      timeMs: 1000,
    });
    expect(result).toEqual({ accepted: false, error: 'implausible_score' });
  });

  it('rate-limits the (N+1)th submission from the same IP', async () => {
    const kv = createInMemoryKVAdapter();
    const at = new Date('2026-05-23T14:00:00.000Z');
    const baseCtx = ctxFor(kv, { now: () => at, clientIp: '1.1.1.1' });
    for (let i = 0; i < 10; i += 1) {
      const r = await handlePost(baseCtx, { initials: 'RAF', score: 10, timeMs: 1000 });
      expect(r.accepted).toBe(true);
    }
    const r = await handlePost(baseCtx, { initials: 'RAF', score: 10, timeMs: 1000 });
    expect(r.accepted).toBe(false);
    if (!r.accepted) {
      expect(r.error).toBe('rate_limited');
      expect(r.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it('accepts a low score on a non-empty non-full board without writing (entries unchanged)', async () => {
    const kv = createInMemoryKVAdapter();
    // Seed 19 high-score entries — submission of score=1 would crack the
    // (board.length < MAX) gate and so DOES get written. Use a full board
    // instead to exercise the "valid but doesn't crack" branch.
    const fullBoard: LeaderboardEntry[] = Array.from({ length: LEADERBOARD_MAX_ENTRIES }, (_, i) => ({
      initials: 'AAA',
      score: 1000 - i,
      timeMs: 60_000,
      submittedAt: `2026-05-22T${String(i).padStart(2, '0')}:00:00.000Z`,
    }));
    await seedBoard(kv, fullBoard);
    const result = await handlePost(ctxFor(kv), {
      initials: 'LOW',
      score: 1, // far below the 20th entry's score
      timeMs: 60_000,
    });
    expect(result).toEqual({ accepted: true, entries: fullBoard });
  });

  it('inserts a qualifying entry and returns the new board', async () => {
    const kv = createInMemoryKVAdapter();
    const result = await handlePost(ctxFor(kv), {
      initials: 'WIN',
      score: 5000,
      timeMs: 60_000,
    });
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.entries.length).toBe(1);
      expect(result.entries[0]?.initials).toBe('WIN');
      expect(result.entries[0]?.submittedAt).toBe('2026-05-23T14:00:00.000Z');
    }
  });

  it('stamps submittedAt from ctx.now()', async () => {
    const kv = createInMemoryKVAdapter();
    const ts = '2099-01-01T00:00:00.000Z';
    const result = await handlePost(
      ctxFor(kv, { now: () => new Date(ts) }),
      { initials: 'WIN', score: 5000, timeMs: 60_000 },
    );
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.entries[0]?.submittedAt).toBe(ts);
    }
  });

  it('forward-compat: a string `signature` is silently accepted when signingKey is unbound', async () => {
    const kv = createInMemoryKVAdapter();
    const result = await handlePost(ctxFor(kv), {
      initials: 'WIN',
      score: 5000,
      timeMs: 60_000,
      signature: 'opaque',
    });
    expect(result.accepted).toBe(true);
  });

  it('persists the new board so a subsequent handleGet sees it', async () => {
    const kv = createInMemoryKVAdapter();
    await handlePost(ctxFor(kv), { initials: 'AAA', score: 1, timeMs: 1000 });
    const result = await handleGet(ctxFor(kv));
    expect(result.entries.length).toBe(1);
    expect(result.entries[0]?.initials).toBe('AAA');
  });
});
