import type { Chapter } from './types'
import { byId, SURFACE_SET } from '../content/landmarks'
import { useStore } from '../store'
import { FeatureTool, FactList } from '../tools/FeatureTool'
import { Chip } from '../ui/controls'
import { dateSubsolar, framing, fmtCoord, ringOf } from './helpers'

function SurfaceTools() {
  const tool = useStore((s) => s.tool)
  const setTool = useStore((s) => s.setTool)
  return (
    <FeatureTool
      title="Surface features"
      kind="landmark"
      items={SURFACE_SET.map((id) => {
        const l = byId.get(id)!
        return { id, name: l.name, meta: l.kind }
      })}
      dossier={(id) => {
        const l = byId.get(id)!
        return {
          kicker: `${l.kind} · ${fmtCoord(l.lon, l.lat)}`,
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
        <div className="chips" style={{ marginTop: 14 }}>
          <Chip pressed={tool.grid} onClick={() => setTool({ grid: !tool.grid })}>
            Graticule
          </Chip>
          <Chip pressed={tool.topo} onClick={() => setTool({ topo: !tool.topo })}>
            Topography
          </Chip>
          <Chip pressed={tool.labels} onClick={() => setTool({ labels: !tool.labels })}>
            Labels
          </Chip>
        </div>
      }
    />
  )
}

export const surface: Chapter = {
  id: 'surface',
  num: '02',
  title: 'Surface',
  short: 'Surface',
  kicker: 'Explorer',
  blurb: 'Ground truth from laser altimetry',
  glyph: 'surface',
  heightVh: 420,
  scrim: 'left',
  Tools: SurfaceTools,
  dimTextOnSelect: true,
  beats: [
    {
      id: 'two-grounds',
      eyebrow: '02 — Surface',
      title: 'Two kinds of *ground*.',
      body: [
        'Bright, rugged highlands are the Moon’s old crust. Dark, smooth maria are younger plains of lava. Hover a name to inspect it, or pick from the list.',
      ],
      alt: 'The near side with a few labelled features: Tycho, Copernicus, Aristarchus, Clavius, Plato, Grimaldi, Tsiolkovskiy, Orientale.',
    },
    {
      id: 'measured',
      eyebrow: '02 — Surface',
      title: 'Measured, not *modelled*.',
      body: [
        'The relief is real. LRO’s laser altimeter, LOLA, mapped elevation across the entire Moon. Switch on the topography layer: blue is deep, warm is high.',
        'From the floor of the South Pole–Aitken basin to a far-side summit the range is about 20 km.',
      ],
      data: [
        ['Lowest', '≈ −9.1 km'],
        ['Highest', '≈ +10.8 km'],
        ['Reference', 'sphere of 1,737.4 km'],
      ],
      note: 'Elevation: NASA LRO / LOLA, 64 px/deg. Colour is a visual aid, not a calibrated scale.',
      alt: 'The Moon coloured by elevation: deep basins in blue, highlands in warm colours, with 1 km contour lines.',
    },
    {
      id: 'dust',
      eyebrow: '02 — Surface',
      title: 'A fine *dust*.',
      body: [
        'Billions of years of micrometeorite impacts have ground the top of the Moon into regolith: a gritty, glassy soil metres deep. Without wind or water, Apollo’s boot prints are still there.',
      ],
      data: [['Site', 'Tranquility Base · 0.67°N 23.47°E']],
      alt: 'A close, low-Sun view of Mare Tranquillitatis and its small craters.',
    },
  ],
  scene(c) {
    const { p, beat, s } = c
    p.starGain = 0.35
    const sel = s.selected?.kind === 'landmark' ? byId.get(s.selected.id) : null
    if (sel) {
      c.focus(sel)
      p.date = dateSubsolar(sel.lon + 70)
      p.rings = [ringOf(sel, c.now)]
      c.compose('right', 0.85)
      c.landmarks('all')
      return
    }
    switch (beat) {
      case 0:
        p.cam = { kind: 'surface', lon: -12, lat: 14, dist: c.dist(4.6) }
        p.date = dateSubsolar(46)
        c.compose('right')
        c.landmarks(SURFACE_SET)
        p.idleSpin = 0.4
        break
      case 1:
        p.cam = { kind: 'surface', lon: 12, lat: 8, dist: c.dist(4.4) }
        p.date = dateSubsolar(40)
        p.topo = 1
        c.compose('right')
        c.landmarks(SURFACE_SET, { maxRank: 1 })
        break
      default:
        p.cam = { kind: 'surface', lon: 23.5, lat: 1.5, dist: c.dist(1.34) }
        p.date = dateSubsolar(100)
        c.compose('right', 0.7)
    }
    void framing
  },
}
