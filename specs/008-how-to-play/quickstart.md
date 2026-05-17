# Quickstart: How-to-Play Modal & In-Game Pause

**Slice**: 008-how-to-play · **Date**: 2026-05-17

## Automated checks

```powershell
npm run typecheck
npm run lint
npm test
```

All three must pass with zero errors / failures before manual validation.

New test files:

- `src/renderer/how-to-play-modal.test.ts` — section structure, dismissal trio (X / ESC / SPACE), backdrop click closes, mode-driven dismissal (`onResume` called only in pause mode), idempotent `show()`.
- `src/renderer/pause-button.test.ts` — state matrix (enabled / disabled / hidden), click dispatch only when enabled.

Tests removed: `src/renderer/credits-panel.test.ts` (module is deleted).

---

## Manual smoke (run in browser)

```powershell
npm run dev
```

1. Open `http://localhost:5173/`. **Expected**: a single "How to Play" button on the start screen where "Problem Credits" used to be; no "Problem credits" text anywhere.
2. Click "How to Play". **Expected**: modal opens with three sections in order — General Rules, Problem Cubes (3 rows with green/yellow/red swatches and labels), Credits (every source from before is listed with title, author, licence, link).
3. Press ESC. **Expected**: modal closes; start screen back to its prior state. No run started.
4. Re-open via "How to Play". Press SPACE. **Expected**: modal closes; start screen unchanged. (SPACE on the start screen still starts a run on the *next* press, so verify the dismissal-then-start works correctly.)
5. Re-open. Click the X close button. **Expected**: modal closes.
6. Start a run. **Expected**: a Pause button is visible at the top of the screen.
7. Steer to avoid obstacles for a few seconds. Click the Pause button. **Expected**: the world freezes within ~100 ms; the How-to-Play modal opens. The Credits section etc. look identical to the entry-screen path.
8. Press SPACE to close the modal. **Expected**: the run resumes from exactly where it stopped — no jump, no jitter, no skipped obstacles.
9. Trigger a problem-gate modal (steer into a cube). While it is open, look at the Pause button. **Expected**: greyed out / disabled. Click it — nothing happens. Press ESC and SPACE — the gate modal handles them as today; no How-to-Play modal opens.
10. Resolve the gate (correct or wrong). After the modal closes, observe: while the runner is blinking in invincibility (after a wrong answer caused a life loss), the Pause button is disabled. Once the blinking stops, it re-enables.
11. Run into multiple obstacles to reach game-over. **Expected**: the game-over screen shows the same "How to Play" link as the start screen; the same modal opens. The Pause button is NOT visible on the game-over screen.
12. With the modal open on the game-over screen, press SPACE. **Expected**: modal closes. Press SPACE again. **Expected**: restart (the existing game-over→restart behaviour). The first SPACE was absorbed by the modal; only the second triggers restart.
13. Resize the dev window to a phone-narrow viewport (320 px). Re-open the modal. **Expected**: no horizontal scrolling; the Problem Cubes rows are readable (column layout or stacked).
14. Open devtools. With `?debug=1` in the URL, hit a gate and open the Pause button → modal flow. **Expected**: `how_to_play_opened`, `how_to_play_closed`, and `pause_button_pressed` debug events appear in the console with the expected payloads.

---

## Bundle-size sanity

```powershell
npm run build
```

Confirm the gzipped JS output is within ~1 KB of `main` (slight increase or near-zero net since the deleted credits-panel offsets the new modules).

---

## Regression to verify

- The pause-on-blur path still works: start a run, tab away, tab back — the old pause overlay still shows (not the How-to-Play modal). Press any key to resume. This path is NOT touched by this slice.
- All 414 existing tests pass (or rather, the new total, after credits-panel.test.ts is deleted and the new test files are added).

---

## Out-of-scope reminders

- No localisation (English only).
- No persistent "don't show again" flag.
- No nested modal stacks.
- No SFX hooks.
- No new keybindings beyond ESC and SPACE.
