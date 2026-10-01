import { Vector3 } from 'three'
import { Astronomy, MOON_RADIUS_KM, lonLatToVec } from '../astro/ephemeris'
import type { Landmark } from '../content/landmarks'
import type { RingSpec } from '../engine/Moon'

export const NOW = Date.now()
const DAY = 86400000

/* ------------------------------------------------------------------ lunation anchors */
let anchor: { start: number; end: number } | null = null

/** The lunation containing "now": previous new moon → next new moon (epoch ms). */
export function lunation(): { start: number; end: number } {
  if (anchor) return anchor
  const t0 = new Astronomy.AstroTime(new Date(NOW - 31 * DAY))
  let nm = Astronomy.SearchMoonPhase(0, t0, 40)!
  // advance until the next new moon would be after now
  for (let i = 0; i < 3; i++) {
    const next = Astronomy.SearchMoonPhase(0, nm.AddDays(2), 40)!
    if (next.date.getTime() > NOW) {
      anchor = { start: nm.date.getTime(), end: next.date.getTime() }
      return anchor
    }
    nm = next
  }
  anchor = { start: NOW - 14 * DAY, end: NOW + 15 * DAY }
  return anchor
}

const phaseCache = new Map<number, number>()
/** epoch ms within the anchor lunation at which the Moon's elongation phase equals `deg` (0 new, 90 first quarter, 180 full…) */
export function datePhase(deg: number): number {
  const key = Math.round(deg * 4) / 4
  const hit = phaseCache.get(key)
  if (hit !== undefined) return hit
  const { start } = lunation()
  const d = ((key % 360) + 360) % 360
  const t = d === 0 ? new Astronomy.AstroTime(new Date(start)) : Astronomy.SearchMoonPhase(d, new Astronomy.AstroTime(new Date(start - 0.5 * DAY)), 40)
  const ms = t ? t.date.getTime() : start + (d / 360) * 29.53 * DAY
  phaseCache.set(key, ms)
  return ms
}

/** date for a fraction u (0..1) of the anchor lunation, linear in time */
export function dateLunation(u: number): number {
  const { start, end } = lunation()
  return start + (end - start) * u
}

/** phase (elongation deg) whose sub-solar longitude is `lon` (east+). */
export function phaseForSubsolar(lon: number): number {
  return (((180 - lon) % 360) + 360) % 360
}

export function dateSubsolar(lon: number): number {
  return datePhase(phaseForSubsolar(lon))
}

/** quarter fractions of the anchor lunation for tick marks */
export function quarterFractions(): number[] {
  const { start, end } = lunation()
  return [0, 90, 180, 270].map((d) => (datePhase(d) - start) / (end - start))
}

/* ------------------------------------------------------------------ misc */
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (t: number) => t * t * (3 - 2 * t)
export const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
export const sstep = (a: number, b: number, x: number) => smooth(clamp((x - a) / (b - a), 0, 1))

/**
 * Camera distance (Moon radii from centre) at which a feature of `diameterKm` spans `frac` of the half view height
 * (vertical fov 30°).  d = cos(a) + sin(a) / (frac · tan(fov/2)),  a = angular radius of the feature.
 */
export function distForFeature(diameterKm: number, frac = 0.42): number {
  const a = Math.min(1.2, diameterKm / 2 / MOON_RADIUS_KM)
  const t = frac * Math.tan((30 * Math.PI) / 360)
  return clamp(Math.cos(a) + Math.sin(a) / t, 1.18, 5.4)
}

export function dirOf(l: { lon: number; lat: number }): Vector3 {
  return lonLatToVec(l.lon, l.lat)
}

export function framing(l: Landmark): number {
  // craters get a wider context frame (the global textures are soft below ~350 km altitude)
  const frac = l.diameterKm < 400 ? 0.3 : 0.42
  return distForFeature(l.diameterKm || 60, frac / (l.frame ?? 1))
}

export function fmtKm(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

export function fmtLat(lat: number, d = 2): string {
  return `${Math.abs(lat).toFixed(d)}°${lat >= 0 ? 'N' : 'S'}`
}
export function fmtLon(lon: number, d = 2): string {
  return `${Math.abs(lon).toFixed(d)}°${lon >= 0 ? 'E' : 'W'}`
}
export function fmtCoord(lon: number, lat: number): string {
  return `${fmtLat(lat)} · ${fmtLon(lon)}`
}


/** A surface-anchored reticle ring around a feature. */
export function ringOf(l: { lon: number; lat: number; diameterKm?: number }, time: number, strength = 1, pad = 1.18): RingSpec {
  const r = Math.max(0.012, ((l.diameterKm ?? 40) / 2 / MOON_RADIUS_KM) / pad)
  return { dir: lonLatToVec(l.lon, l.lat), radius: r, strength, widthPx: 1.5, reticle: true, phase: time * 0.12 }
}
