import type { Chapter } from './types'
import { MARIA, MARE_BY_KEY, MARIA_FACTS } from '../content/maria'
import { FeatureTool } from '../tools/FeatureTool'
import { dateSubsolar, distForFeature, fmtCoord, fmtKm } from './helpers'
import { labelId } from '../app/ids'

function mareDist(diameterKm: number) {
  return distForFeature(diameterKm, 0.5)
}

function MariaTools() {
  return (
    <FeatureTool
      title="Maria"
      kind="mare"
      items={MARIA.map((m) => ({ id: m.key, name: m.name.replace('Oceanus ', 'Oc. '), meta: `${fmtKm(m.diameterKm)} km` }))}
      dossier={(key) => {
        const m = MARE_BY_KEY.get(key)!
        return {
          kicker: `“${m.meaning}” · ${fmtCoord(m.lon, m.lat)}`,
          title: m.name,
          body: (
            <>
              <p>{m.note}</p>
              <dl className="data" style={{ maxWidth: 'none' }}>
                <div>
                  <dt>IAU diameter</dt>
                  <dd>{fmtKm(m.diameterKm)} km</dd>
                </div>
                {m.agesGa && (
                  <div>
                    <dt>Lava ages</dt>
                    <dd>{m.agesGa} Ga</dd>
                  </div>
                )}
                {m.visited && (
                  <div>
                    <dt>Visited</dt>
                    <dd>{m.visited}</dd>
                  </div>
                )}
              </dl>
              <p className="note">Outline is an approximate extent derived from LROC albedo, not a geologic map.</p>
            </>
          ),
        }
      }}
    />
  )
}

export const maria: Chapter = {
  id: 'maria',
  num: '03',
  title: 'Maria',
  short: 'Maria',
  kicker: 'The dark plains',
  blurb: 'Seas that are not seas',
  glyph: 'maria',
  heightVh: 520,
  scrim: 'left',
  Tools: MariaTools,
  dimTextOnSelect: true,
  beats: [
    {
      id: 'not-seas',
      eyebrow: '03 — Maria',
      title: 'Seas that are *not seas*.',
      body: [
        'To the first telescopes the dark patches looked like oceans. Galileo wondered, Kepler assumed, and in 1651 Riccioli named them: Showers, Tranquility, Serenity, Crises. The names stuck. The seas are dry plains of basalt.',
      ],
      alt: 'The near side with every mare outlined softly: Imbrium, Serenitatis, Tranquillitatis, Crisium, Fecunditatis, Nectaris, Nubium, Humorum, Frigoris, Procellarum and others.',
    },
    {
      id: 'floods',
      eyebrow: '03 — Maria',
      title: 'Floods of *lava*.',
      body: [
        'Most mare lava erupted between about 3.9 and 3.1 billion years ago, welling up through the crust and pooling in the great impact basins. Iron- and titanium-rich basalt is darker than highland rock, which is why the plains look dark.',
      ],
      data: [
        ['Coverage', '≈ 16 % of the Moon'],
        ['Near side', '≈ 31 %'],
        ['Far side', 'only a few %'],
      ],
      alt: 'Mare Imbrium outlined: a circular dark plain ringed by the Apennine and Alps mountains.',
    },
    {
      id: 'one-sided',
      eyebrow: '03 — Maria',
      title: 'Why mostly *one side*.',
      body: [
        'Turn the Moon over and the plains nearly vanish. The far-side crust is thicker — up to about 60 km, against roughly 40 km on the near side — so far fewer basin floors were breached. Why the Moon is lopsided is still debated.',
      ],
      note: 'Crustal thicknesses: NASA Science, “Moon Facts”.',
      alt: 'The far side with only a handful of small dark plains: Moscoviense, Ingenii and parts of Australe.',
    },
    {
      id: 'youngest',
      eyebrow: '03 — Maria',
      title: 'The youngest *flows*.',
      body: [
        'In 2020 Chang’e-5 returned basalt from Oceanus Procellarum that crystallised only 2.03 billion years ago — nearly a billion years younger than any Apollo sample. Crater counts suggest some lavas may be younger still.',
      ],
      data: [['Youngest dated basalt', '2.03 billion years']],
      note: 'Li et al. 2021, Nature; Che et al. 2021, Science.',
      alt: 'Oceanus Procellarum outlined: the largest dark region, covering much of the western near side.',
    },
  ],
  scene(c) {
    const { p, beat, s } = c
    p.starGain = 0.3
    p.shadows = true
    const sel = s.selected?.kind === 'mare' ? MARE_BY_KEY.get(s.selected.id) : null
    const hov = s.hover?.kind === 'mare' ? MARE_BY_KEY.get(s.hover.id) : null
    p.mask = 1
    if (hov && hov !== sel) p.maskHover = [hov.id]
    for (const m of MARIA) {
      c.labels.push({
        id: labelId('mare', m.key),
        text: m.name,
        sub: `${fmtKm(m.diameterKm)} km`,
        lon: m.lon,
        lat: m.lat,
        priority: m.diameterKm / 100,
        kind: 'mare',
        active: sel === m,
        hover: hov === m,
        marker: 'none',
        minFacing: 0.2,
      })
    }
    let target = sel
    let view: { lon: number; lat: number; dist: number } | null = null
    if (!target) {
      if (beat === 1) target = MARE_BY_KEY.get('imbrium')!
      else if (beat === 3) target = MARE_BY_KEY.get('procellarum')!
    }
    if (target) {
      view = { lon: target.lon, lat: target.lat, dist: mareDist(target.diameterKm) }
      p.maskSel = [target.id]
      p.date = dateSubsolar(target.lon + 64)
    } else if (beat === 2) {
      view = { lon: 176, lat: 10, dist: 4.8 }
      p.maskSel = MARIA.map((m) => m.id)
      p.date = dateSubsolar(128)
    } else {
      view = { lon: -10, lat: 14, dist: 4.8 }
      p.maskSel = MARIA.map((m) => m.id)
      p.date = dateSubsolar(44)
      p.idleSpin = 0.3
    }
    p.cam = { kind: 'surface', lon: view.lon, lat: view.lat, dist: c.dist(view.dist) }
    c.compose('right', sel ? 0.8 : 1)
    p.mask = sel || target ? 1 : 0.7
    void MARIA_FACTS
  },
}
