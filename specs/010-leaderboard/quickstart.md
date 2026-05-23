# Quickstart: Global Leaderboard

**Slice**: 010-leaderboard · **Date**: 2026-05-23

Slice-specific runbook for developing, testing, and validating the leaderboard. The cross-cutting commands (`npm test`, `npm run lint`, etc.) are documented in the top-level [`README.md`](../../README.md).

---

## One-time setup

The KV namespace has already been provisioned in Rafferty's Cloudflare account:

- Name: `geometry-dash-leaderboard`
- ID: `935b139cc04047bf9ecff5207fe264bc`
- Binding: `LEADERBOARD`

`wrangler.toml` (committed) declares the binding. No further setup is required to develop locally; `wrangler dev` will create an in-memory KV that does NOT touch the production namespace unless explicitly told to via `--remote`.

After cloning, install the new devDependencies:

```bash
npm install
```

(`wrangler` and `@cloudflare/workers-types` are picked up from `package.json`.)

---

## Local development

### Client-only iteration (most UI work)

```bash
npm run dev
```

This starts the Vite dev server on `http://localhost:5173/`. The Worker is NOT running; the leaderboard panel will show "Leaderboard offline" — which is exactly the failure mode the spec mandates (FR-007 / SC-006), so client-only iteration is fully meaningful.

### Worker + assets iteration (backend work)

```bash
npm run build          # populates dist/
npm run dev:worker     # wrangler dev — serves Worker + dist/ on http://localhost:8787
```

The local Worker uses an in-memory KV by default — submissions land in process memory and are lost when wrangler restarts. To hit the real production KV from local dev (rarely needed):

```bash
npx wrangler dev --remote
```

That mode reads/writes the live `geometry-dash-leaderboard` namespace. Use sparingly to avoid polluting production data.

### Seeding the local KV for UI iteration

The local KV starts empty, so the panel renders the "Be the first to claim a spot" empty state. To populate it with sample entries during `wrangler dev`:

```bash
# In one terminal: wrangler dev (above)
# In another: POST 5–10 fake submissions
curl -X POST http://localhost:8787/api/leaderboard \
  -H 'Content-Type: application/json' \
  -d '{"initials":"RAF","score":42000,"timeMs":180000}'
```

Repeat with different initials / scores to exercise sorting and tie-breaks. Each accepted submission also returns the updated board so you can verify ordering.

---

## Automated validation

### Unit tests

```bash
npm test
```

The new tests live in:

- `src/leaderboard/*.test.ts` — client-side pure logic (gate predicate, personal-best derivation, storage adapter, fetch helper with mocked `fetch`).
- `src/worker/*.test.ts` — Worker-side pure logic (validation incl. plausibility bound, rate-limit bucket, profanity match, board insert/sort/evict, handler routing).
- `tests/integration/leaderboard-flow.test.ts` — full submit → fetch → second-submit-causes-eviction flow against the in-memory KV stub.

All Worker tests use `createInMemoryKVAdapter()` — no real Cloudflare runtime needed.

### Type check + lint

```bash
npm run typecheck
npm run lint
```

ESLint's library-boundary rule will reject any new code that imports `three`, anything under `src/renderer/*`, or anything under `src/game/*` from inside `src/worker/*`.

---

## Manual smoke tests

After `npm run build && npm run dev:worker` (so both Worker + bundle are live on `http://localhost:8787`):

### US1 — Read the board from the start screen

1. Open `http://localhost:8787/` in Chrome desktop. The leaderboard panel should render (empty state on first visit).
2. Verify the panel does NOT cover or intercept the "Tap to play" prompt.
3. Click anywhere on the panel — the game should NOT start.
4. Click outside the panel (or press any key) — the game SHOULD start.
5. Repeat on an iPhone-shaped viewport (320 px or 375 px). Verify the panel is legible and "Tap to play" is reachable.

### US2 — Submission flow

1. Pre-seed three entries via `curl` so the cutoff isn't zero.
2. Play a run that beats the third entry's score.
3. On game-over, verify the submission form appears with the 3-letter input.
4. Default initials should be "AAA" (or whatever you submitted via curl most recently if localStorage carries over).
5. Type "RAF" + Submit. Verify (a) the form closes, (b) the leaderboard updates, (c) the "RAF" row is highlighted on the new render, (d) `localStorage.getItem('gd:leaderboard:lastInitials') === 'RAF'`.
6. Refresh the page. The leaderboard should still show your entry. The submission form should NOT auto-open.
7. Play a run with a low score (below the cutoff). On game-over, verify NO submission form opens.

### US3 — Personal best surface

1. Clear localStorage (`localStorage.clear()` in devtools).
2. Play one run with a low score (say 500). On game-over, dismiss any submission form (Skip if it opens; it shouldn't if the cutoff is higher).
3. Refresh. The leaderboard should show a pinned "Your best" row above the table with score 500.
4. Play another run with a higher score (say 2000). Refresh. The pinned row should now show 2000.
5. Play a run that cracks the top 20 and submit. Refresh. Your entry should appear within the top 20, highlighted, and NO pinned row should be shown (because PB is now in the top 20).

### Abuse-vector pass (SC-004)

Run each of the following against `http://localhost:8787` and verify the responses:

```bash
# Malformed JSON
curl -X POST http://localhost:8787/api/leaderboard -H 'Content-Type: application/json' -d 'not json'
# Expected: 400 invalid_payload

# Wrong field types
curl -X POST http://localhost:8787/api/leaderboard -H 'Content-Type: application/json' \
  -d '{"initials":42,"score":"a","timeMs":-1}'
# Expected: 400 invalid_payload

# Impossible score
curl -X POST http://localhost:8787/api/leaderboard -H 'Content-Type: application/json' \
  -d '{"initials":"AAA","score":999999999,"timeMs":1000}'
# Expected: 400 implausible_score

# Profanity (pick a known wordlist entry — confirm in src/worker/profanity.ts)
curl -X POST http://localhost:8787/api/leaderboard -H 'Content-Type: application/json' \
  -d '{"initials":"XXX","score":100,"timeMs":1000}'
# Expected: 400 profanity (if XXX is in the wordlist)

# Rate limit — fire 11 valid submissions in quick succession
for i in 1 2 3 4 5 6 7 8 9 10 11; do
  curl -s -X POST http://localhost:8787/api/leaderboard -H 'Content-Type: application/json' \
    -d "{\"initials\":\"AB$i\",\"score\":$i,\"timeMs\":1000}" | tee /dev/stderr | head -c 200
  echo
done
# Expected: requests 11+ return 429 rate_limited with retryAfterSeconds
```

### Offline-graceful behaviour

1. Stop `wrangler dev` while the game tab is open.
2. Refresh the page. The leaderboard panel should show "Leaderboard offline" within ~5 seconds.
3. Play a full run. Game-over screen should show as normal; no submission form (no board to qualify against).
4. Restart `wrangler dev` and refresh — the leaderboard should reappear.

---

## Deployment

Deploys are driven by `wrangler deploy` (whether triggered locally or via the Cloudflare dashboard's git integration). The dashboard integration already in place picks up `wrangler.toml` automatically once it lands in the repo.

After deploy, verify the live URL (`trgd.raztype.com`):

1. `curl https://trgd.raztype.com/api/leaderboard` returns a 200 with `{ "entries": [...] }`.
2. Submit a smoke-test entry with a recognisable initials triple (e.g. "ZZZ") via the actual game.
3. Confirm it appears in the live board.
4. Operator cleanup: `npx wrangler kv key delete --namespace-id 935b139cc04047bf9ecff5207fe264bc top20` would wipe the entire production board — only do this intentionally.

---

## Operator playbook

### Removing a polluted entry

The profanity wordlist will inevitably miss something. To remove a single entry:

1. Fetch the current board: `npx wrangler kv key get --namespace-id 935b139cc04047bf9ecff5207fe264bc top20`.
2. Edit the JSON to remove the offending entry.
3. Push it back: `npx wrangler kv key put --namespace-id 935b139cc04047bf9ecff5207fe264bc top20 "$(cat board.json)"`.

To nuke the entire board: `npx wrangler kv key delete --namespace-id 935b139cc04047bf9ecff5207fe264bc top20`. The next read returns an empty board.

### Adjusting plausibility bound or rate limit

All numbers live in `src/shared/config.ts`:

- `LEADERBOARD_PLAUSIBLE_MAX_PER_SECOND`
- `LEADERBOARD_PLAUSIBLE_MIN_FLOOR`
- `LEADERBOARD_RATE_LIMIT_PER_HOUR`
- `LEADERBOARD_RATE_LIMIT_BUCKET_TTL_SECONDS`

Edit, commit, redeploy. No KV migration required — the changes apply to new submissions only.

### Adding wordlist entries

Edit `src/worker/profanity.ts`, append to the embedded set, commit, redeploy.
