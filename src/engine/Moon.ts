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
  fetchBlob,
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

export interface WindowMeta {
  id: string
  lon: number
  lat: number
  lonMin: number
  lonMax: number
  latMin: number
  latMax: number
  w: number
  h: number
  bytes: number
}

interface WindowSlot {
  id: string
  color: Texture | null
  relief: Texture | null
  weight: number
  target: number
  loading: boolean
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
  private winMeta: WindowMeta[] = []
  private winSlots: WindowSlot[] = [
    { id: '', color: null, relief: null, weight: 0, target: 0, loading: false },
    { id: '', color: null, relief: null, weight: 0, target: 0, loading: false },
  ]
  private winDummyC = flatPixel(110, 108, 104)
  private winDummyR = flatPixel(128, 128, 0)
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
        uWinC0: { value: null },
        uWinR0: { value: null },
        uWinC1: { value: null },
        uWinR1: { value: null },
        uWinRect: { value: [new Vector4(0, 1, 0, 1), new Vector4(0, 1, 0, 1)] },
        uWinW: { value: new Vector2(0, 0) },
      },
    })
    for (const k of ['uWinC0', 'uWinC1']) this.uniforms[k].value = this.winDummyC
    for (const k of ['uWinR0', 'uWinR1']) this.uniforms[k].value = this.winDummyR
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
    void this.loadWindowIndex()

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

  /* ---------------------------------------------------------------- hero windows */

  private async loadWindowIndex() {
    try {
      const res = await fetch(dataUrl('windows/windows.json'))
      if (!res.ok) return
      const j = (await res.json()) as { windows: WindowMeta[] }
      this.winMeta = j.windows
    } catch (e) {
      console.warn('window index failed', e)
    }
  }

  /** windows that contain a selenographic point, best-centred first */
  private windowsAt(lon: number, lat: number): WindowMeta[] {
    const hits: { m: WindowMeta; d: number }[] = []
    for (const m of this.winMeta) {
      if (lon < m.lonMin || lon > m.lonMax || lat < m.latMin || lat > m.latMax) continue
      const cx = ((lon - m.lonMin) / (m.lonMax - m.lonMin)) * 2 - 1
      const cy = ((lat - m.latMin) / (m.latMax - m.latMin)) * 2 - 1
      hits.push({ m, d: Math.max(Math.abs(cx), Math.abs(cy)) })
    }
    hits.sort((a, b) => a.d - b.d)
    return hits.map((h) => h.m)
  }

  private async fillSlot(slot: WindowSlot, m: WindowMeta) {
    slot.loading = true
    try {
      const sc = this.quality.windowScale
      const resize = sc < 1 ? { resizeWidth: Math.round(m.w * sc), resizeQuality: 'high' as const } : {}
      const [cb, rb] = await Promise.all([
        fetchBlob(dataUrl(`windows/${m.id}_c.webp`)),
        fetchBlob(dataUrl(`windows/${m.id}_r.jpg`)),
      ])
      const [cbmp, rbmp] = await Promise.all([
        createImageBitmap(cb, { premultiplyAlpha: 'none', colorSpaceConversion: 'none', ...resize }),
        createImageBitmap(rb, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }),
      ])
      if (slot.id !== m.id) {
        cbmp.close()
        rbmp.close()
        return
      }
      slot.color = textureFromBitmap(cbmp, { srgb: true, anisotropy: this.anisotropy, repeatS: false })
      slot.relief = textureFromBitmap(rbmp, { anisotropy: this.anisotropy, repeatS: false })
    } catch (e) {
      console.warn('window failed', m.id, e)
      slot.id = ''
    } finally {
      slot.loading = false
    }
  }

  private releaseSlot(slot: WindowSlot) {
    slot.color?.dispose()
    slot.relief?.dispose()
    slot.color = slot.relief = null
    slot.id = ''
    slot.weight = 0
    slot.target = 0
  }

  /**
   * Called every frame with the surface point under the view centre and the camera's distance from the Moon's
   * centre (Moon radii). Brings in the high-resolution tile for that place when we are close enough to see the difference.
   */
  updateWindows(lon: number, lat: number, camDist: number, dt: number) {
    if (this.quality.windowScale <= 0 || this.winMeta.length === 0) return
    const near = camDist < 4.6
    const want = near ? this.windowsAt(lon, lat).slice(0, 2) : []
    const fade = near ? 1 - Math.min(1, Math.max(0, (camDist - 2.2) / 1.1)) : 0
    const slots = this.winSlots
    for (const s of slots) s.target = 0
    for (const m of want) {
      let slot = slots.find((s) => s.id === m.id)
      if (!slot) {
        slot = slots.find((s) => s.id === '' && !s.loading) ?? slots.filter((s) => !want.some((w) => w.id === s.id) && !s.loading && s.weight < 0.02)[0]
        if (!slot) continue
        this.releaseSlot(slot)
        slot.id = m.id
        void this.fillSlot(slot, m)
      }
      slot.target = fade
    }
    const k = 1 - Math.exp(-dt * 3.2)
    const u = this.uniforms
    const wv = u.uWinW.value as Vector2
    const rects = u.uWinRect.value as Vector4[]
    for (let i = 0; i < 2; i++) {
      const s = slots[i]
      const ready = !!s.color && !!s.relief && !s.loading
      s.weight += ((ready ? s.target : 0) - s.weight) * k
      if (s.weight < 0.002 && s.target === 0 && s.color) {
        // keep resident (cheap) until the slot is needed; just stop drawing it
        s.weight = 0
      }
      const m = ready ? this.winMeta.find((x) => x.id === s.id) : undefined
      if (m && s.weight > 0.002) {
        rects[i].set(m.lonMin, m.lonMax, m.latMin, m.latMax)
        u[i === 0 ? 'uWinC0' : 'uWinC1'].value = s.color
        u[i === 0 ? 'uWinR0' : 'uWinR1'].value = s.relief
        wv.setComponent(i, s.weight)
      } else {
        wv.setComponent(i, 0)
        if (!ready || s.weight === 0) {
          u[i === 0 ? 'uWinC0' : 'uWinC1'].value = this.winDummyC
          u[i === 0 ? 'uWinR0' : 'uWinR1'].value = this.winDummyR
        }
      }
    }
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
