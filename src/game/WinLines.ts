import Phaser from 'phaser';
import { DEPTH, THEME } from '../constants';
import { gameConfig } from '../gameConfig';
import { REELS, ROWS } from '../math/config';
import { PAYLINES } from '../math/paylines'; // line geometry, shared with the math
import type { LineWin } from '../rgs/types';
import { UI } from '../scenes/BootScene';
import { formatMoney } from '../utils/format';
import { cellX, cellY, layout, sd } from '../utils/responsive';
import type { Reels } from './Reels';
import { ANIM_EVENTS, type AnimationService } from './animation/AnimationService';

const LINE = gameConfig.anim.line;

const COLORS = [0xffd34d, 0x4dd2ff, 0xff6b8b, 0x8bff6b, 0xc58bff, 0xff9f43, 0x43ffd1, 0xff43c8];
const ALL_COLOR = 0xffd34d;

/**
 * Payline + winning-cell renderer: one Graphics for the lines (redrawn on change) and one pooled
 * tinted frame image per cell. Cell frames are images, not Graphics: Phaser re-tessellates Graphics
 * every frame, and 70 rounded strokes cost ~36 ms a frame at 4x CPU throttle during a big win.
 */
export class WinLines {
  private lines: Phaser.GameObjects.Graphics;
  /** winning-cell frames, index reel * ROWS + row; the container pulses */
  private cells: Phaser.GameObjects.Container;
  private frames: Phaser.GameObjects.Image[] = [];
  private label: Phaser.GameObjects.Text;
  private pulse: Phaser.Tweens.Tween;
  /** line draw-in, 0..1 left to right; one persistent tween, restarted whenever the shown lines change */
  private reveal = { p: 1 };
  private revealTween: Phaser.Tweens.Tween;
  private cycleTimer: Phaser.Time.TimerEvent;
  private mask: boolean[] = new Array(REELS * ROWS).fill(false);
  private wins: readonly LineWin[] = [];
  private cycleIdx = 0;
  /** what is drawn now, so relayout can redraw it: -1 none, -2 all lines, else index into wins */
  private showing = -1;

  constructor(
    scene: Phaser.Scene,
    private reels: Reels,
    private anim: AnimationService,
  ) {
    for (let i = 0; i < REELS * ROWS; i++) {
      this.frames.push(scene.add.image(0, 0, UI.cellFrame).setVisible(false));
    }
    this.cells = scene.add.container(0, 0, this.frames).setDepth(DEPTH.SYMBOL_HIGHLIGHT);
    this.lines = scene.add.graphics().setDepth(DEPTH.LINE_WINS);
    this.label = scene.add
      .text(0, 0, '', {
        fontFamily: THEME.fonts.numeric,
        color: '#fff6d0',
        stroke: THEME.stroke,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.LINE_WINS)
      .setVisible(false);
    this.pulse = scene.tweens.add({
      targets: this.cells,
      alpha: 0.35,
      duration: gameConfig.anim.timings.framePulseMs,
      yoyo: true,
      repeat: -1,
      paused: true,
      persist: true,
    });
    this.revealTween = scene.tweens.add({
      targets: this.reveal,
      p: { from: 0, to: 1 },
      duration: LINE.drawMs,
      ease: 'Sine.easeOut',
      paused: true,
      persist: true,
      onUpdate: () => this.drawLines(),
    });
    this.cycleTimer = scene.time.addEvent({
      delay: LINE.drawMs + LINE.holdMs,
      loop: true,
      paused: true,
      callback: this.nextLine,
      callbackScope: this,
    });
  }

  /** All winning lines and cells at once. */
  showAll(wins: readonly LineWin[]) {
    this.wins = wins;
    this.showing = -2;
    this.cycleTimer.paused = true;
    this.draw();
  }

  /** Loop through the winning lines one by one until clear(). Non-blocking. */
  cycle(wins: readonly LineWin[]) {
    if (wins.length === 0) return;
    this.wins = wins;
    this.cycleIdx = 0;
    this.showing = 0;
    this.draw();
    if (wins.length > 1) {
      this.cycleTimer.elapsed = 0;
      this.cycleTimer.paused = false;
    }
  }

  clear() {
    this.showing = -1;
    this.cycleTimer.paused = true;
    this.draw();
  }

  relayout() {
    const size = sd(layout.cell) * 0.94;
    for (let i = 0; i < REELS * ROWS; i++) {
      this.frames[i]
        .setPosition(cellX(Math.floor(i / ROWS)), cellY(i % ROWS))
        .setDisplaySize(size, size);
    }
    this.draw(false);
  }

  private nextLine() {
    this.cycleIdx = (this.cycleIdx + 1) % this.wins.length;
    this.showing = this.cycleIdx;
    this.draw();
  }

  /** Restart the draw-in at the current (turbo-aware) duration. */
  private restartReveal() {
    // a persistent tween keeps its duration; set it before every restart so turbo applies
    (this.revealTween.data[0] as Phaser.Tweens.TweenData).duration = this.anim.dur(LINE.drawMs);
    this.revealTween.restart();
  }

  /** animate: lines draw in again (new lines shown); false keeps the current progress (relayout). */
  private draw(animate = true) {
    this.mask.fill(false);
    for (let i = 0; i < this.frames.length; i++) this.frames[i].setVisible(false);
    if (this.showing === -1) {
      this.lines.clear();
      this.revealTween.pause();
      this.pulse.pause();
      this.cells.setAlpha(1);
      this.label.setVisible(false);
      this.reels.highlight(null);
      return;
    }
    const one = this.showing >= 0;
    for (let i = this.from(); i < this.to(); i++) {
      const w = this.wins[i];
      const rows = PAYLINES[w.line];
      for (let r = 0; r < w.count; r++) {
        const c = r * ROWS + rows[r];
        this.mask[c] = true;
        this.frames[c].setVisible(true).setTint(this.color(w));
      }
    }
    if (animate) this.restartReveal();
    this.drawLines();
    this.reels.highlight(this.mask);
    // reduced motion: frames stay steady instead of pulsing
    if (this.anim.reduced) {
      this.pulse.pause();
      this.cells.setAlpha(1);
    } else if (this.pulse.isPaused()) this.pulse.resume();
    if (one && animate) this.anim.emit(ANIM_EVENTS.lineShown, this.wins[this.showing].line);

    if (one) {
      const w = this.wins[this.showing];
      const last = w.count - 1;
      this.label
        .setText(formatMoney(w.win))
        .setFontSize(Math.round(sd(46)))
        .setStroke(THEME.stroke, sd(8))
        .setPosition(cellX(last), cellY(PAYLINES[w.line][last]) + sd(layout.cell * 0.36))
        .setVisible(true);
    } else {
      this.label.setVisible(false);
    }
  }

  /** Range of wins drawn now: the cycled one, or all. */
  private from() {
    return this.showing >= 0 ? this.showing : 0;
  }

  private to() {
    return this.showing >= 0 ? this.showing + 1 : this.wins.length;
  }

  private color(w: LineWin) {
    return this.showing >= 0 ? COLORS[w.line % COLORS.length] : ALL_COLOR;
  }

  private drawLines() {
    this.lines.clear();
    if (this.showing === -1) return;
    // glowing stroke: a wide soft pass under the core line
    for (let i = this.from(); i < this.to(); i++) {
      this.drawLine(this.wins[i], this.reveal.p, sd(20), 0.22);
      this.drawLine(this.wins[i], this.reveal.p, sd(7), 0.95);
    }
  }

  /** Polyline lead-in, every reel center, lead-out; cut at fraction p of its width. */
  private drawLine(w: LineWin, p: number, width: number, alpha: number) {
    const rows = PAYLINES[w.line];
    const half = sd(layout.cell) * 0.5;
    const x0 = cellX(0) - half;
    const xEnd = x0 + p * (cellX(REELS - 1) + half - x0);
    let px = x0;
    let py = cellY(rows[0]);
    const g = this.lines.lineStyle(width, this.color(w), alpha).beginPath();
    g.moveTo(px, py);
    for (let i = 0; i <= REELS; i++) {
      const x = i < REELS ? cellX(i) : cellX(REELS - 1) + half;
      const y = cellY(rows[Math.min(i, REELS - 1)]);
      if (x >= xEnd) {
        g.lineTo(xEnd, py + ((y - py) * (xEnd - px)) / (x - px));
        break;
      }
      g.lineTo(x, y);
      px = x;
      py = y;
    }
    g.strokePath();
  }
}
