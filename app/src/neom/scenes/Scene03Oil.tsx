import { useMemo } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  createAtmosphereUniforms,
  withAtmosphere,
} from "../../cinema/atmosphere";
import { createCameraPath } from "../../cinema/camera/cameraPath";
import {
  CountryOutline,
  Earth,
  EARTH_RADIUS_KM,
  lonLatToVec,
} from "../../cinema/earth/Earth";
import { loadInter } from "../../cinema/fonts";
import { OilField } from "../../cinema/industry/OilField";
import { loadBlueMarble } from "../../cinema/map/MapTerrain";
import { FilmGrade } from "../../cinema/overlays/FilmGrade";
import { Card, CornerTag } from "../../cinema/overlays/TextCards";
import { SunriseSky } from "../../cinema/sky/SunriseSky";
import { Stage3D } from "../../cinema/Stage3D";
import { sunDirection } from "../../cinema/terrain/terrainData";
import { useAsyncResource } from "../../cinema/useAsyncResource";
import { phraseFrame, sentenceFrame } from "./SceneShell";

// Scene 3 - "Oil". An illustrative desert oil field at dusk, then Earth from
// orbit (NASA Blue Marble) with Saudi Arabia highlighted.

loadInter();
const ID = 3;
const F_DECADES = sentenceFrame(ID, "For decades");
const F_2016 = sentenceFrame(ID, "In April 2016");
const F_VISION = sentenceFrame(ID, "Launching a plan called Vision 2030");
const F_QUOTE = sentenceFrame(ID, '"We have developed');
const F_CURE = sentenceFrame(ID, "Vision 2030 was meant to be the cure");
const F_TOURISM = phraseFrame(ID, "Tourism");
const F_TECH = phraseFrame(ID, "technology");
const F_ENT = phraseFrame(ID, "entertainment");
const F_IND = phraseFrame(ID, "industry");
const END = 1067;
const X0 = F_VISION - 25; // dissolve from oil field to orbit
const X1 = F_VISION + 10;

const duskSun = sunDirection(282, 1.5);
const oilAtmo = createAtmosphereUniforms({
  sunDir: duskSun,
  hazeSun: new THREE.Color(1.9, 0.8, 0.38),
  hazeAway: new THREE.Color(0.36, 0.34, 0.46),
  density: 0.00011,
  falloff: 1 / 500,
});
const oilSky = {
  sunDir: duskSun,
  zenith: new THREE.Color(0.05, 0.08, 0.2),
  horizon: new THREE.Color(0.75, 0.48, 0.42),
  horizonSun: new THREE.Color(3.2, 1.05, 0.35),
  sunGlow: new THREE.Color(6.0, 2.3, 0.7),
};

const oilCam = createCameraPath([
  // Looking west into the sunset: pumpjacks become silhouettes.
  {
    frame: 0,
    position: new THREE.Vector3(48, 3.2, -13),
    target: new THREE.Vector3(-220, 8, 8),
    fov: 34,
  },
  {
    frame: F_DECADES + 60,
    position: new THREE.Vector3(22, 4.0, -26),
    target: new THREE.Vector3(-320, 9, 10),
    fov: 34,
  },
  {
    frame: F_2016 + 40,
    position: new THREE.Vector3(70, 42, 90),
    target: new THREE.Vector3(-520, 0, -120),
    fov: 34,
  },
  {
    frame: X1 + 5,
    position: new THREE.Vector3(160, 170, 210),
    target: new THREE.Vector3(-1100, 0, -320),
    fov: 33,
  },
]);

// Earth: Arabia in early-morning light, the night side to the west.
const earthSun = lonLatToVec(118, 8, 1).normalize();
const earthCam = createCameraPath([
  {
    frame: X0,
    position: lonLatToVec(28, 14, EARTH_RADIUS_KM * 3.6),
    target: lonLatToVec(40, 22, EARTH_RADIUS_KM * 0.35),
    fov: 30,
  },
  {
    frame: F_CURE,
    position: lonLatToVec(34, 17, EARTH_RADIUS_KM * 2.7),
    target: lonLatToVec(44, 23, EARTH_RADIUS_KM * 0.45),
    fov: 30,
  },
  {
    frame: END,
    position: lonLatToVec(38, 19, EARTH_RADIUS_KM * 2.25),
    target: lonLatToVec(45, 24, EARTH_RADIUS_KM * 0.5),
    fov: 30,
  },
]);

const Ground: React.FC = () => {
  const mat = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d") as CanvasRenderingContext2D;
    let s = 3;
    const r = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    ctx.fillStyle = "#b08a62";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const v = 120 + r() * 70;
      ctx.fillStyle = `rgba(${v + 20},${v},${v - 30},0.35)`;
      ctx.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3);
    }
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = "rgba(90,70,50,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const y = r() * 512;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        170,
        y + (r() - 0.5) * 60,
        340,
        y + (r() - 0.5) * 60,
        512,
        y,
      );
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(400, 400);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return withAtmosphere(
      new THREE.MeshStandardMaterial({ map: t, roughness: 1 }),
      oilAtmo,
    );
  }, []);
  return (
    <mesh rotation-x={-Math.PI / 2} material={mat}>
      <planeGeometry args={[40000, 40000]} />
    </mesh>
  );
};

const loadEarth = async () => {
  const [day, outline] = await Promise.all([
    loadBlueMarble(),
    fetch(staticFile("earth/saudi-arabia.json")).then(
      (r) => r.json() as Promise<CountryOutline>,
    ),
  ]);
  return { day, outline };
};

export const Scene03Oil: React.FC = () => {
  const frame = useCurrentFrame();
  const earth = useAsyncResource("Loading Blue Marble", loadEarth);
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const mix = interpolate(frame, [X0, X1], [0, 1], clamp);
  const showOil = frame < X1;
  const showEarth = frame >= X0;
  const highlight = interpolate(
    frame,
    [F_CURE - 20, F_CURE + 20],
    [0, 1],
    clamp,
  );
  const fadeIn = interpolate(frame, [0, 6], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {showOil ? (
        <AbsoluteFill style={{ opacity: 1 - mix }}>
          <Stage3D
            camera={oilCam(frame)}
            exposure={0.75}
            near={0.5}
            far={900000}
          >
            <SunriseSky settings={oilSky} />
            <directionalLight
              position={duskSun.clone().multiplyScalar(1000)}
              color={new THREE.Color(1.0, 0.55, 0.3)}
              intensity={2.4}
            />
            <hemisphereLight
              args={[
                new THREE.Color(0.3, 0.32, 0.48),
                new THREE.Color(0.35, 0.24, 0.16),
                0.32,
              ]}
            />
            <Ground />
            <OilField
              atmosphere={oilAtmo}
              frame={frame}
              flareColour={new THREE.Color(1.0, 0.55, 0.2)}
            />
          </Stage3D>
          <FilmGrade grain={0.06} />
          <CornerTag
            text="ILLUSTRATIVE"
            detail="A generic oil field · Saudi oil fields lie far from NEOM"
          />
        </AbsoluteFill>
      ) : null}
      {showEarth && earth ? (
        <AbsoluteFill style={{ opacity: mix }}>
          <Stage3D
            camera={earthCam(frame)}
            exposure={0.85}
            near={50}
            far={2e6}
            grade="contrast(1.1) saturate(1.1)"
          >
            <color attach="background" args={["#000000"]} />
            <Earth
              day={earth.day}
              sunDir={earthSun}
              outline={earth.outline}
              highlight={highlight}
              outlineOpacity={0}
            />
          </Stage3D>
          <FilmGrade grain={0.04} />
        </AbsoluteFill>
      ) : null}
      <Card
        kind="info"
        text="Mohammed bin Salman"
        sub="then Deputy Crown Prince · April 2016"
        inFrame={F_2016 + 40}
        outFrame={F_VISION}
        x={110}
        y={820}
        width={900}
        size={46}
      />
      <Card
        kind="info"
        text="VISION 2030"
        sub="national reform plan · launched 25 April 2016"
        inFrame={F_VISION + 5}
        outFrame={F_QUOTE}
        x={110}
        y={790}
        width={900}
        size={70}
      />
      <Card
        kind="quote"
        text="We have developed a case of oil addiction in Saudi Arabia."
        sub="Mohammed bin Salman · Al Arabiya interview, 25 April 2016"
        inFrame={F_QUOTE - 5}
        outFrame={F_CURE}
        x={260}
        y={760}
        width={1400}
        size={48}
        align="center"
      />
      {[
        ["Tourism", F_TOURISM],
        ["Technology", F_TECH],
        ["Entertainment", F_ENT],
        ["Industry", F_IND],
      ].map(([w, f], i) => (
        <Card
          key={w as string}
          kind="info"
          text={w as string}
          inFrame={f as number}
          outFrame={END + 30}
          x={110 + i * 400}
          y={880}
          width={380}
          size={44}
        />
      ))}
      {fadeIn > 0 ? (
        <AbsoluteFill style={{ background: "black", opacity: fadeIn }} />
      ) : null}
    </AbsoluteFill>
  );
};
