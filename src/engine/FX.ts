import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'

const rockVert = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
uniform float uSeed;
float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)) + uSeed) * 43758.5453); }
void main(){
  vec3 d = normalize(position);
  float n = h(floor(d*3.0)) * 0.5 + h(floor(d*7.0)) * 0.3;
  vec3 pos = d * (0.78 + n * 0.55);
  vN = normalize(pos);
  vP = pos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`
const rockFrag = /* glsl */ `
precision highp float;
varying vec3 vN;
varying vec3 vP;
uniform vec3 uSun;
uniform float uHeat;
void main(){
  float l = max(dot(normalize(vN), normalize(uSun)), 0.0);
  vec3 col = vec3(0.12, 0.10, 0.09) * (0.35 + 1.6 * l);
  col += vec3(1.0, 0.45, 0.12) * uHeat * (0.5 + 0.5 * dot(normalize(vN), vec3(0.0, 1.0, 0.0)));
  gl_FragColor = vec4(col, 1.0);
}
`
const trailVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const trailFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uAlpha;
void main(){
  float along = vUv.y; // 0 tip(far end), 1 base(at rock)
  float a = pow(along, 2.2) * uAlpha;
  gl_FragColor = vec4(vec3(1.0, 0.55, 0.22) * a * 5.0, a);
}
`
const sparkVert = /* glsl */ `
attribute float aSize;
attribute float aLife;
varying float vLife;
uniform float uPx;
void main(){
  vLife = aLife;
  gl_PointSize = aSize * uPx;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const sparkFrag = /* glsl */ `
precision highp float;
varying float vLife;
void main(){
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  float a = exp(-d*d*4.0) * vLife;
  gl_FragColor = vec4(vec3(1.0, 0.82, 0.58) * a * 1.4, a);
}
`

const N = 1400

/** Asteroid, trail and ejecta for the educational impact replay. Lives in the Moon's body frame. */
export class ImpactFX {
  readonly group = new Group()
  private rock: Mesh
  private rockMat: ShaderMaterial
  private trail: Mesh
  private trailMat: ShaderMaterial
  private sparks: Points
  private sparkMat: ShaderMaterial
  private pos = new Float32Array(N * 3)
  private life = new Float32Array(N)
  private size = new Float32Array(N)
  private vel: Vector3[] = []
  private seeds: { az: number; el: number; sp: number }[] = []
  private launched = false
  private lastDir = new Vector3()

  constructor() {
    this.rockMat = new ShaderMaterial({ vertexShader: rockVert, fragmentShader: rockFrag, uniforms: { uSun: { value: new Vector3(1, 0, 0) }, uHeat: { value: 0 }, uSeed: { value: 3.7 } } })
    this.rock = new Mesh(new IcosahedronGeometry(1, 3), this.rockMat)
    this.rock.frustumCulled = false
    this.trailMat = new ShaderMaterial({
      vertexShader: trailVert,
      fragmentShader: trailFrag,
      uniforms: { uAlpha: { value: 1 } },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    })
    const cone = new ConeGeometry(1, 1, 18, 1, true)
    cone.translate(0, -0.5, 0) // tip at origin, base at -y... we flip below
    this.trail = new Mesh(cone, this.trailMat)
    this.trail.frustumCulled = false
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(this.pos, 3))
    g.setAttribute('aSize', new BufferAttribute(this.size, 1))
    g.setAttribute('aLife', new BufferAttribute(this.life, 1))
    this.sparkMat = new ShaderMaterial({
      vertexShader: sparkVert,
      fragmentShader: sparkFrag,
      uniforms: { uPx: { value: 1 } },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    this.sparks = new Points(g, this.sparkMat)
    this.sparks.frustumCulled = false
    for (let i = 0; i < N; i++) {
      this.vel.push(new Vector3())
      this.seeds.push({ az: Math.random() * Math.PI * 2, el: 0.5 + Math.random() * 0.8, sp: 0.35 + Math.pow(Math.random(), 1.6) * 0.9 })
    }
    this.group.add(this.rock, this.trail, this.sparks)
    this.group.visible = false
  }

  update(im: { active: boolean; dir: Vector3; radius: number; t: number; approach: number }, sunBody: Vector3, px: number) {
    const showRock = im.approach >= 0 && im.approach < 1
    const showSparks = im.active && im.t > 0 && im.t < 0.9
    this.group.visible = showRock || showSparks
    this.sparkMat.uniforms.uPx.value = px
    this.rockMat.uniforms.uSun.value.copy(sunBody)
    const P = im.dir
    const rho = im.radius
    // local frame at the impact point
    const U = P
    const T = new Vector3(0, 1, 0).cross(U)
    if (T.lengthSq() < 1e-6) T.set(1, 0, 0)
    T.normalize()
    const B = new Vector3().crossVectors(U, T)
    // approach direction: from low over the horizon in the direction of the Sun-opposed side so it is lit
    const away = T.clone().multiplyScalar(0.8).addScaledVector(B, -0.35).normalize()
    if (showRock) {
      const a = im.approach
      const dist = Math.max(0.5, rho * 16)
      const start = P.clone().addScaledVector(away, dist * 1.0).addScaledVector(U, dist * 0.7)
      const e = a * a * (3 - 2 * a) * 0.35 + a * 0.65
      const cur = start.clone().lerp(P, e)
      const r = Math.max(0.006, rho * 0.16) * (1.0 - 0.15 * a)
      this.rock.position.copy(cur)
      this.rock.scale.setScalar(r)
      this.rock.visible = true
      this.rockMat.uniforms.uHeat.value = 0.2 + 0.9 * a
      const vel = P.clone().sub(start).normalize()
      // trail: cone base at rock, tip trailing behind (opposite velocity)
      const len = Math.min(dist * 0.9, 0.25 + a * dist * 0.7)
      this.trail.visible = true
      this.trail.position.copy(cur)
      this.trail.scale.set(r * 1.3, len, r * 1.3)
      this.trail.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), vel.clone().multiplyScalar(-1).normalize().multiplyScalar(-1))
      // cone is built with tip at origin extending to -y: we want the tip pointing back along -vel
      this.trail.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), vel.clone().negate())
      this.trailMat.uniforms.uAlpha.value = 0.9
      this.launched = false
    } else {
      this.rock.visible = false
      this.trail.visible = false
    }
    if (im.active && !this.launched && im.t > 0) {
      this.launched = true
      this.lastDir.copy(P)
      for (let i = 0; i < N; i++) {
        const s = this.seeds[i]
        const dirH = T.clone().multiplyScalar(Math.cos(s.az)).addScaledVector(B, Math.sin(s.az))
        const v = dirH.multiplyScalar(Math.cos(s.el)).addScaledVector(U, Math.sin(s.el)).multiplyScalar(s.sp * rho * 7.5)
        this.vel[i].copy(v)
        this.size[i] = 2.4 + Math.random() * 3.2
      }
    }
    if (!im.active) this.launched = false
    if (showSparks) {
      const tt = im.t // 0..1
      const tau = tt * 2.4
      for (let i = 0; i < N; i++) {
        const v = this.vel[i]
        const g = 0.55 * rho * 6
        const x = P.x + v.x * tau - U.x * g * tau * tau * 0.5
        const y = P.y + v.y * tau - U.y * g * tau * tau * 0.5
        const z = P.z + v.z * tau - U.z * g * tau * tau * 0.5
        // stop at the surface
        const px3 = new Vector3(x, y, z)
        const len = px3.length()
        if (len < 1.001) {
          px3.multiplyScalar(1.001 / Math.max(len, 1e-4))
          this.life[i] = Math.max(0, this.life[i] - 0.02)
        } else this.life[i] = Math.max(0, 1 - tt * 1.15) * (0.4 + 0.6 * Math.min(1, tt * 8))
        this.pos[i * 3] = px3.x
        this.pos[i * 3 + 1] = px3.y
        this.pos[i * 3 + 2] = px3.z
      }
      ;(this.sparks.geometry.attributes.position as BufferAttribute).needsUpdate = true
      ;(this.sparks.geometry.attributes.aLife as BufferAttribute).needsUpdate = true
      ;(this.sparks.geometry.attributes.aSize as BufferAttribute).needsUpdate = true
      this.sparks.visible = true
    } else this.sparks.visible = false
  }
}
