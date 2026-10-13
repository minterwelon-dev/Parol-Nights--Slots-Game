# Parol Nights art integration

Branch: `feat/parol-assets`. Baseline: `53fb299`. Art-only changes; math, RNG, RGS,
state machine, paytable data, simulation and recorded simulation output are unchanged.

## Inventory and mapping

All 23 manifest entries exist and match WebP format, dimensions, byte size and alpha.
The frame has the specified centered 1500 x 900 transparent opening in its 1700 x 1100 canvas.
Approved delivery exceptions are H3 at 448 x 448 and the ornament at 768 x 288.
No damaged or missing delivered assets were found.

| Existing texture or visual | Integrated asset | Treatment |
|---|---|---|
| `sym_L1` through `sym_L4` | Corresponding `symbols/L1.webp` through `L4.webp` | 320-square runtime copies |
| `sym_H1` through `sym_H3` | Corresponding high-symbol WebPs | 320-square runtime copies |
| `sym_WILD`, `sym_SCATTER`, `sym_COIN` | Corresponding symbol WebPs | 320-square runtime copies |
| `sym_*_blur` | Loaded symbol source | Procedural motion smear, normalized to its canvas |
| CSS-only background | `bg_landscape`, `bg_portrait` | Cover-fit orientation images; smaller runtime copies |
| Graphics frame | `frame/reel_frame.webp` | Uniform size; exact derived window/mask |
| `ui_spin`, `ui_round` | `ui/spin_button.webp`, `ui/button_round.webp` | Image bases with live code icons |
| `ui_btn`, former `ui_pill_off` | `ui/button_plaque.webp` | One base, code state tints |
| `logo-ornament` | `ui/logo_ornament.webp` | Empty ornament plus live title text |
| Former `ui_coin` | `sym_COIN` | Red envelope with live value/jackpot labels |
| Food icons | Six `icons/*.webp` entries | Free Spins feast table (`FeastTable.ts`), deferred load |

One mapping lives in `src/theme/parolNights.ts`. Boot generates old symbol/UI placeholders
only if loading fails. Background, frame and ornament also have safe generated fallbacks.
Each failed key warns once. Successfully loaded symbol images are never repainted, including
when fonts finish late. Motion-blur textures are effects derived from the delivered art.

Procedural visuals retained: speaker/arrow/stop/text icons, dim and modal panels, HUD panels,
feature boards and counters, winning-cell outlines, glows, rays, shimmer and existing particles.
There are no delivered equivalents for those pieces. There is no `parts/` delivery or current
dish-table implementation. The animation-service architecture described in ANIMATION_SPEC.md
is not implemented by this art pass; existing animation behavior is retained.

## Loading and size

Original approved WebPs total **1,009,408 bytes**, untouched. Full-resolution critical art would
be 725,480 bytes landscape / 721,494 portrait, even before round/plaque controls.
The chosen alternative is logged resize copies: symbols 320 square; backgrounds 1280 x 720 and
720 x 1280, Lanczos, WebP quality 80/method 6. `scripts/assets/runtime.py` preserves originals and
records SHA-256 hashes and operations in `runtime/manifest.json`. Copies total **418,466 bytes**.
No atlas or repainting was introduced.

| Group | Raw bytes |
|---|---:|
| Critical landscape art, including round/plaque controls | 493,740 |
| Critical portrait art, including round/plaque controls | 489,572 |
| Deferred background after landscape startup | 101,338 |
| Deferred background after portrait startup | 105,506 |
| Deferred external MP3s | 69,231 |
| All art requested across both orientations | 595,078 |
| Optional food icons emitted but not requested | 71,106 |
| Total deployed WebP art | 666,184 |
| Added WebP bytes versus the title-only baseline | 628,330 |

The <500 KB target above measures critical **art**, not JavaScript or the existing 53,844 bytes
of startup fonts. Two small audio files remain inlined in JS, as before. Spin stays in its
existing Loading state until deferred loading finishes. The other orientation can arrive after
rotation without blanking the background. Vite `base: './'` supports a deployment sub-path.

Largest files: landscape background 105,506; portrait background 101,338; frame 86,306;
ornament 37,854; spin button 28,900 bytes. Total production output is **2,075,845 bytes raw /
1,108,958 gzip** (sum of each file compressed using Node zlib defaults). JS is 1,276,873 /
345,035 bytes. The existing Vite large-chunk advisory remains; it is not a build failure.

## Layout and animation

User approved uniform fitting between title and HUD. The frame is never stretched. Reference
cells are 177.27 square in landscape and 172.94 square in portrait. Geometry comes from the
frame dimensions/window plus layout constraints; the mask exactly matches that window.
Symbol images use 92% of cell size inside pooled Containers. Win and land size changes apply
to the container at base scale 1; texture changes reapply the child's display size. Glows are
unmasked additive images beneath the front frame. Existing DEPTH constants were sufficient.

Button bases retain their aspect ratios and use code tints. Hold & Win envelope values have
cream fill/navy outline. Feature counters sit in a dedicated gap below the live title ornament.

## Verification

- `npm run build` (including TypeScript), `npm run lint`, and `npm run check`: pass.
- One million spins, seed 42: **95.181% RTP**, report byte-identical to the committed simulation.
- Protected-file hashes match, and git shows no changes to math, RGS or state-machine sources.
- Chrome: portrait 412 x 915 and landscape 915 x 412 at DPR 2, live rotation, idle, spins,
  anticipation, line wins, big-win presentation, Free Spins, Hold & Win, paytable and HUD
  mute/turbo controls exercised. Both features return to Idle. No normal-run warnings/exceptions.
- All ten symbols checked together. No visible halos or stretching; symbols fit at rest and
  remain distinct at small sizes. High symbols have visibly more elaborate construction.
- 4x CPU throttle, actual Phaser post-render frame counts over four seconds: idle **115.2 FPS**,
  big win **91.0 FPS**. Big-win p95 15.7 ms; slowest frame 28.1 ms (a transient below 55 FPS).
  Neither average is under 55. Desktop GPU/Chrome throttling is not physical-device evidence.
- Title and UI text use the existing local Cinzel Decorative / Baloo 2 setup. No asset contains
  newly baked text. There is no separate settings or verify modal in this implementation.
- Production served at `/parol/`: 56 successful same-subpath HTTP responses across both
  orientations; no missing-asset warnings, runtime exceptions or exposed debug hooks. One canvas.
- Delayed symbol requests: loading title, background and bar visible; rotation during loading
  switches cleanly to the landscape background. The bar uses HUD depth and relayouts on rotation.
- Injected failures for `sym_L1`, `sym_COIN`, both backgrounds, frame, ornament, spin, round and
  plaque: all nine keys have nonblank CanvasTexture fallbacks, each warns exactly once, and a
  spin completes back at Idle without an exception. These warnings are intentional test output.
- Six viewport geometry checks confirm a uniform frame, square cells and the exact inset window.

Local evidence and screenshots are in `_review/art-*`; before captures are the unchanged
baseline `_review/typography-step3-portrait.png` and `typography-step3-landscape.png`.
See `_review/art-browser.json`, `_review/art-production.json` and `_review/art-audit.json`.

No unresolved art questions. Real iOS/WKWebView and physical Android verification remain outside
the available browser environment.

## Audit fixes

Applied after an audit of the first integration pass. Math, RGS and state machine are unchanged.

- **Backgrounds:** `scripts/assets/runtime.py` now bakes a slight blur (Gaussian radius 3 at
  1280 px) into the runtime copies, plus a darker top band (up to 30%, fading out over the top 45%).
  The tuning knobs are at the top of the script. The blur is baked, not a runtime filter, because a
  fullscreen blur costs GPU every frame and canvas `ctx.filter` is unsupported on iOS Safari. Each
  background dropped from about 105 KB to 35 KB, so critical art is now about 423 KB in either
  orientation.
- **Spin button:** the delivered disc carries a code-drawn themed icon: a twin-arrow ring (navy, cream
  halo) around a lantern-red parol star. While the reels spin, the ring turns and the star becomes
  a red stop square. Ring and marks hide behind the LOADING text. The idle glow is softer.
- **Symbols:** shown at 1.05 of the cell, because every symbol has a ~7.5% transparent margin, so the
  visible art fills about 89% of the cell. The Hold & Win envelope is shown at the full cell.
- **Landscape layout:** the frame's maximum height is now 690 (was 650). The logo is smaller, and the
  HUD panel sits 15 units lower.
- **Hold & Win:** each value sits on a `button_plaque` across the envelope's lower half, clear of the
  emblem. Jackpot labels have a heavier stroke. Empty cells and the board are navy.
- **Palette:** text strokes use `THEME.stroke` (navy). Panel edges are gold. The modal panel is navy
  with a gold edge. Old ember-brown values are removed.
- **Turbo plaque:** larger, with the label scaled up to match.
- **Free Spins feast table:** `FeastTable.ts` shows six round plates. In landscape they flank the
  reels, three per side. In portrait they sit in one row under the controls. Each plate starts with
  a faint dish silhouette and fills with its dish, with a pop and a glow, as the round progresses.
  The fill level is `floor(6 * played / (played + left))` from response counts and never drops, so a
  retrigger slows the filling and a resumed round starts partly filled. The food icons load with the
  deferred art.
- **Code:** button sizes come from the texture size instead of hard-coded 512/192. The local
  placeholder table in `BootScene` is renamed to `PLACEHOLDER`. The unreachable coin generator is
  removed. Motion-blur textures are built at their source size (320 px for delivered art). The HUD
  press tint is set before the press handler runs, so a press that disables the button stays grey.
- **Title:** the live title centers on the centroid of the ornament's inner navy panel (measured from
  the art: 383.6, 119.3 of 768 x 288), and it centers the letters' ink rather than the text box.
  The landscape logo sits 32 units lower (y 98) and the Free Spins bar moved down 8 to stay clear.
- **Sizes:** info and mute buttons are larger (92 landscape / 104 portrait). The paytable has
  bigger tabs and close button. Content text is scaled by `MODAL_LAYOUT.text` (1.15 landscape /
  1.3 portrait), and the modal panel is taller.
- **Paytable balance:** every page measures its content, then spaces it evenly. Pays: identical
  icon/count/amount groups sized to the widest one, partial last row centered, grid centered between
  tabs and footer. Features: blocks (icon or text, whichever is taller) with equal gaps above,
  between and below; each icon centers on its own text. Lines: label + mini grid centered in each
  cell. Rules: titled sections (gold heading + text) in rows of `MODAL_LAYOUT.ruleCols` (2 landscape,
  1 portrait), evenly spaced, with faint gold dividers between rows.
