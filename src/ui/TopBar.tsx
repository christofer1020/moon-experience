import { useStore } from '../store'
import { engine } from '../app/engine'
import { Mark } from './Logo'
import { IconExplore, IconGuided, IconIndex, IconRead, IconSettings, IconSoundOff, IconSoundOn } from './Icons'

export function TopBar() {
  const { phase, mode, soundOn, indexOpen, readerOpen, settingsOpen, loadValue, set } = useStore()
  const live = phase === 'live'
  return (
    <header className="topbar" data-ui>
      <a
        className="brand"
        href="#top"
        aria-label="SELENE — back to the start"
        onClick={(e) => {
          e.preventDefault()
          set({ indexOpen: false, readerOpen: false })
          engine.scroll?.goTo(0, 0)
        }}
      >
        <Mark progress={phase === 'loading' || phase === 'ready' ? loadValue : undefined} />
        <span className="word">SELENE</span>
      </a>
      <nav className="bar-actions" aria-label="Primary" style={{ opacity: live ? 1 : 0, pointerEvents: live ? 'auto' : 'none', transition: 'opacity 1.2s' }}>
        <button
          className="tbtn"
          aria-pressed={mode === 'free'}
          onClick={() => {
            set({ mode: mode === 'free' ? 'guided' : 'free' })
            engine.input?.releaseUser(1.2)
          }}
          title={mode === 'free' ? 'Return to the guided scroll story' : 'Free exploration: scroll locked, wheel zooms, drag turns the Moon'}
        >
          {mode === 'free' ? <IconGuided /> : <IconExplore />}
          <span className="l">{mode === 'free' ? 'Guided' : 'Explore'}</span>
          <i className="ul" />
        </button>
        <button className="tbtn" aria-pressed={readerOpen} onClick={() => set({ readerOpen: !readerOpen, indexOpen: false })} title="Text version of everything on this site">
          <IconRead />
          <span className="l">Read</span>
          <i className="ul" />
        </button>
        <button
          className="tbtn"
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Sound on — click to mute' : 'Sound off — click to enable'}
          onClick={() => {
            const on = !soundOn
            set({ soundOn: on })
            engine.sound?.setEnabled(on)
          }}
        >
          {soundOn ? <IconSoundOn /> : <IconSoundOff />}
          <span className="l">Sound {soundOn ? 'on' : 'off'}</span>
          <i className="ul" />
        </button>
        <button className="tbtn" aria-pressed={settingsOpen} aria-label="Settings" onClick={() => set({ settingsOpen: !settingsOpen })}>
          <IconSettings />
          <i className="ul" />
        </button>
        <button className="tbtn keep" aria-pressed={indexOpen} aria-expanded={indexOpen} aria-controls="lunar-index" onClick={() => set({ indexOpen: !indexOpen, readerOpen: false })}>
          <IconIndex />
          <span className="l">
            <span className="k">Index</span>
          </span>
          <i className="ul" />
        </button>
      </nav>
    </header>
  )
}
