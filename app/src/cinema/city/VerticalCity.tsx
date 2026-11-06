import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

// A cutaway of the proposed vertical city (The Line, 2022 proposal): two
// 50 m deep slabs, 500 m tall, either side of a 100 m open-air canyon, with a
// high-speed rail tunnel beneath. The cut is the plane z = 0; the city runs
// back along -z. Programme bands, rooms, furniture and people on the cut are
// drawn procedurally in a shader; terraces, bridges, trees and the train are
// geometry. Everything is deterministic and illustrative.

export const CITY = {
  height: 500,
  inner: 50, // half-width of the canyon
  outer: 100, // half-width overall
  length: 6000, // how far back the model runs
  tunnelY: -52,
  tunnelR: 10,
};

// Programme bands on the cut face (metres above ground).
export const BANDS = {
  parks: [0, 48],
  homes: [48, 200],
  schools: [200, 248],
  offices: [248, 400],
  homesUpper: [400, 500],
};

const GLSL_COMMON = /* glsl */ `
  float h21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x),
               mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  vec3 skyColour(vec3 d) {
    float t = clamp(d.y, -1.0, 1.0);
    vec3 horizon = vec3(0.78, 0.84, 0.9);
    vec3 zenith = vec3(0.2, 0.4, 0.74);
    vec3 ground = vec3(0.55, 0.45, 0.34);
    return t > 0.0 ? mix(horizon, zenith, pow(t, 0.55)) : mix(horizon, ground, min(-t * 6.0, 1.0));
  }
`;

const VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  #include <fog_pars_vertex>
  #include <clipping_planes_pars_vertex>
  varying vec3 vW;
  varying vec3 vN;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = viewMatrix * w;
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
    #include <fog_vertex>
    #include <clipping_planes_vertex>
  }
`;

const fragShell = (uniforms: string, body: string) => /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  #include <fog_pars_fragment>
  #include <clipping_planes_pars_fragment>
  varying vec3 vW;
  varying vec3 vN;
  ${uniforms}
  ${GLSL_COMMON}
  void main() {
    #include <clipping_planes_fragment>
    #include <logdepthbuf_fragment>
    vec3 col = vec3(0.0);
    ${body}
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const shader = (
  body: string,
  uniforms: Record<string, THREE.IUniform> = {},
  decl = "",
  side: THREE.Side = THREE.FrontSide,
) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: fragShell(decl, body),
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, uniforms]),
    fog: true,
    side,
  });

// The cut face of the two slabs: programme bands of lit rooms.
const SECTION_BODY = /* glsl */ `
  float y = vW.y;
  float side = vW.x > 0.0 ? 1.0 : -1.0;
  float u = abs(vW.x) - 50.0; // 0 at the canyon, 50 at the outer facade
  int prog = 1;
  if (y < 48.0) prog = 0;
  else if (y < 200.0) prog = 1;
  else if (y < 248.0) prog = 2;
  else if (y < 400.0) prog = 3;
  float fh = (prog == 0 || prog == 2) ? 8.0 : 4.0;
  float fl = floor(y / fh);
  float fy = fract(y / fh);
  float hy = fy * fh; // height within the storey (m)
  float bayW = prog == 3 ? 12.5 : 8.333;
  float bay = floor(u / bayW);
  float bx = fract(u / bayW);
  float r = h21(vec2(fl + side * 517.0, bay + 3.0));
  vec3 warm = vec3(1.0, 0.58, 0.28);
  vec3 cool = vec3(0.82, 0.9, 1.0);
  vec3 civic = vec3(1.0, 0.8, 0.52);
  vec3 room = prog == 3 ? cool : (prog == 2 ? civic : warm);
  float lit = r < 0.12 ? 0.05 : 0.45 + r * 1.2;
  if (prog == 3) lit *= 1.15;
  col = room * lit * mix(0.45, 1.25, smoothstep(0.2, 0.98, fy));
  // Back wall: a slightly darker band suggests depth into the room.
  col *= 0.85 + 0.15 * smoothstep(0.0, 0.25, abs(bx - 0.5));
  // Floor finish.
  if (hy < 0.75) col = room * lit * 0.32;
  // Furniture silhouettes.
  float rf = h21(vec2(fl * 3.1 + side, bay * 7.7));
  float fx = fract(u / 2.6 + rf * 5.0);
  if (prog != 0 && hy > 0.75 && hy < 1.55 && fx < 0.42 && rf > 0.3) col *= 0.22;
  if (prog == 3 && hy > 1.5 && hy < 1.65 && fx < 0.42) col *= 0.3; // desks
  // People.
  float cell = floor(u / 1.4);
  float rp = h21(vec2(fl * 1.7 + side * 9.0, cell));
  float px = fract(u / 1.4) - 0.5;
  float ph = hy - 0.75;
  float body = step(abs(px), 0.13) * step(0.0, ph) * step(ph, 1.45);
  float head = step(length(vec2(px * 1.4, ph - 1.58)), 0.14);
  if (rp > (prog == 0 ? 0.7 : 0.85) && max(body, head) > 0.5) col = vec3(0.045, 0.04, 0.038) * (prog == 0 ? 2.0 : 1.0);
  // Parks and public spaces at the base: greenery and trees by daylight.
  if (prog == 0) {
    vec3 day = vec3(0.55, 0.62, 0.66);
    vec3 base = mix(day, warm * 0.9, 0.35);
    col = mix(base * mix(0.6, 1.1, fy), col, step(0.5, max(body, head) * step(0.7, rp)));
    vec2 tc = vec2(fract(u / 12.0 + fl * 0.37) - 0.5, hy);
    float crown = step(length(vec2(tc.x * 12.0, (tc.y - 5.0) * 1.15)), 2.6);
    float trunk = step(abs(tc.x * 12.0), 0.25) * step(tc.y, 4.0);
    if (h21(vec2(fl, floor(u / 12.0 + fl * 0.37))) > 0.25) {
      if (crown > 0.5) col = vec3(0.12, 0.26, 0.08) * (0.7 + 0.5 * vnoise(vec2(u, y) * 1.3));
      else if (trunk > 0.5) col = vec3(0.12, 0.08, 0.05);
    }
    if (hy < 0.6) col = vec3(0.16, 0.3, 0.09);
  }
  // Partitions between rooms.
  if (bx < 0.22 / bayW) col = vec3(0.1, 0.095, 0.09);
  // Structural floor slab, lit by daylight.
  float slab = 0.6;
  if (hy < slab) col = vec3(0.34, 0.33, 0.31) * (0.8 + 0.2 * vnoise(vec2(u, y) * 3.0));
  // Facade glass at each edge of the slab.
  if (u < 0.8 || u > 49.2) col = vec3(0.24, 0.3, 0.36);
  // Basements and foundations below ground.
  if (y < 0.0) {
    float b = fract(-y / 4.0);
    col = vec3(0.16, 0.15, 0.14) * (b < 0.12 ? 1.4 : 1.0);
    if (b > 0.3 && h21(vec2(floor(-y / 4.0), floor(u / 8.0))) > 0.5) col += warm * 0.12;
  }
`;

// The canyon-facing facades: glass, floor lines, interiors and planting.
const CANYON_BODY = /* glsl */ `
  vec3 V = normalize(vW - cameraPosition);
  vec3 R = reflect(V, normalize(vN));
  float y = vW.y;
  float z = -vW.z;
  float fl = floor(y / 4.0);
  float fy = fract(y / 4.0);
  float bay = floor(z / 6.0);
  float r = h21(vec2(fl + sign(vW.x) * 311.0, bay));
  vec3 refl = mix(vec3(0.42, 0.46, 0.5), skyColour(R), 0.5) * 0.28;
  vec3 warm = vec3(1.0, 0.6, 0.3);
  vec3 inside = r > 0.5 ? warm * (0.25 + r * 0.6) : vec3(0.05, 0.055, 0.06);
  col = refl + inside * 0.55;
  if (fy < 0.14) col = vec3(0.3, 0.3, 0.29);
  if (fract(z / 6.0) < 0.03) col = vec3(0.12);
  // Vertical gardens in patches.
  float g = h21(vec2(floor(y / 40.0), floor(z / 36.0) + sign(vW.x) * 13.0));
  if (g > 0.62) {
    float leaf = vnoise(vec2(z, y) * 0.9);
    col = mix(col, vec3(0.08, 0.2, 0.06) * (0.6 + leaf), smoothstep(0.35, 0.5, leaf));
  }
  float depthFade = clamp(z / 2500.0, 0.0, 1.0);
  col = mix(col, vec3(0.5, 0.56, 0.62), depthFade * 0.5);
`;

// Mirrored outer facades: sky reflection with a panel grid.
const OUTER_BODY = /* glsl */ `
  vec3 V = normalize(vW - cameraPosition);
  vec3 n = normalize(vN);
  float y = vW.y;
  float z = -vW.z;
  vec2 panel = vec2(floor(z / 3.0), floor(y / 4.0));
  vec3 tilt = (vec3(h21(panel), h21(panel + 7.1), h21(panel + 3.3)) - 0.5) * 0.012;
  float near = 1.0 - smoothstep(250.0, 1400.0, length(vW - cameraPosition));
  vec3 R = reflect(V, normalize(n + tilt * near));
  col = skyColour(R) * 0.58;
  if (fract(y / 4.0) < 0.03 || fract(z / 3.0) < 0.02) col *= mix(1.0, 0.55, near);
  col *= mix(0.9, 1.0, near);
`;

// The earth beneath the cut: strata, and a hole for the rail tunnel.
const EARTH_BODY = /* glsl */ `
  vec2 p = vW.xy;
  if (length(p - vec2(0.0, -52.0)) < 10.0) discard;
  float n = vnoise(vec2(p.x * 0.01, 0.0)) * 6.0 + vnoise(p * vec2(0.03, 0.03)) * 3.0;
  float layer = floor((p.y + n) / 9.0);
  float lh = h21(vec2(layer, 4.0));
  col = mix(vec3(0.3, 0.22, 0.14), vec3(0.5, 0.38, 0.25), lh);
  col *= 0.85 + 0.15 * vnoise(p * vec2(0.4, 1.5));
  if (p.y > -2.5) col = vec3(0.6, 0.47, 0.32);
  // Concrete lining of the tunnel.
  float d = length(p - vec2(0.0, -52.0));
  if (d < 11.5) col = vec3(0.42, 0.41, 0.39);
  // Foundations under the slabs.
  float ax = abs(p.x);
  if (ax > 50.0 && ax < 100.0 && p.y > -26.0) col = vec3(0.3, 0.29, 0.28);
`;

// Tunnel interior, seen from inside the tube.
const TUNNEL_BODY = /* glsl */ `
  float z = -vW.z;
  vec2 c = vW.xy - vec2(0.0, -52.0);
  float a = atan(c.y, c.x);
  col = vec3(0.12, 0.12, 0.13) * (0.6 + 0.4 * sin(a) * 0.5 + 0.2);
  float ring = smoothstep(0.0, 0.04, abs(fract(z / 30.0) - 0.5) - 0.44);
  float strip = smoothstep(0.25, 0.0, abs(a - 1.5708));
  col += vec3(0.9, 0.95, 1.0) * strip * (0.4 + 0.6 * step(fract(z / 12.0), 0.7)) * 1.4;
  col *= 1.0 - 0.35 * (1.0 - ring);
  if (c.y < -7.5) col = vec3(0.08, 0.08, 0.085);
`;

const TRAIN_BODY = /* glsl */ `
  vec3 n = normalize(vN);
  float y = vW.y - (-52.0 - 6.5);
  float z = vW.z;
  vec3 paint = vec3(0.86, 0.87, 0.88) * (0.45 + 0.55 * max(n.y, 0.0) + 0.25 * abs(n.x));
  col = paint;
  float win = step(2.3, y) * step(y, 3.6) * step(0.18, fract(z / 2.2));
  if (abs(n.x) > 0.5 && win > 0.5) col = vec3(1.0, 0.78, 0.5) * 1.6;
  if (z > -1.5 && y > 1.0 && y < 2.2 && abs(vW.x) > 0.6 && abs(vW.x) < 1.6) col = vec3(6.0, 5.6, 5.0);
  if (!gl_FrontFacing) col = vec3(1.0, 0.82, 0.6) * 0.8; // lit interior on the cut
`;

const rng = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const ClippingOn: React.FC = () => {
  const gl = useThree((s) => s.gl);
  gl.localClippingEnabled = true;
  return null;
};

export const VerticalCity: React.FC<{
  trainFront: number; // z of the train's nose (moving towards +z)
}> = ({ trainFront }) => {
  const { group, train } = useMemo(() => {
    const { height: H, inner: IN, outer: OUT, length: LEN } = CITY;
    const group = new THREE.Group();
    const clip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];

    // Cut faces of both slabs.
    const section = shader(SECTION_BODY);
    for (const sgn of [-1, 1]) {
      const g = new THREE.PlaneGeometry(OUT - IN, H + 30);
      const m = new THREE.Mesh(g, section);
      m.position.set((sgn * (OUT + IN)) / 2, (H - 30) / 2, 0);
      group.add(m);
    }
    // Canyon and outer facades.
    const canyon = shader(CANYON_BODY);
    const outer = shader(OUTER_BODY);
    for (const sgn of [-1, 1]) {
      // Face the canyon: the right slab's inner face looks towards -x.
      const c = new THREE.Mesh(new THREE.PlaneGeometry(LEN, H), canyon);
      c.rotation.y = sgn > 0 ? -Math.PI / 2 : Math.PI / 2;
      c.position.set(sgn * IN, H / 2, -LEN / 2);
      group.add(c);
      const o = new THREE.Mesh(new THREE.PlaneGeometry(LEN, H), outer);
      o.rotation.y = sgn > 0 ? Math.PI / 2 : -Math.PI / 2;
      o.position.set(sgn * OUT, H / 2, -LEN / 2);
      group.add(o);
    }
    // Roofs.
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x3f463f,
      roughness: 0.9,
    });
    for (const sgn of [-1, 1]) {
      const roof = new THREE.Mesh(
        new THREE.PlaneGeometry(OUT - IN, LEN),
        roofMat,
      );
      roof.rotation.x = -Math.PI / 2;
      roof.position.set((sgn * (OUT + IN)) / 2, H, -LEN / 2);
      group.add(roof);
    }
    // Canyon floor: a linear park with a water channel.
    const park = new THREE.Mesh(
      new THREE.PlaneGeometry(IN * 2, LEN),
      new THREE.MeshStandardMaterial({ color: 0x3b5a26, roughness: 0.95 }),
    );
    park.rotation.x = -Math.PI / 2;
    park.position.set(0, 0.2, -LEN / 2);
    group.add(park);
    for (const [x, w, c] of [
      [-14, 6, 0xb8ab94],
      [14, 6, 0xb8ab94],
      [0, 8, 0x2c5866],
    ] as const) {
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(w, LEN),
        new THREE.MeshStandardMaterial({
          color: c,
          roughness: c === 0x2c5866 ? 0.15 : 0.9,
          metalness: c === 0x2c5866 ? 0.3 : 0,
        }),
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(x, 0.3, -LEN / 2);
      group.add(strip);
    }

    // Terraces stepping out from the canyon facades, bridges across it,
    // trees and people.
    const rand = rng(23);
    const terraceMat = new THREE.MeshStandardMaterial({
      color: 0xd9d1c3,
      roughness: 0.85,
    });
    const greenMat = new THREE.MeshStandardMaterial({
      color: 0x335a20,
      roughness: 0.95,
    });
    const box = new THREE.BoxGeometry(1, 1, 1);
    const terraces: THREE.Matrix4[] = [];
    const lawns: THREE.Matrix4[] = [];
    const treeSpots: THREE.Vector3[] = [];
    const peopleSpots: THREE.Vector3[] = [];
    const q0 = new THREE.Quaternion();
    for (let i = 0; i < 420; i++) {
      const sgn = rand() < 0.5 ? -1 : 1;
      const depth = 6 + rand() * 12;
      const len = 18 + rand() * 50;
      const y = 8 + Math.floor(rand() * 120) * 4;
      const z = -len / 2 - 4 - Math.pow(rand(), 1.6) * 1800;
      const x = sgn * (IN - depth / 2);
      terraces.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, y - 0.4, z),
          q0,
          new THREE.Vector3(depth, 0.8, len),
        ),
      );
      if (rand() < 0.75) {
        lawns.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(x - sgn * 0.5, y + 0.15, z),
            q0,
            new THREE.Vector3(depth - 2, 0.3, len - 3),
          ),
        );
        const n = Math.floor(len / 9);
        for (let k = 0; k < n; k++) {
          treeSpots.push(
            new THREE.Vector3(
              x + (rand() - 0.5) * (depth - 4),
              y + 0.3,
              z + (k / n - 0.5) * (len - 6),
            ),
          );
        }
      }
      if (z > -500) {
        for (let k = 0; k < 5; k++) {
          peopleSpots.push(
            new THREE.Vector3(
              x + (rand() - 0.5) * (depth - 2),
              y + 0.1,
              z + (rand() - 0.5) * (len - 2),
            ),
          );
        }
      }
    }
    for (let i = 0; i < 70; i++) {
      const y = 30 + Math.floor(rand() * 110) * 4;
      const z = -20 - Math.pow(rand(), 1.4) * 2200;
      terraces.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(0, y, z),
          q0,
          new THREE.Vector3(IN * 2, 1.2, 5 + rand() * 4),
        ),
      );
    }
    const terraceMesh = new THREE.InstancedMesh(
      box,
      terraceMat,
      terraces.length,
    );
    terraces.forEach((m, i) => terraceMesh.setMatrixAt(i, m));
    group.add(terraceMesh);
    const lawnMesh = new THREE.InstancedMesh(box, greenMat, lawns.length);
    lawns.forEach((m, i) => lawnMesh.setMatrixAt(i, m));
    group.add(lawnMesh);
    // Canyon-floor trees and people near the cut.
    for (let i = 0; i < 700; i++) {
      const z = -6 - Math.pow(rand(), 1.3) * 2500;
      const x = (rand() < 0.5 ? -1 : 1) * (22 + rand() * 24);
      treeSpots.push(new THREE.Vector3(x, 0.2, z));
    }
    for (let i = 0; i < 260; i++) {
      const z = -4 - rand() * 380;
      const x = (rand() - 0.5) * 2 * 30;
      peopleSpots.push(new THREE.Vector3(x, 0.3, z));
    }
    const crownGeo = new THREE.IcosahedronGeometry(1, 1);
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0x2f5a1e,
      roughness: 0.9,
      flatShading: true,
    });
    const crowns = new THREE.InstancedMesh(
      crownGeo,
      crownMat,
      treeSpots.length,
    );
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3524 });
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.2, 0.3, 1, 5).translate(0, 0.5, 0),
      trunkMat,
      treeSpots.length,
    );
    treeSpots.forEach((p, i) => {
      const s = 2.2 + rand() * 2.4;
      const th = s * 1.1;
      trunks.setMatrixAt(
        i,
        new THREE.Matrix4().compose(p, q0, new THREE.Vector3(1, th, 1)),
      );
      crowns.setMatrixAt(
        i,
        new THREE.Matrix4().compose(
          p.clone().add(new THREE.Vector3(0, th + s * 0.7, 0)),
          q0,
          new THREE.Vector3(s, s * 0.85, s),
        ),
      );
      crowns.setColorAt(
        i,
        new THREE.Color().setHSL(
          0.26 + rand() * 0.06,
          0.45,
          0.22 + rand() * 0.1,
        ),
      );
    });
    group.add(crowns, trunks);
    const people = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.24, 1.15, 3, 6).translate(0, 0.82, 0),
      new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      peopleSpots.length,
    );
    const clothes = [
      0x2b2b33, 0xd8d2c4, 0x7a3b2a, 0x35506b, 0xa58b5a, 0x1d1d1d,
    ];
    peopleSpots.forEach((p, i) => {
      people.setMatrixAt(
        i,
        new THREE.Matrix4().compose(
          p,
          q0,
          new THREE.Vector3(1, 0.9 + rand() * 0.2, 1),
        ),
      );
      people.setColorAt(
        i,
        new THREE.Color(clothes[Math.floor(rand() * clothes.length)]),
      );
    });
    group.add(people);

    // Earth cut face and tunnel.
    const earth = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 400),
      shader(EARTH_BODY),
    );
    earth.position.set(0, -200, 0);
    group.add(earth);
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(CITY.tunnelR, CITY.tunnelR, LEN, 40, 1, true),
      shader(TUNNEL_BODY, {}, "", THREE.BackSide),
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, CITY.tunnelY, -LEN / 2);
    group.add(tube);

    // Train: a long body with a tapered nose, clipped at the cut.
    const trainMat = shader(TRAIN_BODY, {}, "", THREE.DoubleSide);
    trainMat.clippingPlanes = clip;
    trainMat.clipping = true;
    const train = new THREE.Group();
    const bodyLen = 380;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 4.6, bodyLen),
      trainMat,
    );
    body.position.set(0, 2.3, -bodyLen / 2 - 14);
    train.add(body);
    const nose = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 2.6, 14, 12, 1),
      trainMat,
    );
    nose.rotation.x = Math.PI / 2;
    nose.scale.set(1, 1, 0.85);
    nose.position.set(0, 2.0, -7);
    train.add(nose);
    train.position.y = CITY.tunnelY - 6.5;
    group.add(train);

    for (const child of group.children) child.frustumCulled = false;
    return { group, train };
  }, []);

  train.position.z = trainFront;
  return (
    <>
      <ClippingOn />
      <primitive object={group} />
    </>
  );
};

// Sky dome, distant mountains and desert around the model. The ground in
// front of the cut can be hidden so the section reads cleanly.
const SKY_BODY = /* glsl */ `
  vec3 d = normalize(vW - cameraPosition);
  col = skyColour(d);
  float sun = max(dot(d, normalize(vec3(0.5, 0.55, 0.45))), 0.0);
  col += vec3(1.0, 0.92, 0.8) * (pow(sun, 600.0) * 30.0 + pow(sun, 8.0) * 0.18);
`;

export const SectionEnvironment: React.FC<{ frontGround: boolean }> = ({
  frontGround,
}) => {
  const { sky, ground, uniforms } = useMemo(() => {
    const skyMat = shader(SKY_BODY, {}, "", THREE.BackSide);
    skyMat.fog = false;
    skyMat.depthWrite = false;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(60000, 32, 16), skyMat);
    sky.frustumCulled = false;

    // Desert: a non-uniform grid (fine near the city, coarse far away) with
    // dunes and a ring of mountains on the horizon.
    const N = 260;
    const span = 40000;
    const g = new THREE.PlaneGeometry(1, 1, N, N);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const n2 = (x: number, z: number) =>
      Math.sin(x * 0.0021 + Math.sin(z * 0.0013) * 2) *
        Math.cos(z * 0.0017 - x * 0.0004) +
      0.5 * Math.sin(x * 0.0063 + z * 0.0049);
    for (let i = 0; i < pos.count; i++) {
      const a = pos.getX(i) * 2;
      const b = pos.getZ(i) * 2;
      const x = Math.sign(a) * a * a * span;
      const z = Math.sign(b) * b * b * span;
      const r = Math.hypot(x, z);
      const flat = THREE.MathUtils.smoothstep(Math.abs(x), 160, 700);
      let y = n2(x, z) * 5 * flat;
      const m = THREE.MathUtils.smoothstep(r, 7000, 16000);
      y +=
        m *
        (500 + 900 * (0.5 + 0.5 * n2(x * 0.3, z * 0.3))) *
        (0.6 + 0.4 * Math.sin(Math.atan2(z, x) * 7));
      pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    const uniforms = { hideFront: { value: 1 } };
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc8a57a,
      roughness: 1,
    });
    mat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uniforms);
      s.vertexShader = s.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGW;")
        .replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;",
        );
      s.fragmentShader = s.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vGW;\nuniform float hideFront;",
        )
        .replace(
          "#include <clipping_planes_fragment>",
          "#include <clipping_planes_fragment>\nif (hideFront > 0.5 && vGW.z > 0.0 && abs(vGW.x) < 1200.0) discard;\nif (abs(vGW.x) < 50.0 && vGW.z < 0.0) discard;",
        );
    };
    const ground = new THREE.Mesh(g, mat);
    ground.frustumCulled = false;
    return { sky, ground, uniforms };
  }, []);
  uniforms.hideFront.value = frontGround ? 0 : 1;
  return (
    <>
      <fog attach="fog" args={[0xc4d0da, 2500, 26000]} />
      <primitive object={sky} />
      <primitive object={ground} />
      <hemisphereLight args={[0xbcd3ee, 0xc2ad92, 1.25]} />
      <directionalLight
        position={[5000, 5500, 4500]}
        color={0xf4f2ee}
        intensity={2.2}
      />
    </>
  );
};
