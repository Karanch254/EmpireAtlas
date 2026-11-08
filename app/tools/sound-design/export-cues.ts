// Exports the documentary's timing as a cue sheet for the sound design:
// scene ranges, every narration sentence (global frames), and every named
// event frame (const F_* = sentenceFrame/phraseFrame(...)) in the scenes.
// Usage: npx tsx tools/sound-design/export-cues.ts > out/audio/cues.json
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { audioTimeToFrame, SCENES, TOTAL_FRAMES } from "../../src/neom/timing";
import { NARRATION_SENTENCES } from "../../src/neom/narration-timing";
import { phraseFrame, sentenceFrame } from "../../src/neom/scenes/SceneShell";

const dir = join(__dirname, "../../src/neom/scenes");
const events: Record<string, Record<string, number>> = {};
for (const file of readdirSync(dir).filter((f) => /^Scene\d\d/.test(f))) {
  const id = Number(file.slice(5, 7));
  const src = readFileSync(join(dir, file), "utf8");
  const scene = SCENES.find((s) => s.id === id)!;
  const out: Record<string, number> = {};
  const re = /const (F_[A-Z0-9_]+) = (sentenceFrame|phraseFrame)\((?:ID, )?\s*(["'])(.*?)\3/g;
  for (const m of src.matchAll(re)) {
    try {
      const local = id === 1
        ? Math.round(audioTimeToFrame(1, NARRATION_SENTENCES.find((s) => s.text.startsWith(m[4]))!.start))
        : m[2] === "sentenceFrame" ? sentenceFrame(id, m[4]) : phraseFrame(id, m[4]);
      out[m[1]] = scene.from + local; // global frame
    } catch {
      /* skip unparsable */
    }
  }
  events[`scene${id}`] = out;
}
const sentences = NARRATION_SENTENCES.map((s) => ({
  scene: s.scene,
  start: audioTimeToFrame(s.part, s.start),
  end: audioTimeToFrame(s.part, s.end),
}));
console.log(JSON.stringify({ fps: 30, total: TOTAL_FRAMES, scenes: SCENES.map((s) => ({ id: s.id, title: s.title, from: s.from, to: s.from + s.durationInFrames })), sentences, events }, null, 1));
