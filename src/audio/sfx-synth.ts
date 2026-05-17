import { AUDIO_SFX_BASE_VOLUME } from '../shared/config';

export type SfxName =
  | 'lane-change'
  | 'obstacle-hit'
  | 'gate-hit'
  | 'correct-answer'
  | 'life-lost'
  | 'game-over'
  | 'countdown-tick';

export interface SfxPlayback {
  readonly source: AudioScheduledSourceNode | readonly AudioScheduledSourceNode[];
  readonly durationMs: number;
}

/**
 * Procedural SFX. Each named sound is synthesised on the fly from
 * OscillatorNodes + GainNode envelopes. No asset files. Returns the
 * playback handles so callers can clean up if needed; Web Audio also
 * GCs nodes after `stop()` fires.
 */
export function playSfx(
  ctx: AudioContext,
  destination: AudioNode,
  name: SfxName,
): SfxPlayback {
  switch (name) {
    case 'lane-change':
      return laneChange(ctx, destination);
    case 'obstacle-hit':
      return obstacleHit(ctx, destination);
    case 'gate-hit':
      return gateHit(ctx, destination);
    case 'correct-answer':
      return correctAnswer(ctx, destination);
    case 'life-lost':
      return lifeLost(ctx, destination);
    case 'game-over':
      return gameOver(ctx, destination);
    case 'countdown-tick':
      return countdownTick(ctx, destination);
  }
}

function envelope(
  ctx: AudioContext,
  destination: AudioNode,
  peakVolume: number,
  attackMs: number,
  releaseMs: number,
): { gain: GainNode; startAt: number; releaseAt: number; endAt: number } {
  const gain = ctx.createGain();
  const startAt = ctx.currentTime;
  const releaseAt = startAt + attackMs / 1000;
  const endAt = releaseAt + releaseMs / 1000;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peakVolume, releaseAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
  gain.connect(destination);
  return { gain, startAt, releaseAt, endAt };
}

function laneChange(ctx: AudioContext, destination: AudioNode): SfxPlayback {
  const env = envelope(ctx, destination, AUDIO_SFX_BASE_VOLUME * 0.5, 10, 70);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(800, env.startAt);
  osc.frequency.exponentialRampToValueAtTime(1200, env.endAt);
  osc.connect(env.gain);
  osc.start(env.startAt);
  osc.stop(env.endAt);
  return { source: osc, durationMs: 80 };
}

function obstacleHit(ctx: AudioContext, destination: AudioNode): SfxPlayback {
  const env = envelope(ctx, destination, AUDIO_SFX_BASE_VOLUME * 0.95, 5, 240);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(120, env.startAt);
  osc.frequency.exponentialRampToValueAtTime(50, env.endAt);
  osc.connect(env.gain);
  osc.start(env.startAt);
  osc.stop(env.endAt);
  return { source: osc, durationMs: 250 };
}

function gateHit(ctx: AudioContext, destination: AudioNode): SfxPlayback {
  const env = envelope(ctx, destination, AUDIO_SFX_BASE_VOLUME * 0.6, 4, 200);
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, env.startAt);
  osc1.connect(env.gain);
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1320, env.startAt);
  osc2.detune.setValueAtTime(8, env.startAt);
  osc2.connect(env.gain);
  osc1.start(env.startAt);
  osc2.start(env.startAt);
  osc1.stop(env.endAt);
  osc2.stop(env.endAt);
  return { source: [osc1, osc2], durationMs: 200 };
}

function correctAnswer(ctx: AudioContext, destination: AudioNode): SfxPlayback {
  // Ascending C5 major triad arpeggio: C5 (523) → E5 (659) → G5 (784).
  const notes = [523.25, 659.25, 783.99];
  const noteMs = 120;
  const sources: AudioScheduledSourceNode[] = [];
  const startAt = ctx.currentTime;
  for (let i = 0; i < notes.length; i++) {
    const noteStart = startAt + (i * noteMs) / 1000;
    const gain = ctx.createGain();
    const noteEnd = noteStart + noteMs / 1000;
    gain.gain.setValueAtTime(0, noteStart);
    gain.gain.linearRampToValueAtTime(AUDIO_SFX_BASE_VOLUME * 0.55, noteStart + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    gain.connect(destination);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(notes[i]!, noteStart);
    osc.connect(gain);
    osc.start(noteStart);
    osc.stop(noteEnd);
    sources.push(osc);
  }
  return { source: sources, durationMs: noteMs * notes.length };
}

function lifeLost(ctx: AudioContext, destination: AudioNode): SfxPlayback {
  const env = envelope(ctx, destination, AUDIO_SFX_BASE_VOLUME * 0.7, 6, 340);
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(660, env.startAt);
  osc.frequency.exponentialRampToValueAtTime(220, env.endAt);
  osc.connect(env.gain);
  osc.start(env.startAt);
  osc.stop(env.endAt);
  return { source: osc, durationMs: 350 };
}

function gameOver(ctx: AudioContext, destination: AudioNode): SfxPlayback {
  // Descending minor third arpeggio: E5 → C5 → A4 → F4. Each ~250 ms.
  const notes = [659.25, 523.25, 440.0, 349.23];
  const noteMs = 250;
  const sources: AudioScheduledSourceNode[] = [];
  const startAt = ctx.currentTime;
  for (let i = 0; i < notes.length; i++) {
    const noteStart = startAt + (i * noteMs) / 1000;
    const gain = ctx.createGain();
    const noteEnd = noteStart + (noteMs + 80) / 1000; // small reverb-like tail
    gain.gain.setValueAtTime(0, noteStart);
    gain.gain.linearRampToValueAtTime(AUDIO_SFX_BASE_VOLUME * 0.7, noteStart + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    gain.connect(destination);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(notes[i]!, noteStart);
    osc.connect(gain);
    osc.start(noteStart);
    osc.stop(noteEnd);
    sources.push(osc);
  }
  return { source: sources, durationMs: noteMs * notes.length + 80 };
}

function countdownTick(ctx: AudioContext, destination: AudioNode): SfxPlayback {
  const env = envelope(ctx, destination, AUDIO_SFX_BASE_VOLUME * 0.35, 2, 35);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1500, env.startAt);
  osc.connect(env.gain);
  osc.start(env.startAt);
  osc.stop(env.endAt);
  return { source: osc, durationMs: 40 };
}
