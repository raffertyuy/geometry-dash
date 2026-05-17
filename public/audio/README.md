# Audio assets

Two looping BGM tracks served as static assets.

| File | Plays when | Style |
|------|-----------|-------|
| `bgm-default.opus` | Run is actively running, no problem-gate modal open | Calm tron-ambient |
| `bgm-contest.opus` | Problem-gate modal is open | Tense math-contest / battle-of-the-brains |

## Status

**Placeholders.** The current files are `ffmpeg`-generated synth loops committed so the audio engine has something to decode during development.

- `bgm-default.opus` — 24 s loop: 120-BPM bass kick + low-pass synth bass + a vibrato-modulated lead. Aims for a tron-racing techno feel.
- `bgm-contest.opus` — 20 s loop: 4 Hz ticking percussion + a swung-arpeggio carrier + low pulse bass + a high vibrato lead. Aims for a futuristic quiz-show / "you're under pressure" feel.

They are NOT the final tracks.

## Sourcing the real tracks

Per `specs/009-audio/research.md` §R2:

- Must be CC0 OR CC-BY 4.0.
- Each file ≤ 500 KB compressed (Opus or AAC).
- Default = calm tron-arcade ambient; slow synth pad with gentle pulse.
- Contest = quiz-show / brain-battle vibe; ticking percussion, brisk arpeggio. **Do not** copy a branded piece (e.g. Are You Smarter Than a 5th Grader / Battle of the Brains theme) — source a CC0 / CC-BY 4.0 alternative that *evokes* the genre.
- If CC-BY 4.0, add the attribution to `LICENSES.md`.

The engine's API is content-agnostic — replacing these files needs no code change.
