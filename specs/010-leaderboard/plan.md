# Implementation Plan: Global Leaderboard

**Branch**: `010-leaderboard` | **Date**: 2026-05-23 | **Spec**: [spec.md](./spec.md)

## Summary

Add a global top-20 leaderboard backed by a single Cloudflare Worker handler that reads / writes a single JSON-encoded array in a Cloudflare KV namespace (`geometry-dash-leaderboard`, binding `LEADERBOARD`, id `935b139cc04047bf9ecff5207fe264bc`). The client gains a new `src/leaderboard/` pure-logic module (fetch, submission gating, personal-best derivation, localStorage adapter), a small DOM panel for the start + game-over screens, and a submission form rendered post-game when the player cracks the top 20. Anti-abuse for v1 is intentionally light: server-side payload validation, a fixed-window per-IP rate limit, an embedded profanity wordlist, and a generous time-based score plausibility bound — no HMAC signing, no replay verification. The endpoint shape is designed so a later signing-key upgrade is additive (the read endpoint never sends a signature; the write endpoint adds an optional `signature` field that is required only once a `SIGNING_KEY` Worker secret is set). Infrastructure-as-code lives in a single `wrangler.toml` at the repo root, which declares the static-assets binding (continuing to deploy `dist/`), the Worker entry (`src/worker/index.ts`), and the KV binding.

## Technical Context

**Language/Version**: TypeScript 5.6, ES2022 target, strict mode (unchanged). Both client and Worker share the same toolchain.

**Primary Dependencies**: Three.js 0.184 (untouched). **No new client runtime dependency** — the leaderboard fetches via the browser-native `fetch` API. New dev dependencies: `wrangler@^3` (CLI for local Worker dev + deploy, already implicitly used by the current Cloudflare deploy but not yet checked into `devDependencies`), `@cloudflare/workers-types@^4` (TS types for `KVNamespace`, `Fetcher`, `ExecutionContext`, the `assets` binding, etc.). No new client runtime weight.

**Storage**:
- Server: **Cloudflare KV** — one namespace (`geometry-dash-leaderboard`, id `935b139cc04047bf9ecff5207fe264bc`, binding `LEADERBOARD`). Two key families: a single `top20` key holding the JSON-encoded array of leaderboard entries, and per-IP rate-limit counter keys of shape `rl:{ip}:{hourBucket}` with a short TTL.
- Client: **`localStorage`** — two keys: `gd:leaderboard:lastInitials` (string) and `gd:leaderboard:personalBest` (JSON object). Both follow the same persistence pattern already established by slice 009's `gd:audio:muted` and `gd:problemModal:autoContinue`.

**Testing**: Vitest 2 (existing). Pure-logic modules are tested in isolation with no runtime stubs needed; the Worker handler factory takes a `KVNamespace` parameter so unit tests pass an in-memory stub (`Map`-backed `KVNamespace` shim, ~30 LOC). Integration test in `tests/integration/` exercises a full submit → fetch flow against the same stub. We deliberately do NOT pull in `@cloudflare/vitest-pool-workers` or `miniflare` — the stub is good enough for v1 and avoids a new heavy dev dep (Principle I).

**Target Platform**: Cloudflare Workers (Static Assets product) for the backend; modern evergreen browsers (mobile-first, ≥320 px wide) for the client.

**Project Type**: Static web app + single edge Worker, deployed as one unit via `wrangler deploy`. No separate frontend / backend repos.

**Performance Goals**:
- Leaderboard GET round-trip ≤ 2 s P95 on a 3-year-old mobile (SC-001). Cold-start Worker latency on Cloudflare is typically < 50 ms; the round trip is dominated by network.
- The leaderboard fetch is kicked off ONCE when the game-loop initialises (start screen) and again after a submission. The client caches the most recent result in memory; it is NOT re-fetched per frame.
- Zero impact on the run loop's per-frame budget — all leaderboard work runs outside the rAF tick.
- Worker handler completes in < 50 ms server-time per request (well within Cloudflare's free-tier 10 ms CPU / 30 s wall-clock limits).

**Constraints**:
- Free-tier Cloudflare KV: 100k reads/day, 1k writes/day, account-aggregated; 1 GB total; 25 MiB per value. At v1 traffic (~100 distinct players) we expect ~300 reads/day and ≪ 100 writes/day. Comfortable margin.
- Bundle delta: ≤ 5 KB gzipped on the client (raw `fetch`, no library).
- The repo is published as a public GitHub repository; the KV namespace ID is committable per Cloudflare's own published examples, but any future signing key MUST live in Worker secrets only (see CLAUDE.md "Public repo / secrets policy").
- The game must remain playable when the backend is unreachable (FR-007 / SC-006).

**Scale/Scope**:
- v1 traffic estimate: ≤ 100 distinct players, a few hundred reads/day, well under 100 writes/day (most game-overs do NOT crack the top 20 so do not write).
- Code delta estimate: ~450 net LOC including tests (client module ~150, worker ~200, renderer + integration ~100). One new infra file (`wrangler.toml`, ~20 lines).

## Constitution Check

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Simplicity & YAGNI | **PASS** | One JSON blob in KV — no SQL, no schema migrations, no Durable Object. v1 anti-cheat is intentionally minimal (validation + fixed-window IP rate-limit + small wordlist) with a hook for future HMAC upgrade. Rate-limit uses a fixed window keyed by `rl:{ip}:{floor(now/3600)}` (one counter per IP per hour, evicted by KV TTL) instead of a sliding-window sorted-set — Principle I. No new client runtime dep; new devDeps (`wrangler`, `@cloudflare/workers-types`) are forced by the new Worker target and are recorded here. Hand-rolled in-memory KV stub for tests instead of pulling in `miniflare` or `vitest-pool-workers`. |
| II. Test-First Discipline | **PASS** | Pure logic in `src/leaderboard/` (submission-gate predicate, personal-best derivation, payload parsing) and `src/worker/` (validation, plausibility check, sort + evict, profanity check, rate-limit) all unit-testable without DOM, without network, without a real KV. Tests precede implementation in each user-story task phase per `/speckit-tasks` convention. Integration test in `tests/integration/leaderboard-flow.test.ts` exercises submit → fetch → second-submit-replacing-eviction against the in-memory KV stub. Renderer additions (panel + form) get a focused jsdom smoke test. |
| III. Library-First / Modular | **PASS** | Two new top-level modules each with a single public entrypoint: `src/leaderboard/index.ts` (client) and `src/worker/index.ts` (backend). The Worker handler depends on a `KVAdapter` interface, not the global `LEADERBOARD` binding directly — same library-first pattern the audio engine uses to stay testable. Shared on-the-wire types live in `src/shared/leaderboard-types.ts` for single-source-of-truth between client and Worker. The renderer module gains a new `leaderboard-panel.ts` and `submission-form.ts` (only place that touches DOM); ESLint's existing library-boundary rule is configured to allow `src/worker/` to share `src/shared/` types but forbid imports from `src/renderer/` / `src/game/` / Three.js. |
| IV. Observability & Debuggability | **PASS** | New `console.debug` events: `leaderboard_fetch_started`, `leaderboard_fetch_succeeded` (with entry count), `leaderboard_fetch_failed` (with reason), `leaderboard_submit_started`, `leaderboard_submit_accepted`, `leaderboard_submit_rejected` (with code: `invalid_payload` / `profanity` / `implausible_score` / `rate_limited` / `storage_unavailable`), `leaderboard_personal_best_updated`. Debug overlay (`?debug=1`) gains a "Leaderboard: {status} · {entryCount} entries" line per FR-027. Worker emits a structured `console.log` per request with method, path, IP-hash (last octet redacted), and outcome. |
| Platform & Tech Stack | **PASS** | Cloudflare Workers + Static Assets is the existing deploy target (per `vite.config.ts:4-7` comment and the user's recently-created KV namespace). Browser support unchanged. The game stays playable offline (SC-006). Profanity check is opt-in: the wordlist is small and embedded; operators can edit + redeploy. |
| Performance Budget | **PASS** | Leaderboard work is OUTSIDE the rAF tick. The client makes at most two fetch requests per session (one on load, one on submit). No per-frame allocations introduced. KV reads / writes are O(1). |
| Accessibility & Input | **PASS** | The submission form is keyboard-navigable: focus enters on the initials field, Enter triggers Submit, Escape triggers Skip. Mobile virtual keyboard works because the initials field is a real `<input type="text">` with `inputmode="latin"` and `maxlength="3"`. The leaderboard table uses semantic `<table>` markup with `<th scope="col">` so screen readers announce columns. Difficulty colour is never the only signal (consistent with the constitution). |

No constitution violations. **Complexity Tracking section omitted.**

## Project Structure

### Documentation

```text
specs/010-leaderboard/
├── plan.md                          THIS FILE
├── research.md                      Phase 0 decisions
├── data-model.md                    Phase 1 entities + types
├── quickstart.md                    Phase 1 slice runbook
├── contracts/
│   ├── module-contracts.md          Public TS APIs of new modules
│   └── api.md                       HTTP contract for /api/leaderboard
└── tasks.md                         (created later by /speckit-tasks)
```

### Source Code

```text
src/
├── leaderboard/                     NEW: client-side pure-logic + thin fetch
│   ├── index.ts                     Public entry: re-exports public types + functions
│   ├── client.ts                    NEW: fetchLeaderboard + submitScore (raw fetch, typed)
│   ├── client.test.ts               NEW: contract tests with a mocked fetch
│   ├── gate.ts                      NEW: pure: should-prompt-for-submission predicate
│   ├── gate.test.ts                 NEW: predicate truth table
│   ├── personal-best.ts             NEW: pure: derive {pinned | highlighted | absent} + update PB on game-over
│   ├── personal-best.test.ts        NEW: state matrix
│   ├── storage.ts                   NEW: localStorage adapter (last initials + personal best)
│   ├── storage.test.ts              NEW: round-trip + corruption-tolerance
│   └── types.ts                     NEW: client-facing type re-exports
├── worker/                          NEW: edge backend
│   ├── index.ts                     NEW: default-exported fetch handler; routes /api/leaderboard
│   ├── handlers.ts                  NEW: pure-logic-style handler factory taking a KVAdapter
│   ├── handlers.test.ts             NEW: handler-level tests with in-memory KV
│   ├── validation.ts                NEW: pure: payload schema + score plausibility check
│   ├── validation.test.ts           NEW: rejects every abuse vector from SC-004
│   ├── rate-limit.ts                NEW: pure-ish: fixed-window per-IP counter on KVAdapter
│   ├── rate-limit.test.ts           NEW: bucket eviction + cross-IP isolation
│   ├── profanity.ts                 NEW: small embedded wordlist + matcher
│   ├── profanity.test.ts            NEW: 100% wordlist coverage + non-matches
│   ├── board.ts                     NEW: pure: top-20 sort + evict + tie-break
│   ├── board.test.ts                NEW: ordering, eviction, tie-break, idempotence
│   └── kv-adapter.ts                NEW: KVAdapter interface + the real-Worker implementation + the in-memory test stub
├── shared/
│   └── leaderboard-types.ts         NEW: on-the-wire payload + entry types (single source of truth)
├── renderer/
│   ├── leaderboard-panel.ts         NEW: DOM panel mount + render(board, personalBestRow)
│   ├── leaderboard-panel.test.ts    NEW: jsdom smoke: renders top-20, empty state, offline state
│   ├── submission-form.ts           NEW: DOM form: initials input + Submit/Skip buttons + error display
│   ├── submission-form.test.ts      NEW: jsdom: keyboard + click + skip paths
│   └── index.ts                     MODIFIED: export createLeaderboardPanel + createSubmissionForm
├── game/
│   └── game-loop.ts                 MODIFIED: orchestrate fetch on start, submission gate on game-over
└── main.ts                          MODIFIED: wire #leaderboard-panel + #submission-form hosts

tests/
└── integration/
    └── leaderboard-flow.test.ts     NEW: submit → fetch → second-submit-causes-eviction flow

wrangler.toml                        NEW: declares [assets] binding + Worker main + KV binding
package.json                         MODIFIED: add devDeps (wrangler, @cloudflare/workers-types) + npm scripts
index.html                           MODIFIED: add #leaderboard-panel + #submission-form host elements
README.md                            MODIFIED (post-implement): "What's in it (so far)" + align Pages → Workers
CLAUDE.md                            MODIFIED (post-implement): refresh SPECKIT START/END block to slice 010
.gitignore                           MODIFIED: ignore .wrangler/ and .dev.vars (local Worker dev state)
```

**Structure Decision**: Two new top-level pure-logic modules (`src/leaderboard/` for the client, `src/worker/` for the backend) plus shared types under `src/shared/leaderboard-types.ts`. The renderer module gains a panel + form; the game-loop gets a minimal orchestration change. This matches the slice-006 / slice-009 pattern where a new subsystem is added without disturbing existing module boundaries.

## Phase 0: Outline & Research — Pointer

See [research.md](./research.md) for: KV-over-D1 decision and free-tier sizing, wrangler config format (TOML vs JSONC), KV serialisation strategy + write race, fixed-window vs sliding-window rate-limit, score plausibility formula, profanity wordlist scope, local dev story (`wrangler dev` + Vite), Vitest stub strategy, CORS analysis, and forward-compatibility for a signing-key upgrade.

## Phase 1: Design & Contracts — Pointer

- [data-model.md](./data-model.md) — Entity definitions (LeaderboardEntry, Board, SubmissionRequest/Response, PersonalBest, RateLimitBucket), validation rules, state transitions.
- [contracts/module-contracts.md](./contracts/module-contracts.md) — Public TS surfaces of `src/leaderboard/*` and `src/worker/*` modules; renderer integration; game-loop wiring.
- [contracts/api.md](./contracts/api.md) — HTTP contract for `GET /api/leaderboard` and `POST /api/leaderboard`, including error codes and forward-compatible signature field.
- [quickstart.md](./quickstart.md) — Manual + automated validation runbook (seed a fake board, submit a score, observe panel update, simulate offline backend, abuse-vector pass).

## Constitution Re-Check (post-design)

Re-evaluated after Phase 1. The design introduces two new modules + one shared types file + two renderer adapters + one infra config file + two new devDependencies (forced by the new Worker target). No client runtime dependency added. v1 anti-abuse is light by design, with a documented upgrade path that does not require breaking the read API. All gates still **PASS**.

## Phase 2 — Next

`/speckit-tasks` generates the dependency-ordered task list from this plan + the spec. Implementation tracks tasks one user story at a time (P1 stories first — see Spec §User Story 1 + 2).
