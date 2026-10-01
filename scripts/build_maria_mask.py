#!/usr/bin/env python3
"""
Derive approximate mare extents.

Maria are dark basaltic plains. We threshold the LROC albedo (darkness relative to the surrounding
highlands), then split the dark mask between the IAU-named maria by normalised distance to each
IAU centre (distance / IAU radius). The result is an 8-bit label map (2048x1024, 0 = none) plus
per-mare statistics (area estimated from the mask).

Names, centres and diameters: IAU Gazetteer of Planetary Nomenclature (USGS).
This is an *approximate* delineation intended for visualisation, not a geologic map.
"""
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "data", "moon")

# id, key, name (IAU), lon E(-180..180), lat, diameter km (IAU)
MARIA = [
    (1, "imbrium", "Mare Imbrium", -14.909, 34.724, 1145.53),
    (2, "serenitatis", "Mare Serenitatis", 18.360, 27.288, 674.28),
    (3, "tranquillitatis", "Mare Tranquillitatis", 30.835, 8.349, 875.75),
    (4, "crisium", "Mare Crisium", 59.104, 16.177, 555.92),
    (5, "fecunditatis", "Mare Fecunditatis", 53.669, -7.835, 840.35),
    (6, "nectaris", "Mare Nectaris", 34.602, -15.185, 339.39),
    (7, "nubium", "Mare Nubium", -17.287, -20.589, 714.50),
    (8, "humorum", "Mare Humorum", -38.572, -24.479, 419.67),
    (9, "frigoris", "Mare Frigoris", -0.006, 57.592, 1446.41),
    (10, "vaporum", "Mare Vaporum", 4.090, 13.200, 242.46),
    (11, "cognitum", "Mare Cognitum", -22.314, -10.531, 350.01),
    (12, "insularum", "Mare Insularum", -30.640, 7.792, 511.93),
    (13, "procellarum", "Oceanus Procellarum", -56.677, 20.671, 2592.24),
    (14, "orientale", "Mare Orientale", -94.670, -19.866, 294.16),
    (15, "moscoviense", "Mare Moscoviense", 148.123, 27.282, 275.57),
    (16, "smythii", "Mare Smythii", 87.050, -1.709, 373.97),
    (17, "marginis", "Mare Marginis", 86.515, 12.702, 357.63),
    (18, "ingenii", "Mare Ingenii", 164.827, -33.246, 282.20),
    (19, "australe", "Mare Australe", 91.985, -47.771, 996.84),
    (20, "humboldtianum", "Mare Humboldtianum", 81.543, 56.922, 230.78),
]
R = 1737.4
W, H = 2048, 1024
THR_SCALE = float(os.environ.get('THR_SCALE', 0.93))
REL_MAX = float(os.environ.get('REL_MAX', 0.93))
MAX_REACH = float(os.environ.get('MAX_REACH', 1.3))
LOS_MIN = float(os.environ.get('LOS_MIN', 0.72))


def unit(lon, lat):
    lo, la = np.deg2rad(lon), np.deg2rad(lat)
    return np.stack([np.cos(la) * np.cos(lo), np.sin(la), -np.cos(la) * np.sin(lo)], axis=-1)


def main():
    im = Image.open(os.path.join(OUT, "albedo_4k.webp")).convert("RGB").resize((W, H), Image.BOX)
    a = np.asarray(im, dtype=np.float32) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    lum = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    lum = ndimage.gaussian_filter(lum, sigma=(1.6, 1.6), mode=("nearest", "wrap"))
    # local darkness: ratio to a wide median-ish background so the polar fill and far-side tone don't bias it
    bg = ndimage.gaussian_filter(lum, sigma=(40, 40), mode=("nearest", "wrap"))
    rel = lum / np.maximum(bg, 1e-4)
    lat = 90.0 - (np.arange(H) + 0.5) * 180.0 / H
    lon = -180.0 + (np.arange(W) + 0.5) * 360.0 / W
    lon2, lat2 = np.meshgrid(lon, lat)
    band = np.abs(lat2) < 66
    # Otsu threshold on lum within the equatorial band
    vals = lum[band]
    hist, edges = np.histogram(vals, bins=256)
    p = hist / hist.sum()
    centers = (edges[:-1] + edges[1:]) / 2
    w0 = np.cumsum(p)
    m0 = np.cumsum(p * centers)
    mt = m0[-1]
    sb = (mt * w0 - m0) ** 2 / np.maximum(w0 * (1 - w0), 1e-9)
    thr = centers[np.argmax(sb)]
    print("Otsu luminance threshold", float(thr), "of range", float(vals.min()), float(vals.max()))
    dark = (lum < thr * THR_SCALE) & (rel < REL_MAX) & band
    dark = ndimage.binary_opening(dark, iterations=1)
    dark = ndimage.binary_closing(dark, iterations=2)
    dark = ndimage.binary_fill_holes(dark) & band
    lab, n = ndimage.label(dark)
    sizes = ndimage.sum(dark, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= 60
    dark = keep[lab]

    P = unit(lon2, lat2)  # (H,W,3)
    ys, xs = np.nonzero(dark)
    pts = P[ys, xs]  # (N,3)
    # normalised distance of every dark pixel to every mare centre
    normd = np.empty((len(ys), len(MARIA)), np.float32)
    cpix = []
    for k, (i, key, name, clon, clat, diam) in enumerate(MARIA):
        c = unit(clon, clat)
        ang = np.arccos(np.clip(pts @ c, -1, 1))
        normd[:, k] = (ang * R) / (diam / 2.0)
        cpix.append(((clon + 180.0) / 360.0 * W, (90.0 - clat) / 180.0 * H))
    order = np.argsort(normd, axis=1)[:, :4]
    label = np.zeros((H, W), np.uint8)
    chosen = np.zeros(len(ys), np.int32)
    done = np.zeros(len(ys), bool)
    darkf = dark.astype(np.float32)
    for rank in range(order.shape[1]):
        cand = order[:, rank]
        todo = ~done
        if not todo.any():
            break
        nd = normd[np.arange(len(ys)), cand]
        ok = todo & (nd <= MAX_REACH)
        idx = np.nonzero(ok)[0]
        if len(idx) == 0:
            continue
        cx = np.array([cpix[c][0] for c in cand[idx]])
        cy = np.array([cpix[c][1] for c in cand[idx]])
        x0, y0 = xs[idx].astype(np.float32), ys[idx].astype(np.float32)
        frac = np.zeros(len(idx), np.float32)
        nsamp = 18
        for t in np.linspace(0.0, 1.0, nsamp):
            sx_ = x0 + (cx - x0) * t
            sy_ = y0 + (cy - y0) * t
            frac += darkf[np.clip(sy_.round().astype(int), 0, H - 1), np.clip(sx_.round().astype(int), 0, W - 1)]
        frac /= nsamp
        elig = frac >= LOS_MIN
        sel = idx[elig]
        chosen[sel] = cand[sel] + 1
        done[sel] = True
    label[ys, xs] = chosen.astype(np.uint8)
    # tidy: majority filter, then drop tiny fragments
    out = label.copy()
    for k in range(1, len(MARIA) + 1):
        m = ndimage.uniform_filter((label == k).astype(np.float32), size=5, mode="nearest")
        out[(m > 0.5)] = k
        out[(label == k) & (m <= 0.5)] = 0
    label = out
    Image.fromarray(label).save(os.path.join(OUT, "mare_ids.png"), optimize=True)

    # stats
    pix_area = (R * np.deg2rad(360.0 / W)) * (R * np.deg2rad(180.0 / H)) * np.cos(np.deg2rad(lat2))
    stats = []
    for (i, key, name, clon, clat, diam) in MARIA:
        m = label == i
        area = float(pix_area[m].sum())
        stats.append({"id": i, "key": key, "name": name, "lon": clon, "lat": clat, "diameterKm": diam, "areaKm2": round(area, -2)})
        print(f"{name:<24} area≈{area:>10,.0f} km²  pixels={int(m.sum())}")
    total = float(pix_area[label > 0].sum())
    moon_area = 4 * np.pi * R * R
    print("labelled maria area", total, "fraction of Moon", total / moon_area)
    with open(os.path.join(OUT, "maria.json"), "w") as f:
        json.dump({"threshold": float(thr), "labelledAreaKm2": round(total, -3), "maria": stats}, f, indent=1)
    # preview
    rng = np.random.RandomState(4)
    pal = rng.randint(60, 255, size=(len(MARIA) + 1, 3)).astype(np.uint8)
    pal[0] = (0, 0, 0)
    base = (np.asarray(im, dtype=np.float32) * 0.45).astype(np.uint8)
    prev = np.where((label > 0)[..., None], (0.5 * pal[label] + 0.5 * base).astype(np.uint8), base)
    Image.fromarray(prev).save(os.path.join(ROOT, ".cache", "maria_preview.png"))


if __name__ == "__main__":
    main()
