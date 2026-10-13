# AGENTS.md — Parol Nights (Phaser 3 Slot Sample)

Read [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for the game spec, RGS contract, phases and acceptance criteria. This file holds the **conventions and rules** for working in the repo.

**Before any work, read [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)** — the current implementation state, decisions that extend or deviate from the brief, and the working agreement. **Update it at the end of every completed step.**

## Stack
Phaser 3.90 · TypeScript (strict) · Vite · WebP · MP3 96kbps · `tsx` for Node scripts
Targets: desktop and mobile browsers (iOS Safari / WKWebView, Android Chrome). Not a playable ad: no ad networks, no MRAID, no single-file build.

## Structure
```
src/
  main.ts                # Bootstrap, DOM ready gate, resize binding, lifecycle
  constants.ts           # DEPTH map, reference resolutions, layout constants
  gameConfig.ts          # Single public config object (bets, timings, defaults)
  analytics.ts           # trackEvent() stub (console in dev)
  utils/
    responsive.ts        # sx(), sy(), sd() + orientation reference helpers
    format.ts            # Money formatting (minor units -> display)
    timeline.ts          # Skippable promise-based presentation helper
  math/                  # PURE TS. Zero Phaser/DOM imports. Used by MockRGS and scripts/
    config.ts            # Bet levels, cap, win tiers
    paylines.ts          # 40 line patterns
    paytable.ts          # Symbol pays
    reelStrips.ts        # Base / free-spin strips
    rng.ts               # Seedable RNG (mulberry32 or similar)
    evaluate.ts          # Line win evaluation (wild substitution)
    features.ts          # Free spins + hold & win outcome generation
    round.ts             # Builds a full SpinResponse for a bet
  rgs/
    types.ts             # SpinRequest / SpinResponse / feature round types
    RGS.ts               # Interface the client depends on
    MockRGS.ts           # Latency, failure injection, seeded replay, resume, forced outcomes (dev)
  state/
    SlotStateMachine.ts  # Single source of truth for round flow
  scenes/
    BootScene.ts         # Critical preload + deferred manifest
    GameScene.ts         # Orchestrator only
  game/                  # Single-responsibility Phaser modules
    Reels.ts             # Masked reel container, pooled symbols, spin/stop
    Symbol.ts            # One symbol view (static + win animation)
    WinLines.ts          # Line highlight renderer
    WinPresenter.ts      # Count-up, win tiers, big win overlay
    FreeSpins.ts         # Free spins presentation
    HoldAndWin.ts        # Hold & Win presentation
    Hud.ts               # Balance, bet, win, spin, turbo
    Paytable.ts          # Modal generated from math/paytable.ts
    SoundManager.ts      # Audio gating, mute, visibility suspend
    DebugPanel.ts        # DEV ONLY (import.meta.env.DEV)
Assets/
scripts/
  simulate.ts            # RTP / hit-frequency simulation (Node, imports src/math only)
docs/
  simulation-report.txt  # Committed output of the simulation
```

### Responsibility split

- **`math/`** owns all outcome logic. It is deterministic given a seed and has no Phaser or browser dependencies, so Node can run it.
- **`rgs/`** wraps `math/` behind the contract the client uses. The client depends on the `RGS` interface only, never on `math/` directly.
- **`game/`** modules each own one concern. They receive the Phaser scene as a constructor argument and own their own game objects. They never call the RGS and never decide outcomes.
- **`state/SlotStateMachine.ts`** decides what may happen next. Modules emit events, the state machine transitions.
- **`GameScene.ts`** is the wiring layer: creates modules, calls the RGS, feeds the response to the state machine and presenters. It contains no layout math and no outcome logic.

## Rules

### Slot-specific
- **The client never computes outcomes.** Wins, feature triggers, coin values and balances all come from `SpinResponse`. In dev, assert that the displayed total equals `totalWin`.
- **Money is integer minor units** everywhere. Format with `utils/format.ts` at render time only. No floats for currency.
- **Every presentation is skippable.** Use `utils/timeline.ts` (cancellable promise chain). Tapping during a win presentation or feature intro fast-forwards to the end state. Turbo mode shortens spin and stop timings, never skips result display logic.
- **State machine is law.** No UI path may start a spin outside `Idle`. Log every transition in dev.
- **Respect the 5000x total bet cap.** If `capped` is true the feature sequence ends immediately and the presentation must reflect that.
- **Reproducibility:** any spin must be replayable from a seed. Never use `Math.random()` outside `math/rng.ts` seeding for the mock.
- **Debug code is DEV only.** Forced outcomes, seed and latency controls live behind `import.meta.env.DEV`. The production bundle must not contain `force=` handling or the debug panel.
- **Paytable UI is generated** from `math/paytable.ts` and `math/paylines.ts`. Never hand-type pays in the UI.

### General (carried over from the playable-ad project)
- 60 FPS target; never below 30 on mid-range Android
- No hardcoded px: `sx()`, `sy()`, `sd()` only
- `setDisplaySize(sd())` on images, never `setScale`
- No audio autoplay: unmute on first `pointerdown`
- `for` loops in game logic; pool objects (symbols, win line graphics, coin views); no per-spin allocations
- Never dim via `body` / page background
- Named depth constants only, no magic numbers in scene code
- Single `Phaser.Game` per page

## Phaser Config
```ts
{ type: Phaser.AUTO, transparent: true,
  parent: <HTMLElement created at runtime>,
  scale:  { mode: Phaser.Scale.NONE, width: <ref w>, height: <ref h> },
  render: { antialias: true, pixelArt: false } }
```
`Scale.NONE`: manual sizing; CSS = viewport px; internal = viewport x DPR. `antialias: true` is required to avoid jagged edges on scaled WebP assets. Never set to `false`.

## Responsive (two references)
```ts
const landscape = viewW >= viewH
const ref = landscape ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 }
const s    = Math.min(viewW / ref.w, viewH / ref.h)
const offX = (viewW - ref.w * s) / 2
const offY = (viewH - ref.h * s) / 2
// sx/sy/sd apply offX, offY, s
```

- `update()` polls `visualViewport` per frame for rotation
- On change: `game.scale.resize(vw * dpr, vh * dpr)` then `relayout()`
- `bindResponsiveResize()`: rAF debounce plus 100/300/600 ms retries
- Every module exposes `relayout(layout)`; the layout object carries orientation and the reel area rect. Reel size, symbol size and HUD placement are derived from the layout, not stored per-orientation in modules.

## Round flow
```
Idle -> Spinning -> Stopping -> Evaluating -> WinPresentation
     -> (FreeSpins | HoldAndWin) -> Idle
```
- `Spinning` starts the visual spin immediately and awaits the RGS response in parallel. Stops are scheduled once both a minimum spin time has elapsed and the response is in.
- `Stopping` lands reels in stagger order using `stops` / `grid` from the response.
- Free Spins and Hold & Win are sub-state-machines; they return to `Idle` through `WinPresentation` for the final summary.
- On RGS failure: show a retry modal, never spin visually forever. On refresh mid-round: resume from the persisted unfinished round.

## Math and simulation
- `npm run simulate -- --spins 1000000 --seed 42` prints RTP, hit frequency, feature frequencies, max win and a breakdown by source (base / free spins / hold & win).
- Same seed must produce identical output.
- Commit the latest output to `docs/simulation-report.txt` whenever strips, paytable or feature weights change.
- Target RTP 95–96%. Acceptance window is 94.5–96.5%.

## Depth Map
Define in [constants.ts](src/constants.ts) as a `DEPTH` object.

| Layer | Depth |
|---|---|
| Background | 0 |
| Reel frame (back) | 1 |
| Reels (masked) | 2 |
| Symbol win highlights | 3 |
| Reel frame (front / mask cover) | 4 |
| Line win graphics | 5 |
| Feature overlays (Hold & Win grid, FS counter) | 8 |
| HUD | 10 |
| Win meter / count-up | 12 |
| Dim overlay | 20 |
| Big win / feature intro & summary | 21 |
| Paytable / settings modal | 22 |
| Error / reconnect modal | 30 |
| Debug panel (DEV only) | 40 |

## Build
Standard Vite build (`dist/` with hashed assets). No `vite-plugin-singlefile`, no IIFE requirement.

- `npm run dev` runs the dev server with debug tools enabled
- `npm run build` produces the production bundle (debug code stripped)
- `npm run simulate` runs the math simulation in Node via `tsx`
- Report bundle size (raw and gzip) in the README after each milestone
- If built output contains `console.error` from Phaser or bundled node modules, drop it at bundle time in the Vite config instead of editing library source:

```js
// Vite 8 (Rolldown); esbuild.pure is ignored by Rolldown builds
export default { build: { rolldownOptions: { treeshake: { manualPureFunctions: ['console.error'] } } } };
```

Keep project-authored error handling meaningful: visible fallback UI, `console.warn`, or guarded debug logging.

## Asset Loading
- **Critical** (BootScene): loader bar, background, reel frame, initial symbols. Target < 500 KB.
- **Deferred**: audio, feature overlays, win animations, paytable art. Loads while the player sits on the first `Idle` screen.
- Spin is disabled until the deferred-ready flag is set, with a visible "Loading" state on the spin button.
- Placeholder art is generated at boot with `Graphics` / `generateTexture`. Swapping in real WebP/Spine later must not change any module API.

## Game Config
- `src/gameConfig.ts` is the single public source for tunable client settings: bet levels, default bet, starting balance, currency format, spin and stop timings, turbo multipliers, win-tier thresholds for presentation.
- Math parameters (paytable, strips, feature weights, cap) live in `src/math/` and are **not** part of the client config.
- Do not scatter editable constants across modules.

## Ship Checklist

- [x] `npm run simulate` RTP within 94.5–96.5%, reproducible by seed
- [x] Replaying a recorded seed gives a bit-identical `SpinResponse`
- [x] No Phaser/DOM imports in `src/math/` or `scripts/`
- [x] Displayed totals always equal `totalWin` (dev assertion passes)
- [x] FPS >= 55 under 4x CPU throttle (mobile viewport)
- [x] Portrait and landscape pass, including live rotation and resize
- [x] Skip works on every win presentation and feature intro / summary
- [x] Refresh mid-feature resumes correctly
- [x] Max win cap (5000x) ends the round and the UI reflects it
- [x] Audio muted until first `pointerdown`; suspended when tab hidden
- [x] No `console.error` in production output
- [x] Production bundle contains no debug panel or forced-outcome code
- [x] Paytable modal generated from `math/paytable.ts`
- [ ] README, simulation report, live demo link, gameplay video present _(README + report done; demo link and video skipped, see SKIPPED.md)_

## Pitfalls
| Issue | Fix |
|---|---|
| Rotation stuck | `Scale.NONE` + per-frame `visualViewport` poll |
| Mobile aliasing | Canvas = viewport x DPR, `antialias: true` |
| FPS drop on resize | rAF debounce |
| Reel spin hitches | Pool symbols, no allocations per frame or per spin, reuse tweens/timelines where possible |
| Reels visibly jump on stop | Land on `stops` from the response using wrap-around strip positions; the final symbols must come from `grid`, not from strip lookup on the client |
| Win count-up desync after skip | Skip sets the final value from the response and cancels the timeline; never recompute |
| Float money bugs | Integer minor units only; format at render |
| Rounding differences between sim and client | The client never evaluates; it reads `lineWins` and `totalWin` |
| Audio blocked | Gate on first `pointerdown` |
| Audio keeps playing when tab hides | `visibilitychange` listener in `SoundManager`: mute Phaser sound and `suspend()` the `AudioContext` when `document.hidden`, resume on return |
| iPhone black screen (Android works) | Only one `Phaser.Game` per page. iOS WKWebView can reject a second WebGL context. Render the page background as CSS, not as a second Phaser game |
| iOS hangs on font load | `document.fonts.load()` can stall with base64 `@font-face`. Race against a 1.5 s timeout before starting the game |
| `Cannot read properties of null (reading 'appendChild')` in Phaser boot | Script ran before `<body>` existed. Gate `main.ts` on `DOMContentLoaded` and create the parent `<div>` at runtime, passing the element reference (not a string selector) to `Phaser.Game({ parent })` |
| NineSlice won't shrink in landscape | Phaser `NineSlice` clamps to its inset sizes in source pixels. Operate it in source-pixel space and scale uniformly with `setScale(sd(1))`; tween callers must use `sd(1)` as the base scale |
| Letterbox appears | Avoid `Scale.FIT/EXPAND/CENTER_BOTH`; keep `Scale.NONE` with manual sizing |
| Debug code leaks to production | Guard with `import.meta.env.DEV` so it is tree-shaken; grep `dist/` for `force=` before release |
| Build output contains library `console.error` | Use `build.rolldownOptions.treeshake.manualPureFunctions: ['console.error']` in the Vite config (Vite 8 / Rolldown ignores `esbuild.pure`). Do not edit library source |
