import { useMemo } from "react";
import * as THREE from "three";
import { AtmosphereUniforms, withAtmosphere } from "../atmosphere";

// Boulders and desert scrub scattered around a region, for close-up scale
// and parallax during low flights. Deterministic placement.

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const rockGeometry = (seed: number) => {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const rand = mulberry32(seed);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const offsets = Array.from({ length: 6 }, () => [
    rand() * 2 - 1,
    rand() * 2 - 1,
    rand() * 2 - 1,
    0.15 + rand() * 0.25,
  ]);
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    let k = 1;
    for (const [x, y, z, a] of offsets) {
      k += a * Math.max(0, v.dot(new THREE.Vector3(x, y, z).normalize()));
    }
    v.multiplyScalar(k * 0.7);
    v.y *= 0.55;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
};

export type ScatterArea = {
  center: THREE.Vector3;
  radius: number;
};

export const GroundScatter: React.FC<{
  areas: ScatterArea[];
  heightAt: (x: number, z: number) => number;
  isSea: (x: number, z: number) => boolean;
  avoid: (x: number, z: number) => boolean;
  atmosphere: AtmosphereUniforms;
  rocks: number;
  shrubs: number;
}> = ({ areas, heightAt, isSea, avoid, atmosphere, rocks, shrubs }) => {
  const meshes = useMemo(() => {
    const rand = mulberry32(7);
    const place = (count: number, minS: number, maxS: number, sink: number) => {
      const out: THREE.Matrix4[] = [];
      let tries = 0;
      while (out.length < count && tries < count * 20) {
        tries++;
        const a = areas[Math.floor(rand() * areas.length)];
        const ang = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * a.radius;
        const x = a.center.x + Math.cos(ang) * r;
        const z = a.center.z + Math.sin(ang) * r;
        if (isSea(x, z) || avoid(x, z)) continue;
        const s = minS * Math.pow(maxS / minS, Math.pow(rand(), 2.2));
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(x, heightAt(x, z) - s * sink, z),
          new THREE.Quaternion().setFromEuler(
            new THREE.Euler(rand() * 0.3, rand() * Math.PI * 2, rand() * 0.3),
          ),
          new THREE.Vector3(
            s * (0.8 + rand() * 0.6),
            s,
            s * (0.8 + rand() * 0.6),
          ),
        );
        out.push(m);
      }
      return out;
    };

    const rockMat = withAtmosphere(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.32, 0.21, 0.15),
        roughness: 0.95,
      }),
      atmosphere,
    );
    const shrubMat = withAtmosphere(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.17, 0.155, 0.1),
        roughness: 1,
      }),
      atmosphere,
    );
    const rockMatrices = place(rocks, 1.2, 14, 0.25);
    const shrubMatrices = place(shrubs, 1.5, 5, 0.1);
    const rockMesh = new THREE.InstancedMesh(
      rockGeometry(3),
      rockMat,
      rockMatrices.length,
    );
    rockMatrices.forEach((m, i) => rockMesh.setMatrixAt(i, m));
    const shrubGeo = new THREE.IcosahedronGeometry(1, 1);
    shrubGeo.scale(1.2, 0.55, 1.2);
    const shrubMesh = new THREE.InstancedMesh(
      shrubGeo,
      shrubMat,
      shrubMatrices.length,
    );
    shrubMatrices.forEach((m, i) => shrubMesh.setMatrixAt(i, m));
    rockMesh.frustumCulled = false;
    shrubMesh.frustumCulled = false;
    return [rockMesh, shrubMesh];
  }, [areas, atmosphere, avoid, heightAt, isSea, rocks, shrubs]);

  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
};
