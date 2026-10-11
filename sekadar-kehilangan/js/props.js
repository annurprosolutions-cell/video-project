// 2D props: jetty, mosque, kampung house, lantern, rain, egrets, cliff, whale, sejadah, pelita.
const Props = (() => {
  const { rng, lerp, clamp } = F;

  // glow sprite (radial gradient, additive)
  function glow(ctx, x, y, r, col, a) {
    if (a <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(.25, `rgba(${col},${a * .45})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }

  // Wooden jetty in perspective. proj: world->screen; deck at height hDeck, from z0 to z1, half width hw.
  function jetty(ctx, proj, o) {
    const { z0, z1, hw, hDeck, wood, edge, post } = o;
    const P = (x, y, z) => proj([x, y, z]);
    // posts (below deck) + reflections
    for (let z = z1; z >= z0; z -= 2.4) {
      for (const sx of [-1, 1]) {
        const a = P(sx * hw * .92, hDeck, z), b = P(sx * hw * .92, -0.4, z);
        const w = Math.max(1.2, 0.12 / Math.max(z, .5) * H * .9);
        ctx.fillStyle = post; ctx.fillRect(a[0] - w / 2, a[1], w, b[1] - a[1]);
        // reflection
        const rb = P(sx * hw * .92, -hDeck - .4, z);
        const g = ctx.createLinearGradient(0, b[1], 0, rb[1]);
        g.addColorStop(0, post.replace(/[\d.]+\)$/, '.55)')); g.addColorStop(1, post.replace(/[\d.]+\)$/, '0)'));
        ctx.fillStyle = g; ctx.fillRect(a[0] - w / 2, b[1], w, rb[1] - b[1]);
      }
    }
    // deck top surface
    const n0l = P(-hw, hDeck, z0), n0r = P(hw, hDeck, z0), f0l = P(-hw, hDeck, z1), f0r = P(hw, hDeck, z1);
    ctx.fillStyle = wood;
    ctx.beginPath(); ctx.moveTo(n0l[0], n0l[1]); ctx.lineTo(f0l[0], f0l[1]); ctx.lineTo(f0r[0], f0r[1]); ctx.lineTo(n0r[0], n0r[1]); ctx.closePath(); ctx.fill();
    // front face (thickness)
    const n1l = P(-hw, hDeck - .18, z0), n1r = P(hw, hDeck - .18, z0), f1l = P(-hw, hDeck - .18, z1), f1r = P(hw, hDeck - .18, z1);
    ctx.fillStyle = post;
    ctx.beginPath(); ctx.moveTo(f0l[0], f0l[1]); ctx.lineTo(f0r[0], f0r[1]); ctx.lineTo(f1r[0], f1r[1]); ctx.lineTo(f1l[0], f1l[1]); ctx.closePath(); ctx.fill();
    for (const [a0, a1, b0, b1] of [[n0l, f0l, n1l, f1l], [n0r, f0r, n1r, f1r]]) {
      ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.lineTo(b1[0], b1[1]); ctx.lineTo(b0[0], b0[1]); ctx.closePath(); ctx.fill();
    }
    // planks
    ctx.strokeStyle = edge; ctx.lineWidth = 1;
    for (let z = z0; z < z1; z += .28) {
      const a = P(-hw, hDeck, z), b = P(hw, hDeck, z);
      ctx.globalAlpha = .55; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // sheen along the deck toward the light
    if (o.sheen) {
      const g = ctx.createLinearGradient(0, f0l[1], 0, n0l[1]);
      g.addColorStop(0, o.sheen); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(n0l[0], n0l[1]); ctx.lineTo(f0l[0], f0l[1]); ctx.lineTo(f0r[0], f0r[1]); ctx.lineTo(n0r[0], n0r[1]); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    return { far: P(0, hDeck, z1 - .9) };
  }

  // Mosque silhouette with lit windows. (x,y) = ground centre, s = scale (px per metre)
  function mosque(ctx, x, y, s, o) {
    const col = o.col, win = o.win, t = o.t || 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = col;
    // prayer hall + veranda
    ctx.fillRect(-14, -7, 28, 7);
    ctx.fillRect(-16, -1.2, 32, 1.2);
    // side domes
    for (const dx of [-9, 9]) { ctx.fillRect(dx - 2.4, -9.5, 4.8, 2.6); dome(ctx, dx, -9.5, 2.6, 3.4); spire(ctx, dx, -9.5 - 3.4, .6); }
    // main drum + onion dome
    ctx.fillRect(-5.2, -11, 10.4, 4.2);
    dome(ctx, 0, -11, 5.6, 7.2); spire(ctx, 0, -18.2, 1.1);
    // minaret
    ctx.fillRect(17, -24, 2.6, 24);
    ctx.fillRect(16.3, -19, 4, .7);
    ctx.fillRect(16.6, -26.5, 3.4, 2.6);
    dome(ctx, 18.3, -26.5, 1.8, 2.6); spire(ctx, 18.3, -29.1, .6);
    // lit arched windows
    ctx.fillStyle = win;
    for (let i = -5; i <= 5; i++) archWin(ctx, i * 2.4 - .55, -5.6, 1.1, 3.6);
    for (let i = -1; i <= 1; i++) archWin(ctx, i * 2.6 - .5, -10.4, 1.0, 2.4);
    archWin(ctx, 17.8, -16, .9, 2.2); archWin(ctx, 17.8, -22.5, .9, 1.6);
    ctx.restore();
    // window glow
    if (o.glowCol) glow(ctx, x, y - 4 * s, 22 * s, o.glowCol, o.glowA ?? .25);
    function dome(c, cx, by, r, h) {
      c.beginPath(); c.moveTo(cx - r, by);
      c.bezierCurveTo(cx - r * 1.25, by - h * .55, cx - r * .25, by - h * .8, cx, by - h);
      c.bezierCurveTo(cx + r * .25, by - h * .8, cx + r * 1.25, by - h * .55, cx + r, by);
      c.closePath(); c.fill();
    }
    function spire(c, cx, by, h) { c.fillRect(cx - .08, by - h, .16, h); c.beginPath(); c.arc(cx + .12, by - h - .25, .22, Math.PI * .6, Math.PI * 1.6); c.lineWidth = .1; c.strokeStyle = c.fillStyle; c.stroke(); }
    function archWin(c, wx, wy, w, h) { c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx, wy - h + w / 2); c.arc(wx + w / 2, wy - h + w / 2, w / 2, Math.PI, 0); c.lineTo(wx + w, wy); c.closePath(); c.fill(); }
  }

  // Malay kampung house on stilts
  function kampungHouse(ctx, x, y, s, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = o.col;
    for (const px of [-4.6, -2, .6, 3.2, 4.6]) ctx.fillRect(px - .12, -2.2, .24, 2.2);   // stilts
    ctx.fillRect(-5, -5.2, 10, 3.1);                                                     // walls
    ctx.beginPath(); ctx.moveTo(-6.2, -5); ctx.lineTo(0, -9.2); ctx.lineTo(6.2, -5); ctx.closePath(); ctx.fill(); // roof
    ctx.fillRect(-6.6, -2.3, 3.2, .3);                                                    // serambi
    ctx.fillStyle = o.win;
    ctx.fillRect(-3.4, -4.6, 1.4, 1.6); ctx.fillRect(1.4, -4.6, 1.4, 1.6);
    ctx.restore();
    if (o.glowCol) glow(ctx, x - 1.2 * s, y - 3.8 * s, 6 * s, o.glowCol, o.glowA ?? .4);
  }

  // hanging/standing lantern with flame flicker
  function lantern(ctx, x, y, s, t, o = {}) {
    const fl = .85 + .15 * Math.sin(t * 13.1) * Math.sin(t * 7.3 + 1);
    glow(ctx, x, y, s * 9, '255,170,80', .5 * fl * (o.k ?? 1));
    glow(ctx, x, y, s * 2.4, '255,214,150', .9 * fl * (o.k ?? 1));
    ctx.save(); ctx.fillStyle = o.frame || 'rgba(20,12,6,1)';
    ctx.fillRect(x - s * .55, y - s * 1.1, s * 1.1, s * .18);
    ctx.fillRect(x - s * .55, y + s * .9, s * 1.1, s * .2);
    ctx.fillRect(x - s * .6, y - s * 1.1, s * .1, s * 2.2); ctx.fillRect(x + s * .5, y - s * 1.1, s * .1, s * 2.2);
    ctx.restore();
  }

  // pelita (oil lamp) on the floor
  function pelita(ctx, x, y, s, t, k = 1) {
    const fl = .82 + .18 * Math.sin(t * 15.7) * Math.sin(t * 9.1 + 2) + .05 * Math.sin(t * 31);
    glow(ctx, x, y - s * 1.6, s * 26, '255,150,60', .38 * fl * k);
    glow(ctx, x, y - s * 1.6, s * 8, '255,200,120', .55 * fl * k);
    ctx.save();
    ctx.fillStyle = 'rgba(40,24,12,1)';
    ctx.beginPath(); ctx.ellipse(x, y, s * 1.6, s * .55, 0, 0, 7); ctx.fill();
    ctx.fillRect(x - s * .5, y - s * 1.1, s, s * 1.1);
    // flame
    const fh = s * (1.6 + .25 * Math.sin(t * 11));
    const g = ctx.createRadialGradient(x, y - s * 1.3 - fh * .4, 0, x, y - s * 1.3 - fh * .4, fh);
    g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(.4, 'rgba(255,190,90,.95)'); g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g; ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.moveTo(x - s * .35, y - s * 1.15);
    ctx.quadraticCurveTo(x - s * .45, y - s * 1.3 - fh * .5, x + Math.sin(t * 7) * s * .15, y - s * 1.2 - fh);
    ctx.quadraticCurveTo(x + s * .45, y - s * 1.3 - fh * .5, x + s * .35, y - s * 1.15);
    ctx.fill();
    ctx.restore();
  }

  // rain streaks (deterministic per time), o: {n, len, w, col, angle, speed, seed, y0, y1, a}
  function rain(ctx, t, o) {
    const r = rng(o.seed || 1);
    ctx.save(); ctx.strokeStyle = o.col; ctx.lineCap = 'round';
    const ang = o.angle ?? .18, sp = o.speed ?? 2600;
    const dx = Math.sin(ang), dy = Math.cos(ang);
    const span = (o.y1 ?? H) - (o.y0 ?? 0) + o.len;
    for (let i = 0; i < o.n; i++) {
      const depth = r(), x0 = r() * (W + 300) - 150, ph = r();
      const len = o.len * (.4 + depth * .9), sp2 = sp * (.6 + depth * .6);
      const y = (o.y0 ?? 0) + ((ph * span + t * sp2) % span) - o.len;
      const x = x0 + (y - (o.y0 ?? 0)) * dx / dy;
      ctx.globalAlpha = (o.a ?? .35) * (.35 + depth * .65);
      ctx.lineWidth = (o.w ?? 1.4) * (.5 + depth);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * len, y + dy * len); ctx.stroke();
    }
    ctx.restore();
  }

  // white egret in flight
  function egret(ctx, x, y, s, flap, col) {
    const a = Math.sin(flap);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, 0, 1.1, .28, -.08, 0, 7); ctx.fill();               // body
    ctx.beginPath(); ctx.moveTo(-1, -.05); ctx.quadraticCurveTo(-1.5, -.35, -1.9, -.2); ctx.lineWidth = .16; ctx.strokeStyle = col; ctx.stroke(); // neck tucked
    ctx.beginPath(); ctx.moveTo(.9, .05); ctx.lineTo(2.2, .25); ctx.lineWidth = .07; ctx.stroke();      // legs trailing
    ctx.beginPath(); ctx.moveTo(-.3, -.1); ctx.quadraticCurveTo(.1, -1.2 * a - .2, .9, -2.0 * a); ctx.quadraticCurveTo(.4, -.8 * a, .5, -.05); ctx.fill(); // wing
    ctx.restore();
  }

  // rocky headland / cliff silhouette
  function cliff(ctx, pts, fill, o = {}) {
    ctx.save(); ctx.fillStyle = fill;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
    if (o.rim) { ctx.strokeStyle = o.rim; ctx.lineWidth = o.rimW || 3; ctx.beginPath(); ctx.moveTo(pts[o.rimFrom || 0][0], pts[o.rimFrom || 0][1]); for (let i = (o.rimFrom || 0) + 1; i <= (o.rimTo ?? pts.length - 1); i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.globalCompositeOperation = 'lighter'; ctx.stroke(); }
    ctx.restore();
  }

  // humpback whale silhouette, facing right; (x,y) centre, L length px
  function whale(ctx, x, y, L, t, o) {
    const sw = Math.sin(t * 1.1) * .06;
    ctx.save(); ctx.translate(x, y); ctx.scale(L, L); ctx.rotate(o.tilt || 0);
    const g = ctx.createLinearGradient(0, -.12, 0, .12);
    g.addColorStop(0, o.top); g.addColorStop(1, o.belly);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(.5, 0);                                         // snout
    ctx.bezierCurveTo(.48, -.07, .3, -.11, .1, -.105);
    ctx.bezierCurveTo(-.1, -.1, -.28, -.07, -.38, -.03);
    ctx.quadraticCurveTo(-.45, -.01, -.5, 0 + sw * .3);       // peduncle
    // tail flukes
    ctx.quadraticCurveTo(-.56, -.09 + sw, -.66, -.12 + sw * 1.6);
    ctx.quadraticCurveTo(-.6, -.02 + sw, -.565, .005 + sw);
    ctx.quadraticCurveTo(-.6, .03 + sw, -.66, .13 + sw * 1.6);
    ctx.quadraticCurveTo(-.56, .08 + sw, -.5, .015 + sw * .3);
    ctx.quadraticCurveTo(-.4, .05, -.2, .075);
    ctx.bezierCurveTo(.05, .1, .3, .1, .44, .05);
    ctx.quadraticCurveTo(.5, .03, .5, 0);
    ctx.fill();
    // long pectoral fin
    ctx.beginPath(); ctx.moveTo(.22, .06);
    ctx.quadraticCurveTo(.12 + sw * .3, .2, -.06, .3 + sw);
    ctx.quadraticCurveTo(.08, .2, .14, .07); ctx.fill();
    // dorsal hump
    ctx.beginPath(); ctx.moveTo(-.2, -.09); ctx.quadraticCurveTo(-.24, -.13, -.28, -.08); ctx.fill();
    // ventral grooves hint
    ctx.strokeStyle = o.groove || 'rgba(255,255,255,.05)'; ctx.lineWidth = .004;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(.45 - i * .01, .03 + i * .008); ctx.quadraticCurveTo(.3, .07 + i * .006, .12, .085 + i * .004); ctx.stroke(); }
    ctx.restore();
  }

  // sejadah (prayer mat) in perspective: corners [nearL, nearR, farR, farL]
  function sejadah(ctx, c, o) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(c[0][0], c[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(c[i][0], c[i][1]); ctx.closePath();
    ctx.fillStyle = o.base; ctx.fill(); ctx.clip();
    // border + mihrab motif lines (bilinear map of unit square)
    const map = (u, v) => [lerp(lerp(c[0][0], c[1][0], u), lerp(c[3][0], c[2][0], u), v), lerp(lerp(c[0][1], c[1][1], u), lerp(c[3][1], c[2][1], u), v)];
    ctx.strokeStyle = o.line; ctx.lineWidth = 2.2;
    const quad = (u0, v0, u1, v1) => { const a = map(u0, v0), b = map(u1, v0), d = map(u1, v1), e = map(u0, v1); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...d); ctx.lineTo(...e); ctx.closePath(); ctx.stroke(); };
    quad(.06, .05, .94, .95); quad(.12, .1, .88, .9);
    ctx.beginPath();
    for (let k = 0; k <= 20; k++) { const u = .2 + .6 * k / 20; const v = .55 + .3 * Math.sin(Math.PI * k / 20); const p = map(u, v); k ? ctx.lineTo(...p) : ctx.moveTo(...p); }
    ctx.stroke();
    ctx.restore();
  }

  return { glow, jetty, mosque, kampungHouse, lantern, pelita, rain, egret, cliff, whale, sejadah };
})();
