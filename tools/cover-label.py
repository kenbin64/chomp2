# cover-label.py
# Covers a brand name in a video with a plain "V" label (Ken's rule: the spread
# is implied, never named). Each label is followed frame by frame by matching
# its picture, updating that picture as it goes (so a tumbling, shrinking
# label can still be followed), never jumping further than it could really
# move between frames, and stopping when it is truly gone. Where it is, the
# name is painted over with an oval in the label's own red and a bold yellow V.
# The result is written at game size with the original sound, by ffmpeg.
#
#   python tools/cover-label.py in.mp4 out.mp4 <ffmpeg.exe> <frame> x,y,w,h [x,y,w,h ...]
#   (each label's box in that frame, where it is clear, in the video's own pixels)

import sys, subprocess
sys.path.insert(0, 'C:/projects/art-gallery/.pylib')
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont

src, out, ffmpeg = sys.argv[1], sys.argv[2], sys.argv[3]
ref = int(sys.argv[4])
boxes = [tuple(int(v) for v in a.split(',')) for a in sys.argv[5:]]
OUT_W, FONT = 1280, 'C:/Windows/Fonts/ariblk.ttf'
STEP = 90          # the furthest a label moves between frames, in pixels
KEEP = 0.55        # how alike a match must be to count
KEEP_ORIG = 0.30   # and how alike it must still be to the label as it first was
MIN_SIZE = 0.6     # smallest it may become, against its first size
LOG = []

v = cv2.VideoCapture(src)
fps = v.get(cv2.CAP_PROP_FPS); W = int(v.get(3)); H = int(v.get(4))
out_h = int(round(H * OUT_W / W / 2) * 2)
enc = None
if out != '-':
    enc = subprocess.Popen([ffmpeg, '-y', '-loglevel', 'error',
        '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{OUT_W}x{out_h}', '-r', str(fps), '-i', '-',
        '-i', src, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '24', '-preset', 'slow',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '128k', out], stdin=subprocess.PIPE)

def label_red(patch):
    b, g, r = [patch[..., i].astype(int) for i in range(3)]
    m = (r - g > 80) & (r - b > 70) & (r > 110)
    return tuple(int(c) for c in np.median(patch[m], axis=0)) if m.sum() > 20 else (25, 25, 170)

def cover(frame, x, y, w, h, red):
    # An oval in the label's red over the name, and an upright yellow V in it.
    cx, cy = x + w // 2, y + h // 2
    cv2.ellipse(frame, (cx, cy), (int(w * 0.5), int(h * 0.48)), 0, 0, 360, red, -1, cv2.LINE_AA)
    size = max(8, int(h * 0.95))
    tile = Image.new('RGBA', (w + 10, h + 10), (0, 0, 0, 0))
    ImageDraw.Draw(tile).text((tile.width / 2, tile.height / 2 + size * 0.05), 'V', font=ImageFont.truetype(FONT, size),
        anchor='mm', fill=(255, 214, 40, 255), stroke_width=max(1, size // 16), stroke_fill=(110, 15, 15, 255))
    arr = np.asarray(tile).astype(np.float32)
    x0, y0 = cx - tile.width // 2, cy - tile.height // 2
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + tile.width), min(H, y0 + tile.height)
    if xb <= xa or yb <= ya: return
    part = arr[ya - y0:yb - y0, xa - x0:xb - x0]; a = part[..., 3:4] / 255
    frame[ya:yb, xa:xb] = (frame[ya:yb, xa:xb] * (1 - a) + part[..., [2, 1, 0]] * a).astype(np.uint8)
    sx, sy = slice(max(0, y - 4), min(H, y + h + 4)), slice(max(0, x - 4), min(W, x + w + 4))
    frame[sx, sy] = cv2.GaussianBlur(frame[sx, sy], (3, 3), 0)

v.set(cv2.CAP_PROP_POS_FRAMES, ref); ok, first = v.read()
tracks = []
for (x, y, w, h) in boxes:
    tracks.append({'box': (x, y, w, h), 'templ': first[y:y + h, x:x + w].copy(), 'orig': first[y:y + h, x:x + w].copy(), 'red': label_red(first[y:y + h, x:x + w]),
                   'lost': 0, 'done': False, 'n': 0})
v.set(cv2.CAP_PROP_POS_FRAMES, 0)
i = 0
while True:
    ok, f = v.read()
    if not ok: break
    clean = f.copy()
    for k, t in enumerate(tracks):
        if t['done']: continue
        x, y, w, h = t['box']
        best = None
        w0, h0 = t['orig'].shape[1], t['orig'].shape[0]
        for s in (0.9, 0.95, 1.0, 1.05, 1.1):            # it may grow or shrink a little each frame
            tw, th = int(w * s), int(h * s)
            if tw < w0 * MIN_SIZE or tw > w0 * 2.5: continue  # never shrinks to a speck: that is drift, not the label
            tm = cv2.resize(t['templ'], (tw, th))
            x0, y0 = max(0, x - STEP), max(0, y - STEP)
            x1, y1 = min(W, x + w + STEP), min(H, y + h + STEP)
            win = clean[y0:y1, x0:x1]
            if win.shape[0] <= th or win.shape[1] <= tw: continue
            m = cv2.matchTemplate(win, tm, cv2.TM_CCOEFF_NORMED)
            _, score, _, loc = cv2.minMaxLoc(m)
            if best is None or score > best[0]: best = (score, loc[0] + x0, loc[1] + y0, tw, th)
        if best:
            # It must still look like the label it started as, not only like the last frame.
            _, bx, by, bw, bh = best
            orig = cv2.matchTemplate(clean[by:by + bh, bx:bx + bw], cv2.resize(t['orig'], (bw, bh)), cv2.TM_CCOEFF_NORMED)[0, 0]
            if orig < KEEP_ORIG: best = None
        if best and best[0] >= KEEP:
            _, bx, by, bw, bh = best
            t['box'] = (bx, by, bw, bh); t['lost'] = 0; t['n'] += 1
            t['templ'] = cv2.addWeighted(t['templ'] if t['templ'].shape[:2] == (bh, bw) else cv2.resize(t['templ'], (bw, bh)), 0.8,
                                         clean[by:by + bh, bx:bx + bw], 0.2, 0)      # keep up with its turning, gently
            cover(f, bx, by, bw, bh, t['red'])
            LOG.append((i, k, round(best[0], 2), bx, by, bw, bh))
        else:
            t['lost'] += 1
            # A blurred frame or two is all right; longer and it is gone for good.
            if t['lost'] > 4: t['done'] = True; t['end'] = i
            elif t['lost'] <= 4 and t['n']: cover(f, x, y, w, h, t['red'])   # cover through the blur
    if enc: enc.stdin.write(cv2.resize(f, (OUT_W, out_h), interpolation=cv2.INTER_AREA).tobytes())
    i += 1
if enc: enc.stdin.close(); enc.wait()
for k, t in enumerate(tracks):
    print('LABEL', k, 'covered in', t['n'], 'frames, gone from frame', t.get('end', 'never'))
for row in LOG[::10]: print('  frame %d label %d match %.2f at %d,%d size %dx%d' % row)
print('FRAMES', i, 'WROTE', out)
