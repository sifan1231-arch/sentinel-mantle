# Sentinel Arena — procedural broadcast score (85s, license-clean, fully synthesized)
# Timeline (matches src/Video.tsx scene cuts @30fps):
#   0-6s    Intro        — ambient swell, sub heartbeat
#   6-16s   Roster       — kick + bass groove enters
#   16-26s  ThinkOutLoud — + hats & arp
#   26-38s  Mandate      — energy builds, riser 34->38
#   38s     SHOCK        — impact boom, dark tense section 38-50
#   50-60s  Verify       — recovery, brighter chords
#   60-70s  Spawn        — full groove + lead
#   70-78s  Share        — triumphant peak
#   78.5s   Outro hit    — final boom, pads ring out, fade to 85
import numpy as np
import wave

SR = 44100
DUR = 85.0
N = int(SR * DUR)
t = np.arange(N) / SR
L = np.zeros(N)
R = np.zeros(N)

BPM = 120.0
BEAT = 60.0 / BPM  # 0.5s
BAR = BEAT * 4     # 2.0s


def n2f(name, octave):
    notes = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    semis = notes[name] + (octave - 4) * 12 - 9  # A4 = 440
    return 440.0 * 2 ** (semis / 12)


def add(buf_l, buf_r, sig, at):
    i = int(at * SR)
    j = min(N, i + len(sig))
    if i >= N:
        return
    seg = sig[: j - i]
    buf_l[i:j] += seg
    buf_r[i:j] += seg


def addst(sig_l, sig_r, at):
    i = int(at * SR)
    j = min(N, i + len(sig_l))
    if i >= N:
        return
    L[i:j] += sig_l[: j - i]
    R[i:j] += sig_r[: j - i]


def env_ad(n, a, d, curve=4.0):
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na)
    nd = n - na
    if nd > 0:
        e[na:] = np.exp(-curve * np.linspace(0, 1, nd))
    return e


def lowpass(x, alpha):
    y = np.empty_like(x)
    acc = 0.0
    for k in range(len(x)):
        acc += alpha * (x[k] - acc)
        y[k] = acc
    return y


# vectorized one-pole via lfilter-style recursion using cumulative trick is messy; small signals only use loop.
# For long pads use FFT brick-ish smoothing instead:
def smooth(x, cutoff_hz):
    f = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), 1 / SR)
    f *= 1.0 / (1.0 + (freqs / cutoff_hz) ** 2)
    return np.fft.irfft(f, len(x))


def kick(vel=1.0):
    n = int(0.30 * SR)
    tt = np.arange(n) / SR
    f = 160 * np.exp(-tt * 22) + 44
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-tt * 9)
    click = np.random.RandomState(7).randn(n) * np.exp(-tt * 320) * 0.5
    return (body + click) * vel * 0.95


def hat(vel=1.0, open_=False):
    n = int((0.20 if open_ else 0.05) * SR)
    rs = np.random.RandomState(3)
    x = rs.randn(n)
    x = np.diff(x, prepend=0)  # highpass-ish
    return x * np.exp(-np.arange(n) / SR * (18 if open_ else 90)) * vel * 0.16


def snare(vel=1.0):
    n = int(0.22 * SR)
    tt = np.arange(n) / SR
    rs = np.random.RandomState(11)
    noise = np.diff(rs.randn(n), prepend=0) * np.exp(-tt * 26)
    tone = np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 38)
    return (noise * 0.8 + tone * 0.5) * vel * 0.5


def bass_note(freq, dur, vel=1.0, drive=1.6):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    saw = 2 * ((freq * tt) % 1.0) - 1.0
    sub = np.sin(2 * np.pi * freq * 0.5 * tt) * 0.6
    x = np.tanh((saw * 0.7 + sub) * drive)
    x = smooth(x, 900)
    return x * env_ad(n, 0.004, 2.2, 5.0) * vel * 0.5


def pluck(freq, dur, vel=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * freq * tt) + 0.35 * np.sin(2 * np.pi * freq * 2 * tt)
    return x * env_ad(n, 0.002, 0.5, 9.0) * vel * 0.22


def lead(freq, dur, vel=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.5 * tt)
    x = 2 * ((freq * vib * tt) % 1.0) - 1.0
    x = smooth(x, 2400)
    return x * env_ad(n, 0.02, 1.1, 3.0) * vel * 0.30


def pad_chord(freqs, dur, vel=1.0, bright=1400, attack=0.8):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    rs = np.random.RandomState(int(sum(freqs)) % 1000)
    xl = np.zeros(n)
    xr = np.zeros(n)
    for f0 in freqs:
        for det, w in ((0.9985, 0.5), (1.0, 1.0), (1.0018, 0.5)):
            ph = rs.rand() * 2 * np.pi
            s = 2 * ((f0 * det * tt + ph / (2 * np.pi)) % 1.0) - 1.0
            xl += s * w * (0.55 if det < 1 else 0.45)
            xr += s * w * (0.45 if det < 1 else 0.55)
    xl = smooth(xl, bright)
    xr = smooth(xr, bright)
    e = np.ones(n)
    na = int(attack * SR)
    e[:na] = np.linspace(0, 1, na) ** 2
    rel = int(0.6 * SR)
    if rel < n:
        e[-rel:] *= np.linspace(1, 0, rel)
    g = vel * 0.085 / max(1, len(freqs))
    return xl * e * g * 3, xr * e * g * 3


def riser(dur, at):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    rs = np.random.RandomState(21)
    noise = rs.randn(n)
    sweep = smooth(noise, 600)
    f = np.interp(tt, [0, dur], [200, 5000])
    # crude rising-band: mix noise with sine sweep
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) * 0.4
    e = (tt / dur) ** 2.2
    sig = (sweep * 0.8 + tone) * e * 0.5
    add(L, R, sig, at)


def impact(at, vel=1.0):
    n = int(2.8 * SR)
    tt = np.arange(n) / SR
    f = 90 * np.exp(-tt * 5) + 32
    ph = 2 * np.pi * np.cumsum(f) / SR
    boom = np.sin(ph) * np.exp(-tt * 1.7)
    rs = np.random.RandomState(5)
    crash = np.diff(rs.randn(n), prepend=0) * np.exp(-tt * 3.2) * 0.35
    sig = np.tanh((boom + crash) * 1.8) * vel * 0.9
    add(L, R, sig, at)


# ---------------- arrangement ----------------
Dm = [n2f("D", 3), n2f("F", 3), n2f("A", 3)]
Bb = [n2f("A#", 2), n2f("D", 3), n2f("F", 3)]
F_ = [n2f("F", 3), n2f("A", 3), n2f("C", 4)]
C_ = [n2f("C", 3), n2f("E", 3), n2f("G", 3)]
Gm = [n2f("G", 2), n2f("A#", 2), n2f("D", 3)]
PROG = [Dm, Bb, F_, C_]
DARK = [Dm, Dm, Gm, Bb]
BRIGHT = [F_, C_, Dm, Bb]

# --- pads: whole piece, chord per bar ---
for bar_i in range(int(DUR / BAR) + 1):
    at = bar_i * BAR
    if at >= DUR:
        break
    sec = at
    if sec < 38:
        ch = PROG[bar_i % 4]
        bright, v = (900 if sec < 6 else 1400), (0.7 if sec < 6 else 0.9)
    elif sec < 50:
        ch = DARK[bar_i % 4]
        bright, v = 700, 1.0
    elif sec < 70:
        ch = BRIGHT[bar_i % 4]
        bright, v = 1600, 0.95
    else:
        ch = PROG[bar_i % 4]
        bright, v = 1900, 1.0
    if sec >= 78:
        ch = Dm
        bright, v = 1100, 0.9
    pl, pr = pad_chord(ch, BAR + 0.4, v, bright, attack=0.5 if sec > 6 else 1.6)
    addst(pl, pr, at)

# intro sub heartbeat 0-6s
for b in range(0, 12):
    at = b * BEAT
    if at < 5.5 and b % 2 == 0:
        add(L, R, kick(0.5), at)

# --- drums ---
def drum_section(t0, t1, kick_pat, hat16=True, snare24=True, kv=1.0):
    bar0 = int(t0 / BAR)
    bar1 = int(t1 / BAR)
    for bi in range(bar0, bar1):
        base = bi * BAR
        for beat_i in range(4):
            bt = base + beat_i * BEAT
            if bt >= t1 - 1e-9 or bt < t0:
                continue
            if kick_pat[beat_i]:
                add(L, R, kick(kv), bt)
            if snare24 and beat_i in (1, 3):
                add(L, R, snare(0.9), bt)
            if hat16:
                for s16 in range(4):
                    ht = bt + s16 * BEAT / 4
                    if ht < t1:
                        v = 0.9 if s16 == 0 else 0.5
                        sig = hat(v, open_=(s16 == 2 and beat_i == 3))
                        i = int(ht * SR)
                        j = min(N, i + len(sig))
                        if i < N:
                            L[i:j] += sig[: j - i] * 0.8
                            R[i:j] += sig[: j - i] * 1.2

drum_section(6, 16, [1, 0, 1, 0], hat16=False, snare24=False, kv=0.9)   # groove enters
drum_section(16, 26, [1, 0, 1, 0], hat16=True, snare24=True, kv=0.95)   # full beat
drum_section(26, 34, [1, 1, 1, 1], hat16=True, snare24=True, kv=1.0)    # four-on-floor build
# 34-38 riser bars: kick every beat + snare roll
drum_section(34, 38, [1, 1, 1, 1], hat16=True, snare24=False, kv=1.0)
for k in range(16):
    at = 36 + k * 0.125
    if at < 38:
        add(L, R, snare(0.4 + 0.6 * k / 16), at)
# dark section 38-50: sparse heavy
drum_section(38, 50, [1, 0, 0, 1], hat16=False, snare24=True, kv=1.0)
drum_section(50, 60, [1, 0, 1, 0], hat16=True, snare24=True, kv=0.95)
drum_section(60, 78, [1, 1, 1, 1], hat16=True, snare24=True, kv=1.0)

# --- bass: root per half-bar ---
def bass_section(t0, t1, prog):
    bar0 = int(t0 / BAR)
    bar1 = int(t1 / BAR)
    for bi in range(bar0, bar1):
        base = bi * BAR
        root = prog[bi % 4][0] / 2  # one octave down
        for half in range(2):
            at = base + half * BAR / 2
            if t0 <= at < t1:
                add(L, R, bass_note(root, BAR / 2 * 0.95, 1.0), at)
                add(L, R, bass_note(root, BAR / 8, 0.6), at + BAR / 2 * 0.75)

bass_section(6, 38, PROG)
bass_section(38, 50, DARK)
bass_section(50, 70, BRIGHT)
bass_section(70, 78, PROG)

# --- arp 16ths (think-out-loud + dark tension + peak) ---
def arp_section(t0, t1, prog, octave_mult=2, vel=1.0):
    step = BEAT / 4
    k = 0
    at = t0
    while at < t1 - step:
        bar_i = int(at / BAR)
        ch = prog[bar_i % 4]
        note = ch[k % 3] * octave_mult
        add(L, R, pluck(note, step * 1.8, vel * (0.8 if k % 2 else 1.0)), at)
        k += 1
        at += step

arp_section(16, 26, PROG, 2, 0.8)
arp_section(38, 50, DARK, 1, 1.0)   # low tense arp
arp_section(60, 78, PROG, 2, 0.9)

# --- lead melody at peak (70-78) + recovery hint (50-60) ---
mel_recover = [(n2f("A", 4), 50.0, 1.5), (n2f("F", 4), 52.0, 1.5), (n2f("G", 4), 54.0, 1.5), (n2f("A", 4), 56.0, 3.0)]
for f0, at, d in mel_recover:
    add(L, R, lead(f0, d, 0.55), at)
mel_peak = [
    (n2f("D", 5), 70.0, 1.0), (n2f("C", 5), 71.0, 0.5), (n2f("A", 4), 71.5, 1.5),
    (n2f("F", 4), 73.0, 1.0), (n2f("G", 4), 74.0, 1.0), (n2f("A", 4), 75.0, 3.0),
]
for f0, at, d in mel_peak:
    add(L, R, lead(f0, d, 0.7), at)

# --- one-shots ---
riser(4.0, 34.0)        # into the shock
impact(38.0, 1.0)       # SHOCK boom (scene 5 starts exactly at 38s)
impact(78.5, 0.8)       # outro logo hit
riser(2.0, 4.0)         # small intro whoosh into roster at 6s
impact(6.0, 0.35)       # soft hit when groove starts

# --- sidechain pump against kick grid (6-78s) ---
duck = np.ones(N)
for sec0, sec1, pat in ((6, 26, [1, 0, 1, 0]), (26, 38, [1, 1, 1, 1]), (38, 50, [1, 0, 0, 1]), (50, 60, [1, 0, 1, 0]), (60, 78, [1, 1, 1, 1])):
    for bi in range(int(sec0 / BAR), int(sec1 / BAR)):
        for beat_i in range(4):
            if not pat[beat_i]:
                continue
            at = bi * BAR + beat_i * BEAT
            if at < sec0 or at >= sec1:
                continue
            i = int(at * SR)
            n = int(0.30 * SR)
            j = min(N, i + n)
            curve = 1 - 0.55 * np.exp(-np.linspace(0, 6, j - i))
            duck[i:j] = np.minimum(duck[i:j], curve)
L *= duck
R *= duck

# --- master: gentle drive, fades ---
mix_l = np.tanh(L * 1.25)
mix_r = np.tanh(R * 1.25)
fade_in = int(0.4 * SR)
mix_l[:fade_in] *= np.linspace(0, 1, fade_in)
mix_r[:fade_in] *= np.linspace(0, 1, fade_in)
fade_out = int(4.0 * SR)
mix_l[-fade_out:] *= np.linspace(1, 0, fade_out) ** 1.5
mix_r[-fade_out:] *= np.linspace(1, 0, fade_out) ** 1.5
peak = max(np.abs(mix_l).max(), np.abs(mix_r).max())
mix_l = mix_l / peak * 0.89
mix_r = mix_r / peak * 0.89

stereo = np.empty(N * 2, dtype=np.int16)
stereo[0::2] = (mix_l * 32767).astype(np.int16)
stereo[1::2] = (mix_r * 32767).astype(np.int16)
with wave.open("public/score.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(stereo.tobytes())
print("wrote public/score.wav", round(N * 4 / 1e6, 1), "MB, peak", round(float(peak), 3))
