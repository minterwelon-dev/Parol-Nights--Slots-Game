"""Validate Parol Nights deliverables and preserve Stage 3 evidence."""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from postprocess import ENVIRONMENT, FOOD_IDS, IDS, REVIEW, ROOT, THEME

rows = json.loads((THEME / 'manifest.json').read_text(encoding='utf-8'))
stage = 4 if any(row['role'] == 'icon' for row in rows) else 3
assert {row['id'] for row in rows} == set(IDS) | {spec[0] for spec in ENVIRONMENT} | (set(FOOD_IDS) if stage == 4 else set())
assert len(rows) == (23 if stage == 4 else 17)
caps = {'symbol': 45_000, 'background': 250_000, 'frame': 120_000, 'ui': 40_000, 'icon': 40_000}
files = []
for row in rows:
    path = THEME / row['file']
    payload = path.read_bytes()
    assert len(payload) == row['bytes'] <= caps[row['role']]
    with Image.open(path) as image:
        assert image.format == 'WEBP' and image.size == (row['width'], row['height'])
        assert (image.mode == 'RGBA') == row['hasAlpha']
        if row['role'] == 'symbol':
            assert image.width == image.height and 384 <= image.width <= 512
        elif row['role'] == 'icon':
            assert image.size == (256, 256)
            alpha = image.getchannel('A')
            box = alpha.getbbox()
            assert alpha.getextrema() == (0, 255) and box
            assert 0 < box[0] < box[2] < 256 and 0 < box[1] < box[3] < 256
            assert max(box[2] - box[0], box[3] - box[1]) <= 222
            assert abs((box[0] + box[2]) / 2 - 128) <= 2
            assert abs((box[1] + box[3]) / 2 - 128) <= 2
        else:
            spec = next(spec for spec in ENVIRONMENT if spec[0] == row['id'])
            sizes = {(round(spec[2] * factor), round(spec[3] * factor)) for factor in ((1, 0.875, 0.75) if row['role'] == 'ui' else (1,))}
            assert image.size in sizes
        if row['hasAlpha']:
            assert image.getchannel('A').getextrema()[0] == 0
        if row['id'] == 'reel_frame':
            assert image.size == (1700, 1100)
            assert image.getchannel('A').crop((100, 100, 1600, 1000)).getextrema() == (0, 0)
    files.append(dict(id=row['id'], bytes=len(payload), sha256=hashlib.sha256(payload).hexdigest()))

baseline = json.loads((REVIEW / f'stage{stage}-baseline.json').read_text(encoding='utf-8-sig'))
for relative, digest in baseline.items():
    assert hashlib.sha256((ROOT / relative).read_bytes()).hexdigest() == digest, relative
backgrounds = []
for asset_id in ('bg_landscape', 'bg_portrait'):
    row = next(row for row in rows if row['id'] == asset_id)
    with Image.open(THEME / row['file']) as image:
        grey = image.convert('L')
        bounds = (round(image.width * 0.3), round(image.height * 0.3), round(image.width * 0.7), round(image.height * 0.7))
        center = grey.crop(bounds)
        backgrounds.append(dict(id=asset_id, centerBounds=bounds,
            centerMeanLuma=round(float(np.array(center).mean()), 2),
            wholeMeanLuma=round(float(np.array(grey).mean()), 2),
            centerMeanEdge=round(float(np.array(center.filter(ImageFilter.FIND_EDGES))[1:-1, 1:-1].mean()), 2)))
        assert np.array(center).mean() < np.array(grey).mean(), 'Center should be darker than environment overall'

result = dict(files=files, totalBytes=sum(row['bytes'] for row in rows),
    stage3Bytes=sum(row['bytes'] for row in rows if row['role'] in ('background', 'frame', 'ui')),
    stage4Bytes=sum(row['bytes'] for row in rows if row['role'] == 'icon'),
    baselineFilesUnchanged=len(baseline), frameWindow=dict(x=100, y=100, width=1500, height=900),
    backgrounds=backgrounds)
(REVIEW / f'verification-stage{stage}.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: value for key, value in result.items() if key != 'files'}, indent=2))
