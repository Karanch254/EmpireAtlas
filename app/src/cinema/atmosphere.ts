import * as THREE from "three";
import { ATMOSPHERE_PARS_GLSL } from "./glsl";

// One set of atmosphere uniforms shared by every material in a scene, so
// terrain, architecture and props all sit in the same haze.

export type AtmosphereSettings = {
  sunDir: THREE.Vector3;
  hazeSun: THREE.Color;
  hazeAway: THREE.Color;
  // Extinction per metre at sea level, and how fast it thins with height.
  density: number;
  falloff: number;
};

export type AtmosphereUniforms = {
  ea_sunDir: { value: THREE.Vector3 };
  ea_hazeSun: { value: THREE.Color };
  ea_hazeAway: { value: THREE.Color };
  ea_hazeDensity: { value: number };
  ea_hazeFalloff: { value: number };
};

export const createAtmosphereUniforms = (
  s: AtmosphereSettings,
): AtmosphereUniforms => ({
  ea_sunDir: { value: s.sunDir.clone().normalize() },
  ea_hazeSun: { value: s.hazeSun.clone() },
  ea_hazeAway: { value: s.hazeAway.clone() },
  ea_hazeDensity: { value: s.density },
  ea_hazeFalloff: { value: s.falloff },
});

// Adds the shared haze to a built-in three.js material (standard, physical…),
// applied in linear light just before tone mapping.
export const withAtmosphere = <T extends THREE.Material>(
  material: T,
  uniforms: AtmosphereUniforms,
): T => {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 ea_vWorld;",
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        {
          vec4 eaWorld = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            eaWorld = instanceMatrix * eaWorld;
          #endif
          ea_vWorld = (modelMatrix * eaWorld).xyz;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 ea_vWorld;\n${ATMOSPHERE_PARS_GLSL}`,
      )
      .replace(
        "#include <tonemapping_fragment>",
        "gl_FragColor.rgb = ea_applyAtmosphere(gl_FragColor.rgb, ea_vWorld);\n#include <tonemapping_fragment>",
      );
  };
  material.customProgramCacheKey = () => "ea-atmosphere";
  return material;
};
