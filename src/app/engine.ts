import type { Observatory } from '../engine/Observatory'
import type { LabelLayer } from '../engine/Labels'
import type { Input } from '../engine/Input'
import type { ScrollController } from './scroll'
import type { Sound } from '../audio/Sound'

/** Singleton handles shared between the React UI and the imperative engine. */
export const engine: {
  obs: Observatory | null
  labels: LabelLayer | null
  input: Input | null
  scroll: ScrollController | null
  sound: Sound | null
} = { obs: null, labels: null, input: null, scroll: null, sound: null }
