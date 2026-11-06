import * as THREE from "three";

// Render layers that keep live mirrors from rendering each other
// (which would multiply render time).
//  0 - all ordinary geometry (seen by every camera)
//  1 - live mirror facades (main camera only)
//  2 - live water mirror (main camera only)
//  3 - cheap stand-ins for mirror facades, seen only inside reflections
//  4 - detail seen by the main camera only (full terrain, rocks)
//  5 - simplified geometry seen only inside reflections
export const MIRROR_FACADE_LAYER = 1;
export const WATER_LAYER = 2;
export const REFLECTION_PROXY_LAYER = 3;
export const MAIN_ONLY_LAYER = 4;
export const REFLECTION_ONLY_LAYER = 5;

export const enableMainCameraLayers = (camera: THREE.Camera) => {
  camera.layers.enable(MIRROR_FACADE_LAYER);
  camera.layers.enable(WATER_LAYER);
  camera.layers.enable(MAIN_ONLY_LAYER);
  camera.layers.disable(REFLECTION_PROXY_LAYER);
  camera.layers.disable(REFLECTION_ONLY_LAYER);
};

// What a mirror camera sees: ordinary geometry plus reflection-only
// simplifications (and, optionally, stand-ins for other mirrors).
export const setReflectionCameraLayers = (
  camera: THREE.Camera,
  includeProxies: boolean,
) => {
  camera.layers.set(0);
  camera.layers.enable(REFLECTION_ONLY_LAYER);
  if (includeProxies) camera.layers.enable(REFLECTION_PROXY_LAYER);
};
