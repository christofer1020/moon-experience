import { GLSL_COMMON } from './common'

export const earthVert = /* glsl */ `
out vec3 vObj;
out vec3 vWorldPos;
out vec3 vWorldN;
void main() {
  vObj = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldN = normalize(mat3(modelMatrix) * normalize(position));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const earthFrag = /* glsl */ `
precision highp float;
${GLSL_COMMON}
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform vec3 uSunDir;      // world
uniform vec3 uMoonPos;     // world
uniform float uMoonR;
uniform float uSunAng;
uniform float uTime;
uniform float uCloud;
uniform float uSunInt;
uniform float uAtmo;
uniform vec3 uCamPos;
in vec3 vObj;
in vec3 vWorldPos;
in vec3 vWorldN;
out vec4 fragColor;

void main() {
  vec3 N = normalize(vWorldN);
  vec3 V = normalize(uCamPos - vWorldPos);
  vec3 L = normalize(uSunDir);
  vec2 uv = dirToUV(normalize(vObj));
  vec2 dx = dFdx(uv); vec2 dy = dFdy(uv);
  dx.x -= round(dx.x); dy.x -= round(dy.x);
  vec3 day = textureGrad(uDay, uv, dx, dy).rgb;
  float night = textureGrad(uNight, uv, dx, dy).r;

  float ndl = dot(N, L);
  float vis = sunVisibility(vWorldPos, L, uMoonPos, uMoonR, uSunAng);
  float lit = smoothstep(-0.06, 0.18, ndl);
  float diff = max(ndl, 0.0);

  // procedural cloud deck, drifting
  vec3 cp = normalize(vObj) * 3.2 + vec3(uTime * 0.004, 0.0, uTime * 0.0025);
  float c = fbm3(cp) * 0.75 + fbm3(cp * 3.7 + 11.0) * 0.35;
  float cloud = smoothstep(0.52, 0.80, c) * uCloud;

  vec3 ocean = vec3(0.0);
  float oceanMask = clamp((day.b - day.r * 1.25) * 3.0, 0.0, 1.0);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 120.0) * oceanMask * (1.0 - cloud);

  vec3 sunC = vec3(1.0, 0.98, 0.94) * uSunInt * vis;
  vec3 surf = mix(day, vec3(0.94, 0.95, 0.97), cloud * 0.88);
  vec3 col = surf * sunC * diff * 0.95 + vec3(1.0, 0.96, 0.9) * spec * 0.55 * sunC * diff;

  // twilight band
  float tw = exp(-pow((ndl + 0.02) / 0.15, 2.0));
  col += vec3(1.0, 0.45, 0.2) * tw * 0.035 * (1.0 - cloud * 0.4) * vis * uSunInt;

  // night lights (hidden under cloud, stronger in the dark)
  float dark = 1.0 - smoothstep(-0.12, 0.05, ndl);
  float lights = pow(clamp((night - 0.07) / 0.93, 0.0, 1.0), 1.5);
  col += vec3(1.0, 0.74, 0.40) * lights * 3.2 * dark * (1.0 - cloud * 0.75);
  // faint moonlit / airglow floor
  col += surf * 0.0035;

  // atmospheric scattering rim
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float dayRim = smoothstep(-0.25, 0.4, ndl);
  vec3 atmo = mix(vec3(0.25, 0.48, 1.0), vec3(0.95, 0.55, 0.35), exp(-pow((ndl) / 0.25, 2.0)) * 0.55);
  col += atmo * fres * dayRim * 1.15 * uAtmo * uSunInt * vis;
  // in-scattered blue haze over the lit disk
  col += vec3(0.10, 0.20, 0.50) * (1.0 - max(dot(N, V), 0.0)) * diff * 0.35 * uAtmo * vis * uSunInt;

  fragColor = vec4(col, 1.0);
}
`

export const atmoVert = /* glsl */ `
out vec3 vWorldPos;
out vec3 vWorldN;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldN = normalize(mat3(modelMatrix) * normalize(position));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const atmoFrag = /* glsl */ `
precision highp float;
${GLSL_COMMON}
uniform vec3 uSunDir;
uniform vec3 uCamPos;
uniform vec3 uCenter;
uniform float uInner;   // planet radius
uniform float uOuter;   // shell radius
uniform vec3 uMoonPos;
uniform float uMoonR;
uniform float uSunAng;
uniform float uSunInt;
in vec3 vWorldPos;
in vec3 vWorldN;
out vec4 fragColor;

void main() {
  vec3 rd = normalize(vWorldPos - uCamPos);
  vec3 oc = uCamPos - uCenter;
  // closest approach of the view ray to the planet centre → height above limb
  float tca = -dot(oc, rd);
  vec3 cp = oc + rd * tca;
  float h = length(cp);
  float shell = (uOuter - h) / (uOuter - uInner);   // 0 at shell edge, 1 at the limb
  if (shell <= 0.0) discard;
  vec3 L = normalize(uSunDir);
  vec3 nrm = normalize(cp + 1e-6);
  float sunSide = dot(nrm, L);
  float lit = smoothstep(-0.35, 0.45, sunSide);
  float vis = sunVisibility(uCenter + nrm * uInner, L, uMoonPos, uMoonR, uSunAng);
  float inten = pow(clamp(shell, 0.0, 1.0), 2.4);
  vec3 blue = vec3(0.22, 0.45, 1.0);
  vec3 warm = vec3(1.0, 0.52, 0.28);
  vec3 col = mix(blue, warm, exp(-pow(sunSide / 0.22, 2.0)) * 0.7);
  float a = inten * lit * uSunInt;
  fragColor = vec4(col * a * 1.6 * mix(1.0, vis, 0.85), 1.0);
}
`
