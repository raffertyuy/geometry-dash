# HTTP API Contract: Global Leaderboard

**Slice**: 010-leaderboard · **Date**: 2026-05-23

The Worker exposes exactly two endpoints under `/api/leaderboard`. The contract below is the wire format; client and server share TS types via `src/shared/leaderboard-types.ts` (see [`module-contracts.md`](./module-contracts.md) §1).

---

## `GET /api/leaderboard`

### Request

No body. No headers required beyond the standard `Host` / `Accept`.

### Responses

**200 OK** — current top-20 board.

```json
{
  "entries": [
    {
      "initials": "RAF",
      "score": 42000,
      "timeMs": 180000,
      "submittedAt": "2026-05-23T14:55:21.123Z"
    }
  ]
}
```

- `entries` is sorted by `score` descending. Ties broken by `submittedAt` ascending.
- An empty board returns `{ "entries": [] }`. Length is always between 0 and 20 inclusive.

**5xx** — storage unavailable.

```json
{ "error": "storage_unavailable" }
```

The client maps any 5xx response (or network failure) to the panel's "Leaderboard offline" state.

---

## `POST /api/leaderboard`

### Request

`Content-Type: application/json`

```json
{
  "initials": "RAF",
  "score": 42000,
  "timeMs": 180000
}
```

- `initials`: 1–3 letters; server uppercases internally before validating.
- `score`: non-negative integer.
- `timeMs`: non-negative integer.
- `signature` (OPTIONAL, RESERVED): a future-version field for HMAC signing. v1 clients omit it; v1 servers ignore it. See [research.md §R10](../research.md).

The client IP is read by the server from the `CF-Connecting-IP` request header (Cloudflare-injected). When that header is absent (e.g. local `wrangler dev`), the server uses the literal string `"unknown"` as the IP key — rate-limit still applies but in aggregate.

### Responses

**200 OK — accepted** (whether or not the entry cracked the top 20).

```json
{
  "accepted": true,
  "entries": [ /* current top 20 AFTER applying any write */ ]
}
```

The `entries` field is the same shape as the GET response. If the submission didn't crack the top 20 (validation passed but the score wasn't high enough), the server returns the unchanged board and the new entry is absent from `entries`. The client uses this to update its in-memory cache.

**400 Bad Request — validation failure.**

```json
{ "accepted": false, "error": "invalid_payload" }
```

Returned when:
- Body is not valid JSON.
- `initials` doesn't match `^[A-Z]{1,3}$` (after uppercase coerce).
- `score` is not a non-negative finite integer.
- `timeMs` is not a non-negative finite integer.

```json
{ "accepted": false, "error": "implausible_score" }
```

Returned when `score > plausibleMaxScore(timeMs)`. Error text is deliberately vague to avoid teaching cheaters the formula.

```json
{ "accepted": false, "error": "profanity" }
```

Returned when `initials` matches the embedded wordlist. The response does NOT reveal the wordlist.

**429 Too Many Requests — rate-limited.**

```json
{
  "accepted": false,
  "error": "rate_limited",
  "retryAfterSeconds": 1834
}
```

Returned when the client IP has exceeded `LEADERBOARD_RATE_LIMIT_PER_HOUR` submissions in the current hour bucket. `retryAfterSeconds` is the integer count of seconds until the next hour boundary.

**5xx — storage unavailable.**

```json
{ "accepted": false, "error": "storage_unavailable" }
```

Returned when an unexpected KV operation throws (e.g. transient platform error).

---

## Status code summary

| Code | Outcome | Body shape |
|------|---------|------------|
| 200  | Read OK (GET) | `{ entries }` |
| 200  | Submission accepted (POST) | `{ accepted: true, entries }` |
| 400  | Validation failure (POST) | `{ accepted: false, error: 'invalid_payload' \| 'implausible_score' \| 'profanity' }` |
| 405  | Wrong method on `/api/leaderboard` | `{ error: 'method_not_allowed' }` |
| 429  | Rate-limited (POST) | `{ accepted: false, error: 'rate_limited', retryAfterSeconds }` |
| 500  | Unexpected server error | `{ error: 'storage_unavailable' }` |
| 503  | KV temporarily unavailable | `{ accepted: false, error: 'storage_unavailable' }` |

---

## Forward compatibility

A v2 of this API that enforces signed submissions will:

- Continue returning the GET response in exactly the same shape.
- Begin rejecting POSTs that lack a valid `signature` field with `400 invalid_payload`. Until that rollout happens, the field is silently ignored.
- Add no new endpoints; the leaderboard remains read-only-public + write-by-game-client.

A v2 that introduces per-difficulty boards will:

- Introduce new query parameters (e.g. `GET /api/leaderboard?difficulty=B`).
- The current `GET /api/leaderboard` with no parameters will continue to return the aggregate top 20.
- The KV storage may switch from one `top20` key to multiple `top20:<difficulty>` keys; the migration is server-side only.

No client release coordination is required for either upgrade.
