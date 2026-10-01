import { Vector3 } from 'three'
import type { Chapter } from './types'
import { useStore } from '../store'
import { Slider, Readout, Seg } from '../ui/controls'
import { IconPause, IconPlay } from '../ui/Icons'
import {
  nextLunarEclipses,
  nextSolarEclipses,
  skyAt,
  observerSystemPos,
  subPointOnEarth,
  type LunarEclipseEvent,
  type SolarEclipseEvent,
} from '../astro/ephemeris'
import { NOW, datePhase, clamp, sstep } from './helpers'
import { EARTH_R } from '../engine/Earth'
import { SUN_RADIUS_KM, AU_KM, MOON_RADIUS_KM } from '../astro/ephemeris'

const HOUR = 3600000
const R_SUN = SUN_RADIUS_KM / MOON_RADIUS_KM
const D_SUN = AU_KM / MOON_RADIUS_KM

let lunar: LunarEclipseEvent[] | null = null
let solar: SolarEclipseEvent[] | null = null
function lunarList() {
  return (lunar ??= nextLunarEclipses(new Date(NOW), 7))
}
function solarList() {
  return (solar ??= nextSolarEclipses(new Date(NOW), 7))
}
/** index of the most striking upcoming event: first total (lunar) / total (solar), else first non-penumbral */
function bestIndex(kind: 'lunar' | 'solar') {
  const l: { kind: string }[] = kind === 'lunar' ? lunarList() : solarList()
  const t = l.findIndex((e) => e.kind === 'total')
  if (t >= 0) return t
  const a = l.findIndex((e) => e.kind !== 'penumbral' && e.kind !== 'partial')
  return Math.max(0, a)
}

const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const fmtTime = (ms: number) => new Date(ms).toISOString().slice(11, 16) + ' UTC'

/** fraction of the Sun's disc covered by the Moon from a given observer (JS twin of the shader) */
function obscuration(rs: number, rm: number, d: number) {
  if (d >= rs + rm) return 0
  if (d <= Math.abs(rm - rs)) return rm >= rs ? 1 : (rm * rm) / (rs * rs)
  const a = (d * d + rs * rs - rm * rm) / (2 * d * rs)
  const b = (d * d + rm * rm - rs * rs) / (2 * d * rm)
  const k = (-d + rs + rm) * (d + rs - rm) * (d - rs + rm) * (d + rs + rm)
  const area = rs * rs * Math.acos(clamp(a, -1, 1)) + rm * rm * Math.acos(clamp(b, -1, 1)) - 0.5 * Math.sqrt(Math.max(k, 0))
  return clamp(area / (Math.PI * rs * rs), 0, 1)
}

let lastBeat = -1

function EclipseTools() {
  const { tool, setTool, beatIdx } = useStore()
  if (beatIdx === 3) return null
  const list: (LunarEclipseEvent | SolarEclipseEvent)[] = tool.eclipseKind === 'lunar' ? lunarList() : solarList()
  const ev = list[clamp(tool.eclipseIndex, 0, list.length - 1)]
  const win = tool.eclipseKind === 'lunar' ? 3.4 : 2.4
  const now = ev.peak.getTime() + tool.eclipseT * win * HOUR
  const lu = ev as LunarEclipseEvent
  const so = ev as SolarEclipseEvent
  return (
    <div>
      <div className="tools-title">
        <span>Eclipse simulator</span>
        <b>true scale</b>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <Seg
          label="Eclipse type"
          value={tool.eclipseKind}
          options={[
            { value: 'lunar', label: 'Lunar' },
            { value: 'solar', label: 'Solar' },
          ]}
          onChange={(v) => setTool({ eclipseKind: v, eclipseIndex: bestIndex(v), eclipseT: -0.7, eclipsePlay: true })}
        />
      </div>
      <div className="chips" style={{ margin: '12px 0' }}>
        {list.slice(0, 6).map((e, i) => (
          <button key={i} className="chip" aria-pressed={i === tool.eclipseIndex} onClick={() => setTool({ eclipseIndex: i, eclipseT: -0.7, eclipsePlay: true })}>
            {fmtDay(e.peak)} · {e.kind}
          </button>
        ))}
      </div>
      <Readout
        items={[
          { k: 'Moment', v: fmtTime(now) },
          tool.eclipseKind === 'lunar'
            ? { k: lu.kind === 'total' ? 'Totality' : lu.kind === 'partial' ? 'Partial phase' : 'Penumbral', v: lu.kind === 'total' ? `${Math.round(lu.semiTotalMin * 2)}` : `${Math.round(Math.max(lu.semiPartialMin, lu.semiPenumbralMin) * 2)}`, small: 'min' }
            : { k: 'Obscuration', v: so.obscuration !== undefined ? `${Math.round(so.obscuration * 100)}` : '—', small: '% at peak' },
        ]}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
        <button className="btn" aria-label={tool.eclipsePlay ? 'Pause' : 'Play'} onClick={() => setTool({ eclipsePlay: !tool.eclipsePlay })}>
          {tool.eclipsePlay ? <IconPause /> : <IconPlay />}
        </button>
        <div style={{ flex: 1 }}>
          <Slider
            label="Time through the eclipse"
            value={tool.eclipseT}
            min={-1}
            max={1}
            onChange={(v) => setTool({ eclipseT: v, eclipsePlay: false })}
            notches={[
              { at: -1, label: `−${win.toFixed(1)} h` },
              { at: 0, label: 'greatest', major: true },
              { at: 1, label: `+${win.toFixed(1)} h` },
            ]}
          />
        </div>
      </div>
      {tool.eclipseKind === 'solar' && so.kind && (
        <p className="note" style={{ marginTop: 10 }}>
          {so.kind[0].toUpperCase() + so.kind.slice(1)} solar eclipse
          {so.latitude !== undefined ? ` · greatest eclipse near ${Math.abs(so.latitude).toFixed(1)}°${so.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(so.longitude ?? 0).toFixed(1)}°${(so.longitude ?? 0) >= 0 ? 'E' : 'W'}` : ''}. The inset is the view from there.
        </p>
      )}
    </div>
  )
}

export const eclipses: Chapter = {
  id: 'eclipses',
  num: '08',
  title: 'Eclipses',
  short: 'Eclipses',
  kicker: 'Shadows in space',
  blurb: 'Real events, true-scale geometry',
  glyph: 'eclipses',
  heightVh: 520,
  scrim: 'left',
  Tools: EclipseTools,
  insetLabel: 'As seen from Earth',
  onEnter: (s) => {
    s.setTool({ eclipseKind: 'lunar', eclipseIndex: bestIndex('lunar'), eclipseT: -0.7, eclipsePlay: true })
    lastBeat = -1
  },
  beats: [
    {
      id: 'alignment',
      eyebrow: '08 — Eclipses',
      title: 'When three worlds *align*.',
      body: [
        'In a lunar eclipse the Moon passes into Earth’s shadow. In a solar eclipse the Moon’s small shadow sweeps across Earth. Both need the Sun, Earth and Moon in a line.',
        'These scenes are drawn at true scale, using the real dates of upcoming eclipses.',
      ],
      alt: 'Earth’s umbra and penumbra at the Moon’s distance as translucent bands, with the Moon approaching.',
    },
    {
      id: 'lunar',
      eyebrow: '08 — Eclipses',
      title: 'Into Earth’s *shadow*.',
      body: [
        'Earth’s shadow is nearly as wide as Earth itself, even at the Moon’s distance: the dark inner umbra is about 2.7 Moon-diameters across. Inside it, sunlight reaches the Moon only after passing through Earth’s atmosphere, which turns it copper-red.',
      ],
      data: [
        ['Umbra at the Moon', '≈ 9,200 km wide'],
        ['Penumbra', '≈ 16,000 km wide'],
      ],
      note: 'Shadow sizes from Sun–Earth–Moon geometry (Sun 695,700 km, Earth 6,371 km).',
      alt: 'The Moon crossing Earth’s umbra, turning dark red inside the shadow.',
    },
    {
      id: 'solar',
      eyebrow: '08 — Eclipses',
      title: 'A shadow *a few miles wide*.',
      body: [
        'The Moon is about 400 times smaller than the Sun and about 400 times closer, so the two discs look almost the same size. During a total eclipse, its umbra on Earth is at most about 270 km wide, racing across the globe at over a thousand kilometres per hour.',
      ],
      note: 'Inset: what an observer on the path sees, from the real Sun–Moon geometry at that moment.',
      alt: 'Earth seen from space with the Moon’s shadow as a small dark spot inside a larger penumbral shading; an inset shows the total eclipse with the Sun’s corona.',
    },
    {
      id: 'inclination',
      eyebrow: '08 — Eclipses',
      title: 'Why not every *month*?',
      body: [
        'The Moon’s orbit is tilted 5.1° to the plane of Earth’s orbit. Most months the Moon passes above or below Earth’s shadow at full Moon, and above or below the Sun at new Moon. Eclipses happen only near the two nodes where the orbits cross: in two “eclipse seasons” a year, about 173 days apart.',
      ],
      data: [
        ['Orbital tilt', '5.145°'],
        ['Eclipse seasons', 'about every 173 days'],
      ],
      alt: 'An edge-on view: the Moon’s orbit tilted against the ecliptic plane, with the Moon at full phase passing north or south of Earth’s shadow.',
    },
  ],
  scene(c) {
    const { p, beat, s, obs } = c
    const tool = s.tool
    if (beat !== lastBeat) {
      lastBeat = beat
      const st = useStore.getState()
      if (beat === 2) st.setTool({ eclipseKind: 'solar', eclipseIndex: bestIndex('solar'), eclipseT: -0.75, eclipsePlay: true })
      else if (beat <= 1) st.setTool({ eclipseKind: 'lunar', eclipseIndex: bestIndex('lunar'), eclipseT: -0.75, eclipsePlay: true })
    }
    p.starGain = 0.4
    p.earthVisible = true
    p.eduMix = 0
    p.sunVisible = true
    p.glare = 0.5
    const m = c.layout.mobile || c.layout.portrait
    if (beat === 3) {
      // edge-on view of the tilted orbit, at the full Moon of the current lunation (usually no eclipse)
      p.date = datePhase(180)
      p.dateTau = 0.5
      const sd = obs.sim.sunDir
      const anti = sd.clone().multiplyScalar(-1)
      const L = obs.moonPosWorld.dot(anti)
      const focus = anti.clone().multiplyScalar(L)
      focus.y += obs.moonPosWorld.y * 0.5
      p.sys.umbra = 1
      p.sys.umbraSpan = m ? 60 : 44
      p.sys.nodes = 1
      p.sys.orbit = 1
      p.cam = { kind: 'system', focus, az: Math.atan2(-sd.z, sd.x), el: 0.05, dist: c.dist(70) }
      p.shift = m ? [0, 0.18] : [0.12, 0]
      const y = obs.moonPosWorld.y * MOON_RADIUS_KM
      c.note('moon', obs.moonPosWorld, 'Full Moon', `${Math.abs(y).toLocaleString('en-US', { maximumFractionDigits: 0 })} km ${y >= 0 ? 'north' : 'south'} of the ecliptic`, { tone: 'moon', dx: 24, dy: -26 })
      c.note('umbra', anti.clone().multiplyScalar(L).add(new Vector3(0, 2.4, 0)), "Earth's umbra", 'at the Moon: ≈ 4,600 km radius', { tone: 'neutral', dx: -20, dy: -24 })
      return
    }
    const kind = tool.eclipseKind
    const list: (LunarEclipseEvent | SolarEclipseEvent)[] = kind === 'lunar' ? lunarList() : solarList()
    const ev = list[clamp(tool.eclipseIndex, 0, list.length - 1)]
    const win = kind === 'lunar' ? 3.4 : 2.4
    if (tool.eclipsePlay) {
      let t = tool.eclipseT + c.dt / 16
      if (t > 1) t = -1
      useStore.getState().setTool({ eclipseT: t })
    }
    const T = ev.peak.getTime()
    p.date = T + tool.eclipseT * win * HOUR
    p.dateTau = 0.14
    const sd = obs.sim.sunDir
    const anti = sd.clone().multiplyScalar(-1)
    const mw = obs.moonPosWorld
    if (kind === 'lunar') {
      p.sys.umbra = 1
      p.sys.umbraSpan = m ? 34 : 24
      const L = Math.max(mw.dot(anti), 100)
      const focus = anti.clone().multiplyScalar(L)
      // Sun on the left of the screen: the shadow runs off to the right
      p.cam = { kind: 'system', focus, az: Math.atan2(sd.z, -sd.x), el: 1.1, dist: c.dist(m ? 52 : 40) }
      p.shift = m ? [0, 0.2] : [0.14, 0]
      const perp = new Vector3(-anti.z, 0, anti.x).normalize()
      const rU = EARTH_R - (L * (R_SUN - EARTH_R)) / D_SUN
      const rP = EARTH_R + (L * (R_SUN + EARTH_R)) / D_SUN
      c.note('umbra', focus.clone().addScaledVector(perp, -rU * 0.9), 'Umbra', 'sunlight fully blocked', { tone: 'neutral', dx: 16, dy: -16, marker: false })
      c.note('pen', focus.clone().addScaledVector(perp, -rP * 0.88), 'Penumbra', 'partly blocked', { tone: 'neutral', dx: 16, dy: -16, marker: false })
      c.note('moon', mw, 'Moon', undefined, { tone: 'moon', dx: 22, dy: 22 })
      const dist = mw.length()
      const fov = (2 * Math.atan(1 / (0.8 * dist)) * 180) / Math.PI
      p.inset = { from: new Vector3(0, 0, 0), at: mw.clone(), fov, up: new Vector3(0, 1, 0), x: m ? 0.22 : 0.84, y: m ? 0.79 : 0.74, r: m ? 0.1 : 0.15, hideEarth: true }
    } else {
      p.sys.moonShadow = 1
      // camera on the Moon side of Earth (direction fixed at the moment of greatest eclipse), Earth fills the view
      const peak = skyAt(ev.peak)
      const dir = peak.moonPos.clone().normalize()
      // seen from the side: the Moon's shadow arrives from the left and touches Earth
      p.cam = { kind: 'system', focus: new Vector3(0, 0, 0), az: Math.atan2(dir.x, dir.z) + Math.PI / 2, el: 0.42, dist: c.dist(m ? 34 : 22) }
      p.shift = m ? [0, 0.2] : [0.1, 0]
      p.fov = m ? 36 : 30
      // observer inset: from the point of greatest eclipse
      const so = ev as SolarEclipseEvent
      let lat = so.latitude
      let lon = so.longitude
      if (lat === undefined || lon === undefined) {
        const sp = subPointOnEarth(new Date(p.date), mw)
        lat = sp.lat
        lon = sp.lon
      }
      const date = new Date(obs.simDateMs)
      const obsPos = observerSystemPos(date, lat, lon)
      const sunDir = obs.sim.sunDir
      p.inset = { from: obsPos, at: obsPos.clone().addScaledVector(sunDir, 100), fov: 2.6, up: new Vector3(0, 1, 0), x: m ? 0.22 : 0.84, y: m ? 0.79 : 0.74, r: m ? 0.1 : 0.15, hideEarth: true }
      // corona only when the photosphere is (almost) fully hidden
      const toMoon = mw.clone().sub(obsPos)
      const dm = toMoon.length()
      const rm = Math.asin(1 / dm)
      const rs = (obs.sim.sunAngDeg / 2) * (Math.PI / 180)
      const sep = Math.acos(clamp(toMoon.normalize().dot(sunDir), -1, 1))
      const ob = obscuration(rs, rm, sep)
      p.corona = sstep(0.985, 0.9995, ob)
      p.glare = 0.35 + 0.65 * (1 - p.corona)
      c.note('track', obsPos, so.kind === 'total' ? 'Path of totality' : 'Greatest eclipse', 'the Moon’s shadow on Earth', { tone: 'moon', dx: 26, dy: -26 })
    }
  },
}
