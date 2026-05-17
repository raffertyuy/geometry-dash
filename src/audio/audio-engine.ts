import {
  AUDIO_BGM_URLS,
  AUDIO_MASTER_BASE_VOLUME,
} from '../shared/config';
import { playSfx, type SfxName } from './sfx-synth';

export type BgmTrack = 'default' | 'contest';

export interface AudioEngine {
  /** Fire-and-forget SFX trigger. No-ops silently before gesture unlock. */
  play(name: SfxName): void;
  /** Begin BGM playback. Idempotent for the same track. */
  startBgm(track?: BgmTrack): void;
  /** Switch BGM track (hard cut). No-op if already on the requested track. */
  setBgmTrack(track: BgmTrack): void;
  /** Suspend audio context (BGM + decaying SFX freeze). */
  pauseBgm(): void;
  /** Resume audio context — same track. */
  resumeBgm(): void;
  /** Stop BGM and dispose source. Next startBgm restarts from loop start. */
  stopBgm(): void;
  /** Master mute toggle. Mute = master gain to 0 (BGM keeps running underneath). */
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  /** Test-only: returns the currently active track or null. */
  getActiveTrack(): BgmTrack | null;
  /** Cleanup window-level latch listeners. */
  destroy(): void;
}

/** Factory used by tests to inject a stub AudioContext. */
export interface AudioEngineDeps {
  readonly createContext?: () => AudioContext;
  readonly fetchBgm?: (url: string) => Promise<ArrayBuffer>;
  readonly win?: Window;
}

export function createAudioEngine(deps: AudioEngineDeps = {}): AudioEngine {
  const win =
    deps.win ?? (typeof window === 'undefined' ? undefined : window);
  const createContext =
    deps.createContext ??
    (() => {
      const w = win as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) throw new Error('AudioContext unavailable');
      return new Ctor();
    });
  const fetchBgm =
    deps.fetchBgm ??
    ((url: string) => fetch(url).then((r) => r.arrayBuffer()));

  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  const bgmBuffers: Record<BgmTrack, AudioBuffer | null> = {
    default: null,
    contest: null,
  };
  let bgmSource: AudioBufferSourceNode | null = null;
  let activeTrack: BgmTrack | null = null;
  let muted = false;
  let unlocked = false;
  let destroyed = false;
  let unavailable = false;
  let pendingBgmStart: BgmTrack | null = null;

  function applyMuteGain(): void {
    if (!masterGain || !ctx) return;
    const target = muted ? 0 : AUDIO_MASTER_BASE_VOLUME;
    masterGain.gain.setValueAtTime(target, ctx.currentTime);
  }

  function loadBgm(track: BgmTrack): Promise<void> {
    const localCtx = ctx;
    if (!localCtx || !win) return Promise.resolve();
    return fetchBgm(AUDIO_BGM_URLS[track])
      .then((buf) => localCtx.decodeAudioData(buf))
      .then((decoded) => {
        bgmBuffers[track] = decoded;
        console.debug({
          event: 'audio_bgm_decoded',
          track,
          durationSec: decoded.duration,
        });
        // Event-driven start: if this track was queued (activeTrack === track
        // but no source yet because the buffer hadn't decoded), start it now.
        if (!destroyed && activeTrack === track && !bgmSource) {
          startBgmSource(track);
        }
      })
      .catch((err) => {
        console.debug({ event: 'audio_bgm_decode_failed', track, error: String(err) });
      });
  }

  function unlock(): void {
    if (unlocked || destroyed || unavailable) return;
    try {
      ctx = createContext();
      masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      applyMuteGain();
      unlocked = true;
      void loadBgm('default');
      void loadBgm('contest');
      console.debug({ event: 'audio_unlocked' });
      if (pendingBgmStart !== null) {
        const t = pendingBgmStart;
        pendingBgmStart = null;
        startBgm(t);
      }
    } catch (err) {
      unavailable = true;
      console.debug({ event: 'audio_context_unavailable', error: String(err) });
    }
    teardownLatch();
  }

  function onGesture(): void {
    unlock();
  }

  function teardownLatch(): void {
    if (!win) return;
    win.removeEventListener('pointerdown', onGesture, true);
    win.removeEventListener('keydown', onGesture, true);
  }

  if (win && !destroyed) {
    win.addEventListener('pointerdown', onGesture, true);
    win.addEventListener('keydown', onGesture, true);
  }

  function play(name: SfxName): void {
    if (!unlocked || !ctx || !masterGain || unavailable) {
      console.debug({ event: 'audio_sfx_skipped_locked', name });
      return;
    }
    try {
      playSfx(ctx, masterGain, name);
      console.debug({ event: 'audio_sfx_played', name });
    } catch (err) {
      console.debug({ event: 'audio_sfx_failed', name, error: String(err) });
    }
  }

  function startBgmSource(track: BgmTrack): void {
    if (!ctx || !masterGain) return;
    const buffer = bgmBuffers[track];
    if (!buffer) {
      // Buffer not decoded yet — wait. Re-attempt on the next call.
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(masterGain);
    source.start(0);
    bgmSource = source;
    activeTrack = track;
    console.debug({ event: 'audio_bgm_started', track });
  }

  function stopCurrentSource(): void {
    if (bgmSource) {
      try {
        bgmSource.stop();
      } catch {
        // Already stopped — fine.
      }
      bgmSource.disconnect();
      bgmSource = null;
    }
  }

  function startBgm(track: BgmTrack = 'default'): void {
    if (destroyed || unavailable) return;
    if (!unlocked) {
      pendingBgmStart = track;
      return;
    }
    if (activeTrack === track && bgmSource) return;
    stopCurrentSource();
    if (bgmBuffers[track]) {
      startBgmSource(track);
    } else {
      // Buffer still decoding — mark this as the desired track; loadBgm
      // will auto-start the source as soon as decoding completes.
      activeTrack = track;
    }
  }

  function setBgmTrack(track: BgmTrack): void {
    if (destroyed || unavailable) return;
    if (!unlocked) {
      pendingBgmStart = track;
      return;
    }
    if (activeTrack === track && bgmSource) return;
    const from = activeTrack;
    startBgm(track);
    console.debug({ event: 'audio_bgm_track_changed', from, to: track });
  }

  function pauseBgm(): void {
    if (!ctx || !unlocked || unavailable) return;
    if (ctx.state === 'running') {
      void ctx.suspend().then(() => {
        console.debug({ event: 'audio_bgm_paused', track: activeTrack });
      });
    }
  }

  function resumeBgm(): void {
    if (!ctx || !unlocked || unavailable) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        console.debug({ event: 'audio_bgm_resumed', track: activeTrack });
      });
    }
  }

  function stopBgm(): void {
    if (!unlocked || unavailable) return;
    stopCurrentSource();
    activeTrack = null;
    console.debug({ event: 'audio_bgm_stopped' });
  }

  function setMuted(next: boolean): void {
    if (muted === next) return;
    muted = next;
    applyMuteGain();
    console.debug({ event: 'audio_mute_toggled', muted });
  }

  function isMuted(): boolean {
    return muted;
  }

  function getActiveTrack(): BgmTrack | null {
    return activeTrack;
  }

  function destroy(): void {
    destroyed = true;
    teardownLatch();
    stopCurrentSource();
    if (ctx && ctx.state !== 'closed') {
      void ctx.close();
    }
    ctx = null;
    masterGain = null;
  }

  return {
    play,
    startBgm,
    setBgmTrack,
    pauseBgm,
    resumeBgm,
    stopBgm,
    setMuted,
    isMuted,
    getActiveTrack,
    destroy,
  };
}
