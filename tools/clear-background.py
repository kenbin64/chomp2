# clear-background.py
# Makes the plain background of a reference picture transparent before it goes to
# Meshy's image to 3D. With a solid background (white, grey, even a soft gradient),
# Meshy paints that colour onto the model's sides and back; with a transparent one,
# it has only the object to work from.
#
#   python tools/clear-background.py in.png [out.png] [tolerance]
#
# out.png defaults to in-clear.png next to the input. tolerance (default 18, on a
# 0-255 scale) is how far a pixel may differ from the background and still count
# as background; raise it for noisy backgrounds, lower it if the object's pale
# edges are being eaten.
#
# How: the background is read from the picture's border and fitted as a smooth
# surface (so a gradient is handled), every pixel close to that surface AND
# connected to the border is background, and the edge is softened by a pixel or
# two so the cut-out has no hard fringe. Pale areas inside the object are kept,
# because they do not connect to the border.

import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(src)[0] + '-clear.png'
tol = float(sys.argv[3]) if len(sys.argv) > 3 else 18.0

rgb = np.asarray(Image.open(src).convert('RGB')).astype(float)
H, W, _ = rgb.shape

# The background model: a quadratic surface per colour channel, fitted to a band
# of pixels round the border.
band = max(4, min(H, W) // 64)
edge = np.zeros((H, W), bool)
edge[:band], edge[-band:], edge[:, :band], edge[:, -band:] = True, True, True, True
ys, xs = np.nonzero(edge)
def terms(x, y):
    x, y = x / W, y / H
    return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], axis=-1)
A = terms(xs.astype(float), ys.astype(float))
gy, gx = np.mgrid[0:H, 0:W].astype(float)
G = terms(gx, gy)
background = np.empty_like(rgb)
for c in range(3):
    coef, *_ = np.linalg.lstsq(A, rgb[ys, xs, c], rcond=None)
    background[..., c] = G @ coef

# Close to the background colour, and connected to the border.
near = np.abs(rgb - background).max(axis=-1) < tol
labels, _ = ndimage.label(near)
touching = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
touching = touching[touching > 0]
bg = np.isin(labels, touching)

# Soft edge: alpha ramps over about two pixels at the boundary.
dist = ndimage.distance_transform_edt(~bg)
alpha = np.clip(dist / 2.0, 0, 1)
rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(out)
print(f'cleared {bg.mean() * 100:.1f}% of the picture -> {out}')
