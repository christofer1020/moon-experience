import type { Chapter } from './types'
import { FACT_GROUPS, SOURCES } from '../content/facts'

function FactsPanel() {
  return (
    <div className="facts" data-ui tabIndex={0} aria-label="Fact sheet">
      {FACT_GROUPS.map((g) => (
        <section className="facts-group" key={g.title}>
          <h3>{g.title}</h3>
          <dl>
            {g.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>
                  {f.value} {f.unit && <small style={{ display: 'inline', marginLeft: 4 }}>{f.unit}</small>}
                  {f.note && <small>{f.note}</small>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <section className="facts-group">
        <h3>Sources &amp; credits</h3>
        <p className="note" style={{ marginBottom: 12 }}>
          Imagery and elevation: NASA LRO (LROC and LOLA teams), via the NASA SVS “CGI Moon Kit” by Ernie Wright — public domain, optimised for aesthetics rather than science. Positions and phases: astronomy-engine and the IAU lunar rotation model. Stars: HYG database (CC BY-SA 4.0). Earth: NASA Blue Marble / Black Marble.
        </p>
        <ul>
          {SOURCES.map((s) => (
            <li key={s.url} style={{ padding: '6px 0', borderBottom: '1px solid var(--hair)' }}>
              <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--bone-2)' }}>
                {s.name}
              </a>
              <div className="cap" style={{ marginTop: 2 }}>{s.use}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export const facts: Chapter = {
  id: 'facts',
  num: '15',
  title: 'Facts',
  short: 'Facts',
  kicker: 'Fact sheet',
  blurb: 'The numbers, with their sources',
  glyph: 'facts',
  heightVh: 240,
  scrim: 'left',
  Tools: FactsPanel,
  bareTools: true,
  beats: [
    {
      id: 'numbers',
      eyebrow: '15 — Facts',
      title: 'The Moon, in *numbers*.',
      body: ['Everything quoted on this site, in one place. Figures come from the NASA Moon Fact Sheet, NASA Science and the LRO mission teams; where a value is an estimate or debated, it says so.'],
      alt: 'The Moon slowly turning, coloured by elevation.',
    },
    {
      id: 'credits',
      eyebrow: '15 — Facts',
      title: 'Where this *came from*.',
      body: ['Real data, not artwork: the shape of the Moon is laser-measured; its colours are imaged by LRO; the Sun, Earth and Moon move on a real ephemeris. Simplifications (compressed distances, exaggerated tides, approximate mare outlines) are labelled where they appear.'],
      alt: 'The Moon coloured by elevation next to the list of data sources.',
    },
  ],
  scene(c) {
    const { p, beat } = c
    p.starGain = 0.3
    p.date = (c.s.tool.calendarDate ?? Date.now()) as number
    p.date = Date.now()
    p.cam = { kind: 'surface', lon: 0, lat: 10, dist: c.dist(4.3) }
    p.idleSpin = 3
    p.topo = beat === 1 ? 0.85 : 0
    c.compose('left', 0.9)
    if (c.layout.mobile || c.layout.portrait) c.compose('top', 1)
  },
}
