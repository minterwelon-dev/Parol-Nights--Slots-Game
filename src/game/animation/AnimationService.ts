import Phaser from 'phaser';
import { gameConfig } from '../../gameConfig';
import { AnimationHandle } from './AnimationHandle';
import { FxPool } from './FxPool';
import { STORAGE_KEYS } from '../../utils/storage';

const A = gameConfig.anim;

/** Animation events (spec section 12). Audio and UI listen on scene.events; animation never plays sound. */
export const ANIM_EVENTS = {
  spinStart: 'spinStart',
  reelLanded: 'reelLanded',
  anticipationStart: 'anticipationStart',
  anticipationEnd: 'anticipationEnd',
  lineShown: 'lineShown',
  winPop: 'winPop',
  countUpStart: 'countUpStart',
  countUpEnd: 'countUpEnd',
  bigWinStart: 'bigWinStart',
  bigWinEnd: 'bigWinEnd',
  featureIntro: 'featureIntro',
  multiplierTick: 'multiplierTick',
  coinLocked: 'coinLocked',
  respinReset: 'respinReset',
  jackpotReveal: 'jackpotReveal',
  featureSummary: 'featureSummary',
} as const;
export type AnimEvent = (typeof ANIM_EVENTS)[keyof typeof ANIM_EVENTS];

type TweenConfig = Phaser.Types.Tweens.TweenBuilderConfig;
interface Ends {
  /** end state applied by finish() */
  final?: () => void;
  /** neutral state applied by cancel() */
  neutral?: () => void;
}

/**
 * Facade every game/ module animates through: speed factor (turbo), reduced motion, cancellable
 * handles, comfort limits for shake and flash. Hidden tabs need nothing here: Phaser pauses its
 * loop (and so every tween) while the page is hidden.
 */
export class AnimationService {
  private turbo = false;
  /** null = follow the OS setting */
  private reducedSetting: boolean | null = null;
  private lastFlash = -Infinity;
  private pool?: FxPool;
  private fxUsed = 0;
  /** read live, so an OS change applies to the next animation */
  private readonly media = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  constructor(private scene: Phaser.Scene) {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.motion);
      if (saved === '1' || saved === '0') this.reducedSetting = saved === '1';
    } catch {
      // blocked storage: follow the OS setting
    }
  }

  get reduced() {
    return this.reducedSetting ?? !!this.media?.matches;
  }

  /** Player toggle; null goes back to the OS preference. Remembered per viewer. */
  setReducedMotion(on: boolean | null) {
    this.reducedSetting = on;
    try {
      if (on === null) localStorage.removeItem(STORAGE_KEYS.motion);
      else localStorage.setItem(STORAGE_KEYS.motion, on ? '1' : '0');
    } catch {
      // blocked storage: the choice lasts for this session only
    }
  }

  /** HUD toggle: flip the effective setting; returns the new reduced state. */
  toggleReduced() {
    this.setReducedMotion(!this.reduced);
    return this.reduced;
  }

  setTurbo(on: boolean) {
    this.turbo = on;
  }

  get isTurbo() {
    return this.turbo;
  }

  /** Spin, stop, line and count-up durations; ambient motion uses its raw values. */
  dur(ms: number) {
    return Math.round(this.turbo ? ms * A.turboFactor : ms);
  }

  /** Particle count for a burst, after turbo; at least 1. */
  count(n: number) {
    return Math.max(1, Math.round(this.turbo ? n * A.turboParticles : n));
  }

  /** Active particle cap for this device. */
  get particleCap() {
    return this.scene.sys.game.device.os.desktop ? A.particles.maxActive : A.particles.mobileMax;
  }

  /** Claim one of the post-FX slots (spec section 11); false = budget used up, skip the effect. */
  acquireFx() {
    if (this.fxUsed >= A.postFxMax) return false;
    this.fxUsed++;
    return true;
  }

  releaseFx() {
    this.fxUsed = Math.max(0, this.fxUsed - 1);
  }

  /** Post-FX objects active now (dev budget check). */
  get fxActive() {
    return this.fxUsed;
  }

  /** Shared pooled effects, created on first use (after the boot textures exist). */
  get fx() {
    return (this.pool ??= new FxPool(this.scene, this.particleCap));
  }

  emit(event: AnimEvent, ...args: unknown[]) {
    this.scene.events.emit(event, ...args);
  }

  /** One tween as a handle. Durations are taken as given: pass dur(ms) where turbo applies. */
  tween(config: TweenConfig, ends: Ends = {}) {
    const h = new AnimationHandle();
    const onComplete = config.onComplete;
    const t = this.scene.tweens.add({
      ...config,
      onComplete: (tw, targets, ...rest) => {
        onComplete?.(tw, targets, ...rest);
        h.complete();
      },
    });
    return h.add(t, ends.final, ends.neutral);
  }

  /** from -> to over ms; finish() lands on `to`. */
  counter(
    from: number,
    to: number,
    ms: number,
    onUpdate: (v: number) => void,
    ease = 'Cubic.easeOut',
  ) {
    const h = new AnimationHandle();
    if (ms <= 0) {
      onUpdate(to);
      h.complete();
      return h;
    }
    const t = this.scene.tweens.addCounter({
      from,
      to,
      duration: ms,
      ease,
      onUpdate: (tw) => onUpdate(tw.getValue() ?? to),
      onComplete: () => h.complete(),
    });
    return h.add(
      t,
      () => onUpdate(to),
      () => onUpdate(from),
    );
  }

  delay(ms: number) {
    const h = new AnimationHandle();
    if (ms <= 0) {
      h.complete();
      return h;
    }
    const timer = this.scene.time.delayedCall(ms, () => h.complete());
    return h.add({ stop: () => timer.remove(false) });
  }

  /** Camera shake within the comfort cap; skipped in reduced motion or while one runs. */
  shake(ms: number, intensity: number) {
    const cam = this.scene.cameras.main;
    if (this.reduced || cam.shakeEffect.isRunning) return;
    cam.shake(Math.min(ms, A.shake.maxMs), Math.min(intensity, A.shake.maxIntensity));
  }

  /** Full-screen flash at most once per flash.minGapMs; skipped in reduced motion. */
  flash(ms: number, color = 0xffffff) {
    const now = this.scene.time.now;
    if (this.reduced || now - this.lastFlash < A.flash.minGapMs) return;
    this.lastFlash = now;
    this.scene.cameras.main.flash(ms, (color >> 16) & 255, (color >> 8) & 255, color & 255);
  }
}
