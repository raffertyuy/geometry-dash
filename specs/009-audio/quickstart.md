# Quickstart: Audio

**Slice**: 009-audio · **Date**: 2026-05-17

## Automated checks

```powershell
npm run typecheck
npm run lint
npm test
```

All three must pass with zero errors / failures before manual validation.

New test files:

- `src/audio/audio-engine.test.ts` — gesture latch, mute toggle, BGM start / pause / resume / stop with a stubbed `AudioContext`; SFX `play()` no-ops before gesture and emits after.
- `src/audio/sfx-synth.test.ts` — each `SfxName` returns a valid `SfxPlayback` shape (non-null source, positive `durationMs`).
- `src/renderer/mute-button.test.ts` — state matrix (un-muted / muted icon swap + `aria-pressed` flip); click + keyboard 'M' both fire `onToggle`.

---

## Manual smoke (run in browser)

```powershell
npm run dev
```

1. Open `http://localhost:5173/`. Note: **no sound yet** (no user gesture). Page should be silent.
2. Press any key or tap to start the run. **Expected**: the **default** BGM begins playing within 1 second.
3. Steer the runner left / right. **Expected**: each lane change emits a short blip.
4. Hit an obstacle (in a non-invincible state). **Expected**: a thud SFX then the descending life-lost SFX; lives HUD decrements.
5. Hit a problem cube. **Expected**: chime SFX, modal opens, and within ~500 ms the audio swaps from the default BGM to the **contest** theme (math-contest / battle-of-the-brains style). The default track is no longer audible.
6. Pick the correct answer. **Expected**: positive arpeggio SFX. Close modal; audio swaps back to the default BGM within ~500 ms (the default track may restart from its loop start — that is intentional per FR-001b).
7. Hit another problem cube; pick the wrong answer. **Expected**: descending life-lost SFX (no separate wrong-answer sound).
8. Let a Basic problem-cube countdown run to its final 10 s. **Expected**: a soft tick on every visible-second-boundary from `0:10` down. Stops the moment you answer or hit `0:00`.
9. Open the Pause button → How-to-Play modal. **Expected**: BGM pauses entirely (no track switching — both default and contest are silenced). Close it; BGM resumes the SAME track it was on (default if no gate was open, contest if it was) from the same position.
10. Switch browser tabs and come back. **Expected**: BGM pauses on blur; on return + first input, BGM resumes the same track from the same position.
11. Click the 🔊 mute button in the HUD. **Expected**: all audio silences within 200 ms; icon swaps to 🔇; `aria-pressed` flips to `true`. Verify no SFX play on subsequent lane changes / hits. Click again; BGM resumes audibly mid-track.
12. Press `M` on the keyboard. **Expected**: same toggle behaviour, regardless of run state.
13. Lose all 3 lives. **Expected**: BGM stops; distinct game-over arpeggio plays once.
14. Restart. **Expected**: BGM starts fresh from the loop's beginning.
15. Open devtools with `?debug=1`. Trigger each event; confirm the `audio_unlocked`, `audio_bgm_started`, `audio_sfx_played` (with `name`), and `audio_mute_toggled` debug events fire with the right payloads.

---

## Cross-browser smoke

- **Chrome desktop**: All steps 1–15 should work.
- **Firefox desktop**: Same. Opus playback is native.
- **Safari desktop**: Same. (Safari supports Opus from 14.1+ via MSE; fallback to `.m4a` if cross-version compat surfaces an issue — research §R2.)
- **iOS Safari**: Steps 1–8 + 11 + 13 are the critical ones. Verify the gesture-unlock works — no sound before the first touch.
- **Android Chrome**: Same as iOS.

---

## Bundle-size sanity

```powershell
npm run build
```

Confirm:
- JS bundle delta is ≤ 5 KB gzipped vs. `main`.
- `dist/audio/bgm-default.opus` and `dist/audio/bgm-contest.opus` are each ≤ 500 KB; combined ≤ 1 MB.
- Total `dist/assets/*` is comfortably under 5 MB.

---

## Out-of-scope reminders

- No per-channel volume sliders.
- No mute persistence across reloads.
- No procedural BGM.
- No per-difficulty BGM.
