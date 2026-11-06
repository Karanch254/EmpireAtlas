/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// WebGL renderer: "angle" uses the GPU (best on desktop/Windows).
// GPU-less machines (e.g. cloud containers) set REMOTION_GL=swangle.
type GlRenderer = Parameters<typeof Config.setChromiumOpenGlRenderer>[0];
Config.setChromiumOpenGlRenderer(
  (process.env.REMOTION_GL as GlRenderer | undefined) ?? "angle",
);

// Optional: use a pre-installed Chrome instead of Remotion's downloaded one.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
