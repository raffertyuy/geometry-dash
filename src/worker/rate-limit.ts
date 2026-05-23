import {
  LEADERBOARD_RATE_LIMIT_BUCKET_TTL_SECONDS,
  LEADERBOARD_RATE_LIMIT_PER_HOUR,
} from '../shared/config';
import type { KVAdapter } from './kv-adapter';

export type RateLimitResult =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'rejected'; readonly retryAfterSeconds: number };

/** KV key naming for the fixed-window rate-limit bucket. */
export function rateLimitKey(ipAddress: string, hourBucket: number): string {
  return `rl:${ipAddress}:${hourBucket}`;
}

/**
 * Check + increment the per-IP, per-hour-bucket submission counter. See
 * research.md §R4. Pure-ish: the only side effect is the KV put.
 *
 * `ipAddress` of `null` falls back to a "unknown" bucket so unattributable
 * traffic still hits a single shared limit instead of being unbounded.
 */
export async function checkAndIncrement(
  kv: KVAdapter,
  ipAddress: string | null,
  now: Date,
): Promise<RateLimitResult> {
  const nowMs = now.getTime();
  const hourBucket = Math.floor(nowMs / 3_600_000);
  const ip = ipAddress ?? 'unknown';
  const key = rateLimitKey(ip, hourBucket);

  const currentRaw = await kv.get<number>(key);
  const count = typeof currentRaw === 'number' && Number.isFinite(currentRaw) ? currentRaw : 0;

  if (count >= LEADERBOARD_RATE_LIMIT_PER_HOUR) {
    const nextBoundaryMs = (hourBucket + 1) * 3_600_000;
    const retryAfterSeconds = Math.max(1, Math.ceil((nextBoundaryMs - nowMs) / 1000));
    return { kind: 'rejected', retryAfterSeconds };
  }

  await kv.put(key, count + 1, {
    expirationTtlSeconds: LEADERBOARD_RATE_LIMIT_BUCKET_TTL_SECONDS,
  });
  return { kind: 'allowed' };
}
