import { CLOSING_LINE, part2EffectiveDuration } from "./closing-line";
import { NARRATION_AUDIO, NARRATION_SENTENCES } from "./narration-timing";

// Master timeline for "The Line: The 170km City That Shrank to 2.4km".
// Everything is derived from the measured narration timings, so if the
// narration is re-recorded, re-run tools/align-narration.py and the whole
// timeline updates itself.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// 0.5 s of atmosphere before the first word.
export const PRE_ROLL_FRAMES = 15;
// Gap between the end of the Part 1 file and the start of the Part 2 file.
export const PART_GAP_SECONDS = 1;
// YouTube end-screen time after the last narration file finishes.
export const END_CARD_FRAMES = 10 * FPS;

const toFrames = (seconds: number) => seconds * FPS;

export const PART1_FROM = PRE_ROLL_FRAMES;
const PART1_END_EXACT = PART1_FROM + toFrames(NARRATION_AUDIO.part1.duration);

// Sequences must start on a whole frame, so we use the frame closest to
// exactly PART_GAP_SECONDS after Part 1 ends (6372 -> a 0.987 s gap).
export const PART2_FROM = Math.round(
  PART1_END_EXACT + toFrames(PART_GAP_SECONDS),
);
const PART2_LENGTH = part2EffectiveDuration(NARRATION_AUDIO.part2.duration);
const PART2_END_EXACT = PART2_FROM + toFrames(PART2_LENGTH);

export const PART1_DURATION_FRAMES = Math.ceil(
  toFrames(NARRATION_AUDIO.part1.duration),
);
export const PART2_DURATION_FRAMES = Math.ceil(toFrames(PART2_LENGTH));
// How much of the original Part 2 file plays: all of it, or up to the
// splice point when the re-recorded closing line is in use.
export const PART2_ORIGINAL_FRAMES = CLOSING_LINE
  ? Math.round(toFrames(CLOSING_LINE.spliceAt))
  : PART2_DURATION_FRAMES;
export const NARRATION_END_FRAME = Math.ceil(PART2_END_EXACT);
export const TOTAL_FRAMES = NARRATION_END_FRAME + END_CARD_FRAMES;

export const partOffsetFrames = (part: 1 | 2) =>
  part === 1 ? PART1_FROM : PART2_FROM;

// Converts a time inside an audio file to a frame on the video timeline.
export const audioTimeToFrame = (part: 1 | 2, seconds: number) =>
  partOffsetFrames(part) + toFrames(seconds);

export const SCENE_TITLES: Record<number, string> = {
  1: "The impossible city",
  2: "The mystery",
  3: "Oil",
  4: "NEOM is born",
  5: "The design",
  6: "Inside the city",
  7: "Physics and birds",
  8: "The people on the land",
  9: "The money",
  10: "The review",
  11: "What actually exists",
  12: "The pivot",
  13: "The revelation",
  14: "The bigger picture",
  15: "Outro and end card",
};

export type SceneTiming = {
  id: number;
  title: string;
  part: 1 | 2;
  // Narration span of this scene, in seconds within its audio file.
  audioStart: number;
  audioEnd: number;
  // Position on the video timeline.
  from: number;
  durationInFrames: number;
  openingWords: string;
};

const sceneIds = Object.keys(SCENE_TITLES).map(Number);

const sceneStartFrame = (id: number): number => {
  if (id === 1) {
    return 0;
  }
  const first = NARRATION_SENTENCES.find((s) => s.scene === id);
  if (!first) {
    throw new Error(`No narration found for scene ${id}`);
  }
  if (id === 8) {
    // Scene 8 opens Part 2. Cut in the middle of the quiet between the
    // last word of Part 1 and the first word of Part 2.
    const lastWordPart1 = audioTimeToFrame(1, NARRATION_AUDIO.part1.lastWord);
    const firstWordPart2 = audioTimeToFrame(2, NARRATION_AUDIO.part2.firstWord);
    return Math.round((lastWordPart1 + firstWordPart2) / 2);
  }
  return Math.round(audioTimeToFrame(first.part, first.start));
};

export const SCENES: SceneTiming[] = sceneIds.map((id, index) => {
  const sentences = NARRATION_SENTENCES.filter((s) => s.scene === id);
  const from = sceneStartFrame(id);
  const nextId = sceneIds[index + 1];
  const to = nextId === undefined ? TOTAL_FRAMES : sceneStartFrame(nextId);
  const allWords = sentences[0].text.split(" ");
  const words =
    allWords.length > 8
      ? `${allWords.slice(0, 8).join(" ")}…`
      : sentences[0].text;
  return {
    id,
    title: SCENE_TITLES[id],
    part: sentences[0].part,
    audioStart: sentences[0].start,
    audioEnd: sentences[sentences.length - 1].end,
    from,
    durationInFrames: to - from,
    openingWords: words,
  };
});

// Returns the narration sentence being spoken at a given video frame, if any.
export const sentenceAtFrame = (frame: number) => {
  return NARRATION_SENTENCES.find((s) => {
    const start = audioTimeToFrame(s.part, s.start);
    const end = audioTimeToFrame(s.part, s.end);
    return frame >= start && frame < end;
  });
};

export const formatTimecode = (frame: number) => {
  const totalSeconds = frame / FPS;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  const whole = Math.floor(seconds);
  const hundredths = Math.floor((seconds - whole) * 100);
  const two = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${minutes}:${two(whole)}.${two(hundredths)}`;
};
