"""Vygeneruje ikonu a úvodnú obrazovku Android aplikácie (vlastná pixel-art kresba, bez cudzích assetov).

Spustenie: python3 scripts/android-icons.py   (potrebuje Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw

RES = Path(__file__).resolve().parent.parent / "android/app/src/main/res"
BG = (43, 37, 51)  # #2b2533 – pozadie hry
PAL = {
    ".": None,
    "o": (40, 28, 30),  # obrys
    "f": (242, 162, 92),  # srsť (oranžová)
    "s": (214, 122, 62),  # pásiky
    "w": (255, 243, 230),  # biela
    "p": (240, 140, 160),  # ružová
    "r": (226, 60, 60),  # červený kríž
    "e": (60, 160, 90),  # oči
}
# ľavá polovica 10×18 – zrkadlí sa na 20×18 (mačacia hlava s červeným krížikom = sanitka)
HALF = [
    "..oo......",
    ".ofo......",
    ".offo.....",
    ".ofpfo....",
    ".offffoooo",
    "offsffffww",
    "offfffffwr",
    "ofsfffffrr",
    "offfffffwr",
    "offoeoffff",
    "offoeoffff",
    "osffffffww",
    "offfffwwwp",
    ".offfwwwwo",
    ".offfwwwow",
    "..offfwwww",
    "...ooffwww",
    ".....ooooo",
]
CAT = [r + r[::-1] for r in HALF]


def cat(px: int) -> Image.Image:
    w, h = max(len(r) for r in CAT), len(CAT)
    img = Image.new("RGBA", (w * px, h * px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y, row in enumerate(CAT):
        for x, ch in enumerate(row):
            c = PAL.get(ch)
            if c:
                d.rectangle([x * px, y * px, (x + 1) * px - 1, (y + 1) * px - 1], fill=c + (255,))
    return img


def centered(size: int, art_frac: float, bg, round_mask=False) -> Image.Image:
    img = Image.new("RGBA", (size, size), bg + (255,) if bg else (0, 0, 0, 0))
    px = max(1, int(size * art_frac / len(CAT[0])))
    art = cat(px)
    img.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2 + px // 2))
    if round_mask:
        m = Image.new("L", (size, size), 0)
        ImageDraw.Draw(m).ellipse([0, 0, size - 1, size - 1], fill=255)
        img.putalpha(m)
    return img


DENS = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for name, k in DENS.items():
    d = RES / f"mipmap-{name}"
    s = int(48 * k)
    centered(s, 0.8, BG).save(d / "ic_launcher.png")
    centered(s, 0.7, BG, round_mask=True).save(d / "ic_launcher_round.png")
    # adaptívna ikona: 108 dp, viditeľná je stredná časť ~66 dp
    centered(int(108 * k), 0.56, None).save(d / "ic_launcher_foreground.png")

(RES / "values/ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    '    <color name="ic_launcher_background">#2B2533</color>\n</resources>\n'
)

for p in RES.glob("drawable*/splash.png"):
    w, h = Image.open(p).size
    img = Image.new("RGB", (w, h), BG)
    art = cat(max(1, min(w, h) // 3 // len(CAT[0])))
    img.paste(art, ((w - art.width) // 2, (h - art.height) // 2), art)
    img.save(p)
print("ikony a splash hotové")
