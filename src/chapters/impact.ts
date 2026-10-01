import type { Landmark } from '../content/landmarks'
import { lonLatToVec } from '../astro/ephemeris'
import { MOON_RADIUS_KM } from '../astro/ephemeris'
import type { SceneCtx } from './types'
import { clamp, dateSubsolar } from './helpers'
import { engine } from '../app/engine'

/** Educational impact replay timing (seconds). Time is compressed: this is a visualisation, not a simulation. */
/** lead: dip to black while the camera cuts to the oblique view; out: dip to black before cutting back */
export const IMPACT = { lead: 1.4, approach: 3.2, grow: 9.0, tail: 2.0, out: 1.1 }

const state = { nonce: 0, start: -1, id: '', fired: false, snapped: false, tailUntil: -1 }

export function impactActive(): boolean {
  return state.start >= 0 || (state.tailUntil > 0 && (engine.obs?.time ?? 0) < state.tailUntil)
}

/** Start/advance the replay. Returns true while the replay owns the camera. */
export function runImpact(c: SceneCtx, l: Landmark): boolean {
  const { p, s } = c
  if (s.tool.impactNonce !== state.nonce) {
    state.nonce = s.tool.impactNonce
    state.start = c.now
    state.id = l.id
    state.fired = false
    state.snapped = false
    state.tailUntil = -1
  }
  // after the replay: hold black while the camera returns to the story view, then fade back in
  if (state.start < 0 && state.tailUntil > 0) {
    const k = state.tailUntil - c.now
    if (k > 0) {
      p.fade = k > 0.75 ? 1 : 0
      p.camSnap = k > 0.8
      return false
    }
    state.tailUntil = -1
  }
  if (state.start < 0 || state.id !== l.id) return false
  const el = c.now - state.start
  const total = IMPACT.lead + IMPACT.approach + IMPACT.grow + IMPACT.tail + IMPACT.out
  if (el > total) {
    state.start = -1
    state.tailUntil = c.now + 1.3
    return false
  }
  // cut to the oblique camera under a dip to black, so the move never shows the terrain close up
  if (el < IMPACT.lead) p.fade = 1
  else if (el > total - IMPACT.out) p.fade = 1
  if (!state.snapped && el > IMPACT.lead - 0.15) {
    state.snapped = true
    p.camSnap = true
  }
  const rho = Math.max(0.01, l.diameterKm / 2 / MOON_RADIUS_KM)
  const dir = lonLatToVec(l.lon, l.lat)
  p.impact.dir = dir
  p.impact.radius = rho
  p.impact.depth = 0.075
  const elA = el - IMPACT.lead
  if (elA < 0) {
    p.impact.approach = -1
    p.impact.active = false
    p.impact.t = 0
    p.impact.flatten = 0
  } else if (elA < IMPACT.approach) {
    p.impact.approach = elA / IMPACT.approach
    p.impact.active = false
    p.impact.t = 0
    p.impact.flatten = 1
  } else {
    if (!state.fired) {
      state.fired = true
      engine.sound?.cue('impact')
    }
    const t = clamp((elA - IMPACT.approach) / IMPACT.grow, 0, 1)
    p.impact.approach = -1
    p.impact.active = true
    p.impact.t = t
    p.impact.flatten = 1 - clamp((t - 0.86) / 0.14, 0, 1)
    if (t >= 1) p.impact.active = el < total - IMPACT.out
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
