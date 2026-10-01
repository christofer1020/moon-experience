import { Matrix4, Vector3 } from 'three'
import * as Astronomy from 'astronomy-engine'

/** Matrix mapping J2000-equatorial (EQJ) vectors into the ecliptic-aligned three.js "system" frame. */
let cached: Matrix4 | null = null
export function eqjToSystemMatrix(): Matrix4 {
  if (cached) return cached.clone()
  const r = Astronomy.Rotation_EQJ_ECL().rot
  const col = (x: number, y: number, z: number) => {
    const ex = r[0][0] * x + r[1][0] * y + r[2][0] * z
    const ey = r[0][1] * x + r[1][1] * y + r[2][1] * z
    const ez = r[0][2] * x + r[1][2] * y + r[2][2] * z
    return new Vector3(ex, ez, -ey)
  }
  cached = new Matrix4().makeBasis(col(1, 0, 0), col(0, 1, 0), col(0, 0, 1))
  return cached.clone()
}
