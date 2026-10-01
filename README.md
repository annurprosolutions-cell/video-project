# Video Project

Koleksi video explainer. Setiap video ada folder sendiri: fail MP4 siap, source HTML dan script render.

| Video | Tempoh | Format |
|---|---|---|
| [claude-modes-explainer](claude-modes-explainer/) — beza Chat, Cowork, Artifact, Design, Claude Code, Schedule | 60s | 1080x1920 (Reels/TikTok) |
| [prompt2claude-promo](prompt2claude-promo/) — promosi webinar Prompt2Claude (Pemula), RM50, 17 & 18 Okt 2026 | 30s | 1080x1920 (Reels/TikTok) |

## Render semula

```bash
cd claude-modes-explainer
npm i playwright
node render.mjs full claude-modes.mp4   # perlukan ffmpeg
node render.mjs stills                  # snapshot ke stills/ untuk semak layout
```

Edit teks, warna atau timing dalam `claude-modes.html` (atribut `data-s` = masa mula babak, `data-d` = tempoh).

Untuk promo Prompt2Claude:

```bash
cd prompt2claude-promo
npm i playwright
node render.mjs full prompt2claude-promo.mp4
node render.mjs stills
```

Screenshot demo dalam `prompt2claude-promo/shots/` diambil dari repo prompt2dashboard, eduRuz dan videotentangui.
