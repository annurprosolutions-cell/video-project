# Sekadar Kehilangan — video muzik + lirik (TikTok 9:16)

Video penuh 2:43 untuk lagu "Sekadar Kehilangan", 1080x1920 @ 30fps, H.264 + AAC. Semua visual dijana secara procedural (shader WebGL + lukisan canvas), tiada stok footage. Semua watak berpakaian menutup aurat: khimar labuh dan jubah longgar hingga ke lantai, telekung, jubah berkopiah.

## Babak

| Masa | Lirik | Babak |
|---|---|---|
| 0:00 | Intro, "Bila ku rasa hati ini kosong" | Bukit berkabus sebelum subuh, wanita di puncak |
| 0:16 | "Ku fikir aku kehilangan" | Hujan di tingkap, wanita duduk merenung |
| 0:27 | "Ku lupa segalanya milik Tuhan" | Jejak kaki di pantai, dihapus ombak pada "Tiada yang kekal" |
| 0:38 | Korus 1 | Berjalan di batas sawah waktu senja, burung bangau |
| 0:54 | "Bukan miliki…" hingga "Hanya cinta Ilahi" | Jeti tasik, senja ke malam, pelita |
| 1:13 | "Tangisan tak ubah apa pun jalan" | Hujan malam dan kilat, rumah kampung |
| 1:19 | "Tapi sujud buat aku tenang" | Sujud bertelekung di surau, cahaya pelita |
| 1:25 | "Yang ku kira ujian…" | Ribut reda, pelangi |
| 1:36 | "Bila aku redha…" | Hutan berkabus, sinar cahaya |
| 1:45 | "Dan yang tinggal adalah ujian…" | Ayah dan anak berjalan ke masjid sebelum subuh |
| 1:53 | Korus 2 | Terbang atas hutan hujan dan sungai, burung enggang |
| 2:04 | "Bukan noktah…" | Tebing laut waktu senja |
| 2:18 | Doa Nabi Yunus (1) | Paus dalam lautan dalam |
| 2:24 | Doa Nabi Yunus (2) | Pantai malam, Bima Sakti, berdoa bertelekung |
| 2:30 | "Hatiku redha…" | Matahari terbit atas bukit berkabus, penutup |

## Fail

- `index.html` + `js/` — enjin: `landscape.js` (shader bukit/air/sawah/langit), `scenes-*.js` (babak), `figures.js` (watak), `props.js` (jeti, masjid, rumah kampung, pelita, paus…), `lyrics.js` (lirik perkataan demi perkataan), `timeline.js` (susunan babak dan masa potongan).
- `lyrics.json` — lirik dan masa setiap perkataan. Edit di sini kalau ada perkataan yang salah, kemudian render semula.
- `render.mjs`, `render-all.sh` — render guna Playwright + Chromium + ffmpeg.

## Render semula

Letak lagu di `audio/song.mp3` (tidak disimpan dalam repo), kemudian:

```bash
cd sekadar-kehilangan
mkdir -p node_modules && ln -s "$(npm root -g)/playwright" node_modules/playwright
node render.mjs stills 8,45,90,147      # semak beberapa frame dalam stills/
./render-all.sh 2                       # render 15 segmen (2 proses selari) + gabung dengan audio
./render-all.sh 2 7 8                   # render semula segmen tertentu sahaja, kemudian gabung
```

Segmen `i` bermula di hujung peralihan masuk ke babak `i` dan berakhir di hujung peralihan keluar, jadi bila satu babak diubah, render semula segmen itu dan segmen sebelumnya.

## Nota lirik

Lirik ditranskrip daripada audio (vokal diasingkan, kemudian Whisper). Baris yang paling tidak pasti: "Bila ku rasa hati ini kosong", "Bukan miliki, sekadar kehilangan", "Jika tiada milik dari mula", "Apa yang patut aku susahkan?". Betulkan dalam `lyrics.json` kalau perlu.
