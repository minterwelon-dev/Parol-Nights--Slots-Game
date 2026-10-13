import Phaser from 'phaser';
import type { SymbolId } from '../rgs/types';
import { blurKey, symbolKey } from '../scenes/BootScene';

/** One pooled symbol view. Reused across spins; only texture and position change. */
export class SymbolView {
  readonly img: Phaser.GameObjects.Image;
  id: SymbolId;
  private blurred = false;

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, id: SymbolId) {
    this.id = id;
    this.img = scene.add.image(0, 0, symbolKey(id));
    parent.add(this.img);
  }

  set(id: SymbolId) {
    if (id === this.id) return;
    this.id = id;
    this.img.setTexture(this.key());
  }

  /** Motion-blur copy while the reel moves fast. Same source size, so the display size holds. */
  setBlur(on: boolean) {
    if (on === this.blurred) return;
    this.blurred = on;
    this.img.setTexture(this.key());
  }

  private key() {
    return this.blurred ? blurKey(this.id) : symbolKey(this.id);
  }
}
