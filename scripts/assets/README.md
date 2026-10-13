# Parol Nights asset processing (Stages 1–4)

Stage 4 food rebuild (preserves the 17 approved Stage 1–3 WebPs):

```powershell
& '.\scripts\assets\.python\python.exe' '.\scripts\assets\postprocess.py' --stage 4
& '.\scripts\assets\.python\python.exe' '.\scripts\assets\validate.py'
```

Inputs: six food PNGs under `Assets/theme/parol-nights/source/`, listed in
`generation-stage4.json`. Outputs: `icons/*.webp` (256x256 native-alpha cutouts),
combined 23-file manifest, `_review/food-sheet.png`, `_review/processing-stage4.json`.
Reuses alpha erosion, trimming and 85%-occupancy centering. Near-opaque source
alpha >=240 is normalized to 255, retaining soft edges. Quality 80 / method 6;
quality fallback stops at 70. All current icons fit at 80, no dimension reduction.
Since the brief has no food-specific cap, these use a conservative 40,000-byte target.
Validator detects Stage 4, checks the six icons and prior assets, and verifies
59 file hashes against `_review/stage4-baseline.json` (UTF-8 with BOM), then writes
`_review/verification-stage4.json`. Run Stage 4 last after any earlier-stage rebuild
to restore the full manifest. Do not refresh historical baselines to hide changes.

From the repository root, rerun with the workspace-local Python runtime:

```powershell
& '.\scripts\assets\.python\python.exe' '.\scripts\assets\postprocess.py'
```

Or use Python 3.12+ with `pip install -r scripts/assets/requirements.txt`, then
`python scripts/assets/postprocess.py`.

Inputs: the ten symbol PNGs under `Assets/theme/parol-nights/source/`.
Outputs: seven Stage 2 WebPs, the ten-symbol manifest, `_review/style-lock.png`,
`_review/symbols-sheet.png`, and `_review/processing.json`. Approved L1, H1 and
COIN exports are retained byte-for-byte. Native alpha is preserved with a one-source-pixel
erosion. Optional `--key L1=FF00FF` supports key-color sources with soft removal
and edge despill. Source art and exact generation prompts are preserved for
reprocessing and later approved style references.

The local `.python/` runtime is ignored by git; no Python install is made globally.

Stage 3 environment/UI rebuild (retains all ten approved symbols):

```powershell
& '.\scripts\assets\.python\python.exe' '.\scripts\assets\postprocess.py' --stage 3
```

Sources: `bg_landscape.png`, `bg_portrait.png`, `reel_frame.png`, `spin_button.png`,
`button_round.png`, `button_plaque.png`, and `logo_ornament.png` in the theme's
`source/` directory. The frame and plaque use a flat magenta key; the other
cutouts have native alpha. Outputs: two backgrounds, exact-window frame, four UI WebPs,
the combined 17-file manifest, `_review/processing-stage3.json` and
`_review/environment-sheet.png`. UI subjects are fit uniformly inside their
requested canvases. The frame preserves source framing, checks aspect error
against 8%, and cuts exactly `(100,100)` through `(1600,1000)` (exclusive upper bounds).

The default Stage 2 command rebuilds symbol exports/manifest. Run Stage 3 last
to produce the combined final manifest after rebuilding both stages.

Validate the combined delivery and write `_review/verification-stage3.json`:

```powershell
& '.\scripts\assets\.python\python.exe' '.\scripts\assets\validate.py'
```

The validator checks all 17 manifest entries, formats/dimensions/alpha, caps, the
exact frame cut and background-center brightness. It compares runtime/config
and approved-symbol hashes against `_review/stage3-baseline.json`. That baseline
is historical Stage 3 evidence; after intentional game changes it should not be
used as a claim that the runtime is unchanged.

Stage 3 UI processing normalizes near-opaque native-alpha solids (alpha >=240)
to 255 while preserving softer edge coverage. The title ornament uses the allowed
dimension fallback to 768x288; other Stage 3 dimensions match the requested sizes.
