import type { Chapter } from './types'
import { useStore } from '../store'
import { byId, POLE_FEATURES } from '../content/landmarks'
import { FeatureTool, FactList } from '../tools/FeatureTool'
import { Seg } from '../ui/controls'
import { IconPause, IconPlay } from '../ui/Icons'
import { lunation, fmtCoord, ringOf, framing, clamp } from './helpers'

const SOUTH = POLE_FEATURES.filter((id) => (byId.get(id)?.lat ?? 0) < 0)
const NORTH = POLE_FEATURES.filter((id) => (byId.get(id)?.lat ?? 0) > 0)

function PoleTools() {
  const { tool, setTool } = useStore()
  const ids = tool.pole === 'south' ? SOUTH : NORTH
  return (
    <FeatureTool
      title={`${tool.pole === 'south' ? 'South' : 'North'} polar craters`}
      kind="landmark"
      items={ids.map((id) => {
        const l = byId.get(id)!
        return { id, name: l.name, meta: `${Math.round(l.diameterKm)} km` }
      })}
      dossier={(id) => {
        const l = byId.get(id)!
        return {
          kicker: `crater · ${fmtCoord(l.lon, l.lat)}`,
          title: l.name,
          body: (
            <>
              <p>{l.summary}</p>
              <FactList facts={l.facts} />
            </>
          ),
        }
      }}
      extra={
        <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Seg
            label="Pole"
            value={tool.pole}
            options={[
              { value: 'south', label: 'South' },
              { value: 'north', label: 'North' },
            ]}
            onChange={(v) => setTool({ pole: v })}
          />
          <button className="btn" aria-label={tool.dayPlay ? 'Pause the Sun' : 'Move the Sun'} onClick={() => setTool({ dayPlay: !tool.dayPlay })}>
            {tool.dayPlay ? <IconPause /> : <IconPlay />}
            Sun {tool.dayPlay ? 'moving' : 'paused'}
          </button>
        </div>
      }
    />
  )
}

export const poles: Chapter = {
  id: 'poles',
  num: '13',
  title: 'The Poles',
  short: 'Poles',
  kicker: 'Light and ice',
  blurb: 'Where the Sun never climbs',
  glyph: 'poles',
  heightVh: 520,
  scrim: 'left',
  Tools: PoleTools,
  dimTextOnSelect: true,
  onEnter: (s) => s.setTool({ dayPlay: true, pole: 'south', dayT: 0.1 }),
  beats: [
    {
      id: 'low-sun',
      eyebrow: '13 — The Poles',
      title: 'Where the Sun never *climbs*.',
      body: [
        'The Moon’s axis is tilted only about 1.5° from upright. At the poles the Sun therefore never rises more than a degree or two above the horizon, and over a month it simply circles it, casting shadows that reach for tens of kilometres.',
        'This view is lit by the real geometry. Watch the shadows sweep round the pole.',
      ],
      data: [['Axial tilt (to the ecliptic)', '≈ 1.54°']],
      alt: 'The south polar region seen from above, lit by a Sun just above the horizon; long shadows rotate around the pole over a lunar day.',
    },
    {
      id: 'dark',
      eyebrow: '13 — The Poles',
      title: 'Floors that never *see light*.',
      body: [
        'Some crater floors are so deep, and the Sun so low, that sunlight has not reached them for billions of years. These permanently shadowed regions are among the coldest places measured in the Solar System: about −248 °C at the floor of Hermite crater, near the north pole.',
      ],
      data: [
        ['Coldest measured', '≈ −248 °C'],
        ['Instrument', 'LRO Diviner'],
      ],
      note: 'Source: NASA, LRO Diviner results.',
      alt: 'Crater floors near the south pole that stay black as the Sun circles the horizon.',
    },
    {
      id: 'ice',
      eyebrow: '13 — The Poles',
      title: 'Ice in the *dark*.',
      body: [
        'In October 2009 NASA’s LCROSS spacecraft struck the permanently shadowed floor of Cabeus crater and a following probe flew through the plume. It detected water vapour and ice: roughly 5.6 ± 2.9 % water ice by mass in the debris.',
      ],
      data: [['LCROSS plume estimate', '5.6 ± 2.9 % water ice']],
      note: 'Colaprete et al. 2010, Science.',
      alt: 'Cabeus crater near the south pole, target of the LCROSS impact.',
    },
    {
      id: 'light',
      eyebrow: '13 — The Poles',
      title: 'And peaks of *light*.',
      body: [
        'A few high points on crater rims are lit for most of the lunar year. Near the south pole, sunlight can stay on for more than 200 days at a stretch — a place for solar power, a short walk from ice. That combination is why so many missions are heading there.',
      ],
      note: 'NASA: “More than 200 Earth days of constant illumination at the southern pole”.',
      alt: 'The rim of Shackleton crater lit by the low Sun while its interior remains dark.',
    },
  ],
  scene(c) {
    const { p, beat, s } = c
    const tool = s.tool
    const south = tool.pole === 'south'
    if (tool.dayPlay) useStore.getState().setTool({ dayT: (tool.dayT + c.dt / 26) % 1 })
    p.date = lunation().start + tool.dayT * 29.53 * 86400000
    p.dateTau = 0.2
    p.starGain = 0.3
    p.shadowReach = 0.17
    p.exposure = 1.2
    const sel = s.selected?.kind === 'landmark' ? byId.get(s.selected.id) : null
    const hl = beat === 1 ? byId.get(south ? 'shackleton' : 'hermite') : beat === 2 ? byId.get('cabeus') : beat === 3 ? byId.get('shackleton') : null
    c.landmarks(south ? SOUTH : NORTH, { maxRank: 3, unlit: true })
    if (sel && POLE_FEATURES.includes(sel.id)) {
      p.cam = { kind: 'surface', lon: sel.lon, lat: clamp(sel.lat, -89.4, 89.4), dist: c.dist(framing(sel) + 0.25) }
      p.rings = [ringOf(sel, c.now, 1)]
      c.compose('right', 0.85)
      return
    }
    const lat = south ? -89.5 : 89.5
    if (beat >= 1 && hl && ((beat === 1 && south) || beat >= 2)) {
      const tgt = beat === 1 && !south ? byId.get('hermite')! : hl
      p.cam = { kind: 'surface', lon: tgt.lon, lat: clamp(tgt.lat, -89.4, 89.4), dist: c.dist(2.0) }
      p.rings = [ringOf(tgt, c.now, 0.8)]
    } else {
      p.cam = { kind: 'surface', lon: south ? 15 : -20, lat, dist: c.dist(3.0) }
    }
    c.compose('right', 0.9)
  },
}
