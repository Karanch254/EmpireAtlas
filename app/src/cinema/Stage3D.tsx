import { PerspectiveCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { CameraState } from "./camera/cameraPath";
import { enableMainCameraLayers } from "./layers";

// Standard 3D canvas for the documentary's scenes: logarithmic depth (for
// kilometre-scale worlds), ACES filmic tone mapping with a chosen exposure,
// the keyframed camera, and a gentle contrast/saturation grade.

const RendererSetup: React.FC<{ exposure: number }> = ({ exposure }) => {
  const gl = useThree((s) => s.gl);
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = exposure;
  return null;
};

export const Stage3D: React.FC<{
  camera: CameraState;
  exposure: number;
  near?: number;
  far?: number;
  grade?: string;
  children: React.ReactNode;
}> = ({
  camera,
  exposure,
  near = 3,
  far = 900000,
  grade = "contrast(1.08) saturate(1.12)",
  children,
}) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ filter: grade }}>
      <ThreeCanvas
        width={width}
        height={height}
        gl={{ antialias: true, logarithmicDepthBuffer: true }}
      >
        <PerspectiveCamera
          makeDefault
          ref={(c: THREE.PerspectiveCamera | null) => {
            if (c) enableMainCameraLayers(c);
          }}
          near={near}
          far={far}
          fov={camera.fov}
          position={camera.position}
          quaternion={camera.quaternion}
        />
        <RendererSetup exposure={exposure} />
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
