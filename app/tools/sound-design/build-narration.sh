#!/bin/bash
# The Knowverse - "The Line": the approved narration timeline as one WAV.
#
# Exact command used for the approved final. Places, on the 30 fps film
# timeline (48 kHz stereo, 15338 frames = 511.2667 s):
#   Part 1 at 0.5 s (frame 15);
#   Part 2 at 212.4 s (frame 6372), cut at 281.4 s inside the pause after
#     "...in the comments.";
#   the re-recorded Knowverse closing line at frame 14816 (= 6372 + 8444),
#     at 0.86 gain (see src/neom/closing-line.ts).
# Original recordings are read, never modified.
#
# Run from app/:  bash tools/sound-design/build-narration.sh [output.wav]
set -euo pipefail
OUT=${1:-out/final/narration-final.wav}

ffmpeg -v error -y \
  -i public/audio/the-line-part1.mp3 \
  -i public/audio/the-line-part2.mp3 \
  -i public/audio/the-line-closing-knowverse.mp3 \
  -filter_complex "[0:a]aresample=48000,aformat=channel_layouts=stereo,adelay=500:all=1[a];[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=end=281.4,adelay=212400:all=1[b];[2:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.86,adelay=493866.667:all=1[c];[a][b][c]amix=inputs=3:normalize=0:duration=longest,apad=whole_dur=511.26666666666665,atrim=end=511.26666666666665[m]" \
  -map "[m]" -c:a pcm_s16le "$OUT"
