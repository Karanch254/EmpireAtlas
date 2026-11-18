# QC Report: Voiceover v1 (full narration)

**Video:** 9 Ancient Megastructures Built Before Humans Should Have Known How  
**Date:** 2026-11-18 · **Status:** generated and checked, **waiting for your listening review**. No retakes made.  
**Source text:** `spoken-form-v1.md` §01–§12 (approved spoken form of `02-narration-script.md` v1.2). No source file changed.  
**Settings (all 12 requests):** Dan `fvVBPXuE7f1iX3dZLKFy`, `eleven_v4`, seed 4, stability 0.5, similarity 0.75, style 0.0, speaker boost on, speed 1.0, `mp3_44100_128`, `/with-timestamps`, dictionary `YhYGilJIn6Cp0jpwFo0A` / `cRnXhGnUiGoPtmD1cHcS`, previous/next text = 2 neighbouring sentences.  
**Full file:** `audio/ancient-megastructures-narration-full.mp3`, **9:32.9 (572.91 s)**, 128 kbps, 44.1 kHz, mono (matches the sections).

## Pre-generation check

Approved script narration lines (skipping `[`, `-`, `**`, `#` lines, blanks and the `~9:25 — END` section) vs the spoken form with the 9 changes (8 table rows) undone: **identical word for word in all 12 sections, 1,367 words.** Generation started only after this passed.

## Summary

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | 12 sections, in order, HTTP 200 | ✅ Pass | 12/12 HTTP 200 on the first attempt, generated 01 → 12. No retries |
| 2 | Words match the sent text | ✅ Pass | Alignment characters joined = sent text, exactly, in all 12 sections (also normalized_alignment). 1384 spoken words = **1,367 approved words** after undoing the spoken-form changes. Nothing missing or extra |
| 3 | Duplicated sentences | ✅ Pass | 122 sentences, none repeated |
| 4 | Clipping | ✅ Pass | True peak **−1.6 dBTP**. Highest sample −1.61 dBFS. **0** samples at or above −0.1 dBFS |
| 5 | Long gaps inside sections | ✅ Pass | Alignment: no word-to-word gap over 1.2 s. silencedetect (−45 dB, 1.2 s) on the full file: **0** detections |
| 6 | Joins vs planned gaps (±50 ms) | ✅ Pass | All 11 joins exact (0 ms error). See table below |
| 7 | Duration and pace | ℹ️ | **9:32.9**, **143 wpm** (1,367 approved words). Spoken-form tokens: 145 wpm. Script estimate was ~9:05–9:25 at 145–150 wpm |
| 8 | Pronunciation | 👂 Needs your ears | 31 name occurrences listed below with timestamps. I can't hear the audio |
| 9 | Credits | ✅ Within cap | 3,845 used (cap 10,700). 97,194 remaining. Table below |
| — | Loudness target | ⚠️ **Not met (needs your decision)** | −21.5 LUFS integrated, not −16. See below |
| — | Section loudness spread | ✅ Pass | −19.9 to −21.6 LUFS (1.7 LU). No section more than 2 LU from the others. No per-section changes |
| — | End-of-file bursts in 3 sections | ⚠️ Removed by the trim, please confirm | See below |

## ⚠️ Needs your attention

**1. Loudness: −16 LUFS and ≤ −1.5 dBTP can't both be met with one constant gain and no compression.** The assembled narration measured −20.8 LUFS with −1.0 dBTP before gain. Reaching −16 needs +4.8 dB, which would put true peak near **+3.8 dBTP** (clipping). The peaks aren't isolated: about 4% of 10 ms windows (2,402 of 57,290) would go over −1.5. So I kept the hard limits (one gain, no compression, peak ≤ −1.5 dBTP) and applied **−0.2 dB**, the most gain that keeps the encoded MP3 under −1.5 dBTP. Result: **−21.5 LUFS, −1.6 dBTP, LRA 3.5 LU.** (MP3 encoding lowers measured loudness by ~0.5 LU, so the gain was tuned on the encoded file.) Options for you:
   - (a) Keep it as is. Final loudness is usually set on the full mix, with music, in the edit.
   - (b) Approve a true-peak limiter (or light compression) on the narration to reach −16 LUFS / −1.5 dBTP. No credits needed.

**2. Short bursts of sound at the very end of 3 section files.** In 04, 07 and 09, the speech ends cleanly, then after ~0.3–0.5 s of silence there's a 30–50 ms burst at the very end of the file (peaks about −14 to −16 dBFS). It's probably the model starting into the `next_text` context before being cut off. **The trim cuts at the end of speech, so none of these bursts are in the full file.** They're still in the untouched section MP3s:

| Section | Speech ends | Burst starts | File ends | Burst peak |
|---|---|---|---|---|
| 04-08-stonehenge | 52.36 s | 52.84 s | 52.88 s | -13.6 dBFS |
| 07-05-gobekli-tepe | 55.34 s | 55.64 s | 55.68 s | -16.4 dBFS |
| 09-03-sacsayhuaman | 54.26 s | 54.75 s | 54.80 s | -14.0 dBFS |

**3. Pronunciation still needs your ears.** Every name is listed with its time below. Retakes need your approval (one request per section).

## Sections

| # | Section | Chars sent | Spoken words | Approved words | Full-file start | End | Length | LUFS | Credits (attributed) |
|---|---|---|---|---|---|---|---|---|---|
| 01 | 01-hook | 411 | 74 | 74 | 0.00 | 28.43 | 28.43 s | -21.0 | 181 |
| 02 | 02-introduction | 204 | 38 | 38 | 29.43 | 43.26 | 13.83 s | -19.9 | 90 |
| 03 | 03-09-nan-madol | 840 | 138 | 136 | 43.86 | 98.86 | 54.99 s | -20.5 | 372 |
| 04 | 04-08-stonehenge | 815 | 129 | 128 | 99.46 | 151.87 | 52.41 s | -20.7 | 360 |
| 05 | 05-07-moai | 863 | 146 | 145 | 152.47 | 209.51 | 57.04 s | -20.5 | 390 |
| 06 | 06-06-great-pyramid | 874 | 143 | 133 | 210.11 | 266.37 | 56.26 s | -20.8 | 395 |
| 07 | 07-05-gobekli-tepe | 843 | 125 | 123 | 266.97 | 322.36 | 55.39 s | -21.0 | 378 |
| 08 | 08-04-puma-punku | 880 | 131 | 131 | 322.96 | 381.70 | 58.74 s | -21.6 | 395 |
| 09 | 09-03-sacsayhuaman | 818 | 126 | 126 | 382.30 | 436.61 | 54.31 s | -20.8 | 366 |
| 10 | 10-02-derinkuyu | 792 | 130 | 130 | 437.21 | 489.40 | 52.19 s | -20.8 | 355 |
| 11 | 11-01-baalbek | 972 | 156 | 155 | 490.40 | 551.75 | 61.35 s | -20.7 | 430 |
| 12 | 12-closing | 302 | 48 | 48 | 552.55 | 572.91 | 20.36 s | -20.8 | 133 |
| | **Total** | **8,614** | **1384** | **1,367** | | | **9:32.9** | −21.5 (full) | **3,845** |

Trim: leading silence was already ≤ 35 ms in every section, so nothing was cut at the start. Trailing silence was cut to 50 ms after the last sound above −50 dBFS. 10 ms fades at every join.

## Joins

| After → before | Planned | Inserted | Silence below −60 dB | Speech to speech | Result |
|---|---|---|---|---|---|
| 01 → 02 | 1.0 s | 1.0 s | 1.047 s | 1.075 s | ✅ |
| 02 → 03 | 0.6 s | 0.6 s | 0.635 s | 0.665 s | ✅ |
| 03 → 04 | 0.6 s | 0.6 s | 0.642 s | 0.68 s | ✅ |
| 04 → 05 | 0.6 s | 0.6 s | 0.619 s | 0.65 s | ✅ |
| 05 → 06 | 0.6 s | 0.6 s | 0.641 s | 0.675 s | ✅ |
| 06 → 07 | 0.6 s | 0.6 s | 0.636 s | 0.685 s | ✅ |
| 07 → 08 | 0.6 s | 0.6 s | 0.634 s | 0.675 s | ✅ |
| 08 → 09 | 0.6 s | 0.6 s | 0.636 s | 0.675 s | ✅ |
| 09 → 10 | 0.6 s | 0.6 s | 0.613 s | 0.66 s | ✅ |
| 10 → 11 | 1.0 s | 1.0 s | 1.031 s | 1.07 s | ✅ |
| 11 → 12 | 0.8 s | 0.8 s | 0.822 s | 0.855 s | ✅ |

## Credits

| | Characters used |
|---|---|
| Before (account counter) | 21,490 / 122,529 |
| After | 25,335 / 122,529 |
| **Used by this run** | **3,845** |
| **Remaining** | **97,194** |
| Hard cap | 10,700 (not reached) |

The usage counter updated in batches, roughly every second request, so the exact cost of each request couldn't be read on its own. Observed counter steps:

| Sections | Characters sent | Counter step | Credits per character |
|---|---|---|---|
| 01 + 02 | 615 | 271 | 0.44 |
| 03 + 04 | 1655 | 732 | 0.44 |
| 05 + 06 | 1737 | 785 | 0.45 |
| 07 + 08 | 1723 | 773 | 0.45 |
| 09 + 10 | 1610 | 721 | 0.45 |
| 11 | 972 | 430 | 0.44 |
| 12 | 302 | 133 | 0.44 |

The per-section column in the Sections table splits each step by character count. The bill was ~0.45 credits per character, below the 0.60 seen on the preview and well under the 1 per character estimate. The context text (`previous_text`/`next_text`) wasn't billed separately.

## Pronunciation spot-check (full-file times)

“Nan Madol” is in the dictionary but never spoken in the narration (only in the on-screen title), so it doesn't appear here.

| Time | Name | Section | Context |
|---|---|---|---|
| 0:45.86 | Pohnpei | 03 | …the coast of Pohnpei, in Micronesia, more… |
| 1:00.50 | Saudeleur | 03 | …seat of the Saudeleur rulers, and its… |
| 1:10.14 | Pohnpei | 03 | …quarried elsewhere on Pohnpei, where volcanic rock… |
| 1:56.26 | Preseli | 04 | …came from the Preseli Hills in south-west… |
| 2:33.83 | Moai | 05 | …Number seven: the Moai of Rapa Nui,… |
| 2:34.71 | Rapa Nui | 05 | …the Moai of Rapa Nui, a remote Pacific… |
| 2:43.43 | Rano Raraku | 05 | …one volcanic quarry, Rano Raraku. Most are a… |
| 2:48.23 | Paro | 05 | …some are huge. Paro, one of the… |
| 2:53.43 | Rapa Nui | 05 | …around eighty tonnes. Rapa Nui tradition says the… |
| 2:55.15 | Moai | 05 | …tradition says the Moai walked. In twenty… |
| 2:59.63 | Lipo | 05 | …Hunt and Carl Lipo tested that with… |
| 3:23.15 | Rapa Nui | 05 | …never finished. On Rapa Nui, the challenge was… |
| 3:33.75 | Khufu | 06 | …for the pharaoh Khufu around four thousand… |
| 3:57.15 | Tura | 06 | …stone came from Tura, across the Nile.… |
| 4:00.03 | Wadi al-Jarf | 06 | …Papyri found at Wadi al-Jarf include the logbook… |
| 4:03.23 | Merer | 06 | …an official named Merer, recording his crew… |
| 4:28.21 | Göbekli Tepe | 07 | …rule. Number five: Göbekli Tepe, in south-eastern Türkiye.… |
| 4:30.41 | Türkiye | 07 | …Tepe, in south-eastern Türkiye. Its monumental enclosures… |
| 5:14.57 | Göbekli Tepe | 07 | …people toward farming. Göbekli Tepe shows ambition. The… |
| 5:24.16 | Puma Punku | 08 | …Earth. Number four: Puma Punku, part of the… |
| 5:26.32 | Tiwanaku | 08 | …of the larger Tiwanaku complex near Lake… |
| 6:23.50 | Sacsayhuamán | 09 | …extreme. Number three: Sacsayhuamán, the Inca complex… |
| 6:26.22 | Cusco | 09 | …Inca complex above Cusco. Its zigzag walls… |
| 7:05.22 | Sacsayhuamán | 09 | …indestructible. Much of Sacsayhuamán was dismantled by… |
| 7:08.70 | Cusco | 09 | …to build colonial Cusco. The biggest stones… |
| 7:18.41 | Derinkuyu | 10 | …down. Number two: Derinkuyu, in Cappadocia. Beneath… |
| 8:01.21 | Derinkuyu | 10 | …here at once. Derinkuyu was carved out… |
| 8:11.60 | Baalbek | 11 | …size. Number one: Baalbek, in Lebanon's Beqaa… |
| 8:13.28 | Beqaa | 11 | …Baalbek, in Lebanon's Beqaa Valley. Beneath the… |
| 8:22.96 | Trilithon | 11 | …by side: the Trilithon. Each is about… |
| 9:32.23 | Knowverse | 12 | …This is The Knowverse.… |

## Files

- `audio/sections/NN-<slug>.mp3` + `.json` (text, previous/next text, settings, dictionary locator, alignment, normalized_alignment, credits)
- `audio/ancient-megastructures-narration-full.mp3`
- `timing/word-timings.json` (1,384 spoken-form words), `timing/sentence-timings.json`, `timing/section-timings.json`: all on the full-file timeline
