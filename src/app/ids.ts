import type { Selection } from '../store'

/** Label ids carry their kind: `mare:imbrium`, `mission:apollo-11`, plain landmark ids otherwise. */
export function labelId(kind: Selection['kind'], id: string): string {
  return kind === 'landmark' ? id : `${kind}:${id}`
}

export function parseLabelId(id: string): Selection {
  const i = id.indexOf(':')
  if (i < 0) return { kind: 'landmark', id }
  const kind = id.slice(0, i) as Selection['kind']
  return { kind, id: id.slice(i + 1) }
}
