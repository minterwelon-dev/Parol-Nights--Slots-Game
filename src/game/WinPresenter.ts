import Phaser from 'phaser';
import { DEPTH, HUD_LAYOUT, POD, THEME } from '../constants';
import { gameConfig, type WinTier } from '../gameConfig';
import type { LineWin } from '../rgs/types';
import { SYMBOL_TEX, UI, symbolKey } from '../scenes/BootScene';
import { fitText } from '../utils/fitText';
import { formatMoney } from '../utils/format';
import { layout, sd, sx, sy, type Layout } from '../utils/responsive';
import { Timeline } from '../utils/timeline';
import { dimLayer, fadeIn, fadeOut, pop } from './fx';
import type { WinLines } from './WinLines';

const TIERS = gameConfig.winTiers;
const LOWEST = TIERS[TIERS.length - 1];
/** MEGA / EPIC camera shake: duration, and intensity as a fraction of the canvas size. */
const SHAKE_MS = 350;
const SHAKE = 0.006;

/** Highest tier the amount reaches, or undefined for a normal win. Integer compare, no floats. */
const tierFor = (win: number, bet: number): WinTier | undefined =>
  TIERS.find((t) => win >= t.min * bet);

/** Win count-up, win meter, big / mega / epic overlay. Every step skippable. */
export class WinPresenter {
  /** presentation hook (sound): fires as a win starts presenting, big = reached a tier */
  onWin?: (big: boolean) => void;
  /** amount currently in the win meter, integer minor units (dev assertion reads this) */
  shown = 0;
  private scene: Phaser.Scene;
  private tl: Timeline;
  private meter: Phaser.GameObjects.Text;
  /** glow behind the meter while it counts */
  private meterGlow: Phaser.GameObjects.Image;
  private meterPulse: Phaser.Tweens.Tween;
  /** rotating light rays behind the big win title; the container fades, the image turns */
  private rays: Phaser.GameObjects.Container;
  private raysImg: Phaser.GameObjects.Image;
  private raysTurn: Phaser.Tweens.Tween;
  private dim: Phaser.GameObjects.Image;
  private title: Phaser.GameObjects.Text;
  private amount: Phaser.GameObjects.Text;
  /** undefined = none shown yet this presentation, so the first title pops too */
  private titleTier?: WinTier;
  private shower: Phaser.GameObjects.Particles.ParticleEmitter;
  /** coin size in canvas px, set by relayout */
  private coinPx = 64;
  /** base font sizes and max text width (canvas px), set by relayout */
  private fit = { title: 0, amount: 0, maxW: 0 };

  constructor(
    scene: Phaser.Scene,
    private winLines: WinLines,
  ) {
    this.scene = scene;
    this.tl = new Timeline(scene);
    const font = THEME.fonts.numeric;
    this.meterGlow = scene.add.image(0, 0, UI.glow).setDepth(DEPTH.WIN_METER).setVisible(false);
    this.meterPulse = scene.tweens.add({
      targets: this.meterGlow,
      alpha: { from: 0.25, to: 0.7 },
      duration: 300,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      paused: true,
      persist: true,
    });
    this.meter = scene.add
      .text(0, 0, formatMoney(0), { fontFamily: THEME.fonts.numeric, color: THEME.gold })
      .setOrigin(0.5)
      .setDepth(DEPTH.WIN_METER);
    this.dim = dimLayer(scene, 0x000000, 0.7, DEPTH.DIM);
    this.raysImg = scene.add.image(0, 0, UI.rays);
    this.rays = scene.add.container(0, 0, [this.raysImg]).setDepth(DEPTH.BIG_WIN).setVisible(false);
    this.raysTurn = scene.tweens.add({
      targets: this.raysImg,
      angle: 360,
      duration: 9000,
      repeat: -1,
      paused: true,
      persist: true,
    });
    // coin rain: created before title/amount at the same depth, so it falls behind the text.
    // Particles scale through the emitter (Phaser's particle API); randomness is visual only.
    const R = Phaser.Math;
    this.shower = scene.add
      .particles(0, 0, symbolKey('COIN'), {
        x: { onEmit: () => R.Between(0, scene.scale.width) },
        y: { onEmit: () => -this.coinPx },
        speedX: { onEmit: () => R.Between(-140, 140) * layout.s },
        speedY: { onEmit: () => R.Between(120, 420) * layout.s },
        scale: { onEmit: () => (this.coinPx / SYMBOL_TEX) * R.FloatBetween(0.6, 1.1) },
        rotate: { start: 0, end: 540 },
        lifespan: 3200,
        frequency: gameConfig.win.showerMs,
        quantity: 1,
        maxAliveParticles: 160,
        emitting: false,
      })
      .setDepth(DEPTH.BIG_WIN);
    this.title = scene.add
      .text(0, 0, '', { fontFamily: font, color: '#ffd34d', stroke: '#6a1a00' })
      .setOrigin(0.5)
      .setDepth(DEPTH.BIG_WIN);
    this.amount = scene.add
      .text(0, 0, '', { fontFamily: font, color: '#ffffff', stroke: '#6a1a00' })
      .setOrigin(0.5)
      .setDepth(DEPTH.BIG_WIN);
    this.dim.setVisible(false);
    this.title.setVisible(false);
    this.amount.setVisible(false);
  }

  /** Reset for a new spin. */
  clear() {
    this.shower.killAll();
    this.setMeter(0);
    this.winLines.clear();
  }

  /** Drop line highlights but keep the meter (between free spins). */
  clearLines() {
    this.winLines.clear();
  }

  /** Put an amount from the response straight into the meter. */
  showTotal(v: number) {
    this.setMeter(v);
  }

  /** Fast-forward the running stage to its end state. */
  skip() {
    this.tl.skip();
  }

  /**
   * Present a win. The meter counts from base to base + win (base = amount already won this
   * round, e.g. earlier free spins). Resolves once the presentation, or its skip, is done.
   */
  async present(lineWins: readonly LineWin[], win: number, bet: number, base = 0) {
    const tl = this.tl;
    tl.reset();
    this.winLines.showAll(lineWins);
    const tier = tierFor(win, bet);
    this.onWin?.(!!tier);

    this.setCounting(true);
    if (!tier) {
      await tl.counter(0, win, gameConfig.win.countUpMs, (v) =>
        this.setMeter(base + Math.floor(v)),
      );
      this.setCounting(false);
      this.setMeter(base + win); // final value always from the response
      tl.reset();
      return;
    }

    this.showOverlay(true); // fade first: it would cancel the title pop otherwise
    this.titleTier = undefined;
    this.setTitle(LOWEST);
    this.setAmount(0);
    await tl.counter(0, win, tier.countUpMs, (v) => {
      const n = Math.floor(v);
      this.setAmount(n);
      const reached = tierFor(n, bet);
      if (reached && reached !== this.titleTier) this.setTitle(reached);
    });
    this.setCounting(false);
    this.setTitle(tier);
    this.setAmount(win);
    this.setMeter(base + win);

    // second stage: first tap ended the count-up, the next one closes the overlay
    tl.reset();
    await tl.wait(gameConfig.win.bigWinHoldMs);
    this.showOverlay(false);
    tl.reset();
  }

  private setMeter(v: number) {
    this.shown = v;
    this.meter.setText(formatMoney(v)); // value of the HUD's WIN pod
  }

  private setCounting(on: boolean) {
    this.meterGlow.setVisible(on);
    if (on) this.meterPulse.resume();
    else this.meterPulse.pause();
  }

  private setAmount(v: number) {
    this.amount.setText(formatMoney(v));
    fitText(this.amount, this.fit.amount, this.fit.maxW);
  }

  private setTitle(t: WinTier) {
    const changed = t !== this.titleTier;
    this.titleTier = t;
    this.title.setText(t.title);
    fitText(this.title, this.fit.title, this.fit.maxW);
    this.shower.setQuantity(t.shower); // rain thickens as the tier escalates
    if (!changed) return;
    pop(this.scene, this.title);
    pop(this.scene, this.amount, 1.15);
    if (t !== LOWEST) this.scene.cameras.main.shake(SHAKE_MS, SHAKE); // MEGA / EPIC hit harder
  }

  private showOverlay(on: boolean) {
    if (on) {
      fadeIn(this.scene, this.dim, 0.7);
      fadeIn(this.scene, this.rays, 0.8);
      this.raysTurn.resume();
      fadeIn(this.scene, this.title);
      fadeIn(this.scene, this.amount);
      this.shower.start();
    } else {
      this.shower.stop(); // coins already falling finish their fall
      fadeOut(this.scene, this.dim);
      fadeOut(this.scene, this.rays);
      this.raysTurn.pause();
      fadeOut(this.scene, this.title);
      fadeOut(this.scene, this.amount);
    }
  }

  relayout(l: Layout) {
    const h = l.landscape ? HUD_LAYOUT.landscape : HUD_LAYOUT.portrait;
    this.meter
      .setPosition(sx(h.win.x), sy(h.win.y + POD.valueDy))
      .setFontSize(Math.round(sd(h.font.win)));
    this.meterGlow
      .setPosition(this.meter.x, this.meter.y)
      .setDisplaySize(sd(h.font.win * 7), sd(h.font.win * 2.4));
    // oversized by the shake travel, so a shaking camera never shows an undimmed edge
    const { width: cw, height: ch } = this.scene.scale;
    const pad = Math.ceil(SHAKE * Math.max(cw, ch));
    this.dim.setPosition(-pad, -pad).setDisplaySize(cw + pad * 2, ch + pad * 2);
    const cx = sx(layout.w / 2);
    const cy = sy(layout.h / 2);
    this.fit = { title: sd(150), amount: sd(120), maxW: sd(l.w * 0.9) };
    this.coinPx = sd(84);
    this.shower.gravityY = sd(900);
    this.title.setPosition(cx, cy - sd(110)).setStroke('#6a1a00', sd(14));
    this.rays.setPosition(cx, cy - sd(110));
    this.raysImg.setDisplaySize(sd(1100), sd(1100));
    this.amount.setPosition(cx, cy + sd(90)).setStroke('#6a1a00', sd(12));
    fitText(this.title, this.fit.title, this.fit.maxW);
    fitText(this.amount, this.fit.amount, this.fit.maxW);
  }
}
