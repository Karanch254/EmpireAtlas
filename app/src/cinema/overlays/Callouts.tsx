import { INTER } from "../fonts";

// Measurement callouts drawn in screen space from projected 3D points.

const textStyle: React.CSSProperties = {
  fontFamily: INTER,
  color: "white",
  textShadow: "0 2px 12px rgba(0,0,0,0.55)",
  whiteSpace: "nowrap",
};

type P = { x: number; y: number };

export const HeightCallout: React.FC<{
  bottom: P;
  top: P;
  label: string;
  sub?: string;
  opacity: number;
}> = ({ bottom, top, label, sub, opacity }) => {
  const x = Math.max(bottom.x, top.x) + 26;
  const tick = 14;
  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      <svg width="100%" height="100%" style={{ position: "absolute" }}>
        <g stroke="white" strokeWidth={2.5} strokeOpacity={0.9}>
          <line x1={x} y1={top.y} x2={x} y2={bottom.y} />
          <line x1={x - tick} y1={top.y} x2={x + tick} y2={top.y} />
          <line x1={x - tick} y1={bottom.y} x2={x + tick} y2={bottom.y} />
        </g>
      </svg>
      <div
        style={{
          ...textStyle,
          position: "absolute",
          left: x + 22,
          top: (top.y + bottom.y) / 2 - 34,
        }}
      >
        <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: 2 }}>
          {label}
        </div>
        {sub ? (
          <div style={{ fontSize: 20, fontWeight: 500, opacity: 0.85 }}>
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const LengthCallout: React.FC<{
  from: P;
  to: P;
  label: string;
  sub?: string;
  opacity: number;
  progress: number;
}> = ({ from, to, label, sub, opacity, progress }) => {
  const end = {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
  const mid = { x: (from.x + end.x) / 2, y: (from.y + end.y) / 2 };
  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      <svg width="100%" height="100%" style={{ position: "absolute" }}>
        <line
          x1={from.x}
          y1={from.y}
          x2={end.x}
          y2={end.y}
          stroke="white"
          strokeWidth={2.5}
          strokeDasharray="10 8"
          strokeOpacity={0.9}
        />
        <circle cx={from.x} cy={from.y} r={6} fill="white" />
      </svg>
      <div
        style={{
          ...textStyle,
          position: "absolute",
          left: mid.x - 40,
          top: mid.y - 96,
        }}
      >
        <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: 2 }}>
          {label}
        </div>
        {sub ? (
          <div style={{ fontSize: 20, fontWeight: 500, opacity: 0.85 }}>
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
};
