(function () {
  'use strict';
  const { esc, actions, changes, pages } = UI;
  const S = () => UI.state;
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

  // ---------------- UTAMA ----------------
  pages.utama = () => {
    const s = S(), pre = TT.precheck(s), un = TT.unplaced(s).length, total = TT.buildUnits(s).length;
    const v = TT.validate(s), errs = v.issues.filter((i) => i.sev === 'error').length;
    const empty = !s.teachers.length && !s.classes.length;
    const card = (n, l, go) => `<button class="stat" data-act="goto" data-p="${go[0]}" data-t="${go[1] || ''}"><b>${n}</b><span>${l}</span></button>`;
    return `<section class="hero">
      <h1>Jadual Sekolah</h1>
      <p>Jana jadual waktu secara automatik, edit dengan seret-dan-lepas, dan urus guru ganti (relief) harian dalam satu tempat. Semua data disimpan dalam pelayar ini.</p>
      <div class="row">
        <button class="btn primary" data-act="loadSample">Muat data contoh (SMK Contoh Jaya)</button>
        <button class="btn" data-act="newBlank">Mula kosong</button>
        <button class="btn" data-act="exportJson">Eksport JSON</button>
        <button class="btn" data-act="importJson">Import JSON</button>
        <input type="file" id="importFile" data-chg="importFile" accept=".json,application/json" hidden>
      </div></section>
    <section class="stats">
      ${card(s.teachers.length, 'Guru', ['data', 'guru'])}${card(s.classes.length, 'Kelas', ['data', 'kelas'])}
      ${card(s.subjects.length, 'Subjek', ['data', 'subjek'])}${card(s.rooms.length, 'Bilik', ['data', 'bilik'])}
      ${card(s.lessons.length, 'Pelajaran', ['data', 'pelajaran'])}${card(`${total - un}/${total}`, 'Waktu diletak', ['jadual'])}
      ${card(errs, 'Konflik', ['laporan'])}
    </section>
    <section class="panel"><h2>Langkah kerja</h2>
      <ol class="steps">
        <li class="${s.periods.length ? 'done' : ''}"><a data-act="goto" data-p="tetapan">Tetapan</a>: hari persekolahan, waktu dan rehat, had waktu Jumaat.</li>
        <li class="${s.subjects.length ? 'done' : ''}"><a data-act="goto" data-p="data" data-t="subjek">Subjek</a>, <a data-act="goto" data-p="data" data-t="guru">guru</a> (termasuk waktu guru tidak boleh mengajar), <a data-act="goto" data-p="data" data-t="kelas">kelas</a> dan <a data-act="goto" data-p="data" data-t="bilik">bilik</a>.</li>
        <li class="${s.lessons.length ? 'done' : ''}"><a data-act="goto" data-p="data" data-t="pelajaran">Pelajaran</a>: siapa mengajar apa untuk kelas mana, berapa waktu seminggu, berapa yang berganda.</li>
        <li class="${total && !un ? 'done' : ''}"><a data-act="goto" data-p="jadual">Jana jadual</a>, kemudian laras dengan seret-dan-lepas. Kunci waktu yang tak boleh berubah.</li>
        <li><a data-act="goto" data-p="relief">Relief</a>: tandakan guru tidak hadir, sistem cadangkan guru ganti yang adil.</li>
      </ol></section>
    ${empty ? '' : `<section class="panel"><h2>Semakan data</h2>${pre.length ? `<ul class="issues">${pre.map((i) => `<li class="${i.sev}">${esc(i.msg)}</li>`).join('')}</ul>` : '<p class="okmsg">Tiada masalah data dikesan.</p>'}</section>`}`;
  };

  actions.goto = (el) => { UI.page = el.dataset.p; if (el.dataset.t) UI.dataTab = el.dataset.t; UI.render(); window.scrollTo(0, 0); };

  actions.loadSample = () => {
    const go = () => { UI.state = TT.sample(); UI.lastGen = null; UI.view = { type: 'class', id: null }; UI.save(); UI.render(); UI.toast('Data contoh dimuatkan. Pergi ke Jadual dan tekan Jana.'); };
    if (S().teachers.length || S().classes.length) UI.confirm('Ini akan menggantikan semua data semasa dengan data contoh. Teruskan?', go, 'Ganti'); else go();
  };
  actions.newBlank = () => {
    const go = () => { UI.state = TT.newState(); UI.lastGen = null; UI.save(); UI.render(); };
    if (S().teachers.length || S().classes.length) UI.confirm('Semua data semasa akan dipadam. Teruskan?', go, 'Padam semua'); else go();
  };
  actions.exportJson = () => {
    UI.download(`jadual-${S().school.name.replace(/\W+/g, '-').toLowerCase()}-${TT.todayISO()}.json`, JSON.stringify(S(), null, 1), 'application/json');
  };
  actions.importJson = () => document.getElementById('importFile').click();
  changes.importFile = (el) => {
    const f = el.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const obj = JSON.parse(rd.result);
        if (!obj || !Array.isArray(obj.teachers) || !Array.isArray(obj.lessons)) throw new Error('format');
        UI.state = TT.migrate(obj); UI.commit(); UI.toast('Import berjaya.');
      } catch (e) { UI.toast('Fail JSON tidak sah atau bukan fail Jadual Sekolah.', 'err'); }
    };
    rd.readAsText(f);
  };

  // ---------------- TETAPAN ----------------
  pages.tetapan = () => {
    const s = S(), days = TT.days(s), r = s.settings.relief, slots = TT.slots(s);
    const rows = s.periods.map((p, i) => `<tr>
      <td><input data-chg="period" data-i="${i}" data-f="label" value="${esc(p.label)}" size="6"></td>
      <td><input type="time" data-chg="period" data-i="${i}" data-f="start" value="${p.start}"></td>
      <td><input type="time" data-chg="period" data-i="${i}" data-f="end" value="${p.end}"></td>
      <td><select data-chg="period" data-i="${i}" data-f="type"><option value="lesson"${p.type === 'lesson' ? ' selected' : ''}>Waktu belajar</option><option value="break"${p.type === 'break' ? ' selected' : ''}>Rehat</option></select></td>
      <td class="acts"><button class="btn sm" data-act="periodMove" data-i="${i}" data-dir="-1" title="Naik">↑</button><button class="btn sm" data-act="periodMove" data-i="${i}" data-dir="1" title="Turun">↓</button><button class="btn sm danger" data-act="periodDel" data-i="${i}">Padam</button></td></tr>`).join('');
    const rw = (k, label, hint) => `<label class="fld"><span>${label}</span><input type="number" step="any" data-chg="reliefCfg" data-k="${k}" value="${r[k]}">${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
    return `<section class="panel"><h2>Maklumat sekolah</h2>
      <div class="grid2">
        <label class="fld"><span>Nama sekolah</span><input data-chg="schoolName" value="${esc(s.school.name)}"></label>
        <label class="fld"><span>Minggu persekolahan</span><select data-chg="weekMode">
          <option value="mon-fri"${s.school.weekMode === 'mon-fri' ? ' selected' : ''}>Isnin hingga Jumaat</option>
          <option value="sun-thu"${s.school.weekMode === 'sun-thu' ? ' selected' : ''}>Ahad hingga Khamis (Kedah, Kelantan, Terengganu, Johor)</option></select></label>
      </div></section>
    <section class="panel"><h2>Waktu dan rehat</h2>
      <p class="hint">Susun mengikut turutan sebenar. Waktu berganda tidak akan melintasi rehat. Ada ${slots.length} waktu belajar sehari.</p>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Label</th><th>Mula</th><th>Tamat</th><th>Jenis</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="row"><button class="btn" data-act="periodAdd" data-type="lesson">+ Waktu belajar</button><button class="btn" data-act="periodAdd" data-type="break">+ Rehat</button><button class="btn" data-act="periodGen">Jana pantas waktu...</button></div>
      <h3>Bilangan waktu setiap hari</h3>
      <p class="hint">Contoh: Jumaat lebih pendek. Waktu selepas had ini tidak digunakan.</p>
      <div class="row">${days.map((d, i) => `<label class="fld sm"><span>${d.name}</span><input type="number" min="0" max="${slots.length}" data-chg="dayLimit" data-i="${i}" value="${TT.dayLimits(s)[i]}"></label>`).join('')}</div></section>
    <section class="panel"><h2>Peraturan relief</h2>
      <p class="hint">Skor cadangan guru ganti = jumlah bonus tolak penalti. Calon dengan skor paling tinggi dicadangkan dahulu. Tukar nilai untuk laraskan keutamaan.</p>
      <div class="grid3">
        ${rw('maxPerDay', 'Had relief sehari seorang guru', '0 = tiada had')}
        <label class="fld chk"><input type="checkbox" data-chg="reliefBool" data-k="respectUnavailable"${r.respectUnavailable ? ' checked' : ''}><span>Hormati waktu guru tidak boleh hadir (dalam profil guru)</span></label>
        <span></span>
        ${rw('wSubject', 'Bonus: subjek sama')}${rw('wDept', 'Bonus: panitia sama')}${rw('wKnows', 'Bonus: mengajar kelas itu')}
        ${rw('wHome', 'Bonus: guru kelas')}${rw('wCont', 'Bonus: sambung kelas sama')}${rw('wFair', 'Penalti setiap relief bulan ini')}
        ${rw('wTotal', 'Penalti setiap relief keseluruhan')}${rw('wToday', 'Penalti setiap relief hari ini')}${rw('wLoad', 'Penalti setiap waktu mengajar mingguan')}
      </div>
      <div class="row"><button class="btn" data-act="reliefDefaults">Pulihkan nilai asal</button></div></section>`;
  };

  changes.schoolName = (el) => { S().school.name = el.value.trim() || 'Sekolah'; UI.commit(); };
  changes.weekMode = (el) => { S().school.weekMode = el.value; UI.commit(); };
  changes.period = (el) => {
    const p = S().periods[+el.dataset.i]; p[el.dataset.f] = el.value;
    if (p.type === 'break' && !p.label) p.label = 'Rehat';
    UI.commit();
  };
  changes.dayLimit = (el) => { S().dayLimits[+el.dataset.i] = Math.max(0, Math.min(TT.slots(S()).length, num(el.value, 0))); UI.commit(); };
  changes.reliefCfg = (el) => { S().settings.relief[el.dataset.k] = num(el.value, 0); UI.save(); UI.toast('Disimpan'); };
  changes.reliefBool = (el) => { S().settings.relief[el.dataset.k] = el.checked; UI.save(); };
  actions.reliefDefaults = () => { S().settings.relief = TT.defaultRelief(); UI.commit(); };
  actions.periodAdd = (el) => {
    const ps = S().periods, last = ps[ps.length - 1];
    const n = ps.filter((p) => p.type === 'lesson').length + 1;
    ps.push({ label: el.dataset.type === 'break' ? 'Rehat' : String(n), start: last ? last.end : '07:30', end: last ? addMin(last.end, el.dataset.type === 'break' ? 30 : 40) : '08:10', type: el.dataset.type });
    S().dayLimits = TT.days(S()).map((_, i) => (S().dayLimits[i] != null ? S().dayLimits[i] : 0) + (el.dataset.type === 'lesson' && S().dayLimits[i] === TT.slots(S()).length - 1 ? 1 : 0));
    UI.commit();
  };
  actions.periodDel = (el) => {
    const i = +el.dataset.i, ps = S().periods;
    UI.confirm('Padam baris ini? Waktu yang telah diletak selepasnya mungkin dibuang dari jadual.', () => { ps.splice(i, 1); UI.commit(); }, 'Padam');
  };
  actions.periodMove = (el) => {
    const i = +el.dataset.i, j = i + +el.dataset.dir, ps = S().periods;
    if (j < 0 || j >= ps.length) return; [ps[i], ps[j]] = [ps[j], ps[i]]; UI.commit();
  };
  const addMin = (hhmm, m) => { const [h, mi] = hhmm.split(':').map(Number); const t = h * 60 + mi + m; return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  actions.periodGen = () => {
    UI.openForm({
      title: 'Jana pantas waktu', saveLabel: 'Jana',
      fields: [
        { key: 'start', label: 'Waktu mula persekolahan', type: 'time', def: '07:30' },
        { key: 'len', label: 'Tempoh satu waktu (minit)', type: 'number', def: 40, min: 20, max: 90 },
        { key: 'n', label: 'Bilangan waktu belajar', type: 'number', def: 8, min: 1, max: 14 },
        { key: 'brkAfter', label: 'Rehat selepas waktu ke', type: 'number', def: 4, min: 0, max: 14, hint: '0 = tiada rehat' },
        { key: 'brkLen', label: 'Tempoh rehat (minit)', type: 'number', def: 30, min: 5, max: 90 }
      ],
      onSave: (v) => {
        const ps = []; let t = v.start;
        for (let i = 1; i <= v.n; i++) {
          ps.push({ label: String(i), start: t, end: addMin(t, v.len), type: 'lesson' }); t = addMin(t, v.len);
          if (i === v.brkAfter) { ps.push({ label: 'Rehat', start: t, end: addMin(t, v.brkLen), type: 'break' }); t = addMin(t, v.brkLen); }
        }
        S().periods = ps; S().dayLimits = TT.days(S()).map(() => v.n);
      }
    });
  };

  // ---------------- DATA ----------------
  const TABS = [['guru', 'Guru'], ['subjek', 'Subjek'], ['kelas', 'Kelas'], ['bilik', 'Bilik'], ['pelajaran', 'Pelajaran']];
  const opts = (arr, f) => arr.map((x) => ({ v: x.id, t: f(x) }));

  pages.data = () => {
    const s = S();
    const tabs = `<div class="tabs sub">${TABS.map(([k, t]) => `<button class="${UI.dataTab === k ? 'on' : ''}" data-act="dataTab" data-t="${k}">${t} <small>${{ guru: s.teachers, subjek: s.subjects, kelas: s.classes, bilik: s.rooms, pelajaran: s.lessons }[k].length}</small></button>`).join('')}</div>`;
    return tabs + dataTables[UI.dataTab]();
  };
  actions.dataTab = (el) => { UI.dataTab = el.dataset.t; UI.render(); };

  const bar = (label, addAct, bulk) => `<div class="toolbar"><button class="btn primary" data-act="${addAct}">+ Tambah ${label}</button>${bulk ? `<button class="btn" data-act="bulk" data-kind="${bulk}">Tambah ramai sekaligus</button>` : ''}</div>`;
  const delBtn = (kind, id) => `<button class="btn sm danger" data-act="del" data-kind="${kind}" data-id="${id}">Padam</button>`;
  const editBtn = (kind, id) => `<button class="btn sm" data-act="edit" data-kind="${kind}" data-id="${id}">Edit</button>`;

  const dataTables = {
    guru() {
      const s = S(), load = TT.teacherLoad(s), m = TT.maps(s);
      const rows = s.teachers.map((t) => {
        const blocked = Object.values(t.unavailable).filter(Boolean).length, l = load.get(t.id) || 0;
        return `<tr><td>${esc(t.name)}${t.noRelief ? ' <span class="tag">tiada relief</span>' : ''}</td><td>${esc(t.short)}</td><td>${esc(t.dept)}</td>
          <td>${t.subjectIds.map((i) => esc((m.subject.get(i) || {}).short)).join(', ')}</td>
          <td class="${l > t.maxPerWeek ? 'bad' : ''}">${l}</td><td>${blocked || ''}</td><td class="acts">${editBtn('guru', t.id)}${delBtn('guru', t.id)}</td></tr>`;
      }).join('');
      return bar('guru', 'add-guru', 'guru') + `<div class="tablewrap"><table class="tbl"><thead><tr><th>Nama</th><th>Kod</th><th>Panitia</th><th>Subjek</th><th>Waktu/minggu</th><th>Slot tak boleh</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="empty">Belum ada guru.</td></tr>'}</tbody></table></div>`;
    },
    subjek() {
      const rows = S().subjects.map((x) => `<tr><td><span class="sw" style="background:${esc(x.color)}"></span>${esc(x.name)}</td><td>${esc(x.short)}</td><td>${x.heavy ? 'Ya (pagi)' : ''}</td><td class="acts">${editBtn('subjek', x.id)}${delBtn('subjek', x.id)}</td></tr>`).join('');
      return bar('subjek', 'add-subjek', 'subjek') + `<div class="tablewrap"><table class="tbl"><thead><tr><th>Subjek</th><th>Kod</th><th>Utamakan pagi</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="empty">Belum ada subjek.</td></tr>'}</tbody></table></div>`;
    },
    kelas() {
      const s = S(), m = TT.maps(s);
      const per = new Map(); s.lessons.forEach((l) => l.classIds.forEach((c) => per.set(c, (per.get(c) || 0) + (l.perWeek | 0))));
      const rows = s.classes.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.level)}</td><td>${esc((m.teacher.get(c.homeroomId) || {}).name || '')}</td><td>${per.get(c.id) || 0}</td><td class="acts">${editBtn('kelas', c.id)}${delBtn('kelas', c.id)}</td></tr>`).join('');
      return bar('kelas', 'add-kelas', 'kelas') + `<div class="tablewrap"><table class="tbl"><thead><tr><th>Kelas</th><th>Tingkatan</th><th>Guru kelas</th><th>Waktu/minggu</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">Belum ada kelas.</td></tr>'}</tbody></table></div>`;
    },
    bilik() {
      const rows = S().rooms.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.type)}</td><td class="acts">${editBtn('bilik', r.id)}${delBtn('bilik', r.id)}</td></tr>`).join('');
      return bar('bilik', 'add-bilik', 'bilik') + `<div class="tablewrap"><table class="tbl"><thead><tr><th>Bilik / makmal</th><th>Jenis</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="empty">Belum ada bilik. Bilik bersifat pilihan.</td></tr>'}</tbody></table></div>`;
    },
    pelajaran() {
      const s = S(), m = TT.maps(s), f = UI.lessonFilter;
      const placed = new Map(); s.placements.forEach((p) => placed.set(p.lessonId, (placed.get(p.lessonId) || 0) + p.len));
      const list = s.lessons.filter((l) => (!f.cls || l.classIds.includes(f.cls)) && (!f.teacher || l.teacherIds.includes(f.teacher)) && (!f.subject || l.subjectId === f.subject));
      const rows = list.map((l) => {
        const sub = m.subject.get(l.subjectId) || {}, got = placed.get(l.id) || 0;
        return `<tr><td>${esc(TT.classNames(s, l.classIds))}</td><td><span class="sw" style="background:${esc(sub.color || '#999')}"></span>${esc(sub.name || '?')}</td>
          <td>${l.teacherIds.map((i) => esc((m.teacher.get(i) || {}).name)).join(' + ') || '<span class="bad">tiada guru</span>'}</td><td>${l.perWeek}</td><td>${l.doubles || ''}</td>
          <td>${esc((m.room.get(l.roomId) || {}).name || '')}</td><td class="${got < l.perWeek ? 'warn' : ''}">${got}/${l.perWeek}</td><td class="acts">${editBtn('pelajaran', l.id)}${delBtn('pelajaran', l.id)}</td></tr>`;
      }).join('');
      const sel = (key, label, arr, fn) => `<label class="fld sm"><span>${label}</span><select data-chg="lessonFilter" data-k="${key}"><option value="">Semua</option>${UI.optHtml(opts(arr, fn), f[key])}</select></label>`;
      return `<div class="toolbar"><button class="btn primary" data-act="add-pelajaran">+ Tambah pelajaran</button>
        ${sel('cls', 'Kelas', s.classes, (c) => c.name)}${sel('teacher', 'Guru', s.teachers, (t) => t.name)}${sel('subject', 'Subjek', s.subjects, (x) => x.name)}</div>
        <p class="hint">Pelajaran gabungan (cth Pendidikan Islam / Moral) ialah satu pelajaran dengan beberapa kelas dan beberapa guru yang mengajar serentak.</p>
        <div class="tablewrap"><table class="tbl"><thead><tr><th>Kelas</th><th>Subjek</th><th>Guru</th><th>Waktu/mgg</th><th>Berganda</th><th>Bilik</th><th>Diletak</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="8" class="empty">Tiada pelajaran dipadankan.</td></tr>'}</tbody></table></div>`;
    }
  };
  changes.lessonFilter = (el) => { UI.lessonFilter[el.dataset.k] = el.value; UI.render(); };

  // ---- borang tambah / edit ----
  const forms = {
    guru: (id) => {
      const s = S(), t = id ? s.teachers.find((x) => x.id === id) : null;
      UI.openForm({
        title: t ? 'Edit guru' : 'Tambah guru', wide: true,
        values: t ? { name: t.name, short: t.short, dept: t.dept, subjectIds: t.subjectIds, maxPerDay: t.maxPerDay, maxPerWeek: t.maxPerWeek, noRelief: t.noRelief, unavailable: t.unavailable } : {},
        fields: [
          { key: 'name', label: 'Nama', required: true }, { key: 'short', label: 'Kod ringkas (3 huruf)', hint: 'Dipaparkan dalam jadual. Kosongkan untuk jana automatik.' },
          { key: 'dept', label: 'Panitia / jabatan' },
          { key: 'subjectIds', label: 'Subjek yang boleh diajar', type: 'multi', options: opts(s.subjects, (x) => x.name) },
          { key: 'maxPerDay', label: 'Had waktu mengajar sehari', type: 'number', def: 7, min: 1 }, { key: 'maxPerWeek', label: 'Had waktu seminggu (amaran)', type: 'number', def: 36, min: 1 },
          { key: 'noRelief', label: 'Dikecualikan daripada tugas relief (cth pentadbir)', type: 'checkbox' },
          { key: 'unavailable', label: 'Waktu tidak boleh mengajar', type: 'avail' }
        ],
        onSave: (v) => {
          const o = t || { id: TT.uid('t') };
          Object.assign(o, v, { short: v.short || v.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase() });
          if (!t) s.teachers.push(o);
        }
      });
    },
    subjek: (id) => {
      const s = S(), x = id ? s.subjects.find((y) => y.id === id) : null;
      const pal = ['#e11d48', '#2563eb', '#7c3aed', '#059669', '#b45309', '#0d9488', '#ca8a04', '#ea580c', '#db2777', '#4b5563'];
      UI.openForm({
        title: x ? 'Edit subjek' : 'Tambah subjek', values: x ? { name: x.name, short: x.short, color: x.color, heavy: x.heavy } : { color: pal[s.subjects.length % pal.length] },
        fields: [{ key: 'name', label: 'Nama subjek', required: true }, { key: 'short', label: 'Kod ringkas', hint: 'Cth BM, MT, SN' }, { key: 'color', label: 'Warna', type: 'color' },
          { key: 'heavy', label: 'Subjek berat: utamakan waktu pagi', type: 'checkbox' }],
        onSave: (v) => { const o = x || { id: TT.uid('s') }; Object.assign(o, v, { short: v.short || v.name.slice(0, 3).toUpperCase() }); if (!x) s.subjects.push(o); }
      });
    },
    kelas: (id) => {
      const s = S(), c = id ? s.classes.find((y) => y.id === id) : null;
      UI.openForm({
        title: c ? 'Edit kelas' : 'Tambah kelas', values: c ? { name: c.name, level: c.level, homeroomId: c.homeroomId || '' } : {},
        fields: [{ key: 'name', label: 'Nama kelas', required: true, hint: 'Cth 1 Amanah' }, { key: 'level', label: 'Tingkatan / tahun' },
          { key: 'homeroomId', label: 'Guru kelas', type: 'select', options: [{ v: '', t: '(tiada)' }].concat(opts(s.teachers, (t) => t.name)) }],
        onSave: (v) => { const o = c || { id: TT.uid('c') }; Object.assign(o, v, { homeroomId: v.homeroomId || null }); if (!c) s.classes.push(o); }
      });
    },
    bilik: (id) => {
      const s = S(), r = id ? s.rooms.find((y) => y.id === id) : null;
      UI.openForm({
        title: r ? 'Edit bilik' : 'Tambah bilik', values: r ? { name: r.name, type: r.type } : {},
        fields: [{ key: 'name', label: 'Nama bilik / makmal', required: true }, { key: 'type', label: 'Jenis', hint: 'Cth Makmal, Bengkel' }],
        onSave: (v) => { const o = r || { id: TT.uid('r') }; Object.assign(o, v); if (!r) s.rooms.push(o); }
      });
    },
    pelajaran: (id) => {
      const s = S();
      if (!id) return lessonWizard();
      const l = s.lessons.find((x) => x.id === id);
      UI.openForm({
        title: 'Edit pelajaran', wide: true,
        values: { subjectId: l.subjectId, classIds: l.classIds, teacherIds: l.teacherIds, perWeek: l.perWeek, doubles: l.doubles, roomId: l.roomId || '' },
        fields: [
          { key: 'subjectId', label: 'Subjek', type: 'select', options: opts(s.subjects, (x) => x.name) },
          { key: 'classIds', label: 'Kelas (lebih daripada satu = gabungan serentak)', type: 'multi', options: opts(s.classes, (c) => c.name) },
          { key: 'teacherIds', label: 'Guru (lebih daripada satu = mengajar serentak)', type: 'multi', options: opts(s.teachers, (t) => t.name) },
          { key: 'perWeek', label: 'Waktu seminggu', type: 'number', min: 1, max: 20, required: true }, { key: 'doubles', label: 'Daripadanya berapa pasang waktu berganda', type: 'number', min: 0, max: 10 },
          { key: 'roomId', label: 'Bilik', type: 'select', options: [{ v: '', t: '(tiada)' }].concat(opts(s.rooms, (r) => r.name)) }
        ],
        onSave: (v) => {
          if (!v.classIds.length) return 'Pilih sekurang-kurangnya satu kelas.';
          if (!v.teacherIds.length) return 'Pilih sekurang-kurangnya satu guru.';
          if ((v.doubles || 0) * 2 > v.perWeek) return 'Pasang berganda terlalu banyak untuk bilangan waktu.';
          Object.assign(l, v, { roomId: v.roomId || null, doubles: v.doubles || 0 });
        }
      });
    }
  };

  // tambah pelajaran: pilih subjek, kemudian setiap kelas ada guru sendiri, atau satu pelajaran gabungan
  function lessonWizard() {
    const s = S();
    if (!s.subjects.length || !s.classes.length || !s.teachers.length) { UI.toast('Isi dahulu subjek, kelas dan guru.', 'err'); return; }
    const subjOpts = UI.optHtml(opts(s.subjects, (x) => x.name), '');
    const teacherSel = (name) => {
      const sid = s.subjects[0].id;
      const mine = s.teachers.filter((t) => t.subjectIds.includes(sid)), rest = s.teachers.filter((t) => !t.subjectIds.includes(sid));
      return `<select name="${name}" data-teacher-sel>${mine.length ? `<optgroup label="Mengajar subjek ini">${UI.optHtml(opts(mine, (t) => t.name), '')}</optgroup>` : ''}<optgroup label="Guru lain">${UI.optHtml(opts(rest, (t) => t.name), '')}</optgroup></select>`;
    };
    const body = `<div class="grid2">
      <label class="fld"><span>Subjek</span><select id="wzSubj" data-chg="wzSubject">${subjOpts}</select></label>
      <label class="fld"><span>Bilik</span><select id="wzRoom"><option value="">(tiada)</option>${UI.optHtml(opts(s.rooms, (r) => r.name), '')}</select></label>
      <label class="fld"><span>Waktu seminggu</span><input id="wzPer" type="number" min="1" max="20" value="3"></label>
      <label class="fld"><span>Pasang berganda</span><input id="wzDbl" type="number" min="0" max="10" value="0"></label></div>
      <div class="fld"><span>Mod</span><div class="row"><label class="chk"><input type="radio" name="wzMode" value="asing" checked data-chg="wzMode">Satu pelajaran setiap kelas (guru boleh berbeza)</label>
      <label class="chk"><input type="radio" name="wzMode" value="gabung" data-chg="wzMode">Gabungan serentak (cth Pendidikan Islam / Moral)</label></div></div>
      <div id="wzAsing"><span class="lbl">Kelas dan guru</span><table class="tbl"><tbody>${s.classes.map((c) => `<tr><td><label class="chk"><input type="checkbox" data-wz-cls value="${c.id}">${esc(c.name)}</label></td><td>${teacherSel('t_' + c.id)}</td></tr>`).join('')}</tbody></table>
        <button type="button" class="btn sm" data-act="wzAll">Pilih semua kelas</button></div>
      <div id="wzGabung" class="hidden"><span class="lbl">Kelas yang belajar serentak</span><div class="multi">${s.classes.map((c) => `<label class="chk"><input type="checkbox" data-wz-gc value="${c.id}">${esc(c.name)}</label>`).join('')}</div>
        <span class="lbl">Guru yang mengajar serentak (satu kumpulan setiap guru)</span><div class="multi">${s.teachers.map((t) => `<label class="chk"><input type="checkbox" data-wz-gt value="${t.id}">${esc(t.name)}</label>`).join('')}</div></div>
      <div id="formErr" class="err"></div>`;
    UI.modalOpen('Tambah pelajaran', body, '<button class="btn" data-act="modalClose">Batal</button><button class="btn primary" data-act="wzSave">Tambah</button>', true);
  }
  changes.wzSubject = (el) => {
    const s = S(), sid = el.value;
    document.querySelectorAll('[data-teacher-sel]').forEach((sel) => {
      const cur = sel.value;
      const mine = s.teachers.filter((t) => t.subjectIds.includes(sid)), rest = s.teachers.filter((t) => !t.subjectIds.includes(sid));
      sel.innerHTML = (mine.length ? `<optgroup label="Mengajar subjek ini">${UI.optHtml(opts(mine, (t) => t.name), cur)}</optgroup>` : '') + `<optgroup label="Guru lain">${UI.optHtml(opts(rest, (t) => t.name), cur)}</optgroup>`;
    });
  };
  changes.wzMode = () => {
    const g = document.querySelector('[name=wzMode]:checked').value === 'gabung';
    document.getElementById('wzAsing').classList.toggle('hidden', g); document.getElementById('wzGabung').classList.toggle('hidden', !g);
  };
  actions.wzAll = () => document.querySelectorAll('[data-wz-cls]').forEach((c) => { c.checked = true; });
  actions.wzSave = () => {
    const s = S(), $ = (id) => document.getElementById(id);
    const base = { subjectId: $('wzSubj').value, perWeek: num($('wzPer').value, 0), doubles: num($('wzDbl').value, 0), roomId: $('wzRoom').value || null };
    const fail = (m) => { $('formErr').textContent = m; };
    if (base.perWeek < 1) return fail('Waktu seminggu mesti sekurang-kurangnya 1.');
    if (base.doubles * 2 > base.perWeek) return fail('Pasang berganda terlalu banyak.');
    if (document.querySelector('[name=wzMode]:checked').value === 'gabung') {
      const cls = [...document.querySelectorAll('[data-wz-gc]:checked')].map((x) => x.value), tch = [...document.querySelectorAll('[data-wz-gt]:checked')].map((x) => x.value);
      if (!cls.length || !tch.length) return fail('Pilih kelas dan guru.');
      s.lessons.push(Object.assign({ id: TT.uid('l'), classIds: cls, teacherIds: tch }, base));
    } else {
      const cls = [...document.querySelectorAll('[data-wz-cls]:checked')].map((x) => x.value);
      if (!cls.length) return fail('Pilih sekurang-kurangnya satu kelas.');
      cls.forEach((c) => s.lessons.push(Object.assign({ id: TT.uid('l'), classIds: [c], teacherIds: [document.querySelector(`[name="t_${c}"]`).value] }, base)));
    }
    UI.modalClose(); UI.commit(); UI.toast('Pelajaran ditambah.');
  };

  actions.edit = (el) => forms[{ guru: 'guru', subjek: 'subjek', kelas: 'kelas', bilik: 'bilik', pelajaran: 'pelajaran' }[el.dataset.kind]](el.dataset.id);
  ['guru', 'subjek', 'kelas', 'bilik', 'pelajaran'].forEach((k) => { actions['add-' + k] = () => forms[k](); });

  actions.del = (el) => {
    const { kind, id } = el.dataset, s = S();
    const arr = { guru: 'teachers', subjek: 'subjects', kelas: 'classes', bilik: 'rooms', pelajaran: 'lessons' }[kind];
    const used = kind === 'subjek' ? s.lessons.filter((l) => l.subjectId === id).length
      : kind === 'guru' ? s.lessons.filter((l) => l.teacherIds.includes(id)).length
        : kind === 'kelas' ? s.lessons.filter((l) => l.classIds.includes(id)).length
          : kind === 'bilik' ? s.lessons.filter((l) => l.roomId === id).length : 0;
    const msg = used ? `Item ini dipakai dalam ${used} pelajaran. Padam akan membuang rujukan itu (pelajaran tanpa kelas/guru perlu dibetulkan). Teruskan?` : 'Padam item ini?';
    UI.confirm(msg, () => {
      s[arr] = s[arr].filter((x) => x.id !== id);
      if (kind === 'subjek') s.lessons = s.lessons.filter((l) => l.subjectId !== id);
      if (kind === 'kelas') { s.lessons = s.lessons.filter((l) => l.classIds.some((c) => c !== id)); s.lessons.forEach((l) => { l.classIds = l.classIds.filter((c) => c !== id); }); }
      if (kind === 'guru') { s.classes.forEach((c) => { if (c.homeroomId === id) c.homeroomId = null; }); s.absences = s.absences.filter((a) => a.teacherId !== id); s.reliefs = s.reliefs.filter((r) => r.reliefTeacherId !== id && r.absentTeacherId !== id); }
      UI.commit();
    }, 'Padam');
  };

  actions.bulk = (el) => {
    const kind = el.dataset.kind;
    const help = { guru: 'Satu guru setiap baris: Nama, Kod, Panitia', subjek: 'Satu subjek setiap baris: Nama, Kod', kelas: 'Satu kelas setiap baris: Nama, Tingkatan', bilik: 'Satu bilik setiap baris: Nama, Jenis' }[kind];
    UI.openForm({
      title: 'Tambah ramai: ' + kind, saveLabel: 'Tambah', wide: true,
      fields: [{ key: 'text', label: help, type: 'textarea', rows: 10, hint: 'Tampal terus dari Excel pun boleh (lajur dipisahkan tab atau koma). Hanya nama yang wajib.' }],
      onSave: (v) => {
        const s = S(), pal = ['#e11d48', '#2563eb', '#7c3aed', '#059669', '#b45309', '#0d9488', '#ca8a04', '#ea580c', '#db2777', '#4b5563'];
        const lines = v.text.split(/\r?\n/).map((l) => l.split(/\t|,/).map((x) => x.trim())).filter((c) => c[0]);
        if (!lines.length) return 'Tiada data.';
        lines.forEach(([a, b, c]) => {
          if (kind === 'guru') s.teachers.push({ id: TT.uid('t'), name: a, short: b || a.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase(), dept: c || '', subjectIds: [], maxPerDay: 7, maxPerWeek: 36, unavailable: {}, noRelief: false });
          else if (kind === 'subjek') s.subjects.push({ id: TT.uid('s'), name: a, short: b || a.slice(0, 3).toUpperCase(), color: pal[s.subjects.length % pal.length], heavy: false });
          else if (kind === 'kelas') s.classes.push({ id: TT.uid('c'), name: a, level: b || '', homeroomId: null });
          else s.rooms.push({ id: TT.uid('r'), name: a, type: b || '' });
        });
      }
    });
  };
})();
