export const GAME_TITLE = 'Parol Nights';

/** Reel motion timings. Turbo swaps in a second set; results display the same either way. */
export interface SpinTiming {
  /** full speed, in cells per second */
  speed: number;
  /** time to reach full speed */
  accelMs: number;
  /** minimum visual spin before the first reel may stop */
  minSpinMs: number;
  /** delay between consecutive reel stops */
  stopStaggerMs: number;
  /** landing bounce */
  bounceMs: number;
  /** bounce depth, in cells */
  bounceAmp: number;
  /** stop delay for a teased (anticipation) reel, replaces the stagger */
  anticipationMs: number;
  /** start wind-up: each reel nudges up before dropping */
  windUpMs: number;
  /** wind-up delay between consecutive reels */
  windUpStaggerMs: number;
  /** wind-up height, in cells */
  windUpAmp: number;
}

/** Tunable client settings. Math (pays, strips, weights, cap) lives in src/math, not here. */
export const gameConfig = {
  /** minor units */
  startBalance: 100000,
  /** minor units; must be one of the RGS bet levels */
  defaultBet: 400,
  rgs: {
    /** mock round-trip in ms [min, max] */
    latency: [150, 450] as [number, number],
    failureRate: 0,
  },
  timing: {
    speed: 26,
    accelMs: 160,
    minSpinMs: 750,
    stopStaggerMs: 160,
    bounceMs: 220,
    bounceAmp: 0.14,
    anticipationMs: 1300,
    windUpMs: 140,
    windUpStaggerMs: 40,
    windUpAmp: 0.15,
  } satisfies SpinTiming,
  turbo: {
    speed: 34,
    accelMs: 80,
    minSpinMs: 200,
    stopStaggerMs: 50,
    bounceMs: 140,
    bounceAmp: 0.08,
    anticipationMs: 650,
    windUpMs: 70,
    windUpStaggerMs: 15,
    windUpAmp: 0.08,
  } satisfies SpinTiming,
  currency: { locale: 'en-US', code: 'USD' },
  /** Shown in the rules page. Update from docs/simulation-report.txt whenever the math changes. */
  rtpLabel: '95.3%',
  /** Tease the remaining reels once this many are showing on stopped reels (presentation only). */
  anticipation: { scatter: 2, coin: 4 },
  /** Presentation tiers as multiples of total bet, highest first. Also used by the simulation report. */
  winTiers: [
    // shower = coins per emit (every showerMs) in the big win coin rain
    { name: 'epic', min: 100, title: 'EPIC WIN', countUpMs: 7500, shower: 3 },
    { name: 'mega', min: 50, title: 'MEGA WIN', countUpMs: 5500, shower: 2 },
    { name: 'big', min: 15, title: 'BIG WIN', countUpMs: 3500, shower: 1 },
  ],
  freeSpins: {
    /** intro overlay auto-continues after this (tap to start sooner) */
    introMs: 2500,
    /** "+5 FREE SPINS" banner */
    bannerMs: 1300,
    summaryCountUpMs: 3000,
    summaryHoldMs: 2200,
    /** pause between free spins */
    spinGapMs: 350,
  },
  holdAndWin: {
    introMs: 2500,
    /** delay between initial coins appearing on the board */
    revealStepMs: 120,
    /** empty cells shimmer this long per respin (halved in turbo) */
    respinMs: 1000,
    /** delay between coins landing in one respin */
    landStepMs: 260,
    grandMs: 2200,
    summaryCountUpMs: 3000,
    summaryHoldMs: 2200,
  },
  win: {
    /** coin rain emit interval behind the big win title */
    showerMs: 70,
    /** count-up for wins below the big tier */
    countUpMs: 900,
    /** final amount stays on the big win overlay this long (tap to close early) */
    bigWinHoldMs: 1800,
    /** per-line display time when cycling line wins in Idle */
    lineCycleMs: 1100,
    /** a win line draws in left to right over this long */
    lineDrawMs: 250,
    /** HUD balance rolls up to the new value after a win */
    balanceCountMs: 600,
  },
};

export type WinTier = (typeof gameConfig.winTiers)[number];
