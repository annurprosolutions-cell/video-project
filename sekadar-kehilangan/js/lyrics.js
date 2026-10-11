// Lyric layer drawn on a 2D canvas: word-by-word reveal + roll-up of the previous line.
const Lyrics = (() => {
  let lines = [];
  const LEAD = 0.32;        // line arrives slightly before it is sung
  const SWITCH = 0.55;      // roll-up duration
  const ANCHOR = 1440;      // bottom of the current line block (px)
  const GAP = 24, MAXW = 860, CX = 520;
  const EM = /^(Tuhan|Ilahi|sujud|rahmat|redha|padaMu|KepadaMu|Rabbul|Izzati|tenang)[,?]?$/;
  const STY = {
    v: { font: "600 70px 'Cormorant Garamond'", size: 70 },
    c: { font: "600 76px 'Cormorant Garamond'", size: 76 },
    b: { font: "italic 500 72px 'Cormorant Garamond'", size: 72 },
    o: { font: "600 80px 'Cormorant Garamond'", size: 80 },
    hook: { font: "italic 500 104px 'Cormorant Garamond'", size: 104 },
    a: { font: "italic 500 50px 'Cormorant Garamond'", size: 50 },
  };
  const AR_FONT = "700 86px 'Amiri'";
  const TR_FONT = "500 31px 'Montserrat'";
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const eo = t => 1 - Math.pow(1 - clamp(t), 3);
  const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  const fontsNeeded = [
    "600 70px 'Cormorant Garamond'", "italic 500 72px 'Cormorant Garamond'", "500 40px 'Cormorant Garamond'",
    "700 86px 'Amiri'", "400 64px 'Amiri'", "500 31px 'Montserrat'", "500 28px 'Montserrat'",
  ];
  async function loadFonts() {
    await Promise.all(fontsNeeded.map(f => document.fonts.load(f, 'Aā ḥẓ لَا إِلَٰهَ')));
    await document.fonts.ready;
  }

  function wrap(ctx, words, maxW) {
    const sp = ctx.measureText(' ').width;
    const ws = words.map(w => ctx.measureText(w).width);
    const total = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
    if (total <= maxW || ws.length < 2) return [[0, ws.length]];
    let best = null;
    for (let k = 1; k < ws.length; k++) {
      const a = ws.slice(0, k).reduce((x, y) => x + y, 0) + sp * (k - 1);
      const b = ws.slice(k).reduce((x, y) => x + y, 0) + sp * (ws.length - k - 1);
      const m = Math.max(a, b);
      if (!best || m < best.m) best = { k, m };
    }
    return [[0, best.k], [best.k, ws.length]];
  }

  function build(data) {
    const ctx = document.createElement('canvas').getContext('2d');
    lines = data.lines.map((l, i) => {
      const hook = /^Sekadar kehilangan$/.test(l.text);
      const st = hook ? STY.hook : STY[l.kind] || STY.v;
      ctx.font = st.font;
      const toks = l.words.map(w => w.w);
      const rows = wrap(ctx, toks, MAXW);
      const lh = st.size * 1.12;
      const sp = ctx.measureText(' ').width;
      const words = [];
      let y = (l.ar ? 132 : 0) + st.size * .9;
      for (const [a, b] of rows) {
        const ws = toks.slice(a, b).map(w => ctx.measureText(w).width);
        const rw = ws.reduce((x, z) => x + z, 0) + sp * (ws.length - 1);
        let x = CX - rw / 2;
        for (let j = a; j < b; j++) {
          words.push({ w: toks[j], t: l.words[j].t, x, y, em: EM.test(toks[j]) });
          x += ws[j - a] + sp;
        }
        y += lh;
      }
      const h = (l.ar ? 132 : 0) + rows.length * lh;
      return { ...l, st, words, h, hook };
    });
  }
  function layout() {}

  function currentIndex(t) {
    let c = -1;
    for (let i = 0; i < lines.length; i++) if (t >= lines[i].t0 - LEAD) c = i;
    return c;
  }
  function slot(i, c) {
    if (c < 0 || i > c) return { y: ANCHOR - lines[i].h + 60, o: 0 };
    if (i === c) return { y: ANCHOR - lines[i].h, o: 1 };
    if (i === c - 1) return { y: ANCHOR - lines[c].h - GAP - lines[i].h, o: (lines[c].ar || lines[i].ar) ? 0 : .36 };
    return { y: ANCHOR - lines[c].h - GAP - lines[c - 1].h - GAP - lines[i].h, o: 0 };
  }

  // blurred text via the shadow trick (ctx.filter is far too slow on CPU canvases)
  function blurText(ctx, text, x, y, blur, color) {
    ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.shadowOffsetX = 10000; ctx.shadowOffsetY = 0;
    ctx.fillStyle = color; ctx.fillText(text, x - 10000, y);
    ctx.shadowOffsetX = 0;
  }
  function drawWord(ctx, w, x, y, k, sing, st) {
    if (k <= .003) return;
    ctx.globalAlpha = k * ctx.__lineAlpha;
    const yy = y + (1 - k) * 22;
    if (k < .985) { blurText(ctx, w.w, x, yy, (1 - k) * 12 + .5, w.em ? '#FFE0A8' : '#FFF7EA'); return; }
    if (sing) {
      ctx.shadowColor = 'rgba(255,205,140,.85)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 0;
      ctx.fillStyle = '#FFE6BC';
    } else {
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 3;
      ctx.fillStyle = w.em ? '#FFE0A8' : (st === STY.hook ? '#FFE9C4' : '#FFF7EA');
    }
    ctx.fillText(w.w, x, yy);
    if (sing) { // keep a dark shadow under the glow for legibility
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
      ctx.globalAlpha = k * ctx.__lineAlpha * .35;
      ctx.fillText(w.w, x, yy);
    }
  }

  function draw(ctx, t) {
    const c = currentIndex(t);
    if (c < 0) return;
    const sw = eio((t - (lines[c].t0 - LEAD)) / SWITCH);
    let tail = 1;
    const next = lines[c + 1];
    const endHold = lines[c].t1 + 1.5;
    if (!next || next.t0 - LEAD > endHold) tail = 1 - eo((t - endHold) / .8);
    if (tail <= 0) return;
    ctx.save();
    // soft backdrop behind the lyric area for legibility on bright scenes
    const bg = ctx.createLinearGradient(0, ANCHOR - 330, 0, ANCHOR + 90);
    bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(.55, `rgba(0,0,0,${.22 * tail})`); bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, ANCHOR - 330, W, 420);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    for (let i = Math.max(0, c - 2); i <= c; i++) {
      const l = lines[i];
      const a = slot(i, c - 1), b = slot(i, c);
      const y0 = a.y + (b.y - a.y) * sw;
      const o = (i === c ? 1 : a.o + (b.o - a.o) * sw) * tail;
      if (o <= .003) continue;
      ctx.__lineAlpha = o;
      if (l.ar) {
        const k = eo((t - (l.words[0].t - .35)) / .8);
        ctx.save();
        ctx.font = AR_FONT; ctx.textAlign = 'center'; ctx.direction = 'rtl';
        ctx.globalAlpha = k * o;
        ctx.shadowColor = 'rgba(255,190,110,.5)'; ctx.shadowBlur = 26 + (1 - k) * 20;
        ctx.fillStyle = '#FFE3B0';
        ctx.fillText(l.ar, CX, y0 + 100 + (1 - k) * 16);
        ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3;
        ctx.globalAlpha = k * o * .5;
        ctx.fillText(l.ar, CX, y0 + 100 + (1 - k) * 16);
        ctx.restore();
        ctx.textAlign = 'left'; ctx.direction = 'ltr';
      }
      ctx.font = l.st.font;
      for (let j = 0; j < l.words.length; j++) {
        const w = l.words[j];
        const k = eo((t - (w.t - .16)) / .5);
        const nextT = j + 1 < l.words.length ? l.words[j + 1].t : l.t1;
        const sing = i === c && t >= w.t - .05 && t < nextT + .1;
        drawWord(ctx, w, w.x, y0 + w.y, k, sing, l.st);
      }
    }
    ctx.restore();
    // Quran translation for the doa section
    const ta = clamp((t - 137.9) / .9) * (1 - clamp((t - 149.6) / .8));
    if (ta > .003) {
      ctx.save();
      ctx.globalAlpha = ta; ctx.textAlign = 'center';
      ctx.font = TR_FONT; ctx.fillStyle = 'rgba(255,248,235,.95)';
      ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 2;
      const y = 280 + (1 - ta) * 12;
      ctx.fillText('“Tiada Tuhan melainkan Engkau, Maha Suci Engkau,', 520, y);
      ctx.fillText('sesungguhnya aku termasuk orang-orang yang zalim.”', 520, y + 45);
      ctx.font = "500 24px 'Montserrat'"; ctx.letterSpacing = '3px'; ctx.globalAlpha = ta * .78;
      ctx.fillText('AL-ANBIYA’ 21:87', 520, y + 95);
      ctx.letterSpacing = '0px';
      ctx.restore();
    }
  }

  return { loadFonts, build, layout, draw };
})();
