# Parol Nights — Asset QA

## Final delivery — approved

All four stages approved by the user. Final verification on 2026-10-13 passed
for all 23 manifest entries, matching on-disk WebPs, preserved source PNGs,
per-asset attribution sections and all four review sheets. File dimensions,
alpha, caps, exact frame cut, background metrics and 59 baseline file hashes
passed `scripts/assets/validate.py`; evidence: `_review/verification-stage4.json`.

Production WebPs total **1,009,408 bytes**. Approved size fallbacks: H3 448x448,
logo_ornament 768x288. H2 quality 76; all other exports quality 80, method 6.
No outstanding asset-generation failures. Native source/review files are excluded
from the production total. Runtime integration and browser/device validation of
the new theme are outside this art-only delivery.

## Stage 4 — food icon delivery

Date: 2026-10-13. Stages 1–4 approved by the user.
Review: repository-root `_review/food-sheet.png`, native 256px navy/light previews
plus 96px color, greyscale and light previews. Sources and exact prompts preserved
in `source/generation-stage4.json` and `ATTRIBUTION.md`.

| Check | Result |
|---|---|
| No text, people, religious imagery or brand elements | PASS on visual review of all six final icons; sheet labels are separate. |
| Readable at 96px and distinguishable in greyscale | PASS: cheese ball/wedge, scored ham/slice, noodle mound, fruit bowl, round leaf-wrapped cake and diagonal purple rice bundle have distinct forms/details. Existing symbols remain approved and byte-identical. |
| Clean transparency on navy and light checkerboard | PASS visually; no visible halos or stray background. Native alpha, one-source-pixel erosion, near-opaque alpha normalization. |
| Consistent style, palette and lighting | PASS: thin navy contours, saturated food colors, warm top-front light and glossy gradients matching the approved H1 reference. |
| H1–H3 higher value than L1–L4 | Preserved from approved Stage 2; all symbol hashes unchanged. |
| Reel frame window exactly 1500x900, centered | PASS, rerun assertion at x100/y100 in 1700x1100 canvas. Frame hash unchanged. |
| Dark low-detail background centers | Preserved from approved Stage 3; hashes unchanged, central brightness and edge metrics rechecked. |
| File caps | PASS; no food-specific cap in brief, so applied stricter 40,000-byte UI target. Existing asset caps revalidated. |
| Dimensions, format and alpha | PASS: six 256x256 RGBA WebPs, centered at about 85% longest-side occupancy, transparent margins. All quality 80 / method 6. No reductions. |
| Total size | Six icons: 71,106 bytes (71.11 KB). Full 23-file WebP set: 1,009,408 bytes (1009.41 KB). Sources/review sheets excluded. |
| Approved assets and game/config preserved | PASS: all 59 baseline hashes matched, including 17 approved WebPs. No runtime integration. |
| Runnable processing/validation | PASS: `postprocess.py --stage 4` and `validate.py` completed successfully; evidence in `_review/processing-stage4.json` and `_review/verification-stage4.json`. |

| File | Dimensions | Bytes | Quality | Attempts |
|---|---|---:|---:|---:|
| icons/queso_de_bola.webp | 256x256 | 9,286 | 80 | 1 |
| icons/hamon.webp | 256x256 | 11,818 | 80 | 1 |
| icons/sweet_spaghetti.webp | 256x256 | 11,900 | 80 | 1 |
| icons/fruit_salad.webp | 256x256 | 11,810 | 80 | 1 |
| icons/bibingka.webp | 256x256 | 12,974 | 80 | 1 |
| icons/puto_bumbong.webp | 256x256 | 13,318 | 80 | 1 |

No rejected generations or export failures in Stage 4. Fine source texture merges
at 96px while dish forms remain readable. This is asset QA, not a new browser or
device performance result. Stage 4 is approved; integration is separate.

## Stage 3 — environment and UI delivery

Date: 2026-10-13. Stages 1–3 approved by the user.
Review: repository-root `_review/environment-sheet.png`. Two opaque backgrounds,
one transparent frame and four transparent UI pieces were generated and exported.

| Check | Result |
|---|---|
| No text, people, religious imagery or brand elements | PASS on visual inspection of all Stage 3 exports. UI centers are empty; contact-sheet labels are separate from the assets. |
| Symbols readable at 96px and distinguishable in greyscale | PASS from approved Stage 2 QA; all ten symbol WebPs are byte-identical. |
| Cutouts clean on dark navy and light checkerboard | PASS on final environment sheet: no visible magenta fringe or stray background. Frame/plaque use key removal and despill; other UI retains native transparency with cleaned near-opaque solids. |
| Consistent style, palette and lighting | PASS visually across backgrounds, frame, UI and approved symbols: warm gold/bamboo, navy, colorful capiz lanterns and glossy top-front light. |
| H1–H3 read as higher value than L1–L4 | PASS from approved Stage 2 QA; unchanged. |
| Centered 1500x900 frame window | PASS: exact alpha-clear cut region `(100,100)` to `(1600,1000)` on 1700x1100 canvas; all 1,350,000 pixels in that region have alpha 0. No solid decorative pixels were removed by the cut. Clear space between rails is preserved. |
| Background center dark and low-detail | PASS visually and by supporting center-crop metrics: mean luminance 16.00 vs 36.79 overall for landscape; 15.28 vs 32.12 for portrait (0–255 scale). Mean center edge response 0.33/0.37. |
| Per-file caps | PASS: backgrounds below 250,000 bytes, frame below 120,000, UI below 40,000. All symbols still below 45,000. |
| Dimensions, formats and alpha | PASS with allowed exceptions: all Stage 3 exports match requested dimensions except title ornament 768x288 under size-cap fallback. Two RGB opaque backgrounds; five RGBA cutouts. Previously approved H3 remains 448x448. |
| Total size reported | PASS: all 17 production WebPs total 938,302 bytes / 938.30 KB / 916.31 KiB. Stage 3 contributes 559,138 bytes. Sources, rejected attempts, reports and review PNGs are excluded. |

| Asset | Dimensions | Bytes | Quality / method | Attempts |
|---|---|---:|---|---:|
| bg_landscape | 1920x1080 | 193,256 | 80 / 6 | 1 |
| bg_portrait | 1080x1920 | 189,270 | 80 / 6 | 1 |
| reel_frame | 1700x1100 | 86,306 | 80 / 6 | 3 |
| spin_button | 384x384 | 28,900 | 80 / 6 | 1 |
| button_round | 256x256 | 13,668 | 80 / 6 | 1 |
| button_plaque | 512x192 | 9,884 | 80 / 6 | 3 |
| logo_ornament | 768x288 | 37,854 | 80 / 6 | 1 |

The frame's first attempt would lose large corners/inset rails at the prescribed
cut. The second corrected geometry but noisy diffuse alpha glows exceeded its
cap at quality 70. The selected third attempt uses flat magenta with light inside
the fixtures and crisp edges. Frame source aspect error is 0.087%, below 8%;
resize introduces no visible ornament distortion, so no 9-slice alternative
was needed. Frame sources for rejected attempts are retained for reference provenance.

The plaque's initial native-alpha image and one extraction edit retained broad
brown exterior haze; the selected third attempt uses flat magenta. Key colors
are removed with soft tolerance, despilled and eroded by one source pixel.
The other UI sources use native alpha. Near-opaque UI solids were normalized
from alpha >=240 to 255 to remove generated matte noise; softer edge coverage
and the transparent exterior remain. No hand-drawn art was substituted.

The title ornament still exceeded 40 KB at quality 70 at both 1024x384 and
896x336; the allowed fallback to 768x288 fits at quality 80. All other Stage 3
assets retain their requested sizes; no Stage 3 export is below quality 80.

The end-to-end Stage 3 processing command passed. `scripts/assets/validate.py`
checks the 17-entry manifest, files, dimensions, format/alpha, per-role caps,
frame cut and background centers. Evidence with individual SHA256 hashes is
saved in `_review/verification-stage3.json`; processing settings are in
`_review/processing-stage3.json`. All 52 baseline files (ten approved symbols,
game source and runtime/config files) have unchanged hashes.

Exact prompts, attempts, references, tool and date are in `ATTRIBUTION.md` and
`source/generation-stage3.json`. The tool did not expose the underlying model
identifier; it is recorded as unknown rather than inferred. No licensing claim
is made. The combined `manifest.json` contains only the 17 production exports.

This is asset-only QA, not browser/game integration verification. No game code,
math, runtime config or `src/assets.ts` changes. Stage 4 food icons were not
requested or generated. Next: review `_review/environment-sheet.png` and approve
or request revisions. Stop here; do not integrate or begin another stage without
the user's authorization.

## Stage 2 — approved symbol set (historical)

Date: 2026-10-13. Stage 1 was approved by the user. Stage 2 generated seven
additional symbols; all ten are shown in repository-root `_review/symbols-sheet.png`.
Previews show each export at native size on dark navy and light checkerboard,
plus 96x96 color, greyscale and light-background tests. Stage 2 was subsequently approved.

| Check | Result |
|---|---|
| No text, people, religious imagery or brands | PASS on visual inspection of all ten exports. Labels appear only on the review sheet. |
| Readable at 96px and distinguishable in greyscale | PASS visually: orb, diamond, eight-point burst, tasseled star, beaded hexagon, layered starburst, round sunburst, open bottle-cap ring and envelope silhouettes/details remain recognizable. L1 and H1 share a star but differ in tassel length and filigree. |
| Transparent assets clean on dark and light | PASS: native alpha, no visible halos or stray background on either preview. SCATTER's center remains transparent. |
| Consistent style, palette and lighting | PASS: approved L1/H1 style references, warm gold, navy outline and matching glossy illumination across the set. |
| H1–H3 read as higher value than L1–L4 | PASS: H1 filigree/long tassels, H2 pearl panes/beaded tassels, H3 nested rainbow stars/rays and rich tassels. |
| Exact centered 1500x900 frame window | NOT APPLICABLE: Stage 3 not started. |
| Dark, low-detail background center | NOT APPLICABLE: Stage 3 not started. |
| Every symbol below 45 KB | PASS: all below conservative 45,000-byte cap. |
| Dimensions, WebP format and alpha | PASS: nine 512x512 RGBA WebPs; H3 is 448x448 under the explicitly allowed size-cap fallback, above the 384px minimum. All have alpha range 0–255 and centered bounds. |
| Total production size | PASS: 379,164 bytes / 379.16 KB / 370.28 KiB for all ten; Stage 2 adds 272,338 bytes. |

| Asset | Bytes | Canvas | Quality / method | Attempts |
|---|---:|---|---|---:|
| L1 (approved) | 36,080 | 512x512 | 80 / 6 | 1 |
| L2 | 32,322 | 512x512 | 80 / 6 | 1 |
| L3 | 26,636 | 512x512 | 80 / 6 | 2 |
| L4 | 43,544 | 512x512 | 80 / 6 | 1 |
| H1 (approved) | 43,518 | 512x512 | 80 / 6 | 1 |
| H2 | 44,562 | 512x512 | 76 / 6 | 1 |
| H3 | 44,496 | 448x448 | 80 / 6 | 1 |
| WILD | 41,192 | 512x512 | 80 / 6 | 1 |
| SCATTER | 39,586 | 512x512 | 80 / 6 | 1 |
| COIN (approved) | 27,228 | 512x512 | 80 / 6 | 1 |

H2 quality was reduced to 76. H3 exceeded the cap at 512px even at quality 70;
the allowed fallback to 448px fits at quality 80. No other size or quality
reductions were needed. L3's first attempt had a concave outline and extra tassels;
the selected revision has a convex diamond body and bottom-only tassels. Exact
selected and rejected prompts are in `ATTRIBUTION.md` and `source/generation-stage2.json`.
All new sources are 1254x1254 RGBA PNGs from the built-in image generator;
the underlying model identifier was not exposed.

Processing and validation are in `scripts/assets/postprocess.py`; rebuild from
the repository root with `scripts/assets/.python/python.exe scripts/assets/postprocess.py`.
The manifest now contains all ten symbol exports. Per-file quality and alpha
bounds are recorded in `_review/processing.json`. SHA256 comparison confirmed
approved L1, H1 and COIN exports are unchanged. Review sheet native-size handling
was corrected to support H3's permitted dimension reduction.

Visual checks are art QA, not an in-game usability test. Game source, math,
runtime config and `src/assets.ts` were not changed. No Stage 3 art was generated.
Next: user reviews `_review/symbols-sheet.png`; wait for approval before Stage 3.
No licensing claim is made.

## Stage 1 — historical review

Date: 2026-10-13. Scope: L1, H1 and COIN only. Subsequently approved by the user.
Review sheet: repository-root `_review/style-lock.png` (512px canvases on navy
and light checkerboard, plus 96px color and greyscale previews).

| Check | Result |
|---|---|
| No text, people, religious imagery or brand elements | PASS for the three images, visually inspected. Review-sheet labels are outside the assets. |
| Readable at 96x96 and distinguishable in greyscale | PASS for Stage 1: COIN has an envelope silhouette; L1 has short fan tassels and simple panes; H1 has longer layered tassels and dense filigree. Both lanterns intentionally retain a five-point star shape. Full set awaits Stage 2. |
| Clean transparency on dark and light backgrounds | PASS: native alpha, no visible background remnants or key-color halos on review sheet. |
| Consistent style, palette and lighting | PASS: matching glossy gold frames, thin navy outlines and top-front highlights; L1 supplied as a style reference for H1 and COIN. |
| H1–H3 read as higher value than L1–L4 | PASS for H1 versus L1: richer filigree and longer tassels. Remaining symbols not generated. |
| Frame window exactly 1500x900, centered | NOT APPLICABLE until Stage 3. |
| Background center dark and low-detail | NOT APPLICABLE until Stage 3. |
| Every WebP under its cap | PASS: all below 45,000 bytes. No exceptions. |
| Dimensions, format and alpha match asset list | PASS: all 512x512 WebP, RGBA, alpha range 0–255. Script assertions passed. |
| Total size reported | PASS: 106,826 bytes / 106.83 KB / 104.32 KiB for the three production WebPs. |

| Asset | Bytes | Canvas | Quality / method | Attempts |
|---|---:|---|---|---:|
| L1 | 36,080 | 512x512 | 80 / 6 | 1 |
| H1 | 43,518 | 512x512 | 80 / 6 | 1 |
| COIN | 27,228 | 512x512 | 80 / 6 | 1 |

No regeneration, quality reduction or dimension reduction was needed. Sources
were 1254x1254 RGBA PNGs. Processing applies a one-source-pixel erosion, trims
the alpha bounds and centers each subject at approximately 85% of canvas height
(435 pixels before resampling fringes). Native alpha needed no chroma-key
removal or despill. Key-color fallback is supported by the processing script.

Original PNGs, review PNG, attribution and local Python tooling are excluded from
the production WebP total. The manifest currently lists only Stage 1 exports.
Exact prompts and reference provenance are preserved in `ATTRIBUTION.md` and
`source/generation.json`. The generator did not expose its underlying model name.

Tool availability: built-in image generation with native transparency available;
no usable system Python, ImageMagick or rembg found. A workspace-local Python
3.12.10 runtime with Pillow 12.3.0 and numpy 2.5.4 was installed; WebP supported.

Game source, math, client config and `src/assets.ts` were not edited. A later
approved integration would add critical symbol URL imports and BootScene loading;
that work is outside this asset-only stage. No runtime/build validation was needed
for unreferenced assets. No later-stage art was generated.

Stage 1 was approved; Stage 2 results and the current next step are above.
No licensing claim is made.
