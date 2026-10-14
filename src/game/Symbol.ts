import Phaser from 'phaser';
import type { SymbolId } from '../rgs/types';
import { gameConfig } from '../gameConfig';
import { blurKey, symbolKey } from '../scenes/BootScene';
import { MAX_SYMBOL_PARTS, partKey, SYMBOL_PARTS, UI } from '../theme/parolNights';

const REEL = gameConfig.anim.reel;

/**
 * One pooled symbol view. Reused across spins; only texture and position change.
 * root (cell center: reel motion, scale, alpha) > pivot (top center: sway angle) > img.
 */
export class SymbolView {
  readonly img: Phaser.GameObjects.Image;
  readonly root: Phaser.GameObjects.Container;
  readonly pivot: Phaser.GameObjects.Container;
  private size = 0;
  id: SymbolId;
  private blurred = false;
  private parts: Phaser.GameObjects.Image[] = [];
  private partRoots: Phaser.GameObjects.Container[] = [];
  layered = false;

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, id: SymbolId) {
    this.id = id;
    this.img = scene.add.image(0, 0, symbolKey(id));
    this.pivot = scene.add.container(0, 0, [this.img]);
    this.root = scene.add.container(0, 0, [this.pivot]);
    for (let i = 0; i < MAX_SYMBOL_PARTS; i++) {
      const part = scene.add.image(0, 0, UI.px);
      const root = scene.add.container(0, 0, [part]).setVisible(false);
      this.parts.push(part);
      this.partRoots.push(root);
      this.pivot.add(root);
    }
    parent.add(this.root);
    this.refreshParts();
  }

  set(id: SymbolId) {
    if (id === this.id) return;
    this.id = id;
    this.img.setTexture(this.key());
    this.refreshParts();
  }

  /**
   * Motion blur while the reel moves fast: smear texture (same source size, so the display size
   * holds) plus a slight vertical stretch and fade on the container.
   */
  setBlur(on: boolean) {
    if (on === this.blurred) return;
    this.blurred = on;
    this.img.setTexture(this.key());
    this.refreshParts();
    this.root.setScale(1, on ? REEL.blurStretchY : 1).setAlpha(on ? REEL.blurAlpha : 1);
  }

  resize(size: number) {
    this.size = size;
    this.img.setDisplaySize(size, size).setY(size / 2);
    this.pivot.setY(-size / 2);
    for (let i = 0; i < this.parts.length; i++) {
      const p = SYMBOL_PARTS[this.id]?.[i];
      this.parts[i]
        .setOrigin(0.5, p?.originY ?? 0.5)
        .setDisplaySize((size * (p?.width ?? 512)) / 512, (size * (p?.height ?? 512)) / 512);
      this.partRoots[i].setPosition(
        size * ((p?.x ?? 256) / 512 - 0.5),
        (size * (p?.y ?? 256)) / 512,
      );
    }
  }

  /** All layers must exist; a partial download retains the complete flat symbol. */
  refreshParts() {
    const names = SYMBOL_PARTS[this.id];
    this.layered = !!names && !this.blurred;
    if (names) {
      for (let i = 0; i < names.length; i++) {
        if (!this.img.scene.textures.exists(partKey(names[i].name))) this.layered = false;
      }
    }
    this.img.setVisible(!this.layered);
    for (let i = 0; i < this.parts.length; i++) {
      const visible = this.layered && !!names && i < names.length;
      this.partRoots[i].setVisible(visible).setAngle(0).setScale(1);
      if (visible) this.parts[i].setTexture(partKey(names![i].name));
    }
    this.resize(this.size);
  }

  get effectImage() {
    return this.layered ? this.parts[0] : this.img;
  }

  /** Parts inherit the cell's pop, dim and landing squash; only the core pulses locally. */
  animateParts(dt: number, speed: number, pulse: number, reduced: boolean) {
    if (!this.layered) return;
    const s = gameConfig.anim.symbols;
    if (reduced) {
      for (let i = 0; i < this.partRoots.length; i++) this.partRoots[i].setAngle(0).setScale(1);
      return;
    }
    if (this.id === 'H3') {
      this.partRoots[0].angle += (s.h3.innerDegPerSec * speed * dt) / 1000;
      this.partRoots[1].setAngle(0);
      this.partRoots[2].setScale(1 + s.h3.corePulse * pulse);
    } else if (this.id === 'WILD') {
      this.partRoots[0].angle += (s.wild.raysDegPerSec * speed * dt) / 1000;
      this.partRoots[1].setScale(1 + s.wild.corePulse * pulse);
    }
  }

  animateAttachments(time: number, weight: number, winning: boolean) {
    if (!this.layered || this.id === 'WILD') return;
    const s = gameConfig.anim.symbols;
    for (let i = this.id === 'H3' ? 3 : 1; i < this.parts.length; i++) {
      let angle = 0;
      const t = time - i * s.tassel.staggerMs;
      if (this.id === 'SCATTER') {
        const sc = s.scatter;
        const phase = winning
          ? Math.max(0, t)
          : ((t % sc.jingleEveryMs) + sc.jingleEveryMs) % sc.jingleEveryMs;
        const duration = winning ? sc.shakeStepMs * sc.shakeCycles * 2 : sc.jingleMs;
        if (phase < duration)
          angle =
            (winning ? sc.shakeDeg : sc.jingleDeg) *
            Math.sin((phase / duration) * Math.PI * sc.shakeCycles * 2) *
            (1 - phase / duration);
      } else angle = s.tassel.swayDeg * Math.sin((Math.PI * t) / s.tassel.swayMs);
      this.partRoots[i].setAngle(angle * weight);
    }
  }

  private key() {
    return this.blurred ? blurKey(this.id) : symbolKey(this.id);
  }
}
