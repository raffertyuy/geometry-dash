import { LEADERBOARD_FETCH_TIMEOUT_MS } from '../shared/config';
import type {
  LeaderboardEntry,
  LeaderboardResponse,
  SubmissionErrorCode,
  SubmissionRequest,
  SubmissionResponse,
} from '../shared/leaderboard-types';

/** Result of a GET /api/leaderboard call. */
export type FetchOutcome =
  | { readonly kind: 'success'; readonly entries: readonly LeaderboardEntry[] }
  | { readonly kind: 'offline'; readonly reason: 'network' | 'timeout' | 'http' };

export interface LeaderboardClient {
  fetchLeaderboard(): Promise<FetchOutcome>;
  submitScore(payload: SubmissionRequest): Promise<SubmissionResponse>;
}

export interface CreateLeaderboardClientOptions {
  /** Base URL prefix. Defaults to '' (same-origin). */
  readonly baseUrl?: string;
  /** Abort timeout in ms. Defaults to LEADERBOARD_FETCH_TIMEOUT_MS. */
  readonly timeoutMs?: number;
  /** Injectable fetch — defaults to the global `fetch`. Used by tests. */
  readonly fetchImpl?: typeof fetch;
}

const VALID_ERROR_CODES: readonly SubmissionErrorCode[] = [
  'invalid_payload',
  'profanity',
  'implausible_score',
  'rate_limited',
  'storage_unavailable',
];

function isErrorCode(value: unknown): value is SubmissionErrorCode {
  return typeof value === 'string' && (VALID_ERROR_CODES as readonly string[]).includes(value);
}

function isLeaderboardResponse(value: unknown): value is LeaderboardResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { entries?: unknown }).entries)
  );
}

export function createLeaderboardClient(
  options: CreateLeaderboardClientOptions = {},
): LeaderboardClient {
  const baseUrl = options.baseUrl ?? '';
  const timeoutMs = options.timeoutMs ?? LEADERBOARD_FETCH_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function timedFetch(input: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchLeaderboard(): Promise<FetchOutcome> {
    console.debug({ event: 'leaderboard_fetch_started' });
    try {
      const res = await timedFetch(`${baseUrl}/api/leaderboard`);
      if (!res.ok) {
        console.debug({ event: 'leaderboard_fetch_failed', reason: 'http', status: res.status });
        return { kind: 'offline', reason: 'http' };
      }
      let parsed: unknown;
      try {
        parsed = await res.json();
      } catch {
        console.debug({ event: 'leaderboard_fetch_failed', reason: 'http', detail: 'invalid_json' });
        return { kind: 'offline', reason: 'http' };
      }
      if (!isLeaderboardResponse(parsed)) {
        console.debug({ event: 'leaderboard_fetch_failed', reason: 'http', detail: 'invalid_shape' });
        return { kind: 'offline', reason: 'http' };
      }
      console.debug({ event: 'leaderboard_fetch_succeeded', count: parsed.entries.length });
      return { kind: 'success', entries: parsed.entries };
    } catch (err) {
      const reason = err instanceof DOMException && err.name === 'AbortError' ? 'timeout' : 'network';
      console.debug({
        event: 'leaderboard_fetch_failed',
        reason,
        message: err instanceof Error ? err.message : String(err),
      });
      return { kind: 'offline', reason };
    }
  }

  async function submitScore(payload: SubmissionRequest): Promise<SubmissionResponse> {
    console.debug({ event: 'leaderboard_submit_started', initials: payload.initials, score: payload.score });
    try {
      const res = await timedFetch(`${baseUrl}/api/leaderboard`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        // Fall through; we'll surface a storage_unavailable below.
      }
      if (res.status === 200 && body && (body as { accepted?: unknown }).accepted === true) {
        const entries = (body as { entries?: unknown }).entries;
        if (Array.isArray(entries)) {
          console.debug({ event: 'leaderboard_submit_accepted', count: entries.length });
          return { accepted: true, entries: entries as readonly LeaderboardEntry[] };
        }
      }
      if (body && (body as { error?: unknown }).error && isErrorCode((body as { error: unknown }).error)) {
        const error = (body as { error: SubmissionErrorCode }).error;
        const retryAfter = (body as { retryAfterSeconds?: unknown }).retryAfterSeconds;
        console.debug({ event: 'leaderboard_submit_rejected', code: error });
        if (typeof retryAfter === 'number' && Number.isFinite(retryAfter)) {
          return { accepted: false, error, retryAfterSeconds: retryAfter };
        }
        return { accepted: false, error };
      }
      console.debug({ event: 'leaderboard_submit_rejected', code: 'storage_unavailable', status: res.status });
      return { accepted: false, error: 'storage_unavailable' };
    } catch (err) {
      console.debug({
        event: 'leaderboard_submit_rejected',
        code: 'storage_unavailable',
        message: err instanceof Error ? err.message : String(err),
      });
      return { accepted: false, error: 'storage_unavailable' };
    }
  }

  return { fetchLeaderboard, submitScore };
}
