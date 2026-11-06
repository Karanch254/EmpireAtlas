import { useMemo } from "react";
import * as THREE from "three";
import { AtmosphereUniforms, withAtmosphere } from "../atmosphere";

// A generic, procedural desert village: low flat-roofed plastered houses,
// compound walls, a few lit windows and date palms, placed on the real
// terrain. Deterministic (seeded) and deliberately non-specific: it is not a
// reconstruction of any real home.

const rng = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const PLASTER = [0xcbb89a, 0xbfa985, 0xd6cab2, 0xb59c7a, 0xc8b08c].map(
  (c) => new THREE.Color(c),
);

// A drooping, tapered palm frond along +X.
const frondGeometry = (length: number, width: number) => {
  const seg = 6;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const x = u * length;
    const y = 0.25 * length * u - 0.6 * length * u * u;
    const w = width * Math.sin(Math.PI * Math.min(u * 1.15, 1)) * (1 - u * 0.4);
    pos.push(x, y, -w, x, y - w * 0.25, 0, x, y, w);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 3;
    const b = a + 3;
    idx.push(
      a,
      b,
      a + 1,
      a + 1,
      b,
      b + 1,
      a + 1,
      b + 1,
      a + 2,
      a + 2,
      b + 1,
      b + 2,
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

export const Settlement: React.FC<{
  centre: THREE.Vector2; // world x, z
  radius: number;
  heightAt: (x: number, z: number) => number;
  atmosphere: AtmosphereUniforms;
  houses?: number;
  palms?: number;
  seed?: number;
  litFraction?: number;
}> = ({
  centre,
  radius,
  heightAt,
  atmosphere,
  houses = 46,
  palms = 110,
  seed = 7,
  litFraction = 0.45,
}) => {
  const root = useMemo(() => {
    const rand = rng(seed);
    const group = new THREE.Group();
    const grid = rand() * Math.PI; // a common street orientation
    const cosG = Math.cos(grid);
    const sinG = Math.sin(grid);

    type Box = {
      x: number;
      z: number;
      w: number;
      d: number;
      h: number;
      rot: number;
      col: THREE.Color;
      y: number;
    };
    const boxes: Box[] = [];
    const footprints: { x: number; z: number; r: number }[] = [];
    const groundUnder = (
      x: number,
      z: number,
      w: number,
      d: number,
      rot: number,
    ) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (const [a, b] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
        [0, 0],
      ]) {
        const lx = (a * w) / 2;
        const lz = (b * d) / 2;
        const h = heightAt(
          x + lx * Math.cos(rot) + lz * Math.sin(rot),
          z - lx * Math.sin(rot) + lz * Math.cos(rot),
        );
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
      return { lo, hi };
    };

    let tries = 0;
    while (footprints.length < houses && tries++ < houses * 40) {
      // Cluster houses along a few loose lanes.
      const lane = Math.floor(rand() * 4) - 1.5;
      const along = (rand() * 2 - 1) * radius;
      const across = lane * radius * 0.28 + (rand() - 0.5) * radius * 0.18;
      const x = centre.x + along * cosG - across * sinG;
      const z = centre.y + along * sinG + across * cosG;
      if (Math.hypot(x - centre.x, z - centre.y) > radius) continue;
      const w = 8 + rand() * 9;
      const d = 7 + rand() * 7;
      const rot = -grid + (rand() - 0.5) * 0.12;
      const r = Math.hypot(w, d) / 2 + 5;
      if (footprints.some((f) => Math.hypot(f.x - x, f.z - z) < f.r + r))
        continue;
      const g = groundUnder(x, z, w + 8, d + 8, rot);
      if (g.lo < 2 || g.hi - g.lo > 4) continue; // no sea, no steep slopes
      footprints.push({ x, z, r });
      const col = PLASTER[Math.floor(rand() * PLASTER.length)].clone();
      col.offsetHSL(0, 0, (rand() - 0.5) * 0.05);
      const storeys = rand() < 0.25 ? 2 : 1;
      const h = storeys * 3.4 + 0.6 + rand() * 0.6 + (g.hi - g.lo);
      const y = g.lo - 0.6;
      boxes.push({ x, z, w, d, h, rot, col, y });
      // Parapet-like roof slab, slightly darker.
      boxes.push({
        x,
        z,
        w: w + 0.3,
        d: d + 0.3,
        h: 0.35,
        rot,
        col: col.clone().multiplyScalar(0.88),
        y: y + h,
      });
      // Compound wall around some houses.
      if (rand() < 0.45) {
        const cw = w + 8 + rand() * 6;
        const cd = d + 8 + rand() * 6;
        const wallCol = col.clone().multiplyScalar(0.92);
        const wh = 1.9 + (g.hi - g.lo);
        for (const [ox, oz, ww, dd] of [
          [0, -cd / 2, cw, 0.4],
          [0, cd / 2, cw, 0.4],
          [-cw / 2, 0, 0.4, cd],
          [cw / 2, 0, 0.4, cd * 0.6],
        ]) {
          boxes.push({
            x: x + ox * Math.cos(rot) + oz * Math.sin(rot),
            z: z - ox * Math.sin(rot) + oz * Math.cos(rot),
            w: ww,
            d: dd,
            h: wh,
            rot,
            col: wallCol,
            y: g.lo - 0.4,
          });
        }
      }
    }

    // Houses, roofs and walls in one instanced mesh.
    const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const houseMat = withAtmosphere(
      new THREE.MeshStandardMaterial({
        roughness: 0.92,
        metalness: 0,
        envMapIntensity: 0.15,
      }),
      atmosphere,
    );
    const houseMesh = new THREE.InstancedMesh(unit, houseMat, boxes.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    boxes.forEach((b, i) => {
      q.setFromAxisAngle(yAxis, b.rot);
      m.compose(
        new THREE.Vector3(b.x, b.y, b.z),
        q,
        new THREE.Vector3(b.w, b.h, b.d),
      );
      houseMesh.setMatrixAt(i, m);
      houseMesh.setColorAt(i, b.col);
    });
    group.add(houseMesh);

    // Windows and doors: small dark openings, some warmly lit.
    const openings: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    const lit = new THREE.Color(1.0, 0.58, 0.26).multiplyScalar(2.6);
    const dark = new THREE.Color(0.035, 0.03, 0.028);
    for (const b of boxes) {
      if (b.h < 3) continue; // skip roofs and walls
      const base = b.y + 0.6;
      for (let face = 0; face < 4; face++) {
        const along = face % 2 === 0 ? b.w : b.d;
        const depth = face % 2 === 0 ? b.d : b.w;
        const n = Math.max(1, Math.floor(along / 4.5));
        const ang = b.rot + (face * Math.PI) / 2;
        for (let k = 0; k < n; k++) {
          if (rand() < 0.3) continue;
          const off = (k + 0.5) / n - 0.5;
          const lx = off * along;
          const lz = depth / 2 + 0.06;
          const wx = b.x + lx * Math.cos(ang) + lz * Math.sin(ang);
          const wz = b.z - lx * Math.sin(ang) + lz * Math.cos(ang);
          const door = k === 0 && face === 0;
          const sy = door ? 2.1 : 1.3;
          const wy = door ? base + 1.05 : base + 1.9;
          q.setFromAxisAngle(yAxis, ang);
          const mm = new THREE.Matrix4().compose(
            new THREE.Vector3(wx, wy, wz),
            q,
            new THREE.Vector3(door ? 1.1 : 1.2, sy, 1),
          );
          openings.push({
            m: mm,
            c: !door && rand() < litFraction ? lit : dark,
          });
        }
      }
    }
    const winMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const winMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      winMat,
      openings.length,
    );
    openings.forEach((o, i) => {
      winMesh.setMatrixAt(i, o.m);
      winMesh.setColorAt(i, o.c);
    });
    group.add(winMesh);

    // Date palms, mostly between and around the houses.
    const trunks: THREE.Matrix4[] = [];
    const fronds: THREE.Matrix4[] = [];
    let placed = 0;
    tries = 0;
    while (placed < palms && tries++ < palms * 40) {
      // Most palms stand in small groves beside the houses.
      const a = rand() * Math.PI * 2;
      const home =
        rand() < 0.75 && footprints.length > 0
          ? footprints[Math.floor(rand() * footprints.length)]
          : null;
      const r = home ? home.r + rand() * 18 : Math.sqrt(rand()) * radius * 1.15;
      const x = (home ? home.x : centre.x) + Math.cos(a) * r;
      const z = (home ? home.z : centre.y) + Math.sin(a) * r;
      if (footprints.some((f) => Math.hypot(f.x - x, f.z - z) < f.r - 3))
        continue;
      const h0 = heightAt(x, z);
      if (h0 < 1.5) continue;
      placed++;
      const height = 7 + rand() * 6;
      const lean = new THREE.Quaternion().setFromEuler(
        new THREE.Euler((rand() - 0.5) * 0.14, 0, (rand() - 0.5) * 0.14),
      );
      trunks.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, h0 - 0.5, z),
          lean,
          new THREE.Vector3(1, height + 0.5, 1),
        ),
      );
      const top = new THREE.Vector3(0, height, 0)
        .applyQuaternion(lean)
        .add(new THREE.Vector3(x, h0, z));
      const count = 9 + Math.floor(rand() * 4);
      const spin = rand() * Math.PI * 2;
      for (let k = 0; k < count; k++) {
        const fq = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            0,
            spin + (k / count) * Math.PI * 2 + (rand() - 0.5) * 0.3,
            0.15 + rand() * 0.45,
            "YXZ",
          ),
        );
        const s = 0.85 + rand() * 0.3;
        fronds.push(
          new THREE.Matrix4().compose(top, fq, new THREE.Vector3(s, s, s)),
        );
      }
    }
    const bark = withAtmosphere(
      new THREE.MeshStandardMaterial({
        color: 0x4a3a2a,
        roughness: 0.95,
        envMapIntensity: 0.1,
      }),
      atmosphere,
    );
    const trunkMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.2, 0.3, 1, 6).translate(0, 0.5, 0),
      bark,
      trunks.length,
    );
    trunks.forEach((t, i) => trunkMesh.setMatrixAt(i, t));
    group.add(trunkMesh);
    const leaf = withAtmosphere(
      new THREE.MeshStandardMaterial({
        color: 0x3d4a24,
        roughness: 0.85,
        side: THREE.DoubleSide,
        envMapIntensity: 0.1,
      }),
      atmosphere,
    );
    const frondMesh = new THREE.InstancedMesh(
      frondGeometry(5.8, 0.85),
      leaf,
      fronds.length,
    );
    fronds.forEach((f, i) => frondMesh.setMatrixAt(i, f));
    group.add(frondMesh);

    for (const child of group.children) child.frustumCulled = false;
    return group;
  }, [centre, radius, heightAt, atmosphere, houses, palms, seed, litFraction]);

  return <primitive object={root} />;
};
