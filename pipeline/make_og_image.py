#!/usr/bin/env python3
"""make_og_image.py — renders assets/og-image.png (1200x630) for social cards.

Draws the landing-page identity in the site's visual language: dark ground,
copper gradient wordmark, ledger-card silhouettes, contract provenance line.
Uses the macOS Menlo face (the site's monospace stack starts at Menlo).

Run: python3 pipeline/make_og_image.py
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

W, H = 1200, 630
BG = (11, 11, 14)
INK = (236, 231, 216)
DIM = (141, 134, 120)
RULE = (44, 42, 38)
COPPER = (201, 138, 75)
COPPER_HI = (240, 210, 166)
PANEL = (18, 18, 22)

MENLO = "/System/Library/Fonts/Menlo.ttc"
def font(size, bold=True):
    # Menlo.ttc faces: 0 regular, 1 bold (verified by family lookup below)
    for idx in (1 if bold else 0, 0):
        try:
            f = ImageFont.truetype(MENLO, size, index=idx)
            if not bold or "Bold" in f.getname()[1] or idx == 0:
                return f
        except OSError:
            continue
    return ImageFont.truetype(MENLO, size)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# faint vertical gradient wash
for y in range(H):
    a = y / H
    shade = tuple(int(c + (8 * (1 - a))) for c in BG)
    d.line([(0, y), (W, y)], fill=shade)

# frame, like the ledger card border
d.rectangle([28, 28, W - 28, H - 28], outline=RULE, width=2)

# ---- right side: three ledger-card silhouettes, slightly fanned ----
def card(cx, cy, w, h, angle, name, supply):
    c = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    cd = ImageDraw.Draw(c)
    cd.rounded_rectangle([0, 0, w - 1, h - 1], 10, fill=(14, 15, 18, 255), outline=(70, 64, 54, 255), width=2)
    cd.rectangle([10, 10, w - 11, h - 11], outline=(44, 42, 38, 255), width=1)
    cd.text((w // 2, 26), "HUMANITYCARDS", font=font(11), fill=(150, 142, 126, 255), anchor="mm")
    cd.line([18, 40, w - 18, 40], fill=(44, 42, 38, 255), width=1)
    # rosette rings
    for r in range(16, 60, 9):
        cd.ellipse([w // 2 - r, h // 2 - 26 - r, w // 2 + r, h // 2 - 26 + r], outline=(60, 50, 38, 90), width=1)
    nf = font(22 if len(name) <= 8 else 17)
    cd.text((w // 2, h // 2 - 26), name.upper(), font=nf, fill=(236, 231, 216, 255), anchor="mm")
    cd.line([w // 2 - 22, h // 2 + 2, w // 2 + 22, h // 2 + 2], fill=(201, 138, 75, 255), width=2)
    cd.text((w // 2, h - 28), supply, font=font(12), fill=(201, 138, 75, 255), anchor="mm")
    c = c.rotate(angle, expand=True, resample=Image.BICUBIC)
    img.paste(c, (cx - c.width // 2, cy - c.height // 2), c)

card(940, 330, 190, 266, 8, "Caesar", "1 OF 5")
card(1058, 305, 190, 266, -6, "Cleopatra", "1 OF 10")
card(998, 358, 200, 280, 1, "Jesus", "1 OF 1")

# ---- left side: identity ----
x = 86
d.text((x, 110), "ETHEREUM GENESIS NFT · MINTED MARCH 2018", font=font(17), fill=DIM)

d.text((x, 158), "Humanity", font=font(58), fill=INK)
hw = d.textlength("Humanity", font=font(58))
d.text((x + hw, 158), "Cards", font=font(58), fill=COPPER)

# "Play history." with a vertical copper gradient via masking
big = font(96)
mask = Image.new("L", (W, H), 0)
ImageDraw.Draw(mask).text((x, 268), "Play history.", font=big, fill=255)
grad = Image.new("RGB", (W, H), 0)
gd = ImageDraw.Draw(grad)
for y in range(250, 420):
    t = (y - 250) / 170
    col = tuple(int(COPPER_HI[i] + (156 - COPPER_HI[i] + (COPPER[i] - 156) + (COPPER[i] - COPPER_HI[i]) * 0) * t) for i in range(3))
    col = tuple(int(COPPER_HI[i] + (COPPER[i] - COPPER_HI[i]) * t) for i in range(3))
    gd.line([(0, y), (W, y)], fill=col)
img.paste(grad, (0, 0), mask)

d.text((x, 420), "239 historical figures · fully on-chain · pre-ERC-721", font=font(22), fill=INK)
d.text((x, 462), "Collect the catalogue. Put history in play.", font=font(18, bold=False), fill=DIM)

# provenance footer
d.line([x, 524, 700, 524], fill=RULE, width=1)
d.text((x, 546), "ORIGINAL CONTRACT", font=font(13), fill=DIM)
d.text((x, 572), "0xbc9B96E7Aa6AFEA664f9D5fdDa168518eE20f2Cc", font=font(17), fill=COPPER)

out = Path(__file__).parent.parent / "assets" / "og-image.png"
img.save(out, optimize=True)
print(f"wrote {out} ({out.stat().st_size // 1024} KB)")
