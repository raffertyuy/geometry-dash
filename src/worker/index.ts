import { handleGet, handlePost, type HandlerContext } from './handlers';
import { createKVAdapter } from './kv-adapter';
import type { SubmissionResponse } from '../shared/leaderboard-types';

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

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function statusForSubmission(response: SubmissionResponse): number {
  if (response.accepted) return 200;
  switch (response.error) {
    case 'invalid_payload':
    case 'profanity':
    case 'implausible_score':
      return 400;
    case 'rate_limited':
      return 429;
    case 'storage_unavailable':
      return 503;
    default:
      return 500;
  }
}

function logRequest(
  method: string,
  pathname: string,
  ip: string | null,
  outcome: string,
): void {
  // Truncate the IP for logging: keep first three octets, redact the last.
  // (Best-effort obfuscation; the real audit comes from Cloudflare's edge logs.)
  let ipHash = '-';
  if (ip) {
    const parts = ip.split('.');
    ipHash = parts.length === 4 ? `${parts.slice(0, 3).join('.')}.x` : 'ipv6';
  }
  console.log(JSON.stringify({ event: 'leaderboard_request', method, pathname, ip: ipHash, outcome }));
}

const worker: ExportedHandler<WorkerEnv> = {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/leaderboard') {
      const kv = createKVAdapter(env.LEADERBOARD);
      const ctx: HandlerContext =
        env.SIGNING_KEY !== undefined
          ? {
              kv,
              now: () => new Date(),
              clientIp: request.headers.get('CF-Connecting-IP'),
              signingKey: env.SIGNING_KEY,
            }
          : {
              kv,
              now: () => new Date(),
              clientIp: request.headers.get('CF-Connecting-IP'),
            };

      try {
        if (request.method === 'GET') {
          const body = await handleGet(ctx);
          logRequest('GET', url.pathname, ctx.clientIp, `ok:${body.entries.length}`);
          return jsonResponse(200, body);
        }
        if (request.method === 'POST') {
          let payload: unknown = null;
          try {
            payload = await request.json();
          } catch {
            // Fall through with payload = null → validation will reject.
          }
          const body = await handlePost(ctx, payload);
          const status = statusForSubmission(body);
          logRequest(
            'POST',
            url.pathname,
            ctx.clientIp,
            body.accepted ? `accepted:${body.entries.length}` : `rejected:${body.error}`,
          );
          return jsonResponse(status, body);
        }
        if (request.method === 'OPTIONS') {
          return new Response(null, { status: 204 });
        }
        logRequest(request.method, url.pathname, ctx.clientIp, 'method_not_allowed');
        return jsonResponse(405, { error: 'method_not_allowed' });
      } catch (err) {
        logRequest(
          request.method,
          url.pathname,
          ctx.clientIp,
          `internal:${err instanceof Error ? err.message : String(err)}`,
        );
        return jsonResponse(500, { error: 'storage_unavailable' });
      }
    }

    // Everything else: defer to the static-assets binding.
    return env.ASSETS.fetch(request);
  },
};

export default worker;
