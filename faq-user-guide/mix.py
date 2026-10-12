"""Mix suara + kesan bunyi + muzik latar -> build/audio.wav"""
import json, wave, subprocess
import numpy as np

SR = 44100
tl = json.load(open('build/timeline.json'))
sfx = json.load(open('build/sfx.json'))
TOTAL = tl['total']
N = int(SR * TOTAL)
rng = np.random.default_rng(7)

def load(path):
    with wave.open(path) as w:
        d = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return d

def put(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i < 0 or i >= len(buf): return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[:j - i] * gain

t_ = lambda d: np.arange(int(SR * d)) / SR

# ---------- suara ----------
voice = np.zeros(N, np.float32)
for sid, s in tl['seg'].items():
    put(voice, load(f'build/voice/{sid}.wav'), s['t'], 1.0)

# ---------- SFX ----------
def env(n, a=0.002, r=0.05):
    e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    e *= np.exp(-np.arange(n) / (r * SR)); return e
def bp_noise(d, lo, hi):
    n = rng.standard_normal(int(SR * d)); f = np.fft.rfft(n); fr = np.fft.rfftfreq(len(n), 1 / SR)
    f[(fr < lo) | (fr > hi)] = 0; return np.fft.irfft(f, len(n)).astype(np.float32)
def click():
    a = bp_noise(.03, 1500, 6000) * env(int(SR * .03), .0005, .006)
    b = np.sin(2 * np.pi * 900 * t_(.04)) * env(int(SR * .04), .0005, .012) * .5
    up = np.zeros(int(SR * .09)); up[int(SR * .07):] = 0
    r = bp_noise(.02, 2500, 8000) * env(int(SR * .02), .0003, .004) * .5
    out = np.zeros(int(SR * .1), np.float32); out[:len(a)] += a * .8; out[:len(b)] += b
    out[int(SR * .06):int(SR * .06) + len(r)] += r; return out * .55
def typ():
    f = rng.uniform(1600, 2600)
    n = bp_noise(.02, f, f + 2500) * env(int(SR * .02), .0003, .004)
    return n * .22
def ding():
    out = np.zeros(int(SR * .7), np.float32)
    for f, st, g in [(1046.5, 0, 1.0), (1568.0, .09, .8)]:
        d = t_(.6); s = (np.sin(2 * np.pi * f * d) + .25 * np.sin(2 * np.pi * 2 * f * d)) * env(len(d), .004, .16) * g
        i = int(st * SR); out[i:i + len(s)] += s
    return out * .22
def pop():
    d = t_(.12); f = 420 + 700 * (d / .12)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(d), .002, .035)).astype(np.float32) * .3
def whoosh():
    d = .55; n = rng.standard_normal(int(SR * d)).astype(np.float32); out = np.zeros_like(n)
    # sapuan band-pass
    seg = 8; L = len(n) // seg
    for k in range(seg):
        c = 500 + 2600 * np.sin(np.pi * (k + .5) / seg)
        part = n[k * L:(k + 1) * L]; f = np.fft.rfft(part); fr = np.fft.rfftfreq(len(part), 1 / SR)
        f[(fr < c * .6) | (fr > c * 1.5)] = 0; out[k * L:(k + 1) * L] = np.fft.irfft(f, len(part))
    sh = np.sin(np.pi * np.arange(len(out)) / len(out)) ** 2
    return out * sh * .55
def swipe():
    return whoosh()[:int(SR * .3)] * .6
MAKE = {'click': click, 'type': typ, 'ding': ding, 'pop': pop, 'whoosh': whoosh, 'swipe': swipe}
GAIN = {'click': .9, 'type': 1, 'ding': 1, 'pop': .8, 'whoosh': .5, 'swipe': .45}
sfxb = np.zeros(N, np.float32)
for e in sfx:
    put(sfxb, MAKE[e['k']](), e['t'], GAIN[e['k']])

# ---------- muzik latar (lofi lembut) ----------
BPM = 84; beat = 60 / BPM
def note(f, d, a=.01, r=.4, harm=(1, .3, .1)):
    tt = t_(d); s = sum(g * np.sin(2 * np.pi * f * (k + 1) * tt) for k, g in enumerate(harm))
    e = np.minimum(1, tt / a) * np.exp(-tt / r); return (s * e).astype(np.float32)
def pad(f, d):
    tt = t_(d); s = (np.sin(2 * np.pi * f * tt) + np.sin(2 * np.pi * f * 1.003 * tt) + .5 * np.sin(2 * np.pi * f * .997 * tt)) / 2.5
    e = np.minimum(1, tt / .5) * np.minimum(1, (d - tt) / .6); return (s * e).astype(np.float32)
mf = lambda m: 440 * 2 ** ((m - 69) / 12)
prog_ = [([48, 55, 59, 64], 36), ([45, 52, 60, 64], 33), ([41, 48, 57, 64], 29), ([43, 50, 59, 62], 31)]  # Cmaj7, Am7, Fmaj7, G
music = np.zeros(N, np.float32)
bar = 4 * beat; nb = int(TOTAL / bar) + 2
for b in range(nb):
    chord, bass = prog_[b % 4]; t0 = b * bar
    for m in chord: put(music, pad(mf(m), bar + .3), t0, .10)
    put(music, note(mf(bass), bar * .5, .01, .5, (1, .2)), t0, .35)
    put(music, note(mf(bass), bar * .4, .01, .5, (1, .2)), t0 + bar * .5, .22)
    arp = [chord[1], chord[2], chord[3], chord[2] + 12, chord[3], chord[2], chord[1] + 12, chord[2]]
    for i, m in enumerate(arp):
        put(music, note(mf(m + 12), beat, .004, .22, (1, .2)), t0 + i * beat / 2, .09)
    # hi-hat halus
    for i in range(8):
        h = bp_noise(.04, 6000, 12000) * env(int(SR * .04), .0005, .01)
        put(music, h, t0 + i * beat / 2 + (beat / 4 if i % 2 else 0), .035 if i % 2 else .02)
# lowpass muzik ringan + reverb ringkas
f = np.fft.rfft(music); fr = np.fft.rfftfreq(N, 1 / SR); f *= 1 / (1 + (fr / 3800) ** 4); music = np.fft.irfft(f, N).astype(np.float32)
# ducking bawah suara
ve = np.abs(voice); k = int(SR * .12); ve = np.convolve(ve, np.ones(k) / k, 'same'); ve = np.clip(ve / (np.percentile(ve, 95) + 1e-6), 0, 1)
duck = 1 - .6 * ve; k2 = int(SR * .25); duck = np.convolve(duck, np.ones(k2) / k2, 'same')
fade = np.minimum(1, np.arange(N) / (SR * 1.0)) * np.minimum(1, (N - np.arange(N)) / (SR * 2.2))
music = music * duck * fade * 1.0

mix = voice * 1.0 + sfxb * .8 + music * .55
# simpan stereo sedikit lebar: muzik/sfx kiri-kanan berbeza halus
dly = int(SR * .012)
L = mix.copy(); R = mix.copy(); R[dly:] = mix[:-dly] * .0 + voice[:-dly] + (sfxb[:-dly] * .8) + (music[:-dly] * .55)
L = voice + sfxb * .8 + music * .55
st = np.stack([L, R], 1)
peak = np.abs(st).max(); st = st / peak * .89
with wave.open('build/audio_raw.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', 'build/audio_raw.wav', '-af',
                'loudnorm=I=-15:TP=-1.5:LRA=9,afade=t=out:st=%.2f:d=1.0' % (TOTAL - 1.0), 'build/audio.wav'], check=True)
print('audio siap', TOTAL, 's')
