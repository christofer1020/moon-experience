import { GLSL_COMMON } from './common'

export const starsVert = /* glsl */ `
in float aMag;
in float aBV;
uniform float uPx;
uniform float uGain;
uniform float uTwinkle;
uniform float uTime;
out vec3 vCol;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float flux = pow(10.0, -0.4 * (aMag - 2.0));
  float t = clamp(aBV, -0.4, 2.0);
  vec3 c = mix(vec3(0.62, 0.75, 1.0), vec3(1.0, 0.97, 0.93), smoothstep(-0.25, 0.55, t));
  c = mix(c, vec3(1.0, 0.64, 0.40), smoothstep(0.7, 1.7, t));
  float inten = pow(flux, 0.72) * uGain;
  float size = clamp(1.25 + 1.15 * log2(1.0 + flux * 9.0), 1.25, 6.5);
  // sub-pixel stars are dimmed rather than shrunk
  float area = size < 1.6 ? size * size / 2.56 : 1.0;
  gl_PointSize = max(size, 1.6) * uPx;
  vCol = c * inten * area;
}
`

export const starsFrag = /* glsl */ `
precision highp float;
in vec3 vCol;
out vec4 fragColor;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  float a = exp(-d * d * 3.2);
  fragColor = vec4(vCol * a, 1.0);
}
`

export const sunVert = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 2.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const sunFrag = /* glsl */ `
precision highp float;
${GLSL_COMMON}
in vec2 vUv;
uniform float uK;        // quad half-extent in solar radii
uniform float uCorona;   // 0..1 corona visibility (only when the disc is covered)
uniform float uTime;
uniform float uIntensity;
uniform float uGlare;
out vec4 fragColor;

void main() {
  vec2 p = vUv * uK;
  float r = length(p);
  float ang = atan(p.y, p.x);
  float disc = 1.0 - smoothstep(0.985, 1.0, r);
  float mu = sqrt(max(1.0 - r * r, 0.0));
  float limb = 1.0 - 0.62 * (1.0 - mu);
  vec3 photo = vec3(1.0, 0.95, 0.86) * limb * 55.0 * uIntensity * disc;

  // glare halo (instrument + atmosphere), grows slightly with intensity
  float halo = exp(-(r - 1.0) * 0.9) * step(1.0, r) * 0.55 + exp(-r * r * 0.05) * 0.10;
  halo *= uGlare;
  vec3 glare = vec3(1.0, 0.90, 0.75) * halo * uIntensity;

  // corona: radial streamers, brightest near the limb
  float rays = fbm3(vec3(cos(ang) * 2.2, sin(ang) * 2.2, 1.7)) * 0.65 + fbm3(vec3(cos(ang) * 6.0, sin(ang) * 6.0, 4.1)) * 0.35;
  float k = max(r - 0.98, 0.0);
  float cor = (0.9 / pow(1.0 + k * 2.2, 3.0)) * (0.55 + 0.9 * rays);
  cor *= smoothstep(0.98, 1.05, r) * (1.0 - smoothstep(6.0, 9.0, r));
  vec3 corona = vec3(0.92, 0.95, 1.0) * cor * 4.5 * uCorona;
  // chromatic inner ring (diamond-ring bead hint)
  float prom = exp(-pow((r - 1.02) / 0.025, 2.0)) * uCorona * 1.4 * (0.5 + 0.5 * vnoise3(vec3(ang * 3.0, 2.0, 0.5)));
  corona += vec3(1.0, 0.35, 0.45) * prom;

  vec3 c = photo + glare + corona;
  float a = 1.0;
  fragColor = vec4(c, a);
}
`
