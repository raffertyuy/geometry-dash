---

description: "Task list for feature 010 — Global Leaderboard (Cloudflare KV-backed)"
---

# Tasks: Global Leaderboard

**Input**: Design documents from `/specs/010-leaderboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/module-contracts.md, contracts/api.md, quickstart.md

**Tests**: Required for every pure-logic module on both sides (client gate, personal-best derivation, storage tolerance, fetch helper; Worker validation, rate-limit, profanity, board ops, handlers). Renderer additions get jsdom smoke tests. One integration test exercises a full submit → fetch → eviction flow against an in-memory KV.

**Organization**: Grouped by user story. US1 (read the top-20) + US2 (submit a score) together form the MVP — the board is useless without one or the other. US3 (personal-best surface) is P2 polish on top.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no dependencies on incomplete tasks → parallelizable.
- **[Story]**: US1 / US2 / US3; setup, foundational, and polish tasks have no story label.

## Path Conventions

- Single web project + a new Cloudflare Worker target (per [plan.md](./plan.md)). Source under `src/`; tests colocated as `*.test.ts`. Worker code under `src/worker/`; shared types under `src/shared/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring the new Worker target into the build / typecheck / lint pipelines without changing runtime behaviour yet.

- [X] T001 Append `.wrangler/` and `.dev.vars` to `.gitignore` per [research.md §R12](./research.md).
- [X] T002 [P] Update `package.json`: add `wrangler@^3` and `@cloudflare/workers-types@^4` to `devDependencies`; add a new script `"dev:worker": "wrangler dev"`. Run `npm install` to refresh the lockfile and stage both `package.json` and `package-lock.json` together in this task's commit.
- [X] T003 [P] Create `wrangler.toml` at repo root per [contracts/module-contracts.md §21](./contracts/module-contracts.md). Declare `name = "geometry-dash"`, `main = "src/worker/index.ts"`, a recent `compatibility_date`, the `[assets] directory = "./dist"` + `binding = "ASSETS"`, and the `[[kv_namespaces]]` entry with `binding = "LEADERBOARD"` and `id = "935b139cc04047bf9ecff5207fe264bc"`. The namespace ID is non-sensitive per Cloudflare's published examples and is safe to commit per the project's public-repo / secrets policy in `CLAUDE.md`.
- [X] T004 [P] Update `tsconfig.json` to add `"@cloudflare/workers-types"` to the `types` array (append to any existing list; don't replace). Verify `npm run typecheck` still passes after this and T002.
- [X] T005 [P] Update `eslint.config.js` to extend the existing library-boundary rule: `src/worker/*` MAY import from `src/shared/*` and from its own folder; MUST NOT import from `src/renderer/*`, `src/game/*`, `three`, or any other DOM-facing module. Mirror the existing pattern that forbids non-`renderer`/`game` modules from importing `three`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Stand up the shared types, configuration constants, KV adapter, storage adapter, and a minimal Worker that serves a stub GET. After this phase the typecheck + lint suite is green; `wrangler dev` serves an empty board; nothing user-visible has changed.

- [X] T006 [P] Create `src/shared/leaderboard-types.ts` containing the on-the-wire types from [data-model.md §1](./data-model.md): `LeaderboardEntry`, `SubmissionRequest`, `SubmissionResponse`, `SubmissionErrorCode`, `LeaderboardResponse`. No runtime exports — types only.
- [X] T007 [P] Append the leaderboard configuration constants from [data-model.md §5](./data-model.md) to `src/shared/config.ts`: `LEADERBOARD_MAX_ENTRIES`, `LEADERBOARD_PLAUSIBLE_MAX_PER_SECOND`, `LEADERBOARD_PLAUSIBLE_MIN_FLOOR`, `LEADERBOARD_RATE_LIMIT_PER_HOUR`, `LEADERBOARD_RATE_LIMIT_BUCKET_TTL_SECONDS`, `LEADERBOARD_FETCH_TIMEOUT_MS`, `LEADERBOARD_STORAGE_KEY_LAST_INITIALS`, `LEADERBOARD_STORAGE_KEY_PERSONAL_BEST`, `LEADERBOARD_DEFAULT_INITIALS`.
- [X] T008 [P] Create `src/worker/kv-adapter.ts` per [contracts/module-contracts.md §13](./contracts/module-contracts.md). Export the `KVAdapter` interface, `createKVAdapter(kv: KVNamespace)` (real-Worker wrapper using `kv.get(key, 'json')` and `kv.put(key, JSON.stringify(value), { expirationTtl })`), and `createInMemoryKVAdapter()` (Map-backed, ~30 LOC, manual TTL enforcement on `get`).
- [X] T009 [P] [US1] Create `src/worker/kv-adapter.test.ts` covering the in-memory stub: round-trip, JSON-tolerance on `get`, TTL expiration, missing-key returns null, overwrite semantics. Mark as US1 since US1 needs it for the read flow.
- [X] T010 Create a minimal `src/worker/index.ts` per [contracts/module-contracts.md §7](./contracts/module-contracts.md): export a default `ExportedHandler<WorkerEnv>` whose `fetch` handler routes:
  - `GET /api/leaderboard` → reads `top20` from `LEADERBOARD` KV via `createKVAdapter`, returns `{ entries }` (empty array if missing) with `200 application/json`.
  - `POST /api/leaderboard` → returns `503 storage_unavailable` (placeholder for US2; rejecting cleanly keeps the contract honest while we build the rest).
  - `OPTIONS` → 204.
  - Other methods on `/api/leaderboard` → `405 method_not_allowed`.
  - Everything else → `env.ASSETS.fetch(request)`.
  The `WorkerEnv` interface declares `LEADERBOARD: KVNamespace`, `ASSETS: Fetcher`, `SIGNING_KEY?: string`.
- [X] T011 [P] Create `src/leaderboard/storage.ts` per [contracts/module-contracts.md §5](./contracts/module-contracts.md). Export `createLeaderboardStorage(backing?)` returning `LeaderboardStorage` with `getLastInitials`, `setLastInitials`, `getPersonalBest`, `setPersonalBest`. All reads corruption-tolerant; all writes wrapped in try/catch for quota errors.
- [X] T012 [P] Create `src/leaderboard/storage.test.ts`: backed by an in-memory `{ getItem, setItem }` stub. Cover round-trip, default-on-empty, default-on-corrupt-JSON, default-on-wrong-shape, uppercase coerce + 3-char truncate on `setLastInitials`, quota-error tolerance.

**Checkpoint**: `npm run typecheck && npm run lint && npm test` all green. `npm run dev:worker` serves an empty board at `/api/leaderboard`.

---

## Phase 3: User Story 1 — See the global top-20 from the start screen (Priority: P1)

**Goal**: Player opens the game; the leaderboard panel renders the current top-20 (or the empty state, or the offline state) on the start screen and on the game-over screen, without intercepting "Tap to play".

**Independent Test**: Seed the local KV via `curl` (`POST /api/leaderboard` returns 503 in this phase, so use `npx wrangler kv key put --local --namespace-id 935b... top20 '{"version":1,"entries":[{"initials":"RAF","score":42000,"timeMs":180000,"submittedAt":"2026-05-23T14:55:21.123Z"}]}'`). Run `npm run dev:worker`. Open the game; the panel shows the seeded row. Tap the panel — game doesn't start. Tap outside — game starts.

### Tests for US1

- [X] T013 [P] [US1] Create `src/leaderboard/client.test.ts` per [contracts/module-contracts.md §2](./contracts/module-contracts.md). Inject a mock `fetch`. Cover:
  - `fetchLeaderboard` success → `{ kind: 'success', entries }`.
  - Network error → `{ kind: 'offline', reason: 'network' }`.
  - `AbortController` timeout → `{ kind: 'offline', reason: 'timeout' }`.
  - Non-2xx → `{ kind: 'offline', reason: 'http' }`.
  - 2xx with malformed JSON → `{ kind: 'offline', reason: 'http' }`.
  - `submitScore` 200 → `{ accepted: true, entries }`.
  - `submitScore` 400 → `{ accepted: false, error }`.
  - `submitScore` 429 → `{ accepted: false, error: 'rate_limited', retryAfterSeconds }`.
  - `submitScore` network error → `{ accepted: false, error: 'storage_unavailable' }`.
  - All cases emit the appropriate `console.debug` event (verify with a `vi.spyOn(console, 'debug')`).
- [X] T014 [P] [US1] Create `src/renderer/leaderboard-panel.test.ts` (jsdom). Cover:
  - `success` with 0 entries → empty-state message rendered.
  - `success` with N entries → exactly N rows; each row exposes rank, initials, score, time, date.
  - `offline` → offline message; no table.
  - `personalBestSurface.kind === 'pinned'` → a pinned row above the table with the right values.
  - `personalBestSurface.kind === 'highlighted'` at index `i` → the i-th row has `data-highlighted="true"`.
  - The panel root has `data-no-game-start="true"` (so the start handler can opt out).
  - Click on a row does NOT fire any host listener.

### Implementation for US1

- [X] T015 [P] [US1] Create `src/leaderboard/client.ts` per [contracts/module-contracts.md §2](./contracts/module-contracts.md). Use the native `fetch` and `AbortController`. Default `timeoutMs = LEADERBOARD_FETCH_TIMEOUT_MS`. All paths emit the required `console.debug` events.
- [X] T016 [P] [US1] Create `src/leaderboard/gate.ts` per [contracts/module-contracts.md §3](./contracts/module-contracts.md) — pure `shouldPromptForSubmission(board, runScore): boolean`. Include `src/leaderboard/gate.test.ts` with the truth table from the contract (empty board + score 0 → false; empty + score > 0 → true; full board + score > 20th → true; full + score ≤ 20th → false).
- [X] T017 [P] [US1] Create `src/leaderboard/types.ts` exporting `PersonalBest`, `FetchStatus`, `PersonalBestSurface` per [data-model.md §2](./data-model.md).
- [X] T018 [P] [US1] Create `src/leaderboard/index.ts` re-exporting the public surfaces per [contracts/module-contracts.md §6](./contracts/module-contracts.md).
- [X] T019 [US1] Create `src/renderer/leaderboard-panel.ts` per [contracts/module-contracts.md §14](./contracts/module-contracts.md). Renders semantic `<table>` for the data state; `<p>` for empty / offline. Pin-row above table when applicable. Sets `data-no-game-start="true"` on the host. Updates idempotent.
- [X] T020 [US1] Update `index.html`: add `<section id="leaderboard-panel" data-no-game-start="true" hidden></section>` adjacent to the existing overlays. Add inline CSS so the panel sits in a corner on desktop and full-width-but-bounded on ≤480px viewports, follows the existing pause-modal palette, and never sits OVER the "Tap to play" prompt. Add `<section id="submission-form" data-no-game-start="true" hidden></section>` too (used in US2; declaring the host here keeps `index.html` edits in one commit). Form-specific CSS is added later in T039.
- [X] T021 [US1] Update `src/main.ts`: query `#leaderboard-panel` and `#submission-form` (HTMLElement), pass through to `createGameLoop` as new entries on `GameLoopHostElements`. Type-only addition for the form host — US2 wires the actual form factory.
- [X] T022 [US1] Update `src/game/game-loop.ts`:
  - Extend `GameLoopHostElements` with `leaderboardPanel: HTMLElement` and `submissionForm: HTMLElement` (form host stays unused this phase).
  - On construction: build `leaderboardClient = createLeaderboardClient()`, `leaderboardPanel = createLeaderboardPanel(host.leaderboardPanel)`, `leaderboardStorage = createLeaderboardStorage()`, `currentBoard: readonly LeaderboardEntry[] = []`, `fetchStatus: FetchStatus = { kind: 'idle' }`.
  - Add a private `refreshLeaderboard()` that sets `fetchStatus = { kind: 'loading' }`, renders the panel, then calls `client.fetchLeaderboard()`, then updates `currentBoard + fetchStatus` accordingly and re-renders the panel.
  - Trigger `refreshLeaderboard()` once at construction time (so the start screen has data) and once after a game-over transition.
  - Show the leaderboard panel during the start-screen and game-over states; hide it during active runs (set `hidden` attribute on the host).
  - Add a click-target guard: when handling the "tap to start" event, skip starting if `event.target` is inside an element with `data-no-game-start="true"`.
- [X] T023 [US1] Update `src/renderer/index.ts` to export `createLeaderboardPanel` + type `LeaderboardPanel`. **Note**: T038 (US2) also edits this file to append `createSubmissionForm` exports. If US1 and US2 are implemented in parallel by two developers, serialise the `src/renderer/index.ts` edits (do T023 first, then T038) to avoid a merge conflict.

**Checkpoint**: US1 is independently testable. With a manually-seeded KV, the start screen + game-over screen show the board; "Tap to play" still works. Offline state appears when the Worker is stopped. The pinned / highlighted PB row never appears (PB derivation isn't wired until US3).

---

## Phase 4: User Story 2 — Submit my score when I crack the top 20 (Priority: P1)

**Goal**: When a run ends with a score that would crack the current top 20, the game-over screen surfaces a submission form (3-letter initials, default = last-used or "AAA", Submit + Skip). Submit posts to `/api/leaderboard`; on acceptance the panel refreshes and the player's row is highlighted; on rejection a clear error appears inline. Skip closes without sending.

**Independent Test**: With a seeded board (cutoff 5000), finish a run scoring 12500. Submission form appears. Type "ABC" + Submit. Network panel shows POST with the payload; response carries the new top 20 including the ABC row; the leaderboard panel updates and highlights the new row. Then play a run scoring 500: no submission form.

### Tests for US2

- [ ] T024 [P] [US2] Create `src/worker/validation.test.ts` per [contracts/module-contracts.md §9](./contracts/module-contracts.md). Cover EVERY failure mode listed in [SC-004](./spec.md):
  - non-object payload → `invalid_payload`.
  - missing fields → `invalid_payload`.
  - `initials` length 0 or > 3 → `invalid_payload`.
  - `initials` containing non-letters → `invalid_payload`.
  - lowercase `initials` coerce + accept.
  - `score` negative, non-integer, infinite, NaN → `invalid_payload`.
  - `timeMs` negative, non-integer, infinite, NaN → `invalid_payload`.
  - `score > plausibleMaxScore(timeMs)` (with multiple `timeMs` values) → `implausible_score`.
  - `score === plausibleMaxScore(timeMs)` → ok.
  - Tiny `timeMs` (e.g. 1000ms) still respects the 100k floor.
  - `signature` field present is silently ignored (v1).
- [ ] T025 [P] [US2] Create `src/worker/profanity.test.ts`: every entry in the embedded wordlist matches case-insensitively; a few non-matches (e.g. "RAF", "AAA", "XYZ" if not in list) don't match.
- [ ] T026 [P] [US2] Create `src/worker/rate-limit.test.ts` per [contracts/module-contracts.md §10](./contracts/module-contracts.md):
  - 10 submissions in one bucket all `allowed`.
  - 11th in the same bucket `rejected` with `retryAfterSeconds > 0`.
  - First submission in the next bucket `allowed` (counter resets).
  - Different IPs don't interfere.
  - `ipAddress === null` falls back to the `"unknown"` bucket.
  - Bucket key uses `Math.floor(now/3_600_000)`.
- [ ] T027 [P] [US2] Create `src/worker/board.test.ts`: insertion ordering, tie-break by `submittedAt` ascending, eviction at 21st entry, idempotence (re-inserting same entry doesn't duplicate when timestamps differ — it's actually expected that they differ; spec FR-021 governs ordering), `cracksTopN` truth table.
- [ ] T028 [P] [US2] Create `src/worker/handlers.test.ts`: drive `handleGet` and `handlePost` against `createInMemoryKVAdapter()`:
  - `handleGet` empty board → `{ entries: [] }`.
  - `handleGet` populated → returns sorted entries.
  - `handlePost` validation failure → respective error code.
  - `handlePost` profanity → `profanity`.
  - `handlePost` rate-limit → `rate_limited` (drive the counter via the same KV).
  - `handlePost` low score on full board → `{ accepted: true, entries: unchangedBoard }` (no write).
  - `handlePost` qualifying score → `{ accepted: true, entries: nextBoard }` containing the new entry at the right rank.
  - `submittedAt` comes from `ctx.now()`.
  - Forward-compat: `signature` ignored when `signingKey` undefined.
- [ ] T029 [P] [US2] Create `src/renderer/submission-form.test.ts` (jsdom) per [contracts/module-contracts.md §15](./contracts/module-contracts.md). Cover:
  - `open('AAA')` populates the input and reveals the host.
  - Typing lowercase letters auto-uppercases.
  - Non-letter keystrokes are blocked or stripped on input.
  - `maxlength` of 3 enforced.
  - Enter triggers `onSubmit` with the trimmed initials.
  - Escape triggers `onSkip`.
  - Submit button click triggers `onSubmit`; Skip button click triggers `onSkip`.
  - `setSubmitting(true)` disables both buttons; `setSubmitting(false)` re-enables.
  - `setError(msg)` shows the message; `setError(null)` clears.
- [ ] T030 [P] [US2] Create `tests/integration/leaderboard-flow.test.ts`. Exercise: empty board → submit → entries contains the submission → submit again with a higher score → entries contains both, sorted → submit 19 more such that the 21st would evict → eviction is the lowest score. Use the in-memory KV adapter directly.

### Implementation for US2

- [ ] T031 [P] [US2] Create `src/worker/validation.ts` per [contracts/module-contracts.md §9](./contracts/module-contracts.md). Pure functions: `validateSubmission(raw)` and `plausibleMaxScore(timeMs)`.
- [ ] T032 [P] [US2] Create `src/worker/profanity.ts`: a module-private `Set<string>` of ≤ 30 three-letter slurs/obscenities + `containsProfanity(initials: string): boolean` per [contracts/module-contracts.md §11](./contracts/module-contracts.md). Use a small list of well-known offensive 3-letter sequences (e.g. common English slurs and obvious obscenities) — keep the list tight; operators can amend later.
- [ ] T033 [P] [US2] Create `src/worker/rate-limit.ts`: `checkAndIncrement(kv, ipAddress, now)` per [contracts/module-contracts.md §10](./contracts/module-contracts.md). Implements R4's fixed-window strategy.
- [ ] T034 [P] [US2] Create `src/worker/board.ts`: `insertEntry`, `cracksTopN` per [contracts/module-contracts.md §12](./contracts/module-contracts.md). Pure functions; uses `LEADERBOARD_MAX_ENTRIES` for the cap.
- [ ] T035 [US2] Create `src/worker/handlers.ts` per [contracts/module-contracts.md §8](./contracts/module-contracts.md). Pulls together `validation`, `rate-limit`, `profanity`, `board`, and the `KVAdapter`. Implements the `handleGet` + `handlePost` factories.
- [ ] T036 [US2] Update `src/worker/index.ts`: replace the `POST → 503` placeholder with a real call to `handlers.handlePost`. Wire `clientIp = request.headers.get('CF-Connecting-IP')`, `signingKey = env.SIGNING_KEY`, `now = () => new Date()`. Map `SubmissionResponse.accepted === true` → 200; `error === 'invalid_payload' | 'profanity' | 'implausible_score'` → 400; `'rate_limited'` → 429; `'storage_unavailable'` → 503. Add a structured `console.log` per request with method + path + IP-hash + outcome.
- [ ] T037 [P] [US2] Create `src/renderer/submission-form.ts` per [contracts/module-contracts.md §15](./contracts/module-contracts.md). Implements `open`, `close`, `setError`, `setSubmitting`, `destroy`. Keyboard handling: Enter → submit, Escape → skip.
- [ ] T038 [US2] Update `src/renderer/index.ts` to export `createSubmissionForm` + types.
- [ ] T039 [US2] Update `index.html` CSS for `#submission-form` and the error message: matching pause-modal palette, focus ring, mobile-keyboard-friendly input sizing.
- [ ] T040 [US2] Update `src/game/game-loop.ts`:
  - Construct `submissionForm = createSubmissionForm(host.submissionForm, { onSubmit, onSkip })`.
  - On run end (after the existing game-over transitions): compute `runScore` from the score module + `runTimeMs` from the score module's elapsed value. If `shouldPromptForSubmission(currentBoard, runScore)` is true, `submissionForm.open(leaderboardStorage.getLastInitials())`.
  - `onSubmit(initials)`: `submissionForm.setSubmitting(true)`; `submissionForm.setError(null)`; persist `setLastInitials(initials)`; call `client.submitScore({ initials, score: runScore, timeMs: runTimeMs })`. On `accepted: true`, `submissionForm.close()`, replace `currentBoard = response.entries`, re-derive panel snapshot (PB derivation arrives in US3; for now `personalBestSurface = { kind: 'absent' }`), re-render. On rejected, `submissionForm.setSubmitting(false)` and `submissionForm.setError(messageForCode(error, retryAfterSeconds))`.
  - `onSkip`: `submissionForm.close()`. No state change.
  - Add `submissionForm.close()` to the run-restart path so a fresh run doesn't see a stale form.
  - `messageForCode` is a small pure helper colocated in `src/game/game-loop.ts` mapping each `SubmissionErrorCode` to the user-facing copy from [contracts/api.md](./contracts/api.md) + the rate-limit cool-down message ("Try again in {N} minutes").
- [ ] T041 [US2] Append `console.debug` instrumentation in `game-loop.ts`: `leaderboard_submit_attempted`, `leaderboard_submit_accepted`, `leaderboard_submit_rejected` (with code). The client `submitScore` already emits its own events; these add the loop-level outcome.
- [ ] T041a [US2] Extend the existing debug overlay (the one gated by `?debug=1`, currently in `src/renderer/debug-overlay.ts` or equivalent — locate via `Grep` for the existing overlay implementation) with a single leaderboard-status line per FR-027. Format: `Leaderboard: {fetchStatus.kind} · {entries.length} entries · PB {pb?.score ?? 'none'} · Last submit {lastSubmitOutcome ?? '—'}`. The line refreshes whenever the panel snapshot updates. If the existing overlay does not yet exist as a discrete module, add the new line wherever the `?debug=1`-gated text is rendered.

**Checkpoint**: US2 is independently testable. A qualifying run shows the form; submission updates the board; the new row appears highlighted (via the same client-side highlight path the panel already supports for the personal-best surface). All abuse vectors return their expected error codes.

---

## Phase 5: User Story 3 — See my personal best alongside the global field (Priority: P2)

**Goal**: Persist the player's per-device personal best; show it pinned above the table if it's NOT in the top 20, highlighted within the table if it IS, and absent if there's no PB yet.

**Independent Test**: Clear localStorage. Play a low-scoring run (does not crack the top 20). Refresh — a pinned "Your best" row appears above the table. Play a higher-scoring run that DOES crack the top 20; submit; refresh — the pinned row disappears and the table row carrying your submission is highlighted.

### Tests for US3

- [ ] T042 [P] [US3] Create `src/leaderboard/personal-best.test.ts` per [contracts/module-contracts.md §4](./contracts/module-contracts.md):
  - `shouldUpdatePersonalBest(null, ...)` → true.
  - `shouldUpdatePersonalBest(currentLower, ...)` → true.
  - `shouldUpdatePersonalBest(currentEqual, ...)` → false (ties don't update).
  - `shouldUpdatePersonalBest(currentHigher, ...)` → false.
  - `derivePersonalBestSurface(board, null, ...)` → `{ kind: 'absent' }`.
  - PB present + found in board at index 5 (initials match) → `{ kind: 'highlighted', atIndex: 5 }`.
  - PB present + not in board → `{ kind: 'pinned', entry: ... }`.
  - PB score matches an entry's score but `lastInitials` differs → `{ kind: 'pinned', ... }` (the device's claim is "your initials are X", not "any entry with this score").

### Implementation for US3

- [ ] T043 [P] [US3] Create `src/leaderboard/personal-best.ts` per [contracts/module-contracts.md §4](./contracts/module-contracts.md). Pure functions.
- [ ] T044 [US3] Update `src/leaderboard/index.ts` to re-export `shouldUpdatePersonalBest` + `derivePersonalBestSurface`.
- [ ] T045 [US3] Update `src/game/game-loop.ts`:
  - Track `personalBest: PersonalBest | null = leaderboardStorage.getPersonalBest()` at construction.
  - On run end (BEFORE the existing submission-prompt branch): if `shouldUpdatePersonalBest(personalBest, runScore, runTimeMs)`, update `personalBest = { score: runScore, timeMs: runTimeMs, achievedAt: new Date().toISOString() }`, call `leaderboardStorage.setPersonalBest(personalBest)`, emit `leaderboard_personal_best_updated`.
  - When rendering the panel snapshot anywhere, compute `personalBestSurface = derivePersonalBestSurface(currentBoard, personalBest, leaderboardStorage.getLastInitials())` and pass it into `leaderboardPanel.render({ fetch, personalBestSurface })`. Replace the temporary `{ kind: 'absent' }` from T040 with this derivation everywhere.

**Checkpoint**: US3 is independently testable. With a fresh device, the pinned row appears after one run. Crossing into the top-20 swaps pinned → highlighted. Each end-of-run that doesn't beat the PB leaves it unchanged.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T046 [P] Update `README.md`: add one line to "What's in it (so far)" summarising the new leaderboard capability. Align the existing inconsistency — line 5 says "Cloudflare Workers + Static Assets" but the Tech-stack section says "Cloudflare Pages"; pick "Workers + Static Assets" (matches `wrangler.toml`) and update both places. Update "Backend: none" line — the leaderboard is now the first backend.
- [ ] T047 [P] Refresh the `<!-- SPECKIT START -->...<!-- SPECKIT END -->` block in `CLAUDE.md` if `/speckit-plan` didn't already point at slice 010 (it did during planning; verify it's still pointing here post-implement).
- [ ] T048 [P] Run a full pass of `quickstart.md` §"Manual smoke tests" + §"Abuse-vector pass" against `npm run dev:worker`. Note any deviations and fix.
- [ ] T049 [P] Run `npm run typecheck`, `npm run lint`, `npm test` — every check green. Capture the bundle size delta with `npm run build` and confirm the gzipped client JS hasn't grown more than ~5 KB.
- [ ] T050 If any plausibility-bound rejections fire on legit human runs during T048, retune `LEADERBOARD_PLAUSIBLE_MAX_PER_SECOND` in `src/shared/config.ts`. Document any retune in a follow-up commit so the constitution-check audit trail stays clean.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: T001 (gitignore) and T003 (`wrangler.toml`) are independent of each other and can land in parallel. T002 (`package.json` + lockfile) must complete before T004 (tsconfig types) and T005 (ESLint rule update), because both depend on the new devDeps being installed.
- **Phase 2 (Foundational)**: T006 (types), T007 (config), T008 (KVAdapter), T011 (storage) are mutually independent. T009 (KVAdapter tests) depends on T008. T010 (worker entry + GET stub) depends on T006 + T008. T012 (storage tests) depends on T011.
- **Phase 3 (US1)**: Tests (T013, T014) precede the corresponding implementation (T015, T019). T015–T018 are mutually independent. T019 (panel) depends on T017 (types) but not on T015 (client). T020–T023 are sequential (`index.html` → `main.ts` → `game-loop.ts` → renderer/index).
- **Phase 4 (US2)**: Tests (T024–T030) precede the corresponding implementations (T031–T040). The pure modules (T031, T032, T033, T034) are mutually independent. T035 (handlers.ts) depends on all four. T036 (index.ts wiring) depends on T035. T037 (submission-form.ts) is independent of the worker modules. T040 (game-loop.ts) depends on T036 + T037.
- **Phase 5 (US3)**: T042 → T043 → T044 → T045. Strictly sequential.
- **Phase 6 (Polish)**: All [P] tasks are independent; T050 is conditional on T048 findings.

### User-story dependencies

- **US1 (P1)**: depends only on Foundational. Independently testable with manual KV seeding.
- **US2 (P1)**: depends only on Foundational. Adds the POST handler + submission form. Independently testable in isolation but only becomes useful alongside US1's read flow.
- **US3 (P2)**: depends only on Foundational + US1 (the panel snapshot it extends comes from US1). Does NOT depend on US2.

### Parallel opportunities

- All `[P]` tasks within a phase can run in parallel (different files).
- US1 (read) and US2 (submit + Worker handlers) can be implemented in parallel by two developers after Foundational completes — they touch disjoint client modules; the `index.html` host elements for both are declared together in T020 to avoid a second `index.html` edit later.
- US3 can land at any time after US1 — it only adds a new pure module + a small `game-loop.ts` edit.

---

## Parallel Example: User Story 2

```bash
# All Worker pure-logic modules and their tests in parallel:
Task: "Create src/worker/validation.ts + tests"
Task: "Create src/worker/profanity.ts + tests"
Task: "Create src/worker/rate-limit.ts + tests"
Task: "Create src/worker/board.ts + tests"

# In parallel with the above, the submission-form module:
Task: "Create src/renderer/submission-form.ts + tests"

# THEN serialise:
Task: "Create src/worker/handlers.ts (consumes the 4 above)"
Task: "Wire src/worker/index.ts to handlers"
Task: "Wire src/game/game-loop.ts to submission flow"
```

---

## Implementation Strategy

### MVP scope

US1 + US2 together = MVP. US3 is P2 polish that doesn't change the game's competitive surface.

### Phasing for a fast green-bar

1. Phase 1 (Setup) — one PR, fast review.
2. Phase 2 (Foundational) — checkpoint: `npm run dev:worker` serves an empty board.
3. Phase 3 (US1) — checkpoint: live board renders with seeded data; offline-graceful when Worker is down.
4. Phase 4 (US2) — checkpoint: full submit-then-fetch loop; all abuse vectors rejected.
5. Phase 5 (US3) — checkpoint: PB pinned row + highlight switching works across runs.
6. Phase 6 (Polish) — README + smoke + bundle check.

### Notes

- Commit at the end of every phase + at every checkpoint within a phase per the project's `feat(spec):` / `plan(NNN):` / `tasks(NNN):` / `impl(NNN):` convention.
- The wordlist in `src/worker/profanity.ts` is intentionally small; operators amend later without a code review of the slurs themselves.
- The KV namespace ID committed in `wrangler.toml` is the production namespace. Local `wrangler dev` uses an in-memory mock by default — production data is only touched if `--remote` is passed explicitly. Document this in `quickstart.md` (already done).
- **SC-007** (24-hour free-tier headroom at ≤100 distinct players) is an architectural acceptance criterion, not a buildable task. plan.md + research.md §R1 derive the sizing argument; production telemetry will validate it post-launch. No implementation task can prove it ahead of time.
