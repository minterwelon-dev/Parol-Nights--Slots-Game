import Phaser from 'phaser';
import { gameConfig } from '../../gameConfig';
import { layout } from '../../utils/responsive';
import { FX } from './fxTextures';

const BURST = gameConfig.anim.burst;
/** Sparkle size in reference px. */
const SPARK_PX = 40;
/** Rings that can expand at once per depth. */
const RINGS = 6;

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/**
 * Pooled effects (spec section 11). Emitters and rings are created once per depth on first use
 * and reused; nothing is created or destroyed per spin.
 */
export class FxPool {
  private sparks = new Map<number, Emitter>();
  private bursts = new Map<number, Emitter>();
  private rings = new Map<number, Phaser.GameObjects.Image[]>();
  private ringNext = 0;
  /** emitters owned elsewhere (big win rain) that count toward the particle cap */
  private extra: Emitter[] = [];

  constructor(
    private scene: Phaser.Scene,
    private cap: number,
  ) {}

  /** Count an emitter created elsewhere toward alive(). */
  register(e: Emitter) {
    this.extra.push(e);
  }

  /** Particles alive across every pooled and registered emitter (dev budget check). */
  alive() {
    let n = 0;
    for (const e of this.sparks.values()) n += e.getAliveParticleCount();
    for (const e of this.bursts.values()) n += e.getAliveParticleCount();
    for (const e of this.extra) n += e.getAliveParticleCount();
    return n;
  }

  /** n gold sparkles drifting out from (x, y), canvas px. */
  sparkle(depth: number, x: number, y: number, n: number) {
    const k = this.room(n);
    if (k > 0) this.emitter(this.sparks, depth, 30, 80, 500, 1).explode(k, x, y);
  }

  /** Fast star burst (win burst row of the spec table). */
  burst(depth: number, x: number, y: number, n: number) {
    const [lo, hi] = BURST.speed;
    const k = this.room(n);
    if (k > 0) this.emitter(this.bursts, depth, lo, hi, BURST.lifespanMs, 1.4).explode(k, x, y);
  }

  /** How many of n more particles fit under the cap (hard limit across all emitters). */
  private room(n: number) {
    return Math.min(n, this.cap - this.alive());
  }

  /** Expanding additive ring: scale `from` -> `to` of size px, alpha 1 -> 0 over ms. */
  ring(
    depth: number,
    x: number,
    y: number,
    size: number,
    from: number,
    to: number,
    ms: number,
    tint = 0xffe9a8,
  ) {
    let pool = this.rings.get(depth);
    if (!pool) {
      pool = [];
      for (let i = 0; i < RINGS; i++) {
        pool.push(
          this.scene.add
            .image(0, 0, FX.ring)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(depth)
            .setVisible(false),
        );
      }
      this.rings.set(depth, pool);
    }
    const img = pool[this.ringNext++ % RINGS];
    this.scene.tweens.killTweensOf(img);
    const base = size / img.width;
    img
      .setPosition(x, y)
      .setScale(base * from)
      .setAlpha(1)
      .setTint(tint)
      .setVisible(true);
    this.scene.tweens.add({
      targets: img,
      scale: base * to,
      alpha: 0,
      duration: ms,
      ease: 'Cubic.easeOut',
      onComplete: () => img.setVisible(false),
    });
  }

  private emitter(
    pool: Map<number, Emitter>,
    depth: number,
    speedLo: number,
    speedHi: number,
    lifespan: number,
    size: number,
  ) {
    let e = pool.get(depth);
    if (e) return e;
    const tex = this.scene.textures.get(FX.spark).getSourceImage().width;
    const px = () => (SPARK_PX * size * layout.s) / tex; // follows the layout, so no relayout hook
    e = this.scene.add
      .particles(0, 0, FX.spark, {
        // visual-only randomness: Phaser's generator (set at game boot), never the math RNG
        speed: { onEmit: () => Phaser.Math.RND.between(speedLo, speedHi) * layout.s },
        angle: { min: 0, max: 360 },
        scale: { onEmit: px, onUpdate: (_p, _k, t) => px() * (1 - t) },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 90 },
        tint: 0xffe08a,
        lifespan,
        blendMode: Phaser.BlendModes.ADD,
        maxAliveParticles: this.cap,
        emitting: false,
      })
      .setDepth(depth);
    pool.set(depth, e);
    return e;
  }
}
