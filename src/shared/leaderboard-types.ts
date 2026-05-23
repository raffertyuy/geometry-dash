/**
 * On-the-wire types for the global leaderboard. Single source of truth
 * shared between the browser client (src/leaderboard/*) and the Cloudflare
 * Worker (src/worker/*). Persisted KV shape is a versioned wrapper around
 * `entries[]`; the wire response flattens it (see contracts/api.md).
 */

/** A single persisted leaderboard entry. */
export interface LeaderboardEntry {
  /** 1-3 uppercase Latin letters. Stored uppercase by the server. */
  readonly initials: string;
  /** Final score at end of run. Non-negative integer. */
  readonly score: number;
  /** Run elapsed time in milliseconds. Non-negative integer. */
  readonly timeMs: number;
  /** Server-issued submission timestamp (ISO 8601 instant). */
  readonly submittedAt: string;
}

/** Payload posted by the client when attempting a submission. */
export interface SubmissionRequest {
  /** 1-3 letters; client uppercases before sending but server re-validates. */
  readonly initials: string;
  readonly score: number;
  readonly timeMs: number;
  /**
   * RESERVED for a future signing-key upgrade. Clients in v1 omit this field;
   * v1 servers silently ignore it. A future server with a SIGNING_KEY secret
   * bound would require + verify it.
   */
  readonly signature?: string;
}

/** Discrete error codes returned by POST. The client maps these to user messages. */
export type SubmissionErrorCode =
  | 'invalid_payload'
  | 'profanity'
  | 'implausible_score'
  | 'rate_limited'
  | 'storage_unavailable';

/** Response from POST /api/leaderboard. */
export type SubmissionResponse =
  | {
      readonly accepted: true;
      /** The board AFTER applying any write, top 20, sorted. */
      readonly entries: readonly LeaderboardEntry[];
    }
  | {
      readonly accepted: false;
      readonly error: SubmissionErrorCode;
      /** Set only when error === 'rate_limited'. */
      readonly retryAfterSeconds?: number;
    };

/** Response from GET /api/leaderboard. */
export interface LeaderboardResponse {
  readonly entries: readonly LeaderboardEntry[];
}
