import { create } from 'zustand'

export type Phase = 'loading' | 'ready' | 'intro' | 'live'
export type Mode = 'guided' | 'free'

export interface Selection {
  kind: 'landmark' | 'mare' | 'mission' | 'event'
  id: string
}

export interface ToolState {
  /** phases: fraction of lunation 0..1 chosen by the user / beats (0 = new) */
  lunation: number
  /** days offset when playing */
  playing: boolean
  /** eclipse tool */
  eclipseKind: 'lunar' | 'solar'
  eclipseIndex: number
  eclipseT: number // -1..1 across the event window
  eclipsePlay: boolean
  /** orbit / scale tool */
  scale: 'true' | 'edu'
  /** calendar */
  calendarDate: number // epoch ms
  calendarMonth: number // epoch ms of the first of the displayed month
  /** lunar day: local solar hour 0..1 */
  dayT: number
  dayPlay: boolean
  /** overlays */
  grid: boolean
  topo: boolean
  maria: boolean
  labels: boolean
  /** polar */
  pole: 'south' | 'north'
  /** near/far: orbital position 0..1, show non-rotating moon comparison */
  orbitT: number
  noRotation: boolean
  orbitPlay: boolean
  /** impact replay counter */
  impactNonce: number
  /** light pulse */
  pulseNonce: number
}

export interface UIState {
  phase: Phase
  loadValue: number
  loadStage: string
  firstPaint: boolean
  chapterIdx: number
  beatIdx: number
  /** progress within the chapter 0..1 */
  t: number
  mode: Mode
  indexOpen: boolean
  /** phones: the tools bottom sheet is open (the story text steps aside) */
  toolsSheet: boolean
  indexPreview: number | null
  readerOpen: boolean
  settingsOpen: boolean
  soundOn: boolean
  soundReady: boolean
  reducedMotion: boolean
  selected: Selection | null
  hover: Selection | null
  zoomLevel: number
  tool: ToolState
  /** hide chrome (cinematic) */
  quiet: boolean
  set: (p: Partial<UIState>) => void
  setTool: (p: Partial<ToolState>) => void
}

const monthStart = (d = new Date()) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)

export const useStore = create<UIState>((set) => ({
  phase: 'loading',
  loadValue: 0,
  loadStage: 'initialising',
  firstPaint: false,
  chapterIdx: 0,
  beatIdx: 0,
  t: 0,
  mode: 'guided',
  indexOpen: false,
  toolsSheet: false,
  indexPreview: null,
  readerOpen: false,
  settingsOpen: false,
  soundOn: false,
  soundReady: false,
  reducedMotion: typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  selected: null,
  hover: null,
  zoomLevel: 1,
  quiet: false,
  tool: {
    lunation: 0.25,
    playing: false,
    eclipseKind: 'lunar',
    eclipseIndex: 0,
    eclipseT: 0,
    eclipsePlay: false,
    scale: 'edu',
    calendarDate: Date.now(),
    calendarMonth: monthStart(),
    dayT: 0.1,
    dayPlay: false,
    grid: false,
    topo: false,
    maria: false,
    labels: true,
    pole: 'south',
    orbitT: 0,
    noRotation: false,
    orbitPlay: true,
    impactNonce: 0,
    pulseNonce: 0,
  },
  set: (p) => set(p),
  setTool: (p) => set((s) => ({ tool: { ...s.tool, ...p } })),
}))

export const getState = () => useStore.getState()
