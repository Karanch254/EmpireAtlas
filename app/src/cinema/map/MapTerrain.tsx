import { useMemo } from "react";
import * as THREE from "three";
import { staticFile } from "remotion";
import { NOISE_GLSL } from "../glsl";

// Wide-area relief terrain for map-style shots (prepared by
// tools/prepare-region.py). Real elevation and seabed relief, baked
// sun/sky lighting, optional NASA Blue Marble surface colour, vertical
// exaggeration for legibility at continental scale.

export type RegionMeta = {
  cellSizeM: number;
  widthM: number;
  depthM: number;
  minX: number;
  minZ: number;
  mesh: { cols: number; rows: number; file: string };
  heightRange: [number, number];
  sun: { azimuthDeg: number; elevationDeg: number };
  origin: { lon: number; lat: number };
  lines?: string;
};

export type RegionLines = {
  coast: [number, number][][];
  lakes: [number, number][][];
  countries: Record<string, [number, number][][]>;
};

export type RegionData = {
  meta: RegionMeta;
  heights: Float32Array;
  light: THREE.Texture;
  normals: THREE.Texture;
  lines: RegionLines | null;
  heightAt: (x: number, z: number) => number;
};

const tex = async (url: string, srgb = false) => {
  const t = await new THREE.TextureLoader().loadAsync(url);
  t.flipY = false;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
};

export const loadRegion = async (folder: string): Promise<RegionData> => {
  const meta: RegionMeta = await (
    await fetch(staticFile(`${folder}/meta.json`))
  ).json();
  const heights = new Float32Array(
    await (
      await fetch(staticFile(`${folder}/${meta.mesh.file}`))
    ).arrayBuffer(),
  );
  const [light, normals] = await Promise.all([
    tex(staticFile(`${folder}/light.png`)),
    tex(staticFile(`${folder}/normals.png`)),
  ]);
  const lines: RegionLines | null = meta.lines
    ? await (await fetch(staticFile(`${folder}/${meta.lines}`))).json()
    : null;
  const { cols, rows } = meta.mesh;
  const cell = meta.widthM / cols;
  const heightAt = (x: number, z: number) => {
    const c = Math.min(Math.max((x - meta.minX) / cell - 0.5, 0), cols - 1.001);
    const r = Math.min(Math.max((z - meta.minZ) / cell - 0.5, 0), rows - 1.001);
    const c0 = Math.floor(c);
    const r0 = Math.floor(r);
    const fc = c - c0;
    const fr = r - r0;
    const h = (rr: number, cc: number) => heights[rr * cols + cc];
    return (
      h(r0, c0) * (1 - fc) * (1 - fr) +
      h(r0, c0 + 1) * fc * (1 - fr) +
      h(r0 + 1, c0) * (1 - fc) * fr +
      h(r0 + 1, c0 + 1) * fc * fr
    );
  };
  return { meta, heights, light, normals, lines, heightAt };
};

export const loadBlueMarble = () =>
  tex(staticFile("earth/bluemarble-200401-5400.jpg"), true);

const vertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float exaggeration;
varying vec3 vWorld;
varying vec2 vUv;
varying float vH;
void main() {
  vUv = uv;
  vH = position.y;
  vec3 p = vec3(position.x, position.y * exaggeration, position.z);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}
`;

const fragmentShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${NOISE_GLSL}
uniform sampler2D tLight;
uniform sampler2D tNormal;
uniform sampler2D tAlbedo;
uniform bool useAlbedo;
uniform vec4 merc; // originMercX, originMercY, scale, earthRadius
uniform float exaggeration;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 skyColor;
uniform vec3 hazeColor;
uniform float hazeDensity;
uniform float coolGrade;
#ifdef SHORELINE
uniform float seaLevel;
uniform float exposedFrom;
uniform vec4 contourLevels;
uniform vec4 contourDashed;
uniform vec3 contourColor0;
uniform vec3 contourColor1;
uniform vec3 contourColor2;
uniform vec3 contourColor3;
uniform vec3 exposedColor;
#endif
varying vec3 vWorld;
varying vec2 vUv;
varying float vH;

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

void main() {
  #include <logdepthbuf_fragment>
  vec3 L = texture2D(tLight, vUv).rgb;
  vec3 n = texture2D(tNormal, vUv).rgb * 2.0 - 1.0;
  vec3 N = normalize(vec3(n.x * exaggeration, n.y, n.z * exaggeration));
  float slope = L.b / 3.0;
  vec2 p = vWorld.xz;

  vec3 albedo;
  if (useAlbedo) {
    float mx = p.x / merc.z + merc.x;
    float my = -p.y / merc.z + merc.y;
    float lon = mx / merc.w;
    float lat = 2.0 * atan(exp(my / merc.w)) - 1.5707963;
    albedo = texture2D(tAlbedo, vec2(lon / 6.2831853 + 0.5, 0.5 - lat / 3.1415927)).rgb;
    albedo *= 0.92 + 0.16 * ea_fbm(p * 0.00004, 4);
  } else {
    float n1 = ea_fbm(p * 0.00012, 4);
    vec3 plain = mix(toLinear(vec3(0.78, 0.64, 0.48)), toLinear(vec3(0.86, 0.74, 0.58)), n1);
    vec3 rock = mix(toLinear(vec3(0.42, 0.30, 0.22)), toLinear(vec3(0.30, 0.21, 0.16)), ea_fbm(p * 0.0011, 3));
    float rockMask = smoothstep(0.04, 0.16, slope + smoothstep(400.0, 1400.0, vH) * 0.1);
    albedo = mix(plain, rock, rockMask);
  }

  float sunVis = L.r;
  float ndl = max(dot(N, sunDir), 0.0);
  vec3 col;
#ifdef SHORELINE
  // Inland sea whose surface is not at 0 m (e.g. the Caspian): water where
  // the measured bed lies below the chosen water level.
  float wl = seaLevel;
  float shallowEnd = 0.5;
  float deepEnd = 600.0;
#else
  float wl = 0.0;
  float shallowEnd = 5.0;
  float deepEnd = 900.0;
#endif
  if (vH < wl) {
    // Sea: depth tint over the real seabed relief.
    float depth = wl - vH;
    vec3 shallow = toLinear(vec3(0.10, 0.45, 0.50));
    vec3 deep = toLinear(vec3(0.01, 0.06, 0.14));
    vec3 water = mix(shallow, deep, smoothstep(shallowEnd, deepEnd, depth));
#ifdef SHORELINE
    // Very shallow water (a few metres, like the north Caspian) reads lighter.
    water = mix(toLinear(vec3(0.36, 0.66, 0.60)), water, smoothstep(0.0, 8.0, depth));
#endif
    if (useAlbedo) water = mix(water, albedo, 0.35);
    float relief = 0.75 + 0.5 * ndl;
    col = water * (sunColor * 0.25 * relief + skyColor * 0.6);
  } else {
    col = albedo * (sunColor * ndl * sunVis + skyColor * L.g * (0.55 + 0.45 * N.y));
  }

#ifdef SHORELINE
  // Seabed exposed since a reference level (between the reference and the
  // current water level), and level contours (solid = measured, dashed =
  // projection). Contour width is constant on screen (fwidth).
  if (vH >= wl && vH < exposedFrom) {
    float t = clamp((vH - wl) / max(exposedFrom - wl, 0.01), 0.0, 1.0);
    col = mix(col, exposedColor * (0.55 + 0.45 * ndl * sunVis), 0.78 - 0.18 * t);
  }
  float fw = max(fwidth(vH), 1e-4);
  vec3 cc[4];
  cc[0] = contourColor0; cc[1] = contourColor1; cc[2] = contourColor2; cc[3] = contourColor3;
  for (int i = 0; i < 4; i++) {
    float lv = contourLevels[i];
    if (lv > 9000.0) continue;
    float line = 1.0 - smoothstep(0.6, 1.6, abs(vH - lv) / fw);
    if (contourDashed[i] > 0.5) line *= step(0.45, fract((p.x + p.y) / 6000.0));
    col = mix(col, cc[i], line);
  }
#endif
  // Light aerial haze by distance, and an optional cool cartographic grade.
  float d = length(vWorld - cameraPosition);
  col = mix(col, hazeColor, 1.0 - exp(-d * hazeDensity));
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum) * vec3(0.86, 0.95, 1.12), coolGrade);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const buildTiles = (data: RegionData, step: number, tileCells = 64) => {
  const { meta, heights } = data;
  const { cols, rows } = meta.mesh;
  const cell = meta.widthM / cols;
  const out: THREE.BufferGeometry[] = [];
  const span = tileCells * step;
  for (let tr = 0; tr < rows - 1; tr += span) {
    for (let tc = 0; tc < cols - 1; tc += span) {
      const cs: number[] = [];
      const rs: number[] = [];
      for (let c = tc; c < Math.min(tc + span, cols - 1); c += step) cs.push(c);
      cs.push(Math.min(tc + span, cols - 1));
      for (let r = tr; r < Math.min(tr + span, rows - 1); r += step) rs.push(r);
      rs.push(Math.min(tr + span, rows - 1));
      const w = cs.length;
      const h = rs.length;
      const pos = new Float32Array(w * h * 3);
      const uv = new Float32Array(w * h * 2);
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const v = j * w + i;
          const x = meta.minX + (cs[i] + 0.5) * cell;
          const z = meta.minZ + (rs[j] + 0.5) * cell;
          pos[v * 3] = x;
          pos[v * 3 + 1] = heights[rs[j] * cols + cs[i]];
          pos[v * 3 + 2] = z;
          uv[v * 2] = (x - meta.minX) / meta.widthM;
          uv[v * 2 + 1] = (z - meta.minZ) / meta.depthM;
        }
      }
      const idx = new Uint32Array((w - 1) * (h - 1) * 6);
      let k = 0;
      for (let j = 0; j < h - 1; j++) {
        for (let i = 0; i < w - 1; i++) {
          const a = j * w + i;
          idx[k++] = a;
          idx[k++] = a + w;
          idx[k++] = a + 1;
          idx[k++] = a + 1;
          idx[k++] = a + w;
          idx[k++] = a + w + 1;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.computeBoundingSphere();
      out.push(g);
    }
  }
  return out;
};

export type MapLook = {
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  skyColor: THREE.Color;
  hazeColor: THREE.Color;
  hazeDensity: number;
  coolGrade: number;
};

export type ShorelineSpec = {
  level: number; // water level, metres (same datum as the terrain data)
  exposedFrom?: number; // shade seabed between this level and `level`
  contours?: { level: number; color: THREE.Color; dashed?: boolean }[]; // max 4
  exposedColor?: THREE.Color;
};

export const MapTerrain: React.FC<{
  data: RegionData;
  look: MapLook;
  exaggeration?: number;
  albedo?: THREE.Texture | null;
  step?: number;
  // Optional: inland-sea water level and level contours (Caspian). When
  // omitted the shader is compiled exactly as before.
  shoreline?: ShorelineSpec;
}> = ({ data, look, exaggeration = 1, albedo = null, step = 1, shoreline }) => {
  const tiles = useMemo(() => buildTiles(data, step), [data, step]);
  const material = useMemo(() => {
    const R = 6378137;
    const { lon, lat } = data.meta.origin;
    const ox = R * THREE.MathUtils.degToRad(lon);
    const oy =
      R * Math.log(Math.tan(Math.PI / 4 + THREE.MathUtils.degToRad(lat) / 2));
    // Bounding spheres assume unexaggerated heights; scaling is small enough
    // relative to tile size that culling stays safe.
    const sl = shoreline;
    const c = sl?.contours ?? [];
    const lev = (i: number) => (c[i] ? c[i].level : 9999);
    const extra: Record<string, THREE.IUniform> = sl
      ? {
          seaLevel: { value: sl.level },
          exposedFrom: { value: sl.exposedFrom ?? sl.level },
          contourLevels: {
            value: new THREE.Vector4(lev(0), lev(1), lev(2), lev(3)),
          },
          contourDashed: {
            value: new THREE.Vector4(
              ...[0, 1, 2, 3].map((i) => (c[i]?.dashed ? 1 : 0)),
            ),
          },
          contourColor0: { value: c[0]?.color ?? new THREE.Color(1, 1, 1) },
          contourColor1: { value: c[1]?.color ?? new THREE.Color(1, 1, 1) },
          contourColor2: { value: c[2]?.color ?? new THREE.Color(1, 1, 1) },
          contourColor3: { value: c[3]?.color ?? new THREE.Color(1, 1, 1) },
          exposedColor: {
            value: sl.exposedColor ?? new THREE.Color(0.85, 0.55, 0.18),
          },
        }
      : {};
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      ...(sl ? { defines: { SHORELINE: "" } } : {}),
      uniforms: {
        ...extra,
        tLight: { value: data.light },
        tNormal: { value: data.normals },
        tAlbedo: { value: albedo },
        useAlbedo: { value: !!albedo },
        merc: {
          value: new THREE.Vector4(
            ox,
            oy,
            Math.cos(THREE.MathUtils.degToRad(lat)),
            R,
          ),
        },
        exaggeration: { value: exaggeration },
        sunDir: { value: look.sunDir },
        sunColor: { value: look.sunColor },
        skyColor: { value: look.skyColor },
        hazeColor: { value: look.hazeColor },
        hazeDensity: { value: look.hazeDensity },
        coolGrade: { value: look.coolGrade },
      },
    });
  }, [albedo, data, exaggeration, look, shoreline]);
  return (
    <>
      {tiles.map((g, i) => (
        <mesh key={i} geometry={g} material={material} />
      ))}
    </>
  );
};

// Longitude/latitude -> world position (same projection as the region data).
export const lonLatToWorld = (
  meta: RegionMeta,
  lon: number,
  lat: number,
  y = 0,
) => {
  const R = 6378137;
  const merc = (lo: number, la: number) => [
    R * THREE.MathUtils.degToRad(lo),
    R * Math.log(Math.tan(Math.PI / 4 + THREE.MathUtils.degToRad(la) / 2)),
  ];
  const [ox, oy] = merc(meta.origin.lon, meta.origin.lat);
  const [mx, my] = merc(lon, lat);
  const k = Math.cos(THREE.MathUtils.degToRad(meta.origin.lat));
  return new THREE.Vector3((mx - ox) * k, y, -(my - oy) * k);
};
