// The re-recorded closing sentence for The Knowverse rebrand.
//
// The original Part 2 narration file is never modified. When CLOSING_LINE
// is set, Part 2 plays only up to `spliceAt` (inside the pause after
// "...in the comments."), and the new sentence plays from its own file.
// When it is null, the original Part 2 file plays in full.

export type ClosingLine = {
  file: string; // under public/
  text: string;
  // Seconds into Part 2 where the original audio stops (in the pause).
  spliceAt: number;
  // Seconds into Part 2 where the new file starts playing.
  offset: number;
  // Length of the new file, and the end of its last word, in seconds.
  duration: number;
  lastWord: number;
  // Playback gain, to match the level of the original narration.
  volume: number;
};

// Dan (ElevenLabs), regenerated 2026-11-07 for the rebrand. The new speech
// starts where the original closing sentence did, keeping the ~300 ms pause
// after "...in the comments." (offset is snapped to the 30 fps frame grid:
// frame 8444 of Part 2). The take is 1.3 dB louder than the original
// sentence, so it is played at 0.86 to match.
export const CLOSING_LINE = {
  file: "audio/the-line-closing-knowverse.mp3",
  text: "And if you want more stories about the world's boldest megaprojects, and what really happened to them, subscribe to The Knowverse.",
  spliceAt: 281.4,
  offset: 8444 / 30,
  duration: 7.392625,
  lastWord: 7.17,
  volume: 0.86,
} as ClosingLine | null;

// End of the Part 2 narration (seconds into Part 2) with the closing line.
export const part2EffectiveDuration = (originalDuration: number) =>
  CLOSING_LINE ? CLOSING_LINE.offset + CLOSING_LINE.duration : originalDuration;
