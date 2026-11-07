import { useMemo } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { createAtmosphereUniforms } from "../../cinema/atmosphere";
import { createCameraPath } from "../../cinema/camera/cameraPath";
import {
  SectionEnvironment,
  VerticalCity,
} from "../../cinema/city/VerticalCity";
import { INTER, loadInter } from "../../cinema/fonts";
import { Route } from "../../cinema/line/route";
import { ConceptLabel } from "../../cinema/overlays/ConceptLabel";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { Card } from "../../cinema/overlays/TextCards";
import { Settlement } from "../../cinema/settlement/Settlement";
import { Stage3D } from "../../cinema/Stage3D";
import { useAsyncResource } from "../../cinema/useAsyncResource";
import { NeomExteriorWorld } from "../world/NeomExteriorWorld";
import { loadNeomWorld } from "../world/neomWorld";
import { phraseFrame, sentenceFrame } from "./SceneShell";

// Scene 14 - "The bigger picture". A generic town grows in front of the
// proposed wall (demand-led vs. build-first); planned cities are shown as
// hand-drawn, stylised plans; then back inside the vertical-city cutaway
// for the question The Line asked about density and nature.

loadInter();
const ID = 14;
const F_DEMAND = sentenceFrame(ID, '"Demand-led" means');
const F_ORIGINAL = sentenceFrame(ID, "The original Line");
const F_TRUST = phraseFrame(ID, "and trust that nine million");
const F_HISTORY = sentenceFrame(ID, "History is full");
const F_BRASILIA = sentenceFrame(ID, "Some, like");
const F_SLOWER = sentenceFrame(ID, "Many others grew");
const F_NOTBUILT = sentenceFrame(ID, "Cities are not simply built");
const F_GROW = sentenceFrame(ID, "They grow");
const F_QUESTION = sentenceFrame(ID, "The Line asked");
const F_SPRAWL = phraseFrame(ID, "less sprawl");
const F_REMAINS = sentenceFrame(ID, "That question doesn't");
const END = 1270;

// Town site in route space (flat ground south of the wall).
const TOWN_T = 12000;
const TOWN_S = -1800;

const loadLateMorning = () => loadNeomWorld("latemorning");

const townCamera = (
  route: Route,
  heightAt: (x: number, z: number) => number,
) => {
  const P = (t: number, s: number, y: number) => {
    const p = route.point(t, s, 0);
    return p.setY(heightAt(p.x, p.z) + y);
  };
  return createCameraPath([
    {
      frame: 0,
      position: P(TOWN_T - 420, TOWN_S - 480, 55),
      target: P(TOWN_T + 80, TOWN_S + 80, 12),
      fov: 32,
    },
    {
      frame: F_ORIGINAL,
      position: P(TOWN_T - 380, TOWN_S - 560, 70),
      target: P(TOWN_T + 200, TOWN_S + 300, 40),
      fov: 32,
    },
    // Look up from the town to the wall: build the future first.
    {
      frame: F_TRUST + 40,
      position: P(TOWN_T - 900, TOWN_S - 1200, 160),
      target: P(TOWN_T + 900, -100, 260),
      fov: 34,
    },
    {
      frame: F_NOTBUILT,
      position: P(TOWN_T - 600, TOWN_S - 650, 80),
      target: P(TOWN_T + 60, TOWN_S + 40, 10),
      fov: 33,
    },
    {
      frame: F_QUESTION,
      position: P(TOWN_T - 450, TOWN_S - 520, 70),
      target: P(TOWN_T + 80, TOWN_S + 60, 8),
      fov: 32,
    },
  ]);
};

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const sectionCam = createCameraPath([
  // Inside the canyon: terraces, trees and water.
  {
    frame: F_QUESTION,
    position: V(-10, 30, -140),
    target: V(8, 120, -620),
    fov: 52,
  },
  {
    frame: F_SPRAWL + 40,
    position: V(12, 60, -40),
    target: V(0, 170, -520),
    fov: 50,
  },
  {
    frame: F_REMAINS,
    position: V(260, 260, 900),
    target: V(0, 230, -100),
    fov: 40,
  },
  // Out over the desert that surrounds it.
  {
    frame: END,
    position: V(1900, 820, 2600),
    target: V(0, 180, -900),
    fov: 38,
  },
]);

// Hand-drawn, stylised Brasília plan (Plano Piloto): the curved residential
// axis crossed by the straight monumental axis, beside the lake.
const PlanPanel: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => {
  if (opacity <= 0) return null;
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const d1 = interpolate(
    frame,
    [F_BRASILIA - 5, F_BRASILIA + 35],
    [0, 1],
    clamp,
  );
  const d2 = interpolate(frame, [F_SLOWER - 5, F_SLOWER + 25], [0, 1], clamp);
  const cells = Array.from({ length: 12 * 8 }, (_, i) => i);
  const filled = (i: number) => ((i * 7919) % 97) / 97 < 0.28 && i % 12 < 6;
  return (
    <AbsoluteFill style={{ opacity, fontFamily: INTER }}>
      <AbsoluteFill style={{ background: "rgba(10,14,20,0.9)" }} />
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {/* Brasília (left) */}
        <g transform="translate(520 520)" opacity={d1}>
          <path
            d="M-330 -60 C -180 120, 180 120, 330 -60"
            fill="none"
            stroke="#8fe6ff"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={900}
            strokeDashoffset={900 * (1 - d1)}
          />
          <path
            d="M-10 -260 L 6 260"
            fill="none"
            stroke="#8fe6ff"
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={540}
            strokeDashoffset={540 * (1 - d1)}
          />
          <path
            d="M210 -250 C 330 -170, 400 -40, 360 90 C 330 190, 230 240, 150 300"
            fill="none"
            stroke="rgba(143,230,255,0.45)"
            strokeWidth={4}
            strokeDasharray="10 8"
          />
        </g>
        {/* Illustrative plan only partly filled (right) */}
        <g transform="translate(1090 330)" opacity={d2}>
          {cells.map((i) => (
            <rect
              key={i}
              x={(i % 12) * 52}
              y={Math.floor(i / 12) * 52}
              width={44}
              height={44}
              fill={filled(i) ? "rgba(255,208,138,0.85)" : "none"}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth={1.5}
            />
          ))}
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          left: 220,
          top: 860,
          color: "#8fe6ff",
          opacity: d1,
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 700 }}>Brasília</div>
        <div style={{ fontSize: 20, opacity: 0.85 }}>
          a planned capital that became a living city
        </div>
        <div style={{ fontSize: 16, opacity: 0.6, marginTop: 4 }}>
          hand-drawn, stylised plan
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1090,
          top: 780,
          color: "#ffd08a",
          opacity: d2,
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 700 }}>
          The plan vs. the city that grew
        </div>
        <div style={{ fontSize: 18, opacity: 0.6, marginTop: 4 }}>
          illustrative · not a specific city
        </div>
      </div>
      <div
        style={{ position: "absolute", left: 220, top: 150, color: "white" }}
      >
        <div style={{ fontSize: 18, letterSpacing: 2, opacity: 0.7 }}>
          PLANNED CITIES
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Scene14BiggerPicture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const world = useAsyncResource("Loading NEOM terrain", loadLateMorning);
  const cam = useMemo(
    () => (world ? townCamera(world.route, world.terrain.heightAt) : null),
    [world],
  );
  const atmosphere = useMemo(
    () => (world ? createAtmosphereUniforms(world.atmosphere) : null),
    [world],
  );
  const centre = useMemo(() => {
    if (!world) return null;
    const p = world.route.point(TOWN_T, TOWN_S, 0);
    return new THREE.Vector2(p.x, p.z);
  }, [world]);
  if (!world || !cam || !atmosphere || !centre)
    return <AbsoluteFill style={{ background: "black" }} />;
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const grow =
    interpolate(frame, [F_DEMAND, F_ORIGINAL], [0.08, 0.4], clamp) +
    interpolate(frame, [F_GROW - 20, F_QUESTION - 10], [0, 0.6], clamp);
  const plans = interpolate(
    frame,
    [F_HISTORY - 8, F_HISTORY + 8, F_NOTBUILT - 10, F_NOTBUILT + 4],
    [0, 1, 1, 0],
    clamp,
  );
  const inSection = frame >= F_QUESTION;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {inSection ? (
        <Stage3D camera={sectionCam(frame)} exposure={0.85} near={0.5}>
          <SectionEnvironment frontGround={frame > F_REMAINS - 20} />
          <VerticalCity trainFront={-4000} />
        </Stage3D>
      ) : (
        <Stage3D camera={cam(frame)} exposure={world.exposure}>
          <NeomExteriorWorld world={world} options={{ time: frame / fps }}>
            <Settlement
              centre={centre}
              radius={240}
              heightAt={world.terrain.heightAt}
              atmosphere={atmosphere}
              litFraction={0.15}
              grow={grow}
            />
          </NeomExteriorWorld>
        </Stage3D>
      )}
      <FilmGrade grain={0.05} />
      <Card
        kind="official"
        tag="NEOM, 2026"
        text="“phased, demand-led”"
        inFrame={6}
        outFrame={F_DEMAND}
        x={110}
        y={820}
        width={900}
        size={46}
      />
      <Card
        kind="info"
        text="Demand-led"
        sub="build when people and businesses actually want to come"
        inFrame={F_DEMAND}
        outFrame={F_ORIGINAL}
        x={110}
        y={820}
        width={1000}
        size={46}
      />
      <Card
        kind="info"
        text="The original Line: build the future first"
        sub="and trust that nine million people would follow"
        inFrame={F_ORIGINAL}
        outFrame={F_HISTORY - 8}
        x={110}
        y={820}
        width={1100}
        size={42}
      />
      <PlanPanel frame={frame} opacity={plans} />
      <Card
        kind="info"
        text="Cities are not simply built."
        inFrame={F_NOTBUILT}
        outFrame={F_QUESTION}
        x={110}
        y={760}
        width={1000}
        size={44}
      />
      <Card
        kind="info"
        text="They grow: jobs · families · reasons to stay"
        inFrame={F_GROW}
        outFrame={F_QUESTION}
        x={110}
        y={830}
        width={1100}
        size={40}
      />
      <Card
        kind="info"
        text="Could we live more densely?"
        sub="less sprawl · less driving · more space for nature"
        inFrame={F_QUESTION + 10}
        outFrame={F_REMAINS}
        x={110}
        y={820}
        width={1000}
        size={46}
      />
      <Card
        kind="info"
        text="The question remains."
        inFrame={F_REMAINS + 20}
        outFrame={END + 30}
        x={110}
        y={840}
        width={900}
        size={46}
      />
      <ConceptLabel
        detail={
          inSection
            ? "The Line as proposed in 2022 · illustrative cutaway, not built"
            : "Generic town · The Line as proposed in 2022, not built"
        }
      />
    </AbsoluteFill>
  );
};
