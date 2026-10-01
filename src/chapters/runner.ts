import { Vector3 } from 'three'
import type { Observatory, SceneParams } from '../engine/Observatory'
import type { LabelItem, LabelLayer, LabelKind } from '../engine/Labels'
import { getState, useStore } from '../store'
import { LANDMARKS, byId, type Landmark } from '../content/landmarks'
import { datePhase, framing, lerp, clamp, sstep } from './helpers'
import type { Chapter, Layout, SceneCtx } from './types'
import { lonLatToVec } from '../astro/ephemeris'

export const progress = { t: 0, bt: 0, introT: 0 }

const KIND: Record<Landmark['kind'], LabelKind> = {
  crater: 'crater',
  mare: 'mare',
  basin: 'basin',
  mountain: 'mountain',
  valley: 'valley',
  pole: 'pole',
}

export function layoutNow(): Layout {
  const w = window.innerWidth
  const h = window.innerHeight
  return { mobile: w <= 860, portrait: h > w, aspect: w / h }
}

function portraitK(L: Layout): number {
  if (!L.portrait && !L.mobile) return 1
  const vfov = 36 // radians below: we compute with the mobile fov
  const hf = Math.atan(Math.tan(((vfov * Math.PI) / 180) / 2) * Math.max(L.aspect, 0.3))
  const need = 1 / Math.sin(Math.min(0.82 * hf, 1.2)) // distance that fits the Moon in width
  return clamp((need - 1) / 2.4, 1, 3)
}

export function makeCtx(obs: Observatory, p: SceneParams, dt: number, chapter: Chapter, labelsOut: LabelItem[], notesOut: SceneCtx['notes']): SceneCtx {
  const s = getState()
  const L = layoutNow()
  const nBeats = chapter.beats.length
  const t = progress.t
  const beat = s.beatIdx
  const k = portraitK(L)
  const ctx: SceneCtx = {
    p,
    obs,
    dt,
    now: performance.now() / 1000,
    beat,
    nBeats,
    t,
    bt: progress.bt,
    s,
    free: s.mode === 'free',
    layout: L,
    labels: labelsOut,
    notes: notesOut,
    compose(side, amount = 1) {
      if (L.mobile || L.portrait) {
        p.shift = [0, side === 'center' ? 0.1 * amount : side === 'top' ? 0.3 * amount : 0.2 * amount]
      } else {
        p.shift = [side === 'right' ? 0.22 * amount : side === 'left' ? -0.22 * amount : 0, side === 'top' ? 0.1 * amount : 0]
      }
      if (L.mobile || L.portrait) p.fov = Math.max(p.fov, 36)
    },
    dist(d) {
      return 1 + (d - 1) * k
    },
    landmarks(ids, opts = {}) {
      const rd = obs.rig.dist
      const auto: 1 | 2 | 3 = rd > 2.9 ? 1 : rd > 1.95 ? 2 : 3
      const maxRank = opts.maxRank ?? auto
      const list = ids === 'all' ? LANDMARKS : ids.map((id) => byId.get(id)!).filter(Boolean)
      const sel = s.selected?.kind === 'landmark' ? s.selected.id : null
      const hov = s.hover?.kind === 'landmark' ? s.hover.id : null
      for (const l of list) {
        if (l.rank > maxRank && l.id !== sel && l.id !== hov) continue
        labelsOut.push({
          id: l.id,
          text: l.name,
          sub: l.diameterKm ? `${l.diameterKm >= 100 ? Math.round(l.diameterKm).toLocaleString('en-US') : l.diameterKm.toFixed(0)} km` : undefined,
          lon: l.lon,
          lat: l.lat,
          priority: (4 - l.rank) * 10 + Math.min(9, Math.log10(l.diameterKm + 1) * 3),
          kind: KIND[l.kind],
          active: l.id === sel,
          hover: l.id === hov,
          marker: l.kind === 'crater' ? 'ring' : 'dot',
          dim: opts.dim,
        })
      }
    },
    earthView(d) {
      return { kind: 'earthview', dist: ctx.dist(d) }
    },
    note(id, world, text, sub, opts = {}) {
      notesOut.push({ id, world, text, sub, priority: opts.priority ?? 5, dx: opts.dx, dy: opts.dy, tone: opts.tone, marker: opts.marker })
    },
    focus(target, d) {
      const lon = target.lon
      const lat = target.lat
      const dd = d ?? ('diameterKm' in target ? framing(target as Landmark) : (target as { dist?: number }).dist ?? 2)
      p.cam = { kind: 'surface', lon, lat, dist: ctx.dist(dd) }
    },
  }
  return ctx
}

/* ---------------------------------------------------------------------------------------------
   Loading crescent + cinematic intro
   ------------------------------------------------------------------------------------------- */
export function loadingScene(p: SceneParams, loadValue: number, L: Layout) {
  const k = portraitK(L)
  p.cam = { kind: 'surface', lon: -4, lat: 6, dist: 1 + (9.6 - 1) * k }
  p.fov = L.mobile ? 36 : 28
  p.shift = L.mobile || L.portrait ? [0, 0.18] : [0.28, 0]
  p.starGain = 0.22
  p.date = datePhase(7 + 34 * Math.pow(loadValue, 0.8))
  p.dateTau = 0.9
  p.exposure = 1.25
  p.sunInt = 1.7
  p.bloom = 0.7
  p.vignette = 0.7
  p.shadows = true
}

export function introScene(p: SceneParams, T: number, L: Layout) {
  const k = portraitK(L)
  const e = T * T * (3 - 2 * T)
  p.cam = { kind: 'surface', lon: lerp(-4, -10, e), lat: lerp(6, 12, e), dist: 1 + (lerp(9.6, 5.5, e) - 1) * k }
  p.fov = L.mobile ? 36 : lerp(28, 30, e)
  p.shift = L.mobile || L.portrait ? [0, lerp(0.18, 0.22, e)] : [0.28, 0]
  p.starGain = lerp(0.22, 0.5, e)
  p.date = datePhase(lerp(41, 106, sstep(0, 1, T)))
  p.dateTau = 0.5
  p.exposure = lerp(1.25, 1.0, e)
  p.bloom = 0.6
  p.vignette = 0.6
}

/* ---------------------------------------------------------------------------------------------
   driver
   ------------------------------------------------------------------------------------------- */
export function createDriver(obs: Observatory, labels: LabelLayer, chapters: Chapter[]) {
  const labelItems: LabelItem[] = []
  const notes: SceneCtx['notes'] = []
  const scratch = { v: new Vector3() }
  void scratch
  obs.driver = (p, dt) => {
    const s = getState()
    const L = layoutNow()
    labelItems.length = 0
    notes.length = 0
    if (s.phase === 'loading' || s.phase === 'ready') {
      loadingScene(p, s.loadValue, L)
      labels.items = []
      labels.notes = []
      return
    }
    if (s.phase === 'intro') {
      introScene(p, progress.introT, L)
      labels.items = []
      labels.notes = []
      return
    }
    const idx = s.indexOpen && s.indexPreview !== null ? s.indexPreview : s.chapterIdx
    const ch = chapters[idx]
    const ctx = makeCtx(obs, p, dt, ch, labelItems, notes)
    if (s.indexOpen && s.indexPreview !== null) {
      // preview: first beat of the hovered chapter, composed left so it reads through the overlay
      ctx.beat = 0
      ctx.t = 0.0
      ctx.bt = 0
    }
    ch.scene(ctx)
    // UI toggles that apply everywhere
    if (s.tool.grid) p.grid = Math.max(p.grid, 1)
    if (s.tool.topo) p.topo = Math.max(p.topo, 1)
    labels.items = s.tool.labels ? labelItems.slice() : labelItems.filter((l) => l.active || l.hover)
    labels.notes = notes.slice()
    // surface ring for the selection or hover
    void useStore
    void lonLatToVec
  }
}
