import Phaser from 'phaser';
import { DEPTH, THEME } from '../constants';
import { UI } from '../scenes/BootScene';
import { dimLayer, fadeIn, fadeOut, press } from './fx';
import { sd, sx, sy, type Layout } from '../utils/responsive';

/** Blocking error / reconnect dialog with one action button. */
export class ErrorModal {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private dim: Phaser.GameObjects.Image;
  private panel: Phaser.GameObjects.Image;
  private text: Phaser.GameObjects.Text;
  private btn: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private resolve?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // dim is interactive so nothing underneath receives taps
    this.dim = dimLayer(scene, 0x000000, 0.65).setInteractive();
    this.panel = scene.add.image(0, 0, UI.panel);
    this.text = scene.add
      .text(0, 0, '', { fontFamily: THEME.fonts.ui, color: '#ffe9c4', align: 'center' })
      .setOrigin(0.5);
    this.btn = scene.add.image(0, 0, UI.btn).setInteractive({ useHandCursor: true });
    this.label = scene.add
      .text(0, 0, '', { fontFamily: THEME.fonts.numeric, color: THEME.gold })
      .setOrigin(0.5);
    this.root = scene.add.container(0, 0, [this.dim, this.panel, this.text, this.btn, this.label]);
    this.root.setDepth(DEPTH.ERROR_MODAL).setVisible(false);
    this.btn.on('pointerdown', () => {
      press(scene, this.btn, this.label);
      this.close();
    });
  }

  /** Resolves when the player presses the button. */
  show(message: string, action: string): Promise<void> {
    this.text.setText(message);
    this.label.setText(action);
    fadeIn(this.scene, this.root);
    return new Promise((r) => (this.resolve = r));
  }

  private close() {
    fadeOut(this.scene, this.root);
    const r = this.resolve;
    this.resolve = undefined;
    r?.();
  }

  relayout(l: Layout) {
    const cx = sx(l.w / 2);
    const cy = sy(l.h / 2);
    this.dim.setDisplaySize(this.scene.scale.width, this.scene.scale.height);
    this.panel.setPosition(cx, cy).setDisplaySize(sd(800), sd(450));
    this.text.setPosition(cx, cy - sd(60)).setFontSize(Math.round(sd(46)));
    this.btn.setPosition(cx, cy + sd(120)).setDisplaySize(sd((110 * 512) / 192), sd(110));
    this.label.setPosition(cx, cy + sd(120)).setFontSize(Math.round(sd(44)));
  }
}
