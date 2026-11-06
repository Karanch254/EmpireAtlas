import { Line } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { Route } from "../line/route";

// Illustrative wind streamlines meeting a long wall: air approaching from the
// open desert (the south side, s < 0) is forced up and over the structure, with a turbulent wake on
// the far side. Dashes flow with the frame number (deterministic).

export const WindLines: React.FC<{
  route: Route;
  wallTop: (t: number) => number;
  tValues: number[];
  heights: number[];
  frame: number;
  opacity: number;
}> = ({ route, wallTop, tValues, heights, frame, opacity }) => {
  const lines = useMemo(() => {
    const out: { pts: THREE.Vector3[]; seed: number }[] = [];
    let seed = 1;
    for (const t of tValues) {
      for (const y0 of heights) {
        const pts: THREE.Vector3[] = [];
        const top = wallTop(t);
        for (let s = -2600; s <= 1800; s += 40) {
          // Lift as the air approaches the wall (s = 0 is the centre line).
          const lift =
            Math.max(top + 70 - y0, 0) *
            (1 - 1 / (1 + Math.exp((s + 450) / 180)));
          // Turbulent wake behind the wall, decaying downstream.
          const wake =
            s > 120
              ? Math.sin(s * 0.012 + seed) * 45 * Math.exp(-(s - 120) / 900)
              : 0;
          const settle = s > 0 ? Math.min(s / 1600, 1) * lift * 0.55 : 0;
          pts.push(
            route.point(
              t + Math.sin(s * 0.002 + seed) * 30,
              s,
              y0 + lift - settle + wake,
            ),
          );
        }
        out.push({ pts, seed: seed++ });
      }
    }
    return out;
  }, [route, wallTop, tValues, heights]);
  if (opacity <= 0) return null;
  return (
    <>
      {lines.map((l, i) => (
        <Line
          key={i}
          points={l.pts}
          color="#d9f3ff"
          lineWidth={2.2}
          transparent
          opacity={opacity * 0.85}
          dashed
          dashSize={160}
          gapSize={110}
          dashOffset={-(frame * 22 + l.seed * 37)}
          toneMapped={false}
        />
      ))}
    </>
  );
};
