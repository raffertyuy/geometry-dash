import { createKVAdapter } from './kv-adapter';
import type { LeaderboardEntry, LeaderboardResponse } from '../shared/leaderboard-types';

/** Worker runtime bindings declared in wrangler.toml. */
export interface WorkerEnv {
  readonly LEADERBOARD: KVNamespace;
  readonly ASSETS: Fetcher;
  /**
   * Reserved for a future signing-key upgrade. Absent in v1; if bound,
   * future server logic would require + verify a `signature` field on POST.
   * Per the public-repo / secrets policy, this value lives ONLY in
   * Cloudflare Worker secrets (wrangler secret put), never in wrangler.toml.
   */
  readonly SIGNING_KEY?: string;
}

/** The KV-persisted shape — a versioned wrapper around the entries array. */
interface StoredBoard {
  readonly version: 1;
  readonly entries: readonly LeaderboardEntry[];
}

const KV_KEY_TOP20 = 'top20' as const;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const worker: ExportedHandler<WorkerEnv> = {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/leaderboard') {
      const kv = createKVAdapter(env.LEADERBOARD);

      if (request.method === 'GET') {
        try {
          const stored = await kv.get<StoredBoard>(KV_KEY_TOP20);
          const entries = stored?.entries ?? [];
          const body: LeaderboardResponse = { entries };
          console.log(JSON.stringify({ event: 'leaderboard_get', count: entries.length }));
          return jsonResponse(200, body);
        } catch (err) {
          console.log(
            JSON.stringify({
              event: 'leaderboard_get_failed',
              error: err instanceof Error ? err.message : String(err),
            }),
          );
          return jsonResponse(503, { error: 'storage_unavailable' });
        }
      }

      if (request.method === 'POST') {
        // Placeholder until US2 wires the real submission handler. Returns
        // a clean error so the client offline-graceful path still works.
        console.log(JSON.stringify({ event: 'leaderboard_post_stubbed' }));
        return jsonResponse(503, {
          accepted: false,
          error: 'storage_unavailable',
        });
      }

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204 });
      }

      return jsonResponse(405, { error: 'method_not_allowed' });
    }

    // Everything else: defer to the static-assets binding.
    return env.ASSETS.fetch(request);
  },
};

export default worker;
