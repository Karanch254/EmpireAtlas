import { Audio, Sequence, staticFile } from "remotion";
import { MUSIC_TRACK } from "./music";
import { CLOSING_LINE } from "./closing-line";
import { NARRATION_AUDIO } from "./narration-timing";
import {
  PART1_DURATION_FRAMES,
  PART1_FROM,
  FPS,
  PART2_ORIGINAL_FRAMES,
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
        durationInFrames={PART2_ORIGINAL_FRAMES}
        layout="none"
      >
        <Audio src={staticFile(NARRATION_AUDIO.part2.file)} />
      </Sequence>
      {CLOSING_LINE ? (
        <Sequence
          name="Narration - closing line (The Knowverse)"
          from={PART2_FROM + Math.round(CLOSING_LINE.offset * FPS)}
          durationInFrames={Math.ceil(CLOSING_LINE.duration * FPS)}
          layout="none"
        >
          <Audio
            src={staticFile(CLOSING_LINE.file)}
            volume={CLOSING_LINE.volume}
          />
        </Sequence>
      ) : null}
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
