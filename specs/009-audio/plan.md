# Implementation Plan: Audio (Background Music + Sound Effects)

**Branch**: `009-audio` | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-audio/spec.md`

## Summary

Introduce a single audio subsystem (`src/audio/`) that owns a Web Audio API context, generates **all SFX procedurally with `OscillatorNode` + `GainNode` envelopes** (no SFX asset files), and plays a single small looping BGM file. A new HUD mute button + keyboard shortcut `M` toggle a master gain. The engine respects mobile autoplay restrictions by deferring `AudioContext` creation / resume until the first user gesture. The game-loop and problem-modal each gain thin "fire-and-forget" calls into the engine at the six event points (lane change, obstacle hit, gate hit, correct answer, life lost, game over) plus the per-second tick in the modal's countdown urgency band.

Why procedural for SFX:

- Zero asset bytes — fits the 5 MB total budget with room to spare.
- Zero licensing concerns — no CC-BY attribution work, no source curation.
- Tron-style synth sounds are *idiomatic* for this game's aesthetic, not a compromise.
- Web Audio is universally supported in evergreen browsers (constitution platform constraint).

For BGM, procedural is too ambitious for one slice. **Two** short (~30 s) loopable tracks sourced under CC0 / CC-BY 4.0 are dropped into `public/audio/` and loaded lazily via `fetch + decodeAudioData` on first user gesture:

- **default BGM** — calm tron-style ambient, plays during active running.
- **contest BGM** — math-contest / battle-of-the-brains style: tense, ticking, quiz-show vibe; plays while a problem-gate modal is open.

Track switching is implemented as a hard-cut (stop old source, start new source) — no crossfading needed for an arcade game. Target file size: ≤ 500 KB each, ≤ 1 MB combined. Both files lazy-loaded on first gesture; the contest track starts decoding immediately so it's ready before the first gate hit.

## Technical Context

**Language/Version**: TypeScript 5.6, ES2022 target, strict mode (unchanged).

**Primary Dependencies**: Three.js 0.184 (untouched), Vite 6 (build), Vitest 2 + jsdom 25 (tests). **No new runtime dependencies.** Web Audio API is a browser built-in.

**Storage**: N/A. Mute is in-memory (FR-008 explicitly forbids persistence beyond the session).

**Testing**: Vitest unit tests against a hand-rolled `AudioContext` mock (jsdom does not provide Web Audio). Tests focus on engine state transitions (gesture latch, mute toggle, pause / resume gating) and on the call sites that fire each SFX. We do NOT test that an actual audio waveform is produced — that's a manual-smoke concern.

**Target Platform**: Static web app, evergreen browsers (Chrome / Firefox / Safari / Edge), mobile-first (iOS Safari + Android Chrome from 320 px).

**Project Type**: Single static web project.

**Performance Goals**: Audio engine runs on the browser's audio thread — no impact on the 60 FPS render budget. Per-event SFX construction is O(1), allocations are isolated to the OscillatorNode + GainNode that the engine creates, plays, and lets the GC collect after the envelope ends (~500 ms per SFX). No per-frame allocations introduced.

**Constraints**: Total audio asset weight ≤ 5 MB; each BGM file ≤ 500 KB (≤ 1 MB combined); bundle code delta ≤ 5 KB gzipped (the engine itself is small). No new dependencies.

**Scale/Scope**: One AudioContext per page, two BGM sources (active one at a time), six distinct SFX synthesisers, one mute toggle, one tick-emitter integrated into the existing modal countdown. Estimate ~280 net LOC including tests.

## Constitution Check

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. Simplicity & YAGNI | **PASS** | No new dependency. Procedural SFX eliminates an entire asset-management surface that would otherwise need to exist. One module (`src/audio/`), one public entrypoint (`createAudioEngine`), one HUD adapter (`mute-button.ts`). Per-event API surface is a single method `play('lane-change' \| 'obstacle-hit' \| …)` — no per-SFX wrappers. |
| II. Test-First Discipline | **PASS** | Engine state transitions (gesture latch, mute, pause / resume) are pure-logic and headlessly testable against a stubbed AudioContext. Tests authored alongside implementation in each user-story phase. Audio output itself is not tested (out of scope for automated suite). |
| III. Library-First / Modular | **PASS** | New module `src/audio/` with one public entrypoint `createAudioEngine` and one exported type `AudioEngine`. The mute-button HUD adapter `src/renderer/mute-button.ts` is the only place the engine connects to DOM. Game-loop and problem-modal both depend on `AudioEngine` (an interface) rather than the concrete engine. |
| IV. Observability & Debuggability | **PASS** | New `console.debug` events: `audio_unlocked`, `audio_bgm_started`, `audio_bgm_paused`, `audio_bgm_resumed`, `audio_bgm_stopped`, `audio_sfx_played` (with `name`), `audio_mute_toggled`, `audio_context_unavailable`. No debug overlay extension needed (audio state is audible). |
| Platform & Tech Stack | **PASS** | Web Audio API is a built-in in every evergreen browser. The single BGM file is served as a static asset from `public/audio/` (Vite handles the rest). Touch + keyboard + click for the mute button. Mobile autoplay compliance via the gesture latch. |
| Performance Budget | **PASS** | Audio thread is separate from the render thread. Per-SFX cost: one OscillatorNode + one GainNode allocation per event. Per BGM playback: one AudioBufferSourceNode + one GainNode for the master + one for BGM. No per-frame allocations. |
| Accessibility & Input | **PASS** | Mute button has a clear icon swap (🔊 ↔ 🔇), an explicit `aria-label` and `aria-pressed`, and a keyboard shortcut `M`. Audio is supplementary; the existing visual cues (urgency text "Hurry!", lives HUD, correct-answer highlight, score badges) carry meaning on their own. No information is conveyed by audio alone. |

No constitution violations. **Complexity Tracking section omitted.**

## Project Structure

### Documentation

```text
specs/009-audio/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── module-contracts.md
└── tasks.md
```

### Source Code

```text
src/
├── audio/
│   ├── audio-engine.ts          # NEW: AudioContext owner, gesture latch, BGM playback, master gain
│   ├── audio-engine.test.ts     # NEW: state-machine tests against a mock AudioContext
│   ├── sfx-synth.ts             # NEW: pure procedural SFX generators (one function per SFX name)
│   ├── sfx-synth.test.ts        # NEW: each SFX returns a non-null { source, gain } pair
│   └── index.ts                 # NEW: re-exports createAudioEngine, type AudioEngine
├── renderer/
│   ├── mute-button.ts           # NEW: HUD adapter, very similar shape to pause-button.ts
│   ├── mute-button.test.ts      # NEW: state matrix (muted / un-muted, click + keyboard 'M')
│   └── index.ts                 # MODIFIED: export createMuteButton + type MuteButton
├── game/
│   └── game-loop.ts             # MODIFIED: construct engine; route 6 SFX events; pause / resume BGM with run state
├── input-adapter/
│   └── input-adapter.ts         # MODIFIED: emit a 'lane-change' callback for the audio engine on successful direction input
└── renderer/
    └── problem-modal.ts          # MODIFIED: fire countdown tick on each whole-second transition while remaining ≤ urgency threshold

public/
└── audio/
    ├── bgm-default.opus          # NEW: ≤ 500 KB CC0/CC-BY loopable ambient track (default; plays during running)
    └── bgm-contest.opus          # NEW: ≤ 500 KB CC0/CC-BY loopable math-contest theme (plays while gate modal is open)

index.html                         # MODIFIED: add the #mute-button element next to the existing HUD
src/main.ts                        # MODIFIED: pass the new #mute-button host through GameLoopHostElements
README.md                          # MODIFIED: one-line entry in "What's in it (so far)"
LICENSES.md                        # MODIFIED: append the BGM asset's licence + attribution
```

**Structure Decision**: A new `src/audio/` module hosts all engine + synth logic (Principle III: one entrypoint, isolated tests). The mute button is a renderer adapter that mirrors the shape of the existing `pause-button.ts` for consistency. Game-loop and problem-modal each get a small wiring change; the input adapter exposes one new optional callback so the lane-change SFX fires at the same single source of truth that drives the actual lane movement.

## Phase 0: Outline & Research — Pointer

See [research.md](./research.md) for: procedural-vs-sourced SFX decision, BGM source candidates, gesture-unlock approach, mute-as-master-gain rationale, lane-change wiring choice, and rejected alternatives.

## Phase 1: Design & Contracts — Pointer

- [data-model.md](./data-model.md) — `SfxName` enum, internal `AudioEngineState`, mute-button state matrix.
- [contracts/module-contracts.md](./contracts/module-contracts.md) — Public surfaces for `createAudioEngine` and `createMuteButton`; `GameLoopHostElements` updates; problem-modal + input-adapter integration points.
- [quickstart.md](./quickstart.md) — Manual + automated validation steps specific to this slice.

## Constitution Re-Check (post-design)

Re-evaluated after Phase 1. The design introduces one new module + one renderer adapter + one asset file + zero new dependencies. Mute is a master-gain switch (not a stop) so un-muting doesn't need another user gesture. Audio failures degrade silently with one debug warning. All gates still **PASS**.
