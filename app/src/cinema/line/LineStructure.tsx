import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { AtmosphereUniforms, withAtmosphere } from "../atmosphere";
import {
  MIRROR_FACADE_LAYER,
  REFLECTION_PROXY_LAYER,
  setReflectionCameraLayers,
} from "../layers";
import { facadeFragmentShader, facadeVertexShader } from "./facadeShader";
import { moduleEdgesWithin } from "./modules";
import { Route } from "./route";

// A conceptual reconstruction of The Line as proposed in July 2022:
// two parallel mirror-clad structures, 500 m tall, 200 m wide overall.
// Each structure is modelled as a 50 m deep slab with a 100 m landscaped
// gap between them.

export type LineDimensions = {
  height: number; // above the graded base
  outerHalfWidth: number; // 100 m -> 200 m overall
  innerHalfWidth: number; // 50 m -> 100 m gap
  footing: number; // how far the facades extend below the base
};

export const LINE_2022_PROPOSAL: LineDimensions = {
  height: 500,
  outerHalfWidth: 100,
  innerHalfWidth: 50,
  footing: 25,
};

const SEGMENT = 150; // metres between geometry rows along the route

type Builder = {
  pos: number[];
  nrm: number[];
  uv: number[];
  idx: number[];
};

const newBuilder = (): Builder => ({ pos: [], nrm: [], uv: [], idx: [] });

const quad = (
  b: Builder,
  v: THREE.Vector3[],
  n: THREE.Vector3,
  uvs: [number, number][],
) => {
  const start = b.pos.length / 3;
  v.forEach((p, i) => {
    b.pos.push(p.x, p.y, p.z);
    b.nrm.push(n.x, n.y, n.z);
    b.uv.push(uvs[i][0], uvs[i][1]);
  });
  b.idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
};

const toGeometry = (b: Builder) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
  g.setIndex(b.idx);
  g.computeBoundingSphere();
  return g;
};

// Vertical wall strip along the route at lateral offset s.
// Unflipped strips face right (south for an eastward route); flip to face left.
const wallStrip = (
  b: Builder,
  route: Route,
  dims: LineDimensions,
  s: number,
  normal: THREE.Vector3,
  flip: boolean,
) => {
  for (let t = 0; t < route.length; t += SEGMENT) {
    const t1 = Math.min(t + SEGMENT, route.length);
    const b0 = route.baseAt(t);
    const b1 = route.baseAt(t1);
    const v = [
      route.point(t, s, b0 - dims.footing),
      route.point(t1, s, b1 - dims.footing),
      route.point(t1, s, b1 + dims.height),
      route.point(t, s, b0 + dims.height),
    ];
    const uvs: [number, number][] = [
      [t, -dims.footing],
      [t1, -dims.footing],
      [t1, dims.height],
      [t, dims.height],
    ];
    if (flip) {
      v.reverse();
      uvs.reverse();
    }
    quad(b, v, normal, uvs);
  }
};

const roofStrip = (
  b: Builder,
  route: Route,
  dims: LineDimensions,
  s0: number,
  s1: number,
  y: (t: number) => number,
) => {
  const up = new THREE.Vector3(0, 1, 0);
  for (let t = 0; t < route.length; t += SEGMENT) {
    const t1 = Math.min(t + SEGMENT, route.length);
    quad(
      b,
      [
        route.point(t, s0, y(t)),
        route.point(t1, s0, y(t1)),
        route.point(t1, s1, y(t1)),
        route.point(t, s1, y(t)),
      ],
      up,
      [
        [t, s0],
        [t1, s0],
        [t1, s1],
        [t, s1],
      ],
    );
  }
};

const endCap = (
  b: Builder,
  route: Route,
  dims: LineDimensions,
  t: number,
  normal: THREE.Vector3,
) => {
  const base = route.baseAt(t);
  const o = dims.outerHalfWidth;
  const v = [
    route.point(t, -o, base - dims.footing),
    route.point(t, o, base - dims.footing),
    route.point(t, o, base + dims.height),
    route.point(t, -o, base + dims.height),
  ];
  const uvs: [number, number][] = [
    [-o, -dims.footing],
    [o, -dims.footing],
    [o, dims.height],
    [-o, dims.height],
  ];
  // Unflipped caps face along the route direction.
  if (normal.dot(route.dir) < 0) {
    v.reverse();
    uvs.reverse();
  }
  quad(b, v, normal, uvs);
};

// Seeded random so every render is identical.
const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Inner facades: stacked terraces, glazing, planting and warm interiors.
const makeInnerTextures = () => {
  const w = 512;
  const h = 1024;
  const rand = mulberry32(42);
  const color = document.createElement("canvas");
  color.width = w;
  color.height = h;
  const emissive = document.createElement("canvas");
  emissive.width = w;
  emissive.height = h;
  const c = color.getContext("2d") as CanvasRenderingContext2D;
  const e = emissive.getContext("2d") as CanvasRenderingContext2D;
  c.fillStyle = "#1b2026";
  c.fillRect(0, 0, w, h);
  e.fillStyle = "#000";
  e.fillRect(0, 0, w, h);
  const floors = 40; // texture covers 120 m x 500 m -> 12.5 m terraces
  for (let i = 0; i < floors; i++) {
    const y = (i / floors) * h;
    const fh = h / floors;
    // Glazing with mullions.
    c.fillStyle = `rgb(${38 + rand() * 20},${48 + rand() * 20},${60 + rand() * 20})`;
    c.fillRect(0, y + fh * 0.25, w, fh * 0.6);
    for (let x = 0; x < w; x += 6 + rand() * 4) {
      c.fillStyle = "rgba(10,12,14,0.6)";
      c.fillRect(x, y + fh * 0.25, 1, fh * 0.6);
      if (rand() < 0.18) {
        e.fillStyle = `rgba(255,${150 + rand() * 60},${80 + rand() * 40},${0.4 + rand() * 0.5})`;
        e.fillRect(x + 1, y + fh * 0.3, 5, fh * 0.5);
      }
    }
    // Terrace slab edge.
    c.fillStyle = "#b9b4aa";
    c.fillRect(0, y + fh * 0.85, w, fh * 0.15);
    // Planting along terrace edges.
    for (let x = 0; x < w; x += 3) {
      if (rand() < 0.55) {
        const g = 60 + rand() * 60;
        c.fillStyle = `rgb(${g * 0.45},${g},${g * 0.35})`;
        const s = 2 + rand() * 6;
        c.fillRect(x, y + fh * 0.85 - s, 3, s);
      }
    }
  }
  const mk = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / 120, 1 / 500);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: mk(color, true), emissiveMap: mk(emissive, true) };
};

export const LineStructure: React.FC<{
  route: Route;
  dims: LineDimensions;
  atmosphere: AtmosphereUniforms;
  sunColor: THREE.Color;
  // Which outer facade gets true (planar) mirror reflections.
  heroSide: "left" | "right";
  reflectionScale?: number;
  // 0 = normal mirror; >0 blends in an illustrative heat-exposure map.
  thermal?: number;
}> = ({
  route,
  dims,
  atmosphere,
  sunColor,
  heroSide,
  reflectionScale = 0.5,
  thermal = 0,
}) => {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  // Hero mirror facade, with true reflections rendered every frame.
  const { reflector, proxy } = useMemo(() => {
    const sign = heroSide === "right" ? 1 : -1;
    const normal =
      heroSide === "right" ? route.left.clone().negate() : route.left.clone();
    const b = newBuilder();
    for (let t = 0; t < route.length; t += SEGMENT) {
      const t1 = Math.min(t + SEGMENT, route.length);
      const y0 = route.baseAt(t);
      const y1 = route.baseAt(t1);
      // Local frame: x = sign * t, y = height, normal = +z (outwards).
      const a = new THREE.Vector3(sign * t, y0 - dims.footing, 0);
      const bTop = new THREE.Vector3(sign * t, y0 + dims.height, 0);
      const c = new THREE.Vector3(sign * t1, y1 + dims.height, 0);
      const d = new THREE.Vector3(sign * t1, y1 - dims.footing, 0);
      quad(
        b,
        sign > 0 ? [a, d, c, bTop] : [a, bTop, c, d],
        new THREE.Vector3(0, 0, 1),
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
        ],
      );
    }
    const geo = toGeometry(b);
    const w = Math.round(size.width * dpr * reflectionScale);
    const h = Math.round(size.height * dpr * reflectionScale);
    const r = new Reflector(geo, {
      textureWidth: w,
      textureHeight: h,
      clipBias: 0.002,
      multisample: 0,
      shader: {
        name: "LineFacade",
        uniforms: {
          color: { value: new THREE.Color(1, 1, 1) },
          tDiffuse: { value: null },
          textureMatrix: { value: new THREE.Matrix4() },
          lineProfile: { value: new THREE.Vector3(...route.profile) },
          lineLength: { value: route.length },
          alongSign: { value: sign },
          thermal: { value: 0 },
          facadeNormal: { value: normal.clone() },
          sunColor: { value: sunColor },
          ...atmosphere,
        },
        vertexShader: facadeVertexShader,
        fragmentShader: facadeFragmentShader,
      },
    });
    const xAxis = route.dir.clone().multiplyScalar(sign);
    const basis = new THREE.Matrix4().makeBasis(
      xAxis,
      new THREE.Vector3(0, 1, 0),
      normal,
    );
    r.quaternion.setFromRotationMatrix(basis);
    r.position.copy(
      route.point(
        0,
        heroSide === "right" ? -dims.outerHalfWidth : dims.outerHalfWidth,
        0,
      ),
    );
    r.frustumCulled = true; // the mirror pass only runs when it is in view
    r.layers.set(MIRROR_FACADE_LAYER);
    // The facade's reflection sees ordinary geometry only (not other mirrors).
    const original = r.getReflectionCamera.bind(r);
    r.getReflectionCamera = (camera: THREE.Camera) => {
      const rc = original(camera);
      setReflectionCameraLayers(rc, false);
      return rc;
    };
    // Cheap stand-in so the facade still appears inside other reflections.
    const proxy = new THREE.Mesh(
      geo,
      withAtmosphere(
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(0.86, 0.9, 0.95),
          metalness: 1,
          roughness: 0.05,
        }),
        atmosphere,
      ),
    );
    proxy.quaternion.copy(r.quaternion);
    proxy.position.copy(r.position);
    proxy.layers.set(REFLECTION_PROXY_LAYER);
    proxy.frustumCulled = true;
    return { reflector: r, proxy };
  }, [atmosphere, dims, dpr, heroSide, reflectionScale, route, size, sunColor]);

  const { geometry, materials } = useMemo(() => {
    const right = route.left.clone().negate();
    const groups: Builder[] = [
      newBuilder(),
      newBuilder(),
      newBuilder(),
      newBuilder(),
    ];
    // 0: mirror glass (the non-hero outer facade + end caps)
    if (heroSide === "right") {
      wallStrip(groups[0], route, dims, dims.outerHalfWidth, route.left, true);
    } else {
      wallStrip(groups[0], route, dims, -dims.outerHalfWidth, right, false);
    }
    endCap(groups[0], route, dims, 0, route.dir.clone().negate());
    endCap(groups[0], route, dims, route.length, route.dir.clone());
    // 1: inner terraced facades facing the gap
    wallStrip(groups[1], route, dims, dims.innerHalfWidth, right, false);
    wallStrip(groups[1], route, dims, -dims.innerHalfWidth, route.left, true);
    // 2: roofs
    const top = (t: number) => route.baseAt(t) + dims.height;
    roofStrip(
      groups[2],
      route,
      dims,
      dims.innerHalfWidth,
      dims.outerHalfWidth,
      top,
    );
    roofStrip(
      groups[2],
      route,
      dims,
      -dims.outerHalfWidth,
      -dims.innerHalfWidth,
      top,
    );
    // 3: landscaped floor of the gap
    roofStrip(
      groups[3],
      route,
      dims,
      -dims.innerHalfWidth,
      dims.innerHalfWidth,
      (t) => route.baseAt(t) + 6,
    );

    // Merge into one geometry with material groups.
    const merged = newBuilder();
    const g = new THREE.BufferGeometry();
    let indexOffset = 0;
    groups.forEach((gb, i) => {
      const vOffset = merged.pos.length / 3;
      merged.pos.push(...gb.pos);
      merged.nrm.push(...gb.nrm);
      merged.uv.push(...gb.uv);
      merged.idx.push(...gb.idx.map((x) => x + vOffset));
      g.addGroup(indexOffset, gb.idx.length, i);
      indexOffset += gb.idx.length;
    });
    g.setAttribute("position", new THREE.Float32BufferAttribute(merged.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(merged.nrm, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(merged.uv, 2));
    g.setIndex(merged.idx);
    g.computeBoundingSphere();

    const inner = makeInnerTextures();
    const mats = [
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.86, 0.9, 0.95),
        metalness: 1,
        roughness: 0.05,
        envMapIntensity: 1.1,
      }),
      new THREE.MeshStandardMaterial({
        map: inner.map,
        emissiveMap: inner.emissiveMap,
        emissive: new THREE.Color(1, 1, 1),
        emissiveIntensity: 0.35,
        roughness: 0.6,
        metalness: 0.2,
      }),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.11, 0.115, 0.125),
        roughness: 0.35,
        metalness: 0.6,
      }),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.1, 0.17, 0.07),
        roughness: 0.95,
      }),
    ].map((m) => withAtmosphere(m, atmosphere));
    return { geometry: g, materials: mats };
  }, [atmosphere, dims, heroSide, route]);

  // Slim brushed-metal fins at every module joint on both outer facades:
  // they give the mirror walls real depth and catch the low sun as thin
  // vertical highlights.
  const fins = useMemo(() => {
    const finWidth = 1.8;
    const finDepth = 2.6;
    const edges = moduleEdgesWithin(route.length);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = withAtmosphere(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.78, 0.8, 0.84),
        metalness: 1,
        roughness: 0.22,
        envMapIntensity: 1.2,
      }),
      atmosphere,
    );
    const mesh = new THREE.InstancedMesh(geo, mat, edges.length * 2);
    const yaw = Math.atan2(-route.dir.z, route.dir.x);
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      yaw,
    );
    let i = 0;
    for (const t of edges) {
      const base = route.baseAt(t);
      const bottom = base - dims.footing;
      const top = base + dims.height + 3;
      for (const side of [1, -1]) {
        const s = side * (dims.outerHalfWidth + finDepth / 2 - 0.5);
        const centre = route.point(t, s, (bottom + top) / 2);
        mesh.setMatrixAt(
          i++,
          new THREE.Matrix4().compose(
            centre,
            q,
            new THREE.Vector3(finWidth, top - bottom, finDepth),
          ),
        );
      }
    }
    mesh.frustumCulled = true;
    return mesh;
  }, [atmosphere, dims, route]);

  (reflector.material as THREE.ShaderMaterial).uniforms.thermal.value = thermal;

  return (
    <>
      <primitive object={reflector} />
      <primitive object={proxy} />
      <mesh geometry={geometry} material={materials} />
      <primitive object={fins} />
    </>
  );
};
