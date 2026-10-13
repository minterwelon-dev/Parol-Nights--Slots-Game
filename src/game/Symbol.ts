import Phaser from 'phaser';
import type { SymbolId } from '../rgs/types';
import { gameConfig } from '../gameConfig';
import { blurKey, symbolKey } from '../scenes/BootScene';

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

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, id: SymbolId) {
    this.id = id;
    this.img = scene.add.image(0, 0, symbolKey(id));
    this.pivot = scene.add.container(0, 0, [this.img]);
    this.root = scene.add.container(0, 0, [this.pivot]);
    parent.add(this.root);
  }

  set(id: SymbolId) {
    if (id === this.id) return;
    this.id = id;
    this.img.setTexture(this.key());
    this.resize(this.size);
  }

  /**
   * Motion blur while the reel moves fast: smear texture (same source size, so the display size
   * holds) plus a slight vertical stretch and fade on the container.
   */
  setBlur(on: boolean) {
    if (on === this.blurred) return;
    this.blurred = on;
    this.img.setTexture(this.key());
    this.resize(this.size);
    this.root.setScale(1, on ? REEL.blurStretchY : 1).setAlpha(on ? REEL.blurAlpha : 1);
  }

  resize(size: number) {
    this.size = size;
    this.img.setDisplaySize(size, size).setY(size / 2);
    this.pivot.setY(-size / 2);
  }

  private key() {
    return this.blurred ? blurKey(this.id) : symbolKey(this.id);
  }
}
