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
// route of The Line stay consistent across the documentary. Each scene picks
// a lighting preset; "sunrise" is the approved Scene 1 look.

export const NEOM_TERRAIN_FOLDER = "terrain/neom";

export type NeomWorld = {
  terrain: TerrainData;
  route: Route;
  sunDir: THREE.Vector3;
  atmosphere: AtmosphereSettings;
  lighting: TerrainLighting;
  sky: SkySettings;
  exposure: number;
};

export type LightingPresetName = "sunrise" | "latemorning" | "midday" | "dusk";

type LightingPreset = {
  lightFile: string;
  sun?: { azimuthDeg: number; elevationDeg: number }; // default: terrain bake
  exposure: number;
  haze: {
    sun: THREE.Color;
    away: THREE.Color;
    density: number;
    falloff: number;
  };
  lighting: { sun: THREE.Color; sky: THREE.Color; bounce: THREE.Color };
  sky: {
    zenith: THREE.Color;
    horizon: THREE.Color;
    horizonSun: THREE.Color;
    sunGlow: THREE.Color;
  };
};

const C = (r: number, g: number, b: number, k = 1) =>
  new THREE.Color(r, g, b).multiplyScalar(k);

export const SUNRISE_EXPOSURE = 0.42;

const PRESETS: Record<LightingPresetName, LightingPreset> = {
  // Approved Scene 1 look - do not change.
  sunrise: {
    lightFile: "light.png",
    exposure: SUNRISE_EXPOSURE,
    haze: {
      sun: C(2.7, 1.45, 0.72),
      away: C(0.95, 0.93, 1.0),
      density: 0.000015,
      falloff: 1 / 1400,
    },
    lighting: {
      sun: C(1.0, 0.6, 0.34, 16),
      sky: C(0.34, 0.44, 0.62, 1.8),
      bounce: C(0.55, 0.38, 0.26, 0.65),
    },
    sky: {
      zenith: C(0.16, 0.3, 0.62),
      horizon: C(1.15, 1.02, 1.0),
      horizonSun: C(3.0, 1.45, 0.62),
      sunGlow: C(7.0, 3.6, 1.7),
    },
  },
  // Crisp, bright late morning (Scene 5).
  latemorning: {
    lightFile: "light-latemorning.png",
    sun: { azimuthDeg: 115, elevationDeg: 32 },
    exposure: 0.4,
    haze: {
      sun: C(1.55, 1.42, 1.25),
      away: C(0.82, 0.92, 1.1),
      density: 0.000011,
      falloff: 1 / 1600,
    },
    lighting: {
      sun: C(1.0, 0.94, 0.84, 4.6),
      sky: C(0.42, 0.56, 0.82, 1.5),
      bounce: C(0.6, 0.45, 0.32, 0.6),
    },
    sky: {
      zenith: C(0.09, 0.24, 0.66),
      horizon: C(0.9, 0.98, 1.12),
      horizonSun: C(1.4, 1.3, 1.12),
      sunGlow: C(6.0, 5.4, 4.6),
    },
  },
  // Harsh, high midday sun (Scene 7).
  midday: {
    lightFile: "light-midday.png",
    sun: { azimuthDeg: 165, elevationDeg: 68 },
    exposure: 0.36,
    haze: {
      sun: C(1.6, 1.5, 1.38),
      away: C(1.05, 1.06, 1.1),
      density: 0.000014,
      falloff: 1 / 1700,
    },
    lighting: {
      sun: C(1.0, 0.97, 0.92, 4.4),
      sky: C(0.45, 0.55, 0.75, 1.3),
      bounce: C(0.65, 0.5, 0.36, 0.7),
    },
    sky: {
      zenith: C(0.12, 0.27, 0.62),
      horizon: C(1.05, 1.06, 1.1),
      horizonSun: C(1.3, 1.25, 1.15),
      sunGlow: C(6.5, 6.2, 5.6),
    },
  },
  // Quiet dusk after sunset light has almost gone (Scene 8).
  dusk: {
    lightFile: "light-dusk.png",
    sun: { azimuthDeg: 288, elevationDeg: 3 },
    exposure: 0.62,
    haze: {
      sun: C(1.7, 0.78, 0.42),
      away: C(0.32, 0.34, 0.48),
      density: 0.000016,
      falloff: 1 / 1300,
    },
    lighting: {
      sun: C(1.0, 0.5, 0.24, 9),
      sky: C(0.26, 0.3, 0.5, 1.1),
      bounce: C(0.45, 0.28, 0.2, 0.4),
    },
    sky: {
      zenith: C(0.04, 0.07, 0.18),
      horizon: C(0.7, 0.52, 0.5),
      horizonSun: C(2.6, 0.95, 0.35),
      sunGlow: C(5.5, 2.2, 0.75),
    },
  },
};

export const loadNeomWorld = async (
  preset: LightingPresetName = "sunrise",
): Promise<NeomWorld> => {
  const p = PRESETS[preset];
  const terrain = await loadTerrain(NEOM_TERRAIN_FOLDER, p.lightFile);
  const { meta } = terrain;
  const sun = p.sun ?? meta.sun;
  const sunDir = sunDirection(sun.azimuthDeg, sun.elevationDeg);
  const route = createRoute(
    meta.route.bearingDeg,
    meta.route.lengthM,
    meta.route.baseProfile,
  );
  return {
    terrain,
    route,
    sunDir,
    exposure: p.exposure,
    atmosphere: {
      sunDir,
      hazeSun: p.haze.sun.clone(),
      hazeAway: p.haze.away.clone(),
      density: p.haze.density,
      falloff: p.haze.falloff,
    },
    lighting: {
      sunColor: p.lighting.sun.clone(),
      skyColor: p.lighting.sky.clone(),
      bounceColor: p.lighting.bounce.clone(),
    },
    sky: {
      sunDir,
      zenith: p.sky.zenith.clone(),
      horizon: p.sky.horizon.clone(),
      horizonSun: p.sky.horizonSun.clone(),
      sunGlow: p.sky.sunGlow.clone(),
    },
  };
};
