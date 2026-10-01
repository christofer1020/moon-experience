import { useEffect, useState } from 'react'
import { engine } from '../app/engine'

/** Poll the live simulation state for display in React tools (a few times per second). */
export function useSim(ms = 220) {
  const [, force] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => force((x) => x + 1), ms)
    return () => clearInterval(id)
  }, [ms])
  return engine.obs?.sim ?? null
}

const DEG = Math.PI / 180
/** Sun elevation (deg) at a selenographic site, given the sub-solar point. */
export function sunElevation(lat: number, lon: number, sub: { lat: number; lon: number }) {
  const s = Math.sin(lat * DEG) * Math.sin(sub.lat * DEG) + Math.cos(lat * DEG) * Math.cos(sub.lat * DEG) * Math.cos((lon - sub.lon) * DEG)
  return Math.asin(Math.max(-1, Math.min(1, s))) / DEG
}

/** fraction of the lunar day since local sunrise (0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight) */
export function lunarDayFraction(lon: number, sub: { lon: number }) {
  const H = ((((sub.lon - lon) % 360) + 540) % 360) - 180
  return (((90 - H) / 360) % 1 + 1) % 1
}
