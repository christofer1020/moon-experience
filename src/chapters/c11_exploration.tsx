import type { Chapter, Beat } from './types'
import { useStore } from '../store'
import { TIMELINE, MISSION_BY_ID, type TimelineEvent } from '../content/missions'
import { engine } from '../app/engine'
import { IconNext, IconPrev } from '../ui/Icons'
import { datePhase, dateSubsolar, lerp, ringOf, clamp } from './helpers'
import { labelId } from '../app/ids'

const CH_INDEX = 10

function Timeline() {
  const { beatIdx } = useStore()
  const n = TIMELINE.length
  return (
    <div>
      <div className="tools-title">
        <span>Timeline of lunar exploration</span>
        <span>
          <button className="chip" aria-label="Previous event" onClick={() => engine.scroll?.goTo(CH_INDEX, Math.max(0, beatIdx - 1))}>
            <IconPrev width={12} height={12} style={{ verticalAlign: '-2px' }} />
          </button>
          <b>
            {' '}
            {beatIdx + 1} / {n}{' '}
          </b>
          <button className="chip" aria-label="Next event" onClick={() => engine.scroll?.goTo(CH_INDEX, Math.min(n - 1, beatIdx + 1))}>
            <IconNext width={12} height={12} style={{ verticalAlign: '-2px' }} />
          </button>
        </span>
      </div>
      <div className="timeline-inner" role="list" aria-label="Events">
        <div className="tl-line" />
        {TIMELINE.map((e, i) => (
          <button
            key={e.id}
            role="listitem"
            className="tl-ev"
            style={{ left: `${(i / (n - 1)) * 100}%`, width: 'auto', minWidth: 28 }}
            aria-current={i === beatIdx}
            aria-label={`${e.year}: ${e.title}`}
            onClick={() => engine.scroll?.goTo(CH_INDEX, i)}
          >
            <span className="dot" />
            <span className="yr" style={{ opacity: i === beatIdx || n < 10 || i % 3 === 0 ? 1 : 0.0, transition: 'opacity .4s' }}>
              {e.year.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function beatOf(e: TimelineEvent): Beat {
  return {
    id: e.id,
    eyebrow: `11 — Exploration · ${e.year}`,
    title: e.title.replace(/(\S+)$/, '*$1*'),
    body: [e.body],
    alt: e.missionId ? `The Moon turned to the site of ${MISSION_BY_ID.get(e.missionId)?.name ?? e.title}.` : e.title,
  }
}

export const exploration: Chapter = {
  id: 'exploration',
  num: '11',
  title: 'Exploration',
  short: 'Exploration',
  kicker: 'From the telescope to Artemis',
  blurb: 'Four centuries of looking and landing',
  glyph: 'exploration',
  heightVh: TIMELINE.length * 70 + 120,
  scrim: 'left',
  wideTools: true,
  Tools: Timeline,
  beats: TIMELINE.map(beatOf),
  scene(c) {
    const { p, beat } = c
    const e = TIMELINE[clamp(beat, 0, TIMELINE.length - 1)]
    p.starGain = 0.4
    if (e.view === 'earthrise') {
      // Apollo 8: a low orbit over the limb; Earth does not rise from the surface — only from orbit.
      const u = c.free ? (c.now * 0.045) % 1 : clamp(c.bt * 1.05, 0, 1)
      p.date = datePhase(3)
      p.earthVisible = true
      p.eduMix = 0
      p.cam = { kind: 'ground', lon: lerp(121, 84, u), lat: 0.5, alt: 0.042, heading: 270, pitch: -7 }
      p.fov = 31
      p.glare = 0.3
      p.exposure = 1.1
      p.shadowReach = 0.05
      p.shift = [0, 0]
      c.compose('center', 0.0)
      p.shift = c.layout.mobile || c.layout.portrait ? [0, 0.12] : [0.12, 0]
      return
    }
    const m = e.missionId ? MISSION_BY_ID.get(e.missionId) : undefined
    const lon = e.lon ?? m?.lon ?? (e.view === 'far' ? 176 : -10)
    const lat = e.lat ?? m?.lat ?? (e.view === 'pole' ? -80 : 10)
    if (m) {
      p.cam = { kind: 'surface', lon, lat, dist: c.dist(m.approx ? 2.6 : 1.9) }
      p.date = dateSubsolar(lon + 62)
      p.rings = [ringOf({ lon, lat, diameterKm: 120 }, c.now, 1)]
      c.labels.push({ id: labelId('mission', m.id), text: m.name, sub: m.dateLabel, lon, lat, priority: 100, kind: 'mission', active: true, marker: 'ring', force: true })
    } else if (e.view === 'far') {
      p.cam = { kind: 'surface', lon: 176, lat: 8, dist: c.dist(5.0) }
      p.date = datePhase(12)
    } else if (e.view === 'pole') {
      p.cam = { kind: 'surface', lon: 0, lat: -78, dist: c.dist(2.8) }
      p.date = datePhase(100)
    } else {
      p.cam = { kind: 'surface', lon, lat, dist: c.dist(5.0) }
      p.date = dateSubsolar(lon + 70)
      p.idleSpin = 0.3
    }
    c.compose('right', 0.9)
  },
}
