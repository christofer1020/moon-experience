import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { Observatory } from './engine/Observatory'
import { LabelLayer } from './engine/Labels'
import { Input } from './engine/Input'
import { ScrollController } from './app/scroll'
import { engine } from './app/engine'
import { CHAPTERS } from './chapters'
import { createDriver } from './chapters/runner'
import { getState, useStore } from './store'
import { parseLabelId } from './app/ids'
import { MARIA } from './content/maria'
import { Sound } from './audio/Sound'
import { TopBar } from './ui/TopBar'
import { Stage } from './ui/Stage'
import { Hud, InsetCaption, Rail, ToolsPanel, ZoomControl } from './ui/Chrome'
import { IndexOverlay } from './ui/IndexOverlay'
import { Loader } from './ui/Loader'
import { Reader } from './ui/Reader'
import { Settings } from './ui/Settings'

export default function App() {
  const glRef = useRef<HTMLCanvasElement>(null)
  const lblRef = useRef<HTMLCanvasElement>(null)
  const chapterIdx = useStore((s) => s.chapterIdx)
  const phase = useStore((s) => s.phase)
  const ch = CHAPTERS[chapterIdx]

  useEffect(() => {
    const canvas = glRef.current!
    const obs = new Observatory(canvas)
    const labels = new LabelLayer(lblRef.current!, obs)
    const scroll = new ScrollController()
    const sound = new Sound()
    engine.obs = obs
    engine.labels = labels
    engine.scroll = scroll
    engine.sound = sound
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) (window as unknown as Record<string, unknown>).__selene = { obs, labels, scroll, store: useStore, engine }

    const input = new Input(
      obs,
      labels,
      {
        onPickLabel: (id) => {
          const sel = parseLabelId(id)
          useStore.getState().set({ selected: sel })
        },
        onHoverLabel: (id) => {
          useStore.getState().set({ hover: id ? parseLabelId(id) : null })
          if (id) sound.cue('tick', 0.5)
        },
        onSurfaceClick: (lon, lat) => {
          const st = getState()
          if (CHAPTERS[st.chapterIdx].id === 'maria') {
            const id = obs.moon.mareAt(lon, lat)
            const m = MARIA.find((x) => x.id === id)
            if (m) {
              useStore.getState().set({ selected: { kind: 'mare', id: m.key } })
            }
          }
        },
        onSurfaceHover: (lon, lat) => {
          const st = getState()
          if (CHAPTERS[st.chapterIdx].id === 'maria' && !st.hover?.id?.startsWith?.('')) return
          if (CHAPTERS[st.chapterIdx].id === 'maria') {
            const id = obs.moon.mareAt(lon, lat)
            const m = MARIA.find((x) => x.id === id)
            const cur = st.hover
            if (m && !(cur?.kind === 'mare' && cur.id === m.key)) useStore.getState().set({ hover: { kind: 'mare', id: m.key } })
            else if (!m && cur?.kind === 'mare') useStore.getState().set({ hover: null })
          }
        },
        onSurfaceLeave: () => {
          const h = getState().hover
          if (h?.kind === 'mare') useStore.getState().set({ hover: null })
        },
        onInteract: () => {},
      },
      canvas,
    )
    engine.input = input
    createDriver(obs, labels, CHAPTERS)
    obs.frameListeners.add((dt) => labels.draw(dt))
    const onResize = () => labels.resize()
    window.addEventListener('resize', onResize)

    // release the user's manual rotation when the story moves on
    const unsub = useStore.subscribe((s, p) => {
      if (s.chapterIdx !== p.chapterIdx || s.beatIdx !== p.beatIdx || s.selected !== p.selected) input.releaseUser(2.0, s.selected !== p.selected && s.chapterIdx === p.chapterIdx)
      if (s.chapterIdx !== p.chapterIdx) {
        sound.setChapter(s.chapterIdx)
        sound.cue('whoosh')
        try {
          history.replaceState(null, '', `#${CHAPTERS[s.chapterIdx].id}`)
        } catch {
          /* sandboxed frames may refuse history changes */
        }
      } else if (s.beatIdx !== p.beatIdx && s.phase === 'live') {
        const c = CHAPTERS[s.chapterIdx].beats[s.beatIdx]?.cue ?? 'beat'
        if (c !== 'none') sound.cue(c)
      }
      if (s.selected && s.selected !== p.selected) sound.cue('select')
      if (s.indexOpen !== p.indexOpen) sound.cue(s.indexOpen ? 'open' : 'close')
    })
    // audio follows motion and distance (and meters its own output for the interface)
    obs.frameListeners.add((dt, o) => {
      const v = Math.abs(scroll.lenis.velocity || 0) / 38
      sound.update(dt, { speed: Math.min(1, Math.max(v, o.userActive ? 0.35 : 0)), dist: o.camera.position.distanceTo(o.moonPosWorld) })
    })

    obs
      .init((p) => {
        useStore.getState().set({ loadValue: p.value, loadStage: p.stage, firstPaint: p.ready || getState().firstPaint })
      })
      .then(() => {
        useStore.getState().set({ loadValue: 1, loadStage: 'ready', firstPaint: true, phase: 'ready' })
      })
      .catch((e) => {
        console.error(e)
        useStore.getState().set({ phase: 'ready', loadStage: 'ready (some assets failed)', loadValue: 1, firstPaint: true })
      })
    obs.start()
    labels.resize()
    return () => {
      unsub()
      window.removeEventListener('resize', onResize)
      input.dispose()
      scroll.dispose()
      obs.dispose()
      gsap.ticker.lagSmoothing(500)
    }
  }, [])

  const scrim = ch.scrim ?? 'left'
  return (
    <>
      <a className="skip" href="#stage" onClick={(e) => { e.preventDefault(); useStore.getState().set({ readerOpen: true }) }}>
        Open the text version
      </a>
      <canvas ref={glRef} className="gl" tabIndex={0} role="img" aria-label="Interactive 3D model of the Moon. Drag or use the arrow keys to rotate, plus and minus to zoom." />
      <canvas ref={lblRef} className="labels" aria-hidden="true" />
      <div className={`scrim ${scrim} ${(ch.Tools && !ch.bareTools && !ch.wideTools) || ch.id === 'facts' ? 'rt' : ''}`} />
      <main className="scroller" id="top" aria-hidden={phase !== 'live'}>
        <div id="scroll-space" />
        <div style={{ position: 'absolute', inset: 0 }}>
          {CHAPTERS.map((c) => (
            <section key={c.id} id={`ch-${c.id}`} aria-label={c.title} />
          ))}
        </div>
      </main>
      <TopBar />
      <Stage />
      <Rail />
      <ToolsPanel />
      <Hud />
      <InsetCaption />
      <ZoomControl />
      <Settings />
      <IndexOverlay />
      <Reader />
      <Loader />
    </>
  )
}
