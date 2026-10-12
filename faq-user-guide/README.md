# Panduan Pengguna FAQ Prompt2Claude (60s)

Video 1 minit, 1080x1920, Bahasa Melayu, ada suara + muzik latar. Untuk **pengguna** sahaja (bukan admin):
tanya soalan, lihat jawapan, bagi cadangan sistem, undi cadangan.

Hasil siap: `faq-user-guide.mp4`

## Render semula

```bash
cd faq-user-guide
npm i                         # playwright + font Space Grotesk
sudo apt-get install -y espeak-ng mbrola mbrola-ma1 ffmpeg
python3 build_voice.py 190    # jana suara + build/timeline.json (edit ayat dalam script.json)
node render.mjs frames 4      # render 1800 frame ke build/frames + build/sfx.json
python3 mix.py                # suara + sfx + muzik -> build/audio.wav
ffmpeg -framerate 30 -i build/frames/f_%05d.jpg -i build/audio.wav -c:v libx264 -pix_fmt yuv420p -crf 20 \
  -c:a aac -b:a 192k -movflags +faststart -shortest faq-user-guide.mp4
node render.mjs stills        # snapshot ke build/stills untuk semak layout
```

Suara guna espeak-ng + mbrola (offline). Kalau ada internet, `ENGINE=edge python3 build_voice.py`
guna suara `ms-MY-YasminNeural` (pip install edge-tts), lebih natural. Masa visual ikut tempoh suara secara automatik.
