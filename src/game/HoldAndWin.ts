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
import type { WinPresenter } from './WinPresenter';

const CELLS = REELS * ROWS;
const FONT = THEME.fonts.numeric;
const cfg = gameConfig.holdAndWin;
/** Coin display size relative to the cell. */
const COIN_FILL = 0.9;
/** Grand wave: delay per diagonal step, and how long the wave runs before the banner. */
const WAVE_STEP_MS = 60;
const WAVE_MS = 6 * WAVE_STEP_MS + 360;
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
  private labels: Phaser.GameObjects.Text[] = [];
  /** one glow per cell, behind its coin: landing flash, or a looping sparkle for jackpots */
  private flashes: Phaser.GameObjects.Image[] = [];
  private sparkling: boolean[] = new Array(CELLS).fill(false);
  private filled: boolean[] = new Array(CELLS).fill(false);

  constructor(
    scene: Phaser.Scene,
    private presenter: WinPresenter,
  ) {
    this.scene = scene;
    this.tl = new Timeline(scene);
    this.ov = new FeatureOverlay(scene, {
      dim: 0x001018,
      edge: 0xffc23d,
      title: '#ffd34d',
      sub: '#ffffff',
      stroke: '#5a2a00',
    });
    this.board = scene.add.graphics().setDepth(DEPTH.FEATURE_OVERLAY).setVisible(false);
    this.shimmer = scene.add.graphics().setDepth(DEPTH.FEATURE_OVERLAY).setVisible(false);
    this.shimmerPulse = scene.tweens.add({
      targets: this.shimmer,
      alpha: 0.15,
      duration: 180,
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
      this.values.push(
        scene.add
          .text(0, 0, '', { fontFamily: FONT, color: '#4a1f00' })
          .setOrigin(0.5)
          .setDepth(DEPTH.FEATURE_OVERLAY)
          .setVisible(false),
      );
      this.labels.push(
        scene.add
          .text(0, 0, '', { fontFamily: FONT, color: '#4a1f00' })
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
    this.setBar(resumed ? round.respins[startAt - 1].respinsLeft : round.awarded, shown, round);

    for (let i = startAt; i < round.respins.length; i++) {
      const r = round.respins[i];
      this.setShimmer(true);
      await tl.wait(turbo ? cfg.respinMs / 2 : cfg.respinMs);
      this.setShimmer(false);
      tl.reset();
      for (let c = 0; c < r.coins.length; c++) {
        shown += this.placeCoin(r.coins[c]);
        await tl.wait(cfg.landStepMs);
      }
      tl.reset();
      this.setBar(r.respinsLeft, shown, round);
      if (r.coins.length > 0) this.ov.popBar('left', true); // respins reset
      onStep?.(i + 1);
    }

    if (round.grand > 0) {
      this.wave();
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

  /** Show one coin from the response; returns its value for the running display. */
  /**
   * Show one coin from the response; returns its value for the running display.
   * animate = drop into the cell with a bounce + flash; false = appear in place (resume rebuild).
   */
  private placeCoin(c: Coin, animate = true) {
    const i = c.pos;
    this.filled[i] = true;
    this.coins[i].setVisible(true).setTint(c.jackpot ? JACKPOT_TINT[c.jackpot] : 0xffffff);
    this.values[i].setText(formatMoney(c.value)).setVisible(true);
    this.fitValue(i);
    this.labels[i].setText(c.jackpot ? c.jackpot.toUpperCase() : '').setVisible(!!c.jackpot);
    this.rest(i);
    this.drawShimmer();
    if (c.jackpot) this.sparkle(i, JACKPOT_TINT[c.jackpot]);
    if (animate) {
      this.onCoin?.();
      this.drop(i, !c.jackpot);
    }
    return c.value;
  }

  /** Coin, value and label fall into the cell and bounce; a flash bursts as it lands. */
  private drop(i: number, flash: boolean) {
    const parts = [this.coins[i], this.values[i], this.labels[i]];
    const dy = sd(layout.cell * 0.7);
    for (const p of parts) p.setY(p.y - dy).setAlpha(0);
    this.scene.tweens.add({
      targets: parts,
      y: `+=${dy}`,
      alpha: 1,
      duration: 380,
      ease: 'Bounce.easeOut',
      onComplete: () => flash && this.flash(i),
    });
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
      duration: 320,
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
      duration: 520,
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
        duration: 160,
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
    const parts = [this.coins[i], this.values[i], this.labels[i], this.flashes[i]];
    this.scene.tweens.killTweensOf(parts.slice(0, 3)); // flashes keep a running sparkle
    const cell = sd(layout.cell);
    this.coins[i]
      .setPosition(x, y)
      .setAlpha(1)
      .setDisplaySize(cell * COIN_FILL, cell * COIN_FILL);
    this.values[i].setPosition(x, y + sd(10)).setAlpha(1);
    this.labels[i].setPosition(x, y - sd(layout.cell * 0.2)).setAlpha(1);
    this.flashes[i].setPosition(x, y);
  }

  /** Coin values like $4,000.00 must stay inside the coin. */
  private fitValue(i: number) {
    fitText(this.values[i], sd(layout.cell * 0.17), sd(layout.cell) * COIN_FILL * 0.78);
  }

  private setBar(respinsLeft: number, shown: number, round: HoldAndWinRound) {
    // a capped round's coins can add up past the cap; never show more than the response total
    this.ov.bar(`RESPINS ${respinsLeft}`, `TOTAL ${formatMoney(Math.min(shown, round.totalWin))}`);
  }

  private clearBoard() {
    this.filled.fill(false);
    this.scene.tweens.killTweensOf(this.flashes);
    this.sparkling.fill(false);
    for (let i = 0; i < CELLS; i++) {
      this.coins[i].setVisible(false);
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
    g.fillStyle(0x3a2a5c, 1);
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
      .fillStyle(0x140a24, 1)
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
