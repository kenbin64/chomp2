# impostor-atlas.py
# Packs the tiles rendered by tools/blender-impostor.py into one colour picture
# and one normal picture per tree (4 tiles across, 2 down for 8 directions), and
# writes the phone-size copies at half the size.
#
# Around the leaves the colour picture is filled outward with the nearest leaf
# colour (still fully transparent), so the edges of a cut-out leaf never show a
# dark rim when the picture is scaled down in the distance.
#
#   python tools/impostor-atlas.py <tiles-folder> <out-folder> <name>

import sys, os, json
import numpy as np
from PIL import Image, ImageFilter

src, out, name = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
info = json.load(open(os.path.join(src, 'info.json')))
n, t = info['frames'], info['tile']
cols = 4; rows = (n + cols - 1) // cols

def bleed(img):
    # Spread colour into the transparent surroundings (alpha stays as it is).
    a = np.asarray(img).astype(np.float32) / 255
    rgb, alpha = a[..., :3], a[..., 3:4]
    filled, have = rgb * (alpha > 0.5), (alpha > 0.5).astype(np.float32)
    for radius in (1, 2, 4, 8, 16, 32):
        blur = lambda x: np.asarray(Image.fromarray((x * 255).astype(np.uint8).squeeze()).filter(ImageFilter.BoxBlur(radius))).astype(np.float32) / 255
        s = np.stack([blur(filled[..., c] * 1.0) for c in range(3)], -1)
        w = blur(have[..., 0])[..., None]
        grow = (have[..., 0] < 0.5)[..., None] & (w > 1e-3)
        filled = np.where(grow, s / np.maximum(w, 1e-3), filled)
        have = np.maximum(have, (w > 1e-3).astype(np.float32))
    outp = np.concatenate([filled, alpha], -1)
    return Image.fromarray((outp * 255).clip(0, 255).astype(np.uint8), 'RGBA')

for kind in ('colour', 'normal'):
    sheet = Image.new('RGBA', (cols * t, rows * t), (128, 128, 255, 0) if kind == 'normal' else (0, 0, 0, 0))
    for k in range(n):
        tile = Image.open(os.path.join(src, '%s-%d.png' % (kind, k))).convert('RGBA')
        if kind == 'colour': tile = bleed(tile)
        sheet.paste(tile, ((k % cols) * t, (k // cols) * t))
    if kind == 'normal':
        # The game reads only the colour channels of the normal picture; fill the
        # empty background with "facing the camera" and drop the transparency.
        bg = Image.new('RGB', sheet.size, (128, 128, 255)); bg.paste(sheet, mask=sheet.split()[3]); sheet = bg
        sheet.save(os.path.join(out, '%s-normal.webp' % name), quality=90)
        sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS).save(os.path.join(out, '%s-normal-phone.webp' % name), quality=88)
    else:
        sheet.save(os.path.join(out, '%s-colour.webp' % name), quality=90)
        sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS).save(os.path.join(out, '%s-colour-phone.webp' % name), quality=88)
info.update({'cols': cols, 'rows': rows})
json.dump(info, open(os.path.join(out, '%s.json' % name), 'w'), indent=1)
print('ATLAS', name, sheet.size)
