import type { Chapter } from './types'
import { useStore } from '../store'
import { Slider, Readout } from '../ui/controls'
import { IconPause, IconPlay } from '../ui/Icons'
import { useSim, sunElevation, lunarDayFraction } from '../tools/useSim'
import { byId } from '../content/landmarks'
import { dateLunation, datePhase, dateSubsolar, ringOf, lerp } from './helpers'
import { Chip } from '../ui/controls'

const SITES = [
  { id: 'tranquility', name: 'Tranquility Base', lon: 23.47298, lat: 0.67409 },
  { id: 'plato', name: 'Plato', lon: -9.382, lat: 51.619 },
  { id: 'tycho', name: 'Tycho', lon: -11.215, lat: -43.296 },
]
let siteIdx = 0

function DayTools() {
  const { tool, setTool } = useStore()
  const sim = useSim()
  const site = SITES[siteIdx]
  const elev = sim ? sunElevation(site.lat, site.lon, sim.subSolar) : 0
  const frac = sim ? lunarDayFraction(site.lon, sim.subSolar) : 0
  const daylight = frac < 0.5
  const days = frac * 29.53
  return (
    <div>
      <div className="tools-title">
        <span>Lunar day at</span>
        <b>{site.name}</b>
      </div>
      <Readout
        items={[
          { k: 'Sun elevation', v: `${elev >= 0 ? '' : '−'}${Math.abs(elev).toFixed(1)}°`, small: elev >= 0 ? 'above horizon' : 'below horizon' },
          { k: daylight ? 'Since sunrise' : 'Since sunset', v: (daylight ? days : days - 14.77).toFixed(1), small: 'Earth days' },
        ]}
      />
      <div style={{ margin: '14px 0 2px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button className="btn" aria-label={tool.dayPlay ? 'Pause' : 'Play'} onClick={() => setTool({ dayPlay: !tool.dayPlay })}>
          {tool.dayPlay ? <IconPause /> : <IconPlay />}
          {tool.dayPlay ? 'Pause' : 'Play'}
        </button>
        <div style={{ flex: 1 }}>
          <Slider
            label="Time through one lunation"
            value={tool.dayT}
            onChange={(v) => setTool({ dayT: v, dayPlay: false })}
            notches={[
              { at: 0, label: 'new', major: true },
              { at: 0.25, label: '¼' },
              { at: 0.5, label: 'full', major: true },
              { at: 0.75, label: '¾' },
              { at: 1, label: 'new', major: true },
            ]}
            valueText={`${Math.round(tool.dayT * 29.5)} days into the cycle`}
          />
        </div>
      </div>
      <div className="chips" style={{ marginTop: 10 }}>
        {SITES.map((s, i) => (
          <Chip
            key={s.id}
            pressed={i === siteIdx}
            onClick={() => {
              siteIdx = i
              setTool({ dayT: tool.dayT })
            }}
          >
            {s.name}
          </Chip>
        ))}
      </div>
      <p className="note" style={{ marginTop: 12 }}>
        Sun elevation is computed from the real Sun–Moon geometry for the instant shown.
      </p>
    </div>
  )
}

export const day: Chapter = {
  id: 'day',
  num: '05',
  title: 'The Lunar Day',
  short: 'Lunar day',
  kicker: 'Sunrise to sunrise',
  blurb: 'One day lasts a month',
  glyph: 'day',
  heightVh: 400,
  scrim: 'left',
  Tools: DayTools,
  onEnter: (s) => s.setTool({ dayPlay: true, dayT: 0.02 }),
  beats: [
    {
      id: 'month',
      eyebrow: '05 — The Lunar Day',
      title: 'One day, one *month*.',
      body: [
        'The Moon turns once per orbit, so from sunrise to the next sunrise the Sun takes about 29.5 Earth days to cross the lunar sky: roughly two weeks of daylight, then two weeks of night.',
        'Watch the terminator — the line between day and night — sweep across the surface.',
      ],
      data: [
        ['Sunrise to sunrise', '≈ 29.53 days'],
        ['Daylight', '≈ 14.8 days'],
        ['Sun speed in the sky', '≈ 0.5° per hour'],
      ],
      alt: 'The Moon cycling through a full lunation: the lit side grows and the terminator crosses the disc.',
    },
    {
      id: 'shadows',
      eyebrow: '05 — The Lunar Day',
      title: 'Shadows that *crawl*.',
      body: [
        'Near the terminator the Sun is low, shadows are long and every crater rim stands out. At local noon shadows nearly vanish and the ground looks flat. Apollo crews landed in the lunar morning for exactly this reason: the low Sun reveals hazards and keeps temperatures moderate.',
      ],
      alt: 'Plato crater at sunrise with long shadows from its rim falling across its dark floor; the shadows shorten as the Sun climbs.',
    },
    {
      id: 'extremes',
      eyebrow: '05 — The Lunar Day',
      title: 'No air to hold the *heat*.',
      body: [
        'With no atmosphere to carry warmth, the temperature follows the Sun almost instantly: about 127 °C at noon, down to about −173 °C at night.',
      ],
      data: [
        ['Daytime', '≈ +127 °C'],
        ['Night', '≈ −173 °C'],
      ],
      note: 'Source: NASA Science, “Moon Facts” (equatorial extremes).',
      alt: 'The Moon at local noon, bright with almost no shadows.',
    },
  ],
  scene(c) {
    const { p, beat, s } = c
    p.starGain = 0.3
    const site = SITES[siteIdx]
    if (beat === 0) {
      if (s.tool.dayPlay) {
        const v = (s.tool.dayT + c.dt / 22) % 1
        useStore.getState().setTool({ dayT: v })
      }
      p.date = dateLunation(s.tool.dayT)
      p.cam = { kind: 'surface', lon: 0, lat: 14, dist: c.dist(5.2) }
      p.dateTau = 0.25
      c.compose('right', 0.9)
      return
    }
    if (beat === 1) {
      const pl = byId.get('plato')!
      const u = c.free ? 0.5 + 0.5 * Math.sin(c.now * 0.18 - 1.2) : Math.min(1, c.bt * 1.1)
      p.cam = { kind: 'surface', lon: pl.lon + 6, lat: pl.lat - 4, dist: c.dist(1.85) }
      p.date = dateSubsolar(pl.lon + lerp(88, 22, u))
      p.dateTau = 0.2
      p.rings = [ringOf(pl, c.now, 0.5)]
      p.shadowReach = 0.09
      c.compose('right', 0.8)
      c.landmarks(['plato'])
      void site
      return
    }
    p.cam = { kind: 'surface', lon: 0, lat: 10, dist: c.dist(5.2) }
    p.date = datePhase(180)
    c.compose('right', 0.9)
  },
}
