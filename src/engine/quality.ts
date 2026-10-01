export type Tier = 'low' | 'medium' | 'high'

export interface Quality {
  tier: Tier
  maxDpr: number
  msaa: number
  moonSegments: [number, number]
  albedoSteps: ('2k' | '4k' | '8k')[]
  reliefSteps: ('2k' | '4k')[]
  heightSteps: ('4ppd' | '8ppd')[]
  shadowSteps: number
  bloom: boolean
  grain: boolean
  dynamicRes: boolean
  microDetail: boolean
  starCount: number
  inset: number
}

const PRESETS: Record<Tier, Quality> = {
  low: {
    tier: 'low',
    maxDpr: 1.25,
    msaa: 0,
    moonSegments: [384, 192],
    albedoSteps: ['2k', '4k'],
    reliefSteps: ['2k', '4k'],
    heightSteps: ['4ppd'],
    shadowSteps: 8,
    bloom: false,
    grain: false,
    dynamicRes: true,
    microDetail: false,
    starCount: 30000,
    inset: 256,
  },
  medium: {
    tier: 'medium',
    maxDpr: 1.75,
    msaa: 2,
    moonSegments: [768, 384],
    albedoSteps: ['2k', '4k', '8k'],
    reliefSteps: ['2k', '4k'],
    heightSteps: ['4ppd', '8ppd'],
    shadowSteps: 14,
    bloom: true,
    grain: true,
    dynamicRes: true,
    microDetail: true,
    starCount: 70000,
    inset: 400,
  },
  high: {
    tier: 'high',
    maxDpr: 2,
    msaa: 4,
    moonSegments: [1024, 512],
    albedoSteps: ['2k', '4k', '8k'],
    reliefSteps: ['2k', '4k'],
    heightSteps: ['4ppd', '8ppd'],
    shadowSteps: 22,
    bloom: true,
    grain: true,
    dynamicRes: true,
    microDetail: true,
    starCount: 130000,
    inset: 512,
  },
}

export interface DeviceInfo {
  mobile: boolean
  coarse: boolean
  gpu: string
  maxTexture: number
  memoryGB: number
  cores: number
}

export function probeDevice(): DeviceInfo {
  const ua = navigator.userAgent
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (coarse && Math.min(screen.width, screen.height) < 820)
  let gpu = 'unknown'
  let maxTexture = 4096
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGL2RenderingContext | null
    if (gl) {
      maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE)
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    /* ignore */
  }
  const memoryGB = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? (mobile ? 3 : 8)
  return { mobile, coarse, gpu, maxTexture, memoryGB, cores: navigator.hardwareConcurrency || 4 }
}

export function pickQuality(dev: DeviceInfo): Quality {
  const q = new URLSearchParams(location.search).get('q') as Tier | null
  let tier: Tier
  if (q === 'low' || q === 'medium' || q === 'high') tier = q
  else if (/swiftshader|llvmpipe|software/i.test(dev.gpu)) tier = 'low'
  else if (dev.mobile) tier = dev.memoryGB >= 6 && dev.cores >= 8 ? 'medium' : 'low'
  else if (dev.memoryGB >= 8 && dev.cores >= 6 && dev.maxTexture >= 16384) tier = 'high'
  else tier = 'medium'
  const base = { ...PRESETS[tier] }
  // mobile: never fetch the heaviest albedo tier unless the device is strong
  if (dev.mobile && tier !== 'high') base.albedoSteps = base.albedoSteps.filter((s) => s !== '8k')
  if (dev.maxTexture < 8192) base.albedoSteps = base.albedoSteps.filter((s) => s !== '8k')
  if (new URLSearchParams(location.search).get('dyn') === '0') base.dynamicRes = false
  const msaa = new URLSearchParams(location.search).get('aa')
  if (msaa !== null) base.msaa = Math.max(0, parseInt(msaa, 10) || 0)
  return base
}
