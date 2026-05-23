# Data Model: Global Leaderboard

**Slice**: 010-leaderboard · **Date**: 2026-05-23

This file captures every entity the leaderboard slice manipulates. Type definitions are authoritative; field semantics, validation rules, and state transitions are documented inline.

---

## 1. On-the-wire types (`src/shared/leaderboard-types.ts`)

These types are shared between the client (`src/leaderboard/*`) and the Worker (`src/worker/*`). They are the only structural contract between the two.

```ts
/** A single persisted leaderboard entry. */
export interface LeaderboardEntry {
  /** 1–3 uppercase Latin letters. Stored uppercase by the server. */
  readonly initials: string;
  /** Final score at end of run. Non-negative integer. */
  readonly score: number;
  /** Run elapsed time in milliseconds. Non-negative integer. */
  readonly timeMs: number;
  /** Server-issued submission timestamp (ISO 8601 instant, e.g. "2026-05-23T14:55:21.123Z"). */
  readonly submittedAt: string;
}

/** Payload posted by the client when attempting a submission. */
export interface SubmissionRequest {
  /** 1–3 letters; client uppercases before sending but server re-validates. */
  readonly initials: string;
  readonly score: number;
  readonly timeMs: number;
  /**
   * RESERVED for a future signing-key upgrade (R10). Clients in v1 omit this field;
   * v1 Workers ignore it. Future Workers that bind a SIGNING_KEY secret REQUIRE it.
   */
  readonly signature?: string;
}

/** Response from POST /api/leaderboard. */
export type SubmissionResponse =
  | {
      readonly accepted: true;
      /** The board AFTER applying the accepted submission, top 20, sorted. */
      readonly entries: readonly LeaderboardEntry[];
    }
  | {
      readonly accepted: false;
      readonly error: SubmissionErrorCode;
      /** Set only when error === 'rate_limited'. */
      readonly retryAfterSeconds?: number;
    };

/** Discrete error codes returned by POST. The client maps these to user messages. */
export type SubmissionErrorCode =
  | 'invalid_payload'
  | 'profanity'
  | 'implausible_score'
  | 'rate_limited'
  | 'storage_unavailable';

/** Response from GET /api/leaderboard. */
export interface LeaderboardResponse {
  readonly entries: readonly LeaderboardEntry[];
}
```

### Validation rules (enforced server-side in `src/worker/validation.ts`)

- `initials` matches `/^[A-Z]{1,3}$/`. Lowercase letters are uppercased before the regex test; non-letters fail.
- `score` is a finite, non-negative integer (`Number.isInteger(score) && score >= 0`).
- `timeMs` is a finite, non-negative integer.
- `score <= plausibleMax(timeMs)` where `plausibleMax` is defined in R5.
- `initials` is not in the embedded profanity set (case-insensitive, against the uppercased value).
- Submitter IP (`request.headers.get('CF-Connecting-IP')`) has not exceeded its hour bucket's count.
- `signature`, if present in v1, is silently ignored (R10).

### Persisted shape (KV `top20` key)

```json
{
  "version": 1,
  "entries": [
    { "initials": "RAF", "score": 42000, "timeMs": 180000, "submittedAt": "2026-05-23T14:55:21.123Z" },
    ...up to 20 entries...
  ]
}
```

The wrapping `{ version, entries }` object is the stored shape. The wire `LeaderboardResponse` flattens it to `{ entries }` (the client never sees the version tag). Future versions with new fields land here without breaking existing clients (additive only).

### Sort order

Entries are sorted by `score` descending. Ties on `score` are broken by `submittedAt` ascending (earlier wins) per FR-021. Sort is materialised in storage — the server sorts before `put`, the client trusts the order it receives.

---

## 2. Client state (`src/leaderboard/types.ts` re-exports + module internals)

```ts
/** Client-side personal-best record, persisted in localStorage. */
export interface PersonalBest {
  readonly score: number;
  readonly timeMs: number;
  /** ISO 8601 timestamp of when this PB was achieved. */
  readonly achievedAt: string;
}

/** Client-side leaderboard fetch state. Drives the panel's render. */
export type FetchStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'success'; readonly entries: readonly LeaderboardEntry[] }
  | { readonly kind: 'offline'; readonly reason: 'network' | 'timeout' | 'http' };

/** How the personal best should appear next to the board. Output of personal-best.ts. */
export type PersonalBestSurface =
  | { readonly kind: 'absent' }                          // first-time player
  | { readonly kind: 'pinned'; readonly entry: LeaderboardEntry }  // PB not in top 20
  | { readonly kind: 'highlighted'; readonly atIndex: number };    // PB IS in top 20, at this index
```

### Storage keys

- `gd:leaderboard:lastInitials` → string (1–3 uppercase letters); default initials for the form.
- `gd:leaderboard:personalBest` → JSON `PersonalBest`.

Both keys are written / read by `src/leaderboard/storage.ts`. Corrupt JSON or unexpected shapes are treated as "absent" and the key is overwritten on next valid write. No migration logic — corruption tolerance only.

### State transitions

- **On game-loop initialisation**: `FetchStatus: idle → loading`, fire `fetchLeaderboard()`. On settled response, transition to `success` or `offline`. The personal-best derivation runs on the result.
- **On run end**: if `score > 0`, compute `shouldUpdatePB(currentPB, runScore, runTimeMs)`; if true, `personalBest := { score: runScore, timeMs: runTimeMs, achievedAt: now() }`, persist, emit `leaderboard_personal_best_updated`.
- **On run end (continued)**: compute `shouldPromptForSubmission(board, runScore)` — returns `true` iff the board has fewer than 20 entries OR `runScore > board[19].score`. If `true`, surface the submission form.

- **Personal-best surface derivation**: the match key is `(score, timeMs)` — NOT initials. An earlier draft required all three to match before highlighting, but in practice that produced a confusing duplicate-looking row whenever the player switched initials between submitting and viewing: the pinned "Your best" row would carry the *new* initials with the *old* PB's score, sitting directly above the actual same-numbers entry on the global board under the old initials. Matching on (score, timeMs) alone collapses to the existing board row when the run is represented. The downside — two genuinely-different players on the same device coincidentally sharing identical score AND elapsed-ms — is vanishingly unlikely at the resolutions this game uses.
- **On Submit**: client uppercases initials, calls `submitScore(...)`. On `accepted: true`, replace the in-memory board with `response.entries`, persist `lastInitials`, re-derive personal-best surface, re-render panel.
- **On Skip**: form closes; no network call; no state change beyond closing the form.

---

## 3. Worker state (`src/worker/*` internals)

```ts
/** Per-IP rate-limit bucket — stored as the literal counter integer in KV. */
export type RateLimitBucketValue = number;

/** KV key naming. */
export const KV_KEY_TOP20 = 'top20' as const;
export function rateLimitKey(ipAddress: string, hourBucket: number): string;
//   → `rl:${ipAddress}:${hourBucket}`
```

### Rate-limit state machine (per IP)

- **First submission in this hour-bucket**: `KV.get(key) → null`; treat as 0; check `0 < 10` → allow; `KV.put(key, 1, { expirationTtl: 7200 })`.
- **Subsequent submission, count < 10**: read count → check → write count + 1.
- **Submission when count >= 10**: reject with `rate_limited`, include `retryAfterSeconds = (nextHourBoundary - now) / 1000`.
- **Bucket TTL**: 7200 seconds (2 hours). The bucket auto-evicts well after the rate-limit window closes (1 hour); 2× buffer absorbs eventual-consistency in KV.

### Board state machine

- **Initial**: `KV.get('top20') → null` → treat as empty board (no entries).
- **On accepted submission**:
  1. Read current board.
  2. Construct candidate entry `{ initials, score, timeMs, submittedAt: now }`.
  3. Insert into sorted position.
  4. Truncate to top 20.
  5. Write back with `{ version: 1, entries }`.
- **Race**: see R3 — last write wins; one entry can be lost in a true tie scenario.

---

## 4. Render-tier shapes (`src/renderer/leaderboard-panel.ts`)

The panel takes a single render snapshot per update; it does NOT subscribe to internal state.

```ts
export interface LeaderboardPanelSnapshot {
  readonly fetch: FetchStatus;
  readonly personalBestSurface: PersonalBestSurface;
}

export interface LeaderboardPanel {
  render(snapshot: LeaderboardPanelSnapshot): void;
  setHostVisibility(visible: boolean): void;
  destroy(): void;
}
```

The submission form is a separate adapter (`createSubmissionForm`) — not folded into the panel — so its lifecycle (open on game-over conditional, close on Submit/Skip) is independent.

---

## 5. Configuration constants

Added to `src/shared/config.ts`:

```ts
/** Maximum leaderboard entries persisted + displayed. */
export const LEADERBOARD_MAX_ENTRIES = 20;

/** Plausible-max-per-second score (R5). */
export const LEADERBOARD_PLAUSIBLE_MAX_PER_SECOND = 50_000;

/** Minimum plausible-max floor (R5). */
export const LEADERBOARD_PLAUSIBLE_MIN_FLOOR = 100_000;

/** Per-IP rate-limit: max submissions per hour bucket (R4). */
export const LEADERBOARD_RATE_LIMIT_PER_HOUR = 10;

/** Rate-limit KV bucket TTL in seconds (= 2 × window). */
export const LEADERBOARD_RATE_LIMIT_BUCKET_TTL_SECONDS = 7200;

/** Fetch timeout in milliseconds (R11). */
export const LEADERBOARD_FETCH_TIMEOUT_MS = 5_000;

/** localStorage keys (matches the gd:leaderboard:* convention). */
export const LEADERBOARD_STORAGE_KEY_LAST_INITIALS = 'gd:leaderboard:lastInitials';
export const LEADERBOARD_STORAGE_KEY_PERSONAL_BEST = 'gd:leaderboard:personalBest';

/** Default initials when no prior submission exists. */
export const LEADERBOARD_DEFAULT_INITIALS = 'AAA';
```
