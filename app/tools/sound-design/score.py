"""The Knowverse - "The Line": original score, sound effects and final mix.

Everything here is synthesised from scratch with numpy (no samples, no
third-party music), deterministically, from the documentary's own cue sheet
(tools/sound-design/export-cues.ts). Outputs (48 kHz, stereo, float WAV):

  out/audio/music.wav      the score, un-ducked
  out/audio/sfx.wav        sound effects, un-ducked
  out/audio/duck.wav       the music gain curve (1 = full, lower under speech)
  out/audio/mix.wav        narration (unchanged) + ducked music + sfx

Usage: python3 -I tools/sound-design/score.py out/audio/cues.json \
           out/final/narration-final.wav out/audio
"""
import json
import sys
import wave

import numpy as np

SR = 48000
FPS = 30
RNG = np.random.default_rng(2026)


# ---------------------------------------------------------------- helpers
def fr(frame):
    """Frame -> sample index."""
    return int(round(frame * SR / FPS))


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env_adsr(n, a, r, sustain=1.0, curve=2.0):
    """Attack/release envelope over n samples (a, r in seconds)."""
    t = np.arange(n) / SR
    e = np.ones(n) * sustain
    if a > 0:
        e *= np.clip(t / a, 0, 1) ** curve
    if r > 0:
        e *= np.clip((n / SR - t) / r, 0, 1) ** curve
    return e


def fir_lowpass(cut, taps=1025):
    x = np.arange(taps) - (taps - 1) / 2
    h = np.sinc(2 * cut / SR * x) * np.hanning(taps)
    return h / h.sum()


def fir_highpass(cut, taps=1025):
    h = -fir_lowpass(cut, taps)
    h[(taps - 1) // 2] += 1
    return h


def fir_bandpass(lo, hi, taps=1025):
    return fir_lowpass(hi, taps) - fir_lowpass(lo, taps)


def fftconv(x, h, block=1 << 20):
    """Overlap-add convolution of a 1-D signal with a kernel (same length out)."""
    n = len(x)
    m = len(h)
    nfft = 1 << int(np.ceil(np.log2(block + m - 1)))
    H = np.fft.rfft(h, nfft)
    out = np.zeros(n + m - 1)
    for i in range(0, n, block):
        seg = x[i:i + block]
        y = np.fft.irfft(np.fft.rfft(seg, nfft) * H, nfft)[: len(seg) + m - 1]
        out[i:i + len(y)] += y
    off = (m - 1) // 2 if m < 4096 else 0  # linear-phase FIRs are centred
    return out[off:off + n]


def filt(x, h):
    if x.ndim == 2:
        return np.stack([fftconv(x[0], h), fftconv(x[1], h)])
    return fftconv(x, h)


def reverb_ir(seconds, damp_hz, seed):
    r = np.random.default_rng(seed)
    n = int(round(seconds * SR))
    t = np.arange(n) / SR
    irs = []
    for _ in range(2):
        noise = r.standard_normal(n) * np.exp(-6.9 * t / seconds)
        noise = fftconv(noise, fir_lowpass(damp_hz, 255))
        noise[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        irs.append(noise / np.sqrt((noise ** 2).sum()))
    return irs


def reverb(x, irs, wet):
    out = x.copy()
    for c in range(2):
        out[c] = x[c] * (1 - wet) + fftconv(x[c], irs[c]) * wet
    return out


def pan(mono, p):
    """Equal-power pan, p in [-1, 1]."""
    a = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)])


def add(dst, src, at):
    """Add a stereo or mono buffer into dst (stereo) at sample index."""
    if src.ndim == 1:
        src = np.stack([src, src]) * 0.7071
    at = int(at)
    a0, s0 = max(at, 0), max(-at, 0)
    n = min(dst.shape[1] - a0, src.shape[1] - s0)
    if n > 0:
        dst[:, a0:a0 + n] += src[:, s0:s0 + n]


def db(x):
    return 10 ** (x / 20)


# --------------------------------------------------------- instruments
def additive(freq, n, harm=10, tilt=1.4, detune=0.0, vib=0.0, seed=0):
    """Band-limited saw-like tone (sum of harmonics), optional vibrato."""
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    ph_mod = 0
    if vib:
        ph_mod = vib * np.sin(2 * np.pi * (4.8 + r.random()) * t + r.random() * 6)
    f = freq * (1 + detune)
    out = np.zeros(n)
    for k in range(1, harm + 1):
        if k * f > 16000:
            break
        out += np.sin(2 * np.pi * k * f * t + k * ph_mod + r.random() * 6) / k ** tilt
    return out


def pad_chord(notes, seconds, bright=1.4, voices=2, seed=0):
    n = int(round(seconds * SR))
    out = np.zeros((2, n))
    for i, nt in enumerate(notes):
        for v in range(voices):
            d = (v - (voices - 1) / 2) * 0.004
            tone = additive(midi(nt), n, harm=9, tilt=bright, detune=d, seed=seed + i * 7 + v)
            out += pan(tone, (-0.6 + 1.2 * ((i + v) % 4) / 3))
    return out / (len(notes) * voices)


def strings(notes, seconds, seed=0):
    n = int(round(seconds * SR))
    out = np.zeros((2, n))
    for i, nt in enumerate(notes):
        for v in range(3):
            tone = additive(midi(nt), n, harm=12, tilt=1.15, detune=(v - 1) * 0.0035,
                            vib=0.0025, seed=seed + 31 * i + v)
            out += pan(tone, -0.7 + 1.4 * ((i * 3 + v) % 5) / 4)
    return out / (len(notes) * 3)


def piano(note, seconds=4.0, vel=1.0, seed=0):
    n = int(round(seconds * SR))
    t = np.arange(n) / SR
    f = midi(note)
    out = np.zeros(n)
    for k in range(1, 9):
        fk = f * k * np.sqrt(1 + 0.0004 * k * k)
        if fk > 14000:
            break
        out += np.sin(2 * np.pi * fk * t) * np.exp(-t * (0.9 + 0.55 * k)) / k ** 1.1
    hammer = np.random.default_rng(seed).standard_normal(int(0.01 * SR)) * 0.05
    out[: len(hammer)] += hammer
    out *= np.minimum(t / 0.004, 1)
    return out * vel


def pluck(freq, seconds=0.6, index=2.5, decay=0.18):
    n = int(round(seconds * SR))
    t = np.arange(n) / SR
    mod = index * np.exp(-t / (decay * 0.6)) * np.sin(2 * np.pi * 2 * freq * t)
    return np.sin(2 * np.pi * freq * t + mod) * np.exp(-t / decay) * np.minimum(t / 0.003, 1)


def low_pulse(freq, seconds=0.5):
    n = int(round(seconds * SR))
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * 2 * freq * t)
    return np.tanh(1.6 * x) * np.exp(-t / 0.16) * np.minimum(t / 0.006, 1)


def impact(seconds=4.0, f0=70, f1=38, seed=0):
    n = int(round(seconds * SR))
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.25)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9)
    noise = np.random.default_rng(seed).standard_normal(n) * np.exp(-t / 0.08)
    noise = fftconv(noise, fir_lowpass(900, 511)) * 0.6
    return np.tanh(1.3 * (body + noise))


def metal_hit(seconds=3.0, f=180, seed=0):
    n = int(round(seconds * SR))
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k, ratio in enumerate([1.0, 2.76, 5.40, 8.93, 13.34]):
        out += np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * (1.2 + k * 0.9)) / (k + 1)
    noise = np.random.default_rng(seed).standard_normal(n) * np.exp(-t / 0.02) * 0.3
    return (out + noise) * np.minimum(t / 0.002, 1)


def noise(n, seed):
    return np.random.default_rng(seed).standard_normal(n)


def whoosh(seconds=1.6, peak=0.55, lo=300, hi=4000, seed=0, sweep=1.0):
    n = int(round(seconds * SR))
    t = np.arange(n) / SR
    x = noise(n, seed)
    a = fftconv(x, fir_bandpass(lo, lo * 3, 511))
    b = fftconv(x, fir_bandpass(hi / 3, hi, 511))
    k = np.clip(t / seconds, 0, 1) ** sweep
    mixf = a * (1 - k) + b * k
    e = np.where(t < peak * seconds, (t / (peak * seconds)) ** 2,
                 np.exp(-(t - peak * seconds) / (0.25 * seconds)))
    m = mixf * e
    return np.stack([m * (0.5 + 0.5 * (1 - k)), m * (0.5 + 0.5 * k)])  # moves L->R


def riser(seconds=3.0, seed=0):
    n = int(round(seconds * SR))
    t = np.arange(n) / SR
    x = fftconv(noise(n, seed), fir_highpass(800, 511))
    tone = np.sin(2 * np.pi * np.cumsum(220 + 440 * (t / seconds) ** 2) / SR) * 0.25
    return (x * 0.5 + tone) * (t / seconds) ** 2.5


# -------------------------------------------------- music arrangement
D, F, G, A, Bb, C, E, Eb = 62, 65, 67, 69, 70, 72, 64, 63

CHORDS = {
    "Dm9": [D - 24, D - 12, A - 12, F, E + 12],
    "Dm": [D - 24, D - 12, A - 12, F, A],
    "Bb": [Bb - 36, Bb - 24, F - 12, D, F],
    "Bbmaj7": [Bb - 36, Bb - 24, F - 12, A - 12, D],
    "Gm": [G - 36, G - 24, D - 12, Bb - 12, G],
    "Asus": [A - 36, A - 24, E - 12, A - 12, D],
    "A": [A - 36, A - 24, E - 12, A - 12, C + 1],  # C# - dominant
    "F": [F - 24, F - 12, C - 12, A - 12, F],
    "C": [C - 24, C - 12, G - 12, E, G],
    "FoverA": [A - 36, F - 12, C - 12, A - 12, F],
    "Eb/D": [D - 24, D - 12, G - 12, Bb - 12, Eb],
    "Gm/D": [D - 24, D - 12, G - 12, Bb - 12, D],
    "A7b9": [A - 36, A - 24, G - 12, C + 1 - 12, Bb - 12],
    "Eb": [Eb - 24, Eb - 12, Bb - 12, G - 12, Eb],
    "D": [D - 24, D - 12, A - 12, F + 1, A],  # D major (F#)
}

# (start frame, end frame, progression, chord seconds, level dB, character)
SECTIONS = [
    (0, 605, ["Dm9"], 21, -3, "intro"),
    (605, 2023, ["Dm", "Bb", "Gm", "Asus", "A"], 6.0, -5, "tension"),
    (2023, 4004, ["F", "C", "Dm", "Bb"], 6.0, -6, "future"),
    (4004, 5189, ["Dm9", "Bbmaj7", "FoverA", "C"], 7.0, -7, "immersive"),
    (5189, 6357, ["Dm", "Eb/D", "Gm/D", "Dm"], 7.0, -7, "tense"),
    (6357, 7761, ["Dm", "Bb", "F", "C"], 8.0, -9, "reflective"),
    (7761, 9475, ["Dm", "Eb/D", "Gm/D", "A7b9"], 6.0, -6, "investigative"),
    (9475, 11449, ["Gm", "Eb", "Bb", "Dm"], 6.0, -6, "industrial"),
    (11449, 14220, ["Dm", "Bb", "F", "C"], 6.0, -5, "build"),
    (14220, 15338, ["Dm", "Bb", "F", "C"], 7.0, -6, "outro"),
]
XFADE = 3.0  # seconds of overlap between sections
MOTIF = [A, F, E, D, E, F, A - 12]  # piano motif (Scene 8, returns in 15)


def section_audio(sec, cues, total_n):
    f0, f1, prog, clen, lvl, kind = sec
    s0 = fr(f0) - int(XFADE / 2 * SR)
    s1 = fr(f1) + int(XFADE / 2 * SR)
    s0c, s1c = max(s0, 0), min(s1, total_n)
    n = s1c - s0c
    out = np.zeros((2, n))
    seed = f0
    # Chords: overlapping pads (and strings in the bigger sections).
    t = 0.0
    i = 0
    dur = n / SR
    while t < dur:
        name = prog[i % len(prog)]
        L = min(clen + 1.5, dur - t + 0.01)
        notes = CHORDS[name]
        p = pad_chord(notes, L, bright=1.5, seed=seed + i)
        p *= env_adsr(p.shape[1], 1.4, 1.4)
        add(out, p * 0.55, int(t * SR))
        if kind in ("tension", "future", "immersive", "build", "outro", "industrial"):
            hi = [x + 12 for x in notes[2:]]
            st = strings(hi, L, seed=seed + 100 + i) * env_adsr(int(round(L * SR)), 2.0, 1.6)
            add(out, st * (0.22 if kind != "build" else 0.22 + 0.5 * min(1, t / dur)), int(t * SR))
        t += clen
        i += 1
    # Sub drone on the tonic, slowly breathing.
    tt = np.arange(n) / SR
    root = midi(D - 36)
    drone = (np.sin(2 * np.pi * root * tt) + 0.3 * np.sin(2 * np.pi * 2 * root * tt))
    drone *= 0.5 + 0.5 * np.sin(2 * np.pi * tt / 11.0) ** 2
    add(out, drone * 0.18, 0)
    # Character layers.
    beat = 60 / {"tension": 84, "future": 100, "immersive": 80, "tense": 80,
                 "investigative": 90, "industrial": 90, "build": 84}.get(kind, 80)
    if kind in ("tension", "investigative", "industrial", "build", "tense"):
        start = max(cues.get("pulse_from", {}).get(kind, f0), f0)
        k = 0
        t = max(fr(start) - s0c, 0) / SR
        while t < dur - 0.6:
            accent = 1.0 if k % 4 == 0 else 0.6
            note = D - 36 if kind != "industrial" else (G - 36 if (k // 16) % 4 == 0 else D - 36)
            add(out, low_pulse(midi(note)) * 0.35 * accent, int(t * SR))
            if kind in ("investigative", "tense"):
                tick = pluck(midi(D + 24), 0.08, index=1.0, decay=0.02) * 0.06
                add(out, pan(tick, 0.4 if k % 2 else -0.4), int((t + beat / 2) * SR))
            t += beat / (2 if kind in ("tension", "build") else 1)
            k += 1
    if kind == "future":
        arp = [D, F, A, C + 12, A, F]
        t, k = 0.0, 0
        while t < dur - 0.5:
            note = arp[k % len(arp)] + (12 if (k // 24) % 2 else 0)
            add(out, pan(pluck(midi(note), 0.5, 2.0, 0.15) * 0.09, 0.6 * np.sin(k * 0.7)),
                int(t * SR))
            t += beat / 4
            k += 1
    if kind == "tense":  # high, quiet tremolo cluster
        cl = strings([D + 12, Eb + 12], dur, seed=seed + 5)
        cl *= (0.6 + 0.4 * np.sin(2 * np.pi * 7.5 * tt)) * env_adsr(n, 3, 3)
        add(out, cl * 0.08, 0)
    if kind in ("reflective", "outro", "intro"):
        t = 4.0 if kind != "intro" else 9.0
        k = 0
        step = 1.6 if kind != "intro" else 2.4
        while t < dur - 3:
            note = MOTIF[k % len(MOTIF)]
            add(out, pan(piano(note, 4.5, 0.5, seed=k) * 0.32, -0.2 + 0.4 * (k % 2)),
                int(t * SR))
            t += step * (2 if k % len(MOTIF) == len(MOTIF) - 1 else 1)
            k += 1
    if kind == "industrial":
        for k, t in enumerate(np.arange(2.0, dur - 3, beat * 8)):
            add(out, pan(metal_hit(3.0, 140 + 30 * (k % 3), seed=k) * 0.08, -0.5 + (k % 3) * 0.5),
                int(t * SR))
    out *= env_adsr(n, XFADE if s0 > 0 else 0.8, XFADE if s1 < total_n else 0.01, curve=1.0)
    return out * db(lvl), s0c


def build_music(cues, total_n, irs):
    music = np.zeros((2, total_n))
    for sec in SECTIONS:
        audio, at = section_audio(sec, cues, total_n)
        add(music, audio, at)
        print(f"  music section {sec[5]:13s} frames {sec[0]}-{sec[1]}", flush=True)
    # Cinematic moments inside the score.
    ev = cues["events"]
    moments = [
        (ev["scene1"]["F_TITLE"], "bloom", 1.0),          # THE LINE title
        (1499, "swell", 0.8),                             # oil field -> orbit
        (ev["scene14"]["F_QUESTION"], "peak", 1.0),        # emotional peak
        (ev["scene15"]["F_SUBSCRIBE"], "resolve", 1.0),    # end card: D major
    ]
    for f, kind, g in moments:
        if kind in ("bloom", "peak", "resolve"):
            ch = CHORDS["Bbmaj7" if kind == "bloom" else ("Bb" if kind == "peak" else "D")]
            L = 9.0 if kind != "resolve" else (total_n - fr(f)) / SR
            st = strings([x + 12 for x in ch[1:]], L, seed=f) * env_adsr(int(round(L * SR)), 0.6, 4.0)
            add(music, st * (0.25 if kind != "peak" else 0.45) * g, fr(f))
            pd = pad_chord(ch, L, seed=f + 1) * env_adsr(int(round(L * SR)), 0.3, 4.0)
            add(music, pd * (0.3 if kind != "peak" else 0.5) * g, fr(f))
        if kind == "swell":
            add(music, riser(1.4, seed=f) * 0.25 * g, fr(f) - int(1.0 * SR))
    print("  reverb...", flush=True)
    music = reverb(music, irs, 0.35)
    # Gentle low cut (no rumble) and top cut (no harshness).
    music = filt(music, fir_highpass(35))
    music = filt(music, fir_lowpass(11000))
    return music


# ------------------------------------------------------------- sound fx
def wind(n, seed, strength=1.0):
    x = noise(n, seed)
    low = fftconv(x, fir_lowpass(500, 1025))
    gust = fftconv(noise(n, seed + 1), fir_bandpass(700, 2400, 1025)) * 0.35
    t = np.arange(n) / SR
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * t / 7.3 + seed) * np.sin(2 * np.pi * t / 3.1)
    st = np.stack([low + gust * lfo, np.roll(low, 2400) + np.roll(gust, 1300) * (1.2 - lfo)])
    return st * lfo * strength


def build_sfx(cues, total_n, irs):
    sfx = np.zeros((2, total_n))
    ev = cues["events"]
    S = {s["id"]: s for s in cues["scenes"]}

    def span(f0, f1, a=1.5, r=1.5):
        n = fr(f1) - fr(f0)
        return n, env_adsr(n, a, r, curve=1.0)

    # Scene 1: desert air, then an impact as the title lands.
    n, e = span(0, 605, 2.0, 2.0)
    add(sfx, wind(n, 11) * e * 0.05, 0)
    add(sfx, impact(5.0, 72, 36, seed=1) * 0.09, fr(ev["scene1"]["F_TITLE"]) - int(0.02 * SR))
    add(sfx, riser(2.2, seed=2) * 0.06, fr(ev["scene1"]["F_TITLE"]) - int(2.2 * SR))

    # Scene 3: oil field until the dissolve to orbit.
    s3 = S[3]["from"]
    x0, x1 = ev["scene3"]["F_VISION"] - 25, ev["scene3"]["F_VISION"] + 10
    n, e = span(s3, x1, 0.6, 1.2)
    tt = np.arange(n) / SR
    hum = sum(np.sin(2 * np.pi * 50 * k * tt) / k ** 1.5 for k in range(1, 6))
    flare = fftconv(noise(n, 31), fir_bandpass(60, 380, 1025)) * (0.8 + 0.2 * np.sin(tt * 1.3))
    framepos = np.arange(n) / SR * FPS  # frames since the scene start
    distance = np.clip(1 - (framepos - (ev["scene3"]["F_2016"] - s3)) / 120, 0.35, 1)
    add(sfx, pan(hum * 0.012 * e * distance, -0.3), fr(s3))
    add(sfx, pan(flare * 0.03 * e, 0.6), fr(s3))
    # Pumpjack clunks locked to the hero jack: beam angle sin(0.4 + 0.12 f).
    for f in range(s3, x1):
        a_prev = 0.4 + 0.12 * (f - 1 - s3)
        a_now = 0.4 + 0.12 * (f - s3)
        for target in (np.pi / 2, 3 * np.pi / 2):  # top and bottom of the stroke
            k = np.floor((a_now - target) / (2 * np.pi))
            tgt = target + 2 * np.pi * k
            if a_prev < tgt <= a_now:
                d = max(0.25, 1 - max(0, f - ev["scene3"]["F_2016"]) / 200)
                clunk = low_pulse(55, 0.6) * 0.5 + metal_hit(0.6, 260 if target > 3 else 340,
                                                                seed=f) * 0.25
                gain = d * (1 if f < x0 else max(0, (x1 - f) / (x1 - x0)))
                add(sfx, pan(clunk * 0.09 * gain, -0.25), fr(f))
    add(sfx, whoosh(2.2, 0.6, 200, 3000, seed=33) * 0.10, fr(x0) - int(0.6 * SR))

    # Scene 5: airy architectural hum, whooshes on the big camera moves.
    s5, e5 = S[5]["from"], S[5]["to"]
    n, e = span(s5, e5, 1.5, 1.5)
    tt = np.arange(n) / SR
    air = fftconv(noise(n, 51), fir_bandpass(150, 900, 1025)) * 0.02
    tone = (np.sin(2 * np.pi * 110 * tt) + 0.5 * np.sin(2 * np.pi * 165.5 * tt)) * 0.004
    add(sfx, pan((air + tone) * e, 0.0), fr(s5))
    for f in (ev["scene5"]["F_TWO"], ev["scene5"]["F_GAP"], ev["scene5"]["F_MIRROR"] + 60):
        add(sfx, whoosh(2.0, 0.55, 250, 3500, seed=f) * 0.09, fr(f) - int(1.0 * SR))

    # Scene 6: canyon city air and water, the train, then the open desert.
    s6 = S[6]["from"]
    rail = ev["scene6"]["F_RAIL"]
    n, e = span(s6, rail + 10, 1.0, 1.5)
    trickle = fftconv(noise(n, 61), fir_highpass(2500, 511)) * 0.004
    drops = np.zeros(n)
    rr = np.random.default_rng(62)
    for _ in range(int(n / SR * 9)):
        p = rr.integers(0, n - 2000)
        drops[p:p + 1200] += np.sin(2 * np.pi * rr.uniform(1500, 3200) * np.arange(1200) / SR) \
            * np.exp(-np.arange(1200) / 200) * 0.02
    city = fftconv(noise(n, 63), fir_bandpass(120, 700, 1025)) * 0.012
    add(sfx, pan((trickle + drops + city) * e, 0.2), fr(s6))
    # Train: approaches, passes the cut at rail + 88, recedes under the London panel.
    t0, t1 = rail + 20, ev["scene6"]["F_NINE"] + 8
    n = fr(t1) - fr(t0)
    tt = np.arange(n) / SR
    tpass = (rail + 88 - t0) / FPS
    near = 1 / (1 + ((tt - tpass) / 0.9) ** 2)
    rumble = fftconv(noise(n, 64), fir_lowpass(260, 1025)) * near
    clack = np.zeros(n)
    for k in np.arange(0.0, tt[-1], 0.18):
        i = int(k * SR)
        clack[i:i + 2400] += np.exp(-np.arange(min(2400, n - i)) / 300) * 0.6
    clack = fftconv(clack * noise(n, 65), fir_bandpass(200, 1600, 511)) * near
    add(sfx, pan((rumble * 0.10 + clack * 0.05) * env_adsr(n, 0.4, 0.8), 0.0), fr(t0))
    add(sfx, whoosh(1.6, 0.4, 150, 2500, seed=66) * 0.12, fr(rail + 88) - int(0.6 * SR))
    n, e = span(ev["scene6"]["F_95"] - 20, S[6]["to"], 2.0, 2.0)
    add(sfx, wind(n, 67) * e * 0.035, fr(ev["scene6"]["F_95"] - 20))

    # Scene 7: midday wind, strongest while the streamlines show; wingbeats.
    s7, e7 = S[7]["from"], S[7]["to"]
    n = fr(e7) - fr(s7)
    tt = np.arange(n) / SR
    fw = (ev["scene7"]["F_WIND"] - s7) / FPS
    gustenv = 0.35 + 0.65 * np.exp(-((tt - (fw + 1.5)) / 2.2) ** 2)
    add(sfx, wind(n, 71, 1.0) * gustenv * env_adsr(n, 1.5, 1.5) * 0.09, fr(s7))
    fb = ev["scene7"]["F_BIRDS"]
    n2 = fr(e7) - fr(fb)
    flap = fftconv(noise(n2, 72), fir_bandpass(400, 2500, 511))
    tt2 = np.arange(n2) / SR
    flap *= (0.5 + 0.5 * np.sin(2 * np.pi * 9 * tt2) * np.sin(2 * np.pi * 0.37 * tt2)) ** 2
    add(sfx, pan(flap * env_adsr(n2, 2.5, 3.0) * 0.010, 0.3), fr(fb))

    # Scene 8: quiet desert evening air only (restrained, respectful).
    s8, e8 = S[8]["from"], S[8]["to"]
    n, e = span(s8, e8, 2.5, 2.0)
    add(sfx, wind(n, 81, 0.7) * e * 0.03, fr(s8))

    # Scene 9: map transitions, the shrinking line, the resident count.
    s9 = S[9]["from"]
    add(sfx, whoosh(1.8, 0.5, 300, 4000, seed=91) * 0.08, fr(s9) - int(0.3 * SR))
    fc, fk = ev["scene9"]["F_CUT"] + 20, ev["scene9"]["F_KM"] + 20
    n = fr(fk) - fr(fc)
    tt = np.arange(n) / SR
    sweep = np.sin(2 * np.pi * np.cumsum(900 * np.exp(-tt / (n / SR) * 1.6)) / SR)
    add(sfx, pan(sweep * env_adsr(n, 0.3, 0.6) * 0.02, 0.0), fr(fc))
    fr_ = ev["scene9"]["F_RES"]
    for k in range(24):
        add(sfx, pan(pluck(midi(86 - (k % 3)), 0.07, 0.8, 0.015) * 0.035, 0.6), fr(fr_) + int(k * 0.06 * SR))
    add(sfx, whoosh(2.0, 0.5, 200, 3000, seed=92) * 0.08, fr(ev["scene9"]["F_WHERE"]) - int(0.5 * SR))

    # Scene 10: dusk air.
    n, e = span(S[10]["from"], S[10]["to"], 1.5, 1.5)
    add(sfx, wind(n, 101, 0.6) * e * 0.03, fr(S[10]["from"]))

    # Scene 11: excavators, distant piling and drilling; then sand covers it.
    s11, e11 = S[11]["from"], S[11]["to"]
    fb = ev["scene11"]["F_BENEATH"]
    n = fr(fb + 40) - fr(s11)
    tt = np.arange(n) / SR
    fpos = s11 + tt * FPS
    arm = np.sin((fpos - s11) * 0.035 * 1.7 + 1.0)
    engine = sum(np.sin(2 * np.pi * 38 * k * tt * (1 + 0.04 * arm)) / k for k in range(1, 8)) * 0.012
    engine += fftconv(noise(n, 111), fir_bandpass(80, 500, 1025)) * 0.012
    whine = np.sin(2 * np.pi * np.cumsum(520 + 160 * arm) / SR) * 0.002 * (arm > 0.2)
    closeness = 0.4 + 0.6 * np.exp(-((fpos - (ev["scene11"]["F_EXCAVATORS"] + 20)) / 90) ** 2)
    site = (engine + whine) * closeness * env_adsr(n, 1.0, 1.4)
    add(sfx, pan(site, -0.35), fr(s11))
    for k, t in enumerate(np.arange(1.0, n / SR - 1.5, 1.45)):
        add(sfx, pan((low_pulse(48, 0.5) * 0.6 + metal_hit(0.5, 420, seed=k) * 0.3) * 0.05, 0.5),
            fr(s11) + int(t * SR))
    for k, t in enumerate(np.arange(3.0, n / SR - 2, 5.5)):
        L = int(1.2 * SR)
        drill = fftconv(noise(L, 112 + k), fir_bandpass(900, 3000, 511))
        drill *= (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 24 * np.arange(L) / SR))) * env_adsr(L, 0.05, 0.2)
        add(sfx, pan(drill * 0.006, 0.7), fr(s11) + int(t * SR))
    n2 = fr(e11) - fr(fb)
    sand = fftconv(noise(n2, 113), fir_highpass(1800, 511)) * 0.012 + wind(n2, 114)[0] * 0.04
    add(sfx, pan(sand * env_adsr(n2, 1.2, 0.8), 0.0), fr(fb))

    # Scene 12: cinematic transitions on the map.
    for f, g in ((ev["scene12"]["F_QUOTE"], 0.06), (ev["scene12"]["F_OXAGON"], 0.10),
                 (ev["scene12"]["F_SEMAFOR"], 0.06), (ev["scene12"]["F_SUMMER"], 0.08)):
        add(sfx, whoosh(2.0, 0.55, 220, 3200, seed=f) * g, fr(f) - int(0.6 * SR))
    for f in (ev["scene12"]["F_NINE"] + 5, ev["scene12"]["F_CARS"] + 5):  # strike-throughs
        add(sfx, whoosh(0.5, 0.3, 1200, 6000, seed=f, sweep=0.5) * 0.06, fr(f))
    add(sfx, impact(3.0, 62, 40, seed=121) * 0.20, fr(ev["scene12"]["F_QUOTE"]))

    # Scene 13: restrained impact as the pattern appears; ticks per entry.
    add(sfx, impact(4.0, 66, 34, seed=131) * 0.35, fr(ev["scene13"]["F_PATTERN"]))
    for key in ("F_POP", "F_FUND", "F_WORK", "F_NINE"):
        add(sfx, pan(metal_hit(1.2, 520, seed=len(key)) * 0.025, 0.3), fr(ev["scene13"][key]))
    add(sfx, impact(3.5, 55, 32, seed=132) * 0.22, fr(ev["scene13"]["F_COLLAPSE"]))

    # Scene 14: canyon air when we return inside the city.
    fq = ev["scene14"]["F_QUESTION"]
    n, e = span(fq, S[14]["to"], 1.0, 2.0)
    add(sfx, pan(fftconv(noise(n, 141), fir_bandpass(150, 900, 1025)) * 0.014 * e, -0.2), fr(fq))
    add(sfx, whoosh(1.8, 0.5, 200, 3000, seed=142) * 0.08, fr(fq) - int(0.5 * SR))

    # Scene 15: dusk wind; a soft rise into the end card and a low resolve.
    s15 = S[15]["from"]
    n, e = span(s15, cues["total"], 2.0, 1.0)
    add(sfx, wind(n, 151, 0.7) * e * 0.035, fr(s15))
    fs = ev["scene15"]["F_SUBSCRIBE"]
    add(sfx, riser(2.5, seed=152) * 0.04, fr(fs) - int(2.5 * SR))
    add(sfx, impact(6.0, 60, 30, seed=153) * 0.11, fr(fs))

    print("  sfx reverb...", flush=True)
    sfx = reverb(sfx, irs, 0.22)
    sfx = filt(sfx, fir_highpass(30))
    return sfx


# ----------------------------------------------------------------- mix
def speech_gain(cues, total_n, narration):
    """Music gain: 1 in the gaps, -11 dB under narration, smooth."""
    mask = np.zeros(total_n)
    for s in cues["sentences"]:
        mask[fr(s["start"]) - int(0.15 * SR): fr(s["end"]) + int(0.10 * SR)] = 1
    # Bridge short pauses inside speech so the music doesn't pump.
    w = int(0.7 * SR)
    k = np.ones(w) / w
    bridged = np.minimum(1, fftconv(mask, k) * 1.0 + mask)
    target = 1 - (1 - db(-11)) * np.clip(bridged, 0, 1)
    # Attack 120 ms (down), release 700 ms (up): one-pole smoothing, vectorised in blocks.
    ds = 48  # work at 1 kHz control rate
    tc = target[::ds]
    g = np.empty_like(tc)
    a_dn, a_up = np.exp(-1 / (0.12 * 1000)), np.exp(-1 / (0.7 * 1000))
    v = 1.0
    for i, x in enumerate(tc):
        a = a_dn if x < v else a_up
        v = a * v + (1 - a) * x
        g[i] = v
    return np.repeat(g, ds)[:total_n]


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    data = (x.T * 32767).astype("<i2").tobytes()
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)


def read_wav(path):
    with wave.open(path) as w:
        assert w.getframerate() == SR
        a = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(float) / 32768
        return a.reshape(-1, w.getnchannels()).T


def main():
    cues = json.load(open(sys.argv[1]))
    narr = read_wav(sys.argv[2])
    out = sys.argv[3]
    total_n = narr.shape[1]
    assert total_n == fr(cues["total"]), (total_n, fr(cues["total"]))
    cues["pulse_from"] = {"tension": cues["events"]["scene3"]["F_DECADES"]}
    hall = reverb_ir(3.4, 5000, 7)
    space = reverb_ir(1.4, 6000, 8)
    print("music...", flush=True)
    music = build_music(cues, total_n, hall)
    print("sfx...", flush=True)
    sfx = build_sfx(cues, total_n, space)
    duck = speech_gain(cues, total_n, narr)
    # Level the stems: music sits ~16 dB under the narration's speech level
    # in the gaps (~27 dB under it while ducked).
    def rms(x):
        return np.sqrt((x ** 2).mean())
    speech = narr[0][np.abs(narr[0]) > 0.003]
    ref = np.sqrt((speech ** 2).mean())
    music *= (ref * db(-16)) / rms(music)
    sfx *= (ref * db(-20)) / rms(sfx[:, np.abs(sfx).max(0) > 1e-4])
    sfx_duck = 1 - (1 - duck) * 0.45  # effects dip a little under speech
    mix = narr + music * duck + sfx * sfx_duck
    # Headroom: if the mix would exceed -1 dBFS, lower music and effects
    # (never the narration) in 0.5 dB steps until it fits.
    bed = music * duck + sfx * sfx_duck
    bed_gain = 1.0
    mix = narr + bed
    while np.abs(mix).max() > db(-1.0) and bed_gain > db(-12):
        bed_gain *= db(-0.5)
        mix = narr + bed * bed_gain
    print(f"mix peak {20*np.log10(np.abs(mix).max()):.2f} dBFS, bed trim {20*np.log10(bed_gain):.1f} dB", flush=True)
    music *= bed_gain
    sfx *= bed_gain
    write_wav(f"{out}/music.wav", music * 0.9)
    write_wav(f"{out}/sfx.wav", sfx * 0.9)
    write_wav(f"{out}/duck.wav", np.stack([duck, sfx_duck]))
    write_wav(f"{out}/mix.wav", mix)
    print("done", flush=True)


if __name__ == "__main__":
    main()
