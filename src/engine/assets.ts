import {
  ClampToEdgeWrapping,
  DataTexture,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RedFormat,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
} from 'three'

export const BASE = import.meta.env.BASE_URL

export function dataUrl(path: string): string {
  return `${BASE}data/${path}`
}

/** fetch with byte-level progress reporting */
export async function fetchBlob(url: string, onBytes?: (loaded: number, total: number) => void, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  const total = Number(res.headers.get('content-length') || 0)
  if (!res.body || !onBytes) return res.blob()
  const reader = res.body.getReader()
  const chunks: BlobPart[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value as BlobPart)
    loaded += value.length
    onBytes(loaded, total || loaded)
  }
  return new Blob(chunks, { type: res.headers.get('content-type') || undefined })
}

export async function fetchBitmap(url: string, onBytes?: (l: number, t: number) => void, signal?: AbortSignal): Promise<ImageBitmap> {
  const blob = await fetchBlob(url, onBytes, signal)
  return createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
}

export interface TexOpts {
  srgb?: boolean
  anisotropy?: number
  mipmaps?: boolean
  repeatS?: boolean
}

export function textureFromBitmap(bmp: ImageBitmap, o: TexOpts = {}): Texture {
  const t = new Texture(bmp as unknown as HTMLImageElement)
  t.flipY = false
  t.colorSpace = o.srgb ? SRGBColorSpace : NoColorSpace
  t.generateMipmaps = o.mipmaps ?? true
  t.minFilter = (o.mipmaps ?? true) ? LinearMipmapLinearFilter : LinearFilter
  t.magFilter = LinearFilter
  t.wrapS = o.repeatS === false ? ClampToEdgeWrapping : RepeatWrapping
  t.wrapT = ClampToEdgeWrapping
  t.anisotropy = o.anisotropy ?? 1
  t.needsUpdate = true
  return t
}

function readPixels(bmp: ImageBitmap): { data: Uint8ClampedArray; w: number; h: number } {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height })
  const ctx = c.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D
  ctx.drawImage(bmp, 0, 0)
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height)
  return { data: img.data, w: bmp.width, h: bmp.height }
}

/**
 * Elevation texture. The WebP stores (RG16 = round(metres/unit) + bias). We convert to half-float
 * in units of the lunar radius (1737.4 km) so the shaders can use it directly.
 */
export async function loadHeightTexture(url: string, bias: number, unitMeters: number, onBytes?: (l: number, t: number) => void): Promise<DataTexture> {
  const bmp = await fetchBitmap(url, onBytes)
  const { data, w, h } = readPixels(bmp)
  bmp.close?.()
  const lut = new Uint16Array(65536)
  const seen = new Uint8Array(65536)
  const out = new Uint16Array(w * h)
  const k = unitMeters / 1_737_400
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const v = (data[j] << 8) | data[j + 1]
    if (!seen[v]) {
      seen[v] = 1
      lut[v] = DataUtils.toHalfFloat((v - bias) * k)
    }
    out[i] = lut[v]
  }
  const t = new DataTexture(out, w, h, RedFormat, HalfFloatType)
  t.internalFormat = 'R16F'
  t.minFilter = LinearFilter
  t.magFilter = LinearFilter
  t.wrapS = RepeatWrapping
  t.wrapT = ClampToEdgeWrapping
  t.generateMipmaps = false
  t.flipY = false
  t.needsUpdate = true
  return t
}

export interface LabelMap {
  data: Uint8Array
  w: number
  h: number
}

export async function loadLabelMap(url: string): Promise<LabelMap> {
  const bmp = await fetchBitmap(url)
  const { data, w, h } = readPixels(bmp)
  bmp.close?.()
  const out = new Uint8Array(w * h)
  for (let i = 0, j = 0; i < w * h; i++, j += 4) out[i] = data[j]
  return { data: out, w, h }
}

export function makeMaskTexture(w: number, h: number): DataTexture {
  const t = new DataTexture(new Uint8Array(w * h), w, h, RedFormat, UnsignedByteType)
  t.minFilter = LinearFilter
  t.magFilter = LinearFilter
  t.wrapS = RepeatWrapping
  t.wrapT = ClampToEdgeWrapping
  t.generateMipmaps = false
  t.flipY = false
  t.needsUpdate = true
  return t
}

/** Fill `tex` with a softened binary mask of the label ids. */
export function fillMask(tex: DataTexture, map: LabelMap, ids: ReadonlySet<number> | null) {
  const { w, h } = map
  const dst = tex.image.data as Uint8Array
  if (!ids || ids.size === 0) {
    dst.fill(0)
    tex.needsUpdate = true
    return
  }
  const a = new Uint8Array(w * h)
  for (let i = 0; i < a.length; i++) a[i] = ids.has(map.data[i]) ? 255 : 0
  const b = new Uint8Array(w * h)
  const r = 2
  const norm = 1 / (2 * r + 1)
  const pass = (src: Uint8Array, out: Uint8Array) => {
    // horizontal (wrap)
    for (let y = 0; y < h; y++) {
      const row = y * w
      let sum = 0
      for (let k = -r; k <= r; k++) sum += src[row + ((k + w) % w)]
      for (let x = 0; x < w; x++) {
        out[row + x] = sum * norm
        sum += src[row + ((x + r + 1) % w)] - src[row + ((x - r + w) % w)]
      }
    }
  }
  const passV = (src: Uint8Array, out: Uint8Array) => {
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let k = -r; k <= r; k++) sum += src[Math.min(h - 1, Math.max(0, k)) * w + x]
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum * norm
        sum += src[Math.min(h - 1, y + r + 1) * w + x] - src[Math.max(0, y - r) * w + x]
      }
    }
  }
  pass(a, b)
  passV(b, a)
  pass(a, b)
  passV(b, dst)
  tex.needsUpdate = true
}
