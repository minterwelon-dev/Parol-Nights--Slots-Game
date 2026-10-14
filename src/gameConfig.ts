export const GAME_TITLE = 'Parol Nights';

/**
 * Reel speed timings; turbo swaps in a second set. Start kick, stop stagger, landing and
 * anticipation timings live in `anim.reel` / `anim.land` / `anim.anticipation`.
 */
export interface SpinTiming {
  /** full speed, in cells per second */
  speed: number;
  /** time to reach full speed */
  accelMs: number;
  /** minimum visual spin before the first reel may stop */
  minSpinMs: number;
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
  timing: { speed: 26, accelMs: 160, minSpinMs: 750 } satisfies SpinTiming,
  turbo: { speed: 34, accelMs: 80, minSpinMs: 200 } satisfies SpinTiming,
  currency: { locale: 'en-US', code: 'USD' },
  /** Shown in the rules page. Update from docs/simulation-report.txt whenever the math changes. */
  rtpLabel: '95.3%',
  /** Tease the remaining reels once this many are showing on stopped reels (presentation only). */
  anticipation: { scatter: 2, coin: 4 },
  /** Presentation tiers as multiples of total bet, highest first. Also used by the simulation report. */
  winTiers: [
    { name: 'epic', min: 100, title: 'EPIC WIN', countUpMs: 7000 },
    { name: 'mega', min: 50, title: 'MEGA WIN', countUpMs: 5000 },
    { name: 'big', min: 15, title: 'BIG WIN', countUpMs: 3000 },
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
    /** final amount stays on the big win overlay this long (tap to close early) */
    bigWinHoldMs: 1800,
    /** HUD balance rolls up to the new value after a win */
    balanceCountMs: 600,
  },
  /**
   * Animation tunables (ANIMATION_SPEC.md section 4), read through AnimationService.
   * Win tier thresholds are `winTiers` above; they are not repeated here.
   */
  anim: {
    /** duration factor in turbo for spin, stop, win line and count-up; ambient is unchanged */
    turboFactor: 0.45,
    /** particle count factor in turbo */
    turboParticles: 0.5,
    idle: {
      swayDeg: 3,
      swayMs: 1800,
      breatheScale: 0.03,
      breatheMs: 2400,
      cellDelayMs: 120,
      /** idle motion fades in over this long (after a spin, or when the machine returns to Idle) */
      blendInMs: 600,
      /** a symbol leaving a win / tease / trigger state eases back to rest over this long */
      releaseMs: 300,
    },
    land: { overshootPx: 12, ms: 180, ease: 'Back.easeOut', squashY: 0.94 },
    win: { popScale: 1.18, popMs: 260, popEase: 'Back.easeOut', loopScale: 1.08, loopMs: 500 },
    dim: { alpha: 0.35, ms: 150 },
    reel: {
      startKickPx: 20,
      startMs: 120,
      /** start kick delay between consecutive reels */
      startStaggerMs: 40,
      stopStaggerMs: 180,
      turboStaggerMs: 60,
      blurStretchY: 1.08,
      blurAlpha: 0.9,
    },
    anticipation: { slowFactor: 0.3, glowAlpha: 0.9, ms: 1400, vignetteAlpha: 0.35 },
    /** a win line draws in left to right over drawMs, then holds; one cycled line = drawMs + holdMs */
    line: { drawMs: 350, holdMs: 350 },
    /** normal wins: count-up length grows with the win, between these bounds */
    countUp: { normalMs: [800, 1500] as [number, number], settleMs: 220, settleScale: 1.15 },
    particles: { maxActive: 150, mobileMax: 100 },
    /**
     * Big win overlay (spec sections 8 and 11). BIG: banner + sparkles; MEGA adds rising lanterns
     * and the coin shower; EPIC adds camera shake, light bursts and confetti petals.
     */
    bigWin: {
      bannerMs: 400,
      /** banner width in reference px (the title fits its inner panel) */
      bannerW: { landscape: 1300, portrait: 1000 },
      sparkEveryMs: 220,
      sparks: 3,
      lanterns: 8,
      lanternMs: 3000,
      lanternStaggerMs: 160,
      coins: 40,
      coinsMs: 2000,
      coinGravity: 400,
      petals: 30,
      petalsMs: 2000,
      petalLifeMs: 1800,
      petalGravity: 250,
      lightBurstEveryMs: 600,
      shakeMs: 300,
      shake: 0.004,
    },
    /** Ambient background (spec section 10): bokeh + parallax (stars removed at the user's request); px are reference px */
    ambient: {
      bokeh: 20,
      bokehPx: [70, 190] as [number, number],
      bokehMs: [7000, 12000] as [number, number],
      bokehDriftPx: 160,
      bokehAlpha: 0.55,
      /**
       * Sparkle glints (reference: CSS glitter keyframes, scale 0.3 -> 1 -> 0.3 with a turn and an
       * opacity 0 -> 1 -> 0 pulse, then a rest; sparse so they read as light, not dust).
       */
      glints: 7,
      glintPx: [60, 130] as [number, number],
      glintShowMs: 1100,
      glintRestMs: [2600, 7000] as [number, number],
      glintTurnDeg: 90,
      /** glints appear in the top part of the screen, where the lantern strings hang */
      glintArea: 0.45,
      parallaxPx: 6,
      parallaxMs: 12000,
      tintMs: 600,
      tints: { base: 0xffffff, freeSpins: 0xffd6cc, holdAndWin: 0xffecc4 },
    },
    /** HUD feedback (spec section 10) */
    hud: {
      glowMin: 0.5,
      glowMax: 1,
      glowMs: 1200,
      pressDip: 0.94,
      pressMs: 80,
      disabledAlpha: 0.5,
      nudgeScale: 1.18,
      nudgeMs: 220,
      hoverTint: 0xfff0c0,
    },
    /** Remaining presentation durations (ms), one place to tune (spec section 16) */
    timings: {
      fadeInMs: 200,
      fadeOutMs: 180,
      textPopMs: 280,
      landPopMs: 280,
      teaseGlowPulseMs: 260,
      framePulseMs: 380,
      meterPulseMs: 300,
      bigWinRaysTurnMs: 9000,
      lightBurstRingMs: 500,
      spinRingTurnMs: 900,
      flyMs: 450,
      barFlashMs: 450,
      lightOnMs: 160,
      pipPopMs: 220,
      milestoneFlashMs: 500,
      milestonePulseMs: 420,
      dishGlowMs: 420,
      coinDropMs: 380,
      coinFlashMs: 320,
      jackpotGlowMs: 520,
      collectBumpMs: 160,
      shimmerMs: 180,
      waveStepMs: 60,
      waveBumpMs: 160,
      /** Grand wave runs this long after its last diagonal step before the banner */
      waveTailMs: 360,
    },
    /** Free Spins / Hold & Win presentation (spec section 9); px are reference px */
    feature: {
      /** intro: lantern string lights up left to right, title slides in, count pops */
      lights: 12,
      lightStepMs: 55,
      slidePx: 90,
      slideMs: 380,
      subPopDelayMs: 320,
      /** retrigger banner drops in from above */
      dropPx: 260,
      dropMs: 420,
      /** counter / coin value flip (scaleX or scaleY through 0) */
      flipMs: 180,
      milestones: [5, 10, 15],
      milestoneScale: 1.7,
      dishPopMs: 300,
      dishSparkleStepMs: 140,
      /** Hold & Win respin pips: staggered refill */
      pips: 3,
      pipStepMs: 80,
      /** summary collect: first step, factor per coin (accelerates), floor */
      collectStartMs: 260,
      collectFactor: 0.85,
      collectMinMs: 50,
      grandFlashMs: 300,
    },
    /** win burst (spec section 11): count, px/s at reference scale, lifespan */
    burst: { count: 12, speed: [80, 220] as [number, number], lifespanMs: 600 },
    /** post-FX (preFX shine) objects at once; the rest use baked glow sprites */
    postFxMax: 3,
    /** anticipation (spec 7.3): contributing SCATTER / COIN pulse while the last reel slows */
    tease: { pulseScale: 1.12, pulseMs: 400 },
    /** feature trigger (spec 7.3): pop, 360 deg scaleX spin, burst, then the feature intro */
    trigger: { ms: 1100, popScale: 1.2 },
    /** symbol specifics (spec 7.2, Level 0) */
    symbols: {
      glowTint: 0xffc94a,
      /** one shine sweep per 2 / shineSpeed s (Phaser's shine shader runs on a global clock) */
      shineSpeed: 1,
      h1ShineEveryMs: 4000,
      coinShineEveryMs: 3000,
      h2: { tint: 0x8ff5e6, shimmerMin: 0.1, shimmerMax: 0.25, shimmerHz: 1.5 },
      h3: {
        idleGlow: 0.25,
        innerDegPerSec: -10,
        winSpeed: 3,
        corePulse: 0.06,
        corePulseMs: 1200,
      },
      wild: {
        raysDegPerSec: 20,
        corePulse: 0.06,
        corePulseMs: 900,
        ringMs: 450,
        ringFrom: 0.2,
        ringTo: 2.5,
        sparkEveryMs: 160,
      },
      tassel: { swayDeg: 6, swayMs: 1400, staggerMs: 80 },
      scatter: {
        jingleDeg: 4,
        jingleEveryMs: 3000,
        jingleMs: 450,
        shakeDeg: 8,
        shakeCycles: 3,
        shakeStepMs: 40,
      },
    },
    /** reduced motion: fades replace motion and stay this short */
    reduced: { fadeMs: 150 },
    /** photosensitivity and comfort limits (spec sections 3 and 11) */
    shake: { maxIntensity: 0.004, maxMs: 300 },
    flash: { minGapMs: 400 },
  },
};

export type WinTier = (typeof gameConfig.winTiers)[number];
