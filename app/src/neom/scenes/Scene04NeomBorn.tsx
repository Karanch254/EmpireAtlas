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
import {
  loadBlueMarble,
  loadRegion,
  lonLatToWorld,
  MapLook,
  MapTerrain,
  RegionData,
} from "../../cinema/map/MapTerrain";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { Card, CornerTag, PinLabel } from "../../cinema/overlays/TextCards";
import { Stage3D } from "../../cinema/Stage3D";
import { sunDirection } from "../../cinema/terrain/terrainData";
import { useAsyncResource } from "../../cinema/useAsyncResource";
import { phraseFrame, sentenceFrame } from "./SceneShell";

// Scene 4 - "NEOM is born". A cartographic 3D relief of the Arabian
// Peninsula (real elevation and seabed, NASA Blue Marble colour, Natural
// Earth coastlines and borders). Locations that cannot be verified exactly
// are labelled "approximate".

loadInter();
const ID = 4;
const EX = 10; // vertical exaggeration for legibility at this scale
const F_RIYADH = sentenceFrame(ID, "In October 2017");
const F_NEOM = sentenceFrame(ID, "NEOM: a new region");
const F_JORDAN = phraseFrame(ID, "near Jordan and Egypt");
const F_500 = sentenceFrame(ID, "The headline figure");
const F_PROJECTS = sentenceFrame(ID, "NEOM was meant to contain");
const F_PORT = phraseFrame(ID, "an industrial port");
const F_RESORT = phraseFrame(ID, "a mountain resort");
const F_ISLANDS = phraseFrame(ID, "luxury islands");
const F_FACE = sentenceFrame(ID, "But one idea quickly");
const F_LINE = sentenceFrame(ID, "In January 2021");
const F_CARS = sentenceFrame(ID, "Zero cars");
const F_STREETS = sentenceFrame(ID, "Zero streets");
const F_CARBON = sentenceFrame(ID, "Zero carbon");
const END = 1225;

// Approximate places (labelled as such on screen).
const RIYADH = [46.68, 24.71];
const NEOM_OUTLINE: [number, number][] = [
  [34.96, 29.36],
  [35.9, 29.25],
  [36.35, 28.55],
  [36.1, 27.6],
  [35.55, 27.45],
  [35.2, 27.9],
  [34.78, 28.05],
  [34.62, 28.85],
  [34.96, 29.36],
];
const OXAGON = [35.62, 27.42];
const TROJENA = [35.33, 28.62];
const SINDALAH = [34.88, 27.92];
const LINE_START = [34.8541, 28.0847]; // same illustrative start as Scene 1

const look: MapLook = {
  sunDir: sunDirection(300, 35),
  sunColor: new THREE.Color(1.0, 0.95, 0.88).multiplyScalar(1.9),
  skyColor: new THREE.Color(0.5, 0.58, 0.75).multiplyScalar(0.7),
  hazeColor: new THREE.Color(0.32, 0.38, 0.5),
  hazeDensity: 0.00000018,
  coolGrade: 0.12,
};

const load = async () => {
  const [region, albedo] = await Promise.all([
    loadRegion("terrain/peninsula"),
    loadBlueMarble(),
  ]);
  return { region, albedo };
};

const W = (r: RegionData, lon: number, lat: number, lift = 0) => {
  const p = lonLatToWorld(r.meta, lon, lat);
  p.y = Math.max(r.heightAt(p.x, p.z), 0) * EX + lift;
  return p;
};

const MapLines: React.FC<{ r: RegionData; borderOpacity: number }> = ({
  r,
  borderOpacity,
}) => {
  const { coast, borders } = useMemo(() => {
    const toV = (pts: [number, number][]) =>
      pts.map(([x, z]) => new THREE.Vector3(x, 400, z));
    const lines = r.lines;
    if (!lines) return { coast: [], borders: [] };
    const c = lines.coast.filter((p) => p.length > 3).map(toV);
    const keep = [
      "Saudi Arabia",
      "Jordan",
      "Egypt",
      "Iraq",
      "Yemen",
      "Oman",
      "United Arab Emirates",
      "Kuwait",
      "Qatar",
      "Israel",
      "Palestine",
      "Sudan",
      "Eritrea",
    ];
    const b = keep
      .filter((n) => lines.countries[n])
      .flatMap((n) => lines.countries[n].map(toV));
    return { coast: c, borders: b };
  }, [r]);
  return (
    <>
      {coast.map((pts, i) => (
        <Line
          key={`c${i}`}
          points={pts}
          color="#dfeaf5"
          lineWidth={1.4}
          transparent
          opacity={0.55}
          depthTest={false}
          toneMapped={false}
        />
      ))}
      {borders.map((pts, i) => (
        <Line
          key={`b${i}`}
          points={pts}
          color="#ffe2a8"
          lineWidth={1.6}
          transparent
          opacity={0.6 * borderOpacity}
          depthTest={false}
          toneMapped={false}
          dashed
          dashSize={9000}
          gapSize={6000}
        />
      ))}
    </>
  );
};

const MapText: React.FC<{
  x: number;
  y: number;
  text: string;
  opacity: number;
  size?: number;
  italic?: boolean;
}> = ({ x, y, text, opacity, size = 26, italic }) =>
  opacity > 0 ? (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        fontFamily: INTER,
        fontSize: size,
        fontWeight: 600,
        fontStyle: italic ? "italic" : "normal",
        letterSpacing: 6,
        color: italic ? "#bfe3ff" : "#ffffff",
        opacity,
        textShadow: "0 2px 12px rgba(0,0,0,0.7)",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  ) : null;

export const Scene04NeomBorn: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const data = useAsyncResource("Loading peninsula relief", load);
  const cam = useMemo(() => {
    if (!data) return null;
    const r = data.region;
    const P = (lon: number, lat: number, alt: number) =>
      lonLatToWorld(r.meta, lon, lat, alt);
    return createCameraPath([
      // Whole peninsula, oblique from the south-west.
      {
        frame: 0,
        position: P(38.5, 9.5, 1250000),
        target: P(45.0, 24.0, 0),
        fov: 32,
      },
      {
        frame: F_NEOM - 10,
        position: P(39.5, 13.5, 1050000),
        target: P(43.0, 25.0, 0),
        fov: 32,
      },
      // Sweep north-west to the Gulf of Aqaba and NEOM.
      {
        frame: F_JORDAN,
        position: P(34.6, 23.5, 520000),
        target: P(35.6, 28.6, 0),
        fov: 32,
      },
      {
        frame: F_PROJECTS,
        position: P(34.4, 25.3, 300000),
        target: P(35.5, 28.4, 0),
        fov: 32,
      },
      {
        frame: F_FACE,
        position: P(34.2, 26.2, 200000),
        target: P(35.5, 28.3, 0),
        fov: 32,
      },
      // Closer over The Line's illustrative route.
      {
        frame: F_CARS,
        position: P(34.9, 26.4, 175000),
        target: P(35.75, 28.4, 0),
        fov: 32,
      },
      {
        frame: END,
        position: P(35.2, 26.6, 158000),
        target: P(35.95, 28.45, 0),
        fov: 31,
      },
    ]);
  }, [data]);
  if (!data || !cam) return <AbsoluteFill style={{ background: "black" }} />;
  const r = data.region;
  const camera = cam(frame);
  const project = (p: THREE.Vector3) =>
    projectToScreen(camera, p, width, height, 100, 5e7);
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const fade = (a: number, b = 1e9, d = 12) =>
    interpolate(frame, [a, a + d, b - d, b], [0, 1, 1, 0], clamp);

  const neomPts = NEOM_OUTLINE.map(([lo, la]) => W(r, lo, la, 2500));
  const neomOp = interpolate(frame, [F_NEOM + 20, F_NEOM + 45], [0, 1], clamp);
  const lineDraw = interpolate(
    frame,
    [F_LINE + 10, F_LINE + 80],
    [0, 1],
    clamp,
  );
  const linePts: THREE.Vector3[] = [];
  const startW = lonLatToWorld(r.meta, LINE_START[0], LINE_START[1]);
  const dir = new THREE.Vector3(
    Math.sin((70 * Math.PI) / 180),
    0,
    -Math.cos((70 * Math.PI) / 180),
  );
  for (let t = 0; t <= 170000 * lineDraw; t += 2000) {
    const p = startW.clone().addScaledVector(dir, t);
    p.y = Math.max(r.heightAt(p.x, p.z), 0) * EX + 3000;
    linePts.push(p);
  }
  const lbl = (lon: number, lat: number, lift = 4000) =>
    project(W(r, lon, lat, lift));
  const riyadh = lbl(RIYADH[0], RIYADH[1]);
  const ox = lbl(OXAGON[0], OXAGON[1]);
  const tr = lbl(TROJENA[0], TROJENA[1]);
  const si = lbl(SINDALAH[0], SINDALAH[1]);
  const neomC = lbl(35.55, 28.6, 8000);
  const lineMid = project(
    startW.clone().addScaledVector(dir, 90000).setY(8000),
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#05070b" }}>
      <Stage3D
        camera={camera}
        exposure={0.55}
        near={100}
        far={5e7}
        grade="contrast(1.07) saturate(1.05)"
      >
        <color attach="background" args={["#05070b"]} />
        <MapTerrain
          data={r}
          look={look}
          exaggeration={EX}
          albedo={data.albedo}
          step={2}
        />
        <MapLines
          r={r}
          borderOpacity={interpolate(
            frame,
            [F_NEOM, F_NEOM + 30],
            [0.4, 1],
            clamp,
          )}
        />
        {neomOp > 0 ? (
          <>
            <Line
              points={neomPts}
              color="#7fe8ff"
              lineWidth={10}
              transparent
              opacity={0.25 * neomOp}
              depthTest={false}
              toneMapped={false}
            />
            <Line
              points={neomPts}
              color="#c9f6ff"
              lineWidth={3}
              transparent
              opacity={neomOp}
              depthTest={false}
              toneMapped={false}
            />
          </>
        ) : null}
        {linePts.length > 1 ? (
          <>
            <Line
              points={linePts}
              color="#ffb85a"
              lineWidth={16}
              transparent
              opacity={0.35}
              depthTest={false}
              toneMapped={false}
            />
            <Line
              points={linePts}
              color="#fff1d6"
              lineWidth={4}
              depthTest={false}
              toneMapped={false}
            />
          </>
        ) : null}
      </Stage3D>
      <FilmGrade grain={0.04} />
      {/* Geography labels */}
      {(() => {
        const t = (
          lon: number,
          lat: number,
          text: string,
          op: number,
          size?: number,
          italic?: boolean,
        ) => {
          const p = project(lonLatToWorld(r.meta, lon, lat, 30000));
          return p.visible ? (
            <MapText
              key={text}
              x={p.x}
              y={p.y}
              text={text}
              opacity={op}
              size={size}
              italic={italic}
            />
          ) : null;
        };
        return (
          <>
            {t(44.5, 23.0, "SAUDI ARABIA", fade(10, F_JORDAN + 40), 34)}
            {t(38.6, 20.3, "RED SEA", fade(F_NEOM, END), 24, true)}
            {t(
              34.75,
              28.9,
              "GULF OF AQABA",
              fade(F_JORDAN - 10, END),
              18,
              true,
            )}
            {t(33.0, 28.8, "EGYPT", fade(F_JORDAN, END), 24)}
            {t(36.6, 30.4, "JORDAN", fade(F_JORDAN, END), 24)}
          </>
        );
      })()}
      {riyadh.visible ? (
        <PinLabel
          x={riyadh.x}
          y={riyadh.y}
          title="Riyadh"
          sub="Future Investment Initiative, Oct 2017"
          opacity={fade(F_RIYADH + 10, F_NEOM + 10)}
        />
      ) : null}
      {neomC.visible ? (
        <PinLabel
          x={neomC.x}
          y={neomC.y}
          title="NEOM"
          sub="26,500 km² · approximate boundary"
          opacity={fade(F_NEOM + 35, F_PROJECTS)}
          colour="#9ff0ff"
        />
      ) : null}
      {ox.visible ? (
        <PinLabel
          x={ox.x}
          y={ox.y}
          title="Oxagon"
          sub="industrial port · planned · approx."
          opacity={fade(F_PORT, F_FACE + 10)}
          colour="#ffd08a"
        />
      ) : null}
      {tr.visible ? (
        <PinLabel
          x={tr.x}
          y={tr.y}
          title="Trojena"
          sub="mountain resort · planned · approx."
          opacity={fade(F_RESORT, F_FACE + 10)}
          colour="#ffd08a"
        />
      ) : null}
      {si.visible ? (
        <PinLabel
          x={si.x}
          y={si.y}
          title="Sindalah"
          sub="island resort · planned · approx."
          opacity={fade(F_ISLANDS, F_FACE + 10)}
          colour="#ffd08a"
          side="left"
        />
      ) : null}
      {lineMid.visible ? (
        <PinLabel
          x={lineMid.x}
          y={lineMid.y - 40}
          title="THE LINE"
          sub="announced January 2021 · illustrative alignment"
          opacity={fade(F_LINE + 40, END + 20)}
          colour="#ffe6b8"
        />
      ) : null}
      <Card
        kind="info"
        text="NEOM"
        sub="announced October 2017 · part of Saudi Vision 2030"
        inFrame={F_NEOM}
        outFrame={F_500}
        x={110}
        y={760}
        width={900}
        size={64}
      />
      <Card
        kind="info"
        text="$500 billion"
        sub="headline figure, 2017"
        inFrame={F_500}
        outFrame={F_PROJECTS + 10}
        x={110}
        y={760}
        width={900}
        size={64}
      />
      <Card
        kind="info"
        text="Zero cars."
        inFrame={F_CARS}
        outFrame={END + 30}
        x={110}
        y={700}
        width={700}
        size={52}
      />
      <Card
        kind="info"
        text="Zero streets."
        inFrame={F_STREETS}
        outFrame={END + 30}
        x={110}
        y={772}
        width={700}
        size={52}
      />
      <Card
        kind="info"
        text="Zero carbon emissions."
        inFrame={F_CARBON}
        outFrame={END + 30}
        x={110}
        y={844}
        width={900}
        size={52}
      />
      <CornerTag
        text="MAP"
        detail="Relief exaggerated ×10 · NASA Blue Marble · Natural Earth"
      />
    </AbsoluteFill>
  );
};
