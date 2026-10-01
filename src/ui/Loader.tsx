import { useEffect, useState } from 'react'
import gsap from 'gsap'
import { useStore } from '../store'
import { engine } from '../app/engine'
import { progress } from '../chapters/runner'
import { chapterIndex } from '../chapters'

/**
 * Loading is the opening: the loader is transparent over the live canvas. A thin crescent grows as data arrives,
 * and the percentage rides on the dial. Only when ready do we offer entry (a user gesture, which also lets audio start).
 */
export function Loader() {
  const { phase, loadValue, loadStage, firstPaint, set, reducedMotion } = useStore()
  const [shown, setShown] = useState(0)
  useEffect(() => {
    // ease the displayed percentage
    const id = requestAnimationFrame(function tick() {
      setShown((v) => {
        const target = useStore.getState().loadValue
        return v + (target - v) * 0.12 > target - 0.001 ? target : v + (target - v) * 0.12
      })
      raf = requestAnimationFrame(tick)
    })
    let raf = id
    return () => cancelAnimationFrame(raf)
  }, [])
  const ready = phase === 'ready'
  const gone = phase === 'intro' || phase === 'live'

  const enter = (withSound: boolean) => {
    set({ soundOn: withSound })
    engine.sound?.init()
    engine.sound?.setEnabled(withSound)
    set({ phase: 'intro' })
    progress.introT = 0
    const dur = reducedMotion ? 0.8 : 7.2
    gsap.to(progress, {
      introT: 1,
      duration: dur,
      ease: 'power2.inOut',
      onComplete: () => {
        set({ phase: 'live' })
        const h = decodeURIComponent(location.hash.replace('#', ''))
        if (h) {
          const i = chapterIndex(h)
          if (i > 0) engine.scroll?.goTo(i, 0, { immediate: true })
        }
      },
    })
    engine.sound?.cue('enter')
  }

  const pct = Math.round(shown * 100)
  return (
    <div className={`loader ${gone ? 'gone' : ''} ${ready ? 'ready' : ''} ${firstPaint ? '' : 'solid'}`} role="status" aria-live="polite">
      <div className="loader-core">
        <div className="pct" aria-hidden={ready}>
          {pct}
          <small>%</small>
        </div>
        <div className="stage-line">{ready ? '' : `Loading ${loadStage}`}</div>
        <div className="enter">
          <button className="btn solid" onClick={() => enter(true)} disabled={!ready}>
            Enter · with sound
          </button>
          <button className="btn" onClick={() => enter(false)} disabled={!ready}>
            Enter silently
          </button>
        </div>
        {ready && (
          <p className="cap" style={{ maxWidth: 46 + 'ch' }}>
            Sound is optional and never autoplays. Everything you hear is part of the website, not of space — there is no sound in a vacuum.
          </p>
        )}
      </div>
    </div>
  )
}
