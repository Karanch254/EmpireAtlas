"""Mix the narration with the synthesised score and effects.

Reads the stems written by score.py and sets the balance. The narration is
added untouched (unity gain); only music and effects are shaped:
  * music sits MUSIC_GAP dB under the narration's speech level between
    sentences, and is ducked a further DUCK dB while Dan is speaking
    (120 ms attack, 700 ms release, short pauses bridged);
  * effects sit SFX dB under speech, and dip DUCK * SFX_DUCK_SHARE under it;
  * if the mix would pass -1 dBFS, music and effects are lowered (never
    the narration).

Usage: python3 -I tools/sound-design/mix.py out/audio/cues.json \
           out/final/narration-final.wav out/audio
"""
import json
import sys

import numpy as np

sys.path.insert(0, __file__.rsplit("/", 1)[0])
import score  # noqa: E402

MUSIC_GAP = -10.0  # dB under speech level, between sentences
DUCK = -8.0  # extra dB while narration speaks
SFX = -13.0  # dB under speech level
SFX_DUCK_SHARE = 0.5


def main():
    cues = json.load(open(sys.argv[1]))
    narr = score.read_wav(sys.argv[2])
    out = sys.argv[3]
    music = score.read_wav(f"{out}/music.wav")
    sfx = score.read_wav(f"{out}/sfx.wav")
    n = narr.shape[1]
    assert music.shape[1] == n and sfx.shape[1] == n

    def rms(x):
        return np.sqrt((x ** 2).mean())

    speech = narr[0][np.abs(narr[0]) > 0.003]
    ref = rms(speech)
    music = music * (ref * score.db(MUSIC_GAP)) / rms(music)
    active = np.abs(sfx).max(0) > 1e-4
    sfx = sfx * (ref * score.db(SFX)) / rms(sfx[:, active])

    # Ducking curve (same timing logic as score.speech_gain, set depth).
    mask = np.zeros(n)
    for s in cues["sentences"]:
        mask[score.fr(s["start"]) - int(0.15 * score.SR): score.fr(s["end"]) + int(0.10 * score.SR)] = 1
    w = int(0.7 * score.SR)
    bridged = np.clip(score.fftconv(mask, np.ones(w) / w) + mask, 0, 1)
    target = 1 - (1 - score.db(DUCK)) * bridged
    ds = 48
    tc = target[::ds]
    g = np.empty_like(tc)
    a_dn, a_up = np.exp(-1 / 120), np.exp(-1 / 700)
    v = 1.0
    for i, x in enumerate(tc):
        a = a_dn if x < v else a_up
        v = a * v + (1 - a) * x
        g[i] = v
    duck = np.repeat(g, ds)[:n]
    sfx_duck = 1 - (1 - duck) * SFX_DUCK_SHARE

    bed = music * duck + sfx * sfx_duck
    gain = 1.0
    while np.abs(narr + bed * gain).max() > score.db(-1.0) and gain > score.db(-12):
        gain *= score.db(-0.5)
    mix = narr + bed * gain
    print(f"bed trim {20 * np.log10(gain):.1f} dB, mix peak {20 * np.log10(np.abs(mix).max()):.2f} dBFS")
    score.write_wav(f"{out}/mix.wav", mix)
    score.write_wav(f"{out}/duck.wav", np.stack([duck, sfx_duck]))
    # Proof that the narration is untouched: the mix minus the bed.
    residual = mix - bed * gain - narr
    print(f"narration residual max |x| = {np.abs(residual).max():.2e} (float rounding only)")


if __name__ == "__main__":
    main()
