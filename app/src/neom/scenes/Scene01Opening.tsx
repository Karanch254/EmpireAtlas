import { PerspectiveCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
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
  CameraState,
  createCameraPath,
  projectToScreen,
} from "../../cinema/camera/cameraPath";
import { INTER, loadInter } from "../../cinema/fonts";
import {
  LINE_2022_PROPOSAL,
  LineStructure,
} from "../../cinema/line/LineStructure";
import { Route } from "../../cinema/line/route";
import { HeightCallout, LengthCallout } from "../../cinema/overlays/Callouts";
import { ConceptLabel } from "../../cinema/overlays/ConceptLabel";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { GroundScatter } from "../../cinema/scatter/GroundScatter";
import { SunriseSky } from "../../cinema/sky/SunriseSky";
import { Terrain } from "../../cinema/terrain/Terrain";
import { useAsyncResource } from "../../cinema/useAsyncResource";
import { WaterSurface } from "../../cinema/water/WaterSurface";
import { enableMainCameraLayers } from "../../cinema/layers";
import { NARRATION_SENTENCES } from "../narration-timing";
import { audioTimeToFrame } from "../timing";
import { loadNeomWorld, NeomWorld, SUNRISE_EXPOSURE } from "../world/neomWorld";

// Scene 1 - "The impossible city".
// A conceptual reconstruction of The Line's 2022 proposal at sunrise on the
// real terrain of NEOM. One continuous camera move timed to the narration.

loadInter();

const dims = LINE_2022_PROPOSAL;
const WATER_DEEP = new THREE.Color(0.006, 0.032, 0.05);
// Red Sea reef shallows (turquoise), linear colour.
const WATER_SHALLOW = new THREE.Color(0.02, 0.2, 0.19);
const WATER_FOCUS_TS: [number, number] = [3500, -3000];

// Narration anchors (video frames), taken from the measured timings.
const sentenceFrame = (startsWith: string) => {
  const s = NARRATION_SENTENCES.find((x) => x.text.startsWith(startsWith));
  if (!s) throw new Error(`Sentence not found: ${startsWith}`);
  return Math.round(audioTimeToFrame(s.part, s.start));
};
const F_TWO_WALLS = sentenceFrame("Two walls of mirrored glass");
const F_NINE_MILLION = sentenceFrame("Nine million residents");
const F_TITLE = sentenceFrame("It was called The Line");

const buildCameraPath = (route: Route) => {
  const P = (t: number, s: number, y: number) => route.point(t, s, y);
  // s < 0 is the sunny south side, along the Red Sea coast.
  return createCameraPath([
    // Low over the Red Sea at sunrise, sun ahead-left; walls out of frame.
    {
      frame: 0,
      position: P(800, -5200, 38),
      target: P(9000, -9200, 70),
      fov: 32,
    },
    // Start turning towards the coast sooner, so the sea shot doesn't linger.
    {
      frame: 95,
      position: P(1350, -5050, 45),
      target: P(9800, -7800, 85),
      fov: 32,
    },
    {
      frame: 170,
      position: P(1900, -3300, 80),
      target: P(11000, -2300, 260),
      fov: 32,
    },
    // "Two walls of mirrored glass..." - the walls cross the frame
    // diagonally and rise far above the low camera.
    {
      frame: F_TWO_WALLS,
      position: P(2200, -2500, 105),
      target: P(11500, -1700, 300),
      fov: 32,
    },
    {
      frame: 300,
      position: P(3100, -1700, 150),
      target: P(13500, -1100, 340),
      fov: 32,
    },
    {
      frame: 400,
      position: P(4100, -1250, 190),
      target: P(15000, -900, 350),
      fov: 32,
    },
    // "Nine million residents..." - glide in beside the wall as it towers
    // over the camera.
    {
      frame: F_NINE_MILLION,
      position: P(4900, -950, 220),
      target: P(16000, -750, 350),
      roll: -2,
      fov: 32,
    },
    {
      frame: 525,
      position: P(6100, -560, 215),
      target: P(17000, -330, 360),
      roll: -4,
      fov: 33,
    },
    // "It was called The Line." - rise over the gap, looking down its length.
    {
      frame: F_TITLE - 6,
      position: P(7300, -260, 560),
      target: P(18000, -40, 300),
      roll: -1.5,
      fov: 31,
    },
    {
      frame: 604,
      position: P(8700, 0, 820),
      target: P(24000, 0, 150),
      roll: 0,
      fov: 29,
    },
  ]);
};

const RendererSetup: React.FC<{ exposure: number }> = ({ exposure }) => {
  const gl = useThree((s) => s.gl);
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = exposure;
  return null;
};

const World: React.FC<{
  world: NeomWorld;
  camera: CameraState;
  time: number;
}> = ({ world, camera, time }) => {
  const atmosphere = useMemo(
    () => createAtmosphereUniforms(world.atmosphere),
    [world],
  );
  const caster = useMemo(
    () => ({
      route: world.route,
      halfWidth: dims.outerHalfWidth,
      height: dims.height,
    }),
    [world],
  );
  const scatterAreas = useMemo(
    () => [
      { center: world.route.point(4000, -900, 0), radius: 1600 },
      { center: world.route.point(8000, -1000, 0), radius: 1600 },
    ],
    [world],
  );
  const waterFocus = useMemo(() => {
    const p = world.route.point(WATER_FOCUS_TS[0], WATER_FOCUS_TS[1], 0);
    return new THREE.Vector2(p.x, p.z);
  }, [world]);
  const { heightAt } = world.terrain;
  const isSea = useMemo(
    () => (x: number, z: number) => heightAt(x, z) < 1.2,
    [heightAt],
  );
  const avoid = useMemo(() => {
    const { route } = world;
    return (x: number, z: number) => {
      const t = x * route.dir.x + z * route.dir.z;
      const s = x * route.left.x + z * route.left.z;
      return t > -300 && t < route.length + 300 && Math.abs(s) < 380;
    };
  }, [world]);

  return (
    <>
      <PerspectiveCamera
        makeDefault
        ref={(c: THREE.PerspectiveCamera | null) => {
          if (c) enableMainCameraLayers(c);
        }}
        near={3}
        far={900000}
        fov={camera.fov}
        position={camera.position}
        quaternion={camera.quaternion}
      />
      <RendererSetup exposure={SUNRISE_EXPOSURE} />
      <SunriseSky settings={world.sky} />
      <directionalLight
        position={world.sunDir.clone().multiplyScalar(1000)}
        color={new THREE.Color(1.0, 0.64, 0.4)}
        intensity={8}
      />
      <hemisphereLight
        args={[
          new THREE.Color(0.42, 0.52, 0.72),
          new THREE.Color(0.5, 0.36, 0.24),
          1.25,
        ]}
      />
      <Terrain
        data={world.terrain}
        atmosphere={atmosphere}
        lighting={world.lighting}
        caster={caster}
      />
      <LineStructure
        route={world.route}
        dims={dims}
        atmosphere={atmosphere}
        sunColor={world.lighting.sunColor}
        heroSide="right"
      />
      <WaterSurface
        terrain={world.terrain}
        minX={world.terrain.meta.minX - 200000}
        maxX={world.terrain.meta.minX + world.terrain.meta.widthM}
        minZ={world.terrain.meta.minZ}
        maxZ={world.terrain.meta.minZ + world.terrain.meta.depthM + 200000}
        focus={waterFocus}
        atmosphere={atmosphere}
        sunColor={world.lighting.sunColor}
        skyColor={world.lighting.skyColor}
        deepColor={WATER_DEEP}
        shallowColor={WATER_SHALLOW}
        time={time}
      />
      <GroundScatter
        areas={scatterAreas}
        heightAt={heightAt}
        isSea={isSea}
        avoid={avoid}
        atmosphere={atmosphere}
        rocks={2200}
        shrubs={1600}
      />
    </>
  );
};

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [F_TITLE, F_TITLE + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const spacing = interpolate(frame, [F_TITLE, F_TITLE + 40], [34, 22], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (o <= 0) return null;
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", opacity: o }}
    >
      <div
        style={{
          fontFamily: INTER,
          fontWeight: 800,
          fontSize: 150,
          letterSpacing: spacing,
          color: "white",
          textShadow: "0 6px 40px rgba(0,0,0,0.45)",
          marginLeft: spacing,
        }}
      >
        THE LINE
      </div>
    </AbsoluteFill>
  );
};

export const Scene01Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const world = useAsyncResource("Loading NEOM terrain", loadNeomWorld);
  const path = useMemo(
    () => (world ? buildCameraPath(world.route) : null),
    [world],
  );

  if (!world || !path) {
    return <AbsoluteFill style={{ backgroundColor: "black" }} />;
  }

  const camera = path(frame);
  const { route } = world;
  const project = (p: THREE.Vector3) =>
    projectToScreen(camera, p, width, height);

  // Callouts.
  const tH = 9000;
  const side = -dims.outerHalfWidth;
  const baseH = route.baseAt(tH);
  const hBottom = project(route.point(tH, side, baseH));
  const hTop = project(route.point(tH, side, baseH + dims.height));
  const heightOpacity = interpolate(frame, [290, 305, 440, 456], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lenFrom = project(route.point(tH, side, baseH + dims.height));
  const lenTo = project(
    route.point(route.length, side, route.baseAt(route.length) + dims.height),
  );
  const lengthOpacity = interpolate(frame, [380, 392, 446, 458], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lengthProgress = interpolate(frame, [380, 425], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <AbsoluteFill style={{ filter: "contrast(1.08) saturate(1.12)" }}>
        <ThreeCanvas
          width={width}
          height={height}
          gl={{ antialias: true, logarithmicDepthBuffer: true }}
        >
          <World world={world} camera={camera} time={frame / fps} />
        </ThreeCanvas>
      </AbsoluteFill>
      <FilmGrade fadeInFrames={22} />
      {heightOpacity > 0 && hBottom.visible && hTop.visible ? (
        <HeightCallout
          bottom={hBottom}
          top={hTop}
          label="500 M"
          sub="proposed height"
          opacity={heightOpacity}
        />
      ) : null}
      {lengthOpacity > 0 && lenFrom.visible && lenTo.visible ? (
        <LengthCallout
          from={lenFrom}
          to={lenTo}
          label="170 KM"
          sub="proposed length, 2022"
          opacity={lengthOpacity}
          progress={lengthProgress}
        />
      ) : null}
      <Title />
      <ConceptLabel detail="The Line as proposed in 2022 · not built" />
    </AbsoluteFill>
  );
};
