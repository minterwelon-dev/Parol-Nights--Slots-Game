export const REF = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 },
} as const;

/**
 * Palette. Numbers for Graphics / tint, strings for Text. Every HUD / overlay colour comes
 * from here so the look stays consistent.
 */
export const THEME = {
  panel: 0x0b1033,
  panelEdge: 0x6e3f1a,
  frame: 0xf0a640,
  reelBack: 0x080e28,
  reelColumn: 0x111a3b,
  gold: '#ffd34d',
  goldDeep: '#d9861a',
  ember: '#ff8a3d',
  text: '#fff1d6',
  muted: '#b8916c',
  ink: '#3a1500',
  stroke: '#2a0f05',
  fonts: {
    title: '"Cinzel Decorative", Georgia, serif',
    ui: '"Baloo 2", system-ui, sans-serif',
    numeric: '"Baloo 2", system-ui, sans-serif',
  },
} as const;

/** Reel window placement in reference space: center and cell (symbol) size. */
export const FRAME = {
  width: 1700,
  height: 1100,
  window: { x: 100, y: 100, width: 1500, height: 900 },
} as const;

export const REEL_LAYOUT = {
  landscape: { cx: 960, cy: 540, maxWidth: 1600, maxHeight: 650 },
  portrait: { cx: 540, cy: 790, maxWidth: 980, maxHeight: 640 },
} as const;

/**
 * HUD placement in reference space. Pods are label-over-value readouts centered on x;
 * landscape mirrors around the spin button: BALANCE BET (SPIN) WIN TURBO.
 */
export const HUD_LAYOUT = {
  landscape: {
    logo: { x: 960, y: 82, width: 600, font: 48 },
    /** corner icon buttons in the header row */
    mute: { x: 1850, y: 54, size: 72 },
    info: { x: 70, y: 54, size: 72 },
    /** control panels: top-left corner, size, vertical divider x positions */
    panels: [{ x: 190, y: 880, w: 1540, h: 156, dividers: [540, 1380] }],
    spin: { x: 960, y: 958, size: 212 },
    balance: { x: 365, y: 958 },
    bet: { x: 700, y: 958, gap: 108, btn: 70 },
    win: { x: 1220, y: 958 },
    turbo: { x: 1555, y: 958, w: 190, h: 66 },
    font: { label: 22, value: 38, win: 46, btn: 46, toggle: 26 },
  },
  portrait: {
    logo: { x: 540, y: 285, width: 1000, font: 80 },
    mute: { x: 990, y: 90, size: 84 },
    info: { x: 90, y: 90, size: 84 },
    panels: [
      { x: 60, y: 1120, w: 960, h: 150, dividers: [540] },
      { x: 60, y: 1455, w: 960, h: 160, dividers: [] },
    ],
    spin: { x: 540, y: 1535, size: 270 },
    balance: { x: 300, y: 1195 },
    bet: { x: 245, y: 1535, gap: 118, btn: 80 },
    win: { x: 780, y: 1195 },
    turbo: { x: 835, y: 1535, w: 210, h: 74 },
    font: { label: 26, value: 44, win: 50, btn: 52, toggle: 28 },
  },
} as const;

/** Paytable / rules modal panel (top-left + size) and its grid densities, reference space. */
export const MODAL_LAYOUT = {
  landscape: { x: 160, y: 100, w: 1600, h: 930, payCols: 4, lineCols: 10, tab: { w: 250, h: 62 } },
  portrait: { x: 40, y: 170, w: 1000, h: 1580, payCols: 2, lineCols: 5, tab: { w: 220, h: 66 } },
} as const;

/** Pod geometry: label sits above the value center. */
export const POD = { labelDy: -30, valueDy: 14 } as const;

/** Feature info pill (free spins counter / multiplier, H&W respins / total) above the reels. */
export const FEATURE_LAYOUT = {
  landscape: { pill: { x: 960, y: 183, w: 940, h: 38 }, left: 740, right: 1180, font: 26 },
  portrait: { pill: { x: 540, y: 449, w: 980, h: 46 }, left: 300, right: 780, font: 30 },
} as const;

/** game.events: viewport changed, payload is the Layout */
export const RELAYOUT = 'relayout';

export const DEPTH = {
  BACKGROUND: 0,
  REEL_FRAME_BACK: 1,
  REELS: 2,
  SYMBOL_HIGHLIGHT: 3,
  REEL_FRAME_FRONT: 4,
  LINE_WINS: 5,
  FEATURE_OVERLAY: 8,
  HUD: 10,
  WIN_METER: 12,
  DIM: 20,
  BIG_WIN: 21,
  MODAL: 22,
  ERROR_MODAL: 30,
  DEBUG: 40,
} as const;
