// Shared GLSL snippets used by the EmpireAtlas cinematic shaders.

// Deterministic hash / value-noise / fbm (no textures, same result every render).
export const NOISE_GLSL = /* glsl */ `
float ea_hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 ea_hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float ea_noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(ea_hash12(i), ea_hash12(i + vec2(1.0, 0.0)), u.x),
             mix(ea_hash12(i + vec2(0.0, 1.0)), ea_hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float ea_fbm(vec2 p, int octaves) {
  float a = 0.5;
  float s = 0.0;
  mat2 r = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    s += a * ea_noise(p);
    p = r * p;
    a *= 0.5;
  }
  return s;
}
`;

// Height-dependent aerial perspective with sun-direction in-scattering.
// Uses the analytic integral of exponential height fog along the view ray.
export const ATMOSPHERE_PARS_GLSL = /* glsl */ `
uniform vec3 ea_sunDir;
uniform vec3 ea_hazeSun;
uniform vec3 ea_hazeAway;
uniform float ea_hazeDensity;
uniform float ea_hazeFalloff;

vec3 ea_applyAtmosphere(vec3 col, vec3 worldPos) {
  vec3 ro = cameraPosition;
  vec3 rd = worldPos - ro;
  float dist = length(rd);
  rd /= max(dist, 1e-3);
  float b = ea_hazeFalloff;
  float k = rd.y * b * dist;
  float path = abs(k) < 1e-3 ? dist : (1.0 - exp(-k)) / (rd.y * b);
  float fog = ea_hazeDensity * exp(-max(ro.y, 0.0) * b) * path;
  float amt = 1.0 - exp(-fog);
  float sunAmt = pow(max(dot(rd, ea_sunDir), 0.0), 5.0);
  vec3 fogCol = mix(ea_hazeAway, ea_hazeSun, sunAmt);
  return mix(col, fogCol, amt);
}
`;
