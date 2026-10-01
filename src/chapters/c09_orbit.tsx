import { Vector3 } from 'three'
import type { Chapter } from './types'
import { useStore } from '../store'
import { Slider, Readout, Seg } from '../ui/controls'
import { IconPause, IconPlay } from '../ui/Icons'
import { useSim } from '../tools/useSim'
import { lunation, fmtKm } from './helpers'

const SIDEREAL = 27.321661
const DAY = 86400000
const MU = 403503.2 // km³/s² (Earth + Moon)

function OrbitTools() {
  const { tool, setTool } = useStore()
  const sim = useSim()
  const d = sim?.distKm ?? 384400
  const v = Math.sqrt(MU * (2 / d - 1 / 384400))
  return (
    <div>
      <div className="tools-title">
        <span>Orbit now</span>
        <b>live from the ephemeris</b>
      </div>
      <Readout
        items={[
          { k: 'Distance', v: fmtKm(d), small: 'km' },
          { k: 'Apparent size', v: (sim?.moonAngDeg ?? 0.52).toFixed(3), small: '°' },
          { k: 'Speed', v: v.toFixed(3), small: 'km/s' },
        ]}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
        <button className="btn" aria-label={tool.orbitPlay ? 'Pause' : 'Play'} onClick={() => setTool({ orbitPlay: !tool.orbitPlay })}>
          {tool.orbitPlay ? <IconPause /> : <IconPlay />}
        </button>
        <div style={{ flex: 1 }}>
          <Slider label="Position along the orbit" value={tool.orbitT} onChange={(x) => setTool({ orbitT: x, orbitPlay: false })} notches={[{ at: 0, major: true }, { at: 0.5, major: true }, { at: 1, major: true }]} />
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Seg
          label="Scale"
          value={tool.scale}
          options={[
            { value: 'true', label: 'True scale' },
            { value: 'edu', label: 'Educational scale' },
          ]}
          onChange={(x) => setTool({ scale: x })}
        />
      </div>
      <p className="note" style={{ marginTop: 10 }}>
        {tool.scale === 'edu' ? 'Educational scale: the Moon’s distance is compressed about 9×; Earth and Moon keep their true sizes.' : 'True scale: the Moon is a speck. Switch to educational scale to see it.'}
      </p>
    </div>
  )
}

export const orbit: Chapter = {
  id: 'orbit',
  num: '09',
  title: 'Orbit',
  short: 'Orbit',
  kicker: 'Celestial mechanics',
  blurb: 'An ellipse, a tilt, a slow retreat',
  glyph: 'orbit',
  heightVh: 420,
  scrim: 'left',
  Tools: OrbitTools,
  onEnter: (s) => s.setTool({ orbitPlay: true, scale: 'edu' }),
  beats: [
    {
      id: 'ellipse',
      eyebrow: '09 — Orbit',
      title: 'An ellipse, *barely*.',
      body: [
        'The Moon’s path is an ellipse with an eccentricity of just 0.055. On average it ranges from 363,300 km at perigee to 405,500 km at apogee — a variation of about 11 %.',
        'The orbit drawn here is computed from the real lunar ephemeris.',
      ],
      data: [
        ['Eccentricity', '0.0549'],
        ['Mean perigee / apogee', '363,300 / 405,500 km'],
      ],
      alt: 'The Moon’s orbit around Earth drawn as a nearly circular ellipse, with perigee and apogee marked.',
    },
    {
      id: 'tilt',
      eyebrow: '09 — Orbit',
      title: 'Tilted by *five degrees*.',
      body: [
        'The orbit is inclined 5.145° to the ecliptic, the plane of Earth’s orbit around the Sun. The Moon crosses that plane twice a month, at the nodes. That tilt is why eclipses are rare.',
      ],
      data: [['Inclination', '5.145°']],
      alt: 'An oblique view of the Moon’s orbit tilted against the ecliptic plane, with the two nodes marked.',
    },
    {
      id: 'speed',
      eyebrow: '09 — Orbit',
      title: 'Faster near, *slower far*.',
      body: [
        'The Moon travels about 1 km/s, fastest at perigee. Its apparent diameter varies with distance — what is called a “supermoon” is a full Moon near perigee, only about 14 % larger across than at apogee.',
        'And the Moon is leaving: tidal friction pushes it away at about 3.8 cm a year, measured by bouncing lasers off reflectors left by Apollo crews.',
      ],
      data: [
        ['Mean speed', '1.022 km/s'],
        ['Recession', '≈ 3.8 cm / year'],
      ],
      note: 'Recession: lunar laser ranging. Apparent-size figure compares extreme perigee and apogee.',
      alt: 'The Moon at different points of its orbit with distance and apparent size readouts.',
    },
  ],
  scene(c) {
    const { p, beat, s, obs } = c
    const tool = s.tool
    if (tool.orbitPlay) useStore.getState().setTool({ orbitT: (tool.orbitT + c.dt / (beat === 2 ? 12 : 20)) % 1 })
    p.date = lunation().start + tool.orbitT * SIDEREAL * DAY
    p.dateTau = 0.2
    p.starGain = 0.45
    p.earthVisible = true
    const edu = tool.scale === 'edu'
    p.eduMix = edu ? 1 : 0
    p.eduDist = 24
    p.sys.orbit = 1
    p.sys.earthMoonLine = 0.35
    const m = c.layout.mobile || c.layout.portrait
    const R = edu ? 24 : 221
    const dist = (edu ? 110 : 900) * (m ? 1.25 : 1)
    p.sys.nodes = beat === 1 ? 1 : 0
    const el = beat === 1 ? 0.38 : 1.12
    p.cam = { kind: 'system', focus: new Vector3(0, 0, 0), az: beat === 1 ? 0.7 : 0.35, el, dist: c.dist(dist) }
    p.shift = m ? [0, 0.18] : [0.18, 0.0]
    p.fov = m ? 36 : 30
    c.note('earth', new Vector3(0, 0, 0), 'Earth', undefined, { tone: 'earth', dx: -22, dy: 24 })
    c.note('moon', obs.moonPosWorld, 'Moon', `${fmtKm(obs.sim.distKm)} km`, { tone: 'moon', dx: 20, dy: -22 })
    const ex = obs.overlay.perigeeApogee(p.eduMix, 24)
    if (ex && beat !== 1) {
      c.note('peri', ex.peri.pos, 'Perigee', `${fmtKm(ex.peri.km)} km`, { tone: 'sun', dx: 18, dy: 20 })
      c.note('apo', ex.apo.pos, 'Apogee', `${fmtKm(ex.apo.km)} km`, { tone: 'sun', dx: -18, dy: -20 })
    }
    if (beat === 1) {
      const np = obs.overlay.nodePositions
      c.note('n1', np[0], 'Node', 'orbit crosses the ecliptic', { tone: 'sun', dx: 16, dy: -18 })
      c.note('n2', np[1], 'Node', undefined, { tone: 'sun', dx: -16, dy: 18 })
    }
    void R
  },
}
