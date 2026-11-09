# Video Project

Koleksi video explainer. Setiap video ada folder sendiri: fail MP4 siap, source HTML dan script render.

| Video | Tempoh | Format |
|---|---|---|
| [dashboard-scroll](dashboard-scroll/) — portfolio 10 dashboard, gaya stack 3D scroll, stop dan zoom, hujung CTA RuzPrompt | 108s | 1080x1920 (Reels/TikTok) |
| [dashboard-portfolio](dashboard-portfolio/) — portfolio 10 dashboard (PBD, safety, yuran, zakat, permohonan, kelab, aduan, takaful, direktori, SaaS) | 60s | 1080x1920 (Reels/TikTok) |
| [dashboard-pbd-teaser](dashboard-pbd-teaser/) — semua fungsi Dashboard Analisis PBD 2.0 (login, filter, carta, radar, heatmap, edit data, urus pengguna) | 60s | 1080x1920 (Reels/TikTok) |
| [claude-modes-explainer](claude-modes-explainer/) — beza Chat, Cowork, Artifact, Design, Claude Code, Schedule | 60s | 1080x1920 (Reels/TikTok) |

## Render semula

```bash
cd claude-modes-explainer
npm i playwright
node render.mjs full claude-modes.mp4   # perlukan ffmpeg
node render.mjs stills                  # snapshot ke stills/ untuk semak layout
```

Edit teks, warna atau timing dalam `claude-modes.html` (atribut `data-s` = masa mula babak, `data-d` = tempoh).

`dashboard-pbd-teaser` guna cara yang sama (`node render.mjs full dashboard-pbd.mp4`, `node render.mjs stills`). Semua data dalam video ialah dummy.

`dashboard-portfolio` render: `node render.mjs full portfolio.mp4` (lebih kurang 5 minit). Semua data dummy; dashboard kematian, politik dan borang client sengaja tidak dimasukkan.

`dashboard-scroll` render selari 4 proses: `PLAYWRIGHT_PATH=<path playwright> ./dashboard-scroll/build.sh` (lebih kurang 2.5 minit, perlukan ffmpeg). `render.mjs stills` untuk semak layout. Photo CTA (`photo.png`) dicrop daripada video reference.
