# Audio assets

Two looping BGM tracks served as static assets.

| File | Plays when | Source |
|------|-----------|--------|
| `bgm-default.opus` | Run is actively running, no problem-gate modal open | "Techno House (PSG version)" by Snabisch (CC BY 3.0) |
| `bgm-contest.opus` | Problem-gate modal is open | "Battle Theme" by Wolfgang_ / Theodore Kerr (CC0) |

Both tracks are credited in the repo-root `LICENSES.md`.

## Encoding

- Sourced from OpenGameArt.org.
- Default: full 59 s loop, re-encoded from MP3 to mono Opus ~56 kbps (CBR) — 419 KB.
- Contest: trimmed to the first 45 s and re-encoded from MP3 to mono Opus ~80 kbps — 456 KB.
- Both within the project's per-file 500 KB BGM budget; combined 875 KB (under the 1 MB combined BGM budget).

## Replacing the tracks

The audio engine is content-agnostic — drop in any file at the same paths with a supported format (Opus, OGG Vorbis, MP3, AAC) and no code changes are needed. If you replace these tracks, update the attribution in `LICENSES.md` and this README accordingly.

## SFX

There are no SFX asset files. All seven sound effects (lane change, obstacle hit, gate hit, correct answer, life lost, game over, countdown tick) are synthesised procedurally at runtime by `src/audio/sfx-synth.ts`.
