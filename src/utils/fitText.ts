import type Phaser from 'phaser';

/**
 * Render at the base font size, shrink only if wider than maxW (both canvas px).
 * Call after every setText on text that can outgrow its box (titles, amounts).
 * Cheap when it fits: no extra re-render unless the size actually changes.
 */
export function fitText(t: Phaser.GameObjects.Text, base: number, maxW: number) {
  if (base <= 0) return; // before the first relayout
  const px = Math.round(base);
  if (t.style.fontSize !== `${px}px`) t.setFontSize(px);
  if (t.width > maxW) t.setFontSize(Math.max(1, Math.floor((px * maxW) / t.width)));
}
