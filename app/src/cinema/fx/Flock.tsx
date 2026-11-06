import { useMemo } from "react";
import * as THREE from "three";

// A deterministic bird flock: every bird's position, heading and wingbeat is
// a pure function of the frame, so renders are repeatable. Birds follow a
// shared smooth path with individual offsets and gentle drift.

export type FlockPath = (frame: number) => THREE.Vector3;

const makeBirdGeometry = (span: number) => {
  // Two thin wing triangles meeting at the body; animated by scaling Y.
  const h = span / 2;
  const g = new THREE.BufferGeometry();
  const tip = span * 0.22; // wing tips raised: the V is flexed by Y scale
  const v = new Float32Array([
    0,
    0,
    0.35,
    -h,
    tip,
    -0.1,
    0,
    0,
    -0.35,
    0,
    0,
    0.35,
    0,
    0,
    -0.35,
    h,
    tip,
    -0.1,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
};

export const Flock: React.FC<{
  count: number;
  path: FlockPath;
  frame: number;
  spread: number;
  span?: number;
  colour?: THREE.Color;
  visible?: boolean;
}> = ({ count, path, frame, spread, span = 1.6, colour, visible = true }) => {
  const { mesh, birds } = useMemo(() => {
    let s = 99;
    const r = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    const birds = Array.from({ length: count }, () => ({
      off: new THREE.Vector3(
        r() - 0.5,
        (r() - 0.5) * 0.4,
        r() - 0.5,
      ).multiplyScalar(spread * 2),
      lag: r() * 14,
      phase: r() * Math.PI * 2,
      rate: 0.55 + r() * 0.25,
      wob: r() * 10,
    }));
    const mat = new THREE.MeshBasicMaterial({
      color: colour ?? new THREE.Color(0.06, 0.06, 0.07),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.InstancedMesh(makeBirdGeometry(span), mat, count);
    mesh.frustumCulled = false;
    return { mesh, birds };
  }, [count, spread, span, colour]);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  birds.forEach((b, i) => {
    const f = frame - b.lag;
    const p = path(f)
      .add(b.off)
      .add(
        new THREE.Vector3(
          Math.sin(f * 0.05 + b.wob) * spread * 0.15,
          Math.sin(f * 0.07 + b.wob * 2) * spread * 0.08,
          Math.cos(f * 0.045 + b.wob) * spread * 0.15,
        ),
      );
    const ahead = path(f + 3).add(b.off);
    const dir = ahead.sub(path(f).add(b.off)).normalize();
    // Point the bird's +Z (its nose) along the direction of travel.
    const look = new THREE.Matrix4().lookAt(dir, new THREE.Vector3(), up);
    q.setFromRotationMatrix(look);
    // Wingbeat: tips swing from up (+1) to down (-0.6).
    const flap = 0.2 + 0.8 * Math.sin(f * b.rate + b.phase);
    m.compose(p, q, new THREE.Vector3(1, flap, 1));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.visible = visible;
  return <primitive object={mesh} />;
};
