import type { SVGProps } from 'react'

/** Custom, hairline icon set: 1.3px strokes on an 24px grid, square caps, no fills. */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'square' as const,
  strokeLinejoin: 'miter' as const,
  'aria-hidden': true,
}

export const IconIndex = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M4 12h10M4 17h16" />
    <path d="M18 12h2" />
  </svg>
)
export const IconRead = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3" />
  </svg>
)
export const IconSoundOn = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 10v4h3.5L12 18V6L7.5 10zM15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.4 7.4 0 0 1 0 10.4" />
  </svg>
)
export const IconSoundOff = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 10v4h3.5L12 18V6L7.5 10zM16 9.5l5 5M21 9.5l-5 5" />
  </svg>
)
export const IconExplore = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="7.5" />
    <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
  </svg>
)
export const IconGuided = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M12 3v18M8 17l4 4 4-4" />
    <path d="M7 3h10" />
  </svg>
)
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconMinus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M5 12h14" />
  </svg>
)
export const IconReset = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M5 12a7 7 0 1 0 2.2-5.1M5 4v4h4" />
  </svg>
)
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M5 5l14 14M19 5L5 19" />
  </svg>
)
export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M8 5l11 7-11 7z" />
  </svg>
)
export const IconPause = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M8 5v14M16 5v14" />
  </svg>
)
export const IconPrev = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)
export const IconNext = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M9 5l7 7-7 7" />
  </svg>
)
export const IconArrow = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 12h15M14 7l5 5-5 5" />
  </svg>
)
export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
    <circle cx="15" cy="8" r="2" />
    <circle cx="9" cy="16" r="2" />
  </svg>
)
export const IconImpact = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 4l8 8" />
    <circle cx="14" cy="14" r="5" />
    <path d="M14 3v3M21 14h-3M18.5 6.5l-2 2" />
  </svg>
)
export const IconPulse = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M3 12h4l2-6 4 12 2-6h6" />
  </svg>
)

/** per-chapter glyphs, drawn on a 32px grid (used in the Lunar Index) */
export function Glyph({ id, ...p }: { id: string } & SVGProps<SVGSVGElement>) {
  const s = { viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: 1, 'aria-hidden': true as const, ...p }
  switch (id) {
    case 'moon':
      return (
        <svg {...s}>
          <circle cx="16" cy="16" r="11" />
          <path d="M16 5a11 11 0 0 1 0 22" />
        </svg>
      )
    case 'surface':
      return (
        <svg {...s}>
          <circle cx="16" cy="16" r="11" />
          <path d="M5 16h22M16 5v22" strokeOpacity=".5" />
          <circle cx="16" cy="16" r="3" />
        </svg>
      )
    case 'maria':
      return (
        <svg {...s}>
          <circle cx="16" cy="16" r="11" />
          <path d="M10 12c3-3 7-1 9 1s2 6-1 8-7 1-8-2 0-5 0-7z" strokeOpacity=".8" />
        </svg>
      )
    case 'craters':
      return (
        <svg {...s}>
          <circle cx="16" cy="16" r="11" strokeOpacity=".4" />
          <circle cx="13" cy="14" r="5" />
          <circle cx="21" cy="21" r="2.5" />
          <path d="M13 14l.01 0" />
        </svg>
      )
    case 'day':
      return (
        <svg {...s}>
          <circle cx="16" cy="16" r="11" strokeOpacity=".4" />
          <path d="M16 5v22" />
          <path d="M16 5a11 11 0 0 1 0 22" strokeDasharray="1.5 2.5" />
          <path d="M3 16h2M27 16h2" />
        </svg>
      )
    case 'sides':
      return (
        <svg {...s}>
          <circle cx="11" cy="16" r="8" />
          <circle cx="25" cy="16" r="3" strokeOpacity=".7" />
          <path d="M11 8v16" strokeDasharray="1.5 2.5" strokeOpacity=".6" />
        </svg>
      )
    case 'phases':
      return (
        <svg {...s}>
          <circle cx="16" cy="16" r="11" />
          <path d="M16 5c-6 3-6 19 0 22" />
          <path d="M16 5c3 3 3 19 0 22" strokeOpacity=".4" />
        </svg>
      )
    case 'eclipses':
      return (
        <svg {...s}>
          <circle cx="12" cy="16" r="9" />
          <circle cx="21" cy="16" r="9" strokeOpacity=".6" />
        </svg>
      )
    case 'orbit':
      return (
        <svg {...s}>
          <ellipse cx="16" cy="16" rx="13" ry="7" transform="rotate(-18 16 16)" />
          <circle cx="16" cy="16" r="2.2" />
          <circle cx="27" cy="12" r="1.4" />
        </svg>
      )
    case 'earthmoon':
      return (
        <svg {...s}>
          <circle cx="10" cy="16" r="7" />
          <circle cx="26" cy="16" r="2.2" />
          <path d="M17 16h6" strokeDasharray="1 2" />
        </svg>
      )
    case 'exploration':
      return (
        <svg {...s}>
          <circle cx="16" cy="16" r="11" strokeOpacity=".4" />
          <path d="M7 24c4-1 8-5 10-12M17 12l-2.5 1.5M17 12l.5 3" />
        </svg>
      )
    case 'apollo':
      return (
        <svg {...s}>
          <circle cx="16" cy="16" r="11" strokeOpacity=".4" />
          <path d="M16 9v14M9 16h14" />
          <circle cx="16" cy="16" r="2" />
        </svg>
      )
    case 'poles':
      return (
        <svg {...s}>
          <circle cx="16" cy="16" r="11" />
          <path d="M16 5v22" strokeOpacity=".5" />
          <ellipse cx="16" cy="9" rx="5.5" ry="2" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...s}>
          <rect x="5" y="7" width="22" height="19" />
          <path d="M5 12h22M11 4v5M21 4v5" />
          <circle cx="16" cy="19" r="3" />
        </svg>
      )
    case 'facts':
      return (
        <svg {...s}>
          <path d="M6 8h20M6 14h20M6 20h12M6 26h8" />
        </svg>
      )
    default:
      return <svg {...s} />
  }
}
