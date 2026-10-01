import type { ReactNode } from 'react'
import { useStore, type Selection } from '../store'
import { Dossier } from '../ui/controls'
import { IconNext, IconPrev } from '../ui/Icons'

export interface FeatureItem {
  id: string
  name: string
  meta?: string
}

export function select(sel: Selection | null) {
  useStore.getState().set({ selected: sel })
}

/** A list of features. Selecting one turns the Moon to it and opens its dossier. */
export function FeatureTool({
  title,
  count,
  kind,
  items,
  dossier,
  extra,
}: {
  title: string
  count?: string
  kind: Selection['kind']
  items: FeatureItem[]
  dossier: (id: string) => { kicker: string; title: string; body: ReactNode } | null
  extra?: ReactNode
}) {
  const selected = useStore((s) => s.selected)
  const active = selected && selected.kind === kind && items.some((i) => i.id === selected.id) ? selected.id : null
  const idx = items.findIndex((i) => i.id === active)
  const d = active ? dossier(active) : null

  if (active && d) {
    return (
      <div>
        <div className="tools-title">
          <span>{title}</span>
          <span>
            <button className="chip" aria-label="Previous" onClick={() => select({ kind, id: items[(idx + items.length - 1) % items.length].id })}>
              <IconPrev width={12} height={12} style={{ verticalAlign: '-2px' }} />
            </button>
            <b>
              {' '}
              {idx + 1} / {items.length}{' '}
            </b>
            <button className="chip" aria-label="Next" onClick={() => select({ kind, id: items[(idx + 1) % items.length].id })}>
              <IconNext width={12} height={12} style={{ verticalAlign: '-2px' }} />
            </button>
          </span>
        </div>
        <Dossier kicker={d.kicker} title={d.title} onClose={() => select(null)}>
          {d.body}
        </Dossier>
        {extra}
      </div>
    )
  }
  return (
    <div>
      <div className="tools-title">
        <span>{title}</span>
        <b>{count ?? `${items.length}`}</b>
      </div>
      <div className="list" role="list">
        {items.map((it) => (
          <button key={it.id} role="listitem" onClick={() => select({ kind, id: it.id })} aria-current={false}>
            <span>{it.name}</span>
            {it.meta && <span className="m">{it.meta}</span>}
          </button>
        ))}
      </div>
      {extra}
    </div>
  )
}

export function FactList({ facts }: { facts?: [string, string][] }) {
  if (!facts?.length) return null
  return (
    <dl className="data" style={{ maxWidth: 'none' }}>
      {facts.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}
