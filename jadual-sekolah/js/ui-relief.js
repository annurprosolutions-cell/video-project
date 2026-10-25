(function () {
  'use strict';
  const { esc, actions, changes, pages } = UI;
  const S = () => UI.state;
  const R = () => UI.relief;

  pages.relief = () => {
    const tabs = [['harian', 'Relief harian'], ['statistik', 'Statistik kesaksamaan'], ['sejarah', 'Sejarah']];
    return `<div class="tabs sub">${tabs.map(([k, t]) => `<button class="${R().tab === k ? 'on' : ''}" data-act="reliefTab" data-t="${k}">${t}</button>`).join('')}</div>` +
      { harian: daily, statistik: stats, sejarah: history }[R().tab]();
  };
  actions.reliefTab = (el) => { R().tab = el.dataset.t; UI.render(); };

  const periodText = (s, ps) => {
    const sl = TT.slots(s), a = ps[0], b = ps[ps.length - 1];
    return a === b ? `Waktu ${sl[a].label}<small>${sl[a].start}-${sl[a].end}</small>` : `Waktu ${sl[a].label}-${sl[b].label}<small>${sl[a].start}-${sl[b].end}</small>`;
  };

  function daily() {
    const s = S(), iso = R().date, day = TT.dateToDay(s, iso), days = TT.days(s), m = TT.maps(s);
    const weekday = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'][new Date(iso + 'T00:00:00').getDay()];
    const abs = s.absences.filter((a) => a.date === iso);
    const needs = TT.reliefNeeds(s, iso), grid = TT.teacherGrid(s);
    const sl = TT.slots(s);

    const absRows = abs.map((a) => {
      const t = m.teacher.get(a.teacherId) || { name: '?' };
      const scope = a.from == null && a.to == null ? 'Sehari penuh' : `Waktu ${(a.from || 0) + 1} hingga ${(a.to == null ? sl.length - 1 : a.to) + 1}`;
      const n = needs.filter((x) => x.absenceId === a.id).reduce((c, x) => c + x.periods.length, 0);
      return `<tr><td>${esc(t.name)}</td><td>${esc(a.reason)}${a.note ? `<small>${esc(a.note)}</small>` : ''}</td><td>${scope}</td><td>${n} waktu perlu ganti</td><td class="acts"><button class="btn sm danger" data-act="absenceDel" data-id="${a.id}">Padam</button></td></tr>`;
    }).join('');

    const rows = needs.map((n) => {
      const rec = TT.reliefRecord(s, n), cands = TT.reliefCandidates(s, n, { grid });
      const at = m.teacher.get(n.absentTeacherId) || { name: '?' }, sub = m.subject.get(n.subjectId) || {};
      const cur = rec && rec.status === 'assigned' ? 't:' + rec.reliefTeacherId : rec ? rec.status : '';
      let opts = `<option value="">- Pilih guru ganti -</option>`;
      opts += cands.map((c, i) => `<option value="t:${c.teacher.id}"${cur === 't:' + c.teacher.id ? ' selected' : ''}>${i === 0 ? '★ ' : ''}${esc(c.teacher.name)} · skor ${c.score}${c.tag.length ? ' · ' + esc(c.tag.join(', ')) : ''}</option>`).join('');
      if (cur.startsWith('t:') && !cands.some((c) => 't:' + c.teacher.id === cur)) {
        opts += `<option value="${cur}" selected>${esc((m.teacher.get(cur.slice(2)) || {}).name)} (tidak lagi sesuai)</option>`;
      }
      opts += `<option value="kendiri"${cur === 'kendiri' ? ' selected' : ''}>Kelas kendiri (beri tugasan)</option><option value="gabung"${cur === 'gabung' ? ' selected' : ''}>Gabung dengan kelas lain</option>`;
      const sel = rec && rec.status === 'assigned' ? cands.find((c) => c.teacher.id === rec.reliefTeacherId) : null;
      const why = sel ? sel.parts.map((p) => `${p.label} (${p.v > 0 ? '+' : ''}${Math.round(p.v * 10) / 10})`).join(', ') : (!cands.length && !rec ? 'Tiada guru kosong yang layak pada waktu ini.' : '');
      return `<tr class="${rec ? 'done' : 'todo'}"><td class="nowrap">${periodText(s, n.periods)}</td><td>${esc(TT.classNames(s, n.classIds))}</td>
        <td><span class="sw" style="background:${esc(sub.color || '#999')}"></span>${esc(sub.name || '?')}${n.roomId ? `<small>${esc((m.room.get(n.roomId) || {}).name)}</small>` : ''}</td>
        <td>${esc(at.name)}</td><td><select data-chg="reliefPick" data-key="${esc(n.key)}">${opts}</select>${why ? `<small class="why">${esc(why)}</small>` : ''}</td></tr>`;
    }).join('');

    const per = new Map();
    s.reliefs.filter((r) => r.date === iso && r.status === 'assigned').forEach((r) => per.set(r.reliefTeacherId, (per.get(r.reliefTeacherId) || 0) + r.periods.length));
    const done = needs.filter((n) => TT.reliefRecord(s, n)).length;

    return `<div class="toolbar">
        <button class="btn sm" data-act="reliefDay" data-n="-1">‹</button>
        <input type="date" value="${iso}" data-chg="reliefDate">
        <button class="btn sm" data-act="reliefDay" data-n="1">›</button>
        <button class="btn sm" data-act="reliefToday">Hari ini</button>
        <b class="wd">${weekday}, ${TT.fmtDate(iso)}</b>
        <span class="grow"></span>
        <button class="btn primary" data-act="absenceAdd">+ Guru tidak hadir</button></div>
      ${day < 0 ? `<div class="banner warn">${weekday} bukan hari persekolahan mengikut tetapan (${s.school.weekMode === 'mon-fri' ? 'Isnin hingga Jumaat' : 'Ahad hingga Khamis'}). Tiada relief diperlukan.</div>` : ''}
      ${!s.placements.length ? '<div class="banner warn">Jadual waktu belum dijana. Relief bergantung pada jadual mengajar guru.</div>' : ''}
      <section class="panel"><h2>Guru tidak hadir (${abs.length})</h2>
        ${abs.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Guru</th><th>Sebab</th><th>Tempoh</th><th>Kesan</th><th></th></tr></thead><tbody>${absRows}</tbody></table></div>` : '<p class="empty">Tiada guru tidak hadir dicatat untuk tarikh ini.</p>'}</section>
      <section class="panel"><div class="ph"><h2>Keperluan relief (${done}/${needs.length} diselesaikan)</h2>
        <div class="row"><button class="btn primary" data-act="reliefAuto"${needs.length ? '' : ' disabled'}>Agih automatik</button>
        <button class="btn" data-act="reliefClear"${needs.length ? '' : ' disabled'}>Kosongkan agihan</button>
        <button class="btn" data-act="reliefPrint"${needs.length ? '' : ' disabled'}>Cetak slip</button>
        <button class="btn" data-act="reliefMsg"${needs.length ? '' : ' disabled'}>Mesej WhatsApp</button></div></div>
        ${needs.length ? `<div class="tablewrap"><table class="tbl relief"><thead><tr><th>Waktu</th><th>Kelas</th><th>Subjek</th><th>Guru tiada</th><th>Guru ganti (calon terbaik dahulu)</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="hint">★ = cadangan teratas. Skor merangkumi subjek sama, panitia, kenal kelas itu, dan menolak guru yang sudah banyak relief bulan ini atau beban mengajar tinggi. Pilih guru lain jika perlu, sistem tidak mengunci anda.</p>`
        : '<p class="empty">Tiada waktu mengajar yang terjejas.</p>'}</section>
      ${per.size ? `<section class="panel"><h2>Ringkasan guru ganti hari ini</h2><div class="chips">${[...per].map(([id, n]) => `<span class="chip plain">${esc((m.teacher.get(id) || {}).name)}: ${n} waktu</span>`).join('')}</div></section>` : ''}`;
  }

  changes.reliefDate = (el) => { if (el.value) { R().date = el.value; UI.render(); } };
  actions.reliefDay = (el) => { R().date = TT.addDays(R().date, +el.dataset.n); UI.render(); };
  actions.reliefToday = () => { R().date = TT.nextSchoolDay(S(), TT.todayISO()); UI.render(); };

  changes.reliefPick = (el) => {
    const s = S(), need = TT.reliefNeeds(s, R().date).find((n) => n.key === el.dataset.key); if (!need) return;
    const v = el.value;
    if (!v) TT.setRelief(s, need, null);
    else if (v.startsWith('t:')) TT.setRelief(s, need, 'assigned', v.slice(2));
    else TT.setRelief(s, need, v);
    UI.save(); UI.render();
  };
  actions.reliefAuto = () => {
    const r = TT.autoRelief(S(), R().date); UI.save(); UI.render();
    if (r.unresolved.length) UI.toast(`${r.assigned} diagih. ${r.unresolved.length} blok tiada calon layak: pilih kelas kendiri atau gabung kelas.`, 'err');
    else UI.toast(r.assigned ? `${r.assigned} blok relief diagih.` : 'Tiada keperluan baharu untuk diagih.');
  };
  actions.reliefClear = () => UI.confirm('Kosongkan semua agihan relief untuk tarikh ini?', () => { TT.clearRelief(S(), R().date); UI.commit(); }, 'Kosongkan');

  actions.absenceAdd = () => {
    const s = S(), sl = TT.slots(s);
    if (!s.teachers.length) { UI.toast('Belum ada guru.', 'err'); return; }
    UI.openForm({
      title: 'Guru tidak hadir', saveLabel: 'Simpan',
      values: { date: R().date, dateTo: '', reason: 'MC', scope: 'full', from: 1, to: sl.length },
      fields: [
        { key: 'teacherId', label: 'Guru', type: 'select', options: s.teachers.map((t) => ({ v: t.id, t: `${t.name} (${t.short})` })) },
        { key: 'date', label: 'Tarikh', type: 'date', required: true },
        { key: 'dateTo', label: 'Hingga tarikh (pilihan, untuk cuti beberapa hari)', type: 'date', hint: 'Hujung minggu dilangkau secara automatik.' },
        { key: 'reason', label: 'Sebab', type: 'select', options: TT.ABSENCE_REASONS.map((x) => ({ v: x, t: x })) },
        { key: 'scope', label: 'Tempoh', type: 'select', options: [{ v: 'full', t: 'Sehari penuh' }, { v: 'part', t: 'Waktu tertentu sahaja' }] },
        { key: 'from', label: 'Dari waktu ke (jika waktu tertentu)', type: 'number', min: 1, max: sl.length },
        { key: 'to', label: 'Hingga waktu ke', type: 'number', min: 1, max: sl.length },
        { key: 'note', label: 'Catatan' }
      ],
      onSave: (v) => {
        const to = v.dateTo || v.date;
        if (to < v.date) return 'Tarikh akhir mesti selepas tarikh mula.';
        const dates = TT.schoolDays(s, v.date, to);
        if (!dates.length) return 'Tarikh yang dipilih tiada hari persekolahan.';
        if (dates.length > 60) return 'Julat terlalu panjang (maksimum 60 hari persekolahan).';
        let from = null, till = null;
        if (v.scope === 'part') {
          from = (v.from || 1) - 1; till = (v.to || sl.length) - 1;
          if (till < from) return 'Waktu akhir mesti selepas waktu mula.';
        }
        dates.forEach((d) => {
          const old = s.absences.filter((a) => a.date === d && a.teacherId === v.teacherId);
          s.absences = s.absences.filter((a) => !old.includes(a));
          s.absences.push({ id: TT.uid('a'), date: d, teacherId: v.teacherId, from, to: till, reason: v.reason, note: v.note });
          TT.reliefSync(s, d);
        });
        R().date = dates[0];
      }
    });
  };
  actions.absenceDel = (el) => {
    const s = S(), a = s.absences.find((x) => x.id === el.dataset.id); if (!a) return;
    s.absences = s.absences.filter((x) => x !== a); TT.reliefSync(s, a.date); UI.commit();
  };

  // ---- cetak slip ----
  function slips(iso) {
    const s = S(), m = TT.maps(s), days = TT.days(s), day = TT.dateToDay(s, iso), sl = TT.slots(s);
    const needs = TT.reliefNeeds(s, iso);
    const head = `<h2>${esc(s.school.name)}</h2><h3>Agihan Guru Ganti (Relief) &mdash; ${day >= 0 ? days[day].name : ''}, ${TT.fmtDate(iso)}</h3>`;
    const line = (n, rec) => {
      const t = rec && rec.status === 'assigned' ? (m.teacher.get(rec.reliefTeacherId) || {}).name : rec ? (rec.status === 'kendiri' ? 'Kelas kendiri' : 'Gabung kelas') : '<b>BELUM DIAGIH</b>';
      return `<tr><td>${periodText(s, n.periods)}</td><td>${esc(TT.classNames(s, n.classIds))}</td><td>${esc((m.subject.get(n.subjectId) || {}).name)}</td><td>${esc((m.teacher.get(n.absentTeacherId) || {}).name)}</td><td>${rec && rec.status === 'assigned' ? esc(t) : t}</td><td>${esc((m.room.get(n.roomId) || {}).name || '')}</td></tr>`;
    };
    const all = needs.map((n) => line(n, TT.reliefRecord(s, n))).join('');
    let out = `<section class="sheet">${head}<table class="tbl"><thead><tr><th>Waktu</th><th>Kelas</th><th>Subjek</th><th>Guru tiada</th><th>Guru ganti</th><th>Bilik</th></tr></thead><tbody>${all}</tbody></table>
      <p>Disediakan oleh: ____________________ &nbsp; Disahkan: ____________________</p></section>`;
    const by = new Map();
    needs.forEach((n) => { const r = TT.reliefRecord(s, n); if (r && r.status === 'assigned') { if (!by.has(r.reliefTeacherId)) by.set(r.reliefTeacherId, []); by.get(r.reliefTeacherId).push([n, r]); } });
    out += `<section class="sheet slips">${[...by].map(([tid, list]) => {
      const t = m.teacher.get(tid);
      return `<div class="slip"><h4>SLIP GURU GANTI</h4><p><b>${esc(t.name)}</b> &mdash; ${day >= 0 ? days[day].name : ''}, ${TT.fmtDate(iso)}</p>
        <table class="tbl"><thead><tr><th>Waktu</th><th>Kelas</th><th>Subjek</th><th>Ganti</th><th>Bilik</th></tr></thead><tbody>${list.sort((a, b) => a[0].periods[0] - b[0].periods[0]).map(([n]) => `<tr><td>${periodText(s, n.periods)}</td><td>${esc(TT.classNames(s, n.classIds))}</td><td>${esc((m.subject.get(n.subjectId) || {}).name)}</td><td>${esc((m.teacher.get(n.absentTeacherId) || {}).name)}</td><td>${esc((m.room.get(n.roomId) || {}).name || '')}</td></tr>`).join('')}</tbody></table>
        <p class="sign">Tandatangan: ______________</p></div>`;
    }).join('')}</section>`;
    return out;
  }
  actions.reliefPrint = () => UI.print(slips(R().date));
  actions.reliefMsg = () => {
    const text = TT.reliefMessage(S(), R().date);
    UI.modalOpen('Mesej WhatsApp', `<textarea id="waText" rows="16" readonly>${esc(text)}</textarea><p class="hint">Tekan Salin, kemudian tampal dalam kumpulan WhatsApp guru.</p>`,
      '<button class="btn" data-act="modalClose">Tutup</button><button class="btn primary" data-act="copyMsg">Salin</button>', true);
  };
  actions.copyMsg = () => {
    const ta = document.getElementById('waText');
    UI.copyText(ta.value).then((ok) => {
      if (!ok) { ta.focus(); ta.select(); try { ok = document.execCommand('copy'); } catch (e) { ok = false; } }
      UI.toast(ok ? 'Disalin ke papan klip.' : 'Pilih teks dan salin secara manual.', ok ? '' : 'err');
    });
  };

  // ---- statistik ----
  function stats() {
    const s = S(), { from, to } = R();
    const st = TT.reliefStats(s, from, to), sum = st.summary;
    const rows = st.rows.filter((r) => !r.teacher.noRelief).sort((a, b) => b.periods - a.periods || a.teacher.name.localeCompare(b.teacher.name));
    const max = Math.max(1, ...rows.map((r) => r.periods));
    const body = rows.map((r) => {
      const hi = sum.sd > 0 && r.periods > sum.mean + sum.sd;
      return `<tr><td>${esc(r.teacher.name)}</td><td>${esc(r.teacher.dept)}</td><td class="${hi ? 'warn' : ''}"><b>${r.periods}</b></td><td>${r.sessions}</td><td>${r.load}</td><td>${r.absent || ''}</td>
        <td class="barcell"><div class="bar" style="width:${(r.periods / max) * 100}%"></div></td></tr>`;
    }).join('');
    return `<div class="toolbar"><label class="fld sm"><span>Dari</span><input type="date" value="${from}" data-chg="relFrom"></label>
        <label class="fld sm"><span>Hingga</span><input type="date" value="${to}" data-chg="relTo"></label>
        <button class="btn sm" data-act="relMonth">Bulan ini</button><span class="grow"></span><button class="btn" data-act="relCsv">Eksport CSV</button></div>
      <section class="stats">
        <div class="stat"><b>${sum.total}</b><span>Waktu relief diagih</span></div><div class="stat"><b>${sum.mean.toFixed(1)}</b><span>Purata seorang guru</span></div>
        <div class="stat"><b>${sum.max}</b><span>Tertinggi</span></div><div class="stat"><b>${sum.sd.toFixed(1)}</b><span>Sisihan piawai (kecil = adil)</span></div>
        <div class="stat ${sum.uncovered ? 'bad' : ''}"><b>${sum.uncovered}</b><span>Belum ada guru ganti</span></div><div class="stat"><b>${sum.kendiri}</b><span>Kelas kendiri / gabung</span></div></section>
      <section class="panel"><div class="tablewrap"><table class="tbl"><thead><tr><th>Guru</th><th>Panitia</th><th>Relief (waktu)</th><th>Sesi</th><th>Beban mengajar</th><th>Tidak hadir</th><th></th></tr></thead><tbody>${body || '<tr><td colspan="7" class="empty">Tiada data.</td></tr>'}</tbody></table></div>
      <p class="hint">Guru dengan skor kuning menerima relief lebih daripada purata + 1 sisihan piawai. Enjin cadangan sudah menolak mereka secara automatik pada hari berikutnya.</p></section>`;
  }
  changes.relFrom = (el) => { R().from = el.value; UI.render(); };
  changes.relTo = (el) => { R().to = el.value; UI.render(); };
  actions.relMonth = () => { [R().from, R().to] = UI.monthRange(TT.todayISO()); UI.render(); };
  actions.relCsv = () => {
    const st = TT.reliefStats(S(), R().from, R().to);
    UI.download(`statistik-relief-${R().from}-${R().to}.csv`, '﻿' + UI.csv([['Guru', 'Panitia', 'Relief (waktu)', 'Sesi', 'Beban mengajar', 'Tidak hadir (waktu)']].concat(st.rows.map((r) => [r.teacher.name, r.teacher.dept, r.periods, r.sessions, r.load, r.absent]))), 'text/csv');
  };

  // ---- sejarah ----
  function history() {
    const s = S(), m = TT.maps(s), { from, to, teacher } = R();
    const list = s.reliefs.filter((r) => r.date >= from && r.date <= to && (!teacher || r.reliefTeacherId === teacher || r.absentTeacherId === teacher))
      .sort((a, b) => b.date.localeCompare(a.date) || a.periods[0] - b.periods[0]);
    const rows = list.map((r) => `<tr><td>${TT.fmtDate(r.date)}</td><td>${r.periods.map((p) => p + 1).join(', ')}</td><td>${esc(TT.classNames(s, r.classIds))}</td><td>${esc((m.subject.get(r.subjectId) || {}).short || '')}</td>
      <td>${esc((m.teacher.get(r.absentTeacherId) || {}).name || '?')}</td><td>${r.status === 'assigned' ? esc((m.teacher.get(r.reliefTeacherId) || {}).name) : r.status === 'kendiri' ? '<i>Kelas kendiri</i>' : '<i>Gabung kelas</i>'}</td>
      <td class="acts"><button class="btn sm danger" data-act="histDel" data-id="${r.id}">Padam</button></td></tr>`).join('');
    return `<div class="toolbar"><label class="fld sm"><span>Dari</span><input type="date" value="${from}" data-chg="relFrom"></label>
        <label class="fld sm"><span>Hingga</span><input type="date" value="${to}" data-chg="relTo"></label>
        <label class="fld sm"><span>Guru</span><select data-chg="relTeacher"><option value="">Semua</option>${UI.optHtml(s.teachers.map((t) => ({ v: t.id, t: t.name })), teacher)}</select></label></div>
      <section class="panel"><div class="tablewrap"><table class="tbl"><thead><tr><th>Tarikh</th><th>Waktu</th><th>Kelas</th><th>Subjek</th><th>Guru tiada</th><th>Guru ganti</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="empty">Tiada rekod relief dalam julat ini.</td></tr>'}</tbody></table></div></section>`;
  }
  changes.relTeacher = (el) => { R().teacher = el.value; UI.render(); };
  actions.histDel = (el) => { S().reliefs = S().reliefs.filter((r) => r.id !== el.dataset.id); UI.save(); UI.render(); };
})();
