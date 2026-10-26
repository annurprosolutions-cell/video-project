"""Audio latar 60s: pad + beat + whoosh + tick setiap kad -> assets/bed.wav"""
import numpy as np, wave
SR=44100; D=60; n=SR*D; t=np.arange(n)/SR
rng=np.random.default_rng(11); out=np.zeros(n)
bpm=112; beat=60/bpm
ch=[(220,261.6,329.6),(174.6,220,261.6),(261.6,329.6,392),(196,246.9,293.7)]
for i in range(int(D/beat/4)+1):
    c=ch[i%4]; s=int(i*beat*4*SR); e=min(n,s+int(beat*4*SR)); L=e-s
    if L<=0: break
    tt=np.arange(L)/SR; env=np.minimum(1,tt/.4)*np.minimum(1,(L/SR-tt)/.5)
    for f in c: out[s:e]+=0.05*np.sin(2*np.pi*f*tt)*env*(1+.15*np.sin(2*np.pi*5*tt))
for i in range(int(D/beat)):
    ts=i*beat
    if ts<3.0 or ts>59: continue
    s=int(ts*SR);L=int(.25*SR);tt=np.arange(L)/SR
    out[s:s+L]+=0.34*np.sin(2*np.pi*(120*np.exp(-tt*22)+45)*tt)*np.exp(-tt*9)
    h=int((ts+beat/2)*SR);Lh=int(.05*SR)
    out[h:h+Lh]+=0.05*rng.standard_normal(Lh)*np.exp(-np.arange(Lh)/SR*90)
def whoosh(c,dur=.55,g=.17):
    s=int((c-dur*.7)*SR);L=int(dur*SR);tt=np.arange(L)/SR
    k=np.convolve(rng.standard_normal(L),np.ones(40)/40,'same'); out[s:s+L]+=g*k*np.sin(np.pi*tt/dur)**2
FLY_END=37.0
for c in (3.2,4.4,FLY_END+.3,41.9,49.3): whoosh(c)
# tick setiap kad (kunci tengah slot)
tt0=5.0
for k,ph in enumerate([0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1]):
    d=2.0 if ph else 1.2; c=tt0+d/2; tt0+=d
    s=int(c*SR);L=int(.12*SR);x=np.arange(L)/SR
    f=880*(1.5 if ph else 1)*(1+.02*(k%5))
    out[s:s+L]+=0.09*np.sin(2*np.pi*f*x)*np.exp(-x*38)
# riser sebelum strip mengecut
s=int(35.4*SR);L=int(1.9*SR);x=np.arange(L)/SR
out[s:s+L]+=0.05*np.sin(2*np.pi*(300+500*(x/1.9)**2)*x)*(x/1.9)
s=int(49.4*SR);L=int(1.2*SR);x=np.arange(L)/SR
out[s:s+L]+=0.3*np.sin(2*np.pi*(80*np.exp(-x*3)+40)*x)*np.exp(-x*3)
out*=np.minimum(1,(D-t)/1.5); out=out/np.max(np.abs(out))*.8
w=wave.open('assets/bed.wav','wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR)
w.writeframes((out*32767).astype(np.int16).tobytes());w.close()
