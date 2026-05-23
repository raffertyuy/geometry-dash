import { describe, expect, it } from 'vitest';
import { LEADERBOARD_MAX_ENTRIES } from '../../src/shared/config';
import { handleGet, handlePost, type HandlerContext } from '../../src/worker/handlers';
import { createInMemoryKVAdapter } from '../../src/worker/kv-adapter';

function mkCtx(at: Date, ip = '1.1.1.1'): HandlerContext {
  const kv = createInMemoryKVAdapter();
  return { kv, now: () => at, clientIp: ip };
}

describe('integration: leaderboard submit + fetch + eviction', () => {
  it('full happy-path: empty → submit twice → see both in order → submit a third lower than #1 → ranked second', async () => {
    const kv = createInMemoryKVAdapter();
    const ctx = (at: Date, ip: string): HandlerContext => ({
      kv,
      now: () => at,
      clientIp: ip,
    });

    // Start empty.
    let board = await handleGet(ctx(new Date('2026-05-23T10:00:00Z'), '1.1.1.1'));
    expect(board.entries).toEqual([]);

    // Player A submits.
    const resA = await handlePost(
      ctx(new Date('2026-05-23T10:01:00Z'), '1.1.1.1'),
      { initials: 'AAA', score: 1000, timeMs: 60_000 },
    );
    expect(resA.accepted).toBe(true);

    // Player B submits a higher score.
    const resB = await handlePost(
      ctx(new Date('2026-05-23T10:02:00Z'), '2.2.2.2'),
      { initials: 'BBB', score: 5000, timeMs: 60_000 },
    );
    expect(resB.accepted).toBe(true);
    if (resB.accepted) {
      expect(resB.entries.map((e) => e.initials)).toEqual(['BBB', 'AAA']);
    }

    // GET reflects both.
    board = await handleGet(ctx(new Date('2026-05-23T10:03:00Z'), '3.3.3.3'));
    expect(board.entries.map((e) => e.initials)).toEqual(['BBB', 'AAA']);

    // Player C submits in between.
    const resC = await handlePost(
      ctx(new Date('2026-05-23T10:04:00Z'), '3.3.3.3'),
      { initials: 'CCC', score: 3000, timeMs: 60_000 },
    );
    expect(resC.accepted).toBe(true);
    if (resC.accepted) {
      expect(resC.entries.map((e) => e.initials)).toEqual(['BBB', 'CCC', 'AAA']);
    }
  });

  it('eviction: a 21st qualifying submission removes the lowest entry', async () => {
    const kv = createInMemoryKVAdapter();
    const ctxAt = (minute: number, ip: string): HandlerContext => ({
      kv,
      now: () => new Date(`2026-05-23T10:${String(minute).padStart(2, '0')}:00.000Z`),
      clientIp: ip,
    });

    // Submit MAX_ENTRIES descending scores: 20, 19, 18, ...
    for (let i = 0; i < LEADERBOARD_MAX_ENTRIES; i += 1) {
      const res = await handlePost(ctxAt(i, `10.0.0.${i + 1}`), {
        initials: 'AAA',
        score: 20 - i,
        timeMs: 60_000,
      });
      expect(res.accepted).toBe(true);
    }

    // Board now has 20 entries; the lowest score is 1 (the last submission).
    let board = await handleGet(ctxAt(50, '99.99.99.99'));
    expect(board.entries.length).toBe(LEADERBOARD_MAX_ENTRIES);
    expect(board.entries[board.entries.length - 1]?.score).toBe(1);

    // 21st submission with score 999 → must evict the score=1 entry.
    const resTop = await handlePost(ctxAt(51, '99.99.99.99'), {
      initials: 'TOP',
      score: 999,
      timeMs: 60_000,
    });
    expect(resTop.accepted).toBe(true);
    if (resTop.accepted) {
      expect(resTop.entries.length).toBe(LEADERBOARD_MAX_ENTRIES);
      expect(resTop.entries.find((e) => e.score === 1)).toBeUndefined();
      expect(resTop.entries[0]?.initials).toBe('TOP');
    }

    board = await handleGet(ctxAt(52, 'someone-else'));
    expect(board.entries[0]?.initials).toBe('TOP');
    expect(board.entries.find((e) => e.score === 1)).toBeUndefined();
  });

  it('non-qualifying submission on a full board returns the unchanged board (no write)', async () => {
    const kv = createInMemoryKVAdapter();
    const ctxAt = (minute: number, ip: string): HandlerContext => ({
      kv,
      now: () => new Date(`2026-05-23T10:${String(minute).padStart(2, '0')}:00.000Z`),
      clientIp: ip,
    });
    for (let i = 0; i < LEADERBOARD_MAX_ENTRIES; i += 1) {
      await handlePost(ctxAt(i, `10.0.0.${i + 1}`), {
        initials: 'AAA',
        score: 1000 - i,
        timeMs: 60_000,
      });
    }
    const beforeBoard = await handleGet(ctxAt(50, '99.99.99.99'));
    const res = await handlePost(ctxAt(51, '99.99.99.99'), {
      initials: 'LOW',
      score: 1,
      timeMs: 60_000,
    });
    expect(res.accepted).toBe(true);
    const afterBoard = await handleGet(ctxAt(52, 'someone-else'));
    expect(afterBoard.entries.map((e) => e.score)).toEqual(
      beforeBoard.entries.map((e) => e.score),
    );
  });

  it('mkCtx helper isolation (no test pollution)', async () => {
    const ctx = mkCtx(new Date());
    const result = await handleGet(ctx);
    expect(result.entries).toEqual([]);
  });
});
