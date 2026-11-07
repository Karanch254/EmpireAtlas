import { Line } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { Route } from "../line/route";

// The Line's route drawn over a relief map (same look as Scene 2): a faint
// full alignment, a bright portion of a chosen length measured from the
// start, and an amber highlight for a short segment. Lines float a fixed
// height above the terrain and ignore depth so they always read.

const sample = (
  route: Route,
  heightAt: (x: number, z: number) => number,
  km: number,
  step: number,
  lift: number,
) => {
  const out: THREE.Vector3[] = [];
  for (let t = 0; t <= km * 1000 + 1e-6; t += step) {
    const p = route.point(Math.min(t, km * 1000), 0, 0);
    p.y = Math.max(heightAt(p.x, p.z), 0) + lift;
    out.push(p);
  }
  if (out.length < 2) out.push(out[0].clone());
  return out;
};

export const RouteOverlay: React.FC<{
  route: Route;
  heightAt: (x: number, z: number) => number;
  fullKm: number;
  draw?: number; // 0..1 of the full route traced
  litKm: number; // bright portion, from the start
  faint?: number; // opacity of the unlit remainder
  segmentKm?: number;
  highlight?: number; // 0..1 amber segment
  lift?: number;
}> = ({
  route,
  heightAt,
  fullKm,
  draw = 1,
  litKm,
  faint = 0.25,
  segmentKm = 2.4,
  highlight = 0,
  lift = 150,
}) => {
  const all = useMemo(
    () => sample(route, heightAt, fullKm, 500, lift),
    [route, heightAt, fullKm, lift],
  );
  const seg = useMemo(
    () => sample(route, heightAt, segmentKm, 100, lift),
    [route, heightAt, segmentKm, lift],
  );
  const drawn = all.slice(0, Math.max(2, Math.round(all.length * draw)));
  const litN = Math.max(2, Math.round((litKm / fullKm) * (all.length - 1)) + 1);
  const lit = drawn.slice(0, Math.min(litN, drawn.length));
  const blue = new THREE.Color(0.55, 0.9, 1.0);
  return (
    <>
      <Line
        points={drawn}
        color={blue}
        lineWidth={3}
        transparent
        opacity={faint}
        toneMapped={false}
        depthTest={false}
      />
      {lit.length >= 2 && litKm > segmentKm ? (
        <>
          <Line
            points={lit}
            color={blue}
            lineWidth={10}
            transparent
            opacity={0.35}
            toneMapped={false}
            depthTest={false}
          />
          <Line
            points={lit}
            color={blue}
            lineWidth={3.5}
            toneMapped={false}
            depthTest={false}
          />
        </>
      ) : null}
      {highlight > 0 ? (
        <>
          <Line
            points={seg}
            color={new THREE.Color(1.0, 0.75, 0.35)}
            lineWidth={26}
            transparent
            opacity={0.4 * highlight}
            toneMapped={false}
            depthTest={false}
          />
          <Line
            points={seg}
            color={new THREE.Color(1.0, 0.92, 0.7)}
            lineWidth={7}
            transparent
            opacity={highlight}
            toneMapped={false}
            depthTest={false}
          />
        </>
      ) : null}
    </>
  );
};
