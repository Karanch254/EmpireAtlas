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
import {
  loadRegion,
  lonLatToWorld,
  MapLook,
  MapTerrain,
} from "../../cinema/map/MapTerrain";
import { RouteOverlay } from "../../cinema/map/RouteOverlay";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { Card, CornerTag, PinLabel } from "../../cinema/overlays/TextCards";
import { Stage3D } from "../../cinema/Stage3D";
import { sunDirection } from "../../cinema/terrain/terrainData";
import { useAsyncResource } from "../../cinema/useAsyncResource";
import { phraseFrame, sentenceFrame } from "./SceneShell";

// Scene 12 - "The pivot". The cartographic NEOM map again. The fund's
// chief calls The Line "not a must" and names Oxagon, the industrial port,
// as essential; the camera moves to the port while The Line's route dims.
// Then a reported halt, and the wording that disappeared from NEOM's site.

loadInter();
const ID = 12;
const F_ASKED = sentenceFrame(ID, "Asked whether");
const F_QUOTE = sentenceFrame(ID, '"It would be good');
const F_OXAGON = sentenceFrame(ID, "What the kingdom must have");
const F_CANCEL = sentenceFrame(ID, "He also insisted");
const F_SEMAFOR = sentenceFrame(ID, "A month later");
const F_PORTS = phraseFrame(ID, "ports and data centres");
const F_SUMMER = sentenceFrame(ID, "By the summer");
const F_NINE = phraseFrame(ID, "nine million residents or");
const F_CARS = phraseFrame(ID, "a city without cars");
const F_CORE = sentenceFrame(ID, "The Line was now");
const END = 1450;
const FULL_KM = 170;
const OXAGON: [number, number] = [35.62, 27.42];
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

// Camera keyframes in world metres (x east, z south).
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const camPath = createCameraPath([
  {
    frame: 0,
    position: V(78000, 175000, 175000),
    target: V(62000, 0, 5000),
    fov: 34,
  },
  {
    frame: F_QUOTE,
    position: V(80000, 165000, 168000),
    target: V(64000, 0, 8000),
    fov: 34,
  },
  // To the port.
  {
    frame: F_OXAGON + 50,
    position: V(62000, 70000, 140000),
    target: V(74000, 0, 70000),
    fov: 34,
  },
  {
    frame: F_SEMAFOR,
    position: V(66000, 64000, 134000),
    target: V(75000, 0, 68000),
    fov: 33,
  },
  // Pull back to see the dimmed route and the port together.
  {
    frame: F_SUMMER,
    position: V(84000, 175000, 185000),
    target: V(66000, 0, 22000),
    fov: 34,
  },
  {
    frame: END,
    position: V(86000, 182000, 190000),
    target: V(68000, 0, 22000),
    fov: 34,
  },
]);

const Struck: React.FC<{ text: string; inF: number; frame: number }> = ({
  text,
  inF,
  frame,
}) => {
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const o = interpolate(frame, [inF - 15, inF - 2], [0, 1], clamp);
  const strike = interpolate(frame, [inF + 5, inF + 25], [0, 1], clamp);
  return (
    <div
      style={{
        position: "relative",
        opacity: o * (1 - 0.45 * strike),
        margin: "6px 0",
      }}
    >
      <span style={{ fontSize: 46, fontWeight: 700, color: "white" }}>
        {text}
      </span>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "54%",
          height: 5,
          width: `${strike * 100}%`,
          background: "#ffb046",
        }}
      />
    </div>
  );
};

export const Scene12Pivot: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const region = useAsyncResource("Loading wide NEOM terrain", loadWide);
  if (!region) return <AbsoluteFill style={{ background: "black" }} />;
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const camera = camPath(frame);
  const project = (p: THREE.Vector3) =>
    projectToScreen(camera, p, width, height, 30, 2e7);
  // The Line's route fades as priorities move to the port.
  const lineFade = interpolate(
    frame,
    [F_OXAGON, F_OXAGON + 40, F_SEMAFOR + 40, F_SEMAFOR + 80],
    [1, 0.55, 0.55, 0.25],
    clamp,
  );
  const ox = lonLatToWorld(region.meta, OXAGON[0], OXAGON[1]);
  ox.y = Math.max(region.heightAt(ox.x, ox.z), 0) + 200;
  const oxS = project(ox);
  const oxOp = interpolate(
    frame,
    [F_OXAGON, F_OXAGON + 20, F_CORE - 15, F_CORE],
    [0, 1, 1, 0],
    clamp,
  );
  const lineP = route.point(60000, 0, 0);
  lineP.y = Math.max(region.heightAt(lineP.x, lineP.z), 0) + 150;
  const lineS = project(lineP);
  const lineLabel = interpolate(
    frame,
    [10, 30, F_OXAGON - 10, F_OXAGON + 10],
    [0, 1, 1, 0],
    clamp,
  );
  const haltLabel = interpolate(
    frame,
    [F_SEMAFOR + 20, F_SEMAFOR + 40, F_SUMMER - 10, F_SUMMER + 10],
    [0, 1, 1, 0],
    clamp,
  );
  const summer = interpolate(
    frame,
    [F_SUMMER - 5, F_SUMMER + 10, F_CORE - 10, F_CORE + 5],
    [0, 1, 1, 0],
    clamp,
  );
  const ring = 0.5 + 0.5 * Math.sin(frame * 0.12);

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
        <RouteOverlay
          route={route}
          heightAt={region.heightAt}
          fullKm={FULL_KM}
          litKm={0}
          faint={0.9 * lineFade}
        />
      </Stage3D>
      <FilmGrade grain={0.04} />
      {oxS.visible && oxOp > 0 ? (
        <svg
          width={width}
          height={height}
          style={{ position: "absolute", opacity: oxOp }}
        >
          <circle
            cx={oxS.x}
            cy={oxS.y}
            r={22 + 16 * ring}
            fill="none"
            stroke="#ffd08a"
            strokeWidth={3}
            opacity={1 - ring * 0.7}
          />
          <circle cx={oxS.x} cy={oxS.y} r={9} fill="#ffd08a" />
        </svg>
      ) : null}
      {oxS.visible ? (
        <PinLabel
          x={oxS.x + 14}
          y={oxS.y}
          title="Oxagon"
          sub="NEOM's industrial port · planned · approx. location"
          opacity={oxOp}
          colour="#ffd08a"
        />
      ) : null}
      {lineS.visible ? (
        <PinLabel
          x={lineS.x}
          y={lineS.y}
          title="The Line"
          sub="proposed route"
          opacity={lineLabel}
          colour="#8fe6ff"
        />
      ) : null}
      {lineS.visible ? (
        <PinLabel
          x={lineS.x}
          y={lineS.y}
          title="Work halted"
          sub="until at least after 2030 · reported"
          opacity={haltLabel}
          colour="#ffc56b"
        />
      ) : null}
      <Card
        kind="info"
        tag="APRIL 2026"
        text="Yasir Al-Rumayyan, head of the Public Investment Fund"
        inFrame={8}
        outFrame={F_ASKED}
        x={110}
        y={810}
        width={1000}
        size={36}
      />
      <Card
        kind="info"
        text="Does The Line need to exist by 2030?"
        inFrame={F_ASKED}
        outFrame={F_QUOTE - 4}
        x={110}
        y={820}
        width={1000}
        size={40}
      />
      <Card
        kind="quote"
        text="It would be good to have, but it's not a must."
        sub="Yasir Al-Rumayyan · April 2026"
        inFrame={F_QUOTE}
        outFrame={F_OXAGON}
        x={110}
        y={790}
        width={1100}
        size={48}
      />
      <Card
        kind="official"
        tag="AL-RUMAYYAN · APRIL 2026"
        text="A must: Oxagon, NEOM's industrial port"
        inFrame={F_OXAGON + 10}
        outFrame={F_CANCEL}
        x={110}
        y={810}
        width={980}
        size={38}
      />
      <Card
        kind="official"
        tag="AL-RUMAYYAN · APRIL 2026"
        text="No NEOM projects have been cancelled"
        inFrame={F_CANCEL}
        outFrame={F_SEMAFOR}
        x={110}
        y={810}
        width={980}
        size={38}
      />
      <Card
        kind="reported"
        tag="SEMAFOR · MAY 2026"
        text="Work on The Line halted until at least after 2030"
        inFrame={F_SEMAFOR}
        outFrame={F_SUMMER - 10}
        x={110}
        y={780}
        width={1000}
        size={36}
      />
      <Card
        kind="reported"
        text="Money redirected towards ports and data centres"
        inFrame={F_PORTS}
        outFrame={F_SUMMER - 10}
        x={110}
        y={890}
        width={1000}
        size={30}
      />
      {summer > 0 ? (
        <AbsoluteFill style={{ opacity: summer, fontFamily: INTER }}>
          <AbsoluteFill style={{ background: "rgba(6,10,16,0.55)" }} />
          <div style={{ position: "absolute", left: 160, top: 300 }}>
            <div
              style={{
                fontSize: 18,
                letterSpacing: 2,
                color: "rgba(255,255,255,0.75)",
                marginBottom: 16,
              }}
            >
              NO LONGER LEADING NEOM'S WEBSITE · SUMMER 2026
            </div>
            <Struck text="Nine million residents" inF={F_NINE} frame={frame} />
            <Struck text="A city without cars" inF={F_CARS} frame={frame} />
          </div>
        </AbsoluteFill>
      ) : null}
      <Card
        kind="official"
        tag="NEOM'S WEBSITE · 2026"
        text="The Line: “a core component” of NEOM's long-term vision"
        sub="advancing through a “phased, demand-led approach”"
        inFrame={F_CORE}
        outFrame={END + 30}
        x={110}
        y={790}
        width={1100}
        size={38}
      />
      <CornerTag
        text="MAP"
        detail="Real NEOM terrain · illustrative alignment · port location approximate"
      />
    </AbsoluteFill>
  );
};
