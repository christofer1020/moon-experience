import type { Chapter } from './types'
import { byId, CRATER_SET } from '../content/landmarks'
import { useStore } from '../store'
import { FeatureTool, FactList } from '../tools/FeatureTool'
import { datePhase, dateSubsolar, fmtCoord, framing, ringOf } from './helpers'
import { runImpact, impactActive } from './impact'
import { IconImpact } from '../ui/Icons'

function ImpactButton() {
  const sel = useStore((s) => s.selected)
  const bump = useStore((s) => s.setTool)
  const nonce = useStore((s) => s.tool.impactNonce)
  return (
    <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        className="btn"
        onClick={() => {
          if (!sel || sel.kind !== 'landmark') useStore.getState().set({ selected: { kind: 'landmark', id: 'tycho' } })
          bump({ impactNonce: nonce + 1 })
        }}
      >
        <IconImpact /> Replay the impact
      </button>
      <span className="cap">Educational · time compressed</span>
    </div>
  )
}

function CraterTools() {
  return (
    <FeatureTool
      title="Craters"
      kind="landmark"
      items={CRATER_SET.map((id) => {
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
              {l.meaning && <p className="note">Named for {l.meaning}.</p>}
            </>
          ),
        }
      }}
      extra={<ImpactButton />}
    />
  )
}

export const craters: Chapter = {
  id: 'craters',
  num: '04',
  title: 'Craters',
  short: 'Craters',
  kicker: 'Impact',
  blurb: 'Anatomy of an impact',
  glyph: 'craters',
  heightVh: 520,
  scrim: 'left',
  Tools: CraterTools,
  dimTextOnSelect: true,
  beats: [
    {
      id: 'sculptor',
      eyebrow: '04 — Craters',
      title: 'The Moon’s only *sculptor*.',
      body: [
        'With no weather to erase them, craters are only ever overprinted. A simple bowl up to roughly 15–20 km across grows, in bigger impacts, into a terraced crater with a central peak, and then into ringed basins hundreds of kilometres wide.',
      ],
      alt: 'The southern highlands saturated with overlapping craters near the terminator.',
    },
    {
      id: 'copernicus',
      eyebrow: '04 — Craters',
      title: 'Anatomy of *Copernicus*.',
      body: [
        'Terraced walls slump inward. The floor rebounds into a cluster of central peaks. Debris is thrown outward as a blanket and as rays that cross the mare for hundreds of kilometres.',
      ],
      data: [
        ['Diameter', '≈ 96 km'],
        ['Depth', '≈ 3.8 km'],
        ['Age', '≈ 800 million years'],
      ],
      alt: 'Copernicus crater near the terminator with long shadows, terraced walls and central peaks.',
    },
    {
      id: 'rays',
      eyebrow: '04 — Craters',
      title: 'Rays are a *clock*.',
      body: [
        'Fresh ejecta is bright. Solar wind and micrometeorites slowly darken it, so only the youngest craters keep conspicuous rays. Tycho, about 108 million years old, still throws rays more than a thousand kilometres.',
      ],
      note: 'Best seen near full Moon, when the Sun is overhead and shadows vanish.',
      alt: 'Tycho at full Moon, a bright crater with rays spreading across the southern hemisphere.',
    },
    {
      id: 'replay',
      eyebrow: '04 — Craters',
      title: 'Watch an *impact*.',
      body: [
        'A projectile at some 15–20 km/s excavates, in seconds, a crater roughly ten times its own width. Choose a crater and replay the event. Time and scale are compressed: this is a visualisation, not a simulation.',
      ],
      alt: 'An animated impact: an asteroid strikes the surface, a flash and shock ring expand, ejecta fall back, and a crater with bright rays forms.',
    },
  ],
  scene(c) {
    const { p, beat, s } = c
    p.starGain = 0.3
    const selId = s.selected?.kind === 'landmark' && CRATER_SET.includes(s.selected.id) ? s.selected.id : null
    let l = selId ? byId.get(selId)! : null
    if (!l) l = byId.get(beat === 1 ? 'copernicus' : beat === 2 || beat === 3 ? 'tycho' : 'clavius')!
    c.landmarks(CRATER_SET, { maxRank: 3 })
    if (beat === 3 || impactActive()) {
      if (selId || beat === 3) {
        const ownsCamera = runImpact(c, l)
        if (ownsCamera) {
          c.compose('right', 0.6)
          return
        }
      }
    }
    c.focus(l)
    p.rings = [ringOf(l, c.now, selId ? 1 : 0.7)]
    if (beat === 2 && !selId) p.date = datePhase(176)
    else p.date = dateSubsolar(l.lon + 72)
    if (beat === 0 && !selId) {
      p.cam = { kind: 'surface', lon: -14, lat: -48, dist: c.dist(1.9) }
      p.rings = []
    }
    c.compose('right', 0.85)
    void framing
  },
}
