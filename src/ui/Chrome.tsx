import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { CHAPTERS } from '../chapters'
import { engine } from '../app/engine'
import { IconMinus, IconPlus, IconReset, IconNext, IconPrev } from './Icons'

/** Right-hand chapter rail: hairline ticks, the current chapter's name expands. */
export function Rail() {
  const { chapterIdx, phase, indexOpen } = useStore()
  if (phase !== 'live') return null
  return (
    <nav className="rail" aria-label="Chapters" data-ui style={{ opacity: indexOpen ? 0 : 1, transition: 'opacity .6s', pointerEvents: indexOpen ? 'none' : 'auto' }}>
      {CHAPTERS.map((c, i) => (
        <button key={c.id} aria-current={i === chapterIdx} aria-label={`${c.num} ${c.title}`} onClick={() => engine.scroll?.goTo(i, 0)}>
          <span className="lbl">
            {c.num} · {c.title}
          </span>
          <span className="tick" />
        </button>
      ))}
    </nav>
  )
}

function fmtDate(ms: number) {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
}

/** Live instrument readouts, written straight to the DOM (no React churn). */
export function Hud() {
  const phase = useStore((s) => s.phase)
  const chapterIdx = useStore((s) => s.chapterIdx)
  const refs = {
    alt: useRef<HTMLElement>(null),
    lon: useRef<HTMLElement>(null),
    lat: useRef<HTMLElement>(null),
    sun: useRef<HTMLElement>(null),
    date: useRef<HTMLElement>(null),
    fps: useRef<HTMLElement>(null),
  }
  useEffect(() => {
    const obs = engine.obs
    if (!obs || phase !== 'live') return
    let acc = 0
    const f = (dt: number) => {
      acc += dt
      if (acc < 0.2) return
      acc = 0
      const h = obs.hud
      if (refs.alt.current) refs.alt.current.textContent = h.altKm > 9999 ? `${Math.round(h.altKm / 1000).toLocaleString('en-US')} Mm` : `${Math.round(h.altKm).toLocaleString('en-US')} km`
      if (refs.lon.current) refs.lon.current.textContent = `${Math.abs(h.lon).toFixed(1)}°${h.lon >= 0 ? 'E' : 'W'}`
      if (refs.lat.current) refs.lat.current.textContent = `${Math.abs(h.lat).toFixed(1)}°${h.lat >= 0 ? 'N' : 'S'}`
      if (refs.sun.current) refs.sun.current.textContent = `${h.sunElev.toFixed(0)}°`
      if (refs.date.current) refs.date.current.textContent = fmtDate(obs.simDateMs)
      if (refs.fps.current) refs.fps.current.textContent = new URLSearchParams(location.search).has('fps') ? `${Math.round(h.fps)} fps · ×${h.scale}` : ''
    }
    obs.frameListeners.add(f)
    return () => {
      obs.frameListeners.delete(f)
    }
  }, [phase])
  if (phase !== 'live') return null
  return (
    <div className="hud" aria-hidden="true">
      <span style={{ color: 'var(--amber)' }}>
        {CHAPTERS[chapterIdx].num} · {CHAPTERS[chapterIdx].title}
      </span>
      <span>
        Alt<b ref={refs.alt}>—</b>
      </span>
      <span className="opt">
        Lon<b ref={refs.lon}>—</b>
      </span>
      <span className="opt">
        Lat<b ref={refs.lat}>—</b>
      </span>
      <span className="opt">
        Sun el.<b ref={refs.sun}>—</b>
      </span>
      <span className="opt">
        Time<b ref={refs.date}>—</b>
      </span>
      <b ref={refs.fps} style={{ color: 'var(--faint)' }} />
    </div>
  )
}

export function ZoomControl() {
  const { phase, mode, set } = useStore()
  if (phase !== 'live') return null
  return (
    <div className="zoomctl" data-ui role="group" aria-label="Camera">
      {mode === 'free' && (
        <>
          <button aria-label="Previous part" onClick={() => engine.scroll?.step(-1)}>
            <IconPrev />
          </button>
          <button aria-label="Next part" onClick={() => engine.scroll?.step(1)}>
            <IconNext />
          </button>
        </>
      )}
      <button aria-label="Zoom out (−)" onClick={() => engine.input?.zoomBy(1.2)}>
        <IconMinus />
      </button>
      <button aria-label="Zoom in (+)" onClick={() => engine.input?.zoomBy(0.83)}>
        <IconPlus />
      </button>
      <button
        aria-label="Reset view (0)"
        onClick={() => {
          engine.input?.releaseUser(1.2)
          set({ zoomLevel: 1 })
        }}
      >
        <IconReset />
      </button>
    </div>
  )
}

/** Renders the active chapter's interactive tools. On phones they sit in a collapsible bottom sheet. */
export function ToolsPanel() {
  const { chapterIdx, phase, selected, indexOpen } = useStore()
  const ch = CHAPTERS[chapterIdx]
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const f = () => setMobile(window.innerWidth <= 860)
    f()
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  useEffect(() => {
    setOpen(!!selected)
  }, [selected, chapterIdx])
  if (phase !== 'live' || !ch.Tools || indexOpen) return null
  const Tools = ch.Tools
  const wide = ch.wideTools
  if (ch.bareTools) return <Tools />
  if (mobile) {
    return (
      <div className={`tools ${wide ? 'wide' : ''}`} data-ui style={{ bottom: open ? 'calc(46px + var(--safe-b))' : 'calc(46px + var(--safe-b))' }}>
        <button className="btn" style={{ marginBottom: open ? 10 : 0 }} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Hide tools ▾' : 'Tools ▴'}
        </button>
        {open && (
          <div style={{ background: 'linear-gradient(rgba(5,6,8,.9), rgba(5,6,8,.96))', padding: '12px 0 4px', borderTop: '1px solid var(--hair-2)' }}>
            <Tools />
          </div>
        )}
      </div>
    )
  }
  return (
    <div className={`tools ${wide ? 'wide' : ''}`} data-ui>
      <Tools />
    </div>
  )
}

/** Caption for the observer-view inset rendered inside the 3D scene. */
export function InsetCaption() {
  const { chapterIdx, phase } = useStore()
  const ref = useRef<HTMLDivElement>(null)
  const label = CHAPTERS[chapterIdx].insetLabel
  useEffect(() => {
    const obs = engine.obs
    if (!obs || phase !== 'live') return
    const f = () => {
      const el = ref.current
      if (!el) return
      const ip = obs.p.inset
      if (!ip || !label) {
        el.style.opacity = '0'
        return
      }
      const H = obs.height
      const W = obs.width
      el.style.opacity = '1'
      el.style.left = `${ip.x * W}px`
      el.style.top = `${(1 - ip.y) * H + ip.r * H + 18}px`
    }
    obs.frameListeners.add(f)
    return () => {
      obs.frameListeners.delete(f)
    }
  }, [phase, label])
  if (!label) return null
  return (
    <div className="inset-cap" ref={ref} aria-hidden="true" style={{ opacity: 0 }}>
      {label}
      <br />
      <span style={{ color: 'var(--mute)' }}>ecliptic north up</span>
    </div>
  )
}
