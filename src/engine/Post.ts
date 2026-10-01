import {
  BufferGeometry,
  Float32BufferAttribute,
  GLSL3,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector4,
  WebGLRenderTarget,
  WebGLRenderer,
  LinearSRGBColorSpace,
} from 'three'

const fsVert = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const downFrag = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uFirst;
out vec4 fragColor;
vec3 prefilter(vec3 c) {
  if (uFirst < 0.5) return c;
  float l = max(max(c.r, c.g), c.b);
  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
  return c * k;
}
void main() {
  vec3 c = prefilter(texture(tSrc, vUv).rgb) * 4.0;
  c += prefilter(texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb);
  c += prefilter(texture(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb);
  c += prefilter(texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb);
  c += prefilter(texture(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb);
  fragColor = vec4(min(c / 8.0, vec3(60.0)), 1.0);
}
`

const upFrag = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D tSrc;
uniform sampler2D tAdd;
uniform vec2 uTexel;
out vec4 fragColor;
void main() {
  vec3 c = texture(tSrc, vUv + uTexel * vec2(-1.0, 0.0)).rgb;
  c += texture(tSrc, vUv + uTexel * vec2(1.0, 0.0)).rgb;
  c += texture(tSrc, vUv + uTexel * vec2(0.0, -1.0)).rgb;
  c += texture(tSrc, vUv + uTexel * vec2(0.0, 1.0)).rgb;
  c += texture(tSrc, vUv + uTexel * vec2(-0.7, -0.7)).rgb * 0.5;
  c += texture(tSrc, vUv + uTexel * vec2(0.7, -0.7)).rgb * 0.5;
  c += texture(tSrc, vUv + uTexel * vec2(-0.7, 0.7)).rgb * 0.5;
  c += texture(tSrc, vUv + uTexel * vec2(0.7, 0.7)).rgb * 0.5;
  fragColor = vec4(c / 6.0 + texture(tAdd, vUv).rgb * 0.9, 1.0);
}
`

const compFrag = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tInset;
uniform float uExposure;
uniform float uBloom;
uniform float uGrain;
uniform float uTime;
uniform float uVignette;
uniform float uFade;        // 0 = visible, 1 = black
uniform vec3 uIris;         // centre uv, radius (in height units); radius<=0 disables
uniform vec2 uAspect;       // (w/h, 1)
uniform vec4 uInset;        // centre uv x,y; radius (height units); enable
uniform vec3 uInsetRing;
uniform float uSat;
out vec4 fragColor;

vec3 aces(vec3 x) {
  const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec3 c = texture(tScene, vUv).rgb;
  vec3 b = texture(tBloom, vUv).rgb;
  c += b * uBloom;

  // observer inset composited in HDR before tone mapping
  if (uInset.w > 0.5) {
    vec2 q = (vUv - uInset.xy) * uAspect;
    float r = length(q);
    if (r < uInset.z * 1.0) {
      vec2 iuv = q / (uInset.z * 2.0) + 0.5;
      vec3 ic = texture(tInset, iuv).rgb;
      float edge = smoothstep(uInset.z, uInset.z - 0.004, r);
      c = mix(c * 0.15, ic, edge);
    }
    float ring = smoothstep(0.0022, 0.0, abs(r - uInset.z - 0.004));
    c += vec3(0.80, 0.78, 0.72) * ring * 0.55 * uInsetRing.x;
  }

  c *= uExposure;
  vec3 t = aces(c);
  float l = dot(t, vec3(0.2126, 0.7152, 0.0722));
  t = mix(vec3(l), t, uSat);

  // vignette
  vec2 v = (vUv - 0.5) * vec2(uAspect.x, 1.0);
  float vig = smoothstep(1.15, 0.25, length(v));
  t *= mix(1.0, vig, uVignette);

  // iris transition mask
  if (uIris.z > 0.0) {
    vec2 q = (vUv - uIris.xy) * uAspect;
    float d = length(q) - uIris.z;
    t *= smoothstep(0.012, -0.012, d);
  }

  // film grain + dither
  float g = hash(vUv * vec2(1731.0, 1117.0) + fract(uTime) * 91.0) - 0.5;
  t += g * uGrain * (0.25 + 0.75 * (1.0 - l));
  t += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

  t *= (1.0 - uFade);
  // sRGB OETF
  t = clamp(t, 0.0, 1.0);
  t = mix(t * 12.92, 1.055 * pow(t, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, t));
  fragColor = vec4(t, 1.0);
}
`

export interface PostParams {
  exposure: number
  bloom: number
  grain: number
  vignette: number
  fade: number
  saturation: number
  iris: { x: number; y: number; r: number }
  inset: { x: number; y: number; r: number; on: boolean; ring: number }
}

export class Post {
  readonly scene: Scene
  readonly sceneRT: WebGLRenderTarget
  readonly insetRT: WebGLRenderTarget
  private chain: WebGLRenderTarget[] = []
  private chainUp: WebGLRenderTarget[] = []
  private quad: Mesh
  private cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private down: ShaderMaterial
  private up: ShaderMaterial
  private comp: ShaderMaterial
  private blank: WebGLRenderTarget
  private w = 2
  private h = 2
  bloomEnabled = true
  readonly params: PostParams = {
    exposure: 1,
    bloom: 0.7,
    grain: 0.03,
    vignette: 0.5,
    fade: 0,
    saturation: 1,
    iris: { x: 0.5, y: 0.5, r: 0 },
    inset: { x: 0.5, y: 0.5, r: 0.1, on: false, ring: 1 },
  }

  constructor(private renderer: WebGLRenderer, private msaa: number, insetSize: number) {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
    const mk = (frag: string, uniforms: Record<string, { value: unknown }>) =>
      new ShaderMaterial({ glslVersion: GLSL3, vertexShader: fsVert, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false })
    this.down = mk(downFrag, { tSrc: { value: null }, uTexel: { value: new Vector2() }, uThreshold: { value: 1.0 }, uFirst: { value: 1 } })
    this.up = mk(upFrag, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new Vector2() } })
    this.comp = mk(compFrag, {
      tScene: { value: null },
      tBloom: { value: null },
      tInset: { value: null },
      uExposure: { value: 1 },
      uBloom: { value: 0.7 },
      uGrain: { value: 0.03 },
      uTime: { value: 0 },
      uVignette: { value: 0.5 },
      uFade: { value: 0 },
      uIris: { value: new Vector4(0.5, 0.5, 0, 0) },
      uAspect: { value: new Vector2(1, 1) },
      uInset: { value: new Vector4(0.5, 0.5, 0.1, 0) },
      uInsetRing: { value: new Vector4(1, 0, 0, 0) },
      uSat: { value: 1 },
    })
    this.quad = new Mesh(g, this.down)
    this.quad.frustumCulled = false
    this.scene = new Scene()
    this.scene.add(this.quad)

    const opts = { type: HalfFloatType, format: RGBAFormat, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false, colorSpace: LinearSRGBColorSpace }
    this.sceneRT = new WebGLRenderTarget(2, 2, { ...opts, depthBuffer: true, samples: msaa })
    this.insetRT = new WebGLRenderTarget(insetSize, insetSize, { ...opts, depthBuffer: true, samples: Math.min(msaa, 2) })
    this.blank = new WebGLRenderTarget(2, 2, opts)
    for (let i = 0; i < 4; i++) {
      this.chain.push(new WebGLRenderTarget(2, 2, opts))
      if (i < 3) this.chainUp.push(new WebGLRenderTarget(2, 2, opts))
    }
  }

  resize(w: number, h: number) {
    this.w = w
    this.h = h
    this.sceneRT.setSize(w, h)
    let cw = Math.max(2, Math.floor(w / 2))
    let ch = Math.max(2, Math.floor(h / 2))
    for (let i = 0; i < this.chain.length; i++) {
      this.chain[i].setSize(cw, ch)
      if (i < this.chainUp.length) this.chainUp[i].setSize(cw, ch)
      cw = Math.max(2, Math.floor(cw / 2))
      ch = Math.max(2, Math.floor(ch / 2))
    }
    ;(this.comp.uniforms.uAspect.value as Vector2).set(w / h, 1)
  }

  private pass(mat: ShaderMaterial, target: WebGLRenderTarget | null) {
    this.quad.material = mat
    this.renderer.setRenderTarget(target)
    this.renderer.render(this.scene, this.cam)
  }

  /** Run bloom + composite to the canvas. */
  finish(time: number, insetTex: Texture | null) {
    const p = this.params
    const r = this.renderer
    let bloomTex: Texture = this.blank.texture
    if (this.bloomEnabled && p.bloom > 0.001) {
      // downsample chain
      let src: Texture = this.sceneRT.texture
      for (let i = 0; i < this.chain.length; i++) {
        const t = this.chain[i]
        this.down.uniforms.tSrc.value = src
        ;(this.down.uniforms.uTexel.value as Vector2).set(0.5 / (i === 0 ? this.w : this.chain[i - 1].width), 0.5 / (i === 0 ? this.h : this.chain[i - 1].height))
        this.down.uniforms.uFirst.value = i === 0 ? 1 : 0
        this.down.uniforms.uThreshold.value = 1.1
        this.pass(this.down, t)
        src = t.texture
      }
      // upsample
      let cur = this.chain[this.chain.length - 1]
      for (let i = this.chainUp.length - 1; i >= 0; i--) {
        const dst = this.chainUp[i]
        this.up.uniforms.tSrc.value = cur.texture
        this.up.uniforms.tAdd.value = this.chain[i].texture
        ;(this.up.uniforms.uTexel.value as Vector2).set(1.0 / cur.width, 1.0 / cur.height)
        this.pass(this.up, dst)
        cur = dst
      }
      bloomTex = cur.texture
    }
    const u = this.comp.uniforms
    u.tScene.value = this.sceneRT.texture
    u.tBloom.value = bloomTex
    u.tInset.value = insetTex ?? this.blank.texture
    u.uExposure.value = p.exposure
    u.uBloom.value = p.bloom
    u.uGrain.value = p.grain
    u.uTime.value = time
    u.uVignette.value = p.vignette
    u.uFade.value = p.fade
    u.uSat.value = p.saturation
    ;(u.uIris.value as Vector4).set(p.iris.x, p.iris.y, p.iris.r, 0)
    ;(u.uInset.value as Vector4).set(p.inset.x, p.inset.y, p.inset.r, p.inset.on && insetTex ? 1 : 0)
    ;(u.uInsetRing.value as Vector4).set(p.inset.ring, 0, 0, 0)
    this.pass(this.comp, null)
    r.setRenderTarget(null)
  }

  dispose() {
    this.sceneRT.dispose()
    this.insetRT.dispose()
    this.blank.dispose()
    this.chain.forEach((c) => c.dispose())
    this.chainUp.forEach((c) => c.dispose())
  }
}
