#!/usr/bin/env python3
"""
Pack the HYG star database (Hipparcos / Yale BSC / Gliese; D. Nash, CC BY-SA 4.0) into a compact binary.
Record (8 bytes, sorted by brightness): int16 x,y,z (J2000 equatorial unit vector * 32767),
uint8 magnitude ((mag+2)*20), uint8 colour index ((B-V+0.5)*100).
Output: public/data/sky/stars.b64.txt  (base64 of the binary records, so any static host/CDN serves it as text; + stars.json header)
"""
import csv, json, os, struct
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, ".cache", "sky", "hygdata_v41.csv")
OUT = os.path.join(ROOT, "public", "data", "sky")
os.makedirs(OUT, exist_ok=True)
MAG_LIMIT = 10.0

stars = []
named = []
with open(SRC, newline="") as f:
    for d in csv.DictReader(f):
        try:
            mag = float(d["mag"])
            ra = float(d["rarad"])
            dec = float(d["decrad"])
        except ValueError:
            continue
        if d["proper"] == "Sol" or mag > MAG_LIMIT:
            continue
        ci = float(d["ci"]) if d["ci"] not in ("", None) else 0.6
        stars.append((mag, ra, dec, ci))
        if d["proper"] and mag < 2.2:
            named.append({"name": d["proper"], "mag": mag, "ra": ra, "dec": dec})
stars.sort(key=lambda s: s[0])
buf = bytearray()
for mag, ra, dec, ci in stars:
    x, y, z = np.cos(dec) * np.cos(ra), np.cos(dec) * np.sin(ra), np.sin(dec)
    buf += struct.pack(
        "<hhhBB",
        int(round(x * 32767)), int(round(y * 32767)), int(round(z * 32767)),
        int(np.clip(round((mag + 2.0) * 20), 0, 255)),
        int(np.clip(round((ci + 0.5) * 100), 0, 255)),
    )
import base64
open(os.path.join(OUT, "stars.b64.txt"), "w").write(base64.b64encode(buf).decode())
json.dump({"count": len(stars), "recordBytes": 8, "magLimit": MAG_LIMIT, "named": named,
           "credit": "HYG Database v4.1 (David Nash), CC BY-SA 4.0; data from Hipparcos, Yale BSC, Gliese"},
          open(os.path.join(OUT, "stars.json"), "w"), indent=1)
print(len(stars), "stars", len(buf) / 1e6, "MB;", len(named), "named bright stars")
