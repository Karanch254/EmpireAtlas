import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

// Final-look layer: gentle warm/teal split, vignette, deterministic film
// grain and an optional fade from black.
export const FilmGrade: React.FC<{ fadeInFrames?: number; grain?: number }> = ({
  fadeInFrames = 0,
  grain = 0.06,
}) => {
  const frame = useCurrentFrame();
  const fade =
    fadeInFrames > 0
      ? interpolate(frame, [0, fadeInFrames], [1, 0], {
          extrapolateRight: "clamp",
        })
      : 0;
  return (
    <>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(255,170,90,0.05) 0%, rgba(0,0,0,0) 45%, rgba(20,60,80,0.10) 100%)",
          mixBlendMode: "soft-light",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.04) 50%, rgba(0,0,0,0.12) 65%, rgba(0,0,0,0.24) 80%, rgba(0,0,0,0.38) 100%)",
        }}
      />
      <AbsoluteFill style={{ opacity: grain, mixBlendMode: "overlay" }}>
        <svg width="100%" height="100%">
          <filter id={`grain-${frame}`}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="2"
              seed={frame % 97}
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#grain-${frame})`} />
        </svg>
      </AbsoluteFill>
      {fade > 0 ? (
        <AbsoluteFill style={{ backgroundColor: "black", opacity: fade }} />
      ) : null}
    </>
  );
};
