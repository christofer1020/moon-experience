import type { Chapter } from './types'
import { moon } from './c01_moon'
import { surface } from './c02_surface'
import { maria } from './c03_maria'
import { craters } from './c04_craters'
import { day } from './c05_day'
import { sides } from './c06_sides'
import { phases } from './c07_phases'
import { eclipses } from './c08_eclipses'
import { orbit } from './c09_orbit'
import { earthmoon } from './c10_earthmoon'
import { exploration } from './c11_exploration'
import { apollo } from './c12_apollo'
import { poles } from './c13_poles'
import { calendar } from './c14_calendar'
import { facts } from './c15_facts'

/** Chapters are appended here as each experience is built. */
export const CHAPTERS: Chapter[] = [moon, surface, maria, craters, day, sides, phases, eclipses, orbit, earthmoon, exploration, apollo, poles, calendar, facts]

export const chapterIndex = (id: string) => CHAPTERS.findIndex((c) => c.id === id)
