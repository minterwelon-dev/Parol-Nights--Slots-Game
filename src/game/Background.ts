import Phaser from 'phaser';
import { DEPTH } from '../constants';
import { ART } from '../theme/parolNights';
import { layout, sd, sx, sy, type Layout } from '../utils/responsive';

/** Cover-fit art; retain the loaded orientation until the other background arrives. */
/** Extra cover so the ambient parallax never shows an edge (reference px, per side). */
const PARALLAX_MARGIN = 8;

export class Background {
  private image: Phaser.GameObjects.Image;
  /** layout x of the image center, before the ambient parallax offset */
  private baseX = 0;
  private parallax = 0;
  constructor(private scene: Phaser.Scene) {
    const requested = layout.landscape ? ART.landscape : ART.portrait;
    const available = scene.textures.exists(requested.key)
      ? requested
      : layout.landscape
        ? ART.portrait
        : ART.landscape;
    this.image = scene.add.image(0, 0, available.key).setDepth(DEPTH.BACKGROUND);
    scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, this.refresh, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      scene.load.off(Phaser.Loader.Events.FILE_COMPLETE, this.refresh, this),
    );
    this.relayout(layout);
  }
  private refresh() {
    this.relayout(layout);
  }
  relayout(l: Layout) {
    const key = (l.landscape ? ART.landscape : ART.portrait).key;
    if (this.scene.textures.exists(key)) this.image.setTexture(key);
    const source = this.image.texture.getSourceImage();
    const width = this.scene.scale.width / l.s;
    const height = this.scene.scale.height / l.s;
    const cover = Math.max(
      (width + PARALLAX_MARGIN * 2) / source.width,
      (height + PARALLAX_MARGIN * 2) / source.height,
    );
    this.baseX = sx(l.w / 2);
    this.image
      .setPosition(this.baseX + this.parallax, sy(l.h / 2))
      .setDisplaySize(sd(source.width * cover), sd(source.height * cover));
  }

  /** Ambient parallax: horizontal offset in canvas px (kept within the cover margin). */
  setParallax(dx: number) {
    this.parallax = dx;
    this.image.setX(this.baseX + dx);
  }

  /** Feature palette shift. */
  setTint(color: number) {
    this.image.setTint(color);
  }
}
