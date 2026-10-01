/**
 * Sound — filled in during the audio pass. Interface is stable so the UI can already call it.
 * NOTE: there is no sound in space. Everything here is part of the website experience.
 */
export type Cue = 'enter' | 'tick' | 'select' | 'whoosh' | 'open' | 'close' | 'impact' | 'chime'

export class Sound {
  enabled = false
  init() {
    /* AudioContext is created lazily on a user gesture */
  }
  setEnabled(on: boolean) {
    this.enabled = on
  }
  cue(_c: Cue, _intensity = 1) {
    /* no-op until audio pass */
  }
  setChapter(_i: number) {}
  update(_dt: number, _state: { speed: number }) {}
}
