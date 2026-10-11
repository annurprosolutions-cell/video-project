// Timeline + compositor. Each scene renders: sky LUT -> environment shader (FBO) + 2D layer (canvas),
// then the final pass blends one or two scenes (transitions) and adds grain/vignette.
const W = 1080, H = 1920;
const Engine = (() => {
  const { gl } = GL;
  const scenes = [];
  const cuts = [];           // [{at, dur, type}] between scene i and i+1
  let finalProg, lutProg;
  let lutTgt;
  const DUR = 163.68;

  const FINAL_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uEnvA, uFigA, uEnvB, uFigB, uOver;
uniform float uMix, uType, uT;
uniform vec4 uPost;
uniform vec2 uOut;
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 layer(sampler2D e, sampler2D f, vec2 uv){ vec4 fg=texture(f,uv); vec3 bg=texture(e,uv).rgb; return bg*(1.-fg.a)+fg.rgb; }
void main(){
  vec2 uv=vUv;
  vec3 c=layer(uEnvA,uFigA,uv);
  if(uMix>0.){
    vec3 b=layer(uEnvB,uFigB,uv);
    float k=uMix;
    if(uType<.5) c=mix(c,b,k);
    else if(uType<1.5){ vec3 wc=vec3(1.,.96,.88); c = k<.5 ? mix(c,wc,smoothstep(0.,1.,k*2.)) : mix(wc,b,smoothstep(0.,1.,k*2.-1.)); }
    else { c = k<.5 ? mix(c,vec3(0),smoothstep(0.,1.,k*2.)) : mix(vec3(0),b,smoothstep(0.,1.,k*2.-1.)); }
  }
  vec2 q=(uv-.5)*vec2(1.,1.12);
  float v=smoothstep(.9,.22,length(q));
  c*=mix(1.-uPost.y,1.,v);
  float g=hash12(floor(uv*uOut)+floor(fract(uT*24.)*97.)*13.1)-.5;
  c+=g*uPost.x*(1.-.6*c);
  c=mix(c,vec3(0),uPost.z);
  c=mix(c,vec3(1.,.97,.92),uPost.w);
  vec4 o=texture(uOver,uv);
  c=c*(1.-o.a)+o.rgb;
  fragColor=vec4(c,1.);
}`;

  function add(s) { scenes.push(s); }
  function cut(at, dur = 1.0, type = 0) { cuts.push({ at, dur, type }); }

  let overCnv, overCtx, overTex;
  function init() {
    overCnv = document.createElement('canvas'); overCnv.width = W; overCnv.height = H;
    overCtx = overCnv.getContext('2d', { willReadFrequently: true });
    overTex = GL.canvasTexture();
    finalProg = GL.program(FINAL_FS);
    lutProg = GL.program(SKY_LUT_FS);
    lutTgt = GL.target(128, 128, gl.LINEAR, true);
    for (const s of scenes) {
      s.scale = s.scale || .75;
      s.prog = GL.program(GLSL_HEAD + GLSL_LIB + s.fs);
      s.passList = (s.passes || []).map(ps => ({
        ...ps,
        prog: GL.program(GLSL_HEAD + `#define ${ps.define}\n` + GLSL_LIB + s.fs),
        tgt: GL.target(ps.w || Math.round(W * ps.scale), ps.h || Math.round(H * ps.scale), gl.LINEAR, !!ps.float),
      }));
      s.env = GL.target(Math.round(W * s.scale), Math.round(H * s.scale), gl.LINEAR);
      s.cnv = document.createElement('canvas'); s.cnv.width = W; s.cnv.height = H;
      s.ctx = s.cnv.getContext('2d', { willReadFrequently: true });
      s.figTex = GL.canvasTexture();
    }
    // scene spans from cuts
    for (let i = 0; i < scenes.length; i++) {
      const a = i === 0 ? { at: 0, dur: 0 } : cuts[i - 1];
      const b = i === scenes.length - 1 ? { at: DUR + 1, dur: 0 } : cuts[i];
      scenes[i].t0 = a.at - a.dur / 2; scenes[i].t1 = b.at + b.dur / 2;
      scenes[i].cutIn = a.at; scenes[i].cutOut = b.at;
    }
  }

  function renderScene(s, t) {
    const lt = t - s.t0;
    const sun = s.sun ? s.sun(lt, t) : { az: 0, el: -.3, kMie: 21e-6 };
    const kMie = sun.kMie || 21e-6;
    const L = Atmo.light(sun.az, sun.el, kMie);
    if (s.tweakLight) s.tweakLight(L, lt, t);
    const cam = s.cam ? s.cam(lt, t) : { yaw: 0, pitch: 0, fov: 1.1, h: 2 };
    const exp = typeof s.exp === 'function' ? s.exp(lt, t) : (s.exp ?? 1);
    const P = new Float32Array(32);
    if (s.params) s.params(lt, t, L).forEach((v, i) => P[i] = v);
    const common = {
      uT: t, uLT: lt, uSunDir: L.sd, uSunCol: L.sun, uSunColHi: L.sunHi, uAmb: L.amb, uExp: exp,
      uCam: [cam.yaw, cam.pitch, cam.fov, cam.h], uP: P,
      uAzR: [cam.yaw - Math.atan(Math.tan(cam.fov / 2) * W / H) - .25, cam.yaw + Math.atan(Math.tan(cam.fov / 2) * W / H) + .25],
    };
    if (s.lut !== false) GL.draw(lutProg, lutTgt, { ...common, uRes: [128, 128], uKMie: kMie });
    const tex = { uSky: lutTgt.tex, ...(s.textures ? s.textures(lt, t) : {}) };
    for (const ps of s.passList) {
      GL.draw(ps.prog, ps.tgt, { ...common, uRes: [ps.tgt.w, ps.tgt.h] }, tex);
      tex[ps.name] = ps.tgt.tex;
    }
    GL.draw(s.prog, s.env, { ...common, uRes: [s.env.w, s.env.h] }, tex);
    const ctx = s.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (s.draw) s.draw(ctx, lt, t, { ...L, exp, cam });
    GL.upload(s.figTex, s.cnv);
  }

  let lastStats = {};
  function frame(t) {
    const act = scenes.filter(s => t >= s.t0 && t < s.t1);
    if (!act.length) act.push(scenes[scenes.length - 1]);
    let A = act[0], B = act[1], mix = 0, type = 0;
    const t0 = performance.now();
    renderScene(A, t);
    if (B) {
      const c = cuts[scenes.indexOf(A)];
      mix = Math.min(1, Math.max(0, (t - (c.at - c.dur / 2)) / c.dur));
      type = c.type;
      renderScene(B, t);
    }
    overCtx.setTransform(1, 0, 0, 1, 0, 0);
    overCtx.clearRect(0, 0, W, H);
    Lyrics.draw(overCtx, t);
    Titles.draw(overCtx, t);
    GL.upload(overTex, overCnv);
    const fadeIn = 1 - Math.min(1, t / 1.2);
    const fadeOut = Math.min(1, Math.max(0, (t - (DUR - 1.4)) / 1.3));
    GL.draw(finalProg, null, {
      uMix: mix, uType: type, uT: t, uOut: [W, H],
      uPost: [0.045, 0.28, Math.max(fadeIn, fadeOut), 0],
    }, { uEnvA: A.env.tex, uFigA: A.figTex, uEnvB: (B || A).env.tex, uFigB: (B || A).figTex, uOver: overTex });
    gl.finish();
    lastStats = { ms: performance.now() - t0, scenes: act.map(s => s.id) };
    return lastStats;
  }

  return { add, cut, init, frame, scenes, DUR };
})();

// Intro/outro title cards (canvas)
const Titles = (() => {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const vis = (t, a, b, fi = .9, fo = .9) => clamp((t - a) / fi) * (1 - clamp((t - b) / fo));
  function card(ctx, o, y0, withAr) {
    if (o <= .002) return;
    ctx.save();
    ctx.globalAlpha = o;
    ctx.translate(0, (1 - o) * 14);
    // soft dark backdrop for legibility
    const g = ctx.createRadialGradient(540, y0 + 170, 40, 540, y0 + 170, 520);
    g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y0 - 300, W, 900);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#FFF6E6';
    ctx.font = "italic 500 132px 'Cormorant Garamond'";
    ctx.fillText('Sekadar', 540, y0 + 110);
    ctx.fillText('Kehilangan', 540, y0 + 235);
    ctx.shadowBlur = 0;
    const lg = ctx.createLinearGradient(480, 0, 600, 0);
    lg.addColorStop(0, 'rgba(243,215,166,0)'); lg.addColorStop(.5, 'rgba(243,215,166,1)'); lg.addColorStop(1, 'rgba(243,215,166,0)');
    ctx.fillStyle = lg; ctx.fillRect(480, y0 + 280, 120, 2);
    ctx.shadowBlur = 14;
    if (!withAr) {
      ctx.font = "500 28px 'Montserrat'"; ctx.fillStyle = '#F5E3C3';
      ctx.letterSpacing = '12px';
      ctx.fillText('VIDEO LIRIK', 546, y0 + 345);
      ctx.letterSpacing = '0px';
    } else {
      ctx.direction = 'rtl'; ctx.font = "400 64px 'Amiri'"; ctx.fillStyle = '#FFE3B0';
      ctx.fillText('إِنَّا لِلَّٰهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ', 540, y0 + 395);
      ctx.direction = 'ltr'; ctx.font = "italic 500 40px 'Cormorant Garamond'"; ctx.fillStyle = '#FFF1DA';
      ctx.fillText('Sesungguhnya kita milik Allah, dan kepada-Nya kita kembali', 540, y0 + 470);
    }
    ctx.restore();
  }
  return {
    draw(ctx, t) {
      card(ctx, vis(t, .9, 4.4), 470, false);
      card(ctx, vis(t, 159.6, 162.5, 1.2, 1.1), 330, true);
    },
  };
})();

window.setT = t => Engine.frame(t);
