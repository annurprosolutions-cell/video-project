// Ujian hujung-ke-hujung dalam Chromium. Jalankan: npm i playwright && node tests/e2e.js
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');
const SHOTS = process.env.SHOTS || '';
const shot = (pg, n) => (SHOTS ? pg.screenshot({ path: path.join(SHOTS, n + '.png') }) : null);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  await pg.addInitScript(() => {
    window.print = () => { window.__printed = document.getElementById('printArea').innerHTML; window.dispatchEvent(new Event('afterprint')); };
  });
  await pg.goto('file://' + path.resolve(__dirname, '../index.html'));
  const st = () => pg.evaluate(() => JSON.parse(JSON.stringify(UI.state)));
  const step = (m) => console.log('  ok  ' + m);

  // 1. data contoh + jana
  await pg.click('text=Muat data contoh');
  await pg.click('nav >> text=Jadual');
  await pg.click('button:has-text("Jana jadual")');
  await pg.selectOption('#gEffort', '2000');
  await pg.click('button:has-text("Mula")');
  await pg.waitForFunction(() => !document.querySelector('.overlay') && UI.lastGen, null, { timeout: 40000 });
  let s = await st();
  assert.strictEqual(s.placements.length, 243); assert.strictEqual(await pg.evaluate(() => TT.unplaced(UI.state).length), 0);
  assert.strictEqual(await pg.evaluate(() => TT.validate(UI.state).issues.filter((i) => i.sev === 'error').length), 0);
  step('jana jadual: 243/243, tiada konflik');

  // 2. seret-dan-lepas ke petak kosong
  const mv = await pg.evaluate(() => {
    const s = UI.state; const cls = UI.view.id;
    const m = TT.maps(s); const mine = s.placements.filter((p) => m.lesson.get(p.lessonId).classIds.includes(cls));
    const empties = [...document.querySelectorAll('td.cell.empty[data-day]')];
    for (const e of empties) for (const p of mine) {
      if (p.len === 1 && !p.locked && TT.checkPlacement(s, p.unit, +e.dataset.day, +e.dataset.p).ok) return { unit: p.unit, day: +e.dataset.day, p: +e.dataset.p, from: [p.day, p.start] };
    }
    return null;
  });
  assert.ok(mv, 'tiada gerakan sah ditemui');
  await pg.dragAndDrop(`td.cell.filled[data-unit="${mv.unit}"]`, `td.cell.empty[data-day="${mv.day}"][data-p="${mv.p}"]`);
  s = await st(); const moved = s.placements.find((p) => p.unit === mv.unit);
  assert.deepStrictEqual([moved.day, moved.start], [mv.day, mv.p]);
  step('seret-dan-lepas ke petak kosong');

  // 3. seret ke slot yang guru tidak boleh mengajar mesti ditolak
  await pg.selectOption('select[data-chg="viewType"]', 'teacher');
  const kmrId = await pg.evaluate(() => UI.state.teachers.find((t) => t.short === 'KMR').id);
  await pg.selectOption('select[data-chg="viewId"]', kmrId);
  const kmrUnit = await pg.evaluate(() => document.querySelector('td.cell.filled[data-unit]').dataset.unit);
  const snap = JSON.stringify((await st()).placements);
  await pg.dragAndDrop(`td.cell.filled[data-unit="${kmrUnit}"]`, 'td.cell.unav[data-day="0"][data-p="0"]');
  assert.strictEqual(JSON.stringify((await st()).placements), snap, 'jadual berubah selepas gerakan tidak sah');
  assert.ok((await pg.locator('.toast.err').allTextContents()).some((t) => t.includes('tidak boleh mengajar')));
  step('gerakan ke slot guru tidak boleh mengajar ditolak dengan mesej');
  await pg.selectOption('select[data-chg="viewType"]', 'class');

  // 4. kunci
  await pg.hover(`td.cell.filled[data-unit="${mv.unit}"]`);
  await pg.click(`td.cell.filled[data-unit="${mv.unit}"] button[data-act="lock"]`);
  s = await st(); assert.ok(s.placements.find((p) => p.unit === mv.unit).locked);
  step('kunci waktu');

  // 5. paparan guru, induk, laporan
  await pg.selectOption('select[data-chg="viewType"]', 'teacher');
  assert.ok(await pg.locator('table.grid td.cell.filled').count() > 10);
  await pg.selectOption('select[data-chg="viewType"]', 'mclass');
  assert.ok(await pg.locator('table.grid.master').count() === 1);
  await shot(pg, 'master');
  await pg.click('button[data-act="printView"]');
  await pg.waitForFunction(() => window.__printed && window.__printed.includes('Jadual Induk'));
  await pg.click('nav >> text=Laporan');
  await pg.click('button[data-act="printAll"][data-kind="class"]');
  await pg.waitForFunction(() => (window.__printed.match(/class="sheet"/g) || []).length === 9);
  step('paparan guru / induk / cetak semua kelas (9 helaian)');

  // 6. relief: tandakan guru tidak hadir pada hari Isnin
  await pg.click('nav >> text=Relief');
  await pg.fill('input[type=date][data-chg="reliefDate"]', '2026-10-26');
  await pg.dispatchEvent('input[type=date][data-chg="reliefDate"]', 'change');
  await pg.click('button[data-act="absenceAdd"]');
  const amy = await pg.evaluate(() => UI.state.teachers.find((t) => t.short === 'AMY').id);
  await pg.selectOption('#theForm select[name="teacherId"]', amy);
  await pg.click('button[data-act="formSave"]');
  const need = await pg.locator('table.relief tbody tr').count();
  assert.ok(need > 0, 'tiada keperluan relief');
  await pg.click('button[data-act="reliefAuto"]');
  s = await st();
  const assigned = s.reliefs.filter((r) => r.status === 'assigned');
  assert.strictEqual(assigned.length, need);
  assert.ok(assigned.every((r) => r.reliefTeacherId !== amy));
  await shot(pg, 'relief');
  step(`relief auto-agih: ${need} blok`);

  // tukar guru ganti secara manual melalui dropdown
  const sel = pg.locator('table.relief tbody tr').first().locator('select');
  await sel.selectOption('kendiri');
  s = await st(); assert.ok(s.reliefs.some((r) => r.status === 'kendiri'));
  step('tukar manual ke kelas kendiri');
  await pg.click('button[data-act="reliefAuto"]');

  // slip dan WhatsApp
  await pg.click('button[data-act="reliefPrint"]');
  await pg.waitForFunction(() => window.__printed.includes('SLIP GURU GANTI'));
  await pg.click('button[data-act="reliefMsg"]');
  const msg = await pg.inputValue('#waText'); assert.ok(msg.includes('26/10/2026') && msg.includes('Aminah Yusof'));
  await pg.click('.dlg-f >> text=Tutup');
  step('slip cetak + mesej WhatsApp');

  // cuti berbilang hari melangkau hujung minggu
  await pg.click('button[data-act="absenceAdd"]');
  const kmr = await pg.evaluate(() => UI.state.teachers.find((t) => t.short === 'KMR').id);
  await pg.selectOption('#theForm select[name="teacherId"]', kmr);
  await pg.fill('#theForm input[name="date"]', '2026-10-30'); await pg.fill('#theForm input[name="dateTo"]', '2026-11-03');
  await pg.click('button[data-act="formSave"]');
  s = await st();
  assert.deepStrictEqual(s.absences.filter((a) => a.teacherId === kmr).map((a) => a.date).sort(), ['2026-10-30', '2026-11-02', '2026-11-03']);
  step('cuti 30/10-03/11 melangkau Sabtu dan Ahad');

  // statistik
  await pg.click('button[data-act="reliefTab"][data-t="statistik"]');
  await pg.fill('input[data-chg="relFrom"]', '2026-10-01'); await pg.dispatchEvent('input[data-chg="relFrom"]', 'change');
  await pg.fill('input[data-chg="relTo"]', '2026-11-30'); await pg.dispatchEvent('input[data-chg="relTo"]', 'change');
  assert.ok(await pg.locator('table.tbl tbody tr').count() >= 18);
  await shot(pg, 'stats');
  step('statistik kesaksamaan');

  // 7. data: tambah guru, pelajaran, padam, tetapan
  await pg.click('nav >> text=Data');
  await pg.click('button[data-act="add-guru"]');
  await pg.fill('#theForm input[name="name"]', 'Cikgu Ujian Baharu');
  await pg.click('#theForm td.av[data-k="0-0"]');
  await pg.click('button[data-act="formSave"]');
  s = await st(); const nt = s.teachers.find((t) => t.name === 'Cikgu Ujian Baharu');
  assert.ok(nt && nt.short && nt.unavailable['0-0']);
  await pg.click('button[data-act="dataTab"][data-t="pelajaran"]');
  const nLessons = (await st()).lessons.length;
  await pg.click('button[data-act="add-pelajaran"]');
  await pg.click('[data-wz-cls]:first-of-type >> nth=0');
  await pg.click('button[data-act="wzSave"]');
  s = await st(); assert.strictEqual(s.lessons.length, nLessons + 1);
  step('tambah guru (dengan slot tak boleh) dan pelajaran');

  await pg.click('nav >> text=Tetapan');
  await pg.selectOption('select[data-chg="weekMode"]', 'sun-thu');
  assert.strictEqual((await st()).school.weekMode, 'sun-thu');
  await pg.selectOption('select[data-chg="weekMode"]', 'mon-fri');
  step('tukar minggu Ahad-Khamis dan balik');

  // 8. eksport / import JSON bulat
  const json = await pg.evaluate(() => JSON.stringify(UI.state));
  await pg.evaluate((j) => { localStorage.clear(); UI.state = TT.migrate(JSON.parse(j)); UI.commit(); }, json);
  await pg.reload();
  assert.strictEqual((await st()).teachers.length, JSON.parse(json).teachers.length);
  step('data kekal selepas muat semula halaman');

  assert.deepStrictEqual(errors, []);
  console.log('SEMUA UJIAN E2E LULUS');
  await b.close();
})().catch((e) => { console.error('GAGAL:', e); process.exit(1); });
