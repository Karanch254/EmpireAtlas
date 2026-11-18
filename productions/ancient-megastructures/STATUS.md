# Production Status: 9 Ancient Megastructures

**Last checkpoint:** 2026-11-18 · Phase 2 voiceover: pronunciation preview v1 ready (`voiceover/audio/preview/pronunciation-preview-v1.mp3`, 28.0 s) · **waiting for you to listen and approve** · 145 credits used, 101,039 remaining
**Running right now:** nothing. No background or cloud task is active for this production.

Any session (local or cloud) resuming this work: read this file first, continue from the first ⏳/⬜ stage, and update this file and commit at the end of every stage.

## Stages

| # | Stage | Status | Output | Notes / blockers |
|---|---|---|---|---|
| 1 | Historical research & fact verification | ✅ Done (v1.1) | `01-research-and-sources.md` | All 4 flagged items rechecked and resolved (R-1 to R-4) |
| 2 | Scriptwriting | ✅ Done (v1.1) | `02-narration-script.md` | 1,367 words, ~9:05–9:25. Puma Punku, Sacsayhuamán and Derinkuyu lines updated |
| 3 | Script review & retention optimisation | ✅ Done (v1.2) | `05-quality-control.md` | 0 unresolved factual or visual issues |
| 4 | Visual prompt generation | ✅ Done (v1.2) | `03-shot-list.md` | All 7 flags closed. 4 prompts corrected (Baalbek cutting, Sacsayhuamán cutting and placing, Derinkuyu cutaway). 5 existing prompts unchanged. 18 new |
| 5 | Real-footage research | 🟡 Search terms ready | `03-shot-list.md` | Next: find specific clips and check licences (Pexels free; others may cost money and need your approval) |
| 6 | Voiceover preparation | 🟡 Preview ready, awaiting approval | `voiceover/VOICEOVER-CONFIG.md`, `voiceover/spoken-form-v1.md`, `voiceover/pronunciation-aliases.pls`, `voiceover/pronunciation-dictionary.json`, `voiceover/audio/preview/` | ✅ Dictionary `YhYGilJIn6Cp0jpwFo0A` (version `cRnXhGnUiGoPtmD1cHcS`, 24 rules) created. ✅ One 241-character preview (Dan, eleven_v4, seed 4), 28.0 s, per-name timings in the preview `.json`. Credits: **145 used** (21,345 → 21,490 of 122,529), **101,039 remaining**. Full narration NOT generated: needs your approval |
| 7 | Video editing & rendering | ⬜ Not started | — | Needs a machine with the editor/Remotion and the footage. **Can't run in the cloud as currently set up** (see below) |
| 8 | Final quality checks | ⬜ Not started | — | |
| 9 | YouTube upload package | ✅ Draft done | `04-upload-package.md` | Re-time chapters after voiceover. **Never published without your explicit approval** |

## Changelog

| Version | Date | Change |
|---|---|---|
| v1 | 2026-11-18 | Script, shot list, research, upload package, QC (commit 7e2d377) |
| v1.1 | 2026-11-18 | Baalbek P-1A → Roman iron tools. Sacsayhuamán P-3B → repeated test fit and adjustment. Research flags R-1 to R-4 resolved. Derinkuyu → 50+ m open / ~85 m total. Sacsayhuamán → 100–200 t estimate range. Puma Punku andesite → volcanic sources across the lake (Mount Ccapia). Thumbnail #3 → "85 M DOWN" |
| v1.2 | 2026-11-18 | Sacsayhuamán P-3A → rough shaping at quarry, final fit at the wall (F-4). Derinkuyu P-2A cutaway → ~85 m to match the narration (F-7). F-2, F-3 and F-6 closed with no change. QC audit: 0 open accuracy issues |
| P2-S2 | 2026-11-18 | Voiceover Step 2 proposal: spoken-form copy (9 number/date/italic changes, wording otherwise identical), 24-entry pronunciation dictionary, settings and credit estimate. Approved script untouched |
| P2-S3 | 2026-11-18 | Cloud read-only check passed. b7d39d2 pushed. Dictionary upload attempted in the cloud: HTTP 401 missing `pronunciation_dictionaries_write`. Preview not sent, nothing saved or pushed, 0 credits used (21,345 / 122,529 before and after) |
| P2-S4 | 2026-11-18 | Write permission worked: dictionary `YhYGilJIn6Cp0jpwFo0A` / `cRnXhGnUiGoPtmD1cHcS` created (24 rules). One preview request (241 characters, 244 bytes), HTTP 200, 28.0 s MP3 + alignment + name timings saved. Credits: 145 used (21,345 → 21,490), 101,039 remaining. The counter lagged, so the figure was corrected after a later re-read |

**Push status:** ✅ **Pushed** to GitHub on 2026-11-18, with your approval.
- Remote branch: `origin/claude/relaxed-johnson-o8xlkc` (https://github.com/Karanch254/EmpireAtlas/tree/claude/relaxed-johnson-o8xlkc)
- Production commits pushed: `7e2d377` (v1), `82e2416` (v1.1), `261b298` (v1.2, latest production commit)
- Only `productions/ancient-megastructures/` was pushed. Uncommitted Caspian work in `app/` stays local.
- Nothing has been published or uploaded to YouTube.

## Errors / blockers log

| Date | Issue | Recovery |
|---|---|---|
| 2026-11-18 | `hookscore.py` / `title.py` (YouTube Agent tools) failed: Python isn't installed (only the Windows Store stub) | Hooks and titles assessed manually. Install Python 3 to enable the scoring tools. |
| 2026-11-18 | `yt-viral` skipped: uses vidIQ, which may consume paid credits | **You said not to run it.** Not run, and no vidIQ credits used |
| 2026-11-18 | `~/.claude/youtube/voice.md` missing | Send 3 of your videos to build the voice profile |
| 2026-11-18 | ElevenLabs API: HTTP 401 from this PC. The key was previously supplied by a cloud-environment proxy that this PC doesn't have | Option A: run Step 3 in that cloud environment. Option B: you set the `ELEVENLABS_API_KEY` user environment variable yourself and restart the app |
| 2026-11-18 | Dictionary upload (cloud): HTTP 401, key missing `pronunciation_dictionaries_write` | You add Pronunciation Dictionaries → Write (and confirm Text to Speech) on the ElevenLabs key, then rerun the same one-upload, one-preview step |

## Cloud continuity: what's actually available

**Facts as of this session:**
- This session runs **on your PC** (Claude desktop app). If the PC is off, this session stops. Nothing continues in the background.
- The project is a git repo with a GitHub remote (`origin`, branch `claude/relaxed-johnson-o8xlkc`). Production files persist in the cloud **only once they're committed and pushed**.
- Claude Code can run **cloud sessions** (claude.ai/code) and **scheduled cloud routines** (`/schedule`). Both run on Anthropic's infrastructure, not your PC, and start from a **pushed** GitHub branch.

**To make this production resumable with the PC off:**
1. **Push** this branch to GitHub (I'll do it once you say yes).
2. Make sure the GitHub repo is connected to Claude Code on the web (claude.ai/code → connect GitHub, select `EmpireAtlas`), with a cloud environment.
3. Then either:
   - start a **cloud session** for the next stage ("continue the ancient-megastructures production from STATUS.md"), or
   - create a **scheduled routine** (`/schedule`), e.g. daily: "read STATUS.md, do the next text-only stage, commit, push, update STATUS.md".

**What cloud sessions can and can't do here:**
- ✅ Research, script revisions, prompts, footage search lists, upload-package edits, status tracking, commits.
- ❌ Rendering the Remotion video, using local footage, or anything that needs files that aren't in the repo (`node_modules`, large media) or paid API keys. Those stay local unless you set up cloud rendering separately.
- ❌ Uploading to YouTube. That always waits for your explicit approval.
