import {
  Color,
  DataTexture,
  Group,
  GLSL3,
  Mesh,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  Vector2,
  Vector3,
  Vector4,
  type WebGLRenderer,
} from 'three'
import { moonFrag, moonVert } from './shaders/moon'
import {
  dataUrl,
  fetchBitmap,
  fillMask,
  loadHeightTexture,
  loadLabelMap,
  makeMaskTexture,
  textureFromBitmap,
  type LabelMap,
} from './assets'
import type { Quality } from './quality'

export const MOON_UNITS = 1

export interface RingSpec {
  dir: Vector3
  /** angular radius, radians */
  radius: number
  strength: number
  widthPx: number
  reticle: boolean
  phase: number
}

export interface MoonLoadProgress {
  stage: string
  /** 0..1 over the whole sequence */
  value: number
  /** first-paint assets ready */
  ready: boolean
}

const SIZES: Record<string, number> = {
  albedo2k: 0.4e6,
  relief2k: 1.64e6,
  height4: 0.92e6,
  mare: 0.05e6,
  albedo4k: 1.13e6,
  relief4k: 6.43e6,
  height8: 3.8e6,
  albedo8k: 4.33e6,
}

function flatPixel(r: number, g: number, b: number): DataTexture {
  const t = new DataTexture(new Uint8Array([r, g, b, 255]), 1, 1)
  t.needsUpdate = true
  return t
}

export class MoonBody {
  readonly group = new Group()
  readonly mesh: Mesh<SphereGeometry, ShaderMaterial>
  readonly material: ShaderMaterial
  private labels: LabelMap | null = null
  private maskSel: DataTexture
  private maskHover: DataTexture
  private maskSelKey = ''
  private maskHoverKey = ''
  private loaded = new Set<string>()
  private anisotropy = 4
  radius = 1

  constructor(private renderer: WebGLRenderer, private quality: Quality) {
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    const [ws, hs] = quality.moonSegments
    const geo = new SphereGeometry(1, ws, hs)
    geo.deleteAttribute('normal')
    geo.deleteAttribute('uv')
    geo.computeBoundingSphere()
    geo.boundingSphere!.radius = 1.03

    this.maskSel = makeMaskTexture(2048, 1024)
    this.maskHover = makeMaskTexture(2048, 1024)

    const dummyAlbedo = flatPixel(110, 108, 104)
    const dummyRelief = flatPixel(128, 128, 0)
    const dummyHeight = flatPixel(0, 0, 0)

    const rings = [0, 1, 2].map(() => new Vector4(0, 1, 0, 0))
    const ringP = [0, 1, 2].map(() => new Vector4(0, 1.5, 0, 0))

    this.material = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: moonVert,
      fragmentShader: moonFrag,
      uniforms: {
        uAlbedo: { value: dummyAlbedo },
        uRelief: { value: dummyRelief },
        uHeight: { value: dummyHeight },
        uMask: { value: this.maskSel },
        uMaskHover: { value: this.maskHover },
        uSunBody: { value: new Vector3(1, 0, 0) },
        uCamBody: { value: new Vector3(0, 0, 5) },
        uEarthBody: { value: new Vector3(221, 0, 0) },
        uEarthR: { value: 3.667 },
        uSunAng: { value: 0.00465 },
        uSunInt: { value: 2.4 },
        uEarthshine: { value: 0.5 },
        uHeightScale: { value: 1 },
        uGrade: { value: new Vector3(1, 1, 1) },
        uShadowSteps: { value: quality.shadowSteps },
        uShadowReach: { value: 0.06 },
        uShadowSoft: { value: 40 },
        uMicro: { value: quality.microDetail ? 1 : 0 },
        uReliefGain: { value: 1 },
        uTime: { value: 0 },
        uOverlay: { value: new Vector4(0, 0, 0, 0) },
        uMaskColor: { value: new Color(1.0, 0.82, 0.55) },
        uRing: { value: rings },
        uRingP: { value: ringP },
        uImpact: { value: new Vector4(1, 0, 0, 0.05) },
        uImpactState: { value: new Vector4(0, 0, 0.08, 0) },
        uPulse: { value: new Vector4(1, 0, 0, 0) },
        uTopoRange: { value: new Vector2(-9000, 10800) },
      },
    })
    this.mesh = new Mesh(geo, this.material)
    this.mesh.frustumCulled = false
    this.group.add(this.mesh)
    this.group.name = 'moon'
  }

  get uniforms() {
    return this.material.uniforms
  }

  /** Progressive load. Resolves when first-paint assets are in; continues upgrades in the background. */
  async load(onProgress: (p: MoonLoadProgress) => void): Promise<void> {
    const q = this.quality
    const plan: { key: string; run: () => Promise<void> }[] = []
    const done = new Map<string, number>()
    const total = () => {
      let s = 0
      for (const p of plan) s += SIZES[p.key] ?? 1e6
      return s
    }
    const report = (stage: string, ready: boolean) => {
      let d = 0
      for (const [k, frac] of done) d += (SIZES[k] ?? 1e6) * frac
      onProgress({ stage, value: Math.min(1, d / total()), ready })
    }
    const byteCb = (k: string, stage: string) => (l: number, t: number) => {
      done.set(k, Math.min(1, l / Math.max(t, 1)))
      report(stage, false)
    }
    const swap = (uniform: string, tex: Texture) => {
      const old = this.uniforms[uniform].value as Texture
      this.uniforms[uniform].value = tex
      if (old && old.dispose) old.dispose()
      done.set(uniform, 1)
    }

    const A = q.albedoSteps
    const R = q.reliefSteps
    const H = q.heightSteps

    // --- first paint
    plan.push({
      key: 'albedo2k',
      run: async () => {
        const bmp = await fetchBitmap(dataUrl('moon/albedo_2k.webp'), byteCb('albedo2k', 'surface imagery'))
        swap('uAlbedo', textureFromBitmap(bmp, { srgb: true, anisotropy: this.anisotropy }))
        done.set('albedo2k', 1)
      },
    })
    plan.push({
      key: 'relief2k',
      run: async () => {
        const bmp = await fetchBitmap(dataUrl('moon/relief_2k.jpg'), byteCb('relief2k', 'laser altimetry'))
        swap('uRelief', textureFromBitmap(bmp, { anisotropy: this.anisotropy }))
        done.set('relief2k', 1)
      },
    })
    plan.push({
      key: 'height4',
      run: async () => {
        const t = await loadHeightTexture(dataUrl('moon/height_4ppd.webp'), 2500, 8, byteCb('height4', 'elevation model'))
        swap('uHeight', t)
        done.set('height4', 1)
      },
    })
    plan.push({
      key: 'mare',
      run: async () => {
        this.labels = await loadLabelMap(dataUrl('moon/mare_ids.png'))
        done.set('mare', 1)
      },
    })
    // first-paint set
    await Promise.all(plan.map((p) => p.run().catch((e) => console.warn('asset failed', p.key, e))))
    report('ready', true)

    // --- upgrades (background, sequential to be gentle on bandwidth + decode)
    const upgrades: { key: string; run: () => Promise<void> }[] = []
    if (A.includes('4k')) {
      upgrades.push({
        key: 'albedo4k',
        run: async () => {
          const bmp = await fetchBitmap(dataUrl('moon/albedo_4k.webp'))
          swap('uAlbedo', textureFromBitmap(bmp, { srgb: true, anisotropy: this.anisotropy }))
        },
      })
    }
    if (R.includes('4k')) {
      upgrades.push({
        key: 'relief4k',
        run: async () => {
          const bmp = await fetchBitmap(dataUrl('moon/relief_4k.jpg'))
          swap('uRelief', textureFromBitmap(bmp, { anisotropy: this.anisotropy }))
        },
      })
    }
    if (H.includes('8ppd')) {
      upgrades.push({
        key: 'height8',
        run: async () => {
          swap('uHeight', await loadHeightTexture(dataUrl('moon/height_8ppd.webp'), 2500, 4))
        },
      })
    }
    if (A.includes('8k')) {
      upgrades.push({
        key: 'albedo8k',
        run: async () => {
          const bmp = await fetchBitmap(dataUrl('moon/albedo_8k.webp'))
          swap('uAlbedo', textureFromBitmap(bmp, { srgb: true, anisotropy: this.anisotropy }))
        },
      })
    }
    // do not block the caller
    void (async () => {
      for (const u of upgrades) {
        try {
          await u.run()
          this.loaded.add(u.key)
        } catch (e) {
          console.warn('upgrade failed', u.key, e)
        }
        await new Promise((r) => setTimeout(r, 60))
      }
    })()
  }

  /** Highlight maria by id (label ids from mare_ids.png). Selected + hover masks. */
  setMaskIds(slot: 'sel' | 'hover', ids: number[] | null) {
    if (!this.labels) return
    const key = ids ? ids.join(',') : ''
    if (slot === 'sel') {
      if (key === this.maskSelKey) return
      this.maskSelKey = key
      fillMask(this.maskSel, this.labels, ids ? new Set(ids) : null)
    } else {
      if (key === this.maskHoverKey) return
      this.maskHoverKey = key
      fillMask(this.maskHover, this.labels, ids ? new Set(ids) : null)
    }
  }

  /** mare id under a selenographic position */
  mareAt(lonDeg: number, latDeg: number): number {
    if (!this.labels) return 0
    const { w, h, data } = this.labels
    const x = Math.floor(((lonDeg + 180) / 360) * w) % w
    const y = Math.min(h - 1, Math.max(0, Math.floor(((90 - latDeg) / 180) * h)))
    return data[y * w + ((x + w) % w)]
  }

  setRings(rings: RingSpec[]) {
    const u = this.uniforms.uRing.value as Vector4[]
    const p = this.uniforms.uRingP.value as Vector4[]
    for (let i = 0; i < 3; i++) {
      const r = rings[i]
      if (r) {
        u[i].set(r.dir.x, r.dir.y, r.dir.z, r.radius)
        p[i].set(r.strength, r.widthPx, r.reticle ? 1 : 0, r.phase)
      } else {
        p[i].set(0, 1, 0, 0)
      }
    }
  }

  setPose(position: Vector3, quat: Quaternion) {
    this.group.position.copy(position)
    this.group.quaternion.copy(quat)
    this.group.updateMatrixWorld(true)
  }
}
