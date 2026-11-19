# Draws the extension icons. Usage: python3 scripts/make-icons.py extension/icons  (needs Pillow)
import sys
from PIL import Image, ImageDraw
out = sys.argv[1]
S = 512
def shield_mask():
    import math
    big = S*4
    m = Image.new('L', (big, big), 0); d = ImageDraw.Draw(m)
    k = 4
    left, right, top, mid, bottom, cx = 76*k, 436*k, 36*k, 250*k, 486*k, 256*k
    poly = [(left, top+44*k), (cx, top), (right, top+44*k), (right, mid)]
    for i in range(1, 60):
        t = i/60*math.pi/2
        poly.append((cx + (right-cx)*math.cos(t), mid + (bottom-mid)*math.sin(t)))
    for i in range(0, 60):
        t = (1 - i/60)*math.pi/2
        poly.append((cx - (cx-left)*math.cos(t), mid + (bottom-mid)*math.sin(t)))
    poly.append((left, mid))
    d.polygon(poly, fill=255)
    return m.resize((S, S), Image.LANCZOS)
mask = shield_mask()
grad = Image.new('RGB', (S, S))
gd = ImageDraw.Draw(grad)
for y in range(S):
    t = y / S
    r = int(255*(1-t) + 255*t); g = int(111*(1-t) + 179*t); b = int(168*(1-t) + 107*t)
    gd.line([(0, y), (S, y)], fill=(r, g, b))
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
img.paste(grad, (0, 0), mask)
d = ImageDraw.Draw(img)
dark = (36, 12, 40, 255)
# eye
cx, cy = S//2, 250
d.ellipse([cx-130, cy-75, cx+130, cy+75], outline=dark, width=30)
d.ellipse([cx-42, cy-42, cx+42, cy+42], fill=dark)
# slash
d.line([(cx-128, cy+104), (cx+128, cy-104)], fill=dark, width=34)
for size in (16, 32, 48, 128):
    img.resize((size, size), Image.LANCZOS).save(f"{out}/icon-{size}.png")
img.save(f"{out}/../../docs/icon-512.png")
