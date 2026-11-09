import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { createCameraPath } from "../../cinema/camera/cameraPath";
import { INTER, loadInter } from "../../cinema/fonts";
import {
  loadRegion,
  lonLatToWorld,
  MapLook,
  MapTerrain,
  RegionData,
  ShorelineSpec,
} from "../../cinema/map/MapTerrain";
import { Stage3D } from "../../cinema/Stage3D";
import { sunDirection } from "../../cinema/terrain/terrainData";
import { useAsyncResource } from "../../cinema/useAsyncResource";

// Documentary 4, Scene 8 - bathymetry + shoreline PROTOTYPE (not production).
// GEBCO_2026 bathymetry; water drawn wherever the measured bed lies below
// the chosen level. Levels here are TEST levels in the GEBCO datum (metres
// relative to Mean Sea Level), pending verified Caspian level figures.
// Frames 0-4: whole-sea view, frames 5-9: north-shelf close view.

loadInter();

type Test = { level: number; label: string; projection?: boolean };
const TESTS: Test[] = [
  { level: -26, label: "Test level −26 m" },
  { level: -28, label: "Test level −28 m" },
  { level: -29, label: "Test level −29 m" },
  { level: -37, label: "Test level −37 m (−29 m − 8 m)", projection: true },
  { level: -43, label: "Test level −43 m (−29 m − 14 m)", projection: true },
];
const REF = -26; // reference for the exposed-seabed shading (test value)
const EX = 6;

const loadCaspian = () => loadRegion("terrain/caspian-gebco");

const look: MapLook = {
  sunDir: sunDirection(230, 35),
  sunColor: new THREE.Color(1.0, 0.95, 0.86).multiplyScalar(1.7),
  skyColor: new THREE.Color(0.5, 0.6, 0.78).multiplyScalar(0.55),
  hazeColor: new THREE.Color(0.62, 0.7, 0.8),
  hazeDensity: 0.00000018,
  coolGrade: 0.05,
};

const cams = (r: RegionData) => {
  const P = (lon: number, lat: number, y: number) =>
    lonLatToWorld(r.meta, lon, lat, y);
  return {
    wide: createCameraPath([
      {
        frame: 0,
        position: P(51.0, 35.2, 1250000),
        target: P(50.6, 42.6, 0),
        fov: 36,
      },
      {
        frame: 1,
        position: P(51.0, 35.2, 1250000),
        target: P(50.6, 42.6, 0),
        fov: 36,
      },
    ]),
    north: createCameraPath([
      {
        frame: 0,
        position: P(50.9, 43.4, 120000),
        target: P(49.8, 45.6, -200),
        fov: 38,
      },
      {
        frame: 1,
        position: P(50.9, 43.4, 120000),
        target: P(49.8, 45.6, -200),
        fov: 38,
      },
    ]),
  };
};

const CYAN = new THREE.Color(0.22, 0.88, 1.0);
const ICE = new THREE.Color(0.85, 0.96, 1.0);
const AMBER = new THREE.Color(1.0, 0.69, 0.18);

export const ShorelinePrototype: React.FC = () => {
  const frame = useCurrentFrame();
  const region = useAsyncResource("Loading GEBCO Caspian", loadCaspian);
  if (!region) return <AbsoluteFill style={{ background: "black" }} />;
  const t = TESTS[frame % 5];
  const close = frame >= 5;
  const cam = cams(region)[close ? "north" : "wide"](0);
  const shoreline: ShorelineSpec = {
    level: t.level,
    exposedFrom: REF,
    exposedColor: new THREE.Color(0.95, 0.45, 0.12),
    contours: [
      { level: REF, color: ICE },
      ...(t.projection
        ? [
            { level: -37, color: CYAN, dashed: true },
            { level: -43, color: CYAN, dashed: true },
          ]
        : [{ level: t.level, color: AMBER }]),
    ],
  };
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0d12" }}>
      <Stage3D
        camera={cam}
        exposure={0.55}
        near={50}
        far={2e7}
        grade="contrast(1.06) saturate(1.0)"
      >
        <color attach="background" args={["#0a0d12"]} />
        <MapTerrain
          data={region}
          look={look}
          exaggeration={EX}
          step={close ? 1 : 2}
          shoreline={shoreline}
        />
      </Stage3D>
      <div
        style={{
          position: "absolute",
          left: 40,
          top: 32,
          fontFamily: INTER,
          color: "white",
        }}
      >
        <div
          style={{
            fontSize: 18,
            letterSpacing: 3,
            color: "#ffb02e",
            fontWeight: 700,
          }}
        >
          SCENE 8 PROTOTYPE · NOT A HISTORICAL CLAIM
        </div>
        <div style={{ fontSize: 44, fontWeight: 800, marginTop: 6 }}>
          {t.label}
        </div>
        <div style={{ fontSize: 18, opacity: 0.8, marginTop: 4 }}>
          metres relative to mean sea level (GEBCO datum) ·{" "}
          {close ? "north Caspian shelf" : "whole Caspian"}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 40,
          bottom: 34,
          fontFamily: INTER,
          color: "white",
          fontSize: 18,
          lineHeight: 1.6,
        }}
      >
        <div>
          <span style={{ color: "#d9f5ff" }}>━━</span> shoreline at test
          reference −26 m
        </div>
        {t.projection ? (
          <div>
            <span style={{ color: "#38e1ff" }}>╍╍</span> projection test levels
            −37 m and −43 m
          </div>
        ) : (
          <div>
            <span style={{ color: "#ffb02e" }}>━━</span> shoreline at the test
            level shown
          </div>
        )}
        <div>
          <span style={{ color: "#f2731f" }}>■</span> seabed exposed below −26 m
        </div>
        <div style={{ opacity: 0.6, fontSize: 15, marginTop: 4 }}>
          Bathymetry: GEBCO_2026 Grid (15″) · vertical exaggeration ×{EX}
        </div>
      </div>
    </AbsoluteFill>
  );
};
