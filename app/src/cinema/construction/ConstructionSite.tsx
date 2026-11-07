import { useMemo } from "react";
import * as THREE from "three";
import { AtmosphereUniforms, withAtmosphere } from "../atmosphere";
import { Route } from "../line/route";

// A generic, illustrative foundation works site along The Line's route:
// a graded strip, rows of foundation piles, spoil heaps, excavators and
// piling rigs. Deterministic; machines animate from the frame number.
// `bury` (0..1) lets windblown sand cover the site: piles sink below the
// surface and the machinery fades out.

const rng = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Machine = {
  root: THREE.Group;
  cab: THREE.Group;
  boom: THREE.Group;
  arm: THREE.Group;
  phase: number;
};

const makeExcavator = (paint: THREE.Material, dark: THREE.Material) => {
  const box = (w: number, h: number, d: number, m: THREE.Material) =>
    new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const root = new THREE.Group();
  for (const z of [-1.4, 1.4]) {
    const track = box(5.2, 1.1, 0.9, dark);
    track.position.set(0, 0.55, z);
    root.add(track);
  }
  const cab = new THREE.Group();
  cab.position.y = 1.3;
  const body = box(3.8, 1.5, 2.9, paint);
  body.position.set(-0.6, 0.75, 0);
  cab.add(body);
  const cabin = box(1.5, 1.6, 1.1, dark);
  cabin.position.set(0.5, 2.2, 0.85);
  cab.add(cabin);
  const boom = new THREE.Group();
  boom.position.set(1.0, 1.4, -0.3);
  const b = box(5.6, 0.6, 0.55, paint);
  b.position.x = 2.8;
  boom.add(b);
  const arm = new THREE.Group();
  arm.position.x = 5.5;
  const a = box(0.5, 3.6, 0.45, paint);
  a.position.y = -1.8;
  arm.add(a);
  const bucket = box(1.1, 0.9, 1.0, dark);
  bucket.position.y = -3.7;
  arm.add(bucket);
  boom.add(arm);
  cab.add(boom);
  root.add(cab);
  return { root, cab, boom, arm };
};

const makeRig = (paint: THREE.Material, dark: THREE.Material) => {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 3.4), dark);
  base.position.y = 0.8;
  g.add(base);
  const house = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 3), paint);
  house.position.set(-1, 2.7, 0);
  g.add(house);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.8, 26, 0.8), paint);
  mast.position.set(2.4, 14, 0);
  g.add(mast);
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 0.3), dark);
  brace.position.set(0.9, 6, 0);
  brace.rotation.z = -0.35;
  g.add(brace);
  return g;
};

export const ConstructionSite: React.FC<{
  route: Route;
  heightAt: (x: number, z: number) => number;
  atmosphere: AtmosphereUniforms;
  frame: number;
  t0?: number;
  t1?: number;
  bury?: number;
  // Route-space position of a hero excavator the camera can frame.
  heroT?: number;
  heroS?: number;
  // false: an abandoned site - machinery gone, only piles and spoil remain.
  showMachines?: boolean;
}> = ({
  route,
  heightAt,
  atmosphere,
  frame,
  t0 = 1200,
  t1 = 3600,
  bury = 0,
  heroT = 1350,
  heroS = -62,
  showMachines = true,
}) => {
  const site = useMemo(() => {
    const rand = rng(41);
    const group = new THREE.Group();
    const at = (t: number, s: number, lift = 0) => {
      const p = route.point(t, s, 0);
      p.y = heightAt(p.x, p.z) + lift;
      return p;
    };
    const fadeMats: THREE.Material[] = [];
    const std = (color: number, rough = 0.85, metal = 0) => {
      const m = withAtmosphere(
        new THREE.MeshStandardMaterial({
          color,
          roughness: rough,
          metalness: metal,
          envMapIntensity: 0.15,
          transparent: true,
        }),
        atmosphere,
      );
      fadeMats.push(m);
      return m;
    };

    // Graded strip following the terrain.
    const W = 150;
    const segT = Math.ceil((t1 - t0 + 200) / 10);
    const segS = Math.ceil(W / 10);
    const g = new THREE.PlaneGeometry(1, 1, segT, segS);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5;
      const v = pos.getY(i) + 0.5;
      const p = at(t0 - 100 + u * (t1 - t0 + 200), (v - 0.5) * W, 0.35);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    g.computeVertexNormals();
    const cols: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const u =
        (pos.getX(i) - route.origin.x) * route.dir.x +
        (pos.getZ(i) - route.origin.z) * route.dir.z;
      const v =
        (pos.getX(i) - route.origin.x) * route.left.x +
        (pos.getZ(i) - route.origin.z) * route.left.z;
      const n =
        0.88 +
        0.12 * Math.sin(u * 0.05 + Math.sin(v * 0.3) * 2) * Math.cos(v * 0.21);
      const track = Math.abs((((v % 12) + 12) % 12) - 6) < 0.8 ? 0.9 : 1;
      cols.push(n * track, n * track, n * track);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    const padMat = std(0xe0a56c, 1);
    padMat.side = THREE.DoubleSide;
    (padMat as THREE.MeshStandardMaterial).vertexColors = true;
    const pad = new THREE.Mesh(g, padMat);
    group.add(pad);

    // Foundation piles: rows under each of the two slabs.
    const pileTops: THREE.Matrix4[] = [];
    const rows = [-45, -30, -15, 15, 30, 45];
    const q = new THREE.Quaternion();
    for (const s of rows) {
      for (let t = t0; t <= t1; t += 6.5) {
        const h = 0.5 + rand() * 1.0;
        const p = at(t + (rand() - 0.5) * 0.6, s + (rand() - 0.5) * 0.6, 0.35);
        p.y += h / 2;
        pileTops.push(
          new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, h, 1)),
        );
      }
    }
    const pileMat = std(0xe6dccb, 0.9);
    const piles = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.7, 0.7, 1, 10),
      pileMat,
      pileTops.length,
    );
    pileTops.forEach((m, i) => piles.setMatrixAt(i, m));
    const rebarMat = std(0x6b4a33, 0.7, 0.4);
    (rebarMat as THREE.MeshStandardMaterial).wireframe = true;
    const rebar = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 3, true),
      rebarMat,
      pileTops.length,
    );
    pileTops.forEach((m, i) => {
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      const sc = new THREE.Vector3().setFromMatrixScale(m);
      rebar.setMatrixAt(
        i,
        new THREE.Matrix4().compose(
          p.clone().add(new THREE.Vector3(0, sc.y / 2 + 0.6, 0)),
          q,
          new THREE.Vector3(1, 1.2, 1),
        ),
      );
    });
    const pileGroup = new THREE.Group();
    pileGroup.add(piles, rebar);
    group.add(pileGroup);

    // Spoil heaps along both edges.
    const heapMat = std(0xe8ad72, 1);
    const heapGeo = new THREE.SphereGeometry(
      1,
      14,
      7,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    const heapList: THREE.Matrix4[] = [];
    for (const side of [-1, 1]) {
      for (let t = t0; t <= t1; t += 30 + rand() * 40) {
        const r = 8 + rand() * 10;
        const p = at(t, side * (78 + rand() * 12), 0);
        p.y -= 0.6;
        heapList.push(
          new THREE.Matrix4().compose(
            p,
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler(0, rand() * 6, 0),
            ),
            new THREE.Vector3(r, r * 0.32, r * (0.8 + rand() * 0.4)),
          ),
        );
      }
    }
    const heaps = new THREE.InstancedMesh(heapGeo, heapMat, heapList.length);
    heapList.forEach((m, i) => heaps.setMatrixAt(i, m));
    group.add(heaps);
    const equipment: THREE.Object3D[] = [];

    // Machines.
    const paint = std(0xc9a227, 0.55, 0.1);
    const dark = std(0x2a2826, 0.8, 0.2);
    const machines: Machine[] = [];
    const yaw = Math.atan2(-route.dir.z, route.dir.x);
    for (let i = 0; i < 7; i++) {
      const e = makeExcavator(paint, dark);
      let t = t0 + 150 + i * ((t1 - t0 - 300) / 6) + (rand() - 0.5) * 80;
      let s = (i % 2 ? 1 : -1) * (58 + rand() * 10);
      if (i === 0) [t, s] = [heroT, heroS];
      e.root.position.copy(at(t, s, 0.35));
      e.root.rotation.y =
        yaw + (s > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.6;
      group.add(e.root);
      equipment.push(e.root);
      machines.push({ ...e, phase: rand() * 10 });
    }
    for (let i = 0; i < 3; i++) {
      const r = makeRig(paint, dark);
      const t = t0 + 500 + i * 900 + rand() * 100;
      r.position.copy(at(t, i % 2 ? 22 : -22, 0.35));
      r.rotation.y = yaw + (rand() - 0.5) * 0.4;
      group.add(r);
      equipment.push(r);
    }
    for (const c of group.children) c.frustumCulled = false;
    return { group, machines, pileGroup, fadeMats, padMat, equipment };
  }, [route, heightAt, atmosphere, t0, t1, heroT, heroS]);

  for (const m of site.machines) {
    const a = frame * 0.035 + m.phase;
    m.cab.rotation.y = Math.sin(a) * 0.9;
    m.boom.rotation.z = 0.25 + Math.sin(a * 1.7) * 0.18;
    m.arm.rotation.z = -0.5 + Math.sin(a * 1.7 + 1.2) * 0.35;
  }
  const b = THREE.MathUtils.clamp(bury, 0, 1);
  site.pileGroup.position.y = -4.5 * b;
  for (const mat of site.fadeMats) {
    mat.opacity =
      mat === site.padMat ? 1 - b : 1 - THREE.MathUtils.smoothstep(b, 0.2, 0.8);
    mat.depthWrite = mat.opacity > 0.99;
  }
  site.group.visible = b < 1;
  for (const e of site.equipment) e.visible = showMachines;
  return <primitive object={site.group} />;
};
