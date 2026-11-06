import { interpolate, useCurrentFrame } from "remotion";
import { INTER } from "../fonts";

// On-screen text cards with clearly different styles for different kinds of
// claim, so viewers can always tell what is established, what is an official
// account, and what is disputed or unverified.

export type CardKind =
  | "reported" // reported and acknowledged facts (white)
  | "official" // an official account (cool grey)
  | "disputed" // disputed / unverified claims (amber)
  | "info" // neutral context (white, no frame)
  | "quote"; // a direct quotation

const STYLE: Record<
  CardKind,
  { tag: string; colour: string; border: string; bg: string }
> = {
  reported: {
    tag: "REPORTED & ACKNOWLEDGED",
    colour: "#ffffff",
    border: "rgba(255,255,255,0.85)",
    bg: "rgba(8,10,14,0.62)",
  },
  official: {
    tag: "OFFICIAL SAUDI ACCOUNT",
    colour: "#c9d3e0",
    border: "rgba(160,176,198,0.85)",
    bg: "rgba(14,18,26,0.66)",
  },
  disputed: {
    tag: "DISPUTED / UNVERIFIED",
    colour: "#ffc56b",
    border: "rgba(255,180,70,0.9)",
    bg: "rgba(26,16,4,0.62)",
  },
  info: {
    tag: "",
    colour: "#ffffff",
    border: "rgba(255,255,255,0)",
    bg: "rgba(0,0,0,0)",
  },
  quote: {
    tag: "",
    colour: "#ffffff",
    border: "rgba(255,255,255,0)",
    bg: "rgba(0,0,0,0.35)",
  },
};

export const Card: React.FC<{
  kind: CardKind;
  text: string;
  sub?: string;
  tag?: string;
  inFrame: number;
  outFrame: number;
  x: number;
  y: number;
  width?: number;
  size?: number;
  align?: "left" | "center";
}> = ({
  kind,
  text,
  sub,
  tag,
  inFrame,
  outFrame,
  x,
  y,
  width = 760,
  size = 38,
  align = "left",
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(
    frame,
    [inFrame, inFrame + 10, outFrame - 10, outFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  if (o <= 0) return null;
  const st = STYLE[kind];
  const lift = interpolate(frame, [inFrame, inFrame + 14], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const label = tag ?? st.tag;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + lift,
        width,
        opacity: o,
        fontFamily: INTER,
        color: st.colour,
        textAlign: align,
        background: st.bg,
        borderLeft:
          kind === "info" || kind === "quote"
            ? undefined
            : `4px solid ${st.border}`,
        padding: kind === "info" ? 0 : "18px 24px",
        borderRadius: 6,
        textShadow: "0 2px 14px rgba(0,0,0,0.55)",
        boxSizing: "border-box",
      }}
    >
      {label ? (
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: 3,
            marginBottom: 10,
            opacity: 0.9,
          }}
        >
          {label}
        </div>
      ) : null}
      <div
        style={{
          fontSize: size,
          fontWeight: kind === "quote" ? 500 : 650,
          fontStyle: kind === "quote" ? "italic" : "normal",
          lineHeight: 1.22,
        }}
      >
        {kind === "quote" ? `“${text}”` : text}
      </div>
      {sub ? (
        <div
          style={{ fontSize: 20, fontWeight: 500, marginTop: 10, opacity: 0.8 }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

// A small persistent corner tag ("ILLUSTRATIVE", "APPROXIMATE LOCATION"...).
export const CornerTag: React.FC<{
  text: string;
  detail?: string;
  opacity?: number;
}> = ({ text, detail, opacity = 1 }) => (
  <div
    style={{
      position: "absolute",
      top: 44,
      left: 52,
      display: "flex",
      alignItems: "center",
      gap: 14,
      fontFamily: INTER,
      color: "rgba(255,255,255,0.92)",
      textShadow: "0 1px 8px rgba(0,0,0,0.45)",
      opacity,
    }}
  >
    <div
      style={{
        fontSize: 19,
        fontWeight: 700,
        letterSpacing: 3.5,
        padding: "8px 14px",
        border: "1.5px solid rgba(255,255,255,0.75)",
        borderRadius: 4,
        background: "rgba(0,0,0,0.18)",
      }}
    >
      {text}
    </div>
    {detail ? (
      <div style={{ fontSize: 18, fontWeight: 500, opacity: 0.85 }}>
        {detail}
      </div>
    ) : null}
  </div>
);

// A map/scene label anchored to a projected 3D point.
export const PinLabel: React.FC<{
  x: number;
  y: number;
  title: string;
  sub?: string;
  opacity: number;
  colour?: string;
  side?: "left" | "right";
}> = ({ x, y, title, sub, opacity, colour = "#ffffff", side = "right" }) => {
  if (opacity <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity }}>
      <div
        style={{
          position: "absolute",
          left: x - 7,
          top: y - 7,
          width: 14,
          height: 14,
          borderRadius: 7,
          background: colour,
          boxShadow: `0 0 18px ${colour}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: side === "right" ? x + 18 : x - 18,
          transform: side === "left" ? "translateX(-100%)" : undefined,
          top: y - 20,
          fontFamily: INTER,
          color: "white",
          whiteSpace: "nowrap",
          textShadow: "0 2px 10px rgba(0,0,0,0.7)",
          textAlign: side === "left" ? "right" : "left",
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 750, letterSpacing: 1 }}>
          {title}
        </div>
        {sub ? (
          <div style={{ fontSize: 18, fontWeight: 500, opacity: 0.85 }}>
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
};
