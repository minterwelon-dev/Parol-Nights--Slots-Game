import Phaser from 'phaser';
import { DEPTH, HUD_LAYOUT, POD, THEME } from '../../constants';
import { gameConfig, type WinTier } from '../../gameConfig';
import type { LineWin } from '../../rgs/types';
import { UI, symbolKey } from '../../scenes/BootScene';
import { fitText } from '../../utils/fitText';
import { formatMoney } from '../../utils/format';
import { layout, sd, sx, sy, type Layout } from '../../utils/responsive';
import { Timeline } from '../../utils/timeline';
import { dimLayer, fadeIn, fadeOut, goldTitle, pop } from '../fx';
import type { WinLines } from '../WinLines';
import { ASPECT, LOGO_KEY, PANEL } from '../Title';
import { FX } from './fxTextures';
import { ANIM_EVENTS, type AnimationService } from './AnimationService';

const TIERS = gameConfig.winTiers;
const COUNT = gameConfig.anim.countUp;
const LOWEST = TIERS[TIERS.length - 1];
const BIG = gameConfig.anim.bigWin;
/** Lantern rise uses the low symbols, tinted warm and scaled down. */
const LANTERN_IDS = ['L1', 'L2', 'L3', 'L4'] as const;
const PETAL_TINTS = [0xff5a5a, 0xffd34d, 0x6ee08a, 0xfff3d6];
/** Reference-px sizes of big win dressing. */
const LANTERN_PX = 120;
const COIN_PX = 84;

const CUBIC = 'Cubic.easeOut';
/** Tier titles escalate through the glow: color and blur (reference px). */
const TIER_GLOW: Record<string, [string, number]> = {
  big: [THEME.glow.gold, 18],
  mega: [THEME.glow.red, 24],
  epic: [THEME.glow.red, 36],
};

/** Normal win count-up: grows with the win (in bet multiples) from normalMs[0] at 0x to [1] at the big tier. */
const normalMs = (win: number, bet: number) => {
  const [lo, hi] = COUNT.normalMs;
  return Math.round(lo + (hi - lo) * Math.min(1, win / (LOWEST.min * bet)));
};

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
  /** ornamental banner (the logo ornament) that scales in behind the tier title */
  private banner: Phaser.GameObjects.Container;
  private bannerImg: Phaser.GameObjects.Image;
  private bannerGlow: Phaser.GameObjects.Image;
  private shower: Phaser.GameObjects.Particles.ParticleEmitter;
  private petals: Phaser.GameObjects.Particles.ParticleEmitter;
  /** pooled lanterns for the MEGA rise */
  private lanterns: Phaser.GameObjects.Image[] = [];
  /** looping sparkles around the banner (BIG+) and light bursts (EPIC); paused when idle */
  private sparkTimer: Phaser.Time.TimerEvent;
  private burstTimer: Phaser.Time.TimerEvent;
  /** tiers whose dressing already started this presentation */
  private dressed = new Set<string>();
  /** coin size in canvas px, set by relayout */
  private coinPx = 64;
  /** base font sizes and max text width (canvas px), set by relayout */
  private fit = { title: 0, amount: 0, maxW: 0 };

  constructor(
    scene: Phaser.Scene,
    private winLines: WinLines,
    private anim: AnimationService,
  ) {
    this.scene = scene;
    this.tl = new Timeline(scene);
    const font = THEME.fonts.numeric;
    this.meterGlow = scene.add.image(0, 0, UI.glow).setDepth(DEPTH.WIN_METER).setVisible(false);
    this.meterPulse = scene.tweens.add({
      targets: this.meterGlow,
      alpha: { from: 0.25, to: 0.7 },
      duration: gameConfig.anim.timings.meterPulseMs,
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
      duration: gameConfig.anim.timings.bigWinRaysTurnMs,
      repeat: -1,
      paused: true,
      persist: true,
    });
    this.bannerGlow = scene.add
      .image(0, 0, FX.glow)
      .setTint(0xffc94a)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.BIG_WIN)
      .setVisible(false);
    this.bannerImg = scene.add.image(0, 0, LOGO_KEY);
    this.banner = scene.add
      .container(0, 0, [this.bannerImg])
      .setDepth(DEPTH.BIG_WIN)
      .setVisible(false);
    // rain and lanterns: created before title/amount at the same depth, so they pass behind the text.
    // Visual randomness only, from Phaser's generator (never the math RNG).
    const rnd = () => Phaser.Math.RND;
    this.shower = scene.add
      .particles(0, 0, symbolKey('COIN'), {
        x: { onEmit: () => rnd().between(0, scene.scale.width) },
        y: { onEmit: () => -this.coinPx },
        speedX: { onEmit: () => rnd().between(-140, 140) * layout.s },
        speedY: { onEmit: () => rnd().between(120, 420) * layout.s },
        scale: {
          onEmit: () =>
            (this.coinPx / scene.textures.get(symbolKey('COIN')).getSourceImage().width) *
            rnd().realInRange(0.6, 1.1),
        },
        rotate: { start: 0, end: 540 },
        lifespan: 3200,
        frequency: BIG.coinsMs / BIG.coins,
        quantity: 1,
        maxAliveParticles: BIG.coins,
        emitting: false,
      })
      .setDepth(DEPTH.BIG_WIN);
    const petalTex = () => scene.textures.get(FX.petal).getSourceImage().width;
    this.petals = scene.add
      .particles(0, 0, FX.petal, {
        x: { onEmit: () => rnd().between(0, scene.scale.width) },
        y: { onEmit: () => -sd(40) },
        speedX: { onEmit: () => rnd().between(-90, 90) * layout.s },
        speedY: { onEmit: () => rnd().between(60, 200) * layout.s },
        scale: { onEmit: () => (sd(28) / petalTex()) * rnd().realInRange(0.7, 1.2) },
        rotate: { start: 0, end: 540 },
        tint: { onEmit: () => rnd().pick(PETAL_TINTS) },
        lifespan: BIG.petalLifeMs,
        frequency: BIG.petalsMs / BIG.petals,
        quantity: 1,
        maxAliveParticles: BIG.petals,
        emitting: false,
      })
      .setDepth(DEPTH.BIG_WIN);
    anim.fx.register(this.shower);
    anim.fx.register(this.petals);
    for (let i = 0; i < BIG.lanterns; i++) {
      this.lanterns.push(
        scene.add
          .image(0, 0, symbolKey(LANTERN_IDS[i % LANTERN_IDS.length]))
          .setTint(0xffd9a0)
          .setDepth(DEPTH.BIG_WIN)
          .setVisible(false),
      );
    }
    this.sparkTimer = scene.time.addEvent({
      delay: BIG.sparkEveryMs,
      loop: true,
      paused: true,
      callback: this.bannerSparkle,
      callbackScope: this,
    });
    this.burstTimer = scene.time.addEvent({
      delay: BIG.lightBurstEveryMs,
      loop: true,
      paused: true,
      callback: this.lightBurst,
      callbackScope: this,
    });
    this.title = scene.add
      .text(0, 0, '', { fontFamily: THEME.fonts.title, fontStyle: 'bold', stroke: THEME.stroke })
      .setOrigin(0.5)
      .setDepth(DEPTH.BIG_WIN);
    this.amount = scene.add
      .text(0, 0, '', { fontFamily: font, color: THEME.amount, stroke: THEME.stroke })
      .setOrigin(0.5)
      .setDepth(DEPTH.BIG_WIN);
    this.dim.setVisible(false);
    this.title.setVisible(false);
    this.amount.setVisible(false);
  }

  /** Reset for a new spin. */
  clear() {
    this.shower.killAll();
    this.petals.killAll();
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
    this.anim.emit(ANIM_EVENTS.countUpStart);
    if (!tier) {
      await tl.counter(
        0,
        win,
        this.anim.dur(normalMs(win, bet)),
        (v) => this.setMeter(base + Math.floor(v)),
        CUBIC,
      );
      this.setCounting(false);
      this.setMeter(base + win); // final value always from the response
      this.settle();
      this.anim.emit(ANIM_EVENTS.countUpEnd);
      tl.reset();
      return;
    }

    this.showOverlay(true, tier); // fade first: it would cancel the title pop otherwise
    this.titleTier = undefined;
    this.setTitle(LOWEST);
    this.setAmount(0);
    await tl.counter(
      0,
      win,
      this.anim.dur(tier.countUpMs),
      (v) => {
        const n = Math.floor(v);
        this.setAmount(n);
        const reached = tierFor(n, bet);
        if (reached && reached !== this.titleTier) this.setTitle(reached);
      },
      CUBIC,
    );
    this.setCounting(false);
    this.setTitle(tier);
    this.setAmount(win);
    this.setMeter(base + win);
    this.settle();
    this.anim.emit(ANIM_EVENTS.countUpEnd);

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
    // reduced motion: steady glow
    if (on && !this.anim.reduced) this.meterPulse.resume();
    else this.meterPulse.pause();
    if (on && this.anim.reduced) this.meterGlow.setAlpha(0.5);
  }

  /** Short settle pulse on the meter once it shows the final value (count-up end or skip). */
  private settle() {
    if (this.anim.reduced) return;
    this.scene.tweens.killTweensOf(this.meter);
    this.meter.setScale(COUNT.settleScale);
    this.scene.tweens.add({
      targets: this.meter,
      scale: 1,
      duration: COUNT.settleMs,
      ease: 'Back.easeOut',
    });
  }

  private setAmount(v: number) {
    this.amount.setText(formatMoney(v));
    fitText(this.amount, this.fit.amount, sd(layout.w * 0.9));
  }

  private setTitle(t: WinTier) {
    const changed = t !== this.titleTier;
    this.titleTier = t;
    this.title.setText(t.title);
    this.fitTitle();
    if (!changed) return;
    pop(this.scene, this.title);
    pop(this.scene, this.amount, 1.15);
    this.dress(t);
  }

  /** Start the dressing of tier t and every tier below it that has not started yet. */
  private dress(t: WinTier) {
    const reduced = this.anim.reduced;
    for (let i = TIERS.length - 1; i >= 0; i--) {
      const tier = TIERS[i];
      if (tier.min > t.min || this.dressed.has(tier.name)) continue;
      this.dressed.add(tier.name);
      if (reduced) continue; // reduced motion: banner, text and static rays only
      if (tier.name === 'big') this.sparkTimer.paused = false;
      if (tier.name === 'mega') {
        this.shower.start(0, BIG.coinsMs);
        this.riseLanterns();
      }
      if (tier.name === 'epic') {
        this.anim.shake(BIG.shakeMs, BIG.shake);
        this.petals.start(0, BIG.petalsMs);
        this.burstTimer.paused = false;
      }
    }
  }

  /** MEGA: tinted lanterns float up from below with a sway, staggered. */
  private riseLanterns() {
    const { width: w, height: h } = this.scene.scale;
    const size = sd(LANTERN_PX);
    const rnd = Phaser.Math.RND;
    for (let i = 0; i < this.lanterns.length; i++) {
      const l = this.lanterns[i];
      this.scene.tweens.killTweensOf(l);
      const x = ((i + 0.5) / this.lanterns.length) * w + rnd.between(-40, 40) * layout.s;
      l.setPosition(x, h + size)
        .setDisplaySize(size, size)
        .setAlpha(0.95)
        .setAngle(-6)
        .setVisible(true);
      const delay = i * BIG.lanternStaggerMs;
      this.scene.tweens.add({
        targets: l,
        y: -size,
        duration: BIG.lanternMs,
        delay,
        ease: 'Sine.easeIn',
        onComplete: () => l.setVisible(false),
      });
      this.scene.tweens.add({
        targets: l,
        x: x + sd(30),
        angle: 6,
        duration: BIG.lanternMs / 4,
        delay,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: 1,
      });
    }
  }

  /** BIG+: a few sparkles around the banner. */
  private bannerSparkle() {
    const rnd = Phaser.Math.RND;
    const w = this.bannerImg.displayWidth;
    const x = this.banner.x + rnd.realInRange(-0.45, 0.45) * w;
    const y = this.banner.y + rnd.realInRange(-0.3, 0.3) * this.bannerImg.displayHeight;
    this.anim.fx.sparkle(DEPTH.BIG_WIN, x, y, this.anim.count(BIG.sparks));
  }

  /** EPIC: star burst + ring at a random spot (no full-screen flash). */
  private lightBurst() {
    const rnd = Phaser.Math.RND;
    const { width: w, height: h } = this.scene.scale;
    const x = rnd.realInRange(0.15, 0.85) * w;
    const y = rnd.realInRange(0.15, 0.6) * h;
    this.anim.fx.burst(DEPTH.BIG_WIN, x, y, this.anim.count(gameConfig.anim.burst.count));
    this.anim.fx.ring(
      DEPTH.BIG_WIN,
      x,
      y,
      sd(260),
      0.2,
      1.6,
      gameConfig.anim.timings.lightBurstRingMs,
    );
  }

  private showOverlay(on: boolean, tier?: WinTier) {
    const reduced = this.anim.reduced;
    if (on) {
      this.dressed.clear();
      this.anim.emit(ANIM_EVENTS.bigWinStart, tier?.name);
      fadeIn(this.scene, this.dim, 0.7);
      fadeIn(this.scene, this.rays, 0.8);
      if (!reduced) this.raysTurn.resume();
      fadeIn(this.scene, this.bannerGlow, 0.55);
      fadeIn(this.scene, this.banner);
      // banner scales in (container scale, base 1); the fade above set its alpha
      this.banner.setScale(reduced ? 1 : 0.2);
      if (!reduced)
        this.scene.tweens.add({
          targets: this.banner,
          scale: 1,
          duration: BIG.bannerMs,
          ease: 'Back.easeOut',
        });
      fadeIn(this.scene, this.title);
      fadeIn(this.scene, this.amount);
    } else {
      this.shower.stop(); // coins and petals already falling finish their fall
      this.petals.stop();
      this.sparkTimer.paused = true;
      this.burstTimer.paused = true;
      for (const l of this.lanterns) fadeOut(this.scene, l);
      fadeOut(this.scene, this.dim);
      fadeOut(this.scene, this.rays);
      this.raysTurn.pause();
      fadeOut(this.scene, this.bannerGlow);
      fadeOut(this.scene, this.banner);
      fadeOut(this.scene, this.title);
      fadeOut(this.scene, this.amount);
      this.anim.emit(ANIM_EVENTS.bigWinEnd);
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
    const pad = Math.ceil(BIG.shake * Math.max(cw, ch));
    this.dim.setPosition(-pad, -pad).setDisplaySize(cw + pad * 2, ch + pad * 2);
    const cx = sx(layout.w / 2);
    const cy = sy(layout.h / 2);
    // banner: the title sits on the ornament's inner panel and fits inside it
    const bw = sd(Math.min(l.landscape ? BIG.bannerW.landscape : BIG.bannerW.portrait, l.w * 0.95));
    const bh = bw * ASPECT;
    const by = cy - sd(110) - (PANEL.y - 0.5) * bh;
    this.banner.setPosition(cx + (0.5 - PANEL.x) * bw, by);
    this.bannerImg.setDisplaySize(bw, bh);
    this.bannerGlow.setPosition(cx, cy - sd(110)).setDisplaySize(bw * 1.1, bw * 0.7);
    this.fit = {
      title: Math.min(sd(150), bh * PANEL.h * 0.95),
      amount: sd(120),
      maxW: Math.min(sd(l.w * 0.9), bw * PANEL.w * 0.92),
    };
    this.coinPx = sd(COIN_PX);
    this.shower.gravityY = sd(BIG.coinGravity);
    this.petals.gravityY = sd(BIG.petalGravity);
    this.title.setPosition(cx, cy - sd(110)).setStroke(THEME.stroke, sd(10));
    this.rays.setPosition(cx, cy - sd(110));
    this.raysImg.setDisplaySize(sd(1100), sd(1100));
    this.amount.setPosition(cx, cy + sd(90)).setStroke(THEME.stroke, sd(12));
    this.fitTitle();
    fitText(this.amount, this.fit.amount, sd(l.w * 0.9));
  }

  /** Fit the tier title to the banner panel, then (re)apply its gold look for the new size. */
  private fitTitle() {
    fitText(this.title, this.fit.title, this.fit.maxW);
    const [glow, blur] = TIER_GLOW[this.titleTier?.name ?? 'big'];
    goldTitle(this.title, glow, sd(blur));
  }
}
