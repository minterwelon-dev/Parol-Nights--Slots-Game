"""Create logged runtime resize copies; never modify approved art."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
THEME = ROOT / 'Assets/theme/parol-nights'
rows = json.loads((THEME / 'manifest.json').read_text())
report = []
for row in rows:
    if row['role'] not in ('symbol', 'background'):
        continue
    source = THEME / row['file']
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    size = (320, 320) if row['role'] == 'symbol' else ((1280, 720) if row['width'] > row['height'] else (720, 1280))
    dest = THEME / 'runtime' / row['file']
    dest.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.resize(size, Image.Resampling.LANCZOS).save(dest, 'WEBP', quality=80, method=6)
    with Image.open(dest) as result:
        assert result.size == size and result.format == 'WEBP'
        assert ('A' in result.getbands()) == row['hasAlpha']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == digest
    report.append(dict(source=row['file'], sourceSha256=digest, file=dest.relative_to(THEME).as_posix(),
        width=size[0], height=size[1], bytes=dest.stat().st_size, quality=80, method=6, operation='Lanczos resize only'))
(THEME / 'runtime/manifest.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
