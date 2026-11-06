import { AbsoluteFill, Sequence } from "remotion";
import { NarrationAudio } from "../NarrationAudio";
import { NARRATION_SENTENCES } from "../narration-timing";
import { audioTimeToFrame, SCENES } from "../timing";

// Shared helpers for scene compositions. Every scene is its own Remotion
// composition that starts at local frame 0 but plays exactly its stretch of
// the approved narration (the full narration timeline, shifted back by the
// scene's start frame).

export const sceneById = (id: number) => {
  const s = SCENES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s;
};

// Local frame (within a scene) where a narration sentence starts.
export const sentenceFrame = (sceneId: number, startsWith: string) => {
  const s = NARRATION_SENTENCES.find((x) => x.text.startsWith(startsWith));
  if (!s) throw new Error(`Sentence not found: ${startsWith}`);
  return (
    Math.round(audioTimeToFrame(s.part, s.start)) - sceneById(sceneId).from
  );
};

// Local frame where a given phrase inside a sentence is spoken, estimated by
// its character position within the sentence's measured duration.
export const phraseFrame = (sceneId: number, phrase: string) => {
  const s = NARRATION_SENTENCES.find((x) => x.text.includes(phrase));
  if (!s) throw new Error(`Phrase not found: ${phrase}`);
  const k = s.text.indexOf(phrase) / s.text.length;
  const t = s.start + (s.end - s.start) * k;
  return Math.round(audioTimeToFrame(s.part, t)) - sceneById(sceneId).from;
};

export const SceneWithNarration: React.FC<{
  sceneId: number;
  children: React.ReactNode;
}> = ({ sceneId, children }) => {
  const scene = sceneById(sceneId);
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Sequence from={-scene.from} layout="none" name="Narration">
        <NarrationAudio />
      </Sequence>
      {children}
    </AbsoluteFill>
  );
};
