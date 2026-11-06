import * as THREE from "three";
import { staticFile } from "remotion";

// Loads terrain prepared by tools/prepare-terrain.py.
// World axes: x = east (m), y = up (m above sea level), z = south (m).

export type TerrainMeta = {
  source: string;
  cellSizeM: number;
  widthM: number;
  depthM: number;
  minX: number;
  minZ: number;
  mesh: { cols: number; rows: number; file: string };
  // Optional full-resolution patch where cameras fly low.
  patch?: {
    cols: number;
    rows: number;
    minX: number;
    minZ: number;
    file: string;
  };
  light: { cols: number; rows: number };
  heightRange: [number, number];
  route: {
    bearingDeg: number;
    lengthM: number;
    baseProfile: [number, number, number];
    note: string;
  };
  sun: { azimuthDeg: number; elevationDeg: number };
};

export type TerrainData = {
  meta: TerrainMeta;
  heights: Float32Array;
  patchHeights: Float32Array | null;
  lightTex: THREE.Texture;
  normalTex: THREE.Texture;
  seaTex: THREE.Texture;
  heightAt: (x: number, z: number) => number;
};

const loadTexture = async (url: string) => {
  const tex = await new THREE.TextureLoader().loadAsync(url);
  tex.flipY = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

// The elevation data has pixel-level noise along the shore, which turns the
// coastline into stair-steps up close. Gently smooth only cells near sea
// level; inland relief is untouched.
const smoothCoast = (h: Float32Array, cols: number, rows: number) => {
  // The data's sea floor jumps straight to deep values at the shore; treat
  // it as shallow sea before smoothing so the contour forms natural curves.
  let src = h.map((v) => Math.max(v, -2));
  for (let pass = 0; pass < 4; pass++) {
    const out = new Float32Array(src);
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        const i = r * cols + c;
        if (Math.abs(src[i]) > 6) continue;
        let sum = 0;
        let w = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const k = dr === 0 && dc === 0 ? 4 : dr === 0 || dc === 0 ? 2 : 1;
            sum += src[i + dr * cols + dc] * k;
            w += k;
          }
        }
        out[i] = sum / w;
      }
    }
    src = out;
  }
  return src;
};

export const loadTerrain = async (folder: string): Promise<TerrainData> => {
  const meta: TerrainMeta = await (
    await fetch(staticFile(`${folder}/meta.json`))
  ).json();
  const buffer = await (
    await fetch(staticFile(`${folder}/${meta.mesh.file}`))
  ).arrayBuffer();
  const heights = new Float32Array(buffer);
  const patchHeights = meta.patch
    ? smoothCoast(
        new Float32Array(
          await (
            await fetch(staticFile(`${folder}/${meta.patch.file}`))
          ).arrayBuffer(),
        ),
        meta.patch.cols,
        meta.patch.rows,
      )
    : null;
  const [lightTex, normalTex, seaTex] = await Promise.all([
    loadTexture(staticFile(`${folder}/light.png`)),
    loadTexture(staticFile(`${folder}/normals.png`)),
    loadTexture(staticFile(`${folder}/sea.png`)),
  ]);

  const { cols, rows } = meta.mesh;
  const cell = meta.widthM / cols;
  const bilinear = (
    data: Float32Array,
    gc: number,
    gr: number,
    c: number,
    r: number,
  ) => {
    const c0 = Math.floor(c);
    const r0 = Math.floor(r);
    const fc = c - c0;
    const fr = r - r0;
    const h = (rr: number, cc: number) => data[rr * gc + cc];
    return (
      h(r0, c0) * (1 - fc) * (1 - fr) +
      h(r0, c0 + 1) * fc * (1 - fr) +
      h(r0 + 1, c0) * (1 - fc) * fr +
      h(r0 + 1, c0 + 1) * fc * fr
    );
  };

  const heightAt = (x: number, z: number) => {
    const p = meta.patch;
    if (p && patchHeights) {
      const pc = (x - p.minX) / meta.cellSizeM - 0.5;
      const pr = (z - p.minZ) / meta.cellSizeM - 0.5;
      if (pc >= 0 && pr >= 0 && pc < p.cols - 1.001 && pr < p.rows - 1.001) {
        return bilinear(patchHeights, p.cols, p.rows, pc, pr);
      }
    }
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

  return { meta, heights, patchHeights, lightTex, normalTex, seaTex, heightAt };
};

export const sunDirection = (azimuthDeg: number, elevationDeg: number) => {
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  return new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    -Math.cos(az) * Math.cos(el),
  ).normalize();
};
