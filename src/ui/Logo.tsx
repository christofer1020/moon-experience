import type { CSSProperties } from 'react'

/**
 * SELENE mark: a dial of 30 ticks (one lunar day ≈ 29.5 Earth days) with one long lit tick — the Sun.
 * Used as the logo and, with `progress`, as the loading indicator.
 */
export function Mark({ progress, size = 30, className, style }: { progress?: number; size?: number; className?: string; style?: CSSProperties }) {
  const N = 30
  const ticks = []
  const lit = progress === undefined ? 1 : progress
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2
    const sun = i === 0
    const r0 = sun ? 8.2 : 11.2
    const r1 = 14.2
    const on = progress === undefined ? true : i / N <= lit
    ticks.push(
      <line
        key={i}
        x1={16 + Math.cos(a) * r0}
        y1={16 + Math.sin(a) * r0}
        x2={16 + Math.cos(a) * r1}
        y2={16 + Math.sin(a) * r1}
        stroke={sun ? '#e7c48e' : '#ece7db'}
        strokeWidth={sun ? 1.4 : 0.9}
        strokeOpacity={on ? (sun ? 1 : 0.75) : 0.16}
        style={{ transition: 'stroke-opacity .5s' }}
      />,
    )
  }
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {ticks}
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="brand">
      <Mark />
      <span className="word">SELENE</span>
    </span>
  )
}
