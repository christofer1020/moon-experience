import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { lonLatToVec } from '../astro/ephemeris'

export type CamTarget =
  /** look at the Moon from above (lon, lat) at `dist` Moon-radii from its centre; north up */
  | { kind: 'surface'; lon: number; lat: number; dist: number; roll?: number }
  /** orbit a focus point in the Earth–Moon system (ecliptic frame, +Y north). `follow` makes `focus` an offset from the Moon / the Earth–Moon midpoint. */
  | { kind: 'system'; focus: Vector3; az: number; el: number; dist: number; follow?: 'moon' | 'mid' }
  /** stand on the Earth–Moon line looking at the Moon (as seen from Earth, ecliptic north up) */
  | { kind: 'earthview'; dist: number; roll?: number }
  /** low-altitude "spacecraft" camera above a surface point looking along a heading */
  | { kind: 'ground'; lon: number; lat: number; alt: number; heading: number; pitch: number }

export interface ResolvedTarget {
  pivot: Vector3
  dir: Vector3 // unit: from pivot toward camera
  dist: number
  up: Vector3
  /** true when the view is attached to the Moon's body frame (surface / ground cameras) */
  anchored: boolean
  /** how the pivot rides on the Moon's orbital motion for views that are not body-anchored */
  rides: 'none' | 'moon' | 'mid' | 'earthview'
}

const DEG = Math.PI / 180
const tmpA = new Vector3()
const tmpB = new Vector3()
const tmpQ = new Quaternion()
const tmpRide = new Vector3()
const tmpRideA = new Vector3()
const tmpRideB = new Vector3()

/** north tangent at a selenographic point (body frame) */
function northTangent(lon: number, lat: number, out: Vector3): Vector3 {
  const lo = lon * DEG
  const la = lat * DEG
  return out.set(-Math.sin(la) * Math.cos(lo), Math.cos(la), Math.sin(la) * Math.sin(lo))
}
function eastTangent(lon: number, out: Vector3): Vector3 {
  const lo = lon * DEG
  // d(position)/d(lon) / cos(lat)
  return out.set(-Math.sin(lo), 0, -Math.cos(lo))
}

export function resolveTarget(
  t: CamTarget,
  moonPos: Vector3,
  moonQuat: Quaternion,
  user: { a: number; e: number },
  out: ResolvedTarget,
): ResolvedTarget {
  out.anchored = t.kind === 'surface' || t.kind === 'ground'
  out.rides = t.kind === 'earthview' ? 'earthview' : t.kind === 'system' && t.follow ? t.follow : 'none'
  if (t.kind === 'earthview') {
    out.dir.copy(moonPos).multiplyScalar(-1).normalize()
    out.pivot.copy(moonPos)
    out.dist = t.dist
    out.up.set(0, 1, 0)
    if (t.roll) out.up.applyAxisAngle(out.dir, t.roll * DEG)
    // keep a stable up near the poles of the ecliptic
    if (Math.abs(out.dir.y) > 0.98) out.up.set(0, 0, 1)
    // user look-around: yaw about up, pitch about the camera's right axis
    if (user.a || user.e) {
      out.dir.applyAxisAngle(out.up, user.a)
      const right = tmpA.crossVectors(out.up, out.dir).normalize()
      out.dir.applyAxisAngle(right, -user.e)
    }
    return out
  }
  if (t.kind === 'surface') {
    const lon = t.lon + user.a * (180 / Math.PI)
    const lat = Math.max(-89.5, Math.min(89.5, t.lat + user.e * (180 / Math.PI)))
    const d = lonLatToVec(lon, lat, tmpA)
    out.dir.copy(d).applyQuaternion(moonQuat)
    out.pivot.copy(moonPos)
    out.dist = t.dist
    northTangent(lon, lat, tmpB)
    if (t.roll) tmpB.applyAxisAngle(d, t.roll * DEG)
    out.up.copy(tmpB).applyQuaternion(moonQuat)
    return out
  }
  if (t.kind === 'system') {
    const az = t.az + user.a
    const el = Math.max(-1.45, Math.min(1.45, t.el + user.e))
    out.dir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az))
    out.pivot.copy(t.focus)
    if (t.follow === 'moon') out.pivot.add(moonPos)
    else if (t.follow === 'mid') out.pivot.addScaledVector(moonPos, 0.5)
    out.dist = t.dist
    out.up.set(0, 1, 0)
    return out
  }
  // ground
  const lon = t.lon
  const lat = t.lat
  const n = lonLatToVec(lon, lat, tmpA) // up
  const N = northTangent(lon, lat, new Vector3())
  const E = eastTangent(lon, new Vector3())
  const h = (t.heading + user.a * (180 / Math.PI) * 0.35) * DEG
  const p = Math.max(-1.45, Math.min(0.9, t.pitch * DEG + Math.max(-0.5, Math.min(0.5, user.e * 0.35))))
  const horiz = N.multiplyScalar(Math.cos(h)).addScaledVector(E, Math.sin(h))
  const fwd = horiz.multiplyScalar(Math.cos(p)).addScaledVector(n, Math.sin(p))
  const cam = n.clone().multiplyScalar(1 + t.alt)
  const D = 6
  const pivotBody = cam.clone().addScaledVector(fwd, D)
  out.pivot.copy(pivotBody).applyQuaternion(moonQuat).add(moonPos)
  out.dir.copy(fwd).multiplyScalar(-1).applyQuaternion(moonQuat)
  out.dist = D
  out.up.copy(n).applyQuaternion(moonQuat)
  return out
}

function slerpDir(a: Vector3, b: Vector3, step: number, upHint: Vector3, out: Vector3) {
  const dot = Math.max(-1, Math.min(1, a.dot(b)))
  const ang = Math.acos(dot)
  if (ang < 1e-6) return out.copy(b)
  const s = Math.min(step, ang)
  const axis = tmpA.crossVectors(a, b)
  if (axis.lengthSq() < 1e-10) {
    axis.crossVectors(a, upHint)
    if (axis.lengthSq() < 1e-10) axis.set(1, 0, 0).cross(a)
  }
  axis.normalize()
  tmpQ.setFromAxisAngle(axis, s)
  return out.copy(a).applyQuaternion(tmpQ).normalize()
}

export interface RigTuning {
  tau: number
  vmax: number
  accel: number
}

export class Rig {
  pivot = new Vector3()
  dir = new Vector3(0, 0, 1)
  up = new Vector3(0, 1, 0)
  dist = 5
  fov = 30
  shiftX = 0
  shiftY = 0
  private angVel = 0
  private logVel = 0
  /** user orbit offsets (radians), written by pointer input */
  user = { a: 0, e: 0 }
  /** zoom multiplier from user input (1 = chapter default) */
  zoom = 1
  private zoomS = 1
  initialised = false
  private target: ResolvedTarget = { pivot: new Vector3(), dir: new Vector3(0, 0, 1), dist: 5, up: new Vector3(0, 1, 0), anchored: true, rides: 'none' }
  speed = 1

  snap(t: ResolvedTarget) {
    this.pivot.copy(t.pivot)
    this.dir.copy(t.dir)
    this.dist = t.dist
    this.up.copy(t.up)
    this.angVel = 0
    this.logVel = 0
    this.initialised = true
  }

  /**
   * @param moonDelta rigid motion of the Moon since the last frame (applied to anchored views so that
   *        only the *residual* is eased: the camera travels with the Moon rather than lagging behind it)
   */
  step(
    t: ResolvedTarget,
    dt: number,
    tune: RigTuning,
    fovT: number,
    shiftT: [number, number],
    minDistToCentre: number,
    moonDelta?: { prevPos: Vector3; pos: Vector3; dq: Quaternion },
  ) {
    if (!this.initialised) this.snap(t)
    else if (t.anchored && moonDelta) {
      this.pivot.sub(moonDelta.prevPos).applyQuaternion(moonDelta.dq).add(moonDelta.pos)
      this.dir.applyQuaternion(moonDelta.dq)
      this.up.applyQuaternion(moonDelta.dq)
    } else if (moonDelta && t.rides !== 'none') {
      // views that ride the Moon's orbit (system focus on the Moon / mid-point, Earth-side view): carry the camera with
      // the orbital motion so only the residual is eased, otherwise a fast-moving Moon outruns the camera
      const d = tmpRide.copy(moonDelta.pos).sub(moonDelta.prevPos)
      if (t.rides === 'moon' || t.rides === 'earthview') this.pivot.add(d)
      else this.pivot.addScaledVector(d, 0.5)
      if (t.rides === 'earthview' && moonDelta.prevPos.lengthSq() > 1e-6 && moonDelta.pos.lengthSq() > 1e-6) {
        const a = tmpRideA.copy(moonDelta.prevPos).normalize().multiplyScalar(-1)
        const b = tmpRideB.copy(moonDelta.pos).normalize().multiplyScalar(-1)
        if (a.dot(b) < 0.999999) {
          tmpQ.setFromUnitVectors(a, b)
          this.dir.applyQuaternion(tmpQ)
          this.up.applyQuaternion(tmpQ)
        }
      }
    }
    const s = this.speed
    const tau = tune.tau / s
    // zoom smoothing
    this.zoomS += (this.zoom - this.zoomS) * (1 - Math.exp(-dt / 0.18))
    const targetDist = Math.max(minDistToCentre, t.dist * this.zoomS)

    // pivot: exponential approach
    const kp = 1 - Math.exp(-dt / (tau * 0.9))
    this.pivot.lerp(t.pivot, kp)

    // direction: acceleration-limited angular approach
    const dot = Math.max(-1, Math.min(1, this.dir.dot(t.dir)))
    const ang = Math.acos(dot)
    if (ang > 1e-5) {
      const desired = Math.min(ang / tau, tune.vmax * s)
      const dv = desired - this.angVel
      const lim = tune.accel * s * dt
      this.angVel += Math.max(-lim * 1.8, Math.min(lim, dv))
      slerpDir(this.dir, t.dir, Math.max(0, this.angVel) * dt, this.up, this.dir)
      if (Math.acos(Math.max(-1, Math.min(1, this.dir.dot(t.dir)))) < 1e-4) this.angVel = 0
    } else this.angVel = 0

    // up vector
    this.up.lerp(t.up, 1 - Math.exp(-dt / (tau * 0.8))).normalize()

    // distance in log space
    const lt = Math.log(targetDist)
    const lc = Math.log(this.dist)
    const err = lt - lc
    const desired = Math.max(-tune.vmax * 1.4 * s, Math.min(tune.vmax * 1.4 * s, err / tau))
    const lim = tune.accel * 1.4 * s * dt
    this.logVel += Math.max(-lim * 1.8, Math.min(lim, desired - this.logVel))
    let nlc = lc + this.logVel * dt
    if ((lt - nlc) * err <= 0) {
      nlc = lt
      this.logVel = 0
    }
    this.dist = Math.exp(nlc)

    this.fov += (fovT - this.fov) * (1 - Math.exp(-dt / (tau * 0.7)))
    this.shiftX += (shiftT[0] - this.shiftX) * (1 - Math.exp(-dt / (tau * 0.9)))
    this.shiftY += (shiftT[1] - this.shiftY) * (1 - Math.exp(-dt / (tau * 0.9)))
  }

  apply(cam: PerspectiveCamera) {
    cam.position.copy(this.pivot).addScaledVector(this.dir, this.dist)
    cam.up.copy(this.up)
    cam.lookAt(this.pivot)
    if (Math.abs(cam.fov - this.fov) > 0.001) {
      cam.fov = this.fov
    }
  }

  get resolved() {
    return this.target
  }
}
