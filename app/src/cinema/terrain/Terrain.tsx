import { useMemo } from "react";
import * as THREE from "three";
import { AtmosphereUniforms, withAtmosphere } from "../atmosphere";
import { MAIN_ONLY_LAYER, REFLECTION_ONLY_LAYER } from "../layers";
import { ATMOSPHERE_PARS_GLSL, NOISE_GLSL } from "../glsl";
import { Route } from "../line/route";
import { TerrainData } from "./terrainData";

// Real-elevation desert terrain with pre-baked mountain shadows, analytic
// shadows from The Line, slope/height-based rock & sand colouring, close-up
// procedural detail, and a simple sea surface.

// Mean sea level used by the water surface. Terrain below it is pushed down
// to a clear seabed so the water and the ground never compete for depth.
export const SEA_LEVEL = 0.4;

// Height used for the mesh: real land heights, and below sea level a seabed
// that falls away four times faster than the data, so the water is clearly
// above it a few metres offshore. The mapping is continuous, so the
// coastline follows the real contour instead of snapping to the grid.
export const meshHeight = (h: number) =>
  h >= SEA_LEVEL ? h : SEA_LEVEL - Math.min(SEA_LEVEL - h, 30) * 4;

export type TerrainLighting = {
  sunColor: THREE.Color; // linear, includes intensity
  skyColor: THREE.Color;
  bounceColor: THREE.Color;
};

export type LineShadowCaster = {
  route: Route;
  halfWidth: number;
  height: number;
};

const vertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}
`;

const fragmentShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${NOISE_GLSL}
${ATMOSPHERE_PARS_GLSL}
uniform sampler2D tLight;
uniform sampler2D tNormal;
uniform sampler2D tSea;
uniform vec3 sunColor;
uniform vec3 skyColor;
uniform vec3 bounceColor;
uniform vec3 lineOrigin;
uniform vec2 lineDir;
uniform float lineLength;
uniform float lineHalfWidth;
uniform float lineHeight;
uniform vec3 lineProfile;
varying vec3 vWorld;
varying vec2 vUv;

float lineBase(float t) {
  t = clamp(t, 0.0, lineLength);
  return lineProfile.x * t * t + lineProfile.y * t + lineProfile.z;
}

// Exact shadow test against The Line's volume (a long box whose top follows
// the graded base profile). The sun ray rises, so if it is ever inside the
// structure, it is lowest where it first enters it.
float lineShadow(vec3 p) {
  vec2 left = vec2(lineDir.y, -lineDir.x);
  vec2 rel = p.xz - lineOrigin.xz;
  float t0 = dot(rel, lineDir);
  float s0 = dot(rel, left);
  float sT = dot(ea_sunDir.xz, lineDir);
  float sS = dot(ea_sunDir.xz, left);
  if (abs(sS) < 1e-5) return 1.0;
  float da = (-lineHalfWidth - s0) / sS;
  float db = (lineHalfWidth - s0) / sS;
  float dIn = max(min(da, db), 0.0);
  float dOut = max(da, db);
  if (dOut <= 0.0) return 1.0;
  if (abs(sT) > 1e-5) {
    float d0 = (0.0 - t0) / sT;
    float d1 = (lineLength - t0) / sT;
    dIn = max(dIn, min(d0, d1));
    dOut = min(dOut, max(d0, d1));
  } else if (t0 < 0.0 || t0 > lineLength) {
    return 1.0;
  }
  if (dIn > dOut) return 1.0;
  float y = p.y + ea_sunDir.y * dIn;
  float top = lineBase(t0 + sT * dIn) + lineHeight;
  return smoothstep(-12.0, 12.0, y - top);
}

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

void main() {
  #include <logdepthbuf_fragment>
  vec3 L = texture2D(tLight, vUv).rgb;
  float sunVis = L.r;
  float skyVis = L.g;
  float slope = L.b / 3.0;
  vec3 N = normalize(texture2D(tNormal, vUv).rgb * 2.0 - 1.0);
  float dist = length(vWorld - cameraPosition);
  vec2 p = vWorld.xz;

  // Close-up surface detail, faded out with distance. Skipped entirely in
  // the lighter variant used inside reflections (TERRAIN_LITE).
  #ifdef TERRAIN_LITE
  float detail = 0.0;
  #else
  float detail = 1.0 - smoothstep(1500.0, 9000.0, dist);
  #endif
  if (detail > 0.0) {
    // Gentle undulation + gravel grain; the fine grain fades out before it
    // becomes smaller than a pixel to avoid shimmering.
    float e = 4.0;
    float h0 = ea_fbm(p * 0.012, 3);
    float hx = ea_fbm((p + vec2(e, 0.0)) * 0.012, 3);
    float hz = ea_fbm((p + vec2(0.0, e)) * 0.012, 3);
    float grainFade = 1.0 - smoothstep(250.0, 900.0, dist);
    float g0 = ea_noise(p * 0.18);
    float gx = ea_noise((p + vec2(1.0, 0.0)) * 0.18);
    float gz = ea_noise((p + vec2(0.0, 1.0)) * 0.18);
    vec3 dn = vec3(-(hx - h0) * 1.6 - (gx - g0) * 0.25 * grainFade, 0.0,
                   -(hz - h0) * 1.6 - (gz - g0) * 0.25 * grainFade);
    N = normalize(N + dn * detail);
  }

  // Desert palette: pale gravel plains, ochre sand, red-brown rock.
  float n1 = ea_fbm(p * 0.00035, 4);
  float n2 = ea_fbm(p * 0.0032, 3);
  float n3 = ea_noise(p * 0.045);
  float elev = vWorld.y;
  vec3 plain = mix(toLinear(vec3(0.80, 0.66, 0.50)), toLinear(vec3(0.86, 0.73, 0.57)), n1);
  vec3 sand = toLinear(vec3(0.83, 0.60, 0.40));
  vec3 rock = mix(toLinear(vec3(0.42, 0.27, 0.19)), toLinear(vec3(0.27, 0.18, 0.14)), n2);
  vec3 highRock = toLinear(vec3(0.50, 0.38, 0.30));
  float sandMask = smoothstep(0.45, 0.75, n2 + n1 * 0.4) * (1.0 - smoothstep(0.02, 0.08, slope));
  float rockMask = smoothstep(0.05, 0.20, slope + (n2 - 0.5) * 0.08 + smoothstep(300.0, 900.0, elev) * 0.12);
  vec3 albedo = mix(plain, sand, sandMask * 0.6);
  albedo = mix(albedo, mix(rock, highRock, smoothstep(900.0, 1800.0, elev)), rockMask);
  albedo *= 0.82 + 0.36 * mix(0.5, n3, detail);

  // Weathered dark "desert varnish" patches on gravel plains.
  float varnish = smoothstep(0.56, 0.74, ea_fbm(p * 0.0011 + 7.3, 3)) * (1.0 - rockMask);
  albedo = mix(albedo, albedo * vec3(0.66, 0.58, 0.52), varnish * 0.55);
  // Geological strata on rock faces, and darker crevices / gullies.
  float strata = 0.86 + 0.28 * smoothstep(-0.35, 0.35, sin(elev * 0.055 + n2 * 6.0 + n1 * 3.0));
  albedo *= mix(1.0, strata, rockMask);
  albedo *= mix(1.0, mix(0.62, 1.0, smoothstep(0.35, 0.85, skyVis)), rockMask);

  // Soft ground occlusion along the foot of The Line's facades.
  {
    vec2 relL = vWorld.xz - lineOrigin.xz;
    float tL = dot(relL, lineDir);
    float sL = abs(dot(relL, vec2(lineDir.y, -lineDir.x)));
    if (tL > -200.0 && tL < lineLength + 200.0) {
      float dEdge = max(sL - lineHalfWidth, 0.0);
      albedo *= mix(0.55, 1.0, smoothstep(0.0, 70.0, dEdge));
    }
  }

  // Darker wet sand just above the waterline.
  albedo *= mix(0.55, 1.0, smoothstep(0.4, 2.2, elev));

  float shadow = sunVis;
  if (shadow > 0.0) shadow *= lineShadow(vWorld + vec3(0.0, 1.0, 0.0));
  float ndl = max(dot(N, ea_sunDir), 0.0);
  vec3 col = albedo * (
    sunColor * ndl * shadow +
    skyColor * skyVis * (0.55 + 0.45 * N.y) +
    bounceColor * (1.0 - N.y) * 0.5
  );

  // Sea: deep water with sky reflection and sunrise glitter.
  float sea = texture2D(tSea, vUv).r;
  if (sea > 0.01 && vWorld.y < 0.0) {
    vec3 V = normalize(cameraPosition - vWorld);
    vec2 wp = p * 0.08;
    vec3 wn = normalize(vec3((ea_noise(wp) - 0.5) * 0.35 + (ea_noise(wp * 3.1) - 0.5) * 0.15, 1.0,
                             (ea_noise(wp + 17.0) - 0.5) * 0.35 + (ea_noise(wp * 3.1 + 5.0) - 0.5) * 0.15));
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(V, wn), 0.0), 5.0);
    vec3 R = reflect(-V, wn);
    vec3 skyRefl = mix(ea_hazeAway, ea_hazeSun, pow(max(dot(R, ea_sunDir), 0.0), 4.0)) * 0.6;
    float glint = pow(max(dot(R, ea_sunDir), 0.0), 900.0) * 60.0;
    vec3 water = toLinear(vec3(0.02, 0.10, 0.16)) * skyColor * 1.5;
    vec3 seaCol = mix(water, skyRefl, fres) + sunColor * glint * 0.05;
    col = mix(col, seaCol, smoothstep(0.2, 0.8, sea));
  }

  col = ea_applyAtmosphere(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

// Regular grid of height samples -> square tiles of indexed triangles.
// Each tile has its own bounding sphere, so three.js skips tiles outside a
// camera's view (main camera and each mirror camera independently).
// `step` > 1 builds a lighter version using every step-th sample.
// UVs map into the lighting textures, which cover the full terrain extent.
const gridTiles = (
  data: TerrainData,
  heights: Float32Array,
  cols: number,
  rows: number,
  minX: number,
  minZ: number,
  cell: number,
  step: number,
  lowerInside?: Bounds,
  tileCells = 64,
) => {
  const { meta } = data;
  const tiles: THREE.BufferGeometry[] = [];
  const lastC = cols - 1;
  const lastR = rows - 1;
  const span = tileCells * step;
  for (let tr = 0; tr < lastR; tr += span) {
    for (let tc = 0; tc < lastC; tc += span) {
      const cs: number[] = [];
      const rs: number[] = [];
      for (let c = tc; c < Math.min(tc + span, lastC); c += step) cs.push(c);
      cs.push(Math.min(tc + span, lastC));
      for (let r = tr; r < Math.min(tr + span, lastR); r += step) rs.push(r);
      rs.push(Math.min(tr + span, lastR));
      const w = cs.length;
      const h = rs.length;
      const positions = new Float32Array(w * h * 3);
      const uvs = new Float32Array(w * h * 2);
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const r = rs[j];
          const c = cs[i];
          const v = j * w + i;
          const x = minX + (c + 0.5) * cell;
          const z = minZ + (r + 0.5) * cell;
          let y = meshHeight(heights[r * cols + c]);
          // Sink the coarse mesh under the detail patch so the patch wins.
          if (
            lowerInside &&
            x > lowerInside.minX &&
            x < lowerInside.maxX &&
            z > lowerInside.minZ &&
            z < lowerInside.maxZ
          ) {
            y -= 6;
          }
          positions[v * 3] = x;
          positions[v * 3 + 1] = y;
          positions[v * 3 + 2] = z;
          uvs[v * 2] = (x - meta.minX) / meta.widthM;
          uvs[v * 2 + 1] = (z - meta.minZ) / meta.depthM;
        }
      }
      const index = new Uint32Array((w - 1) * (h - 1) * 6);
      let k = 0;
      for (let j = 0; j < h - 1; j++) {
        for (let i = 0; i < w - 1; i++) {
          const a = j * w + i;
          const b = a + 1;
          const d = a + w;
          const e = d + 1;
          index[k++] = a;
          index[k++] = d;
          index[k++] = b;
          index[k++] = b;
          index[k++] = d;
          index[k++] = e;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      g.setIndex(new THREE.BufferAttribute(index, 1));
      g.computeBoundingSphere();
      tiles.push(g);
    }
  }
  return tiles;
};

const buildGeometries = (data: TerrainData, reflectionStep: number) => {
  const { meta } = data;
  const p = meta.patch;
  const bounds =
    p && data.patchHeights
      ? {
          minX: p.minX,
          maxX: p.minX + p.cols * meta.cellSizeM,
          minZ: p.minZ,
          maxZ: p.minZ + p.rows * meta.cellSizeM,
        }
      : undefined;
  const coarseCell = meta.widthM / meta.mesh.cols;
  const coarse = gridTiles(
    data,
    data.heights,
    meta.mesh.cols,
    meta.mesh.rows,
    meta.minX,
    meta.minZ,
    coarseCell,
    1,
    bounds,
  );
  const detail =
    p && data.patchHeights
      ? gridTiles(
          data,
          data.patchHeights,
          p.cols,
          p.rows,
          p.minX,
          p.minZ,
          meta.cellSizeM,
          1,
        )
      : [];
  // Lighter terrain seen only by mirror cameras (reflections are distorted
  // by waves and glass panels, so the extra detail is not visible there).
  const reflection =
    reflectionStep > 0
      ? gridTiles(
          data,
          data.heights,
          meta.mesh.cols,
          meta.mesh.rows,
          meta.minX,
          meta.minZ,
          coarseCell,
          reflectionStep,
        )
      : [];
  return { main: [...coarse, ...detail], reflection };
};

export const Terrain: React.FC<{
  data: TerrainData;
  atmosphere: AtmosphereUniforms;
  lighting: TerrainLighting;
  caster: LineShadowCaster;
  // 0 = mirrors see the full main terrain; N = mirrors see every N-th sample.
  reflectionStep?: number;
}> = ({ data, atmosphere, lighting, caster, reflectionStep = 0 }) => {
  const { main, reflection } = useMemo(
    () => buildGeometries(data, reflectionStep),
    [data, reflectionStep],
  );
  const material = useMemo(() => {
    const { route } = caster;
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        ...atmosphere,
        tLight: { value: data.lightTex },
        tNormal: { value: data.normalTex },
        tSea: { value: data.seaTex },
        sunColor: { value: lighting.sunColor },
        skyColor: { value: lighting.skyColor },
        bounceColor: { value: lighting.bounceColor },
        lineOrigin: { value: route.origin },
        lineDir: { value: new THREE.Vector2(route.dir.x, route.dir.z) },
        lineLength: { value: route.length },
        lineHalfWidth: { value: caster.halfWidth },
        lineHeight: { value: caster.height },
        lineProfile: { value: new THREE.Vector3(...route.profile) },
      },
    });
  }, [atmosphere, caster, data, lighting]);

  const meshes = useMemo(() => {
    const mainLayer = reflectionStep > 0 ? MAIN_ONLY_LAYER : 0;
    const out: THREE.Mesh[] = [];
    for (const g of main) {
      const m = new THREE.Mesh(g, material);
      m.layers.set(mainLayer);
      out.push(m);
    }
    const lite = material.clone();
    lite.defines = { ...lite.defines, TERRAIN_LITE: 1 };
    for (const g of reflection) {
      const m = new THREE.Mesh(g, lite);
      m.layers.set(REFLECTION_ONLY_LAYER);
      out.push(m);
    }
    return out;
  }, [main, reflection, material, reflectionStep]);

  const farMaterial = useMemo(
    () =>
      withAtmosphere(
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.8, 0.62, 0.45).multiplyScalar(0.35),
        }),
        atmosphere,
      ),
    [atmosphere],
  );

  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      {/* Distant desert floor beyond the elevation data, lost in haze. */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, -60, 0]}
        material={farMaterial}
      >
        <planeGeometry args={[600000, 600000]} />
      </mesh>
    </>
  );
};
