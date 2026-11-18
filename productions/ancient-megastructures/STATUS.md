# Production Status: 9 Ancient Megastructures

**Last checkpoint:** 2026-11-18 · script v1 delivered for review
**Running right now:** nothing. No background or cloud task is active for this production.

Any session (local or cloud) resuming this work: read this file first, continue from the first ⏳/⬜ stage, and update this file and commit at the end of every stage.

## Stages

| # | Stage | Status | Output | Notes / blockers |
|---|---|---|---|---|
| 1 | Historical research & fact verification | ✅ Done (v1) | `01-research-and-sources.md` | 4 ⚠ items flagged for a primary-source check |
| 2 | Scriptwriting | ✅ Done (v1) | `02-narration-script.md` | 1,347 words, ~9:00–9:20 |
| 3 | Script review & retention optimisation | ✅ Done (v1) | `05-quality-control.md` | Awaiting **your review** |
| 4 | Visual prompt generation | ✅ Done | `03-shot-list.md` | 18 new prompts + 9 preserved. Decide on flags F-1 and F-5 |
| 5 | Real-footage research | 🟡 Search terms ready | `03-shot-list.md` | Next: find specific clips and check licences (Pexels free; others may cost money and need your approval) |
| 6 | Voiceover preparation | ⬜ Not started | — | Blocked on script approval. Any paid TTS or vidIQ voiceover needs your approval |
| 7 | Video editing & rendering | ⬜ Not started | — | Needs a machine with the editor/Remotion and the footage. **Can't run in the cloud as currently set up** (see below) |
| 8 | Final quality checks | ⬜ Not started | — | |
| 9 | YouTube upload package | ✅ Draft done | `04-upload-package.md` | Re-time chapters after voiceover. **Never published without your explicit approval** |

## Errors / blockers log

| Date | Issue | Recovery |
|---|---|---|
| 2026-11-18 | `hookscore.py` / `title.py` (YouTube Agent tools) failed: Python isn't installed (only the Windows Store stub) | Hooks and titles assessed manually. Install Python 3 to enable the scoring tools. |
| 2026-11-18 | `yt-viral` skipped: uses vidIQ, which may consume paid credits | Waiting for your approval |
| 2026-11-18 | `~/.claude/youtube/voice.md` missing | Send 3 of your videos to build the voice profile |

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
