import Phaser from 'phaser';
import { DEPTH, THEME } from '../../constants';
import { gameConfig } from '../../gameConfig';
import { sd } from '../../utils/responsive';
import type { AnimationService } from './AnimationService';
import { FX } from './fxTextures';

const F = gameConfig.anim.feature;
const LIGHT_TINTS = [0xff5a5a, 0xffd34d, 0x6ee08a];
/** Unlit light / spent pip. */
const OFF_ALPHA = 0.35;

type Scalable = Phaser.GameObjects.Text | Phaser.GameObjects.Image;

/**
 * Feature presentation pieces (spec section 9) shared by FeatureOverlay, Free Spins and
 * Hold & Win. Every piece is pooled and lands on its end state when cut short.
 */

/** Text slides up into place while fading in (alpha comes from the caller's fade). */
export function slideIn(
  scene: Phaser.Scene,
  anim: AnimationService,
  t: Scalable,
  fromDy: number,
  ms: number,
) {
  if (anim.reduced) return;
  const y = t.y;
  t.setY(y + fromDy);
  scene.tweens.add({ targets: t, y, duration: ms, ease: 'Back.easeOut' });
}

/**
 * Flip through zero on one axis; onMid swaps the content while edge-on. Text rests at scale 1;
 * an image passes its rest scale (it is sized with setDisplaySize).
 */
export function flip(
  scene: Phaser.Scene,
  anim: AnimationService,
  o: Scalable,
  axis: 'x' | 'y',
  onMid?: () => void,
  rest = 1,
) {
  const key = axis === 'x' ? 'scaleX' : 'scaleY';
  scene.tweens.killTweensOf(o);
  if (anim.reduced) {
    onMid?.();
    o[key] = rest;
    return;
  }
  scene.tweens.add({
    targets: o,
    [key]: 0,
    duration: F.flipMs / 2,
    ease: 'Sine.easeIn',
    onComplete: () => {
      onMid?.();
      scene.tweens.add({ targets: o, [key]: rest, duration: F.flipMs / 2, ease: 'Back.easeOut' });
    },
  });
}

/** Lantern string over the feature title: lights come on left to right (intro). */
export class StringLights {
  private lights: Phaser.GameObjects.Image[] = [];

  constructor(
    private scene: Phaser.Scene,
    private anim: AnimationService,
  ) {
    for (let i = 0; i < F.lights; i++) {
      this.lights.push(
        scene.add
          .image(0, 0, FX.glow)
          .setTint(LIGHT_TINTS[i % LIGHT_TINTS.length])
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(DEPTH.BIG_WIN)
          .setVisible(false),
      );
    }
  }

  /** Light the string along a sagging arc of width w centered at (x, y), canvas px. */
  play(x: number, y: number, w: number) {
    const n = this.lights.length;
    const size = sd(46);
    for (let i = 0; i < n; i++) {
      const l = this.lights[i];
      const k = i / (n - 1);
      this.scene.tweens.killTweensOf(l);
      l.setPosition(x - w / 2 + k * w, y + sd(34) * Math.sin(Math.PI * k))
        .setDisplaySize(size, size)
        .setVisible(true);
      if (this.anim.reduced) {
        l.setAlpha(1);
        continue;
      }
      l.setAlpha(OFF_ALPHA);
      this.scene.tweens.add({
        targets: l,
        alpha: 1,
        duration: gameConfig.anim.timings.lightOnMs,
        delay: i * F.lightStepMs,
      });
    }
  }

  hide() {
    for (const l of this.lights) {
      this.scene.tweens.killTweensOf(l);
      l.setVisible(false);
    }
  }
}

/** Hold & Win respin pips: one is spent per respin, a new coin refills all with a stagger. */
export class Pips {
  private pips: Phaser.GameObjects.Image[] = [];
  private lit = 0;
  private size = 0;

  constructor(
    private scene: Phaser.Scene,
    private anim: AnimationService,
  ) {
    for (let i = 0; i < F.pips; i++) {
      this.pips.push(
        scene.add.image(0, 0, FX.coinDot).setDepth(DEPTH.FEATURE_OVERLAY).setVisible(false),
      );
    }
  }

  /** Width of the pip row, canvas px. */
  get width() {
    return this.size * (F.pips * 1.5 - 0.5);
  }

  /** Row starts at x (left edge), centered on y. size = pip diameter, canvas px. */
  place(x: number, y: number, size: number) {
    this.size = size;
    for (let i = 0; i < this.pips.length; i++) {
      this.pips[i].setPosition(x + size / 2 + i * size * 1.5, y).setDisplaySize(size, size);
    }
  }

  /** n lit; refill = a new coin reset them (staggered refill + pulse). null hides the row. */
  set(n: number | null, refill = false) {
    if (n === null) {
      for (const p of this.pips) {
        this.scene.tweens.killTweensOf(p);
        p.setVisible(false);
      }
      this.lit = 0;
      return;
    }
    const prev = this.lit;
    this.lit = n;
    for (let i = 0; i < this.pips.length; i++) {
      const p = this.pips[i].setVisible(true);
      this.scene.tweens.killTweensOf(p);
      p.setDisplaySize(this.size, this.size);
      const on = i < n;
      if (this.anim.reduced) {
        this.style(p, on);
        continue;
      }
      if (refill && on) {
        this.style(p, false);
        this.pop(p, true, i * F.pipStepMs);
      } else if (!on && i < prev) {
        this.pop(p, false); // spent this respin
      } else this.style(p, on);
    }
  }

  private style(p: Phaser.GameObjects.Image, on: boolean) {
    p.setAlpha(on ? 1 : OFF_ALPHA).setTint(on ? 0xffffff : 0x8a96c8);
  }

  /** Quick size pop after delay, ending lit or spent. */
  private pop(p: Phaser.GameObjects.Image, on: boolean, delay = 0) {
    const s = this.size;
    this.scene.tweens.add({
      targets: p,
      displayWidth: { from: s * 1.6, to: s },
      displayHeight: { from: s * 1.6, to: s },
      delay,
      duration: gameConfig.anim.timings.pipPopMs,
      ease: 'Back.easeOut',
      onStart: () => this.style(p, on),
    });
  }
}

/** Gold text flash + scale pulse + sparkle burst (multiplier milestones). */
export function milestone(
  scene: Phaser.Scene,
  anim: AnimationService,
  t: Phaser.GameObjects.Text,
  color: string,
) {
  t.setColor(THEME.gold);
  scene.time.delayedCall(gameConfig.anim.timings.milestoneFlashMs, () => t.setColor(color));
  if (anim.reduced) return;
  scene.tweens.killTweensOf(t);
  t.setScale(F.milestoneScale);
  scene.tweens.add({
    targets: t,
    scale: 1,
    duration: gameConfig.anim.timings.milestonePulseMs,
    ease: 'Back.easeOut',
  });
  anim.fx.burst(DEPTH.BIG_WIN, t.x, t.y, anim.count(gameConfig.anim.burst.count));
}
