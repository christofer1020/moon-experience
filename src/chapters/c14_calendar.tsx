import { useEffect, useRef } from 'react'
import type { Chapter } from './types'
import { useStore } from '../store'
import { Astronomy, quartersInRange, phaseName, skyAt } from '../astro/ephemeris'
import { Readout } from '../ui/controls'
import { IconNext, IconPrev } from '../ui/Icons'
import { fmtLat, fmtLon } from './helpers'

const DAY = 86400000
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/** Draw the Moon's phase from the Sun–Moon elongation (0 new … 180 full … 360 new). */
export function drawPhase(cv: HTMLCanvasElement, E: number, size: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  cv.width = size * dpr
  cv.height = size * dpr
  cv.style.width = `${size}px`
  cv.style.height = `${size}px`
  const ctx = cv.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, size, size)
  const r = size / 2 - 2
  const cx = size / 2
  const cy = size / 2
  const waxing = E <= 180
  const e = waxing ? E : 360 - E
  const k = Math.cos((e * Math.PI) / 180) // +1 new … -1 full
  // dark disc
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(236,231,219,0.07)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(236,231,219,0.28)'
  ctx.lineWidth = 0.8
  ctx.stroke()
  // lit part
  ctx.save()
  ctx.translate(cx, cy)
  if (!waxing) ctx.scale(-1, 1)
  ctx.beginPath()
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false) // right limb
  ctx.ellipse(0, 0, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k > 0 ? true : false)
  ctx.closePath()
  ctx.fillStyle = 'rgba(244,238,224,0.94)'
  ctx.fill()
  ctx.restore()
}

function Day({ date, selected, today, month, onPick, quarter }: { date: number; selected: boolean; today: boolean; month: boolean; onPick: () => void; quarter: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const E = Astronomy.MoonPhase(new Astronomy.AstroTime(new Date(date + 12 * 3600000)))
    drawPhase(ref.current, E, 30)
  }, [date])
  const d = new Date(date)
  return (
    <button className={`cal-day ${today ? 'today' : ''} ${month ? '' : 'out'}`} aria-current={selected ? 'date' : undefined} aria-label={d.toUTCString().slice(0, 16)} onClick={onPick}>
      <span className="d">{d.getUTCDate()}</span>
      {quarter && <i className="q" />}
      <canvas ref={ref} />
    </button>
  )
}

function CalendarTools() {
  const { tool, setTool } = useStore()
  const month = new Date(tool.calendarMonth)
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
  const dow = (first.getUTCDay() + 6) % 7
  const start = first.getTime() - dow * DAY
  const days = Array.from({ length: 42 }, (_, i) => start + i * DAY)
  const q = quartersInRange(new Date(start), 42)
  const qDays = new Set(q.map((e) => Math.floor(e.date.getTime() / DAY)))
  const sel = tool.calendarDate
  const selDay = Math.floor(sel / DAY)
  const sim = skyAt(new Date(Math.floor(sel / DAY) * DAY + 12 * 3600000))
  const todayDay = Math.floor(Date.now() / DAY)
  const upcoming = quartersInRange(new Date(sel), 32).slice(0, 3)
  const shift = (n: number) => {
    const d = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + n, 1))
    setTool({ calendarMonth: d.getTime() })
  }
  return (
    <div>
      <div className="cal-head">
        <div className="mo">
          {month.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </div>
        <div className="cal-nav">
          <button aria-label="Previous month" onClick={() => shift(-1)}>
            <IconPrev width={14} height={14} />
          </button>
          <button
            className="chip"
            onClick={() => {
              const t = Date.now()
              setTool({ calendarDate: t, calendarMonth: Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), 1) })
            }}
          >
            Today
          </button>
          <button aria-label="Next month" onClick={() => shift(1)}>
            <IconNext width={14} height={14} />
          </button>
        </div>
      </div>
      <div className="cal-grid" role="grid" aria-label="Lunar phase calendar (UTC)">
        {DOW.map((d) => (
          <div key={d} className="cal-dow" role="columnheader">
            {d}
          </div>
        ))}
        {days.map((t) => (
          <Day
            key={t}
            date={t}
            selected={Math.floor(t / DAY) === selDay}
            today={Math.floor(t / DAY) === todayDay}
            month={new Date(t).getUTCMonth() === month.getUTCMonth()}
            quarter={qDays.has(Math.floor(t / DAY))}
            onPick={() => setTool({ calendarDate: t + 12 * 3600000 })}
          />
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <Readout
          items={[
            { k: new Date(sel).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }), v: phaseName(sim.phaseDeg) },
            { k: 'Illuminated', v: `${(sim.illumination * 100).toFixed(0)}`, small: '%' },
            { k: 'Age', v: sim.ageDays.toFixed(1), small: 'days' },
          ]}
        />
        <p className="note" style={{ marginTop: 10 }}>
          {upcoming.map((e) => `${e.name} ${e.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`).join(' · ')}
          <br />
          Libration now: {fmtLon(sim.subEarth.lon, 1)}, {fmtLat(sim.subEarth.lat, 1)}. Dates and times are UTC; phases are computed, not looked up.
        </p>
      </div>
    </div>
  )
}

export const calendar: Chapter = {
  id: 'calendar',
  num: '14',
  title: 'Lunar Calendar',
  short: 'Calendar',
  kicker: 'Any date',
  blurb: 'Pick a night; see the Moon',
  glyph: 'calendar',
  heightVh: 300,
  scrim: 'left',
  Tools: CalendarTools,
  beats: [
    {
      id: 'calendar',
      eyebrow: '14 — Lunar Calendar',
      title: 'Choose a *night*.',
      body: [
        'Every glyph in the calendar is computed from the Moon’s position for that day. Pick a date and the Moon on the left is lit exactly as it would be, tilted by the real libration of that day.',
        'The small diamonds mark the four principal phases.',
      ],
      alt: 'A month calendar showing the Moon’s phase for each day; the selected date’s Moon is shown large.',
    },
    {
      id: 'practical',
      eyebrow: '14 — Lunar Calendar',
      title: 'A *practical* clock.',
      body: [
        'Observers have used phase as a clock for millennia. The Moon rises about 50 minutes later each day; the bright limb always points to the Sun. A thin crescent is a sunset object, a full Moon rises at sunset, a last quarter at midnight.',
      ],
      alt: 'The Moon in its current phase as seen from Earth.',
    },
  ],
  scene(c) {
    const { p, s } = c
    p.date = Math.floor(s.tool.calendarDate / DAY) * DAY + 12 * 3600000
    p.dateTau = 0.35
    p.starGain = 0.35
    p.cam = c.earthView(5.0)
    c.compose('right', 0.7)
    c.landmarks(['tycho', 'copernicus', 'aristarchus', 'plato', 'clavius'], { maxRank: 2 })
    c.labels.length = 0
  },
}
