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
import { RouteOverlay } from "../../cinema/map/RouteOverlay";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { Card, CornerTag, PinLabel } from "../../cinema/overlays/TextCards";
import { Stage3D } from "../../cinema/Stage3D";
import { sunDirection } from "../../cinema/terrain/terrainData";
import { useAsyncResource } from "../../cinema/useAsyncResource";
import { phraseFrame, sentenceFrame } from "./SceneShell";

// Scene 9 - "The money". The same cartographic NEOM map as Scene 2. The
// full 170 km proposal is lit; as the reported 2030 expectations are read,
// the lit length retracts to the ~2.4 km target and a resident count shrinks
// from 1.5 million to under 300,000. Every figure is labelled as reported.

loadInter();
const ID = 9;
const F_CUT = sentenceFrame(ID, "By 2030, according to");
const F_KM = phraseFrame(ID, "two point four kilometres of The Line");
const F_RES = phraseFrame(ID, "fewer than three hundred thousand");
const F_FUND = sentenceFrame(ID, "The sovereign wealth fund");
const F_WHERE = sentenceFrame(ID, "That is where");
const F_REPORTED = sentenceFrame(ID, "It was a reported target");
const F_NEVER1 = phraseFrame(ID, "never officially announced");
const F_NEVER2 = phraseFrame(ID, "never the size");
const F_NEXT = sentenceFrame(ID, "But over the next two years");
const END = 1196;
const FULL_KM = 170;
const TARGET_KM = 2.4;
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

const P = (t: number, s: number, y: number) => route.point(t, s, y);
const camPath = createCameraPath([
  {
    frame: 0,
    position: P(70000, -150000, 240000),
    target: P(82000, 0, 0),
    fov: 34,
  },
  {
    frame: F_CUT,
    position: P(62000, -125000, 210000),
    target: P(72000, 0, 0),
    fov: 34,
  },
  // Follow the lit length as it retracts towards the start of the route.
  {
    frame: F_KM + 30,
    position: P(30000, -80000, 120000),
    target: P(18000, 0, 0),
    fov: 34,
  },
  {
    frame: F_FUND,
    position: P(24000, -70000, 105000),
    target: P(14000, 0, 0),
    fov: 34,
  },
  // "That is where the figure comes from": down to the segment.
  {
    frame: F_WHERE + 40,
    position: P(5200, -15000, 25000),
    target: P(1400, 0, 0),
    fov: 34,
  },
  {
    frame: F_NEXT,
    position: P(4200, -12500, 21000),
    target: P(1200, 0, 0),
    fov: 32,
  },
  // "...the direction of travel": rise and look along the empty route.
  {
    frame: END,
    position: P(-9000, -26000, 30000),
    target: P(30000, 0, 0),
    fov: 34,
  },
]);

// 1.5 million as 150 dots of 10,000; all but 30 fade at the reported cut.
const Residents: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => {
  if (opacity <= 0) return null;
  const cut = interpolate(frame, [F_RES - 5, F_RES + 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cols = 15;
  const kept = 30;
  const shown = Math.round(
    interpolate(frame, [F_CUT + 10, F_CUT + 70], [0, 150], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const value =
    Math.round(interpolate(cut, [0, 1], [1_500_000, 300_000]) / 10000) * 10000;
  return (
    <div
      style={{
        position: "absolute",
        right: 90,
        top: 150,
        width: 420,
        opacity,
        fontFamily: INTER,
        color: "white",
        background: "rgba(6,10,16,0.72)",
        border: "1px solid rgba(255,255,255,0.3)",
        borderRadius: 8,
        padding: "20px 24px",
      }}
    >
      <div style={{ fontSize: 14, letterSpacing: 2, opacity: 0.75 }}>
        2030 RESIDENTS · REPORTED
      </div>
      <div
        style={{
          fontSize: 52,
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {cut < 1 ? value.toLocaleString("en-GB") : "< 300,000"}
      </div>
      <div style={{ fontSize: 17, opacity: 0.8, marginBottom: 14 }}>
        {cut < 0.5
          ? "hoped for by 2030"
          : "reported expectation, down from 1.5 million"}
      </div>
      <svg width={372} height={250}>
        {Array.from({ length: 150 }, (_, i) => {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const keep = i < kept;
          const fade = keep ? 1 : 1 - 0.8 * cut;
          return i < shown ? (
            <circle
              key={i}
              cx={12 + c * 24.5}
              cy={12 + r * 24.5}
              r={8}
              fill={keep ? "#ffd08a" : `rgba(143,230,255,${0.9 * fade})`}
              stroke={keep ? "none" : "rgba(143,230,255,0.5)"}
              strokeWidth={1}
            />
          ) : null;
        })}
      </svg>
      <div style={{ fontSize: 14, opacity: 0.65, marginTop: 6 }}>
        each dot = 10,000 residents
      </div>
    </div>
  );
};

export const Scene09Money: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const region = useAsyncResource("Loading wide NEOM terrain", loadWide);
  if (!region) return <AbsoluteFill style={{ background: "black" }} />;
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const camera = camPath(frame);
  // The lit length retracts from 170 km to the 2.4 km target.
  const litKm = interpolate(
    frame,
    [F_CUT + 20, F_KM + 20],
    [FULL_KM, TARGET_KM],
    {
      ...clamp,
      easing: (t) => 1 - Math.pow(1 - t, 2),
    },
  );
  const highlight =
    interpolate(frame, [F_KM, F_KM + 20], [0, 1], clamp) *
    (0.85 + 0.15 * Math.sin(frame * 0.25));
  const project = (p: THREE.Vector3) =>
    projectToScreen(camera, p, width, height, 30, 2e7);
  const tip = route.point(Math.max(litKm, TARGET_KM) * 1000, 0, 0);
  tip.y = Math.max(region.heightAt(tip.x, tip.z), 0) + 150;
  const tipS = project(tip);
  const tipOp = interpolate(
    frame,
    [F_CUT + 20, F_CUT + 35, F_KM, F_KM + 15],
    [0, 1, 1, 0],
    clamp,
  );
  const segS = project(route.point(TARGET_KM * 500, 0, 300));
  const segOp = interpolate(
    frame,
    [F_KM + 10, F_KM + 25, F_NEXT, F_NEXT + 20],
    [0, 1, 1, 0.6],
    clamp,
  );
  const resOp = interpolate(
    frame,
    [F_CUT + 5, F_CUT + 20, F_FUND - 10, F_FUND + 5],
    [0, 1, 1, 0],
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
        <RouteOverlay
          route={route}
          heightAt={region.heightAt}
          fullKm={FULL_KM}
          litKm={litKm}
          faint={0.22}
          highlight={highlight}
        />
      </Stage3D>
      <FilmGrade grain={0.04} />
      {tipS.visible ? (
        <PinLabel
          x={tipS.x}
          y={tipS.y}
          title={`${Math.round(litKm)} KM`}
          sub="of the 170 km proposal"
          opacity={tipOp}
          colour="#8fe6ff"
        />
      ) : null}
      {segS.visible ? (
        <PinLabel
          x={segS.x}
          y={segS.y}
          title="~2.4 KM"
          sub="reported 2030 target"
          opacity={segOp}
          colour="#ffd08a"
        />
      ) : null}
      <Residents frame={frame} opacity={resOp} />
      <Card
        kind="reported"
        tag="BLOOMBERG · APRIL 2024"
        text="Saudi officials sharply cut their expectations for The Line"
        inFrame={4}
        outFrame={F_CUT}
        x={110}
        y={800}
        width={980}
        size={36}
      />
      <Card
        kind="reported"
        tag="REPORTED · PERSON FAMILIAR WITH THE PLANS"
        text="By 2030: about 2.4 km completed, fewer than 300,000 residents"
        sub="down from a hoped-for 1.5 million"
        inFrame={F_CUT + 10}
        outFrame={F_FUND}
        x={110}
        y={790}
        width={980}
        size={34}
      />
      <Card
        kind="reported"
        tag="REPORTED · BLOOMBERG"
        text="The sovereign wealth fund had not yet approved NEOM's budget for the year"
        inFrame={F_FUND}
        outFrame={F_WHERE}
        x={110}
        y={800}
        width={980}
        size={34}
      />
      <Card
        kind="info"
        text="A reported target for 2030"
        inFrame={F_REPORTED}
        outFrame={F_NEXT}
        x={110}
        y={720}
        width={900}
        size={40}
      />
      <Card
        kind="info"
        text="Never officially announced"
        inFrame={F_NEVER1}
        outFrame={F_NEXT}
        x={110}
        y={790}
        width={900}
        size={40}
      />
      <Card
        kind="info"
        text="Never the size of the whole project"
        inFrame={F_NEVER2}
        outFrame={F_NEXT}
        x={110}
        y={860}
        width={900}
        size={40}
      />
      <CornerTag
        text="MAP"
        detail="Real NEOM terrain · illustrative alignment · figures as reported"
      />
    </AbsoluteFill>
  );
};
