(function () {
  'use strict';
  const KEY = 'jadual-sekolah-v1';
  const esc = TT.esc;
  const $ = (id) => document.getElementById(id);

  const UI = window.UI = {
    state: null, page: 'utama', dataTab: 'guru', view: { type: 'class', id: null },
    lessonFilter: { cls: '', teacher: '', subject: '' },
    relief: { date: TT.todayISO(), tab: 'harian', from: '', to: '', teacher: '' },
    lastGen: null, actions: {}, changes: {}, pages: {}, esc, $
  };

  const monthRange = (iso) => {
    const [y, m] = iso.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, '0');
    return [`${y}-${mm}-01`, `${y}-${mm}-${String(last).padStart(2, '0')}`];
  };
  [UI.relief.from, UI.relief.to] = monthRange(UI.relief.date);
  UI.monthRange = monthRange;

  UI.load = () => {
    try { const raw = localStorage.getItem(KEY); if (raw) return TT.migrate(JSON.parse(raw)); } catch (e) { /* storan tiada atau rosak */ }
    return TT.newState();
  };
  UI.save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(UI.state)); } catch (e) { UI.toast('Gagal simpan ke pelayar (storan penuh atau disekat). Eksport JSON untuk backup.', 'err'); }
  };
  UI.commit = () => { TT.reconcile(UI.state); TT.prunePlacements(UI.state); UI.save(); UI.render(); };

  UI.toast = (msg, kind) => {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    $('toast').appendChild(el);
    setTimeout(() => el.remove(), kind === 'err' ? 6000 : 3200);
  };

  // ---------- modal ----------
  UI.modalOpen = (title, body, footer, wide) => {
    $('modal').innerHTML = `<div class="overlay" data-act="modalBg"><div class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-label="${esc(title)}">
      <div class="dlg-h"><h3>${esc(title)}</h3><button class="x" data-act="modalClose" aria-label="Tutup">×</button></div>
      <div class="dlg-b">${body}</div>${footer ? `<div class="dlg-f">${footer}</div>` : ''}</div></div>`;
    const first = $('modal').querySelector('input:not([type=checkbox]),select,textarea');
    if (first) first.focus();
  };
  UI.modalClose = () => { $('modal').innerHTML = ''; UI._form = null; };

  UI.confirm = (msg, yes, label) => {
    UI._yes = yes;
    UI.modalOpen('Pengesahan', `<p>${esc(msg)}</p>`, `<button class="btn" data-act="modalClose">Batal</button><button class="btn danger" data-act="confirmYes">${esc(label || 'Teruskan')}</button>`);
  };
  UI.actions.confirmYes = () => { const f = UI._yes; UI.modalClose(); if (f) f(); };
  UI.actions.modalClose = () => UI.modalClose();
  UI.actions.modalBg = (el, e) => { if (e.target === el) UI.modalClose(); };

  // ---------- borang generik ----------
  const optHtml = (opts, sel) => opts.map((o) => `<option value="${esc(o.v)}"${String(o.v) === String(sel) ? ' selected' : ''}>${esc(o.t)}</option>`).join('');
  UI.optHtml = optHtml;

  UI.availGrid = (state, value) => {
    const days = TT.days(state), slots = TT.slots(state), lim = TT.dayLimits(state);
    let h = '<table class="avail"><thead><tr><th></th>' + days.map((d, i) => `<th><button type="button" class="lnk" data-act="availCol" data-d="${i}">${d.short}</button></th>`).join('') + '</tr></thead><tbody>';
    slots.forEach((sl, p) => {
      h += `<tr><th><button type="button" class="lnk" data-act="availRow" data-p="${p}">${esc(sl.label)}</button></th>`;
      days.forEach((_, d) => {
        if (p >= lim[d]) h += '<td class="na">-</td>';
        else h += `<td class="av${value && value[`${d}-${p}`] ? ' off' : ''}" data-k="${d}-${p}" data-act="availCell"></td>`;
      });
      h += '</tr>';
    });
    return h + '</tbody></table><p class="hint">Klik petak untuk tandakan waktu guru <b>tidak boleh</b> mengajar (merah). Klik tajuk hari atau waktu untuk tanda satu lajur/baris.</p>';
  };
  UI.actions.availCell = (el) => el.classList.toggle('off');
  UI.actions.availCol = (el) => {
    const cells = [...el.closest('table').querySelectorAll(`td.av[data-k^="${el.dataset.d}-"]`)];
    const on = cells.some((c) => !c.classList.contains('off')); cells.forEach((c) => c.classList.toggle('off', on));
  };
  UI.actions.availRow = (el) => {
    const cells = [...el.closest('tr').querySelectorAll('td.av')];
    const on = cells.some((c) => !c.classList.contains('off')); cells.forEach((c) => c.classList.toggle('off', on));
  };

  UI.openForm = (spec) => {
    const v = spec.values || {};
    const body = spec.fields.map((f) => {
      const val = v[f.key] != null ? v[f.key] : (f.def != null ? f.def : '');
      const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : '';
      switch (f.type) {
        case 'select': return `<label class="fld"><span>${esc(f.label)}</span><select name="${f.key}">${optHtml(f.options, val)}</select>${hint}</label>`;
        case 'checkbox': return `<label class="fld chk"><input type="checkbox" name="${f.key}"${val ? ' checked' : ''}><span>${esc(f.label)}</span>${hint}</label>`;
        case 'multi': return `<div class="fld"><span>${esc(f.label)}</span><div class="multi">${f.options.map((o) => `<label class="chk"><input type="checkbox" name="${f.key}" value="${esc(o.v)}"${(val || []).includes(o.v) ? ' checked' : ''}>${esc(o.t)}</label>`).join('') || '<em>Tiada pilihan lagi</em>'}</div>${hint}</div>`;
        case 'avail': return `<div class="fld"><span>${esc(f.label)}</span>${UI.availGrid(UI.state, val)}</div>`;
        case 'textarea': return `<label class="fld"><span>${esc(f.label)}</span><textarea name="${f.key}" rows="${f.rows || 6}" placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>${hint}</label>`;
        default: return `<label class="fld"><span>${esc(f.label)}</span><input type="${f.type || 'text'}" name="${f.key}" value="${esc(val)}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}${f.required ? ' required' : ''}>${hint}</label>`;
      }
    }).join('');
    UI._form = spec;
    UI.modalOpen(spec.title, `<form id="theForm" onsubmit="return false">${body}</form><div id="formErr" class="err"></div>`,
      `<button class="btn" data-act="modalClose">Batal</button><button class="btn primary" data-act="formSave">${esc(spec.saveLabel || 'Simpan')}</button>`, spec.wide);
  };
  UI.collect = (spec, root) => {
    const out = {};
    for (const f of spec.fields) {
      if (f.type === 'checkbox') out[f.key] = root.querySelector(`[name="${f.key}"]`).checked;
      else if (f.type === 'multi') out[f.key] = [...root.querySelectorAll(`[name="${f.key}"]:checked`)].map((x) => x.value);
      else if (f.type === 'avail') { out[f.key] = {}; root.querySelectorAll('td.av.off').forEach((td) => { out[f.key][td.dataset.k] = true; }); }
      else {
        const el = root.querySelector(`[name="${f.key}"]`);
        out[f.key] = f.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value.trim();
      }
    }
    return out;
  };
  UI.actions.formSave = () => {
    const spec = UI._form; if (!spec) return;
    const form = $('theForm');
    const vals = UI.collect(spec, form);
    for (const f of spec.fields) if (f.required && (vals[f.key] === '' || vals[f.key] == null)) { $('formErr').textContent = `${f.label} wajib diisi.`; return; }
    const err = spec.onSave(vals);
    if (err) { $('formErr').textContent = err; return; }
    UI.modalClose(); UI.commit();
  };

  // ---------- cetak ----------
  UI.print = (html) => {
    $('printArea').innerHTML = html;
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); $('printArea').innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  };

  UI.download = (name, text, type) => {
    const blob = new Blob([text], { type: type || 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  UI.csv = (rows) => rows.map((r) => r.map((c) => { const x = String(c == null ? '' : c); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; }).join(',')).join('\r\n');

  UI.copyText = (text) => {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(() => true, () => false);
    return Promise.resolve(false);
  };
})();
