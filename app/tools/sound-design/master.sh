#!/bin/bash
# The Knowverse - "The Line": mastering and final mux.
#
# These are the exact commands used for the approved final (8 Nov 2026):
#   1. +5.0 dB uniform gain (-21.0 -> -16.0 LUFS integrated);
#   2. a 4x-oversampled (192 kHz) peak limiter at -1.5 dBFS (1 ms attack,
#      40 ms release, no auto-level), which keeps true peaks under -1 dBTP;
#   3. compensation of the limiter's 48-sample (1.0 ms) delay, padded back
#      to the exact film length (15338 frames x 1600 = 24,540,800 samples);
#   4. a 1.5 s fade at the very end, matching the picture's fade to black
#      (the narration has already finished there);
#   5. AAC 320 kbps, muxed with the 1080p master's video stream COPIED
#      (not re-encoded).
#
# Run from app/ after export-cues.ts, score.py and mix.py:
#   bash tools/sound-design/master.sh
set -euo pipefail

MIX=${MIX:-out/audio/mix.wav}
MASTER_DIR=${MASTER_DIR:-out/master-audio}
VIDEO=${VIDEO:-out/final/the-knowverse-the-line-1080p.mp4}
FINAL=${FINAL:-out/final/the-knowverse-the-line-1080p-final.mp4}
SAMPLES=24540800                   # 15338 frames * 48000 / 30
END_FADE_START=509.7666666666667   # 15338 / 30 - 1.5

mkdir -p "$MASTER_DIR"

ffmpeg -v error -y -i "$MIX" -af "volume=5.0dB,aresample=192000,alimiter=limit=0.8414:attack=1:release=40:level=disabled,aresample=48000,atrim=start_sample=48,asetpts=N/SR/TB,apad=whole_len=${SAMPLES}" \
  -c:a pcm_f32le "$MASTER_DIR/master-mix.wav"

ffmpeg -v error -y -i "$MASTER_DIR/master-mix.wav" \
  -af "afade=t=out:st=${END_FADE_START}:d=1.5:curve=qsin" \
  -c:a pcm_f32le "$MASTER_DIR/master-mix-faded.wav"
mv "$MASTER_DIR/master-mix-faded.wav" "$MASTER_DIR/master-mix.wav"

ffmpeg -v error -y -i "$VIDEO" -i "$MASTER_DIR/master-mix.wav" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -ar 48000 \
  -movflags +faststart "$FINAL"

# Checks: loudness / true peak, and that the video stream is unchanged.
ffmpeg -nostats -i "$FINAL" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|Peak:)"
echo "video stream MD5 (master, final) - must match:"
ffmpeg -v error -i "$VIDEO" -map 0:v -c copy -f md5 -
ffmpeg -v error -i "$FINAL" -map 0:v -c copy -f md5 -
