import { Vector3 } from 'three'
import type { Chapter } from './types'
import { useStore } from '../store'
import { Seg, Readout } from '../ui/controls'
import { IconPulse } from '../ui/Icons'
import { useSim } from '../tools/useSim'
import { fmtKm, lunation, clamp } from './helpers'

const LIGHT_S = 1.2825
let pulseStart = -1
let pulseNonce = 0
let slow = false

function EarthMoonTools() {
  const { tool, setTool } = useStore()
  const sim = useSim()
  const km = sim?.distKm ?? 384400
  return (
    <div>
      <div className="tools-title">
        <span>Earth + Moon</span>
        <b>{tool.scale === 'true' ? 'true scale' : 'educational scale'}</b>
      </div>
      <Readout
        items={[
          { k: 'Distance', v: fmtKm(km), small: 'km' },
          { k: 'In Earth diameters', v: (km / 12742).toFixed(1) },
          { k: 'Light travel', v: (km / 299792.458).toFixed(2), small: 's' },
        ]}
      />
      <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Seg
          label="Scale"
          value={tool.scale}
          options={[
            { value: 'true', label: 'True scale' },
            { value: 'edu', label: 'Educational' },
          ]}
          onChange={(x) => setTool({ scale: x })}
        />
        <button
          className="btn"
          onClick={() => {
            slow = false
            setTool({ pulseNonce: tool.pulseNonce + 1 })
          }}
        >
          <IconPulse /> Send light
        </button>
        <button
          className="btn"
          onClick={() => {
            slow = true
            setTool({ pulseNonce: tool.pulseNonce + 1 })
          }}
        >
          <IconPulse /> ×10 slower
        </button>
      </div>
      <p className="note" style={{ marginTop: 10 }}>
        {tool.scale === 'edu' ? 'Educational scale: distance compressed ~9×; sizes true. The light pulse still takes 1.28 s.' : 'Everything here is to scale: Earth 12,742 km across, Moon 3,475 km.'}
      </p>
    </div>
  )
}

export const earthmoon: Chapter = {
  id: 'earthmoon',
  num: '10',
  title: 'Earth + Moon',
  short: 'Earth + Moon',
  kicker: 'Scale',
  blurb: 'How far away it really is',
  glyph: 'earthmoon',
  heightVh: 520,
  scrim: 'left',
  Tools: EarthMoonTools,
  onEnter: (s) => s.setTool({ scale: 'true' }),
  beats: [
    {
      id: 'basketball',
      eyebrow: '10 — Earth + Moon',
      title: 'To *scale*.',
      body: [
        'If Earth were a basketball, the Moon would be a tennis ball about seven metres away. Most diagrams cheat to fit the page. This one does not: switch between true and educational scale, and read the label that says which.',
      ],
      data: [
        ['Earth diameter', '12,742 km'],
        ['Moon diameter', '3,475 km  (27 %)'],
      ],
      alt: 'Earth and the Moon drawn to true scale: a large Earth, a small Moon, and a very wide gap of empty space between them.',
    },
    {
      id: 'thirty',
      eyebrow: '10 — Earth + Moon',
      title: 'Thirty Earths *fit between*.',
      body: [
        'On average, 30 Earths laid side by side would span the gap between our planet and the Moon. Each tick on the ruler is one Earth diameter.',
      ],
      data: [['Average distance', '≈ 30.2 Earth diameters']],
      alt: 'A ruler from Earth to the Moon with ticks marking each Earth diameter.',
    },
    {
      id: 'light',
      eyebrow: '10 — Earth + Moon',
      title: 'Light takes *1.3 seconds*.',
      body: [
        'Light crosses the gap in about 1.28 seconds. Press the button to send a pulse at true speed, or at a tenth of it. Apollo astronauts talked to Mission Control with that delay on every reply.',
      ],
      data: [['Light travel time', '≈ 1.28 s']],
      alt: 'A pulse of light travelling from Earth to the Moon.',
    },
    {
      id: 'tides',
      eyebrow: '10 — Earth + Moon',
      title: 'A slow *tug of war*.',
      body: [
        'The Moon’s gravity pulls Earth’s oceans into two bulges, one toward it and one away, giving most coasts two high tides a day. The drag of those tides is what slows Earth’s spin and pushes the Moon away.',
        'The bulge is hugely exaggerated here to be visible.',
      ],
      note: 'The real equilibrium tide is well under a metre. The drawn ellipsoid is not to scale.',
      alt: 'Earth with an exaggerated tidal bulge aligned with the direction of the Moon.',
    },
  ],
  scene(c) {
    const { p, beat, s, obs } = c
    const edu = s.tool.scale === 'edu'
    p.date = lunation().start + 6.2 * 86400000
    p.starGain = 0.5
    p.earthVisible = true
    p.eduMix = edu ? 1 : 0
    p.eduDist = 24
    p.sys.earthMoonLine = beat === 0 ? 0.5 : 0.3
    p.sys.distanceRuler = beat === 1 ? 1 : 0
    p.sys.tide = beat === 3 ? 1 : 0
    const m = c.layout.mobile || c.layout.portrait
    const mw = obs.moonPosWorld
    if (beat === 3) {
      const dir = mw.clone().normalize()
      p.cam = { kind: 'system', focus: new Vector3(0, 0, 0), az: Math.atan2(dir.x, dir.z) + 0.9, el: 0.9, dist: c.dist(m ? 30 : 22) }
      p.shift = m ? [0, 0.2] : [0.2, 0]
      c.note('moon', dir.clone().multiplyScalar(EARTH_R_FOR_NOTE * 1.6), 'Toward the Moon', undefined, { tone: 'moon', dx: 20, dy: -14, marker: false })
    } else {
      const span = edu ? 150 : 520
      p.cam = { kind: 'system', focus: new Vector3(0, 0, 0), follow: 'mid', az: 0.2, el: 0.3, dist: c.dist(span * (m ? 1.6 : 1)) }
      p.shift = m ? [0, 0.2] : [0.2, 0]
      p.fov = m ? 36 : 30
      c.note('earth', new Vector3(0, 0, 0), 'Earth', '12,742 km', { tone: 'earth', dx: -22, dy: 26 })
      c.note('moon', mw, 'Moon', '3,475 km', { tone: 'moon', dx: 22, dy: -26 })
    }
    // light pulse
    const nonce = s.tool.pulseNonce
    if (nonce !== pulseNonce) {
      pulseNonce = nonce
      pulseStart = c.now
    }
    let auto = -1
    if (beat === 2 && pulseStart < 0) pulseStart = c.now
    if (beat === 2 && pulseStart >= 0 && c.now - pulseStart > LIGHT_S * (slow ? 10 : 1) + 1.4) pulseStart = c.now
    if (pulseStart >= 0) auto = (c.now - pulseStart) / (LIGHT_S * (slow ? 10 : 1))
    p.sys.lightPulse = auto > 0 && auto < 1 ? clamp(auto, 0.001, 0.999) : 0
  },
}
const EARTH_R_FOR_NOTE = 3.667
