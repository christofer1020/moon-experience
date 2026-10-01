#!/usr/bin/env bash
# Downloads the public source data into .cache/ (large: ~2.5 GB). Run once, then `npm run data`.
# Everything here is NASA public-domain data except the HYG star catalogue (CC BY-SA 4.0) and the IAU/USGS gazetteer.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .cache/nasa .cache/sky .cache/earth .cache/iau

SVS=https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720
for f in ldem_16_uint.tif ldem_64_uint.tif lroc_color_16bit_srgb_16k.tif; do
  [ -s ".cache/nasa/$f" ] || curl -L --fail -o ".cache/nasa/$f" "$SVS/$f"
done

[ -s .cache/sky/hygdata_v41.csv ] || curl -L --fail -o .cache/sky/hygdata_v41.csv \
  https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv

[ -s .cache/earth/bluemarble_5400.jpg ] || curl -L --fail -o .cache/earth/bluemarble_5400.jpg \
  https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg
[ -s .cache/earth/blackmarble_3km.jpg ] || curl -L --fail -o .cache/earth/blackmarble_3km.jpg \
  https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg

# IAU Gazetteer of Planetary Nomenclature (USGS) — only used to author src/content/landmarks.ts and maria.ts
[ -s .cache/iau/moon_nom.zip ] || curl -L --fail -o .cache/iau/moon_nom.zip \
  https://planetarynames.wr.usgs.gov/shapefiles/MOON_nomenclature_center_pts.zip

# LRO WAC tiles for the hero windows are fetched on demand by scripts/build_windows.py (NASA Trek WMTS).
echo "done"
