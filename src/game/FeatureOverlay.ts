import Phaser from 'phaser';
import { DEPTH, FEATURE_LAYOUT, THEME } from '../constants';
import { fitText } from '../utils/fitText';
import { formatMoney } from '../utils/format';
import { cellX, cellY, layout, sd, sx, sy, type Layout } from '../utils/responsive';
import type { Timeline } from '../utils/timeline';
import { dimLayer, fadeIn, fadeOut, pop } from './fx';

export interface OverlayTheme {
  /** info pill outline */
  edge: number;
  /** dim tint behind intro / summary */
  dim: number;
  title: string;
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
  /** base font sizes and max text width (canvas px), set by relayout */
  private fit = { title: 0, sub: 0, hint: 0, maxW: 0 };

  constructor(
    scene: Phaser.Scene,
    private theme: OverlayTheme,
  ) {
    this.scene = scene;
    const text = (color: string, depth: number) =>
      scene.add
        .text(0, 0, '', { fontFamily: FONT, color, stroke: theme.stroke, align: 'center' })
        .setOrigin(0.5)
        .setDepth(depth)
        .setVisible(false);
    this.dim = dimLayer(scene, theme.dim, 0.78, DEPTH.DIM).setVisible(false);
    this.title = text(theme.title, DEPTH.BIG_WIN);
    this.sub = text(theme.sub, DEPTH.BIG_WIN);
    this.hint = text('#ffffff', DEPTH.BIG_WIN);
    this.pill = scene.add.graphics().setDepth(DEPTH.FEATURE_OVERLAY).setVisible(false);
    this.left = text('#ffffff', DEPTH.FEATURE_OVERLAY);
    this.right = text(theme.sub, DEPTH.FEATURE_OVERLAY);
    this.flyer = text(theme.sub, DEPTH.FEATURE_OVERLAY);
  }

  /** Show a centered message for ms (skippable through tl), then hide it. */
  async step(tl: Timeline, title: string, sub: string, hint: string, ms: number) {
    tl.reset();
    this.show(title, sub, hint);
    pop(this.scene, this.title);
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

  /** Info bar above the reels; null hides the bar. */
  bar(left: string | null, right = '') {
    if (left === null) {
      this.scene.tweens.killTweensOf(this.flyer);
      this.flyer.setVisible(false);
    }
    this.pill.setVisible(left !== null);
    this.left.setVisible(left !== null).setText(left ?? '');
    this.right.setVisible(left !== null).setText(right);
  }

  /** flash: the text also turns gold for a moment (e.g. respins reset) */
  popBar(side: 'left' | 'right', flash = false) {
    const t = side === 'left' ? this.left : this.right;
    pop(this.scene, t);
    if (!flash) return;
    const color = side === 'left' ? '#ffffff' : this.theme.sub;
    t.setColor(THEME.gold);
    this.scene.time.delayedCall(450, () => t.setColor(color));
  }

  /** label flies from the reel center into one side of the bar, which then shows text and pops. Non-blocking. */
  fly(label: string, side: 'left' | 'right', text: string) {
    const t = side === 'left' ? this.left : this.right;
    const f = this.flyer;
    this.scene.tweens.killTweensOf(f);
    f.setText(label).setPosition(cellX(2), cellY(1)).setScale(1.6).setAlpha(1).setVisible(true);
    this.scene.tweens.add({
      targets: f,
      x: t.x,
      y: t.y,
      scale: 0.7,
      duration: 450,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        f.setVisible(false);
        t.setText(text);
        this.popBar(side);
      },
    });
  }

  private show(title: string, sub: string, hint: string) {
    this.text(this.title, title);
    this.text(this.sub, sub);
    this.text(this.hint, hint);
    fadeIn(this.scene, this.dim, 0.78);
    fadeIn(this.scene, this.title);
    fadeIn(this.scene, this.sub);
    fadeIn(this.scene, this.hint);
  }

  private hide() {
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
    this.title.setPosition(cx, cy - sd(130)).setStroke(stroke, sd(14));
    this.sub.setPosition(cx, cy + sd(40)).setStroke(stroke, sd(12));
    this.hint.setPosition(cx, cy + sd(190)).setStroke(stroke, sd(6));
    this.text(this.title, this.title.text);
    this.text(this.sub, this.sub.text);
    this.text(this.hint, this.hint.text);
  }
}
