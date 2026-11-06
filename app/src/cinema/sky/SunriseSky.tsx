import { Environment } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

// Art-directable sunrise sky: zenith-to-horizon gradient, warm horizon band
// towards the sun, layered forward-scattering glow and a sun disk. The same
// sky is rendered into the environment map used by reflective materials, and
// its horizon colours match the aerial-perspective haze.

export type SkySettings = {
  sunDir: THREE.Vector3;
  zenith: THREE.Color;
  horizon: THREE.Color;
  horizonSun: THREE.Color;
  sunGlow: THREE.Color;
};

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  // The dome always surrounds the camera, at infinite distance.
  vDir = normalize(position);
  vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0);
  gl_Position = p.xyww;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 sunDir;
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 horizonSun;
uniform vec3 sunGlow;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float up = max(d.y, 0.0);
  float sd = max(dot(d, sunDir), 0.0);
  vec2 dh = normalize(d.xz + 1e-5);
  vec2 sh = normalize(sunDir.xz);
  float azim = max(dot(dh, sh), 0.0);

  float t = pow(1.0 - up, 5.0);
  vec3 col = mix(zenith, horizon, t);
  // Warm band hugging the horizon, strongest towards the sun.
  float band = pow(azim, 2.5) * pow(1.0 - up, 9.0);
  col = mix(col, horizonSun, clamp(band, 0.0, 1.0));
  // Forward scattering around the sun.
  col += sunGlow * (pow(sd, 900.0) * 1.4 + pow(sd, 90.0) * 0.28 + pow(sd, 10.0) * 0.1);
  // Sun disk.
  col += sunGlow * smoothstep(0.99994, 0.99997, sd) * 30.0;
  // Below the horizon, fade into horizon haze.
  if (d.y < 0.0) col = mix(col, horizon * 0.85, smoothstep(0.0, -0.08, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const makeGlowTexture = () => {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const v =
        Math.max(0, 1 - r) * (Math.exp(-r * 7) * 0.5 + Math.exp(-r * 22) * 0.5);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(Math.min(1, v) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.needsUpdate = true;
  return tex;
};

const SkyDome: React.FC<{ settings: SkySettings }> = ({ settings }) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          sunDir: { value: settings.sunDir.clone().normalize() },
          zenith: { value: settings.zenith },
          horizon: { value: settings.horizon },
          horizonSun: { value: settings.horizonSun },
          sunGlow: { value: settings.sunGlow },
        },
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
      }),
    [settings],
  );
  return (
    <mesh material={material} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[1000, 48, 24]} />
    </mesh>
  );
};

export const SunriseSky: React.FC<{ settings: SkySettings }> = ({
  settings,
}) => {
  const glow = useMemo(() => {
    const m = new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      color: settings.sunGlow.clone().multiplyScalar(0.07),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      fog: false,
    });
    const s = new THREE.Sprite(m);
    s.position.copy(settings.sunDir.clone().multiplyScalar(300000));
    s.scale.setScalar(30000);
    s.renderOrder = 10;
    return s;
  }, [settings]);

  return (
    <>
      <SkyDome settings={settings} />
      <primitive object={glow} />
      <Environment frames={1} resolution={256}>
        <SkyDome settings={settings} />
      </Environment>
    </>
  );
};
