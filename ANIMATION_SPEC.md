# ANIMATION_SPEC — Parol Nights (Phaser 3.90, code-driven)

Animation spec for the Filipino Christmas lantern slot. Companion to `AGENTS.md`, `PROJECT_BRIEF.md` and `CODEX_ASSET_PROMPT.md`.

**Approach:** all animation is **code-driven** (tweens, particles, camera effects, a few cheap shader effects). No Spine required. This keeps the bundle small, plays well with skip, turbo and reduced-motion, and suits the lantern art (glow, sway, sparkle). Spine remains an optional extension point (section 13).

---

## 1. Principles

1. **Animation never affects outcomes.** It only presents results the server already decided (`SpinResponse`).
2. **Everything is skippable.** Every presentation is cancellable and jumps to its correct final state.
3. **Config-driven timings.** Durations, easings, distances and counts live in `animationConfig.ts`, not in modules.
4. **Cheap by default.** Pool objects, avoid per-frame allocation, cap particles and post-effects (section 11).
5. **Readable first.** Wins must be obvious within about 300 ms; ambient motion must never compete with symbols.
6. **Accessible.** Reduced-motion mode, and no flashing faster than 3 times per second.
7. **Visual randomness is separate from the math RNG.** Use index-based offsets (deterministic) or a visual-only RNG. Never touch `math/rng.ts`.

## 2. Architecture

```
src/game/animation/
  animationConfig.ts     # all durations, eases, distances, particle counts (single source)
  AnimationService.ts    # facade used by game/ modules; owns speed factor, reduced motion, handles
  AnimationHandle.ts     # cancellable handle (tweens + emitters + timers) with finish()
  SymbolAnimator.ts      # idle / anticipation / land / win / dim per symbol view
  ReelAnimator.ts        # spin start, loop, staggered stop, bounce, anticipation slow-down
  WinPresenter.ts        # line draw, count-up, win tiers, big win overlay
  FeatureAnimations.ts   # Free Spins (Noche Buena), Hold & Win (Aguinaldo)
  AmbientBackground.ts   # lantern strings, bokeh, stars
  HudAnimations.ts       # spin button, counters, bet nudge
  FxPool.ts              # pooled glow sprites, sparkle emitters, rings, ribbons
  fxTextures.ts          # generates glow / spark / ring / petal textures at boot (no art assets)
```

Rules:
- `game/` modules call `AnimationService`; they do not create tweens directly.
- Every call returns an `AnimationHandle`. The state machine can `finish()` (jump to end) or `cancel()` (stop and reset) any handle.
- Animations emit events (section 12) so audio and the UI can sync without coupling.

```ts
interface AnimationHandle {
  readonly done: Promise<void>;   // resolves on finish or cancel
  finish(): void;                 // stop, apply the correct final state, resolve
  cancel(): void;                 // stop, reset to neutral, resolve
}
```

## 3. Global modes

| Mode | Behaviour |
|---|---|
| **Normal** | Config durations x 1.0 |
| **Turbo** | Durations x 0.45 for spin, stop, win line and count-up; ambient unchanged. Particle counts x 0.5 |
| **Skip** | Calls `finish()` on the active handles: final states applied immediately, counters show the final value |
| **Reduced motion** | Honour `prefers-reduced-motion` and a settings toggle. No camera shake, no flash, no looping scale or rotation; replace with static highlight and short fades (<= 150 ms). Ambient background becomes static |
| **Hidden tab** | Pause ambient and idle loops; the audio service already suspends. Resume on return |

```ts
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// AnimationService.dur(ms) = ms * speedFactor (normal 1, turbo 0.45)
// Prefer dur() over scene.tweens.setGlobalTimeScale(), which would also slow unrelated tweens.
```

Photosensitivity: no full-screen flash more than once per 400 ms, and light flicker amplitude stays small (alpha swing <= 0.15 at <= 3 Hz).

## 4. Config shape

```ts
export const ANIM = {
  idle:   { swayDeg: 3,  swayMs: 1800, breatheScale: 0.03, breatheMs: 2400 },
  land:   { overshootPx: 12, ms: 180, ease: 'Back.easeOut' },
  win:    { popScale: 1.18, popMs: 260, popEase: 'Back.easeOut', loopScale: 1.08, loopMs: 500 },
  dim:    { alpha: 0.35, ms: 150 },
  reel:   { startKickPx: 20, startMs: 120, stopStaggerMs: 180, turboStaggerMs: 60,
            blurStretchY: 1.08, blurAlpha: 0.9 },
  anticipation: { slowFactor: 0.3, glowAlpha: 0.9, ms: 1400 },
  line:   { drawMs: 350, holdMs: 350 },
  countUp:{ normalMs: [800, 1500], bigMs: 3000, megaMs: 5000, epicMs: 7000 },
  tiers:  { big: 15, mega: 50, epic: 100 },     // multiples of total bet (presentation only)
  particles: { maxActive: 150, mobileMax: 100 },
} as const;
```

Tune values here only.

## 5. Optional layered assets ("Spine-lite")

**Level 0 (default, no extra art):** animate whole symbol images with transforms. This is enough for a good first version.

**Level 1 (optional, add later):** a few extra layered parts give a richer feel. Append these to `CODEX_ASSET_PROMPT.md` (same style bible; each part drawn on the **same 512x512 canvas and alignment as its parent**, so layers composite to the static symbol):

| File | Size | Purpose |
|---|---|---|
| `parts/tassel.webp` | 128x256 | Reusable tassel, rotated around its top pivot for L/H symbols that carry tassels |
| `parts/H3_outer_body.webp`, `H3_inner.webp`, `H3_core.webp` | 512x512 | H3 outer frame follows whole-symbol sway; inner rotates, core pulses; four separate tassels |
| `parts/WILD_core.webp`, `WILD_rays.webp` | 512x512 | Core pulses, rays rotate behind it |
| `parts/pandereta_hoop.webp` | 512x512 | Hoop without caps |
| `parts/pandereta_cap.webp` | 64x64 | Single bottle cap, placed around the hoop in code and jingled |

Do **not** generate glow, sparkle, ring or petal textures. Create them in code (`fxTextures.ts`).

## 6. Reel animations

| Event | Motion | Duration | Notes |
|---|---|---|---|
| Spin start | Symbols kick up `startKickPx`, then accelerate downward | 120 ms | Ease `Quad.easeIn` |
| Spin loop | Symbols scroll at configured speed; apply `scaleY 1.08`, `alpha 0.9` as cheap motion blur | until stop | No extra assets |
| Stop (per reel) | Land in staggered order, overshoot 12 px, settle | 180 ms, stagger 180 ms (turbo 60 ms) | Ease `Back.easeOut`; emit `reelLanded` |
| Anticipation | If SCATTER or COIN count means the **last reel could complete a trigger**: slow that reel to 30% speed, add glow and a gentle dark vignette on other reels | up to 1400 ms | Do not fake: only when the response shows the trigger is possible; end on the real result |
| Skip | All reels snap to final grid, no bounce | immediate | |

Rule: reel animation must land on `response.grid` exactly. Never animate toward a symbol the response does not contain.

## 7. Symbol animations

States: **Idle**, **Land**, **Anticipation**, **Win**, **Dim**, **Trigger**. Idle plays only while the machine is in `Idle` and the tab is visible; stop idle loops during spin.

### 7.1 Shared behaviour (L1 to L4, H1 to H3)

| State | Level 0 motion | Duration / ease |
|---|---|---|
| Idle | Whole symbol sways +/- `swayDeg` around its top pivot; slow breathe `scale 1 -> 1.03`; per-cell delay = `index * 120 ms` | 1800 ms and 2400 ms, `Sine.easeInOut`, yoyo, repeat |
| Land | Overshoot and settle (section 6), tiny squash `scaleY 0.94 -> 1` | 180 ms |
| Win | Pop `1 -> 1.18`, then loop breathe `1.0 <-> 1.08`; glow sprite alpha `0.3 -> 0.8`; 3 sparkles per cycle | pop 260 ms `Back.easeOut`, loop 500 ms |
| Dim (non-winning) | Alpha to 0.35, no motion | 150 ms |

Level 1 upgrade: swing `parts/tassel` independently (angle +/- 6 degrees, 1400 ms, staggered by index), preserving the body's original sway and breathe.

### 7.2 Symbol specifics

| Symbol | Extra idle | Extra win | Notes |
|---|---|---|---|
| **L1 to L4** | None beyond shared | Faster sway (x1.6) during win | Keep subtle so high symbols stand out |
| **H1** (red and gold) | Shine sweep every 4 s using a masked white sweep sprite | Shine sweep plays twice; gold sparkle burst | Only one H1 shine at a time |
| **H2** (capiz shell) | Shimmer: overlay of pearl highlight, alpha jitter 0.1 to 0.25 at <= 2 Hz | Shimmer brightens, teal glow pulse | |
| **H3** (grand) | Slow sway + breathe + glow. Level 1: fixed outer, inner -10 deg/s, core pulse, independent tassels | Inner x3 speed, rays flash once, sparkle burst x2 | The most spectacular symbol |
| **WILD** | Rays rotate 20 deg/s behind core, core pulses `1 <-> 1.06` | **On land:** expanding ring shockwave + sparkle burst. During win: rays x2 speed, continuous sparkles | Level 0: rotate a baked ray sprite behind the symbol |
| **SCATTER** (pandereta) | Gentle jingle: rotate +/- 4 degrees every 3 s | Shake +/- 8 degrees, 3 cycles, 40 ms apart (Level 1: caps jiggle individually) | |
| **COIN** (aguinaldo) | Slow shine sweep every 3 s | See Hold & Win (section 9) | Value text drawn in code, pops in on land |

### 7.3 Anticipation and trigger
- **Anticipation:** symbols that contribute to a possible trigger (SCATTER, COIN) pulse: scale `1 -> 1.12` every 400 ms and gain glow while the last reel slows.
- **Trigger (3+ SCATTER or 6+ COIN):** triggering symbols pop, spin 360 degrees on their vertical axis using `scaleX` squash/stretch (no new art), sparkle burst, then the feature intro starts. Non-triggering symbols dim.

## 8. Win presentation

| Step | Motion | Duration |
|---|---|---|
| Line draw | Animated polyline over the winning cells, drawn progressively with a glowing stroke; cycle through winning lines one at a time | `drawMs` 350 + `holdMs` 350 per line |
| Symbol win | Section 7 win state on winning cells; others dim | |
| Count-up | Win meter counts from 0 to the final win (ease `Cubic.easeOut`). Duration by tier below | |
| Tiers | **Normal:** no overlay. **Big (>= 15x):** banner + sparkles. **Mega (>= 50x):** banner + lantern rise + coin shower. **Epic (>= 100x):** all of that + camera shake and light bursts (not in reduced motion) | |

Count-up durations: normal 0.8 to 1.5 s (scaled by win size), big 3 s, mega 5 s, epic 7 s. Tap or skip jumps to the final value and plays a short settle pulse on the meter.

**Big win overlay:** dim overlay (depth 20), ornamental banner scales in (`Back.easeOut`, 400 ms), the tier label pops in (drawn as text), lanterns (tinted copies of the L-symbols, scaled down) float upward with sway, coin shower from the top, glow ring behind the banner. Dismisses automatically after the count-up or on tap.

## 9. Feature animations

### 9.1 Free Spins: "Noche Buena Spins"
| Moment | Animation |
|---|---|
| Intro | Lantern string lights up left to right, title card slides in with glow, spin-count number pops |
| Multiplier table | A table graphic at the side; each **winning spin adds a dish icon** (pop, `Back.easeOut`, 300 ms), and the multiplier counter ticks `x1 -> x15` with a pulse. Milestone pulses at x5, x10 and x15 |
| Retrigger | Banner "+5" drops in, spin counter flips and pulses |
| Summary | Dishes sparkle in sequence, total win counts up |

The dish icons come from the optional Stage 4 asset set; until then use simple circles with letters or placeholders.

### 9.2 Hold & Win: "Aguinaldo Respins"
| Moment | Animation |
|---|---|
| Trigger | Coins pulse and "fly" to their grid positions, then lock with a flash; non-coin symbols dim to 0.35 |
| Respin counter | 3 pips; a respin consumes one pip with a small pop; **a new coin resets all pips to 3** with a staggered refill and a pulse |
| New coin landing | Drop, bounce, then value reveal (scaleX flip), value text pops |
| Jackpot coin | Ring burst colored by tier (Mini, Minor, Major), banner flashes briefly |
| Full grid (Grand) | All 15 coins pulse in a wave (60 ms stagger), one camera flash (not in reduced motion), Grand banner |
| Summary | Coin values add up one by one (accelerates, skippable), total counts up |

## 10. Ambient background and HUD

### Background (`AmbientBackground`)
| Element | Motion | Budget |
|---|---|---|
| Lantern strings | Each string rotates +/- 1.5 degrees around its anchor, 3 to 5 s, phase offsets | <= 8 strings |
| String lights | Alpha jitter 0.85 to 1.0 | One tween drives a group |
| Bokeh | Slow vertical drift and alpha fade | <= 20 sprites |
| Stars | Twinkle (alpha) | <= 20 sprites |
| Parallax (optional) | Background shifts +/- 6 px with a slow sine | 1 object |

Total animated ambient objects <= 40. Reduced motion: static. Feature rounds: palette shifts via tint, with no extra animation load.

### HUD (`HudAnimations`)
- **Spin button:** idle glow pulse (alpha 0.5 to 1.0, 1200 ms); press `scale 0.94` for 80 ms; while spinning, the star ring rotates; disabled state at alpha 0.5.
- **Counters** (balance, win, bet): count-up with ease `Cubic.easeOut`; a small nudge when the bet changes.
- **Buttons:** hover and press feedback via tint and scale only.

## 11. Particles and effects budget

All textures generated at boot in `fxTextures.ts`: `glow_soft` (radial gradient), `spark_star` (4-point star), `ring` (thin circle), `petal` (small teardrop), `coin_dot` (small gold circle).

| Emitter | Texture | Count | Lifespan | Speed | Blend |
|---|---|---|---|---|---|
| Symbol sparkle | `spark_star` | 3 per cycle | 500 ms | 30 to 80 | ADD |
| Win burst | `spark_star` | 12 | 600 ms | 80 to 220 | ADD |
| Wild shockwave | `ring` | 1 (scale 0.2 -> 2.5, alpha 1 -> 0) | 450 ms | n/a | ADD |
| Coin shower | `coin_dot` | 40 total over 2 s | 1500 ms | gravity 400 | NORMAL |
| Lantern rise | tinted symbol images | 8 total | 3000 ms | slow upward | NORMAL |
| Confetti petals | `petal` | 30 over 2 s | 1800 ms | gravity 250 | NORMAL |

Hard caps:
- Active particles <= `ANIM.particles.maxActive` (100 on mobile).
- **Post-FX (`postFX.addGlow`, `addShine`) on at most 3 objects at once** (WILD, a winning symbol, the logo). Per-object post effects are expensive on mobile. For the other cells use a **baked additive glow sprite** (`glow_soft` tinted, `setBlendMode(ADD)`) instead.
- Pool emitters and glow sprites; do not create or destroy per spin.
- At most one camera shake at a time (intensity <= 0.004, duration <= 300 ms), and not in reduced motion.

## 12. Events (for audio and UI sync)

Emit through the scene event emitter (or the existing event bus):
`spinStart`, `reelLanded(reelIndex)`, `anticipationStart`, `anticipationEnd`, `lineShown(lineIndex)`, `winPop`, `countUpStart`, `countUpEnd`, `bigWinStart(tier)`, `bigWinEnd`, `featureIntro(type)`, `multiplierTick(value)`, `coinLocked`, `respinReset`, `jackpotReveal(tier)`, `featureSummary`.

Audio hooks key off these names; animation code never plays sound directly.

## 13. Implementation snippets

**Cancellable handle**
```ts
export class Handles {
  private tweens: Phaser.Tweens.Tween[] = [];
  private onFinish: Array<() => void> = [];
  add(t: Phaser.Tweens.Tween, finalState?: () => void) {
    this.tweens.push(t); if (finalState) this.onFinish.push(finalState);
  }
  finish() { for (const t of this.tweens) t.stop(); for (const f of this.onFinish) f(); this.clear(); }
  cancel() { for (const t of this.tweens) t.stop(); this.clear(); }
  private clear() { this.tweens.length = 0; this.onFinish.length = 0; }
}
```

**Idle sway with deterministic offsets**
```ts
scene.tweens.add({
  targets: symbol, angle: { from: -ANIM.idle.swayDeg, to: ANIM.idle.swayDeg },
  duration: ANIM.idle.swayMs, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
  delay: index * 120,
});
// `symbol` is a Container. To sway around the top, put the container's position at the symbol's
// top-center and offset the child image down by half its display height, so rotation pivots at the top.
```

**Win pop then breathe**
```ts
scene.tweens.add({
  targets: symbol, scale: ANIM.win.popScale, duration: dur(ANIM.win.popMs), ease: ANIM.win.popEase,
  onComplete: () => scene.tweens.add({
    targets: symbol, scale: ANIM.win.loopScale, duration: dur(ANIM.win.loopMs),
    ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
  }),
});
```

**Baked glow sprite (cheap, use for most cells)**
```ts
const glow = scene.add.image(x, y, 'glow_soft').setBlendMode(Phaser.BlendModes.ADD)
  .setTint(0xffc94a).setAlpha(0).setDisplaySize(sd(360), sd(360));
scene.tweens.add({ targets: glow, alpha: { from: 0.3, to: 0.8 }, duration: 500, yoyo: true, repeat: -1 });
```

**Post-FX glow (budgeted to a few objects)**
```ts
const fx = wild.postFX.addGlow(0xffffff, 0, 0, false, 0.1, 12);
scene.tweens.add({ targets: fx, outerStrength: 4, duration: 900, yoyo: true, repeat: -1 });
```

**Particle burst (Phaser 3.60+ API)**
```ts
const burst = scene.add.particles(0, 0, 'spark_star', {
  speed: { min: 80, max: 220 }, lifespan: 600, scale: { start: 0.8, end: 0 },
  alpha: { start: 1, end: 0 }, blendMode: 'ADD', emitting: false,
});
burst.explode(12, x, y);
```

**Count-up**
```ts
scene.tweens.addCounter({ from: 0, to: win, duration: dur(ms), ease: 'Cubic.easeOut',
  onUpdate: t => meter.setText(format(Math.round(t.getValue()))) });
```

Use `sd()`, `sx()`, `sy()` for all sizes and positions as required by `AGENTS.md`.

**Scale rule (important):** `AGENTS.md` says to size images with `setDisplaySize(sd())` instead of `setScale`. That means an image's own `scale` is not 1 (it equals display size divided by texture size), so tweening an image's `scale` to an absolute value such as 1.18 would blow it up. In every snippet above, `symbol` therefore means a **Container** that holds the image (sized with `setDisplaySize`). Tween the container's `scale` and `angle` (base value 1), and never tween an image's own `scale` directly. If you ever must tween an image, tween to `baseScale * factor`.

## 14. Optional Spine extension point
- Keep `SymbolAnimator` behind an interface (`playIdle`, `playWin`, `playAnticipation`, `stop`) so a Spine-backed implementation can replace the tween-based one for a single symbol.
- If you later add Spine, start with one hero symbol (WILD): bones for the rays and core, a short idle and a win animation, loaded through the Phaser Spine plugin. Check Spine's current licensing terms before shipping.
- In the README: state that animation is code-driven by design for bundle size and mobile performance, with Spine as a documented extension.

## 15. Reuse in Perya Hub
`AnimationService`, `FxPool`, count-up, big-win presenter and reduced-motion logic live in a shared module. Other games add their own animators only:
- **Perya Drop Ball:** ball trail, peg flash, bin landing pulse.
- **Color Game:** dice roll with tumble and settle, winning color tile pulse.
- Per-game configs extend the same `ANIM` shape.

## 16. QA checklist

- [ ] 60 FPS idle with a full 5x3 grid animating; >= 55 FPS under 4x CPU throttle during a mega win
- [ ] Post-FX objects <= 3 at any time; active particles under the cap (log in dev)
- [ ] Skip lands in the exact correct final state for every handle (reels, lines, counters, features)
- [ ] After a round ends, active tween count returns to the idle baseline (no leaks)
- [ ] Turbo shortens spin, stop, line and count-up timings as configured
- [ ] Reduced-motion mode: no shake, flash, looping scale or rotation; ambient static
- [ ] No full-screen flash more than once per 400 ms; flicker within limits
- [ ] Anticipation only plays when the response makes a trigger possible
- [ ] Reels always land on `response.grid`; animation never contradicts the response
- [ ] Hidden tab pauses ambient and idle loops; resume works
- [ ] Portrait and landscape: effects scale with `sd()` and stay inside the layout
- [ ] All timings come from `animationConfig.ts`; no magic numbers in modules
- [ ] Events fire in the documented order and audio hooks work

## 17. Build order

1. `animationConfig.ts`, `AnimationService`, `AnimationHandle`, `fxTextures.ts`
2. Reel spin, stop, bounce, skip
3. Symbol states (Level 0) and win presentation with count-up
4. Anticipation and trigger
5. Particles and big win overlay
6. Free Spins and Hold & Win animations
7. Ambient background and HUD
8. Polish pass: tune values, test on a throttled mobile viewport
9. Optional: Level 1 layered parts, Spine experiment

Implementation 2026-10-14: H3 and WILD Level 1 complete; L1-L4/H1/H2 have independent tassels,
and SCATTER has seven separately animated caps. All use pooled views, reduced motion and complete
flat-symbol fallback. H3's outer frame does not spin; its body sways with four independent tassels.
L1-L4/H1/H2 also retain whole-body sway. Spine remains optional.
Runtime tuning lives in `gameConfig.anim`; see IMPLEMENTATION_STATUS.md
for verification and asset provenance.
