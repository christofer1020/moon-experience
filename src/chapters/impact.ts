import type { Landmark } from '../content/landmarks'
import { lonLatToVec } from '../astro/ephemeris'
import { MOON_RADIUS_KM } from '../astro/ephemeris'
import type { SceneCtx } from './types'
import { clamp, dateSubsolar } from './helpers'

/** Educational impact replay timing (seconds). Time is compressed: this is a visualisation, not a simulation. */
export const IMPACT = { approach: 3.4, grow: 9.0 }

const state = { nonce: 0, start: -1, id: '' }

export function impactActive(): boolean {
  return state.start >= 0
}

/** Start/advance the replay. Returns true while the replay owns the camera. */
export function runImpact(c: SceneCtx, l: Landmark): boolean {
  const { p, s } = c
  if (s.tool.impactNonce !== state.nonce) {
    state.nonce = s.tool.impactNonce
    state.start = c.now
    state.id = l.id
  }
  if (state.start < 0 || state.id !== l.id) return false
  const el = c.now - state.start
  const total = IMPACT.approach + IMPACT.grow + 2.2
  if (el > total) {
    state.start = -1
    return false
  }
  const rho = Math.max(0.01, l.diameterKm / 2 / MOON_RADIUS_KM)
  const dir = lonLatToVec(l.lon, l.lat)
  p.impact.dir = dir
  p.impact.radius = rho
  p.impact.depth = 0.075
  if (el < IMPACT.approach) {
    p.impact.approach = el / IMPACT.approach
    p.impact.active = false
    p.impact.t = 0
    p.impact.flatten = 1
  } else {
    const t = clamp((el - IMPACT.approach) / IMPACT.grow, 0, 1)
    p.impact.approach = -1
    p.impact.active = true
    p.impact.t = t
    p.impact.flatten = 1 - clamp((t - 0.86) / 0.14, 0, 1)
    if (t >= 1) p.impact.active = el < total - 0.5
  }
  // oblique "chase" camera: stand off to the south of the crater, low, looking north
  const h = clamp(5.2 * rho, 0.05, 0.5)
  const alt = 0.22 + rho * 2.4
  const latCam = l.lat - (h * 180) / Math.PI
  const pitch = -(Math.atan2(alt, h) * 180) / Math.PI
  p.cam = { kind: 'ground', lon: l.lon, lat: clamp(latCam, -85, 85), alt, heading: l.lat - h * 57 < -85 ? 180 : 0, pitch }
  p.fov = 34
  p.date = dateSubsolar(l.lon + 78)
  p.dateTau = 0.5
  p.rings = []
  return true
}
