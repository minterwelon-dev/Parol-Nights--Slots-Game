import Phaser from 'phaser';
import { SFX, type SfxKey } from '../assets';
import { STORAGE_KEYS } from '../utils/storage';

const MUTE_KEY = STORAGE_KEYS.muted;
const VOLUME: Record<SfxKey, number> = {
  spin: 0.45,
  stop: 0.6,
  click: 0.5,
  coin: 0.6,
  win: 0.7,
  bigwin: 0.8,
  feature: 0.7,
  tease: 0.5,
};

/**
 * Audio gating and playback. Silent until the first user gesture (no autoplay), mute toggle
 * remembered per viewer, and muted + AudioContext suspended while the tab is hidden.
 * Sounds are created once after the deferred load and replayed, never allocated per play.
 */
export class SoundManager {
  private scene: Phaser.Scene;
  private sounds: Partial<Record<SfxKey, Phaser.Sound.BaseSound>> = {};
  private unlocked = false;
  private muted: boolean;
  private onVisibility = () => this.apply();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.muted = readMuted();
    scene.sound.mute = true;
    // capture phase on window: runs before Phaser handles the same press, so the first spin
    // is already audible. A key press is also a gesture browsers accept for audio.
    const unlock = () => {
      this.unlocked = true;
      this.apply();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    // Phaser's WebAudio manager calls onFocus() (context.resume) every step unless the window
    // blurred, which would undo our suspend on a hidden tab. Allow it only when we'd be audible.
    const sm = scene.sound as unknown as { onFocus?: () => void }; // not in the typings
    if (sm.onFocus) {
      const phaserFocus = sm.onFocus.bind(sm);
      sm.onFocus = () => {
        if (this.unlocked && !document.hidden) phaserFocus();
      };
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unlock();
      document.removeEventListener('visibilitychange', this.onVisibility);
    });
  }

  get isMuted() {
    return this.muted;
  }

  /** Create the pooled sounds once the deferred audio is in the cache. */
  init() {
    for (const key in SFX) {
      const k = key as SfxKey;
      if (this.scene.cache.audio.exists(k))
        this.sounds[k] = this.scene.sound.add(k, { volume: VOLUME[k] });
    }
  }

  play(key: SfxKey) {
    if (!this.unlocked || this.muted || document.hidden) return;
    this.sounds[key]?.play(); // restarts if already playing
  }

  stop(key: SfxKey) {
    this.sounds[key]?.stop();
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // storage blocked: the toggle still works for this session
    }
    this.apply();
    return this.muted;
  }

  /** Single place that decides whether anything is audible. */
  private apply() {
    const silent = !this.unlocked || this.muted || document.hidden;
    this.scene.sound.mute = silent;
    const ctx = (this.scene.sound as Partial<Phaser.Sound.WebAudioSoundManager>).context;
    if (!ctx) return; // HTML5 audio fallback: mute alone covers it
    if (document.hidden) void ctx.suspend();
    else if (this.unlocked && ctx.state === 'suspended') void ctx.resume();
  }
}

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
