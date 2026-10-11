// 2D drawing library: modest characters (khimar + jubah, telekung, baju Melayu/jubah + kopiah),
// birds, coconut palms, grass. Everything is drawn in display space with lighting that matches
// the WebGL background (colours come from Atmo + the same ACES tonemap).
const F = (() => {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const aces = x => clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14));
  // linear radiance -> display rgb (0..255), same curve as the shaders
  const disp = (c, exp = 1) => c.map(v => Math.round(255 * Math.pow(aces(Math.max(0, v) * exp), 1 / 2.2)));
  const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const mixc = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const mul = (a, b) => a.map((v, i) => v * (Array.isArray(b) ? b[i] : b));

  // Light model for a figure. albedo in 0..1, light = {amb, key (linear radiance), front (0..1), exp}
  function shade(albedo, L, extra = 0) {
    const c = albedo.map((a, i) => a * (L.amb[i] * (L.ambK ?? 1) + L.key[i] * (L.front + extra)));
    return disp(c, L.exp);
  }

  // ---------- path builders (unit height, origin at feet, y up -> canvas -y)
  function P(pts) { // pts: [[x,y],...] closed Catmull-Rom spline through points
    const p = new Path2D();
    const n = pts.length;
    const g = i => pts[(i + n) % n];
    p.moveTo(g(0)[0], -g(0)[1]);
    for (let i = 0; i < n; i++) {
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      p.bezierCurveTo(c1[0], -c1[1], c2[0], -c2[1], p2[0], -p2[1]);
    }
    p.closePath();
    return p;
  }
  const mirror = (half, closeBottom = true) => { // half: right side top->bottom, returns full ring
    const L = half.slice().reverse().map(([x, y]) => [-x, y]);
    return half.concat(L.filter(([x]) => Math.abs(x) > 1e-6 || !closeBottom));
  };

  // Woman, back view: khimar (long hijab to mid-back) over a loose abaya to the floor.
  // o: {t, wind (-1..1), walk (0/1), phase}
  function womanShapes(o) {
    const w = o.wind || 0, t = o.t || 0;
    const ph = o.phase ?? t * 3.2;
    const bob = o.walk ? Math.abs(Math.sin(ph)) * 0.006 : 0;
    const down = (x) => Math.sign(x) === Math.sign(w) || Math.abs(x) < 1e-6;
    const fl = (y, k) => w * Math.pow(Math.max(0, .84 - y), 1.15) * k;
    const flut = (x, y) => w * .018 * Math.sin(t * 5.7 + y * 16 + x * 9) * Math.max(0, .84 - y);
    // long khimar, bell shaped, hem curving down to mid-thigh at the back
    const kh = [[0, 1.0], [.034, .994], [.054, .976], [.065, .947], [.068, .915], [.071, .888], [.09, .856], [.115, .828], [.135, .797],
      [.152, .75], [.168, .672], [.184, .58], [.198, .505], [.19, .478], [.15, .458], [.08, .44], [0, .435]];
    const khimar = mirror(kh).map(([x, y]) => {
      const k = down(x) ? 1.25 : .75;
      const lift = (y < .56 && down(x)) ? Math.abs(w) * .04 * (1 + .5 * Math.sin(t * 6.3 + x * 25)) * (.56 - y) / .12 : 0;
      return [x + fl(y, .16 * k) + flut(x, y), y + lift + bob];
    });
    // abaya: soft A-line to the floor (feet hidden)
    const sw = o.walk ? Math.sin(ph) * .014 : 0;
    const ab = [[.14, .62], [.15, .47], [.152, .34], [.162, .2], [.184, .08], [.212 + sw, .012], [.16, -.002], [0, -.006]];
    const abaya = mirror(ab).map(([x, y]) => {
      const hemSway = y < .15 ? (x > 0 ? sw : -sw) * (1 - y / .15) : 0;
      return [x + fl(y, .07) + flut(x, y) * .4 + hemSway + (y < .1 ? w * .025 : 0), y + (y > .3 ? bob : 0)];
    });
    return { khimar: P(khimar), abaya: P(abaya), bbox: [-.25, -.02, .25, 1.02] };
  }

  // Woman sitting on the ground / jetty edge, back view.
  function womanSitShapes(o) {
    const w = o.wind || 0, t = o.t || 0;
    const fl = (y) => w * Math.max(0, .78 - y) * .12 + w * .01 * Math.sin(t * 5 + y * 12);
    const kh = [[0, 1.0], [.07, .985], [.09, .93], [.092, .86], [.105, .82], [.17, .77], [.215, .68], [.24, .56], [.245, .45], [.16, .41], [0, .4]];
    const khimar = mirror(kh).map(([x, y]) => [x + fl(y) * (Math.sign(x) === Math.sign(w) ? 1.2 : .8), y]);
    const ab = [[.2, .56], [.25, .4], [.27, .25], [.3, .1], [.33, .02], [.2, -.005], [0, -.01]];
    const abaya = mirror(ab).map(([x, y]) => [x + fl(y) * .3, y]);
    return { khimar: P(khimar), abaya: P(abaya), bbox: [-.36, -.02, .36, 1.02] };
  }

  // Man, back view: jubah to the ankles, kopiah, optional walking stick.
  function manShapes(o) {
    const w = o.wind || 0, t = o.t || 0, ph = o.phase ?? t * 3;
    const bob = o.walk ? Math.abs(Math.sin(ph)) * .006 : 0;
    const sway = o.walk ? Math.sin(ph) * .01 : 0;
    const fl = y => w * Math.max(0, .8 - y) * .05 + w * .006 * Math.sin(t * 5 + y * 10);
    const cap = P(mirror([[0, 1.0], [.045, .997], [.062, .985], [.064, .952], [.0, .95]]).map(([x, y]) => [x, y + bob]));
    const head = P(mirror([[0, .962], [.06, .955], [.066, .91], [.063, .885], [.055, .862], [.042, .845], [0, .84]]).map(([x, y]) => [x, y + bob]));
    const jb = [[.045, .85], [.1, .822], [.158, .8], [.18, .74], [.19, .6], [.196, .47], [.2, .44], [.15, .432], [.152, .4], [.156, .2], [.158 + sway, .04], [.16 + sway, .03], [.09, .025], [0, .022]];
    const jubah = P(mirror(jb).map(([x, y]) => [x + fl(y), y + (y > .3 ? bob : 0)]));
    const feet = P(mirror([[.06, .035], [.11 + sway * 2, .03], [.12 + sway * 2, 0], [.04, 0], [0, .0]]));
    return { cap, head, jubah, feet, bbox: [-.26, -.02, .3, 1.02] };
  }

  // Telekung in sujud, side view facing left. unit = body length.
  // Forehead and palms rest on the mat at the front; hips are the highest point; the top piece drapes to the floor.
  function sujudShapes() {
    const outer = P([[0, 0], [-.025, .03], [-.02, .075], [.015, .118], [.07, .142], [.12, .14], [.17, .152], [.26, .2], [.37, .272], [.48, .348],
      [.57, .41], [.635, .44], [.69, .438], [.735, .41], [.762, .345], [.775, .26], [.79, .18], [.83, .115], [.87, .06], [.885, .02], [.86, 0], [.5, 0], [.15, 0]]);
    const top = P([[0, 0], [-.025, .03], [-.02, .075], [.015, .118], [.07, .142], [.12, .14], [.17, .152], [.26, .2], [.37, .272], [.48, .348],
      [.57, .41], [.635, .44], [.69, .438], [.705, .405], [.67, .33], [.6, .24], [.5, .14], [.39, .06], [.3, .012], [.22, 0], [.08, 0]]);
    return { outer, top, bbox: [-.05, -.02, .9, .5] };
  }

  // Telekung, kneeling, hands raised in doa, back view: the cape lifts at the elbows.
  function doaShapes(o) {
    const w = o.wind || 0, t = o.t || 0;
    const fl = y => w * Math.max(0, .8 - y) * .06 + w * .008 * Math.sin(t * 4 + y * 9);
    const top = [[0, 1.0], [.06, .993], [.095, .965], [.112, .92], [.118, .875], [.15, .82], [.21, .77], [.27, .715], [.33, .655],
      [.372, .6], [.376, .57], [.35, .5], [.33, .42], [.31, .35], [.25, .31], [.14, .29], [0, .285]];
    const kain = [[.24, .42], [.31, .27], [.37, .14], [.425, .05], [.43, .015], [.36, -.004], [0, -.008]];
    return { top: P(mirror(top).map(([x, y]) => [x + fl(y), y])), kain: P(mirror(kain).map(([x, y]) => [x + fl(y) * .3, y])), bbox: [-.46, -.02, .46, 1.02] };
  }

  // ---------- generic layered drawing with rim light
  // parts: [{path, fill (css), rim?}] ; L: {rimCol 'rgba(r,g,b,1)', rimDir (rad, screen), rimW px, rim 0..1, glow px, halo 0..1}
  // NB: ctx.filter is very slow on CPU canvases, so blur is done by down/up-scaling small offscreens.
  const cpu = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; };
  const [OFF, OC] = cpu(16, 16), [SM, SC] = cpu(16, 16);
  const withA = (c, a) => c.replace(/[\d.]+\)$/, a.toFixed(3) + ')');
  function figMask(parts, H, flip, ox, oy, dx = 0, dy = 0) {
    OC.setTransform(H * flip, 0, 0, H, ox + dx, oy + dy);
    for (const pt of parts) if (pt.rim !== false) OC.fill(pt.path);
  }
  function softDraw(ctx, ow, oh, x, y, k, alpha = 1) { // blurred copy of OFF via down/up-scale
    const sw = Math.max(2, Math.ceil(ow / k)), sh = Math.max(2, Math.ceil(oh / k));
    if (SM.width < sw || SM.height < sh) { SM.width = Math.max(SM.width, sw); SM.height = Math.max(SM.height, sh); }
    SC.setTransform(1, 0, 0, 1, 0, 0); SC.clearRect(0, 0, SM.width, SM.height);
    SC.imageSmoothingEnabled = true; SC.drawImage(OFF, 0, 0, ow, oh, 0, 0, sw, sh);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(SM, 0, 0, sw, sh, x, y, ow, oh); ctx.restore();
  }
  function drawLayered(ctx, x, y, H, parts, L, flip = 1) {
    const rim = L && L.rim > 0;
    const m = 30, ow = Math.ceil(H * 1.25 + 2 * m), oh = Math.ceil(H * 1.15 + 2 * m), ox = ow / 2, oy = H * 1.06 + m;
    if (rim) {
      if (OFF.width < ow || OFF.height < oh) { OFF.width = Math.max(OFF.width, ow); OFF.height = Math.max(OFF.height, oh); }
      if (L.halo) { // light bleeding around the silhouette (drawn first; the figure covers its inside)
        OC.setTransform(1, 0, 0, 1, 0, 0); OC.globalCompositeOperation = 'source-over'; OC.clearRect(0, 0, OFF.width, OFF.height);
        OC.fillStyle = '#fff'; figMask(parts, H, flip, ox, oy);
        OC.setTransform(1, 0, 0, 1, 0, 0); OC.globalCompositeOperation = 'source-in';
        OC.fillStyle = withA(L.rimCol, L.halo); OC.fillRect(0, 0, ow, oh);
        softDraw(ctx, ow, oh, x - ox, y - oy, Math.max(2, Math.round((L.glow || 8) / 1.5)));
      }
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(H * flip, H);
    for (const pt of parts) {
      ctx.fillStyle = pt.fill;
      ctx.fill(pt.path);
      if (pt.detail) pt.detail(ctx);
    }
    ctx.restore();
    if (!rim) return;
    // directional rim: mask minus the mask shifted away from the light => edges facing the light
    const lx = Math.cos(L.rimDir), ly = Math.sin(L.rimDir), w = L.rimW || 5;
    OC.setTransform(1, 0, 0, 1, 0, 0); OC.globalCompositeOperation = 'source-over'; OC.clearRect(0, 0, OFF.width, OFF.height);
    OC.fillStyle = '#fff'; figMask(parts, H, flip, ox, oy);
    OC.globalCompositeOperation = 'destination-out'; figMask(parts, H, flip, ox, oy, -lx * w, -ly * w);
    OC.globalAlpha = .5; figMask(parts, H, flip, ox, oy, -lx * w * .5, -ly * w * .5); OC.globalAlpha = 1;
    OC.setTransform(1, 0, 0, 1, 0, 0); OC.globalCompositeOperation = 'source-in';
    OC.fillStyle = withA(L.rimCol, L.rim); OC.fillRect(0, 0, ow, oh);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(OFF, 0, 0, ow, oh, x - ox, y - oy, ow, oh);
    ctx.restore();
    if (L.glow) softDraw(ctx, ow, oh, x - ox, y - oy, Math.max(2, Math.round(L.glow / 2)), .6);
  }

  // Fabric fold lines (subtle), drawn in unit space.
  function folds(ctx, seed, lines, x0, x1, yTop, yBot, col) {
    const r = rng(seed);
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = .006; ctx.lineCap = 'round';
    for (let i = 0; i < lines; i++) {
      const x = lerp(x0, x1, (i + .5) / lines) + (r() - .5) * .02;
      ctx.beginPath();
      ctx.moveTo(x * .8, -yTop);
      ctx.bezierCurveTo(x * .9 + (r() - .5) * .02, -(yTop * .6 + yBot * .4), x * 1.05, -(yTop * .3 + yBot * .7), x * 1.12 + (r() - .5) * .02, -yBot);
      ctx.stroke();
    }
    ctx.restore();
  }

  function contactShadow(ctx, x, y, w, a = .45) {
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 0, x, y, w);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, w, w * .22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ---------- public figure drawers
  function woman(ctx, x, y, H, o) {
    const s = o.sit ? womanSitShapes(o) : womanShapes(o);
    const kh = o.khimarFill, ab = o.abayaFill;
    if (o.shadow !== false) contactShadow(ctx, x, y + 2, H * .22, o.shadowA ?? .35);
    drawLayered(ctx, x, y, H, [
      { path: s.abaya, fill: ab, detail: o.folds ? c => folds(c, 7, 7, -.14, .14, .44, .02, o.folds) : null },
      { path: s.khimar, fill: kh, detail: o.folds ? c => folds(c, 3, 5, -.12, .12, .8, .57, o.folds) : null },
    ], o.light);
  }
  function man(ctx, x, y, H, o) {
    const s = manShapes(o);
    if (o.shadow !== false) contactShadow(ctx, x, y + 2, H * .2, o.shadowA ?? .35);
    const parts = [
      { path: s.feet, fill: o.skinFill || o.jubahFill, rim: false },
      { path: s.jubah, fill: o.jubahFill, detail: o.folds ? c => folds(c, 11, 6, -.13, .13, .75, .05, o.folds) : null },
      { path: s.head, fill: o.hairFill },
      { path: s.cap, fill: o.capFill },
    ];
    drawLayered(ctx, x, y, H, parts, o.light);
    if (o.stick) {
      ctx.save(); ctx.translate(x, y); ctx.scale(H, H);
      ctx.strokeStyle = o.stickFill || o.hairFill; ctx.lineWidth = .014; ctx.lineCap = 'round';
      const sw = o.walk ? Math.sin((o.phase ?? o.t * 3)) * .02 : 0;
      ctx.beginPath(); ctx.moveTo(.205, -.46); ctx.lineTo(.25 + sw, 0); ctx.stroke();
      ctx.restore();
    }
  }
  function sujud(ctx, x, y, L, o) {
    const s = sujudShapes();
    if (o.shadow !== false) contactShadow(ctx, x + L * .42 * (o.flip || 1), y + 2, L * .55, .45);
    drawLayered(ctx, x, y, L, [
      { path: s.outer, fill: o.kainFill },
      { path: s.top, fill: o.topFill, detail: o.detail },
    ], o.light, o.flip || 1);
  }
  function doa(ctx, x, y, H, o) {
    const s = doaShapes(o);
    if (o.shadow !== false) contactShadow(ctx, x, y + 2, H * .5, .4);
    const shadeDetail = c => {
      const g = c.createLinearGradient(0, -1, 0, -.28);
      g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,.22)');
      c.fillStyle = g; c.fill(s.top);
      c.strokeStyle = 'rgba(0,0,0,.045)'; c.lineWidth = .006; c.lineCap = 'round';
      for (const [x0, x1] of [[-.07, -.2], [.07, .2], [-.12, -.3]]) {
        c.beginPath(); c.moveTo(x0 * .6, -.86); c.quadraticCurveTo(x0 + (x1 - x0) * .4, -.6, x1, -.32); c.stroke();
      }
    };
    drawLayered(ctx, x, y, H, [
      { path: s.kain, fill: o.kainFill },
      { path: s.top, fill: o.topFill, detail: shadeDetail },
    ], o.light);
  }

  // ---------- birds (flapping silhouettes)
  function bird(ctx, x, y, s, flap, col) {
    const a = Math.sin(flap) * .9;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-1, -a * .9);
    ctx.quadraticCurveTo(-.45, -a * .2 - .25, 0, .05);
    ctx.quadraticCurveTo(.45, -a * .2 - .25, 1, -a * .9);
    ctx.quadraticCurveTo(.45, -a * .2 - .05, 0, .22);
    ctx.quadraticCurveTo(-.45, -a * .2 - .05, -1, -a * .9);
    ctx.fill();
    ctx.restore();
  }
  function flock(ctx, t, o) { // o: {n, seed, x0,y0,x1,y1, t0, dur, size, col, spread}
    const r = rng(o.seed);
    for (let i = 0; i < o.n; i++) {
      const dl = r() * (o.stagger ?? .6), ox = (r() - .5) * o.spread, oy = (r() - .5) * o.spread * .45;
      const k = (t - o.t0 - dl) / o.dur;
      if (k < 0 || k > 1) { r(); r(); continue; }
      const px = lerp(o.x0, o.x1, k) + ox + Math.sin(t * .7 + i) * 6;
      const py = lerp(o.y0, o.y1, k) + oy + Math.sin(t * 1.3 + i * 2) * 5 + Math.sin(k * Math.PI) * (o.arc || 0);
      const sz = o.size * (.75 + r() * .5) * lerp(1, o.endScale ?? 1, k);
      bird(ctx, px, py, sz, t * (7 + r() * 3) + i, o.col);
    }
  }

  // ---------- coconut palm silhouette
  function palm(ctx, x, y, H, o) {
    const t = o.t || 0, lean = o.lean || 0, r = rng(o.seed || 1);
    const sway = Math.sin(t * .9 + (o.seed || 1)) * .015 + (o.wind || 0) * .02;
    const tx = x + (lean + sway) * H, ty = y - H;
    ctx.save();
    ctx.fillStyle = o.col; ctx.strokeStyle = o.col;
    // trunk (tapered, slightly curved)
    const cx = x + lean * H * .55 - .04 * H, cy = y - H * .55;
    ctx.beginPath();
    const w0 = H * .028, w1 = H * .016;
    ctx.moveTo(x - w0, y);
    ctx.quadraticCurveTo(cx - w0 * .8, cy, tx - w1, ty);
    ctx.lineTo(tx + w1, ty);
    ctx.quadraticCurveTo(cx + w0 * .8, cy, x + w0, y);
    ctx.closePath(); ctx.fill();
    // fronds
    const n = o.fronds || 11;
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i / (n - 1) - .5) * 3.6 + (r() - .5) * .25 + sway * 3;
      const len = H * (.3 + r() * .12);
      const droop = .55 + r() * .35;
      const ex = tx + Math.cos(ang) * len, ey = ty + Math.sin(ang) * len * .55 + len * droop * .55;
      const mx = tx + Math.cos(ang) * len * .55, my = ty + Math.sin(ang) * len * .55 - len * .08;
      // spine
      ctx.lineWidth = H * .005; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
      // leaflets
      ctx.lineWidth = H * .0035;
      const segs = 18;
      for (let k = 2; k < segs; k++) {
        const u = k / segs;
        const px = (1 - u) * (1 - u) * tx + 2 * (1 - u) * u * mx + u * u * ex;
        const py = (1 - u) * (1 - u) * ty + 2 * (1 - u) * u * my + u * u * ey;
        const dx = 2 * (1 - u) * (mx - tx) + 2 * u * (ex - mx), dy = 2 * (1 - u) * (my - ty) + 2 * u * (ey - my);
        const dl = Math.hypot(dx, dy), nx = -dy / dl, ny = dx / dl;
        const ll = H * .075 * Math.sin(u * Math.PI) * (.8 + r() * .4);
        for (const sgn of [1, -1]) {
          ctx.beginPath(); ctx.moveTo(px, py);
          ctx.lineTo(px + (nx * sgn * .8 + dx / dl * .55) * ll, py + (ny * sgn * .8 + dy / dl * .55) * ll + ll * .35);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // ---------- grass blades along a ground line (silhouette)
  function grass(ctx, pts, o) { // pts: function x->y ground, o: {x0,x1, n, h, col, t, wind, seed}
    const r = rng(o.seed || 3);
    ctx.save(); ctx.fillStyle = o.col;
    for (let i = 0; i < o.n; i++) {
      const x = lerp(o.x0, o.x1, r());
      const y = pts(x) + 2;
      const h = o.h * (.4 + r() * .8);
      const bend = (o.wind || .3) * h * .35 + Math.sin(o.t * 1.6 + x * .02) * h * .08;
      const w = 1.2 + r() * 2.2;
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.quadraticCurveTo(x + bend * .4, y - h * .6, x + bend, y - h);
      ctx.quadraticCurveTo(x + bend * .4 + w * .3, y - h * .6, x + w, y);
      ctx.fill();
    }
    ctx.restore();
  }

  return { clamp, lerp, smooth, ease, easeOut, rng, disp, css, mixc, mul, shade, woman, man, sujud, doa, bird, flock, palm, grass, contactShadow, P };
})();
