import * as THREE from "three";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  BANDS,
  SectionEnvironment,
  VerticalCity,
} from "../../cinema/city/VerticalCity";
import {
  createCameraPath,
  projectToScreen,
} from "../../cinema/camera/cameraPath";
import { INTER, loadInter } from "../../cinema/fonts";
import { ConceptLabel } from "../../cinema/overlays/ConceptLabel";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { Card, PinLabel } from "../../cinema/overlays/TextCards";
import { Stage3D } from "../../cinema/Stage3D";
import { phraseFrame, sentenceFrame } from "./SceneShell";

// Scene 6 - "Inside the city". A cutaway section of the proposed vertical
// city: stacked homes, schools, offices and parks around an open canyon,
// the five-minute-walk idea, the rail line beneath, a population comparison
// with London, then the wider desert the design promised to leave untouched.

loadInter();
const ID = 6;
const F_HOMES = phraseFrame(ID, "Homes");
const F_SCHOOLS = phraseFrame(ID, "schools");
const F_OFFICES = phraseFrame(ID, "offices");
const F_PARKS = phraseFrame(ID, "parks");
const F_WALK = phraseFrame(ID, "five-minute walk");
const F_RAIL = sentenceFrame(ID, "Beneath it all");
const F_TWENTY = phraseFrame(ID, "twenty minutes");
const F_NINE = sentenceFrame(ID, "The long-term ambition");
const F_LONDON = phraseFrame(ID, "roughly the size of London");
const F_95 = sentenceFrame(ID, "NEOM said the design");
const F_RADICAL = sentenceFrame(ID, "It was a genuinely radical");
const F_BUT = sentenceFrame(ID, "But radical ideas");
const F_PHYSICS = phraseFrame(ID, "physics,");
const F_MONEY = phraseFrame(ID, "money and");
const F_PEOPLE = phraseFrame(ID, "people.");
const END = 1184;

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const cam = createCameraPath([
  // Inside the canyon, looking up at the stacked terraces.
  { frame: 0, position: V(16, 24, -70), target: V(-12, 190, -470), fov: 54 },
  { frame: 60, position: V(8, 70, 40), target: V(-4, 200, -380), fov: 50 },
  // Out through the cut to the full section.
  {
    frame: F_HOMES + 40,
    position: V(250, 250, 840),
    target: V(0, 225, 0),
    fov: 40,
  },
  { frame: F_WALK, position: V(300, 225, 770), target: V(10, 215, 0), fov: 40 },
  // Down to the rail tunnel.
  {
    frame: F_RAIL + 30,
    position: V(12, -49, 75),
    target: V(-1, -53, -200),
    fov: 44,
  },
  {
    frame: F_NINE,
    position: V(16, -47, 40),
    target: V(-2, -54, -200),
    fov: 42,
  },
  // Out to the desert (behind the London panel).
  {
    frame: F_LONDON + 30,
    position: V(900, 520, 2400),
    target: V(0, 230, -300),
    fov: 38,
  },
  {
    frame: F_95,
    position: V(1800, 880, 3300),
    target: V(0, 200, -700),
    fov: 38,
  },
  {
    frame: F_RADICAL,
    position: V(2500, 1150, 2900),
    target: V(0, 170, -1300),
    fov: 36,
  },
  {
    frame: F_BUT,
    position: V(3100, 760, 1500),
    target: V(0, 240, -1700),
    fov: 36,
  },
  {
    frame: END,
    position: V(3300, 640, 700),
    target: V(0, 260, -2100),
    fov: 36,
  },
]);

// Train: ~140 m/s (170 km in about 20 minutes), arriving at the cut.
const trainFront = (frame: number) => -320 + (frame - (F_RAIL + 20)) * 4.7;

// Hand-drawn, stylised outline of Greater London (approximate; km, east and
// north of the centre) and the Thames.
const LONDON: [number, number][] = [
  [-24, 4],
  [-22.5, 9.5],
  [-17, 13],
  [-12, 17],
  [-5, 19],
  [2, 20],
  [7, 18],
  [12, 14.5],
  [17, 13],
  [22, 10],
  [26, 6],
  [25, 0.5],
  [21, -3],
  [16, -5],
  [13, -9],
  [9, -13.5],
  [4, -20],
  [-1, -18],
  [-6, -15],
  [-11, -14],
  [-15, -10],
  [-20, -8],
  [-26, -4],
  [-27, 0],
];
const THAMES: [number, number][] = [
  [-27, -1.5],
  [-20, -3],
  [-15, -4],
  [-8, -3],
  [-3, 0],
  [0, -1],
  [4, 0.5],
  [8, -2],
  [14, -1],
  [20, -2.5],
  [26, 0],
];

const LondonPanel: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => {
  if (opacity <= 0) return null;
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const k = 8.4; // px per km
  const lineX0 = 210;
  const lineY = 300;
  const lineDraw = interpolate(frame, [F_NINE + 5, F_NINE + 40], [0, 1], clamp);
  const count = Math.round(
    interpolate(frame, [F_NINE + 5, F_NINE + 55], [0, 9_000_000], {
      ...clamp,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    }),
  );
  const ldDraw = interpolate(
    frame,
    [F_LONDON - 5, F_LONDON + 40],
    [0, 1],
    clamp,
  );
  const cx = 960;
  const cy = 680;
  // A gentle hand-drawn wobble, fixed per vertex (deterministic).
  const wob = (i: number) => Math.sin(i * 12.9898) * 0.7;
  // Smooth (Catmull-Rom) path through the wobbled points.
  const pts = (arr: [number, number][], close: boolean) => {
    const P = arr.map(
      ([x, y], i) =>
        [cx + (x + wob(i)) * k, cy - (y + wob(i + 7)) * k] as const,
    );
    const n = P.length;
    const at = (i: number) =>
      close ? P[(i + n) % n] : P[Math.min(Math.max(i, 0), n - 1)];
    let d = `M${P[0][0]} ${P[0][1]}`;
    const segs = close ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
    }
    return d + (close ? " Z" : "");
  };
  const perim = 900;
  return (
    <AbsoluteFill style={{ opacity, fontFamily: INTER }}>
      <AbsoluteFill style={{ background: "rgba(8,14,22,0.97)" }} />
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <line
          x1={lineX0}
          y1={lineY}
          x2={lineX0 + 170 * k * lineDraw}
          y2={lineY}
          stroke="#ffd08a"
          strokeWidth={3}
        />
        <path
          d={pts(LONDON, true)}
          fill={`rgba(143,230,255,${0.08 * ldDraw})`}
          stroke="#8fe6ff"
          strokeWidth={3.5}
          strokeLinejoin="round"
          strokeDasharray={perim}
          strokeDashoffset={perim * (1 - ldDraw)}
        />
        <path
          d={pts(THAMES, false)}
          fill="none"
          stroke="rgba(143,230,255,0.55)"
          strokeWidth={2}
          strokeDasharray={420}
          strokeDashoffset={420 * (1 - ldDraw)}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: lineX0,
          top: lineY - 70,
          color: "#ffd08a",
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 700 }}>
          The Line · 170 km × 200 m
        </div>
        <div style={{ fontSize: 18, opacity: 0.8 }}>
          as proposed in 2022 · to scale
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: lineX0,
          top: lineY + 30,
          color: "white",
          opacity: lineDraw,
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count.toLocaleString("en-GB")}
        </div>
        <div style={{ fontSize: 22, opacity: 0.8 }}>
          planned residents · long-term ambition
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: cx + 30 * k,
          top: cy - 40,
          color: "#8fe6ff",
          opacity: ldDraw,
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 700 }}>Greater London</div>
        <div style={{ fontSize: 20, opacity: 0.85 }}>
          about 9 million people
        </div>
        <div style={{ fontSize: 16, opacity: 0.65, marginTop: 6 }}>
          hand-drawn, stylised outline · same scale
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Scene06InsideCity: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const camera = cam(frame);
  const london = interpolate(
    frame,
    [F_NINE - 8, F_NINE + 6, F_95 - 12, F_95 + 4],
    [0, 1, 1, 0],
    clamp,
  );
  const frontGround = frame > F_LONDON;

  // Programme labels pinned to the right-hand slab of the cut.
  const label = (y: number) =>
    projectToScreen(camera, V(100, y, 0), width, height);
  const progOp = (f: number) =>
    interpolate(
      frame,
      [f, f + 10, F_WALK - 5, F_WALK + 8],
      [0, 1, 1, 0],
      clamp,
    );
  const progs = [
    { f: F_HOMES, y: (BANDS.homes[0] + BANDS.homes[1]) / 2, t: "Homes" },
    {
      f: F_SCHOOLS,
      y: (BANDS.schools[0] + BANDS.schools[1]) / 2,
      t: "Schools",
    },
    {
      f: F_OFFICES,
      y: (BANDS.offices[0] + BANDS.offices[1]) / 2,
      t: "Offices",
    },
    { f: F_PARKS, y: 24, t: "Parks & public space" },
  ];

  // The five-minute walk: a ring spreading from one home across the section.
  const walkR = interpolate(frame, [F_WALK, F_WALK + 30], [0, 1], {
    ...clamp,
    easing: (t) => 1 - Math.pow(1 - t, 2),
  });
  const walkOp = interpolate(
    frame,
    [F_WALK, F_WALK + 6, F_RAIL + 10, F_RAIL + 25],
    [0, 1, 1, 0],
    clamp,
  );
  const walkCentre = projectToScreen(camera, V(-70, 150, 0), width, height);
  const walkEdge = projectToScreen(camera, V(-70 + 400, 150, 0), width, height);
  const walkPx = Math.abs(walkEdge.x - walkCentre.x) * walkR;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Stage3D camera={camera} exposure={0.85} near={0.5}>
        <SectionEnvironment frontGround={frontGround} />
        <VerticalCity trainFront={trainFront(frame)} />
      </Stage3D>
      <FilmGrade grain={0.04} />
      {progs.map((p) => {
        const s = label(p.y);
        return (
          <PinLabel
            key={p.t}
            x={s.x}
            y={s.y}
            title={p.t}
            opacity={progOp(p.f)}
          />
        );
      })}
      {walkOp > 0 ? (
        <svg
          width={width}
          height={height}
          style={{ position: "absolute", opacity: walkOp }}
        >
          <circle
            cx={walkCentre.x}
            cy={walkCentre.y}
            r={walkPx}
            fill="rgba(143,230,255,0.10)"
            stroke="#8fe6ff"
            strokeWidth={3}
            strokeDasharray="12 8"
          />
          <circle cx={walkCentre.x} cy={walkCentre.y} r={7} fill="#8fe6ff" />
        </svg>
      ) : null}
      <Card
        kind="info"
        text="Five-minute walk"
        sub="daily needs within ~400 m, including lifts · as proposed"
        inFrame={F_WALK}
        outFrame={F_RAIL + 20}
        x={110}
        y={830}
        width={900}
        size={46}
      />
      <Card
        kind="info"
        text="High-speed rail"
        sub="end to end in about 20 minutes · as proposed"
        inFrame={F_TWENTY - 40}
        outFrame={F_NINE}
        x={110}
        y={830}
        width={900}
        size={46}
      />
      <LondonPanel frame={frame} opacity={london} />
      <Card
        kind="official"
        tag="NEOM'S CLAIM"
        text="95% of NEOM's land left untouched"
        inFrame={F_95 + 8}
        outFrame={F_RADICAL + 40}
        x={110}
        y={820}
        width={900}
        size={40}
      />
      <Card
        kind="info"
        text="Physics"
        inFrame={F_PHYSICS}
        outFrame={END + 30}
        x={110}
        y={830}
        width={400}
        size={52}
      />
      <Card
        kind="info"
        text="Money"
        inFrame={F_MONEY}
        outFrame={END + 30}
        x={420}
        y={830}
        width={400}
        size={52}
      />
      <Card
        kind="info"
        text="People"
        inFrame={F_PEOPLE}
        outFrame={END + 30}
        x={690}
        y={830}
        width={400}
        size={52}
      />
      <ConceptLabel detail="The Line as proposed in 2022 · illustrative cutaway, not built" />
    </AbsoluteFill>
  );
};
