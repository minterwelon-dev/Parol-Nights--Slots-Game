"""Package generated control layers: alpha-bounds trim, uniform resize and transparent padding."""
import hashlib
import json
from pathlib import Path
from PIL import Image

THEME = Path(__file__).resolve().parents[2] / 'Assets/theme/parol-nights'
LAYERS = {'spin_arrows': 156, 'spin_star': 76, 'stop_icon': 60}
rows = []
for name, extent in LAYERS.items():
    source = THEME / 'source/spin-controls' / f'{name}.png'
    with Image.open(source) as raw:
        assert 'A' in raw.getbands(), f'No generated alpha: {name}'
        image = raw.convert('RGBA')
        assert image.getchannel('A').getextrema() == (0, 255)
        box = image.getchannel('A').getbbox()
        cropped = image.crop(box)
        cropped.thumbnail((extent, extent), Image.Resampling.LANCZOS)
        out = Image.new('RGBA', (256, 256))
        out.alpha_composite(cropped, ((256 - cropped.width) // 2, (256 - cropped.height) // 2))
        target = THEME / 'ui' / f'{name}.webp'
        out.save(target, 'WEBP', quality=90, method=6)
    rows.append(dict(id=name, file=f'ui/{name}.webp', width=256, height=256,
                     hasAlpha=True, bytes=target.stat().st_size, role='ui',
                     source=f'source/spin-controls/{name}.png',
                     sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                     operation=f'Alpha bounds {box}; uniform fit to {extent}px; centered on transparent 256px canvas; WebP q90'))
(THEME / 'source/spin-controls/processing.json').write_text(json.dumps(rows, indent=2) + '\n')
manifest = json.loads((THEME / 'manifest.json').read_text())
manifest = [row for row in manifest if row['id'] not in LAYERS]
manifest.extend({key: row[key] for key in ['id', 'file', 'width', 'height', 'hasAlpha', 'bytes', 'role']} for row in rows)
(THEME / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(rows, indent=2))
