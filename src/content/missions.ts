/**
 * Mission sites and the exploration timeline.
 * Apollo site coordinates: Davies et al. (1987) values as tabulated by the Apollo Lunar Surface Journal
 * (Mean Earth / Polar Axis frame); LRO-refined positions agree to well under 1 km.
 * Landing/crew data: NASA (history.nasa.gov, NSSDCA, LPI). Recent missions: NASA, ISRO, CNSA, JAXA, CLPS provider releases.
 */
export type MissionKind = 'crewed' | 'lander' | 'impactor' | 'sample' | 'rover' | 'orbiter'

export interface Mission {
  id: string
  name: string
  kind: MissionKind
  agency: string
  /** ISO date of landing / key event */
  date: string
  /** human-readable date */
  dateLabel: string
  lon: number
  lat: number
  site: string
  /** approximate placement (not a surveyed coordinate) */
  approx?: boolean
  summary: string
  facts?: [string, string][]
}

export const APOLLO: Mission[] = [
  {
    id: 'apollo-11',
    name: 'Apollo 11',
    kind: 'crewed',
    agency: 'NASA',
    date: '1969-07-20',
    dateLabel: '20 July 1969',
    lon: 23.47298,
    lat: 0.67409,
    site: 'Tranquility Base · Mare Tranquillitatis',
    summary:
      'The first landing of humans on another world. Neil Armstrong and Buzz Aldrin spent about 21½ hours on the surface in the lunar module Eagle while Michael Collins orbited above in Columbia.',
    facts: [
      ['Landing', '20 July 1969, 20:17 UTC'],
      ['Crew', 'Neil Armstrong · Buzz Aldrin · Michael Collins'],
      ['Moonwalk', '≈ 2 h 31 min (one EVA)'],
      ['Samples', '≈ 21.5 kg'],
      ['Left behind', 'a laser retroreflector still used for ranging today'],
    ],
  },
  {
    id: 'apollo-12',
    name: 'Apollo 12',
    kind: 'crewed',
    agency: 'NASA',
    date: '1969-11-19',
    dateLabel: '19 November 1969',
    lon: -23.4193,
    lat: -3.01381,
    site: 'Oceanus Procellarum',
    summary:
      'A pinpoint landing in Oceanus Procellarum, within walking distance of Surveyor 3, which had landed in 1967. The crew brought back parts of the spacecraft to study how materials weather in space.',
    facts: [
      ['Landing', '19 November 1969, 06:54 UTC'],
      ['Crew', 'Pete Conrad · Alan Bean · Richard Gordon'],
      ['Lunar module', 'Intrepid'],
      ['Moonwalks', 'two, ≈ 7¾ h total'],
      ['Samples', '≈ 34 kg'],
    ],
  },
  {
    id: 'apollo-14',
    name: 'Apollo 14',
    kind: 'crewed',
    agency: 'NASA',
    date: '1971-02-05',
    dateLabel: '5 February 1971',
    lon: -17.47139,
    lat: -3.64544,
    site: 'Fra Mauro highlands',
    summary:
      'Landed in the rugged Fra Mauro formation — material thrown out by the Imbrium impact — to sample rock from deep in the crust. Alan Shepard famously hit golf balls before leaving.',
    facts: [
      ['Landing', '5 February 1971, 09:18 UTC'],
      ['Crew', 'Alan Shepard · Edgar Mitchell · Stuart Roosa'],
      ['Lunar module', 'Antares'],
      ['Moonwalks', 'two, ≈ 9 h 23 min'],
      ['Samples', '≈ 43 kg'],
    ],
  },
  {
    id: 'apollo-15',
    name: 'Apollo 15',
    kind: 'crewed',
    agency: 'NASA',
    date: '1971-07-30',
    dateLabel: '30 July 1971',
    lon: 3.634,
    lat: 26.13224,
    site: 'Hadley–Apennine',
    summary:
      'The first mission with the Lunar Roving Vehicle. David Scott and James Irwin drove beside Hadley Rille at the foot of the Apennine mountains, collecting the “Genesis Rock” of ancient anorthosite.',
    facts: [
      ['Landing', '30 July 1971, 22:16 UTC'],
      ['Crew', 'David Scott · James Irwin · Alfred Worden'],
      ['Lunar module', 'Falcon'],
      ['Moonwalks', 'three, ≈ 18½ h'],
      ['Samples', '≈ 77 kg'],
    ],
  },
  {
    id: 'apollo-16',
    name: 'Apollo 16',
    kind: 'crewed',
    agency: 'NASA',
    date: '1972-04-21',
    dateLabel: '21 April 1972',
    lon: 15.49859,
    lat: -8.97341,
    site: 'Descartes Highlands',
    summary:
      'The only landing in the lunar highlands proper. John Young and Charles Duke tested whether the Descartes formation was volcanic — and found it was impact breccia instead.',
    facts: [
      ['Landing', '21 April 1972, 02:23 UTC'],
      ['Crew', 'John Young · Charles Duke · Ken Mattingly'],
      ['Lunar module', 'Orion'],
      ['Moonwalks', 'three, ≈ 20 h'],
      ['Samples', '≈ 96 kg'],
    ],
  },
  {
    id: 'apollo-17',
    name: 'Apollo 17',
    kind: 'crewed',
    agency: 'NASA',
    date: '1972-12-11',
    dateLabel: '11 December 1972',
    lon: 30.77475,
    lat: 20.18809,
    site: 'Taurus–Littrow valley',
    summary:
      'The last crewed landing so far, and the only one with a professional geologist: Harrison “Jack” Schmitt. They found orange volcanic glass at Shorty crater and brought back the most samples of any mission.',
    facts: [
      ['Landing', '11 December 1972, 19:54 UTC'],
      ['Crew', 'Gene Cernan · Harrison Schmitt · Ron Evans'],
      ['Lunar module', 'Challenger'],
      ['Moonwalks', 'three, ≈ 22 h'],
      ['Samples', '≈ 110 kg'],
    ],
  },
]

export const ROBOTIC: Mission[] = [
  { id: 'luna-2', name: 'Luna 2', kind: 'impactor', agency: 'USSR', date: '1959-09-13', dateLabel: 'Sept 1959', lon: 0, lat: 29.1, site: 'Palus Putredinis', approx: true, summary: 'The first human-made object to reach the surface of another world: it impacted near Archimedes, confirming the Moon has no significant magnetic field or radiation belts.' },
  { id: 'luna-9', name: 'Luna 9', kind: 'lander', agency: 'USSR', date: '1966-02-03', dateLabel: '3 Feb 1966', lon: -64.37, lat: 7.13, site: 'Oceanus Procellarum', approx: true, summary: 'First soft landing on the Moon and first photographs from its surface — proving the regolith could bear a spacecraft’s weight.' },
  { id: 'luna-16', name: 'Luna 16', kind: 'sample', agency: 'USSR', date: '1970-09-20', dateLabel: 'Sept 1970', lon: 56.3, lat: -0.68, site: 'Mare Fecunditatis', approx: true, summary: 'The first robotic sample return from the Moon: about 100 g of regolith drilled automatically and flown to Earth.' },
  { id: 'lunokhod-1', name: 'Lunokhod 1', kind: 'rover', agency: 'USSR', date: '1970-11-17', dateLabel: 'Nov 1970', lon: -35, lat: 38.28, site: 'Mare Imbrium', approx: true, summary: 'The first remotely driven rover on another world, operating for most of a year.' },
  { id: 'change-3', name: 'Chang’e 3', kind: 'rover', agency: 'CNSA', date: '2013-12-14', dateLabel: '14 Dec 2013', lon: -19.5123, lat: 44.1184, site: 'Mare Imbrium · Guang Han Gong', summary: 'First soft landing on the Moon in 37 years; the Yutu rover explored Mare Imbrium.' },
  { id: 'change-4', name: 'Chang’e 4', kind: 'rover', agency: 'CNSA', date: '2019-01-03', dateLabel: '3 Jan 2019', lon: 177.6, lat: -45.45, site: 'Von Kármán crater · Statio Tianhe', summary: 'The first landing on the far side of the Moon, inside the South Pole–Aitken basin, relayed through the Queqiao satellite.' },
  { id: 'change-5', name: 'Chang’e 5', kind: 'sample', agency: 'CNSA', date: '2020-12-01', dateLabel: 'Dec 2020', lon: -51.92, lat: 43.06, site: 'Oceanus Procellarum · Statio Tianchuan', summary: 'Returned about 1.7 kg of the youngest lunar basalts yet dated: ≈ 2.0 billion years old.' },
  { id: 'chandrayaan-3', name: 'Chandrayaan-3', kind: 'lander', agency: 'ISRO', date: '2023-08-23', dateLabel: '23 Aug 2023', lon: 32.3198, lat: -69.3734, site: 'Statio Shiv Shakti', summary: 'India’s Vikram lander and Pragyan rover touched down closer to the south pole than any earlier soft landing.' },
  { id: 'slim', name: 'SLIM', kind: 'lander', agency: 'JAXA', date: '2024-01-19', dateLabel: '19 Jan 2024', lon: 25.251, lat: -13.316, site: 'Shioli crater', summary: 'The “Moon Sniper” demonstrated pinpoint landing within metres of its target, despite one failed engine.' },
  { id: 'im-1', name: 'IM-1 Odysseus', kind: 'lander', agency: 'Intuitive Machines / NASA CLPS', date: '2024-02-22', dateLabel: '22 Feb 2024', lon: 1.44, lat: -80.13, site: 'near Malapert A', summary: 'The first U.S. landing since Apollo 17 and the first by a private company; it came to rest tilted, but operated for about a week.' },
  { id: 'change-6', name: 'Chang’e 6', kind: 'sample', agency: 'CNSA', date: '2024-06-02', dateLabel: '1–2 June 2024', lon: -153.98, lat: -41.63, site: 'Apollo basin · Statio Tianjiang', summary: 'The first samples ever returned from the far side: 1,935.3 g from the South Pole–Aitken basin.' },
  { id: 'blue-ghost-1', name: 'Blue Ghost 1', kind: 'lander', agency: 'Firefly / NASA CLPS', date: '2025-03-02', dateLabel: '2 Mar 2025', lon: 61.81, lat: 18.56, site: 'Mare Crisium', summary: 'The first fully successful commercial lunar landing: ten NASA payloads, 14 days of operations, and a view of a total solar eclipse from the surface.' },
  { id: 'im-2', name: 'IM-2 Athena', kind: 'lander', agency: 'Intuitive Machines / NASA CLPS', date: '2025-03-06', dateLabel: '6 Mar 2025', lon: 29.1957, lat: -84.7906, site: 'Mons Mouton', summary: 'Landed closer to the south pole than any earlier mission, but came to rest on its side and ran out of power within a day.' },
]

export const SURFACE_MISSIONS: Mission[] = [...APOLLO, ...ROBOTIC]
export const MISSION_BY_ID = new Map(SURFACE_MISSIONS.map((m) => [m.id, m]))

export interface TimelineEvent {
  id: string
  year: string
  /** sort key (decimal year) */
  t: number
  title: string
  body: string
  /** surface location the Moon turns to (optional) */
  lon?: number
  lat?: number
  missionId?: string
  kind: 'observation' | 'robotic' | 'crewed' | 'orbiter' | 'modern' | 'future'
  /** camera framing hint */
  view?: 'near' | 'far' | 'earthrise' | 'pole'
}

export const TIMELINE: TimelineEvent[] = [
  { id: 'galileo', year: '1609', t: 1609.9, kind: 'observation', title: 'The telescope turns to the Moon', body: 'Galileo’s drawings show mountains, craters and shadows: the Moon is a rugged world, not a perfect sphere. His 1610 book Sidereus Nuncius made it public.', lon: 0, lat: 0 },
  { id: 'hevelius', year: '1647', t: 1647, kind: 'observation', title: 'Selenographia', body: 'Johannes Hevelius publishes the first atlas devoted to the Moon. Four years later Riccioli’s map gives the maria their “sea” names, still in use.', lon: -20, lat: 25 },
  { id: 'luna2', year: '1959', t: 1959.7, kind: 'robotic', title: 'Luna 2 and Luna 3', body: 'Luna 2 is the first human-made object to reach the Moon. Weeks later, Luna 3 photographs the far side for the first time.', missionId: 'luna-2', view: 'near' },
  { id: 'luna9', year: '1966', t: 1966.1, kind: 'robotic', title: 'Soft landings', body: 'Luna 9 lands softly and transmits the first pictures from the surface; Surveyor 1 follows months later.', missionId: 'luna-9' },
  { id: 'apollo8', year: '1968', t: 1968.98, kind: 'crewed', title: 'Apollo 8 — Earthrise', body: 'Frank Borman, Jim Lovell and William Anders become the first humans to orbit the Moon. On 24 December, Anders photographs Earth rising over the lunar horizon.', view: 'earthrise' },
  { id: 'apollo11', year: '1969', t: 1969.55, kind: 'crewed', title: 'Apollo 11', body: 'Neil Armstrong and Buzz Aldrin walk on the Moon at Tranquility Base.', missionId: 'apollo-11' },
  { id: 'apollo17', year: '1972', t: 1972.95, kind: 'crewed', title: 'Apollo 17', body: 'The last crewed landing so far. Between 1969 and 1972, twelve people walked on the Moon and brought back about 382 kg of rock and soil.', missionId: 'apollo-17' },
  { id: 'luna16', year: '1970 – 76', t: 1973.0, kind: 'robotic', title: 'Robots take over', body: 'Luna 16 returns the first robotic sample; Lunokhod 1 and 2 drive for kilometres. Luna 24 is the last Soviet mission in 1976 — and the last soft landing for 37 years.', missionId: 'luna-16' },
  { id: 'clementine', year: '1994 – 99', t: 1996, kind: 'orbiter', title: 'Back to orbit', body: 'Clementine and Lunar Prospector map the whole Moon and find hints of hydrogen at the poles.', view: 'pole' },
  { id: 'lro', year: '2009', t: 2009.5, kind: 'orbiter', title: 'LRO and LCROSS', body: 'NASA’s Lunar Reconnaissance Orbiter begins mapping topography and imagery in unprecedented detail — the data behind this atlas. LCROSS hits Cabeus crater and finds water in the plume.', lon: -42.7, lat: -85.3, view: 'pole' },
  { id: 'change3', year: '2013 – 19', t: 2015, kind: 'modern', title: 'China lands, twice', body: 'Chang’e 3 lands in 2013. In January 2019, Chang’e 4 makes the first landing on the far side.', missionId: 'change-4', view: 'far' },
  { id: 'change5', year: '2020 – 24', t: 2021, kind: 'modern', title: 'Samples return', body: 'Chang’e 5 returns 1.7 kg of 2-billion-year-old basalt. In 2024, Chang’e 6 brings back the first far-side samples: 1,935 g.', missionId: 'change-6', view: 'far' },
  { id: 'chandrayaan3', year: '2023 – 24', t: 2023.65, kind: 'modern', title: 'A crowded Moon', body: 'India lands near the south pole (Chandrayaan-3), Japan lands within metres of its target (SLIM), and a private company, Intuitive Machines, lands in February 2024.', missionId: 'chandrayaan-3', view: 'pole' },
  { id: 'bg1', year: '2025', t: 2025.2, kind: 'modern', title: 'Commercial science', body: 'Firefly’s Blue Ghost 1 completes a fully successful landing in Mare Crisium. IM-2 lands near the south pole but tips over.', missionId: 'blue-ghost-1' },
  { id: 'artemis2', year: 'Apr 2026', t: 2026.3, kind: 'crewed', title: 'Artemis II', body: 'Reid Wiseman, Victor Glover, Christina Koch and Jeremy Hansen fly around the Moon in Orion — the first crewed lunar mission since 1972 — travelling farther from Earth than any humans before.', view: 'far' },
  { id: 'next', year: '2027 →', t: 2027.5, kind: 'future', title: 'What comes next', body: 'NASA now plans Artemis III as a 2027 Earth-orbit test of commercial landers, with the first Artemis lunar landing targeted for Artemis IV in 2028. China’s Chang’e 7 has been postponed to a later launch window. Dates are targets and can move.', view: 'pole' },
]
