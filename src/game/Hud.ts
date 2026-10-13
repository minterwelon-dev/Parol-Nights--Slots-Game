import Phaser from 'phaser';
import { DEPTH, HUD_LAYOUT, POD, THEME } from '../constants';
import { UI } from '../scenes/BootScene';
import { gameConfig } from '../gameConfig';
import { Title } from './Title';
import { formatMoney } from '../utils/format';
import { sd, sx, sy, type Layout } from '../utils/responsive';
import { press } from './fx';

/** spin = ready, stop = tap to quick-stop, off = unavailable, loading = deferred assets pending */
export type SpinMode = 'spin' | 'stop' | 'off' | 'loading';

export interface HudHandlers {
  spin(): void;
  betDown(): void;
  betUp(): void;
  turbo(): void;
  mute(): void;
  info(): void;
}

const OFF_ALPHA = 0.35;

/** A pressable image with a text label; ignores presses while disabled. */
class Button {
  readonly img: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
  enabled = true;
  tint = 0xffffff;

  constructor(
    scene: Phaser.Scene,
    texture: string,
    text: string,
    color: string,
    onPress: () => void,
  ) {
    this.img = scene.add
      .image(0, 0, texture)
      .setDepth(DEPTH.HUD)
      .setInteractive({ useHandCursor: true });
    this.label = scene.add
      .text(0, 0, text, { fontFamily: THEME.fonts.ui, color })
      .setOrigin(0.5)
      .setDepth(DEPTH.HUD);
    this.img.on('pointerdown', () => {
      if (!this.enabled) return;
      press(scene, this.img, this.label);
      onPress();
      this.img.setTint(0xffe4a0);
    });
    const release = () => this.img.setTint(this.enabled ? this.tint : 0x888899);
    this.img.on('pointerup', release).on('pointerout', release);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.img.setAlpha(on ? 1 : OFF_ALPHA).setTint(on ? this.tint : 0x888899);
    this.label.setAlpha(on ? 1 : OFF_ALPHA);
  }

  place(x: number, y: number, w: number, h: number, font: number) {
    const fit = Math.min(w / this.img.width, h / this.img.height);
    this.img.setPosition(x, y).setDisplaySize(this.img.width * fit, this.img.height * fit);
    // optical centering: heavy glyphs sit a touch high
    this.label.setPosition(x, y - font * 0.04).setFontSize(Math.round(font));
  }
}

/**
 * Layered spin button: breathing glow (ready), gold disc, arrow ring that rotates while the
 * reels spin, and a stop square inside the ring (tap = quick stop). All layers share one
 * 256 px source size, so they stack exactly at any display size.
 */
class SpinButton {
  readonly disc: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private arrow: Phaser.GameObjects.Image;
  private mark: Phaser.GameObjects.Image;
  private breathe: Phaser.Tweens.Tween;
  private turn: Phaser.Tweens.Tween;

  constructor(private scene: Phaser.Scene) {
    const img = (key: string) => scene.add.image(0, 0, key).setDepth(DEPTH.HUD);
    this.glow = img(UI.glow).setVisible(false);
    this.disc = img(UI.spin).setInteractive({ useHandCursor: true });
    this.arrow = img(UI.spinArrow);
    this.mark = img(UI.stop).setVisible(false);
    this.breathe = scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.2, to: 0.65 },
      duration: 1100,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      paused: true,
      persist: true,
    });
    this.turn = scene.tweens.add({
      targets: this.arrow,
      angle: 360,
      duration: 750,
      repeat: -1,
      paused: true,
      persist: true,
    });
  }

  setMode(mode: SpinMode) {
    const live = mode === 'spin' || mode === 'stop';
    const a = live ? 1 : 0.45;
    this.disc.setAlpha(a).setTint(live ? (mode === 'stop' ? 0xffe4a0 : 0xffffff) : 0x888899);
    this.arrow.setAlpha(a);
    this.mark.setVisible(mode === 'stop');
    if (mode === 'stop') this.turn.restart();
    else {
      this.turn.pause();
      this.arrow.setAngle(0);
    }
    this.glow.setVisible(mode === 'spin');
    if (mode === 'spin') this.breathe.resume();
    else this.breathe.pause();
  }

  squash() {
    press(this.scene, this.disc, this.arrow, this.mark);
  }

  place(x: number, y: number, size: number) {
    for (const o of [this.glow, this.disc, this.arrow, this.mark]) o.setPosition(x, y);
    this.glow.setDisplaySize(size * 1.5, size * 1.5);
    this.disc.setDisplaySize(size, size);
    this.arrow.setDisplaySize(size, size);
    this.mark.setDisplaySize(size, size);
  }
}

/**
 * Player controls and readouts: logo, control panel with BALANCE / BET / WIN pods, spin,
 * turbo. Emits intents only; GameScene + state machine decide. The WIN value text itself
 * belongs to WinPresenter (count-up); the HUD only draws its label.
 */
export class Hud {
  private spinBtn: SpinButton;
  private mode: SpinMode = 'off';
  private turboOn = false;
  private betDown: Button;
  private betUp: Button;
  private turboBtn: Button;
  private muteBtn: Phaser.GameObjects.Image;
  private infoBtn: Button;
  private panel: Phaser.GameObjects.Graphics;
  private logo: Title;
  private labels: {
    balance: Phaser.GameObjects.Text;
    bet: Phaser.GameObjects.Text;
    win: Phaser.GameObjects.Text;
  };
  private betValue: Phaser.GameObjects.Text;
  private balance: Phaser.GameObjects.Text;
  private loading: Phaser.GameObjects.Text;
  /** balance text value, minor units; the roll-up starts from here */
  private shownBalance = 0;
  private balanceCount?: Phaser.Tweens.Tween;

  constructor(
    private scene: Phaser.Scene,
    h: HudHandlers,
  ) {
    this.panel = scene.add.graphics().setDepth(DEPTH.HUD);
    this.logo = new Title(scene);

    this.spinBtn = new SpinButton(scene);
    const spin = () => {
      if (this.mode !== 'spin' && this.mode !== 'stop') return;
      this.spinBtn.squash();
      h.spin();
    };
    this.spinBtn.disc.on('pointerdown', spin);
    scene.input.keyboard?.on('keydown-SPACE', spin);

    this.betDown = new Button(scene, UI.round, '−', THEME.gold, h.betDown);
    this.betUp = new Button(scene, UI.round, '+', THEME.gold, h.betUp);
    this.turboBtn = new Button(scene, UI.pillOff, 'TURBO', THEME.muted, h.turbo);
    this.muteBtn = scene.add
      .image(0, 0, UI.soundOn)
      .setDepth(DEPTH.HUD)
      .setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', () => {
      press(scene, this.muteBtn);
      h.mute();
    });
    this.infoBtn = new Button(scene, UI.round, 'i', THEME.gold, h.info);
    this.infoBtn.label.setFontFamily(THEME.fonts.ui).setFontStyle('bold');

    const text = (color: string, font: string) =>
      scene.add.text(0, 0, '', { fontFamily: font, color }).setOrigin(0.5).setDepth(DEPTH.HUD);
    const label = (s: string) => text(THEME.muted, THEME.fonts.ui).setText(s).setFontStyle('bold');
    this.labels = { balance: label('BALANCE'), bet: label('BET'), win: label('WIN') };
    this.betValue = text(THEME.text, THEME.fonts.numeric).setFontStyle('bold');
    this.balance = text(THEME.text, THEME.fonts.numeric).setFontStyle('bold');
    this.loading = text(THEME.text, THEME.fonts.ui).setAlign('center').setVisible(false);

    this.setSpinMode('off');
    this.setTurbo(false);
    this.setBet(0, false, false);
  }

  setSpinMode(mode: SpinMode) {
    this.mode = mode;
    this.spinBtn.setMode(mode);
    this.loading.setVisible(mode === 'loading');
  }

  /** Deferred asset progress, 0..1, shown on the spin button while it is in 'loading'. */
  setLoading(p: number) {
    this.loading.setText(`LOADING\n${Math.round(p * 100)}%`);
  }

  /** count: roll up from the shown value (after a win). The text always ends on minor. */
  setBalance(minor: number, count = false) {
    this.balanceCount?.stop();
    const from = this.shownBalance;
    this.shownBalance = minor;
    if (!count || minor <= from) {
      this.balance.setText(formatMoney(minor));
      return;
    }
    this.balanceCount = this.scene.tweens.addCounter({
      from,
      to: minor,
      duration: gameConfig.win.balanceCountMs,
      ease: 'Sine.easeOut',
      onUpdate: (t) => this.balance.setText(formatMoney(Math.floor(t.getValue() ?? minor))),
      onComplete: () => this.balance.setText(formatMoney(minor)),
    });
  }

  /** canDown / canUp: bet level exists and bet changes are allowed right now */
  setBet(minor: number, canDown: boolean, canUp: boolean) {
    this.betValue.setText(minor > 0 ? formatMoney(minor) : '-');
    this.betDown.setEnabled(canDown);
    this.betUp.setEnabled(canUp);
  }

  /** Paytable opens from Idle only. */
  setInfoEnabled(on: boolean) {
    this.infoBtn.setEnabled(on);
  }

  setMuted(muted: boolean) {
    this.muteBtn.setTexture(muted ? UI.soundOff : UI.soundOn);
  }

  /** ON: solid gold pill, dark text. OFF: outlined pill, muted text. Always pressable. */
  setTurbo(on: boolean) {
    this.turboOn = on;
    this.turboBtn.tint = on ? 0xffdf80 : 0xb0b0c8;
    this.turboBtn.img.setTint(this.turboBtn.tint);
    this.turboBtn.label.setColor(on ? THEME.gold : THEME.muted);
  }

  relayout(l: Layout) {
    const p = l.landscape ? HUD_LAYOUT.landscape : HUD_LAYOUT.portrait;
    const f = p.font;

    this.logo.place(p.logo.x, p.logo.y, p.logo.width, p.logo.font);

    const g = this.panel.clear();
    for (const r of p.panels) {
      g.fillStyle(THEME.panel, 0.92).fillRoundedRect(sx(r.x), sy(r.y), sd(r.w), sd(r.h), sd(32));
      g.lineStyle(sd(3), THEME.panelEdge, 1).strokeRoundedRect(
        sx(r.x),
        sy(r.y),
        sd(r.w),
        sd(r.h),
        sd(32),
      );
      g.lineStyle(sd(2), THEME.panelEdge, 0.7);
      for (const x of r.dividers)
        g.lineBetween(sx(x), sy(r.y + r.h * 0.22), sx(x), sy(r.y + r.h * 0.78));
    }

    this.spinBtn.place(sx(p.spin.x), sy(p.spin.y), sd(p.spin.size));
    this.loading
      .setPosition(sx(p.spin.x), sy(p.spin.y))
      .setFontSize(Math.round(sd(p.spin.size * 0.13)))
      .setStroke(THEME.stroke, sd(6));

    this.pod(this.labels.balance, this.balance, p.balance.x, p.balance.y, f.label, f.value);
    this.pod(this.labels.bet, this.betValue, p.bet.x, p.bet.y, f.label, f.value);
    this.labels.win
      .setPosition(sx(p.win.x), sy(p.win.y + POD.labelDy))
      .setFontSize(Math.round(sd(f.label)));

    const b = p.bet;
    const btn = sd(b.btn);
    this.betDown.place(sx(b.x - b.gap), sy(b.y), btn, btn, sd(f.btn));
    this.betUp.place(sx(b.x + b.gap), sy(b.y), btn, btn, sd(f.btn));

    this.muteBtn
      .setPosition(sx(p.mute.x), sy(p.mute.y))
      .setDisplaySize(sd(p.mute.size), sd(p.mute.size));
    const inf = p.info;
    this.infoBtn.place(sx(inf.x), sy(inf.y), sd(inf.size), sd(inf.size), sd(inf.size * 0.62));

    const t = p.turbo;
    this.turboBtn.place(sx(t.x), sy(t.y), sd(t.w), sd(t.h), sd(f.toggle));
    this.setTurbo(this.turboOn);
  }

  /** Label above, value below, both centered on x. */
  private pod(
    label: Phaser.GameObjects.Text,
    value: Phaser.GameObjects.Text,
    x: number,
    y: number,
    lf: number,
    vf: number,
  ) {
    label.setPosition(sx(x), sy(y + POD.labelDy)).setFontSize(Math.round(sd(lf)));
    value.setPosition(sx(x), sy(y + POD.valueDy)).setFontSize(Math.round(sd(vf)));
  }
}
