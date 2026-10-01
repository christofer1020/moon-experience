import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CHAPTERS } from '../chapters'
import { progress } from '../chapters/runner'
import { getState, useStore } from '../store'

gsap.registerPlugin(ScrollTrigger)

/**
 * Scroll controller.
 * One smooth-scrolled page whose length is the sum of the chapters. The page never shows the content itself:
 * it only provides the timeline. Position → (chapter, beat, progress), written to the store and `progress`.
 * In FREE mode the page is locked and chapter/beat are driven directly.
 */
export class ScrollController {
  lenis: Lenis
  private offsets: number[] = []
  private heights: number[] = []
  private total = 1
  private vh = 1
  private tickFn: (t: number) => void
  private ignoreScroll = false
  private freeProgress = { t: 0 }

  constructor() {
    this.lenis = new Lenis({
      lerp: 0.12,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.1,
      smoothWheel: true,
      syncTouch: false,
      autoRaf: false,
    })
    this.lenis.on('scroll', () => ScrollTrigger.update())
    this.tickFn = (t) => this.lenis.raf(t * 1000)
    gsap.ticker.add(this.tickFn)
    gsap.ticker.lagSmoothing(0)
    window.addEventListener('resize', this.measure)
    this.measure()
    this.lenis.stop()
    // frame hook
    gsap.ticker.add(this.update)
    useStore.subscribe((s, prev) => {
      if (s.mode !== prev.mode) this.onMode()
      if (s.indexOpen !== prev.indexOpen) this.updateLock()
      if (s.readerOpen !== prev.readerOpen) this.updateLock()
      if (s.phase !== prev.phase) this.updateLock()
    })
  }

  private updateLock() {
    const s = getState()
    const locked = s.phase !== 'live' || s.indexOpen || s.readerOpen || s.mode === 'free'
    if (locked) this.lenis.stop()
    else this.lenis.start()
  }

  measure = () => {
    this.vh = window.innerHeight
    this.offsets = []
    this.heights = []
    let y = 0
    for (const c of CHAPTERS) {
      this.offsets.push(y)
      const h = (c.heightVh / 100) * this.vh
      this.heights.push(h)
      y += h
    }
    this.total = y + this.vh
    const el = document.getElementById('scroll-space')
    if (el) el.style.height = `${this.total}px`
    // section anchors
    CHAPTERS.forEach((c, i) => {
      const sec = document.getElementById(`ch-${c.id}`)
      if (sec) sec.style.height = `${this.heights[i]}px`
    })
  }

  /** scroll position of the start of a chapter (+ fraction) */
  /** chapter entry hook; with reduced motion, nothing starts playing by itself */
  private enter(ch: (typeof CHAPTERS)[number]) {
    ch.onEnter?.(getState())
    if (getState().reducedMotion) getState().setTool({ dayPlay: false, orbitPlay: false, eclipsePlay: false, playing: false })
  }

  positionOf(chapterIdx: number, frac = 0): number {
    const i = Math.max(0, Math.min(CHAPTERS.length - 1, chapterIdx))
    const span = Math.max(1, this.heights[i] - this.vh)
    return this.offsets[i] + span * frac
  }

  /** jump to a chapter (guided mode scrolls; free mode just switches) */
  goTo(chapterIdx: number, beat = 0, opts: { immediate?: boolean } = {}) {
    const s = getState()
    const ch = CHAPTERS[chapterIdx]
    if (!ch) return
    const n = ch.beats.length
    const frac = (beat + 0.5) / n
    if (s.mode === 'free') {
      useStore.getState().set({ chapterIdx, beatIdx: beat, selected: null })
      if (chapterIdx !== s.chapterIdx) this.enter(ch)
      gsap.to(this.freeProgress, { t: frac, duration: 0.8, ease: 'power2.out', onUpdate: () => (progress.t = this.freeProgress.t) })
      return
    }
    const y = this.positionOf(chapterIdx, beat === 0 ? 0.001 : (beat + 0.3) / n)
    this.ignoreScroll = false
    this.lenis.scrollTo(y, { duration: opts.immediate ? 0 : 2.6, easing: (t: number) => 1 - Math.pow(1 - t, 4), immediate: opts.immediate, lock: false })
  }

  /** step through beats (free mode keyboard / buttons) */
  step(dir: 1 | -1) {
    const s = getState()
    let ci = s.chapterIdx
    let bi = s.beatIdx + dir
    if (bi >= CHAPTERS[ci].beats.length) {
      if (ci < CHAPTERS.length - 1) {
        ci++
        bi = 0
      } else bi = CHAPTERS[ci].beats.length - 1
    } else if (bi < 0) {
      if (ci > 0) {
        ci--
        bi = CHAPTERS[ci].beats.length - 1
      } else bi = 0
    }
    this.goTo(ci, bi)
  }

  private onMode() {
    const s = getState()
    this.updateLock()
    if (s.mode === 'free') {
      this.freeProgress.t = progress.t
    } else {
      // return to guided: scroll to current position
      const y = this.positionOf(s.chapterIdx, (s.beatIdx + 0.5) / CHAPTERS[s.chapterIdx].beats.length)
      this.lenis.scrollTo(y, { immediate: true })
    }
  }

  private update = () => {
    const s = getState()
    if (s.phase !== 'live') return
    if (s.mode === 'free') {
      const ch = CHAPTERS[s.chapterIdx]
      const n = ch.beats.length
      progress.t = this.freeProgress.t
      const b = Math.min(n - 1, Math.floor(progress.t * n))
      progress.bt = progress.t * n - b
      if (b !== s.beatIdx) useStore.getState().set({ beatIdx: b })
      return
    }
    const y = this.lenis.scroll
    let ci = 0
    for (let i = 0; i < this.offsets.length; i++) if (y >= this.offsets[i] - 1) ci = i
    const span = Math.max(1, this.heights[ci] - this.vh)
    const t = Math.max(0, Math.min(1, (y - this.offsets[ci]) / span))
    const n = CHAPTERS[ci].beats.length
    // beats are equal slices of the chapter; a little hysteresis keeps text from flickering
    const raw = t * n
    let b = Math.min(n - 1, Math.floor(raw))
    if (ci === s.chapterIdx && b !== s.beatIdx && Math.abs(raw - (s.beatIdx + 0.5)) < 0.54) b = s.beatIdx
    progress.t = t
    progress.bt = raw - b
    if (ci !== s.chapterIdx || b !== s.beatIdx) {
      useStore.getState().set({ chapterIdx: ci, beatIdx: b, selected: ci !== s.chapterIdx ? null : s.selected })
      if (ci !== s.chapterIdx) this.enter(CHAPTERS[ci])
    }
  }

  dispose() {
    gsap.ticker.remove(this.tickFn)
    gsap.ticker.remove(this.update)
    window.removeEventListener('resize', this.measure)
    this.lenis.destroy()
  }
}
