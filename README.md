# Video Project

Koleksi video explainer. Setiap video ada folder sendiri: fail MP4 siap, source HTML dan script render.

| Video | Tempoh | Format |
|---|---|---|
| [claude-modes-explainer](claude-modes-explainer/) — beza Chat, Cowork, Artifact, Design, Claude Code, Schedule | 60s | 1080x1920 (Reels/TikTok) |
| [eperolehan-promo](eperolehan-promo/) — marketing + cara guna sistem E-Perolehan (tracking kerja), semua data dummy | 87s | 1920x1080 (landskap) |

## Render semula

```bash
cd claude-modes-explainer
npm i playwright
node render.mjs full claude-modes.mp4   # perlukan ffmpeg
node render.mjs stills                  # snapshot ke stills/ untuk semak layout
```

Edit teks, warna atau timing dalam `claude-modes.html` (atribut `data-s` = masa mula babak, `data-d` = tempoh).

### eperolehan-promo

```bash
cd eperolehan-promo
npm i playwright
node render.mjs full eperolehan-promo.mp4   # perlukan ffmpeg, ~4 minit
node render.mjs stills 20,45,66             # snapshot ke stills/ pada saat tertentu
```

UI sistem direplika dalam `eperolehan.html` (tiada pautan sebenar, semua data contoh). Timeline ditulis sebagai saat mutlak dalam skrip: `TABAT` (tukar tab), `MOD` (modal), `FS` (isian borang), `CAPS` (kapsyen), `KF` (pergerakan cursor), `CLICKS`. Tukar `DUR` dalam `render.mjs` kalau ubah panjang video (maksimum 90s).
