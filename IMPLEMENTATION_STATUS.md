# Implementation Status — Parol Nights

Handoff document for new sessions. **Read this after `AGENTS.md` and `PROJECT_BRIEF.md`, before touching code.**
It records what is built, every decision that deviates from or extends the brief, and how to verify.

**Keep it current:** at the end of every completed step, update the relevant sections (status, decisions,
file map, known issues, next steps) and the "Last updated" line. Phase checkboxes also live in `PROJECT_BRIEF.md`; tick them there too.

_Last updated: 2026-10-13 — Typography Step 3 complete and checked; awaiting review before Step 4 full verification. Asset Stages 1–4 approved. Phase 5 deploy/video remain skipped._

---

## 1. Working agreement (how the user wants to work)

- Work **step by step**. Implement one step, verify it, report, then **stop and wait** for the user to say "proceed".
- Never start a new phase without the user's go-ahead. All phases are done; the user skipped deploy and video.
- Ask before changing the game spec. (The user approved the paytable rescale and the RTP tuning, as long as mechanics stay intact.)
- Verify visually in **both landscape and portrait** after any UI change; the user reviews layouts closely (spacing, balance, text fitting the screen).
- Nothing is committed to git yet (repo was `git init`-ed in Phase 0, zero commits). Commit only when the user asks.

## 2. Status by phase

Typography Step 3: user authorized; implemented Cinzel Decorative 700 title plus
Baloo 2 400/700 UI/numbers, both Fontsource 5.3.0 / SIL OFL 1.1. Only three Latin
WOFF2 files ship; ñ/Ñ included in Latin coverage. THEME.fonts is the central font
map; DOM CSS variables mirror it. Replaced hardcoded text families throughout
Phaser, debug DOM and generated placeholder labels. FontFace `tnum` and DOM
tabular-nums enabled. Browser measurements confirm equal 0–9 advances at both weights.

Startup races font loads against 1500ms; failed loads use fallback. Late fonts
refresh existing Text objects recursively, cached symbol labels and layout fitting.
Live Title module draws GAME_TITLE over the approved text-free ornament in Boot
and HUD, using warm gold/navy outline/static glow, with responsive sizing. No new
title animation. Other generated theme assets are not integrated in this step.

Build/typecheck, self-checks and project lint (excluding embedded Python vendor)
passed. Portrait/landscape screenshots and digit/late-font tests are under
`_review/typography-step3-*`. Four-second font delay test proves startup fallback
and subsequent title refit. Font requests are same-origin only. Protected math,
state and response-type hashes unchanged. Font bytes: 53,844 raw / 53,870 gzip.
Whole dist: 1,440,130 bytes (+103,196 over Step 2 including ornament/licenses/code).
Licenses ship in public/licenses; full details in docs/typography.md.
Step 4 full loading-screen/count-up/modal/production audit remains pending review.

Rename/typography task: Step 1 inventory reviewed, Step 2 authorized and completed.
`GAME_TITLE` in `src/gameConfig.ts` owns the live title in BootScene, HUD, document
title and simulation report heading; static HTML title and package metadata use
Parol Nights / parol-nights. Updated existing docs and sound/report headings;
CODEX_ASSET_PROMPT.md already used the correct name, ANIMATION_SPEC.md is absent.
No existing source filenames or repo directory renamed. No tagline added.

`src/utils/storage.ts` centralizes current and legacy keys and performs the guarded,
repeat-safe migration before startup reads state. Current keys: parol-nights-rgs,
parol-nights-progress, parol-nights-muted. Raw values are copied without parsing;
existing new values win, missing old values are ignored, successful writes precede
old-key removal. Exceptions are caught per key. Debug reset clears both current
and legacy session/progress keys, preserving the mute preference. No analytics
events were found or changed. Old-name strings remain only in the three intentional
legacy keys and their production copies.

Validation: build/typecheck and all self-checks pass, including migration, repeated
startup, destination conflicts, blocked storage/read/write/remove, and saved-round
resume with seed/nonce/balance preserved. Math/state/response-type baseline hashes
unchanged. Seed 42 / 1M spins exactly reproduces the renamed report (RTP 95.181%).
Muted headless Chrome verified title/viewport bounds in portrait 412x915 and
landscape 915x412; screenshots `_review/rename-step2-{portrait,landscape}.png`.
Project lint passes with `--ignore-pattern 'scripts/assets/.python/**'`.
Plain `npm run lint` currently scans the local embedded Python dependency tree
and reports six no-undef errors in its vendored emscripten worker (unrelated to game code).
Production total 1,336,934 bytes; JS 1,267,106 raw / 341,965 gzip via Node zlib.
No font assets added. Font selection, loading, ornament and full typography QA
are Step 3/4 work. Historical asset baseline hashes intentionally predate this rename;
do not regenerate those baselines to conceal authorized source changes.

Tooling update (2026-10-13): added the `DietrichGebert/ponytail` Codex marketplace and installed `ponytail@ponytail` v5.2.0. Verified the user-level CLI lists the plugin as installed and enabled. Start a new session to load the new plugin skills.

Asset workflow (2026-10-13): followed `CODEX_ASSET_PROMPT.md`, Stages 1–4.
Generated L1, H1 and COIN with native alpha, then exported centered 512x512 WebPs
at quality 80, method 6 under `Assets/theme/parol-nights/symbols/`. All are below
45 KB; total 106,826 bytes. Reviewed `_review/style-lock.png` on navy and light
checkerboard, including 96px color/greyscale previews. Preserved source PNGs,
exact prompts, attribution, Stage 1 manifest and QA report in the theme folder.
Rebuild with `scripts/assets/.python/python.exe scripts/assets/postprocess.py`;
workspace-local Python/Pillow/numpy runtime is ignored by git. No game source,
math, config or `src/assets.ts` edits. The user approved Stage 1 and authorized Stage 2.

Stage 2: generated L2, L3, L4, H2, H3, WILD and SCATTER using approved L1/H1
style references. All ten exports are in the manifest and `_review/symbols-sheet.png`
at native size on navy/light checkerboard and at 96px in color/greyscale.
Visual checks and export assertions passed. Nine exports are 512x512; H3 uses
the prompt's allowed 448x448 fallback to stay under 45 KB. H2 quality is 76;
all others quality 80, method 6. All symbols total 379,164 bytes. L3 took two
attempts to correct the kite silhouette and tassel placement; other new symbols
took one. Approved Stage 1 WebPs are byte-identical (SHA256 verified). Exact
prompts and references are in `source/generation-stage2.json` and `ATTRIBUTION.md`;
QA report updated. The user approved Stage 2 and authorized Stage 3.

Stage 3: two backgrounds (1920x1080 / 1080x1920), transparent reel frame
(1700x1100, exact 1500x900 centered alpha-clear cut), and four UI pieces exported.
All Stage 3 exports quality 80 / method 6, below their caps; title ornament uses
the allowed 768x288 fallback. Frame and plaque each took three attempts and use
flat-magenta removal/despill; other UI uses native alpha with near-opaque matte
noise normalized. Frame aspect error 0.087%, no visible distortion. All 17 WebPs
total 938,302 bytes (Stage 3 adds 559,138). End-to-end processing and asset
validator passed; 52 baseline runtime/config/approved symbol hashes unchanged.
Review sheet: `_review/environment-sheet.png`; evidence: `_review/verification-stage3.json`.
Exact prompts/references and rejected sources are preserved, attribution/manifest/
QA report updated. Rebuild with `scripts/assets/.python/python.exe scripts/assets/postprocess.py --stage 3`;
validate with `scripts/assets/.python/python.exe scripts/assets/validate.py`.
The user approved Stage 3 and explicitly authorized Stage 4.

Stage 4: generated queso_de_bola, hamon, sweet_spaghetti, fruit_salad, bibingka,
and puto_bumbong using approved H1 as a style reference. Each took one attempt.
All six exports are 256x256 transparent WebP, quality 80 / method 6, centered
at approximately 85% occupancy, with native-alpha cleanup. No size/quality fallback.
Food icons total 71,106 bytes; all 23 WebPs total 1,009,408 bytes. The prompt has
no food-specific cap; a conservative 40,000-byte UI target was applied and passed.
Visual review passed on navy/light checkerboard and at 96px color/greyscale.
Review: `_review/food-sheet.png`. Validation: `_review/verification-stage4.json`;
59 baseline file hashes unchanged, including all 17 previously approved exports
and the recorded game/config files. Source PNGs, exact prompts, attribution,
manifest and QA report updated. Rebuild: `scripts/assets/.python/python.exe
scripts/assets/postprocess.py --stage 4`; validate with `scripts/assets/validate.py`.
The user approved Stage 4. Final delivery completed: all 23 WebPs match the manifest,
all source PNGs and per-asset attribution sections are present, and all four review
sheets exist. Final validation passed dimensions, alpha, file caps, frame window,
background metrics and 59 baseline hashes. Total production art: 1,009,408 bytes.
Approved dimension fallbacks: H3 448x448 and logo_ornament 768x288. Art-only
delivery as required by CODEX_ASSET_PROMPT.md; runtime integration is a separate step.

| Phase | State | Notes |
|---|---|---|
| 0 Setup | ✅ done | Vite 8.3 + TS strict + Phaser 3.90.0, ESLint, Prettier, folder structure, responsive helpers |
| 1 Math + mock RGS | ✅ done | RTP tuned to ~95.2–95.5%, simulation committed, MockRGS with latency/failure/replay/resume/force |
| 2 Core reels + UI | ✅ done | state machine, masked pooled reels, anticipation, line wins, count-up, tiers, HUD, skip, both orientations |
| 3 Features | ✅ done | Free Spins (multiplier, retrigger), Hold & Win (jackpots, Grand), skippable, cap-aware |
| 4 Platform | ✅ done (stretch skipped) | loading + deferred audio, SoundManager, resume mid-feature, debug panel, paytable modal |
| 5 Polish + delivery | ✅ done (deploy + video skipped) | FPS under 4x throttle measured + fixed, bundle size + README written, Ship Checklist ticked |

Extra work done between steps at the user's request: ponytail-audit cleanup (shared fx/cell helpers, dead getters/config removed), spin icon redraw, full **HUD/UI revamp** (theme tokens,
bottom control panel, portrait panels, logo), **banner text fitting** in portrait, **sound map** reference file.

## 3. Decisions and deviations (important context)

### Math (`src/math/`)
- **Paytable rescaled ~×10** vs the brief's starting values (brief only reached ~6% base RTP). Current (multiples of line bet, 3/4/5):
  L1/L2 10/30/80 · L3/L4 20/50/120 · H1 30/80/250 · H2 40/120/300 · H3 60/200/800. User approved.
- **Bet levels** `[40, 80, 200, 400, 1000, 2000]` minor units (all divisible by 40 lines → integer line bet). Default bet 400 ($4.00), start balance 100000 ($1,000.00).
- **Strips** built from symbol counts, shuffled once with a fixed seed (constant across runs). Base strips ~150 long; WILD only on reels 2–4;
  base SCATTER 3 on reels 2–4 and 5 on reels 1/5; COIN 17. FS strips: no COIN, WILD 3, SCATTER 1 on reels 2–4 / 2 on reels 1/5.
  Changing any count reshuffles that strip → retune with the simulator.
- **Hold & Win**: empty-cell land chance 0.055 per respin; weighted coin table 1x–15x plus Mini 20x / Minor 50x / Major 200x; Grand 1000x.
  H&W max is 4000x, so only Free Spins can naturally reach 5000x.
- **Same-spin collision**: 3+ SCATTER beats 6+ COIN (Free Spins awarded).
- **Wild**: a run of leading WILDs never pays alone (WILD cannot land on reel 1).
- **Cap**: the step that reaches the cap is clamped to exactly the cap and the feature ends. `playRound(bet, rng, capMult)` takes a
  **dev-only cap override** (forced "cap" uses 20x) so the capped presentation is testable; base wins are also clamped for that case.
- **Win tiers** (big 15x / mega 50x / epic 100x) live only in `gameConfig.winTiers`; `scripts/simulate.ts` reads them from there.
- Simulation (1M spins, seed 42): **RTP 95.18%** (base 61.5 / FS 18.9 / H&W 14.8), hit 34.6%, FS 1 in 189, H&W 1 in 251, Grand 1 in 67k,
  max 1129x, cap never hit. 5M spins seed 7: 95.33%. Report: `docs/simulation-report.txt` (regenerate with `--out` after math changes).

### Contract (`src/rgs/types.ts`) — extended beyond the brief
- `SpinResponse.bet` added (a resumed round knows its stake).
- `FreeSpinsRound { awarded, spins[{stops, grid, lineWins(raw), multiplier, win, retrigger, spinsLeft}], totalWin, capped }`.
- `HoldAndWinRound { awarded, initial: Coin[], respins[{coins, respinsLeft}], grand, totalWin, capped }`, `Coin { pos = reel*3+row, value, jackpot? }`.
- `RoundOutcome` = response minus `roundId/bet/balance` (what math produces).
- `InitResponse` (in `RGS.ts`) includes `reelStrips: { base, free }` so the client never imports math strips for the visual spin.
- `RGSError` codes: `network | session | invalidBet | insufficientFunds`.

### MockRGS (`src/rgs/MockRGS.ts`)
- Per-round seed = `deriveSeed(sessionSeed, nonce)`; `roundId = "<nonce>-<seedHex>[-c<capMult>]"`; `replay(roundId, bet, balanceBefore)` rebuilds a bit-identical response.
- State persisted in `localStorage['parol-nights-rgs']` (balance, seed, nonce, unfinished round). **Balance does not reset on refresh**
  (reset via debug panel "Reset session" or `localStorage.removeItem('parol-nights-rgs')`).
- Failures: half before commit (nothing debited), half after commit (response lost); `spin()` while a round is unfinished returns that round → retry is always safe.
- Forcing: `rgs.pick = forcePicker(force)` (one-shot), scans seeds until a real round matches → forced rounds still replay.
  Forces: `freeSpins, retrigger, holdAndWin, grand, bigWin (base-only ≥15x), megaWin (base-only ≥50x), cap (dev 20x cap)`.

### Client
- **State machine** adds `Boot` (start + resume entry) and `Error` (retry) states. Table in `src/state/SlotStateMachine.ts`; illegal transitions throw; dev logs `[fsm] A -> B`.
- **Canvas sizing**: `Scale.NONE`, internal size = viewport × DPR, `zoom: 1/dpr` keeps CSS size = viewport (Phaser maps input).
- **Reels**: 5 pooled views per reel rotated in place; landing feeds `grid[r][2..0]` then the strip symbol above `stops[r]`; bounce; dev assertion that the landed window equals `res.grid`.
- **Anticipation** (presentation only, from `res.grid`): ≥2 SCATTER (or ≥4 COIN in base) on stopped reels → remaining reels get `anticipationMs` delay + glow. Thresholds in `gameConfig.anticipation`.
- **Skip**: `utils/timeline.ts`; two-stage skip on overlays (tap 1 ends count-up, tap 2 closes). Final values always set from the response.
- **Display money** = sums of response values only (meter running totals); dev warns if displayed total ≠ `totalWin`.
- **Resume**: `utils/progress.ts` stores `{roundId, step}` (`parol-nights-progress`) after each free spin / respin; refresh resumes mid-feature ("RESUMED" intro), base win not re-presented.
- **Loading**: critical art is generated in `BootScene` (canvas textures); when real WebP art exists, queue it in `BootScene.preload()` (the progress bar is already wired). Deferred = 8 MP3 SFX; spin shows "LOADING n%" until loaded; failed files never block play.
- **Audio**: unlock on first `pointerdown` *or key press* (capture-phase window listener so the first spin is audible); mute persisted (`parol-nights-muted`);
  hidden tab → mute + `AudioContext.suspend()`. Phaser's `WebAudioSoundManager.onFocus` (called every step) is **wrapped** so it can't resume audio while hidden.
- **Build**: Vite 8 uses Rolldown, which ignores `esbuild.pure` → `build.rolldownOptions.treeshake.manualPureFunctions: ['console.error']` is the only option in `vite.config.ts` and removes library `console.error` (0 in dist). AGENTS.md pitfall updated to match.
- **Debug panel** is plain DOM (bottom-left, collapsible), mounted via dynamic import inside `import.meta.env.DEV` → absent from prod.
- **UI theme**: `THEME` tokens + `HUD_LAYOUT` / `FEATURE_LAYOUT` / `MODAL_LAYOUT` / `POD` in `src/constants.ts`. Landscape: bottom panel BALANCE · BET −/+ · (SPIN) · WIN · TURBO; portrait: info panel + controls panel. Header: "i" (paytable) top-left, mute top-right, logo center.
- **Text fitting**: `utils/fitText.ts` shrinks text that would exceed its box (banner titles/amounts at 90% screen width, H&W coin values inside the coin). Use it for any new dynamic text.
- **Animations** (polish batch, all pooled / persistent tweens, all skip-safe):
  - Overlay fades: `fadeIn`/`fadeOut` in `src/game/fx.ts` (200/180 ms, kill prior tweens, fadeOut resets text scale). Used by FeatureOverlay, WinPresenter, Paytable, ErrorModal. Never delays logic.
  - Win cells: `WinLines` frames are 15 pooled tinted images (`UI.cellFrame`), **not Graphics**. Phaser re-tessellates Graphics every frame; the old 70-rounded-stroke Graphics cost ~36 ms/frame at 4x throttle on big wins. Avoid many-shape Graphics that stay on screen.
  - Win symbols: winning symbols pulse to 1.06x (`setDisplaySize`) with a pooled gold glow (`UI.glow`) per cell; one persistent tween in `Reels`; `highlight(null)` restores sizes.
  - Spin button: `SpinButton` class in `Hud.ts` = glow + disc (`UI.spin`) + arrow ring (`UI.spinArrow`, rotates while spinning) + stop square (`UI.stop`); breathing glow in Idle; press squash.
  - Motion blur: boot-generated smear textures (`blurKey(id)`, 13 stamps, no ctx.filter); a reel swaps above 60% speed (`BLUR_AT`), back to sharp at landing bounce.
  - H&W: coins drop + bounce + flash (pooled `flashes` per cell), jackpot coins loop a tinted sparkle, Grand plays a diagonal wave (`WAVE_MS`) before the banner; resume rebuild is instant.
  - Big win coin rain: one particle emitter in WinPresenter (COIN texture), density = `gameConfig.winTiers[].shower`, interval `gameConfig.win.showerMs`; stops on close, `clear()` kills remaining coins.
  - Reel wind-up: each reel nudges up `windUpAmp` cells over `windUpMs`, staggered by `windUpStaggerMs` (all in `SpinTiming`, smaller in turbo). Lives in `Reels.update()`; a stop can't land before the wind-up ends.
  - Landing pop: SCATTER / COIN bump (+18%) with a fading `winGlows` burst in `Reels.landPop()` when their reel settles. The win display owns a cell once `highlight()` marks it; a running pop (`Reels.pops`) keeps its glow through `highlight()` until it fades.
  - Win lines draw in left to right over `gameConfig.win.lineDrawMs` (persistent tween on `WinLines.reveal`, restarted on every new line set; relayout keeps progress). Cell frames appear at once.
  - Big win dressing: rotating rays (`UI.rays`, container fades, image turns) behind the title; camera shake on MEGA / EPIC (the big win dim is oversized by the shake travel, so no undimmed edge shows); amount bumps with the title on every tier change. The first title of each presentation now pops too.
  - FS multiplier: a raised value flies in as "+n" from the reel center into the pill (`FeatureOverlay.fly()`), the pill keeps the old value until it lands, then pops. `FreeSpins.mult` resets per round.
  - H&W respin reset: RESPINS text pops and flashes gold (`popBar('left', true)`).
  - Balance rolls up after a win (`Hud.setBalance(v, true)`, `gameConfig.win.balanceCountMs`; any later setBalance stops it). WIN meter has a pulsing glow while it counts.
  - Press feedback: `press()` in `fx.ts` (dip to 88%, spring back) on every HUD button, mute, paytable tabs / close, error modal button; the spin button uses it too. Its rest scale is in layout units, so a resize mid-press still ends at the new size.
- **Paytable modal**: tabs PAYS / FEATURES / LINES / RULES; all numbers from `src/math` (money at current bet). Only manual value: `gameConfig.rtpLabel` ('95.3%') — update from the simulation report.

## 4. File map (what lives where)

```
src/main.ts                 DOM gate, single Phaser.Game, resize binding (rAF + 100/300/600ms + per-frame visualViewport poll), DEV hooks
src/constants.ts            REF, THEME, REEL_LAYOUT, HUD_LAYOUT, POD, FEATURE_LAYOUT, MODAL_LAYOUT, RELAYOUT (event name), DEPTH
src/gameConfig.ts           client tunables: balance, bet, RGS mock latency/failure, timings (+turbo), currency, rtpLabel,
                            anticipation, winTiers, freeSpins/holdAndWin/win presentation timings
src/assets.ts               SFX manifest (?url imports from Assets/audio)
src/math/                   config, rng (mulberry32, randomSeed, deriveSeed), paylines, paytable, reelStrips, evaluate, features, round
src/rgs/                    types, RGS (interface, InitResponse, RGSError), MockRGS (+replay), force (DEV only)
src/state/SlotStateMachine.ts
src/scenes/BootScene.ts     loading bar, generated symbol + UI textures (UI keys exported as `UI`; spinDisc/secondaryDisc helpers)
src/scenes/GameScene.ts     wiring only: init/resume, round flow, presentRound, deferred load, sound hooks, modal guards
src/game/                   Reels, Symbol, WinLines, WinPresenter, FeatureOverlay (shared feature chrome), FreeSpins, HoldAndWin,
                            Hud, ErrorModal, Paytable, SoundManager, DebugPanel (DEV),
                            fx (shared dimLayer(), pop(), press(), fadeIn(), fadeOut() helpers)
src/utils/                  responsive (sx/sy/sd, cellX/cellY reel-cell centers, Layout), format (formatMoney), timeline,
                            anticipation, progress, fitText
scripts/check.ts            assert-based self-checks: math, strips, eval, features, cap, MockRGS (replay/resume/failure/force/seed), fsm, anticipation
scripts/simulate.ts         RTP report (--spins --seed --bet --out); timing on stderr so output is byte-identical per seed
scripts/spin.ts             inspect one seeded round: npx tsx scripts/spin.ts <seed> [bet]
docs/simulation-report.txt  committed 1M-spin report (seed 42)
README.md                   reviewer-facing: run, architecture + state diagrams (mermaid), RGS contract, sim, bundle size, FPS
SKIPPED.md                  everything deliberately not done, with what it would take
Assets/audio/               8 placeholder MP3s (ffmpeg-synthesized, 96 kbps) + SOUND_MAP.txt (what plays when, how to swap)
```

Module hooks for sound (wired in GameScene): `reels.hooks.{spin,land,tease}`, `presenter.onWin(big)`, `holdAndWin.onCoin`.

## 5. How to run and verify

```
npm run dev                                   # dev server (debug panel bottom-left)
npm run check                                 # all self-checks (must print every "check ...: ok")
npx tsc --noEmit && npm run lint              # types + lint (lint also bans Phaser/DOM in src/math and scripts)
npm run simulate -- --spins 1000000 --seed 42 [--out docs/simulation-report.txt]
npm run build                                 # prod bundle; then verify no debug code:
grep -o "forcePicker\|__rgs\|__game\|Reset session\|console.error" dist/assets/*.js   # expect no output
```

Dev-only console hooks: `__rgs` (MockRGS), `__game` (Phaser.Game). Force from console:
`__rgs.pick = (await import('/src/rgs/force.ts')).forcePicker('holdAndWin')`.
Scene modules are reachable for testing: `__game.scene.getScene('Game').paytable.open(400)` etc.

Visual verification used headless Chrome via a puppeteer-core script kept in the session scratchpad (not in the repo).
Default headless Chrome on this machine gets the real GPU (RTX 3060 via ANGLE D3D11). Add `--use-angle=swiftshader` only for software rendering. `networkidle0` waits for deferred audio.
FPS method (README > Performance): mobile viewport at DPR 2.625; CDP `Emulation.setCPUThrottlingRate` 4, applied after load (reloading a throttled dev server times out); rAF frame-time probe; forced features via a pre-imported `forcePicker` (a dynamic import mid-run causes a ~1 s spike).
Recreate if needed: launch `C:/Program Files/Google/Chrome/Application/chrome.exe` with puppeteer-core, press Space to spin, screenshot.

## 6. Known issues / limitations

- Phaser `sound.mute` getter can read `false` before the first gesture (gain value not updated while the context is suspended). Harmless: playback is gated and the context is suspended.
- Title "pop" tween scales banner text to 130% for ~0.3 s; a very long title can touch the edges during that moment.
- Strip shuffling makes RTP tuning jumpy (coin/scatter clustering changes with any count change).
- FS WILD density is only slightly higher than base (4.3% vs 4.0% per cell on reels 2–4) to keep FS RTP in budget; `check.ts` asserts FS > base.
- The retrigger banner was exercised by forced runs but never captured in a screenshot.
- JS bundle is 1,266.7 KB raw / 343.4 KB gzip (mostly Phaser); Vite warns about chunk size.
- Skipped work (Phase 4 stretch, deploy, video, no separate settings modal) is listed in `SKIPPED.md`.
- FPS was measured with a desktop GPU and CPU throttling only. One portrait run had a single 1.6 s frame that didn't reproduce. A check on a real mid-range Android is still worth doing.
- Verifying mid-animation frames headless: set `__game.scene.getScene('Game').tweens.timeScale = 0.05` (slows tweens, not reel motion).

## 7. Next steps (when the user resumes)

### Animation backlog
All 14 suggested items are done (see section 3, Client > Animations). Rules for any new animation: skippable (timeline end state unchanged),
pooled / no per-frame allocations, turbo shortens but never removes results, money only from the response, verify both orientations.

### Remaining
Art integration is authorized and in progress on `feat/parol-assets`.
Inventory: all 23 approved WebPs match their manifest (dimensions, bytes, format, alpha).
Approved size exceptions: H3 448 square; logo 768 x 288. No missing files.
User approved uniformly scaling the frame and its centered 1500 x 900 window between title and HUD.
Mapping/loading step: centralized in `src/theme/parolNights.ts`; fallback generators remain for failures only.
Runtime copies: 320-square symbols and 1280 x 720 / 720 x 1280 backgrounds, generated by
`scripts/assets/runtime.py` (Lanczos resize, WebP quality 80). Original hashes and operations are
logged in `Assets/theme/parol-nights/runtime/manifest.json`; approved originals are untouched.
Critical art including round/plaque controls: 493,740 bytes landscape / 489,572 portrait.
Opposite background and audio are deferred; spin remains gated by existing deferred-ready behavior.
Relative Vite base supports deployment under a sub-path. Browser verification is in progress.
Layout/animation step complete: frame/window/cell geometry comes from the source dimensions and
uniform layout scale; symbol images live in pooled containers, with container-only win/landing
scale animation. Unmasked additive win glows stay beneath the front frame. UI bases retain their
aspect ratios; envelope values use cream text with navy strokes. Feature counters have a clear
gap below the ornament. Existing named depths are sufficient; no new depth constants were added.
Build/type check, lint and all existing checks pass. The million-spin seed-42 simulation still
reports 95.181% RTP. Browser smoke covers portrait/landscape, live rotation, paytable, anticipation,
big win, Free Spins and Hold & Win, returning to Idle without warnings or exceptions.
4x CPU throttle (412 x 915, DPR 2, desktop Chrome): actual rendered frames averaged 115.2 FPS idle
and 91.0 FPS during big win; animation p95 15.7 ms / maximum 28.1 ms. Physical mobile remains untested.

Parol Nights assets: Stages 1–4 approved; final delivery complete.
All 23 exports delivered with manifest, source prompts, attribution, QA and four review sheets.
Asset integration is covered by the current user request.

Only the items in `SKIPPED.md`: deploy (then add the link to the README), gameplay video, and the optional Phase 4 stretch.
Keep the README's bundle size and performance tables current when the client changes.
