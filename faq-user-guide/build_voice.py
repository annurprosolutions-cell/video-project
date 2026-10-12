"""Jana suara naratif (espeak-ng + mbrola Melayu) dan timeline.json.
Guna: python3 build_voice.py [speed]
Kalau ada edge-tts dan internet, set ENGINE=edge untuk suara ms-MY-YasminNeural.
"""
import json, os, subprocess, sys, wave, asyncio
import numpy as np

SR = 44100
TOTAL = 60.0
ENGINE = os.environ.get('ENGINE', 'espeak')
SPEED = sys.argv[1] if len(sys.argv) > 1 else '140'
os.makedirs('build/voice', exist_ok=True)
script = json.load(open('script.json'))

def synth(sid, text):
    raw = f'build/voice/{sid}_raw.wav'
    if ENGINE == 'edge':
        import edge_tts
        async def go():
            await edge_tts.Communicate(text, 'ms-MY-YasminNeural', rate='+0%').save(f'build/voice/{sid}.mp3')
        asyncio.run(go())
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', f'build/voice/{sid}.mp3', '-ar', str(SR), '-ac', '1', raw], check=True)
    else:
        subprocess.run(['espeak-ng', '-v', 'mb-ma1', '-s', SPEED, '-g', '3', '-w', raw, text],
                       check=True, stderr=subprocess.DEVNULL)
    out = f'build/voice/{sid}.wav'
    # bersihkan + warm EQ + normalise, buang senyap di hujung
    af = ('highpass=f=90,lowpass=f=7500,'
          'equalizer=f=250:t=q:w=1:g=2,equalizer=f=3000:t=q:w=1.2:g=2,'
          'acompressor=threshold=-20dB:ratio=3:attack=5:release=80,'
          'silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
          'silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
          'loudnorm=I=-16:TP=-1.5:LRA=7')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-af', af, '-ar', str(SR), '-ac', '1', out], check=True)
    with wave.open(out) as w:
        return w.getnframes() / w.getframerate()

durs = {}
for grp in script.values():
    for s in grp:
        durs[s['id']] = synth(s['id'], s['text'])

order = [(g, s['id']) for g, grp in script.items() for s in grp]
GAP_IN, GAP_GROUP, LEAD, TAIL = 0.35, 0.8, 0.5, 1.2
voice_total = sum(durs.values())
fixed = LEAD + TAIL + sum(GAP_IN if order[i][0] == order[i+1][0] else GAP_GROUP for i in range(len(order)-1))
print(f'voice {voice_total:.1f}s + gaps {fixed:.1f}s = {voice_total+fixed:.1f}s (sasaran {TOTAL}s)')
spare = TOTAL - voice_total - fixed
if spare < 0:
    sys.exit(f'Terlebih {-spare:.1f}s - naikkan speed atau pendekkan skrip')
# bahagikan baki masa jadi jeda tambahan antara kumpulan
ngroups = len(script) - 1
extra = spare / ngroups
t = LEAD
tl = {}
for i, (g, sid) in enumerate(order):
    tl[sid] = {'t': round(t, 3), 'd': round(durs[sid], 3), 'g': g}
    t += durs[sid]
    if i + 1 < len(order):
        t += GAP_IN if order[i+1][0] == g else GAP_GROUP + extra
json.dump({'total': TOTAL, 'seg': tl, 'text': {s['id']: s['text'] for grp in script.values() for s in grp}},
          open('build/timeline.json', 'w'), indent=1, ensure_ascii=False)
print('hujung suara', round(t, 1))
for k, v in tl.items(): print(k, v['t'], v['d'])
tl_json = open('build/timeline.json').read()
open('build/timeline.js', 'w').write('const TIMELINE = ' + tl_json + ';\n')
