import type { ComponentType } from 'react'
import type { Vector3 } from 'three'
import type { Observatory, SceneParams } from '../engine/Observatory'
import type { CamTarget } from '../engine/Rig'
import type { LabelItem, NoteItem } from '../engine/Labels'
import type { UIState } from '../store'
import type { Landmark } from '../content/landmarks'

export interface Beat {
  id: string
  eyebrow?: string
  title: string
  /** paragraphs; *word* renders italic accent */
  body: string[]
  data?: [string, string][]
  note?: string
  /** concise textual alternative of what the 3D scene shows (screen readers + reader view) */
  alt?: string
  /** sound cue played when this beat arrives (default: a soft tick) */
  cue?: 'chime' | 'beat' | 'none'
}

export interface Layout {
  mobile: boolean
  portrait: boolean
  aspect: number
}

export interface SceneCtx {
  p: SceneParams
  obs: Observatory
  dt: number
  now: number
  beat: number
  nBeats: number
  /** progress through the chapter 0..1 */
  t: number
  /** progress through the current beat 0..1 */
  bt: number
  s: UIState
  free: boolean
  layout: Layout
  labels: LabelItem[]
  notes: NoteItem[]
  /** composition helpers */
  compose: (side: 'right' | 'left' | 'center' | 'top', amount?: number) => void
  /** camera distance adjusted for narrow viewports so the Moon fits */
  dist: (d: number) => number
  /** show landmark labels (rank filter) */
  landmarks: (ids: string[] | 'all', opts?: { maxRank?: 1 | 2 | 3; dim?: boolean; unlit?: boolean }) => void
  focus: (l: Landmark | { lon: number; lat: number; dist?: number }, dist?: number) => void
  /** camera standing on the Earth–Moon line, looking at the Moon as seen from Earth (north up) */
  earthView: (dist: number) => CamTarget
  /** world-anchored annotation */
  note: (id: string, world: Vector3, text: string, sub?: string, opts?: { dx?: number; dy?: number; tone?: 'earth' | 'sun' | 'moon' | 'neutral'; priority?: number; marker?: boolean }) => void
}

export interface Chapter {
  id: string
  num: string
  title: string
  /** short label for the rail */
  short: string
  kicker: string
  /** one-line description in the index */
  blurb: string
  glyph: string
  /** scroll length in viewport heights */
  heightVh: number
  beats: Beat[]
  /** drive scene parameters every frame */
  scene: (c: SceneCtx) => void
  /** interactive tools (React) */
  Tools?: ComponentType
  /** caption under the observer-view inset */
  insetLabel?: string
  /** render Tools without the standard panel wrapper (they position themselves) */
  bareTools?: boolean
  /** wide tools panel centered at the bottom */
  wideTools?: boolean
  /** text column sits at the left; `center` chapters use a centred scrim */
  scrim?: 'left' | 'center' | 'light'
  /** hide the text stage when a dossier is active (selection) */
  dimTextOnSelect?: boolean
  /** called when the chapter becomes active (reset selection etc.) */
  onEnter?: (s: UIState) => void
}
