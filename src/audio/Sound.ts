/**
 * Sound — the site's own instrument.
 *
 * There is no sound in space. Everything here is part of the website, and all of it is synthesised live with the
 * Web Audio API (no audio files, no samples): a slow drone/pad whose harmony drifts with the chapter, a reverb tail
 * generated at start-up, sparse bell tones, and short interface cues. It never autoplays — the AudioContext is only
 * created inside a user gesture, and the toggle in the top bar is always available.
 */
export type Cue = 'enter' | 'tick' | 'select' | 'whoosh' | 'open' | 'close' | 'impact' | 'chime' | 'beat'

export interface SoundState {
  /** 0..1 how fast the story / camera is currently moving */
  speed: number
  /** camera distance from the Moon's centre, in Moon radii */
  dist: number
}

interface Mood {
  /** MIDI notes for the four pad voices (lowest first) */
  notes: [number, number, number, number]
  /** filter brightness multiplier */
  bright: number
  /** reverb send multiplier */
  wet: number
}

/** harmonic map of the story: each chapter has its own chord and colour; changes glide rather than jump */
const MOODS: Mood[] = [
  { notes: [38, 45, 52, 57], bright: 1.0, wet: 1.0 }, // 01 moon        D A E A
  { notes: [36, 43, 50, 55], bright: 0.9, wet: 0.9 }, // 02 surface     C G D G
  { notes: [34, 41, 48, 53], bright: 0.75, wet: 1.0 }, // 03 maria       Bb F C F
  { notes: [38, 45, 53, 57], bright: 1.05, wet: 0.9 }, // 04 craters     D A F A
  { notes: [43, 50, 57, 62], bright: 1.3, wet: 0.9 }, // 05 day         G D A D
  { notes: [36, 43, 51, 55], bright: 0.85, wet: 1.0 }, // 06 sides       C G Eb G
  { notes: [40, 47, 52, 59], bright: 1.0, wet: 1.0 }, // 07 phases      E B E B
  { notes: [33, 40, 47, 52], bright: 0.6, wet: 1.3 }, // 08 eclipses    A E B E
  { notes: [38, 45, 50, 57], bright: 1.0, wet: 1.1 }, // 09 orbit       D A D A
  { notes: [41, 48, 55, 60], bright: 1.1, wet: 1.2 }, // 10 earth-moon  F C G C
  { notes: [43, 50, 55, 59], bright: 1.2, wet: 1.0 }, // 11 exploration G D G B
  { notes: [43, 50, 57, 62], bright: 1.15, wet: 0.8 }, // 12 apollo      G D A D
  { notes: [31, 38, 45, 50], bright: 0.7, wet: 1.5 }, // 13 poles       G D A D (low, cold)
  { notes: [40, 47, 54, 59], bright: 1.0, wet: 1.0 }, // 14 calendar    E B F# B
  { notes: [38, 45, 52, 57], bright: 1.0, wet: 1.0 }, // 15 facts
]

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
/** interface cues sit slightly above the ambient bed */
const CUE = 2.2

export class Sound {
  enabled = false
  /** smoothed output level 0..1 (also mirrored to the --audio CSS variable) */
  level = 0

  private ctx: AudioContext | null = null
  private master!: GainNode
  private bus!: GainNode
  private revSend!: GainNode
  private padFilter!: BiquadFilterNode
  private padGain!: GainNode
  private airGain!: GainNode
  private airFilter!: BiquadFilterNode
  private subGain!: GainNode
  private analyser!: AnalyserNode
  private meter!: Uint8Array<ArrayBuffer>
  private voices: { a: OscillatorNode; b: OscillatorNode; g: GainNode }[] = []
  private sub!: OscillatorNode
  private noise!: AudioBuffer
  private chapter = 0
  private mood: Mood = MOODS[0]
  private time = 0
  private nextSpark = 4
  private frame = 0
  private speed = 0
  private failed = false

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return
      if (document.hidden) void this.ctx.suspend()
      else if (this.enabled) void this.ctx.resume()
    })
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  init() {
    if (this.ctx || this.failed) return
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) {
        this.failed = true
        return
      }
      this.ctx = new AC({ latencyHint: 'playback' })
      this.build(this.ctx)
    } catch (e) {
      console.warn('audio unavailable', e)
      this.failed = true
      this.ctx = null
    }
  }

  private build(ctx: AudioContext) {
    // ---- output chain: bus (+ reverb) → master → compressor → analyser → speakers
    this.master = ctx.createGain()
    this.master.gain.value = 0
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -20
    comp.knee.value = 18
    comp.ratio.value = 3
    comp.attack.value = 0.02
    comp.release.value = 0.4
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 512
    this.meter = new Uint8Array(new ArrayBuffer(this.analyser.fftSize))
    this.master.connect(comp)
    comp.connect(this.analyser)
    comp.connect(ctx.destination)

    this.bus = ctx.createGain()
    this.bus.gain.value = 0.9
    this.bus.connect(this.master)

    const reverb = ctx.createConvolver()
    reverb.buffer = this.makeImpulse(ctx, 3.6, 2.6)
    this.revSend = ctx.createGain()
    this.revSend.gain.value = 0.55
    const revOut = ctx.createGain()
    revOut.gain.value = 0.9
    this.revSend.connect(reverb)
    reverb.connect(revOut)
    revOut.connect(this.master)

    // ---- pad: four voices, each a detuned saw + triangle, through one slowly breathing low-pass
    this.padFilter = ctx.createBiquadFilter()
    this.padFilter.type = 'lowpass'
    this.padFilter.frequency.value = 620
    this.padFilter.Q.value = 0.5
    this.padGain = ctx.createGain()
    this.padGain.gain.value = 0.11
    this.padFilter.connect(this.padGain)
    this.padGain.connect(this.bus)
    this.padGain.connect(this.revSend)
    const levels = [0.2, 0.16, 0.12, 0.08]
    for (let i = 0; i < 4; i++) {
      const g = ctx.createGain()
      g.gain.value = levels[i]
      const a = ctx.createOscillator()
      const b = ctx.createOscillator()
      a.type = 'sawtooth'
      b.type = 'triangle'
      a.detune.value = -7 + i * 2
      b.detune.value = 6 - i * 3
      const f = mtof(this.mood.notes[i])
      a.frequency.value = f
      b.frequency.value = f
      a.connect(g)
      b.connect(g)
      g.connect(this.padFilter)
      a.start()
      b.start()
      this.voices.push({ a, b, g })
    }
    // sub sine with a slow tremolo
    this.sub = ctx.createOscillator()
    this.sub.type = 'sine'
    this.sub.frequency.value = mtof(this.mood.notes[0] - 12)
    this.subGain = ctx.createGain()
    this.subGain.gain.value = 0.03
    this.sub.connect(this.subGain)
    this.subGain.connect(this.bus)
    this.sub.start()
    const trem = ctx.createOscillator()
    trem.frequency.value = 0.07
    const tremDepth = ctx.createGain()
    tremDepth.gain.value = 0.006
    trem.connect(tremDepth)
    tremDepth.connect(this.subGain.gain)
    trem.start()
    // breathing filter
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.045
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = 180
    lfo.connect(lfoDepth)
    lfoDepth.connect(this.padFilter.frequency)
    lfo.start()
    const lfo2 = ctx.createOscillator()
    lfo2.frequency.value = 0.031
    const lfo2Depth = ctx.createGain()
    lfo2Depth.gain.value = 0.02
    lfo2.connect(lfo2Depth)
    lfo2Depth.connect(this.padGain.gain)
    lfo2.start()

    // ---- air: filtered noise that rises with motion
    this.noise = this.makeNoise(ctx, 2.5)
    const air = ctx.createBufferSource()
    air.buffer = this.noise
    air.loop = true
    this.airFilter = ctx.createBiquadFilter()
    this.airFilter.type = 'bandpass'
    this.airFilter.frequency.value = 1100
    this.airFilter.Q.value = 0.45
    this.airGain = ctx.createGain()
    this.airGain.gain.value = 0
    air.connect(this.airFilter)
    this.airFilter.connect(this.airGain)
    this.airGain.connect(this.bus)
    this.airGain.connect(this.revSend)
    air.start()

    this.applyMood(0.01)
  }

  private makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const n = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buf.getChannelData(0)
    // pink-ish noise (Paul Kellet's filter)
    let b0 = 0
    let b1 = 0
    let b2 = 0
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99765 * b0 + w * 0.099046
      b1 = 0.963 * b1 + w * 0.2965164
      b2 = 0.57 * b2 + w * 1.0526913
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.1
    }
    return buf
  }

  /** a synthetic hall: decaying noise whose highs fade faster than its lows */
  private makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const n = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, n, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      let lp = 0
      for (let i = 0; i < n; i++) {
        const t = i / n
        const env = Math.pow(1 - t, decay) * (i < 90 ? i / 90 : 1)
        const k = 0.92 - 0.8 * t
        lp += ((Math.random() * 2 - 1) - lp) * (1 - k)
        d[i] = lp * env * 1.6
      }
    }
    return buf
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (on) {
      this.init()
      const ctx = this.ctx
      if (!ctx) return
      void ctx.resume()
      const now = ctx.currentTime
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setValueAtTime(this.master.gain.value, now)
      this.master.gain.linearRampToValueAtTime(0.85, now + 3.2)
    } else if (this.ctx) {
      const ctx = this.ctx
      const now = ctx.currentTime
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setValueAtTime(this.master.gain.value, now)
      this.master.gain.linearRampToValueAtTime(0, now + 0.6)
      window.setTimeout(() => {
        if (!this.enabled && this.ctx) void this.ctx.suspend()
      }, 750)
    }
  }

  setChapter(i: number) {
    this.chapter = i
    this.mood = MOODS[clamp(i, 0, MOODS.length - 1)]
    if (this.ctx) this.applyMood(1.7)
  }

  private applyMood(tc: number) {
    const ctx = this.ctx
    if (!ctx) return
    const now = ctx.currentTime
    for (let i = 0; i < 4; i++) {
      const f = mtof(this.mood.notes[i])
      this.voices[i].a.frequency.setTargetAtTime(f, now, tc)
      this.voices[i].b.frequency.setTargetAtTime(f, now, tc)
    }
    this.sub.frequency.setTargetAtTime(mtof(this.mood.notes[0] - 12), now, tc)
    this.revSend.gain.setTargetAtTime(0.55 * this.mood.wet, now, 1.5)
  }

  /** per-frame: drives the filter/air from motion & distance, schedules sparse bells, meters the output */
  update(dt: number, st: SoundState) {
    this.time += dt
    this.frame++
    const ctx = this.ctx
    this.speed += (st.speed - this.speed) * Math.min(1, dt * 4)
    if (!ctx || ctx.state !== 'running' || !this.enabled) {
      if (this.level > 0.001) {
        this.level *= 0.9
        this.publish()
      }
      return
    }
    if (this.frame % 3 === 0) {
      const now = ctx.currentTime
      const close = 1 - clamp(Math.log(Math.max(st.dist, 1.05)) / Math.log(40), 0, 1) // 1 near, 0 far
      const cutoff = (480 + 900 * close + 1500 * this.speed) * this.mood.bright
      this.padFilter.frequency.setTargetAtTime(cutoff, now, 0.35)
      this.airGain.gain.setTargetAtTime(0.004 + 0.05 * this.speed * this.speed, now, 0.25)
      this.airFilter.frequency.setTargetAtTime(700 + 2600 * this.speed, now, 0.25)
      // meter
      this.analyser.getByteTimeDomainData(this.meter)
      let s = 0
      for (let i = 0; i < this.meter.length; i++) {
        const v = (this.meter[i] - 128) / 128
        s += v * v
      }
      const rms = Math.sqrt(s / this.meter.length)
      this.level += (clamp(rms * 20, 0, 1) - this.level) * 0.2
      this.publish()
    }
    // sparse bells in the current key; a little more often while things move
    this.nextSpark -= dt * (1 + this.speed * 2.5)
    if (this.nextSpark <= 0) {
      this.nextSpark = 5 + Math.random() * 8
      this.bell(this.pick(5, 6), 0.026 + Math.random() * 0.02, Math.random() * 2 - 1, 4)
    }
  }

  /** a random pitch from the current chord (plus its added 9th), in the given octave range — always consonant with the pad */
  private pick(lowOct: number, highOct: number): number {
    const pcs = [...this.mood.notes.map((n) => n % 12), (this.mood.notes[0] + 2) % 12]
    const pc = pcs[Math.floor(Math.random() * pcs.length)]
    const oct = lowOct + Math.floor(Math.random() * (highOct - lowOct + 1))
    return pc + 12 * (oct + 1)
  }

  private publish() {
    if (this.frame % 6 === 0) document.documentElement.style.setProperty('--audio', this.level.toFixed(3))
  }

  /* ---------------------------------------------------------------- cues */

  private out(pan = 0, send = 0.4): AudioNode | null {
    const ctx = this.ctx
    if (!ctx) return null
    const g = ctx.createGain()
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    if (p) {
      p.pan.value = clamp(pan, -1, 1)
      g.connect(p)
      p.connect(this.bus)
      const s = ctx.createGain()
      s.gain.value = send
      p.connect(s)
      s.connect(this.revSend)
    } else {
      g.connect(this.bus)
    }
    return g
  }

  private ready(): AudioContext | null {
    return this.ctx && this.enabled && this.ctx.state === 'running' ? this.ctx : null
  }

  private blip(freq: number, gain: number, dur: number, type: OscillatorType = 'sine', pan = 0, send = 0.4, when = 0) {
    const ctx = this.ready()
    if (!ctx) return
    const out = this.out(pan, send) as GainNode | null
    if (!out) return
    const t = ctx.currentTime + when
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    out.gain.setValueAtTime(0.0001, t)
    out.gain.linearRampToValueAtTime(gain * CUE, t + 0.004)
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(out)
    o.start(t)
    o.stop(t + dur + 0.05)
    window.setTimeout(() => out.disconnect(), (dur + 0.4) * 1000 + when * 1000)
  }

  /** inharmonic bell: four partials with their own decays */
  private bell(midi: number, gain: number, pan = 0, dur = 3, when = 0) {
    const ctx = this.ready()
    if (!ctx) return
    const out = this.out(pan, 0.9) as GainNode | null
    if (!out) return
    const t = ctx.currentTime + when
    const f0 = mtof(midi)
    const partials: [number, number, number][] = [
      [1, 1, 1],
      [2.0, 0.42, 0.7],
      [2.76, 0.3, 0.5],
      [5.4, 0.12, 0.3],
    ]
    for (const [r, a, d] of partials) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f0 * r
      const e = ctx.createGain()
      e.gain.setValueAtTime(0.0001, t)
      e.gain.linearRampToValueAtTime(gain * a * CUE, t + 0.006)
      e.gain.exponentialRampToValueAtTime(0.0001, t + dur * d)
      o.connect(e)
      e.connect(out)
      o.start(t)
      o.stop(t + dur * d + 0.1)
    }
    window.setTimeout(() => out.disconnect(), (dur + 0.6) * 1000 + when * 1000)
  }

  private sweep(from: number, to: number, dur: number, gain: number, q = 1.1, when = 0) {
    const ctx = this.ready()
    if (!ctx) return
    const out = this.out(0, 0.7) as GainNode | null
    if (!out) return
    const t = ctx.currentTime + when
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = q
    bp.frequency.setValueAtTime(from, t)
    bp.frequency.exponentialRampToValueAtTime(to, t + dur)
    out.gain.setValueAtTime(0.0001, t)
    out.gain.linearRampToValueAtTime(gain * CUE, t + dur * 0.4)
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(bp)
    bp.connect(out)
    src.start(t, Math.random() * 1.5)
    src.stop(t + dur + 0.1)
    window.setTimeout(() => out.disconnect(), (dur + 0.5) * 1000 + when * 1000)
  }

  cue(c: Cue, intensity = 1) {
    if (!this.ready()) return
    const root = this.mood.notes[0]
    try {
      switch (c) {
        case 'tick': {
          this.blip(mtof(this.pick(6, 7)), 0.028 * intensity, 0.11, 'sine', Math.random() * 0.6 - 0.3, 0.35)
          break
        }
        case 'beat': {
          this.blip(mtof(root + 36 + 7), 0.03 * intensity, 0.35, 'triangle', 0, 0.6)
          break
        }
        case 'select': {
          this.blip(mtof(root + 36), 0.06 * intensity, 0.7, 'triangle', -0.1, 0.7)
          this.blip(mtof(root + 43), 0.05 * intensity, 0.9, 'sine', 0.1, 0.8, 0.07)
          break
        }
        case 'whoosh': {
          this.sweep(260, 2100, 1.25, 0.1 * intensity, 1.0)
          break
        }
        case 'open': {
          this.sweep(180, 1500, 0.9, 0.09, 0.9)
          this.blip(mtof(root + 24), 0.05, 1.2, 'sine', 0, 0.9)
          this.blip(mtof(root + 31), 0.04, 1.4, 'sine', 0, 0.9, 0.08)
          break
        }
        case 'close': {
          this.sweep(1500, 180, 0.8, 0.07, 0.9)
          this.blip(mtof(root + 24), 0.035, 0.8, 'sine', 0, 0.9)
          break
        }
        case 'chime': {
          this.bell(this.pick(5, 5), 0.07 * intensity, 0, 4.5)
          this.bell(this.pick(6, 6), 0.04 * intensity, 0.3, 5, 0.18)
          break
        }
        case 'enter': {
          const ks = [root + 24, root + 31, root + 36, root + 43, root + 52]
          ks.forEach((k, i) => this.bell(k, 0.05, (i - 2) * 0.25, 6, 0.25 + i * 0.32))
          this.sweep(120, 1600, 3.2, 0.1, 0.7)
          break
        }
        case 'impact': {
          const ctx = this.ready()
          if (!ctx) return
          const out = this.out(0, 1) as GainNode | null
          if (!out) return
          const t = ctx.currentTime
          const o = ctx.createOscillator()
          o.type = 'sine'
          o.frequency.setValueAtTime(95, t)
          o.frequency.exponentialRampToValueAtTime(27, t + 1.6)
          out.gain.setValueAtTime(0.0001, t)
          out.gain.linearRampToValueAtTime(0.5, t + 0.012)
          out.gain.exponentialRampToValueAtTime(0.0001, t + 2.2)
          o.connect(out)
          o.start(t)
          o.stop(t + 2.3)
          const n = ctx.createBufferSource()
          n.buffer = this.noise
          const lp = ctx.createBiquadFilter()
          lp.type = 'lowpass'
          lp.frequency.setValueAtTime(2600, t)
          lp.frequency.exponentialRampToValueAtTime(160, t + 1.4)
          const ng = ctx.createGain()
          ng.gain.setValueAtTime(0.0001, t)
          ng.gain.linearRampToValueAtTime(0.38, t + 0.01)
          ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
          n.connect(lp)
          lp.connect(ng)
          ng.connect(out)
          n.start(t, Math.random())
          n.stop(t + 1.7)
          window.setTimeout(() => out.disconnect(), 3000)
          break
        }
      }
    } catch (e) {
      console.warn('cue failed', e)
    }
  }
}
