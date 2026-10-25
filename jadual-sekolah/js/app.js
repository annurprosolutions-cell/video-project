(function () {
  'use strict';
  const { esc, $ } = UI;
  const NAV = [['utama', 'Utama'], ['tetapan', 'Tetapan'], ['data', 'Data'], ['jadual', 'Jadual'], ['relief', 'Relief'], ['laporan', 'Laporan']];

  UI.render = () => {
    const y = window.scrollY, s = UI.state;
    $('app').innerHTML = `<header class="top"><div class="brand"><span class="logo">JS</span><div><b>Jadual Sekolah</b><small>${esc(s.school.name)}</small></div></div>
      <nav class="tabs">${NAV.map(([k, t]) => `<button class="${UI.page === k ? 'on' : ''}" data-act="goto" data-p="${k}">${t}</button>`).join('')}</nav></header>
      <main class="pg-${UI.page}">${UI.pages[UI.page]()}</main>
      <footer class="foot">Data disimpan dalam pelayar ini sahaja. Eksport JSON secara berkala sebagai backup.</footer>`;
    window.scrollTo(0, y);
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const f = UI.actions[el.dataset.act];
    if (f) f(el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-chg]'); if (!el) return;
    const f = UI.changes[el.dataset.chg];
    if (f) f(el, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('modal').firstChild && !UI._gen) UI.modalClose();
    if (e.key === 'Enter' && e.target.matches('#theForm input:not([type=checkbox])')) { e.preventDefault(); UI.actions.formSave(); }
  });

  UI.state = UI.load();
  UI.relief.date = TT.nextSchoolDay(UI.state, UI.relief.date);
  UI.render();
})();
