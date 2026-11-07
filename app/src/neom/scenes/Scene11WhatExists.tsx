import { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { createAtmosphereUniforms } from "../../cinema/atmosphere";
import { createCameraPath } from "../../cinema/camera/cameraPath";
import { ConstructionSite } from "../../cinema/construction/ConstructionSite";
import { Route } from "../../cinema/line/route";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { Card, CornerTag } from "../../cinema/overlays/TextCards";
import { Stage3D } from "../../cinema/Stage3D";
import { useAsyncResource } from "../../cinema/useAsyncResource";
import { NeomExteriorWorld } from "../world/NeomExteriorWorld";
import { loadNeomWorld } from "../world/neomWorld";
import { sentenceFrame } from "./SceneShell";

// Scene 11 - "What actually exists". No wall: the real ground along the
// route, with illustrative foundation works - a graded strip, rows of
// piles, excavators and piling rigs. At the end, sand drifts over it.

const ID = 11;
const F_EXCAVATORS = sentenceFrame(ID, "Excavators had been");
const F_PILES = sentenceFrame(ID, "NEOM's own updates");
const F_EXISTS = sentenceFrame(ID, "Whatever happens next");
const F_BENEATH = sentenceFrame(ID, "It just lies beneath");
const END = 522;

const loadLateMorning = () => loadNeomWorld("latemorning");

// Heights are metres above the real ground at each point.
const cameraFor = (
  route: Route,
  heightAt: (x: number, z: number) => number,
) => {
  const P = (t: number, s: number, y: number) => {
    const p = route.point(t, s, 0);
    return p.setY(heightAt(p.x, p.z) + y);
  };
  return createCameraPath([
    { frame: 0, position: P(700, -300, 110), target: P(2000, 0, 20), fov: 34 },
    {
      frame: F_EXCAVATORS + 20,
      position: P(1300, -22, 9),
      target: P(1352, -62, 3),
      fov: 40,
    },
    {
      frame: F_PILES + 30,
      position: P(1860, -60, 10),
      target: P(1990, -10, 0.5),
      fov: 40,
    },
    {
      frame: F_EXISTS + 20,
      position: P(2250, -330, 150),
      target: P(3200, 0, 0),
      fov: 34,
    },
    {
      frame: END,
      position: P(2450, -380, 175),
      target: P(3350, 0, 0),
      fov: 33,
    },
  ]);
};

export const Scene11WhatExists: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const world = useAsyncResource("Loading NEOM terrain", loadLateMorning);
  const cam = useMemo(
    () => (world ? cameraFor(world.route, world.terrain.heightAt) : null),
    [world],
  );
  const atmosphere = useMemo(
    () => (world ? createAtmosphereUniforms(world.atmosphere) : null),
    [world],
  );
  if (!world || !cam || !atmosphere)
    return <AbsoluteFill style={{ background: "black" }} />;
  const bury = interpolate(frame, [F_BENEATH, END - 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => t * t * (3 - 2 * t),
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Stage3D camera={cam(frame)} exposure={world.exposure}>
        <NeomExteriorWorld
          world={world}
          options={{ showLine: false, time: frame / fps }}
        >
          <ConstructionSite
            route={world.route}
            heightAt={world.terrain.heightAt}
            atmosphere={atmosphere}
            frame={frame}
            bury={bury}
          />
        </NeomExteriorWorld>
      </Stage3D>
      <FilmGrade grain={0.05} />
      <Card
        kind="reported"
        tag="SINCE 2022"
        text="Excavators cutting into the desert"
        inFrame={F_EXCAVATORS}
        outFrame={F_PILES}
        x={110}
        y={800}
        width={900}
        size={38}
      />
      <Card
        kind="official"
        tag="NEOM CONSTRUCTION UPDATES"
        text="Thousands of foundation piles driven deep into the ground"
        inFrame={F_PILES}
        outFrame={F_EXISTS}
        x={110}
        y={800}
        width={980}
        size={36}
      />
      <Card
        kind="info"
        text="Part of The Line exists."
        inFrame={F_EXISTS}
        outFrame={END + 30}
        x={110}
        y={790}
        width={900}
        size={46}
      />
      <Card
        kind="info"
        text="It lies beneath the sand."
        inFrame={F_BENEATH}
        outFrame={END + 30}
        x={110}
        y={860}
        width={900}
        size={46}
      />
      <CornerTag
        text="ILLUSTRATIVE"
        detail="Generic foundation works on real terrain · not a depiction of a specific site"
      />
    </AbsoluteFill>
  );
};
