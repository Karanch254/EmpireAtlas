// Irregular structural modules along The Line. Module k spans
// [moduleEdge(k), moduleEdge(k + 1)). The same formula exists in JS (to place
// 3D fins) and GLSL (to draw joints and vary panels), so they always agree.
// Offsets stay below half the nominal spacing, so edges never cross.

export const MODULE_SPACING = 640;

export const moduleEdge = (k: number) =>
  k * MODULE_SPACING +
  150 * Math.sin(k * 1.7 + 0.3) +
  60 * Math.sin(k * 4.3 + 1.1);

export const MODULE_GLSL = /* glsl */ `
float moduleEdge(float k) {
  return k * ${MODULE_SPACING.toFixed(1)} + 150.0 * sin(k * 1.7 + 0.3) + 60.0 * sin(k * 4.3 + 1.1);
}
`;

// All module edges strictly inside (0, length).
export const moduleEdgesWithin = (length: number) => {
  const out: number[] = [];
  for (let k = 1; moduleEdge(k) < length; k++) {
    out.push(moduleEdge(k));
  }
  return out;
};
