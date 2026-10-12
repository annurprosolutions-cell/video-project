# Video Project

Koleksi video explainer. Setiap video ada folder sendiri: fail MP4 siap, source HTML dan script render.

| Video | Tempoh | Format |
|---|---|---|
| [claude-modes-explainer](claude-modes-explainer/) — beza Chat, Cowork, Artifact, Design, Claude Code, Schedule | 60s | 1080x1920 (Reels/TikTok) |
| [faq-user-guide](faq-user-guide/) — panduan pengguna FAQ Prompt2Claude (tanya soalan, cadangan, undi), suara BM | 60s | 1080x1920 |

## Render semula

```bash
cd claude-modes-explainer
npm i playwright
node render.mjs full claude-modes.mp4   # perlukan ffmpeg
node render.mjs stills                  # snapshot ke stills/ untuk semak layout
```

Edit teks, warna atau timing dalam `claude-modes.html` (atribut `data-s` = masa mula babak, `data-d` = tempoh).
