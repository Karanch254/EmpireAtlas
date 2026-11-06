import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { AtmosphereUniforms } from "../atmosphere";
import { ATMOSPHERE_PARS_GLSL, NOISE_GLSL } from "../glsl";
import { setReflectionCameraLayers, WATER_LAYER } from "../layers";
import { SEA_LEVEL } from "../terrain/Terrain";
import { TerrainData } from "../terrain/terrainData";

// Sea surface with true planar reflections (distorted by procedural waves),
// depth-based colour (deep blue -> Red Sea turquoise shallows),
// a soft foam edge, Fresnel and sunrise glitter.
//
// The surface is a finely subdivided mesh (densest around `focus`), not one
// huge quad: on very large triangles, interpolated depth loses precision and
// the seabed can win the depth test, which made the sea flicker to sand.

const DEPTH_RANGE = 8; // metres of water depth encoded in the depth textures

const vertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform mat4 textureMatrix;
varying vec4 vUvR;
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vUvR = textureMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}
`;

const fragmentShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${NOISE_GLSL}
${ATMOSPHERE_PARS_GLSL}
uniform vec3 color;
uniform sampler2D tDiffuse;
uniform sampler2D tDepthDetail;
uniform sampler2D tDepthCoarse;
uniform vec4 detailBounds; // minX, minZ, sizeX, sizeZ
uniform vec4 coarseBounds;
uniform float depthRange;
uniform vec3 sunColor;
uniform vec3 skyColor;
uniform vec3 deepColor;
uniform vec3 shallowColor;
uniform float uTime;
varying vec4 vUvR;
varying vec3 vWorld;

vec2 waveGrad(vec2 p) {
  float e = 0.35;
  float h = ea_noise(p);
  return vec2(ea_noise(p + vec2(e, 0.0)) - h, ea_noise(p + vec2(0.0, e)) - h) / e;
}

float waterDepth(vec2 p) {
  vec2 ud = (p - detailBounds.xy) / detailBounds.zw;
  if (all(greaterThan(ud, vec2(0.0))) && all(lessThan(ud, vec2(1.0)))) {
    return texture2D(tDepthDetail, ud).r * depthRange;
  }
  vec2 uc = (p - coarseBounds.xy) / coarseBounds.zw;
  if (all(greaterThan(uc, vec2(0.0))) && all(lessThan(uc, vec2(1.0)))) {
    return texture2D(tDepthCoarse, uc).r * depthRange;
  }
  return depthRange; // open sea beyond the elevation data
}

void main() {
  #include <logdepthbuf_fragment>
  vec2 p = vWorld.xz;
  float dist = length(cameraPosition - vWorld);
  float t = uTime;
  float depth = waterDepth(p);

  // Swell + chop; finer octaves fade with distance to avoid shimmer, and
  // waves calm down in very shallow water.
  vec2 g = waveGrad(p * 0.012 + vec2(t * 0.02, t * 0.01)) * 0.55;
  g += waveGrad(p * 0.045 - vec2(t * 0.05, -t * 0.03)) * 0.3 * (1.0 - smoothstep(2500.0, 9000.0, dist));
  g += waveGrad(p * 0.17 + vec2(t * 0.09, t * 0.07)) * 0.22 * (1.0 - smoothstep(400.0, 1600.0, dist));
  g += waveGrad(p * 0.6 - vec2(t * 0.15, t * 0.11)) * 0.14 * (1.0 - smoothstep(100.0, 450.0, dist));
  float calm = mix(0.22, 0.09, smoothstep(1000.0, 12000.0, dist)) * mix(0.35, 1.0, smoothstep(0.2, 2.0, depth));
  vec3 n = normalize(vec3(-g.x * calm, 1.0, -g.y * calm));

  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = max(dot(n, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);

  vec2 uv = vUvR.xy / vUvR.w + n.xz * 0.02;
  vec3 refl = texture2D(tDiffuse, uv).rgb;

  vec3 R = reflect(-V, n);
  float glint = pow(max(dot(R, ea_sunDir), 0.0), 700.0) * 25.0
              + pow(max(dot(R, ea_sunDir), 0.0), 60.0) * 0.25;

  // Water body colour by depth: turquoise shallows near the shore, deep blue
  // offshore. The beach edge itself is the real terrain meeting the water.
  vec3 lit = sunColor * max(ea_sunDir.y, 0.0) * 0.6 + skyColor * 0.55;
  vec3 body = mix(shallowColor * lit, deepColor, smoothstep(0.8, 6.0, depth));

  float reflStrength = clamp(fres, 0.0, 1.0) * mix(0.6, 1.0, smoothstep(0.3, 2.0, depth));
  vec3 col = mix(body, refl * 0.75, reflStrength) + sunColor * glint * 0.06;

  // Soft, broken foam line where the water meets the beach.
  float foamBand = 1.0 - smoothstep(0.3, 0.75, depth);
  float foamNoise = smoothstep(0.45, 0.8, ea_noise(p * 0.35 + vec2(t * 0.4, -t * 0.25)));
  float foam = foamBand * foamNoise * (1.0 - smoothstep(600.0, 4000.0, dist));
  col = mix(col, lit * 0.9, foam * 0.28);

  col = ea_applyAtmosphere(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// Elevation data records the sea surface as ~0 m, so it has no usable
// bathymetry. Water depth is estimated from distance to the real coastline
// instead (a chamfer distance transform): shallow turquoise water within a
// couple of hundred metres of the shore, deep water beyond.
const DEPTH_PER_METRE = 0.025;

const depthTexture = (
  heights: Float32Array,
  cols: number,
  rows: number,
  cell: number,
) => {
  const n = cols * rows;
  const dist = new Float32Array(n);
  const INF = 1e9;
  for (let i = 0; i < n; i++) dist[i] = heights[i] >= SEA_LEVEL ? 0 : INF;
  const D1 = 1;
  const D2 = Math.SQRT2;
  const relax = (i: number, j: number, d: number) => {
    if (dist[j] + d < dist[i]) dist[i] = dist[j] + d;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c > 0) relax(i, i - 1, D1);
      if (r > 0) {
        relax(i, i - cols, D1);
        if (c > 0) relax(i, i - cols - 1, D2);
        if (c < cols - 1) relax(i, i - cols + 1, D2);
      }
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      if (c < cols - 1) relax(i, i + 1, D1);
      if (r < rows - 1) {
        relax(i, i + cols, D1);
        if (c < cols - 1) relax(i, i + cols + 1, D2);
        if (c > 0) relax(i, i + cols - 1, D2);
      }
    }
  }
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const d =
      dist[i] === 0
        ? 0
        : Math.min(0.3 + dist[i] * cell * DEPTH_PER_METRE, DEPTH_RANGE);
    const v = Math.round((d / DEPTH_RANGE) * 255);
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, cols, rows);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
};

// Grid lines clustered around `center`: ~60 m apart near it, growing to
// kilometres at the far edges.
const clusteredLines = (
  min: number,
  max: number,
  center: number,
  count: number,
) => {
  const k = 4.2;
  const out: number[] = [];
  for (let i = 0; i <= count; i++) {
    const u = (i / count) * 2 - 1;
    const half = u < 0 ? center - min : max - center;
    out.push(center + (half * Math.sinh(k * u)) / Math.sinh(k));
  }
  return out;
};

// Subdivided plane in the Reflector's local XY plane (normal +Z), which maps
// to world XZ after a -90 degree rotation about X.
const waterGeometry = (
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  focus: THREE.Vector2,
  center: THREE.Vector2,
) => {
  const xs = clusteredLines(minX, maxX, focus.x, 360);
  const zs = clusteredLines(minZ, maxZ, focus.y, 360);
  const cols = xs.length;
  const rows = zs.length;
  const pos = new Float32Array(cols * rows * 3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      pos[i * 3] = xs[c] - center.x;
      pos[i * 3 + 1] = -(zs[r] - center.y);
      pos[i * 3 + 2] = 0;
    }
  }
  const idx = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let k = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      // Counter-clockwise when seen from +Z (above the water). Local y runs
      // opposite to world z, so row r+1 lies at a smaller local y.
      idx[k++] = a;
      idx[k++] = d;
      idx[k++] = b;
      idx[k++] = b;
      idx[k++] = d;
      idx[k++] = e;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
};

export const WaterSurface: React.FC<{
  terrain: TerrainData;
  // World-space rectangle covered by sea (land occludes it naturally).
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  // Where the mesh is most finely subdivided (where the camera flies).
  focus: THREE.Vector2;
  atmosphere: AtmosphereUniforms;
  sunColor: THREE.Color;
  skyColor: THREE.Color;
  deepColor: THREE.Color;
  shallowColor: THREE.Color;
  time: number;
  reflectionScale?: number;
}> = ({
  terrain,
  minX,
  maxX,
  minZ,
  maxZ,
  focus,
  atmosphere,
  sunColor,
  skyColor,
  deepColor,
  shallowColor,
  time,
  reflectionScale = 0.33,
}) => {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const water = useMemo(() => {
    const { meta } = terrain;
    const center = new THREE.Vector2((minX + maxX) / 2, (minZ + maxZ) / 2);
    const geo = waterGeometry(minX, maxX, minZ, maxZ, focus, center);
    const coarseTex = depthTexture(
      terrain.heights,
      meta.mesh.cols,
      meta.mesh.rows,
      meta.widthM / meta.mesh.cols,
    );
    const p = meta.patch;
    const detailTex =
      p && terrain.patchHeights
        ? depthTexture(terrain.patchHeights, p.cols, p.rows, meta.cellSizeM)
        : coarseTex;
    const detailBounds =
      p && terrain.patchHeights
        ? new THREE.Vector4(
            p.minX,
            p.minZ,
            p.cols * meta.cellSizeM,
            p.rows * meta.cellSizeM,
          )
        : new THREE.Vector4(0, 0, -1, -1);
    const r = new Reflector(geo, {
      textureWidth: Math.round(size.width * dpr * reflectionScale),
      textureHeight: Math.round(size.height * dpr * reflectionScale),
      clipBias: 0.003,
      multisample: 0,
      shader: {
        name: "Sea",
        uniforms: {
          color: { value: new THREE.Color(1, 1, 1) },
          tDiffuse: { value: null },
          textureMatrix: { value: new THREE.Matrix4() },
          tDepthDetail: { value: detailTex },
          tDepthCoarse: { value: coarseTex },
          detailBounds: { value: detailBounds },
          coarseBounds: {
            value: new THREE.Vector4(
              meta.minX,
              meta.minZ,
              meta.widthM,
              meta.depthM,
            ),
          },
          depthRange: { value: DEPTH_RANGE },
          sunColor: { value: sunColor },
          skyColor: { value: skyColor },
          deepColor: { value: deepColor },
          shallowColor: { value: shallowColor },
          uTime: { value: 0 },
          ...atmosphere,
        },
        vertexShader,
        fragmentShader,
      },
    });
    r.rotation.x = -Math.PI / 2;
    r.position.set(center.x, SEA_LEVEL, center.y);
    r.frustumCulled = false;
    r.layers.set(WATER_LAYER);
    // The sea's reflection sees normal geometry plus lightweight reflection
    // proxies, never other live mirrors (which would multiply render cost).
    const original = r.getReflectionCamera.bind(r);
    r.getReflectionCamera = (camera: THREE.Camera) => {
      const rc = original(camera);
      setReflectionCameraLayers(rc, true);
      return rc;
    };
    return r;
  }, [
    atmosphere,
    deepColor,
    dpr,
    focus,
    maxX,
    maxZ,
    minX,
    minZ,
    reflectionScale,
    shallowColor,
    size,
    skyColor,
    sunColor,
    terrain,
  ]);

  (water.material as THREE.ShaderMaterial).uniforms.uTime.value = time;

  return <primitive object={water} />;
};
