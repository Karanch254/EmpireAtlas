import { ATMOSPHERE_PARS_GLSL, NOISE_GLSL } from "../glsl";
import { MODULE_GLSL } from "./modules";

// Shader for the hero mirror facade, used with three's Reflector, which
// renders the true mirrored scene into tDiffuse every frame.
// Realism comes from breaking up the "perfect mirror":
//  - every 12 x 24 m glass panel is tilted by a tiny fixed random amount,
//  - each structural module (~430-900 m) bows slightly differently,
//  - thin mullions, darker service floors every ~100 m and irregular
//    module joints (matching the 3D fins), all fading out with distance,
//  - a dark structural crown at the top and a podium with warm entrances.

export const facadeVertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform mat4 textureMatrix;
varying vec4 vUvR;
varying vec3 vLocal;
varying vec3 vWorld;
void main() {
  vLocal = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vUvR = textureMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}
`;

export const facadeFragmentShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${NOISE_GLSL}
${ATMOSPHERE_PARS_GLSL}
uniform vec3 color;
uniform sampler2D tDiffuse;
uniform vec3 lineProfile;
uniform float lineLength;
uniform float alongSign;
uniform vec3 facadeNormal;
uniform vec3 sunColor;
// 0 = normal look (Scene 1). >0 blends in a heat-exposure visualisation.
uniform float thermal;
varying vec4 vUvR;
varying vec3 vLocal;
varying vec3 vWorld;

float baseAt(float t) {
  t = clamp(t, 0.0, lineLength);
  return lineProfile.x * t * t + lineProfile.y * t + lineProfile.z;
}

${MODULE_GLSL}

void main() {
  #include <logdepthbuf_fragment>
  float t = vLocal.x * alongSign;
  float h = vLocal.y - baseAt(t);
  float dist = length(cameraPosition - vWorld);

  // Which structural module are we in?
  float k = floor(t / 640.0);
  if (t < moduleEdge(k)) k -= 1.0;
  if (t >= moduleEdge(k + 1.0)) k += 1.0;
  float m0 = moduleEdge(k);
  float m1 = moduleEdge(k + 1.0);
  float mr = ea_hash12(vec2(k, 11.0));
  float mt = (t - m0) / (m1 - m0);

  // Glass panels.
  vec2 cellSize = vec2(12.0, 24.0);
  vec2 q = vec2(t, h) / cellSize;
  vec2 id = floor(q);
  vec2 f = fract(q);
  vec2 rnd = ea_hash22(id + k * 17.13) - 0.5;

  // Per-panel tilt + per-module bow, scaled down with distance so the far
  // facade reads as one continuous mirror.
  float near = 1.0 - smoothstep(4000.0, 22000.0, dist);
  vec2 bow = vec2(sin(mt * 3.14159 + mr * 6.0), sin(h * 0.012 + mr * 4.0)) * 0.0022;
  vec2 off = (rnd * 0.0042 * near) + bow;
  vec2 uv = vUvR.xy / vUvR.w + off;
  vec3 refl = texture2D(tDiffuse, uv).rgb;

  // Fresnel: glass mirrors reflect strongly, more at grazing angles.
  vec3 V = normalize(cameraPosition - vWorld);
  float cosT = abs(dot(V, facadeNormal));
  float fres = 0.78 + 0.22 * pow(1.0 - cosT, 4.0);
  float panelTone = 0.93 + 0.12 * ea_hash12(id + 5.0 + k);
  // Slight per-module variation in glass batch / coating.
  vec3 moduleTint = mix(vec3(0.72, 0.80, 0.88), vec3(0.80, 0.83, 0.86), mr);
  vec3 tint = moduleTint * panelTone;
  vec3 col = refl * tint * fres;

  // Mullions (anti-aliased, faded once they are smaller than a pixel).
  vec2 fw = fwidth(q);
  vec2 w = vec2(0.12 / cellSize.x, 0.16 / cellSize.y);
  vec2 edge = min(f, 1.0 - f);
  vec2 sm = 1.0 - smoothstep(w, w + fw * 1.5, edge);
  float lineFade = 1.0 - smoothstep(0.06, 0.25, max(fw.x, fw.y));
  float mullion = max(sm.x, sm.y) * lineFade;
  vec3 frame = vec3(0.025, 0.027, 0.03);
  col = mix(col, frame, mullion * 0.32);

  // Service floors every ~100 m and module joints.
  float floorH = mod(h + 40.0 + mr * 30.0, 100.0);
  float fwH = fwidth(h);
  float band = 1.0 - smoothstep(3.5, 3.5 + fwH * 1.5, abs(floorH - 50.0));
  float jointW = 1.6 + fwidth(t) * 1.5;
  float joint = (1.0 - smoothstep(1.0, jointW, min(t - m0, m1 - t))) * (1.0 - smoothstep(3000.0, 9000.0, dist));
  vec3 structure = vec3(0.03, 0.03, 0.032);
  col = mix(col, structure, max(band * 0.22 * (1.0 - smoothstep(2500.0, 8000.0, dist)), joint * 0.6));

  // Structural crown: a dark band with louvres at the top of the facade.
  float crown = smoothstep(483.0 - fwH, 483.0 + fwH, h);
  float louvre = step(0.5, fract(t / 4.0)) * (1.0 - smoothstep(0.2, 0.6, fwidth(t / 4.0)));
  vec3 crownCol = refl * 0.18 + vec3(0.03, 0.032, 0.035) * (0.8 + 0.4 * louvre);
  col = mix(col, crownCol, crown);
  // Sun catching the top edge of the facade.
  float coping = 1.0 - smoothstep(1.2, 1.2 + fwH * 2.0, abs(h - 498.8));
  col = mix(col, vec3(0.95, 0.9, 0.85) * sunColor * 0.06, coping * 0.8);

  // Podium: darker glazing at street level with warm entrance lights.
  float podium = 1.0 - smoothstep(18.0 - fwH, 18.0 + fwH, h);
  float lamp = step(0.82, ea_hash12(floor(vec2(t / 9.0, h / 6.0)) + k)) * (1.0 - smoothstep(1500.0, 5000.0, dist));
  vec3 podiumCol = refl * 0.25 + vec3(1.0, 0.62, 0.32) * 0.05 * lamp;
  col = mix(col, podiumCol, podium * step(0.0, h));

  if (thermal > 0.0) {
    // Illustrative heat exposure: sun incidence on the facade, warmer low
    // down where the desert floor re-radiates heat.
    float inc = max(dot(facadeNormal, ea_sunDir), 0.0) + 0.35 * ea_sunDir.y;
    float heat = clamp(inc * 0.9 + (1.0 - smoothstep(0.0, 350.0, h)) * 0.35, 0.0, 1.0);
    vec3 cool = vec3(0.05, 0.12, 0.45);
    vec3 mid = vec3(0.9, 0.75, 0.1);
    vec3 hot = vec3(1.2, 0.18, 0.05);
    vec3 heatCol = heat < 0.5 ? mix(cool, mid, heat * 2.0) : mix(mid, hot, heat * 2.0 - 1.0);
    col = mix(col, heatCol * 0.9, thermal);
  }

  col = ea_applyAtmosphere(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
