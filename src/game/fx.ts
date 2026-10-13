import Phaser from 'phaser';
import { UI } from '../scenes/BootScene';
import { layout } from '../utils/responsive';
import { THEME } from '../constants';
import { gameConfig } from '../gameConfig';

type Fadable =
  | Phaser.GameObjects.Image
  | Phaser.GameObjects.Text
  | Phaser.GameObjects.Graphics
  | Phaser.GameObjects.Container;

const FADE_IN_MS = gameConfig.anim.timings.fadeInMs;
const FADE_OUT_MS = gameConfig.anim.timings.fadeOutMs;

/**
 * Logo-style title: Cinzel gold gradient fill, navy stroke, warm outer glow. The gradient spans
 * the text's own height, so call again after any setText / font size change.
 */
export function goldTitle(t: Phaser.GameObjects.Text, glow: string, blur: number) {
  const [top, mid, bottom] = THEME.titleGold;
  const g = t.context.createLinearGradient(0, 0, 0, Math.max(1, t.height));
  g.addColorStop(0, top);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, bottom);
  t.setFill(g).setShadow(0, 0, glow, blur, false, true);
}

/** Full-screen tinted dim (1px texture). Size it with setDisplaySize(scale.width, scale.height) on relayout. */
export const dimLayer = (scene: Phaser.Scene, tint: number, alpha: number, depth = 0) =>
  scene.add.image(0, 0, UI.px).setOrigin(0).setTint(tint).setAlpha(alpha).setDepth(depth);

/** Scale pop as an animation multiplier; layout size stays the font size. Call after fadeIn. */
export function pop(scene: Phaser.Scene, t: Phaser.GameObjects.Text, from = 1.3) {
  t.setScale(from);
  scene.tweens.add({
    targets: t,
    scale: 1,
    duration: gameConfig.anim.timings.textPopMs,
    ease: 'Back.easeOut',
  });
}

type Pressable = Phaser.GameObjects.Image | Phaser.GameObjects.Text;
/** Running presses and the rest scale they return to. */
const pressing = new WeakMap<Pressable, { tween: Phaser.Tweens.Tween; x: number; y: number }>();

/**
 * Press feedback: dip to 88% and spring back. Images are always sized with sd(), so their rest
 * scale is kept in layout units and a resize mid-press still ends at the new size; text rests at 1.
 * Uses its own counter, so fades running on the same objects are untouched.
 */
export function press(scene: Phaser.Scene, ...objs: Pressable[]) {
  pressBy(scene, 0.88, 220, objs);
}

/** press() with its own dip and duration (the spin button uses the spec's 0.94 / 80 ms). */
export function pressBy(scene: Phaser.Scene, dip: number, ms: number, objs: readonly Pressable[]) {
  for (const o of objs) {
    const prev = pressing.get(o);
    prev?.tween.stop();
    const text = o instanceof Phaser.GameObjects.Text;
    // pressed again mid-dip: the current scale is dipped, keep the first press's rest scale
    const x = prev ? prev.x : text ? 1 : o.scaleX / layout.s;
    const y = prev ? prev.y : text ? 1 : o.scaleY / layout.s;
    const tween = scene.tweens.addCounter({
      from: dip,
      to: 1,
      duration: ms,
      ease: 'Back.easeOut',
      onUpdate: (t) => {
        const k = (t.getValue() ?? 1) * (text ? 1 : layout.s);
        o.setScale(x * k, y * k);
      },
      onComplete: () => pressing.delete(o),
    });
    pressing.set(o, { tween, x, y });
  }
}

/** Show from transparent to `alpha`. Non-blocking; replaces any tween already running on obj. */
export function fadeIn(scene: Phaser.Scene, obj: Fadable, alpha = 1, ms = FADE_IN_MS) {
  scene.tweens.killTweensOf(obj);
  obj.setVisible(true).setAlpha(0);
  scene.tweens.add({ targets: obj, alpha, duration: ms, ease: 'Sine.easeOut' });
}

/** Fade to transparent, then hide. Non-blocking: game logic never waits for it. */
export function fadeOut(scene: Phaser.Scene, obj: Fadable, ms = FADE_OUT_MS) {
  if (!obj.visible) return;
  scene.tweens.killTweensOf(obj);
  // a pop cut short by the kill would leave the text oversized for its next appearance
  if (obj instanceof Phaser.GameObjects.Text) obj.setScale(1);
  scene.tweens.add({
    targets: obj,
    alpha: 0,
    duration: ms,
    ease: 'Sine.easeIn',
    onComplete: () => obj.setVisible(false),
  });
}
