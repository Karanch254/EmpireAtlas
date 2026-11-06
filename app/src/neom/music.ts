// Dedicated music track, reserved for licensed music added later.
//
// To add music:
//   1. Put the licensed file in public/audio/music/ (e.g. the-line-score.mp3).
//   2. Set `src` below to "audio/music/the-line-score.mp3".
//   3. Adjust `volume` (0-1). Narration should stay clearly on top.
// Leave MUSIC_TRACK as null to render with narration only.

export type MusicTrack = {
  src: string;
  volume: number;
  // Frame on the video timeline where the music starts.
  from: number;
};

export const MUSIC_TRACK: MusicTrack | null = null;
