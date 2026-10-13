import Phaser from 'phaser';
import { DEPTH, HUD_LAYOUT } from '../../constants';
import { ASPECT } from '../Title';
import { gameConfig } from '../../gameConfig';
import { layout, sd, sx, sy } from '../../utils/responsive';
import type { Background } from '../Background';
import type { AnimationService } from './AnimationService';
import { FX } from './fxTextures';

const AMB = gameConfig.anim.ambient;
const BOKEH_TINTS = [0xffc94a, 0xff8a5a, 0xfff0c0, 0xff6b8b];
/** R2 low-discrepancy sequence: deterministic, evenly spread positions (no RNG). */
const R2X = 0.7548776662466927;
const R2Y = 0.5698402909980532;
const frac = (v: number) => v - Math.floor(v);

export type AmbientMode = 'base' | 'freeSpins' | 'holdAndWin';

/**
 * Ambient background motion (spec section 10): drifting bokeh, sparse sparkle glints and a slow
 * parallax on the painted background; a tint shift during features. One per-frame pass, static
 * (no glints) in reduced motion. The lantern strings are painted into the background art, so
 * they cannot sway without layered art (see ANIMATION_SPEC Level 1).
 */
export class AmbientBackground {
  private bokeh: Phaser.GameObjects.Image[] = [];
  /** sparkle glints: each pulses once (grow, turn, fade), rests, then reappears elsewhere */
  private glints: Phaser.GameObjects.Image[] = [];
  private glintSlot: number[] = [];
  /** per-object base position (canvas px), size factor and period */
  private base: { x: number; y: number; k: number; ms: number }[] = [];
  private clock = 0;
  private tint = { from: 0xffffff, to: 0xffffff, k: 1 };
  private tintTween?: Phaser.Tweens.Tween;

  constructor(
    private scene: Phaser.Scene,
    private anim: AnimationService,
    private background: Background,
  ) {
    const add = (key: string) =>
      scene.add.image(0, 0, key).setDepth(DEPTH.BACKGROUND).setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < AMB.bokeh; i++) {
      this.bokeh.push(add(FX.bokeh).setTint(BOKEH_TINTS[i % BOKEH_TINTS.length]));
    }
    for (let i = 0; i < AMB.bokeh; i++) this.base.push({ x: 0, y: 0, k: 0, ms: 0 });
    for (let i = 0; i < AMB.glints; i++) {
      this.glints.push(add(FX.glint).setTint(0xfff3d0).setVisible(false));
      this.glintSlot.push(-1);
    }
  }

  /** Feature palette: tint the painted background toward the mode's color. */
  setMode(mode: AmbientMode) {
    const to = AMB.tints[mode];
    if (to === this.tint.to) return;
    this.tintTween?.stop();
    this.tint.from = this.currentTint();
    this.tint.to = to;
    this.tint.k = 0;
    this.tintTween = this.scene.tweens.add({
      targets: this.tint,
      k: 1,
      duration: this.anim.reduced ? 0 : AMB.tintMs,
      onUpdate: () => this.background.setTint(this.currentTint()),
      onComplete: () => this.background.setTint(to),
    });
  }

  update(dt: number) {
    this.clock += dt;
    const reduced = this.anim.reduced;
    const t = reduced ? 0 : this.clock;
    this.background.setParallax(
      reduced ? 0 : sd(AMB.parallaxPx) * Math.sin((2 * Math.PI * t) / AMB.parallaxMs),
    );
    for (let i = 0; i < this.bokeh.length; i++) {
      const b = this.base[i];
      // rise slowly and fade in / out over one period; static mid-cycle in reduced motion
      const k = reduced ? 0.5 : frac(t / b.ms + b.k);
      this.bokeh[i]
        .setY(b.y - sd(AMB.bokehDriftPx) * k)
        .setAlpha(AMB.bokehAlpha * (0.4 + 0.6 * b.k) * Math.sin(Math.PI * k));
    }
    for (let i = 0; i < this.glints.length; i++) this.glint(i, reduced);
  }

  /**
   * Glint i: a period of show + rest (rest differs per glint); during the show it grows
   * 0.3 -> 1 -> 0.3, turns glintTurnDeg and fades 0 -> 1 -> 0. Each appearance takes the next
   * spot of a deterministic sequence, so the sparkle wanders without any RNG.
   */
  private glint(i: number, reduced: boolean) {
    const g = this.glints[i];
    if (reduced) return void g.setVisible(false);
    const n = this.glints.length;
    const u = frac(0.37 + (i + 1) * 0.6180339887);
    const period =
      AMB.glintShowMs + AMB.glintRestMs[0] + (AMB.glintRestMs[1] - AMB.glintRestMs[0]) * u;
    const p = this.clock / period + u;
    const local = frac(p) * period;
    if (local >= AMB.glintShowMs) return void g.setVisible(false);
    const slot = i + n * Math.floor(p);
    if (slot !== this.glintSlot[i]) {
      this.glintSlot[i] = slot;
      const { width: w, height: h } = this.scene.scale;
      const size = sd(AMB.glintPx[0] + (AMB.glintPx[1] - AMB.glintPx[0]) * frac(slot * 0.4142135));
      // glints sit on the painted background: skip spots the reel frame or the logo covers
      const f = layout.frame;
      const logo = (layout.landscape ? HUD_LAYOUT.landscape : HUD_LAYOUT.portrait).logo;
      const lw = logo.width / 2;
      const lh = (logo.width * ASPECT) / 2;
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 12; tries++) {
        const q = slot * 12 + tries;
        x = frac(0.11 + q * R2X) * w;
        y = frac(0.29 + q * R2Y) * h * AMB.glintArea;
        const inFrame = x > sx(f.x) && x < sx(f.x + f.w) && y > sy(f.y) && y < sy(f.y + f.h);
        const inLogo = Math.abs(x - sx(logo.x)) < sd(lw) && Math.abs(y - sy(logo.y)) < sd(lh);
        if (!inFrame && !inLogo) break;
      }
      g.setPosition(x, y).setDisplaySize(size, size);
      g.setData('base', g.scaleX);
    }
    const k = local / AMB.glintShowMs;
    const pulse = Math.sin(Math.PI * k);
    const base = g.getData('base') as number;
    g.setVisible(true)
      .setScale(base * (0.3 + 0.7 * pulse))
      .setAngle(AMB.glintTurnDeg * k)
      .setAlpha(pulse);
  }

  /** Positions spread over the canvas. */
  relayout() {
    const { width: w, height: h } = this.scene.scale;
    for (let i = 0; i < this.bokeh.length; i++) {
      const k = frac(0.5 + (i + 1) * 0.6180339887);
      const size = sd(AMB.bokehPx[0] + (AMB.bokehPx[1] - AMB.bokehPx[0]) * k);
      this.base[i] = {
        x: frac(0.31 + (i + 1) * R2X) * w,
        y: frac(0.17 + (i + 1) * R2Y) * h,
        k,
        ms: AMB.bokehMs[0] + (AMB.bokehMs[1] - AMB.bokehMs[0]) * k,
      };
      this.bokeh[i].setPosition(this.base[i].x, this.base[i].y).setDisplaySize(size, size);
    }
    this.glintSlot.fill(-1); // glints re-place for the new canvas size on their next frame
  }

  private currentTint() {
    const a = Phaser.Display.Color.IntegerToColor(this.tint.from);
    const b = Phaser.Display.Color.IntegerToColor(this.tint.to);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, this.tint.k * 100);
    return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
  }
}
