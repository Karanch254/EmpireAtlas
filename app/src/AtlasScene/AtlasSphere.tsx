import { useCurrentFrame, useVideoConfig } from "remotion";

const RADIUS = 1.2;
const AXIAL_TILT = (23.4 * Math.PI) / 180;
const MERIDIANS = 8;

export const AtlasSphere: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Exactly one full turn over the composition, so the spin loops seamlessly.
  const spin = (frame / durationInFrames) * Math.PI * 2;
  // Gentle float, also completing one full cycle over the composition.
  const float = Math.sin((frame / durationInFrames) * Math.PI * 2) * 0.06;

  return (
    <group position={[0, float, 0]} rotation={[0, 0, AXIAL_TILT]}>
      <group rotation={[0, spin, 0]}>
        {/* Polished chrome core */}
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[RADIUS, 128, 128]} />
          <meshPhysicalMaterial
            color="#d9dde4"
            metalness={1}
            roughness={0.12}
            clearcoat={1}
            clearcoatRoughness={0.05}
            envMapIntensity={1.4}
          />
        </mesh>

        {/* Gold equatorial band */}
        <mesh rotation-x={Math.PI / 2} castShadow>
          <torusGeometry args={[RADIUS * 1.003, 0.035, 32, 256]} />
          <meshPhysicalMaterial
            color="#e0b25a"
            metalness={1}
            roughness={0.2}
            clearcoat={0.6}
            envMapIntensity={1.6}
          />
        </mesh>

        {/* Dark gunmetal meridian lines - these make the rotation readable */}
        {new Array(MERIDIANS).fill(true).map((_, i) => (
          <mesh key={i} rotation-y={(i / MERIDIANS) * Math.PI} castShadow>
            <torusGeometry args={[RADIUS * 1.001, 0.009, 16, 256]} />
            <meshStandardMaterial
              color="#2a2f38"
              metalness={1}
              roughness={0.35}
            />
          </mesh>
        ))}

        {/* Latitude lines */}
        {[-0.6, -0.3, 0.3, 0.6].map((lat) => {
          const y = Math.sin(lat * (Math.PI / 2)) * RADIUS;
          const r = Math.cos(lat * (Math.PI / 2)) * RADIUS;
          return (
            <mesh key={lat} position={[0, y, 0]} rotation-x={Math.PI / 2}>
              <torusGeometry args={[r * 1.001, 0.008, 16, 256]} />
              <meshStandardMaterial
                color="#2a2f38"
                metalness={1}
                roughness={0.35}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
};
