import * as THREE from "three";
import { AtmosphereSettings } from "../../cinema/atmosphere";
import { createRoute, Route } from "../../cinema/line/route";
import { SkySettings } from "../../cinema/sky/SunriseSky";
import { TerrainLighting } from "../../cinema/terrain/Terrain";
import {
  loadTerrain,
  sunDirection,
  TerrainData,
} from "../../cinema/terrain/terrainData";

// Shared look and geography for every NEOM scene, so lighting, haze and the
// route of The Line stay consistent across the documentary.

export const NEOM_TERRAIN_FOLDER = "terrain/neom";

export type NeomWorld = {
  terrain: TerrainData;
  route: Route;
  sunDir: THREE.Vector3;
  atmosphere: AtmosphereSettings;
  lighting: TerrainLighting;
  sky: SkySettings;
};

export const SUNRISE_EXPOSURE = 0.42;

export const loadNeomWorld = async (): Promise<NeomWorld> => {
  const terrain = await loadTerrain(NEOM_TERRAIN_FOLDER);
  const { meta } = terrain;
  const sunDir = sunDirection(meta.sun.azimuthDeg, meta.sun.elevationDeg);
  const route = createRoute(
    meta.route.bearingDeg,
    meta.route.lengthM,
    meta.route.baseProfile,
  );
  return {
    terrain,
    route,
    sunDir,
    atmosphere: {
      sunDir,
      hazeSun: new THREE.Color(2.7, 1.45, 0.72),
      hazeAway: new THREE.Color(0.95, 0.93, 1.0),
      density: 0.000015,
      falloff: 1 / 1400,
    },
    lighting: {
      sunColor: new THREE.Color(1.0, 0.6, 0.34).multiplyScalar(16),
      skyColor: new THREE.Color(0.34, 0.44, 0.62).multiplyScalar(1.8),
      bounceColor: new THREE.Color(0.55, 0.38, 0.26).multiplyScalar(0.65),
    },
    sky: {
      sunDir,
      zenith: new THREE.Color(0.16, 0.3, 0.62),
      horizon: new THREE.Color(1.15, 1.02, 1.0),
      horizonSun: new THREE.Color(3.0, 1.45, 0.62),
      sunGlow: new THREE.Color(7.0, 3.6, 1.7),
    },
  };
};
