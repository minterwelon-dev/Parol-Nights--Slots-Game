import Phaser from 'phaser';
import { gameConfig } from '../../gameConfig';
import type { AnimationService } from './AnimationService';

const HUD = gameConfig.anim.hud;

/** HUD feedback (spec section 10): tint and scale only. */

/** Small scale nudge on a counter whose value changed (e.g. bet). Text rests at scale 1. */
export function nudge(scene: Phaser.Scene, anim: AnimationService, t: Phaser.GameObjects.Text) {
  if (anim.reduced) return;
  scene.tweens.killTweensOf(t);
  t.setScale(HUD.nudgeScale);
  scene.tweens.add({ targets: t, scale: 1, duration: HUD.nudgeMs, ease: 'Back.easeOut' });
}

/** Hover tint on a pressable image while `enabled()`; `rest()` gives the tint to return to. */
export function hover(img: Phaser.GameObjects.Image, enabled: () => boolean, rest: () => number) {
  img.on('pointerover', () => enabled() && img.setTint(HUD.hoverTint));
  img.on('pointerout', () => img.setTint(rest()));
}
