import type {
  LeaderboardEntry,
  LeaderboardResponse,
  SubmissionResponse,
} from '../shared/leaderboard-types';
import { cracksTopN, insertEntry } from './board';
import type { KVAdapter } from './kv-adapter';
import { containsProfanity } from './profanity';
import { checkAndIncrement } from './rate-limit';
import { validateSubmission } from './validation';

/** Persisted KV shape — a versioned wrapper. Future versions are additive. */
interface StoredBoard {
  readonly version: 1;
  readonly entries: readonly LeaderboardEntry[];
}

export const KV_KEY_TOP20 = 'top20' as const;

export interface HandlerContext {
  readonly kv: KVAdapter;
  /** Injectable now() so tests can pin server timestamps. */
  readonly now: () => Date;
  /** Trusted client IP from `CF-Connecting-IP`. Null if missing (e.g. local dev). */
  readonly clientIp: string | null;
  /** Reserved for a future signing-key upgrade; ignored when undefined. */
  readonly signingKey?: string;
}

async function readBoard(kv: KVAdapter): Promise<readonly LeaderboardEntry[]> {
  const stored = await kv.get<StoredBoard>(KV_KEY_TOP20);
  return stored?.entries ?? [];
}

async function writeBoard(
  kv: KVAdapter,
  entries: readonly LeaderboardEntry[],
): Promise<void> {
  const next: StoredBoard = { version: 1, entries };
  await kv.put(KV_KEY_TOP20, next);
}

export async function handleGet(ctx: HandlerContext): Promise<LeaderboardResponse> {
  const entries = await readBoard(ctx.kv);
  return { entries };
}

export async function handlePost(
  ctx: HandlerContext,
  rawPayload: unknown,
): Promise<SubmissionResponse> {
  // 1. Validate payload shape + plausibility.
  const validation = validateSubmission(rawPayload);
  if (validation.kind === 'err') {
    return { accepted: false, error: validation.code };
  }
  const { initials, score, timeMs } = validation.value;

  // 2. Profanity check.
  if (containsProfanity(initials)) {
    return { accepted: false, error: 'profanity' };
  }

  // 3. Rate limit. Skipped in local dev (no CF-Connecting-IP header) so
  // a developer iterating against `wrangler dev` doesn't lock themselves
  // out after 10 test submissions. Cloudflare's edge always sets the
  // header for real traffic, so production rate-limiting is unaffected.
  if (ctx.clientIp !== null) {
    const rateLimit = await checkAndIncrement(ctx.kv, ctx.clientIp, ctx.now());
    if (rateLimit.kind === 'rejected') {
      return {
        accepted: false,
        error: 'rate_limited',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      };
    }
  }

  // 4. Read current board; decide if write is needed.
  let currentBoard: readonly LeaderboardEntry[];
  try {
    currentBoard = await readBoard(ctx.kv);
  } catch (err) {
    console.log(
      JSON.stringify({
        event: 'leaderboard_storage_error',
        phase: 'read',
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return { accepted: false, error: 'storage_unavailable' };
  }

  if (!cracksTopN(currentBoard, { score })) {
    // Submission was valid + not abusive, but didn't qualify. Return the
    // unchanged board so the client cache stays in sync. No write happens.
    return { accepted: true, entries: currentBoard };
  }

  // 5. Insert + persist.
  const candidate: LeaderboardEntry = {
    initials,
    score,
    timeMs,
    submittedAt: ctx.now().toISOString(),
  };
  const nextBoard = insertEntry(currentBoard, candidate);
  try {
    await writeBoard(ctx.kv, nextBoard);
  } catch (err) {
    console.log(
      JSON.stringify({
        event: 'leaderboard_storage_error',
        phase: 'write',
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return { accepted: false, error: 'storage_unavailable' };
  }

  return { accepted: true, entries: nextBoard };
}
