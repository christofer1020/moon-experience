import { Group } from 'three'
import type { Observatory } from './Observatory'

/** Orbit paths, shadow cones, guides etc. (filled in with the system chapters). */
export class SystemOverlay {
  readonly group = new Group()
  update(_obs: Observatory, _dt: number) {
    /* implemented in system pass */
  }
}
