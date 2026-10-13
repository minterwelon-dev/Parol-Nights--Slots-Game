import Phaser from 'phaser';
import { DEPTH, THEME } from '../constants';
import { gameConfig } from '../gameConfig';
import { REELS, ROWS } from '../math/config';
import { UI } from '../scenes/BootScene';
import type { Coin, HoldAndWinRound, Jackpot } from '../rgs/types';
import { fitText } from '../utils/fitText';
import { formatMoney } from '../utils/format';
import { cellX, cellY, layout, sd, sx, sy, type Layout } from '../utils/responsive';
import { Timeline } from '../utils/timeline';
import { FeatureOverlay } from './FeatureOverlay';
import { pop } from './fx';
import type { WinPresenter } from './animation/WinPresenter';
import { ANIM_EVENTS, type AnimationService } from './animation/AnimationService';
import { flip } from './animation/FeatureAnimations';

const CELLS = REELS * ROWS;
const FONT = THEME.fonts.numeric;
const cfg = gameConfig.holdAndWin;
/** Coin display size relative to the cell (the envelope art has its own transparent margin). */
const COIN_FILL = 1;
/** Value plaque across the envelope's lower half, clear of the emblem: offset, width, value font. */
const TAG = { dy: 0.3, w: 0.86, font: 0.15 };
/** Grand wave: delay per diagonal step, and how long the wave runs before the banner. */
const WAVE_STEP_MS = gameConfig.anim.timings.waveStepMs;
const WAVE_MS = 6 * WAVE_STEP_MS + gameConfig.anim.timings.waveTailMs;
const F = gameConfig.anim.feature;
const JACKPOT_TINT: Record<Jackpot, number> = { mini: 0xa8ffb0, minor: 0x9cd8ff, major: 0xff9cf0 };

/**
 * Hold & Win presentation: a 15-cell board over the reels, played back from the response
 * (initial coins, each respin's new coins, Grand). Amounts on screen are response values.
 */
export class HoldAndWin {
  private scene: Phaser.Scene;
  private tl: Timeline;
  private ov: FeatureOverlay;
  /** true from intro to the end of the summary */
  active = false;
  private board: Phaser.GameObjects.Graphics;
  private shimmer: Phaser.GameObjects.Graphics;
  private shimmerPulse: Phaser.Tweens.Tween;
  /** pooled per-cell views, index = reel * ROWS + row */
  private coins: Phaser.GameObjects.Image[] = [];
  private values: Phaser.GameObjects.Text[] = [];
  /** plaque behind each value so it reads over the envelope art */
  private tags: Phaser.GameObjects.Image[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  /** one glow per cell, behind its coin: landing flash, or a looping sparkle for jackpots */
  private flashes: Phaser.GameObjects.Image[] = [];
  private sparkling: boolean[] = new Array(CELLS).fill(false);
  private filled: boolean[] = new Array(CELLS).fill(false);
  /** response value per filled cell, for the summary collect */
  private cellValue: number[] = new Array(CELLS).fill(0);

  constructor(
    scene: Phaser.Scene,
    private presenter: WinPresenter,
    private anim: AnimationService,
  ) {
    this.scene = scene;
    this.tl = new Timeline(scene);
    this.ov = new FeatureOverlay(
      scene,
      {
        dim: 0x001018,
        edge: 0xffc23d,
        glow: THEME.glow.gold,
        sub: THEME.amount,
        stroke: THEME.stroke,
      },
      anim,
    );
    this.board = scene.add.graphics().setDepth(DEPTH.FEATURE_OVERLAY).setVisible(false);
    this.shimmer = scene.add.graphics().setDepth(DEPTH.FEATURE_OVERLAY).setVisible(false);
    this.shimmerPulse = scene.tweens.add({
      targets: this.shimmer,
      alpha: 0.15,
      duration: gameConfig.anim.timings.shimmerMs,
      yoyo: true,
      repeat: -1,
      paused: true,
      persist: true,
    });
    for (let i = 0; i < CELLS; i++) {
      this.flashes.push(
        scene.add.image(0, 0, UI.glow).setDepth(DEPTH.FEATURE_OVERLAY).setVisible(false),
      );
    }
    for (let i = 0; i < CELLS; i++) {
      this.coins.push(
        scene.add.image(0, 0, UI.coin).setDepth(DEPTH.FEATURE_OVERLAY).setVisible(false),
      );
      this.tags.push(
        scene.add.image(0, 0, UI.btn).setDepth(DEPTH.FEATURE_OVERLAY).setVisible(false),
      );
      this.values.push(
        scene.add
          .text(0, 0, '', { fontFamily: FONT, color: '#fff1d6', stroke: THEME.stroke })
          .setOrigin(0.5)
          .setDepth(DEPTH.FEATURE_OVERLAY)
          .setVisible(false),
      );
      this.labels.push(
        scene.add
          .text(0, 0, '', { fontFamily: FONT, color: '#fff1d6', stroke: THEME.stroke })
          .setOrigin(0.5)
          .setDepth(DEPTH.FEATURE_OVERLAY)
          .setVisible(false),
      );
    }
  }

  /** presentation hook (sound): a coin appears on the board */
  onCoin?: () => void;

  /** Any tap fast-forwards the current step; the end state is always set from the response. */
  tap() {
    if (this.active) this.tl.skip();
  }

  /**
   * Intro, initial coins, every respin, Grand. startAt > 0 resumes after a refresh: the board
   * is rebuilt instantly from coins already revealed. onStep(n) fires after respin n.
   */
  async play(round: HoldAndWinRound, turbo: boolean, startAt = 0, onStep?: (done: number) => void) {
    const tl = this.tl;
    this.active = true;
    const resumed = startAt > 0;
    const sub = resumed ? 'RESUMED' : `${round.awarded} RESPINS`;
    this.anim.emit(ANIM_EVENTS.featureIntro, 'holdAndWin');
    await this.ov.step(tl, 'HOLD & WIN', sub, 'TAP TO START', cfg.introMs);

    this.clearBoard();
    this.showBoard(true);
    let shown = 0; // sum of response coin values, for the info bar
    tl.reset();
    for (let i = 0; i < round.initial.length; i++) {
      shown += this.placeCoin(round.initial[i], !resumed);
      if (!resumed) await tl.wait(cfg.revealStepMs);
    }
    for (let i = 0; i < startAt; i++) {
      const coins = round.respins[i].coins;
      for (let c = 0; c < coins.length; c++) shown += this.placeCoin(coins[c], false);
    }
    tl.reset();
    let left = resumed ? round.respins[startAt - 1].respinsLeft : round.awarded;
    this.setBar(left, shown, round);

    for (let i = startAt; i < round.respins.length; i++) {
      const r = round.respins[i];
      this.setBar(left - 1, shown, round); // the respin spends a pip
      this.setShimmer(true);
      await tl.wait(turbo ? cfg.respinMs / 2 : cfg.respinMs);
      this.setShimmer(false);
      tl.reset();
      for (let c = 0; c < r.coins.length; c++) {
        shown += this.placeCoin(r.coins[c]);
        await tl.wait(cfg.landStepMs);
      }
      tl.reset();
      left = r.respinsLeft;
      this.setBar(left, shown, round, r.coins.length > 0);
      if (r.coins.length > 0) {
        this.ov.popBar('left', true); // respins reset
        this.anim.emit(ANIM_EVENTS.respinReset);
      }
      onStep?.(i + 1);
    }

    if (round.grand > 0) {
      this.wave();
      this.anim.flash(F.grandFlashMs); // one flash, gated (reduced motion, 400 ms rule)
      await tl.wait(WAVE_MS);
      tl.reset();
      await this.ov.step(tl, 'GRAND', formatMoney(round.grand), 'ALL 15 FILLED', cfg.grandMs);
      shown += round.grand;
      this.setBar(0, shown, round);
    }
    if (import.meta.env.DEV && !round.capped && shown !== round.totalWin)
      console.warn(`[hw] played ${shown} != round total ${round.totalWin}`);
  }

  /** Summary overlay; leaves the meter on the round total from the response. */
  async summary(round: HoldAndWinRound, totalWin: number) {
    await this.collect(round);
    await this.ov.summary(
      this.tl,
      round.capped ? 'MAX WIN REACHED' : 'HOLD & WIN',
      round.totalWin,
      round.capped ? 'FEATURE ENDED AT MAX WIN' : 'TAP TO CONTINUE',
      cfg.summaryCountUpMs,
      cfg.summaryHoldMs,
    );
    this.ov.bar(null);
    this.showBoard(false);
    this.presenter.showTotal(totalWin);
    this.active = false;
  }

  /** Coin values add up one by one (accelerating, skippable), then the bar shows the response total. */
  private async collect(round: HoldAndWinRound) {
    const tl = this.tl;
    tl.reset();
    let sum = 0;
    let step: number = F.collectStartMs;
    for (let i = 0; i < CELLS; i++) {
      if (!this.filled[i]) continue;
      sum += this.cellValue[i];
      this.setBar(0, sum, round);
      if (!this.anim.reduced) this.bump(i);
      await tl.wait(step);
      step = Math.max(F.collectMinMs, step * F.collectFactor);
    }
    this.setBar(0, round.totalWin, round); // final value from the response
    tl.reset();
  }

  /** Short size bump + flash on one coin (summary collect). */
  private bump(i: number) {
    const c = this.coins[i];
    const size = sd(layout.cell) * COIN_FILL;
    this.scene.tweens.killTweensOf(c);
    c.setDisplaySize(size * 1.15, size * 1.15);
    this.scene.tweens.add({
      targets: c,
      displayWidth: size,
      displayHeight: size,
      duration: gameConfig.anim.timings.collectBumpMs,
      ease: 'Sine.easeOut',
    });
    if (!this.sparkling[i]) this.flash(i);
  }

  /**
   * Show one coin from the response; returns its value for the running display.
   * animate = drop into the cell with a bounce + flash; false = appear in place (resume rebuild).
   */
  private placeCoin(c: Coin, animate = true) {
    const i = c.pos;
    this.filled[i] = true;
    this.cellValue[i] = c.value;
    this.coins[i].setVisible(true).setTint(c.jackpot ? JACKPOT_TINT[c.jackpot] : 0xffffff);
    this.tags[i].setVisible(true);
    this.values[i].setText(formatMoney(c.value)).setVisible(true);
    this.fitValue(i);
    this.labels[i].setText(c.jackpot ? c.jackpot.toUpperCase() : '').setVisible(!!c.jackpot);
    this.rest(i);
    this.drawShimmer();
    if (c.jackpot) this.sparkle(i, JACKPOT_TINT[c.jackpot]);
    if (animate) {
      this.onCoin?.();
      this.drop(i, c);
    }
    return c.value;
  }

  /**
   * Coin falls into the cell and bounces, locks with a flash (jackpots: a ring burst in their
   * tier color), then its value flips into view and pops.
   */
  private drop(i: number, c: Coin) {
    const coin = this.coins[i];
    const tag = this.tags[i];
    const value = this.values[i];
    const tagScale = tag.scaleX;
    const dy = sd(layout.cell * 0.7);
    coin.setY(coin.y - dy).setAlpha(0);
    this.labels[i].setAlpha(0);
    tag.scaleX = 0;
    value.scaleX = 0;
    this.scene.tweens.add({
      targets: [coin, this.labels[i]],
      y: `+=${dy}`,
      alpha: 1,
      duration: gameConfig.anim.timings.coinDropMs,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        this.anim.emit(ANIM_EVENTS.coinLocked, i);
        if (c.jackpot) this.jackpot(i, c.jackpot);
        else this.flash(i);
        flip(this.scene, this.anim, tag, 'x', undefined, tagScale);
        flip(this.scene, this.anim, value, 'x', () => pop(this.scene, value, 1.35));
      },
    });
  }

  /** Jackpot coin: ring burst in its tier color, star burst, and the TOTAL slot flashes. */
  private jackpot(i: number, tier: Jackpot) {
    this.anim.emit(ANIM_EVENTS.jackpotReveal, tier);
    this.ov.popBar('right', true);
    if (this.anim.reduced) return;
    const x = cellX(Math.floor(i / ROWS));
    const y = cellY(i % ROWS);
    const cell = sd(layout.cell);
    this.anim.fx.ring(DEPTH.FEATURE_OVERLAY, x, y, cell, 0.3, 2.2, 520, JACKPOT_TINT[tier]);
    this.anim.fx.burst(DEPTH.FEATURE_OVERLAY, x, y, this.anim.count(gameConfig.anim.burst.count));
  }

  private flash(i: number) {
    const cell = sd(layout.cell);
    const f = this.flashes[i].setTint(0xffffff).setVisible(true).setAlpha(0.9);
    f.setDisplaySize(cell * 0.9, cell * 0.9);
    this.scene.tweens.add({
      targets: f,
      displayWidth: cell * 1.7,
      displayHeight: cell * 1.7,
      alpha: 0,
      duration: gameConfig.anim.timings.coinFlashMs,
      ease: 'Sine.easeOut',
      onComplete: () => f.setVisible(false),
    });
  }

  /** Jackpot coins keep a pulsing tinted glow until the board clears. */
  private sparkle(i: number, tint: number) {
    const cell = sd(layout.cell);
    const f = this.flashes[i];
    this.sparkling[i] = true;
    this.scene.tweens.killTweensOf(f);
    f.setTint(tint)
      .setVisible(true)
      .setAlpha(0.25)
      .setDisplaySize(cell * 1.3, cell * 1.3);
    this.scene.tweens.add({
      targets: f,
      alpha: 0.85,
      duration: gameConfig.anim.timings.jackpotGlowMs,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /** Grand: a diagonal wave of bumps + flashes across the full board. */
  private wave() {
    const size = sd(layout.cell) * COIN_FILL;
    for (let i = 0; i < CELLS; i++) {
      const delay = (Math.floor(i / ROWS) + (i % ROWS)) * WAVE_STEP_MS;
      this.scene.tweens.add({
        targets: this.coins[i],
        displayWidth: size * 1.2,
        displayHeight: size * 1.2,
        duration: gameConfig.anim.timings.waveBumpMs,
        delay,
        yoyo: true,
        ease: 'Sine.easeOut',
        onStart: () => !this.sparkling[i] && this.flash(i),
      });
    }
  }

  /** Resting position and size of one cell's coin, value and label. */
  private rest(i: number) {
    const x = cellX(Math.floor(i / ROWS));
    const y = cellY(i % ROWS);
    const parts = [this.coins[i], this.tags[i], this.values[i], this.labels[i], this.flashes[i]];
    this.scene.tweens.killTweensOf(parts.slice(0, 4)); // flashes keep a running sparkle
    this.scene.tweens.killTweensOf(this.values[i]);
    const cell = sd(layout.cell);
    this.coins[i]
      .setPosition(x, y)
      .setAlpha(1)
      .setDisplaySize(cell * COIN_FILL, cell * COIN_FILL);
    const tag = this.tags[i];
    const tw = cell * TAG.w;
    tag
      .setPosition(x, y + cell * TAG.dy)
      .setAlpha(1)
      .setDisplaySize(tw, (tw * tag.height) / tag.width);
    this.values[i]
      .setPosition(x, y + cell * TAG.dy)
      .setAlpha(1)
      .setScale(1)
      .setStroke(THEME.stroke, sd(3));
    this.labels[i]
      .setPosition(x, y - cell * 0.06)
      .setAlpha(1)
      .setStroke(THEME.stroke, sd(6));
    this.flashes[i].setPosition(x, y);
  }

  /** Coin values like $4,000.00 must stay inside the plaque. */
  private fitValue(i: number) {
    fitText(this.values[i], sd(layout.cell * TAG.font), sd(layout.cell) * TAG.w * 0.78);
  }

  /** refill = a new coin reset the respins (pips refill with a stagger). */
  private setBar(respinsLeft: number, shown: number, round: HoldAndWinRound, refill = false) {
    // a capped round's coins can add up past the cap; never show more than the response total
    const total = `TOTAL ${formatMoney(Math.min(shown, round.totalWin))}`;
    this.ov.bar('RESPINS', total, Math.max(0, respinsLeft), refill);
  }

  private clearBoard() {
    this.filled.fill(false);
    this.scene.tweens.killTweensOf(this.flashes);
    this.sparkling.fill(false);
    for (let i = 0; i < CELLS; i++) {
      this.coins[i].setVisible(false);
      this.tags[i].setVisible(false);
      this.values[i].setVisible(false);
      this.labels[i].setVisible(false);
      this.flashes[i].setVisible(false);
    }
    this.drawShimmer();
  }

  private showBoard(on: boolean) {
    this.board.setVisible(on);
    this.shimmer.setVisible(on);
    if (!on) {
      this.clearBoard();
      this.setShimmer(false);
    }
  }

  private setShimmer(on: boolean) {
    if (on) this.shimmerPulse.resume();
    else {
      this.shimmerPulse.pause();
      this.shimmer.setAlpha(1);
    }
  }

  /** Empty cells: lighter slots that pulse while a respin is "spinning". */
  private drawShimmer() {
    const g = this.shimmer.clear();
    const cell = sd(layout.cell);
    g.fillStyle(0x1c2a5e, 1);
    for (let i = 0; i < CELLS; i++) {
      if (this.filled[i]) continue;
      g.fillRoundedRect(
        cellX(Math.floor(i / ROWS)) - cell * 0.44,
        cellY(i % ROWS) - cell * 0.44,
        cell * 0.88,
        cell * 0.88,
        sd(18),
      );
    }
  }

  relayout(l: Layout) {
    this.ov.relayout(l);
    const cell = sd(l.cell);
    this.board
      .clear()
      .fillStyle(THEME.reelBack, 1)
      .fillRect(sx(l.reel.x), sy(l.reel.y), sd(l.reel.w), sd(l.reel.h));
    for (let i = 0; i < CELLS; i++) {
      this.rest(i); // also cancels a drop in flight, so a resize never leaves a coin offset
      this.fitValue(i);
      this.labels[i].setFontSize(Math.round(sd(l.cell * 0.12)));
      if (this.flashes[i].visible) this.flashes[i].setDisplaySize(cell * 1.3, cell * 1.3);
    }
    this.drawShimmer();
  }
}
