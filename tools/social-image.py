# Renders the preview image for shared links (Open Graph, 1200 × 630) with PIL.
# Usage: python3 tools/social-image.py assets/social/preview.png
# Uses the app icon (run tools/app-icons.py first) and the app font.
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG, TEXT, MUTED, PRIMARY, SOIL = '#FFF9EC', '#2B2A33', '#66636F', '#187533', '#A8622A'
FONT = 'vendor/fonts/nunito/nunito-latin-wght-normal.woff2'

def font(size, weight):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_axes([weight])
    return f

img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)
# soil line along the bottom, like the icon
d.rectangle([0, H - 18, W, H], fill=SOIL)

icon = Image.open('assets/icons/app/icon-512.png').convert('RGBA').resize((300, 300), Image.LANCZOS)
img.paste(icon, (80, (H - 300) // 2 - 10), icon)

x = 430
d.text((x, 150), 'Erntelotse', font=font(104, 800), fill=PRIMARY)
d.text((x, 290), 'Plan your garden, bed by bed', font=font(46, 700), fill=TEXT)
d.text((x, 348), 'and week by week', font=font(46, 700), fill=TEXT)
d.text((x, 438), 'Free · works offline · no account', font=font(32, 600), fill=MUTED)

img.save(sys.argv[1], optimize=True)
print('ok')
