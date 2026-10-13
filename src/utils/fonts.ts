import Phaser from 'phaser';
import titleUrl from '@fontsource/cinzel-decorative/files/cinzel-decorative-latin-700-normal.woff2?url';
import uiUrl from '@fontsource/baloo-2/files/baloo-2-latin-400-normal.woff2?url';
import boldUrl from '@fontsource/baloo-2/files/baloo-2-latin-700-normal.woff2?url';
import { RELAYOUT, THEME } from '../constants';
import { layout } from './responsive';

/** Register only the three Latin WOFF2 faces used by the game. No CDN stylesheets. */
export function loadFonts(): Promise<unknown> {
  for (const [family, url, weight] of [
    ['Cinzel Decorative', titleUrl, '700'],
    ['Baloo 2', uiUrl, '400'],
    ['Baloo 2', boldUrl, '700'],
  ]) {
    document.fonts.add(
      new FontFace(family, `url("${url}")`, {
        weight,
        style: 'normal',
        display: 'swap',
        featureSettings: '"tnum"',
      }),
    );
  }
  for (const name of ['title', 'ui', 'numeric'] as const) {
    document.documentElement.style.setProperty(`--font-${name}`, THEME.fonts[name]);
  }
  // Font loading size is an API probe, not a rendered layout size.
  return Promise.all([
    document.fonts.load('700 16px "Cinzel Decorative"', 'Parol Nights ñÑ'),
    document.fonts.load('400 16px "Baloo 2"', '0123456789,.x% ñÑ'),
    document.fonts.load('700 16px "Baloo 2"', '0123456789,.x% ñÑ'),
  ]).catch(() => undefined); // A failed font must not block the fallback UI.
}

/** Repaint cached canvas Text after a late font load, including texts inside containers. */
export function refreshFonts(game: Phaser.Game): void {
  const refresh = (objects: Phaser.GameObjects.GameObject[]) => {
    for (const object of objects) {
      if (object instanceof Phaser.GameObjects.Text) {
        object.setFontFamily(object.style.fontFamily);
        object.updateText();
      } else if (object instanceof Phaser.GameObjects.Container) refresh(object.list);
    }
  };
  for (const scene of game.scene.getScenes(true)) refresh(scene.children.list);
  game.events.emit(RELAYOUT, layout); // Refit strings using the loaded face's metrics.
}
