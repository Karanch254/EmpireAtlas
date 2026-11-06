import { AbsoluteFill } from "remotion";
import { NarrationAudio } from "../NarrationAudio";
import { Scene01Opening } from "./Scene01Opening";

// Stand-alone review composition for Scene 1, with the real narration.
// Scene 1 starts at documentary frame 0, so the audio lines up unchanged.
export const Scene01Composition: React.FC = () => (
  <AbsoluteFill>
    <NarrationAudio />
    <Scene01Opening />
  </AbsoluteFill>
);
