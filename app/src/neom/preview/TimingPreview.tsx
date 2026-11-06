import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { INTER, loadInter } from "../../cinema/fonts";
import { NarrationAudio } from "../NarrationAudio";
import { NARRATION_AUDIO } from "../narration-timing";
import {
  audioTimeToFrame,
  formatTimecode,
  NARRATION_END_FRAME,
  PART1_DURATION_FRAMES,
  PART1_FROM,
  PART2_DURATION_FRAMES,
  PART2_FROM,
  SceneTiming,
  SCENES,
  sentenceAtFrame,
  TOTAL_FRAMES,
} from "../timing";

// Stage 1: a plain "animatic" used to check that every scene boundary lands
// on the right words. It uses the real narration audio and the real timeline
// that the finished documentary will use.

loadInter();

const BG = "#0b0e14";
const PANEL = "rgba(255,255,255,0.06)";
const TEXT = "#f2f4f8";
const MUTED = "#8a93a6";
const PART_COLOURS = { 1: "#d9a441", 2: "#5aa2e6" } as const;

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const SceneCard: React.FC<{ scene: SceneTiming }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const progress = frame / scene.durationInFrames;
  // A bright flash on the first frames of each scene makes cuts obvious.
  const flash = interpolate(frame, [0, 12], [1, 0], {
    extrapolateRight: "clamp",
  });
  const colour = PART_COLOURS[scene.part];
  const last = scene.from + scene.durationInFrames - 1;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        paddingBottom: 220,
      }}
    >
      <AbsoluteFill
        style={{ border: `12px solid ${colour}`, opacity: flash }}
      />
      <div style={{ width: 1500, textAlign: "center" }}>
        <div
          style={{
            fontSize: 34,
            letterSpacing: 8,
            color: colour,
            fontWeight: 600,
          }}
        >
          SCENE {pad2(scene.id)} OF 15 · NARRATION PART {scene.part}
        </div>
        <div
          style={{
            fontSize: 112,
            fontWeight: 800,
            color: TEXT,
            marginTop: 12,
            lineHeight: 1.05,
          }}
        >
          {scene.title}
        </div>
        <div
          style={{
            fontSize: 40,
            color: MUTED,
            marginTop: 28,
            fontStyle: "italic",
          }}
        >
          “{scene.openingWords}”
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            marginTop: 40,
            fontSize: 28,
            color: TEXT,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Info
            label="Video"
            value={`${formatTimecode(scene.from)} – ${formatTimecode(last + 1)}`}
          />
          <Info label="Frames" value={`${scene.from} – ${last}`} />
          <Info
            label={`Part ${scene.part} audio`}
            value={`${scene.audioStart.toFixed(2)}s – ${scene.audioEnd.toFixed(2)}s`}
          />
          <Info
            label="Length"
            value={`${(scene.durationInFrames / 30).toFixed(2)}s`}
          />
        </div>
        <div
          style={{
            marginTop: 40,
            height: 10,
            background: PANEL,
            borderRadius: 5,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: colour,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div
    style={{
      background: PANEL,
      borderRadius: 12,
      padding: "14px 22px",
      minWidth: 220,
    }}
  >
    <div style={{ fontSize: 20, color: MUTED, letterSpacing: 2 }}>
      {label.toUpperCase()}
    </div>
    <div style={{ marginTop: 6 }}>{value}</div>
  </div>
);

const Header: React.FC = () => {
  const frame = useCurrentFrame();
  let status = "";
  if (frame < PART1_FROM) {
    status = "Pre-roll (0.5 s before narration)";
  } else if (
    frame >= PART1_FROM + PART1_DURATION_FRAMES &&
    frame < PART2_FROM
  ) {
    status = "Gap between narration Part 1 and Part 2";
  } else if (frame >= NARRATION_END_FRAME) {
    status = "End card (narration finished)";
  }
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: 60,
        right: 60,
        display: "flex",
        justifyContent: "space-between",
        fontSize: 26,
        color: MUTED,
        letterSpacing: 3,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <div>EMPIREATLAS · THE LINE · TIMING PREVIEW</div>
      <div style={{ color: "#ff8a5c" }}>{status}</div>
      <div style={{ color: TEXT }}>
        {formatTimecode(frame)} · frame {frame} / {TOTAL_FRAMES - 1}
      </div>
    </div>
  );
};

const Caption: React.FC = () => {
  const frame = useCurrentFrame();
  const sentence = sentenceAtFrame(frame);
  if (!sentence) {
    return null;
  }
  return (
    <div
      style={{
        position: "absolute",
        left: 160,
        right: 160,
        bottom: 190,
        textAlign: "center",
        fontSize: 40,
        lineHeight: 1.3,
        color: TEXT,
        background: "rgba(0,0,0,0.55)",
        borderRadius: 14,
        padding: "18px 28px",
      }}
    >
      <span style={{ color: PART_COLOURS[sentence.part], fontWeight: 700 }}>
        [S{sentence.scene}]
      </span>{" "}
      {sentence.text}
    </div>
  );
};

const TimelineStrip: React.FC = () => {
  const frame = useCurrentFrame();
  const left = 60;
  const width = 1800;
  const x = (f: number) => left + (f / TOTAL_FRAMES) * width;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {SCENES.map((s) => {
        const active = frame >= s.from && frame < s.from + s.durationInFrames;
        return (
          <div
            key={s.id}
            style={{
              position: "absolute",
              left: x(s.from),
              width: x(s.from + s.durationInFrames) - x(s.from) - 2,
              top: 950,
              height: 44,
              background: active ? PART_COLOURS[s.part] : PANEL,
              color: active ? BG : MUTED,
              fontSize: 20,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
            }}
          >
            {s.id}
          </div>
        );
      })}
      {[
        { part: 1 as const, from: PART1_FROM, len: PART1_DURATION_FRAMES },
        { part: 2 as const, from: PART2_FROM, len: PART2_DURATION_FRAMES },
      ].map((p) => (
        <div
          key={p.part}
          style={{
            position: "absolute",
            left: x(p.from),
            width: x(p.from + p.len) - x(p.from),
            top: 1004,
            height: 12,
            background: PART_COLOURS[p.part],
            opacity: 0.6,
            borderRadius: 3,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: x(frame) - 2,
          width: 4,
          top: 940,
          height: 84,
          background: "#ffffff",
        }}
      />
      <div
        style={{
          position: "absolute",
          left,
          top: 1026,
          fontSize: 18,
          color: MUTED,
        }}
      >
        Scenes (top) · narration audio Part 1 / Part 2 (bottom) · speech Part 1
        ends{" "}
        {formatTimecode(audioTimeToFrame(1, NARRATION_AUDIO.part1.lastWord))},
        Part 2 starts{" "}
        {formatTimecode(audioTimeToFrame(2, NARRATION_AUDIO.part2.firstWord))}
      </div>
    </div>
  );
};

export const TimingPreview: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: INTER }}>
      <NarrationAudio />
      {SCENES.map((scene) => (
        <Sequence
          key={scene.id}
          name={`Scene ${scene.id} - ${scene.title}`}
          from={scene.from}
          durationInFrames={scene.durationInFrames}
        >
          <SceneCard scene={scene} />
        </Sequence>
      ))}
      <Header />
      <Caption />
      <TimelineStrip />
    </AbsoluteFill>
  );
};
