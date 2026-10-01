import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  GLSL3,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'
import { starsFrag, starsVert, sunFrag, sunVert } from './shaders/sky'
import { dataUrl } from './assets'
import { eqjToSystemMatrix } from '../astro/frames'

const SKY_RADIUS = 1000

export class Sky {
  readonly group = new Group()
  private stars: Points | null = null
  private starMat: ShaderMaterial
  readonly sun: Mesh<PlaneGeometry, ShaderMaterial>
  private starTotal = 0
  starNames: { name: string; mag: number; ra: number; dec: number }[] = []

  constructor() {
    this.starMat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: starsVert,
      fragmentShader: starsFrag,
      uniforms: { uPx: { value: 1 }, uGain: { value: 1 }, uTwinkle: { value: 0 }, uTime: { value: 0 } },
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    })
    const sunMat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: sunVert,
      fragmentShader: sunFrag,
      uniforms: {
        uK: { value: 18 },
        uCorona: { value: 0 },
        uTime: { value: 0 },
        uIntensity: { value: 1 },
        uGlare: { value: 1 },
      },
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    })
    this.sun = new Mesh(new PlaneGeometry(1, 1), sunMat)
    this.sun.frustumCulled = false
    this.sun.renderOrder = -5
    this.group.add(this.sun)
    this.group.renderOrder = -10
  }

  async load(starCount: number) {
    try {
      const [buf, meta] = await Promise.all([
        fetch(dataUrl('sky/stars.bin')).then((r) => r.arrayBuffer()),
        fetch(dataUrl('sky/stars.json')).then((r) => r.json()),
      ])
      this.starNames = meta.named ?? []
      const n = Math.min(Math.floor(buf.byteLength / 8), starCount)
      const dv = new DataView(buf)
      const pos = new Float32Array(n * 3)
      const mag = new Float32Array(n)
      const bv = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        const o = i * 8
        pos[i * 3] = (dv.getInt16(o, true) / 32767) * SKY_RADIUS
        pos[i * 3 + 1] = (dv.getInt16(o + 2, true) / 32767) * SKY_RADIUS
        pos[i * 3 + 2] = (dv.getInt16(o + 4, true) / 32767) * SKY_RADIUS
        mag[i] = dv.getUint8(o + 6) / 20 - 2
        bv[i] = dv.getUint8(o + 7) / 100 - 0.5
      }
      const g = new BufferGeometry()
      g.setAttribute('position', new Float32BufferAttribute(pos, 3))
      g.setAttribute('aMag', new BufferAttribute(mag, 1))
      g.setAttribute('aBV', new BufferAttribute(bv, 1))
      this.stars = new Points(g, this.starMat)
      this.stars.frustumCulled = false
      this.stars.matrixAutoUpdate = false
      this.stars.matrix.copy(eqjToSystemMatrix())
      this.stars.renderOrder = -10
      this.starTotal = n
      this.group.add(this.stars)
    } catch (e) {
      console.warn('stars failed', e)
    }
  }

  get count() {
    return this.starTotal
  }

  /** place the sky around the camera; sunDir is a unit vector (system frame) */
  update(cam: PerspectiveCamera, sunDir: Vector3, o: { starGain: number; px: number; time: number; sunAngRad: number; corona: number; glare: number; sunVisible: boolean }) {
    this.group.position.copy(cam.position)
    this.starMat.uniforms.uGain.value = o.starGain
    this.starMat.uniforms.uPx.value = o.px
    this.starMat.uniforms.uTime.value = o.time
    if (this.stars) this.stars.visible = o.starGain > 0.001
    const D = SKY_RADIUS * 0.9
    const half = D * Math.tan(o.sunAngRad) * 18
    this.sun.visible = o.sunVisible
    this.sun.position.copy(sunDir).multiplyScalar(D)
    this.sun.scale.setScalar(half * 2)
    this.sun.lookAt(cam.position)
    const u = this.sun.material.uniforms
    u.uK.value = 18
    u.uCorona.value = o.corona
    u.uTime.value = o.time
    u.uGlare.value = o.glare
  }
}

export const _tmpMatrix = new Matrix4()
export const _tmpV = new Vector3()
