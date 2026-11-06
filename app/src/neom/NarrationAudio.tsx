import { Audio, Sequence, staticFile } from "remotion";
import { MUSIC_TRACK } from "./music";
import { NARRATION_AUDIO } from "./narration-timing";
import {
  PART1_DURATION_FRAMES,
  PART1_FROM,
  PART2_DURATION_FRAMES,
  PART2_FROM,
  TOTAL_FRAMES,
} from "./timing";

// Places both narration files on the timeline, plus the reserved music track.
// Shared by the timing preview and the final documentary.
export const NarrationAudio: React.FC = () => {
  return (
    <>
      <Sequence
        name="Narration - Part 1 (scenes 1-7)"
        from={PART1_FROM}
        durationInFrames={PART1_DURATION_FRAMES}
        layout="none"
      >
        <Audio src={staticFile(NARRATION_AUDIO.part1.file)} />
      </Sequence>
      <Sequence
        name="Narration - Part 2 (scenes 8-15)"
        from={PART2_FROM}
        durationInFrames={PART2_DURATION_FRAMES}
        layout="none"
      >
        <Audio src={staticFile(NARRATION_AUDIO.part2.file)} />
      </Sequence>
      {MUSIC_TRACK ? (
        <Sequence
          name="Music"
          from={MUSIC_TRACK.from}
          durationInFrames={TOTAL_FRAMES - MUSIC_TRACK.from}
          layout="none"
        >
          <Audio
            src={staticFile(MUSIC_TRACK.src)}
            volume={MUSIC_TRACK.volume}
          />
        </Sequence>
      ) : null}
    </>
  );
};
