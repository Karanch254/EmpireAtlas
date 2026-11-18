# Final Quality Control: script v1

| # | Check | Result |
|---|---|---|
| 1 | Runtime 8–10 min | ✅ 1,347 narration words → ~9:00 at 150 wpm, ~9:17 at 145 wpm, ~9:35 with end card |
| 2 | All nine in order (#9 Nan Madol → #1 Baalbek) | ✅ |
| 3 | Claims and measurements verified | ✅ See `01-research-and-sources.md`. Four ⚠ items say exactly what to double-check. |
| 4 | Theories labelled as theories | ✅ "possibly", "proposed", "archaeologists believe", "one leading explanation", "many researchers believe", "strongly supported… not proven" |
| 5 | No unsupported claims | ✅ The 20,000 Derinkuyu figure is explicitly qualified. No lasers, no "defies modern cranes". Moai walking is not presented as certain. |
| 6 | Visual prompts match narration | ✅ with flags F-1 to F-7 in `03-shot-list.md`. **F-1 (Baalbek "stone tools") and F-5 (Sacsayhuamán "fits perfectly")** are the two worth fixing. |
| 7 | Hook compelling | ✅ The mandated line opens, followed by three concrete images and a payoff promise. See the hook note below. |
| 8 | Transitions maintain curiosity | ✅ Every section ends by pointing at the next. Open loops land at 0:40 (#1 tease), 2:19 ("strangest part still coming"), 4:29 (farming rule), 5:19 (wild theories) and 8:42 (quarry reveal). That's roughly one every 60–120 s. |
| 9 | Retention / packaging skills used | Partly. See the skill report below. |
| 10 | Source list | ✅ `01-research-and-sources.md` |

## Accuracy note on the mandated opening line

> "How did people with no cranes, no wheels, and no steel move stones heavier than a blue whale?"

- **"no wheels"**: true for Rapa Nui, the Inca and Neolithic Britain, but Romans at Baalbek certainly had wheels, and Egyptians had them later than Khufu. The next line handles this honestly: *"Some of these builders never had the wheel. Others had it, and it barely helped."*
- **"no cranes"**: Romans had treadwheel cranes, but none that could lift 800 t. Read as "no cranes for loads this size", the line is defensible.
- **"no steel"**: Roman iron tools sometimes contained steel. Read as "no modern steel machinery", it's fine.
- **"heavier than a blue whale"**: a blue whale is roughly 100–150+ t. Only the Trilithon (~800 t) and the Baalbek quarry blocks clearly exceed that, perhaps also Sacsayhuamán's largest. The line asks about "stones" generally, so it holds, but don't suggest every site's stones are that heavy. The script doesn't.

## Hook options

yt-script asks for five hooks scored with its `hookscore.py`. The tool **couldn't run because Python isn't installed** on this PC (only the Microsoft Store stub exists). The scores below are my manual assessment against the skill's three jobs: confirm the title, open a question, prove the payoff.

| Hook | Formula | Assessment |
|---|---|---|
| **A (used, mandated):** "How did people with no cranes, no wheels, and no steel move stones heavier than a blue whale?" | Question + comparison | Strong. Concrete comparison, an open question, and it confirms the "should have known how" title. |
| B: "Three blocks in a Lebanese temple wall weigh around 800 tonnes each, and the quarry next door holds one twice as heavy." | Statistic | Strong number, but it gives away the #1 payoff in the first 10 seconds. |
| C: "In 2024, scientists traced a six-tonne stone at Stonehenge to the far north of Scotland. Nobody knows how it got there." | Recent discovery | Strong, but it confirms the title less directly. Better as a mid-roll loop (used at 2:19). |
| D: "A city on the sea. Statues that walked. Pillars older than farming." | Triptych tease | Good rhythm. Partly used in the hook's second half. |
| E: "Every one of these nine sites has a theory involving aliens. Every one also has a better explanation." | Myth vs. evidence | Risky: it raises "aliens" in a channel that avoids sensationalism. Not used. |

**Winner: A**, built on the question-plus-comparison formula. It fits because the whole video answers "how did they move it?", and a blue whale is a weight anyone can picture.

## YouTube Agent skill report

| Skill | Used? | What happened |
|---|---|---|
| `/youtube-agent:yt-script` | ✅ | Structure applied: first-15-seconds rule, no channel intro, on-screen cue on every beat, single close ask. `hookscore.py` could not run (no Python). |
| `/youtube-agent:yt-package` | ✅ | Rules applied: ≤60/≤40 character checks, thumbnail text never repeats the title, ≤3 words, a number beats an adjective. `title.py` could not run (no Python). Lengths counted manually. |
| `/youtube-agent:yt-seo` | ✅ | First-two-lines rule, chapters, light tag use, three-query test. |
| `/youtube-agent:yt-plan` | ❌ not used | This skill plans weekly/monthly upload calendars, not the structure of a single video. Story structure was done directly. |
| `/youtube-agent:yt-retention` | ❌ not used | It analyses a YouTube Studio audience-retention export, which doesn't exist before upload. Its pacing principles were applied by hand (open loops, 5–8 s visual changes). Run it on this video's retention CSV ~7 days after publishing. |
| `/youtube-agent:yt-viral` | ❌ not used | Niche research runs through the connected vidIQ tools, which may consume paid credits. Skipped per your "no paid credits without approval" rule. Say the word and I'll run it. |

**Voice profile:** all three skills ask for `~/.claude/youtube/voice.md` (your narration voice, built from three of your own videos). It doesn't exist yet. Send three video links or transcripts and I'll create it, so future scripts match your delivery.

## Before recording

1. Decide on flags F-1 and F-5 (prompt fixes).
2. Clear the four ⚠ items in the research file, or accept the conservative wording as written.
3. Read the script aloud once. Lines that trip you up are the ones to cut.
