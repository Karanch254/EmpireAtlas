import { Environment, Lightformer, PerspectiveCamera } from "@react-three/drei";
import { ThreeCanvas } from "@remotion/three";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AtlasSphere } from "./AtlasSphere";

// Every animated value below is derived from the current frame only,
// so any frame can be rendered independently and in any order.

const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Slow cinematic push-in with a slight lateral drift.
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(progress, [0, 1], [-0.6, 0.6]);
  const y = 0.5;
  const z = interpolate(progress, [0, 1], [7.2, 6.2]);

  // Aim the camera at the origin without needing an imperative lookAt().
  const yaw = Math.atan2(x, z);
  const pitch = -Math.atan2(y, Math.hypot(x, z));

  return (
    <PerspectiveCamera
      makeDefault
      fov={32}
      near={0.1}
      far={100}
      position={[x, y, z]}
      rotation={[pitch, yaw, 0, "YXZ"]}
    />
  );
};

const Lighting: React.FC = () => {
  return (
    <>
      <ambientLight intensity={0.08} />
      {/* Key light - casts the main shadow */}
      <directionalLight
        castShadow
        position={[4, 7, 5]}
        intensity={2.2}
        color="#fff4e6"
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={6}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={1}
        shadow-camera-far={20}
      />
      {/* Cool rim light from behind for edge separation */}
      <spotLight
        position={[-5, 3, -6]}
        angle={0.5}
        penumbra={1}
        intensity={60}
        color="#6aa8ff"
      />

      {/* Procedural studio environment for reflections (no network HDR files). */}
      <Environment resolution={512}>
        {/* Dim base tone so the chrome reads as metal rather than black glass */}
        <color attach="background" args={["#2a3242"]} />
        <Lightformer
          form="rect"
          intensity={4}
          color="#ffffff"
          position={[0, 5, -2]}
          rotation-x={Math.PI / 2}
          scale={[10, 3, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2.5}
          color="#ffe2c2"
          position={[5, 1, 2]}
          rotation-y={-Math.PI / 2}
          scale={[4, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2}
          color="#8fb8ff"
          position={[-5, 1, -1]}
          rotation-y={Math.PI / 2}
          scale={[4, 6, 1]}
        />
        <Lightformer
          form="ring"
          intensity={3}
          color="#ffffff"
          position={[2, 2, 6]}
          scale={1.5}
        />
      </Environment>
    </>
  );
};

const ShadowFloor: React.FC = () => {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -1.45, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <shadowMaterial transparent opacity={0.55} />
    </mesh>
  );
};

export const AtlasScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.75], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 42%, #1b2233 0%, #0b0e16 45%, #030407 100%)",
      }}
    >
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        gl={{ antialias: true }}
      >
        <CameraRig />
        <Lighting />
        <AtlasSphere />
        <ShadowFloor />
      </ThreeCanvas>

      {/* Cinematic vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.75) 100%)",
          pointerEvents: "none",
        }}
      />
      {/* Fade in from black */}
      <AbsoluteFill style={{ backgroundColor: "black", opacity: fadeIn }} />
    </AbsoluteFill>
  );
};
