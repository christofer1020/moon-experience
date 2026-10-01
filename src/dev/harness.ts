import { Observatory } from '../engine/Observatory'

const canvas = document.getElementById('c') as HTMLCanvasElement
const log = document.getElementById('log')!
const obs = new Observatory(canvas)
;(window as any).__obs = obs
const params = new URLSearchParams(location.search)
const num = (k: string, d: number) => (params.has(k) ? parseFloat(params.get(k)!) : d)

obs.driver = (p) => {
  p.cam = { kind: 'surface', lon: num('lon', 0), lat: num('lat', 0), dist: num('dist', 3.4) }
  p.fov = num('fov', 30)
  p.shift = [num('sx', 0), num('sy', 0)]
  p.starGain = num('stars', 0.6)
  p.date = params.has('date') ? Date.parse(params.get('date')!) : Date.parse('2026-10-18T16:00:00Z')
  p.exposure = num('exp', 1)
  p.sunInt = num('sun', 2.6)
  p.grid = num('grid', 0)
  p.topo = num('topo', 0)
  p.shadows = num('shadows', 1) > 0
  p.shadowReach = num('reach', 0.06)
  p.grade = [num('gain', 1), num('gamma', 1), num('sat', 1)]
  p.earthVisible = num('earth', 0) > 0
  p.sunVisible = num('sunvis', 0) > 0
}
obs.init((pr) => { log.textContent = `${pr.stage} ${(pr.value * 100).toFixed(0)}%` + (pr.ready ? ' ready' : '') }).then(() => {
  obs.start()
  ;(window as any).__ready = true
  log.textContent = `ready ${obs.quality.tier} ${obs.device.gpu}`
})
