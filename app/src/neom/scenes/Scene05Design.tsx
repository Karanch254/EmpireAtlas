import { useMemo } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  createAtmosphereUniforms,
  withAtmosphere,
} from "../../cinema/atmosphere";
import {
  createCameraPath,
  projectToScreen,
} from "../../cinema/camera/cameraPath";
import { loadInter } from "../../cinema/fonts";
import { LINE_2022_PROPOSAL } from "../../cinema/line/LineStructure";
import { Route } from "../../cinema/line/route";
import { HeightCallout, LengthCallout } from "../../cinema/overlays/Callouts";
import { ConceptLabel } from "../../cinema/overlays/ConceptLabel";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { PinLabel } from "../../cinema/overlays/TextCards";
import { Stage3D } from "../../cinema/Stage3D";
import { useAsyncResource } from "../../cinema/useAsyncResource";
import { NeomExteriorWorld } from "../world/NeomExteriorWorld";
import { loadNeomWorld, NeomWorld } from "../world/neomWorld";
import { sentenceFrame } from "./SceneShell";

// Scene 5 - "The design". The 2022 proposal in crisp late-morning light:
// crane up the facade, scale against generic towers, rise to see the
// structure's width, then a fast run beside the mirror wall.

loadInter();
const ID = 5;
const dims = LINE_2022_PROPOSAL;
const F_TWO = sentenceFrame(ID, "The Line would now be two parallel");
const F_GAP = sentenceFrame(ID, "They would face each other");
const F_MIRROR = sentenceFrame(ID, "Their outer walls would be mirrors");

// Generic, unbranded comparison towers (heights in metres).
const TOWERS = [
  { h: 150, label: "150 m", sub: "typical skyscraper", t: 5400, s: -520 },
  { h: 300, label: "300 m", sub: "supertall", t: 5650, s: -560 },
  { h: 828, label: "828 m", sub: "world's tallest building", t: 5950, s: -640 },
];

const loadLateMorning = () => loadNeomWorld("latemorning");

const path = (route: Route) => {
  const P = (t: number, s: number, y: number) => route.point(t, s, y);
  return createCameraPath([
    // Crane up from the foot of the facade.
    {
      frame: 0,
      position: P(4700, -175, 22),
      target: P(5400, -105, 260),
      fov: 40,
    },
    {
      frame: F_TWO - 40,
      position: P(4760, -230, 330),
      target: P(5600, -100, 330),
      fov: 38,
    },
    // Pull back to compare with generic towers.
    {
      frame: F_TWO + 30,
      position: P(4600, -1450, 420),
      target: P(5900, -300, 330),
      fov: 34,
    },
    {
      frame: F_GAP - 20,
      position: P(4700, -1700, 520),
      target: P(6100, -150, 300),
      fov: 33,
    },
    // Rise above: two structures, 200 m overall, running to the horizon.
    {
      frame: F_GAP + 70,
      position: P(5600, -650, 1250),
      target: P(7400, 0, 0),
      fov: 34,
    },
    {
      frame: F_MIRROR - 20,
      position: P(6700, -500, 1350),
      target: P(14000, 0, 200),
      fov: 32,
    },
    // Fast low run beside the mirror wall.
    {
      frame: F_MIRROR + 30,
      position: P(8200, -480, 180),
      target: P(13000, -260, 260),
      roll: -3,
      fov: 36,
    },
    {
      frame: 754,
      position: P(11800, -420, 160),
      target: P(17000, -230, 250),
      roll: -5,
      fov: 36,
    },
  ]);
};

const Towers: React.FC<{ world: NeomWorld; opacity: number }> = ({
  world,
  opacity,
}) => {
  const { group, glass } = useMemo(() => {
    const atm = createAtmosphereUniforms(world.atmosphere);
    const glass = withAtmosphere(
      // Translucent "scale ghosts": a measuring aid, not real buildings.
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.92, 0.95, 1.0),
        emissive: new THREE.Color(0.35, 0.4, 0.48),
        metalness: 0.1,
        roughness: 0.6,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
      atm,
    );
    const g = new THREE.Group();
    for (const tw of TOWERS) {
      const base = world.terrain.heightAt(
        world.route.point(tw.t, tw.s, 0).x,
        world.route.point(tw.t, tw.s, 0).z,
      );
      const p = world.route.point(tw.t, tw.s, base);
      // Stepped tapering silhouette, deliberately generic.
      const steps = tw.h > 500 ? 6 : 3;
      let y = 0;
      for (let i = 0; i < steps; i++) {
        const segH = tw.h * (i === steps - 1 ? 0.12 : 0.88 / (steps - 1));
        const w = (tw.h > 500 ? 70 : 40) * (1 - i / (steps + 1));
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, segH, w), glass);
        m.position.set(p.x, base + y + segH / 2, p.z);
        g.add(m);
        y += segH;
      }
      if (tw.h > 500) {
        const spire = new THREE.Mesh(
          new THREE.CylinderGeometry(1.5, 6, tw.h * 0.18, 8),
          glass,
        );
        spire.position.set(p.x, base + tw.h * 0.91, p.z);
        g.add(spire);
      }
    }
    return { group: g, glass };
  }, [world]);
  glass.opacity = opacity * 0.55;
  group.visible = opacity > 0.001;
  return <primitive object={group} />;
};

export const Scene05Design: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const world = useAsyncResource("Loading NEOM terrain", loadLateMorning);
  const cam = useMemo(() => (world ? path(world.route) : null), [world]);
  if (!world || !cam) return <AbsoluteFill style={{ background: "black" }} />;
  const camera = cam(frame);
  const { route } = world;
  const project = (p: THREE.Vector3) =>
    projectToScreen(camera, p, width, height);

  const tH = 6300;
  const bH = route.baseAt(tH);
  const hb = project(route.point(tH, -dims.outerHalfWidth, bH));
  const ht = project(route.point(tH, -dims.outerHalfWidth, bH + dims.height));
  const hOp = interpolate(
    frame,
    [F_TWO, F_TWO + 12, F_GAP - 10, F_GAP],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const tW = 8200;
  const top = route.baseAt(tW) + dims.height;
  const wA = project(route.point(tW, -dims.outerHalfWidth, top));
  const wB = project(route.point(tW, dims.outerHalfWidth, top));
  const lenA = project(route.point(tW, 0, top));
  const lenB = project(
    route.point(route.length, 0, route.baseAt(route.length) + dims.height),
  );
  const gapOp = interpolate(
    frame,
    [F_GAP + 40, F_GAP + 55, F_MIRROR - 15, F_MIRROR],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const towerOp = interpolate(
    frame,
    [F_TWO + 20, F_TWO + 35, F_GAP - 10, F_GAP],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Stage3D camera={camera} exposure={world.exposure}>
        <NeomExteriorWorld
          world={world}
          options={{
            time: frame / fps,
            scatter: [
              { t: 4800, s: -600, r: 900 },
              { t: 10000, s: -700, r: 1500 },
            ],
          }}
        >
          <Towers world={world} opacity={towerOp} />
        </NeomExteriorWorld>
      </Stage3D>
      <FilmGrade grain={0.05} />
      {hOp > 0 && hb.visible && ht.visible ? (
        <HeightCallout
          bottom={hb}
          top={ht}
          label="500 M"
          sub="proposed height"
          opacity={hOp}
        />
      ) : null}
      {TOWERS.map((tw) => {
        const b = world.terrain.heightAt(
          route.point(tw.t, tw.s, 0).x,
          route.point(tw.t, tw.s, 0).z,
        );
        const p = project(route.point(tw.t, tw.s, b + tw.h + 30));
        return p.visible ? (
          <PinLabel
            key={tw.label}
            x={p.x}
            y={p.y}
            title={tw.label}
            sub={tw.sub}
            opacity={towerOp}
            side="left"
          />
        ) : null;
      })}
      {gapOp > 0 && wA.visible && wB.visible ? (
        <PinLabel
          x={(wA.x + wB.x) / 2}
          y={(wA.y + wB.y) / 2 - 30}
          title="200 M"
          sub="overall width, as proposed"
          opacity={gapOp}
        />
      ) : null}
      {gapOp > 0 && lenA.visible && lenB.visible ? (
        <LengthCallout
          from={lenA}
          to={lenB}
          label="170 KM"
          sub="proposed length"
          opacity={gapOp}
          progress={interpolate(frame, [F_GAP + 40, F_GAP + 90], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
        />
      ) : null}
      <ConceptLabel detail="The Line as proposed in 2022 · not built" />
    </AbsoluteFill>
  );
};
