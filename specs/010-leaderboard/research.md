# Research: Global Leaderboard

**Slice**: 010-leaderboard · **Date**: 2026-05-23

Captures the Phase 0 decisions resolving every architectural question in [plan.md](./plan.md). The spec emitted zero `[NEEDS CLARIFICATION]` markers; research is concentrated on platform + anti-abuse choices.

---

## R1. Storage: Cloudflare KV (NOT D1, Durable Object, R2, Upstash, Supabase, …)

**Decision**: One Cloudflare KV namespace (`geometry-dash-leaderboard`, id `935b139cc04047bf9ecff5207fe264bc`, binding `LEADERBOARD`). Two key families: a single `top20` key holding the JSON-encoded board, and per-IP rate-limit counters of shape `rl:{ip}:{hourBucket}` with a 2-hour TTL.

**Rationale**:

- **Already on Cloudflare**: zero new platform onboarding, zero new billing surface, zero new credentials.
- **Free-tier headroom**: 100k reads/day, 1k writes/day (account-aggregated), 1 GB storage, 25 MiB per value. At v1 traffic (~100 distinct players) we expect ~300 reads/day and ≪ 100 writes/day. Comfortable margin.
- **Read-mostly pattern fits KV**: GET is hot, POST is rare (only when a run cracks the top 20). KV is read-optimised; eventual consistency is acceptable for a "fun board".
- **No schema migrations**: the entire leaderboard is one JSON blob; future shape changes are version-tagged in the payload, not migrated SQL.
- **Atomicity is sufficient for the access pattern**: KV's read-modify-write race window is "two players both crack the top 20 within the same second"; both writes complete but one may be overwritten. The blast radius is one lost entry per race, which is acceptable for a fun board. Mitigation if it ever bites: switch the single `top20` key to a list-prefix scan + write-once-per-entry pattern (FR-025 keeps the API forward-compatible).

**Alternatives considered**:

- **Cloudflare D1 (SQLite)**: Generous free tier and a real database, but adds schema + migrations + ORM/builder surface for what is fundamentally one tiny ordered array. Re-evaluate if v2 needs per-difficulty boards or time-windowed boards.
- **Cloudflare Durable Object**: Elegant single-actor mental model with serialised writes and no race. But more code to manage one tiny dataset (state class, fetch handler, transactional storage API), and the in-flight billing model is opaque. Overkill for v1.
- **Cloudflare R2**: Object storage; no atomic update — writes race. Rejected.
- **Upstash Redis** (`ZADD`/`ZREVRANGE` is literally the leaderboard primitive): elegant, but adds a second platform. Rejected on simplicity grounds.
- **Supabase / Neon / Turso / Firebase**: User explicitly ruled out a "full-fledged database" for this slice during brainstorm.
- **GitHub gist / repo via API**: rate-limited, conflict-prone, leaks a PAT into the Worker. Rejected.

---

## R2. Wrangler config: `wrangler.toml` (NOT `wrangler.jsonc`)

**Decision**: A single `wrangler.toml` checked in at the repo root.

**Rationale**:

- TOML is the format of every Cloudflare Worker example shipped under `developers.cloudflare.com`; familiarity matters in a public learning-friendly repo.
- TOML's comment syntax (`#`) and inline tables are well-suited to the small set of fields we need (`main`, `compatibility_date`, `[assets]`, `[[kv_namespaces]]`).
- `wrangler.jsonc` is supported and gaining traction (JSON-native, no extra parser), but the project has no other JSONC configs — TOML is the path of least surprise.

**Alternatives considered**:

- **`wrangler.jsonc`**: Equally valid. Re-evaluate if a future slice needs to share config across the wrangler + Vite (Vite reads JS/TS configs natively, not TOML).

---

## R3. KV serialisation: single `top20` key holding a JSON array

**Decision**: The entire leaderboard is stored under one KV key (`top20`) as JSON-encoded `LeaderboardEntry[]` (sorted descending by score, ties broken by ascending submission timestamp). Read = `KV.get('top20', 'json')`. Write = `KV.put('top20', JSON.stringify(nextBoard))`.

**Rationale**:

- ≤ 20 entries × ~80 bytes/entry = ~1.6 KB total. Well below KV's 25 MiB per-value ceiling.
- One key = one GET per page load, one PUT per qualifying submission. Minimises free-tier write consumption.
- Sort order is materialised in storage, so reads are O(N) over 20 entries — no separate sort key index needed.
- Eviction is a trivial `.slice(0, 20)` after insert.
- Future schema migrations get a top-level `version` field, e.g. `{ version: 1, entries: [...] }`. Older clients reading a future-version blob fall back to "Leaderboard offline" gracefully.

**Race-condition behaviour**:

Two simultaneous qualifying submissions both `get('top20')` → mutate locally → `put('top20')`. The second `put` overwrites the first. The first submitter's entry is lost. This is an acceptable failure mode for v1 (very rare at expected traffic). Mitigation paths (not implemented in v1, FR-025 keeps them open):

- Switch the `top20` value to a list of (prefixed) keys + per-entry KV writes — no race.
- Promote storage to Durable Objects — serialised writes by construction.

**Alternatives considered**:

- **One KV key per entry, listed/sorted on read**: avoids the race but doubles read complexity and writes 20× more keys than v1 needs.
- **Versioned blob with optimistic CAS**: KV doesn't expose a CAS primitive; would require Durable Object.

---

## R4. Rate-limit: fixed-window (NOT sliding-window)

**Decision**: Fixed-window counter keyed by `rl:{ip}:{hourBucket}` where `hourBucket = floor(Date.now() / 3_600_000)`. Each POST does:

1. `count = (await KV.get(key, 'json')) ?? 0`
2. If `count >= 10`, reject with `429 rate_limited`.
3. Else `KV.put(key, count + 1, { expirationTtl: 7200 })` (2-hour TTL so the bucket auto-evicts after the window closes).

**Rationale**:

- **Simpler than sliding-window**: sliding-window needs a sorted set or a Redis-style structure. Fixed-window is one read + one conditional write per submission.
- **Worst case is mild**: a user can submit 10 right before the bucket flips and 10 right after = 20 submissions in 1 second. For a "fun board" anti-abuse story, this is fine. A determined attacker can also just rotate IPs.
- **KV TTL handles eviction**: no manual cleanup logic; the bucket key disappears 2 hours after creation.
- **One extra KV read + write per submission**: bounded, predictable, no per-IP storage growth.

**Alternatives considered**:

- **Sliding-window** (Redis ZADD/ZCOUNT-style): more accurate, but the storage primitive is wrong (KV has no sorted set), and an in-Worker simulation needs multiple reads. Rejected.
- **No rate-limit at all**: invites obvious abuse. Rejected.
- **Cloudflare's built-in WAF / Rate Limiting product**: paid feature on the Workers plan we're using. Rejected.

---

## R5. Score plausibility upper bound

**Decision**: A submission is rejected when `score > plausibleMax(time_ms)` where

```text
plausibleMax(time_ms) = max(100_000, ceil(time_ms / 1000) * 50_000)
```

i.e. up to 50,000 points per second of elapsed run time, with a 100,000 floor so quick runs that hit a couple of Advanced gates aren't flagged. Computed in pure TS in `src/worker/validation.ts`.

**Rationale**:

The realistic per-second score ceiling at maximum escalation is dominated by problem-gate hits (Advanced = +10,000 each, no enforced minimum gap between gates). A worst-case sequence at 24 world-units/sec with one Advanced gate per 14 world units (`OBSTACLES_MIN_GAP`) yields one gate per ~580 ms = ~1.7 gates/sec × 10,000 = ~17,000 from gates, plus a sub-1000 contribution from the run-distance score. 50,000/sec gives ~3× headroom; the 100,000 floor absorbs early-game flukes.

**Tunability**:

The constants `LEADERBOARD_PLAUSIBLE_MAX_PER_SECOND = 50_000` and `LEADERBOARD_PLAUSIBLE_MIN_FLOOR = 100_000` live in `src/shared/config.ts` so they can be retuned without code changes if the formula flags real runs (or fails to catch obvious abuse).

**Alternatives considered**:

- **Derive from `ESCALATION_*` constants exactly** (run-rate integral over time): more accurate but couples the validator to the game-balance constants, which is fragile if escalation is retuned. Rejected.
- **No score bound at all** (rely on rate-limit + profanity only): allows trivial high-score griefing (Inspect Element → fetch → POST 999_999_999). Rejected.
- **Replay verification** (record input sequence, re-simulate on server): genuinely robust but enormous implementation cost. Tracked as a future-slice option for a competitive v2.

---

## R6. Profanity wordlist: tiny embedded

**Decision**: An embedded `Set<string>` of ≤ 30 three-letter sequences in `src/worker/profanity.ts`. Matched case-insensitively. The list contains common English slurs and obvious obscenities; non-English / multi-language coverage is out of scope for v1.

**Rationale**:

- 3-letter initials make the surface area minuscule; the obvious offenders are well-known.
- The wordlist is small enough to live inline in source. Operators amend it without database migrations.
- The list is intentionally NOT exhaustive — false negatives are acceptable (operators can delete polluted entries via `wrangler kv key delete`).
- Public source-code exposure of the wordlist is fine — it's a deny-list, not a secret, and any external profanity-filter library would expose the same lexicon.

**Alternatives considered**:

- **Third-party `bad-words` library**: adds a dep and pulls in a 1000+ entry list; most entries are ≥ 4 letters and irrelevant for 3-letter initials. Rejected.
- **Allow-list (only A-Z initials matching `^[A-Z]{3}$` and not containing certain patterns)**: too aggressive; rejects legit initials like "RAF".

---

## R7. Local dev story: `wrangler dev` + Vite

**Decision**: Two scripts in `package.json`:

- `npm run dev` — Vite dev server (existing). Provides instant HMR for the client. The leaderboard panel shows "Leaderboard offline" when the Worker isn't running, which is exactly how production behaves under a network failure, so client-only iteration works fine.
- `npm run dev:worker` — runs `wrangler dev` against `wrangler.toml`. Spawns a local Worker that serves both the Worker handlers AND the built static assets from `dist/`. Used when iterating on the Worker handler.

For the integrated end-to-end experience, the developer runs `npm run build` once to populate `dist/`, then `npm run dev:worker`. Vite dev does NOT proxy to the Worker — the gain wouldn't be worth the config complexity for a v1 with two endpoints.

**Rationale**:

- Both modes are useful; neither is the "main" one. Most leaderboard UI iteration happens in `npm run dev` against a missing backend; Worker-handler iteration happens in `npm run dev:worker`.
- `wrangler dev` connects to the real Cloudflare KV namespace (or to a local mock — `wrangler dev --remote` flips the mode). Default behaviour is local-only with an in-memory KV.
- Running both servers simultaneously on different ports is supported but not the documented happy path; the leaderboard's offline-graceful behaviour makes that unnecessary.

**Alternatives considered**:

- **`wrangler pages dev` style with a proxy to Vite**: outdated approach (Pages-specific). Not applicable to the Workers Static Assets product.
- **Custom Vite plugin that proxies `/api/*` to a local Worker**: adds non-trivial config for marginal benefit. Rejected.

---

## R8. Vitest: hand-rolled in-memory KV (NOT `@cloudflare/vitest-pool-workers`)

**Decision**: A ~30-line in-memory KV stub in `src/worker/kv-adapter.ts` (e.g. `createInMemoryKVAdapter()` returning a `Map`-backed implementation of `KVAdapter`). All Worker handler / validator / rate-limit tests use it.

**Rationale**:

- Sufficient: the Worker code path never depends on the real KV runtime semantics beyond "get returns the last value put". The stub is faithful enough.
- Zero new dev dependencies. `@cloudflare/vitest-pool-workers` and `miniflare` would add ~10 MB to `node_modules` for negligible coverage gain over the stub.
- Tests run in the same Vitest pool as everything else — no separate config.
- Principle I (YAGNI): if a future test genuinely needs the full Workers runtime (e.g. cache API, fetch sub-requests), revisit then.

**Alternatives considered**:

- **`@cloudflare/vitest-pool-workers`** (official): authentic but heavyweight. Re-evaluate when the Worker grows beyond simple KV ops.
- **`miniflare` (standalone)**: same trade-off. Rejected on YAGNI.

---

## R9. CORS: not required

**Decision**: The Worker handler does NOT set CORS headers. The static assets and the `/api/*` endpoints are served from the same origin (`trgd.raztype.com` in prod, `localhost:8787` under `wrangler dev`), so same-origin policy applies and no CORS dance is needed.

**Rationale**:

- Cloudflare's Workers Static Assets product serves the Worker AND the static bundle from the same origin by construction.
- A cross-origin embed of the game (e.g. iframe) would NOT be able to call the API anyway, but that's an out-of-scope concern.

---

## R10. Forward-compatibility for future signing-key upgrade

**Decision**: The HTTP contract is designed so a future cryptographic upgrade is additive, not breaking:

- `GET /api/leaderboard` never carries a signature in v1 or future versions.
- `POST /api/leaderboard` accepts an OPTIONAL `signature` field on the request body. If a `SIGNING_KEY` Worker secret is bound, validation REQUIRES the signature and verifies it against the rest of the payload. If the secret is NOT bound, validation IGNORES any signature field. The client always sends submissions WITHOUT a signature in v1; a future client release would add it after a server-side rollout.
- The Worker secret is named `SIGNING_KEY` (Cloudflare convention: uppercase). It is bound via `wrangler secret put SIGNING_KEY` and accessed as `env.SIGNING_KEY`. Per the public-repo / secrets policy in CLAUDE.md, it MUST NOT appear in `wrangler.toml`.

**Rationale**:

- A v2 anti-cheat tightening doesn't break v1 clients during the rollout window.
- Operators who never want signing don't pay any complexity tax.
- The signing scheme itself (HMAC-SHA256? Ed25519? Per-run nonces?) is intentionally deferred — the surface area is just "an optional `signature` field" and the algorithm is opaque to the wire format.

---

## R11. Network timeout + error UX

**Decision**: The client uses a `fetch` with `AbortController` set to 5 seconds. Any non-2xx response, network error, or abort surfaces as "Leaderboard offline" on the panel. The submission form surfaces the specific error code returned by the Worker (`profanity` → "Try different initials", `rate_limited` → "Too many recent submissions; try again later", `implausible_score` → "Submission could not be verified", anything else → generic "Submission failed").

**Rationale**:

- 5 s aligns with the spec's >5 s timeout edge case.
- The error surface is intentionally vague for `implausible_score` per the spec (don't teach cheaters the formula).
- `AbortController` is in every evergreen browser.

---

## R12. `.gitignore` hygiene

**Decision**: Add `.wrangler/` and `.dev.vars` to `.gitignore`.

- `.wrangler/` — wrangler's local cache (state, KV stub, etc.).
- `.dev.vars` — local-only `.env` for the Worker (used for testing secrets without committing them; wrangler reads it for `wrangler dev`).

Neither file currently exists in the repo, but they will be created by `wrangler dev`, so pre-emptive ignoring is appropriate.

---
