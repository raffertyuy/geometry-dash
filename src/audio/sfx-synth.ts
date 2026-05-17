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
 * Procedural SFX in a tron / synthwave palette. Each named sound is
 * synthesised on the fly from `OscillatorNode` + `GainNode` envelopes
 * (with the occasional white-noise burst). No asset files.
 *
 * Design language:
 *   - Sweeps and detuned dual-oscillators feel "neon".
 *   - Square + saw waveforms read as electronic / arcade.
 *   - Short noise bursts add transient bite for impacts.
 *   - Correct / wrong are stylised game-show cues.
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

function makeGain(
  ctx: AudioContext,
  destination: AudioNode,
  startAt: number,
  peak: number,
  attackS: number,
  holdS: number,
  releaseS: number,
): { gain: GainNode; endAt: number } {
  const gain = ctx.createGain();
  const releaseAt = startAt + attackS + holdS;
  const endAt = releaseAt + releaseS;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peak, startAt + attackS);
  gain.gain.setValueAtTime(peak, releaseAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
  gain.connect(destination);
  return { gain, endAt };
}

function makeNoiseBuffer(ctx: AudioContext, durationS: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sampleRate * durationS));
  const buf = ctx.createBuffer(1, len, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

// --------------------------------------------------------------------------
// 1. lane-change — tron lightcycle swoosh: short downward FM sweep w/ detune
function laneChange(ctx: AudioContext, destination: AudioNode): SfxPlayback {
  const startAt = ctx.currentTime;
  const durationS = 0.14;
  const env = makeGain(
    ctx,
    destination,
    startAt,
    AUDIO_SFX_BASE_VOLUME * 0.45,
    0.005,
    0.005,
    durationS - 0.01,
  );
  // Main sawtooth sweeping from 1400 Hz down to 500 Hz — feels like a "whoosh".
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(1400, startAt);
  osc.frequency.exponentialRampToValueAtTime(500, env.endAt);
  osc.connect(env.gain);
  // Detuned sub-oscillator one octave below for body.
  const sub = ctx.createOscillator();
  sub.type = 'triangle';
  sub.frequency.setValueAtTime(700, startAt);
  sub.frequency.exponentialRampToValueAtTime(250, env.endAt);
  sub.detune.setValueAtTime(-12, startAt);
  sub.connect(env.gain);
  osc.start(startAt);
  sub.start(startAt);
  osc.stop(env.endAt);
  sub.stop(env.endAt);
  return { source: [osc, sub], durationMs: durationS * 1000 };
}

// --------------------------------------------------------------------------
// 2. obstacle-hit — sharp electric crash: noise burst + low square thump
function obstacleHit(ctx: AudioContext, destination: AudioNode): SfxPlayback {
  const startAt = ctx.currentTime;
  const durationS = 0.32;
  const sources: AudioScheduledSourceNode[] = [];
  // Noise transient (white noise, very short).
  const noiseEnv = makeGain(
    ctx,
    destination,
    startAt,
    AUDIO_SFX_BASE_VOLUME * 0.65,
    0.002,
    0.0,
    0.08,
  );
  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, 0.1);
  noise.connect(noiseEnv.gain);
  noise.start(startAt);
  noise.stop(noiseEnv.endAt);
  sources.push(noise);
  // Sub-bass thump (square pitching down 180 → 40 Hz).
  const thumpEnv = makeGain(
    ctx,
    destination,
    startAt,
    AUDIO_SFX_BASE_VOLUME * 1.0,
    0.005,
    0.01,
    durationS - 0.015,
  );
  const thump = ctx.createOscillator();
  thump.type = 'square';
  thump.frequency.setValueAtTime(180, startAt);
  thump.frequency.exponentialRampToValueAtTime(40, thumpEnv.endAt);
  thump.connect(thumpEnv.gain);
  thump.start(startAt);
  thump.stop(thumpEnv.endAt);
  sources.push(thump);
  return { source: sources, durationMs: durationS * 1000 };
}

// --------------------------------------------------------------------------
// 3. gate-hit — tron warp gate: upward FM sweep with detuned dual osc
function gateHit(ctx: AudioContext, destination: AudioNode): SfxPlayback {
  const startAt = ctx.currentTime;
  const durationS = 0.28;
  const env = makeGain(
    ctx,
    destination,
    startAt,
    AUDIO_SFX_BASE_VOLUME * 0.55,
    0.005,
    0.05,
    durationS - 0.055,
  );
  // Upward sweep — entering the gate.
  const osc1 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(440, startAt);
  osc1.frequency.exponentialRampToValueAtTime(1320, startAt + 0.12);
  osc1.connect(env.gain);
  // Detuned partner for chorus.
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(660, startAt);
  osc2.frequency.exponentialRampToValueAtTime(1980, startAt + 0.12);
  osc2.detune.setValueAtTime(12, startAt);
  osc2.connect(env.gain);
  osc1.start(startAt);
  osc2.start(startAt);
  osc1.stop(env.endAt);
  osc2.stop(env.endAt);
  return { source: [osc1, osc2], durationMs: durationS * 1000 };
}

// --------------------------------------------------------------------------
// 4. correct-answer — game-show "ding ding ding": three bright bell tones
function correctAnswer(ctx: AudioContext, destination: AudioNode): SfxPlayback {
  // Three short bell strikes in quick succession at game-show pitch.
  // Each strike = a triangle + a higher sine for the ring, with a fast
  // attack and a long-ish exponential tail.
  const notes = [880, 1175, 1568]; // A5, D6, G6 — bright and major.
  const noteSpacingS = 0.13;
  const ringS = 0.45;
  const sources: AudioScheduledSourceNode[] = [];
  const startAt = ctx.currentTime;
  for (let i = 0; i < notes.length; i++) {
    const noteStart = startAt + i * noteSpacingS;
    const env = makeGain(
      ctx,
      destination,
      noteStart,
      AUDIO_SFX_BASE_VOLUME * 0.6,
      0.004,
      0.0,
      ringS,
    );
    // Body
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(notes[i]!, noteStart);
    body.connect(env.gain);
    // Bright ring an octave above
    const ring = ctx.createOscillator();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(notes[i]! * 2, noteStart);
    ring.connect(env.gain);
    body.start(noteStart);
    ring.start(noteStart);
    body.stop(env.endAt);
    ring.stop(env.endAt);
    sources.push(body, ring);
  }
  return {
    source: sources,
    durationMs: (noteSpacingS * (notes.length - 1) + ringS) * 1000,
  };
}

// --------------------------------------------------------------------------
// 5. life-lost — game-show wrong-answer buzz: harsh square at low pitch
function lifeLost(ctx: AudioContext, destination: AudioNode): SfxPlayback {
  const startAt = ctx.currentTime;
  const durationS = 0.55;
  const env = makeGain(
    ctx,
    destination,
    startAt,
    AUDIO_SFX_BASE_VOLUME * 0.7,
    0.005,
    0.35,
    durationS - 0.355,
  );
  // Main square at ~120 Hz — that classic "WRONG" buzzer feel.
  const buzz = ctx.createOscillator();
  buzz.type = 'square';
  buzz.frequency.setValueAtTime(130, startAt);
  buzz.connect(env.gain);
  // Slight vibrato via a detune LFO would be nicer, but a static
  // detuned partner reads close enough at this length.
  const partner = ctx.createOscillator();
  partner.type = 'sawtooth';
  partner.frequency.setValueAtTime(130, startAt);
  partner.detune.setValueAtTime(15, startAt);
  partner.connect(env.gain);
  buzz.start(startAt);
  partner.start(startAt);
  buzz.stop(env.endAt);
  partner.stop(env.endAt);
  return { source: [buzz, partner], durationMs: durationS * 1000 };
}

// --------------------------------------------------------------------------
// 6. game-over — synth doom: descending bass arp + noise wash
function gameOver(ctx: AudioContext, destination: AudioNode): SfxPlayback {
  // Descending notes A3 → F3 → D3 → A2 — each a square+saw layer.
  const notes = [220, 174.61, 146.83, 110];
  const noteSpacingS = 0.32;
  const ringS = 0.55;
  const sources: AudioScheduledSourceNode[] = [];
  const startAt = ctx.currentTime;
  for (let i = 0; i < notes.length; i++) {
    const noteStart = startAt + i * noteSpacingS;
    const env = makeGain(
      ctx,
      destination,
      noteStart,
      AUDIO_SFX_BASE_VOLUME * 0.55,
      0.01,
      0.04,
      ringS,
    );
    const sq = ctx.createOscillator();
    sq.type = 'square';
    sq.frequency.setValueAtTime(notes[i]!, noteStart);
    sq.connect(env.gain);
    const sw = ctx.createOscillator();
    sw.type = 'sawtooth';
    sw.frequency.setValueAtTime(notes[i]!, noteStart);
    sw.detune.setValueAtTime(-8, noteStart);
    sw.connect(env.gain);
    sq.start(noteStart);
    sw.start(noteStart);
    sq.stop(env.endAt);
    sw.stop(env.endAt);
    sources.push(sq, sw);
  }
  // Background noise wash over the whole arpeggio.
  const totalS = noteSpacingS * notes.length + ringS;
  const washEnv = makeGain(
    ctx,
    destination,
    startAt,
    AUDIO_SFX_BASE_VOLUME * 0.2,
    0.1,
    totalS - 0.4,
    0.3,
  );
  const wash = ctx.createBufferSource();
  wash.buffer = makeNoiseBuffer(ctx, totalS);
  wash.connect(washEnv.gain);
  wash.start(startAt);
  wash.stop(washEnv.endAt);
  sources.push(wash);
  return { source: sources, durationMs: totalS * 1000 };
}

// --------------------------------------------------------------------------
// 7. countdown-tick — aggressive arcade tick: short square click w/ harmonics
function countdownTick(ctx: AudioContext, destination: AudioNode): SfxPlayback {
  const startAt = ctx.currentTime;
  const durationS = 0.055;
  const env = makeGain(
    ctx,
    destination,
    startAt,
    AUDIO_SFX_BASE_VOLUME * 0.42,
    0.002,
    0.0,
    durationS - 0.002,
  );
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(2000, startAt);
  osc.connect(env.gain);
  // Higher harmonic for bite.
  const harm = ctx.createOscillator();
  harm.type = 'triangle';
  harm.frequency.setValueAtTime(3200, startAt);
  harm.connect(env.gain);
  osc.start(startAt);
  harm.start(startAt);
  osc.stop(env.endAt);
  harm.stop(env.endAt);
  return { source: [osc, harm], durationMs: durationS * 1000 };
}
