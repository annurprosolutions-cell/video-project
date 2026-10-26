# RuzPrompt: Setahun Vibe Coding

Video jualan 60 saat (1080x1920, TikTok/Reels) yang tunjuk 20 projek, ayat motivasi setiap scene, dan scene akhir dengan muka + RuzPrompt.

- `ruzprompt.html`: semua scene (edit teks/timing di sini; `--t` = saat mula, `--d` = tempoh)
- `bina-audio.py`: jana `assets/bed.wav` (pad + beat + whoosh)
- `render.cjs`: render frame guna Playwright, encode ffmpeg

```bash
python3 bina-audio.py
node render.cjs full silent.mp4
ffmpeg -i silent.mp4 -i assets/bed.wav -c:v copy -c:a aac -shortest ruzprompt-setahun.mp4
node render.cjs stills   # snapshot semak layout
```

Data dalam kad (RM 3,480, 482 aset, 124 staf dll), link `ruzprompt.my/demo` ialah **dummy** (nombor WhatsApp 011-2087 9149 ialah nombor sebenar). Tukar sebelum siar.
