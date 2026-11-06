import { useMemo } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { createAtmosphereUniforms } from "../../cinema/atmosphere";
import {
  createCameraPath,
  projectToScreen,
} from "../../cinema/camera/cameraPath";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { Card, CornerTag, PinLabel } from "../../cinema/overlays/TextCards";
import { Settlement } from "../../cinema/settlement/Settlement";
import { Stage3D } from "../../cinema/Stage3D";
import { useAsyncResource } from "../../cinema/useAsyncResource";
import { NeomExteriorWorld } from "../world/NeomExteriorWorld";
import { loadNeomWorld } from "../world/neomWorld";
import { phraseFrame, sentenceFrame } from "./SceneShell";

// Scene 8 - "The people on the land". A quiet dusk over a generic,
// procedural village on the real coastal plain south of Sharma (the
// al-Khuraybah area; position approximate). No people are shown and nothing
// is re-enacted: the events are carried only by the narration and by text
// cards whose style marks each claim as reported, official or disputed.

const ID = 8;
const F_LAND = sentenceFrame(ID, "And the land was not empty");
const F_TRIBE = sentenceFrame(ID, "Members of the Huwaitat");
const F_VIDEOS = sentenceFrame(ID, "In April 2020, one of them");
const F_SHOT = sentenceFrame(ID, "Shortly afterwards");
const F_OFFICIAL = sentenceFrame(ID, "Saudi authorities said he had");
const F_DISPUTE = sentenceFrame(ID, "Human rights groups dispute");
const F_UN = phraseFrame(ID, "United Nations experts");
const F_BBC = sentenceFrame(ID, "In 2024, a former Saudi");
const F_COMP = sentenceFrame(ID, "Saudi authorities say residents");
const F_MONEY = sentenceFrame(ID, "But in the end");
const END = 1403;

// Village centre (lon 35.245, lat 28.035 - approximate) in world metres.
const CENTRE = new THREE.Vector2(38391, 5531);
// The same point in route space, for water detail.
const C_T = 34184;
const C_S = -18327;

const loadDusk = () => loadNeomWorld("dusk");

const P = (dx: number, y: number, dz: number) =>
  new THREE.Vector3(CENTRE.x + dx, y, CENTRE.y + dz);

// Slow, still camera from the higher ground inland, looking west over the
// village towards the sea and the last of the light.
const cam = createCameraPath([
  { frame: 0, position: P(560, 120, -200), target: P(-60, 34, 30), fov: 28 },
  {
    frame: F_SHOT,
    position: P(500, 108, -230),
    target: P(-50, 34, 20),
    fov: 28,
  },
  {
    frame: F_DISPUTE,
    position: P(450, 100, -250),
    target: P(-40, 34, 10),
    fov: 27,
  },
  {
    frame: F_BBC,
    position: P(420, 98, -200),
    target: P(-40, 35, 20),
    fov: 27,
  },
  {
    frame: F_COMP,
    position: P(400, 104, -140),
    target: P(-90, 38, 40),
    fov: 28,
  },
  // "...money": the camera lifts away from the village to the horizon.
  {
    frame: END,
    position: P(380, 200, -80),
    target: P(-2400, 150, 300),
    fov: 32,
  },
]);

export const Scene08PeopleLand: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const world = useAsyncResource("Loading NEOM terrain", loadDusk);
  const atmosphere = useMemo(
    () => (world ? createAtmosphereUniforms(world.atmosphere) : null),
    [world],
  );
  if (!world || !atmosphere)
    return <AbsoluteFill style={{ background: "black" }} />;
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const camera = cam(frame);
  const village = P(0, world.terrain.heightAt(CENTRE.x, CENTRE.y) + 28, 0);
  const pin = projectToScreen(camera, village, width, height);
  const pinOp = interpolate(
    frame,
    [F_TRIBE, F_TRIBE + 15, F_SHOT - 15, F_SHOT],
    [0, 1, 1, 0],
    clamp,
  );
  const fadeIn = interpolate(frame, [0, F_LAND + 4], [1, 0], clamp);

  const X = 110;
  const Y = 790;
  const W = 1040;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Stage3D camera={camera} exposure={world.exposure * 0.55}>
        <NeomExteriorWorld
          world={world}
          options={{
            showLine: false,
            time: frame / fps,
            waterFocusTS: [C_T - 1800, C_S + 600],
          }}
        >
          <Settlement
            centre={CENTRE}
            radius={260}
            heightAt={world.terrain.heightAt}
            atmosphere={atmosphere}
          />
        </NeomExteriorWorld>
      </Stage3D>
      <FilmGrade grain={0.05} />
      <PinLabel
        x={pin.x}
        y={pin.y}
        title="al-Khuraybah area"
        sub="approximate location · illustrative village"
        opacity={pin.visible ? pinOp : 0}
      />
      <Card
        kind="info"
        text="Members of the Huwaitat tribe lived in the area"
        inFrame={F_TRIBE}
        outFrame={F_VIDEOS}
        x={X}
        y={Y + 40}
        width={W}
        size={38}
      />
      <Card
        kind="reported"
        tag="APRIL 2020 · REPORTED & ACKNOWLEDGED"
        text="Abdul Rahim al-Huwaiti posted videos refusing to leave his home"
        inFrame={F_VIDEOS}
        outFrame={F_SHOT}
        x={X}
        y={Y}
        width={W}
        size={36}
      />
      <Card
        kind="reported"
        tag="APRIL 2020 · REPORTED & ACKNOWLEDGED"
        text="Shot dead by Saudi security forces"
        inFrame={F_SHOT}
        outFrame={F_OFFICIAL}
        x={X}
        y={Y}
        width={W}
        size={40}
      />
      <Card
        kind="official"
        text="He barricaded himself inside and opened fire"
        sub="Saudi authorities"
        inFrame={F_OFFICIAL}
        outFrame={F_DISPUTE}
        x={X}
        y={Y}
        width={W}
        size={38}
      />
      <Card
        kind="disputed"
        tag="ACCOUNT DISPUTED"
        text="Human rights groups dispute the official account"
        inFrame={F_DISPUTE}
        outFrame={F_BBC}
        x={X}
        y={Y}
        width={W}
        size={36}
      />
      <Card
        kind="reported"
        text="UN experts wrote to the Saudi government raising concerns about his death"
        inFrame={F_UN}
        outFrame={F_BBC}
        x={X}
        y={Y - 190}
        width={W}
        size={30}
      />
      <Card
        kind="disputed"
        tag="DISPUTED / UNVERIFIED · BBC, 2024"
        text="A former Saudi intelligence officer said lethal force was authorised to clear the area"
        sub="The BBC could not independently verify this claim"
        inFrame={F_BBC}
        outFrame={F_COMP}
        x={X}
        y={Y - 50}
        width={W}
        size={34}
      />
      <Card
        kind="official"
        text="Residents were offered compensation"
        sub="Saudi authorities"
        inFrame={F_COMP}
        outFrame={F_MONEY + 40}
        x={X}
        y={Y}
        width={W}
        size={38}
      />
      <CornerTag
        text="ILLUSTRATIVE"
        detail="Generic village on real terrain · not a recreation of real homes or events"
      />
      {fadeIn > 0 ? (
        <AbsoluteFill style={{ background: "black", opacity: fadeIn }} />
      ) : null}
    </AbsoluteFill>
  );
};
