#!/usr/bin/env python3
"""
Build web-delivery Moon textures from NASA's public-domain "CGI Moon Kit"
(NASA SVS 4720; LROC color mosaic + LOLA elevation, Ernie Wright / LRO teams).

Inputs  (downloaded to .cache/nasa by scripts/fetch_data.sh):
  lroc_color_16bit_srgb_16k.tif   2025 color map, 16384x8192, 16-bit sRGB, centered on 0° lon
  ldem_16_uint.tif                LOLA elevation, 5760x2880 (16 px/deg), uint16 half-metres + 20000
  ldem_64_uint.tif                LOLA elevation, 23040x11520 (64 px/deg), uint16 half-metres + 20000

Outputs (public/data/moon):
  albedo_{2k,4k,8k}.webp          progressive color maps (sRGB)
  height_{4,8}ppd.webp            elevation packed in R (hi byte) / G (lo byte)  [lossless WebP]
                                  elevation_m = (RG16 - 2500) * unit   (unit = 8 m for 4 ppd, 4 m for 8 ppd)
  relief_{2k,4k}.jpg              R,G = signed east/north slope (sqrt-encoded, |s|max 0.6),
                                  B = sub-texel roughness
  meta.json                       decoding constants

Reference sphere radius 1737.4 km (LRO convention).
"""
import json
import os
import sys
import time

import numpy as np
import tifffile
from PIL import Image
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "nasa")
OUT = os.path.join(ROOT, "public", "data", "moon")
os.makedirs(OUT, exist_ok=True)

R_M = 1_737_400.0  # metres


def log(*a):
    print(f"[{time.strftime('%H:%M:%S')}]", *a, flush=True)


def box_down(arr, factor):
    """Area-average an (H,W[,C]) array down by an integer factor."""
    h, w = arr.shape[:2]
    assert h % factor == 0 and w % factor == 0
    if arr.ndim == 2:
        return arr.reshape(h // factor, factor, w // factor, factor).mean(axis=(1, 3))
    c = arr.shape[2]
    return arr.reshape(h // factor, factor, w // factor, factor, c).mean(axis=(1, 3))


# --------------------------------------------------------------------------------------
# 1. Albedo
# --------------------------------------------------------------------------------------
def build_albedo():
    log("albedo: reading 16k 16-bit color …")
    a = tifffile.imread(os.path.join(CACHE, "lroc_color_16bit_srgb_16k.tif"))
    log("albedo:", a.shape, a.dtype)
    a = a[..., :3]
    out = {}
    for name, f in (("8k", 2), ("4k", 4), ("2k", 8)):
        chans = []
        for c in range(3):
            ch = a[..., c].astype(np.float32)
            chans.append(box_down(ch, f))
        d = np.stack(chans, axis=-1) / 257.0
        im = Image.fromarray(np.clip(d + 0.5, 0, 255).astype(np.uint8))
        path = os.path.join(OUT, f"albedo_{name}.webp")
        im.save(path, "WEBP", quality=90 if name != "2k" else 92, method=6)
        out[name] = os.path.getsize(path)
        log("albedo", name, im.size, f"{out[name] / 1e6:.2f} MB")
    return out


# --------------------------------------------------------------------------------------
# 2. Height — lossless packed RG, quantised
# --------------------------------------------------------------------------------------
HEIGHT_BIAS = 2500  # keeps values positive: min elevation -9.1 km


def pack16(q):
    q = q.astype(np.uint16)
    rgb = np.zeros(q.shape + (3,), np.uint8)
    rgb[..., 0] = (q >> 8).astype(np.uint8)
    rgb[..., 1] = (q & 0xFF).astype(np.uint8)
    return Image.fromarray(rgb)


def build_height():
    log("height: reading 16 ppd …")
    h16 = tifffile.imread(os.path.join(CACHE, "ldem_16_uint.tif")).astype(np.float32)
    metres = (h16 - 20000.0) * 0.5
    sizes = {}
    for name, f, unit in (("8ppd", 2, 4.0), ("4ppd", 4, 8.0)):
        m = box_down(metres, f)
        q = np.round(m / unit) + HEIGHT_BIAS
        assert q.min() >= 0 and q.max() < 65536, (q.min(), q.max())
        p = os.path.join(OUT, f"height_{name}.webp")
        pack16(q).save(p, "WEBP", lossless=True, quality=100, method=6)
        sizes[name] = {"bytes": os.path.getsize(p), "unitMeters": unit, "size": [q.shape[1], q.shape[0]]}
        log("height", name, q.shape, f"{sizes[name]['bytes'] / 1e6:.2f} MB")
    return sizes, (float(metres.min()), float(metres.max()))


# --------------------------------------------------------------------------------------
# 3. Relief (slopes) from 64 ppd LOLA
# --------------------------------------------------------------------------------------
SMAX = 0.6  # max |slope| representable (tan of ~31 degrees); steeper walls clip


def slope_enc(s):
    e = np.sign(s) * np.sqrt(np.minimum(np.abs(s) / SMAX, 1.0))
    return np.clip((e * 0.5 + 0.5) * 255.0 + 0.5, 0, 255).astype(np.uint8)


def gradients(h, ppd, sigma):
    H, W = h.shape
    hs = ndimage.gaussian_filter(h, sigma=(sigma, sigma), mode=("nearest", "wrap"))
    lat = np.deg2rad(90.0 - (np.arange(H) + 0.5) / ppd)
    coslat = np.maximum(np.cos(lat), 0.05).astype(np.float32)[:, None]
    dy = R_M * np.deg2rad(1.0 / ppd)
    dx = dy * coslat
    gx = (np.roll(hs, -1, axis=1) - np.roll(hs, 1, axis=1)) / (2.0 * dx)  # east
    gy = np.zeros_like(hs)
    gy[1:-1] = (hs[:-2] - hs[2:]) / (2.0 * dy)  # north (row index decreases northwards)
    gy[0], gy[-1] = gy[1], gy[-2]
    return np.clip(gx, -1.2, 1.2), np.clip(gy, -1.2, 1.2)


def build_relief():
    log("relief: reading 64 ppd DEM …")
    v = tifffile.imread(os.path.join(CACHE, "ldem_64_uint.tif"))
    H, W = v.shape
    h = (v.astype(np.float32) - 20000.0) * 0.5
    del v
    ppd = W / 360.0
    log("relief:", h.shape, f"{ppd:.0f} ppd")
    gx, gy = gradients(h, ppd, 1.6)  # robust mean slope
    gxf, gyf = gradients(h, ppd, 0.7)  # finer, for roughness
    del h
    tw, th = 4096, 2048

    def down(plane):
        return np.asarray(Image.fromarray(np.ascontiguousarray(plane, dtype=np.float32)).resize((tw, th), Image.BOX), dtype=np.float32)

    sx, sy = down(gx), down(gy)
    # sub-texel roughness = RMS deviation of fine-scale slope about the texel mean
    var = down(gxf * gxf + gyf * gyf) - (down(gxf) ** 2 + down(gyf) ** 2)
    rough = np.sqrt(np.clip(var, 0, None))
    rough_e = np.clip(np.sqrt(np.clip(rough / 0.35, 0, 1)) * 255.0 + 0.5, 0, 255).astype(np.uint8)
    rgb = np.stack([slope_enc(sx), slope_enc(sy), rough_e], axis=-1)
    sizes = {}
    for name, size in (("4k", (tw, th)), ("2k", (2048, 1024))):
        im = Image.fromarray(rgb)
        if im.size != size:
            im = im.resize(size, Image.BOX)
        p = os.path.join(OUT, f"relief_{name}.jpg")
        im.save(p, "JPEG", quality=85, subsampling=0, optimize=True)
        sizes[name] = os.path.getsize(p)
        log("relief", name, im.size, f"{sizes[name] / 1e6:.2f} MB")
    # hillshade sanity preview (sun from the west-north-west, 25° elevation)
    az, el = np.deg2rad(290.0), np.deg2rad(25.0)
    lx, ly, lz = np.sin(az) * np.cos(el) * -1.0, np.cos(az) * np.cos(el), np.sin(el)
    nrm = np.sqrt(sx * sx + sy * sy + 1.0)
    shade = np.clip((-sx * lx - sy * ly + lz) / nrm, 0, 1)
    Image.fromarray((shade * 255).astype(np.uint8)).resize((2048, 1024), Image.LANCZOS).save(
        os.path.join(ROOT, ".cache", "hillshade_preview.png")
    )
    return sizes


def main():
    os.makedirs(os.path.join(ROOT, ".cache"), exist_ok=True)
    only = set(sys.argv[1:])
    meta = {
        "radiusKm": 1737.4,
        "height": {"encoding": "RG16 lossless WebP", "bias": HEIGHT_BIAS},
        "relief": {"encoding": "sign*sqrt(|s|/smax) -> 8bit", "smax": SMAX, "channels": ["east", "north", "roughness"], "roughnessMax": 0.35},
        "source": "NASA SVS 4720 CGI Moon Kit (LROC / LOLA)",
    }
    if "albedo" in only or (not only and not os.path.exists(os.path.join(OUT, "albedo_8k.webp"))):
        meta["albedoBytes"] = build_albedo()
    if not only or "height" in only:
        sizes, rng = build_height()
        meta["heightBytes"] = sizes
        meta["heightRange"] = rng
    if not only or "relief" in only:
        meta["reliefBytes"] = build_relief()
    with open(os.path.join(OUT, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)
    log("done", meta)


if __name__ == "__main__":
    main()
