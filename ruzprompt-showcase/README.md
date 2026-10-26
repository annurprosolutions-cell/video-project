# RuzPrompt: Setahun Vibe Coding (versi showcase 3D)

Video jualan 60 saat (1080x1920). Konsep: strip screenshot sistem sebenar disusun menegak, kamera condong terbang melepasi setiap projek (depth blur di bawah), strip mengecut jadi garis nipis, headline ditaip, dan scene akhir muka + RuzPrompt. Gambar training jadi selingan dalam strip yang sama.

- `showcase.html`: semua scene dan kamera (`setT(t)` deterministik; edit teks/timing di sini)
- `shots.cjs`: ambil screenshot setiap sistem (Playwright, fail disajikan melalui route interception, tiada server dibuka). Perlu `build` dahulu untuk erph, ragnarokmath, ammartraveldraft
- `bina-audio.py`: jana `assets/bed.wav`
- `render.cjs`: render selari (4 worker) lalu concat

```bash
python3 bina-audio.py
node render.cjs full silent.mp4 4
ffmpeg -i silent.mp4 -i assets/bed.wav -c:v copy -c:a aac -shortest ruzprompt-showcase.mp4
node render.cjs stills x 5 12 30 41   # semak layout
```

`ruzprompt.my/demo` ialah dummy. Screenshot app diambil dalam mod demo / skrin log masuk; tiada data sebenar pengguna.
