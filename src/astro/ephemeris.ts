/**
 * Real-sky ephemeris for the Earth–Moon–Sun system.
 *
 * Frames
 *  - "system" frame: Earth-centred, ecliptic-aligned (three.js axes: +Y = ecliptic north,
 *    +X = vernal equinox, +Z = -(ecliptic Y)).  Units: Moon radii (1 unit = 1737.4 km).
 *  - "body" frame (render): +X → selenographic (lon 0, lat 0), +Y → north pole, -Z → lon 90°E.
 *
 * Positions come from astronomy-engine (VSOP87 / Chapront-based lunar series, arcminute-class).
 * The Moon's orientation uses the IAU/WGCCRE pole + prime-meridian model (Archinal et al. 2018)
 * so libration (optical + physical) emerges from geometry rather than being faked.
 */
import * as Astronomy from 'astronomy-engine'
import { Matrix4, Quaternion, Vector3 } from 'three'

export const MOON_RADIUS_KM = 1737.4
export const EARTH_RADIUS_KM = 6371.0
export const SUN_RADIUS_KM = 695_700
export const AU_KM = 149_597_870.7
export const KM_PER_AU = AU_KM

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

/** EQJ (J2000 equatorial) → system frame (three axes, ecliptic-aligned). */
const eqjToEcl = Astronomy.Rotation_EQJ_ECL()
export function eqjToSystem(v: { x: number; y: number; z: number }, scale = 1): Vector3 {
  const e = Astronomy.RotateVector(eqjToEcl, new Astronomy.Vector(v.x, v.y, v.z, new Astronomy.AstroTime(new Date())))
  // ecliptic (x,y,z) → three (x, z, -y)
  return new Vector3(e.x * scale, e.z * scale, -e.y * scale)
}

function eqjToSystemRaw(x: number, y: number, z: number, scale: number): Vector3 {
  const m = eqjToEcl.rot
  const ex = m[0][0] * x + m[1][0] * y + m[2][0] * z
  const ey = m[0][1] * x + m[1][1] * y + m[2][1] * z
  const ez = m[0][2] * x + m[1][2] * y + m[2][2] * z
  return new Vector3(ex * scale, ez * scale, -ey * scale)
}

/** Selenographic (lon east+, lat north+, degrees) → unit vector in the body (render) frame. */
export function lonLatToVec(lonDeg: number, latDeg: number, out = new Vector3()): Vector3 {
  const lon = lonDeg * DEG
  const lat = latDeg * DEG
  return out.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon))
}

export function vecToLonLat(v: Vector3): { lon: number; lat: number } {
  const n = v.clone().normalize()
  return { lon: Math.atan2(-n.z, n.x) * RAD, lat: Math.asin(Math.max(-1, Math.min(1, n.y))) * RAD }
}

/** IAU rotation model for the Moon (WGCCRE 2009/2015). Returns body(IAU) → ICRF rotation. */
function iauMoonRotation(date: Date): Matrix4 {
  const d = (date.getTime() / 86400000 + 2440587.5) - 2451545.0 // days from J2000.0
  const T = d / 36525
  const E = (a: number, b: number) => (a + b * d) * DEG
  const E1 = E(125.045, -0.0529921)
  const E2 = E(250.089, -0.1059842)
  const E3 = E(260.008, 13.012_0009)
  const E4 = E(176.625, 13.340_7154)
  const E5 = E(357.529, 0.985_6003)
  const E6 = E(311.589, 26.405_7084)
  const E7 = E(134.963, 13.064_9930)
  const E8 = E(276.617, 0.328_7146)
  const E9 = E(34.226, 1.748_4877)
  const E10 = E(15.134, -0.158_9763)
  const E11 = E(119.743, 0.003_6096)
  const E12 = E(239.961, 0.164_3573)
  const E13 = E(25.053, 12.959_0088)
  const ra =
    269.9949 + 0.0031 * T - 3.8787 * Math.sin(E1) - 0.1204 * Math.sin(E2) + 0.07 * Math.sin(E3) - 0.0172 * Math.sin(E4) +
    0.0072 * Math.sin(E6) - 0.0052 * Math.sin(E10) + 0.0043 * Math.sin(E13)
  const dec =
    66.5392 + 0.013 * T + 1.5419 * Math.cos(E1) + 0.0239 * Math.cos(E2) - 0.0278 * Math.cos(E3) + 0.0068 * Math.cos(E4) -
    0.0029 * Math.cos(E6) + 0.0009 * Math.cos(E7) + 0.0008 * Math.cos(E10) - 0.0009 * Math.cos(E13)
  const W =
    38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.561 * Math.sin(E1) + 0.1208 * Math.sin(E2) - 0.0642 * Math.sin(E3) +
    0.0158 * Math.sin(E4) + 0.0252 * Math.sin(E5) - 0.0066 * Math.sin(E6) - 0.0047 * Math.sin(E7) - 0.0046 * Math.sin(E8) +
    0.0028 * Math.sin(E9) + 0.0052 * Math.sin(E10) + 0.004 * Math.sin(E11) + 0.0019 * Math.sin(E12) - 0.0044 * Math.sin(E13)
  // R = Rz(ra+90°) · Rx(90°-dec) · Rz(W)
  const m = new Matrix4().makeRotationZ((ra + 90) * DEG)
  m.multiply(new Matrix4().makeRotationX((90 - dec) * DEG))
  m.multiply(new Matrix4().makeRotationZ((((W % 360) + 360) % 360) * DEG))
  return m
}

// IAU body axes (x→lon0, y→lon90E, z→north)  →  render body axes (x, y=north, z=-east)
const IAU_TO_RENDER = new Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1)

// EQJ → system axes as a Matrix4
const EQJ_TO_SYSTEM = (() => {
  const a = eqjToSystemRaw(1, 0, 0, 1)
  const b = eqjToSystemRaw(0, 1, 0, 1)
  const c = eqjToSystemRaw(0, 0, 1, 1)
  return new Matrix4().makeBasis(a, b, c)
})()

export interface SkyState {
  date: Date
  /** Moon centre in system frame, Moon-radii units (true distance). */
  moonPos: Vector3
  /** Unit vector Earth→Sun in system frame. */
  sunDir: Vector3
  /** Sun distance in Moon radii. */
  sunDist: number
  /** Body (render) → system rotation of the Moon. */
  moonQuat: Quaternion
  /** Earth's spin: system quaternion for an Earth mesh whose +Y is the geographic pole, lon 0 on +X. */
  earthQuat: Quaternion
  distKm: number
  /** Sub-Earth point (selenographic lon/lat, degrees) — i.e. where the Earth is overhead (libration). */
  subEarth: { lon: number; lat: number }
  /** Sub-solar point (selenographic lon/lat, degrees). */
  subSolar: { lon: number; lat: number }
  /** Moon–Sun ecliptic elongation phase angle 0..360 (0 new, 90 first quarter, 180 full). */
  phaseDeg: number
  /** Illuminated fraction 0..1 as seen from Earth. */
  illumination: number
  /** Phase angle Sun–Moon–Earth in degrees (0 = full). */
  phaseAngle: number
  /** Age of the Moon in days since new moon (approx. from phase). */
  ageDays: number
  /** Angular diameters in degrees as seen from Earth's centre. */
  moonAngDeg: number
  sunAngDeg: number
}

const MOON_RAD_AU = MOON_RADIUS_KM / KM_PER_AU
const tmpM = new Matrix4()

export function skyAt(date: Date): SkyState {
  const t = new Astronomy.AstroTime(date)
  const moon = Astronomy.GeoMoon(t) // EQJ, AU
  const sun = Astronomy.GeoVector(Astronomy.Body.Sun, t, true)
  const moonPos = eqjToSystemRaw(moon.x, moon.y, moon.z, 1 / MOON_RAD_AU)
  const sunVec = eqjToSystemRaw(sun.x, sun.y, sun.z, 1 / MOON_RAD_AU)
  const sunDist = sunVec.length()
  const sunDir = sunVec.clone().normalize()

  // Moon orientation: body(render) → IAU → ICRF → system
  const R = iauMoonRotation(date)
  tmpM.copy(EQJ_TO_SYSTEM).multiply(R).multiply(IAU_TO_RENDER.clone().transpose())
  // body(render) = P^T-inverse chain: render→IAU is IAU_TO_RENDER^T
  const moonQuat = new Quaternion().setFromRotationMatrix(tmpM)

  const inv = moonQuat.clone().invert()
  const toEarthBody = moonPos.clone().multiplyScalar(-1).normalize().applyQuaternion(inv)
  const sunBody = sunDir.clone().applyQuaternion(inv)
  const subEarth = vecToLonLat(toEarthBody)
  const subSolar = vecToLonLat(sunBody)

  const phaseDeg = Astronomy.MoonPhase(t)
  const ill = Astronomy.Illumination(Astronomy.Body.Moon, t)
  const phaseAngle = ill.phase_angle
  const distKm = moonPos.length() * MOON_RADIUS_KM

  // Earth spin: Greenwich sidereal time rotates the Earth about the equatorial pole.
  const gst = Astronomy.SiderealTime(t) // hours
  const earthQuat = earthQuaternion(gst)

  return {
    date,
    moonPos,
    sunDir,
    sunDist,
    moonQuat,
    earthQuat,
    distKm,
    subEarth,
    subSolar,
    phaseDeg,
    illumination: ill.phase_fraction,
    phaseAngle,
    ageDays: (phaseDeg / 360) * 29.530588,
    moonAngDeg: 2 * Math.asin(MOON_RADIUS_KM / distKm) * RAD,
    sunAngDeg: 2 * Math.asin(SUN_RADIUS_KM / (sunDist * MOON_RADIUS_KM)) * RAD,
  }
}

/**
 * Earth rotation quaternion in system frame. The Earth mesh: +Y = geographic north, lon 0 faces +X
 * before rotation (standard equirect texture with u=0.5 at lon 0 mapped via our shader).
 */
export function earthQuaternion(gstHours: number): Quaternion {
  // equatorial (EQJ) frame: z = celestial pole, x = vernal equinox. Spin about z by GST.
  const spin = new Matrix4().makeRotationZ(gstHours * 15 * DEG)
  // Earth mesh axes (x→lon0, y→north, z→-east) in the "geographic" equatorial frame:
  // geographic x→x, y(north)→z, z(-east)→-y
  const geoToEq = new Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1).transpose()
  // geoToEq maps render-style axes to equatorial: (x, y_north, z_negEast) → (x, east, north)
  const m = new Matrix4().copy(EQJ_TO_SYSTEM).multiply(spin).multiply(geoToEq)
  return new Quaternion().setFromRotationMatrix(m)
}

/** System-frame position of a point on Earth's surface (lat/lon degrees) in Moon-radii. */
export function observerSystemPos(date: Date, latDeg: number, lonDeg: number): Vector3 {
  const t = new Astronomy.AstroTime(date)
  const obs = new Astronomy.Observer(latDeg, lonDeg, 0)
  const v = Astronomy.ObserverVector(t, obs, false) // EQJ AU (geocentric)
  return eqjToSystemRaw(v.x, v.y, v.z, 1 / MOON_RAD_AU)
}

/** Sub-lunar-style helper: surface lat/lon on Earth directly under a system-frame direction. */
export function subPointOnEarth(date: Date, dirSystem: Vector3): { lat: number; lon: number } {
  const t = new Astronomy.AstroTime(date)
  const q = earthQuaternion(Astronomy.SiderealTime(t)).invert()
  const v = dirSystem.clone().normalize().applyQuaternion(q)
  return { lat: Math.asin(v.y) * RAD, lon: Math.atan2(-v.z, v.x) * RAD }
}

/* ------------------------------------------------------------------------------------------ */
/* Phases, quarters and eclipses                                                                */
/* ------------------------------------------------------------------------------------------ */

export const PHASE_NAMES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
] as const

export function phaseName(phaseDeg: number): string {
  return PHASE_NAMES[Math.floor(((phaseDeg + 22.5) % 360) / 45)]
}

export function previousNewMoon(date: Date): Date {
  const t = Astronomy.SearchMoonPhase(0, new Astronomy.AstroTime(new Date(date.getTime() - 31 * 86400000)), 40)
  let best = t!
  let cur = best
  // advance until just before `date`
  for (let i = 0; i < 3; i++) {
    const next = Astronomy.SearchMoonPhase(0, cur.AddDays(1), 40)
    if (!next || next.date.getTime() > date.getTime()) break
    cur = next
    best = next
  }
  return best.date
}

export interface MoonQuarterEvent {
  quarter: 0 | 1 | 2 | 3
  name: string
  date: Date
}

export function quartersInRange(start: Date, days: number): MoonQuarterEvent[] {
  const out: MoonQuarterEvent[] = []
  let q = Astronomy.SearchMoonQuarter(new Astronomy.AstroTime(start))
  const end = start.getTime() + days * 86400000
  while (q.time.date.getTime() < end) {
    out.push({ quarter: q.quarter as 0 | 1 | 2 | 3, name: ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'][q.quarter], date: q.time.date })
    q = Astronomy.NextMoonQuarter(q)
  }
  return out
}

export interface LunarEclipseEvent {
  kind: 'penumbral' | 'partial' | 'total'
  peak: Date
  obscuration: number
  semiPartialMin: number
  semiTotalMin: number
  semiPenumbralMin: number
}

export function nextLunarEclipses(from: Date, count: number): LunarEclipseEvent[] {
  const res: LunarEclipseEvent[] = []
  let e = Astronomy.SearchLunarEclipse(new Astronomy.AstroTime(from))
  for (let i = 0; i < count; i++) {
    res.push({
      kind: e.kind.toLowerCase() as LunarEclipseEvent['kind'],
      peak: e.peak.date,
      obscuration: e.obscuration,
      semiPartialMin: e.sd_partial,
      semiTotalMin: e.sd_total,
      semiPenumbralMin: e.sd_penum,
    })
    e = Astronomy.NextLunarEclipse(e.peak)
  }
  return res
}

export interface SolarEclipseEvent {
  kind: 'partial' | 'annular' | 'total' | 'hybrid'
  peak: Date
  obscuration: number | undefined
  latitude: number | undefined
  longitude: number | undefined
  distanceKm: number
}

export function nextSolarEclipses(from: Date, count: number): SolarEclipseEvent[] {
  const res: SolarEclipseEvent[] = []
  let e = Astronomy.SearchGlobalSolarEclipse(new Astronomy.AstroTime(from))
  for (let i = 0; i < count; i++) {
    res.push({
      kind: e.kind.toLowerCase() as SolarEclipseEvent['kind'],
      peak: e.peak.date,
      obscuration: e.obscuration,
      latitude: e.latitude,
      longitude: e.longitude,
      distanceKm: e.distance,
    })
    e = Astronomy.NextGlobalSolarEclipse(e.peak)
  }
  return res
}

export function previousSolarEclipses(from: Date, count: number): SolarEclipseEvent[] {
  // Eclipse seasons recur every ~173 days; scan backward in 6-month hops and collect distinct events.
  const found = new Map<number, SolarEclipseEvent>()
  let cursor = new Date(from.getTime() - 400 * 86400000)
  while (found.size < count + 4 && cursor.getTime() < from.getTime()) {
    const [ev] = nextSolarEclipses(cursor, 1)
    if (ev.peak.getTime() >= from.getTime()) break
    found.set(ev.peak.getTime(), ev)
    cursor = new Date(ev.peak.getTime() + 20 * 86400000)
  }
  return [...found.values()].slice(-count)
}

/** Ecliptic latitude of the Moon (degrees) — non-zero except at the nodes: why eclipses are rare. */
export function moonEclipticLatitude(date: Date): number {
  const m = Astronomy.EclipticGeoMoon(new Astronomy.AstroTime(date))
  return m.lat
}

/** Moon's angle (deg) above/below the ecliptic plane at date, plus node proximity helper. */
export function nodeInfo(date: Date) {
  const m = Astronomy.EclipticGeoMoon(new Astronomy.AstroTime(date))
  return { lat: m.lat, lon: m.lon }
}

/** Orbit polyline for the Moon around Earth over one sidereal month, in system frame, Moon-radii units. */
export function orbitPath(date: Date, steps = 180): Vector3[] {
  const pts: Vector3[] = []
  const sidereal = 27.321661
  for (let i = 0; i <= steps; i++) {
    const d = new Date(date.getTime() + ((i / steps) * sidereal - sidereal / 2) * 86400000)
    const m = Astronomy.GeoMoon(new Astronomy.AstroTime(d))
    pts.push(eqjToSystemRaw(m.x, m.y, m.z, 1 / MOON_RAD_AU))
  }
  return pts
}

export const KM_PER_UNIT = MOON_RADIUS_KM
export { Astronomy }
