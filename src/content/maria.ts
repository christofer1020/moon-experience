/**
 * Lunar maria. Names, centres and diameters from the IAU Gazetteer (USGS). Outline extents on the
 * Moon are approximate: derived from LROC albedo and partitioned by IAU centre/size.
 */
export interface Mare {
  id: number // label value in mare_ids.png
  key: string
  name: string
  meaning: string
  lon: number
  lat: number
  diameterKm: number
  note: string
  /** reference ages from returned samples / orbital counts (billions of years), when known */
  agesGa?: string
  /** missions that visited or sampled */
  visited?: string
}

export const MARIA: Mare[] = [
  { id: 1, key: 'imbrium', name: 'Mare Imbrium', meaning: 'Sea of Showers', lon: -14.909, lat: 34.724, diameterKm: 1145.53, note: 'Fills the Imbrium impact basin, one of the youngest of the great basins. The lava flooded in long after the impact; its rim survives as the Apennine, Alps and Carpathian mountains.', agesGa: 'basin ≈ 3.85; lavas ≈ 3.2–3.5', visited: 'Apollo 15 (rim), Luna 17 / Lunokhod 1, Chang’e 3' },
  { id: 2, key: 'serenitatis', name: 'Mare Serenitatis', meaning: 'Sea of Serenity', lon: 18.36, lat: 27.288, diameterKm: 674.28, note: 'A circular basin with dark, titanium-rich lava and a ring of wrinkle ridges. Apollo 17 landed on its southeastern edge in the Taurus–Littrow valley.', agesGa: '≈ 3.7–3.8', visited: 'Apollo 17, Luna 21' },
  { id: 3, key: 'tranquillitatis', name: 'Mare Tranquillitatis', meaning: 'Sea of Tranquility', lon: 30.835, lat: 8.349, diameterKm: 875.75, note: 'A broad, irregular plain of iron- and titanium-rich basalt. Apollo 11’s samples from its southwest edge showed the dark plains are volcanic.', agesGa: '≈ 3.6–3.9', visited: 'Apollo 11' },
  { id: 4, key: 'crisium', name: 'Mare Crisium', meaning: 'Sea of Crises', lon: 59.104, lat: 16.177, diameterKm: 555.92, note: 'An isolated, oval basin near the eastern limb, visible with the naked eye as a dark spot at the Moon’s right edge from the northern hemisphere.', agesGa: '≈ 3.3–3.6', visited: 'Luna 24 (1976), Blue Ghost 1 (2025)' },
  { id: 5, key: 'fecunditatis', name: 'Mare Fecunditatis', meaning: 'Sea of Fecundity', lon: 53.669, lat: -7.835, diameterKm: 840.35, note: 'A very large, irregular mare near the eastern limb, a patchwork of overlapping lava flows.', visited: 'Luna 16 (first robotic sample return, 1970)' },
  { id: 6, key: 'nectaris', name: 'Mare Nectaris', meaning: 'Sea of Nectar', lon: 34.602, lat: -15.185, diameterKm: 339.39, note: 'The basalt-filled floor of the Nectaris basin, whose impact defines the start of the Nectarian period.', visited: 'SLIM landed nearby (2024)' },
  { id: 7, key: 'nubium', name: 'Mare Nubium', meaning: 'Sea of Clouds', lon: -17.287, lat: -20.589, diameterKm: 714.5, note: 'A broad southern mare, home to the Straight Wall (Rupes Recta) and the crater Bullialdus.' },
  { id: 8, key: 'humorum', name: 'Mare Humorum', meaning: 'Sea of Moisture', lon: -38.572, lat: -24.479, diameterKm: 419.67, note: 'A round basin mare ringed by faults and fractured crater Gassendi on its rim.' },
  { id: 9, key: 'frigoris', name: 'Mare Frigoris', meaning: 'Sea of Cold', lon: -0.006, lat: 57.592, diameterKm: 1446.41, note: 'A long, narrow mare along the northern edge of the near side, east–west for more than a thousand kilometres.' },
  { id: 10, key: 'vaporum', name: 'Mare Vaporum', meaning: 'Sea of Vapors', lon: 4.09, lat: 13.2, diameterKm: 242.46, note: 'A small mare between the Apennine and Haemus mountains.' },
  { id: 11, key: 'cognitum', name: 'Mare Cognitum', meaning: 'Sea that has become known', lon: -22.314, lat: -10.531, diameterKm: 350.01, note: 'Named after Ranger 7 returned the first close images of the Moon here in July 1964.', visited: 'Ranger 7 (impact)' },
  { id: 12, key: 'insularum', name: 'Mare Insularum', meaning: 'Sea of Islands', lon: -30.64, lat: 7.792, diameterKm: 511.93, note: 'A mare scattered with islands of highland material and ray debris from nearby craters.' },
  { id: 13, key: 'procellarum', name: 'Oceanus Procellarum', meaning: 'Ocean of Storms', lon: -56.677, lat: 20.671, diameterKm: 2592.24, note: 'The only “ocean”: the largest dark region on the Moon, spanning more than 2,500 km. Its origin is debated; the rock beneath is unusually rich in heat-producing elements.', agesGa: '≈ 1.2–3.9; Chang’e-5 basalts ≈ 2.0', visited: 'Apollo 12, Luna 9, Surveyor 1 & 3, Chang’e 5' },
  { id: 14, key: 'orientale', name: 'Mare Orientale', meaning: 'Eastern Sea', lon: -94.67, lat: -19.866, diameterKm: 294.16, note: 'A thin patch of lava in the bull’s-eye centre of the Orientale basin; the basalt layer is probably under 1 km thick.' },
  { id: 15, key: 'moscoviense', name: 'Mare Moscoviense', meaning: 'Sea of Muscovy', lon: 148.123, lat: 27.282, diameterKm: 275.57, note: 'One of the few maria on the far side, filling a basin in the northern far-side highlands.' },
  { id: 16, key: 'smythii', name: 'Mare Smythii', meaning: 'Smyth’s Sea', lon: 87.05, lat: -1.709, diameterKm: 373.97, note: 'A dark plain right on the eastern limb, glimpsed only at favourable libration.' },
  { id: 17, key: 'marginis', name: 'Mare Marginis', meaning: 'Sea of the Edge', lon: 86.515, lat: 12.702, diameterKm: 357.63, note: 'A small mare at the very edge of the visible disc, notable for light-coloured swirls that coincide with magnetic anomalies.' },
  { id: 18, key: 'ingenii', name: 'Mare Ingenii', meaning: 'Sea of Cleverness', lon: 164.827, lat: -33.246, diameterKm: 282.2, note: 'A far-side mare; its bright swirls coincide with magnetic anomalies.' },
  { id: 19, key: 'australe', name: 'Mare Australe', meaning: 'Southern Sea', lon: 91.985, lat: -47.771, diameterKm: 996.84, note: 'A patchy mare on the southeastern limb, with scattered lava-filled craters.' },
  { id: 20, key: 'humboldtianum', name: 'Mare Humboldtianum', meaning: 'Humboldt’s Sea', lon: 81.543, lat: 56.922, diameterKm: 230.78, note: 'A small mare on the northeastern limb, filling the Humboldtianum impact basin.' },
]

export const MARE_BY_KEY = new Map(MARIA.map((m) => [m.key, m]))

export const MARIA_FACTS = {
  coverageNear: 'about a third of the near side',
  coverageFar: 'only a few percent of the far side',
  coverageAll: 'roughly 16 % of the whole surface',
  youngestDated: '2.03 billion years (Chang’e-5 basalt, lead–lead dating)',
}
