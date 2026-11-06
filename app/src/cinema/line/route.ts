import * as THREE from "three";

// Geometry of an illustrative linear-city route on the terrain.
// t = metres along the route from its start, s = metres to the left (north
// for an eastward route). Heights follow a smooth graded base profile.

export type Route = {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  left: THREE.Vector3;
  length: number;
  profile: [number, number, number];
  baseAt: (t: number) => number;
  point: (t: number, s: number, y: number) => THREE.Vector3;
};

export const createRoute = (
  bearingDeg: number,
  length: number,
  profile: [number, number, number],
): Route => {
  const b = THREE.MathUtils.degToRad(bearingDeg);
  const dir = new THREE.Vector3(Math.sin(b), 0, -Math.cos(b));
  const left = new THREE.Vector3(dir.z, 0, -dir.x);
  const origin = new THREE.Vector3(0, 0, 0);
  const baseAt = (t: number) => {
    const tc = Math.min(Math.max(t, 0), length);
    return profile[0] * tc * tc + profile[1] * tc + profile[2];
  };
  const point = (t: number, s: number, y: number) =>
    origin.clone().addScaledVector(dir, t).addScaledVector(left, s).setY(y);
  return { origin, dir, left, length, profile, baseAt, point };
};
