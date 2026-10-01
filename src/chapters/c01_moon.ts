import type { Chapter } from './types'
import { datePhase } from './helpers'

export const moon: Chapter = {
  id: 'moon',
  num: '01',
  title: 'The Moon',
  short: 'The Moon',
  kicker: 'Overview',
  blurb: 'A world beside our own',
  glyph: 'moon',
  heightVh: 520,
  scrim: 'left',
  beats: [
    {
      id: 'hero',
      eyebrow: '01 — The Moon',
      title: 'SELENE — an atlas of the Moon',
      body: ['A world beside our own.'],
      alt: 'A waxing gibbous Moon, lit from the right, with the terminator crossing the craters Tycho and Copernicus; the night side fades into darkness.',
    },
    {
      id: 'nearest',
      eyebrow: '01 — The Moon',
      title: 'The nearest *world*.',
      body: [
        'It is 3,475 km across — just over a quarter of Earth’s width — and on average 384,400 km away. Light crosses that gap in 1.3 seconds.',
        'Everything here is built from the Moon’s own measured shape and colour: laser altimetry and imaging from NASA’s Lunar Reconnaissance Orbiter.',
      ],
      data: [
        ['Diameter', '3,474.8 km'],
        ['Mean distance', '384,400 km'],
        ['Surface gravity', '1.62 m/s²  (≈ ⅙ of Earth’s)'],
        ['Light travel time', '≈ 1.28 s'],
      ],
      alt: 'The Moon seen from the near side with the maria visible as dark plains.',
    },
    {
      id: 'collision',
      eyebrow: '01 — The Moon',
      title: 'Born of a *collision*.',
      body: [
        'The leading theory: about 4.5 billion years ago a Mars-sized body, called Theia, struck the young Earth. The molten and vaporised debris gathered into the Moon.',
        'Apollo rocks share Earth’s oxygen isotopes almost exactly, which is why the idea works so well. It is still being tested: how large was Theia, and was it one impact or several?',
      ],
      data: [
        ['Age', '≈ 4.5 billion years'],
        ['Mass', '7.35 × 10²² kg  (1.2 % of Earth)'],
        ['Crust', '≈ 40 km near · up to ≈ 60 km far'],
      ],
      note: 'Source: NASA Science, “Moon Facts” and “Formation of the Moon”.',
      alt: 'The far side of the Moon, uniformly bright, heavily cratered highlands with almost no dark plains.',
    },
    {
      id: 'remembers',
      eyebrow: '01 — The Moon',
      title: 'A surface that *remembers*.',
      body: [
        'With no air, no water and no plate tectonics, the Moon keeps its history: dark plains of ancient lava, bright cratered highlands, four billion years of impacts.',
        'Turn it. Zoom in. Every name you can touch is a doorway.',
      ],
      alt: 'The near side of the Moon with labelled major craters and plains.',
    },
  ],
  scene(c) {
    const { p, beat } = c
    p.starGain = 0.5
    p.exposure = 1
    switch (beat) {
      case 0:
        p.cam = { kind: 'surface', lon: -8, lat: 10, dist: c.dist(5.5) }
        p.date = datePhase(106)
        p.idleSpin = 0.35
        c.compose('right')
        break
      case 1:
        p.cam = { kind: 'surface', lon: 4, lat: 4, dist: c.dist(5.3) }
        p.date = datePhase(150)
        p.idleSpin = 0.25
        c.compose('right')
        break
      case 2:
        p.cam = { kind: 'surface', lon: 176, lat: 12, dist: c.dist(5.3) }
        p.date = datePhase(14)
        p.idleSpin = 0.25
        c.compose('right')
        break
      default:
        p.cam = { kind: 'surface', lon: -14, lat: 16, dist: c.dist(5.1) }
        p.date = datePhase(112)
        p.idleSpin = 0.2
        c.compose('right')
        c.landmarks(['tycho', 'copernicus', 'aristarchus', 'clavius', 'plato', 'orientale'], { maxRank: 1 })
    }
  },
}
