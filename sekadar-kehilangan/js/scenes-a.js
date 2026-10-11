// Scene helpers + scenes using the landscape shader.
function LP(o) {
  const a = new Array(32).fill(0);
  const v = (k, d) => (o[k] ?? d);
  [v('mist', 0), v('mistH', 150), v('haze', 1.5e-5), v('cover', .6),
   v('wave', 0), v('ripple', 0), v('waterDark', 0), v('padiWind', 1),
   v('stars', 0), v('milky', 0), v('moonPhase', 0), v('flash', 0),
   v('rainbow', 0), v('rays', 0), v('sunSize', .0058), v('sunGlow', 1),
   (o.sunUV || [.5, .5])[0], (o.sunUV || [.5, .5])[1], v('batas', 0), v('cloudAlt', 2500),
   v('camX', 0), v('camZ', 0), v('cloudSpeed', 6), v('cloudScale', 1 / 2800),
   ...(o.moonDir || [0, .3, 1]), v('moonSize', .02),
   v('night', 0), v('mistDrift', .004), v('groundTint', 0), v('ripe', 0)].forEach((x, i) => a[i] = x);
  return a;
}
// 2D zoom matching a slow camera push (env shader narrows fov, 2D layer scales about centre)
function zoom2D(ctx, fov0, fov, cx = W / 2, cy = H / 2) {
  const z = Math.tan(fov0 / 2) / Math.tan(fov / 2);
  ctx.setTransform(z, 0, 0, z, cx * (1 - z), cy * (1 - z));
  return z;
}
const lin = c => c; // documentation helper: colours below are linear albedo
function figLight(L, x, y, sunUV, o = {}) {
  // light for a 2D figure standing at (x,y): ambient + key, rim toward the sun position on screen
  const sx = sunUV[0] * W, sy = (1 - sunUV[1]) * H;
  const rimDir = Math.atan2(sy - (y - 150), sx - x);
  const rc = F.disp(L.sun.map(v => v * (o.rimK ?? .5)), L.exp);
  return {
    amb: L.amb, key: L.sun, front: o.front ?? .04, exp: L.exp, ambK: o.ambK ?? 1,
    rim: o.rim ?? .9, rimDir, rimW: o.rimW ?? 5, glow: o.glow ?? 6, halo: o.halo ?? 0,
    rimCol: `rgba(${rc[0]},${rc[1]},${rc[2]},1)`,
  };
}
function fillFor(albedo, Lf, extra = 0) { return F.css(F.shade(albedo, Lf, extra)); }

// soft glowing specks (pollen / dust in light)
function motes(ctx, t, o) {
  const r = F.rng(o.seed || 9);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < o.n; i++) {
    const bx = r() * W, by = o.y0 + r() * (o.y1 - o.y0), sp = .3 + r() * .7, ph = r() * 6.28, sz = o.size * (.4 + r() * .9);
    const x = (bx + Math.sin(t * .23 * sp + ph) * 40 + t * (o.drift ?? 6) * sp) % (W + 40) - 20;
    const y = by + Math.sin(t * .31 * sp + ph * 2) * 30 - t * (o.rise ?? 3) * sp;
    const a = o.a * (.5 + .5 * Math.sin(t * 1.3 * sp + ph)) * (o.fade ? o.fade(x, y) : 1);
    if (a <= .01) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, sz);
    g.addColorStop(0, `rgba(${o.col},${a})`); g.addColorStop(1, `rgba(${o.col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, sz, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// Foreground ridge (2D) with grass, returns ground function
function foreRidge(ctx, pts, fill, o = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-20, H + 20);
  ctx.lineTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i][0] + pts[i + 1][0]) / 2, yc = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
  }
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  ctx.lineTo(W + 20, H + 20);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (o.rimCol) {
    ctx.save(); ctx.clip();
    ctx.strokeStyle = o.rimCol; ctx.lineWidth = o.rimW || 4;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const xc = (pts[i][0] + pts[i + 1][0]) / 2, yc = (pts[i][1] + pts[i + 1][1]) / 2; ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc); }
    ctx.stroke(); ctx.restore();
  }
  ctx.restore();
  // ground height lookup (piecewise linear on control points)
  return x => {
    for (let i = 0; i < pts.length - 1; i++) if (x >= pts[i][0] && x <= pts[i + 1][0]) {
      const k = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]); return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k;
    }
    return pts[pts.length - 1][1];
  };
}

// ============ S1: misty highlands before sunrise, woman on the ridge ============
const HIGHLAND_LAYERS = [
  { d: 900, base: -.2, amp: .1, freq: 2.6, tree: 16, alb: [.03, .055, .028] },
  { d: 2000, base: -.125, amp: .09, freq: 2.2, tree: 21, alb: [.035, .06, .033] },
  { d: 4000, base: -.075, amp: .075, freq: 1.9, tree: 27, alb: [.04, .063, .04] },
  { d: 8000, base: -.038, amp: .062, freq: 1.6, alb: [.045, .065, .05] },
  { d: 16000, base: -.01, amp: .052, freq: 1.3, alb: [.05, .065, .06] },
  { d: 30000, base: .008, amp: .046, freq: 1.0, alb: [.055, .065, .07] },
];

function highlandScene(id, o) {
  return {
    id, scale: .7,
    fs: landscapeFS({ seed: o.seed, clouds: true, layers: HIGHLAND_LAYERS }),
    passes: landscapePasses(HIGHLAND_LAYERS.length, false),
    sun: lt => ({ az: o.sunAz, el: o.sunEl(lt), kMie: 22e-6 }),
    cam: lt => ({ yaw: o.yaw, pitch: -.035, fov: o.fov0 - lt * o.zoom, h: 430 }),
    exp: o.exp,
    params(lt, t, L) {
      const cam = this.cam(lt);
      return LP({ mist: o.mist, mistH: 170, haze: 1.2e-5, cover: o.cover, cloudAlt: 2600, cloudSpeed: 9, cloudScale: 1 / 2200,
        sunGlow: 1.2, sunUV: sunScreen(cam, L.sd), mistDrift: .006, camX: lt * 4 });
    },
    draw(ctx, lt, t, L) {
      const cam = this.cam(lt);
      const su = sunScreen(cam, L.sd);
      zoom2D(ctx, o.fov0, cam.fov, 640, 1250);
      // distant birds
      F.flock(ctx, lt, { n: 6, seed: 4, x0: -60, y0: 760, x1: 1150, y1: 620, t0: o.birdT, dur: 11, size: 9, spread: 130, col: F.css(F.disp(L.amb.map(v => v * .25), L.exp)), arc: -40 });
      // foreground ridge
      const ambDark = F.disp(L.amb.map(v => v * .05), L.exp);
      const rc = F.disp(L.sun.map(v => v * .35), L.exp);
      const ground = foreRidge(ctx, [[-20, 1290], [200, 1262], [420, 1228], [610, 1200], [720, 1192], [860, 1206], [1100, 1250]],
        F.css(ambDark), { rimCol: F.css(rc, .55), rimW: 5 });
      const fx = 705, fy = ground(fx) + 3;
      const Lf = figLight(L, fx, fy, su, { front: 0, ambK: .22, rim: 1, rimK: o.sunrise ? 1.3 : .9, rimW: 4, glow: 6, halo: o.sunrise ? .5 : .35 });
      F.woman(ctx, fx, fy, 345, {
        t: lt, wind: .32 + .12 * Math.sin(lt * .6),
        khimarFill: fillFor([.62, .45, .45], Lf), abayaFill: fillFor([.16, .16, .22], Lf), light: Lf, shadow: false,
      });
      F.grass(ctx, ground, { x0: -20, x1: 1100, n: 260, h: 34, col: F.css(ambDark), t: lt, wind: .35, seed: 21 });
      motes(ctx, lt, { n: 26, seed: 5, y0: 700, y1: 1250, size: 5, a: .35, col: '255,220,170', drift: 7, rise: 2 });
    },
  };
}

const SCN = window.SCN = {};
SCN.dawn = highlandScene('highlands-dawn', {
  seed: 3, sunAz: .62, sunEl: lt => -.022 + lt * .0018, yaw: .08, fov0: 1.0, zoom: .0024, exp: 2.0,
  mist: 1.5e-3, cover: .5, birdT: 6.5,
});

// ---------- shared helpers for landscape scenes
const camOf = (s, lt) => { const c = s.cam(lt); return { ...c, x: c.x || 0, z: c.z || 0 }; };
const projOf = cam => p => projectPt(cam, p);
const smooth = F.smooth;

// storm darkening of clouds (uP[7].z) is handled in landscape.js via STORM define
// ============ S4: golden-hour padi field, woman walking along the batas ============
SCN.padi = {
  id: 'padi-walk', scale: .7,
  fs: landscapeFS({ seed: 11, padi: true, clouds: true, sat: 1.1, layers: [
    { d: 700, base: .002, amp: .014, freq: 7, tree: 9, alb: [.03, .05, .025] },
    { d: 3500, base: .004, amp: .028, freq: 2.4, alb: [.04, .06, .045] },
    { d: 14000, base: -.004, amp: .1, freq: 1.05, alb: [.05, .065, .072] },
  ] }),
  passes: landscapePasses(3, false),
  sun: lt => ({ az: -.42, el: .085 - lt * .0016, kMie: 26e-6 }),
  cam: lt => ({ yaw: -.05, pitch: -.035, fov: .95, h: 1.65, x: 0, z: lt * .55 }),
  exp: .85,
  params(lt, t, L) {
    const cam = this.cam(lt);
    return LP({ mist: 2.5e-4, mistH: 60, haze: 2.2e-5, cover: .52, cloudAlt: 2200, cloudSpeed: 5, cloudScale: 1 / 2600,
      sunUV: sunScreen(cam, L.sd), batas: 0, camX: 0, camZ: cam.z, padiWind: 1, ripe: .18 });
  },
  draw(ctx, lt, t, L) {
    const cam = camOf(this, lt), proj = projOf(cam), su = sunScreen(cam, L.sd);
    const silh = F.css(F.disp(L.amb.map(v => v * .06), L.exp));
    // mid-distance coconut palms
    for (const [x, z, h, sd, ln] of [[-38, 95, 16, 2, -.05], [-46, 140, 18, 3, .04], [-31, 210, 15, 5, .02], [44, 120, 17, 7, .06], [58, 170, 19, 8, -.03], [36, 260, 14, 9, 0]]) {
      const b = proj([x, 0, z]), tp = proj([x, h, z]);
      if (b[2] > 1) F.palm(ctx, b[0], b[1], b[1] - tp[1], { col: silh, t: lt, seed: sd, lean: ln, wind: .3 });
    }
    // egrets
    for (let i = 0; i < 3; i++) {
      const k = (lt - 2 - i * .8) / 12;
      if (k < 0 || k > 1) continue;
      Props.egret(ctx, 1150 - k * 1300 + i * 70, 640 + i * 28 + Math.sin(lt + i) * 6, 13, lt * 4.2 + i * 1.7, F.css(F.disp(L.sun.map(v => v * .5 + .02), L.exp), .95));
    }
    // the woman walking ahead on the batas
    const z = cam.z + 11.5;
    const ft = proj([0, 0, z]), hd = proj([0, 1.62, z]);
    const Hpx = ft[1] - hd[1];
    const Lf = figLight(L, ft[0], ft[1], su, { front: .02, ambK: .28, rim: 1, rimK: 1.1, rimW: 3, glow: 5, halo: .3 });
    F.contactShadow(ctx, ft[0] + 18, ft[1] + 3, Hpx * .25, .4);
    F.woman(ctx, ft[0], ft[1], Hpx, { t: lt, wind: .22 + .08 * Math.sin(lt * .7), walk: true, phase: lt * 3.3,
      khimarFill: fillFor([.7, .6, .5], Lf), abayaFill: fillFor([.2, .23, .17], Lf), light: Lf, shadow: false });
    // foreground rice plants (out of focus, dark)
    F.grass(ctx, x => H + 10, { x0: -40, x1: 300, n: 70, h: 260, col: F.css(F.disp(L.amb.map(v => v * .09), L.exp), .92), t: lt, wind: .3, seed: 31 });
    F.grass(ctx, x => H + 10, { x0: 780, x1: 1120, n: 70, h: 280, col: F.css(F.disp(L.amb.map(v => v * .09), L.exp), .92), t: lt, wind: .3, seed: 32 });
    motes(ctx, lt, { n: 30, seed: 41, y0: 600, y1: 1300, size: 4, a: .45, col: '255,215,150', drift: 9, rise: 4 });
  },
};

// ============ S5: lake jetty, sunset -> dusk -> stars ============
SCN.lake = {
  id: 'lake-jetty', scale: .7,
  fs: landscapeFS({ seed: 21, water: true, clouds: true, stars: true, moon: true, layers: [
    { d: 1400, base: -.003, amp: .032, freq: 3.2, tree: 14, alb: [.02, .035, .022] },
    { d: 3600, base: .001, amp: .05, freq: 2.2, tree: 20, alb: [.028, .042, .033] },
    { d: 9500, base: .004, amp: .066, freq: 1.45, alb: [.04, .05, .058] },
  ] }),
  passes: landscapePasses(3, false),
  sun: lt => ({ az: .14, el: .04 - lt * .0082, kMie: 24e-6 }),
  cam: lt => ({ yaw: .03, pitch: -.04, fov: .98, h: 1.45, x: 0, z: 0 }),
  exp: lt => 1.0 + 7 * smooth(4, 19, lt),
  params(lt, t, L) {
    const cam = this.cam(lt);
    const night = smooth(10, 18, lt);
    return LP({ mist: 4e-4, mistH: 40, haze: 1.8e-5, cover: .54, cloudAlt: 2400, cloudSpeed: 4, cloudScale: 1 / 2400,
      wave: .035 + .02 * Math.sin(lt * .3), waterDark: .3, sunUV: sunScreen(cam, L.sd),
      stars: 1.2, milky: .35, night, moonDir: [-.32, .36, 1], moonSize: .022, moonPhase: .55 });
  },
  tweakLight(L, lt) { const n = smooth(9, 18, lt); L.amb = L.amb.map((v, i) => v + n * [.006, .009, .02][i]); },
  draw(ctx, lt, t, L) {
    const cam = camOf(this, lt), proj = projOf(cam), su = sunScreen(cam, L.sd);
    const dark = F.css(F.disp(L.amb.map(v => v * .12), L.exp));
    const edge = F.css(F.disp(L.sun.map(v => v * .25 + 0.001), L.exp), .8);
    const jt = Props.jetty(ctx, proj, { z0: 1.0, z1: 9.6, hw: .95, hDeck: .45, wood: dark, post: F.css(F.disp(L.amb.map(v => v * .07), L.exp), 1), edge,
      sheen: F.css(F.disp(L.sun.map(v => v * .12), L.exp), .5) });
    const ft = proj([0, .45, 8.6]), hd = proj([0, .45 + .92, 8.6]);
    const Hs = ft[1] - hd[1];
    const Lf = figLight(L, ft[0], ft[1], su, { front: .02, ambK: .5, rim: .9, rimK: .9, rimW: 3, glow: 5, halo: .2 });
    const lamp = smooth(11, 15, lt);
    // reflection of figure + lantern on the water
    const wy = proj([0, 0, 9.9])[1];
    ctx.save(); ctx.globalAlpha = .28; ctx.translate(0, wy * 2 + Hs * .3); ctx.scale(1, -1);
    F.woman(ctx, ft[0] - 4, ft[1], Hs, { t: lt, sit: true, wind: .1, khimarFill: fillFor([.5, .42, .45], Lf), abayaFill: fillFor([.18, .2, .26], Lf), light: null, shadow: false });
    ctx.restore();
    if (lamp > 0) Props.glow(ctx, ft[0] + Hs * .55, wy + Hs * .55, Hs * 1.2, '255,160,70', .25 * lamp);
    F.woman(ctx, ft[0] - 4, ft[1], Hs, { t: lt, sit: true, wind: .12, khimarFill: fillFor([.62, .5, .52], Lf), abayaFill: fillFor([.2, .22, .3], Lf), light: Lf, shadow: false });
    if (lamp > 0) Props.lantern(ctx, ft[0] + Hs * .55, ft[1] - Hs * .12, Hs * .09, lt, { k: lamp });
    F.flock(ctx, lt, { n: 5, seed: 12, x0: 1150, y0: 560, x1: -80, y1: 700, t0: 3, dur: 12, size: 8, spread: 120, col: F.css(F.disp(L.amb.map(v => v * .2), L.exp)) });
    if (lamp > 0) motes(ctx, lt, { n: 14, seed: 77, y0: 900, y1: 1250, size: 3, a: .7 * lamp, col: '200,255,170', drift: 2, rise: 1 }); // fireflies
  },
};

// ============ S6: night rain on the lake, lightning ============
const flashAt = (t, list) => list.reduce((a, [t0, k]) => a + k * Math.exp(-Math.max(0, t - t0) * 9) * (t >= t0 ? 1 : 0), 0);
SCN.nightRain = {
  id: 'night-rain', scale: .65,
  fs: landscapeFS({ seed: 33, water: true, ripples: true, clouds: true, sat: .9, layers: [
    { d: 1100, base: -.004, amp: .03, freq: 3, tree: 13, alb: [.02, .03, .022] },
    { d: 4000, base: .0, amp: .05, freq: 2, alb: [.03, .04, .04] },
  ] }),
  passes: landscapePasses(2, false),
  sun: () => ({ az: .2, el: -.35, kMie: 21e-6 }),
  cam: lt => ({ yaw: -.02, pitch: -.05, fov: 1.0, h: 1.3, x: 0, z: 0 }),
  exp: 6.0,
  flash(t) { return Math.min(.45, flashAt(t, [[74.02, .3], [74.2, .42], [76.83, .36], [77.0, .22], [78.9, .2]])); },
  tweakLight(L, lt, t) {
    const f = this.flash(t);
    L.amb = [.012 + f * .09, .016 + f * .1, .03 + f * .14]; L.sun = [0, 0, 0]; L.sunHi = [0, 0, 0];
  },
  params(lt, t, L) {
    return LP({ mist: 6e-4, mistH: 80, haze: 6e-5, cover: .22, cloudAlt: 1500, cloudSpeed: 9, cloudScale: 1 / 1800,
      wave: .05, ripple: 1.3, waterDark: .2, flash: this.flash(t) });
  },
  draw(ctx, lt, t, L) {
    const cam = camOf(this, lt), proj = projOf(cam);
    const f = this.flash(t);
    const hp = proj([-90, 0, 420]), s = proj([-90, 1, 420]);
    const ppm = hp[1] - s[1];
    Props.kampungHouse(ctx, hp[0], hp[1], ppm, { col: F.css(F.disp([.004 + f * .03, .006 + f * .035, .01 + f * .05], L.exp)), win: 'rgba(255,190,110,1)', glowCol: '255,170,80', glowA: .35 });
    // window reflection streak
    const g = ctx.createLinearGradient(0, hp[1], 0, hp[1] + 260);
    g.addColorStop(0, 'rgba(255,170,90,.35)'); g.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
    for (let i = 0; i < 9; i++) { const yy = hp[1] + 8 + i * 26, ww = 26 - i * 1.5 + Math.sin(t * 3 + i) * 4; ctx.fillRect(hp[0] - 1.2 * ppm - ww / 2 + Math.sin(t * 2.2 + i * 1.3) * 5, yy, ww, 9); }
    ctx.restore();
    Props.rain(ctx, t, { n: 420, len: 70, w: 1.3, col: `rgba(${f > .1 ? '230,235,255' : '170,185,210'},1)`, angle: .12, speed: 2400, seed: 5, a: .28 + f * .3 });
    Props.rain(ctx, t, { n: 60, len: 160, w: 2.4, col: 'rgba(170,185,210,1)', angle: .12, speed: 3600, seed: 6, a: .16 + f * .2 });
  },
};

// ============ S8: storm clearing, sunlit valley + rainbow ============
SCN.storm = {
  id: 'storm-rainbow', scale: .7,
  fs: landscapeFS({ seed: 41, clouds: true, rainbow: true, storm: true, sat: 1.15, layers: [
    { d: 900, base: -.2, amp: .1, freq: 2.4, tree: 10, alb: [.035, .07, .028] },
    { d: 2100, base: -.13, amp: .09, freq: 2.1, tree: 13, alb: [.04, .072, .035] },
    { d: 4500, base: -.08, amp: .07, freq: 1.8, tree: 17, alb: [.045, .07, .045] },
    { d: 9000, base: -.032, amp: .06, freq: 1.5, alb: [.06, .085, .07] },
    { d: 20000, base: -.006, amp: .05, freq: 1.2, alb: [.065, .08, .085] },
  ] }),
  passes: landscapePasses(5, false),
  sun: lt => ({ az: 2.84, el: .12 + lt * .002, kMie: 22e-6 }),
  cam: lt => ({ yaw: 0, pitch: .05 + lt * .0015, fov: 1.32 - lt * .004, h: 380, x: 0, z: 0 }),
  exp: 1.05,
  params(lt, t, L) {
    return LP({ mist: 1.3e-3, mistH: 140, haze: 1.6e-5, cover: .3 + smooth(2, 11, lt) * .14, cloudAlt: 1800, cloudSpeed: 14, cloudScale: 1 / 2000,
      rainbow: smooth(3.2, 6.5, lt) * 1.25, mistDrift: .01, camX: lt * 6, groundTint: 1.0 - smooth(5, 11, lt) * .3 });
  },
  draw(ctx, lt, t, L) {
    const cam = camOf(this, lt);
    zoom2D(ctx, 1.32, cam.fov, 760, 1250);
    const lit = F.disp(L.sun.map(v => v * .045 + .002), L.exp);
    const grassCol = F.css([Math.round(lit[0] * .32), Math.round(lit[1] * .5), Math.round(lit[2] * .26)]);
    const ground = foreRidge(ctx, [[-20, 1330], [260, 1300], [520, 1262], [690, 1236], [800, 1232], [920, 1246], [1100, 1280]], grassCol);
    // grass texture tint
    F.grass(ctx, ground, { x0: -20, x1: 1100, n: 300, h: 30, col: F.css([Math.round(lit[0] * .45), Math.round(lit[1] * .7), Math.round(lit[2] * .35)]), t: lt, wind: .4, seed: 51 });
    const fx = 790, fy = ground(fx) + 3, Hpx = 300;
    // cast shadow (sun behind camera -> shadow falls away from us)
    ctx.save(); ctx.fillStyle = 'rgba(0,10,0,.35)';
    ctx.beginPath(); ctx.ellipse(fx + 40, fy - 28, Hpx * .12, Hpx * .07, -.5, 0, 7); ctx.fill(); ctx.restore();
    const Lf = { amb: L.amb, key: L.sun, front: .14, exp: L.exp, ambK: .32, rim: 0 };
    F.woman(ctx, fx, fy, Hpx, { t: lt, wind: .35 + .1 * Math.sin(lt), khimarFill: fillFor([.55, .4, .4], Lf), abayaFill: fillFor([.18, .22, .2], Lf), light: null, shadow: false,
      folds: 'rgba(0,0,0,.12)' });
    // fading sunlit rain
    const rk = 1 - smooth(1, 6, lt);
    if (rk > 0) Props.rain(ctx, t, { n: 220, len: 60, w: 1.2, col: 'rgba(255,245,225,1)', angle: .2, speed: 2200, seed: 9, a: .22 * rk });
    F.flock(ctx, lt, { n: 7, seed: 3, x0: -80, y0: 980, x1: 1160, y1: 820, t0: 4.5, dur: 9, size: 9, spread: 160, col: 'rgba(20,24,20,.85)' });
  },
};

// ============ S10: father & daughter walking to the masjid before subuh ============
SCN.masjid = {
  id: 'masjid-dawn', scale: .7,
  fs: landscapeFS({ seed: 51, clouds: true, stars: true, moon: true, sat: 1.05, layers: [
    { d: 650, base: -.0005, amp: .012, freq: 6, tree: 10, alb: [.015, .02, .018] },
    { d: 3200, base: .002, amp: .03, freq: 2.3, alb: [.025, .03, .035] },
    { d: 11000, base: .0, amp: .055, freq: 1.3, alb: [.035, .04, .05] },
  ] }),
  passes: landscapePasses(3, false),
  sun: lt => ({ az: .28, el: -.115 + lt * .0022, kMie: 22e-6 }),
  cam: lt => ({ yaw: .04, pitch: -.03, fov: .96, h: 1.6, x: 0, z: lt * .9 }),
  exp: 9.0,
  params(lt, t, L) {
    return LP({ mist: 6e-4, mistH: 30, haze: 2e-5, cover: .6, cloudAlt: 2600, cloudSpeed: 3, cloudScale: 1 / 2600,
      stars: 1.0, milky: .12, night: .75, moonDir: [-.4, .42, 1], moonSize: .02, moonPhase: .62, camZ: lt * .9 });
  },
  tweakLight(L) { L.amb = L.amb.map((v, i) => v + [.003, .0045, .009][i]); },
  draw(ctx, lt, t, L) {
    const cam = camOf(this, lt), proj = projOf(cam);
    const silh = F.css(F.disp(L.amb.map(v => v * .05), L.exp));
    // path (dirt road) toward the mosque
    const pts = [];
    for (let z = cam.z + 2; z < 220; z += 4) pts.push([proj([-1.6 + Math.sin(z * .02) * .6, 0, z]), proj([1.6 + Math.sin(z * .02) * .6, 0, z])]);
    ctx.save(); ctx.fillStyle = F.css(F.disp(L.amb.map(v => v * .16), L.exp), .9);
    ctx.beginPath(); ctx.moveTo(pts[0][0][0], pts[0][0][1]);
    for (const p of pts) ctx.lineTo(p[0][0], p[0][1]);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][1][0], pts[i][1][1]);
    ctx.closePath(); ctx.fill(); ctx.restore();
    // grass field darkness either side of the road (ground plane is dark already)
    // mosque
    const mb = proj([10, 0, 230]), mt = proj([10, 1, 230]);
    Props.mosque(ctx, mb[0], mb[1], mb[1] - mt[1], { col: silh, win: 'rgba(255,205,130,1)', glowCol: '255,180,90', glowA: .22, t: lt });
    // palms + lamp posts
    for (const [x, z, h, sd, ln] of [[-9, 40, 13, 1, -.05], [-12, 85, 15, 2, .05], [11, 60, 14, 4, .03], [14, 120, 16, 6, -.04], [-15, 150, 15, 7, .02]]) {
      const b = proj([x, 0, z]), tp = proj([x, h, z]);
      if (b[2] > 1) F.palm(ctx, b[0], b[1], b[1] - tp[1], { col: silh, t: lt, seed: sd, lean: ln, wind: .15 });
    }
    for (const z of [30, 70, 110, 150, 190]) {
      const b = proj([2.6, 0, z]), tp = proj([2.6, 4.2, z]);
      if (b[2] < 1) continue;
      ctx.fillStyle = silh; ctx.fillRect(b[0] - 1, tp[1], 2, b[1] - tp[1]);
      Props.glow(ctx, tp[0], tp[1], (b[1] - tp[1]) * .9, '255,175,90', .45);
      Props.glow(ctx, tp[0], tp[1], (b[1] - tp[1]) * .15, '255,225,170', .9);
    }
    // father (jubah + kopiah, walking stick) and daughter (tudung + long dress)
    const z = cam.z + 9.5;
    const f0 = proj([-.45, 0, z]), f1 = proj([-.45, 1.7, z]);
    const d0 = proj([.42, 0, z + .3]), d1 = proj([.42, 1.12, z + .3]);
    const Lf = { amb: L.amb, key: [1.2, .8, .45], front: .0, exp: L.exp, ambK: 2.2, rim: .7, rimDir: -1.75, rimW: 2.5, glow: 4, halo: .15, rimCol: 'rgba(255,190,120,1)' };
    F.man(ctx, f0[0], f0[1], f0[1] - f1[1], { t: lt, walk: true, phase: lt * 3.0, stick: true, jubahFill: fillFor([.78, .76, .72], Lf), hairFill: fillFor([.06, .05, .05], Lf), capFill: fillFor([.9, .9, .88], Lf), light: Lf, shadowA: .3 });
    F.woman(ctx, d0[0], d0[1], d0[1] - d1[1], { t: lt, walk: true, phase: lt * 4.2 + 1, wind: .05, khimarFill: fillFor([.8, .55, .6], Lf), abayaFill: fillFor([.5, .45, .62], Lf), light: Lf, shadowA: .3 });
  },
};

// ============ S12: sea cliff at golden hour, waves on the rocks ============
SCN.ocean = {
  id: 'ocean-cliff', scale: .7,
  fs: landscapeFS({ seed: 61, water: true, clouds: true, sat: 1.12, layers: [
    { d: 5200, base: -.004, amp: .03, freq: 2.2, alb: [.03, .045, .04] },
    { d: 15000, base: -.002, amp: .03, freq: 1.4, alb: [.045, .055, .065] },
  ] }),
  passes: landscapePasses(2, false),
  sun: lt => ({ az: .2, el: .075 - lt * .0018, kMie: 24e-6 }),
  cam: lt => ({ yaw: .06, pitch: -.07 + lt * .003, fov: 1.0, h: 26 - lt * .3, x: 0, z: 0 }),
  exp: 1.05,
  params(lt, t, L) {
    const cam = this.cam(lt);
    return LP({ mist: 1e-4, mistH: 50, haze: 1.6e-5, cover: .47, cloudAlt: 2300, cloudSpeed: 10, cloudScale: 1 / 2400,
      wave: .42, waterDark: .1, sunUV: sunScreen(cam, L.sd), sunGlow: 1.2 });
  },
  draw(ctx, lt, t, L) {
    const cam = camOf(this, lt), su = sunScreen(cam, L.sd);
    const rock = F.css(F.disp(L.amb.map(v => v * .07), L.exp));
    const rim = F.css(F.disp(L.sun.map(v => v * .3), L.exp), .7);
    const lift = lt * 6;
    // spray bursts against the rocks (every ~3.3 s)
    const r = F.rng(19);
    for (let b = 0; b < 5; b++) {
      const tb = 1.2 + b * 3.3, k = (lt - tb) / 2.4;
      if (k < 0 || k > 1) continue;
      for (let i = 0; i < 70; i++) {
        const a = -Math.PI / 2 + (r() - .5) * 1.8, v = 250 + r() * 420;
        const x = 600 + (r() - .5) * 140 + Math.cos(a) * v * k, y = 1325 + lift + Math.sin(a) * v * k + 380 * k * k;
        const sz = 3 + r() * 9;
        ctx.fillStyle = `rgba(255,240,215,${(1 - k) * .55})`;
        ctx.beginPath(); ctx.arc(x, y, sz * (1 + k), 0, 7); ctx.fill();
      }
    }
    Props.cliff(ctx, [[-20, 1180 + lift], [140, 1150 + lift], [300, 1128 + lift], [420, 1112 + lift], [470, 1118 + lift], [540, 1150 + lift], [600, 1235 + lift], [680, 1330 + lift], [760, 1420 + lift], [900, 1520 + lift], [1100, 1640 + lift], [1100, H + 20], [-20, H + 20]],
      rock, { rim, rimW: 3, rimFrom: 0, rimTo: 6 });
    const fx = 400, fy = 1117 + lift, Hpx = 330;
    const Lf = figLight(L, fx, fy, su, { front: 0, ambK: .22, rim: 1, rimK: 1.2, rimW: 4, glow: 6, halo: .35 });
    F.woman(ctx, fx, fy, Hpx, { t: lt, wind: -.75 - .2 * Math.sin(lt * 1.3), khimarFill: fillFor([.55, .45, .48], Lf), abayaFill: fillFor([.12, .14, .2], Lf), light: Lf, shadow: false });
    F.flock(ctx, lt, { n: 4, seed: 23, x0: 1150, y0: 520, x1: -60, y1: 640, t0: 2, dur: 10, size: 11, spread: 150, col: F.css(F.disp(L.amb.map(v => v * .1), L.exp)) });
  },
};

// ============ S14: night beach under the Milky Way, telekung in doa ============
SCN.nightBeach = {
  id: 'night-beach', scale: .7,
  fs: landscapeFS({ seed: 71, water: true, stars: true, sat: 1.05, layers: [
    { d: 9000, base: -.002, amp: .012, freq: 2.5, alb: [.01, .012, .015] },
  ] }),
  passes: landscapePasses(1, false),
  sun: () => ({ az: .5, el: -.4, kMie: 21e-6 }),
  cam: lt => ({ yaw: -.05, pitch: .02 + lt * .004, fov: 1.02, h: 1.4, x: 0, z: 0 }),
  exp: 7.0,
  tweakLight(L) { L.amb = [.01, .014, .03]; L.sun = [0, 0, 0]; L.sunHi = [0, 0, 0]; },
  params(lt, t, L) {
    return LP({ mist: 0, haze: 3e-5, wave: .12, waterDark: .3, stars: 1.6, milky: .9, night: 1 });
  },
  draw(ctx, lt, t, L) {
    // sand
    const sandY = 1210;
    const g = ctx.createLinearGradient(0, sandY - 20, 0, H);
    g.addColorStop(0, 'rgba(46,52,70,1)'); g.addColorStop(.25, 'rgba(26,28,38,1)'); g.addColorStop(1, 'rgba(8,8,12,1)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-20, sandY + 10);
    for (let x = -20; x <= 1100; x += 40) ctx.lineTo(x, sandY + Math.sin(x * .006 + 1) * 10);
    ctx.lineTo(1100, H + 10); ctx.lineTo(-20, H + 10); ctx.closePath(); ctx.fill();
    // foam line
    const sw = Math.sin(lt * .9) * 18;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(150,170,210,${.22 - k * .06})`; ctx.lineWidth = 3 - k;
      ctx.beginPath();
      for (let x = -20; x <= 1100; x += 20) { const y = sandY - 6 + sw * (1 - k * .3) + Math.sin(x * .013 + lt * 1.2 + k) * 4 + k * 9; x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
    const fx = 520, fy = 1196, Hpx = 215;
    const Lf = { amb: [.009, .011, .018], key: [0, 0, 0], front: 0, exp: L.exp, ambK: 1, rim: .35, rimDir: -1.4, rimW: 3, glow: 4, halo: .08, rimCol: 'rgba(170,190,255,1)' };
    F.doa(ctx, fx, fy, Hpx, { t: lt, wind: .1, topFill: fillFor([.66, .67, .71], Lf), kainFill: fillFor([.56, .57, .62], Lf), light: Lf });
  },
};

// ============ S15: sunrise over the misty highlands (closing) ============
SCN.sunrise = highlandScene('highlands-sunrise', {
  seed: 3, sunAz: .2, sunEl: lt => -.004 + lt * .0032, yaw: .08, fov0: 1.0, zoom: .002, exp: 1.25,
  mist: 1.6e-3, cover: .48, birdT: 2.5, sunrise: true,
});
