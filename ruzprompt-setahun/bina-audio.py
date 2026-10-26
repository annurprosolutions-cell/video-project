"""Jana audio latar 60s (pad + beat + whoosh pada setiap tukar scene) -> assets/bed.wav"""
import numpy as np, wave
SR=44100; D=60; n=SR*D; t=np.arange(n)/SR
rng=np.random.default_rng(7)
out=np.zeros(n)
bpm=104; beat=60/bpm
# pad: Am - F - C - G, 4 beat setiap chord
ch=[(220,261.6,329.6),(174.6,220,261.6),(261.6,329.6,392),(196,246.9,293.7)]
for i in range(int(D/beat)+1):
    c=ch[(i//4)%4]; s=int(i*beat*SR); e=min(n,s+int(beat*4*SR)) if i%4==0 else None
    if e:
        L=e-s; tt=np.arange(L)/SR
        env=np.minimum(1,tt/.4)*np.minimum(1,(L/SR-tt)/.5)
        for f in c: out[s:e]+=0.05*np.sin(2*np.pi*f*tt)*env*(1+.15*np.sin(2*np.pi*5*tt))
# kick + hat mulai 4.5s
for i in range(int(D/beat)):
    ts=i*beat
    if ts<4.0 or ts>59: continue
    s=int(ts*SR);L=int(.25*SR);tt=np.arange(L)/SR
    out[s:s+L]+=0.38*np.sin(2*np.pi*(120*np.exp(-tt*22)+45)*tt)*np.exp(-tt*9)
    h=int((ts+beat/2)*SR);Lh=int(.05*SR)
    out[h:h+Lh]+=0.05*rng.standard_normal(Lh)*np.exp(-np.arange(Lh)/SR*90)
# whoosh pada tukar scene
cuts=[];tt0=4.0
for k in range(8):
    cuts.append(tt0);tt0+=3.3
    if k%2==1: cuts.append(tt0);tt0+=2.4
cuts+= [tt0,tt0+6.4,tt0+12.0]; cuts=[0.0]+cuts
for c in cuts[1:]:
    s=int((c-.35)*SR);L=int(.5*SR);tt=np.arange(L)/SR
    nz=rng.standard_normal(L);k=np.convolve(nz,np.ones(40)/40,'same')
    out[s:s+L]+=0.16*k*np.sin(np.pi*tt/.5)**2
# letupan akhir
s=int((cuts[-1]+.1)*SR);L=int(1.2*SR);tt=np.arange(L)/SR
out[s:s+L]+=0.3*np.sin(2*np.pi*(80*np.exp(-tt*3)+40)*tt)*np.exp(-tt*3)
out*=np.minimum(1,(D-t)/1.5)  # fade out
out=out/np.max(np.abs(out))*.8
w=wave.open('assets/bed.wav','wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR)
w.writeframes((out*32767).astype(np.int16).tobytes());w.close()
