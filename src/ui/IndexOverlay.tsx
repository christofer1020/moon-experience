import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { CHAPTERS } from '../chapters'
import { engine } from '../app/engine'
import { Glyph } from './Icons'

const TIME: Record<string, string> = {
  moon: '2 min', surface: '3 min', maria: '3 min', craters: '4 min', day: '2 min', sides: '2 min', phases: '3 min', eclipses: '4 min',
  orbit: '2 min', earthmoon: '2 min', exploration: '4 min', apollo: '4 min', poles: '3 min', calendar: '2 min', facts: '2 min',
}

/**
 * LUNAR INDEX — the navigation is the Moon. Hovering or focusing a chapter makes the Moon behind the overlay
 * re-orient and relight itself for that chapter, so you preview before you go.
 */
export function IndexOverlay() {
  const { indexOpen, indexPreview, chapterIdx, mode, set, phase } = useStore()
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (indexOpen) {
      const t = window.setTimeout(() => first.current?.focus(), 350)
      return () => clearTimeout(t)
    }
    set({ indexPreview: null })
  }, [indexOpen])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useStore.getState().indexOpen) set({ indexOpen: false })
      if ((e.key === 'i' || e.key === 'I') && !(e.target as HTMLElement)?.closest?.('input,textarea') && useStore.getState().phase === 'live') {
        set({ indexOpen: !useStore.getState().indexOpen, readerOpen: false })
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  if (phase !== 'live' && phase !== 'intro') return null
  const pv = CHAPTERS[indexPreview ?? chapterIdx]
  return (
    <div className={`index ${indexOpen ? 'open' : ''}`} id="lunar-index" role="dialog" aria-modal="true" aria-label="Lunar Index" aria-hidden={!indexOpen} data-ui>
      <div className="index-inner">
        <div>
          <h2>Lunar Index</h2>
          <ul className="index-list">
            {CHAPTERS.map((c, i) => (
              <li key={c.id}>
                <button
                  ref={i === 0 ? first : undefined}
                  aria-current={i === chapterIdx}
                  tabIndex={indexOpen ? 0 : -1}
                  onMouseEnter={() => set({ indexPreview: i })}
                  onFocus={() => set({ indexPreview: i })}
                  onClick={() => {
                    set({ indexOpen: false })
                    engine.scroll?.goTo(i, 0)
                    engine.input?.releaseUser(1)
                  }}
                >
                  <span className="n">{c.num}</span>
                  <span className="t">{c.title}</span>
                  <span className="m">{TIME[c.id] ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="index-side">
          <div className="prev" aria-live="polite">
            <div className="eyebrow">
              <Glyph id={pv.glyph} width={26} height={26} style={{ marginRight: 4 }} /> {pv.num} — {pv.kicker}
            </div>
            <p>{pv.blurb}.</p>
            <small>{pv.beats[0].body[0]}</small>
          </div>
          <div className="index-modes">
            <div className="seg" role="group" aria-label="Mode">
              <button aria-pressed={mode === 'guided'} tabIndex={indexOpen ? 0 : -1} onClick={() => set({ mode: 'guided' })}>
                Guided
              </button>
              <button aria-pressed={mode === 'free'} tabIndex={indexOpen ? 0 : -1} onClick={() => set({ mode: 'free' })}>
                Free exploration
              </button>
            </div>
            <span className="cap" style={{ alignSelf: 'center' }}>
              Press I to open / Esc to close
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
