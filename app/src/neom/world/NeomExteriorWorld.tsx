import { useMemo } from "react";
import * as THREE from "three";
import { createAtmosphereUniforms } from "../../cinema/atmosphere";
import {
  LINE_2022_PROPOSAL,
  LineStructure,
} from "../../cinema/line/LineStructure";
import { GroundScatter, ScatterArea } from "../../cinema/scatter/GroundScatter";
import { SunriseSky } from "../../cinema/sky/SunriseSky";
import { Terrain } from "../../cinema/terrain/Terrain";
import { WaterSurface } from "../../cinema/water/WaterSurface";
import { NeomWorld } from "./neomWorld";

// The real NEOM landscape with The Line, for exterior scenes after Scene 1.
// (Scene 1 keeps its own approved copy of this setup.)

const WATER_DEEP = new THREE.Color(0.006, 0.032, 0.05);
const WATER_SHALLOW = new THREE.Color(0.02, 0.2, 0.19);

export type ExteriorOptions = {
  showLine?: boolean;
  heroSide?: "left" | "right";
  water?: boolean;
  waterFocusTS?: [number, number];
  // Rocks/shrubs around these route-space points (t, s, radius).
  scatter?: { t: number; s: number; r: number }[];
  rocks?: number;
  shrubs?: number;
  time?: number;
  thermal?: number;
};

export const NeomExteriorWorld: React.FC<{
  world: NeomWorld;
  options: ExteriorOptions;
  children?: React.ReactNode;
}> = ({ world, options, children }) => {
  const {
    showLine = true,
    heroSide = "right",
    water = true,
    waterFocusTS = [3500, -3000],
    scatter = [],
    rocks = 2000,
    shrubs = 1400,
    time = 0,
    thermal = 0,
  } = options;
  const dims = LINE_2022_PROPOSAL;
  const atmosphere = useMemo(
    () => createAtmosphereUniforms(world.atmosphere),
    [world],
  );
  const caster = useMemo(
    () => ({
      route: world.route,
      halfWidth: showLine ? dims.outerHalfWidth : 0,
      height: showLine ? dims.height : 0,
    }),
    [world, showLine, dims],
  );
  const scatterKey = JSON.stringify(scatter);
  const scatterAreas: ScatterArea[] = useMemo(
    () =>
      (JSON.parse(scatterKey) as { t: number; s: number; r: number }[]).map(
        (a) => ({ center: world.route.point(a.t, a.s, 0), radius: a.r }),
      ),
    [world, scatterKey],
  );
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
      return (
        showLine && t > -300 && t < route.length + 300 && Math.abs(s) < 380
      );
    };
  }, [world, showLine]);
  const waterFocus = useMemo(() => {
    const p = world.route.point(waterFocusTS[0], waterFocusTS[1], 0);
    return new THREE.Vector2(p.x, p.z);
  }, [world, waterFocusTS]);
  const { meta } = world.terrain;

  return (
    <>
      <SunriseSky settings={world.sky} />
      <directionalLight
        position={world.sunDir.clone().multiplyScalar(1000)}
        color={world.lighting.sunColor.clone().multiplyScalar(0.5)}
        intensity={1}
      />
      <hemisphereLight
        args={[
          world.lighting.skyColor.clone().multiplyScalar(0.7),
          new THREE.Color(0.5, 0.36, 0.24),
          1.1,
        ]}
      />
      <Terrain
        data={world.terrain}
        atmosphere={atmosphere}
        lighting={world.lighting}
        caster={caster}
      />
      {showLine ? (
        <LineStructure
          route={world.route}
          dims={dims}
          atmosphere={atmosphere}
          sunColor={world.lighting.sunColor}
          heroSide={heroSide}
          thermal={thermal}
        />
      ) : null}
      {water ? (
        <WaterSurface
          terrain={world.terrain}
          minX={meta.minX - 200000}
          maxX={meta.minX + meta.widthM}
          minZ={meta.minZ}
          maxZ={meta.minZ + meta.depthM + 200000}
          focus={waterFocus}
          atmosphere={atmosphere}
          sunColor={world.lighting.sunColor}
          skyColor={world.lighting.skyColor}
          deepColor={WATER_DEEP}
          shallowColor={WATER_SHALLOW}
          time={time}
        />
      ) : null}
      {scatterAreas.length > 0 ? (
        <GroundScatter
          areas={scatterAreas}
          heightAt={heightAt}
          isSea={isSea}
          avoid={avoid}
          atmosphere={atmosphere}
          rocks={rocks}
          shrubs={shrubs}
        />
      ) : null}
      {children}
    </>
  );
};
