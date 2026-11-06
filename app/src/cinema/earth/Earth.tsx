import { Line } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

// Earth from orbit: NASA Blue Marble surface, a soft dawn terminator, ocean
// sun-glint, atmospheric rim glow, stars, and an optional highlighted
// country (outline + mask from Natural Earth). Units: kilometres.

export const EARTH_RADIUS_KM = 6371;

export const lonLatToVec = (lon: number, lat: number, r = EARTH_RADIUS_KM) => {
  const lo = THREE.MathUtils.degToRad(lon);
  const la = THREE.MathUtils.degToRad(lat);
  return new THREE.Vector3(
    r * Math.cos(la) * Math.cos(lo),
    r * Math.sin(la),
    -r * Math.cos(la) * Math.sin(lo),
  );
};

const surfaceVS = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN;
varying vec3 vW;
void main() {
  vN = normalize(position);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}
`;

const surfaceFS = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D tDay;
uniform sampler2D tMask;
uniform vec3 sunDir;
uniform float highlight;
uniform vec3 highlightColour;
varying vec3 vN;
varying vec3 vW;
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vN);
  float lon = atan(-n.z, n.x);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  vec2 uv = vec2(lon / 6.2831853 + 0.5, 0.5 - lat / 3.1415927);
  vec3 day = texture2D(tDay, uv).rgb;
  float mask = texture2D(tMask, uv).r;
  float ndl = dot(n, sunDir);
  float lit = smoothstep(-0.18, 0.35, ndl);
  // Ocean glint (oceans are dark and blue in Blue Marble).
  float ocean = smoothstep(0.08, 0.02, day.r) * step(day.r, day.b);
  vec3 V = normalize(cameraPosition - vW);
  vec3 H = normalize(V + sunDir);
  float spec = pow(max(dot(n, H), 0.0), 900.0) * ocean * lit;
  vec3 col = day * (0.03 + 2.2 * lit);
  // Warm band along the terminator (dawn).
  float dawn = exp(-pow(ndl / 0.09, 2.0));
  col += vec3(0.9, 0.38, 0.12) * dawn * 0.04 * smoothstep(0.0, 0.1, ndl + 0.05);
  // Highlighted country: lifted and tinted.
  col = mix(col, col * 1.25 + highlightColour * 0.18 * (0.3 + lit), mask * highlight);
  // Glowing border from the edge of the (smoothly filtered) country mask.
  float edge = 1.0 - abs(mask * 2.0 - 1.0);
  col += highlightColour * smoothstep(0.15, 0.9, edge) * highlight * 1.4;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const atmoVS = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN;
varying vec3 vW;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}
`;

const atmoFS = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 sunDir;
varying vec3 vN;
varying vec3 vW;
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vW);
  vec3 V = normalize(cameraPosition - vW);
  float rim = pow(1.0 - abs(dot(normalize(vN), vec3(0.0, 0.0, 1.0))), 3.0);
  float lit = smoothstep(-0.25, 0.4, dot(n, sunDir));
  vec3 col = mix(vec3(0.05, 0.1, 0.25), vec3(0.35, 0.6, 1.0), lit) * rim * (0.25 + 1.2 * lit);
  float dawn = exp(-pow(dot(n, sunDir) / 0.15, 2.0));
  col += vec3(1.0, 0.45, 0.15) * dawn * rim * 0.6;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export type CountryOutline = { rings: [number, number][][] };

const makeMask = (outline: CountryOutline | null) => {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 1024;
  const ctx = c.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  if (outline) {
    ctx.fillStyle = "#fff";
    for (const ring of outline.rings) {
      ctx.beginPath();
      ring.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * c.width;
        const y = ((90 - lat) / 180) * c.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.colorSpace = THREE.NoColorSpace;
  return t;
};

export const Earth: React.FC<{
  day: THREE.Texture;
  sunDir: THREE.Vector3;
  outline: CountryOutline | null;
  highlight: number;
  outlineOpacity: number;
}> = ({ day, sunDir, outline, highlight, outlineOpacity }) => {
  const { surface, atmo, stars, outlinePts, mat } = useMemo(() => {
    const mask = makeMask(outline);
    const mat = new THREE.ShaderMaterial({
      vertexShader: surfaceVS,
      fragmentShader: surfaceFS,
      uniforms: {
        tDay: { value: day },
        tMask: { value: mask },
        sunDir: { value: sunDir.clone().normalize() },
        highlight: { value: 0 },
        highlightColour: { value: new THREE.Color(1.0, 0.72, 0.35) },
      },
    });
    const surface = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS_KM, 160, 120),
      mat,
    );
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS_KM * 1.025, 96, 72),
      new THREE.ShaderMaterial({
        vertexShader: atmoVS,
        fragmentShader: atmoFS,
        uniforms: { sunDir: { value: sunDir.clone().normalize() } },
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    // Deterministic star field on a distant sphere.
    let s = 7;
    const r = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    const pos: number[] = [];
    const col: number[] = [];
    for (let i = 0; i < 4500; i++) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const k = Math.sqrt(1 - u * u);
      const d = 400000;
      pos.push(d * k * Math.cos(th), d * u, d * k * Math.sin(th));
      const b = 0.25 + Math.pow(r(), 6) * 1.6;
      col.push(b, b, b * (0.9 + r() * 0.2));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 1.6,
        sizeAttenuation: false,
        vertexColors: true,
        depthWrite: false,
      }),
    );
    const outlinePts = (outline?.rings ?? []).map((ring) =>
      ring.map(([lon, lat]) => lonLatToVec(lon, lat, EARTH_RADIUS_KM * 1.0015)),
    );
    return { surface, atmo, stars, outlinePts, mat };
  }, [day, outline, sunDir]);
  mat.uniforms.highlight.value = highlight;
  return (
    <>
      <primitive object={stars} />
      <primitive object={surface} />
      <primitive object={atmo} />
      {outlineOpacity > 0
        ? outlinePts.map((pts, i) => (
            <Line
              key={i}
              points={pts}
              color="#ffd38a"
              lineWidth={2.2}
              depthTest={false}
              transparent
              opacity={outlineOpacity}
              toneMapped={false}
            />
          ))
        : null}
    </>
  );
};
