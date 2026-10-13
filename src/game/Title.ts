import Phaser from 'phaser';
import { ART } from '../theme/parolNights';
import { DEPTH, THEME } from '../constants';
import { GAME_TITLE } from '../gameConfig';
import { fitText } from '../utils/fitText';
import { sd, sx, sy } from '../utils/responsive';

export const LOGO_KEY = ART.logo.key;
/** Ornament height / width (768 x 288 art). */
export const ASPECT = 288 / 768;
/**
 * Centroid of the ornament's inner navy panel, as fractions of the art, measured from the
 * delivered WebP (panel spans x 149-618, y 73-163 of 768 x 288). The title centers here.
 */
export const PANEL = { x: 383.6 / 768, y: 119.3 / 288, w: 469 / 768, h: 90 / 288 };

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
        stroke: THEME.stroke,
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
    const height = width * ASPECT;
    this.ornament?.setPosition(sx(x), sy(y)).setDisplaySize(sd(width), sd(height));
    const t = this.text
      .setStroke(THEME.stroke, sd(2))
      .setShadow(0, sd(1), '#FF9F1C', sd(4), false, true);
    fitText(t, sd(font), sd(width * 0.52));
    // Center the letters' ink, not the text box: the box keeps room for descenders and accents
    // the all-caps title never uses, so its center sits below the visible letters.
    const m = t.context.measureText(t.text);
    const stroke = t.style.strokeThickness;
    const inkX = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft - m.width) / 2;
    const baseline = stroke / 2 + t.style.getTextMetrics().ascent;
    const inkY =
      baseline - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2 - t.height / 2;
    t.setPosition(
      sx(x + width * (PANEL.x - 0.5)) - inkX * t.scaleX,
      sy(y + height * (PANEL.y - 0.5)) - inkY * t.scaleY,
    );
  }
}
