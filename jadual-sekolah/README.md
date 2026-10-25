# Jadual Sekolah

Penjana jadual waktu sekolah (macam Winjaws / aSc TimeTables) dengan modul guru ganti (relief) harian. Web app biasa, tiada server dan tiada dependency. Data disimpan dalam pelayar.

## Cara guna

Buka `index.html` terus dalam Chrome, Edge atau Firefox. Tak perlu install apa-apa.

1. **Utama**: tekan "Muat data contoh" untuk cuba (18 guru, 9 kelas, 243 waktu), atau "Mula kosong".
2. **Tetapan**: Isnin-Jumaat atau Ahad-Khamis, waktu dan rehat, bilangan waktu Jumaat.
3. **Data**: subjek, guru, kelas, bilik, kemudian pelajaran. Tambah ramai sekaligus dengan tampal dari Excel.
4. **Jadual**: tekan "Jana jadual". Lepas tu laras dengan seret-dan-lepas, kunci waktu yang tak boleh berubah, dan cetak.
5. **Relief**: tandakan guru tidak hadir, sistem cadangkan guru ganti.

Eksport JSON (halaman Utama) untuk backup atau pindah ke komputer lain.

## Ciri

**Penjana jadual**
- Peraturan tetap: guru, kelas dan bilik tak bertindih; guru tak diletak pada slot "tidak boleh mengajar"; waktu berganda tak melintasi rehat; had waktu sehari guru; had pelajaran sama sehari setiap kelas.
- Peraturan lembut (dioptimumkan): kurangkan waktu kosong guru dan kelas, sebar pelajaran merentas hari, subjek berat di waktu pagi, imbang beban harian guru.
- Pelajaran gabungan serentak, contoh Pendidikan Islam / Moral: satu pelajaran, beberapa kelas, beberapa guru mengajar pada masa sama.
- Kunci waktu, jana semula selebihnya. Mod "kekalkan susunan semasa" untuk isi yang belum diletak sahaja.
- Waktu yang tak dapat diletak dilaporkan dengan sebab (cth "guru kosong 1 slot, kelas kosong 0 slot, tiada yang sama").
- Semakan awal sebelum jana: guru yang bebannya melebihi kapasiti sebenar (termasuk had harian dan slot tak boleh), kelas atau bilik yang melebihi slot.

**Edit manual**
- Seret waktu ke petak lain. Petak sah ditunjuk hijau. Kalau petak diduduki satu waktu lain, sistem cuba tukar tempat.
- Paparan: kelas, guru, bilik, induk semua kelas, induk semua guru.
- Konflik ditunjuk merah dan disenaraikan di halaman Laporan.

**Relief (guru ganti)**
- Catat guru tidak hadir: sehari penuh, waktu tertentu, atau julat tarikh (hujung minggu dilangkau).
- Sistem kira waktu yang terjejas daripada jadual guru itu pada hari berkenaan. Waktu berganda dikendalikan sebagai satu blok supaya seorang guru ganti pegang kedua-duanya.
- Calon mesti kosong pada waktu itu, tidak turut tidak hadir, tidak sudah ada relief lain waktu yang sama, dan belum melebihi had relief sehari.
- Calon diskor: bonus subjek sama, panitia sama, mengajar kelas itu, guru kelas, sambung kelas yang sama; penalti untuk relief bulan ini, relief keseluruhan, relief hari ini dan beban mengajar. Semua pemberat boleh diubah di Tetapan.
- "Agih automatik" mula dengan blok yang calonnya paling sedikit. Anda boleh tukar mana-mana pilihan secara manual, atau pilih "kelas kendiri" / "gabung kelas".
- Cetak slip guru ganti (ringkasan harian + slip setiap guru), salin mesej WhatsApp, statistik kesaksamaan (purata, sisihan piawai, siapa lebih daripada purata), sejarah dan eksport CSV.
- Guru tertentu (cth pentadbir) boleh dikecualikan daripada relief.

**Cetak**: satu jadual, semua kelas, semua guru, semua bilik, atau induk. Guna "Save as PDF" dalam dialog cetak untuk dapatkan PDF.

## Susunan kod

```
index.html
css/app.css
js/core.js         model data, semakan (validate / precheck), alih waktu (applyMove)
js/engine.js       penjana jadual
js/relief.js       logik relief: keperluan, calon, agihan, statistik, mesej
js/sample.js       data contoh SMK
js/ui-*.js, app.js antara muka
tests/             ujian unit (Node) dan e2e (Playwright)
```

### Cara penjana berfungsi

Fasa 1 meletakkan setiap unit (satu waktu, atau satu pasang waktu berganda) pada slot terbaik. Kalau semua slot sah sudah diduduki, ia menolak keluar unit yang menghalang, letak unit baharu, dan letak semula unit yang ditolak kemudian. Had waktu sehari guru pun diselesaikan dengan cara sama. Fasa 2 ialah simulated annealing: alih satu unit atau tukar dua unit, terima kalau kos lembut turun (atau naik sedikit pada awal), dan tak pernah melanggar peraturan tetap. Pengoptimuman 2, 6 atau 20 saat boleh dipilih.

Untuk data contoh, 6 saat mengurangkan waktu kosong guru dari 120 ke sekitar 30.

## Ujian

```bash
npm test                          # 20 ujian unit, tanpa dependency
npm i playwright && npm run test:e2e   # klik seluruh aliran dalam Chromium
```

Ujian unit merangkumi: jadual sah merentas beberapa seed, waktu dikunci dikekalkan, slot tak boleh dihormati, data mustahil dilapor dengan sebab, seret-dan-lepas rawak tak merosakkan jadual, calon relief tak pernah bertindih, dan simulasi relief sebulan (20 hari, 241 waktu) yang tersebar dengan sisihan piawai di bawah 2.5.

Penjana juga diuji secara manual dengan sekolah 24 kelas / 30 guru yang setiap kelas penuh 38/38 waktu dan guru dimuatkan sehingga 33 waktu. Semua waktu diletak.

## Had semasa

Jujur, ini belum menyamai Winjaws atau aSc dari segi ciri:

- Data dalam pelayar sahaja (localStorage). Tiada pelayan, tiada akaun, tiada penyuntingan serentak oleh ramai orang. Kongsi dengan eksport / import JSON.
- Setiap pelajaran guna satu bilik tetap. Tiada "mana-mana makmal yang kosong".
- Tiada kumpulan murid atau blok pilihan (elective) selain pelajaran gabungan serentak.
- Tiada import terus daripada fail Winjaws atau aSc. Tambah ramai hanya melalui tampal teks.
- Sekolah dua sesi (pagi / petang): buat satu fail JSON bagi setiap sesi.
- Penjana ialah heuristik, bukan bukti optimum. Data yang sangat ketat boleh tinggalkan beberapa waktu belum diletak (dilaporkan dengan sebab, dan boleh disiapkan dengan seret manual).
- Relief tidak menghantar mesej sendiri. Mesej WhatsApp disalin dan ditampal secara manual.
- Hanya satu jadual aktif. Tiada versi jadual berasingan (cth penggal 1 dan penggal 2) selain eksport JSON berasingan.
