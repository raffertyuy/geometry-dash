# Feature Specification: Global Leaderboard

**Feature Branch**: `010-leaderboard`

**Created**: 2026-05-23

**Status**: Draft

**Input**: User description: "Add a global leaderboard. After each game-over, if the player's score would crack the top 20 on the global board, the game-over screen surfaces a 3-letter-initials input plus Submit / Skip buttons. The start screen and game-over screen both render the top-20 leaderboard with rank, initials, score, time, and submission date. The player's personal best is highlighted if it appears within the top 20, or pinned as a separate row above the board if it does not. Backend: a single hosted endpoint stores submissions; submissions are only persisted if they crack the current top 20. Server-side validation: well-formed payload, initials A–Z (max 3), score plausible relative to elapsed time, per-IP rate-limiting, profanity filter against a small embedded wordlist. v1 is a 'fun board, not competitive' — no signing keys, no replay verification. Out of scope: per-difficulty boards, time-windowed boards, accounts/sign-in, social features, replay capture."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — See the global top-20 from the start screen (Priority: P1)

A player opens the game and immediately sees the current global top-20 leaderboard on the start screen alongside the "Tap to play" affordance. They can read the field of scores to set a goal before they even tap to begin.

**Why this priority**: This is the leaderboard's primary social hook and the simplest cut — it works the moment the backend exists, with no submission flow needed. It also delivers value to players who never beat the top-20 (they still get to see what the field looks like).

**Independent Test**: Seed the backend with 5–20 entries (manually or via a one-off submission). Load the start screen on desktop and mobile. The leaderboard table renders with rank, initials, score, time, and date; "Tap to play" remains visible and interactive; tapping the leaderboard area does NOT start the game; tapping outside it does.

**Acceptance Scenarios**:

1. **Given** the backend holds 12 leaderboard entries, **When** the player opens the start screen, **Then** all 12 entries are visible in rank order and the "Tap to play" prompt remains visible and reachable.
2. **Given** the backend is empty (fresh deployment), **When** the player opens the start screen, **Then** an empty-state message such as "Be the first to claim a spot" is shown in place of the table.
3. **Given** the backend is unreachable (network error), **When** the player opens the start screen, **Then** a non-blocking "Leaderboard offline" message replaces the table and the player can still tap to play.
4. **Given** the start screen is open, **When** the player taps anywhere on the leaderboard panel itself, **Then** the game does NOT start; tapping outside the panel (or pressing any key) starts the game as before.

---

### User Story 2 — Submit my score when I crack the top 20 (Priority: P1)

A player finishes a run with a score high enough to crack the current top 20. The game-over screen shows a "You made the leaderboard!" prompt with a 3-letter-initials input (defaulting to whatever they last used, or "AAA" if first time), a Submit button, and a Skip button. Submitting writes the entry to the backend and shows the updated leaderboard with their row highlighted.

**Why this priority**: This is the loop closure — it converts spectators into participants. Co-equal priority with P1 because a leaderboard with no contributions stays empty; both pieces need to ship in v1.

**Independent Test**: With a seeded top-20 board, finish a run that beats the 20th-place score. The submission prompt appears; entering "ABC" + Submit results in (a) a network request to the backend with the payload, (b) a refreshed leaderboard now containing "ABC" at the appropriate rank, (c) the row visibly highlighted on the displayed table.

**Acceptance Scenarios**:

1. **Given** the player just scored 12,500 and the current 20th-place score is 8,000, **When** the game-over overlay opens, **Then** a submission form is presented with the 3-letter initials input and Submit/Skip buttons.
2. **Given** the player just scored 500 and the current 20th-place score is 5,000, **When** the game-over overlay opens, **Then** NO submission form is presented and the standard "try again" overlay shows.
3. **Given** the submission form is open with default initials "AAA", **When** the player types two letters and Submits, **Then** the entry is accepted and persisted with the partial initials (e.g. "AB").
4. **Given** the player has previously submitted as "RAF", **When** a new qualifying run finishes, **Then** the initials input pre-fills with "RAF" instead of "AAA".
5. **Given** the submission form is open, **When** the player presses Skip, **Then** the form closes, NO submission is sent, and the standard game-over overlay is shown.
6. **Given** the submission was just accepted, **When** the leaderboard re-renders, **Then** the player's new entry is visually distinguished (e.g. highlighted background) so it can be located at a glance.

---

### User Story 3 — See my personal best alongside the global field (Priority: P2)

A returning player sees their personal best (the highest score they have ever achieved on this device, tracked locally) either highlighted within the top-20 table if it appears there, or pinned as a separate "Your best" row above the table if it does not. This works regardless of whether they have ever submitted to the global board.

**Why this priority**: Pure motivational value — closes the gap between "the world's best" and "your best" so casual players who never crack the top-20 still see a personal progression signal. Lower priority than P1/P2 because the global board on its own is already meaningful.

**Independent Test**: Play one full run, then refresh the page. The start screen should show a "Your best" pinned row above the global top-20 with the previous run's score. Then play a run that exceeds it; the pinned row updates after game-over.

**Acceptance Scenarios**:

1. **Given** the player has finished at least one run on this device, **When** they view the start screen or game-over screen, **Then** their personal-best row is visible either as a pinned row above the table OR highlighted within the table.
2. **Given** the player has never finished a run on this device, **When** they view the start screen, **Then** no personal-best row is shown.
3. **Given** the player's personal best is 9,000 and the top-20 cutoff is 5,000, **When** they view the leaderboard, **Then** the row containing their best is highlighted within the top-20 (no pinned duplicate).
4. **Given** the player's personal best is 2,000 and the top-20 cutoff is 5,000, **When** they view the leaderboard, **Then** a pinned "Your best" row labelled with their best run's data appears above the top-20.

---

### Edge Cases

- **Backend unreachable**: A non-blocking "Leaderboard offline" message replaces the table; the rest of the game (run, score, lives, restart) remains fully playable.
- **Backend slow**: A loading skeleton is shown while the request is in flight; loads exceeding 5 s fall back to the "offline" message.
- **Empty backend**: An empty-state message ("Be the first to claim a spot") replaces the table.
- **Submission rejected — profanity**: The form shows an inline "Try different initials" error without revealing the wordlist; the player can edit and re-submit.
- **Submission rejected — rate-limited**: The form shows "Too many recent submissions; try again later" and Submit becomes inactive for a cool-down window.
- **Submission rejected — implausible score**: The form shows "Submission could not be verified" (deliberately vague to avoid teaching cheaters the formula); the entry is silently dropped server-side and logged.
- **Score ties with an existing entry**: The tie-breaker is "earlier submission ranks higher" (FCFS, arcade-style). The newer entry sits below the older entry of equal score.
- **Two qualifying runs from different players land at the same instant**: Both write; the backend resolves the resulting top-20 read by sorting by score then by submission timestamp. A brief eventual-consistency window where one client may see a slightly stale board is acceptable.
- **Player closes the game-over overlay without acting on the submission form**: Treated as Skip — no submission is sent.
- **Player edits initials to fewer than 3 characters and submits**: Accepted (1–3 characters allowed); the table renders the partial initials as-is.
- **Player on a 320 px-wide phone**: The leaderboard table remains readable (compressing column widths or stacking the date below the row is acceptable so long as Rank/Initials/Score remain legible at a glance).
- **Personal best lost from local storage**: Pinned row simply doesn't appear; the global table is still shown. No error.
- **Score of exactly 0 makes the top 20 (early days)**: Accepted — submission writes through as long as it cracks the current cutoff and other validators pass.

## Requirements *(mandatory)*

### Functional Requirements

#### Reading the leaderboard

- **FR-001**: The system MUST display the current global top 20 leaderboard on the start screen.
- **FR-002**: The system MUST display the current global top 20 leaderboard on the game-over screen.
- **FR-003**: Each leaderboard row MUST show rank, player initials, score, run elapsed time, and submission date.
- **FR-004**: The leaderboard MUST be readable on screens 320 px wide and above.
- **FR-005**: The leaderboard panel MUST NOT block the start-screen "Tap to play" affordance and MUST NOT cause taps within the leaderboard panel to start the game.
- **FR-006**: When the backend has no entries, the system MUST show an empty-state message in place of the table.
- **FR-007**: When the backend is unreachable or times out (>5 s), the system MUST show a non-blocking "Leaderboard offline" message and MUST keep the rest of the game playable.

#### Submitting a score

- **FR-008**: After a run ends, the system MUST present a submission form ONLY when the player's score would crack the current top 20.
- **FR-009**: The submission form MUST accept 1–3 ASCII letters A–Z (case-insensitive input, displayed and stored uppercase).
- **FR-010**: The submission form MUST default the initials field to the value the player last submitted (persisted across sessions) or to "AAA" if no prior submission exists.
- **FR-011**: The submission form MUST provide a Submit action and a Skip action; Skip MUST close the form without sending any data.
- **FR-012**: When a submission is accepted, the system MUST refresh the displayed leaderboard within 5 seconds and visually distinguish the new entry on the rendered table.
- **FR-013**: When a submission is rejected, the system MUST show a human-readable error and allow the player to edit and retry (subject to rate-limiting).

#### Personal-best surface

- **FR-014**: The system MUST track the player's personal-best run per device (highest score across all runs on this device) and persist it locally.
- **FR-015**: If the personal best appears within the top 20, the system MUST highlight that row on the displayed table and MUST NOT show a separate pinned row.
- **FR-016**: If the personal best does NOT appear within the top 20, the system MUST show a separate "Your best" row pinned above the table.
- **FR-017**: If no personal best exists yet (first-time player on this device), the system MUST NOT show a personal-best row.

#### Backend behaviour

- **FR-018**: The backend MUST expose a read endpoint that returns the current top 20 as structured data.
- **FR-019**: The backend MUST expose a write endpoint that validates submissions and persists them only if they crack the current top 20.
- **FR-020**: The backend MUST keep at most 20 entries in the stored leaderboard at any time; submissions that would push the list past 20 entries MUST evict the lowest-scored entry.
- **FR-021**: The backend MUST sort entries by score descending, ties broken by submission timestamp ascending (earlier wins).
- **FR-022**: The backend MUST validate every submission: initials match `^[A-Z]{1,3}$`, score is a finite non-negative integer, run time is a finite non-negative integer, score is within an arithmetic upper bound derived from the run's elapsed time and the game's known maximum scoring rate (with a generous fudge factor to absorb genuine outliers).
- **FR-023**: The backend MUST reject submissions whose initials match a small embedded profanity wordlist; rejections MUST NOT reveal the wordlist contents.
- **FR-024**: The backend MUST rate-limit submissions per client IP to at most 10 per hour using a sliding window; rate-limited submissions MUST return a clear error code that the client can surface.
- **FR-025**: The backend MUST be architected so that a future cryptographic signing requirement (e.g. an HMAC on the payload) can be added without a breaking change to the read endpoint.

#### Observability

- **FR-026**: Significant transitions (submission attempted, accepted, rejected with reason, rate-limit hit, fetch failed) MUST emit structured debug log events from both the client and the backend.
- **FR-027**: When the debug overlay is active (`?debug=1`), it MUST include a leaderboard-status line summarising the most recent fetch / submission outcome.

### Key Entities *(include if feature involves data)*

- **Leaderboard entry**: One persisted submission. Attributes: initials (1–3 letters A–Z), score (non-negative integer), run elapsed time (non-negative integer milliseconds), submission timestamp (ISO instant). Identity is the combination of (submission timestamp, initials) — no separate ID needed for v1.
- **Leaderboard board**: The ordered collection of up to 20 leaderboard entries, sorted by score descending then submission timestamp ascending.
- **Personal best**: Per-device record. Attributes: score, run elapsed time, achieved timestamp. Identity is implicit (one per device).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A returning player can see the current global top-20 within 2 seconds of opening the start screen on a 3-year-old mobile device on a typical home Wi-Fi connection.
- **SC-002**: A player whose run cracks the top 20 can complete submission (open form → type initials → Submit → see refreshed table) in under 10 seconds, with the new entry visibly distinguished on the displayed table.
- **SC-003**: A returning player's last-used initials are pre-filled on at least 99% of subsequent submission attempts on the same device (failures only occur when local storage has been cleared).
- **SC-004**: Across a manual abuse-vector pass — malformed payloads, oversized payloads, scores 10× above the plausible bound, repeated submissions from the same IP exceeding the rate limit, and profanity attempts — every abusive request is rejected and the persisted top 20 is not polluted.
- **SC-005**: On a 320 px-wide viewport, all leaderboard rows show rank, initials, and score legibly (run time and date may stack or abbreviate but must remain readable to a user who scrolls or zooms).
- **SC-006**: With the backend deliberately offline, a player can still complete a full run, see their game-over screen with their score and time, and dismiss the offline message — no part of the core game blocks on the leaderboard request.
- **SC-007**: Across a 24-hour period at expected v1 traffic (≤100 distinct players), the backend serves all read requests and never declines a legitimate top-20-cracking submission solely because of free-tier write-quota exhaustion.

## Assumptions

- The game is hosted on a platform that provides free-tier compute + key/value storage suitable for the read-mostly access pattern described (single small JSON blob per leaderboard, infrequent writes). The chosen platform's free quotas are sufficient at expected v1 traffic (≤100 distinct players, a few hundred reads per day, well under 100 writes per day).
- Players are uniquely identified per device for the purposes of the personal-best surface and the pre-filled initials field; no account system exists. Multiple players sharing a device share the same personal-best row.
- v1 anti-abuse is "fun board, not competitive" — server-side validation plus per-IP rate-limiting are adequate; a determined attacker who reads the public client bundle could forge submissions, and this is accepted for v1.
- The profanity wordlist is small (≤50 three-letter slurs) and embedded in the backend source. Operators can amend it without touching the client.
- Submission timestamps come from the backend (server-issued), not from the client, to prevent trivial spoofing of "earlier wins" tie-breaking.
- Run time on a leaderboard entry is the player's run-elapsed time (a derived value already produced by the existing score module), NOT wall-clock time.
- The game's existing escalation rules define a known maximum scoring rate per unit time; the backend's plausibility bound is derived from that constant with a generous safety multiplier (e.g. 3×) so that genuinely good runs are never flagged.
- The repo is published as a public GitHub repository; any future cryptographic secrets (signing keys, API tokens) must live in the deployment platform's secret store and never in committed source, in line with the project's secrets policy.
- Removing a polluted entry (e.g. a profanity that slipped through a future wordlist update) is performed by an operator using platform tooling (CLI / dashboard); no in-game moderator UI is required for v1.
