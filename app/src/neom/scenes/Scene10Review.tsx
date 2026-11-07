import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { createCameraPath } from "../../cinema/camera/cameraPath";
import { Route } from "../../cinema/line/route";
import { ConceptLabel } from "../../cinema/overlays/ConceptLabel";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { Card } from "../../cinema/overlays/TextCards";
import { Stage3D } from "../../cinema/Stage3D";
import { useAsyncResource } from "../../cinema/useAsyncResource";
import { NeomExteriorWorld } from "../world/NeomExteriorWorld";
import { loadNeomWorld } from "../world/neomWorld";
import { sentenceFrame } from "./SceneShell";

// Scene 10 - "The review". The proposed wall at dusk, the light going: a
// slow, quiet push along the glass while a change of leadership and a
// strategic review are reported. No people are shown.

const ID = 10;
const F_SUCCESSOR = sentenceFrame(ID, "His replacement");
const F_LEADER = sentenceFrame(ID, "A new leader");
const F_NEWREVIEW = sentenceFrame(ID, "A new review");
const F_PRIORITIES = sentenceFrame(ID, "And soon, new priorities");
const END = 516;

const loadDusk = () => loadNeomWorld("dusk");

const cameraFor = (route: Route) => {
  const P = (t: number, s: number, y: number) => route.point(t, s, y);
  return createCameraPath([
    {
      frame: 0,
      position: P(2300, -2500, 230),
      target: P(7200, -60, 330),
      fov: 32,
    },
    {
      frame: F_SUCCESSOR,
      position: P(2700, -2250, 225),
      target: P(7500, -60, 330),
      fov: 31,
    },
    {
      frame: F_LEADER,
      position: P(3200, -1900, 215),
      target: P(7900, -60, 320),
      fov: 30,
    },
    {
      frame: END,
      position: P(3500, -1720, 210),
      target: P(8200, -60, 330),
      fov: 29,
    },
  ]);
};

export const Scene10Review: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const world = useAsyncResource("Loading NEOM terrain", loadDusk);
  const cam = useMemo(() => (world ? cameraFor(world.route) : null), [world]);
  if (!world || !cam) return <AbsoluteFill style={{ background: "black" }} />;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Stage3D camera={cam(frame)} exposure={world.exposure * 0.7}>
        <NeomExteriorWorld
          world={world}
          options={{
            time: frame / fps,
            scatter: [{ t: 3000, s: -2000, r: 900 }],
          }}
        />
      </Stage3D>
      <FilmGrade grain={0.05} />
      <Card
        kind="reported"
        tag="NOVEMBER 2024"
        text="NEOM's long-serving chief executive left"
        sub="no public explanation was given"
        inFrame={6}
        outFrame={F_SUCCESSOR}
        x={110}
        y={800}
        width={900}
        size={38}
      />
      <Card
        kind="reported"
        tag="HIS REPLACEMENT"
        text="Aiman al-Mudaifer, from the sovereign wealth fund"
        sub="began a strategic review"
        inFrame={F_SUCCESSOR}
        outFrame={F_LEADER - 4}
        x={110}
        y={800}
        width={900}
        size={36}
      />
      <Card
        kind="info"
        text="A new leader."
        inFrame={F_LEADER}
        outFrame={END + 30}
        x={110}
        y={720}
        width={700}
        size={46}
      />
      <Card
        kind="info"
        text="A new review."
        inFrame={F_NEWREVIEW}
        outFrame={END + 30}
        x={110}
        y={790}
        width={700}
        size={46}
      />
      <Card
        kind="info"
        text="New priorities."
        inFrame={F_PRIORITIES}
        outFrame={END + 30}
        x={110}
        y={860}
        width={700}
        size={46}
      />
      <ConceptLabel detail="The Line as proposed in 2022 · not built" />
    </AbsoluteFill>
  );
};
