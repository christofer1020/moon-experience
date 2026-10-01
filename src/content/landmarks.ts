/**
 * Curated lunar landmarks.
 * Positions / diameters: IAU Gazetteer of Planetary Nomenclature (USGS Astrogeology), centre points.
 * Longitudes are selenographic, east positive, −180…180. Descriptions are paraphrased from
 * NASA / LRO / peer-reviewed sources; where ages are debated the text says so.
 */
export type LandmarkKind = 'mare' | 'crater' | 'basin' | 'mountain' | 'valley' | 'pole'

export interface Landmark {
  id: string
  name: string
  kind: LandmarkKind
  lon: number
  lat: number
  /** IAU diameter in km (0 = not applicable) */
  diameterKm: number
  /** label priority: 1 = global view, 2 = mid zoom, 3 = close */
  rank: 1 | 2 | 3
  meaning?: string
  summary: string
  facts?: [string, string][]
  /** ray crater? (renders ejecta rays in the impact visualisation) */
  rays?: boolean
  /** angular size multiplier used when framing the camera */
  frame?: number
}

const L = (lon: number) => (lon > 180 ? lon - 360 : lon)

export const LANDMARKS: Landmark[] = [
  /* ------------------------------------------------------------ craters */
  {
    id: 'tycho',
    name: 'Tycho',
    kind: 'crater',
    lon: L(348.785),
    lat: -43.296,
    diameterKm: 85.29,
    rank: 1,
    rays: true,
    meaning: 'Tycho Brahe, Danish astronomer (1546–1601)',
    summary:
      'A young, sharply preserved crater in the southern highlands, the hub of the most spectacular ray system on the near side. At full Moon its bright rays fan out for well over a thousand kilometres.',
    facts: [
      ['Diameter', '≈ 85 km (IAU)'],
      ['Depth', '≈ 4.7 km'],
      ['Age', '≈ 108 million years'],
      ['Ray reach', 'up to ≈ 1,500 km'],
      ['Central peak', '≈ 1.6 km above the floor'],
      ['Also here', 'Surveyor 7 landed on its ejecta blanket in 1968'],
    ],
  },
  {
    id: 'copernicus',
    name: 'Copernicus',
    kind: 'crater',
    lon: L(339.921),
    lat: 9.621,
    diameterKm: 96.07,
    rank: 1,
    rays: true,
    meaning: 'Nicolaus Copernicus, Polish astronomer (1473–1543)',
    summary:
      'A textbook complex crater: terraced walls, a cluster of central peaks, and a skirt of ejecta and rays across Mare Imbrium and Oceanus Procellarum. Its estimated age gave the Copernican period its name.',
    facts: [
      ['Diameter', '≈ 96 km (IAU)'],
      ['Depth', '≈ 3.8 km'],
      ['Age', '≈ 800 million years (estimate)'],
      ['Ray reach', '≈ 800 km'],
      ['Central peaks', '≈ 1.2 km high'],
    ],
  },
  {
    id: 'kepler',
    name: 'Kepler',
    kind: 'crater',
    lon: L(321.991),
    lat: 8.121,
    diameterKm: 29.49,
    rank: 2,
    rays: true,
    meaning: 'Johannes Kepler, German astronomer (1571–1630)',
    summary:
      'A small, bright, young crater on the dark plains of Oceanus Procellarum. Its rays overlie older material for hundreds of kilometres, making it a useful stratigraphic marker.',
    facts: [
      ['Diameter', '≈ 29 km (IAU)'],
      ['Depth', '≈ 2.7 km'],
      ['Age', 'Copernican (younger than ≈ 1.1 billion years); exact age uncertain'],
      ['Rays', 'extend well over 300 km'],
    ],
  },
  {
    id: 'plato',
    name: 'Plato',
    kind: 'crater',
    lon: L(350.618),
    lat: 51.619,
    diameterKm: 100.68,
    rank: 2,
    meaning: 'Plato, Greek philosopher (c. 428–347 BCE)',
    summary:
      'A dark-floored giant on the northern shore of Mare Imbrium. Lava flooded its interior long after the impact, leaving a smooth, dark floor ringed by high walls whose shadows crawl across it during the lunar day.',
    facts: [
      ['Diameter', '≈ 101 km (IAU)'],
      ['Age', 'Late Imbrian — roughly 3.8 billion years'],
      ['Floor', 'flooded by dark basalt'],
      ['Notable', 'long rim shadows are a classic telescope test'],
    ],
  },
  {
    id: 'clavius',
    name: 'Clavius',
    kind: 'crater',
    lon: L(345.273),
    lat: -58.623,
    diameterKm: 230.77,
    rank: 1,
    meaning: 'Christopher Clavius, German Jesuit mathematician (1537–1612)',
    summary:
      'One of the largest craters on the near side, ancient and heavily battered. A graceful arc of progressively smaller craters curves across its floor. It appears as a fictional lunar base in the film 2001: A Space Odyssey.',
    facts: [
      ['Diameter', '≈ 231 km (IAU)'],
      ['Depth', '≈ 4.8 km'],
      ['Age', 'Nectarian period (≈ 3.9 billion years)'],
      ['Floor', 'arc of craters (Rutherfurd, D, C, N, J, JA)'],
    ],
  },
  {
    id: 'aristarchus',
    name: 'Aristarchus',
    kind: 'crater',
    lon: L(312.51),
    lat: 23.73,
    diameterKm: 39.99,
    rank: 1,
    rays: true,
    meaning: 'Aristarchus of Samos, Greek astronomer (c. 310–230 BCE)',
    summary:
      'The brightest of the large formations on the Moon: young enough that space weathering has not yet darkened its excavated rock. Next to it, Vallis Schröteri, the longest sinuous rille on the near side, was carved by flowing lava.',
    facts: [
      ['Diameter', '≈ 40 km (IAU)'],
      ['Depth', '≈ 2.7 km'],
      ['Age', 'about 0.2–0.45 billion years (estimates differ)'],
      ['Notable', 'pyroclastic deposits; most reported transient lunar phenomena'],
    ],
  },
  { id: 'eratosthenes', name: 'Eratosthenes', kind: 'crater', lon: L(348.684), lat: 14.474, diameterKm: 58.77, rank: 3, meaning: 'Eratosthenes, Greek astronomer & geographer', summary: 'A terraced crater at the southern end of the Apennine mountains, at the edge of Mare Imbrium.' },
  { id: 'archimedes', name: 'Archimedes', kind: 'crater', lon: L(356.007), lat: 29.717, diameterKm: 81.04, rank: 3, meaning: 'Archimedes of Syracuse', summary: 'A lava-flooded crater on the eastern floor of Mare Imbrium.' },
  { id: 'ptolemaeus', name: 'Ptolemaeus', kind: 'crater', lon: L(358.163), lat: -9.161, diameterKm: 153.67, rank: 3, meaning: 'Claudius Ptolemy', summary: 'A vast, flat-floored crater in the central highlands, the first in a famous chain with Alphonsus and Arzachel.' },
  { id: 'alphonsus', name: 'Alphonsus', kind: 'crater', lon: L(357.154), lat: -13.388, diameterKm: 110.54, rank: 3, meaning: 'Alfonso X of Castile', summary: 'Site of a 1958 report of gas emission and of dark halo vents later interpreted as volcanic pyroclastic deposits.' },
  { id: 'theophilus', name: 'Theophilus', kind: 'crater', lon: L(26.285), lat: -11.452, diameterKm: 98.59, rank: 3, meaning: 'Theophilus of Alexandria', summary: 'A deep, sharp-rimmed crater with a massive central peak complex beside Mare Nectaris.' },
  { id: 'langrenus', name: 'Langrenus', kind: 'crater', lon: 61.038, lat: -8.86, diameterKm: 131.98, rank: 3, meaning: 'Michel Florent van Langren, Belgian selenographer', summary: 'A large terraced crater near the eastern limb with a bright central peak.' },
  { id: 'petavius', name: 'Petavius', kind: 'crater', lon: 60.778, lat: -25.391, diameterKm: 184.06, rank: 3, meaning: 'Denis Pétau', summary: 'A large crater with a complex central peak and a conspicuous rille across its floor.' },
  { id: 'grimaldi', name: 'Grimaldi', kind: 'crater', lon: L(291.64), lat: -5.38, diameterKm: 235, rank: 2, meaning: 'Francesco Maria Grimaldi', summary: 'A dark, lava-filled basin-scale crater on the western limb — one of the darkest spots on the Moon.' },
  { id: 'gassendi', name: 'Gassendi', kind: 'crater', lon: L(320.036), lat: -17.555, diameterKm: 111.39, rank: 3, meaning: 'Pierre Gassendi', summary: 'A fractured, lava-flooded crater on the northern rim of Mare Humorum.' },
  { id: 'bullialdus', name: 'Bullialdus', kind: 'crater', lon: L(337.737), lat: -20.748, diameterKm: 60.72, rank: 3, meaning: 'Ismaël Bullialdus', summary: 'A crisp, terraced crater in Mare Nubium with a prominent central peak.' },
  { id: 'schickard', name: 'Schickard', kind: 'crater', lon: L(304.895), lat: -44.379, diameterKm: 212.18, rank: 3, meaning: 'Wilhelm Schickard', summary: 'A huge, lava-flooded crater in the southwestern highlands.' },
  { id: 'aristoteles', name: 'Aristoteles', kind: 'crater', lon: 17.32, lat: 50.243, diameterKm: 87.57, rank: 3, meaning: 'Aristotle', summary: 'A terraced crater north of Mare Frigoris with a distinctive ejecta blanket.' },
  { id: 'posidonius', name: 'Posidonius', kind: 'crater', lon: 29.991, lat: 31.878, diameterKm: 95.06, rank: 3, summary: 'A rille-crossed, lava-flooded crater on the northeastern shore of Mare Serenitatis.' },
  { id: 'tsiolkovskiy', name: 'Tsiolkovskiy', kind: 'crater', lon: 128.972, lat: -20.379, diameterKm: 184.39, rank: 2, meaning: 'Konstantin Tsiolkovsky', summary: 'A prominent far-side crater with a dark, lava-flooded floor and a bright central peak, first glimpsed in the 1959 Luna 3 images.' },
  { id: 'mendeleev', name: 'Mendeleev', kind: 'crater', lon: 141.168, lat: 5.375, diameterKm: 325.13, rank: 3, meaning: 'Dmitri Mendeleev', summary: 'A large far-side crater cut by a younger, smaller crater on its floor.' },
  { id: 'korolev', name: 'Korolev', kind: 'crater', lon: 202.592 - 360, lat: -4.191, diameterKm: 423.41, rank: 3, meaning: 'Sergei Korolev', summary: 'A big, ancient far-side basin-scale crater.' },
  { id: 'hertzsprung', name: 'Hertzsprung', kind: 'crater', lon: 231.344 - 360, lat: 1.365, diameterKm: 536.37, rank: 3, meaning: 'Ejnar Hertzsprung', summary: 'A peak-ring impact basin on the far side, over 500 km across.' },
  { id: 'schrodinger', name: 'Schrödinger', kind: 'crater', lon: 132.925, lat: -74.733, diameterKm: 316.39, rank: 3, meaning: 'Erwin Schrödinger', summary: 'A well-preserved peak-ring basin near the south pole, among the youngest large basins on the Moon.' },
  /* ------------------------------------------------------------ basins */
  {
    id: 'orientale',
    name: 'Orientale Basin',
    kind: 'basin',
    lon: L(265.069),
    lat: -19.436,
    diameterKm: 930,
    rank: 1,
    meaning: '"Eastern" — named when it was on the Moon’s eastern limb in old convention',
    summary:
      'The best-preserved large multi-ring impact basin on the Moon: concentric mountain rings frozen mid-collapse. It straddles the western limb, only dimly glimpsed from Earth at favourable libration.',
    facts: [
      ['Outer ring (Montes Cordillera)', '≈ 930–960 km, sources differ'],
      ['Central Mare Orientale', '≈ 294 km (IAU)'],
      ['Age', '≈ 3.7–3.8 billion years'],
      ['Lava fill', 'thin — probably under 1 km'],
    ],
  },
  {
    id: 'spa',
    name: 'South Pole–Aitken Basin',
    kind: 'basin',
    lon: -169,
    lat: -53,
    diameterKm: 2500,
    rank: 1,
    summary:
      'The largest, deepest and oldest recognised impact basin on the Moon — and one of the largest in the Solar System. Its floor holds the lowest elevations on the Moon and may expose rock from the deep crust or upper mantle.',
    facts: [
      ['Diameter', '≈ 2,500 km'],
      ['Depth', 'roughly 6–8 km (floor), lowest point ≈ −9.1 km'],
      ['Age', 'pre-Nectarian; one proposed zircon age ≈ 4.34 billion years'],
      ['Samples', 'Chang’e 6 returned the first far-side samples from here (2024)'],
    ],
  },
  /* ------------------------------------------------------------ mountains & valleys */
  { id: 'apennines', name: 'Montes Apenninus', kind: 'mountain', lon: 0.025, lat: 19.871, diameterKm: 599.67, rank: 2, summary: 'The great curved rim of the Imbrium basin; peaks reach about 5 km above the plains. Apollo 15 landed at its foot.' },
  { id: 'alps', name: 'Montes Alpes', kind: 'mountain', lon: -0.58, lat: 48.36, diameterKm: 334.48, rank: 3, summary: 'Imbrium-rim mountains, cut by the arrow-straight Alpine Valley (Vallis Alpes).' },
  { id: 'caucasus', name: 'Montes Caucasus', kind: 'mountain', lon: 9.931, lat: 37.519, diameterKm: 443.51, rank: 3, summary: 'Imbrium-rim mountains between Mare Imbrium and Mare Serenitatis.' },
  { id: 'carpatus', name: 'Montes Carpatus', kind: 'mountain', lon: L(336.375), lat: 14.568, diameterKm: 333.59, rank: 3, summary: 'A mountain arc along the southern rim of Mare Imbrium.' },
  { id: 'jura', name: 'Montes Jura', kind: 'mountain', lon: L(323.889), lat: 47.494, diameterKm: 420.8, rank: 3, summary: 'The mountain rim around Sinus Iridum, the “Bay of Rainbows”.' },
  { id: 'huygens', name: 'Mons Huygens', kind: 'mountain', lon: L(357.143), lat: 19.919, diameterKm: 41.97, rank: 3, summary: 'Highest peak of the Apennines, rising ≈ 5.3 km above Mare Imbrium.' },
  { id: 'rupes-recta', name: 'Rupes Recta', kind: 'valley', lon: L(352.298), lat: -21.675, diameterKm: 115.95, rank: 3, summary: 'The “Straight Wall”: a fault scarp about 116 km long in Mare Nubium.' },
  { id: 'schroter', name: 'Vallis Schröteri', kind: 'valley', lon: L(308.42), lat: 26.155, diameterKm: 185.32, rank: 3, summary: 'A sinuous lava channel beside Aristarchus — the largest sinuous rille on the near side.' },
  { id: 'hadley-rille', name: 'Rima Hadley', kind: 'valley', lon: 3.147, lat: 25.716, diameterKm: 116.09, rank: 3, summary: 'Sinuous rille beside the Apollo 15 landing site, explored by Scott and Irwin in 1971.' },
  { id: 'sinus-iridum', name: 'Sinus Iridum', kind: 'basin', lon: L(328.335), lat: 45.01, diameterKm: 249.29, rank: 2, meaning: '“Bay of Rainbows”', summary: 'A graceful, half-flooded crater on the northwest edge of Mare Imbrium, bordered by the Jura mountains.' },
  /* ------------------------------------------------------------ poles */
  {
    id: 'shackleton',
    name: 'Shackleton',
    kind: 'crater',
    lon: 129.78,
    lat: -89.67,
    diameterKm: 20.92,
    rank: 2,
    meaning: 'Sir Ernest Shackleton, Antarctic explorer (1874–1922)',
    summary:
      'A crater sitting almost exactly on the south pole. Its floor never sees sunlight, while sections of its rim are lit for most of the lunar year.',
    facts: [
      ['Diameter', '≈ 21 km (IAU)'],
      ['Floor', 'permanently shadowed'],
      ['Interest', 'cold trap candidate for water ice; near sites of long sunlight'],
    ],
    frame: 0.5,
  },
  {
    id: 'cabeus',
    name: 'Cabeus',
    kind: 'crater',
    lon: L(317.867),
    lat: -85.33,
    diameterKm: 100.58,
    rank: 2,
    meaning: 'Niccolò Cabeo, Italian Jesuit (1586–1650)',
    summary:
      'Target of NASA’s LCROSS impactor in October 2009. The ejecta plume contained water vapour and ice, among other volatiles, from a permanently shadowed floor.',
    facts: [
      ['Diameter', '≈ 101 km (IAU)'],
      ['LCROSS result', '≈ 5.6 ± 2.9 % water ice by mass (plume estimate)'],
    ],
    frame: 0.8,
  },
  { id: 'hermite', name: 'Hermite', kind: 'crater', lon: 266.685 - 360, lat: 86.166, diameterKm: 108.64, rank: 3, meaning: 'Charles Hermite, French mathematician', summary: 'Near the north pole. LRO’s Diviner measured about −248 °C on its floor — among the coldest places ever measured in the Solar System.', frame: 0.8 },
  { id: 'peary', name: 'Peary', kind: 'crater', lon: 24.402, lat: 88.625, diameterKm: 78.75, rank: 3, meaning: 'Robert Peary, Arctic explorer', summary: 'A large crater almost at the north pole with permanently dark interior pockets.', frame: 0.8 },
  { id: 'faustini', name: 'Faustini', kind: 'crater', lon: 84.31, lat: -87.183, diameterKm: 42.48, rank: 3, meaning: 'Arnaldo Faustini, Italian polar geographer', summary: 'A deep south-polar crater whose interior is in permanent shadow.', frame: 0.5 },
  { id: 'haworth', name: 'Haworth', kind: 'crater', lon: L(354.83), lat: -87.45, diameterKm: 51.42, rank: 3, summary: 'A south-polar crater with permanently shadowed floor.', frame: 0.5 },
  { id: 'shoemaker', name: 'Shoemaker', kind: 'crater', lon: 45.911, lat: -88.137, diameterKm: 51.82, rank: 3, meaning: 'Eugene Shoemaker, astrogeologist', summary: 'A south-polar crater named for the geologist who trained the Apollo astronauts.', frame: 0.5 },
]

export const POLE_FEATURES = ['shackleton', 'cabeus', 'faustini', 'haworth', 'shoemaker', 'hermite', 'peary']

export const byId = new Map(LANDMARKS.map((l) => [l.id, l]))

export function sideOf(lon: number): 'near' | 'far' | 'limb' {
  const a = Math.abs(lon)
  return a < 78 ? 'near' : a > 102 ? 'far' : 'limb'
}

export const SURFACE_SET = [
  'tycho', 'copernicus', 'aristarchus', 'clavius', 'plato', 'grimaldi', 'tsiolkovskiy', 'orientale', 'spa', 'apennines', 'sinus-iridum',
]
export const CRATER_SET = ['tycho', 'copernicus', 'kepler', 'plato', 'clavius', 'aristarchus']
