# SELENE — an atlas of the Moon

An interactive lunar observatory where **the Moon is the interface**. One persistent, real-data Moon stays on screen from the first frame to the last; the story, the tools, the index and the maps are all drawn *on* it. Everything is made in code (WebGL/GLSL, WebAudio, DOM) — no generated imagery, video or audio.

## Run it

The site is a static web app: it needs a small local web server, not just a double-click (browsers block the Moon's data files when a page is opened from `file://`). Pick one way.

### On your computer

1. Install **Git** and **Node.js 20.19+ or 22** (check with `node -v`).
2. Clone, install and open:
   ```
   git clone https://github.com/christofer1020/moon-experience.git
   cd moon-experience
   npm install
   npm start          # builds, then opens http://127.0.0.1:4173
   ```
   For development with live reload use `npm run dev` instead (http://localhost:5173).

### In GitHub Codespaces (nothing to install)

On the repository page: **Code → Codespaces → Create codespace on `main`**. It installs everything and starts the dev server; the forwarded port 5173 opens in your browser. (The 3D is drawn by *your* browser's GPU, not by the Codespace.) This path was set up but not tested.

### Build once, serve any way you like

`npm run build` writes a self-contained site to `dist/` (relative paths, ≈ 38 MB). Serve that folder with any static server, for example `python3 -m http.server 8080 -d dist`, then open http://localhost:8080.

### If something looks wrong

* **Black or blank page:** the site needs WebGL 2. Use a current Chrome, Edge, Firefox or Safari with hardware acceleration on (Chrome: `chrome://gpu`).
* **Choppy:** add `?q=low` to the address, or use Settings → Graphics quality.
* **No sound:** sound only starts from the "Enter · with sound" button (browsers forbid autoplay).
* **`npm install` complains about the Node version:** install Node 20.19+ or 22.
* **Port already in use:** stop the other server, or `npx vite --port 5180`.

## Commands

```
npm run dev        # development server with live reload, http://localhost:5173
npm start          # production build + preview, http://127.0.0.1:4173
npm run build      # type-check + production build into dist/ (relative base: host from any path)
npm run preview    # serve an existing dist/
```

The repository already contains the processed data (`public/data`, ≈ 36 MB). To regenerate it from the original NASA sources: `npm run data` (downloads ≈ 2.5 GB into `.cache/`; needs Python 3 with `numpy scipy pillow tifffile requests`).

## What is in it

| | |
|---|---|
| 01 The Moon | Opening: loading is the first scene (a crescent grows as data arrives), then entry with or without sound. |
| 02 Surface | Highland / mare contrast, LOLA elevation as colour + hillshade, graticule, ~30 IAU-named features. |
| 03 Maria | Approximate mare outlines you can hover and select; far-side vs near-side coverage. |
| 04 Craters | Anatomy of Copernicus and Tycho; **impact replay** (educational, time-compressed): flattened ground, projectile, flash, excavation, ejecta rays. |
| 05 The lunar day | Real Sun elevation at a site for any moment of the 29.53-day cycle; the terminator sweeps the surface. |
| 06 Near / far side | Tidal locking: the orbit, a rotating arrow vs a fixed one, the unchanging face from Earth in an inset; far side; libration read-outs. |
| 07 Phases | Real Sun–Earth–Moon geometry with parallel sunlight and an Earth-observer inset; scrubbable lunation. |
| 08 Eclipses | True-scale umbra/penumbra, upcoming lunar and solar eclipses from the ephemeris, observer view at greatest eclipse, orbital tilt/nodes. |
| 09 Orbit | Live perigee/apogee/distance/speed from the ephemeris; true vs educational scale. |
| 10 Earth + Moon | True scale, distance in Earth diameters, a light pulse at true (or ×10 slower) speed, exaggerated tides (labelled). |
| 11 Exploration | A timeline from Galileo to Artemis; the Moon turns to each site. Includes an Earthrise moment from a low orbit. |
| 12 Apollo | Six landing sites on the Moon itself, lit with the real Sun at touchdown (computed from the ephemeris for the historical date). |
| 13 The poles | Permanently shadowed regions with the real polar lighting geometry; the Sun circling the pole. |
| 14 Lunar calendar | A month view with phase glyphs, computed (not looked up). |
| 15 Facts | Sourced fact sheet and credits. |

Navigation: scroll (guided), the **Lunar Index** (`I`), the chapter rail, or **Explore** mode (free drag/zoom, scroll locked). Keyboard: arrows turn the Moon, `+`/`−` zoom, `0` resets, `Esc` closes panels. Touch: drag, pinch, tap. A full **text version** (`Read`) contains every word and a text alternative for each scene.

Query parameters for QA: `?q=low|medium|high` quality tier, `?aa=0` no MSAA, `?dyn=0` fixed resolution, `?win=0` no close-up windows, `?fps` frame-time read-out, `?debug=1` exposes `window.__selene`.

## How it is built

* **Engine** (`src/engine`): vanilla Three.js r186 with custom GLSL. HDR half-float render target, MSAA, bloom chain, ACES composite. React is used only for the interface.
* **Moon shader**: lunar-Lambert (McEwen) shading with opposition surge, relief normals from LOLA slopes, height-field cast shadows (with shadow-hiding at opposition so a full Moon looks flat, as it does), Earth occlusion for eclipses (copper umbra light + earthshine), progressive 2k→4k→8k imagery, procedural micro-relief only when very close, overlays for graticule/topography/mare masks, surface reticles.
* **Hero windows**: 32 sites have extra close-up tiles (LRO WAC level-7 detail transferred onto the LROC colour map; LOLA 64 ppd slopes) loaded on demand when the camera is low and over them (`public/data/windows`, built by `scripts/build_windows.py`).
* **Astronomy** (`src/astro`): positions, phases, eclipses via `astronomy-engine`; Moon orientation from the IAU WGCCRE series (agrees with the library's libration to ≈ 0.02°).
* **Story engine** (`src/chapters`): each chapter is a function that writes camera, date, overlays and labels for the current beat. A camera rig keeps views attached to the Moon's body or its orbit while time runs.
* **Interface**: hairlines and type, no cards; labels are drawn on a canvas with collision avoidance; one design token set in `src/styles/app.css`.
* **Sound** (`src/audio/Sound.ts`): synthesised live with WebAudio — a drone/pad whose chord glides with the chapter, generated reverb, sparse bells, short interface cues. Never autoplays, only starts from a user gesture, one toggle always visible. (There is no sound in space; all of this belongs to the website.)

## Data and licences

| Data | Source | Licence |
|---|---|---|
| Colour, elevation (LROC, LOLA) | NASA SVS 4720 "CGI Moon Kit" (E. Wright / LRO) | Public domain; visualisation-optimised |
| Close-up detail | NASA Trek — LRO WAC global mosaic | Public domain |
| Feature names, positions, sizes | IAU Gazetteer of Planetary Nomenclature (USGS) | Open data |
| Apollo coordinates | Apollo Lunar Surface Journal | Reference data |
| Stars | HYG database v4.1 (D. Nash) | CC BY-SA 4.0 (the derived `public/data/sky/stars.b64.txt` stays under the same licence) |
| Earth | NASA Blue Marble (topo+bathy), Black Marble 2016 | Public domain |
| Ephemerides | `astronomy-engine` (D. Cross) | MIT |
| Fonts | Instrument Serif / Instrument Sans / JetBrains Mono via Fontsource | SIL OFL 1.1 |

Facts quoted in the interface come from the NASA Moon Fact Sheet, NASA Science, the IAU, LRO mission papers and the sources listed in chapter 15 (`src/content/facts.ts`).

## What is illustrative, and labelled as such

* Mare outlines are **approximate**: dark-albedo mask partitioned by distance to the IAU mare centres — not a geological map.
* The impact replay is an educational visualisation with compressed time, not a simulation.
* "Educational scale" views compress the Earth–Moon distance (body sizes stay true; eclipse geometry is scaled to keep true angular sizes). Tidal bulges are exaggerated and labelled.
* Textures are display-referred and the colour is stylised by the source kit; hero windows fuse WAC morphology with the colour map.

## Limits (honest)

* Developed and visually inspected in headless Chromium with a software GPU (SwiftShader). It has not been profiled on physical phones/GPUs; the quality tier, dynamic resolution and texture ladder are there for that, but real-device tuning is outstanding.
* Audio was verified for graph correctness and levels (RMS/peak measurement in-browser), not by ear.
* Textures are WebP/JPEG (no KTX2/Basis); GPU memory on the high tier is a few hundred MB.

## Tooling

`scripts/flow.mjs`, `scripts/qa.sh` and `scripts/shot.mjs` drive Playwright screenshots of the running site (`node scripts/flow.mjs <outDir> "<steps>" [w] [h] [query]`; steps such as `ch:<chapter>:<beat>`, `settle:<frames>:<dt>`, `shot:<name>`). They expect Playwright at the path set at the top of each script and a dev server on :5173.
