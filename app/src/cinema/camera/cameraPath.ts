import * as THREE from "three";

// A smooth, keyframed camera path that is a pure function of the frame
// number. The same function drives the 3D camera and any 2D overlays that
// need to know where things appear on screen.

export type CameraKey = {
  frame: number;
  position: THREE.Vector3;
  target: THREE.Vector3;
  roll?: number; // degrees, positive = bank right
  fov?: number; // vertical, degrees
};

export type CameraState = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  fov: number;
};

// Monotone cubic interpolation (Fritsch-Carlson) so the camera never
// overshoots or reverses between keyframes.
const monotoneCubic = (xs: number[], ys: number[]) => {
  const n = xs.length;
  const d: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) {
    m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  }
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * d[i];
      m[i + 1] = tau * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
};

export const createCameraPath = (keys: CameraKey[]) => {
  const frames = keys.map((k) => k.frame);
  const u = keys.map((_, i) => i / (keys.length - 1));
  const frameToU = monotoneCubic(frames, u);
  const posCurve = new THREE.CatmullRomCurve3(
    keys.map((k) => k.position),
    false,
    "centripetal",
  );
  const tgtCurve = new THREE.CatmullRomCurve3(
    keys.map((k) => k.target),
    false,
    "centripetal",
  );
  const roll = monotoneCubic(
    frames,
    keys.map((k) => k.roll ?? 0),
  );
  const fov = monotoneCubic(
    frames,
    keys.map((k) => k.fov ?? 30),
  );

  // CatmullRomCurve3.getPoint(u) spaces keyframes evenly in u, which matches
  // how frameToU maps keyframe frames.
  return (frame: number): CameraState => {
    const uu = frameToU(frame);
    const position = posCurve.getPoint(uu);
    const target = tgtCurve.getPoint(uu);
    const m = new THREE.Matrix4().lookAt(
      position,
      target,
      new THREE.Vector3(0, 1, 0),
    );
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(m);
    const r = THREE.MathUtils.degToRad(-roll(frame));
    quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), r),
    );
    return { position, quaternion, fov: fov(frame) };
  };
};

// Projects a world point to pixel coordinates for 2D overlays.
export const projectToScreen = (
  state: CameraState,
  point: THREE.Vector3,
  width: number,
  height: number,
  near = 2,
  far = 900000,
) => {
  const cam = new THREE.PerspectiveCamera(state.fov, width / height, near, far);
  cam.position.copy(state.position);
  cam.quaternion.copy(state.quaternion);
  cam.updateMatrixWorld(true);
  const p = point.clone().project(cam);
  return {
    x: (p.x * 0.5 + 0.5) * width,
    y: (-p.y * 0.5 + 0.5) * height,
    visible: p.z > -1 && p.z < 1,
  };
};
