#!/usr/bin/env python3
"""
Align the approved narration script with the recorded narration audio.

Why this exists
---------------
The narration was recorded as two long audio files (Part 1 = scenes 1-7,
Part 2 = scenes 8-15). Pauses between scenes are often no longer than pauses
between sentences, so silence detection alone cannot find the scene
boundaries. This tool combines both sources of information:

  1. ffmpeg's silencedetect lists every pause in each audio file.
  2. The approved script is split into sentences; each sentence's expected
     duration is proportional to its length in characters.
  3. Dynamic programming picks, in script order, the pause that ends each
     sentence so that real durations best match expected durations
     (with a mild preference for longer pauses).

The result is written to src/neom/narration-timing.ts, which the Remotion
compositions read. Re-run this tool only if the narration is re-recorded.

Requirements: Python 3, numpy is NOT needed, ffmpeg + ffprobe on PATH.

Usage (from the app/ folder):
  python3 tools/align-narration.py
"""

import json
import os
import re
import subprocess
import sys

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT_PATH = os.path.join(APP_DIR, "src", "neom", "narration.txt")
OUT_PATH = os.path.join(APP_DIR, "src", "neom", "narration-timing.ts")
PARTS = {
    1: {"file": "public/audio/the-line-part1.mp3", "scenes": range(1, 8)},
    2: {"file": "public/audio/the-line-part2.mp3", "scenes": range(8, 16)},
}

# Pause detection used for sentence alignment.
PAUSE_NOISE_DB = -40
PAUSE_MIN_SECONDS = 0.15
# Stricter threshold used to find exactly where speech starts and ends.
EDGE_NOISE_DB = -50
EDGE_MIN_SECONDS = 0.02


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, check=True)


def duration_of(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "default=nw=1:nk=1", path]).stdout
    return float(out.strip())


def silences(path, noise_db, min_s):
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af",
               f"silencedetect=noise={noise_db}dB:d={min_s}",
               "-f", "null", "-"]).stderr
    vals = [float(v) for v in re.findall(r"silence_(?:start|end): ([0-9.]+)", err)]
    return [(vals[i], vals[i + 1]) for i in range(0, len(vals) - 1, 2)]


def read_script():
    scenes = {}
    current = None
    with open(SCRIPT_PATH, encoding="utf-8") as f:
        for line in f:
            m = re.match(r"^##(\d+)", line)
            if m:
                current = int(m.group(1))
                scenes[current] = ""
                continue
            scenes[current] += line.strip() + " "
    return scenes


def split_sentences(text):
    parts = re.split(r'(?<=[.!?:"])\s+(?=[A-Z"])', text.strip())
    return [p.strip() for p in parts if p.strip()]


def align_part(sentences, pauses, speech_start, speech_end):
    n, m = len(sentences), len(pauses)
    lengths = [len(s[1]) for s in sentences]
    rate = (speech_end - speech_start) / sum(lengths)
    inf = float("inf")

    def cost(i, start, end, gap):
        expected = lengths[i] * rate
        return ((end - start - expected) / max(expected, 1)) ** 2 * 10 - 2.0 * min(gap, 1.5)

    dp = [[inf] * m for _ in range(n)]
    back = [[-1] * m for _ in range(n)]
    for j in range(m):
        dp[0][j] = cost(0, speech_start, pauses[j][0], pauses[j][1])
    for i in range(1, n - 1):
        for j in range(i, m):
            for k in range(i - 1, j):
                if dp[i - 1][k] == inf:
                    continue
                c = dp[i - 1][k] + cost(i, pauses[k][0], pauses[j][0], pauses[j][1])
                if c < dp[i][j]:
                    dp[i][j], back[i][j] = c, k
    best, last = inf, -1
    for k in range(n - 2, m):
        if dp[n - 2][k] == inf:
            continue
        expected = lengths[-1] * rate
        c = dp[n - 2][k] + ((speech_end - pauses[k][0] - expected) / expected) ** 2 * 10
        if c < best:
            best, last = c, k
    chosen = [last]
    i, j = n - 2, last
    while i > 0:
        j = back[i][j]
        chosen.append(j)
        i -= 1
    chosen.reverse()
    bounds = [speech_start] + [pauses[k][0] for k in chosen] + [speech_end]
    return [
        {"scene": sentences[i][0], "start": round(bounds[i], 3),
         "end": round(bounds[i + 1], 3), "text": sentences[i][1]}
        for i in range(n)
    ]


def main():
    os.chdir(APP_DIR)
    script = read_script()
    if sorted(script) != list(range(1, 16)):
        sys.exit("Expected 15 scenes (##1 .. ##15) in narration.txt")

    result = {}
    for part, cfg in PARTS.items():
        path = cfg["file"]
        dur = duration_of(path)
        edges = silences(path, EDGE_NOISE_DB, EDGE_MIN_SECONDS)
        first_word = edges[0][1] if edges and edges[0][0] < 0.01 else 0.0
        last_word = edges[-1][0] if edges and edges[-1][1] > dur - 0.01 else dur
        pauses = [((a + b) / 2, b - a)
                  for a, b in silences(path, PAUSE_NOISE_DB, PAUSE_MIN_SECONDS)
                  if a > first_word + 0.05 and b < last_word - 0.05]
        sentences = [(sc, s) for sc in cfg["scenes"] for s in split_sentences(script[sc])]
        rows = align_part(sentences, pauses, first_word, last_word)
        for r in rows:
            r["part"] = part
        result[part] = {"duration": dur, "firstWord": round(first_word, 3),
                        "lastWord": round(last_word, 3), "sentences": rows}
        print(f"Part {part}: {dur:.3f}s, speech {first_word:.3f}-{last_word:.3f}s, "
              f"{len(rows)} sentences aligned to {len(pauses)} pauses")

    lines = [
        "// AUTO-GENERATED by tools/align-narration.py - do not edit by hand.",
        "// Times are in seconds, measured from the start of each audio file.",
        "// Sentence boundaries sit in the middle of the pause that ends each sentence.",
        "",
        "export type NarrationSentence = {",
        "  scene: number;",
        "  part: 1 | 2;",
        "  start: number;",
        "  end: number;",
        "  text: string;",
        "};",
        "",
        "export const NARRATION_AUDIO = {",
    ]
    for part in (1, 2):
        r = result[part]
        lines.append(f"  part{part}: {{ file: {json.dumps(PARTS[part]['file'].replace('public/', ''))}, "
                     f"duration: {r['duration']}, firstWord: {r['firstWord']}, lastWord: {r['lastWord']} }},")
    lines += ["} as const;", "", "export const NARRATION_SENTENCES: NarrationSentence[] = ["]
    for part in (1, 2):
        for s in result[part]["sentences"]:
            lines.append(f"  {{ scene: {s['scene']}, part: {part}, start: {s['start']}, "
                         f"end: {s['end']}, text: {json.dumps(s['text'], ensure_ascii=False)} }},")
    lines += ["];", ""]
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Wrote {os.path.relpath(OUT_PATH, APP_DIR)}")


if __name__ == "__main__":
    main()
