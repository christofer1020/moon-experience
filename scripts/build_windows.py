#!/usr/bin/env python3
"""
High-resolution "windows" for close-ups.

Each window is a lat/lon box (6 x 6 WAC tiles = 8.44° tall) around a site, built from:
  * NASA Trek LRO WAC global mosaic, level 7 (≈182 px/deg, ≈167 m/px) — luminance detail
  * NASA SVS LROC color map (16k, 2025) — color / low-frequency brightness
  * NASA SVS LOLA 64 ppd elevation — slope (relief) map
The WAC detail is transferred onto the color map:   out = color_up * (wac / lowpass(wac)).

Outputs (public/data/windows):  <id>_c.webp (color)   <id>_r.jpg (relief, half-res)   windows.json
"""
import io, json, math, os, sys, time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import requests
import tifffile
from PIL import Image
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache")
OUT = os.path.join(ROOT, "public", "data", "windows")
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(CACHE, "wac_tiles"), exist_ok=True)

TILE = 256
LVL = 7
NCOLS_L = 2 ** (LVL + 1)  # 256
NROWS_L = 2 ** LVL  # 128
DEG = 360.0 / NCOLS_L  # 1.40625
TILES_Y = 6
BASE = "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm"
SESSION = requests.Session()
SESSION.verify = "/root/.ccr/ca-bundle.crt"
SMAX = 0.6
R_M = 1_737_400.0

# id, lon (E, -180..180), lat
SITES = [
    ("tycho", -11.215, -43.296), ("copernicus", -20.079, 9.621), ("kepler", -38.009, 8.121), ("plato", -9.382, 51.619),
    ("clavius", -14.727, -58.623), ("aristarchus", -47.49, 23.73), ("eratosthenes", -11.316, 14.474),
    ("theophilus", 26.285, -11.452), ("langrenus", 61.038, -8.86), ("tsiolkovskiy", 128.972, -20.379),
    ("grimaldi", -68.36, -5.38), ("bullialdus", -22.263, -20.748), ("alphonsus", -2.846, -13.388),
    ("archimedes", -3.993, 29.717), ("apollo-11", 23.473, 0.674), ("apollo-12", -23.419, -3.014),
    ("apollo-14", -17.471, -3.645), ("apollo-15", 3.634, 26.132), ("apollo-16", 15.499, -8.973),
    ("apollo-17", 30.775, 20.188), ("change-3", -19.512, 44.118), ("orientale", -94.9, -19.4),
    ("schickard", -55.1, -44.4), ("sinus-iridum", -31.7, 45.0), ("rupes-recta", -7.7, -21.7),
    ("posidonius", 30.0, 31.9), ("blue-ghost-1", 61.81, 18.56), ("change-5", -51.92, 43.06),
    ("slim", 25.25, -13.32), ("aristoteles", 17.32, 50.24), ("ptolemaeus", -1.84, -9.16), ("hertzsprung", -128.6, 1.4),
]


def tile(row, col):
    path = os.path.join(CACHE, "wac_tiles", f"{LVL}_{row}_{col}.jpg")
    if os.path.exists(path) and os.path.getsize(path) > 100:
        return Image.open(path).convert("L")
    for attempt in range(5):
        try:
            r = SESSION.get(f"{BASE}/{LVL}/{row}/{col}.jpg", timeout=40)
            if r.status_code == 200:
                open(path, "wb").write(r.content)
                return Image.open(io.BytesIO(r.content)).convert("L")
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"tile {row},{col} failed")


def window_box(lon, lat):
    ncols = max(6, int(round(TILES_Y / max(math.cos(math.radians(lat)), 0.25))))
    col0 = int(math.floor((lon + 180.0) / DEG)) - ncols // 2
    row0 = int(math.floor((90.0 - lat) / DEG)) - TILES_Y // 2
    col0 = max(0, min(NCOLS_L - ncols, col0))
    row0 = max(0, min(NROWS_L - TILES_Y, row0))
    lon_min = -180.0 + col0 * DEG
    lat_max = 90.0 - row0 * DEG
    return dict(col0=col0, row0=row0, ncols=ncols, lon_min=lon_min, lon_max=lon_min + ncols * DEG, lat_max=lat_max, lat_min=lat_max - TILES_Y * DEG)


def srgb_to_lin(a):
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(a, 1 / 2.4) - 0.055)


def main():
    only = set(sys.argv[1:])
    print("loading color + DEM ...", flush=True)
    color = tifffile.imread(os.path.join(CACHE, "nasa", "lroc_color_16bit_srgb_16k.tif"))[..., :3]
    dem = tifffile.imread(os.path.join(CACHE, "nasa", "ldem_64_uint.tif"))
    CH, CW = color.shape[:2]
    meta = []
    for sid, lon, lat in SITES:
        if only and sid not in only:
            continue
        t0 = time.time()
        b = window_box(lon, lat)
        W, H = b["ncols"] * TILE, TILES_Y * TILE
        jobs = [(b["row0"] + r, b["col0"] + c) for r in range(TILES_Y) for c in range(b["ncols"])]
        with ThreadPoolExecutor(max_workers=16) as ex:
            imgs = list(ex.map(lambda rc: tile(*rc), jobs))
        wac = np.zeros((H, W), np.float32)
        k = 0
        for r in range(TILES_Y):
            for c in range(b["ncols"]):
                wac[r * TILE:(r + 1) * TILE, c * TILE:(c + 1) * TILE] = np.asarray(imgs[k], np.float32) / 255.0
                k += 1
        # ---- color crop (16k map: 45.5 px/deg), upsampled to the window size
        x0 = int(math.floor((b["lon_min"] + 180.0) / 360.0 * CW))
        x1 = int(math.ceil((b["lon_max"] + 180.0) / 360.0 * CW))
        y0 = int(math.floor((90.0 - b["lat_max"]) / 180.0 * CH))
        y1 = int(math.ceil((90.0 - b["lat_min"]) / 180.0 * CH))
        crop = color[y0:y1, x0:x1].astype(np.float32) / 65535.0  # sRGB-coded
        # exact sub-pixel alignment of the crop to the window bounds
        fx0 = (b["lon_min"] + 180.0) / 360.0 * CW - x0
        fx1 = (b["lon_max"] + 180.0) / 360.0 * CW - x0
        fy0 = (90.0 - b["lat_max"]) / 180.0 * CH - y0
        fy1 = (90.0 - b["lat_min"]) / 180.0 * CH - y0
        chans = []
        for ci in range(3):
            im = Image.fromarray(crop[..., ci], mode="F")
            im = im.transform((W, H), Image.AFFINE, ((fx1 - fx0) / W, 0, fx0, 0, (fy1 - fy0) / H, fy0), resample=Image.BICUBIC)
            chans.append(np.asarray(im, np.float32))
        col = np.stack(chans, -1)
        # ---- WAC detail transfer
        lp = ndimage.gaussian_filter(wac, sigma=3.2)
        ratio = np.clip(wac / (lp + 0.03), 0.35, 2.6)
        lin = srgb_to_lin(np.clip(col, 0, 1)) * ratio[..., None]
        out = lin_to_srgb(lin)
        out8 = (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)
        Image.fromarray(out8).save(os.path.join(OUT, f"{sid}_c.webp"), "WEBP", quality=82, method=5)
        # ---- relief from LOLA 64 ppd
        dx0 = int(math.floor((b["lon_min"] + 180.0) * 64.0))
        dx1 = int(math.ceil((b["lon_max"] + 180.0) * 64.0))
        dy0 = int(math.floor((90.0 - b["lat_max"]) * 64.0))
        dy1 = int(math.ceil((90.0 - b["lat_min"]) * 64.0))
        h = (dem[dy0:dy1, dx0:dx1].astype(np.float32) - 20000.0) * 0.5
        h = ndimage.gaussian_filter(h, sigma=0.9)
        latc = np.deg2rad(90.0 - (np.arange(dy0, dy1) + 0.5) / 64.0)
        dy = R_M * np.deg2rad(1 / 64.0)
        dxm = dy * np.maximum(np.cos(latc), 0.05)[:, None]
        gx = np.clip((np.roll(h, -1, 1) - np.roll(h, 1, 1)) / (2 * dxm), -1.2, 1.2)
        gy = np.zeros_like(h)
        gy[1:-1] = (h[:-2] - h[2:]) / (2 * dy)
        gy = np.clip(gy, -1.2, 1.2)
        RW, RH = W // 2, H // 2
        fx0d = (b["lon_min"] + 180.0) * 64.0 - dx0
        fx1d = (b["lon_max"] + 180.0) * 64.0 - dx0
        fy0d = (90.0 - b["lat_max"]) * 64.0 - dy0
        fy1d = (90.0 - b["lat_min"]) * 64.0 - dy0

        def up(plane):
            im = Image.fromarray(np.ascontiguousarray(plane, np.float32), mode="F")
            im = im.transform((RW, RH), Image.AFFINE, ((fx1d - fx0d) / RW, 0, fx0d, 0, (fy1d - fy0d) / RH, fy0d), resample=Image.BICUBIC)
            return np.asarray(im, np.float32)

        sx, sy = up(gx), up(gy)
        # roughness from WAC high-frequency energy
        hf = wac - ndimage.gaussian_filter(wac, sigma=1.5)
        rough = np.sqrt(ndimage.gaussian_filter(hf * hf, sigma=4.0))
        rough = np.asarray(Image.fromarray(rough.astype(np.float32), mode="F").resize((RW, RH), Image.BILINEAR), np.float32)
        rough_e = np.clip(np.sqrt(np.clip(rough / 0.08, 0, 1)) * 255, 0, 255).astype(np.uint8)

        def enc(s):
            e = np.sign(s) * np.sqrt(np.minimum(np.abs(s) / SMAX, 1.0))
            return np.clip((e * 0.5 + 0.5) * 255 + 0.5, 0, 255).astype(np.uint8)

        rel = np.stack([enc(sx), enc(sy), rough_e], -1)
        Image.fromarray(rel).save(os.path.join(OUT, f"{sid}_r.jpg"), "JPEG", quality=88, subsampling=0, optimize=True)
        cb = os.path.getsize(os.path.join(OUT, f"{sid}_c.webp"))
        rb = os.path.getsize(os.path.join(OUT, f"{sid}_r.jpg"))
        meta.append(dict(id=sid, lon=lon, lat=lat, lonMin=b["lon_min"], lonMax=b["lon_max"], latMin=b["lat_min"], latMax=b["lat_max"], w=W, h=H, rw=RW, rh=RH, bytes=cb + rb))
        print(f"{sid:<14} {W}x{H}  color {cb / 1e6:.2f} MB  relief {rb / 1e6:.2f} MB   {time.time() - t0:.1f}s", flush=True)
    mp = os.path.join(OUT, "windows.json")
    prev = []
    if only and os.path.exists(mp):
        prev = [m for m in json.load(open(mp))["windows"] if m["id"] not in {x["id"] for x in meta}]
    json.dump({"tileDeg": DEG, "windows": prev + meta}, open(mp, "w"), indent=1)
    print("total", sum(m["bytes"] for m in prev + meta) / 1e6, "MB")


if __name__ == "__main__":
    main()
