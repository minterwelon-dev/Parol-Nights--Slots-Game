"""Rebuild symbol exports and review sheets from preserved generated PNGs."""
import argparse
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
THEME = ROOT / 'Assets/theme/parol-nights'
REVIEW = ROOT / '_review'
STAGE1 = ('L1', 'H1', 'COIN')
IDS = ('L1', 'L2', 'L3', 'L4', 'H1', 'H2', 'H3', 'WILD', 'SCATTER', 'COIN')
CAP = 45_000  # Conservative decimal KB.
FOOD_IDS = ('queso_de_bola', 'hamon', 'sweet_spaghetti', 'fruit_salad', 'bibingka', 'puto_bumbong')
NAVY = '#0B1033'
ENVIRONMENT = (
    ('bg_landscape', 'bg/bg_landscape.webp', 1920, 1080, False, 250_000, 'background'),
    ('bg_portrait', 'bg/bg_portrait.webp', 1080, 1920, False, 250_000, 'background'),
    ('reel_frame', 'frame/reel_frame.webp', 1700, 1100, True, 120_000, 'frame'),
    ('spin_button', 'ui/spin_button.webp', 384, 384, True, 40_000, 'ui'),
    ('button_round', 'ui/button_round.webp', 256, 256, True, 40_000, 'ui'),
    ('button_plaque', 'ui/button_plaque.webp', 512, 192, True, 40_000, 'ui'),
    ('logo_ornament', 'ui/logo_ornament.webp', 1024, 384, True, 40_000, 'ui'),
)


def clean_alpha(image, key=None, trim=True):
    pixels = np.array(image.convert('RGBA'))
    if key is not None:
        # Soft key removal and unmatting remove key-colored edge spill.
        rgb = pixels[:, :, :3].astype(float)
        color = np.array(key, dtype=float)
        distance = np.linalg.norm(rgb - color, axis=2)
        coverage = np.clip((distance - 35) / 65, 0, 1)
        alpha = pixels[:, :, 3] / 255 * coverage
        edge = (coverage > 0) & (coverage < 1)
        unmatte = (rgb - (1 - coverage[:, :, None]) * color) / np.maximum(coverage[:, :, None], 0.01)
        pixels[edge, :3] = np.clip(unmatte[edge], 0, 255).astype(np.uint8)
        pixels[:, :, 3] = np.round(alpha * 255).astype(np.uint8)
    result = Image.fromarray(pixels)
    # One source-pixel erosion; native-alpha inputs require no color despill.
    alpha = result.getchannel('A').filter(ImageFilter.MinFilter(3))
    alpha = alpha.point(lambda value: 0 if value < 4 else value)
    result.putalpha(alpha)
    box = alpha.getbbox()
    if box is None:
        raise ValueError('No subject pixels remain')
    return result.crop(box) if trim else result


def centered(subject, size):
    target = round(size * 0.85)
    ratio = target / max(subject.size)
    scaled = subject.resize(tuple(round(side * ratio) for side in subject.size), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (size, size))
    canvas.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    data = np.array(canvas)
    data[data[:, :, 3] == 0, :3] = 0
    return Image.fromarray(data)


def export(subject, destination):
    for size in (512, 448, 384):
        image = centered(subject, size)
        for quality in (80, 78, 76, 74, 72, 70):
            buffer = io.BytesIO()
            image.save(buffer, 'WEBP', quality=quality, method=6, exact=True)
            if buffer.tell() <= CAP:
                destination.write_bytes(buffer.getvalue())
                return size, quality
    raise ValueError(f'{destination.name} exceeds cap at minimum permitted quality and size')


def font(size):
    path = Path('C:/Windows/Fonts/arial.ttf')
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default(size=size)


def checkerboard(size):
    tile = Image.new('RGBA', size, '#FFFFFF')
    draw = ImageDraw.Draw(tile)
    for y in range(0, size[1], 24):
        for x in range(0, size[0], 24):
            if (x // 24 + y // 24) % 2:
                draw.rectangle((x, y, x + 23, y + 23), fill='#E0E3E9')
    return tile


def contact_sheet():
    # Top two rows retain 512px canvases; bottom row shows 96px color/greyscale.
    sheet = Image.new('RGBA', (1616, 1390), NAVY)
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 16), 'PAROL NIGHTS / STAGE 1 STYLE LOCK', font=font(26), fill='#FFF6E0')
    for index, symbol in enumerate(STAGE1):
        image = Image.open(THEME / f'symbols/{symbol}.webp').convert('RGBA')
        image = image.resize((512, 512), Image.Resampling.LANCZOS)
        x = 24 + index * 532
        draw.text((x, 62), f'{symbol} / dark navy', font=font(22), fill='#FFC94A')
        sheet.alpha_composite(image, (x, 100))
        draw.text((x, 632), f'{symbol} / light checkerboard', font=font(22), fill='#FFC94A')
        sheet.alpha_composite(checkerboard((512, 512)), (x, 670))
        sheet.alpha_composite(image, (x, 670))
        small = image.resize((96, 96), Image.Resampling.LANCZOS)
        grey = ImageOps.grayscale(small).convert('RGBA')
        grey.putalpha(small.getchannel('A'))
        draw.text((x, 1202), '96px: color / greyscale / light', font=font(20), fill='#FFF6E0')
        sheet.alpha_composite(small, (x + 36, 1240))
        sheet.alpha_composite(grey, (x + 204, 1240))
        sheet.alpha_composite(checkerboard((96, 96)), (x + 372, 1240))
        sheet.alpha_composite(small, (x + 372, 1240))
    REVIEW.mkdir(exist_ok=True)
    sheet.convert('RGB').save(REVIEW / 'style-lock.png')


def symbols_sheet():
    # Preview exports at their native size, including any cap-driven reduction.
    sheet = Image.new('RGBA', (2688, 2690), NAVY)
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 16), 'PAROL NIGHTS / STAGE 2 / ALL SYMBOLS', font=font(28), fill='#FFF6E0')
    for index, symbol in enumerate(IDS):
        x, y = 24 + (index % 5) * 532, 70 + (index // 5) * 1300
        with Image.open(THEME / f'symbols/{symbol}.webp') as asset:
            image = asset.convert('RGBA')
        assert image.width == image.height and 384 <= image.width <= 512
        offset = (512 - image.width) // 2
        draw.text((x, y), f'{symbol} / {image.width}px dark navy', font=font(22), fill='#FFC94A')
        sheet.alpha_composite(image, (x + offset, y + 38 + offset))
        draw.text((x, y + 568), f'{image.width}px light checkerboard', font=font(22), fill='#FFC94A')
        sheet.alpha_composite(checkerboard((512, 512)), (x, y + 606))
        sheet.alpha_composite(image, (x + offset, y + 606 + offset))
        small = image.resize((96, 96), Image.Resampling.LANCZOS)
        grey = ImageOps.grayscale(small).convert('RGBA')
        grey.putalpha(small.getchannel('A'))
        draw.text((x, y + 1140), '96px: color / greyscale / light', font=font(20), fill='#FFF6E0')
        sheet.alpha_composite(small, (x + 36, y + 1176))
        sheet.alpha_composite(grey, (x + 204, y + 1176))
        sheet.alpha_composite(checkerboard((96, 96)), (x + 372, y + 1176))
        sheet.alpha_composite(small, (x + 372, y + 1176))
    sheet.convert('RGB').save(REVIEW / 'symbols-sheet.png')


def environment_sheet():
    sheet = Image.new('RGBA', (2100, 3100), NAVY)
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 18), 'PAROL NIGHTS / STAGE 3 / ENVIRONMENT AND UI', font=font(30), fill='#FFF6E0')
    for asset_id, position, preview_size in (
        ('bg_landscape', (24, 90), (1152, 648)),
        ('bg_portrait', (1280, 90), (648, 1152)),
    ):
        spec = next(row for row in ENVIRONMENT if row[0] == asset_id)
        image = Image.open(THEME / spec[1]).convert('RGBA')
        draw.text((position[0], position[1] - 28), f'{asset_id} / {image.width}x{image.height}', font=font(20), fill='#FFC94A')
        sheet.alpha_composite(image.resize(preview_size, Image.Resampling.LANCZOS), position)
    frame = Image.open(THEME / 'frame/reel_frame.webp').convert('RGBA')
    draw.text((24, 1354), 'reel_frame / 1700x1100 / cut window 1500x900 / navy + light', font=font(22), fill='#FFC94A')
    for x, background in ((24, Image.new('RGBA', (1020, 660), NAVY)), (1056, checkerboard((1020, 660)))):
        background.alpha_composite(frame.resize((1020, 660), Image.Resampling.LANCZOS))
        sheet.alpha_composite(background, (x, 1400))
    ui_positions = (
        ('spin_button', (24, 2120)), ('button_round', (456, 2120)),
        ('button_plaque', (24, 2570)), ('logo_ornament', (24, 2830)),
    )
    for asset_id, (x, y) in ui_positions:
        spec = next(row for row in ENVIRONMENT if row[0] == asset_id)
        image = Image.open(THEME / spec[1]).convert('RGBA')
        draw.text((x, y - 30), f'{asset_id} / {image.width}x{image.height}', font=font(20), fill='#FFC94A')
        # Logo is half-size; other UI previews are native-size.
        if asset_id == 'logo_ornament':
            image = image.resize((512, 192), Image.Resampling.LANCZOS)
        if asset_id in ('spin_button', 'button_round'):
            sheet.alpha_composite(image, (x, y))
            light_x = x + 1120
            sheet.alpha_composite(checkerboard(image.size), (light_x, y))
            sheet.alpha_composite(image, (light_x, y))
        else:
            sheet.alpha_composite(image, (x, y))
            light_y = y
            light_x = x + 700
            sheet.alpha_composite(checkerboard(image.size), (light_x, light_y))
            sheet.alpha_composite(image, (light_x, light_y))
    sheet.convert('RGB').save(REVIEW / 'environment-sheet.png')


def process_environment():
    entries = [row for row in json.loads((THEME / 'manifest.json').read_text(encoding='utf-8')) if row['role'] == 'symbol']
    processing = []
    for asset_id, relative, width, height, has_alpha, cap, role in ENVIRONMENT:
        source = Image.open(THEME / f'source/{asset_id}.png')
        aspect_error = abs((source.width / source.height) / (width / height) - 1)
        extra = {}
        if not has_alpha:
            image = ImageOps.fit(source.convert('RGB'), (width, height), Image.Resampling.LANCZOS)
        elif role == 'frame':
            if aspect_error > 0.08:
                raise ValueError('Frame aspect error exceeds 8%; do not stretch. Review a 9-slice approach.')
            image = clean_alpha(source, (255, 0, 255), trim=False).resize((width, height), Image.Resampling.LANCZOS)
            alpha = image.getchannel('A')
            pixels = np.array(alpha)
            extra['solidPixelsCut'] = int(np.count_nonzero(pixels[100:1000, 100:1600] >= 200))
            pixels[100:1000, 100:1600] = 0
            image.putalpha(Image.fromarray(pixels))
            extra['window'] = dict(x=100, y=100, width=1500, height=900)
            extra['key'] = 'FF00FF'
        else:
            key = (255, 0, 255) if asset_id == 'button_plaque' else None
            if key is None and (source.mode != 'RGBA' or source.getchannel('A').getextrema()[0] != 0):
                raise ValueError(f'{asset_id} needs native alpha or a key-color source')
            subject = clean_alpha(source, key)
            if key is None:
                # Generated UI solids have noisy near-opaque alpha; keep softer edge coverage.
                subject.putalpha(subject.getchannel('A').point(lambda value: 255 if value >= 240 else value))
            ratio = min((width - 16) / subject.width, (height - 16) / subject.height)
            subject = subject.resize(tuple(round(side * ratio) for side in subject.size), Image.Resampling.LANCZOS)
            image = Image.new('RGBA', (width, height))
            image.alpha_composite(subject, ((width - subject.width) // 2, (height - subject.height) // 2))
            extra['key'] = 'FF00FF' if key else None
        target = THEME / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        fitted = image
        encoded = None
        # UI size fallback is permitted; frame canvas/window dimensions stay exact.
        for factor in ((1, 0.875, 0.75) if role == 'ui' else (1,)):
            image = fitted if factor == 1 else fitted.resize((round(width * factor), round(height * factor)), Image.Resampling.LANCZOS)
            for quality in (80, 78, 76, 74, 72, 70):
                buffer = io.BytesIO()
                image.save(buffer, 'WEBP', quality=quality, method=6, exact=True)
                if buffer.tell() <= cap:
                    encoded = buffer.getvalue()
                    break
            if encoded is not None:
                break
        if encoded is None:
            raise ValueError(f'{asset_id} exceeds its cap at quality 70; review reduction or regeneration')
        target.write_bytes(encoded)
        with Image.open(target) as result:
            assert result.format == 'WEBP' and result.size == image.size
            assert (result.mode == 'RGBA') == has_alpha
            if has_alpha:
                assert result.getchannel('A').getextrema()[0] == 0
            if role == 'frame':
                assert result.getchannel('A').crop((100, 100, 1600, 1000)).getextrema() == (0, 0)
        entries.append(dict(id=asset_id, file=relative, width=image.width, height=image.height, hasAlpha=has_alpha, bytes=target.stat().st_size, role=role))
        processing.append(dict(id=asset_id, quality=quality, dimensionsReduced=image.size != (width, height), aspectError=aspect_error, **extra))
    (THEME / 'manifest.json').write_text(json.dumps(entries, indent=2) + '\n', encoding='utf-8')
    (REVIEW / 'processing-stage3.json').write_text(json.dumps(processing, indent=2) + '\n', encoding='utf-8')
    environment_sheet()
    print(json.dumps(dict(assets=entries, totalBytes=sum(row['bytes'] for row in entries), processing=processing), indent=2))


def process_food():
    entries = [row for row in json.loads((THEME / 'manifest.json').read_text(encoding='utf-8')) if row['role'] != 'icon']
    assert len(entries) == 17, 'Build Stages 2 and 3 before Stage 4'
    (THEME / 'icons').mkdir(exist_ok=True)
    sheet = Image.new('RGBA', (1128, 1560), NAVY)
    draw = ImageDraw.Draw(sheet)
    draw.text((24, 16), 'PAROL NIGHTS / STAGE 4 / FOOD ICONS', font=font(28), fill='#FFF6E0')
    processing = []
    for index, asset_id in enumerate(FOOD_IDS):
        with Image.open(THEME / f'source/{asset_id}.png') as source:
            assert source.mode == 'RGBA' and source.getchannel('A').getextrema()[0] == 0
            subject = clean_alpha(source)
        subject.putalpha(subject.getchannel('A').point(lambda value: 255 if value >= 240 else value))
        image = centered(subject, 256)
        path = THEME / f'icons/{asset_id}.webp'
        for quality in (80, 78, 76, 74, 72, 70):
            buffer = io.BytesIO()
            image.save(buffer, 'WEBP', quality=quality, method=6, exact=True)
            if buffer.tell() <= 40_000:  # Conservative UI cap; no separate food cap in brief.
                break
        assert buffer.tell() <= 40_000, f'{asset_id}: regenerate to retain 256px size'
        path.write_bytes(buffer.getvalue())
        with Image.open(path) as result:
            assert result.format == 'WEBP' and result.mode == 'RGBA' and result.size == (256, 256)
            image = result.copy()
        alpha = image.getchannel('A')
        box = alpha.getbbox()
        assert alpha.getextrema() == (0, 255) and box
        assert max(box[2] - box[0], box[3] - box[1]) <= 222
        assert abs((box[0] + box[2]) / 2 - 128) <= 2
        assert abs((box[1] + box[3]) / 2 - 128) <= 2
        entries.append(dict(id=asset_id, file=f'icons/{asset_id}.webp', width=256, height=256, hasAlpha=True, bytes=path.stat().st_size, role='icon'))
        processing.append(dict(id=asset_id, quality=quality, alphaBounds=box, dimensionsReduced=False))
        x, y = 24 + index % 3 * 368, 80 + index // 3 * 740
        draw.text((x, y), asset_id, font=font(23), fill='#FFC94A')
        sheet.alpha_composite(image, (x + 40, y + 38))
        sheet.alpha_composite(checkerboard((256, 256)), (x + 40, y + 310))
        sheet.alpha_composite(image, (x + 40, y + 310))
        draw.text((x, y + 580), '96px: color / grey / light', font=font(19), fill='#FFF6E0')
        small = image.resize((96, 96), Image.Resampling.LANCZOS)
        grey = ImageOps.grayscale(small).convert('RGBA')
        grey.putalpha(small.getchannel('A'))
        sheet.alpha_composite(small, (x, y + 618))
        sheet.alpha_composite(grey, (x + 116, y + 618))
        sheet.alpha_composite(checkerboard((96, 96)), (x + 232, y + 618))
        sheet.alpha_composite(small, (x + 232, y + 618))
    sheet.convert('RGB').save(REVIEW / 'food-sheet.png')
    (THEME / 'manifest.json').write_text(json.dumps(entries, indent=2) + '\n', encoding='utf-8')
    (REVIEW / 'processing-stage4.json').write_text(json.dumps(processing, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(dict(icons=entries[-6:], totalBytes=sum(row['bytes'] for row in entries), processing=processing), indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', choices=(2, 3, 4), type=int, default=2)
    parser.add_argument('--key', action='append', default=[], metavar='ID=RRGGBB', help='Optional per-asset key for opaque source images')
    args = parser.parse_args()
    if args.stage == 4:
        process_food()
        return
    if args.stage == 3:
        process_environment()
        return
    keys = {}
    for item in args.key:
        symbol, color = item.split('=')
        color = color.lstrip('#')
        if symbol not in IDS or len(color) != 6:
            parser.error('--key expects a symbol ID and a six-digit RGB hex color')
        keys[symbol] = tuple(int(color[offset:offset + 2], 16) for offset in (0, 2, 4))
    entries, processing = [], []
    previous = {row['id']: row for row in json.loads((REVIEW / 'processing.json').read_text(encoding='utf-8'))}
    (THEME / 'symbols').mkdir(parents=True, exist_ok=True)
    for symbol in IDS:
        source = Image.open(THEME / f'source/{symbol}.png')
        if symbol not in keys and (source.mode != 'RGBA' or source.getchannel('A').getextrema()[0] != 0):
            raise ValueError(f'{symbol}: native transparency missing; supply --key or regenerate')
        target = THEME / f'symbols/{symbol}.webp'
        # Keep the approved Stage 1 exports byte-identical on later-stage reruns.
        if symbol in STAGE1 and target.exists() and symbol not in keys:
            with Image.open(target) as approved:
                size = approved.width
            quality = previous[symbol]['quality']
        else:
            size, quality = export(clean_alpha(source, keys.get(symbol)), target)
        with Image.open(target) as result:
            alpha = result.getchannel('A')
            box = alpha.getbbox()
            assert result.format == 'WEBP' and result.mode == 'RGBA'
            assert result.size == (size, size) and size >= 384
            assert alpha.getextrema() == (0, 255) and target.stat().st_size <= CAP
            assert box and max(box[2] - box[0], box[3] - box[1]) <= round(size * 0.85) + 4
            assert abs((box[0] + box[2]) / 2 - size / 2) <= 2
            assert abs((box[1] + box[3]) / 2 - size / 2) <= 2
        entries.append(dict(id=symbol, file=f'symbols/{symbol}.webp', width=size, height=size, hasAlpha=True, bytes=target.stat().st_size, role='symbol'))
        processing.append(dict(id=symbol, quality=quality, dimensionsReduced=size != 512, alphaBounds=box, key=keys.get(symbol)))
    (THEME / 'manifest.json').write_text(json.dumps(entries, indent=2) + '\n', encoding='utf-8')
    (REVIEW / 'processing.json').write_text(json.dumps(processing, indent=2) + '\n', encoding='utf-8')
    contact_sheet()
    symbols_sheet()
    print(json.dumps(dict(assets=entries, totalBytes=sum(entry['bytes'] for entry in entries), processing=processing), indent=2))


if __name__ == '__main__':
    main()
