import { useMemo } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { createCameraPath } from "../../cinema/camera/cameraPath";
import { INTER, loadInter } from "../../cinema/fonts";
import { Flock } from "../../cinema/fx/Flock";
import { WindLines } from "../../cinema/fx/WindLines";
import { LINE_2022_PROPOSAL } from "../../cinema/line/LineStructure";
import { Route } from "../../cinema/line/route";
import { ConceptLabel } from "../../cinema/overlays/ConceptLabel";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { Card } from "../../cinema/overlays/TextCards";
import { Stage3D } from "../../cinema/Stage3D";
import { useAsyncResource } from "../../cinema/useAsyncResource";
import { NeomExteriorWorld } from "../world/NeomExteriorWorld";
import { loadNeomWorld } from "../world/neomWorld";
import { phraseFrame, sentenceFrame } from "./SceneShell";

// Scene 7 - "Physics and birds". Harsh midday on the proposed walls:
// wind forced over the structure, an illustrative heat-exposure map, then a
// migrating flock that turns and climbs away from the glass (no collision
// is shown - the concern is a risk assessment, not an observed event).

loadInter();
const ID = 7;
const dims = LINE_2022_PROPOSAL;
const F_ARCH = sentenceFrame(ID, "Architects and engineers");
const F_WIND = phraseFrame(ID, "resist wind");
const F_HEAT = phraseFrame(ID, "how much heat");
const F_CARBON = phraseFrame(ID, "how much carbon");
const F_BIRDS = sentenceFrame(ID, "Then there were the birds");
const F_STUDY = sentenceFrame(ID, "The region lies on a major");
const F_NEOM = sentenceFrame(ID, "NEOM said the facades");
const END = 1167;

const loadMidday = () => loadNeomWorld("midday");

// The flock: soaring migrants crossing the desert at ~200 m, meeting the
// wall, banking to fly parallel to the glass and drifting away from it.
// (t, s, height above the ground line); s = -100 is the south facade.
const FLOCK_KEYS: [number, number, number][] = [
  [5660, -820, 200],
  [5720, -600, 212],
  [5800, -420, 228],
  [5920, -300, 250], // banking: turning parallel to the glass
  [6080, -270, 272],
  [6240, -320, 292],
  [6380, -430, 310], // drifting away from the wall
];
const FLOCK_F0 = F_BIRDS - 20;
const FLOCK_F1 = END + 20;
const FLOCK_LAG = 7; // mean per-bird lag in Flock

const flockPathFor = (route: Route) => {
  const curve = new THREE.CatmullRomCurve3(
    FLOCK_KEYS.map(([t, s, y]) => route.point(t, s, route.baseAt(t) + y)),
  );
  return (frame: number) =>
    curve.getPointAt(
      THREE.MathUtils.clamp((frame - FLOCK_F0) / (FLOCK_F1 - FLOCK_F0), 0, 1),
    );
};

const cameraFor = (route: Route) => {
  const P = (t: number, s: number, y: number) => route.point(t, s, y);
  const keyed = createCameraPath([
    // Harsh midday: the wall in the open desert.
    {
      frame: 0,
      position: P(3600, -2900, 480),
      target: P(8500, -100, 300),
      fov: 32,
    },
    {
      frame: F_ARCH,
      position: P(4000, -2700, 470),
      target: P(8200, -100, 280),
      fov: 32,
    },
    // Side-on to read the wind lifting over the wall.
    {
      frame: F_WIND + 20,
      position: P(1200, -1400, 360),
      target: P(5200, -150, 300),
      fov: 34,
    },
    // Facing the facade for the heat map.
    {
      frame: F_HEAT + 10,
      position: P(4300, -2100, 330),
      target: P(6100, -100, 260),
      fov: 34,
    },
    {
      frame: F_BIRDS,
      position: P(4900, -2000, 320),
      target: P(6000, -100, 280),
      fov: 34,
    },
  ]);
  // Chase camera: behind and to the desert side of the flock, so the glass
  // stays in frame as the birds bank. After NEOM's response it stops moving
  // and lets the flock fly on.
  const path = flockPathFor(route);
  const awayFromWall = route.left.clone().multiplyScalar(-1);
  const chase = (frame: number) => {
    const f = Math.min(frame, F_NEOM + 40) - FLOCK_LAG;
    const c = path(f);
    const d = path(f + 25)
      .sub(path(f - 25))
      .setY(0);
    if (d.lengthSq() < 1e-6) d.copy(route.dir);
    d.normalize();
    const position = c
      .clone()
      .addScaledVector(d, -62)
      .addScaledVector(awayFromWall, 38)
      .add(new THREE.Vector3(0, -14, 0));
    const look = path(frame - FLOCK_LAG)
      .addScaledVector(d, 25)
      .addScaledVector(awayFromWall, -12);
    const m = new THREE.Matrix4().lookAt(
      position,
      look,
      new THREE.Vector3(0, 1, 0),
    );
    return {
      position,
      quaternion: new THREE.Quaternion().setFromRotationMatrix(m),
    };
  };
  return (frame: number) => {
    const k = keyed(frame);
    const w = interpolate(frame, [F_BIRDS - 15, F_BIRDS + 35], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });
    if (w <= 0) return k;
    const c = chase(frame);
    return {
      position: k.position.clone().lerp(c.position, w),
      quaternion: k.quaternion.clone().slerp(c.quaternion, w),
      fov: THREE.MathUtils.lerp(k.fov, 38, w),
    };
  };
};

// Schematic inset: the Red Sea / Gulf of Aqaba flyway (hand-drawn, approximate).
const FlywayInset: React.FC<{ opacity: number; frame: number }> = ({
  opacity,
  frame,
}) => {
  if (opacity <= 0) return null;
  const dash = -(frame * 1.2) % 40;
  return (
    <div
      style={{
        position: "absolute",
        right: 70,
        top: 110,
        width: 360,
        opacity,
        fontFamily: INTER,
      }}
    >
      <div
        style={{
          background: "rgba(6,12,20,0.72)",
          border: "1px solid rgba(255,255,255,0.35)",
          borderRadius: 8,
          padding: 14,
        }}
      >
        <svg width="332" height="300" viewBox="0 0 332 300">
          <rect width="332" height="300" fill="#2b2418" />
          {/* Sea (schematic): Gulf of Aqaba + northern Red Sea */}
          <path
            d="M150 10 L172 10 L168 90 L190 160 L230 240 L260 300 L180 300 L150 230 L132 150 L140 80 Z"
            fill="#163a52"
          />
          <path
            d="M60 10 L100 10 L118 70 L132 150 L120 160 L95 90 Z"
            fill="#163a52"
          />
          {/* NEOM area */}
          <circle cx="198" cy="118" r="7" fill="#ffd08a" />
          <text x="210" y="122" fill="#ffd08a" fontSize="14" fontWeight="700">
            NEOM
          </text>
          {/* Flyway arrows */}
          <path
            d="M130 0 C 150 90, 170 160, 215 300"
            stroke="#8fe6ff"
            strokeWidth="4"
            fill="none"
            strokeDasharray="14 10"
            strokeDashoffset={dash}
          />
          <path
            d="M175 0 C 190 80, 205 150, 250 300"
            stroke="#8fe6ff"
            strokeWidth="3"
            fill="none"
            strokeDasharray="14 10"
            strokeDashoffset={dash}
            opacity="0.7"
          />
        </svg>
        <div
          style={{
            color: "white",
            fontSize: 18,
            fontWeight: 700,
            marginTop: 8,
          }}
        >
          Major migration route
        </div>
        <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 14 }}>
          Schematic · approximate · not to scale
        </div>
      </div>
    </div>
  );
};

export const Scene07PhysicsBirds: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const world = useAsyncResource("Loading NEOM terrain", loadMidday);
  const cam = useMemo(() => (world ? cameraFor(world.route) : null), [world]);
  const flockPath = useMemo(
    () => (world ? flockPathFor(world.route) : null),
    [world],
  );
  const wallTop = useMemo(
    () =>
      world
        ? (t: number) => world.route.baseAt(t) + dims.height
        : (t: number) => t * 0,
    [world],
  );
  if (!world || !cam || !flockPath)
    return <AbsoluteFill style={{ background: "black" }} />;
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const wind = interpolate(
    frame,
    [F_WIND - 10, F_WIND + 15, F_HEAT - 5, F_HEAT + 15],
    [0, 1, 1, 0],
    clamp,
  );
  const thermal = interpolate(
    frame,
    [F_HEAT, F_HEAT + 20, F_BIRDS - 25, F_BIRDS],
    [0, 0.85, 0.85, 0],
    clamp,
  );
  const inset = interpolate(
    frame,
    [F_STUDY - 10, F_STUDY + 10, F_NEOM - 10, F_NEOM + 10],
    [0, 1, 1, 0],
    clamp,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Stage3D
        camera={cam(frame)}
        exposure={world.exposure}
        grade="contrast(1.12) saturate(1.02)"
      >
        <NeomExteriorWorld
          world={world}
          options={{
            time: frame / fps,
            thermal,
            scatter: [{ t: 4800, s: -2200, r: 1200 }],
          }}
        >
          <WindLines
            route={world.route}
            wallTop={wallTop}
            tValues={[3600, 4300, 5000, 5700, 6400]}
            heights={[60, 180, 320, 460]}
            frame={frame}
            opacity={wind}
          />
          <Flock
            count={70}
            path={flockPath}
            frame={frame}
            spread={28}
            span={2.6}
            visible={frame >= F_BIRDS}
          />
        </NeomExteriorWorld>
      </Stage3D>
      <FilmGrade grain={0.05} />
      <Card
        kind="info"
        text="Concerns raised by architects & engineers"
        inFrame={F_ARCH}
        outFrame={F_BIRDS}
        x={110}
        y={110}
        width={1100}
        size={34}
      />
      <Card
        kind="info"
        text="Wind"
        sub="forced up and over a 500 m wall (illustrative)"
        inFrame={F_WIND}
        outFrame={F_HEAT}
        x={110}
        y={830}
        width={800}
        size={50}
      />
      <Card
        kind="info"
        text="Heat"
        sub="sun exposure on the glass (illustrative heat map)"
        inFrame={F_HEAT}
        outFrame={F_CARBON}
        x={110}
        y={830}
        width={800}
        size={50}
      />
      <Card
        kind="info"
        text="Embodied carbon"
        sub="steel · concrete · glass"
        inFrame={F_CARBON}
        outFrame={F_BIRDS}
        x={110}
        y={830}
        width={800}
        size={50}
      />
      <Card
        kind="reported"
        tag="2024 CONSERVATION STUDY"
        text="Likely to pose a substantial risk to migratory species"
        inFrame={F_STUDY + 60}
        outFrame={F_NEOM}
        x={110}
        y={790}
        width={900}
        size={36}
      />
      <Card
        kind="official"
        tag="NEOM'S RESPONSE"
        text="Facades to be treated to reduce collisions, with nature corridors along migration paths"
        inFrame={F_NEOM + 5}
        outFrame={END + 30}
        x={110}
        y={790}
        width={980}
        size={34}
      />
      <FlywayInset opacity={inset} frame={frame} />
      <ConceptLabel detail="The Line as proposed in 2022 · not built" />
    </AbsoluteFill>
  );
};
