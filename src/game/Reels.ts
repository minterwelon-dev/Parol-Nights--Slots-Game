import Phaser from 'phaser';
import { DEPTH, THEME } from '../constants';
import type { SpinTiming } from '../gameConfig';
import { REELS, ROWS } from '../math/config';
import type { SymbolId } from '../rgs/types';
import { sd, sx, sy, type Layout } from '../utils/responsive';
import { UI } from '../scenes/BootScene';
import { SymbolView } from './Symbol';

/** Symbols per reel: visible rows plus one buffer above and below. */
const SLOTS = ROWS + 2;
/** Symbol display size relative to the cell. */
const SYMBOL_FILL = 0.92;
/** Symbols fed in on landing: the result column bottom-up, then the strip symbol above it. */
const LANDING = ROWS + 1;
/** Largest motion carried into the bounce, in cells; avoids a visible pop at high speed. */
const MAX_CARRY = 0.3;
/** Alpha of non-winning symbols during win display. */
const DIMMED = 0.35;
/** Peak size growth of a winning symbol during its pulse. */
const WIN_GROW = 0.06;
/** Fraction of full speed above which symbols switch to their motion-blur textures. */
const BLUR_AT = 0.6;
/** Landing pop for SCATTER / COIN: peak size growth and duration. */
const LAND_POP = 0.18;
const LAND_POP_MS = 280;

type Strips = readonly (readonly SymbolId[])[];

/** Per-reel motion state. Allocated once, reused every spin. */
interface Run {
  spinning: boolean;
  /** strip index of the last symbol fed into slot 0 */
  top: number;
  /** downward offset in cells, [0, 1) while moving */
  offset: number;
  /** cells per second */
  speed: number;
  /** reel clock time when landing starts; Infinity = not scheduled */
  stopAt: number;
  landing: boolean;
  /** views currently show motion-blur textures */
  blurred: boolean;
  feed: SymbolId[];
  fed: number;
  /** ms into the bounce, -1 = not bouncing */
  bounceT: number;
  /** offset at the moment of landing, eased out during the bounce */
  carry: number;
  /** anticipation: extra delay before landing and a glow once the previous reel lands */
  tease: boolean;
  /** ms into the start wind-up; negative = waiting for this reel's stagger */
  windT: number;
}

/** Masked reel window with pooled symbols; spins on strips, lands on the response grid. */
export class Reels {
  private container: Phaser.GameObjects.Container;
  private back: Phaser.GameObjects.Graphics;
  private front: Phaser.GameObjects.Graphics;
  private maskShape: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Graphics;
  private glowPulse: Phaser.Tweens.Tween;
  /** win animation: one soft glow per visible cell (reel * ROWS + row) behind the symbols */
  private winGlows: Phaser.GameObjects.Image[] = [];
  private winMask: boolean[] = new Array(REELS * ROWS).fill(false);
  /** running landing pop per cell; its glow finishes fading even when highlight() hides the others */
  private pops: (Phaser.Tweens.Tween | undefined)[] = new Array(REELS * ROWS).fill(undefined);
  /** single persistent tween; k goes 0..1..0 while a win is shown */
  private winPulse: Phaser.Tweens.Tween;
  private pulse = { k: 0 };
  /** reels glowing right now */
  private glowing: boolean[] = new Array(REELS).fill(false);
  /** window rect in canvas px, kept for glow redraws */
  private win = { x: 0, y: 0, h: 0 };
  /** [reel][slot], slot 0 is the hidden buffer above row 0. Rotated in place while spinning. */
  private cols: SymbolView[][] = [];
  private runs: Run[] = [];
  private strips: Strips;
  /** last landed grid, restored by halt() */
  private grid: SymbolId[][] = [];
  private cell = 0;
  private clock = 0;
  private timing!: SpinTiming;
  private pending = 0;
  private done?: () => void;
  /** presentation hooks (sound); GameScene wires them */
  hooks: { spin?(): void; land?(reel: number): void; tease?(reel: number): void } = {};

  constructor(
    private scene: Phaser.Scene,
    strips: Strips,
    grid: readonly SymbolId[][],
  ) {
    this.strips = strips;
    this.back = scene.add.graphics().setDepth(DEPTH.REEL_FRAME_BACK);
    this.front = scene.add.graphics().setDepth(DEPTH.REEL_FRAME_FRONT);
    this.container = scene.add.container(0, 0).setDepth(DEPTH.REELS);
    this.maskShape = scene.make.graphics({}, false);
    this.container.setMask(this.maskShape.createGeometryMask());
    this.glow = scene.add.graphics().setDepth(DEPTH.REEL_FRAME_FRONT);
    this.glowPulse = scene.tweens.add({
      targets: this.glow,
      alpha: 0.35,
      duration: 260,
      yoyo: true,
      repeat: -1,
      paused: true,
      persist: true,
    });

    // glows first so they render behind every symbol inside the masked container
    for (let i = 0; i < REELS * ROWS; i++) {
      this.winGlows.push(scene.add.image(0, 0, UI.glow).setVisible(false));
    }
    this.container.add(this.winGlows);
    this.winPulse = scene.tweens.add({
      targets: this.pulse,
      k: 1,
      duration: 380,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      paused: true,
      persist: true,
      onUpdate: () => this.applyPulse(),
    });

    for (let r = 0; r < REELS; r++) {
      const col: SymbolView[] = [];
      for (let i = 0; i < SLOTS; i++) col.push(new SymbolView(scene, this.container, 'L1'));
      this.cols.push(col);
      this.grid.push([]);
      this.runs.push({
        spinning: false,
        top: 0,
        offset: 0,
        speed: 0,
        stopAt: Infinity,
        landing: false,
        feed: new Array<SymbolId>(LANDING).fill('L1'),
        fed: 0,
        bounceT: -1,
        carry: 0,
        tease: false,
        blurred: false,
        windT: 0,
      });
    }
    this.setGrid(grid);
  }

  /** Swap the strips used for the visual spin (base <-> free spins). Takes effect next spin. */
  setStrips(strips: Strips) {
    this.strips = strips;
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
      this.runs[r].offset = 0;
      this.setBlur(r, false);
      this.place(r);
    }
  }

  /** Start all reels. Landing is scheduled later by stop(). */
  spin(timing: SpinTiming) {
    this.hooks.spin?.();
    this.timing = timing;
    this.pending = REELS;
    for (let r = 0; r < REELS; r++) {
      const run = this.runs[r];
      run.spinning = true;
      run.speed = 0;
      run.stopAt = Infinity;
      run.landing = false;
      run.fed = 0;
      run.bounceT = -1;
      run.windT = -r * timing.windUpStaggerMs;
    }
  }

  /**
   * Land on the response. Reel r lands one stagger after reel r - 1, or one anticipation
   * delay when tease[r] is set. quick drops all delays and anticipation.
   */
  stop(
    stops: readonly number[],
    grid: readonly SymbolId[][],
    quick: boolean,
    tease?: readonly boolean[],
  ): Promise<void> {
    let at = this.clock;
    for (let r = 0; r < REELS; r++) {
      const strip = this.strips[r];
      const run = this.runs[r];
      for (let row = 0; row < ROWS; row++) {
        run.feed[row] = grid[r][ROWS - 1 - row];
        this.grid[r][row] = grid[r][row];
      }
      run.feed[ROWS] = strip[(stops[r] - 1 + strip.length) % strip.length];
      run.top = stops[r] - 1;
      run.tease = !quick && !!tease?.[r];
      if (r > 0 && !quick) at += run.tease ? this.timing.anticipationMs : this.timing.stopStaggerMs;
      run.stopAt = at;
    }
    return new Promise((resolve) => {
      this.done = resolve;
      if (this.pending === 0) resolve();
    });
  }

  /** Dim every visible symbol not in mask (index reel * ROWS + row); null restores all. */
  highlight(mask: readonly boolean[] | null) {
    let any = false;
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        const i = r * ROWS + row;
        const win = !!mask && mask[i];
        this.winMask[i] = win;
        any ||= win;
        this.cols[r][row + 1].img.setAlpha(!mask || win ? 1 : DIMMED);
        this.winGlows[i].setVisible(win || !!this.pops[i]);
      }
    }
    if (any) {
      if (this.winPulse.isPaused()) this.winPulse.resume();
    } else {
      this.winPulse.pause();
      this.pulse.k = 0;
      this.applyPulse(); // back to resting sizes before anything spins
    }
  }

  /** Winning symbols breathe in size (setDisplaySize, never setScale) and their glow brightens. */
  private applyPulse() {
    const k = this.pulse.k;
    const base = this.cell * SYMBOL_FILL;
    const grown = base * (1 + WIN_GROW * k);
    const glow = this.cell * (1.15 + 0.1 * k);
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        const i = r * ROWS + row;
        const s = this.winMask[i] ? grown : base;
        this.cols[r][row + 1].img.setDisplaySize(s, s);
        if (this.winMask[i]) this.winGlows[i].setDisplaySize(glow, glow).setAlpha(0.35 + 0.5 * k);
      }
    }
  }

  /** True if the visible window shows exactly this grid (dev assertion after landing). */
  shows(grid: readonly SymbolId[][]) {
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++)
        if (this.cols[r][row + 1].id !== grid[r][row]) return false;
    }
    return true;
  }

  /** Quick stop: every reel not yet landing lands now, without anticipation. */
  slam() {
    for (let r = 0; r < REELS; r++) {
      const run = this.runs[r];
      run.tease = false;
      if (run.stopAt !== Infinity && !run.landing) run.stopAt = this.clock;
    }
    this.setGlow(-1, false);
  }

  /** Abort a spin without a result (RGS error): snap back to the last landed grid. */
  halt() {
    for (let r = 0; r < REELS; r++) this.runs[r].spinning = false;
    this.pending = 0;
    this.setGlow(-1, false);
    this.setGrid(this.grid);
  }

  update(dtMs: number) {
    if (this.pending === 0) return;
    this.clock += dtMs;
    const t = this.timing;
    for (let r = 0; r < REELS; r++) {
      const run = this.runs[r];
      if (!run.spinning) continue;

      if (run.bounceT >= 0) {
        run.bounceT += dtMs;
        const k = Math.min(run.bounceT / t.bounceMs, 1);
        // ease the carried motion out while dipping past the stop and back
        run.offset = run.carry * (1 - k) * (1 - k) + t.bounceAmp * Math.sin(Math.PI * k);
        if (k === 1) {
          run.offset = 0;
          run.spinning = false;
          run.bounceT = -1;
          this.landed(r);
          if (--this.pending === 0) this.done?.();
        }
        this.place(r);
        continue;
      }

      if (run.windT < t.windUpMs) {
        // wind-up: nudge up and settle back before the drop (a stop can't land before it ends)
        run.windT += dtMs;
        const k = Math.min(Math.max(run.windT / t.windUpMs, 0), 1);
        run.offset = -t.windUpAmp * Math.sin(Math.PI * k);
        this.place(r);
        continue;
      }

      if (!run.landing && this.clock >= run.stopAt) run.landing = true;
      run.speed = Math.min(t.speed, run.speed + (t.speed * dtMs) / t.accelMs);
      this.setBlur(r, run.speed >= BLUR_AT * t.speed);
      run.offset += (run.speed * dtMs) / 1000;

      while (run.offset >= 1) {
        run.offset -= 1;
        if (run.landing) {
          this.shift(r, run.feed[run.fed++]);
          if (run.fed === LANDING) {
            run.carry = Math.min(run.offset, MAX_CARRY);
            run.bounceT = 0;
            this.setBlur(r, false); // land sharp: the result must read clearly
            run.offset = run.carry;
            break;
          }
        } else {
          const strip = this.strips[r];
          run.top = (run.top - 1 + strip.length) % strip.length;
          this.shift(r, strip[run.top]);
        }
      }
      this.place(r);
    }
  }

  /** Reel r finished its bounce: its glow ends, the next teased reel starts glowing. */
  private landed(r: number) {
    this.hooks.land?.(r);
    this.setGlow(r, false);
    for (let row = 0; row < ROWS; row++) {
      const id = this.grid[r][row];
      if (id === 'SCATTER' || id === 'COIN') this.landPop(r, row);
    }
    if (r + 1 < REELS && this.runs[r + 1].tease && this.runs[r + 1].spinning) {
      this.setGlow(r + 1, true);
      this.hooks.tease?.(r + 1);
    }
  }

  /** Feature symbol settles: quick size bump plus a fading glow burst. Win display owns the cell once set. */
  private landPop(r: number, row: number) {
    const i = r * ROWS + row;
    const img = this.cols[r][row + 1].img;
    const glow = this.winGlows[i].setVisible(true);
    this.pops[i]?.stop(); // same cell landed again before the last pop ended
    this.pops[i] = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: LAND_POP_MS,
      ease: 'Sine.easeOut',
      onUpdate: (t) => {
        if (this.winMask[i]) return;
        const k = t.getValue() ?? 1;
        const s = this.cell * SYMBOL_FILL * (1 + LAND_POP * Math.sin(Math.PI * k));
        const g = this.cell * (1 + 0.6 * k);
        img.setDisplaySize(s, s);
        glow.setDisplaySize(g, g).setAlpha(0.9 * (1 - k));
      },
      onComplete: () => {
        this.pops[i] = undefined;
        if (this.winMask[i]) return;
        img.setDisplaySize(this.cell * SYMBOL_FILL, this.cell * SYMBOL_FILL);
        glow.setVisible(false);
      },
    });
  }

  /** Toggle one reel's glow (r = -1: all off) and redraw. */
  private setGlow(r: number, on: boolean) {
    if (r < 0) this.glowing.fill(false);
    else this.glowing[r] = on;
    this.drawGlow();
  }

  private drawGlow() {
    const g = this.glow.clear();
    let any = false;
    for (let r = 0; r < REELS; r++) {
      if (!this.glowing[r]) continue;
      any = true;
      const x = this.win.x + r * this.cell;
      g.fillStyle(0xffc23d, 0.18).fillRoundedRect(x, this.win.y, this.cell, this.win.h, sd(14));
      g.lineStyle(sd(8), 0xffd34d, 1).strokeRoundedRect(
        x + sd(4),
        this.win.y + sd(4),
        this.cell - sd(8),
        this.win.h - sd(8),
        sd(14),
      );
    }
    if (any && this.glowPulse.isPaused()) this.glowPulse.resume();
    if (!any) {
      this.glowPulse.pause();
      this.glow.setAlpha(1);
    }
  }

  private setBlur(r: number, on: boolean) {
    const run = this.runs[r];
    if (run.blurred === on) return;
    run.blurred = on;
    for (let i = 0; i < SLOTS; i++) this.cols[r][i].setBlur(on);
  }

  /** Everything moves down one slot; the bottom view wraps to the top with a new symbol. */
  private shift(r: number, id: SymbolId) {
    const col = this.cols[r];
    const v = col.pop()!;
    v.set(id);
    col.unshift(v);
  }

  private place(r: number) {
    const col = this.cols[r];
    const y0 = (this.runs[r].offset - 0.5) * this.cell;
    for (let i = 0; i < SLOTS; i++) col[i].img.y = y0 + i * this.cell;
  }

  relayout(l: Layout) {
    const x = sx(l.reel.x);
    const y = sy(l.reel.y);
    const w = sd(l.reel.w);
    const h = sd(l.reel.h);
    const cell = (this.cell = sd(l.cell));
    const pad = sd(18);

    this.container.setPosition(x, y);
    for (let r = 0; r < REELS; r++) {
      for (let i = 0; i < SLOTS; i++) {
        this.cols[r][i].img
          .setX((r + 0.5) * cell)
          .setDisplaySize(cell * SYMBOL_FILL, cell * SYMBOL_FILL);
      }
      this.place(r);
    }

    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        this.winGlows[r * ROWS + row].setPosition((r + 0.5) * cell, (row + 0.5) * cell);
      }
    }
    this.applyPulse();

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

    this.front.clear();
    this.front
      .lineStyle(sd(6), THEME.frame, 1)
      .strokeRoundedRect(x - pad, y - pad, w + pad * 2, h + pad * 2, sd(28));
  }
}
