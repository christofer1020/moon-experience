import gsap from 'gsap'
import type { Observatory } from './Observatory'
import type { LabelLayer } from './Labels'
import { getState, useStore } from '../store'

export interface InputHooks {
  /** a labelled feature was activated */
  onPickLabel: (id: string) => void
  onHoverLabel: (id: string | null) => void
  /** click on bare surface */
  onSurfaceClick: (lon: number, lat: number) => void
  onSurfaceHover: (lon: number, lat: number) => void
  onSurfaceLeave: () => void
  onInteract: () => void
}

interface Ptr {
  id: number
  x: number
  y: number
}

const DEG = 180 / Math.PI

export class Input {
  private ptrs = new Map<number, Ptr>()
  private dragging = false
  private downAt = 0
  private downX = 0
  private downY = 0
  private moved = 0
  private vA = 0
  private vE = 0
  private lastT = 0
  private pinchStart = 0
  private pinchZoom = 1
  private raf = 0
  private tween: gsap.core.Tween | null = null
  private lastUserEnd = 0
  private hoverId: string | null = null
  private el: HTMLElement

  constructor(private obs: Observatory, private labels: LabelLayer, private hooks: InputHooks, el: HTMLElement) {
    this.el = el
    el.addEventListener('pointerdown', this.down)
    window.addEventListener('pointermove', this.move)
    window.addEventListener('pointerup', this.up)
    window.addEventListener('pointercancel', this.up)
    el.addEventListener('pointerleave', this.leave)
    el.addEventListener('wheel', this.wheel, { passive: false })
    window.addEventListener('keydown', this.key)
    this.loop()
    useStore.subscribe((s, p) => {
      if (s.mode !== p.mode) this.applyMode()
    })
    this.applyMode()
  }

  private applyMode() {
    const free = getState().mode === 'free'
    this.el.style.touchAction = free ? 'none' : 'pan-y'
  }

  dispose() {
    this.el.removeEventListener('pointerdown', this.down)
    window.removeEventListener('pointermove', this.move)
    window.removeEventListener('pointerup', this.up)
    window.removeEventListener('pointercancel', this.up)
    cancelAnimationFrame(this.raf)
  }

  /** ease any user rotation / zoom back to the chapter's composition */
  releaseUser(duration = 2.2, keepZoom = false) {
    this.tween?.kill()
    const u = this.obs.rig.user
    const targets: gsap.TweenVars = { a: 0, e: 0, duration, ease: 'power3.inOut', overwrite: true }
    this.vA = this.vE = 0
    this.tween = gsap.to(u, targets)
    if (!keepZoom) gsap.to(this.obs.rig, { zoom: 1, duration, ease: 'power3.inOut' })
  }

  zoomBy(f: number) {
    const r = this.obs.rig
    r.zoom = Math.max(0.28, Math.min(3.2, r.zoom * f))
    useStore.getState().set({ zoomLevel: r.zoom })
    this.hooks.onInteract()
  }

  private perPixel(): number {
    const o = this.obs
    const fov = (o.camera.fov * Math.PI) / 180
    const H = o.height
    const kind = o.p.cam.kind
    if (kind === 'surface') {
      const d = Math.max(o.rig.dist - 1, 0.4)
      return (2 * Math.tan(fov / 2) * d) / H
    }
    if (kind === 'ground') return (2 * Math.tan(fov / 2)) / H
    return (2 * Math.tan(fov / 2) * 1.5) / H
  }

  private isUi(target: EventTarget | null) {
    const el = target as HTMLElement | null
    return !!el?.closest?.('[data-ui]')
  }

  private down = (e: PointerEvent) => {
    if (this.isUi(e.target)) return
    const st = getState()
    if (st.phase !== 'live' || st.indexOpen || st.readerOpen) return
    this.el.setPointerCapture?.(e.pointerId)
    this.ptrs.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY })
    if (this.ptrs.size === 1) {
      this.dragging = true
      this.downAt = performance.now()
      this.downX = e.clientX
      this.downY = e.clientY
      this.moved = 0
      this.vA = this.vE = 0
      this.lastT = performance.now()
      this.tween?.kill()
    } else if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()]
      this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y)
      this.pinchZoom = this.obs.rig.zoom
    }
    this.obs.userActive = true
    this.hooks.onInteract()
  }

  private move = (e: PointerEvent) => {
    const p = this.ptrs.get(e.pointerId)
    if (p && this.ptrs.size === 2) {
      p.x = e.clientX
      p.y = e.clientY
      const [a, b] = [...this.ptrs.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (this.pinchStart > 0) {
        this.obs.rig.zoom = Math.max(0.28, Math.min(3.2, this.pinchZoom * (this.pinchStart / d)))
        useStore.getState().set({ zoomLevel: this.obs.rig.zoom })
      }
      return
    }
    if (p && this.dragging) {
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      this.moved += Math.abs(dx) + Math.abs(dy)
      const k = this.perPixel()
      const free = getState().mode === 'free' || e.pointerType !== 'touch'
      const u = this.obs.rig.user
      const dA = -dx * k
      const dE = free ? dy * k : 0
      u.a += dA
      u.e = Math.max(-1.25, Math.min(1.25, u.e + dE))
      const now = performance.now()
      const dt = Math.max(1, now - this.lastT) / 1000
      this.lastT = now
      this.vA = this.vA * 0.6 + (dA / dt) * 0.4
      this.vE = this.vE * 0.6 + (dE / dt) * 0.4
      return
    }
    // hover (mouse only)
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') this.hover(e)
  }

  private hover(e: PointerEvent) {
    const st = getState()
    if (st.phase !== 'live' || this.isUi(e.target) || st.indexOpen) {
      this.labels.pointer = null
      return
    }
    const hit = this.labels.hitTest(e.clientX, e.clientY)
    const id = hit?.kind === 'label' ? hit.id : null
    if (id !== this.hoverId) {
      this.hoverId = id
      this.hooks.onHoverLabel(id)
    }
    const pick = this.obs.pickMoon(e.clientX, e.clientY)
    if (pick) {
      this.labels.pointer = { x: e.clientX, y: e.clientY, lon: pick.lon, lat: pick.lat, over: !id }
      this.hooks.onSurfaceHover(pick.lon, pick.lat)
      this.el.style.cursor = id ? 'pointer' : 'crosshair'
    } else {
      this.labels.pointer = null
      this.el.style.cursor = id ? 'pointer' : 'grab'
      this.hooks.onSurfaceLeave()
    }
  }

  private leave = () => {
    this.labels.pointer = null
    if (this.hoverId) {
      this.hoverId = null
      this.hooks.onHoverLabel(null)
    }
    this.hooks.onSurfaceLeave()
  }

  private up = (e: PointerEvent) => {
    if (!this.ptrs.has(e.pointerId)) return
    this.ptrs.delete(e.pointerId)
    if (this.ptrs.size === 0) {
      const wasDrag = this.dragging
      this.dragging = false
      this.obs.userActive = false
      this.lastUserEnd = performance.now()
      const dt = performance.now() - this.downAt
      if (wasDrag && this.moved < 6 && dt < 450 && e.type === 'pointerup') {
        // a click / tap
        const hit = this.labels.hitTest(e.clientX, e.clientY)
        if (hit?.kind === 'label') this.hooks.onPickLabel(hit.id)
        else {
          const pick = this.obs.pickMoon(e.clientX, e.clientY)
          if (pick) this.hooks.onSurfaceClick(pick.lon, pick.lat)
        }
        this.vA = this.vE = 0
      }
      if (getState().reducedMotion) this.vA = this.vE = 0
    } else if (this.ptrs.size === 1) {
      // continue as a drag from the remaining pointer
      this.pinchStart = 0
    }
  }

  private wheel = (e: WheelEvent) => {
    const st = getState()
    if (st.phase !== 'live' || this.isUi(e.target) || st.indexOpen || st.readerOpen) return
    // free mode, or pinch-zoom (ctrl+wheel): zoom. Guided mode: let the page scroll.
    if (st.mode === 'free' || e.ctrlKey) {
      e.preventDefault()
      const f = Math.exp(e.deltaY * 0.0014 * (e.ctrlKey ? 2 : 1))
      this.zoomBy(f)
    }
  }

  private key = (e: KeyboardEvent) => {
    const st = getState()
    if (st.phase !== 'live' || st.indexOpen || st.readerOpen) return
    const t = e.target as HTMLElement
    if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return
    const step = 0.06 * Math.max(this.obs.rig.dist - 1, 0.4) * (e.shiftKey ? 3 : 1)
    const u = this.obs.rig.user
    let used = true
    switch (e.key) {
      case 'ArrowLeft':
        u.a += step
        break
      case 'ArrowRight':
        u.a -= step
        break
      case 'ArrowUp':
        u.e = Math.min(1.25, u.e - step)
        break
      case 'ArrowDown':
        u.e = Math.max(-1.25, u.e + step)
        break
      case '+':
      case '=':
        this.zoomBy(0.88)
        break
      case '-':
      case '_':
        this.zoomBy(1.14)
        break
      case '0':
        this.releaseUser(1.4)
        break
      default:
        used = false
    }
    if (used && (e.key.startsWith('Arrow'))) {
      this.obs.userActive = true
      window.setTimeout(() => (this.obs.userActive = false), 400)
      e.preventDefault()
    }
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    if (this.dragging) return
    if (Math.abs(this.vA) > 0.0004 || Math.abs(this.vE) > 0.0004) {
      const dt = 1 / 60
      const u = this.obs.rig.user
      u.a += this.vA * dt
      u.e = Math.max(-1.25, Math.min(1.25, u.e + this.vE * dt))
      const decay = Math.exp(-3.2 * dt)
      this.vA *= decay
      this.vE *= decay
    }
  }

  get idleFor() {
    return performance.now() - this.lastUserEnd
  }
}
