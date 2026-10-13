import Phaser from 'phaser';
import { DEPTH, THEME } from '../constants';
import { gameConfig, type SpinTiming } from '../gameConfig';
import { REELS, ROWS } from '../math/config';
import type { SymbolId } from '../rgs/types';
import { sd, sx, sy, type Layout } from '../utils/responsive';
import { ART } from '../theme/parolNights';
import { SymbolView } from './Symbol';
import type { AnimationService } from './animation/AnimationService';
import { ReelAnimator } from './animation/ReelAnimator';
import { SymbolAnimator } from './animation/SymbolAnimator';
import type { AnimationHandle } from './animation/AnimationHandle';

/** Symbols per reel: visible rows plus one buffer above and below. */
const SLOTS = ROWS + 2;
/** Symbol display size relative to the cell. */
const SYMBOL_FILL = 1.05; // delivered art has a ~7.5% transparent margin: ~89% visible
const TEASE = gameConfig.anim.anticipation;

type Strips = readonly (readonly SymbolId[])[];

/** Masked reel window with pooled symbols; spins on strips, lands on the response grid. */
export class Reels {
  private container: Phaser.GameObjects.Container;
  private back: Phaser.GameObjects.Graphics;
  private front: Phaser.GameObjects.Image;
  private highlights: Phaser.GameObjects.Container;
  private maskShape: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Graphics;
  /** anticipation vignette over the reels that are not teased */
  private shade: Phaser.GameObjects.Graphics;
  private glowPulse: Phaser.Tweens.Tween;
  /** reels glowing right now */
  private glowing: boolean[] = new Array(REELS).fill(false);
  /** window rect in canvas px, kept for glow redraws */
  private win = { x: 0, y: 0, h: 0 };
  /** [reel][slot], slot 0 is the hidden buffer above row 0. Rotated in place while spinning. */
  private cols: SymbolView[][] = [];
  private strips: Strips;
  /** last landed grid, restored by halt() */
  private grid: SymbolId[][] = [];
  private cell = 0;
  /** current offset per reel in cells, kept so relayout can re-place a moving reel */
  private offsets: number[] = new Array(REELS).fill(0);
  /** symbol states: idle, land, win, dim */
  private symbols: SymbolAnimator;
  /** reel motion; it drives the views through the callbacks given in the constructor */
  private motion: ReelAnimator;

  constructor(
    scene: Phaser.Scene,
    private anim: AnimationService,
    strips: Strips,
    grid: readonly SymbolId[][],
  ) {
    this.strips = strips;
    this.back = scene.add.graphics().setDepth(DEPTH.REEL_FRAME_BACK);
    this.front = scene.add.image(0, 0, ART.frame.key).setDepth(DEPTH.REEL_FRAME_FRONT);
    this.highlights = scene.add.container(0, 0).setDepth(DEPTH.SYMBOL_HIGHLIGHT);
    this.container = scene.add.container(0, 0).setDepth(DEPTH.REELS);
    this.maskShape = scene.make.graphics({}, false);
    this.container.setMask(this.maskShape.createGeometryMask());
    this.glow = scene.add.graphics().setDepth(DEPTH.REEL_FRAME_FRONT);
    this.shade = scene.add.graphics().setDepth(DEPTH.SYMBOL_HIGHLIGHT);
    this.glowPulse = scene.tweens.add({
      targets: this.glow,
      alpha: 0.35,
      duration: gameConfig.anim.timings.teaseGlowPulseMs,
      yoyo: true,
      repeat: -1,
      paused: true,
      persist: true,
    });

    for (let r = 0; r < REELS; r++) {
      const col: SymbolView[] = [];
      for (let i = 0; i < SLOTS; i++) col.push(new SymbolView(scene, this.container, 'L1'));
      this.cols.push(col);
      this.grid.push([]);
    }
    this.motion = new ReelAnimator(
      anim,
      {
        shift: (r, id) => this.shift(r, id),
        place: (r, offset) => this.place(r, offset),
        setBlur: (r, on) => this.setBlur(r, on),
        snap: (r, above) => this.snap(r, above),
        landed: (r, snapped) => this.symbols.landed(r, snapped),
        tease: (r, on) => this.tease(r, on),
      },
      strips,
    );
    this.symbols = new SymbolAnimator(
      scene,
      anim,
      this.highlights,
      (r, row) => this.cols[r][row + 1],
    );
    this.setGrid(grid);
  }

  /** Swap the strips used for the visual spin (base <-> free spins). Takes effect next spin. */
  setStrips(strips: Strips) {
    this.strips = strips;
    this.motion.setStrips(strips);
  }

  /** Show a grid directly (idle / resume / error halt). */
  setGrid(grid: readonly SymbolId[][]) {
    for (let r = 0; r < REELS; r++) {
      const strip = this.strips[r];
      const col = this.cols[r];
      col[0].set(strip[0]);
      for (let row = 0; row < ROWS; row++) {
        this.grid[r][row] = grid[r][row];
        col[row + 1].set(grid[r][row]);
      }
      col[SLOTS - 1].set(strip[1]);
      this.setBlur(r, false);
      this.place(r, 0);
    }
    this.symbols.reset();
  }

  /** Idle sway / breathe while the state machine sits in Idle. */
  setIdle(on: boolean) {
    this.symbols.setIdle(on);
  }

  /** Start all reels. Landing is scheduled later by stop(). */
  spin(timing: SpinTiming) {
    this.symbols.spinStart();
    this.motion.spin(timing);
  }

  /**
   * Land on the response. Reel r lands one stagger after reel r - 1, or one anticipation
   * delay when tease[r] is set. quick snaps every reel to the grid at once.
   */
  stop(
    stops: readonly number[],
    grid: readonly SymbolId[][],
    quick: boolean,
    tease?: readonly boolean[],
  ): Promise<void> {
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) this.grid[r][row] = grid[r][row];
    }
    return this.motion.stop(stops, grid, quick, tease);
  }

  /** Win cells (index reel * ROWS + row) pop and breathe, the rest dim; null restores all. */
  highlight(mask: readonly boolean[] | null) {
    this.symbols.highlight(mask);
  }

  /** True if the visible window shows exactly this grid (dev assertion after landing). */
  shows(grid: readonly SymbolId[][]) {
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++)
        if (this.cols[r][row + 1].id !== grid[r][row]) return false;
    }
    return true;
  }

  /** Quick stop: every reel with a known result snaps to it now, without anticipation. */
  slam() {
    this.motion.slam();
  }

  /** Abort a spin without a result (RGS error): snap back to the last landed grid. */
  halt() {
    this.motion.halt();
    this.setGrid(this.grid);
  }

  update(dtMs: number) {
    this.motion.update(dtMs);
    this.symbols.update(dtMs);
  }

  /** Reel r shows its landed column at rest (skip). above = strip symbol above row 0. */
  private snap(r: number, above: SymbolId) {
    const col = this.cols[r];
    col[0].set(above);
    for (let row = 0; row < ROWS; row++) col[row + 1].set(this.grid[r][row]);
    this.place(r, 0);
  }

  /**
   * Anticipation on reel r (-1 = all off): glow + vignette, and the symbols that make the trigger
   * possible pulse. Contributors are counted on the reels already landed, as `utils/anticipation` does.
   */
  private tease(r: number, on: boolean) {
    this.setGlow(r, on);
    if (!on) return this.symbols.setTease(false, false);
    let scatters = 0;
    let coins = 0;
    for (let c = 0; c < r; c++) {
      for (let row = 0; row < ROWS; row++) {
        if (this.grid[c][row] === 'SCATTER') scatters++;
        else if (this.grid[c][row] === 'COIN') coins++;
      }
    }
    const t = gameConfig.anticipation;
    this.symbols.setTease(scatters >= t.scatter, coins >= t.coin);
  }

  /** Feature trigger on every visible `id` (from the response grid); the rest dim. Skippable handle. */
  trigger(id: SymbolId): AnimationHandle {
    const mask: boolean[] = [];
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) mask.push(this.grid[r][row] === id);
    }
    return this.symbols.trigger(mask);
  }

  /** Toggle one reel's glow (r = -1: all off) and redraw. */
  private setGlow(r: number, on: boolean) {
    if (r < 0) this.glowing.fill(false);
    else this.glowing[r] = on;
    this.drawGlow();
  }

  private drawGlow() {
    const g = this.glow.clear();
    const shade = this.shade.clear();
    let any = false;
    for (let r = 0; r < REELS; r++) {
      if (!this.glowing[r]) continue;
      any = true;
      const x = this.win.x + r * this.cell;
      g.fillStyle(0xffc23d, 0.18).fillRoundedRect(x, this.win.y, this.cell, this.win.h, sd(14));
      g.lineStyle(sd(8), 0xffd34d, TEASE.glowAlpha).strokeRoundedRect(
        x + sd(4),
        this.win.y + sd(4),
        this.cell - sd(8),
        this.win.h - sd(8),
        sd(14),
      );
    }
    if (any) {
      shade.fillStyle(0x000000, TEASE.vignetteAlpha);
      for (let r = 0; r < REELS; r++) {
        if (!this.glowing[r])
          shade.fillRect(this.win.x + r * this.cell, this.win.y, this.cell, this.win.h);
      }
    }
    // reduced motion: a steady glow, no pulse
    if (any && !this.anim.reduced && this.glowPulse.isPaused()) this.glowPulse.resume();
    if (!any || this.anim.reduced) {
      this.glowPulse.pause();
      this.glow.setAlpha(1);
    }
  }

  private setBlur(r: number, on: boolean) {
    for (let i = 0; i < SLOTS; i++) this.cols[r][i].setBlur(on);
  }

  /** Everything moves down one slot; the bottom view wraps to the top with a new symbol. */
  private shift(r: number, id: SymbolId) {
    const col = this.cols[r];
    const v = col.pop()!;
    v.set(id);
    col.unshift(v);
  }

  private place(r: number, offset: number) {
    this.offsets[r] = offset;
    const col = this.cols[r];
    const y0 = (offset - 0.5) * this.cell;
    for (let i = 0; i < SLOTS; i++) col[i].root.y = y0 + i * this.cell;
  }

  relayout(l: Layout) {
    const x = sx(l.reel.x);
    const y = sy(l.reel.y);
    const w = sd(l.reel.w);
    const h = sd(l.reel.h);
    const cell = (this.cell = sd(l.cell));
    const pad = sd(18);

    this.container.setPosition(x, y);
    this.highlights.setPosition(x, y);
    for (let r = 0; r < REELS; r++) {
      for (let i = 0; i < SLOTS; i++) {
        this.cols[r][i].root.setX((r + 0.5) * cell);
        this.cols[r][i].resize(cell * SYMBOL_FILL);
      }
      this.place(r, this.offsets[r]);
    }

    this.symbols.relayout(cell, x, y);

    this.maskShape.clear().fillStyle(0xffffff).fillRect(x, y, w, h);
    this.win.x = x;
    this.win.y = y;
    this.win.h = h;
    this.drawGlow();

    this.back.clear();
    this.back
      .fillStyle(THEME.reelBack, 0.92)
      .fillRoundedRect(x - pad, y - pad, w + pad * 2, h + pad * 2, sd(28));
    this.back.fillStyle(THEME.reelColumn, 1);
    for (let r = 0; r < REELS; r++) {
      this.back.fillRoundedRect(x + r * cell + sd(4), y, cell - sd(8), h, sd(14));
    }

    this.front
      .setPosition(sx(l.frame.x + l.frame.w / 2), sy(l.frame.y + l.frame.h / 2))
      .setDisplaySize(sd(l.frame.w), sd(l.frame.h));
  }
}
