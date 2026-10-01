import {
  Color,
  HalfFloatType,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { MoonBody, type RingSpec } from './Moon'
import { EarthBody, EARTH_R } from './Earth'
import { Sky } from './Sky'
import { Post } from './Post'
import { Rig, resolveTarget, type CamTarget, type ResolvedTarget } from './Rig'
import { pickQuality, probeDevice, type DeviceInfo, type Quality } from './quality'
import { lonLatToVec, skyAt, vecToLonLat, MOON_RADIUS_KM, type SkyState } from '../astro/ephemeris'
import { SystemOverlay } from './SystemOverlay'

export interface InsetParams {
  /** camera position in system frame */
  from: Vector3
  /** look-at in system frame */
  at: Vector3
  fov: number
  up: Vector3
  /** screen placement: centre (0..1, y up) and radius as fraction of viewport height */
  x: number
  y: number
  r: number
  /** hide Earth/atmosphere in the inset (observer on the surface) */
  hideEarth?: boolean
}

export interface SceneParams {
  cam: CamTarget
  fov: number
  shift: [number, number]
  /** simulation time (epoch ms) */
  date: number
  dateTau: number
  exposure: number
  bloom: number
  grain: number
  vignette: number
  starGain: number
  sunInt: number
  earthshine: number
  grade: [number, number, number]
  reliefGain: number
  grid: number
  topo: number
  mask: number
  maskSel: number[] | null
  maskHover: number[] | null
  rings: RingSpec[]
  shadows: boolean
  shadowReach: number
  earthVisible: boolean
  /** 0 = true scale, 1 = educational (compressed) */
  eduMix: number
  eduDist: number
  sunVisible: boolean
  corona: number
  glare: number
  fade: number
  iris: { x: number; y: number; r: number }
  inset: InsetParams | null
  cloud: number
  /** speed multiplier for camera easing (1 = normal) */
  camSpeed: number
  tune: { tau: number; vmax: number; accel: number }
  /** overlay system toggles (orbits, shadow cones, guides) */
  sys: SystemFlags
  pulse: { dir: Vector3 | null; strength: number }
  impact: { active: boolean; dir: Vector3; radius: number; t: number; depth: number }
  idleSpin: number
}

export interface SystemFlags {
  orbit: number
  orbitOpacity: number
  nodes: number
  earthMoonLine: number
  sunRay: number
  umbra: number
  moonShadow: number
  spinMarker: number
  noRotationGhost: number
  terminator: number
  distanceRuler: number
  lightPulse: number
  moonLabelFlag: number
}

export function defaultParams(): SceneParams {
  return {
    cam: { kind: 'surface', lon: 0, lat: 0, dist: 3.4 },
    fov: 30,
    shift: [0, 0],
    date: Date.now(),
    dateTau: 0.7,
    exposure: 1,
    bloom: 0.55,
    grain: 0.035,
    vignette: 0.55,
    starGain: 0,
    sunInt: 2.6,
    earthshine: 1,
    grade: [1, 1, 1],
    reliefGain: 1,
    grid: 0,
    topo: 0,
    mask: 0,
    maskSel: null,
    maskHover: null,
    rings: [],
    shadows: true,
    shadowReach: 0.06,
    earthVisible: false,
    eduMix: 0,
    eduDist: 26,
    sunVisible: false,
    corona: 0,
    glare: 0.6,
    fade: 0,
    iris: { x: 0.5, y: 0.5, r: 0 },
    inset: null,
    cloud: 0.9,
    camSpeed: 1,
    tune: { tau: 0.7, vmax: 1.5, accel: 3.2 },
    sys: {
      orbit: 0, orbitOpacity: 1, nodes: 0, earthMoonLine: 0, sunRay: 0, umbra: 0, moonShadow: 0,
      spinMarker: 0, noRotationGhost: 0, terminator: 0, distanceRuler: 0, lightPulse: 0, moonLabelFlag: 0,
    },
    pulse: { dir: null, strength: 0 },
    impact: { active: false, dir: new Vector3(1, 0, 0), radius: 0.05, t: 0, depth: 0.08 },
    idleSpin: 0,
  }
}

export interface Hud {
  altKm: number
  lon: number
  lat: number
  sunElev: number
  fps: number
  scale: number
}

export type Driver = (p: SceneParams, dt: number, obs: Observatory) => void

const SMOOTH_KEYS = ['grid', 'topo', 'mask', 'exposure', 'bloom', 'starGain', 'sunInt', 'eduMix', 'corona', 'glare', 'fade', 'reliefGain', 'cloud', 'earthshine', 'vignette'] as const

export class Observatory {
  readonly canvas: HTMLCanvasElement
  readonly renderer: WebGLRenderer
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(30, 1, 0.01, 4000)
  readonly insetCamera = new PerspectiveCamera(2, 1, 1, 4000)
  readonly moon: MoonBody
  readonly earth: EarthBody
  readonly sky = new Sky()
  readonly overlay: SystemOverlay
  readonly post: Post
  readonly rig = new Rig()
  readonly quality: Quality
  readonly device: DeviceInfo

  /** parameters for the current frame (driver writes these) */
  p: SceneParams = defaultParams()
  /** smoothed values actually used */
  s: SceneParams = defaultParams()
  driver: Driver | null = null
  sim: SkyState
  simDateMs = Date.now()
  moonPosWorld = new Vector3(221, 0, 0)
  moonQuat = new Quaternion()
  hud: Hud = { altKm: 0, lon: 0, lat: 0, sunElev: 0, fps: 60, scale: 1 }
  frameListeners = new Set<(dt: number, o: Observatory) => void>()
  width = 1
  height = 1
  renderScale = 1
  paused = false
  userActive = false
  private target: ResolvedTarget = { pivot: new Vector3(), dir: new Vector3(0, 0, 1), dist: 3, up: new Vector3(0, 1, 0), anchored: true }
  private prevMoonPos = new Vector3()
  private prevMoonQuat = new Quaternion()
  private moonDelta = { prevPos: new Vector3(), pos: new Vector3(), dq: new Quaternion() }
  private last = 0
  private raf = 0
  private clock = 0
  private slowFrames = 0
  private fastFrames = 0
  private emaMs = 16
  private readonly tmp = new Vector3()
  private readonly tmpQ = new Quaternion()
  private readonly tmpQ2 = new Quaternion()
  private needsResize = true
  private renderScaleSteps = [1, 0.85, 0.7, 0.55]
  private renderScaleIdx = 0
  private idleLon = 0
  private frameCount = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.device = probeDevice()
    this.quality = pickQuality(this.device)
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: false })
    this.renderer.autoClear = true
    this.renderer.setClearColor(new Color(0x000000), 1)
    this.renderer.outputColorSpace = 'srgb-linear'
    const gl = this.renderer.getContext()
    const hdrOk = this.renderer.extensions.has('EXT_color_buffer_float') || this.renderer.extensions.has('EXT_color_buffer_half_float')
    void HalfFloatType
    void gl
    this.post = new Post(this.renderer, hdrOk ? this.quality.msaa : 0, this.quality.inset)
    this.moon = new MoonBody(this.renderer, this.quality)
    this.earth = new EarthBody(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()))
    this.overlay = new SystemOverlay()
    this.scene.add(this.sky.group, this.earth.group, this.moon.group, this.overlay.group)
    this.sim = skyAt(new Date(this.simDateMs))
    this.post.bloomEnabled = this.quality.bloom
    this.camera.matrixAutoUpdate = true
    window.addEventListener('resize', this.onResize)
    document.addEventListener('visibilitychange', this.onVis)
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      cancelAnimationFrame(this.raf)
    })
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.start()
    })
  }

  async init(onProgress: (p: { stage: string; value: number; ready: boolean }) => void) {
    this.resize()
    const starTask = this.sky.load(this.quality.starCount)
    const earthTask = this.earth.load(this.quality.tier !== 'low')
    await Promise.all([this.moon.load(onProgress), starTask, earthTask])
  }

  start() {
    cancelAnimationFrame(this.raf)
    this.last = performance.now()
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop)
      if (this.paused) {
        this.last = t
        return
      }
      this.frame(t)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
  }

  /** render exactly one frame with a fixed dt (used by automated screenshots) */
  stepOnce(dt = 1 / 30, n = 1) {
    for (let i = 0; i < n; i++) this.frame(this.last + dt * 1000, dt)
  }

  private onVis = () => {
    this.paused = document.hidden
  }

  private onResize = () => {
    this.needsResize = true
  }

  resize() {
    const w = Math.max(2, this.canvas.clientWidth || window.innerWidth)
    const h = Math.max(2, this.canvas.clientHeight || window.innerHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.maxDpr) * this.renderScale
    this.width = w
    this.height = h
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.post.resize(Math.floor(w * dpr), Math.floor(h * dpr))
    this.camera.aspect = w / h
    this.needsResize = false
  }

  /** moon world position given scale mode */
  private placeMoon(sim: SkyState, eduMix: number, eduDist: number, out: Vector3) {
    const trueDist = sim.moonPos.length()
    const edu = eduDist * (trueDist / 221.3)
    const d = trueDist + (edu - trueDist) * eduMix
    return out.copy(sim.moonPos).multiplyScalar(d / trueDist)
  }

  private frame(now: number, fixedDt?: number) {
    const dt = fixedDt ?? Math.min(0.1, Math.max(0.0005, (now - this.last) / 1000))
    this.last = now
    this.clock += dt
    this.frameCount++
    if (this.needsResize) this.resize()

    // --- drive parameters
    const p = this.p
    const fresh = defaultParams()
    // preserve persistent objects to avoid garbage
    p.cam = fresh.cam
    p.fov = fresh.fov
    p.shift = fresh.shift
    p.date = this.simDateMs
    p.dateTau = fresh.dateTau
    p.exposure = fresh.exposure
    p.bloom = fresh.bloom
    p.grain = fresh.grain
    p.vignette = fresh.vignette
    p.starGain = fresh.starGain
    p.sunInt = fresh.sunInt
    p.earthshine = fresh.earthshine
    p.grade = fresh.grade
    p.reliefGain = fresh.reliefGain
    p.grid = 0
    p.topo = 0
    p.mask = 0
    p.maskSel = null
    p.maskHover = null
    p.rings = []
    p.shadows = true
    p.shadowReach = 0.06
    p.earthVisible = false
    p.eduMix = 0
    p.eduDist = 26
    p.sunVisible = false
    p.corona = 0
    p.glare = 0.6
    p.fade = 0
    p.iris = fresh.iris
    p.inset = null
    p.cloud = 0.9
    p.camSpeed = 1
    p.tune = fresh.tune
    p.sys = fresh.sys
    p.pulse = fresh.pulse
    p.impact = fresh.impact
    p.idleSpin = 0
    this.driver?.(p, dt, this)
    if (this.frameCount === 1) this.simDateMs = p.date

    // --- smooth scalar params
    const s = this.s
    const k = 1 - Math.exp(-dt / 0.45)
    for (const key of SMOOTH_KEYS) (s[key] as number) += ((p[key] as number) - (s[key] as number)) * k
    s.grade = p.grade
    s.shadows = p.shadows
    s.shadowReach = p.shadowReach
    s.sunVisible = p.sunVisible
    s.earthVisible = p.earthVisible
    s.sys = p.sys
    s.rings = p.rings
    s.pulse = p.pulse
    s.impact = p.impact
    s.eduDist = p.eduDist
    s.iris = p.iris
    s.inset = p.inset
    s.grain = p.grain
    s.maskSel = p.maskSel
    s.maskHover = p.maskHover

    // --- simulation time easing
    const target = p.date
    const diffDays = (target - this.simDateMs) / 86400000
    if (Math.abs(diffDays) > 60) this.simDateMs = target
    else {
      const maxStep = 7 * dt * 86400000
      let step = (target - this.simDateMs) * (1 - Math.exp(-dt / Math.max(0.05, p.dateTau)))
      step = Math.max(-maxStep, Math.min(maxStep, step))
      this.simDateMs += step
    }
    const sim = (this.sim = skyAt(new Date(this.simDateMs)))

    // --- bodies
    this.prevMoonPos.copy(this.moonPosWorld)
    this.prevMoonQuat.copy(this.moonQuat)
    this.placeMoon(sim, s.eduMix, p.eduDist, this.moonPosWorld)
    this.moonQuat.copy(sim.moonQuat)
    if (this.frameCount === 1) {
      this.prevMoonPos.copy(this.moonPosWorld)
      this.prevMoonQuat.copy(this.moonQuat)
    }
    this.moonDelta.prevPos.copy(this.prevMoonPos)
    this.moonDelta.pos.copy(this.moonPosWorld)
    this.moonDelta.dq.copy(this.moonQuat).multiply(this.prevMoonQuat.invert())
    this.moon.setPose(this.moonPosWorld, this.moonQuat)

    // --- camera rig
    this.rig.speed = p.camSpeed
    if (p.idleSpin && !this.userActive && p.cam.kind === 'surface') this.idleLon += p.idleSpin * dt
    else this.idleLon *= Math.exp(-dt * 0.8)
    const cam = p.cam.kind === 'surface' ? ({ ...p.cam, lon: p.cam.lon + this.idleLon } as CamTarget) : p.cam
    resolveTarget(cam, this.moonPosWorld, this.moonQuat, this.rig.user, this.target)
    const minD = this.minCamDistance(this.target)
    this.rig.step(this.target, dt, p.tune, p.fov, p.shift, minD, this.moonDelta)
    this.rig.apply(this.camera)
    this.safeguardCamera()
    this.camera.aspect = this.width / this.height
    this.camera.fov = this.rig.fov
    this.updateClipPlanes()
    this.camera.setViewOffset(this.width, this.height, -this.rig.shiftX * this.width * 0.5, this.rig.shiftY * this.height * 0.5, this.width, this.height)
    this.camera.updateMatrixWorld(true)
    this.camera.updateProjectionMatrix()

    // --- overlays & uniforms
    this.updateMoonUniforms(this.camera)
    this.updateEarthAndSky(this.camera, false)
    this.overlay.update(this, dt)

    // --- render
    const px = this.renderer.getPixelRatio()
    this.post.params.exposure = s.exposure
    this.post.params.bloom = s.bloom
    this.post.params.grain = this.quality.grain ? s.grain : 0
    this.post.params.vignette = s.vignette
    this.post.params.fade = s.fade
    this.post.params.iris = p.iris
    void px
    this.renderer.setRenderTarget(this.post.sceneRT)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    let insetTex = null
    const insetP = this.p.inset as InsetParams | null
    if (insetP) {
      const ip = insetP
      const ic = this.insetCamera
      ic.fov = ip.fov
      ic.aspect = 1
      ic.position.copy(ip.from)
      ic.up.copy(ip.up)
      ic.lookAt(ip.at)
      ic.near = Math.max(0.01, ip.from.distanceTo(this.moonPosWorld) * 0.2)
      ic.far = 4000
      ic.updateProjectionMatrix()
      ic.updateMatrixWorld(true)
      this.updateMoonUniforms(ic)
      this.updateEarthAndSky(ic, !!ip.hideEarth)
      this.overlay.group.visible = false
      this.renderer.setRenderTarget(this.post.insetRT)
      this.renderer.clear()
      this.renderer.render(this.scene, ic)
      this.overlay.group.visible = true
      insetTex = this.post.insetRT.texture
      this.post.params.inset = { x: ip.x, y: ip.y, r: ip.r, on: true, ring: 1 }
      // restore main-camera uniforms for any later readers
      this.updateMoonUniforms(this.camera)
      this.updateEarthAndSky(this.camera, false)
    } else this.post.params.inset.on = false
    this.post.finish(this.clock, insetTex)

    for (const f of this.frameListeners) f(dt, this)
    this.updateHud(dt)
    this.adaptResolution(dt)
  }

  private minCamDistance(t: ResolvedTarget): number {
    // keep the camera above both bodies when orbiting a pivot
    const moonC = this.moonPosWorld
    const pivotToMoon = this.tmp.copy(moonC).sub(t.pivot)
    if (pivotToMoon.lengthSq() < 1e-6) return 1.04
    return 0.01
  }

  private safeguardCamera() {
    const c = this.camera.position
    const toM = this.tmp.copy(c).sub(this.moonPosWorld)
    const d = toM.length()
    if (d < 1.012) {
      toM.multiplyScalar(1.012 / Math.max(d, 1e-5))
      c.copy(this.moonPosWorld).add(toM)
      this.camera.lookAt(this.rig.pivot)
    }
    if (this.earth.group.visible) {
      const de = c.length()
      if (de < EARTH_R * 1.01) {
        c.multiplyScalar((EARTH_R * 1.01) / Math.max(de, 1e-5))
        this.camera.lookAt(this.rig.pivot)
      }
    }
  }

  private updateClipPlanes() {
    const c = this.camera.position
    const dMoon = c.distanceTo(this.moonPosWorld)
    const surfMoon = Math.max(0.002, dMoon - 1.01)
    let near = surfMoon * 0.35
    let far = dMoon + 4
    if (this.earth.group.visible || this.s.earthVisible) {
      const dE = c.length()
      near = Math.min(near, Math.max(0.01, (dE - EARTH_R * 1.06) * 0.3))
      far = Math.max(far, dE + EARTH_R + 10)
    }
    far = Math.max(far, 1500)
    near = Math.max(0.0015, Math.min(near, 40))
    this.camera.near = near
    this.camera.far = far
  }

  private updateMoonUniforms(cam: PerspectiveCamera) {
    const u = this.moon.uniforms
    const sim = this.sim
    const inv = this.tmpQ.copy(this.moonQuat).invert()
    const sunB = this.tmp.copy(sim.sunDir).applyQuaternion(inv)
    u.uSunBody.value.copy(sunB)
    u.uCamBody.value.copy(cam.position).sub(this.moonPosWorld).applyQuaternion(inv)
    u.uEarthBody.value.set(0, 0, 0).sub(this.moonPosWorld).applyQuaternion(inv)
    u.uEarthR.value = EARTH_R
    u.uSunAng.value = (sim.sunAngDeg / 2) * (Math.PI / 180)
    u.uSunInt.value = this.s.sunInt
    const moonDir = this.moonPosWorld.clone().normalize()
    u.uEarthshine.value = Math.max(0, 0.5 * (1 + sim.sunDir.dot(moonDir))) * this.s.earthshine
    u.uGrade.value.set(this.s.grade[0], this.s.grade[1], this.s.grade[2])
    u.uReliefGain.value = this.s.reliefGain
    const sh = this.s
    u.uShadowSteps.value = sh.shadows ? this.quality.shadowSteps : 0
    u.uShadowReach.value = sh.shadowReach
    u.uTime.value = this.clock
    const o = u.uOverlay.value
    o.set(sh.grid, sh.topo, sh.mask, 0)
    // rings
    this.moon.setRings(sh.rings)
    // pulse
    const pl = u.uPulse.value
    if (sh.pulse.dir && sh.pulse.strength > 0.001) pl.set(sh.pulse.dir.x, sh.pulse.dir.y, sh.pulse.dir.z, sh.pulse.strength)
    else pl.set(1, 0, 0, 0)
    const im = sh.impact
    u.uImpact.value.set(im.dir.x, im.dir.y, im.dir.z, im.radius)
    u.uImpactState.value.set(im.t, im.active ? 1 : 0, im.depth, 0)
    this.moon.setMaskIds('sel', sh.maskSel)
    this.moon.setMaskIds('hover', sh.maskHover)
  }

  private updateEarthAndSky(cam: PerspectiveCamera, hideEarth: boolean) {
    const sim = this.sim
    const s = this.s
    const px = this.renderer.getPixelRatio()
    const sunAng = (sim.sunAngDeg / 2) * (Math.PI / 180)
    this.earth.update({
      quat: sim.earthQuat,
      sunDir: sim.sunDir,
      moonPos: this.moonPosWorld,
      cam,
      time: this.clock,
      sunAng,
      sunInt: s.sunInt,
      visible: (s.earthVisible || this.earthFade() > 0.01) && !hideEarth,
    })
    this.earth.mesh.material.uniforms.uCloud.value = s.cloud
    this.sky.update(cam, sim.sunDir, {
      starGain: s.starGain,
      px: px * 1.0,
      time: this.clock,
      sunAngRad: sunAng,
      corona: s.corona,
      glare: s.glare,
      sunVisible: s.sunVisible,
    })
  }

  private earthFade() {
    return this.s.earthVisible ? 1 : 0
  }

  private updateHud(dt: number) {
    const c = this.camera.position
    const inv = this.tmpQ2.copy(this.moonQuat).invert()
    const rel = this.tmp.copy(c).sub(this.moonPosWorld)
    const alt = (rel.length() - 1) * MOON_RADIUS_KM
    const body = rel.clone().applyQuaternion(inv)
    const ll = vecToLonLat(body)
    const sunB = this.tmp.copy(this.sim.sunDir).applyQuaternion(inv)
    const up = lonLatToVec(ll.lon, ll.lat, new Vector3())
    const elev = Math.asin(Math.max(-1, Math.min(1, up.dot(sunB)))) * (180 / Math.PI)
    this.hud.altKm = alt
    this.hud.lon = ll.lon
    this.hud.lat = ll.lat
    this.hud.sunElev = elev
    this.hud.fps += (1 / Math.max(dt, 1e-4) - this.hud.fps) * 0.05
    this.hud.scale = this.renderScale
  }

  private adaptResolution(dt: number) {
    if (!this.quality.dynamicRes || this.frameCount < 90) return
    this.emaMs += (dt * 1000 - this.emaMs) * 0.08
    if (this.emaMs > 26) {
      this.slowFrames++
      this.fastFrames = 0
    } else if (this.emaMs < 14) {
      this.fastFrames++
      this.slowFrames = 0
    } else {
      this.slowFrames = 0
      this.fastFrames = 0
    }
    if (this.slowFrames > 45 && this.renderScaleIdx < this.renderScaleSteps.length - 1) {
      this.renderScaleIdx++
      this.renderScale = this.renderScaleSteps[this.renderScaleIdx]
      this.needsResize = true
      this.slowFrames = 0
    } else if (this.fastFrames > 360 && this.renderScaleIdx > 0) {
      this.renderScaleIdx--
      this.renderScale = this.renderScaleSteps[this.renderScaleIdx]
      this.needsResize = true
      this.fastFrames = 0
    }
  }

  /* ------------------------------------------------------------------ picking & projection */

  /** CSS-pixel position → selenographic lon/lat if the ray hits the Moon */
  pickMoon(clientX: number, clientY: number): { lon: number; lat: number; point: Vector3 } | null {
    const rect = this.canvas.getBoundingClientRect()
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1
    const dir = new Vector3(nx, ny, 0.5).unproject(this.camera).sub(this.camera.position).normalize()
    const o = this.camera.position
    const m = this.moonPosWorld
    const oc = new Vector3().copy(o).sub(m)
    const b = oc.dot(dir)
    const c = oc.dot(oc) - 1.0
    const disc = b * b - c
    if (disc < 0) return null
    const t = -b - Math.sqrt(disc)
    if (t < 0) return null
    const hit = new Vector3().copy(o).addScaledVector(dir, t)
    const body = hit.clone().sub(m).applyQuaternion(this.tmpQ2.copy(this.moonQuat).invert())
    const ll = vecToLonLat(body)
    return { ...ll, point: hit }
  }

  /** screen position (CSS px) of a selenographic point + whether its surface faces the camera */
  projectSurface(lon: number, lat: number, out: { x: number; y: number; visible: boolean; facing: number }, lift = 0.0015): boolean {
    const p = lonLatToVec(lon, lat, this.tmp.set(0, 0, 0))
    const world = p.clone().multiplyScalar(1 + lift).applyQuaternion(this.moonQuat).add(this.moonPosWorld)
    const normal = p.clone().applyQuaternion(this.moonQuat)
    const toCam = this.tmp.copy(this.camera.position).sub(world).normalize()
    const facing = normal.dot(toCam)
    const ndc = world.clone().project(this.camera)
    out.x = (ndc.x * 0.5 + 0.5) * this.width
    out.y = (-ndc.y * 0.5 + 0.5) * this.height
    out.facing = facing
    out.visible = facing > 0.03 && ndc.z < 1 && ndc.z > -1
    return out.visible
  }

  /** world → CSS px */
  projectWorld(v: Vector3, out: { x: number; y: number; z: number }) {
    const n = v.clone().project(this.camera)
    out.x = (n.x * 0.5 + 0.5) * this.width
    out.y = (-n.y * 0.5 + 0.5) * this.height
    out.z = n.z
  }

  /** pixels per Moon-radius at the Moon's centre (for sizing screen elements) */
  moonPixelRadius(): number {
    const d = this.camera.position.distanceTo(this.moonPosWorld)
    const h = this.height
    return (1 / Math.max(d, 1.0001)) / Math.tan((this.camera.fov * Math.PI) / 360) * (h / 2)
  }

  dispose() {
    this.stop()
    window.removeEventListener('resize', this.onResize)
    document.removeEventListener('visibilitychange', this.onVis)
    this.post.dispose()
    this.renderer.dispose()
  }

  /** helper for external readers */
  get viewport() {
    return new Vector2(this.width, this.height)
  }
}
