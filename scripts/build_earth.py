#!/usr/bin/env python3
"""NASA Blue Marble Next Generation (day) + Black Marble 2016 (night lights) → web textures."""
import os
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, ".cache", "earth")
OUT = os.path.join(ROOT, "public", "data", "earth")
os.makedirs(OUT, exist_ok=True)

day = Image.open(os.path.join(SRC, "bluemarble_5400.jpg")).convert("RGB")
print("day", day.size)
for name, w in (("4k", 4096), ("2k", 2048)):
    im = day.resize((w, w // 2), Image.LANCZOS)
    p = os.path.join(OUT, f"day_{name}.webp")
    im.save(p, "WEBP", quality=86, method=6)
    print(p, os.path.getsize(p) / 1e6, "MB")

night = Image.open(os.path.join(SRC, "blackmarble_3km.jpg")).convert("L")
print("night", night.size)
for name, w in (("4k", 4096), ("2k", 2048)):
    im = night.resize((w, w // 2), Image.LANCZOS)
    p = os.path.join(OUT, f"night_{name}.webp")
    im.save(p, "WEBP", quality=84, method=6)
    print(p, os.path.getsize(p) / 1e6, "MB")
