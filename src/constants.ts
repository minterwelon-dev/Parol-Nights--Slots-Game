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
  panelEdge: 0xc9973a,
  frame: 0xe8b23a,
  reelBack: 0x080e28,
  reelColumn: 0x111a3b,
  gold: '#ffd34d',
  text: '#fff1d6',
  muted: '#c9b98f',
  stroke: '#0b1033',
  /** feature / win titles: the logo look (gold gradient top to bottom, navy stroke, warm glow) */
  titleGold: ['#fff3c4', '#ffc94a', '#d9821e'],
  glow: { gold: '#ff9f1c', red: '#e8402a' },
  /** big win and summary amounts */
  amount: '#fff6e0',
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
  landscape: { cx: 960, cy: 545, maxWidth: 1600, maxHeight: 690 },
  portrait: { cx: 540, cy: 790, maxWidth: 980, maxHeight: 640 },
} as const;

/**
 * HUD placement in reference space. Pods are label-over-value readouts centered on x;
 * landscape mirrors around the spin button: BALANCE BET (SPIN) WIN TURBO.
 */
export const HUD_LAYOUT = {
  landscape: {
    logo: { x: 960, y: 98, width: 500, font: 40 },
    /** corner icon buttons in the header row */
    mute: { x: 1842, y: 62, size: 92 },
    info: { x: 78, y: 62, size: 92 },
    /** control panels: top-left corner, size, vertical divider x positions */
    panels: [{ x: 190, y: 895, w: 1540, h: 150, dividers: [540, 1380] }],
    spin: { x: 960, y: 970, size: 200 },
    balance: { x: 365, y: 970 },
    bet: { x: 700, y: 970, gap: 108, btn: 70 },
    win: { x: 1220, y: 970 },
    turbo: { x: 1555, y: 970, w: 240, h: 90 },
    font: { label: 22, value: 38, win: 46, btn: 46, toggle: 30 },
  },
  portrait: {
    logo: { x: 540, y: 285, width: 1000, font: 80 },
    mute: { x: 980, y: 96, size: 104 },
    info: { x: 100, y: 96, size: 104 },
    panels: [
      { x: 60, y: 1120, w: 960, h: 150, dividers: [540] },
      { x: 60, y: 1455, w: 960, h: 160, dividers: [] },
    ],
    spin: { x: 540, y: 1535, size: 270 },
    balance: { x: 300, y: 1195 },
    bet: { x: 245, y: 1535, gap: 118, btn: 80 },
    win: { x: 780, y: 1195 },
    turbo: { x: 835, y: 1535, w: 250, h: 94 },
    font: { label: 26, value: 44, win: 50, btn: 52, toggle: 32 },
  },
} as const;

/**
 * Paytable / rules modal panel (top-left + size), its grid densities (pays, lines, rules columns), tab size and a text scale
 * applied to every content font, reference space.
 */
export const MODAL_LAYOUT = {
  landscape: {
    x: 160,
    y: 50,
    w: 1600,
    h: 980,
    payCols: 4,
    lineCols: 10,
    ruleCols: 2,
    tab: { w: 300, h: 100 },
    text: 1.15,
  },
  portrait: {
    x: 40,
    y: 120,
    w: 1000,
    h: 1680,
    payCols: 2,
    lineCols: 5,
    ruleCols: 1,
    tab: { w: 232, h: 87 },
    text: 1.3,
  },
} as const;

/** Pod geometry: label sits above the value center. */
export const POD = { labelDy: -30, valueDy: 14 } as const;

/** Feature info pill (free spins counter / multiplier, H&W respins / total) above the reels. */
export const FEATURE_LAYOUT = {
  landscape: { pill: { x: 960, y: 186, w: 940, h: 32 }, left: 740, right: 1180, font: 24 },
  portrait: { pill: { x: 540, y: 449, w: 980, h: 46 }, left: 300, right: 780, font: 30 },
} as const;

/**
 * Free Spins feast table: plate centers and size, reference space. Landscape flanks the reels
 * (three plates per side); portrait is one row under the controls.
 */
export const FEAST_LAYOUT = {
  landscape: {
    size: 130,
    plates: [
      [215, 400],
      [215, 545],
      [215, 690],
      [1705, 400],
      [1705, 545],
      [1705, 690],
    ],
  },
  portrait: {
    size: 130,
    plates: [
      [140, 1745],
      [300, 1745],
      [460, 1745],
      [620, 1745],
      [780, 1745],
      [940, 1745],
    ],
  },
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
