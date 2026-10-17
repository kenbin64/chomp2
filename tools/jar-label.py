# jar-label.py
# Paints the label for Kenny's jar: yellow, a red band along the top and the
# bottom, and a big red "V" with a white edge. The picture wraps once around the
# jar, so it is about 4.4 times wider than tall (the jar's circumference over the
# label's height). The V is printed twice, front and back, so it shows from
# either side.
#
#   python tools/jar-label.py assets/jar/label.png

import sys, os
from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1]
os.makedirs(os.path.dirname(out), exist_ok=True)
W, H = 1024, 232
YELLOW, RED, WHITE = (246, 197, 22), (206, 32, 41), (255, 255, 255)

img = Image.new('RGB', (W, H), YELLOW)
g = ImageDraw.Draw(img)
g.rectangle([0, 0, W, 26], fill=RED)
g.rectangle([0, H - 26, W, H], fill=RED)
g.rectangle([0, 30, W, 34], fill=WHITE)
g.rectangle([0, H - 35, W, H - 31], fill=WHITE)

font = ImageFont.truetype('C:/Windows/Fonts/ariblk.ttf', 150)
for cx in (W * 0.25, W * 0.75):
    g.text((cx, H / 2 + 4), 'V', font=font, anchor='mm', fill=RED, stroke_width=7, stroke_fill=WHITE)
img.save(out)
print('LABEL', out)
