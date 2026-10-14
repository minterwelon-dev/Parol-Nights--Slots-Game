# Implementation Status — Parol Nights

Handoff document for new sessions. **Read this after `AGENTS.md` and `PROJECT_BRIEF.md`, before touching code.**
It records what is built, every decision that deviates from or extends the brief, and how to verify.

**Keep it current:** at the end of every completed step, update the relevant sections (status, decisions,
file map, known issues, next steps) and the "Last updated" line. Phase checkboxes also live in `PROJECT_BRIEF.md`; tick them there too.

_Last updated: 2026-10-14 — Parol sway / H3 outer and DevTools resize corrections verified. Not deployed._

---

## 1. Working agreement (how the user wants to work)

- Work **step by step**. Implement one step, verify it, report, then **stop and wait** for the user to say "proceed".
- Never start a new phase without the user's go-ahead. All phases are done; the user skipped deploy and video.
- Ask before changing the game spec. (The user approved the paytable rescale and the RTP tuning, as long as mechanics stay intact.)
- Verify visually in **both landscape and portrait** after any UI change; the user reviews layouts closely (spacing, balance, text fitting the screen).
- The repository has published commits. Commit only when the user asks; on 2026-10-14 the user authorized committing and pushing the pending layered-animation and resize changes to `feat/audio-fx`.

## 2. Status by phase

**Parol motion and viewport correction (2026-10-14):** user requested that H3's outer stop
spinning and all parols retain their original sway alongside independent tassels. This supersedes
the stationary bodies / rotating outer decisions in the historical Step 9 entries below.
Generated a clean H3 outer with imagegen, preserving source and exact prompt in
`source/layered/H3_outer_body.png` and `H3-outer-body-prompt.txt`; export metadata in
`processing-next.json`. The new 30,400-byte WebP replaces the old outer at runtime (old source
preserved, excluded from bundle). Four reused tassels attach independently. H3 inner rotation
and core pulse remain; L1-L4/H1/H2/H3 sway and breathe again. Reduced motion now cancels any
in-progress release blend immediately. No math, money, RGS or state-machine changes.

Resize root cause: applying Phaser zoom before resizing left stale CSS dimensions on returning
to DPR 1 (reproduced: 1280x720 canvas with 1170x2532 CSS). Resize now precedes zoom, and integer
internal dimensions keep canvas, camera and layout aligned at fractional DPR. Regression script
`node tools/check-resize.mjs` passes six successive viewport/DPR changes plus clearing emulation;
evidence `_review/resize-before.json` and `_review/resize-check.json`.

Verified build/typecheck, lint, existing checks and production debug/error-string gate.
`node tools/check-layered.mjs` passes both orientations: fixed outer, body/tassel motion,
win speed, reduced motion, blur/reuse, spin/skip, pool size, failed downloads, no exceptions.
Mixed-grid 4x CPU/DPR 2 samples: 67.4 FPS portrait / 89.4 landscape. Screenshots in
`_review/attachments-{portrait,landscape}.png`; report `_review/layered-check.json`.
Production dist: 2,355,880 raw / 1,351,068 gzip bytes. Physical devices, feature-resume and
deployment were not repeated; resize proof uses CDP emulation, not manual DevTools interaction.

**Animation Step 9, tassels/SCATTER slice (2026-10-14):** implemented on the user's request to
proceed. Generated six clean bodies (L1-L4, H1, H2), one shared gold tassel, an H2 beaded tassel,
and a clean pandereta hoop plus separate cap. L4's delivered art has eight tassels despite the
old asset description omitting them; all eight are supported. H3 retains the previous rotating
outer frame with its attached tassels. Original flat symbols and previous five parts are preserved.
New parts total 218,042 bytes; exact prompts, source PNGs, source hashes, dimensions and export
operations live under `Assets/theme/parol-nights/source/layered/` (`generation-next.json`,
the H2/L4 prompt text files, `processing-next.json`). Re-export: `node tools/export-layered.mjs --next`.

`SYMBOL_PARTS` now supplies per-part texture, attachment position, dimensions and pivot on the
512px reference canvas. Nine slots per SymbolView (largest = L4 body plus eight tassels), allocated
once; timings in gameConfig.anim.symbols.tassel. Bodies stay still in idle; tassels swing +/-6 degrees
over 1400ms with staggered phases. Seven SCATTER caps jingle independently in idle/win; whole-symbol
landing/trigger/skip remains intact. H1 shine now targets the visible body layer. Reduced motion,
dim, spin resets and whole-symbol fallback apply to attachments too. Deferred downloads are unique
by texture name; the tiny cap is inlined by Vite. No outcome, money, state-machine or RGS changes.

Verified: build/typecheck, lint, existing self-checks, production debug/error-string scan, and
expanded `tools/check-layered.mjs`: both orientations, motion with still bodies, expected part
counts, win jiggle, trigger finish/skip, reduced motion, real spin/skip to Idle, unchanged pool
size, and failed tassel/beaded-tassel/cap downloads falling back to complete flat symbols.
Screenshots: `_review/attachments-{portrait,landscape}.png`; report `_review/layered-check.json`.
Attachment-heavy mixed grid at DPR 2 / 4x CPU: 72.2 FPS portrait, 82.1 landscape (short desktop
headless samples, not physical mobile certification). Physical devices, feature-resume and
deployment were not repeated. Spine remains optional.

**Animation Step 9, H3/WILD slice (2026-10-14):** user requested implementation using the
imagegen skill. Five transparent layers generated with the built-in image tool from the approved
symbol references. Original flat artwork is untouched. Sources and exact prompts are in
`Assets/theme/parol-nights/source/layered/`; 512x512 WebPs in `parts/` total 150,970 bytes.
These are regenerated interpretations, not pixel-identical decompositions. Native alpha preserved;
uniform fit/padding and WebP export recorded in `processing.json`. Re-export using
`node tools/export-layered.mjs` (local headless Chrome, muted).

Parts load deferred. Every pooled SymbolView owns three reusable layer slots; no per-spin objects
or layer tweens. H3 inner -10 / outer +6 degrees per second, x3 during wins; WILD rays +20,
x2 during wins. Cores pulse independently, with H3 parameters in gameConfig.anim.symbols.h3.
Layers inherit whole-symbol win/land scale and dim. Reduced motion restores a static pose;
spin resets poses and uses the existing flat blur. Missing any layer retains that symbol's
complete flat image; WILD's procedural rays remain the fallback. No outcome/state/RGS changes.

Verified: build/typecheck, lint, existing self-checks, production debug/error-string gate;
`node tools/check-layered.mjs` with `npm run dev` checks portrait/landscape, opposite rotation,
win speed, reduced motion, blur/reuse reset, actual spin/skip returning to Idle, unchanged pool
size and one failed-layer download falling back while WILD remains layered. No runtime exceptions.
Screenshots/report: `_review/layered-{portrait,landscape}.png`, `_review/layered-check.json`.
4x CPU / DPR 2, five H3 + five WILD: portrait 104.6 FPS vs flat 110.2; landscape 118.8 vs flat
116.6. An initial 40.3 FPS sample failed; final comparison passed. Desktop headless measurements,
not physical-device proof. Production total: 2,150,785 raw / 1,151,006 gzip bytes.
Remaining optional slices: independent tassels on other symbols, individual SCATTER caps, Spine.
Physical Android/iOS, feature-resume regression and deployment were not repeated in this slice.

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
  - Win symbols: superseded by `SymbolAnimator` (ANIMATION_SPEC Step 3, see the animation section).
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

## ANIMATION_SPEC.md implementation (in progress)

User decisions (2026-10-13): **full spec architecture** (`src/game/animation/*`, existing animation code
moves into it step by step); animation values live in **`gameConfig.anim`** (not a separate
`animationConfig.ts`, per AGENTS.md single-config rule); **spec values replace the tuned ones** as each
step lands. If the user dislikes them, restore these previous tuned values:
`win.lineDrawMs 250`, `win.countUpMs 900` (fixed), tier `countUpMs` 3500 / 5500 / 7500, win pulse 1.06
with no pop (`Reels.WIN_GROW`), `timing.stopStaggerMs 160` / turbo 50, `timing.bounceMs 220` / `bounceAmp 0.14`,
`timing.anticipationMs 1300` / turbo 650, camera shake 0.006 for 350 ms (`WinPresenter.SHAKE*`).
Shake drops to the spec cap (<= 0.004, <= 300 ms) regardless: it is a comfort / photosensitivity limit.

Build order (spec section 17): 1 foundation · 2 reels · 3 symbol states + win presentation · 4 anticipation +
trigger · 5 particles + big win · 6 Free Spins + Hold & Win · 7 ambient + HUD · 8 polish / throttled FPS · 9 optional Level 1 / Spine.

**Step 1 done:** `gameConfig.anim` (spec section 4 values, turbo factor 0.45 / particles 0.5, reduced fade
150 ms, shake and flash caps). `src/game/animation/AnimationHandle.ts` (Phaser-free: `done`, `finish()`,
`cancel()`, `complete()`, `AnimationHandle.all()`; asserted in `npm run check`). `AnimationService.ts`
(`dur()`, `count()`, `particleCap`, `tween()` / `counter()` / `delay()` returning handles, capped `shake()`,
400 ms-gated `flash()`, `reduced` = player override ?? live `prefers-reduced-motion`, `ANIM_EVENTS` emitted on
`scene.events`). `fxTextures.ts` generates `FX.glow / spark / ring / petal / coinDot` in BootScene. GameScene
owns one service and forwards turbo. No module uses it yet, so nothing visible changed.
ESLint: scripts may import `game/animation/AnimationHandle` only (narrow exception; other game imports still error).
Hidden tab: Phaser already pauses its loop (all tweens) while hidden; nothing extra needed.
**Note:** this machine has Windows animation effects off (`MinAnimate 0`), so Chrome here reports
`prefers-reduced-motion: reduce`. Once modules honour it (from Step 2), local testing shows the reduced
variant unless the override is used: `__game.scene.getScene('Game').anim.setReducedMotion(false)`.
Verified: tsc, lint, prettier, 8 self-checks, build (no debug strings in dist), headless Chrome portrait 412x915
and landscape 915x412: FX textures present, a spin returns to Idle, no warnings or errors; turbo `dur(1000)` = 450.

**Step 2 done (reels):** reel motion moved out of `Reels.ts` into `src/game/animation/ReelAnimator.ts`; `Reels`
keeps views, mask, frame, glow / vignette, win highlight and landing pops, and passes the animator a small
`ReelView` callback set (shift, place, setBlur, snap, landed, tease). Values from `gameConfig.anim`:
start kick 20 px over 120 ms with 40 ms per-reel stagger (`anim.reel.startStaggerMs`, added); stop stagger 180 ms
(turbo 60); landing overshoot 12 px, settle 180 ms; spin-loop blur = existing smear texture plus container
`scaleY 1.08` / `alpha 0.9`; anticipation slows the teased reel to 30% speed, glow stroke at `glowAlpha` 0.9 and a
black 0.35 vignette (`anim.anticipation.vignetteAlpha`, added) over the other reels, total about 1400 ms (the slow
landing counts toward it); quick stop snaps every reel with a known result straight onto the grid (no bounce).
Turbo: `dur()` scales kick, landing and anticipation (0.45). Reduced motion: no kick, no overshoot, steady glow.
`SpinTiming` now holds only `speed`, `accelMs`, `minSpinMs`; the old wind-up / bounce / stagger / anticipation
fields are gone (previous values listed above for revert). `Reels.hooks` removed: GameScene plays sound from
`spinStart`, `reelLanded`, `anticipationStart` on `scene.events`. Anticipation rule (`utils/anticipation.ts`) unchanged.
Verified: tsc, lint, prettier, self-checks, both orientations in headless Chrome with full motion: land gaps
150 to 200 ms (frame-quantized around 180), turbo about 60, quick stop 0; forced Free Spins anticipation about
1.35 to 1.5 s with events `anticipationStart/End` in order; feature played through to Idle; reduced-motion spin;
RGS failure halts to Error and recovers to Idle; no warnings, errors or landed-grid mismatches.
Screenshots: scratchpad only (`anim-step2-*`), not committed. **User approved Step 2.**

**Step 3 done (symbol states + win presentation):** `src/game/animation/SymbolAnimator.ts` owns per-cell states in one
per-frame pass (no tweens, no allocations): idle sway +/-3 deg around the top pivot (1800 ms half-period) and
breathe 1 -> 1.03 (2400 ms), phase offset `index * 120 ms`, only while the FSM is in Idle (GameScene fsm listener ->
`reels.setIdle`); land squash scaleY 0.94 -> 1 over `dur(180)` (none on skip snap); win pop 1 -> 1.18 (260 ms
Back.easeOut) blending into a 1.0 <-> 1.08 breathe (500 ms), glow alpha 0.3 -> 0.8, 3 sparkles per cycle, L1-L4 sway
x1.6 while winning; dim to 0.35 over 150 ms. The SCATTER / COIN landing pop moved here from `Reels`. `SymbolView` now
nests root (cell center: motion, scale, alpha) > pivot (top center: angle) > image. Reduced motion: no idle, pop, breathe,
squash or sparkles; static glow 0.6; dim applies at once. `FxPool.ts` (pooled sparkle emitter per depth, capped at
`particleCap`, visual randomness from `Phaser.Math.RND`) is reached through `anim.fx`.
`WinPresenter` moved to `src/game/animation/WinPresenter.ts`: count-up `Cubic.easeOut`; normal wins 800 -> 1500 ms
scaled by win / (15 x bet); tiers 3000 / 5000 / 7000 ms (`winTiers.countUpMs`); all through `dur()`, so turbo is x0.45;
a 1.15 -> 1 settle pulse on the meter after every count-up and skip (`anim.countUp.settle*`); `countUpStart / End`
and `winPop` events; camera shake now 0.004 / 300 ms via `anim.shake()`. `WinLines`: draw-in `dur(350)`, Idle cycle
350 + 350 = 700 ms per line, glow stroke (soft 20 px pass under the 7 px line), `lineShown(line)` event, steady frames
in reduced motion. During the presentation all lines still show at once (approved behaviour); one-by-one cycling stays
in Idle. Removed `win.countUpMs`, `win.lineCycleMs`, `win.lineDrawMs` (now `anim.line` / `anim.countUp`).
`Timeline.counter()` takes an optional ease. Not in this step: symbol specifics (7.2: H1 shine, H2 shimmer, WILD rays /
shockwave, SCATTER jingle, COIN shine), trigger, big win extras.
Verified (headless Chrome, both orientations, full motion): idle angles vary within +/-3 deg and are 0 while spinning;
land squash sampled at 0.943 to 0.953; a normal win grew 5 to 7 cells and dimmed the rest, count-up 910 to 1195 ms;
line cycle 700 ms; big win count-up 3004 ms, turbo 1355 ms; skip leaves the final amount and the meter mid-settle;
up to 27 sparkles alive; reduced motion static; no warnings / errors (the dev total assertion stayed silent).
Found and fixed during testing: `Phaser.Math.RND` is only set at game boot, so FxPool reads it at emit time.
**User approved Step 3.**

**Step 4 done (anticipation pulse, trigger, symbol specifics 7.2 Level 0):** all in `SymbolAnimator`, values in
`gameConfig.anim.tease / trigger / symbols / burst / postFxMax`.
- Anticipation: while a reel teases, visible SCATTER (and COIN when coins count) on landed reels pulse 1 -> 1.12 every
  400 ms with a glow. `Reels.tease()` counts contributors on the landed reels with the same thresholds as
  `utils/anticipation.ts`, so only symbols that make the trigger possible pulse.
- Trigger: `Reels.trigger(id)` -> `SymbolAnimator.trigger(mask)` returns an `AnimationHandle` (first real handle user).
  GameScene plays it before the feature intro (not when resuming mid-feature): SCATTER (Free Spins) or COIN (Hold & Win)
  cells from the response grid pop to 1.2, spin 360 deg via `scaleX = cos`, 12-star burst; the rest dim; 1100 ms. Tap or
  the spin button calls `finish()`; afterwards `clearLines()` restores the reels before the intro overlay.
- Specifics: L1-L4 faster win sway (Step 3); H1 preFX shine every 4 s in Idle (one at a time), win = star burst + two
  shine sweeps; H2 teal shimmer glow (alpha 0.1-0.25, 1.5 Hz) in Idle, teal win glow; H3 breathing glow in Idle, two
  star bursts on win; WILD baked rays (`UI.rays`, behind the symbol at the reel-back depth) turning 20 deg/s in Idle and
  40 deg/s while winning, core pulse 1 <-> 1.06, landing shockwave ring (0.2 -> 2.5, 450 ms) + star burst, a steady
  sparkle stream while winning; SCATTER jingle +/-4 deg every 3 s, win shake +/-8 deg x3 at 40 ms; COIN shine every 3 s.
- Post-FX budget: `anim.acquireFx()` / `releaseFx()`, max 3 (`postFxMax`); shines skip when the budget is used,
  on Canvas (no preFX) and in reduced motion. All shines are removed at spin start.
- Glows now use the white `FX.glow` texture tinted per symbol (gold `0xffc94a`, H2 teal).
- `FxPool` gained `burst()` (12 stars, 80-220 px/s, 600 ms) and pooled `ring()` (6 per depth).
- Reduced motion: no pulse, spin, shake, jingle, ray rotation, shockwave or shine; static glows and dim only; trigger
  shortens to the 150 ms fade.
Verified (headless Chrome, both orientations, full motion): WILD rays visible and turning, shockwave ring seen after
landing; H2 / H3 idle glows on; forced Free Spins: tease scale 1.12 at pulse peak (1.27 when it overlaps the landing
pop), trigger about 1.1 s plus polling, scaleX reached -1.19 (full flip); forced Hold & Win trigger tapped after 150 ms
finished at once; reels fully undimmed in Idle after both features; post-FX never above 2; no warnings or errors.
**User approved Step 4.**

**Step 5 done (particles + big win overlay):** `WinPresenter` dressing per tier, values in `gameConfig.anim.bigWin`.
Opening: dim (depth 20), rays (static in reduced motion), soft gold glow, and the logo ornament as the banner, scaling
0.2 -> 1 (`Back.easeOut`, 400 ms); the tier title sits on the ornament's inner panel (`Title.PANEL`, now exported with
`ASPECT`) and fits inside it. Tiers stack as the count-up escalates (`dress()`): BIG = sparkles around the banner every
220 ms; MEGA adds 8 warm-tinted L-symbol lanterns rising over 3 s with a sway (pooled) and the coin shower (COIN art,
40 over 2 s, gravity 400); EPIC adds one camera shake (0.004 / 300 ms, capped by the service), confetti petals
(`FX.petal`, 30 over 2 s, gravity 250, 4 tints) and light bursts (star burst + ring at a random spot every 600 ms, no
full-screen flash). Shake moved from MEGA+ to EPIC only, as the spec lists it. Closing stops every emitter and timer and
fades lanterns; falling coins / petals finish their fall. `bigWinStart(tier)` / `bigWinEnd` events. Removed
`winTiers[].shower` and `win.showerMs`. Reduced motion: banner, text, static rays and glow only.
Particle cap: `FxPool.alive()` counts pooled and registered emitters; sparkles and bursts shrink to the room left
under `particleCap`, so the cap is a hard limit. DEV: GameScene warns once if more than the cap are alive.
Visual randomness uses `Phaser.Math.RND` (the old shower used `Phaser.Math.Between`, i.e. `Math.random`).
Verified (headless Chrome, both orientations, full motion): forced BIG (banner at scale 1, sparkles, no coins), forced
MEGA (18 coins, 8 lanterns mid-count), EPIC via a direct `presenter.present()` call (no force exists for >= 100x: shake
ran at the tier change, coins 39, petals 19, light bursts); two taps close the overlay with nothing left visible; titles
fit the banner panel; reduced motion added no new particles; peak alive 114 landscape / 88 portrait (cap 150), after a
first run peaked at 156 and led to the hard cap; no warnings or errors.
**User approved Step 5.**

**Step 6 done (Free Spins + Hold & Win, spec section 9):** shared pieces in `src/game/animation/FeatureAnimations.ts`
(`slideIn`, `flip`, `milestone`, pooled `StringLights` and `Pips`), values in `gameConfig.anim.feature`.
`FeatureOverlay` takes the service; `step(..., style)` has `'intro'` (12-light lantern string lights left to right,
title slides up 90 px with a tinted glow, the count pops 320 ms later) and `'drop'` (banner falls 260 px). Its bar takes
optional respin pips; `flipBar()` flips a counter on its vertical axis then pops; `fly(..., onLand)`.
Free Spins: intro style, `featureIntro('freeSpins')`; each raised multiplier emits `multiplierTick(n)` when the flyer
lands, with a milestone (gold flash, 1.7 scale pulse, star burst) at x5 / x10 / x15; retrigger "+n" drops in and the
spin counter flips; dish pop 300 ms; summary sparkles the served dishes in turn. The feast table keeps the approved
progress-based fill (it does not add one dish per winning spin as the spec words it).
Hold & Win: the bar reads `RESPINS` + 3 pips; a respin spends one (pop), a new coin refills all three with an 80 ms
stagger (`respinReset`); coins drop and bounce, lock with a flash (`coinLocked`), then the plaque and value flip in on
scaleX and the value pops; jackpot coins add a ring in their tier tint, a star burst and a gold flash on TOTAL
(`jackpotReveal(tier)`); Grand adds one camera flash (`anim.flash`, gated by reduced motion and the 400 ms rule) to the
wave; the summary first collects coin values one by one (260 ms, x0.85 per coin, floor 50 ms, skippable), then shows
the response total and counts up as before (`featureSummary`). Reduced motion: lights static, no slide / drop / flip /
milestone pulse / ring / flash, pips change at once.
Verified (headless Chrome, both orientations, turbo on to shorten the run): forced retrigger round: intro lights 7 of 12
lit after 400 ms, title glow on, multiplier ticks 2..7 (landscape) and 2..10 (portrait) in order, summary event;
forced Grand: 3 pips with 2 lit after the first respin, values mid-flip at 0.97, 15 `coinLocked`, 9 `respinReset`,
camera flash ran, 15 distinct TOTAL values during the collect, back to Idle; no warnings or errors (dev total assertions
silent). Spent pip alpha raised from 0.18 to 0.35 after the screenshot review. No jackpot coin appeared in the forced
rounds; a direct `holdAndWin.jackpot(7, 'major')` call showed the ring in the Major tint (`ff9cf0`), 12 stars and the
`jackpotReveal:major` event, without errors.
**User approved Step 6.**

**Step 7 done (ambient background, HUD, reduced-motion toggle; spec section 10):**
- `src/game/animation/AmbientBackground.ts`: 20 additive bokeh (`FX.glow`, warm tints) rising 60 px and fading over
  7-12 s, 20 stars (`FX.spark`) twinkling in the top 42% with an alpha swing of 0.15 (photosensitivity limit), and a
  +/-6 px, 12 s parallax on the painted background (`Background.setParallax`; the cover fit gained an 8 px margin so no
  edge shows). Positions use an R2 low-discrepancy sequence: deterministic, no RNG. 40 objects, one per-frame pass.
  Feature palette: an fsm listener tints the background toward `ambient.tints.freeSpins` / `holdAndWin` over 600 ms and
  back to white in Idle. Reduced motion: everything static. Not done: lantern-string sway and string-light jitter.
  Those lanterns are painted into the background art, so they need layered art (spec Level 1).
- `src/game/animation/HudAnimations.ts` (`nudge`, `hover`) and `fx.pressBy()`. Spin button: idle glow pulse 0.5 -> 1.0
  over 1200 ms (was 0.1 -> 0.35 / 1100), press 0.94 for 80 ms (other buttons keep the 0.88 / 220 ms press), disabled
  alpha 0.5 (was 0.45), ring rotation and glow pulse off in reduced motion. Balance roll-up `Cubic.easeOut`. Bet value
  nudges 1.18 -> 1 when it changes. Hover tint `0xfff0c0` on the HUD buttons, mute, motion and an active spin disc.
- Reduced-motion toggle: a header button (`UI.motionOn / motionOff`, generated in BootScene: three speed lines, struck
  out when reduced) left of mute in both orientations. `AnimationService.toggleReduced()` flips the effective setting
  and stores it in `localStorage['parol-nights-motion']` ('1' / '0'; absent = follow the OS); read at startup, storage
  errors ignored. Not part of the legacy-key migration (new key).
Verified (headless Chrome, both orientations): 40 ambient objects, background x and bokeh alpha change over 0.9 s, stars
within 0.45-0.60; spin glow samples 0.53 to 1.0; bet nudge 1.18; spin disc hover tint `fff0c0`, back to `ffffff` on
leave; background tint `e2c8ff` during forced Free Spins and `ffffff` back in Idle; the motion button set reduced, icon
`ui_motion_off`, stored '1', ambient static, and the choice survived a reload; no warnings or errors.
**Step 7 revision (user feedback, 2026-10-13):** (1) bokeh was barely visible: new `FX.bokeh` texture (near-flat disc
with a soft rim, reads as out-of-focus light; the soft `FX.glow` disappeared into the painted lights), 70-190 px, alpha
0.55, drift 160 px. (2) Stars removed (they read as dust / speckles); `ambient.stars / starPx / starMs / starAlpha /
flickerSwing / skyFraction` deleted. (3) Symbols jumped straight into mid-sway / mid-breathe when the machine entered
Idle after a spin, and snapped from the win scale when a cycled line moved on: idle motion now fades in over
`anim.idle.blendInMs` 600 ms (smoothstep weight per cell), and any cell leaving win / tease / trigger eases from its last
scale and angle over `anim.idle.releaseMs` 300 ms (cubic out). Landing squash and feature pops are unchanged.
Measured (headless Chrome, both orientations, full motion): the largest frame-to-frame change on settled cells after
three spins and during the Idle line cycle was 0.04-0.17 deg (0.54 deg once, during the SCATTER jingle, which is a
deliberate quick wiggle) and at most 0.010 in scale; no warnings or errors.
**Note for local review:** this PC has Windows animation effects off, so Chrome reports `prefers-reduced-motion:
reduce` and the game starts in reduced motion (no idle sway, static ambient). Use the header motion button (three lines)
to switch to full motion; the choice is remembered.
**Sparkle glints (replace the removed stars, user request 2026-10-13).** References: CSS glitter keyframes
(scale 0.3 -> 1 -> 0.3 with a turn, opacity 0 -> 1 -> 0, then a rest; https://gist.github.com/zamboney/ed398efded1a88f5217682eef750776c),
4-point concave star shape (https://www.techumber.com/amazing-glitter-star-effect-using-pure-css3), bright sparkles with
diffraction spikes and twinkle cycles above 1.4 s (https://animationpatterns.art/animations/starlight-shimmer-text/).
New `FX.glint` texture: soft white core, four long tapered spikes and four short diagonals. 7 glints
(`anim.ambient.glints`), 60-130 px, warm-white tint, additive at background depth. Each shows for 1100 ms (grow 0.3 ->
1 -> 0.3, turn 90 deg, fade in and out), then rests 2.6-7 s, and reappears at the next spot of an R2 sequence in the top
45% of the screen, skipping the reel frame and the logo. On average 1.5 are visible at once. Hidden in reduced motion.
Deviation to note: a glint fades fully in and out (one pulse, under 1 Hz, small area), unlike the 0.15 swing the spec
sets for ambient light flicker; it is not a repeating flicker, but say if you want it capped.
Verified (headless Chrome, both orientations): glints reach full alpha with the intended shape on the sky, average 1.5
visible (6 for a moment as the phases line up), 0 in reduced motion; no warnings or errors.
**User approved Step 7 (with the glints).**

**Step 8 done (polish + QA, spec sections 16-17):**
- Throttled FPS (412 x 915 / 915 x 412, DPR 2.625, 4x CPU, full motion, dev build): portrait idle 113.8 / spin 98.4 /
  mega 93.0 / Free Spins 89.1 / Hold & Win 80.0 FPS; landscape 132.6 / 116.8 / 88.1 / 104.0 / 111.4. p95 frame
  10-20 ms. Frames over 100 ms only occur in `Spinning` inside the dev forced-outcome seed scan (`forcePicker`; 2.98 s
  for a forced mega win at 4x); unforced rounds have none. README Performance table updated.
- Leaks: Idle tween count is 8 before and after big win, Free Spins and Hold & Win; post-FX back to 0.
- Config: the remaining hard-coded presentation durations moved to `gameConfig.anim.timings` (values unchanged):
  fx fades / text pop, land pop, tease glow, win-frame pulse, meter pulse, big win rays, light-burst ring, spin ring,
  flyer, bar flash, string lights, pips, milestone, dish glow, coin drop / flash, jackpot glow, collect bump, shimmer,
  Grand wave. Geometry fractions and particle speed ranges stay as named module constants.
- Production: preview build in both orientations, one canvas, no debug hooks, no warnings or errors; dist has no
  debug strings. Bundle: JS 1,325.0 KB raw / 364.0 KB gzip (+35 KB raw / +11 KB gzip over the pre-animation build);
  total dist 1,996.7 KB / 1,000.7 KB (README updated).
QA checklist status: FPS, post-FX <= 3, particle cap, skip end states (dev total assertion silent through tapped
features), no tween leaks, turbo, reduced motion, flash gating, anticipation from the response only, reels land on the
grid (dev assertion), hidden tab (Phaser pauses), both orientations, timings in config, events in order: all checked.
Not checked: a physical Android / iOS device.
Step 9 is optional: Level 1 layered symbol parts (needs new art via CODEX_ASSET_PROMPT.md) and a Spine trial (licence).

**Title restyle (user request after Step 8, 2026-10-13; option "logo gold for all"):** FREE SPINS, HOLD & WIN, GRAND,
the retrigger banner, the feature summaries and BIG / MEGA / EPIC WIN now use Cinzel Decorative 700 with the logo look:
`goldTitle()` in `src/game/fx.ts` (gradient `THEME.titleGold` cream #fff3c4 -> gold #ffc94a -> amber #d9821e, navy
stroke, outer glow), re-applied after every text / size change because the gradient spans the text's height. Tier glow
(`WinPresenter.TIER_GLOW`): BIG gold #ff9f1c blur 18, MEGA parol red #e8402a blur 24, EPIC red blur 36 (reference px).
Free Spins dropped pink / purple: title glow red, dim 0x170818 (navy-red), pill edge gold, ambient tint 0xffd6cc (was
purple 0xe2c8ff). Hold & Win: gold glow. Amounts and counters stay Baloo 2, cream `THEME.amount` #fff6e0 on navy.
`OverlayTheme.title` replaced by `glow`. Title stroke 14 -> 10 px (the glow carries the edge). docs/typography.md updated.
Verified with screenshots in both orientations (big, mega, epic, Free Spins intro and summary, Hold & Win intro, Grand):
titles fit the banner and screen, glow not clipped, no warnings or errors.
Seen in passing (not changed): in portrait the Grand banner's hint "ALL 15 FILLED" overlaps the dimmed BALANCE / WIN
panel (existing overlay layout).

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
src/game/                   Reels, Symbol, WinLines, FeatureOverlay (shared feature chrome), FreeSpins, HoldAndWin,
                            Hud, ErrorModal, Paytable, SoundManager, DebugPanel (DEV),
                            fx (shared dimLayer(), pop(), press(), fadeIn(), fadeOut() helpers)
src/game/animation/         AnimationHandle (Phaser-free), AnimationService (facade, turbo, reduced motion, events), fxTextures,
                            ReelAnimator (spin / stop / anticipation / snap motion; Reels supplies the views),
                            SymbolAnimator (idle / land / win / dim per cell), FxPool (pooled sparkles), WinPresenter
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

Sound wiring (GameScene): `ANIM_EVENTS.spinStart / reelLanded / anticipationStart` on `scene.events`, `presenter.onWin(big)`, `holdAndWin.onCoin`.

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
Art integration is complete on `feat/parol-assets`; see `docs/art-integration.md`.
Inventory: all 23 approved WebPs match their manifest (dimensions, bytes, format, alpha).
Approved size exceptions: H3 448 square; logo 768 x 288. No missing files.
User approved uniformly scaling the frame and its centered 1500 x 900 window between title and HUD.
Mapping/loading step: centralized in `src/theme/parolNights.ts`; fallback generators remain for failures only.
Runtime copies: 320-square symbols and 1280 x 720 / 720 x 1280 backgrounds, generated by
`scripts/assets/runtime.py` (Lanczos resize, WebP quality 80). Original hashes and operations are
logged in `Assets/theme/parol-nights/runtime/manifest.json`; approved originals are untouched.
Critical art including round/plaque controls: 493,740 bytes landscape / 489,572 portrait.
Opposite background and audio are deferred; spin remains gated by existing deferred-ready behavior.
Relative Vite base supports deployment under a sub-path. Browser verification passed.
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
Final verification: production `/parol/` passed in both orientations with 56 successful HTTP
responses and no runtime warnings/exceptions; debug hooks are absent and only one canvas exists.
Loading-screen rotation passed. The loader bar now remains above the background and relayouts.
Nine injected missing textures all use nonblank procedural fallbacks and warn once per key;
a complete fallback spin returned to Idle without exceptions. Final build, type check, lint and
existing checks pass. Six viewport geometry checks pass. Original delivered art is unchanged.
Final dist: 2,075,845 raw / 1,108,958 gzip bytes. Active art across orientations: 595,078 bytes;
71,106 optional food-icon bytes are emitted but not requested (there is no dish-table consumer).
Evidence: `_review/art-browser.json`, `art-production.json`, `art-audit.json`, screenshots
`_review/art-*.png`. Procedural HUD icons, panels, feature boards and effects remain intentionally.
No unresolved integration questions; separate settings/verify modals do not exist in this client.

Art audit fixes (2026-10-13, uncommitted): see `docs/art-integration.md` > Audit fixes. Runtime
backgrounds are baked with a slight blur and darker top band (`scripts/assets/runtime.py`, 35 KB each).
Spin button: delivered disc plus generated navy/gold twin arrows and a red parol star (red/gold
stop square while spinning; the ring turns). The three generated control layers are mapped in
`src/theme/parolNights.ts`; existing procedural glyphs remain load-failure fallbacks. No spin,
stop, game-state or animation timing logic changed in this replacement. Original PNGs and
exact prompts are in `Assets/theme/parol-nights/source/spin-controls/` and
`source/spin-controls-prompts.json`; packaging script `scripts/assets/spin_controls.py` logs
alpha trim, uniform resize and padding. Added WebPs total 16,044 bytes. Build/type check, lint,
self-checks and portrait/landscape browser checks pass (spin/stop/loading/disabled states and
real spin/quick-stop back to Idle). Evidence: `_review/generated-controls-browser.json` and
`_review/art-generated-controls-*.png`. Current working-tree dist: 1,961,723 raw / 989,676 gzip
bytes, including earlier audit changes. Critical art: 439,238 landscape / 438,852 portrait bytes.
Title ink is centered on the ornament's inner panel centroid.
Corner buttons and paytable (tabs, text via `MODAL_LAYOUT.text`) are larger. Symbols fill 1.05 of the cell (art has a ~7.5% margin). Landscape reels
are larger (frame max height 690, smaller logo, HUD lowered). Hold & Win values sit on the plaque art.
Palette is navy/gold throughout (`THEME.stroke` navy, gold panel edges, navy modal panel). Turbo
plaque is larger. Food icons now drive `src/game/FeastTable.ts`: six plates (landscape: three each
side of the reels; portrait: a row below the controls) fill with dishes during Free Spins.
The fill level is `floor(6 * played / (played + left))` from response counts, and it never drops.

Parol Nights assets: Stages 1–4 approved; final delivery complete.
All 23 exports delivered with manifest, source prompts, attribution, QA and four review sheets.
Asset integration is covered by the current user request.

Phase 5 delivery (user request, 2026-10-13): gameplay video `docs/media/gameplay.mp4` (39 s, 1280x720, H.264 CRF 26,
6.8 MB, silent) recorded from the dev build with puppeteer `page.screencast` (ffmpeg-static in the session scratchpad,
not a repo dependency): two base spins, the debug panel arming freeSpins, turbo on, Free Spins played through (taps
fast-forward intros / summaries), then holdAndWin armed and played. GitHub Pages: `.github/workflows/pages.yml` (Node 22,
`npm ci`, `npm run check`, `npm run build`, debug-string gate, upload + deploy-pages) on pushes to `main`. `_review/`
(39 MB of local QA evidence) is git-ignored at the user's choice; docs still reference it locally. Branch plan: commit on
feat/parol-assets, create `main` at the same commit, push both once the user creates the public repo.
Remaining after that: the optional Phase 4 stretch items in `SKIPPED.md` and the optional ANIMATION_SPEC Step 9.
Deployed 2026-10-13: repo https://github.com/minterwelon-dev/Parol-Nights--Slots-Game (branches `main` and
`feat/parol-assets`, same commit). The first workflow run failed to parse (invalid YAML escape in the debug gate); fixed
with a block-scalar `grep -E` step (commit "fix(ci)"). The run on `main` then passed every step and deployed:
https://minterwelon-dev.github.io/Parol-Nights--Slots-Game/. Live check (headless Chrome, both orientations, production): 66 successful responses, no 4xx/5xx, one canvas,
no debug hooks, no warnings or errors, three spins played.
Keep the README's bundle size and performance tables current when the client changes.
