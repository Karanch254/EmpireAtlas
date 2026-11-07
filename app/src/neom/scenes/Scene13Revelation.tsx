import { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { createCameraPath } from "../../cinema/camera/cameraPath";
import { INTER, loadInter } from "../../cinema/fonts";
import { Route } from "../../cinema/line/route";
import { ConceptLabel } from "../../cinema/overlays/ConceptLabel";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { Card } from "../../cinema/overlays/TextCards";
import { Stage3D } from "../../cinema/Stage3D";
import { useAsyncResource } from "../../cinema/useAsyncResource";
import { NeomExteriorWorld } from "../world/NeomExteriorWorld";
import { loadNeomWorld } from "../world/neomWorld";
import { phraseFrame, sentenceFrame } from "./SceneShell";

// Scene 13 - "The revelation". Back to The Line at sunrise, as the film
// began. The status of each claim is set out; then a dated timeline of the
// reported changes builds up, one entry per sentence; then a slow pull
// away as "budgets, reviews and rewritten web pages" close the scene.

loadInter();
const ID = 13;
const F_HONEST = sentenceFrame(ID, "The honest answer");
const F_OFFICIAL = sentenceFrame(ID, "Officially, The Line");
const F_REPORTED = sentenceFrame(ID, "The two point four");
const F_NEVER = sentenceFrame(ID, "It was never a cut");
const F_PATTERN = sentenceFrame(ID, "But look at the pattern");
const F_POP = sentenceFrame(ID, "The reported population goal");
const F_WORK = sentenceFrame(ID, "Work was reportedly pushed");
const F_NINE = sentenceFrame(ID, "The long-term promise");
const F_FUND = sentenceFrame(ID, "And the people funding it");
const F_COLLAPSE = sentenceFrame(ID, "The Line didn't collapse");
const F_STEP = sentenceFrame(ID, "It shrank step by step");
const F_BUDGETS = phraseFrame(ID, "budgets");
const F_REVIEWS = phraseFrame(ID, "reviews and");
const F_PAGES = phraseFrame(ID, "rewritten web pages");
const END = 1499;

const loadSunrise = () => loadNeomWorld("sunrise");

const cameraFor = (route: Route) => {
  const P = (t: number, s: number, y: number) => route.point(t, s, y);
  return createCameraPath([
    {
      frame: 0,
      position: P(1500, -1900, 300),
      target: P(6500, -80, 330),
      fov: 33,
    },
    {
      frame: F_OFFICIAL,
      position: P(2100, -1700, 290),
      target: P(7000, -80, 320),
      fov: 32,
    },
    {
      frame: F_PATTERN,
      position: P(2900, -1450, 280),
      target: P(7600, -80, 320),
      fov: 31,
    },
    // Behind the timeline panel the camera keeps drifting.
    {
      frame: F_COLLAPSE,
      position: P(3600, -1500, 340),
      target: P(8200, -80, 300),
      fov: 31,
    },
    {
      frame: END,
      position: P(2600, -3600, 700),
      target: P(9000, 0, 250),
      fov: 34,
    },
  ]);
};

type Entry = {
  when: string;
  pos: number; // (date - 2022) / 4.8: position on a 2022.0 -> 2026.8 axis
  text: string;
  source: string;
  kind: "reported" | "official";
  inF: number;
};

const ENTRIES: Entry[] = [
  {
    when: "2022",
    pos: 0.1146,
    text: "Unveiled: 170 km, nine million residents",
    source: "NEOM",
    kind: "official",
    inF: F_PATTERN + 10,
  },
  {
    when: "APR 2024",
    pos: 0.4771,
    text: "2030 population goal: 1.5 million → under 300,000",
    source: "reported · Bloomberg",
    kind: "reported",
    inF: F_POP,
  },
  {
    when: "APR 2026",
    pos: 0.8937,
    text: "Funder: The Line “not a must” by 2030",
    source: "PIF head, in public",
    kind: "official",
    inF: F_FUND,
  },
  {
    when: "MAY 2026",
    pos: 0.9104,
    text: "Work pushed beyond 2030",
    source: "reported · Semafor",
    kind: "reported",
    inF: F_WORK,
  },
  {
    when: "SUMMER 2026",
    pos: 0.9583,
    text: "Nine million residents gone from the official description",
    source: "NEOM website",
    kind: "official",
    inF: F_NINE,
  },
];

const Timeline: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => {
  if (opacity <= 0) return null;
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const x0 = 160;
  const x1 = 1760;
  const y = 330;
  const draw = interpolate(frame, [F_PATTERN, F_PATTERN + 30], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity, fontFamily: INTER }}>
      <AbsoluteFill style={{ background: "rgba(6,10,16,0.86)" }} />
      <div style={{ position: "absolute", left: x0, top: 150, color: "white" }}>
        <div style={{ fontSize: 18, letterSpacing: 2, opacity: 0.7 }}>
          THE PATTERN
        </div>
        <div style={{ fontSize: 40, fontWeight: 700 }}>
          How The Line changed, 2022–2026
        </div>
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <line
          x1={x0}
          y1={y}
          x2={x0 + (x1 - x0) * draw}
          y2={y}
          stroke="rgba(255,255,255,0.6)"
          strokeWidth={3}
        />
        {["2022", "2023", "2024", "2025", "2026"].map((yr, i) => (
          <g key={yr} opacity={draw}>
            <line
              x1={x0 + (i / 4.8) * (x1 - x0)}
              y1={y - 8}
              x2={x0 + (i / 4.8) * (x1 - x0)}
              y2={y + 8}
              stroke="rgba(255,255,255,0.6)"
              strokeWidth={2}
            />
            <text
              x={x0 + (i / 4.8) * (x1 - x0)}
              y={y - 18}
              fill="rgba(255,255,255,0.7)"
              fontSize={20}
              textAnchor="middle"
              fontFamily={INTER}
            >
              {yr}
            </text>
          </g>
        ))}
      </svg>
      {ENTRIES.map((e, i) => {
        const o = interpolate(frame, [e.inF, e.inF + 12], [0, 1], clamp);
        if (o <= 0) return null;
        const x = x0 + e.pos * (x1 - x0);
        const colour = e.kind === "reported" ? "#ffffff" : "#c9d3e0";
        const row = 410 + i * 108;
        return (
          <div key={e.when}>
            <svg
              width={1920}
              height={1080}
              style={{ position: "absolute", opacity: o }}
            >
              <circle cx={x} cy={y} r={9} fill={colour} />
              <line
                x1={x}
                y1={y + 9}
                x2={x}
                y2={row + 10}
                stroke={colour}
                strokeOpacity={0.35}
                strokeWidth={1.5}
                strokeDasharray="4 5"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                left: Math.min(x - 14, 1920 - 760),
                top: row,
                width: 740,
                opacity: o,
                transform: `translateY(${(1 - o) * 10}px)`,
                borderLeft: `3px solid ${colour}`,
                paddingLeft: 14,
                color: colour,
              }}
            >
              <div style={{ fontSize: 15, letterSpacing: 2, opacity: 0.75 }}>
                {e.when} · {e.source.toUpperCase()}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{e.text}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const Scene13Revelation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const world = useAsyncResource("Loading NEOM terrain", loadSunrise);
  const cam = useMemo(() => (world ? cameraFor(world.route) : null), [world]);
  if (!world || !cam) return <AbsoluteFill style={{ background: "black" }} />;
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const panel = interpolate(
    frame,
    [F_PATTERN - 10, F_PATTERN + 8, F_COLLAPSE - 12, F_COLLAPSE + 6],
    [0, 1, 1, 0],
    clamp,
  );
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Stage3D camera={cam(frame)} exposure={world.exposure}>
        <NeomExteriorWorld world={world} options={{ time: frame / fps }} />
      </Stage3D>
      <FilmGrade grain={0.05} />
      <Card
        kind="info"
        text="Did the 170 km city really shrink to 2.4 km?"
        inFrame={6}
        outFrame={F_HONEST + 60}
        x={110}
        y={820}
        width={1100}
        size={44}
      />
      <Card
        kind="official"
        text="Officially, The Line has not been cancelled"
        inFrame={F_OFFICIAL}
        outFrame={F_REPORTED}
        x={110}
        y={820}
        width={980}
        size={38}
      />
      <Card
        kind="reported"
        text="2.4 km: a reported 2030 target, not an official one"
        inFrame={F_REPORTED}
        outFrame={F_NEVER}
        x={110}
        y={820}
        width={980}
        size={38}
      />
      <Card
        kind="info"
        text="Not a cut to the whole plan."
        inFrame={F_NEVER}
        outFrame={F_PATTERN}
        x={110}
        y={760}
        width={980}
        size={40}
      />
      <Card
        kind="info"
        text="Not a measure of what has been built."
        inFrame={phraseFrame(ID, "not a measure")}
        outFrame={F_PATTERN}
        x={110}
        y={830}
        width={980}
        size={40}
      />
      <Timeline frame={frame} opacity={panel} />
      <Card
        kind="info"
        text="Not a single dramatic collapse."
        inFrame={F_COLLAPSE + 6}
        outFrame={F_STEP}
        x={110}
        y={820}
        width={980}
        size={42}
      />
      <Card
        kind="info"
        text="Budgets."
        inFrame={F_BUDGETS}
        outFrame={END + 30}
        x={110}
        y={760}
        width={600}
        size={46}
      />
      <Card
        kind="info"
        text="Reviews."
        inFrame={F_REVIEWS}
        outFrame={END + 30}
        x={110}
        y={825}
        width={600}
        size={46}
      />
      <Card
        kind="info"
        text="Rewritten web pages."
        inFrame={F_PAGES}
        outFrame={END + 30}
        x={110}
        y={890}
        width={800}
        size={46}
      />
      <ConceptLabel detail="The Line as proposed in 2022 · not built" />
    </AbsoluteFill>
  );
};
