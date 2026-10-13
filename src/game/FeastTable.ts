import Phaser from 'phaser';
import { DEPTH, FEAST_LAYOUT } from '../constants';
import { UI } from '../scenes/BootScene';
import { FOOD } from '../theme/parolNights';
import { sd, sx, sy, type Layout } from '../utils/responsive';
import { gameConfig } from '../gameConfig';
import type { AnimationService } from './animation/AnimationService';

const F = gameConfig.anim.feature;

/** Dish size relative to its plate. */
const DISH = 0.8;
/** Silhouette of a dish not served yet. */
const EMPTY_TINT = 0x8a96c8;
const EMPTY_ALPHA = 0.3;

/**
 * Free Spins feast table: six plates fill with Noche Buena dishes as the round plays.
 * Presentation only. The fill level comes from response spin counts (played vs left), never
 * from outcomes, and it never goes down, so a retrigger slows the filling without emptying it.
 */
export class FeastTable {
  private plates: Phaser.GameObjects.Image[] = [];
  private dishes: Phaser.GameObjects.Image[] = [];
  private glows: Phaser.GameObjects.Image[] = [];
  private served = 0;
  private size = 0;

  constructor(
    private scene: Phaser.Scene,
    private anim: AnimationService,
  ) {
    const img = (key: string) =>
      scene.add.image(0, 0, key).setDepth(DEPTH.FEATURE_OVERLAY).setVisible(false);
    for (let i = 0; i < FOOD.length; i++) {
      this.plates.push(img(UI.round));
      this.glows.push(img(UI.glow).setBlendMode(Phaser.BlendModes.ADD));
      this.dishes.push(img(UI.px));
    }
  }

  /** Dishes served after `done` spins with `left` still to play. */
  private level(done: number, left: number) {
    return done + left > 0 ? Math.floor((done * FOOD.length) / (done + left)) : 0;
  }

  /** Show the table, already filled for a resumed round. */
  show(done: number, left: number) {
    this.served = this.level(done, left);
    for (let i = 0; i < FOOD.length; i++) {
      this.plates[i].setVisible(true);
      this.rest(i);
    }
  }

  /** After a spin: serve any dishes the progress has earned, with a pop and a glow burst. */
  fill(done: number, left: number) {
    const to = Math.max(this.served, this.level(done, left));
    for (let i = this.served; i < to; i++) {
      this.served = i + 1;
      this.rest(i);
      this.serve(i);
    }
  }

  /** Summary: every served dish sparkles in turn. */
  sparkle() {
    if (this.anim.reduced) return;
    for (let i = 0; i < this.served; i++) {
      const d = this.dishes[i];
      if (!d.visible) continue;
      this.scene.time.delayedCall(i * F.dishSparkleStepMs, () => {
        if (!d.visible) return;
        this.anim.fx.sparkle(DEPTH.BIG_WIN, d.x, d.y, this.anim.count(6));
        this.serve(i);
      });
    }
  }

  hide() {
    for (let i = 0; i < FOOD.length; i++) {
      this.scene.tweens.killTweensOf([this.dishes[i], this.glows[i]]);
      this.plates[i].setVisible(false);
      this.dishes[i].setVisible(false);
      this.glows[i].setVisible(false);
    }
  }

  private serve(i: number) {
    const dish = this.dishes[i];
    if (!dish.visible) return;
    const s = this.size * DISH;
    dish.setDisplaySize(s * 1.6, s * 1.6);
    this.scene.tweens.add({
      targets: dish,
      displayWidth: s,
      displayHeight: s,
      duration: F.dishPopMs,
      ease: 'Back.easeOut',
    });
    const glow = this.glows[i].setVisible(true).setAlpha(0.9).setDisplaySize(s, s);
    this.scene.tweens.add({
      targets: glow,
      displayWidth: this.size * 1.8,
      displayHeight: this.size * 1.8,
      alpha: 0,
      duration: gameConfig.anim.timings.dishGlowMs,
      ease: 'Sine.easeOut',
      onComplete: () => glow.setVisible(false),
    });
  }

  /**
   * Resting state of plate i. Dishes load deferred: a dish whose texture has not arrived yet
   * stays hidden and shows up on the next call.
   */
  private rest(i: number) {
    const dish = this.dishes[i];
    const key = FOOD[i].key;
    this.scene.tweens.killTweensOf([dish, this.glows[i]]);
    this.glows[i].setVisible(false);
    const ready = this.plates[i].visible && this.scene.textures.exists(key);
    if (ready && dish.texture.key !== key) dish.setTexture(key);
    const s = this.size * DISH;
    dish.setVisible(ready).setPosition(this.plates[i].x, this.plates[i].y).setDisplaySize(s, s);
    if (i < this.served) dish.clearTint().setAlpha(1);
    else dish.setTint(EMPTY_TINT).setAlpha(EMPTY_ALPHA);
  }

  relayout(l: Layout) {
    const p = l.landscape ? FEAST_LAYOUT.landscape : FEAST_LAYOUT.portrait;
    this.size = sd(p.size);
    for (let i = 0; i < FOOD.length; i++) {
      const [x, y] = p.plates[i];
      this.plates[i].setPosition(sx(x), sy(y)).setDisplaySize(this.size, this.size);
      this.glows[i].setPosition(sx(x), sy(y));
      this.rest(i);
    }
  }
}
