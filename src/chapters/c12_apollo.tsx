import type { Chapter } from './types'
import { useStore } from '../store'
import { APOLLO, ROBOTIC, MISSION_BY_ID, type Mission } from '../content/missions'
import { FeatureTool, FactList } from '../tools/FeatureTool'
import { Chip } from '../ui/controls'
import { dateSubsolar, fmtCoord, ringOf } from './helpers'
import { skyAt } from '../astro/ephemeris'
import { sunElevation } from '../tools/useSim'
import { labelId } from '../app/ids'

/** UTC touchdown times (NASA). The Sun's elevation at touchdown is computed from the real ephemeris for that instant. */
const LANDING_UTC: Record<string, string> = {
  'apollo-11': '1969-07-20T20:17:40Z',
  'apollo-12': '1969-11-19T06:54:35Z',
  'apollo-14': '1971-02-05T09:18:11Z',
  'apollo-15': '1971-07-30T22:16:29Z',
  'apollo-16': '1972-04-21T02:23:35Z',
  'apollo-17': '1972-12-11T19:54:57Z',
}

const touchdown = new Map<string, { elev: number; subLon: number }>()
function touchdownSun(m: Mission) {
  const iso = LANDING_UTC[m.id] ?? `${m.date}T12:00:00Z`
  let v = touchdown.get(m.id)
  if (!v) {
    const sk = skyAt(new Date(iso))
    v = { elev: sunElevation(m.lat, m.lon, sk.subSolar), subLon: sk.subSolar.lon }
    touchdown.set(m.id, v)
  }
  return v
}

function ApolloTools() {
  const { tool, setTool, selected } = useStore()
  const robotic = tool.labels === true && selected?.kind === 'mission' && !!ROBOTIC.find((r) => r.id === selected.id)
  const list = robotic ? ROBOTIC : APOLLO
  const showRobotic = useStore((s) => s.tool.playing)
  const items = (showRobotic ? ROBOTIC : APOLLO).map((m) => ({ id: m.id, name: m.name, meta: m.dateLabel }))
  void list
  return (
    <FeatureTool
      title={showRobotic ? 'Robotic missions' : 'Apollo landings'}
      kind="mission"
      items={items}
      dossier={(id) => {
        const m = MISSION_BY_ID.get(id)!
        const crewed = APOLLO.includes(m)
        const td = crewed ? touchdownSun(m) : null
        return {
          kicker: `${m.agency} · ${fmtCoord(m.lon, m.lat)}${m.approx ? ' (approx.)' : ''}`,
          title: m.name,
          body: (
            <>
              <p>
                <strong style={{ color: 'var(--bone)' }}>{m.site}.</strong> {m.summary}
              </p>
              <FactList facts={m.facts} />
              {td && (
                <p className="note">
                  Lighting shown matches the real Sun at touchdown: {td.elev.toFixed(0)}° above the horizon (computed from the ephemeris for {LANDING_UTC[m.id].slice(0, 10)}).
                </p>
              )}
            </>
          ),
        }
      }}
      extra={
        <div className="chips" style={{ marginTop: 14 }}>
          <Chip pressed={!showRobotic} onClick={() => setTool({ playing: false })}>
            Apollo
          </Chip>
          <Chip pressed={showRobotic} onClick={() => setTool({ playing: true })}>
            Robotic missions
          </Chip>
        </div>
      }
    />
  )
}

export const apollo: Chapter = {
  id: 'apollo',
  num: '12',
  title: 'Apollo',
  short: 'Apollo',
  kicker: 'Mission map',
  blurb: 'Six landings, one map: the Moon',
  glyph: 'apollo',
  heightVh: 460,
  scrim: 'left',
  Tools: ApolloTools,
  dimTextOnSelect: true,
  onEnter: (s) => s.setTool({ playing: false }),
  beats: [
    {
      id: 'six',
      eyebrow: '12 — Apollo',
      title: 'Six landings, *twelve people*.',
      body: [
        'Between July 1969 and December 1972, six Apollo missions put twelve people on the Moon. They landed on the near side, in a band close to the equator, where communications and fuel margins were best. Every site is on the map: select one.',
      ],
      data: [
        ['Missions', '11, 12, 14, 15, 16, 17'],
        ['Samples returned', '≈ 382 kg'],
      ],
      alt: 'The near side with six labelled sites, from Apollo 11 in Mare Tranquillitatis to Apollo 17 in the Taurus–Littrow valley.',
    },
    {
      id: 'why',
      eyebrow: '12 — Apollo',
      title: 'Sites chosen for *questions*.',
      body: [
        'Maria were safe and smooth; highlands, mountains and rilles held older rock and the story of the great impacts. Each crew went somewhere that could answer a different question about the Moon’s age and history.',
      ],
      alt: 'Close view of several landing sites relative to maria and highlands.',
    },
    {
      id: 'left',
      eyebrow: '12 — Apollo',
      title: 'What they *left*.',
      body: [
        'Apollo 11, 14 and 15 left laser retroreflectors on the surface. Observatories on Earth still fire pulses at them, timing the round trip to measure the Moon’s distance to millimetres — and to find that it drifts away by about 3.8 cm a year.',
      ],
      alt: 'The three Apollo retroreflector sites highlighted on the near side.',
    },
    {
      id: 'beyond',
      eyebrow: '12 — Apollo',
      title: 'And the *robots*.',
      body: [
        'Since Apollo, robots have landed at poles and on the far side. Switch to the robotic layer to see Luna, Chang’e, Chandrayaan, SLIM and commercial landers on the same map.',
      ],
      alt: 'The Moon with robotic landing sites from many nations marked.',
    },
  ],
  scene(c) {
    const { p, beat, s } = c
    p.starGain = 0.35
    const robotic = s.tool.playing || beat === 3
    const set = robotic ? ROBOTIC : APOLLO
    const sel = s.selected?.kind === 'mission' ? MISSION_BY_ID.get(s.selected.id) : null
    for (const m of [...APOLLO, ...(robotic ? ROBOTIC : [])]) {
      c.labels.push({
        id: labelId('mission', m.id),
        text: m.name,
        sub: m.dateLabel,
        lon: m.lon,
        lat: m.lat,
        priority: sel?.id === m.id ? 100 : APOLLO.includes(m) ? 20 : 10,
        kind: 'mission',
        active: sel?.id === m.id,
        hover: s.hover?.kind === 'mission' && s.hover.id === m.id,
        marker: 'ring',
        dim: !!sel && sel.id !== m.id,
        minFacing: 0.08,
      })
    }
    if (sel) {
      const td = APOLLO.includes(sel) ? touchdownSun(sel) : null
      p.cam = { kind: 'surface', lon: sel.lon, lat: sel.lat, dist: c.dist(sel.approx ? 2.4 : 1.55) }
      p.date = dateSubsolar(td ? td.subLon : sel.lon + 62)
      p.rings = [ringOf({ lon: sel.lon, lat: sel.lat, diameterKm: 70 }, c.now, 1)]
      c.compose('right', 0.85)
      return
    }
    void set
    switch (beat) {
      case 0:
        p.cam = { kind: 'surface', lon: 8, lat: 6, dist: c.dist(4.6) }
        p.date = dateSubsolar(42)
        break
      case 1:
        p.cam = { kind: 'surface', lon: 2, lat: 4, dist: c.dist(3.4) }
        p.date = dateSubsolar(55)
        break
      case 2: {
        p.cam = { kind: 'surface', lon: 14, lat: 12, dist: c.dist(3.6) }
        p.date = dateSubsolar(40)
        break
      }
      default:
        p.cam = { kind: 'surface', lon: 60, lat: 0, dist: c.dist(5.0) }
        p.date = dateSubsolar(30)
        p.idleSpin = 0.4
    }
    c.compose('right', 0.9)
  },
}
