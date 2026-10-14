# Codex Prompt: Generate "Parol Nights" Slot Assets

> How to use: save this file in the slot repo root, then tell Codex: **"Read CODEX_ASSET_PROMPT.md and follow it. Start with Stage 1 and stop for my review."**

---

## Role and goal

You are helping me produce the art for a **play-money portfolio slot game** called **Parol Nights**, a Filipino Christmas lantern theme. The game is Phaser 3 + TypeScript + Vite. Use your **image generation capability** to create the assets listed below, then post-process them with scripts into game-ready WebP files.

**Scope:** art assets only. Do **not** change game code, math or config. If a theme or asset manifest file already exists in the repo, tell me what you would add, but ask before editing it.

**If you do not have an image generation tool in this environment, say so and stop.** Do not substitute procedural or hand-coded art unless I ask for it.

## Before you start

1. Read `AGENTS.md` (and any asset rules in it) and follow them. Defaults if it does not say otherwise: WebP images, reference resolutions 1920x1080 (landscape) and 1080x1920 (portrait), assets go under `Assets/theme/parol-nights/`.
2. Check which tools are available: image generation, Python with Pillow and numpy, ImageMagick, `rembg` (may be unavailable offline). Tell me what you found in one short list.
3. Create `scripts/assets/` for post-processing scripts and `_review/` for contact sheets.

## Staged workflow (stop at the end of each stage)

### Stage 1: Style lock (3 assets only)
Generate **L1**, **H1** and **COIN** (see the asset list). Post-process them, build `_review/style-lock.png` (the three assets side by side on a dark navy background and on a light checkerboard), then **stop and summarize**. I will approve or ask for changes before you continue. Do not generate anything else yet.

### Stage 2: Remaining symbols
Generate the other 7 symbols (L2, L3, L4, H2, H3, WILD, SCATTER). Use the approved Stage 1 images as the style reference if your tool supports reference or edit input. Build `_review/symbols-sheet.png` showing all 10 symbols at full size and at 96x96. Stop and summarize.

### Stage 3: Backgrounds, frame and UI
Generate the backgrounds, reel frame and UI pieces. Build `_review/environment-sheet.png`. Stop and summarize.

### Stage 4 (optional, only if I ask): food icons
Six small icons for the Free Spins "table filling up" visual.

### Final delivery
`manifest.json`, `ATTRIBUTION.md` and a `QA_REPORT.md` (see "Deliverables").

## Style bible (apply to every asset)

**Look:** polished 2D mobile slot-game art in a stylized vector-illustration style. Soft gradients, subtle glossy highlights, clean thin dark-navy outline, warm light glowing from inside each lantern. Filipino Christmas **parol** (star lantern) aesthetic: bamboo frame, colored capiz-shell or cellophane panels, tassels.

**Composition:** front view, centered, symmetrical, strong readable silhouette, no cast shadow, no ground, no scene.

**Palette** (use as a guide, not exact):
- Night navy `#0B1033`, deep indigo `#1B1F5E`
- Lantern gold `#FFC94A`, warm amber `#FF9F1C`
- Parol red `#E63946`, emerald `#1FB981`, sapphire `#2F6FED`, amethyst `#8E44AD`, tangerine `#FF7A1A`
- Pearl white `#FFF6E0`

**Hard exclusions (all assets):**
- No text, letters, numbers, logos or watermarks inside any image (labels and values are drawn in code later)
- No people, faces or hands
- No religious imagery (no nativity scenes, saints, crosses, halos)
- No brand names, no existing characters, no references to existing slot games
- Do not imitate any specific existing slot or casino game's art

**Readability:** every symbol must be recognizable at 96x96 pixels and distinguishable in greyscale (distinct silhouette or clearly different detail), not only by color.

## Shared prompt prefix

Use this as the start of every symbol prompt, then add the asset-specific description. Replace `{KEY}` with a flat key color that does **not** appear in the subject (see "Transparency").

```
Polished 2D mobile slot-game icon in a stylized vector-illustration look, soft gradients,
subtle glossy highlights, clean thin dark-navy outline, warm glow radiating from inside.
Filipino Christmas parol aesthetic: bamboo frame, colored capiz-shell or cellophane panels,
tassels. Front view, perfectly centered, symmetrical, strong readable silhouette, no cast
shadow, no ground. No text, no letters, no numbers, no watermark, no people, no faces, no
religious symbols. The subject sits on a perfectly flat solid {KEY} background with no
gradient, no vignette, no texture.
```

## Asset list

### Symbols (transparent WebP, 512x512 canvas, subject fills about 85% of the canvas, centered)

| ID | File | Description to append to the prefix | Distinct silhouette |
|---|---|---|---|
| L1 | `symbols/L1.webp` | Five-pointed star parol with emerald green panels, gold bamboo frame, short golden tassels at the tips. Simple, clean design. | 5-point star |
| L2 | `symbols/L2.webp` | Round orb-shaped parol with sapphire blue panels and gold ribs, one small tassel at the bottom. Simple, clean design. | Circle |
| L3 | `symbols/L3.webp` | Diamond (kite) shaped parol with amethyst purple panels, gold frame, tassels at the bottom corner. Simple, clean design. | Diamond |
| L4 | `symbols/L4.webp` | Eight-pointed snowflake-like parol with tangerine orange panels and a gold frame. Simple, clean design. | 8-point burst |
| H1 | `symbols/H1.webp` | Ornate five-pointed star parol, deep red panels with intricate gold filigree, long flowing gold tassels, rich warm glow. More detailed than the low symbols. | Large tasseled star |
| H2 | `symbols/H2.webp` | Hexagonal capiz-shell parol with translucent pearl-white shell panes, teal inner glow, silver-gold frame, delicate beaded tassels. | Hexagon |
| H3 | `symbols/H3.webp` | Grand layered giant parol with several nested gold star layers, rainbow-colored inner lights, sunburst rays, extra tassels. The richest and most spectacular symbol. | Layered starburst |
| WILD | `symbols/WILD.webp` | Radiant white-gold sunburst lantern, blazing pearl-white core with golden rays and sparkles, the brightest symbol. | Round sunburst |
| SCATTER | `symbols/SCATTER.webp` | A Filipino caroling tambourine (pandereta) made of flattened bottle caps threaded on a round wooden hoop, with a festive red-and-gold ribbon, shiny metallic caps, warm glow. | Ring with caps |
| COIN | `symbols/COIN.webp` | A red aguinaldo gift envelope with a gold ornamental border and a golden coin partly emerging from the top. No text on the envelope. | Envelope |

### Environment (opaque WebP unless noted)

| File | Size | Description |
|---|---|---|
| `bg/bg_landscape.webp` | 1920x1080 | Wide night-time Filipino neighborhood street at Christmas. Strings of glowing colorful parol lanterns and bunting overhead, soft bokeh lights, deep navy starry sky, simple house silhouettes. **The center area must be darker and low in detail** so the reels stay readable. No people, no text. |
| `bg/bg_portrait.webp` | 1080x1920 | Same scene composed vertically: lanterns and bunting concentrated at the top, soft bokeh, calm darker middle. Same palette and style as the landscape version. |
| `frame/reel_frame.webp` (transparent) | 1700x1100 | Ornate rectangular frame made of bamboo and gold with small glowing parol lights along the edges and star-lantern ornaments in the corners. After generation, **cut an exact transparent window of 1500x900 centered** with a script. |

### UI (transparent WebP)

| File | Size | Description |
|---|---|---|
| `ui/spin_button.webp` | 384x384 | Round glowing star-orb button, gold rim, warm light, **no icon or text** |
| `ui/button_round.webp` | 256x256 | Round gold bamboo-rimmed button base, neutral dark-blue interior (will be tinted in code), **no icon** |
| `ui/button_plaque.webp` | 512x192 | Rounded rectangular plaque with bamboo-gold border and a neutral dark interior (used for buttons and jackpot panels, tinted in code), **no text** |
| `ui/logo_ornament.webp` | 1024x384 | A decorative banner: ribbon and small parol ornaments with an **empty center** where the title text will be drawn in code. **No text.** |

### Optional Stage 4: food icons (transparent WebP, 256x256)
`icons/queso_de_bola.webp`, `icons/hamon.webp`, `icons/sweet_spaghetti.webp`, `icons/fruit_salad.webp`, `icons/bibingka.webp`, `icons/puto_bumbong.webp`. Same style prefix, simplified for small size.

### Do NOT generate (create these in code instead)
Glow, sparkle and particle textures, highlight sweeps, win-line graphics, palette variants (tint the base images), any text.

## Transparency and post-processing

Image generators rarely give clean transparency. Use this process and verify it visually.

1. **Prefer native transparency** if your tool supports a transparent background.
2. Otherwise generate on a flat key color. Choose the key color **per asset** so it does not appear in the subject (rule of thumb: its hue differs by more than 40 degrees from the subject's dominant colors). Magenta, cyan and pure green are the usual options.
3. Write `scripts/assets/postprocess.py` (Pillow + numpy) that, for each transparent asset:
   - removes the key color with a tolerance, **despills** the edge (removes key-color fringing), and erodes the edge by about 1 px;
   - trims to the alpha bounding box, then scales so the longest side is about 85% of the 512 canvas (symbols) and centers it;
   - exports WebP at quality about 80 (method 6), keeping alpha.
4. For the **reel frame**, resize to 1700x1100 with Pillow and cut the exact 1500x900 center window. If the resize visibly distorts the ornaments (aspect error above about 8%), do not stretch: tell me and propose a 9-slice approach using corners plus an edge strip.
5. Inspect every transparent asset on both a dark navy and a white checkerboard. No halos, no stray background pixels.

## Size caps (per file, WebP)

| Asset type | Cap |
|---|---|
| Symbols | 45 KB |
| Backgrounds | 250 KB |
| Reel frame | 120 KB |
| UI pieces | 40 KB |

If a file exceeds its cap, lower quality (not below 70), then reduce dimensions (symbols not below 384 px), and report it. Do not worry about the overall total, but report it.

## Consistency rules

- Use the **same prefix and palette** for every symbol; reuse approved images as style references where possible.
- Same light direction (soft top-front light, warm inner glow) and the same outline weight across all symbols.
- High-pay symbols (H1 to H3) must look clearly richer and more detailed than the low-pay ones (L1 to L4), without becoming unreadable at 96 px.
- If an image contains text-like artifacts, extra objects or a cropped subject, regenerate it. Keep a short note of how many attempts each asset took.

## Deliverables

1. All assets under `Assets/theme/parol-nights/` using the paths above.
2. `Assets/theme/parol-nights/manifest.json`, one entry per file:
   ```json
   { "id": "L1", "file": "symbols/L1.webp", "width": 512, "height": 512,
     "hasAlpha": true, "bytes": 0, "role": "symbol" }
   ```
3. `scripts/assets/postprocess.py` and any helper scripts, runnable again with one command.
4. `_review/` contact sheets for each stage.
5. `Assets/theme/parol-nights/ATTRIBUTION.md`: for each asset, the generation tool and model name, date, exact prompt, and any reference image used. I will check the tool's license terms for commercial and portfolio use myself; do not claim anything about licensing.
6. `QA_REPORT.md` with a checklist and result for each item:
   - [ ] No text, people, religious imagery or brand elements in any asset
   - [ ] Every symbol is readable at 96x96 and distinguishable in greyscale
   - [ ] Transparent assets are clean on dark and light backgrounds (no halos)
   - [ ] Consistent style, palette and lighting across the set
   - [ ] H1 to H3 read as higher value than L1 to L4
   - [ ] Reel frame window is exactly 1500x900, centered
   - [ ] Background center area is dark and low-detail
   - [ ] Every file is under its size cap (list any exceptions)
   - [ ] Dimensions, formats and alpha match the asset list
   - [ ] Total size reported

## Rules

- Do not invent extra assets or change the asset list without asking.
- Do not modify game code or config.
- Do not use or imitate existing slot or casino game art, characters or titles.
- Keep the content suitable for a general audience.
- Stop after each stage and summarize what you generated, what failed, and what you need from me.

## Level 1 animation layers (H3 / WILD slice, 2026-10-14)

Implemented from ANIMATION_SPEC section 5 using the approved H3/WILD images as edit references.
- `parts/H3_outer.webp`, `H3_inner.webp`, `H3_core.webp`: outer frame/fringe, stained-glass medallion, luminous core.
- `parts/WILD_rays.webp`, `WILD_core.webp`: rays/rim and central disc.

All exports use a 512x512 transparent canvas; align centers and leave rotation clearance.
Reconstruct concealed artwork instead of leaving accidental holes. Preserve original flat symbols
for spin blur and failed-download fallback. Exact generation prompts and original PNGs are under
`Assets/theme/parol-nights/source/layered/`. Re-export: `node tools/export-layered.mjs`.
Independent tassels and SCATTER caps are a later slice. Runtime integration was explicitly
requested for this slice and is implemented; the original art-only stages above remain historical.

### Completed next slice: tassels and SCATTER (2026-10-14)

User authorized implementation of the next step. Generated clean L1-L4/H1/H2 bodies, shared gold
tassel, H2 beaded tassel (preserves the delivered detail), clean pandereta hoop and separate cap.
L4's delivered art has eight tassels, so it is included despite its older description above.
Exact prompts, PNGs and per-file export manifest: `Assets/theme/parol-nights/source/layered/`.
Export: `node tools/export-layered.mjs --next`. Runtime and browser checks are complete;
H3 retains its previous rotating frame/tassels. Spine remains optional.
