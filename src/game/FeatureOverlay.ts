import Phaser from 'phaser';
import { DEPTH, FEATURE_LAYOUT, THEME } from '../constants';
import { fitText } from '../utils/fitText';
import { formatMoney } from '../utils/format';
import { cellX, cellY, layout, sd, sx, sy, type Layout } from '../utils/responsive';
import type { Timeline } from '../utils/timeline';
import { dimLayer, fadeIn, fadeOut, goldTitle, pop } from './fx';
import { ANIM_EVENTS, type AnimationService } from './animation/AnimationService';
import { Pips, StringLights, flip, slideIn } from './animation/FeatureAnimations';
import { gameConfig } from '../gameConfig';
import { FX } from './animation/fxTextures';

const F = gameConfig.anim.feature;
/** intro = string lights + title slide-in + count pop; drop = banner falls in (retrigger). */
export type StepStyle = 'plain' | 'intro' | 'drop';

export interface OverlayTheme {
  /** info pill outline */
  edge: number;
  /** dim tint behind intro / summary */
  dim: number;
  /** glow behind the gold title (the title itself always uses the logo gold) */
  glow: string;
  sub: string;
  stroke: string;
}

const FONT = THEME.fonts.numeric;

/**
 * Feature chrome shared by Free Spins and Hold & Win: a centered intro / banner / summary
 * overlay and a two-slot info bar above the reels. Text only changes on events, never per frame.
 */
export class FeatureOverlay {
  private scene: Phaser.Scene;
  private dim: Phaser.GameObjects.Image;
  private title: Phaser.GameObjects.Text;
  private sub: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private left: Phaser.GameObjects.Text;
  private right: Phaser.GameObjects.Text;
  private pill: Phaser.GameObjects.Graphics;
  /** '+n' that flies from the reels into the bar */
  private flyer: Phaser.GameObjects.Text;
  private lights: StringLights;
  private titleGlow: Phaser.GameObjects.Image;
  readonly pips: Pips;
  /** bar left text center (canvas px) and pip size, set by relayout */
  private leftX = 0;
  private pipPx = 0;
  private pipsShown = false;
  /** title rest y (canvas px) */
  private titleY = 0;
  /** base font sizes and max text width (canvas px), set by relayout */
  private fit = { title: 0, sub: 0, hint: 0, maxW: 0 };

  constructor(
    scene: Phaser.Scene,
    private theme: OverlayTheme,
    private anim: AnimationService,
  ) {
    this.scene = scene;
    const text = (color: string, depth: number) =>
      scene.add
        .text(0, 0, '', { fontFamily: FONT, color, stroke: theme.stroke, align: 'center' })
        .setOrigin(0.5)
        .setDepth(depth)
        .setVisible(false);
    this.dim = dimLayer(scene, theme.dim, 0.78, DEPTH.DIM).setVisible(false);
    this.titleGlow = scene.add
      .image(0, 0, FX.glow)
      .setTint(theme.edge)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.BIG_WIN)
      .setVisible(false);
    this.lights = new StringLights(scene, anim);
    this.title = text(THEME.text, DEPTH.BIG_WIN)
      .setFontFamily(THEME.fonts.title)
      .setFontStyle('bold');
    this.sub = text(theme.sub, DEPTH.BIG_WIN);
    this.hint = text('#ffffff', DEPTH.BIG_WIN);
    this.pill = scene.add.graphics().setDepth(DEPTH.FEATURE_OVERLAY).setVisible(false);
    this.left = text('#ffffff', DEPTH.FEATURE_OVERLAY);
    this.right = text(theme.sub, DEPTH.FEATURE_OVERLAY);
    this.flyer = text(theme.sub, DEPTH.FEATURE_OVERLAY);
    this.pips = new Pips(scene, anim);
  }

  /** Show a centered message for ms (skippable through tl), then hide it. */
  async step(
    tl: Timeline,
    title: string,
    sub: string,
    hint: string,
    ms: number,
    style: StepStyle = 'plain',
  ) {
    tl.reset();
    this.show(title, sub, hint);
    if (style === 'intro') {
      this.lights.play(
        this.title.x,
        this.title.y - sd(120),
        Math.max(this.title.displayWidth * 1.2, sd(520)),
      );
      fadeIn(this.scene, this.titleGlow, 0.5);
      slideIn(this.scene, this.anim, this.title, sd(F.slidePx), F.slideMs);
      // the spin count pops once the title has arrived
      this.sub.setScale(0.01);
      this.scene.time.delayedCall(this.anim.reduced ? 0 : F.subPopDelayMs, () =>
        pop(this.scene, this.sub, 1.4),
      );
    } else if (style === 'drop') {
      slideIn(this.scene, this.anim, this.title, -sd(F.dropPx), F.dropMs);
      pop(this.scene, this.sub);
    } else pop(this.scene, this.title);
    await tl.wait(ms);
    tl.reset();
    this.hide();
  }

  /** Count 0 -> amount (response value), then hold. Tap 1 ends the count, tap 2 the hold. */
  async summary(
    tl: Timeline,
    title: string,
    amount: number,
    doneHint: string,
    countMs: number,
    holdMs: number,
  ) {
    tl.reset();
    this.anim.emit(ANIM_EVENTS.featureSummary);
    this.show(title, formatMoney(0), '');
    pop(this.scene, this.title);
    await tl.counter(0, amount, countMs, (v) => this.text(this.sub, formatMoney(Math.floor(v))));
    this.text(this.sub, formatMoney(amount));
    this.text(this.hint, doneHint);
    tl.reset();
    await tl.wait(holdMs);
    tl.reset();
    this.hide();
  }

  /**
   * Info bar above the reels; null hides the bar. pips = respin pips shown after the left text
   * (refill = a new coin reset them); undefined keeps the pips as they are.
   */
  bar(left: string | null, right = '', pips?: number | null, refill = false) {
    if (left === null) {
      this.scene.tweens.killTweensOf(this.flyer);
      this.flyer.setVisible(false);
      pips = null;
    }
    this.pill.setVisible(left !== null);
    this.left.setVisible(left !== null).setText(left ?? '');
    this.right.setVisible(left !== null).setText(right);
    if (pips !== undefined) {
      this.pipsShown = pips !== null;
      this.pips.set(pips, refill);
    }
    this.placeLeft();
  }

  /** Left text (and the pips after it) centered on the left slot. */
  private placeLeft() {
    const gap = this.pipsShown ? this.pipPx * 0.8 : 0;
    const row = this.pipsShown ? this.pips.width : 0;
    const x = this.leftX - (row + gap) / 2;
    this.left.setX(x);
    this.pips.place(x + this.left.displayWidth / 2 + gap, this.left.y, this.pipPx);
  }

  /** Counter flips on its vertical axis, then pops (retrigger). */
  flipBar(side: 'left' | 'right') {
    const t = side === 'left' ? this.left : this.right;
    flip(this.scene, this.anim, t, 'y', () => this.popBar(side));
  }

  /** flash: the text also turns gold for a moment (e.g. respins reset) */
  popBar(side: 'left' | 'right', flash = false) {
    const t = side === 'left' ? this.left : this.right;
    pop(this.scene, t);
    if (!flash) return;
    const color = side === 'left' ? '#ffffff' : this.theme.sub;
    t.setColor(THEME.gold);
    this.scene.time.delayedCall(gameConfig.anim.timings.barFlashMs, () => t.setColor(color));
  }

  /** label flies from the reel center into one side of the bar, which then shows text and pops. Non-blocking. */
  fly(
    label: string,
    side: 'left' | 'right',
    text: string,
    onLand?: (t: Phaser.GameObjects.Text) => void,
  ) {
    const t = side === 'left' ? this.left : this.right;
    const f = this.flyer;
    this.scene.tweens.killTweensOf(f);
    f.setText(label).setPosition(cellX(2), cellY(1)).setScale(1.6).setAlpha(1).setVisible(true);
    this.scene.tweens.add({
      targets: f,
      x: t.x,
      y: t.y,
      scale: 0.7,
      duration: gameConfig.anim.timings.flyMs,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        f.setVisible(false);
        t.setText(text);
        this.popBar(side);
        onLand?.(t);
      },
    });
  }

  private show(title: string, sub: string, hint: string) {
    this.title.setY(this.titleY); // a slide cut short by a skip must not leave it offset
    this.text(this.title, title);
    this.text(this.sub, sub);
    this.text(this.hint, hint);
    fadeIn(this.scene, this.dim, 0.78);
    fadeIn(this.scene, this.title);
    fadeIn(this.scene, this.sub);
    fadeIn(this.scene, this.hint);
  }

  private hide() {
    this.lights.hide();
    fadeOut(this.scene, this.titleGlow);
    fadeOut(this.scene, this.title);
    fadeOut(this.scene, this.sub);
    fadeOut(this.scene, this.hint);
    fadeOut(this.scene, this.dim);
  }

  /** Set text, then shrink to the screen width if needed (long titles in portrait). */
  private text(t: Phaser.GameObjects.Text, s: string) {
    t.setText(s);
    const base = t === this.title ? this.fit.title : t === this.sub ? this.fit.sub : this.fit.hint;
    fitText(t, base, this.fit.maxW);
    if (t === this.title) goldTitle(t, this.theme.glow, sd(22));
    return t;
  }

  relayout(l: Layout) {
    const p = l.landscape ? FEATURE_LAYOUT.landscape : FEATURE_LAYOUT.portrait;
    const stroke = this.theme.stroke;
    const q = p.pill;
    this.pill
      .clear()
      .fillStyle(THEME.panel, 0.92)
      .fillRoundedRect(sx(q.x - q.w / 2), sy(q.y - q.h / 2), sd(q.w), sd(q.h), sd(q.h / 2))
      .lineStyle(sd(3), this.theme.edge, 1)
      .strokeRoundedRect(sx(q.x - q.w / 2), sy(q.y - q.h / 2), sd(q.w), sd(q.h), sd(q.h / 2));
    this.leftX = sx(p.left);
    this.pipPx = sd(p.font * 0.8);
    this.left
      .setPosition(sx(p.left), sy(q.y))
      .setFontSize(Math.round(sd(p.font)))
      .setStroke(stroke, sd(6));
    this.right
      .setPosition(sx(p.right), sy(q.y))
      .setFontSize(Math.round(sd(p.font)))
      .setStroke(stroke, sd(6));

    this.flyer.setFontSize(Math.round(sd(p.font * 1.6))).setStroke(stroke, sd(8));
    this.dim.setDisplaySize(this.scene.scale.width, this.scene.scale.height);
    const cx = sx(layout.w / 2);
    const cy = sy(layout.h / 2);
    this.fit = { title: sd(130), sub: sd(100), hint: sd(40), maxW: sd(l.w * 0.9) };
    this.title.setPosition(cx, cy - sd(130)).setStroke(stroke, sd(10));
    this.titleGlow.setPosition(cx, cy - sd(130)).setDisplaySize(sd(900), sd(360));
    this.titleY = cy - sd(130);
    this.sub.setPosition(cx, cy + sd(40)).setStroke(stroke, sd(12));
    this.hint.setPosition(cx, cy + sd(190)).setStroke(stroke, sd(6));
    this.text(this.title, this.title.text);
    this.text(this.sub, this.sub.text);
    this.text(this.hint, this.hint.text);
    this.placeLeft();
  }
}
