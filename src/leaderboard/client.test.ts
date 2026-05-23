import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLeaderboardClient } from './client';
import type { LeaderboardEntry } from '../shared/leaderboard-types';

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeRawResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain' } });
}

const entry: LeaderboardEntry = {
  initials: 'RAF',
  score: 1000,
  timeMs: 5000,
  submittedAt: '2026-05-23T00:00:00.000Z',
};

beforeEach(() => {
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('createLeaderboardClient — fetchLeaderboard', () => {
  it('returns success on a 200 with valid JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { entries: [entry] }));
    const client = createLeaderboardClient({ fetchImpl });
    expect(await client.fetchLeaderboard()).toEqual({ kind: 'success', entries: [entry] });
  });

  it('returns offline:network on a thrown TypeError', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('NetworkError'));
    const client = createLeaderboardClient({ fetchImpl });
    expect(await client.fetchLeaderboard()).toEqual({ kind: 'offline', reason: 'network' });
  });

  it('returns offline:timeout when the request aborts', async () => {
    const abortErr = new DOMException('aborted', 'AbortError');
    const fetchImpl = vi.fn().mockRejectedValue(abortErr);
    const client = createLeaderboardClient({ fetchImpl });
    expect(await client.fetchLeaderboard()).toEqual({ kind: 'offline', reason: 'timeout' });
  });

  it('returns offline:http on a 500 response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(500, { error: 'storage_unavailable' }));
    const client = createLeaderboardClient({ fetchImpl });
    expect(await client.fetchLeaderboard()).toEqual({ kind: 'offline', reason: 'http' });
  });

  it('returns offline:http when the body is non-JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeRawResponse(200, 'oops'));
    const client = createLeaderboardClient({ fetchImpl });
    expect(await client.fetchLeaderboard()).toEqual({ kind: 'offline', reason: 'http' });
  });

  it('returns offline:http when the shape is wrong', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { foo: 'bar' }));
    const client = createLeaderboardClient({ fetchImpl });
    expect(await client.fetchLeaderboard()).toEqual({ kind: 'offline', reason: 'http' });
  });

  it('emits the fetch_started + fetch_succeeded debug events on success', async () => {
    const debugSpy = vi.spyOn(console, 'debug');
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { entries: [entry] }));
    const client = createLeaderboardClient({ fetchImpl });
    await client.fetchLeaderboard();
    const events = debugSpy.mock.calls
      .map((args) => (typeof args[0] === 'object' && args[0] && (args[0] as { event?: string }).event) || '')
      .filter(Boolean);
    expect(events).toContain('leaderboard_fetch_started');
    expect(events).toContain('leaderboard_fetch_succeeded');
  });
});

describe('createLeaderboardClient — submitScore', () => {
  it('returns accepted:true on 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { accepted: true, entries: [entry] }));
    const client = createLeaderboardClient({ fetchImpl });
    const result = await client.submitScore({ initials: 'RAF', score: 1000, timeMs: 5000 });
    expect(result).toEqual({ accepted: true, entries: [entry] });
  });

  it('returns accepted:false with error code on 400', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(400, { accepted: false, error: 'profanity' }));
    const client = createLeaderboardClient({ fetchImpl });
    const result = await client.submitScore({ initials: 'XXX', score: 1, timeMs: 1 });
    expect(result).toEqual({ accepted: false, error: 'profanity' });
  });

  it('returns rate_limited with retryAfterSeconds on 429', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      makeResponse(429, { accepted: false, error: 'rate_limited', retryAfterSeconds: 1800 }),
    );
    const client = createLeaderboardClient({ fetchImpl });
    const result = await client.submitScore({ initials: 'AAA', score: 1, timeMs: 1 });
    expect(result).toEqual({ accepted: false, error: 'rate_limited', retryAfterSeconds: 1800 });
  });

  it('returns storage_unavailable on network error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('NetworkError'));
    const client = createLeaderboardClient({ fetchImpl });
    const result = await client.submitScore({ initials: 'AAA', score: 1, timeMs: 1 });
    expect(result).toEqual({ accepted: false, error: 'storage_unavailable' });
  });

  it('returns storage_unavailable when body shape is unrecognised', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { weird: true }));
    const client = createLeaderboardClient({ fetchImpl });
    const result = await client.submitScore({ initials: 'AAA', score: 1, timeMs: 1 });
    expect(result).toEqual({ accepted: false, error: 'storage_unavailable' });
  });

  it('emits submit_started + submit_accepted on accept', async () => {
    const debugSpy = vi.spyOn(console, 'debug');
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { accepted: true, entries: [entry] }));
    const client = createLeaderboardClient({ fetchImpl });
    await client.submitScore({ initials: 'RAF', score: 1000, timeMs: 5000 });
    const events = debugSpy.mock.calls
      .map((args) => (typeof args[0] === 'object' && args[0] && (args[0] as { event?: string }).event) || '')
      .filter(Boolean);
    expect(events).toContain('leaderboard_submit_started');
    expect(events).toContain('leaderboard_submit_accepted');
  });

  it('emits submit_rejected with code on reject', async () => {
    const debugSpy = vi.spyOn(console, 'debug');
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(400, { accepted: false, error: 'profanity' }));
    const client = createLeaderboardClient({ fetchImpl });
    await client.submitScore({ initials: 'XXX', score: 1, timeMs: 1 });
    const codes = debugSpy.mock.calls
      .filter(
        (args) =>
          typeof args[0] === 'object' &&
          args[0] &&
          (args[0] as { event?: string }).event === 'leaderboard_submit_rejected',
      )
      .map((args) => (args[0] as { code?: string }).code);
    expect(codes).toContain('profanity');
  });
});
