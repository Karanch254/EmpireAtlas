import { INTER } from "../fonts";

// The Knowverse brand: deep navy and black, electric blue and cyan light,
// clean modern type and a globe / exploration motif. No gold.

export const KNOWVERSE = {
  name: "The Knowverse",
  navy: "#06122a",
  black: "#020409",
  electric: "#1e7bff",
  cyan: "#38e1ff",
  ice: "#d8f6ff",
};

// A wireframe globe that turns with the frame number, circled by an orbit
// with a travelling point of light.
export const KnowverseGlobe: React.FC<{ frame: number; size: number }> = ({
  frame,
  size,
}) => {
  const r = size * 0.36;
  const c = size / 2;
  const spin = frame * 0.012;
  const meridians = Array.from({ length: 9 }, (_, i) => {
    const lon = spin + (i * Math.PI) / 9;
    const rx = Math.abs(Math.cos(lon)) * r;
    const front = Math.sin(lon) > 0;
    return { rx, front, key: i };
  });
  const lats = [-60, -30, 0, 30, 60].map((d) => {
    const a = (d * Math.PI) / 180;
    return { y: c - Math.sin(a) * r, rx: Math.cos(a) * r, key: d };
  });
  const orbit = frame * 0.035;
  const dotX = c + Math.cos(orbit) * r * 1.42;
  const dotY = c + Math.sin(orbit) * r * 0.42;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id="kv-core" cx="40%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#0f3a7a" stopOpacity="0.95" />
          <stop offset="70%" stopColor={KNOWVERSE.navy} stopOpacity="0.95" />
          <stop offset="100%" stopColor={KNOWVERSE.black} stopOpacity="1" />
        </radialGradient>
        <filter id="kv-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={size * 0.012} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle
        cx={c}
        cy={c}
        r={r * 1.18}
        fill="none"
        stroke={KNOWVERSE.electric}
        strokeOpacity={0.18}
        strokeWidth={size * 0.05}
      />
      <circle cx={c} cy={c} r={r} fill="url(#kv-core)" />
      <g filter="url(#kv-glow)" fill="none" stroke={KNOWVERSE.cyan}>
        {meridians.map((m) => (
          <ellipse
            key={m.key}
            cx={c}
            cy={c}
            rx={m.rx}
            ry={r}
            strokeWidth={size * 0.004}
            strokeOpacity={m.front ? 0.85 : 0.25}
          />
        ))}
        {lats.map((l) => (
          <ellipse
            key={l.key}
            cx={c}
            cy={l.y}
            rx={l.rx}
            ry={l.rx * 0.12}
            strokeWidth={size * 0.004}
            strokeOpacity={0.55}
          />
        ))}
        <circle
          cx={c}
          cy={c}
          r={r}
          strokeWidth={size * 0.007}
          strokeOpacity={0.95}
        />
        <ellipse
          cx={c}
          cy={c}
          rx={r * 1.42}
          ry={r * 0.42}
          stroke={KNOWVERSE.electric}
          strokeWidth={size * 0.005}
          strokeOpacity={0.8}
        />
      </g>
      <circle
        cx={dotX}
        cy={dotY}
        r={size * 0.016}
        fill={KNOWVERSE.ice}
        filter="url(#kv-glow)"
      />
    </svg>
  );
};

// "THE KNOWVERSE" wordmark.
export const KnowverseWordmark: React.FC<{ scale?: number }> = ({
  scale = 1,
}) => (
  <div style={{ fontFamily: INTER, textAlign: "center", lineHeight: 1 }}>
    <div
      style={{
        fontSize: 30 * scale,
        fontWeight: 600,
        letterSpacing: 14 * scale,
        color: KNOWVERSE.cyan,
        marginBottom: 10 * scale,
        paddingLeft: 14 * scale,
      }}
    >
      THE
    </div>
    <div
      style={{
        fontSize: 118 * scale,
        fontWeight: 800,
        letterSpacing: 8 * scale,
        paddingLeft: 8 * scale,
        backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${KNOWVERSE.ice} 45%, ${KNOWVERSE.cyan} 100%)`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        filter: `drop-shadow(0 0 ${18 * scale}px rgba(56,225,255,0.35))`,
      }}
    >
      KNOWVERSE
    </div>
  </div>
);
