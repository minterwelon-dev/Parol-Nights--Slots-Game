# Parol Nights typography

Step 3 implementation, 2026-10-13. Full Step 4 modal/count-up/device verification remains next.

## Fonts and licensing

The requested pair is used without a third numeric family:

| Use | Font / weights | License | Reason |
|---|---|---|---|
| Live game title | Cinzel Decorative 700 | SIL Open Font License 1.1 | Ornamental letterforms complement the gold bamboo banner. |
| UI and numbers | Baloo 2 400, 700 | SIL Open Font License 1.1 | Rounded friendly shapes, clear digits and equal digit advances. |

Both installed Fontsource packages are 5.3.0. Licenses were read from the packages
and checked against [Cinzel Decorative](https://fontsource.org/fonts/cinzel-decorative/about)
and [Baloo 2](https://fontsource.org/fonts/baloo-2/about) on Fontsource.
Unmodified copyright notices and full licenses ship under `public/licenses/` and
are copied to `dist/licenses/`. Only Latin WOFF2 files enter the build; package
Latin coverage includes U+0000–00FF, covering basic Latin and ñ / Ñ.

## Setup

`THEME.fonts` in `src/constants.ts` defines title, UI and numeric stacks. Numeric
uses the same Baloo 2 stack. CSS variables `--font-title`, `--font-ui` and
`--font-numeric` expose these to DOM elements. DOM text requests tabular numbers;
FontFace descriptors request `tnum` for canvas rendering as well.

`src/utils/fonts.ts` registers the three local URL imports and loads all faces.
`main.ts` races loading against 1500ms before creating Phaser. Failure reaches the
fallback UI. A late `loadingdone` event reapplies fonts, refreshes Text canvases
(including nested containers), redraws cached placeholder labels and refits layout.
Font load API probes use 16px; all rendered title layout uses sx/sy/sd.

`src/game/Title.ts` renders exactly `GAME_TITLE` as live text over the existing
text-free logo ornament. Warm gold, navy stroke, static warm shadow; no added
animation or flashing. Static presentation is compatible with reduced motion.
The title fits the open panel in the tested 412x915 and 915x412 viewports.
Cinzel's lowercase forms resemble small capitals; the underlying text remains
exactly `Parol Nights`. Other theme art integration is separate.

## Step 3 evidence

- Build/type check and all self-checks pass; protected math/state/type hashes unchanged.
- Project lint passes excluding `scripts/assets/.python/**`; plain lint still scans
  that embedded dependency's vendored JavaScript and reports its six pre-existing errors.
- `_review/typography-step3-browser.mjs`: muted headless Chrome, portrait/landscape,
  loaded faces, title bounds, equal digit widths and a deliberate four-second font delay.
- At a 100px canvas measurement size, all ten Baloo 2 digits measure 58.29999px
  at weight 400 and 60px at weight 700. No per-digit width workaround is needed.
- The delayed-font scenario starts with all three faces still loading, then shows
  the loaded title's different metrics after refresh/refit. All three font requests
  are same-origin; no CDN request is introduced.
- Screenshots: `_review/typography-step3-portrait.png`, `typography-step3-landscape.png`.
  Data: `_review/typography-step3-browser.json`, `typography-step3-sizes.json`.
- Remaining old-name hits are only the three intentional legacy storage literals
  at `src/utils/storage.ts:8–10` and their copies in the built JavaScript.

## Bundle impact

Decimal bytes, gzip measured per file using Node `zlib.gzipSync`:

| Font asset | Raw | Gzip |
|---|---:|---:|
| Cinzel Decorative Latin 700 | 15,488 | 15,511 |
| Baloo 2 Latin 400 | 18,920 | 18,922 |
| Baloo 2 Latin 700 | 19,436 | 19,437 |
| **Font total** | **53,844** | **53,870** |

WOFF2 is already compressed, so gzip is slightly larger. Full build is 1,440,130
bytes, +103,196 over Step 2: fonts 53,844, ornament 37,854, licenses 8,998,
JavaScript +2,383 and HTML +117. Final JS: 1,269,489 raw / 342,934 gzip.

## Next review

Step 4 still needs the full loading-screen, live count-up, paytable, settings/verify
surface audit, rotation and production browser pass. No separate settings or verify
modal is recorded in the existing implementation; confirm actual available surfaces
during that audit rather than creating new game features. No unresolved font choice
or ornament-fit question was found in Step 3.
