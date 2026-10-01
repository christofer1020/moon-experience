import { Vector3 } from 'three'
import type { Chapter } from './types'
import { useStore } from '../store'
import { Slider, Readout, Chip } from '../ui/controls'
import { IconPause, IconPlay } from '../ui/Icons'
import { useSim } from '../tools/useSim'
import { dateLunation, datePhase, dateSubsolar, lunation } from './helpers'
import { fmtLat, fmtLon } from './helpers'

const SIDEREAL = 27.321661
const DAY = 86400000

function SidesTools() {
  const { tool, setTool, beatIdx } = useStore()
  const sim = useSim()
  return (
    <div>
      <div className="tools-title">
        <span>{beatIdx === 3 ? 'Libration' : 'One orbit'}</span>
        <b>{Math.round(tool.orbitT * SIDEREAL * 10) / 10} / 27.3 days</b>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button className="btn" aria-label={tool.orbitPlay ? 'Pause' : 'Play'} onClick={() => setTool({ orbitPlay: !tool.orbitPlay })}>
          {tool.orbitPlay ? <IconPause /> : <IconPlay />}
        </button>
        <div style={{ flex: 1 }}>
          <Slider
            label="Position along the orbit"
            value={tool.orbitT}
            onChange={(v) => setTool({ orbitT: v, orbitPlay: false })}
            notches={[
              { at: 0, label: '0°', major: true },
              { at: 0.25, label: '90°' },
              { at: 0.5, label: '180°', major: true },
              { at: 0.75, label: '270°' },
              { at: 1, label: '360°', major: true },
            ]}
          />
        </div>
      </div>
      {beatIdx < 2 && (
        <div className="chips" style={{ marginTop: 12 }}>
          <Chip pressed={tool.noRotation} onClick={() => setTool({ noRotation: !tool.noRotation })}>
            Compare: a Moon that does not rotate
          </Chip>
        </div>
      )}
      {beatIdx === 3 && sim && (
        <div style={{ marginTop: 14 }}>
          <Readout
            items={[
              { k: 'Sub-Earth longitude', v: fmtLon(sim.subEarth.lon, 1), small: 'libration in longitude' },
              { k: 'Sub-Earth latitude', v: fmtLat(sim.subEarth.lat, 1), small: 'in latitude' },
            ]}
          />
        </div>
      )}
      <p className="note" style={{ marginTop: 12 }}>
        Educational scale: the Moon is drawn far closer to Earth than it really is. Sizes are true.
      </p>
    </div>
  )
}

export const sides: Chapter = {
  id: 'sides',
  num: '06',
  title: 'Near Side / Far Side',
  short: 'Near / far',
  kicker: 'Tidal locking',
  blurb: 'Why we always see the same face',
  glyph: 'sides',
  heightVh: 520,
  scrim: 'left',
  Tools: SidesTools,
  insetLabel: 'The Moon, seen from Earth',
  onEnter: (s) => s.setTool({ orbitPlay: true, orbitT: 0, noRotation: false }),
  beats: [
    {
      id: 'same-face',
      eyebrow: '06 — Near Side / Far Side',
      title: 'The *same face*.',
      body: [
        'The Moon spins exactly once for every trip around Earth, 27.32 days, so one hemisphere always faces us. This is tidal locking: over a long time, Earth’s tidal pull slowed the Moon’s spin until it matched its orbit.',
      ],
      data: [
        ['Rotation period', '27.32 days'],
        ['Orbital period', '27.32 days'],
      ],
      alt: 'Top-down view of the Moon orbiting Earth with an arrow on the Moon that always points at Earth.',
    },
    {
      id: 'turn',
      eyebrow: '06 — Near Side / Far Side',
      title: 'Watch it *turn*.',
      body: [
        'The amber arrow marks the near side. It always points at Earth, which means the Moon rotates once during each orbit. The grey arrow keeps one direction in space: a Moon that did not rotate would show us every side in turn.',
      ],
      alt: 'The amber arrow rotates once per orbit while the grey arrow stays fixed in space.',
    },
    {
      id: 'hidden',
      eyebrow: '06 — Near Side / Far Side',
      title: 'A hidden *hemisphere*.',
      body: [
        'Nobody saw the far side until Luna 3 photographed it in October 1959. It is a different world: thicker crust, almost no dark plains, and the huge, ancient South Pole–Aitken basin.',
      ],
      alt: 'The far side of the Moon in afternoon light: bright, heavily cratered highlands, the dark Mare Moscoviense and Tsiolkovskiy crater, and the terminator on the right.',
    },
    {
      id: 'libration',
      eyebrow: '06 — Near Side / Far Side',
      title: 'But we *peek*.',
      body: [
        'The orbit is elliptical and tilted, so the Moon appears to rock — libration — by up to about 8° in longitude and 7° in latitude. Over time we can see about 59 % of the surface from Earth.',
      ],
      note: 'The readouts are computed from the IAU rotation model and the lunar ephemeris.',
      alt: 'The Moon as seen from Earth, wobbling slightly so that features near the edge appear and disappear.',
    },
  ],
  scene(c) {
    const { p, beat, s, obs } = c
    p.starGain = 0.4
    // time along one sidereal orbit starting at the new moon of the anchor lunation
    if (s.tool.orbitPlay) {
      const v = (s.tool.orbitT + c.dt / (beat === 3 ? 26 : 18)) % 1
      useStore.getState().setTool({ orbitT: v })
    }
    const date0 = lunation().start
    p.date = date0 + s.tool.orbitT * SIDEREAL * DAY
    p.dateTau = 0.2
    const moonW = obs.moonPosWorld
    if (beat <= 1) {
      p.earthVisible = true
      p.eduMix = 1
      p.eduDist = 11
      p.sys.orbit = 1
      p.sys.spinMarker = 1
      p.sys.noRotationGhost = s.tool.noRotation ? 1 : 0
      p.sys.earthMoonLine = 0.5
      // fixed view of the whole orbit, centred on Earth, so the Moon can be followed round it
      p.cam = { kind: 'system', focus: new Vector3(0, 0, 0), az: 0.55, el: 1.0, dist: c.dist(60) }
      p.shift = c.layout.mobile || c.layout.portrait ? [0, 0.22] : [0.15, 0.08]
      p.starGain = 0.5
      p.fov = 30
      c.note('earth', new Vector3(0, 0, 0), 'Earth', undefined, { tone: 'earth', dx: -22, dy: 30 })
      c.note('moon', moonW, 'Moon', 'near side faces Earth', { tone: 'moon', dx: 18, dy: -20 })
      // the view from Earth never changes: the same face, every day of the month
      const dM = moonW.length()
      const fovI = (2 * Math.atan(1 / (0.8 * dM)) * 180) / Math.PI
      const m = c.layout.mobile || c.layout.portrait
      p.inset = { from: new Vector3(0, 0, 0), at: moonW.clone(), fov: fovI, up: new Vector3(0, 1, 0), x: m ? 0.22 : 0.85, y: m ? 0.79 : 0.72, r: m ? 0.1 : 0.14, hideEarth: true }
      return
    }
    if (beat === 2) {
      // afternoon Sun over the Mare Moscoviense / Tsiolkovskiy side, so craters and the terminator show their relief
      p.date = dateSubsolar(122)
      p.cam = { kind: 'surface', lon: 178, lat: 6, dist: c.dist(5.2) }
      c.compose('right', 0.9)
      c.landmarks(['tsiolkovskiy', 'spa'], { maxRank: 1 })
      return
    }
    // libration: standing on the Earth–Moon line, so the wobble is the real wobble
    p.cam = c.earthView(5.4)
    c.compose('right', 0.9)
    c.landmarks(['tycho', 'copernicus', 'orientale', 'grimaldi'], { maxRank: 3 })
    void dateLunation
    void dateSubsolar
  },
}
