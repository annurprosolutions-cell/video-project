// JS port of the single-scattering atmosphere used in the shaders, so 2D layers
// (figures, palms, jetty...) get the same sun/sky colours as the WebGL backgrounds.
const Atmo = (() => {
  const R_PLANET = 6371e3, R_ATMOS = 6471e3, I_SUN = 22;
  const K_RLH = [5.5e-6, 13.0e-6, 22.4e-6];
  const SH_RLH = 8e3, SH_MIE = 1.2e3, G = 0.758;

  function rsi(r0, rd, sr) {
    const a = dot(rd, rd), b = 2 * dot(rd, r0), c = dot(r0, r0) - sr * sr;
    const d = b * b - 4 * a * c;
    if (d < 0) return [1e5, -1e5];
    const s = Math.sqrt(d);
    return [(-b - s) / (2 * a), (-b + s) / (2 * a)];
  }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

  function sky(dir, sunDir, kMie = 21e-6) {
    const r = norm(dir), pSun = norm(sunDir), r0 = [0, R_PLANET + 1000, 0];
    const p = rsi(r0, r, R_ATMOS);
    if (p[0] > p[1]) return [0, 0, 0];
    p[1] = Math.min(p[1], rsi(r0, r, R_PLANET)[0]);
    const IS = 16, JS = 8, iStep = (p[1] - p[0]) / IS;
    let iTime = 0, tR = [0, 0, 0], tM = [0, 0, 0], iOdR = 0, iOdM = 0;
    const mu = dot(r, pSun), mumu = mu * mu, gg = G * G;
    const pR = 3 / (16 * Math.PI) * (1 + mumu);
    const pM = 3 / (8 * Math.PI) * ((1 - gg) * (mumu + 1)) / (Math.pow(1 + gg - 2 * mu * G, 1.5) * (2 + gg));
    for (let i = 0; i < IS; i++) {
      const ip = add(r0, r, iTime + iStep * 0.5);
      const ih = Math.hypot(...ip) - R_PLANET;
      const odR = Math.exp(-ih / SH_RLH) * iStep, odM = Math.exp(-ih / SH_MIE) * iStep;
      iOdR += odR; iOdM += odM;
      const jStep = rsi(ip, pSun, R_ATMOS)[1] / JS;
      let jt = 0, jR = 0, jM = 0;
      for (let j = 0; j < JS; j++) {
        const jp = add(ip, pSun, jt + jStep * 0.5);
        const jh = Math.hypot(...jp) - R_PLANET;
        jR += Math.exp(-jh / SH_RLH) * jStep; jM += Math.exp(-jh / SH_MIE) * jStep; jt += jStep;
      }
      for (let c = 0; c < 3; c++) {
        const att = Math.exp(-(kMie * (iOdM + jM) + K_RLH[c] * (iOdR + jR)));
        tR[c] += odR * att; tM[c] += odM * att;
      }
      iTime += iStep;
    }
    return [0, 1, 2].map(c => I_SUN * (pR * K_RLH[c] * tR[c] + pM * kMie * tM[c]));
  }

  // colour of direct sunlight after passing through the atmosphere
  function sunColor(sunDir, kMie = 21e-6, alt = 1000) {
    const pSun = norm(sunDir), r0 = [0, R_PLANET + alt, 0];
    const far = rsi(r0, pSun, R_ATMOS)[1];
    const hit = rsi(r0, pSun, R_PLANET);
    const JS = 32, st = far / JS;
    let oR = 0, oM = 0;
    for (let j = 0; j < JS; j++) {
      const p = add(r0, pSun, st * (j + 0.5));
      const h = Math.hypot(...p) - R_PLANET;
      oR += Math.exp(-h / SH_RLH) * st; oM += Math.exp(-h / SH_MIE) * st;
    }
    let vis = 1;
    if (hit[0] > 0 && hit[0] < hit[1]) vis = 0; // below horizon: occluded by planet
    // soften the cut-off so dusk light fades instead of switching off
    const el = Math.asin(pSun[1]);
    const dip = Math.sqrt(2 * Math.max(alt - 1000, 0) / R_PLANET);
    vis = Math.min(1, Math.max(0, (el + dip + 0.02) / 0.03));
    return [0, 1, 2].map(c => I_SUN * Math.exp(-(kMie * 1.1 * oM + K_RLH[c] * oR)) * vis);
  }

  const sunDirFrom = (az, el) => [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];

  // Cheap summary of the lighting for a scene: sun colour, zenith/horizon sky, ambient.
  function light(sunAz, sunEl, kMie = 21e-6) {
    const sd = sunDirFrom(sunAz, sunEl);
    const sun = sunColor(sd, kMie);
    const sunHi = sunColor(sd, kMie, 3000);
    const zen = sky([0, 1, 0], sd, kMie);
    const horSun = sky(sunDirFrom(sunAz, 0.03), sd, kMie);
    const horAway = sky(sunDirFrom(sunAz + Math.PI, 0.03), sd, kMie);
    const horSide = sky(sunDirFrom(sunAz + Math.PI / 2, 0.05), sd, kMie);
    const amb = [0, 1, 2].map(c => (zen[c] * 0.5 + horSide[c] * 0.3 + horAway[c] * 0.2));
    return { sd, sun, sunHi, zen, horSun, horAway, amb };
  }

  return { sky, sunColor, sunDirFrom, light };
})();
