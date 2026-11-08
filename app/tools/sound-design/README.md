# Sound design — The Knowverse, "The Line"

An original score and sound-effects layer, synthesised entirely in code
(numpy + ffmpeg; no samples, stock music or third-party audio), mixed under
the approved narration and muxed with the untouched 1080p video.

Run from `app/`, in this order:

| Step | Command | Output |
|---|---|---|
| 0. Narration timeline | `bash tools/sound-design/build-narration.sh` | `out/final/narration-final.wav`: the approved narration on the film timeline (Part 1, Part 2 cut at 281.4 s, Knowverse closing line). |
| 1. Cue sheet | `npx tsx tools/sound-design/export-cues.ts > out/audio/cues.json` | Scene ranges, all 104 narration sentences and every `F_*` event frame from the scene files (global frames). |
| 2. Score + effects | `python3 -I tools/sound-design/score.py out/audio/cues.json out/final/narration-final.wav out/audio` | `music.wav`, `sfx.wav` (deterministic: fixed seeds). |
| 3. Mix | `python3 -I tools/sound-design/mix.py out/audio/cues.json out/final/narration-final.wav out/audio` | `mix.wav`: narration at unity, music 10 dB under speech level in pauses and ducked a further 8 dB under narration (120 ms / 700 ms), effects 13 dB under. |
| 4. Master + mux | `bash tools/sound-design/master.sh` | `out/final/the-knowverse-the-line-1080p-final.mp4`: −16 LUFS, true peak under −1 dBTP, video stream copied. |

The original recordings in `public/audio/` are read, never modified. Paths in
`master.sh` can be overridden with the `MIX`, `MASTER_DIR`, `VIDEO` and
`FINAL` environment variables.

Approved final (8 Nov 2026): −16.1 LUFS integrated, −1.3 dBTP true peak,
LRA 3.2 LU, no clipping, narration sync 0.00 ms in all 15 scenes, video
stream MD5 `ccd3052fe201eaa28d2eafc81adfe60c` (identical to the 1080p master).

Rendered audio and video live in `out/`, which is not tracked by git.
