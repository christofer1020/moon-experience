import { useCallback, useRef, useState, type ReactNode } from 'react'

export interface Notch {
  at: number
  label?: string
  major?: boolean
}

export function Slider({
  value,
  min = 0,
  max = 1,
  step,
  onChange,
  onStart,
  onEnd,
  notches,
  label,
  valueText,
  className,
}: {
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
  onStart?: () => void
  onEnd?: () => void
  notches?: Notch[]
  label: string
  valueText?: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState(false)
  const frac = (value - min) / (max - min)

  const setFromX = useCallback(
    (clientX: number) => {
      const r = ref.current!.getBoundingClientRect()
      let f = (clientX - r.left) / r.width
      f = Math.max(0, Math.min(1, f))
      let v = min + f * (max - min)
      if (step) v = Math.round(v / step) * step
      onChange(v)
    },
    [min, max, step, onChange],
  )

  return (
    <div
      ref={ref}
      className={`slider ${drag ? 'drag' : ''} ${className ?? ''}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Number(value.toFixed(3))}
      aria-valuetext={valueText}
      onPointerDown={(e) => {
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        e.currentTarget.setPointerCapture(e.pointerId)
        setDrag(true)
        onStart?.()
        setFromX(e.clientX)
      }}
      onPointerMove={(e) => {
        if (drag) setFromX(e.clientX)
      }}
      onPointerUp={() => {
        setDrag(false)
        onEnd?.()
      }}
      onPointerCancel={() => {
        setDrag(false)
        onEnd?.()
      }}
      onKeyDown={(e) => {
        const d = (step ?? (max - min) / 100) * (e.shiftKey ? 5 : 1)
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          onChange(Math.min(max, value + d))
          e.preventDefault()
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          onChange(Math.max(min, value - d))
          e.preventDefault()
        } else if (e.key === 'Home') onChange(min)
        else if (e.key === 'End') onChange(max)
      }}
    >
      <div className="track" />
      <div className="fill" style={{ width: `${frac * 100}%` }} />
      {notches?.map((n, i) => (
        <span key={i}>
          <span className={`notch ${n.major ? 'major' : ''}`} style={{ left: `${((n.at - min) / (max - min)) * 100}%` }} />
          {n.label && (
            <span className="nlabel" style={{ left: `${((n.at - min) / (max - min)) * 100}%` }}>
              {n.label}
            </span>
          )}
        </span>
      ))}
      <div className="handle" style={{ left: `${frac * 100}%` }} />
    </div>
  )
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ pressed, onClick, children, title }: { pressed: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button className="chip" aria-pressed={pressed} onClick={onClick} title={title}>
      {children}
    </button>
  )
}

export function Dossier({ kicker, title, children, onClose }: { kicker: string; title: string; children: ReactNode; onClose?: () => void }) {
  return (
    <section className="dossier" aria-live="polite">
      <h3>
        <small>{kicker}</small>
        {title}
      </h3>
      {children}
      {onClose && (
        <button className="chip" style={{ alignSelf: 'flex-start' }} onClick={onClose}>
          Close ✕
        </button>
      )}
    </section>
  )
}

export function Readout({ items }: { items: { k: string; v: ReactNode; small?: string }[] }) {
  return (
    <div className="readout">
      {items.map((it, i) => (
        <div key={i}>
          <div className="k">{it.k}</div>
          <div className="v">
            {it.v}
            {it.small && <small>{it.small}</small>}
          </div>
        </div>
      ))}
    </div>
  )
}

/** minimal inline markup: *word* → <em> */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g)
  return (
    <>
      {parts.map((p, i) => (p.startsWith('*') && p.endsWith('*') ? <em key={i}>{p.slice(1, -1)}</em> : <span key={i}>{p}</span>))}
    </>
  )
}
