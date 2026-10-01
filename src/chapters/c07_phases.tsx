import { Vector3 } from 'three'
import type { Chapter } from './types'
import { useStore } from '../store'
import { Slider, Readout, Chip } from '../ui/controls'
import { IconPause, IconPlay } from '../ui/Icons'
import { useSim } from '../tools/useSim'
import { dateLunation, quarterFractions, lunation } from './helpers'
import { PHASE_NAMES, phaseName } from '../astro/ephemeris'

const STARTS = [0, 45, 90, 135, 180, 225, 270, 315]

/** lunation fraction at which the elongation phase is `deg` (linear interpolation across the anchor lunation) */
function uForPhase(deg: number) {
  const q = quarterFractions() // fractions of new, FQ, full, LQ
  const pts = [0, ...q.slice(1), 1]
  const degs = [0, 90, 180, 270, 360]
  const d = ((deg % 360) + 360) % 360
  for (let i = 0; i < 4; i++) if (d >= degs[i] && d <= degs[i + 1]) return pts[i] + ((d - degs[i]) / 90) * (pts[i + 1] - pts[i])
  return 0
}

const BEAT_PHASE = [0, 90, 180, 270]
let lastBeat = -1

function PhaseTools() {
  const { tool, setTool } = useStore()
  const sim = useSim()
  const q = quarterFractions()
  const inLun = lunation()
  void inLun
  return (
    <div>
      <div className="tools-title">
        <span>Phase simulator</span>
        <b>real Sun–Earth–Moon geometry</b>
      </div>
      {sim && (
        <Readout
          items={[
            { k: 'Phase', v: phaseName(sim.phaseDeg) },
            { k: 'Illuminated', v: `${(sim.illumination * 100).toFixed(0)}`, small: '%' },
            { k: 'Age', v: sim.ageDays.toFixed(1), small: 'days' },
          ]}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
        <button className="btn" aria-label={tool.playing ? 'Pause' : 'Play'} onClick={() => setTool({ playing: !tool.playing })}>
          {tool.playing ? <IconPause /> : <IconPlay />}
        </button>
        <div style={{ flex: 1 }}>
          <Slider
            label="Moment in the lunar month"
            value={tool.lunation}
            onChange={(v) => setTool({ lunation: v, playing: false })}
            notches={[
              { at: 0, label: 'new', major: true },
              { at: q[1], label: '1st qtr', major: true },
              { at: q[2], label: 'full', major: true },
              { at: q[3], label: 'last qtr', major: true },
              { at: 1, label: 'new', major: true },
            ]}
            valueText={sim ? `${phaseName(sim.phaseDeg)}, ${(sim.illumination * 100).toFixed(0)} percent illuminated` : undefined}
          />
        </div>
      </div>
      <div className="chips" style={{ marginTop: 14 }}>
        {PHASE_NAMES.map((n, i) => (
          <Chip key={n} pressed={!!sim && Math.floor(((sim.phaseDeg + 22.5) % 360) / 45) === i} onClick={() => setTool({ lunation: uForPhase(STARTS[i]), playing: false })}>
            {n}
          </Chip>
        ))}
      </div>
    </div>
  )
}

export const phases: Chapter = {
  id: 'phases',
  num: '07',
  title: 'Phases',
  short: 'Phases',
  kicker: 'Simulator',
  blurb: 'Scrub a month of light',
  glyph: 'phases',
  heightVh: 520,
  scrim: 'left',
  Tools: PhaseTools,
  wideTools: false,
  insetLabel: 'As seen from Earth',
  onEnter: (s) => {
    s.setTool({ playing: false, lunation: 0.02 })
    lastBeat = -1
  },
  beats: [
    {
      id: 'half',
      eyebrow: '07 — Phases',
      title: 'Half is always *lit*.',
      body: [
        'The Sun lights half of the Moon at all times. What changes is how much of that lit half we can see from Earth, as the Moon travels around us once every 29.5 days.',
        'Below, the Moon orbits Earth under parallel sunlight. The inset shows the view from Earth.',
      ],
      alt: 'Top-down diagram of the Moon at new moon between Earth and the Sun; the inset shows a dark Moon.',
    },
    {
      id: 'quarter',
      eyebrow: '07 — Phases',
      title: 'A quarter of the way *round*.',
      body: [
        'At first quarter the Moon is a quarter of the way around its orbit. From Earth we look at it side-on, so half of the near side is lit: the terminator runs straight down the middle.',
      ],
      alt: 'The Moon at first quarter; from Earth, the right half is lit.',
    },
    {
      id: 'full',
      eyebrow: '07 — Phases',
      title: 'The Sun behind *us*.',
      body: [
        'At full Moon, Earth is roughly between the Sun and the Moon, so we see the entire lit hemisphere. It is not Earth’s shadow that makes phases: the Moon almost always passes above or below it.',
      ],
      alt: 'The Moon at full phase: the whole near side is lit.',
    },
    {
      id: 'month',
      eyebrow: '07 — Phases',
      title: 'Why *29.5* days.',
      body: [
        'The Moon circles Earth in 27.32 days, but while it does, Earth moves along its own orbit. The Moon needs about two more days to catch up with the Sun’s apparent position: the 29.53-day synodic month that sets the cycle of phases.',
      ],
      data: [
        ['Sidereal month', '27.32 days'],
        ['Synodic month', '29.53 days'],
      ],
      alt: 'Waning phase: the Moon after full, lit on its left side.',
    },
  ],
  scene(c) {
    const { p, beat, s, obs } = c
    // beats drive the dial once when they change; the user can then scrub freely
    if (beat !== lastBeat) {
      lastBeat = beat
      useStore.getState().setTool({ lunation: uForPhase(BEAT_PHASE[beat] + (beat === 0 ? 4 : 0)) })
    }
    if (s.tool.playing) {
      let v = s.tool.lunation + c.dt / 24
      if (v > 1) v -= 1
      useStore.getState().setTool({ lunation: v })
    }
    p.date = dateLunation(s.tool.lunation)
    p.dateTau = 0.22
    p.starGain = 0.45
    p.earthVisible = true
    p.eduMix = 1
    p.eduDist = 24
    p.sys.orbit = 1
    p.sys.sunRay = 1
    p.sys.earthMoonLine = 0.4
    p.sys.terminator = 0
    const sd = obs.sim.sunDir
    // Sun-locked frame: sunlight always arrives from the right of the screen
    const az = Math.atan2(-sd.z, sd.x)
    const m = c.layout.mobile || c.layout.portrait
    p.cam = { kind: 'system', focus: new Vector3(0, 0, 0), az, el: 1.12, dist: c.dist(m ? 130 : 108) }
    p.shift = m ? [0, 0.16] : [0.06, 0.02]
    p.fov = m ? 36 : 30
    const mw = obs.moonPosWorld
    c.note('earth', new Vector3(0, 0, 0), 'Earth', undefined, { tone: 'earth', dx: -26, dy: 26 })
    c.note('moon', mw, 'Moon', undefined, { tone: 'moon', dx: 18, dy: -22 })
    c.note('sun', sd.clone().multiplyScalar(obs.orbitRadiusHint() * 1.28), 'To the Sun', 'parallel rays', { tone: 'sun', dx: -16, dy: 30, marker: false })
    // observer view from Earth
    const dist = mw.length()
    const fov = (2 * Math.atan(1 / (0.8 * dist)) * 180) / Math.PI
    p.inset = { from: new Vector3(0, 0, 0), at: mw.clone(), fov, up: new Vector3(0, 1, 0), x: m ? 0.22 : 0.84, y: m ? 0.79 : 0.74, r: m ? 0.1 : 0.15, hideEarth: true }
  },
}
