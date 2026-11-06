import { useMemo } from "react";
import * as THREE from "three";
import { AtmosphereUniforms, withAtmosphere } from "../atmosphere";

// An illustrative desert oil field: animated pumpjacks, pipelines on
// supports, storage tanks and flare stacks. Procedural and deterministic.

const rng = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Jack = {
  group: THREE.Group;
  beam: THREE.Group;
  crank: THREE.Group;
  phase: number;
  speed: number;
};

const makeJack = (m: {
  steel: THREE.Material;
  dark: THREE.Material;
  accent: THREE.Material;
}) => {
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, mat: THREE.Material) =>
    new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  // Skid / base.
  const base = box(12, 0.6, 2.6, m.dark);
  base.position.set(0, 0.3, 0);
  g.add(base);
  // Samson post (A-frame).
  for (const z of [-0.9, 0.9]) {
    for (const x of [-1.3, 1.3]) {
      const leg = box(0.35, 6.6, 0.35, m.steel);
      leg.position.set(x * 0.5, 3.6, z * 0.8);
      leg.rotation.z = x > 0 ? -0.18 : 0.18;
      g.add(leg);
    }
  }
  // Walking beam pivots on top of the samson post.
  const beam = new THREE.Group();
  beam.position.set(0, 6.9, 0);
  const b = box(11, 0.7, 0.5, m.accent);
  beam.add(b);
  // Horsehead at the front (+x).
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(
      1.9,
      1.9,
      0.6,
      18,
      1,
      false,
      -Math.PI / 2,
      Math.PI,
    ),
    m.accent,
  );
  head.rotation.x = Math.PI / 2;
  head.position.set(5.6, -0.6, 0);
  beam.add(head);
  // Pitman arms hang from the rear (-x) end.
  const pitman = box(0.2, 4.2, 0.2, m.steel);
  pitman.position.set(-4.6, -2.1, 0.45);
  beam.add(pitman);
  g.add(beam);
  // Crank and counterweights at the rear.
  const crank = new THREE.Group();
  crank.position.set(-4.6, 2.3, 0);
  for (const z of [-0.55, 0.55]) {
    const arm = box(3.2, 0.4, 0.25, m.dark);
    arm.position.set(0, 0, z);
    crank.add(arm);
    const cw = box(1.4, 1.6, 0.35, m.dark);
    cw.position.set(-1.4, 0, z);
    crank.add(cw);
  }
  g.add(crank);
  // Gearbox / motor housing.
  const gear = box(2.2, 1.8, 1.6, m.dark);
  gear.position.set(-4.6, 1.5, 0);
  g.add(gear);
  // Wellhead + polished rod under the horsehead.
  const well = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 2.4, 8),
    m.steel,
  );
  well.position.set(5.6, 1.2, 0);
  g.add(well);
  return { group: g, beam, crank };
};

export type FlareInfo = { position: THREE.Vector3; phase: number };

export const OilField: React.FC<{
  atmosphere: AtmosphereUniforms;
  frame: number;
  flareColour: THREE.Color;
}> = ({ atmosphere, frame, flareColour }) => {
  const { root, jacks, flames } = useMemo(() => {
    const rand = rng(11);
    const mats = {
      steel: withAtmosphere(
        new THREE.MeshStandardMaterial({
          color: 0x26231f,
          envMapIntensity: 0.12,
          metalness: 0.15,
          roughness: 0.85,
        }),
        atmosphere,
      ),
      dark: withAtmosphere(
        new THREE.MeshStandardMaterial({
          color: 0x1b1a19,
          envMapIntensity: 0.12,
          metalness: 0.15,
          roughness: 0.9,
        }),
        atmosphere,
      ),
      accent: withAtmosphere(
        new THREE.MeshStandardMaterial({
          color: 0x3a3020,
          envMapIntensity: 0.12,
          metalness: 0.15,
          roughness: 0.85,
        }),
        atmosphere,
      ),
      pipe: withAtmosphere(
        new THREE.MeshStandardMaterial({
          color: 0x8c8780,
          metalness: 0.85,
          roughness: 0.3,
        }),
        atmosphere,
      ),
      tank: withAtmosphere(
        new THREE.MeshStandardMaterial({
          color: 0xb8b2a6,
          metalness: 0.4,
          roughness: 0.55,
        }),
        atmosphere,
      ),
    };
    const root = new THREE.Group();
    const jacks: Jack[] = [];
    // Pumpjacks on an irregular grid.
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 9; col++) {
        if (rand() < 0.18) continue;
        const { group, beam, crank } = makeJack(mats);
        const x = -col * 160 + (rand() - 0.5) * 60 - 150;
        const z = (row - 3) * 170 + (rand() - 0.5) * 60;
        group.position.set(x, 0, z);
        group.rotation.y = (rand() - 0.5) * 0.5 + (rand() < 0.5 ? 0 : Math.PI);
        const s = 0.9 + rand() * 0.3;
        group.scale.setScalar(s);
        root.add(group);
        jacks.push({
          group,
          beam,
          crank,
          phase: rand() * Math.PI * 2,
          speed: 0.05 + rand() * 0.025,
        });
      }
    }
    // Hero pumpjack close to the camera path, side-on so its beam reads.
    {
      const { group, beam, crank } = makeJack(mats);
      group.position.set(0, 0, 0);
      group.rotation.y = 0.15;
      group.scale.setScalar(1.15);
      root.add(group);
      jacks.push({ group, beam, crank, phase: 0.4, speed: 0.06 });
    }
    // Pipelines on low supports, running along the rows.
    for (let row = 0; row < 7; row++) {
      const z = (row - 3) * 170 + 22;
      const len = 1500;
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, len, 12),
        mats.pipe,
      );
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(-650, 1.2, z);
      root.add(pipe);
      for (let x = -1390; x < 90; x += 18) {
        const sup = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 1.2, 1.2),
          mats.dark,
        );
        sup.position.set(x, 0.6, z);
        root.add(sup);
      }
    }
    // Trunk line towards the tank farm.
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 1300, 14),
      mats.pipe,
    );
    trunk.rotation.x = Math.PI / 2;
    trunk.position.set(-1480, 1.6, 0);
    root.add(trunk);
    // Storage tanks.
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(
        new THREE.CylinderGeometry(24, 24, 16, 40),
        mats.tank,
      );
      t.position.set(-1700 - (i % 3) * 62, 8, -300 - Math.floor(i / 3) * 62);
      root.add(t);
    }
    // Flare stacks.
    const flames: FlareInfo[] = [];
    for (const [x, z] of [
      [1500, -900],
      [1650, -1350],
      [900, -1450],
    ]) {
      const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 1.4, 45, 10),
        mats.dark,
      );
      stack.position.set(x, 22.5, z);
      root.add(stack);
      flames.push({
        position: new THREE.Vector3(x, 47, z),
        phase: rand() * 10,
      });
    }
    return { root, jacks, flames };
  }, [atmosphere]);

  // Animate pumpjacks from the frame number (deterministic).
  for (const j of jacks) {
    const a = j.phase + frame * j.speed * 2;
    j.beam.rotation.z = Math.sin(a) * 0.32;
    j.crank.rotation.z = -a;
  }

  return (
    <>
      <primitive object={root} />
      {flames.map((f, i) => {
        const flick =
          0.75 +
          0.15 * Math.sin(frame * 0.9 + f.phase) +
          0.1 * Math.sin(frame * 2.3 + f.phase * 3);
        return (
          <group key={i} position={f.position}>
            <mesh
              scale={[3.2 * flick, 9 * flick, 3.2 * flick]}
              position={[0, 4 * flick, 0]}
            >
              <sphereGeometry args={[1, 12, 10]} />
              <meshBasicMaterial
                color={flareColour.clone().multiplyScalar(4 * flick)}
                transparent
                opacity={0.85}
                toneMapped
              />
            </mesh>
            <pointLight
              color={flareColour}
              intensity={9000 * flick}
              distance={700}
              decay={2}
            />
          </group>
        );
      })}
    </>
  );
};
