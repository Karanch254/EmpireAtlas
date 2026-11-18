# Voiceover Configuration: proposal v1 (awaiting approval)

**Status:** proposal only. No audio has been generated and no ElevenLabs credits have been used.
**Approved source text:** `../02-narration-script.md` (v1.2, commit 261b298, 1,367 words). Not modified.
**Audio input text:** `spoken-form-v1.md` (8,631 characters).

---

## 1. API connection check: ❌ not verified from this PC

| Check | Result |
|---|---|
| ElevenLabs key in Windows environment variables (User / Machine / Process) | None found (searched by variable name only. No values were read or printed.) |
| Key in project `.env` files or Claude settings | None found |
| Read-only API calls (`/v1/user/subscription`, `/v1/voices/{id}`, `/v1/models`) | **HTTP 401 Invalid API key.** No credits are used by these endpoints. |
| How earlier Knowverse audio was made | `app/tools/caspian/generate-sections.py` sends the placeholder key `"proxy-injected"`, so the real key was added by a network proxy in the environment that ran it (most likely a Claude cloud session with the key stored as a secret). That proxy doesn't exist on this PC. |
| Python | Not installed on this PC. Generation can use `curl` or Node instead. |

**Because of this, I couldn't confirm from the account:** the voice still exists, which models the account can use, the plan, or the remaining credit balance.

### Two safe ways to enable it (your choice; never paste the key into chat)
- **A. Run Step 3 in the same cloud environment as before.** The key stays in that environment's secret store. This is also the "PC can be off" option from Phase 1.
- **B. Store the key on this PC yourself:** Windows Settings → System → About → Advanced system settings → Environment Variables → *User variables* → New: name `ELEVENLABS_API_KEY`, value = your key. Then fully restart the Claude app. I would only ever reference the variable by name.

Either way, the first action after approval is the same three read-only calls, plus the account's credit balance, before any generation.

---

## 2. Voice (from the project's own records)

| Item | Value | Source |
|---|---|---|
| Voice name | **Dan** | `app/tools/caspian/generate-sections.py`, `app/src/neom/closing-line.ts` (closing line regenerated 2026-11-07) |
| Voice ID | `fvVBPXuE7f1iX3dZLKFy` | same script |
| Plan used previously | Paid ElevenLabs plan (£22), per `app/CREDITS.md` | Not re-verified |

Using Dan keeps the channel's voice consistent with the Caspian video and the rebrand closing line.

## 3. Model and settings: recommendation

| Setting | Recommended | Why |
|---|---|---|
| Model | `eleven_v4` | Same model as the channel's approved takes. Supports pronunciation dictionaries (alias and phoneme rules). |
| Stability | **0.50** | The channel's approved value. Natural variation without drifting between sections. |
| Similarity boost | **0.75** | The channel's approved value. |
| Style exaggeration | **0.0** | No added drama, as your brief requires ("avoid exaggerated drama"). |
| Speaker boost | **On** | The channel's approved value. |
| Speed | **1.0** | The previous takes ran at 1.0. At 8,631 characters this should land near the 145–150 wpm target (~9:05–9:30). Only consider 0.95 if the preview feels rushed. |
| Seed | **4** (fixed) | Same as the Caspian workflow, for repeatable retakes. |
| Continuity | `previous_text` / `next_text` set to the neighbouring section's last and first sentences | Keeps tone and pacing consistent across the 12 requests. These are context only and aren't spoken. |
| Output | `mp3_44100_128`, with timestamps (`/with-timestamps`) | Matches the previous takes. Timestamps give word timing for the edit and for my Step 4 check. |
| Pauses | Added **in the edit**, not in the text: ~0.6 s between sections, ~1.0 s after the hook and before #1 | Keeps the approved wording untouched and pauses fully adjustable. |

## 4. Pronunciation handling

**Method:** an ElevenLabs **pronunciation dictionary** with alias rules (`pronunciation-aliases.pls`, 24 entries), uploaded to the account and attached to each request. Alias rules work on every current model including `eleven_v4`. Phoneme (IPA) rules also work on v4 but only for English, and alias respellings are easier to tweak by ear.

Advantages: the approved spellings stay in both the script and the spoken-form copy, so captions and alignment match. The fix lives in one file. And retakes need no text edits.

| Name | Proposed sound | Notes |
|---|---|---|
| **Göbekli Tepe** | guh-BECK-lee TEH-peh | Close to Turkish *[gœbekˈli teˈpe]*. The common English form. |
| **Sacsayhuamán** | sak-sigh-wah-MAHN | Quechua *Saksaywaman*. Avoids the "sexy woman" mishearing. |
| **Pohnpei** | POHN-pay | |
| **Tiwanaku** | tee-wah-NAH-koo | |
| Saudeleur | SOW-deh-lair | |
| Nan Madol | nahn mah-DOLL | |
| Rapa Nui / Rano Raraku / Moai | RAH-pah NOO-ee / RAH-no rah-RAH-koo / MOH-eye | |
| Khufu / Merer / Tura / Wadi al-Jarf | KOO-foo / MEH-rer / TOO-rah / WAH-dee al-JARF | |
| Türkiye | TUR-kee-yeh | |
| Puma Punku | POO-mah POON-koo | |
| Cusco | KOOS-koh | |
| Derinkuyu | deh-rin-KOO-yoo | |
| Baalbek / Beqaa / Trilithon | BAHL-beck / beh-KAH / TRY-lith-on | "TRIL-ith-on" is also accepted. Your choice. |
| Preseli / Lipo / Paro | preh-SELL-ee / LEE-poh / PAH-roh | |
| Knowverse | KNOW-verse | Check it matches the existing closing line. |

**Recommended check before the full run:** one short preview request containing only the name list (~350 characters, ≈350 credits) to confirm the respellings by ear. This also needs your approval.

## 5. Spoken-form changes (the complete list, 9 items)

Produced mechanically with fixed find-and-replace rules. A word-level diff confirmed no other text changed.

| Section | Approved script | Spoken-form copy |
|---|---|---|
| #9 Nan Madol | about 1200 to 1500 CE. | about twelve hundred to fifteen hundred C.E. |
| #8 Stonehenge | In 2024, a study in *Nature* | In twenty twenty-four, a study in Nature |
| #7 Moai | In 2012, | In twenty twelve, |
| #6 Pyramid | around 4,500 years ago | around four thousand five hundred years ago |
| #6 Pyramid | about 146.6 metres | about a hundred and forty-six point six metres |
| #6 Pyramid | an estimated 2.3 million blocks | an estimated two point three million blocks |
| #5 Göbekli Tepe | roughly 9600 to 8200 BCE | roughly ninety-six hundred to eighty-two hundred B.C.E. |
| #1 Baalbek | In 2014, | In twenty fourteen, |

(The *Nature* italics change is counted with the 2024 row: 9 changes across 8 rows.)

Already spoken-ready, so left as written: "nineteen metres", "eight hundred tonnes", "sixteen hundred and fifty", "eighty-five", "H-shaped", "T-shaped", "south-west", "north-east".

## 6. Sections (12 requests)

| # | File | Section | Characters |
|---|---|---|---|
| 01 | `01-hook.mp3` | Hook | 412 |
| 02 | `02-introduction.mp3` | Introduction | 205 |
| 03 | `03-09-nan-madol.mp3` | #9 Nan Madol | 842 |
| 04 | `04-08-stonehenge.mp3` | #8 Stonehenge | 816 |
| 05 | `05-07-moai.mp3` | #7 Moai | 864 |
| 06 | `06-06-great-pyramid.mp3` | #6 Great Pyramid | 875 |
| 07 | `07-05-gobekli-tepe.mp3` | #5 Göbekli Tepe | 847 |
| 08 | `08-04-puma-punku.mp3` | #4 Puma Punku | 881 |
| 09 | `09-03-sacsayhuaman.mp3` | #3 Sacsayhuamán | 821 |
| 10 | `10-02-derinkuyu.mp3` | #2 Derinkuyu | 793 |
| 11 | `11-01-baalbek.mp3` | #1 Baalbek | 973 |
| 12 | `12-closing.mp3` | Closing | 303 |
| | `00-full-narration.mp3` | All 12 joined with the pauses above (made locally with ffmpeg, no credits) | — |

Output folder: `productions/ancient-megastructures/voiceover/audio/`. Each MP3 gets a `.json` with its text, settings and word timings.

## 7. Credit estimate

| Item | Characters ≈ credits |
|---|---|
| Full narration, one pass (12 sections) | **≈ 8,631** |
| Pronunciation preview (recommended, before the full run) | ≈ 350 |
| Retake allowance (~20%, e.g. 2–3 sections redone for pronunciation or pacing) | ≈ 1,700 |
| **Planned total** | **≈ 10,700 credits** |

Basis: ElevenLabs bills text-to-speech per character of spoken text. For `eleven_v4`, its published guidance (~10,000 credits ≈ 10 minutes of audio) matches 1 credit per character. I couldn't check your balance or plan (no API access from this PC), so this is an estimate. The first read-only call after approval will confirm the remaining balance before anything is generated. The documentation doesn't make clear whether `previous_text`/`next_text` context is billed. If it is, the worst case adds about 2,000 credits.
