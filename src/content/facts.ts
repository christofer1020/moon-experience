export interface Fact {
  label: string
  value: string
  unit?: string
  note?: string
}
export interface FactGroup {
  title: string
  facts: Fact[]
}

/** Figures from the NASA Moon Fact Sheet (NSSDCA), NASA Science, LRO/LOLA and lunar laser ranging. */
export const FACT_GROUPS: FactGroup[] = [
  {
    title: 'Size & mass',
    facts: [
      { label: 'Mean radius', value: '1,737.4', unit: 'km', note: 'LRO reference sphere' },
      { label: 'Equatorial radius', value: '1,738.1', unit: 'km' },
      { label: 'Mass', value: '7.346 × 10²²', unit: 'kg', note: '1.2 % of Earth' },
      { label: 'Mean density', value: '3,344', unit: 'kg/m³', note: 'Earth: 5,514' },
      { label: 'Surface gravity', value: '1.62', unit: 'm/s²', note: '≈ 16.5 % of Earth' },
      { label: 'Escape velocity', value: '2.38', unit: 'km/s' },
      { label: 'Geometric albedo', value: '0.12', note: 'reflects ≈ 12 % of the sunlight it receives' },
    ],
  },
  {
    title: 'Orbit & rotation',
    facts: [
      { label: 'Mean distance', value: '384,400', unit: 'km', note: 'semi-major axis' },
      { label: 'Perigee / apogee (mean)', value: '363,300 / 405,500', unit: 'km' },
      { label: 'Sidereal month', value: '27.32', unit: 'days', note: 'one orbit; one rotation' },
      { label: 'Synodic month', value: '29.53', unit: 'days', note: 'new Moon to new Moon' },
      { label: 'Eccentricity', value: '0.0549' },
      { label: 'Inclination to the ecliptic', value: '5.145', unit: '°' },
      { label: 'Mean orbital speed', value: '1.022', unit: 'km/s' },
      { label: 'Recession from Earth', value: '3.8', unit: 'cm / year', note: 'lunar laser ranging' },
    ],
  },
  {
    title: 'Surface & interior',
    facts: [
      { label: 'Daytime / night temperature', value: '+127 / −173', unit: '°C', note: 'NASA Science; equatorial extremes' },
      { label: 'Coldest measured', value: '≈ −248', unit: '°C', note: 'Hermite crater, LRO Diviner' },
      { label: 'Atmosphere', value: 'exosphere', note: 'night pressure ≈ 3 × 10⁻¹⁵ bar' },
      { label: 'Elevation range', value: '−9.1 to +10.8', unit: 'km', note: 'LOLA, relative to 1,737.4 km' },
      { label: 'Crust thickness', value: '≈ 40 to ≈ 60', unit: 'km', note: 'near side to far side' },
      { label: 'Maria', value: '≈ 16', unit: '% of surface' },
      { label: 'Inner core radius', value: '≈ 240', unit: 'km' },
    ],
  },
  {
    title: 'Exploration',
    facts: [
      { label: 'Apollo landings', value: '6', note: '1969–1972; 12 people walked on the Moon' },
      { label: 'Samples returned by Apollo', value: '≈ 382', unit: 'kg', note: '842 lb' },
      { label: 'Robotic spacecraft launched', value: '> 105', note: 'NASA Science' },
      { label: 'Farthest human distance', value: '252,756', unit: 'miles', note: 'Artemis II, 6 April 2026 (≈ 406,800 km)' },
    ],
  },
]

export interface Source {
  name: string
  url: string
  use: string
}

export const SOURCES: Source[] = [
  { name: 'NASA SVS — CGI Moon Kit (LROC color mosaic, LOLA elevation)', url: 'https://svs.gsfc.nasa.gov/4720', use: 'Surface imagery and elevation (public domain)' },
  { name: 'NASA Trek — LRO WAC global mosaic (303 ppd)', url: 'https://trek.nasa.gov/moon/', use: 'High-resolution close-up tiles around 32 sites (detail added to the colour map)' },
  { name: 'NASA Moon Fact Sheet (NSSDCA)', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html', use: 'Physical and orbital parameters' },
  { name: 'NASA Science — Moon facts / formation / phases', url: 'https://science.nasa.gov/moon/facts/', use: 'Bulk facts, giant impact, phases' },
  { name: 'IAU Gazetteer of Planetary Nomenclature (USGS)', url: 'https://planetarynames.wr.usgs.gov/', use: 'Feature names, positions and diameters' },
  { name: 'Apollo Lunar Surface Journal — landing site coordinates', url: 'https://apollojournals.org/alsj/alsjcoords.html', use: 'Apollo site coordinates' },
  { name: 'LROC / LRO Diviner / LCROSS (NASA)', url: 'https://science.nasa.gov/solar-system/moon/10-cool-things-nasas-lunar-reconnaissance-orbiter-is-teaching-us-about-the-moon/', use: 'Polar cold traps, water ice' },
  { name: 'Colaprete et al. 2010, Science — water in the LCROSS plume', url: 'https://pubmed.ncbi.nlm.nih.gov/20966242/', use: '5.6 ± 2.9 % water ice by mass' },
  { name: 'NASA — Artemis II mission and record distance', url: 'https://www.nasa.gov/mission/artemis-ii/', use: 'April 2026 crewed flyby' },
  { name: 'NASA — Artemis program', url: 'https://www.nasa.gov/humans-in-space/artemis/', use: 'Artemis III (2027 Earth-orbit test) and Artemis IV (landing, 2028 target)' },
  { name: 'astronomy-engine (Don Cross)', url: 'https://github.com/cosinekitty/astronomy', use: 'Moon, Sun and Earth positions; phases; eclipses; libration cross-check' },
  { name: 'IAU WGCCRE report (Archinal et al.)', url: 'https://doi.org/10.1007/s10569-010-9320-4', use: 'Moon rotation model (pole and prime meridian)' },
  { name: 'HYG Star Database (D. Nash), CC BY-SA 4.0', url: 'https://github.com/astronexus/HYG-Database', use: 'Real star positions and brightnesses' },
  { name: 'NASA Visible Earth — Blue Marble / Black Marble', url: 'https://visibleearth.nasa.gov/', use: 'Earth day and night imagery' },
  { name: 'Instrument Serif, Instrument Sans, JetBrains Mono (SIL OFL 1.1)', url: 'https://fontsource.org/', use: 'Typography, served locally via Fontsource' },
]
