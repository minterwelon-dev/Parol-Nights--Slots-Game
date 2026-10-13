import Phaser from 'phaser';
import { ART } from '../theme/parolNights';
import { DEPTH, THEME } from '../constants';
import { GAME_TITLE } from '../gameConfig';
import { fitText } from '../utils/fitText';
import { sd, sx, sy } from '../utils/responsive';

export const LOGO_KEY = ART.logo.key;

/** Live title over the approved, text-free banner. Coordinates are reference units. */
export class Title {
  readonly text: Phaser.GameObjects.Text;
  private ornament?: Phaser.GameObjects.Image;
  private position = { x: 0, y: 0, width: 0, font: 0 };

  constructor(private scene: Phaser.Scene) {
    this.text = scene.add
      .text(0, 0, GAME_TITLE, {
        fontFamily: THEME.fonts.title,
        fontStyle: 'bold',
        color: '#FFC94A',
        stroke: '#0B1033',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD);
    this.attachOrnament();
    scene.load.on(`filecomplete-image-${LOGO_KEY}`, this.attachOrnament, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.load.off(`filecomplete-image-${LOGO_KEY}`, this.attachOrnament, this);
    });
  }

  private attachOrnament() {
    if (this.ornament || !this.scene.textures.exists(LOGO_KEY)) return;
    this.ornament = this.scene.add.image(0, 0, LOGO_KEY).setDepth(DEPTH.HUD);
    this.scene.children.bringToTop(this.text);
    this.place(this.position.x, this.position.y, this.position.width, this.position.font);
  }

  place(x: number, y: number, width: number, font: number) {
    this.position = { x, y, width, font };
    if (!width) return;
    this.ornament?.setPosition(sx(x), sy(y)).setDisplaySize(sd(width), sd((width * 288) / 768));
    // Clear inner panel: x ~24%-76%; y ~27%-53%. Center on that panel, not the tassels.
    this.text
      .setPosition(sx(x), sy(y - width * 0.04))
      .setStroke('#0B1033', sd(2))
      .setShadow(0, sd(1), '#FF9F1C', sd(4), false, true);
    fitText(this.text, sd(font), sd(width * 0.52));
  }
}
