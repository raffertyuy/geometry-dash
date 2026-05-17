# Audio assets

Two looping BGM tracks served as static assets.

| File | Plays when | Source |
|------|-----------|--------|
| `bgm-default.opus` | Run is actively running, no problem-gate modal open | "Techno DRIVE!!!" by Centurion_of_war (CC BY 4.0) |
| `bgm-contest.opus` | Problem-gate modal is open | "Tension" by Tsorthan Grove (CC BY 4.0) |

Both tracks are licensed under **Creative Commons Attribution 4.0 International** (CC BY 4.0) and are credited in the repo-root `LICENSES.md`.

## Encoding

- Sourced from OpenGameArt.org.
- Trimmed (default: 30 s, contest: 40 s) and re-encoded to mono Opus ~80 kbps to fit the project's per-file 500 KB BGM budget.
- The contest source is labelled `tension_loop` by its author — the trimmed window may not loop perfectly seam-to-seam; if the loop boundary is audible enough to be distracting, re-encode a different segment or use the full 77-second loop at ~48 kbps.

## Replacing the tracks

The audio engine is content-agnostic — drop in any file at the same paths with a supported format (Opus, OGG Vorbis, MP3, AAC) and no code changes are needed. If you replace these tracks, update the attribution in `LICENSES.md` and this README accordingly.

## SFX

There are no SFX asset files. All seven sound effects (lane change, obstacle hit, gate hit, correct answer, life lost, game over, countdown tick) are synthesised procedurally at runtime by `src/audio/sfx-synth.ts`.
