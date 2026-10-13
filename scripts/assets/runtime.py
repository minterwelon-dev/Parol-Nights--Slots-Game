"""Create logged runtime copies; never modify approved art.

Backgrounds get a slight blur and a darker top band so the title ornament, corner buttons and
reels read clearly over the busy lantern art. Tune BG_BLUR / BG_TOP_DIM / BG_TOP_SPAN below.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
THEME = ROOT / 'Assets/theme/parol-nights'
BG_BLUR = 3.0  # Gaussian radius in runtime pixels (1280 / 720 copies)
BG_TOP_DIM = 0.3  # brightness removed at the top edge, fading to none at BG_TOP_SPAN
BG_TOP_SPAN = 0.45  # fraction of the height the top darkening covers


def soften(image):
    image = image.convert('RGB').filter(ImageFilter.GaussianBlur(BG_BLUR))
    w, h = image.size
    span = int(h * BG_TOP_SPAN)
    # 0 = untouched, 255 = black; linear ramp from BG_TOP_DIM at the top to 0 at span
    ramp = Image.new('L', (1, h), 0)
    for y in range(span):
        ramp.putpixel((0, y), round(255 * BG_TOP_DIM * (1 - y / span)))
    return Image.composite(Image.new('RGB', (w, h)), image, ramp.resize((w, h)))


rows = json.loads((THEME / 'manifest.json').read_text())
report = []
for row in rows:
    if row['role'] not in ('symbol', 'background'):
        continue
    source = THEME / row['file']
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    bg = row['role'] == 'background'
    size = (320, 320) if not bg else ((1280, 720) if row['width'] > row['height'] else (720, 1280))
    dest = THEME / 'runtime' / row['file']
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        out = image.resize(size, Image.Resampling.LANCZOS)
        if bg:
            out = soften(out)
        out.save(dest, 'WEBP', quality=80, method=6)
    with Image.open(dest) as result:
        assert result.size == size and result.format == 'WEBP'
        assert ('A' in result.getbands()) == row['hasAlpha']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == digest
    op = 'Lanczos resize only'
    if bg:
        op = f'Lanczos resize, Gaussian blur {BG_BLUR}, top {BG_TOP_SPAN:.0%} darkened up to {BG_TOP_DIM:.0%}'
    report.append(dict(source=row['file'], sourceSha256=digest, file=dest.relative_to(THEME).as_posix(),
        width=size[0], height=size[1], bytes=dest.stat().st_size, quality=80, method=6, operation=op))
(THEME / 'runtime/manifest.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
