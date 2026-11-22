# Renders the app icon design (assets/icons/app/favicon.svg) as PNG icons with PIL.
# Usage: python3 tools/app-icons.py assets/icons/app
import sys
from PIL import Image, ImageDraw

def cubic(p0, p1, p2, p3, n=40):
    return [tuple((1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t*t*c + t**3*d for a, b, c, d in zip(p0, p1, p2, p3)) for t in [i/n for i in range(n+1)]]

# leaf 1: M24 25 c0-8 -5.5-12.5 -14-12.5  0 8 5.5 12.5 14 12.5Z
leaf1 = cubic((24,25),(24,17),(18.5,12.5),(10,12.5)) + cubic((10,12.5),(10,20.5),(15.5,25),(24,25))[1:]
# leaf 2: M24 29 c0-7 5-11 12.5-11  0 7 -5 11 -12.5 11Z
leaf2 = cubic((24,29),(24,22),(29,18),(36.5,18)) + cubic((36.5,18),(36.5,25),(31.5,29),(24,29))[1:]

def render(size, inset, rounded, bg='#FFF9EC'):
    S = size * 4
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, S-1, S-1], radius=S*12/48, fill=bg)
    else:
        d.rectangle([0, 0, S, S], fill=bg)
    # artwork scaled into the inner area (inset = fraction of padding on each side)
    k = S * (1 - 2*inset) / 48
    o = S * inset
    P = lambda pts: [(o + x*k, o + y*k) for x, y in pts]
    w = lambda v: max(1, round(v*k))
    def line(a, b, col, width):
        d.line(P([a, b]), fill=col, width=w(width))
        for x, y in P([a, b]):
            r = w(width)/2
            d.ellipse([x-r, y-r, x+r, y+r], fill=col)
    line((24,40),(24,24),'#187533',3)
    for leaf, fill in ((leaf1,'#2E9E4F'),(leaf2,'#6FD98A')):
        pts = P(leaf)
        d.polygon(pts, fill=fill)
        d.line(pts + [pts[0]], fill='#187533', width=w(2), joint='curve')
    line((12,40),(36,40),'#A8622A',3)
    cx, cy, r = o+37*k, o+11*k, 4.5*k
    d.ellipse([cx-r-k, cy-r-k, cx+r+k, cy+r+k], fill='#D9531A')
    d.ellipse([cx-r+k, cy-r+k, cx+r-k, cy+r-k], fill='#FFD54A')
    return img.resize((size, size), Image.LANCZOS)

out = sys.argv[1]
render(192, 0.06, True).save(f'{out}/icon-192.png', optimize=True)
render(512, 0.06, True).save(f'{out}/icon-512.png', optimize=True)
# maskable: full-bleed background, artwork inside the 80% safe zone
render(512, 0.16, False).save(f'{out}/icon-maskable-512.png', optimize=True)
# iOS ignores transparency and rounds itself
render(180, 0.1, False).save(f'{out}/apple-touch-icon.png', optimize=True)
print('ok')
