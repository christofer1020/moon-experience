import { GLSL_COMMON } from './common'

export const moonVert = /* glsl */ `
uniform sampler2D uHeight;
uniform float uHeightScale;
uniform vec4 uImpact;     // xyz = centre dir (body), w = angular radius (rad)
uniform vec4 uImpactState; // x = progress 0..1, y = active, z = depth ratio, w = flatten (0..1)
uniform float uImpactBase;  // elevation the site is flattened to (fraction of R)

out vec3 vDir;
out vec3 vPos;

${GLSL_COMMON}

// impact replay: the existing crater is wiped to the surrounding ground level before the new one forms
float flatH(float h, vec3 d) {
  float f = uImpactState.w;
  if (f < 0.001) return h;
  float th = acos(clamp(dot(d, uImpact.xyz), -1.0, 1.0));
  float rho = max(uImpact.w, 1e-4);
  return mix(h, uImpactBase, f * (1.0 - smoothstep(1.05 * rho, 1.9 * rho, th)));
}

float impactHeight(vec3 d) {
  if (uImpactState.y < 0.5) return 0.0;
  float t = uImpactState.x;
  float grow = smoothstep(0.02, 0.55, t);
  float rho = uImpact.w * (0.35 + 0.65 * grow);
  float th = acos(clamp(dot(d, uImpact.xyz), -1.0, 1.0));
  float x = th / max(rho, 1e-5);
  float depth = uImpactState.z * 2.0 * rho;
  float cavity = x < 1.0 ? -depth * (1.0 - x * x) : 0.0;
  float settle = smoothstep(0.55, 1.0, t);
  float rim = depth * 0.22 * exp(-pow((x - 1.04) / 0.17, 2.0));
  float blanket = depth * 0.10 * exp(-(max(x, 1.0) - 1.0) / 0.7) * step(1.0, x);
  float transient = 1.0 - 0.35 * settle;
  return (cavity * transient + (rim + blanket) * grow) * smoothstep(0.0, 0.08, t);
}

void main() {
  vec3 d = normalize(position);
  float h = flatH(textureLod(uHeight, dirToUV(d), 0.0).r * uHeightScale, d) + impactHeight(d);
  vec3 p = d * (1.0 + h);
  vDir = d;
  vPos = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

export const moonFrag = /* glsl */ `
precision highp float;
precision highp int;

uniform sampler2D uAlbedo;
uniform sampler2D uRelief;
uniform sampler2D uHeight;
uniform sampler2D uMask;      // soft region mask (selected)
uniform sampler2D uMaskHover; // soft region mask (hover)

uniform vec3 uSunBody;
uniform vec3 uCamBody;
uniform vec3 uEarthBody;
uniform float uEarthR;
uniform float uSunAng;
uniform float uSunInt;
uniform float uEarthshine;
uniform float uHeightScale;
uniform vec3 uGrade;      // gain, gamma(contrast), saturation
uniform float uShadowSteps;
uniform float uShadowReach;
uniform float uShadowSoft;
uniform float uMicro;     // 0..1 sub-texel detail strength
uniform float uReliefGain;
uniform float uTime;

uniform vec4 uOverlay;    // x grid, y topography, z region mask strength, w terminator guide
uniform vec3 uMaskColor;
uniform vec4 uRing[3];    // xyz dir, w angular radius
uniform vec4 uRingP[3];   // x strength, y width(px), z style (0 plain, 1 reticle), w phase
uniform vec4 uImpact;
uniform vec4 uImpactState;
uniform float uImpactBase;
uniform vec4 uPulse;      // xyz dir, w intensity  (soft glow patch: sites, etc)
uniform vec2 uTopoRange;  // metres min,max

// hero windows: up to two high-resolution lat/lon tiles (colour + relief) blended over the global maps
uniform sampler2D uWinC0;
uniform sampler2D uWinR0;
uniform sampler2D uWinC1;
uniform sampler2D uWinR1;
uniform vec4 uWinRect[2]; // lonMin, lonMax, latMin, latMax (degrees)
uniform vec2 uWinW;       // blend weights

in vec3 vDir;
in vec3 vPos;
out vec4 fragColor;

${GLSL_COMMON}

const float SMAX = 0.6;

float flatH(float h, vec3 d) {
  float f = uImpactState.w;
  if (f < 0.001) return h;
  float th = acos(clamp(dot(d, uImpact.xyz), -1.0, 1.0));
  float rho = max(uImpact.w, 1e-4);
  return mix(h, uImpactBase, f * (1.0 - smoothstep(1.05 * rho, 1.9 * rho, th)));
}

vec3 topoRamp(float t) {
  // deep basin → low plains → mid → highlands → peaks. Muted, perceptually even.
  vec3 c0 = vec3(0.16, 0.14, 0.42);
  vec3 c1 = vec3(0.10, 0.36, 0.60);
  vec3 c2 = vec3(0.30, 0.58, 0.58);
  vec3 c3 = vec3(0.70, 0.74, 0.52);
  vec3 c4 = vec3(0.90, 0.68, 0.38);
  vec3 c5 = vec3(0.86, 0.38, 0.28);
  vec3 c6 = vec3(0.97, 0.94, 0.92);
  if (t < 0.12) return mix(c0, c1, t / 0.12);
  if (t < 0.34) return mix(c1, c2, (t - 0.12) / 0.22);
  if (t < 0.5) return mix(c2, c3, (t - 0.34) / 0.16);
  if (t < 0.66) return mix(c3, c4, (t - 0.5) / 0.16);
  if (t < 0.84) return mix(c4, c5, (t - 0.66) / 0.18);
  return mix(c5, c6, (t - 0.84) / 0.16);
}

float gridLine(float g, float w) {
  return 1.0 - smoothstep(w * 0.4, w * 1.4, g);
}

// analytic crater-formation shading normal contribution
vec2 impactSlope(vec3 d, out float rays, out float flash, out float shock) {
  rays = 0.0; flash = 0.0; shock = 0.0;
  if (uImpactState.y < 0.5) return vec2(0.0);
  float t = uImpactState.x;
  float grow = smoothstep(0.02, 0.55, t);
  float rho = uImpact.w * (0.35 + 0.65 * grow);
  float th = acos(clamp(dot(d, uImpact.xyz), -1.0, 1.0));
  // ejecta rays + blanket brightening
  vec3 c = uImpact.xyz;
  vec3 e0 = normalize(cross(vec3(0.0, 1.0, 0.0), c) + 1e-5 * vec3(1.0, 0.0, 0.0));
  vec3 n0 = cross(c, e0);
  vec3 q = d - c * dot(d, c);
  float az = atan(dot(q, n0), dot(q, e0));
  float x = th / max(uImpact.w, 1e-5);
  float rayN = vnoise3(vec3(cos(az) * 5.0, sin(az) * 5.0, 3.0)) * 0.7 + vnoise3(vec3(cos(az) * 14.0, sin(az) * 14.0, 9.0)) * 0.3;
  float reach = 2.0 + 14.0 * smoothstep(0.35, 0.95, t);
  rays = smoothstep(0.45, 0.85, rayN) * exp(-max(x - 1.0, 0.0) / (reach * 0.35)) * step(1.0, x) * smoothstep(0.4, 0.8, t);
  rays += exp(-pow(x * 0.9, 2.0)) * 0.6 * smoothstep(0.5, 0.9, t);
  // shock front
  float front = uImpact.w * (0.5 + 5.0 * pow(clamp(t * 1.15, 0.0, 1.0), 0.55));
  float fw = uImpact.w * 0.18;
  shock = exp(-pow((th - front) / fw, 2.0)) * (1.0 - smoothstep(0.1, 0.7, t)) * smoothstep(0.0, 0.05, t);
  flash = exp(-th / (uImpact.w * 0.8)) * exp(-t * 26.0);
  // radial slope from the displacement profile
  float depth = uImpactState.z * 2.0 * rho;
  float xr = th / max(rho, 1e-5);
  float dh = 0.0;
  if (xr < 1.0) dh = 2.0 * depth * xr;
  dh += -depth * 0.22 * 2.0 * (xr - 1.04) / (0.17 * 0.17) * exp(-pow((xr - 1.04) / 0.17, 2.0)) * 0.0;
  float rimSlope = depth * 0.22 * exp(-pow((xr - 1.04) / 0.17, 2.0)) * (-2.0 * (xr - 1.04) / (0.17 * 0.17));
  float s = (dh * (1.0 - 0.35 * smoothstep(0.55, 1.0, t)) + rimSlope * grow) / max(rho, 1e-5);
  s = clamp(s, -2.0, 2.0) * smoothstep(0.0, 0.08, t);
  // slope is d(height)/d(arc length) pointing away from centre → east/north components
  vec3 away = normalize(q + 1e-7);
  vec3 E = normalize(vec3(d.z, 0.0, -d.x) + vec3(1e-6, 0.0, 0.0));
  vec3 N = cross(d, E);
  return vec2(dot(away, E), dot(away, N)) * s;
}

vec2 winUV(vec4 r, vec2 ll) {
  return vec2((ll.x - r.x) / (r.y - r.x), (r.w - ll.y) / (r.w - r.z));
}

float winEdge(vec2 w) {
  return smoothstep(0.0, 0.07, min(min(w.x, 1.0 - w.x), min(w.y, 1.0 - w.y)));
}

void main() {
  vec3 p = normalize(vDir);
  vec2 uv = dirToUV(p);
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  dx.x -= round(dx.x);
  dy.x -= round(dy.x);

  // selenographic lon/lat in degrees, and their screen derivatives (for the window samplers)
  float lonD = degrees(atan(-p.z, p.x));
  float latD = degrees(asin(clamp(p.y, -1.0, 1.0)));
  vec2 ll = vec2(lonD, latD);
  vec2 llx = dFdx(ll);
  vec2 lly = dFdy(ll);
  llx.x -= 360.0 * round(llx.x / 360.0);
  lly.x -= 360.0 * round(lly.x / 360.0);

  // ---- albedo (linear), graded
  vec3 alb = textureGrad(uAlbedo, uv, dx, dy).rgb;
  float winTotal = 0.0;
  vec4 winRl = vec4(0.0);
  if (uWinW.x > 0.002) {
    vec4 r = uWinRect[0];
    vec2 w = winUV(r, ll);
    float f = winEdge(w) * uWinW.x;
    if (f > 0.0005) {
      vec2 sz = vec2(r.y - r.x, r.w - r.z);
      vec2 gx = vec2(llx.x / sz.x, -llx.y / sz.y);
      vec2 gy = vec2(lly.x / sz.x, -lly.y / sz.y);
      alb = mix(alb, textureGrad(uWinC0, w, gx, gy).rgb, f);
      winRl += vec4(textureGrad(uWinR0, w, gx, gy).rgb, 1.0) * f;
      winTotal += f;
    }
  }
  if (uWinW.y > 0.002) {
    vec4 r = uWinRect[1];
    vec2 w = winUV(r, ll);
    float f = winEdge(w) * uWinW.y;
    if (f > 0.0005) {
      vec2 sz = vec2(r.y - r.x, r.w - r.z);
      vec2 gx = vec2(llx.x / sz.x, -llx.y / sz.y);
      vec2 gy = vec2(lly.x / sz.x, -lly.y / sz.y);
      alb = mix(alb, textureGrad(uWinC1, w, gx, gy).rgb, f);
      winRl += vec4(textureGrad(uWinR1, w, gx, gy).rgb, 1.0) * f;
      winTotal += f;
    }
  }
  winTotal = min(winTotal, 1.0);
  // impact replay: show pristine, pre-impact terrain (blurred albedo, flat relief) around the site
  float impThe = 9.0;
  float impRho = max(uImpact.w, 1e-4);
  float impF = uImpactState.w;
  if (impF > 0.001) {
    impThe = acos(clamp(dot(p, uImpact.xyz), -1.0, 1.0));
    float wA = impF * (1.0 - smoothstep(5.0 * impRho, 13.0 * impRho, impThe));
    vec2 ts = vec2(textureSize(uAlbedo, 0));
    float lod = clamp(log2(max(impRho * ts.x / TAU * 1.6, 1.0)), 0.0, 9.0);
    vec3 bg = textureLod(uAlbedo, uv, lod).rgb;
    alb = mix(alb, bg, wA);
  }
  float lum = dot(alb, vec3(0.2126, 0.7152, 0.0722));
  alb = mix(vec3(lum), alb, uGrade.z);
  alb = uGrade.x * pow(max(alb, vec3(1e-4)), vec3(uGrade.y));

  // ---- relief normal
  vec4 rl = textureGrad(uRelief, uv, dx, dy);
  if (winTotal > 0.0005) rl.rgb = mix(rl.rgb, winRl.rgb / max(winRl.a, 1e-4), winTotal);
  vec2 e = (rl.rg - 0.5) * 2.0;
  vec2 s = SMAX * e * abs(e) * uReliefGain;
  float rough = 0.35 * rl.b * rl.b;
  if (impF > 0.001) s *= 1.0 - impF * (1.0 - smoothstep(1.3 * impRho, 2.2 * impRho, impThe));

  vec3 E = normalize(vec3(p.z, 0.0, -p.x) + vec3(1e-6, 0.0, 0.0));
  vec3 N = cross(p, E);

  // procedural sub-texel regolith relief, only when close
  if (uMicro > 0.001) {
    float fd = max(length(dx) + length(dy), 1e-7);           // uv footprint of a pixel
    float closeness = smoothstep(2.2e-4, 3.0e-5, fd) * uMicro * (1.0 - 0.55 * winTotal); // fades in below ~0.4 km/pixel
    if (closeness > 0.002) {
      vec3 q = p * 900.0;
      float h0 = fbm3(q);
      vec3 g = vec3(fbm3(q + vec3(0.7, 0.0, 0.0)) - h0, fbm3(q + vec3(0.0, 0.7, 0.0)) - h0, fbm3(q + vec3(0.0, 0.0, 0.7)) - h0);
      g -= p * dot(g, p);
      float amp = (0.10 + 1.6 * rough) * closeness;
      s += vec2(dot(g, E), dot(g, N)) * amp;
      lum *= 1.0;
      alb *= 1.0 + (h0 - 0.5) * 0.10 * closeness;
    }
  }

  // impact formation (educational visualisation)
  float iRays, iFlash, iShock;
  s += impactSlope(p, iRays, iFlash, iShock);

  vec3 n = normalize(p - s.x * E - s.y * N);

  // ---- illumination
  vec3 L = normalize(uSunBody);
  vec3 V = normalize(uCamBody - vPos);
  float mu0 = max(dot(n, L), 0.0);
  float mu = max(dot(n, V), 0.0);
  float alpha = acos(clamp(dot(L, V), -1.0, 1.0));
  float Lw = exp(-alpha / 1.0472);                       // McEwen lunar-Lambert weight
  float refl = 2.0 * Lw * mu0 / (mu0 + mu + 1e-3) + (1.0 - Lw) * mu0;
  float surge = 1.0 + 0.5 / (1.0 + tan(alpha * 0.5) / 0.06); // opposition effect

  // cast shadows from the elevation field
  float shadow = 1.0;
  float pl = dot(p, L);
  if (uShadowSteps > 0.5 && pl < 0.66 && pl > -0.2 && mu0 > 0.0) {
    // start from the fragment's own texture height (the interpolated mesh vertex height is too coarse)
    float h0 = flatH(textureLod(uHeight, uv, 0.0).r * uHeightScale, p);
    vec3 P0 = p * (1.0 + h0);
    float t = 0.0006;
    float growth = pow(uShadowReach / 0.0006, 1.0 / max(uShadowSteps - 1.0, 1.0));
    float res = 1.0;
    for (int i = 0; i < 40; i++) {
      if (float(i) >= uShadowSteps) break;
      vec3 q = P0 + L * t;
      float r = length(q);
      float hq = flatH(textureLod(uHeight, dirToUV(q / r), 0.0).r * uHeightScale, q / r);
      float dh = r - (1.0 + hq) + 0.00012;
      res = min(res, clamp(uShadowSoft * dh / t, 0.0, 1.0));
      t *= growth;
    }
    shadow = res * res * (3.0 - 2.0 * res);
    // shadow hiding: seen from (nearly) the Sun's direction the shadowed ground is hidden behind the objects that cast it,
    // which is why a full Moon looks flat. The cast-shadow term fades out toward zero phase angle.
    shadow = mix(1.0, shadow, smoothstep(0.03, 0.5, alpha));
  }

  // eclipse: Earth occludes the Sun
  float vis = sunVisibility(vPos, L, uEarthBody, uEarthR, uSunAng);
  vec3 toEarth = normalize(uEarthBody - vPos);
  float mue = max(dot(n, toEarth), 0.0);

  vec3 sunC = vec3(1.0, 0.985, 0.955) * uSunInt;
  vec3 col = alb * sunC * (refl * surge * shadow * vis);

  // sunlight refracted through Earth's atmosphere into the umbra (copper) + earthshine
  vec3 ee = uEarthBody - vPos;
  float de = length(ee);
  float re = asin(min(uEarthR / de, 1.0));
  float dsep = acos(clamp(dot(ee / de, L), -1.0, 1.0));
  float umbra = (1.0 - smoothstep(0.0, 0.25, vis)) * smoothstep(re + uSunAng * 2.0, re - uSunAng, dsep);
  float depthFrac = clamp(dsep / max(re - uSunAng, 1e-4), 0.0, 1.2);
  vec3 copper = mix(vec3(1.0, 0.30, 0.08) * 0.35, vec3(1.0, 0.55, 0.28) * 1.2, smoothstep(0.2, 1.0, depthFrac));
  col += alb * copper * 0.075 * uSunInt * umbra * (0.45 + 0.55 * mue);
  col += alb * vec3(0.62, 0.74, 1.0) * uEarthshine * 0.011 * uSunInt * (0.25 + 0.75 * mue);
  col += alb * 0.0004; // starlight / zodiacal fill so the dark limb is never perfectly flat
  // regolith bounce / scattered light: keeps shadowed ground from being a hard black where the Sun is up nearby
  col += alb * sunC * 0.014 * smoothstep(-0.02, 0.35, pl) * vis;

  // impact visual
  col += vec3(1.0, 0.82, 0.55) * iFlash * 12.0;
  col += vec3(1.0, 0.86, 0.66) * iShock * 0.9;
  col = mix(col, col + alb * sunC * 0.55 * mu0, clamp(iRays, 0.0, 1.0));

  // ---- overlays (display-referred additive, independent of illumination)
  if (uOverlay.y > 0.001) {
    float hm = textureGrad(uHeight, uv, dx, dy).r * 1737400.0;
    float t01 = clamp((hm - uTopoRange.x) / (uTopoRange.y - uTopoRange.x), 0.0, 1.0);
    vec3 ramp = topoRamp(t01);
    // fixed-light hillshade (from the north-west, 38° above the horizon) so relief reads on any date
    float cel = cos(0.6632);
    vec3 Lh = normalize(-0.7071 * cel * E + 0.7071 * cel * N + sin(0.6632) * p);
    vec3 nx = normalize(p - 3.4 * (s.x * E + s.y * N));
    float hs = clamp(dot(nx, Lh), 0.0, 1.0);
    vec3 tcol = ramp * (0.16 + 1.25 * hs) * 0.8;
    // topography is a map layer: it replaces the lighting (also on the night side)
    col = mix(col, tcol, uOverlay.y * 0.94);
    float cg = abs(fract(hm / 1000.0 + 0.5) - 0.5);
    float cw = fwidth(hm / 1000.0);
    float cl = 1.0 - smoothstep(cw * 0.5, cw * 1.5, cg);
    float cg2 = abs(fract(hm / 5000.0 + 0.5) - 0.5);
    float cw2 = fwidth(hm / 5000.0);
    float cl2 = 1.0 - smoothstep(cw2 * 0.5, cw2 * 1.5, cg2);
    col += vec3(0.95, 0.92, 0.85) * (cl * 0.05 + cl2 * 0.12) * uOverlay.y;
  }

  if (uOverlay.x > 0.001) {
    float gl = abs(fract(lonD / 15.0 + 0.5) - 0.5) * 15.0;
    float gt = abs(fract(latD / 15.0 + 0.5) - 0.5) * 15.0;
    float wl = fwidth(gl);
    float wt = fwidth(gt);
    float polar = 1.0 - smoothstep(70.0, 86.0, abs(latD));
    float g = max(gridLine(gl, wl) * polar, gridLine(gt, wt));
    float eq = max(gridLine(abs(lonD), fwidth(lonD)) * polar, gridLine(abs(latD), fwidth(latD)));
    float facing = smoothstep(0.0, 0.25, dot(p, V));
    col += vec3(0.82, 0.90, 1.0) * (g * 0.10 + eq * 0.18) * uOverlay.x * facing;
  }

  if (uOverlay.z > 0.001) {
    float m = textureLod(uMask, uv, 0.0).r;
    float mh = textureLod(uMaskHover, uv, 0.0).r;
    float w = fwidth(m);
    float edge = 1.0 - smoothstep(0.0, max(w * 1.6, 1e-3), abs(m - 0.5));
    float inside = smoothstep(0.45, 0.62, m);
    float wh = fwidth(mh);
    float edgeH = 1.0 - smoothstep(0.0, max(wh * 1.6, 1e-3), abs(mh - 0.5));
    float insideH = smoothstep(0.45, 0.62, mh);
    vec3 mc = uMaskColor;
    col += mc * (edge * 0.85 + inside * 0.07) * uOverlay.z * (0.4 + 0.6 * smoothstep(0.0, 0.3, dot(p, V)));
    col += mc * (edgeH * 0.55 + insideH * 0.05) * uOverlay.z;
    // keep the underlying terrain readable: gentle lift of masked region
    col *= 1.0 + inside * 0.10 * uOverlay.z;
  }

  // reticles / rings anchored to the surface
  for (int i = 0; i < 3; i++) {
    float st = uRingP[i].x;
    if (st > 0.001) {
      float ang = acos(clamp(dot(p, uRing[i].xyz), -1.0, 1.0));
      float aw = max(fwidth(ang), 1e-6);
      float wpx = uRingP[i].y;
      float ring = 1.0 - smoothstep(aw * wpx * 0.5, aw * wpx * 1.2 + 1e-6, abs(ang - uRing[i].w));
      float ring2 = 1.0 - smoothstep(aw * wpx * 0.5, aw * wpx * 1.2 + 1e-6, abs(ang - uRing[i].w * 1.18));
      float tick = 0.0;
      if (uRingP[i].z > 0.5) {
        vec3 c = uRing[i].xyz;
        vec3 e0 = normalize(cross(vec3(0.0, 1.0, 0.0), c) + vec3(1e-6, 0.0, 0.0));
        vec3 n0 = cross(c, e0);
        vec3 q = p - c * dot(p, c);
        float az = atan(dot(q, n0), dot(q, e0)) + uRingP[i].w;
        float sector = abs(fract(az / (PI * 0.5) + 0.5) - 0.5) * (PI * 0.5) * ang;  // arc length from nearest cardinal
        float inBand = smoothstep(uRing[i].w * 0.7, uRing[i].w * 0.95, ang) * (1.0 - smoothstep(uRing[i].w * 1.28, uRing[i].w * 1.45, ang));
        tick = (1.0 - smoothstep(aw * wpx * 0.5, aw * wpx * 1.3, sector)) * inBand;
      }
      float dotc = (1.0 - smoothstep(aw * 2.0, aw * 4.5, ang)) * step(0.5, uRingP[i].z);
      col += vec3(1.0, 0.86, 0.60) * (ring * 0.9 + ring2 * 0.35 + tick * 0.7 + dotc * 0.9) * st;
    }
  }
  if (uPulse.w > 0.001) {
    float ang = acos(clamp(dot(p, uPulse.xyz), -1.0, 1.0));
    col += vec3(1.0, 0.82, 0.52) * exp(-pow(ang / 0.035, 2.0)) * uPulse.w * 0.5;
  }

  fragColor = vec4(col, 1.0);
}
`
