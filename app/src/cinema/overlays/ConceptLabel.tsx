import { INTER } from "../fonts";

// Permanent label for reconstructions of proposed (not built) designs.
export const ConceptLabel: React.FC<{ detail?: string }> = ({ detail }) => (
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
      CONCEPT VISUALISATION
    </div>
    {detail ? (
      <div style={{ fontSize: 18, fontWeight: 500, opacity: 0.85 }}>
        {detail}
      </div>
    ) : null}
  </div>
);
