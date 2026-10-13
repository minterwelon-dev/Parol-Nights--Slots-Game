import Phaser from 'phaser';
import { DEPTH } from '../../constants';
import { gameConfig } from '../../gameConfig';
import { REELS, ROWS } from '../../math/config';
import type { SymbolId } from '../../rgs/types';
import { UI } from '../../scenes/BootScene';
import type { SymbolView } from '../Symbol';
import { AnimationHandle } from './AnimationHandle';
import { ANIM_EVENTS, type AnimationService } from './AnimationService';
import { FX } from './fxTextures';

const A = gameConfig.anim;
const S = A.symbols;
const CELLS = REELS * ROWS;
/** Landing pop for SCATTER / COIN: peak size growth and duration. */
const LAND_POP = 0.18;
const LAND_POP_MS = gameConfig.anim.timings.landPopMs;
/** Sparkles emitted per winning cell per breathe cycle. */
const SPARKS = 3;
/** Win sway runs this much faster for the low symbols (spec section 7.2). */
const LOW_WIN_SWAY = 1.6;
/** Reduced motion: steady glow instead of a pulse. */
const STATIC_GLOW = 0.6;
/** WILD ray sprite size relative to the cell (stays inside the frame window). */
const RAYS_FILL = 1.1;
/** Trigger phases as fractions of anim.trigger.ms: pop, 360 deg spin, settle. */
const TRIG_POP = 0.25;
const TRIG_SPIN = 0.85;
const backOut = Phaser.Math.Easing.Back.Out;
const LOW = new Set<SymbolId>(['L1', 'L2', 'L3', 'L4']);

/**
 * Per-cell symbol states (spec sections 7.1 to 7.3): idle sway + breathe and per-symbol extras,
 * land squash, anticipation pulse, win pop then breathe with glow and sparkles, trigger, dim.
 * One per-frame pass over the 15 visible cells, no per-frame allocations. Reels owns the views;
 * this only sets their scale, angle, alpha and the pooled glow / ray sprites.
 */
export class SymbolAnimator {
  /** soft glow per cell (index reel * ROWS + row), additive over the symbols */
  private glows: Phaser.GameObjects.Image[] = [];
  /** WILD rays per cell, behind the symbols */
  private rays: Phaser.GameObjects.Image[] = [];
  private rayLayer: Phaser.GameObjects.Container;
  private rayAngle: number[] = new Array(CELLS).fill(0);
  private win: boolean[] = new Array(CELLS).fill(false);
  /** ms since the cell started winning */
  private winT: number[] = new Array(CELLS).fill(0);
  /** winT of the next sparkle burst, and of H3's second star burst (0 = none) */
  private sparkAt: number[] = new Array(CELLS).fill(0);
  private burst2: number[] = new Array(CELLS).fill(0);
  private alpha: number[] = new Array(CELLS).fill(1);
  private alphaTo: number[] = new Array(CELLS).fill(1);
  /** ms into the land squash / feature pop / trigger, -1 = none */
  private landT: number[] = new Array(CELLS).fill(-1);
  private popT: number[] = new Array(CELLS).fill(-1);
  private trigT: number[] = new Array(CELLS).fill(-1);
  private trigMs = A.trigger.ms;
  /** running preFX shine per cell and the ms it has left */
  private shines: (Phaser.FX.Shine | undefined)[] = new Array(CELLS).fill(undefined);
  private shineLeft: number[] = new Array(CELLS).fill(0);
  private nextShine = { H1: S.h1ShineEveryMs, COIN: S.coinShineEveryMs };
  private shineCursor = 0;
  /** idle motion weight 0..1 per cell (fades in), and the release blend out of other states */
  private idleW: number[] = new Array(CELLS).fill(0);
  /** 0 rest / idle, 1 win, 2 tease, 3 trigger: a change back to 0 starts the release blend */
  private state: number[] = new Array(CELLS).fill(0);
  private relT: number[] = new Array(CELLS).fill(-1);
  private relS: number[] = new Array(CELLS).fill(1);
  private relA: number[] = new Array(CELLS).fill(0);
  private lastS: number[] = new Array(CELLS).fill(1);
  private lastA: number[] = new Array(CELLS).fill(0);
  /** reel settled: its cells may animate (false while it spins, so reel motion owns the views) */
  private live: boolean[] = new Array(REELS).fill(true);
  private idle = false;
  /** anticipation running and which symbols contribute to the possible trigger */
  private tease = { scatter: false, coin: false, t: 0 };
  private clock = 0;
  private cell = 0;
  /** reel window origin in canvas px (particles are emitted in canvas space) */
  private origin = { x: 0, y: 0 };

  constructor(
    scene: Phaser.Scene,
    private anim: AnimationService,
    layer: Phaser.GameObjects.Container,
    private view: (r: number, row: number) => SymbolView,
  ) {
    // created after the reel backing, so at the same depth the rays draw above it, below the symbols
    this.rayLayer = scene.add.container(0, 0).setDepth(DEPTH.REEL_FRAME_BACK);
    for (let i = 0; i < CELLS; i++) {
      this.rays.push(
        scene.add.image(0, 0, UI.rays).setVisible(false).setBlendMode(Phaser.BlendModes.ADD),
      );
      // unmasked additive glows can extend softly beneath the front frame
      this.glows.push(
        scene.add.image(0, 0, FX.glow).setVisible(false).setBlendMode(Phaser.BlendModes.ADD),
      );
    }
    this.rayLayer.add(this.rays);
    layer.add(this.glows);
  }

  /** Idle loops; on only while the state machine is in Idle. */
  setIdle(on: boolean) {
    this.idle = on;
  }

  /** Anticipation pulse on the visible symbols of the given kinds; both false = off. */
  setTease(scatter: boolean, coin: boolean) {
    if (!this.tease.scatter && !this.tease.coin) this.tease.t = 0;
    this.tease.scatter = scatter;
    this.tease.coin = coin;
  }

  /** Reels start: every cell back to neutral; reel motion owns the views until each lands. */
  spinStart() {
    this.live.fill(false);
    this.highlight(null);
    this.setTease(false, false);
    for (let i = 0; i < CELLS; i++) {
      this.landT[i] = this.popT[i] = this.trigT[i] = this.relT[i] = -1;
      this.idleW[i] = this.state[i] = this.lastA[i] = 0;
      this.lastS[i] = 1;
      this.alpha[i] = 1;
      this.stopShine(i);
      this.glows[i].setVisible(false);
      this.rays[i].setVisible(false);
      this.neutral(i);
    }
  }

  /** Grid shown directly (idle / resume / halt): all cells settled. */
  reset() {
    this.live.fill(true);
  }

  /** Reel r settled. snapped = skip: no squash. Feature symbols pop, a WILD sends a shockwave. */
  landed(r: number, snapped: boolean) {
    this.live[r] = true;
    const reduced = this.anim.reduced;
    for (let row = 0; row < ROWS; row++) {
      const i = r * ROWS + row;
      this.landT[i] = snapped || reduced ? -1 : 0;
      const id = this.view(r, row).id;
      if (id === 'SCATTER' || id === 'COIN') this.popT[i] = 0;
      if (id === 'WILD' && !reduced) {
        const x = this.cellX(i);
        const y = this.cellY(i);
        this.anim.fx.ring(
          DEPTH.SYMBOL_HIGHLIGHT,
          x,
          y,
          this.cell,
          S.wild.ringFrom,
          S.wild.ringTo,
          S.wild.ringMs,
        );
        this.anim.fx.burst(DEPTH.SYMBOL_HIGHLIGHT, x, y, this.anim.count(A.burst.count));
      }
    }
  }

  /** Win cells (index reel * ROWS + row) pop and breathe, the rest dim; null restores all. */
  highlight(mask: readonly boolean[] | null) {
    let popped = false;
    for (let i = 0; i < CELLS; i++) {
      const on = !!mask && mask[i];
      if (on && !this.win[i]) {
        this.winT[i] = 0;
        this.sparkAt[i] = A.win.popMs;
        this.burst2[i] = 0;
        popped = true;
      }
      this.win[i] = on;
      if (!mask) this.trigT[i] = -1; // a cleared display also ends a held trigger state
      this.alphaTo[i] = !mask || on ? 1 : A.dim.alpha;
      if (this.anim.reduced) this.alpha[i] = this.alphaTo[i];
    }
    if (popped) this.anim.emit(ANIM_EVENTS.winPop);
  }

  /**
   * Feature trigger: the masked symbols pop, spin 360 deg on their vertical axis and burst; the
   * rest dim. finish() (tap) jumps to the end state: symbols at rest with a glow, others dimmed.
   */
  trigger(mask: readonly boolean[]): AnimationHandle {
    const reduced = this.anim.reduced;
    this.trigMs = reduced ? A.reduced.fadeMs : A.trigger.ms;
    for (let i = 0; i < CELLS; i++) {
      this.win[i] = false;
      this.trigT[i] = mask[i] ? 0 : -1;
      this.alphaTo[i] = mask[i] ? 1 : A.dim.alpha;
      if (reduced) this.alpha[i] = this.alphaTo[i];
      if (mask[i] && !reduced)
        this.anim.fx.burst(
          DEPTH.SYMBOL_HIGHLIGHT,
          this.cellX(i),
          this.cellY(i),
          this.anim.count(A.burst.count),
        );
    }
    return this.anim.delay(this.trigMs).add(null, () => {
      for (let i = 0; i < CELLS; i++) {
        if (this.trigT[i] >= 0) this.trigT[i] = this.trigMs;
        this.alpha[i] = this.alphaTo[i];
      }
    });
  }

  update(dt: number) {
    this.clock += dt;
    if (this.tease.scatter || this.tease.coin) this.tease.t += dt;
    const reduced = this.anim.reduced;
    const loopMs = A.win.loopMs;
    const fade = dt * ((1 - A.dim.alpha) / A.dim.ms);
    for (let i = 0; i < CELLS; i++) {
      const r = Math.floor(i / ROWS);
      if (!this.live[r]) continue;
      const v = this.view(r, i % ROWS);
      const id = v.id;
      let s = 1;
      let sx = 1;
      let angle = 0;
      let glowA = 0;
      let glowK = 1;
      let tint: number = S.glowTint;
      let rayRate = 0;
      let state = 0;

      // dim fade
      const a = this.alpha[i];
      const to = this.alphaTo[i];
      this.alpha[i] = a < to ? Math.min(to, a + fade) : Math.max(to, a - fade);

      if (this.trigT[i] >= 0) {
        state = 3;
        const k = Math.min((this.trigT[i] += dt) / this.trigMs, 1);
        const P = A.trigger.popScale;
        glowA = reduced ? STATIC_GLOW : 0.8 - 0.3 * k;
        if (!reduced) {
          if (k < TRIG_POP) s = 1 + (P - 1) * backOut(k / TRIG_POP);
          else if (k < TRIG_SPIN) {
            s = P;
            sx = Math.cos((2 * Math.PI * (k - TRIG_POP)) / (TRIG_SPIN - TRIG_POP));
          } else s = P + (1 - P) * ((k - TRIG_SPIN) / (1 - TRIG_SPIN));
        }
      } else if (this.win[i]) {
        state = 1;
        const t = (this.winT[i] += dt);
        if (id === 'H2') tint = S.h2.tint;
        if (reduced) {
          glowA = STATIC_GLOW;
        } else {
          let k = 0; // breathe phase 0..1
          if (t < A.win.popMs) {
            s = 1 + (A.win.popScale - 1) * backOut(t / A.win.popMs);
          } else {
            const lt = t - A.win.popMs;
            k = 0.5 - 0.5 * Math.cos((Math.PI * lt) / loopMs);
            // from the pop peak into the 1.0 <-> loopScale breathe without a jump
            const excess = (A.win.popScale - A.win.loopScale) * Math.max(0, 1 - lt / loopMs);
            s = A.win.loopScale - (A.win.loopScale - 1) * k + excess;
            if (t >= this.sparkAt[i]) this.winSparks(i, id, t);
            if (this.burst2[i] > 0 && t >= this.burst2[i]) {
              this.burst2[i] = 0;
              this.anim.fx.burst(
                DEPTH.SYMBOL_HIGHLIGHT,
                this.cellX(i),
                this.cellY(i),
                this.anim.count(A.burst.count),
              );
            }
          }
          if (LOW.has(id)) angle = this.sway(i, A.idle.swayMs / LOW_WIN_SWAY);
          if (id === 'SCATTER') angle = this.scatterShake(t);
          glowA = 0.3 + 0.5 * (1 - k);
          glowK = 1.15 + 0.1 * (1 - k);
          rayRate = 2;
        }
      } else if (this.teases(id)) {
        state = 2;
        const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * this.tease.t) / A.tease.pulseMs);
        if (!reduced) s = 1 + (A.tease.pulseScale - 1) * k;
        glowA = reduced ? STATIC_GLOW : 0.4 + 0.4 * k;
      } else if (this.idle && !reduced) {
        // idle motion fades in, so symbols never jump into mid-sway after a spin
        const w = (this.idleW[i] = Math.min(1, this.idleW[i] + dt / A.idle.blendInMs));
        const ease = w * w * (3 - 2 * w);
        const b = 0.5 - 0.5 * Math.cos((Math.PI * this.phase(i)) / A.idle.breatheMs);
        if (id === 'WILD') {
          const p = 0.5 - 0.5 * Math.cos((2 * Math.PI * this.phase(i)) / S.wild.corePulseMs);
          s = 1 + S.wild.corePulse * p * ease;
          rayRate = ease;
        } else {
          s = 1 + A.idle.breatheScale * b * ease;
          angle = this.sway(i, A.idle.swayMs) * ease;
        }
        if (id === 'SCATTER') angle += this.jingle(i) * ease;
        if (id === 'H2') {
          const f = 0.5 + 0.5 * Math.sin((2 * Math.PI * S.h2.shimmerHz * this.clock) / 1000);
          glowA = S.h2.shimmerMin + (S.h2.shimmerMax - S.h2.shimmerMin) * f;
          tint = S.h2.tint;
        } else if (id === 'H3') {
          glowA = S.h3.idleGlow * (0.5 + 0.5 * b);
        }
      }

      if (state !== 0 || !this.idle || reduced) this.idleW[i] = 0;
      // leaving win / tease / trigger: ease from where the symbol was to its rest / idle pose
      if (state !== this.state[i]) {
        this.relT[i] = state === 0 && !reduced ? 0 : -1;
        this.relS[i] = this.lastS[i];
        this.relA[i] = this.lastA[i];
        this.state[i] = state;
      }
      if (this.relT[i] >= 0) {
        const k = Math.min((this.relT[i] += dt) / A.idle.releaseMs, 1);
        const e = 1 - (1 - k) * (1 - k) * (1 - k);
        s = this.relS[i] + (s - this.relS[i]) * e;
        angle = this.relA[i] + (angle - this.relA[i]) * e;
        if (k === 1) this.relT[i] = -1;
      }
      this.lastS[i] = s;
      this.lastA[i] = angle;

      // SCATTER / COIN landing pop with a fading glow burst; win and trigger states own the cell
      if (this.popT[i] >= 0) {
        const k = Math.min((this.popT[i] += dt) / LAND_POP_MS, 1);
        if (!this.win[i] && this.trigT[i] < 0) {
          if (!reduced) s *= 1 + LAND_POP * Math.sin(Math.PI * k);
          glowA = Math.max(glowA, 0.9 * (1 - k));
          glowK = 1 + 0.6 * k;
        }
        if (k === 1) this.popT[i] = -1;
      }

      // land squash: scaleY 0.94 -> 1 while the reel settles
      let sy = 1;
      if (this.landT[i] >= 0) {
        const k = Math.min((this.landT[i] += dt) / this.anim.dur(A.land.ms), 1);
        sy = A.land.squashY + (1 - A.land.squashY) * (1 - (1 - k) * (1 - k));
        if (k === 1) this.landT[i] = -1;
      }

      v.root.setScale(s * sx, s * sy).setAlpha(this.alpha[i]);
      v.pivot.setAngle(angle);

      const glow = this.glows[i];
      if (glowA > 0) {
        const g = this.cell * glowK;
        glow.setVisible(true).setDisplaySize(g, g).setAlpha(glowA).setTint(tint);
      } else glow.setVisible(false);

      const ray = this.rays[i];
      if (id === 'WILD') {
        if (!reduced) this.rayAngle[i] += (rayRate * S.wild.raysDegPerSec * dt) / 1000;
        ray
          .setVisible(true)
          .setAngle(this.rayAngle[i])
          .setAlpha(this.alpha[i] * 0.8);
      } else ray.setVisible(false);

      if (this.shines[i] && (this.shineLeft[i] -= dt) <= 0) this.stopShine(i);
    }
    if (this.idle && !reduced) this.scheduleShines(dt);
  }

  relayout(cell: number, x: number, y: number) {
    this.cell = cell;
    this.origin.x = x;
    this.origin.y = y;
    this.rayLayer.setPosition(x, y);
    for (let i = 0; i < CELLS; i++) {
      const lx = (Math.floor(i / ROWS) + 0.5) * cell;
      const ly = ((i % ROWS) + 0.5) * cell;
      this.glows[i].setPosition(lx, ly);
      this.rays[i].setPosition(lx, ly).setDisplaySize(cell * RAYS_FILL, cell * RAYS_FILL);
    }
  }

  /** Win sparkles per symbol: H1 burst + double shine, H3 two bursts, WILD a steady stream. */
  private winSparks(i: number, id: SymbolId, t: number) {
    const x = this.cellX(i);
    const y = this.cellY(i);
    const fx = this.anim.fx;
    if (id === 'WILD') {
      fx.sparkle(DEPTH.SYMBOL_HIGHLIGHT, x, y, 1);
      this.sparkAt[i] = t + S.wild.sparkEveryMs;
      return;
    }
    if (this.sparkAt[i] === A.win.popMs && (id === 'H1' || id === 'H3')) {
      fx.burst(DEPTH.SYMBOL_HIGHLIGHT, x, y, this.anim.count(A.burst.count));
      if (id === 'H1') this.startShine(i, 2);
      else this.burst2[i] = t + A.win.loopMs; // H3: second burst half a breathe later
    }
    fx.sparkle(DEPTH.SYMBOL_HIGHLIGHT, x, y, this.anim.count(SPARKS));
    this.sparkAt[i] += A.win.loopMs * 2;
  }

  /** SCATTER win: +/- shakeDeg, alternating every shakeStepMs for shakeCycles, then still. */
  private scatterShake(t: number) {
    const sc = S.scatter;
    const step = Math.floor(t / sc.shakeStepMs);
    return step < sc.shakeCycles * 2 ? (step % 2 ? -sc.shakeDeg : sc.shakeDeg) : 0;
  }

  /** SCATTER idle jingle: a short +/- jingleDeg wiggle once every jingleEveryMs. */
  private jingle(i: number) {
    const sc = S.scatter;
    const t = ((this.phase(i) % sc.jingleEveryMs) + sc.jingleEveryMs) % sc.jingleEveryMs;
    if (t > sc.jingleMs) return 0;
    const k = t / sc.jingleMs;
    return sc.jingleDeg * Math.sin(k * Math.PI * 4) * (1 - k);
  }

  /** H1 every h1ShineEveryMs and COIN every coinShineEveryMs; one cell per kind at a time. */
  private scheduleShines(dt: number) {
    for (const id of ['H1', 'COIN'] as const) {
      if ((this.nextShine[id] -= dt) > 0) continue;
      this.nextShine[id] = id === 'H1' ? S.h1ShineEveryMs : S.coinShineEveryMs;
      for (let n = 0; n < CELLS; n++) {
        const i = (this.shineCursor + n) % CELLS;
        if (this.view(Math.floor(i / ROWS), i % ROWS).id !== id || this.shines[i]) continue;
        this.startShine(i, 1);
        this.shineCursor = i + 1;
        break;
      }
    }
  }

  /** preFX shine for `sweeps` passes, within the post-FX budget (WebGL only). */
  private startShine(i: number, sweeps: number) {
    if (this.shines[i] || this.anim.reduced || !this.anim.acquireFx()) return;
    const img = this.view(Math.floor(i / ROWS), i % ROWS).img;
    const fx = img.preFX?.addShine(S.shineSpeed, 0.5, 3, false);
    if (!fx) {
      this.anim.releaseFx();
      return;
    }
    this.shines[i] = fx;
    this.shineLeft[i] = (sweeps * 2000) / S.shineSpeed;
  }

  private stopShine(i: number) {
    const fx = this.shines[i];
    if (!fx) return;
    this.view(Math.floor(i / ROWS), i % ROWS).img.preFX?.remove(fx);
    this.shines[i] = undefined;
    this.anim.releaseFx();
  }

  private teases(id: SymbolId) {
    return (this.tease.scatter && id === 'SCATTER') || (this.tease.coin && id === 'COIN');
  }

  private cellX(i: number) {
    return this.origin.x + (Math.floor(i / ROWS) + 0.5) * this.cell;
  }

  private cellY(i: number) {
    return this.origin.y + ((i % ROWS) + 0.5) * this.cell;
  }

  /** Deterministic per-cell phase: index * cellDelayMs behind the shared clock. */
  private phase(i: number) {
    return this.clock - i * A.idle.cellDelayMs;
  }

  private sway(i: number, halfPeriodMs: number) {
    return -A.idle.swayDeg * Math.cos((Math.PI * this.phase(i)) / halfPeriodMs);
  }

  private neutral(i: number) {
    const v = this.view(Math.floor(i / ROWS), i % ROWS);
    v.root.setScale(1).setAlpha(1);
    v.pivot.setAngle(0);
  }
}
