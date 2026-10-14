import Phaser from 'phaser';
import { DEPTH, RELAYOUT, THEME } from '../constants';
import { Title } from '../game/Title';
import { Background } from '../game/Background';
import { makeFxTextures } from '../game/animation/fxTextures';
import { ART, UI, symbolKey, blurKey, criticalArt, warnMissing } from '../theme/parolNights';
export { UI, symbolKey, blurKey } from '../theme/parolNights';
import type { SymbolId } from '../rgs/types';
import { layout, sd, sx, sy } from '../utils/responsive';

/** Source size of generated placeholder symbol textures (px). */
const SYMBOL_TEX = 256;

interface Art {
  bg: [string, string];
  label: string;
  color: string;
  size: number;
  round?: boolean;
}

// Generated stand-ins, used only for symbols whose delivered WebP fails to load.
const PLACEHOLDER: Record<SymbolId, Art> = {
  L1: { bg: ['#3b6fd6', '#1b2f66'], label: 'J', color: '#e6efff', size: 150 },
  L2: { bg: ['#36a85a', '#14462a'], label: 'Q', color: '#e6ffe9', size: 150 },
  L3: { bg: ['#8a4fd6', '#3a1b66'], label: 'K', color: '#f1e6ff', size: 150 },
  L4: { bg: ['#d6833b', '#663a1b'], label: 'A', color: '#fff1e6', size: 150 },
  H1: { bg: ['#2ec4d6', '#0f4a55'], label: '♦', color: '#e0fbff', size: 170 },
  H2: { bg: ['#e0457b', '#5c1430'], label: '♥', color: '#ffe3ee', size: 170 },
  H3: { bg: ['#e8402a', '#5a0f06'], label: '7', color: '#ffe08a', size: 180 },
  WILD: { bg: ['#ffd34d', '#a8610b'], label: 'WILD', color: '#5a2a00', size: 74 },
  SCATTER: { bg: ['#ff5cf1', '#4a0b66'], label: '★', color: '#fff6a8', size: 190 },
  COIN: { bg: ['#ffe27a', '#b07a12'], label: '$', color: '#7a4a00', size: 150, round: true },
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class BootScene extends Phaser.Scene {
  private critical = criticalArt(layout.landscape);
  constructor() {
    super('Boot');
  }

  /** Current-orientation art first; fallbacks are generated after loading completes. */
  preload() {
    this.critical = criticalArt(layout.landscape);
    let background: Background | undefined;
    const placeBackground = () => background?.relayout(layout);
    this.game.events.on(RELAYOUT, placeBackground);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off(RELAYOUT, placeBackground),
    );
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
      if (key === ART.landscape.key || key === ART.portrait.key) background = new Background(this);
    });
    const title = new Title(this);
    const placeTitle = () => title.place(layout.w / 2, layout.h / 2 - 220, 1000, 92);
    placeTitle();
    this.game.events.on(RELAYOUT, placeTitle);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off(RELAYOUT, placeTitle),
    );
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) =>
      warnMissing(file.key),
    );
    for (const item of this.critical) {
      if (item.url) this.load.image(item.key, item.url);
      else warnMissing(item.key);
    }
    const bar = this.add.graphics().setDepth(DEPTH.HUD);
    let progress = 0;
    const draw = (p: number) => {
      progress = p;
      const cx = sx(layout.w / 2);
      const cy = sy(layout.h / 2);
      const w = sd(560);
      const h = sd(18);
      bar
        .clear()
        .fillStyle(THEME.panel, 1)
        .fillRoundedRect(cx - w / 2, cy, w, h, h / 2);
      bar.fillStyle(0xffd34d, 1).fillRoundedRect(cx - w / 2, cy, Math.max(h, w * p), h, h / 2);
    };
    draw(0);
    this.load.on(Phaser.Loader.Events.PROGRESS, draw);
    const placeBar = () => draw(progress);
    this.game.events.on(RELAYOUT, placeBar);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(RELAYOUT, placeBar));
  }

  create() {
    this.refreshSymbolTextures();
    this.makeUiTextures();
    makeFxTextures(this);
    this.ensureArtFallbacks(this.critical);
    this.scene.start('Game');
  }

  /** Redraw cached placeholder labels if fonts finish after the startup timeout. */
  refreshSymbolTextures() {
    const S = SYMBOL_TEX;
    for (const id in PLACEHOLDER) {
      const a = PLACEHOLDER[id as SymbolId];
      const key = symbolKey(id as SymbolId);
      if (
        this.textures.exists(key) &&
        !(this.textures.get(key) instanceof Phaser.Textures.CanvasTexture)
      )
        continue;
      if (!this.textures.exists(key)) warnMissing(key);
      const tex = this.textures.exists(key)
        ? (this.textures.get(key) as Phaser.Textures.CanvasTexture)
        : this.textures.createCanvas(key, S, S)!;
      const ctx = tex.getContext();
      ctx.clearRect(0, 0, S, S);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      const grad = ctx.createLinearGradient(0, 0, 0, S);
      grad.addColorStop(0, a.bg[0]);
      grad.addColorStop(1, a.bg[1]);
      ctx.fillStyle = grad;
      if (a.round) {
        ctx.beginPath();
        ctx.arc(S / 2, S / 2, S * 0.44, 0, Math.PI * 2);
      } else {
        roundRect(ctx, S * 0.06, S * 0.06, S * 0.88, S * 0.88, S * 0.14);
      }
      ctx.fill();
      ctx.lineWidth = S * 0.03;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.stroke();

      ctx.fillStyle = a.color;
      ctx.font = `700 ${a.size}px ${THEME.fonts.ui}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.fillText(a.label, S / 2, S / 2 + S * 0.03);
      tex.refresh();
    }
    this.makeBlurTextures();
  }

  /** Only missing textures are generated; delivered art is never painted over. */
  ensureArtFallbacks(items: readonly { key: string }[]) {
    for (const { key } of items) {
      if (this.textures.exists(key)) continue;
      warnMissing(key);
      // A missing part keeps the complete flat symbol; never substitute a panel for a layer.
      if (key.startsWith('part_')) continue;
      const frame = key === ART.frame.key;
      const logo = key === ART.logo.key;
      const w = frame ? 1700 : logo ? 768 : 32;
      const h = frame ? 1100 : logo ? 288 : 32;
      this.canvasTex(key, w, h, (ctx) => {
        if (frame || logo) {
          ctx.strokeStyle = '#FFC94A';
          ctx.lineWidth = frame ? 32 : 8;
          ctx.strokeRect(
            frame ? 60 : w * 0.2,
            frame ? 60 : h * 0.25,
            frame ? w - 120 : w * 0.6,
            frame ? h - 120 : h * 0.3,
          );
        } else {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, '#0B1033');
          g.addColorStop(1, '#231438');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
      });
    }
  }

  private canvasTex(
    key: string,
    w: number,
    h: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
  ) {
    if (
      this.textures.exists(key) &&
      !(this.textures.get(key) instanceof Phaser.Textures.CanvasTexture)
    )
      return;
    const tex = this.textures.exists(key)
      ? (this.textures.get(key) as Phaser.Textures.CanvasTexture)
      : this.textures.createCanvas(key, w, h)!;
    tex.getContext().clearRect(0, 0, w, h);
    draw(tex.getContext());
    tex.refresh();
  }

  /**
   * Vertical motion smear of each symbol at its source size: the source stamped at small offsets
   * (no ctx.filter, iOS-safe). Offsets scale with the source so delivered and placeholder art match.
   */
  private makeBlurTextures() {
    for (const id in PLACEHOLDER) {
      const src = this.textures
        .get(symbolKey(id as SymbolId))
        .getSourceImage() as HTMLCanvasElement;
      const S = src.width;
      const step = S / 256;
      this.canvasTex(blurKey(id as SymbolId), S, S, (ctx) => {
        ctx.globalAlpha = 0.17;
        for (let dy = -18; dy <= 18; dy += 3) ctx.drawImage(src, 0, dy * step, S, S);
      });
    }
  }

  private makeUiTextures() {
    // 1px white: dims and solid fills via tint + setDisplaySize
    this.canvasTex(UI.px, 4, 4, (ctx) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 4, 4);
    });

    // spin button layers (same 256 canvas so they stack exactly): disc, twin-arrow ring, and a
    // center mark: a parol star (ready) or a stop square (spinning). Sized to sit inside the orb.
    this.canvasTex(UI.spin, 256, 256, spinDisc);
    this.canvasTex(UI.spinArrow, 256, 256, (ctx) => {
      // cream halo first, then navy on top, so the icon reads on the bright orb
      for (const [color, grow] of [
        [ICON_EDGE, 7],
        [ICON, 0],
      ] as const) {
        ctx.strokeStyle = ctx.fillStyle = color;
        ctx.lineCap = ctx.lineJoin = 'round';
        for (let k = 0; k < 2; k++) twinArrow(ctx, -Math.PI / 2 + 0.4 + k * Math.PI, grow);
      }
    });
    this.canvasTex(UI.spinStar, 256, 256, (ctx) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 14 : 34;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(128 + r * Math.cos(a), 128 + r * Math.sin(a));
      }
      ctx.closePath();
      iconFill(ctx);
    });
    // secondary round button (bet - / +): dark disc, gold ring; glyph drawn as Text on top
    this.canvasTex(UI.round, 128, 128, secondaryDisc);
    // soft gold glow behind winning symbols
    this.canvasTex(UI.glow, 256, 256, (ctx) => {
      const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
      g.addColorStop(0, 'rgba(255, 226, 120, 0.95)');
      g.addColorStop(0.45, 'rgba(255, 170, 40, 0.55)');
      g.addColorStop(1, 'rgba(255, 120, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    });
    // big win light rays: 12 soft wedges fading out from the center
    this.canvasTex(UI.rays, 512, 512, (ctx) => {
      const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
      g.addColorStop(0, 'rgba(255, 236, 160, 0.9)');
      g.addColorStop(0.5, 'rgba(255, 180, 60, 0.4)');
      g.addColorStop(1, 'rgba(255, 140, 20, 0)');
      ctx.fillStyle = g;
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(256, 256);
        ctx.arc(256, 256, 256, a, a + Math.PI / n);
        ctx.closePath();
        ctx.fill();
      }
    });
    // mute toggle: secondary disc with a speaker, sound waves (on) or a cross (off)
    for (const on of [true, false]) {
      this.canvasTex(on ? UI.soundOn : UI.soundOff, 128, 128, (ctx) => {
        ctx.drawImage(
          this.textures.get(UI.round).getSourceImage() as HTMLImageElement,
          0,
          0,
          128,
          128,
        );
        ctx.fillStyle = ctx.strokeStyle = on ? '#ffd34d' : '#b8916c';
        ctx.beginPath(); // speaker: box + cone
        ctx.moveTo(32, 52);
        ctx.lineTo(46, 52);
        ctx.lineTo(64, 36);
        ctx.lineTo(64, 92);
        ctx.lineTo(46, 76);
        ctx.lineTo(32, 76);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (on) {
          ctx.arc(64, 64, 14, -0.9, 0.9);
          ctx.moveTo(64 + 26 * Math.cos(-0.9), 64 + 26 * Math.sin(-0.9));
          ctx.arc(64, 64, 26, -0.9, 0.9);
        } else {
          ctx.moveTo(76, 52);
          ctx.lineTo(98, 76);
          ctx.moveTo(98, 52);
          ctx.lineTo(76, 76);
        }
        ctx.stroke();
      });
    }
    // motion toggle: secondary disc with three speed lines (full motion) or a struck-out set (reduced)
    for (const on of [true, false]) {
      this.canvasTex(on ? UI.motionOn : UI.motionOff, 128, 128, (ctx) => {
        ctx.drawImage(
          this.textures.get(UI.round).getSourceImage() as HTMLImageElement,
          0,
          0,
          128,
          128,
        );
        ctx.strokeStyle = on ? '#ffd34d' : '#b8916c';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const [y, x0] of [
          [46, 40],
          [64, 30],
          [82, 40],
        ]) {
          ctx.moveTo(x0, y);
          ctx.lineTo(92, y);
        }
        if (!on) {
          ctx.moveTo(38, 92);
          ctx.lineTo(92, 36);
        }
        ctx.stroke();
      });
    }
    // small stop square that sits inside the (rotating) arrow ring while the reels spin
    this.canvasTex(UI.stop, 256, 256, (ctx) => {
      roundRect(ctx, 104, 104, 48, 48, 10);
      iconFill(ctx);
    });

    // generic button and modal panel
    this.canvasTex(UI.btn, 400, 120, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 120);
      g.addColorStop(0, '#ffcf5a');
      g.addColorStop(1, '#c4610f');
      ctx.fillStyle = g;
      roundRect(ctx, 4, 4, 392, 112, 56);
      ctx.fill();
    });
    // winning-cell frame: white so WinLines can tint it per line. Drawn at 0.94 cell, so 11 px / 29 px
    // here match the old sd(8) stroke / sd(22) radius at reference cell size.
    this.canvasTex(UI.cellFrame, 256, 256, (ctx) => {
      ctx.lineWidth = 11;
      ctx.strokeStyle = '#fff';
      roundRect(ctx, 6, 6, 244, 244, 29);
      ctx.stroke();
    });
    this.canvasTex(UI.panel, 800, 450, (ctx) => {
      ctx.fillStyle = '#0b1033';
      roundRect(ctx, 4, 4, 792, 442, 40);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#e8b23a';
      ctx.stroke();
    });
  }
}

const ICON = '#0b1033';
const ICON_EDGE = '#fff3c4';
const ICON_RED = '#c8102e';

/** Lantern-red fill with a navy edge and cream halo: the spin button's center marks. */
function iconFill(ctx: CanvasRenderingContext2D) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = 16;
  ctx.strokeStyle = ICON_EDGE;
  ctx.stroke();
  ctx.lineWidth = 7;
  ctx.strokeStyle = ICON;
  ctx.stroke();
  ctx.fillStyle = ICON_RED;
  ctx.fill();
}

/** One of the two clockwise arrows of the spin ring: a 140-degree arc from a0 with a head. */
function twinArrow(ctx: CanvasRenderingContext2D, a0: number, grow: number) {
  const c = 128;
  const R = 54;
  const a1 = a0 + Math.PI - 0.8;
  ctx.lineWidth = 15 + grow;
  ctx.beginPath();
  ctx.arc(c, c, R, a0, a1);
  ctx.stroke();
  const px = c + R * Math.cos(a1);
  const py = c + R * Math.sin(a1);
  const tx = -Math.sin(a1); // clockwise tangent
  const ty = Math.cos(a1);
  const nx = Math.cos(a1); // radial
  const ny = Math.sin(a1);
  ctx.lineWidth = grow;
  ctx.beginPath();
  ctx.moveTo(px + tx * 26, py + ty * 26);
  ctx.lineTo(px + nx * 19 - tx * 4, py + ny * 19 - ty * 4);
  ctx.lineTo(px - nx * 19 - tx * 4, py - ny * 19 - ty * 4);
  ctx.closePath();
  ctx.fill();
  if (grow) ctx.stroke();
}

/** Dark disc with a gold ring (128 px): secondary buttons (bet -/+, mute, info, close). */
function secondaryDisc(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#3a1d12');
  g.addColorStop(1, '#1a0b07');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#d9861a';
  ctx.stroke();
}

/** Gold disc with a lit rim, shared by the spin and stop textures. */
function spinDisc(ctx: CanvasRenderingContext2D) {
  const c = 128;
  // dark seating ring so the disc reads as the primary control on any panel
  ctx.fillStyle = '#2a0f05';
  ctx.beginPath();
  ctx.arc(c, c, 127, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(c - 30, c - 40, 10, c, c, 120);
  g.addColorStop(0, '#fff0a8');
  g.addColorStop(0.55, '#f2a53a');
  g.addColorStop(1, '#a8460a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, 114, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#ffe9b0';
  ctx.stroke();
}
