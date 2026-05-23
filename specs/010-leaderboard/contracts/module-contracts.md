# Module Contracts: Global Leaderboard

**Slice**: 010-leaderboard · **Date**: 2026-05-23

Public TypeScript surfaces of every new or modified module in this slice. All types referenced here are defined in [`../data-model.md`](../data-model.md) unless noted.

---

## 1. NEW: `src/shared/leaderboard-types.ts`

Single source of truth for on-the-wire types. Imported by both client and Worker.

```ts
export interface LeaderboardEntry { /* see data-model §1 */ }
export interface SubmissionRequest { /* see data-model §1 */ }
export type SubmissionResponse = /* see data-model §1 */;
export type SubmissionErrorCode = /* see data-model §1 */;
export interface LeaderboardResponse { /* see data-model §1 */ }
```

ESLint boundary: this file is the only thing `src/worker/*` is allowed to import from outside its own folder, besides `src/shared/config.ts`.

---

## 2. NEW: `src/leaderboard/client.ts` (client → server fetch helpers)

```ts
import type { LeaderboardEntry, SubmissionRequest, SubmissionResponse } from '../shared/leaderboard-types';

export type FetchOutcome =
  | { readonly kind: 'success'; readonly entries: readonly LeaderboardEntry[] }
  | { readonly kind: 'offline'; readonly reason: 'network' | 'timeout' | 'http' };

export interface LeaderboardClient {
  fetchLeaderboard(): Promise<FetchOutcome>;
  submitScore(payload: SubmissionRequest): Promise<SubmissionResponse>;
}

export function createLeaderboardClient(options?: {
  readonly baseUrl?: string;            // defaults to '' (same-origin)
  readonly timeoutMs?: number;          // defaults to LEADERBOARD_FETCH_TIMEOUT_MS
  readonly fetchImpl?: typeof fetch;    // injectable for tests
}): LeaderboardClient;
```

**Behaviour**:

- `fetchLeaderboard()` issues `GET ${baseUrl}/api/leaderboard` with an `AbortController` honoured at `timeoutMs`. Maps network errors / aborts / non-2xx into `{ kind: 'offline', reason }`. On 2xx with malformed JSON, treats as `offline` with `reason: 'http'`.
- `submitScore(payload)` issues `POST ${baseUrl}/api/leaderboard` with JSON body. Maps 200 → `{ accepted: true, entries }`, 400/429/503 → `{ accepted: false, error, retryAfterSeconds? }`. Network errors map to `{ accepted: false, error: 'storage_unavailable' }` so the UI shows a recoverable error rather than a hard offline state.
- Both methods emit `console.debug` events per FR-026: `leaderboard_fetch_started`, `leaderboard_fetch_succeeded` (with entry count), `leaderboard_fetch_failed` (with reason), `leaderboard_submit_started`, `leaderboard_submit_accepted`, `leaderboard_submit_rejected` (with code).

---

## 3. NEW: `src/leaderboard/gate.ts` (submission gate predicate)

```ts
import type { LeaderboardEntry } from '../shared/leaderboard-types';

/**
 * Returns true iff a run that ended with the given score should prompt
 * the player to submit. The predicate is local — the server is the
 * authority and may reject the submission for other reasons.
 */
export function shouldPromptForSubmission(
  board: readonly LeaderboardEntry[],
  runScore: number,
): boolean;
```

**Behaviour**: returns `runScore > 0 && (board.length < 20 || runScore > board[board.length - 1].score)`. A `runScore` of 0 never prompts (FR-008 in spirit — 0 cracks the top 20 only on a completely empty board, but the UX of asking for initials on a 0 score is bad). Edge case: an empty board with a 0 score does NOT prompt, by design.

---

## 4. NEW: `src/leaderboard/personal-best.ts` (PB derivation)

```ts
import type { LeaderboardEntry } from '../shared/leaderboard-types';
import type { PersonalBest, PersonalBestSurface } from './types';

export function shouldUpdatePersonalBest(
  current: PersonalBest | null,
  runScore: number,
  runTimeMs: number,
): boolean;

export function derivePersonalBestSurface(
  board: readonly LeaderboardEntry[],
  personalBest: PersonalBest | null,
  lastInitials: string,
): PersonalBestSurface;
```

**Behaviour**:

- `shouldUpdatePersonalBest`: returns `true` if `current === null` OR `runScore > current.score`. (Ties don't update.)
- `derivePersonalBestSurface`:
  - `personalBest === null` → `{ kind: 'absent' }`.
  - else look for an entry in `board` where `entry.score === personalBest.score && entry.timeMs === personalBest.timeMs && entry.initials === lastInitials`. If found at index `i`, return `{ kind: 'highlighted', atIndex: i }`. Otherwise return `{ kind: 'pinned', entry: { initials: lastInitials, score, timeMs, submittedAt: personalBest.achievedAt } }`.

The match criteria deliberately use `lastInitials` as part of the highlight key — if the player has been resetting initials, only the most recent submission's initials count as "yours" for highlight purposes. This is intentional: the personal-best surface is *device-local* and *player-claimed*.

---

## 5. NEW: `src/leaderboard/storage.ts` (localStorage adapter)

```ts
import type { PersonalBest } from './types';

export interface LeaderboardStorage {
  getLastInitials(): string;                          // returns LEADERBOARD_DEFAULT_INITIALS if empty/corrupt
  setLastInitials(initials: string): void;            // uppercases, truncates to 3
  getPersonalBest(): PersonalBest | null;             // null if empty/corrupt
  setPersonalBest(pb: PersonalBest): void;
}

export function createLeaderboardStorage(
  backing?: Pick<Storage, 'getItem' | 'setItem'>,    // defaults to window.localStorage
): LeaderboardStorage;
```

**Behaviour**: All reads are corruption-tolerant — invalid JSON, wrong shape, or wrong types return the empty default and silently overwrite on next write. Writes never throw (try/catch around `setItem` to absorb quota errors). The injectable `backing` lets tests run in Node without `window`.

---

## 6. NEW: `src/leaderboard/index.ts` (public re-exports)

```ts
export { createLeaderboardClient, type LeaderboardClient, type FetchOutcome } from './client';
export { shouldPromptForSubmission } from './gate';
export { shouldUpdatePersonalBest, derivePersonalBestSurface } from './personal-best';
export { createLeaderboardStorage, type LeaderboardStorage } from './storage';
export type { PersonalBest, PersonalBestSurface, FetchStatus } from './types';
```

---

## 7. NEW: `src/worker/index.ts` (Worker entry point)

```ts
import type { LeaderboardResponse, SubmissionRequest, SubmissionResponse } from '../shared/leaderboard-types';

/** Worker runtime bindings (declared in wrangler.toml). */
export interface WorkerEnv {
  readonly LEADERBOARD: KVNamespace;
  readonly ASSETS: Fetcher;                  // Cloudflare's static-assets binding
  readonly SIGNING_KEY?: string;             // Reserved for future use (R10); absent in v1.
}

const worker: ExportedHandler<WorkerEnv> = {
  async fetch(request, env, ctx) {
    // Route /api/leaderboard → handlers; everything else → env.ASSETS.fetch(request)
  },
};
export default worker;
```

**Routing**:

- `GET /api/leaderboard` → `handlers.handleGet(request, kvAdapter)` → `Response<LeaderboardResponse>`.
- `POST /api/leaderboard` → `handlers.handlePost(request, kvAdapter, env.SIGNING_KEY)` → `Response<SubmissionResponse>`.
- `OPTIONS /api/leaderboard` → 204 (preflight, even though same-origin should never trigger one).
- Other methods on `/api/leaderboard` → 405.
- Anything outside `/api/*` → `env.ASSETS.fetch(request)` (Cloudflare static-assets pass-through; serves `dist/`).

---

## 8. NEW: `src/worker/handlers.ts`

```ts
import type { KVAdapter } from './kv-adapter';
import type { LeaderboardResponse, SubmissionResponse } from '../shared/leaderboard-types';

export interface HandlerContext {
  readonly kv: KVAdapter;
  readonly now: () => Date;                  // injectable for tests
  readonly clientIp: string | null;
  readonly signingKey?: string;              // forward-compat; ignored in v1
}

export async function handleGet(ctx: HandlerContext): Promise<LeaderboardResponse>;
export async function handlePost(
  ctx: HandlerContext,
  rawPayload: unknown,
): Promise<SubmissionResponse>;
```

**Behaviour**:

- `handleGet`: read `top20`, parse, return `{ entries }`. KV miss returns `{ entries: [] }`.
- `handlePost`:
  1. Parse + validate `rawPayload` against `SubmissionRequest` shape (via `validation.ts`).
  2. Check rate limit (via `rate-limit.ts`); on miss, return `{ accepted: false, error: 'rate_limited', retryAfterSeconds }`.
  3. Check profanity (via `profanity.ts`); on hit, return `{ accepted: false, error: 'profanity' }`.
  4. Check score plausibility (via `validation.ts`); on miss, return `{ accepted: false, error: 'implausible_score' }`.
  5. Read current board, decide if entry cracks top 20 (via `board.ts`):
     - If NO: still consume the rate-limit bucket (already done above) and return `{ accepted: true, entries: currentBoard }`. The "accepted" verb is slightly fuzzy here — the submission wasn't rejected but no write happened. Returning `accepted: true` keeps the client flow simple; the new entry is absent from `entries` so the client doesn't see itself.
     - If YES: insert, sort, truncate, write back, return `{ accepted: true, entries: nextBoard }`.
  6. Any unexpected `kv.put` failure → return `{ accepted: false, error: 'storage_unavailable' }` and log the error.

Refinement on step 5: alternative is to return a distinct outcome for "valid but didn't crack top 20". For v1 the spec says the CLIENT decides whether to prompt (via `shouldPromptForSubmission`), so this server-side path is a defence-in-depth — the server simply persists what's a top-20 entry and silently no-ops the rest. The client never sees this branch in normal play.

---

## 9. NEW: `src/worker/validation.ts`

```ts
import type { SubmissionRequest } from '../shared/leaderboard-types';

export type ValidationResult =
  | { readonly kind: 'ok'; readonly value: SubmissionRequest & { readonly initials: string } }
  | { readonly kind: 'err'; readonly code: 'invalid_payload' | 'implausible_score' };

export function validateSubmission(raw: unknown): ValidationResult;
export function plausibleMaxScore(timeMs: number): number;
```

**Behaviour**:

- `validateSubmission`:
  - Reject `null` / non-object → `invalid_payload`.
  - Coerce `initials` to uppercase, verify `/^[A-Z]{1,3}$/` → else `invalid_payload`.
  - Verify `score` integer in `[0, Number.MAX_SAFE_INTEGER]` → else `invalid_payload`.
  - Verify `timeMs` integer in `[0, Number.MAX_SAFE_INTEGER]` → else `invalid_payload`.
  - Verify `score <= plausibleMaxScore(timeMs)` → else `implausible_score`.
  - Ignore `signature` field in v1.
- `plausibleMaxScore`: `Math.max(LEADERBOARD_PLAUSIBLE_MIN_FLOOR, Math.ceil(timeMs / 1000) * LEADERBOARD_PLAUSIBLE_MAX_PER_SECOND)` (R5).

---

## 10. NEW: `src/worker/rate-limit.ts`

```ts
import type { KVAdapter } from './kv-adapter';

export type RateLimitResult =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'rejected'; readonly retryAfterSeconds: number };

export async function checkAndIncrement(
  kv: KVAdapter,
  ipAddress: string,
  now: Date,
): Promise<RateLimitResult>;
```

**Behaviour**: implements R4. Uses `rateLimitKey(ipAddress, hourBucket)` where `hourBucket = Math.floor(now.getTime() / 3_600_000)`. If `ipAddress === null` (e.g. local dev without `CF-Connecting-IP`), falls back to a `"unknown"` bucket so the limit still applies in aggregate.

---

## 11. NEW: `src/worker/profanity.ts`

```ts
export function containsProfanity(initials: string): boolean;
```

**Behaviour**: case-insensitive `Set.has` against the embedded wordlist. The wordlist is a module-private `const`; the function takes uppercase input (after validation) and tests presence directly.

---

## 12. NEW: `src/worker/board.ts`

```ts
import type { LeaderboardEntry } from '../shared/leaderboard-types';

/** Insert candidate into sorted board, truncate to top 20, return the new board. */
export function insertEntry(
  board: readonly LeaderboardEntry[],
  candidate: LeaderboardEntry,
): readonly LeaderboardEntry[];

/** True iff the candidate would crack the current top 20. */
export function cracksTopN(
  board: readonly LeaderboardEntry[],
  candidate: Pick<LeaderboardEntry, 'score'>,
  maxEntries: number,
): boolean;
```

**Behaviour**:

- `insertEntry` is pure. Uses stable sort with the FR-021 tie-break (`score` desc, `submittedAt` asc).
- `cracksTopN` checks `board.length < maxEntries || candidate.score > board[maxEntries - 1].score`.

---

## 13. NEW: `src/worker/kv-adapter.ts`

```ts
export interface KVAdapter {
  get<T>(key: string): Promise<T | null>;             // expects JSON; returns null if missing or unparseable
  put<T>(key: string, value: T, options?: { readonly expirationTtlSeconds?: number }): Promise<void>;
}

export function createKVAdapter(kv: KVNamespace): KVAdapter;
export function createInMemoryKVAdapter(): KVAdapter; // for tests; ~30 LOC, Map-backed
```

**Behaviour**:

- `createKVAdapter`: thin wrapper. `get` uses `kv.get(key, 'json')`; `put` uses `kv.put(key, JSON.stringify(value), { expirationTtl })`.
- `createInMemoryKVAdapter`: a `Map<string, { value: unknown; expiresAt: number | null }>` with manual expiration check on each `get`. No background eviction needed.

---

## 14. NEW: `src/renderer/leaderboard-panel.ts`

```ts
import type { LeaderboardPanelSnapshot, LeaderboardPanel } from '../leaderboard/types';

export function createLeaderboardPanel(host: HTMLElement): LeaderboardPanel;
```

**Behaviour**: renders a semantic `<table>` with rank, initials, score, time, date columns; an empty-state `<p>` for `fetch.kind === 'success' && fetch.entries.length === 0`; an offline-state `<p>` for `fetch.kind === 'offline'`; a pinned "Your best" row above the table if `personalBestSurface.kind === 'pinned'`; the `atIndex` row gets a `data-highlighted="true"` attribute if `personalBestSurface.kind === 'highlighted'`. Click events on rows are ignored (per FR-005); the entire panel sets `data-no-game-start="true"` so the game-loop's "tap to start" handler can opt out.

---

## 15. NEW: `src/renderer/submission-form.ts`

```ts
export interface SubmissionFormHandlers {
  onSubmit(initials: string): void;
  onSkip(): void;
}

export interface SubmissionForm {
  open(initialInitials: string): void;
  close(): void;
  setError(message: string | null): void;
  setSubmitting(submitting: boolean): void;
  destroy(): void;
}

export function createSubmissionForm(
  host: HTMLElement,
  handlers: SubmissionFormHandlers,
): SubmissionForm;
```

**Behaviour**: a 3-character A–Z `<input>` + Submit / Skip buttons. Letters auto-uppercase on input. `Enter` triggers Submit, `Escape` triggers Skip. Closes the form on Skip; on Submit, `setSubmitting(true)` disables both buttons until the parent calls `setSubmitting(false)`. `setError(message)` displays an inline error below the input.

---

## 16. MODIFIED: `src/renderer/index.ts`

Add re-exports:

```ts
export { createLeaderboardPanel, type LeaderboardPanel } from './leaderboard-panel';
export { createSubmissionForm, type SubmissionForm, type SubmissionFormHandlers } from './submission-form';
```

---

## 17. MODIFIED: `src/game/game-loop.ts`

Wires the leaderboard into the existing lifecycle:

- On game-loop construction, build a `LeaderboardClient`, a `LeaderboardStorage`, a `LeaderboardPanel`, and a `SubmissionForm`.
- On start screen render (and on game-over screen render), call `client.fetchLeaderboard()`, update the panel with `{ fetch, personalBestSurface }`.
- On run end, compute `shouldUpdatePersonalBest` → persist if true. Compute `shouldPromptForSubmission` → if true, open the submission form.
- `SubmissionFormHandlers.onSubmit(initials)`: storage.setLastInitials; client.submitScore; on accepted, refresh panel; on rejected, `form.setError(messageFor(code))`.
- `SubmissionFormHandlers.onSkip()`: form.close.

The leaderboard fetch IS NOT triggered every frame; it's triggered on (a) game-loop init, (b) accepted submission. The fetch promise's result updates the panel asynchronously.

---

## 18. MODIFIED: `src/main.ts`

Add two new host-element references:

```ts
const leaderboardPanelHost = document.querySelector<HTMLElement>('#leaderboard-panel')!;
const submissionFormHost = document.querySelector<HTMLElement>('#submission-form')!;
```

Pass both into the game-loop factory's `hostElements` argument.

---

## 19. MODIFIED: `index.html`

Add two new host elements adjacent to existing overlays:

```html
<section id="leaderboard-panel" data-no-game-start="true" hidden></section>
<section id="submission-form" data-no-game-start="true" hidden></section>
```

The CSS for these lives inline in `index.html` (matching the existing pattern from slices 005–009).

---

## 20. MODIFIED: `package.json`

```json
{
  "devDependencies": {
    "wrangler": "^3.0.0",
    "@cloudflare/workers-types": "^4.20240000.0"
  },
  "scripts": {
    "dev:worker": "wrangler dev"
  }
}
```

---

## 21. NEW: `wrangler.toml`

```toml
name = "geometry-dash"
main = "src/worker/index.ts"
compatibility_date = "2026-05-23"

[assets]
directory = "./dist"
binding = "ASSETS"

[[kv_namespaces]]
binding = "LEADERBOARD"
id = "935b139cc04047bf9ecff5207fe264bc"
```

---

## 22. MODIFIED: `tsconfig.json`

Add `@cloudflare/workers-types` so the Worker code typechecks. The client code does NOT use these types and is unaffected (they're additive globals).

```json
{
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  }
}
```

If the existing config already has a `types` array, append rather than replace.

---

## 23. MODIFIED: `eslint.config.js`

Extend the existing library-boundary rule so `src/worker/*` can only import from `src/shared/*` and its own folder. Specifically forbid imports of `three` and anything under `src/renderer/`, `src/game/`, or any other DOM-facing module from inside `src/worker/`.

---

## 24. MODIFIED: `.gitignore`

Append:

```text
.wrangler/
.dev.vars
```
