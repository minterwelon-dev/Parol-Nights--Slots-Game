import { gameConfig, type SpinTiming } from '../../gameConfig';
import { REELS, ROWS } from '../../math/config';
import type { SymbolId } from '../../rgs/types';
import { layout } from '../../utils/responsive';
import { ANIM_EVENTS, type AnimationService } from './AnimationService';

const REEL = gameConfig.anim.reel;
const LAND = gameConfig.anim.land;
const TEASE = gameConfig.anim.anticipation;
/** Symbols fed in on landing: the result column bottom-up, then the strip symbol above it. */
const LANDING = ROWS + 1;
/** Largest motion carried into the bounce, in cells; avoids a visible pop at high speed. */
const MAX_CARRY = 0.3;
/** Fraction of full speed above which symbols switch to their motion-blur look. */
const BLUR_AT = 0.6;

type Strips = readonly (readonly SymbolId[])[];

/** What the animator drives; Reels owns the views, mask and glow. */
export interface ReelView {
  /** everything moves down one slot; a new symbol enters at the top */
  shift(r: number, id: SymbolId): void;
  /** offset in cells, positive = down */
  place(r: number, offset: number): void;
  setBlur(r: number, on: boolean): void;
  /** show reel r's landed column at rest; above = strip symbol above row 0 */
  snap(r: number, above: SymbolId): void;
  /** reel r settled on its result; snapped = skip, no landing motion */
  landed(r: number, snapped: boolean): void;
  /** anticipation glow + vignette for reel r (-1 = all off) */
  tease(r: number, on: boolean): void;
}

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
  blurred: boolean;
  feed: SymbolId[];
  fed: number;
  /** ms into the bounce, -1 = not bouncing */
  bounceT: number;
  /** offset at the moment of landing, eased out during the bounce */
  carry: number;
  /** anticipation planned for this reel (extra delay before landing) */
  tease: boolean;
  /** anticipation running: the reel slows down and glows */
  teasing: boolean;
  /** ms into the start kick; negative = waiting for this reel's stagger */
  kickT: number;
}

/**
 * Reel motion (ANIMATION_SPEC.md section 6): start kick, spin loop with motion blur, staggered stop
 * with overshoot, anticipation slow-down, skip snap. Always lands on the response grid.
 */
export class ReelAnimator {
  private runs: Run[] = [];
  private clock = 0;
  private timing!: SpinTiming;
  private pending = 0;
  private done?: () => void;

  constructor(
    private anim: AnimationService,
    private view: ReelView,
    private strips: Strips,
  ) {
    for (let r = 0; r < REELS; r++) {
      this.runs.push({
        spinning: false,
        top: 0,
        offset: 0,
        speed: 0,
        stopAt: Infinity,
        landing: false,
        blurred: false,
        feed: new Array<SymbolId>(LANDING).fill('L1'),
        fed: 0,
        bounceT: -1,
        carry: 0,
        tease: false,
        teasing: false,
        kickT: 0,
      });
    }
  }

  setStrips(strips: Strips) {
    this.strips = strips;
  }

  spin(timing: SpinTiming) {
    this.anim.emit(ANIM_EVENTS.spinStart);
    this.timing = timing;
    this.pending = REELS;
    const stagger = this.anim.dur(REEL.startStaggerMs);
    for (let r = 0; r < REELS; r++) {
      const run = this.runs[r];
      run.spinning = true;
      run.speed = 0;
      run.stopAt = Infinity;
      run.landing = false;
      run.fed = 0;
      run.bounceT = -1;
      run.tease = run.teasing = false;
      run.kickT = -r * stagger;
    }
  }

  /**
   * Land on the response. Reel r lands one stagger after reel r - 1, or one anticipation delay
   * when tease[r] is set. quick snaps every reel to the grid at once (skip).
   */
  stop(
    stops: readonly number[],
    grid: readonly SymbolId[][],
    quick: boolean,
    tease?: readonly boolean[],
  ): Promise<void> {
    const stagger = this.anim.isTurbo ? REEL.turboStaggerMs : REEL.stopStaggerMs;
    // the slowed landing itself counts toward the anticipation length
    const slowLandMs = (LANDING * 1000) / (this.timing.speed * TEASE.slowFactor);
    const teaseDelay = Math.max(stagger, this.anim.dur(TEASE.ms) - slowLandMs);
    let at = this.clock;
    for (let r = 0; r < REELS; r++) {
      const strip = this.strips[r];
      const run = this.runs[r];
      for (let row = 0; row < ROWS; row++) run.feed[row] = grid[r][ROWS - 1 - row];
      run.feed[ROWS] = strip[(stops[r] - 1 + strip.length) % strip.length];
      run.top = stops[r] - 1;
      run.tease = !quick && !!tease?.[r];
      if (r > 0 && !quick) at += run.tease ? teaseDelay : stagger;
      run.stopAt = at;
    }
    const done = new Promise<void>((resolve) => {
      this.done = resolve;
      if (this.pending === 0) resolve();
    });
    if (quick) this.slam();
    return done;
  }

  /** Skip: every reel with a known result snaps to it now, without bounce or anticipation. */
  slam() {
    let teased = false;
    for (let r = 0; r < REELS; r++) {
      const run = this.runs[r];
      teased ||= run.teasing;
      run.tease = run.teasing = false;
    }
    this.view.tease(-1, false);
    if (teased) this.anim.emit(ANIM_EVENTS.anticipationEnd);
    for (let r = 0; r < REELS; r++) {
      const run = this.runs[r];
      if (run.spinning && run.stopAt !== Infinity) this.snap(r);
    }
  }

  /** Abort without a result (RGS error); the caller restores the last grid. */
  halt() {
    for (let r = 0; r < REELS; r++) {
      const run = this.runs[r];
      run.spinning = run.tease = run.teasing = false;
      this.setBlur(r, false);
    }
    this.pending = 0;
    this.view.tease(-1, false);
  }

  update(dtMs: number) {
    if (this.pending === 0) return;
    this.clock += dtMs;
    const t = this.timing;
    const reduced = this.anim.reduced;
    const cell = layout.cell;
    for (let r = 0; r < REELS; r++) {
      const run = this.runs[r];
      if (!run.spinning) continue;

      if (run.bounceT >= 0) {
        run.bounceT += dtMs;
        const k = Math.min(run.bounceT / this.anim.dur(LAND.ms), 1);
        const amp = reduced ? 0 : LAND.overshootPx / cell;
        // ease the carried motion out while overshooting past the stop and settling back
        run.offset = run.carry * (1 - k) * (1 - k) + amp * Math.sin(Math.PI * k);
        if (k === 1) {
          run.offset = 0;
          run.spinning = false;
          run.bounceT = -1;
          this.view.place(r, 0);
          this.landed(r, false);
          continue;
        }
        this.view.place(r, run.offset);
        continue;
      }

      const kickMs = this.anim.dur(REEL.startMs);
      if (run.kickT < kickMs) {
        // start kick: nudge up and back before the drop (a stop can't land before it ends)
        run.kickT += dtMs;
        const k = Math.min(Math.max(run.kickT / kickMs, 0), 1);
        run.offset = reduced ? 0 : -(REEL.startKickPx / cell) * Math.sin(Math.PI * k);
        this.view.place(r, run.offset);
        continue;
      }

      if (!run.landing && this.clock >= run.stopAt) run.landing = true;
      // anticipation slows the teased reel; the change is eased by the acceleration rate
      const target = run.teasing ? t.speed * TEASE.slowFactor : t.speed;
      const step = (t.speed * dtMs) / t.accelMs;
      run.speed =
        run.speed < target
          ? Math.min(target, run.speed + step)
          : Math.max(target, run.speed - step);
      this.setBlur(r, run.speed >= BLUR_AT * t.speed);
      run.offset += (run.speed * dtMs) / 1000;

      while (run.offset >= 1) {
        run.offset -= 1;
        if (run.landing) {
          this.view.shift(r, run.feed[run.fed++]);
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
          this.view.shift(r, strip[run.top]);
        }
      }
      this.view.place(r, run.offset);
    }
  }

  private snap(r: number) {
    const run = this.runs[r];
    run.spinning = false;
    run.bounceT = -1;
    run.offset = 0;
    this.setBlur(r, false);
    this.view.snap(r, run.feed[ROWS]);
    this.landed(r, true);
  }

  /** Reel r settled: its anticipation ends, the next teased reel starts its slow-down. */
  private landed(r: number, snapped: boolean) {
    const run = this.runs[r];
    if (run.teasing) {
      run.teasing = false;
      this.view.tease(r, false);
      this.anim.emit(ANIM_EVENTS.anticipationEnd, r);
    }
    this.view.landed(r, snapped);
    this.anim.emit(ANIM_EVENTS.reelLanded, r);
    const next = this.runs[r + 1];
    if (next && next.tease && next.spinning) {
      next.teasing = true;
      this.view.tease(r + 1, true);
      this.anim.emit(ANIM_EVENTS.anticipationStart, r + 1);
    }
    if (--this.pending === 0) this.done?.();
  }

  private setBlur(r: number, on: boolean) {
    const run = this.runs[r];
    if (run.blurred === on) return;
    run.blurred = on;
    this.view.setBlur(r, on);
  }
}
