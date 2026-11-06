import { Line } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  createCameraPath,
  projectToScreen,
} from "../../cinema/camera/cameraPath";
import { INTER, loadInter } from "../../cinema/fonts";
import { createRoute } from "../../cinema/line/route";
import { loadRegion, MapLook, MapTerrain } from "../../cinema/map/MapTerrain";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { CornerTag, PinLabel } from "../../cinema/overlays/TextCards";
import { Stage3D } from "../../cinema/Stage3D";
import { sunDirection } from "../../cinema/terrain/terrainData";
import { useAsyncResource } from "../../cinema/useAsyncResource";
import { phraseFrame, sentenceFrame } from "./SceneShell";

// Scene 2 - "The mystery". A cool, cartographic overhead view of the real
// NEOM landscape. The full 170 km proposal traces on; then everything but
// the reported 2030 segment (~2.4 km) dims, and the camera dives towards it.

loadInter();
const ID = 2;
const F_REPORTS = phraseFrame(ID, "reports said");
const F_TWO_POINT_FOUR = phraseFrame(ID, "two point four kilometres");
const F_QUESTION = sentenceFrame(ID, "So what happened");
const FULL_KM = 170;
const TARGET_KM = 2.4;
// Same illustrative bearing as Scene 1's route.
const route = createRoute(70, FULL_KM * 1000, [0, 0, 0]);

const loadWide = () => loadRegion("terrain/neom-wide");

const look: MapLook = {
  sunDir: sunDirection(120, 40),
  sunColor: new THREE.Color(1.0, 0.93, 0.84).multiplyScalar(1.7),
  skyColor: new THREE.Color(0.45, 0.55, 0.75).multiplyScalar(0.55),
  hazeColor: new THREE.Color(0.55, 0.62, 0.75),
  hazeDensity: 0.0000018,
  coolGrade: 0.18,
};

const camPath = createCameraPath([
  {
    frame: 0,
    position: route.point(70000, -150000, 240000),
    target: route.point(82000, 0, 0),
    fov: 34,
  },
  {
    frame: F_REPORTS,
    position: route.point(60000, -120000, 205000),
    target: route.point(70000, 0, 0),
    fov: 34,
  },
  {
    frame: F_TWO_POINT_FOUR + 25,
    position: route.point(14000, -40000, 70000),
    target: route.point(6000, 0, 0),
    fov: 34,
  },
  {
    frame: F_QUESTION + 20,
    position: route.point(5000, -15000, 26000),
    target: route.point(1400, 0, 0),
    fov: 34,
  },
  {
    frame: 349,
    position: route.point(3800, -12500, 22000),
    target: route.point(1200, 0, 0),
    fov: 32,
  },
]);

const RouteLines: React.FC<{
  heightAt: (x: number, z: number) => number;
  draw: number; // 0..1 how much of the full route is traced
  dim: number; // 0..1 dimming of everything beyond the 2030 segment
  highlight: number; // 0..1 the 2030 segment glow
}> = ({ heightAt, draw, dim, highlight }) => {
  const pts = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (let t = 0; t <= FULL_KM * 1000; t += 500) {
      const p = route.point(t, 0, 0);
      p.y = Math.max(heightAt(p.x, p.z), 0) + 150;
      out.push(p);
    }
    return out;
  }, [heightAt]);
  const n = Math.max(2, Math.round(pts.length * draw));
  const drawn = pts.slice(0, n);
  const seg = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (let t = 0; t <= TARGET_KM * 1000; t += 100) {
      const p = route.point(t, 0, 0);
      p.y = Math.max(heightAt(p.x, p.z), 0) + 150;
      out.push(p);
    }
    return out;
  }, [heightAt]);
  const full = new THREE.Color(0.55, 0.9, 1.0);
  const fullOpacity = 1 - 0.75 * dim;
  return (
    <>
      <Line
        points={drawn}
        color={full}
        lineWidth={10}
        transparent
        opacity={0.35 * fullOpacity}
        toneMapped={false}
        depthTest={false}
      />
      <Line
        points={drawn}
        color={full}
        lineWidth={3.5}
        transparent
        opacity={fullOpacity}
        toneMapped={false}
        depthTest={false}
      />
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

export const Scene02Mystery: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const region = useAsyncResource("Loading wide NEOM terrain", loadWide);
  if (!region) return <AbsoluteFill style={{ background: "black" }} />;
  const camera = camPath(frame);
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const draw = interpolate(frame, [0, 45], [0, 1], {
    ...clamp,
    easing: (t) => 1 - (1 - t) ** 3,
  });
  const dim = interpolate(
    frame,
    [F_TWO_POINT_FOUR - 10, F_TWO_POINT_FOUR + 20],
    [0, 1],
    clamp,
  );
  const highlight =
    interpolate(
      frame,
      [F_TWO_POINT_FOUR - 5, F_TWO_POINT_FOUR + 15],
      [0, 1],
      clamp,
    ) *
    (0.85 + 0.15 * Math.sin(frame * 0.25));
  const project = (p: THREE.Vector3) =>
    projectToScreen(camera, p, width, height, 30, 2e7);
  const endP = route.point(95000, 0, 0);
  endP.y = Math.max(region.heightAt(endP.x, endP.z), 0) + 150;
  const end = project(endP);
  const segP = route.point(TARGET_KM * 500, 0, 300);
  const segS = project(segP);
  const fullLabel = interpolate(
    frame,
    [30, 45, F_TWO_POINT_FOUR, F_TWO_POINT_FOUR + 15],
    [0, 1, 1, 0.35],
    clamp,
  );
  const segLabel = interpolate(
    frame,
    [F_TWO_POINT_FOUR + 10, F_TWO_POINT_FOUR + 25],
    [0, 1],
    clamp,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0d12" }}>
      <Stage3D
        camera={camera}
        exposure={0.5}
        near={30}
        far={2e7}
        grade="contrast(1.06) saturate(0.95)"
      >
        <color attach="background" args={["#0a0d12"]} />
        <MapTerrain data={region} look={look} exaggeration={1.6} />
        <RouteLines
          heightAt={region.heightAt}
          draw={draw}
          dim={dim}
          highlight={highlight}
        />
      </Stage3D>
      <FilmGrade grain={0.04} />
      {end.visible ? (
        <PinLabel
          x={end.x}
          y={end.y}
          title="170 KM"
          sub="full proposal, 2022"
          opacity={fullLabel}
          colour="#8fe6ff"
        />
      ) : null}
      {segS.visible ? (
        <PinLabel
          x={segS.x}
          y={segS.y}
          title="~2.4 KM"
          sub="reported 2030 target (Bloomberg, Apr 2024)"
          opacity={segLabel}
          colour="#ffd08a"
          side="left"
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          right: 60,
          bottom: 56,
          fontFamily: INTER,
          color: "rgba(255,255,255,0.75)",
          fontSize: 18,
          letterSpacing: 2,
          textAlign: "right",
        }}
      >
        REAL NEOM TERRAIN · ILLUSTRATIVE ALIGNMENT
        <br />
        2030 TARGET ≠ TOTAL PROJECT · NOT A MEASURE OF WHAT IS BUILT
      </div>
      <CornerTag
        text="CONCEPT VISUALISATION"
        detail="Proposed route, 2022 · not built"
      />
    </AbsoluteFill>
  );
};
