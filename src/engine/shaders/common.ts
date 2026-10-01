/** GLSL snippets shared between the Moon, Earth and sky shaders. */
export const GLSL_COMMON = /* glsl */ `
const float PI = 3.14159265359;
const float TAU = 6.28318530718;

// selenographic/geographic direction -> equirectangular uv (v=0 at north, u=0.5 at lon 0, east to the right)
vec2 dirToUV(vec3 d) {
  float lon = atan(-d.z, d.x);
  float lat = asin(clamp(d.y, -1.0, 1.0));
  return vec2(lon / TAU + 0.5, 0.5 - lat / PI);
}

// fraction of a disc (angular radius rs) covered by an occluding disc (radius re) at centre separation d
float discOverlap(float rs, float re, float d) {
  if (d >= rs + re) return 0.0;
  if (d <= abs(re - rs)) return re >= rs ? 1.0 : (re * re) / (rs * rs);
  float rs2 = rs * rs;
  float re2 = re * re;
  float a = (d * d + rs2 - re2) / (2.0 * d * rs);
  float b = (d * d + re2 - rs2) / (2.0 * d * re);
  float k = (-d + rs + re) * (d + rs - re) * (d - rs + re) * (d + rs + re);
  float area = rs2 * acos(clamp(a, -1.0, 1.0)) + re2 * acos(clamp(b, -1.0, 1.0)) - 0.5 * sqrt(max(k, 0.0));
  return clamp(area / (PI * rs2), 0.0, 1.0);
}

// 1 = Sun fully visible from P, 0 = fully hidden by the sphere (centre oc, radius orad)
float sunVisibility(vec3 P, vec3 sunDir, vec3 oc, float orad, float sunAng) {
  vec3 e = oc - P;
  float de = length(e);
  float re = asin(min(orad / de, 1.0));
  float d = acos(clamp(dot(e / de, sunDir), -1.0, 1.0));
  return 1.0 - discOverlap(sunAng, re, d);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1, 0, 0));
  float n010 = hash13(i + vec3(0, 1, 0));
  float n110 = hash13(i + vec3(1, 1, 0));
  float n001 = hash13(i + vec3(0, 0, 1));
  float n101 = hash13(i + vec3(1, 0, 1));
  float n011 = hash13(i + vec3(0, 1, 1));
  float n111 = hash13(i + vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

float fbm3(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise3(p);
    p = p * 2.03 + vec3(7.1, 3.7, 5.3);
    a *= 0.5;
  }
  return s;
}
`
