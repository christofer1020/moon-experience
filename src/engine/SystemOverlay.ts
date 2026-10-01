import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  GLSL3,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import type { Observatory } from './Observatory'
import { orbitPath, SUN_RADIUS_KM, EARTH_RADIUS_KM, MOON_RADIUS_KM, AU_KM } from '../astro/ephemeris'
import { EARTH_R } from './Earth'

const R_SUN = SUN_RADIUS_KM / MOON_RADIUS_KM
const D_SUN = AU_KM / MOON_RADIUS_KM
const MEAN_MOON_DIST = 384400 / MOON_RADIUS_KM

const coneVert = /* glsl */ `
out vec3 vN;
out vec3 vV;
out float vT;
uniform float uR0;
uniform float uR1;
uniform float uLen;
void main() {
  float t = position.y + 0.5;
  float r = mix(uR0, uR1, t);
  vec3 radial = normalize(vec3(position.x, 0.0, position.z) + vec3(1e-6, 0.0, 0.0));
  vec3 p = vec3(radial.x * r, t * uLen, radial.z * r);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * radial);
  vV = normalize(cameraPosition - wp.xyz);
  vT = t;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`
const coneFrag = /* glsl */ `
precision highp float;
in vec3 vN;
in vec3 vV;
in float vT;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uFade;
out vec4 fragColor;
void main() {
  float edge = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.3);
  float a = uAlpha * (0.22 + 0.78 * edge) * mix(1.0, 1.0 - 0.85 * vT, uFade);
  fragColor = vec4(uColor * a, a);
}
`

interface ConeUniforms {
  uR0: { value: number }
  uR1: { value: number }
  uLen: { value: number }
  uAlpha: { value: number }
  uFade: { value: number }
  uColor: { value: Vector3 }
}

function makeCone(color: number, additive: boolean) {
  const uniforms: ConeUniforms = {
    uColor: { value: new Vector3((color >> 16) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255) },
    uAlpha: { value: 0 },
    uFade: { value: 0 },
    uR0: { value: 1 },
    uR1: { value: 1 },
    uLen: { value: 1 },
  }
  const mat = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: coneVert,
    fragmentShader: coneFrag,
    uniforms: uniforms as unknown as { [k: string]: { value: unknown } },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: additive ? AdditiveBlending : undefined,
  })
  const m = new Mesh(new CylinderGeometry(1, 1, 1, 72, 1, true), mat)
  m.frustumCulled = false
  m.renderOrder = 5
  ;(m as unknown as { cu: ConeUniforms }).cu = uniforms
  return m
}

function cu(m: Mesh): ConeUniforms {
  return (m as unknown as { cu: ConeUniforms }).cu
}

/** Orbit paths, shadow cones, guides etc. for the system chapters. All geometry derives from the live ephemeris. */
export class SystemOverlay {
  readonly group = new Group()
  private orbit: Line
  private orbitGeo: BufferGeometry
  private orbitMat: LineBasicMaterial
  private path: Vector3[] = []
  private pathDate = 0
  private ecl: LineLoop
  private eclMat: LineBasicMaterial
  private eclDisc: Mesh
  private nodes: Mesh[] = []
  private line: Line
  private lineMat: LineBasicMaterial
  private ticks: LineSegments
  private ticksMat: LineBasicMaterial
  private rays: LineSegments
  private raysMat: LineBasicMaterial
  private earthUmbra: Mesh
  private earthPenumbra: Mesh
  private moonUmbra: Mesh
  private moonPenumbra: Mesh
  private spinArrow: Group
  private fixedArrow: Group
  private pulse: Mesh
  private pulseGlow: Mesh
  private tide: Mesh
  private termRing: LineLoop
  readonly nodePositions: Vector3[] = [new Vector3(), new Vector3()]
  /** radius of the orbit in world units for the current scale (used for framing / notes) */
  orbitRadius = MEAN_MOON_DIST
  private scratch = new Vector3()
  private q = new Quaternion()

  constructor() {
    this.group.renderOrder = 4
    this.orbitGeo = new BufferGeometry()
    this.orbitGeo.setAttribute('position', new BufferAttribute(new Float32Array(182 * 3), 3))
    this.orbitMat = new LineBasicMaterial({ color: 0x8fb6e0, transparent: true, opacity: 0, depthWrite: false })
    this.orbit = new Line(this.orbitGeo, this.orbitMat)
    this.orbit.frustumCulled = false

    const ringPts: number[] = []
    for (let i = 0; i < 192; i++) {
      const a = (i / 192) * Math.PI * 2
      ringPts.push(Math.cos(a), 0, Math.sin(a))
    }
    const eg = new BufferGeometry()
    eg.setAttribute('position', new Float32BufferAttribute(ringPts, 3))
    this.eclMat = new LineBasicMaterial({ color: 0xece7db, transparent: true, opacity: 0, depthWrite: false })
    this.ecl = new LineLoop(eg, this.eclMat)
    this.ecl.frustumCulled = false
    const disc = new CircleGeometry(1, 96)
    disc.rotateX(-Math.PI / 2)
    this.eclDisc = new Mesh(disc, new MeshBasicMaterial({ color: 0xece7db, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }))
    this.eclDisc.frustumCulled = false

    for (let i = 0; i < 2; i++) {
      const m = new Mesh(new SphereGeometry(1, 16, 12), new MeshBasicMaterial({ color: 0xe7c48e, transparent: true, opacity: 0, depthWrite: false }))
      m.frustumCulled = false
      this.nodes.push(m)
    }

    const lg = new BufferGeometry()
    lg.setAttribute('position', new BufferAttribute(new Float32Array(6), 3))
    this.lineMat = new LineBasicMaterial({ color: 0xece7db, transparent: true, opacity: 0, depthWrite: false })
    this.line = new Line(lg, this.lineMat)
    this.line.frustumCulled = false

    const tg = new BufferGeometry()
    tg.setAttribute('position', new BufferAttribute(new Float32Array(80 * 6), 3))
    this.ticksMat = new LineBasicMaterial({ color: 0xece7db, transparent: true, opacity: 0, depthWrite: false })
    this.ticks = new LineSegments(tg, this.ticksMat)
    this.ticks.frustumCulled = false

    const rg = new BufferGeometry()
    rg.setAttribute('position', new BufferAttribute(new Float32Array(9 * 6), 3))
    rg.setAttribute('color', new BufferAttribute(new Float32Array(9 * 6), 3))
    this.raysMat = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending })
    this.rays = new LineSegments(rg, this.raysMat)
    this.rays.frustumCulled = false

    this.earthUmbra = makeCone(0xb4673c, true)
    this.earthPenumbra = makeCone(0x4a6a96, true)
    this.moonUmbra = makeCone(0xb4673c, true)
    this.moonPenumbra = makeCone(0x4a6a96, true)
    for (const c of [this.earthUmbra, this.earthPenumbra, this.moonUmbra, this.moonPenumbra]) c.visible = false

    const mkArrow = (color: number) => {
      const g = new Group()
      const shaft = new Mesh(new CylinderGeometry(0.05, 0.05, 1, 8), new MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }))
      shaft.position.y = 0.5
      const head = new Mesh(new ConeGeometry(0.16, 0.38, 14), new MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }))
      head.position.y = 1.19
      g.add(shaft, head)
      g.visible = false
      g.traverse((o) => (o.frustumCulled = false))
      return g
    }
    this.spinArrow = mkArrow(0xe7c48e)
    this.fixedArrow = mkArrow(0x9aa4b0)

    this.pulse = new Mesh(new SphereGeometry(0.5, 16, 12), new MeshBasicMaterial({ color: 0xfff1d0 }))
    this.pulse.visible = false
    this.pulseGlow = new Mesh(new SphereGeometry(1.4, 16, 12), new MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false }))
    this.pulseGlow.visible = false

    const tideG = new SphereGeometry(1, 48, 24)
    this.tide = new Mesh(tideG, new MeshBasicMaterial({ color: 0x5f93d8, transparent: true, opacity: 0, depthWrite: false, wireframe: true }))
    this.tide.visible = false

    const tp: number[] = []
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2
      tp.push(Math.cos(a), Math.sin(a), 0)
    }
    const tgeo = new BufferGeometry()
    tgeo.setAttribute('position', new Float32BufferAttribute(tp, 3))
    this.termRing = new LineLoop(tgeo, new LineBasicMaterial({ color: 0xe7c48e, transparent: true, opacity: 0, depthWrite: false }))
    this.termRing.frustumCulled = false

    this.group.add(
      this.orbit, this.ecl, this.eclDisc, ...this.nodes, this.line, this.ticks, this.rays,
      this.earthUmbra, this.earthPenumbra, this.moonUmbra, this.moonPenumbra,
      this.spinArrow, this.fixedArrow, this.pulse, this.pulseGlow, this.tide, this.termRing,
    )
  }

  /** perigee / apogee of the current orbit sample, mapped to the current scale (world units) */
  perigeeApogee(mix: number, eduDist: number) {
    if (!this.path.length) return null
    let lo = this.path[0]
    let hi = this.path[0]
    for (const p of this.path) {
      if (p.length() < lo.length()) lo = p
      if (p.length() > hi.length()) hi = p
    }
    const map = (v: Vector3) => v.clone().multiplyScalar(this.mapDist(v.length(), mix, eduDist) / v.length())
    return { peri: { pos: map(lo), km: lo.length() * MOON_RADIUS_KM }, apo: { pos: map(hi), km: hi.length() * MOON_RADIUS_KM } }
  }

  private mapDist(d: number, mix: number, eduDist: number) {
    const edu = eduDist * (d / 221.3)
    return d + (edu - d) * mix
  }

  update(obs: Observatory, dt: number) {
    const f = obs.s.sys
    const sim = obs.sim
    const mix = obs.s.eduMix
    const eduDist = obs.p.eduDist
    const moonW = obs.moonPosWorld
    const vis = (v: number) => v > 0.002

    // ---------------------------------------------------------------- orbit path
    const wantOrbit = vis(f.orbit)
    this.orbit.visible = wantOrbit
    this.ecl.visible = vis(f.nodes)
    this.eclDisc.visible = vis(f.nodes)
    for (const n of this.nodes) n.visible = vis(f.nodes)
    if (wantOrbit || vis(f.nodes)) {
      const dateMs = obs.simDateMs
      if (!this.path.length || Math.abs(dateMs - this.pathDate) > 0.4 * 86400000) {
        this.path = orbitPath(new Date(dateMs), 180)
        this.pathDate = dateMs
      }
      const pos = this.orbitGeo.attributes.position as BufferAttribute
      let rSum = 0
      for (let i = 0; i < this.path.length; i++) {
        const p = this.path[i]
        const d = p.length()
        const k = this.mapDist(d, mix, eduDist) / d
        pos.setXYZ(i, p.x * k, p.y * k, p.z * k)
        rSum += d * k
      }
      pos.needsUpdate = true
      this.orbitGeo.setDrawRange(0, this.path.length)
      this.orbitRadius = rSum / this.path.length
      this.orbitMat.opacity = f.orbitOpacity * Math.min(1, f.orbit) * 0.55
      // ecliptic plane
      this.ecl.scale.setScalar(this.orbitRadius * 1.0)
      this.eclMat.opacity = Math.min(1, f.nodes) * 0.5
      this.eclDisc.scale.setScalar(this.orbitRadius * 1.0)
      ;(this.eclDisc.material as MeshBasicMaterial).opacity = Math.min(1, f.nodes) * 0.022
      // nodes: where the path crosses the ecliptic (y = 0)
      let found = 0
      for (let i = 0; i < this.path.length - 1 && found < 2; i++) {
        const a = this.path[i]
        const b = this.path[i + 1]
        if (a.y === 0 || a.y * b.y < 0) {
          const t = a.y / (a.y - b.y || 1)
          const x = a.x + (b.x - a.x) * t
          const z = a.z + (b.z - a.z) * t
          const d = Math.hypot(x, z)
          const k = this.mapDist(d, mix, eduDist) / d
          this.nodePositions[found].set(x * k, 0, z * k)
          found++
        }
      }
      for (let i = 0; i < 2; i++) {
        this.nodes[i].position.copy(this.nodePositions[i])
        this.nodes[i].scale.setScalar(Math.max(0.12, obs.rig.dist * 0.011))
        ;(this.nodes[i].material as MeshBasicMaterial).opacity = Math.min(1, f.nodes) * 0.9
      }
    }

    // ---------------------------------------------------------------- earth–moon line + ruler ticks
    this.line.visible = vis(f.earthMoonLine) || vis(f.distanceRuler)
    if (this.line.visible) {
      const a = this.line.geometry.attributes.position as BufferAttribute
      const dirE = this.scratch.copy(moonW).normalize()
      const start = dirE.clone().multiplyScalar(EARTH_R * 1.04)
      const end = dirE.clone().multiplyScalar(moonW.length() - 1.04)
      a.setXYZ(0, start.x, start.y, start.z)
      a.setXYZ(1, end.x, end.y, end.z)
      a.needsUpdate = true
      this.lineMat.opacity = Math.max(f.earthMoonLine, f.distanceRuler) * 0.55
    }
    this.ticks.visible = vis(f.distanceRuler) && mix < 0.05
    if (this.ticks.visible) {
      const a = this.ticks.geometry.attributes.position as BufferAttribute
      const dirE = this.scratch.copy(moonW).normalize()
      // perpendicular for tick marks (stay readable from above)
      const perp = new Vector3(0, 1, 0).cross(dirE).normalize()
      const up = new Vector3().crossVectors(dirE, perp)
      const step = EARTH_R * 2 * (moonW.length() / 221.3 >= 0 ? 1 : 1)
      let n = 0
      for (let d = EARTH_R + step; d < moonW.length() - 1.5 && n < 78; d += step) {
        const c = dirE.clone().multiplyScalar(d)
        const a0 = c.clone().addScaledVector(up, -1.4)
        const a1 = c.clone().addScaledVector(up, 1.4)
        a.setXYZ(n * 2, a0.x, a0.y, a0.z)
        a.setXYZ(n * 2 + 1, a1.x, a1.y, a1.z)
        n++
      }
      this.ticks.geometry.setDrawRange(0, n * 2)
      a.needsUpdate = true
      this.ticksMat.opacity = f.distanceRuler * 0.6
      void perp
    }

    // ---------------------------------------------------------------- sunlight rays
    this.rays.visible = vis(f.sunRay)
    if (this.rays.visible) {
      const sd = sim.sunDir
      const side = new Vector3(0, 1, 0).cross(sd).normalize()
      const up = new Vector3().crossVectors(sd, side).normalize()
      const R = this.orbitRadius * 1.35
      const len = this.orbitRadius * 0.55
      const pos = this.rays.geometry.attributes.position as BufferAttribute
      const col = this.rays.geometry.attributes.color as BufferAttribute
      let n = 0
      for (let i = -4; i <= 4; i++) {
        const off = side.clone().multiplyScalar((i / 4) * R * 0.78)
        const startP = sd.clone().multiplyScalar(R * 1.35).add(off)
        const endP = startP.clone().addScaledVector(sd, -len)
        pos.setXYZ(n * 2, startP.x, startP.y, startP.z)
        pos.setXYZ(n * 2 + 1, endP.x, endP.y, endP.z)
        col.setXYZ(n * 2, 0, 0, 0)
        col.setXYZ(n * 2 + 1, 1.0, 0.8, 0.45)
        n++
      }
      pos.needsUpdate = true
      col.needsUpdate = true
      this.raysMat.opacity = f.sunRay * 0.9
      void up
    }

    // ---------------------------------------------------------------- shadow cones (true geometry)
    const sd = sim.sunDir
    const anti = this.scratch.copy(sd).multiplyScalar(-1).clone()
    const yAxis = new Vector3(0, 1, 0)
    const orient = (m: Mesh, origin: Vector3, r0: number, r1: number, len: number, alpha: number, fade: number) => {
      m.position.copy(origin)
      this.q.setFromUnitVectors(yAxis, anti)
      m.quaternion.copy(this.q)
      const u = cu(m)
      u.uR0.value = r0
      u.uR1.value = r1
      u.uLen.value = len
      u.uAlpha.value = alpha
      u.uFade.value = fade
    }
    // Earth: umbra apex at L = R_e · D / (R_s − R_e); penumbra widens by (R_s + R_e)/D per unit length
    const eUmbraLen = (EARTH_R * D_SUN) / (R_SUN - EARTH_R)
    this.earthUmbra.visible = vis(f.umbra)
    this.earthPenumbra.visible = vis(f.umbra)
    if (this.earthUmbra.visible) {
      orient(this.earthUmbra, new Vector3(0, 0, 0), EARTH_R, 0, eUmbraLen, 0.5 * f.umbra, 0.3)
      const L = Math.max(moonW.length() * 1.3, 90)
      const spread = (R_SUN + EARTH_R) / D_SUN
      orient(this.earthPenumbra, new Vector3(0, 0, 0), EARTH_R, EARTH_R + L * spread, L, 0.34 * f.umbra, 0)
    }
    // Moon: umbra apex at L = R_m · D / (R_s − R_m) (≈ 215 Moon radii: just short of, or reaching, Earth)
    const mUmbraLen = (1 * D_SUN) / (R_SUN - 1)
    this.moonUmbra.visible = vis(f.moonShadow)
    this.moonPenumbra.visible = vis(f.moonShadow)
    if (this.moonUmbra.visible) {
      orient(this.moonUmbra, moonW, 1, 0, mUmbraLen, 0.6 * f.moonShadow, 0.15)
      const L = 300
      const spread = (R_SUN + 1) / D_SUN
      orient(this.moonPenumbra, moonW, 1, 1 + L * spread, L, 0.3 * f.moonShadow, 0)
    }

    // ---------------------------------------------------------------- spin arrows (tidal lock demonstration)
    const showSpin = vis(f.spinMarker)
    this.spinArrow.visible = showSpin
    this.fixedArrow.visible = showSpin && vis(f.noRotationGhost)
    if (showSpin) {
      const len = Math.max(2.4, this.orbitRadius * 0.12)
      // amber arrow: from the Moon's centre through its near-side sub-Earth meridian (body +X)
      const dirBody = new Vector3(1, 0, 0).applyQuaternion(obs.moonQuat)
      this.spinArrow.position.copy(moonW).addScaledVector(dirBody, 1.0)
      this.spinArrow.quaternion.setFromUnitVectors(yAxis, dirBody)
      this.spinArrow.scale.set(len * 0.45, len, len * 0.45)
      this.fixedArrow.position.copy(moonW).addScaledVector(new Vector3(1, 0, 0), 1.0)
      this.fixedArrow.quaternion.setFromUnitVectors(yAxis, new Vector3(1, 0, 0))
      this.fixedArrow.scale.set(len * 0.45, len, len * 0.45)
      ;(this.fixedArrow.children[0] as Mesh<CylinderGeometry, MeshBasicMaterial>).material.opacity = 0.9 * f.noRotationGhost
      ;(this.fixedArrow.children[1] as Mesh<ConeGeometry, MeshBasicMaterial>).material.opacity = 0.9 * f.noRotationGhost
    }

    // ---------------------------------------------------------------- light pulse
    const lp = f.lightPulse
    this.pulse.visible = lp > 0 && lp < 1
    this.pulseGlow.visible = this.pulse.visible
    if (this.pulse.visible) {
      const dirE = this.scratch.copy(moonW).normalize()
      const d = EARTH_R + (moonW.length() - 1 - EARTH_R) * lp
      this.pulse.position.copy(dirE).multiplyScalar(d)
      this.pulseGlow.position.copy(this.pulse.position)
      const s = Math.max(0.3, this.orbitRadius * 0.012)
      this.pulse.scale.setScalar(s)
      this.pulseGlow.scale.setScalar(s * 1.6)
    }

    // ---------------------------------------------------------------- tide ellipsoid (exaggerated)
    const tideOn = f.tide
    this.tide.visible = tideOn > 0.01
    if (this.tide.visible) {
      const dirE = this.scratch.copy(moonW).normalize()
      this.tide.position.set(0, 0, 0)
      this.tide.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), dirE)
      this.tide.scale.set(EARTH_R * 1.07, EARTH_R * 1.0, EARTH_R * 1.0)
      ;(this.tide.material as MeshBasicMaterial).opacity = 0.35 * tideOn
    }

    // ---------------------------------------------------------------- terminator guide
    this.termRing.visible = vis(f.terminator)
    if (this.termRing.visible) {
      // great circle perpendicular to the sun direction around the Moon
      this.termRing.position.copy(moonW)
      this.q.setFromUnitVectors(new Vector3(0, 0, 1), sim.sunDir)
      this.termRing.quaternion.copy(this.q)
      this.termRing.scale.setScalar(1.012)
      ;(this.termRing.material as LineBasicMaterial).opacity = f.terminator * 0.7
    }
    void dt
    void EARTH_RADIUS_KM
  }
}
