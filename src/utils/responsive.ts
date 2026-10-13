import { REEL_LAYOUT, REF } from '../constants';
import { REELS, ROWS } from '../math/config'; // grid shape only, no outcome logic

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  landscape: boolean;
  /** reference-space size */
  w: number;
  h: number;
  /** uniform scale and letterbox offsets (canvas px) */
  s: number;
  offX: number;
  offY: number;
  /** reel window in reference space */
  reel: Rect;
  /** symbol cell size in reference space */
  cell: number;
}

export const layout: Layout = {
  landscape: true,
  w: 1920,
  h: 1080,
  s: 1,
  offX: 0,
  offY: 0,
  reel: { x: 0, y: 0, w: 0, h: 0 },
  cell: 0,
};

/** Recompute layout for a canvas of (viewW, viewH) px. Mutates and returns the shared object. */
export function updateLayout(viewW: number, viewH: number): Layout {
  const landscape = viewW >= viewH;
  const ref = landscape ? REF.landscape : REF.portrait;
  const s = Math.min(viewW / ref.w, viewH / ref.h);
  layout.landscape = landscape;
  layout.w = ref.w;
  layout.h = ref.h;
  layout.s = s;
  layout.offX = (viewW - ref.w * s) / 2;
  layout.offY = (viewH - ref.h * s) / 2;

  const r = landscape ? REEL_LAYOUT.landscape : REEL_LAYOUT.portrait;
  layout.cell = r.cell;
  layout.reel.w = r.cell * REELS;
  layout.reel.h = r.cell * ROWS;
  layout.reel.x = r.cx - layout.reel.w / 2;
  layout.reel.y = r.cy - layout.reel.h / 2;
  return layout;
}

export const sx = (x: number) => layout.offX + x * layout.s;
export const sy = (y: number) => layout.offY + y * layout.s;
/** size / distance (no offset) */
export const sd = (d: number) => d * layout.s;

/** Canvas position of a reel cell center. */
export const cellX = (reel: number) => sx(layout.reel.x + (reel + 0.5) * layout.cell);
export const cellY = (row: number) => sy(layout.reel.y + (row + 0.5) * layout.cell);
