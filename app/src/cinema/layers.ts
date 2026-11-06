import * as THREE from "three";

// Render layers that keep live mirrors from rendering each other
// (which would multiply render time).
//  0 - all ordinary geometry (seen by every camera)
//  1 - live mirror facades (main camera only)
//  2 - live water mirror (main camera only)
//  3 - cheap stand-ins for mirror facades, seen only inside reflections
export const MIRROR_FACADE_LAYER = 1;
export const WATER_LAYER = 2;
export const REFLECTION_PROXY_LAYER = 3;

export const enableMainCameraLayers = (camera: THREE.Camera) => {
  camera.layers.enable(MIRROR_FACADE_LAYER);
  camera.layers.enable(WATER_LAYER);
  camera.layers.disable(REFLECTION_PROXY_LAYER);
};
