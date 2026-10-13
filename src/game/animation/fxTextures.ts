import Phaser from 'phaser';

/** Effect textures generated at boot (spec section 11). White unless noted, so they take a tint. */
export const FX = {
  glow: 'fx_glow_soft',
  spark: 'fx_spark_star',
  ring: 'fx_ring',
  petal: 'fx_petal',
  coinDot: 'fx_coin_dot',
  bokeh: 'fx_bokeh',
  glint: 'fx_glint',
} as const;

type Draw = (ctx: CanvasRenderingContext2D) => void;

const DRAW: Record<keyof typeof FX, [number, number, Draw]> = {
  glow: [
    128,
    128,
    (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    },
  ],
  spark: [
    64,
    64,
    (ctx) => {
      // 4-point star with a soft core
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? 6 : 31;
        const a = -Math.PI / 2 + (i * Math.PI) / 4;
        ctx.lineTo(32 + r * Math.cos(a), 32 + r * Math.sin(a));
      }
      ctx.closePath();
      ctx.fill();
    },
  ],
  ring: [
    128,
    128,
    (ctx) => {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(64, 64, 58, 0, Math.PI * 2);
      ctx.stroke();
    },
  ],
  petal: [
    32,
    48,
    (ctx) => {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(16, 2);
      ctx.bezierCurveTo(32, 18, 28, 46, 16, 46);
      ctx.bezierCurveTo(4, 46, 0, 18, 16, 2);
      ctx.fill();
    },
  ],
  glint: [
    128,
    128,
    (ctx) => {
      // sparkle glint: soft core, a 4-point star with curved sides, long thin diffraction spikes
      const c = 64;
      const core = ctx.createRadialGradient(c, c, 0, c, c, 26);
      core.addColorStop(0, 'rgba(255,255,255,1)');
      core.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      core.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, 128, 128);
      const spike = (angle: number, len: number, w: number) => {
        ctx.save();
        ctx.translate(c, c);
        ctx.rotate(angle);
        const g = ctx.createLinearGradient(0, 0, len, 0);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -w);
        ctx.quadraticCurveTo(len * 0.25, 0, len, 0);
        ctx.quadraticCurveTo(len * 0.25, 0, 0, w);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };
      for (let i = 0; i < 4; i++) spike((i * Math.PI) / 2, 62, 7); // main cross
      for (let i = 0; i < 4; i++) spike(Math.PI / 4 + (i * Math.PI) / 2, 26, 3.5); // short diagonals
    },
  ],
  bokeh: [
    128,
    128,
    (ctx) => {
      // out-of-focus light: a near-flat disc with a soft rim (reads as bokeh, unlike a glow)
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,255,255,0.75)');
      g.addColorStop(0.72, 'rgba(255,255,255,0.65)');
      g.addColorStop(0.88, 'rgba(255,255,255,0.3)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(64, 64, 62, 0, Math.PI * 2);
      ctx.fill();
    },
  ],
  coinDot: [
    32,
    32,
    (ctx) => {
      const g = ctx.createRadialGradient(12, 11, 2, 16, 16, 15);
      g.addColorStop(0, '#fff3b0');
      g.addColorStop(0.6, '#ffc93a');
      g.addColorStop(1, '#a8670c');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(16, 16, 15, 0, Math.PI * 2);
      ctx.fill();
    },
  ],
};

/** Create every FX texture once (no art assets involved). */
export function makeFxTextures(scene: Phaser.Scene) {
  for (const id in DRAW) {
    const key = FX[id as keyof typeof FX];
    if (scene.textures.exists(key)) continue;
    const [w, h, draw] = DRAW[id as keyof typeof FX];
    const tex = scene.textures.createCanvas(key, w, h)!;
    draw(tex.getContext());
    tex.refresh();
  }
}
