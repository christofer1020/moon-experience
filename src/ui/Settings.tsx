import { useStore } from '../store'
import { engine } from '../app/engine'

export function Settings() {
  const { settingsOpen, reducedMotion, soundOn, tool, setTool, set, phase } = useStore()
  const q = new URLSearchParams(location.search).get('q') ?? 'auto'
  const setQ = (v: string) => {
    const u = new URL(location.href)
    if (v === 'auto') u.searchParams.delete('q')
    else u.searchParams.set('q', v)
    location.href = u.toString()
  }
  if (phase !== 'live') return null
  return (
    <div className={`settings ${settingsOpen ? 'open' : ''}`} role="region" aria-label="Settings" data-ui>
      <label>
        <span>Reduce motion</span>
        <button aria-pressed={reducedMotion} onClick={() => set({ reducedMotion: !reducedMotion })} aria-label="Reduce motion">
          <span className="toggle" />
        </button>
      </label>
      <label>
        <span>Sound</span>
        <button
          aria-pressed={soundOn}
          aria-label="Sound"
          onClick={() => {
            set({ soundOn: !soundOn })
            engine.sound?.setEnabled(!soundOn)
          }}
        >
          <span className="toggle" />
        </button>
      </label>
      <label>
        <span>Surface labels</span>
        <button aria-pressed={tool.labels} onClick={() => setTool({ labels: !tool.labels })} aria-label="Surface labels">
          <span className="toggle" />
        </button>
      </label>
      <label>
        <span>Graticule</span>
        <button aria-pressed={tool.grid} onClick={() => setTool({ grid: !tool.grid })} aria-label="Graticule">
          <span className="toggle" />
        </button>
      </label>
      <div>
        <div className="cap" style={{ marginBottom: 8 }}>
          Graphics quality · detected {engine.obs?.quality.tier}
        </div>
        <div className="seg" role="group" aria-label="Quality">
          {['auto', 'low', 'medium', 'high'].map((v) => (
            <button key={v} aria-pressed={q === v} onClick={() => setQ(v)}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <p className="note" style={{ paddingBottom: 14 }}>
        Keyboard: arrows turn the Moon · + / − zoom · 0 resets · I opens the index · Esc closes panels.
      </p>
    </div>
  )
}
