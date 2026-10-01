import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { CHAPTERS } from '../chapters'
import { LANDMARKS } from '../content/landmarks'
import { MARIA } from '../content/maria'
import { APOLLO, ROBOTIC, TIMELINE } from '../content/missions'
import { FACT_GROUPS, SOURCES } from '../content/facts'
import { fmtCoord } from '../chapters/helpers'
import { Rich } from './controls'
import { IconClose } from './Icons'

/**
 * The Lunar Reader — everything on the site as one linear, accessible document.
 * The scientific content never depends on 3D interaction.
 */
export function Reader() {
  const open = useStore((s) => s.readerOpen)
  const set = useStore((s) => s.set)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) {
      ref.current?.scrollTo({ top: 0 })
      const t = window.setTimeout(() => ref.current?.querySelector<HTMLElement>('button')?.focus(), 200)
      const k = (e: KeyboardEvent) => e.key === 'Escape' && set({ readerOpen: false })
      window.addEventListener('keydown', k)
      return () => {
        clearTimeout(t)
        window.removeEventListener('keydown', k)
      }
    }
  }, [open])
  return (
    <div className={`reader ${open ? 'open' : ''}`} ref={ref} role="dialog" aria-modal="true" aria-label="Text version" aria-hidden={!open} data-ui>
      <div className="reader-bar">
        <span className="mono" style={{ color: 'var(--amber)' }}>
          Lunar Reader — text version
        </span>
        <button className="tbtn" onClick={() => set({ readerOpen: false })} tabIndex={open ? 0 : -1}>
          <IconClose /> <span className="l">Close</span>
        </button>
      </div>
      {open && (
        <div className="reader-inner">
          <h1>SELENE — an atlas of the Moon</h1>
          <p>
            An interactive lunar observatory built on NASA’s Lunar Reconnaissance Orbiter data and real astronomical ephemerides. This page contains all of its content as plain text.
          </p>
          {CHAPTERS.map((c) => (
            <section key={c.id} aria-labelledby={`r-${c.id}`}>
              <h2 id={`r-${c.id}`}>
                {c.num} · {c.title}
              </h2>
              <p className="cap">{c.kicker}</p>
              {c.beats.map((b) => (
                <div key={b.id}>
                  <h3>
                    <Rich text={b.title} />
                  </h3>
                  {b.body.map((t, i) => (
                    <p key={i}>
                      <Rich text={t} />
                    </p>
                  ))}
                  {b.data && (
                    <table>
                      <tbody>
                        {b.data.map(([k, v]) => (
                          <tr key={k}>
                            <th scope="row">{k}</th>
                            <td>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {b.alt && <p className="src">On screen: {b.alt}</p>}
                  {b.note && <p className="src">{b.note}</p>}
                </div>
              ))}
            </section>
          ))}

          <h2>Landmarks</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Position</th>
                <th>Diameter</th>
              </tr>
            </thead>
            <tbody>
              {LANDMARKS.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.name}</strong>
                    <br />
                    <span className="src">{l.summary}</span>
                  </td>
                  <td>{l.kind}</td>
                  <td>{fmtCoord(l.lon, l.lat)}</td>
                  <td>{l.diameterKm ? `${Math.round(l.diameterKm).toLocaleString('en-US')} km` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Maria</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Meaning</th>
                <th>Diameter</th>
              </tr>
            </thead>
            <tbody>
              {MARIA.map((m) => (
                <tr key={m.key}>
                  <td>
                    <strong>{m.name}</strong>
                    <br />
                    <span className="src">{m.note}</span>
                  </td>
                  <td>{m.meaning}</td>
                  <td>{Math.round(m.diameterKm).toLocaleString('en-US')} km</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Landing sites</h2>
          <table>
            <thead>
              <tr>
                <th>Mission</th>
                <th>Date</th>
                <th>Site</th>
                <th>Position</th>
              </tr>
            </thead>
            <tbody>
              {[...APOLLO, ...ROBOTIC].map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.name}</strong> <span className="src">({m.agency})</span>
                    <br />
                    <span className="src">{m.summary}</span>
                  </td>
                  <td>{m.dateLabel}</td>
                  <td>{m.site}</td>
                  <td>
                    {m.approx ? '≈ ' : ''}
                    {fmtCoord(m.lon, m.lat)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Exploration timeline</h2>
          <ul>
            {TIMELINE.map((e) => (
              <li key={e.id}>
                <strong>{e.year} — {e.title}.</strong> {e.body}
              </li>
            ))}
          </ul>

          <h2>Fact sheet</h2>
          {FACT_GROUPS.map((g) => (
            <div key={g.title}>
              <h3>{g.title}</h3>
              <table>
                <tbody>
                  {g.facts.map((f) => (
                    <tr key={f.label}>
                      <th scope="row">{f.label}</th>
                      <td>
                        {f.value} {f.unit} {f.note && <span className="src">· {f.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <h2>Sources &amp; credits</h2>
          <p>
            Imagery and elevation are public-domain NASA data (LRO Camera and Lunar Orbiter Laser Altimeter teams; visualisation by Ernie Wright, NASA SVS). “This visualisation is optimised for aesthetics, not science”: scientific work should use the source data. Educational simplifications are labelled where they occur.
          </p>
          <ul>
            {SOURCES.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.name}
                </a>{' '}
                <span className="src">— {s.use}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
