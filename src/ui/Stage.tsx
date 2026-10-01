import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { CHAPTERS } from '../chapters'
import type { Beat } from '../chapters/types'
import { Rich } from './controls'
import { engine } from '../app/engine'

interface Item {
  key: string
  beat: Beat
  state: 'enter' | 'in' | 'out'
}

function BeatView({ item, chapterNum }: { item: Item; chapterNum: string }) {
  const b = item.beat
  return (
    <article className={`beat ${item.state === 'in' ? 'in' : item.state === 'out' ? 'out' : ''}`} aria-hidden={item.state === 'out'} aria-label={b.title.replace(/\*/g, '')}>
      <div className="eyebrow reveal">{b.eyebrow ?? chapterNum}</div>
      <h2 className="title reveal">
        <Rich text={b.title} />
      </h2>
      <div className="reveal">
        {b.body.map((t, i) => (
          <p className="body" key={i}>
            <Rich text={t} />
          </p>
        ))}
      </div>
      {b.data && (
        <dl className="data reveal">
          {b.data.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {b.note && <p className="note reveal">{b.note}</p>}
    </article>
  )
}

export function Stage() {
  const { chapterIdx, beatIdx, phase, selected, indexOpen } = useStore()
  const ch = CHAPTERS[chapterIdx]
  const beat = ch.beats[beatIdx] ?? ch.beats[0]
  const key = `${ch.id}:${beat.id}`
  const [items, setItems] = useState<Item[]>([])
  const last = useRef('')

  useEffect(() => {
    if (key === last.current) return
    last.current = key
    setItems((prev) => [...prev.map((i) => ({ ...i, state: 'out' as const })), { key, beat, state: 'enter' }])
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, state: 'in' } : i)))))
    const t = window.setTimeout(() => setItems((prev) => prev.filter((i) => i.state !== 'out')), 1000)
    return () => {
      cancelAnimationFrame(r)
      clearTimeout(t)
    }
  }, [key, beat])

  const isHero = chapterIdx === 0 && beatIdx === 0
  const dim = !!selected && !!ch.dimTextOnSelect
  if (phase !== 'live') return null
  return (
    <>
      <div className={`hero ${isHero ? 'on' : ''}`} style={{ opacity: isHero && !indexOpen ? 1 : 0, transition: 'opacity 1.1s var(--ease)' }} aria-hidden={!isHero}>
        <h1 className="logo-mega" aria-label="SELENE">
          SELENE
        </h1>
        <p className="tag">An atlas of the Moon.</p>
        <div className="hint">
          <span className="hint-pill">
            <i /> Scroll to begin
          </span>
          <span className="hint-pill">Drag to turn the Moon</span>
        </div>
      </div>
      <div className={`stage ${dim ? 'dim' : ''}`} style={{ opacity: isHero ? 0 : dim ? 0.0 : 1, transition: 'opacity .8s var(--ease)' }} aria-live="polite" id="stage">
        {items.map((it) => (
          <BeatView key={it.key} item={it} chapterNum={ch.num} />
        ))}
        {!isHero && ch.beats.length > 1 && ch.beats.length <= 8 && (
          <div className="beat-dots" role="group" aria-label="Beats in this chapter" style={{ position: 'absolute', bottom: -6, left: 0 }}>
            {ch.beats.map((b, i) => (
              <button key={b.id} aria-current={i === beatIdx} aria-label={`Part ${i + 1}: ${b.title.replace(/\*/g, '')}`} onClick={() => engine.scroll?.goTo(chapterIdx, i)} />
            ))}
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {ch.num} {ch.title}. {beat.alt ?? ''}
      </p>
    </>
  )
}
