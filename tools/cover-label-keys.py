# cover-label-keys.py
# Covers the brand name in Ken's promo video with a plain V label (Ken's rule:
# the spread is implied, never named), from key frames marked by hand in
# tools/data/trailer-labels.json. Automatic tracking wandered onto other red
# and orange things in this footage, so the positions are marked by hand and
# filled in smoothly between. Each mark gets an oval in the label's red with a
# bold yellow V, turned with the label. Written at game size with the sound.
#
#   python tools/cover-label-keys.py in.mp4 marks.json out.mp4 <ffmpeg.exe>

import sys, json, subprocess
sys.path.insert(0, 'C:/projects/art-gallery/.pylib')
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont

src, marks, out, ffmpeg = sys.argv[1:5]
LABELS = json.load(open(marks))['labels']
OUT_W, FONT, RED = 1280, 'C:/Windows/Fonts/ariblk.ttf', (32, 28, 196)   # BGR: the labels' red

v = cv2.VideoCapture(src)
fps = v.get(cv2.CAP_PROP_FPS); W = int(v.get(3)); H = int(v.get(4))
out_h = int(round(H * OUT_W / W / 2) * 2)
enc = subprocess.Popen([ffmpeg, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{OUT_W}x{out_h}',
    '-r', str(fps), '-i', '-', '-i', src, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '24', '-preset', 'slow',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k', out], stdin=subprocess.PIPE)

def at(keys, i):
    # The label's place at frame i, between the key frames either side; None outside them.
    if i < keys[0][0] or i > keys[-1][0]: return None
    for a, b in zip(keys, keys[1:]):
        if a[0] <= i <= b[0]:
            t = (i - a[0]) / max(1, b[0] - a[0])
            return [a[k] + (b[k] - a[k]) * t for k in range(1, 6)]
    return keys[-1][1:]

def cover(frame, cx, cy, w, h, ang):
    cv2.ellipse(frame, (int(cx), int(cy)), (int(w / 2), int(h / 2)), ang, 0, 360, RED, -1, cv2.LINE_AA)
    size = max(8, int(h * 0.95))
    tile = Image.new('RGBA', (int(w) + 20, int(h) + 20), (0, 0, 0, 0))
    ImageDraw.Draw(tile).text((tile.width / 2, tile.height / 2 + size * 0.05), 'V', font=ImageFont.truetype(FONT, size),
        anchor='mm', fill=(255, 214, 40, 255), stroke_width=max(1, size // 16), stroke_fill=(110, 15, 15, 255))
    tile = tile.rotate(-ang, resample=Image.BICUBIC, expand=True)
    arr = np.asarray(tile).astype(np.float32)
    x0, y0 = int(cx) - tile.width // 2, int(cy) - tile.height // 2
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + tile.width), min(H, y0 + tile.height)
    if xb > xa and yb > ya:
        part = arr[ya - y0:yb - y0, xa - x0:xb - x0]; a = part[..., 3:4] / 255
        frame[ya:yb, xa:xb] = (frame[ya:yb, xa:xb] * (1 - a) + part[..., [2, 1, 0]] * a).astype(np.uint8)
    r = int(max(w, h) / 2) + 6
    sy, sx = slice(max(0, int(cy) - r), min(H, int(cy) + r)), slice(max(0, int(cx) - r), min(W, int(cx) + r))
    frame[sy, sx] = cv2.GaussianBlur(frame[sy, sx], (3, 3), 0)       # sits into the soft, filmic picture

i = 0
while True:
    ok, f = v.read()
    if not ok: break
    for keys in LABELS.values():
        p = at(keys, i)
        if p: cover(f, *p)
    enc.stdin.write(cv2.resize(f, (OUT_W, out_h), interpolation=cv2.INTER_AREA).tobytes())
    i += 1
enc.stdin.close(); enc.wait()
print('FRAMES', i, 'WROTE', out)
