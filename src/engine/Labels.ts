import { Vector3 } from 'three'
import type { Observatory } from './Observatory'
import { lonLatToVec } from '../astro/ephemeris'

export type LabelKind = 'mare' | 'crater' | 'site' | 'mountain' | 'pole' | 'mission' | 'basin' | 'valley' | 'event'

export interface LabelItem {
  id: string
  text: string
  sub?: string
  lon: number
  lat: number
  priority: number
  kind: LabelKind
  active?: boolean
  hover?: boolean
  marker?: 'dot' | 'ring' | 'none'
  /** hide when the point is beyond this facing value (0 = limb, 1 = centre) */
  minFacing?: number
  /** force show regardless of collisions */
  force?: boolean
  /** dim variant */
  dim?: boolean
}

export interface NoteItem {
  id: string
  /** world position (system frame) */
  world: Vector3
  text: string
  sub?: string
  priority: number
  dx?: number
  dy?: number
  align?: 'left' | 'right' | 'center'
  tone?: 'earth' | 'sun' | 'moon' | 'neutral'
  marker?: boolean
}

interface State {
  alpha: number
  x: number
  y: number
  w: number
  h: number
  ox: number
  oy: number
}

interface Hit {
  id: string
  kind: 'label' | 'note'
  x: number
  y: number
  r: number
  rect: [number, number, number, number]
}

const AMBER = '231,196,142'
const BONE = '236,231,219'
const EARTH = '143,182,224'

const CANDIDATES: [number, number][] = [
  [1, -1],
  [1, 1],
  [-1, -1],
  [-1, 1],
  [0, -1.5],
  [0, 1.5],
  [1.7, 0],
  [-1.7, 0],
]

function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number, align: 'left' | 'right' | 'center' = 'left') {
  let total = 0
  const widths: number[] = []
  for (const ch of text) {
    const w = ctx.measureText(ch).width + tracking
    widths.push(w)
    total += w
  }
  total -= tracking
  let cx = align === 'left' ? x : align === 'right' ? x - total : x - total / 2
  let i = 0
  for (const ch of text) {
    ctx.fillText(ch, cx, y)
    cx += widths[i++]
  }
  return total
}

function trackedWidth(ctx: CanvasRenderingContext2D, text: string, tracking: number) {
  let total = 0
  for (const ch of text) total += ctx.measureText(ch).width + tracking
  return Math.max(0, total - tracking)
}

export class LabelLayer {
  private ctx: CanvasRenderingContext2D
  private states = new Map<string, State>()
  private hits: Hit[] = []
  items: LabelItem[] = []
  notes: NoteItem[] = []
  /** pointer reticle (CSS px) */
  pointer: { x: number; y: number; lon: number; lat: number; over: boolean } | null = null
  enabled = true
  private tmp = { x: 0, y: 0, visible: false, facing: 0 }
  private tmpW = { x: 0, y: 0, z: 0 }
  private tmpV = new Vector3()
  private dpr = 1
  private time = 0
  /** global opacity (for transitions) */
  opacity = 1

  constructor(private canvas: HTMLCanvasElement, private obs: Observatory) {
    this.ctx = canvas.getContext('2d')!
  }

  resize() {
    const w = this.obs.width
    const h = this.obs.height
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.floor(w * this.dpr)
    this.canvas.height = Math.floor(h * this.dpr)
  }

  hitTest(x: number, y: number): { id: string; kind: 'label' | 'note' } | null {
    let best: Hit | null = null
    let bd = 1e9
    for (const h of this.hits) {
      const inRect = x >= h.rect[0] && x <= h.rect[2] && y >= h.rect[1] && y <= h.rect[3]
      const d = Math.hypot(x - h.x, y - h.y)
      if (inRect || d < h.r) {
        const dd = inRect ? 0 : d
        if (dd < bd) {
          bd = dd
          best = h
        }
      }
    }
    return best ? { id: best.id, kind: best.kind } : null
  }

  draw(dt: number) {
    const ctx = this.ctx
    const W = this.obs.width
    const H = this.obs.height
    this.time += dt
    if (this.canvas.width !== Math.floor(W * this.dpr)) this.resize()
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    this.hits.length = 0
    if (!this.enabled || this.opacity < 0.01) return
    ctx.globalAlpha = this.opacity
    ctx.textBaseline = 'alphabetic'

    const placed: [number, number, number, number][] = []
    const overlaps = (r: [number, number, number, number]) => {
      for (const p of placed) if (r[0] < p[2] + 6 && r[2] > p[0] - 6 && r[1] < p[3] + 4 && r[3] > p[1] - 4) return true
      return false
    }

    // ---------------------------------------------------------------- surface labels
    const items = [...this.items].sort((a, b) => Number(!!b.active) - Number(!!a.active) || Number(!!b.hover) - Number(!!a.hover) || b.priority - a.priority)
    const seen = new Set<string>()
    for (const it of items) {
      seen.add(it.id)
      let st = this.states.get(it.id)
      if (!st) {
        st = { alpha: 0, x: 0, y: 0, w: 0, h: 0, ox: 14, oy: -14 }
        this.states.set(it.id, st)
      }
      const vis = this.obs.projectSurface(it.lon, it.lat, this.tmp)
      const facing = this.tmp.facing
      const minF = it.minFacing ?? 0.1
      let target = 0
      const inScreen = this.tmp.x > -40 && this.tmp.x < W + 40 && this.tmp.y > -40 && this.tmp.y < H + 40
      if (vis && facing > minF && inScreen) target = Math.min(1, (facing - minF) / 0.18)
      // features on the unlit side fade out (selected ones stay, dimmed)
      {
        const sb = this.obs.moon.uniforms.uSunBody.value as Vector3
        const lit = lonLatToVec(it.lon, it.lat, this.tmpV).dot(sb)
        const l01 = Math.min(1, Math.max(0, (lit + 0.04) / 0.22))
        target *= it.active || it.hover ? 0.4 + 0.6 * l01 : l01 * l01
      }
      const k = 1 - Math.exp(-dt * (target > st.alpha ? 5 : 8))
      st.alpha += (target - st.alpha) * k
      if (st.alpha < 0.01) continue
      st.x = this.tmp.x
      st.y = this.tmp.y

      const big = !!it.active || !!it.hover
      const fontSize = big ? 22 : 11
      const font = big ? `400 ${fontSize}px "Instrument Serif", serif` : `500 ${fontSize}px "Instrument Sans Variable", system-ui, sans-serif`
      ctx.font = font
      const label = big ? it.text : it.text.toUpperCase()
      const tracking = big ? 0.2 : 1.6
      const tw = trackedWidth(ctx, label, tracking)
      let subW = 0
      if (big && it.sub) {
        ctx.font = '400 10px "JetBrains Mono", ui-monospace, monospace'
        subW = trackedWidth(ctx, it.sub.toUpperCase(), 1)
        ctx.font = font
      }
      const w = Math.max(tw, subW)
      const h = big ? (it.sub ? 34 : 22) : 13
      // choose a placement that does not collide
      let chosen: [number, number, number, number] | null = null
      let cdx = 0
      let cdy = 0
      const ordered = [...CANDIDATES]
      // try to keep previous placement to avoid jitter
      const prefIdx = Math.max(0, CANDIDATES.findIndex((c) => c[0] * 16 === st!.ox && c[1] * 16 === st!.oy))
      ordered.unshift(CANDIDATES[prefIdx])
      for (const c of ordered) {
        const ox = c[0] * 16
        const oy = c[1] * 16
        const rx = c[0] >= 0.5 ? st.x + ox : c[0] <= -0.5 ? st.x + ox - w : st.x - w / 2
        const ry = c[1] <= -0.5 ? st.y + oy - h + (big ? 6 : 4) : st.y + oy + 2
        const r: [number, number, number, number] = [rx, ry, rx + w, ry + h]
        if (r[0] < 8 || r[2] > W - 8 || r[1] < 56 || r[3] > H - 40) continue
        if (it.force || it.active || !overlaps(r)) {
          chosen = r
          cdx = ox
          cdy = oy
          break
        }
      }
      if (!chosen && !it.force && !it.active) {
        // draw only the marker for crowded labels
        this.drawMarker(ctx, st, it, big)
        continue
      }
      if (!chosen) {
        const r: [number, number, number, number] = [st.x + 16, st.y - 16, st.x + 16 + w, st.y - 16 + h]
        chosen = r
        cdx = 16
        cdy = -16
      }
      st.ox = cdx
      st.oy = cdy
      placed.push(chosen)
      const a = st.alpha * (it.dim ? 0.55 : 1)
      this.drawMarker(ctx, st, it, big)

      // leader
      const lx = chosen[0] < st.x ? chosen[2] : chosen[0]
      const ly = chosen[3] - (cdy < 0 ? (big ? 8 : 3) : h - 3)
      ctx.strokeStyle = `rgba(${big ? AMBER : BONE},${(big ? 0.7 : 0.35) * a})`
      ctx.lineWidth = 0.75
      ctx.beginPath()
      ctx.moveTo(st.x + (cdx > 0 ? 4 : cdx < 0 ? -4 : 0), st.y + (cdy < 0 ? -3 : 3))
      ctx.lineTo(lx + (cdx > 0 ? -2 : cdx < 0 ? 2 : 0), ly)
      ctx.stroke()

      // text
      ctx.fillStyle = `rgba(${big ? '246,240,226' : BONE},${(big ? 1 : 0.86) * a})`
      ctx.font = font
      ctx.shadowColor = `rgba(0,0,0,${0.95 * a})`
      ctx.shadowBlur = big ? 10 : 8
      const tx = chosen[0]
      const ty = chosen[1] + (big ? 18 : 10)
      tracked(ctx, label, tx, ty, tracking)
      ctx.shadowBlur = 3
      tracked(ctx, label, tx, ty, tracking)
      if (big && it.sub) {
        ctx.font = '400 10px "JetBrains Mono", ui-monospace, monospace'
        ctx.fillStyle = `rgba(${AMBER},${0.95 * a})`
        tracked(ctx, it.sub.toUpperCase(), tx, ty + 15, 1)
      }
      ctx.shadowBlur = 0
      this.hits.push({ id: it.id, kind: 'label', x: st.x, y: st.y, r: 11, rect: [chosen[0] - 3, chosen[1] - 2, chosen[2] + 3, chosen[3] + 2] })
    }
    for (const [id, st] of this.states) if (!seen.has(id)) {
      st.alpha *= Math.exp(-dt * 10)
      if (st.alpha < 0.01) this.states.delete(id)
    }

    // ---------------------------------------------------------------- world notes (system views)
    for (const n of [...this.notes].sort((a, b) => b.priority - a.priority)) {
      this.obs.projectWorld(n.world, this.tmpW)
      if (this.tmpW.z > 1 || this.tmpW.z < -1) continue
      const x = this.tmpW.x
      const y = this.tmpW.y
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue
      const tone = n.tone === 'earth' ? EARTH : n.tone === 'sun' ? '255,214,150' : n.tone === 'moon' ? BONE : BONE
      ctx.font = '500 11px "Instrument Sans Variable", system-ui, sans-serif'
      const tw = trackedWidth(ctx, n.text.toUpperCase(), 1.6)
      ctx.font = '400 10px "JetBrains Mono", ui-monospace, monospace'
      const sw = n.sub ? trackedWidth(ctx, n.sub.toUpperCase(), 1) : 0
      const w = Math.max(tw, sw)
      const dx = n.dx ?? 18
      const dy = n.dy ?? -18
      const align = n.align ?? (dx >= 0 ? 'left' : 'right')
      const rx = align === 'left' ? x + dx : align === 'right' ? x + dx - w : x + dx - w / 2
      const ry = y + dy - 12
      const r: [number, number, number, number] = [rx, ry, rx + w, ry + (n.sub ? 28 : 14)]
      if (overlaps(r)) continue
      placed.push(r)
      if (n.marker !== false) {
        ctx.strokeStyle = `rgba(${tone},0.8)`
        ctx.lineWidth = 0.9
        ctx.beginPath()
        ctx.arc(x, y, 3.2, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.strokeStyle = `rgba(${tone},0.4)`
      ctx.lineWidth = 0.75
      ctx.beginPath()
      ctx.moveTo(x + (dx >= 0 ? 4 : -4), y + (dy < 0 ? -3 : 3))
      ctx.lineTo(x + dx - (align === 'left' ? 3 : align === 'right' ? -3 : 0), y + dy - 4)
      ctx.stroke()
      ctx.shadowColor = 'rgba(0,0,0,0.9)'
      ctx.shadowBlur = 6
      ctx.fillStyle = `rgba(${tone},0.95)`
      ctx.font = '500 11px "Instrument Sans Variable", system-ui, sans-serif'
      tracked(ctx, n.text.toUpperCase(), rx, ry + 10, 1.6)
      if (n.sub) {
        ctx.font = '400 10px "JetBrains Mono", ui-monospace, monospace'
        ctx.fillStyle = `rgba(${tone},0.7)`
        tracked(ctx, n.sub.toUpperCase(), rx, ry + 24, 1)
      }
      ctx.shadowBlur = 0
    }

    // ---------------------------------------------------------------- pointer reticle
    if (this.pointer?.over) {
      const { x, y, lon, lat } = this.pointer
      ctx.strokeStyle = `rgba(${BONE},0.55)`
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.arc(x, y, 9, 0, Math.PI * 2)
      ctx.moveTo(x - 16, y)
      ctx.lineTo(x - 5, y)
      ctx.moveTo(x + 5, y)
      ctx.lineTo(x + 16, y)
      ctx.moveTo(x, y - 16)
      ctx.lineTo(x, y - 5)
      ctx.moveTo(x, y + 5)
      ctx.lineTo(x, y + 16)
      ctx.stroke()
      const fmt = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`
      ctx.font = '400 10px "JetBrains Mono", ui-monospace, monospace'
      ctx.fillStyle = `rgba(${BONE},0.8)`
      ctx.shadowColor = 'rgba(0,0,0,0.9)'
      ctx.shadowBlur = 5
      const tx = x + 22 + 140 > W ? x - 22 - trackedWidth(ctx, fmt, 0.6) : x + 22
      tracked(ctx, fmt, tx, y + 3, 0.6)
      ctx.shadowBlur = 0
    }
    ctx.globalAlpha = 1
  }

  private drawMarker(ctx: CanvasRenderingContext2D, st: State, it: LabelItem, big: boolean) {
    if (it.marker === 'none') return
    const a = st.alpha * (it.dim ? 0.6 : 1)
    const col = big ? AMBER : BONE
    if (big) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.2)
      ctx.strokeStyle = `rgba(${col},${0.9 * a})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(st.x, st.y, 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = `rgba(${col},${(0.25 + 0.25 * pulse) * a})`
      ctx.beginPath()
      ctx.arc(st.x, st.y, 9 + pulse * 3, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.fillStyle = `rgba(${col},${0.8 * a})`
      ctx.beginPath()
      ctx.arc(st.x, st.y, it.marker === 'ring' ? 2.6 : 1.7, 0, Math.PI * 2)
      if (it.marker === 'ring') {
        ctx.strokeStyle = `rgba(${col},${0.8 * a})`
        ctx.lineWidth = 0.9
        ctx.stroke()
      } else ctx.fill()
    }
  }
}
