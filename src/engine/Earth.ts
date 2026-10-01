import {
  AdditiveBlending,
  BackSide,
  Group,
  GLSL3,
  Mesh,
  PerspectiveCamera,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  Vector3,
} from 'three'
import { atmoFrag, atmoVert, earthFrag, earthVert } from './shaders/earth'
import { dataUrl, fetchBitmap, textureFromBitmap } from './assets'
import { EARTH_RADIUS_KM, MOON_RADIUS_KM } from '../astro/ephemeris'
import { DataTexture } from 'three'

export const EARTH_R = EARTH_RADIUS_KM / MOON_RADIUS_KM // 3.667 Moon radii

function px(r: number, g: number, b: number) {
  const t = new DataTexture(new Uint8Array([r, g, b, 255]), 1, 1)
  t.needsUpdate = true
  return t
}

export class EarthBody {
  readonly group = new Group()
  readonly mesh: Mesh<SphereGeometry, ShaderMaterial>
  readonly shell: Mesh<SphereGeometry, ShaderMaterial>
  private anisotropy = 4

  constructor(anisotropy: number) {
    this.anisotropy = anisotropy
    const mat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: earthVert,
      fragmentShader: earthFrag,
      uniforms: {
        uDay: { value: px(30, 60, 120) },
        uNight: { value: px(0, 0, 0) },
        uSunDir: { value: new Vector3(1, 0, 0) },
        uMoonPos: { value: new Vector3(221, 0, 0) },
        uMoonR: { value: 1 },
        uSunAng: { value: 0.00465 },
        uTime: { value: 0 },
        uCloud: { value: 0.9 },
        uSunInt: { value: 2.4 },
        uAtmo: { value: 1 },
        uCamPos: { value: new Vector3() },
      },
    })
    this.mesh = new Mesh(new SphereGeometry(1, 160, 80), mat)
    this.mesh.scale.setScalar(EARTH_R)
    this.mesh.frustumCulled = false

    const shellMat = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: atmoVert,
      fragmentShader: atmoFrag,
      uniforms: {
        uSunDir: { value: new Vector3(1, 0, 0) },
        uCamPos: { value: new Vector3() },
        uCenter: { value: new Vector3() },
        uInner: { value: EARTH_R },
        uOuter: { value: EARTH_R * 1.03 },
        uMoonPos: { value: new Vector3(221, 0, 0) },
        uMoonR: { value: 1 },
        uSunAng: { value: 0.00465 },
        uSunInt: { value: 2.4 },
      },
      side: BackSide,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
    this.shell = new Mesh(new SphereGeometry(1, 96, 48), shellMat)
    this.shell.scale.setScalar(EARTH_R * 1.03)
    this.shell.frustumCulled = false
    this.group.add(this.mesh, this.shell)
    this.group.name = 'earth'
  }

  async load(highRes: boolean) {
    const u = this.mesh.material.uniforms
    const set = (name: string, t: Texture) => {
      const old = u[name].value as Texture
      u[name].value = t
      old?.dispose?.()
    }
    try {
      const d = await fetchBitmap(dataUrl('earth/day_2k.webp'))
      set('uDay', textureFromBitmap(d, { srgb: true, anisotropy: this.anisotropy }))
      const n = await fetchBitmap(dataUrl('earth/night_2k.webp'))
      set('uNight', textureFromBitmap(n, { anisotropy: this.anisotropy }))
      if (highRes) {
        void (async () => {
          try {
            set('uDay', textureFromBitmap(await fetchBitmap(dataUrl('earth/day_4k.webp')), { srgb: true, anisotropy: this.anisotropy }))
            set('uNight', textureFromBitmap(await fetchBitmap(dataUrl('earth/night_4k.webp')), { anisotropy: this.anisotropy }))
          } catch (e) {
            console.warn('earth hi-res failed', e)
          }
        })()
      }
    } catch (e) {
      console.warn('earth textures failed', e)
    }
  }

  update(o: { quat: Quaternion; sunDir: Vector3; moonPos: Vector3; cam: PerspectiveCamera; time: number; sunAng: number; sunInt: number; visible: boolean }) {
    this.group.visible = o.visible
    if (!o.visible) return
    this.mesh.quaternion.copy(o.quat)
    const u = this.mesh.material.uniforms
    u.uSunDir.value.copy(o.sunDir)
    u.uMoonPos.value.copy(o.moonPos)
    u.uCamPos.value.copy(o.cam.position)
    u.uTime.value = o.time
    u.uSunAng.value = o.sunAng
    u.uSunInt.value = o.sunInt
    const s = this.shell.material.uniforms
    s.uSunDir.value.copy(o.sunDir)
    s.uMoonPos.value.copy(o.moonPos)
    s.uCamPos.value.copy(o.cam.position)
    s.uSunAng.value = o.sunAng
    s.uSunInt.value = o.sunInt
  }
}
