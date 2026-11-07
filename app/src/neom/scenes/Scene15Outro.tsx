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
import {
  KNOWVERSE,
  KnowverseGlobe,
  KnowverseWordmark,
} from "../../cinema/brand/Knowverse";
import { INTER, loadInter } from "../../cinema/fonts";
import { Route } from "../../cinema/line/route";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { Card, CornerTag } from "../../cinema/overlays/TextCards";
import { Stage3D } from "../../cinema/Stage3D";
import { useAsyncResource } from "../../cinema/useAsyncResource";
import { NeomExteriorWorld } from "../world/NeomExteriorWorld";
import { loadNeomWorld } from "../world/neomWorld";
import { phraseFrame, sceneById, sentenceFrame } from "./SceneShell";

// Scene 15 - "Outro and end card". Foundations waiting in the sand as
// the light goes: the machinery gone, pile heads half-buried. The closing
// questions, a prompt to comment, then The Knowverse end card and a
// fade to black at the very end of the film.

loadInter();
const ID = 15;
const F_WHETHER = sentenceFrame(ID, "Whether they become");
const F_MONUMENT = phraseFrame(ID, "or a monument");
const F_VISION = sentenceFrame(ID, "Was The Line a vision");
const F_WARNING = phraseFrame(ID, "or a warning");
const F_COMMENTS = sentenceFrame(ID, "Tell us what you think");
const F_SUBSCRIBE = sentenceFrame(ID, "And if you want more");
// Last frame, derived from the narration so a re-recorded closing line can
// change the scene's length without breaking the fade.
const END = sceneById(ID).durationInFrames - 1;

const loadDusk = () => loadNeomWorld("dusk");

const cameraFor = (
  route: Route,
  heightAt: (x: number, z: number) => number,
) => {
  const P = (t: number, s: number, y: number) => {
    const p = route.point(t, s, 0);
    return p.setY(heightAt(p.x, p.z) + y);
  };
  return createCameraPath([
    { frame: 0, position: P(1700, -70, 7), target: P(1900, -20, 0.5), fov: 40 },
    {
      frame: F_WHETHER + 60,
      position: P(1820, -110, 18),
      target: P(2150, -10, 1),
      fov: 38,
    },
    {
      frame: F_VISION + 40,
      position: P(1900, -260, 70),
      target: P(2700, 0, 0),
      fov: 35,
    },
    {
      frame: F_SUBSCRIBE,
      position: P(1950, -420, 150),
      target: P(3200, 0, 10),
      fov: 34,
    },
    {
      frame: END,
      position: P(1980, -460, 170),
      target: P(3400, 0, 20),
      fov: 34,
    },
  ]);
};

const EndCard: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => {
  if (opacity <= 0) return null;
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const sub = interpolate(
    frame,
    [F_SUBSCRIBE + 40, F_SUBSCRIBE + 60],
    [0, 1],
    clamp,
  );
  return (
    <AbsoluteFill
      style={{
        opacity,
        fontFamily: INTER,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(6,18,42,0.78) 0%, rgba(2,4,9,0.94) 70%)",
        }}
      />
      <div
        style={{ position: "relative", textAlign: "center", color: "white" }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <KnowverseGlobe frame={frame} size={250} />
        </div>
        <div style={{ marginTop: 6 }}>
          <KnowverseWordmark scale={0.92} />
        </div>
        <div
          style={{
            fontSize: 21,
            letterSpacing: 7,
            color: KNOWVERSE.ice,
            opacity: 0.75,
            marginTop: 22,
          }}
        >
          MORE STORIES OF THE WORLD'S BOLDEST MEGAPROJECTS
        </div>
        <div
          style={{
            display: "inline-block",
            opacity: sub,
            marginTop: 30,
            padding: "14px 40px",
            background: `linear-gradient(90deg, ${KNOWVERSE.electric}, ${KNOWVERSE.cyan})`,
            borderRadius: 6,
            boxShadow: "0 0 28px rgba(56,225,255,0.45)",
            color: KNOWVERSE.black,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 4,
          }}
        >
          SUBSCRIBE
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 60,
          width: "100%",
          textAlign: "center",
          color: "rgba(216,246,255,0.5)",
          fontSize: 16,
          lineHeight: 1.6,
        }}
      >
        Terrain: AWS Terrain Tiles (incl. NASA SRTM) · Earth imagery: NASA Blue
        Marble · Maps: Natural Earth
        <br />
        Visualisations are illustrative. The Line, as proposed in 2022, has not
        been built.
      </div>
    </AbsoluteFill>
  );
};

export const Scene15Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const world = useAsyncResource("Loading NEOM terrain", loadDusk);
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
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  // Night falls through the scene.
  const exposure =
    world.exposure * interpolate(frame, [0, F_SUBSCRIBE], [0.85, 0.45], clamp);
  const end = interpolate(
    frame,
    [F_SUBSCRIBE - 10, F_SUBSCRIBE + 15],
    [0, 1],
    clamp,
  );
  const fadeOut = interpolate(frame, [END - 30, END], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Stage3D camera={cam(frame)} exposure={exposure}>
        <NeomExteriorWorld
          world={world}
          options={{ showLine: false, time: frame / fps }}
        >
          <ConstructionSite
            route={world.route}
            heightAt={world.terrain.heightAt}
            atmosphere={atmosphere}
            frame={frame}
            bury={0.18}
            showMachines={false}
          />
        </NeomExteriorWorld>
      </Stage3D>
      <FilmGrade grain={0.05} />
      <Card
        kind="info"
        text="Foundations, waiting in the sand."
        inFrame={8}
        outFrame={F_WHETHER}
        x={110}
        y={830}
        width={1000}
        size={44}
      />
      <Card
        kind="info"
        text="The first piece of a new kind of city?"
        inFrame={F_WHETHER + 20}
        outFrame={F_VISION}
        x={110}
        y={760}
        width={1100}
        size={42}
      />
      <Card
        kind="info"
        text="Or a monument to the limits of ambition?"
        inFrame={F_MONUMENT}
        outFrame={F_VISION}
        x={110}
        y={830}
        width={1100}
        size={42}
      />
      <Card
        kind="info"
        text="A vision ahead of its time?"
        inFrame={F_VISION}
        outFrame={F_COMMENTS}
        x={110}
        y={760}
        width={1100}
        size={46}
      />
      <Card
        kind="info"
        text="Or a warning about building the future from the top down?"
        inFrame={F_WARNING}
        outFrame={F_COMMENTS}
        x={110}
        y={830}
        width={1300}
        size={40}
      />
      <Card
        kind="info"
        text="Tell us what you think in the comments."
        inFrame={F_COMMENTS}
        outFrame={F_SUBSCRIBE}
        x={110}
        y={830}
        width={1100}
        size={44}
      />
      {end < 1 ? (
        <CornerTag
          text="ILLUSTRATIVE"
          detail="Generic foundation works on real terrain"
          opacity={1 - end}
        />
      ) : null}
      <EndCard frame={frame} opacity={end} />
      {fadeOut > 0 ? (
        <AbsoluteFill style={{ background: "black", opacity: fadeOut }} />
      ) : null}
    </AbsoluteFill>
  );
};
