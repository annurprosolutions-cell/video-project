// Custom-shader scenes: aerial rainforest river, underwater whale.

// ============ S11: flying over the rainforest and a winding river ============
SCN.aerial = {
  id: 'aerial-river', scale: .62,
  fs: `
float riverX(float z){ return 70.*sin(z*.0042)+28.*sin(z*.011+1.3); }
// rounded tree crowns: nearest feature point gives a dome; normal from the dome + leaf noise
vec4 crowns(vec2 p, float sz, float seed){
  vec2 g=p/sz; vec2 id=floor(g), f=fract(g);
  float best=-1.; vec2 bo=vec2(0); vec2 bid=vec2(0); float br=1.;
  for(int a=-1;a<=1;a++) for(int b=-1;b<=1;b++){
    vec2 o=vec2(a,b); vec2 cid=id+o;
    vec3 hh=hash32(cid+seed);
    vec2 c=o+hh.xy*.8+.1;
    float r=.55+.4*hh.z;
    vec2 d=f-c; float q=1.-dot(d,d)/(r*r);
    float hgt=q>0.?sqrt(q)*r*(.7+.6*hash12(cid*1.3+seed)):-1.;
    if(hgt>best){ best=hgt; bo=d; bid=cid; br=r; }
  }
  return vec4(best, bo/br, hash12(bid+seed*3.));
}
vec3 canopyCol(vec2 p, out float h){
  vec4 a=crowns(p, 13., 0.);
  vec4 b=crowns(p+37., 7., 11.);
  vec4 c=a.x>=b.x*.8?a:b;
  h=max(c.x,0.);
  vec2 lp=p*.6;
  vec3 n=normalize(vec3(c.y*1.4+gnoise(lp*2.)*.35, max(c.x,.05)+.3, c.z*1.4+gnoise(lp*2.+7.)*.35));
  float diff=max(dot(n,normalize(uSunDir)),0.);
  float ao=smoothstep(-.1,.6,c.x);
  vec3 base=mix(vec3(.035,.085,.025), vec3(.09,.15,.04), c.w);
  if(c.w>.93) base=mix(base, vec3(.2,.19,.06), .65);
  if(c.w<.035) base=mix(base, vec3(.16,.09,.05), .55);
  float leaf=fbm(p*1.7,4)*.5+.5;
  return base*(.55+.6*leaf)*(uAmb*ao*.9+uSunCol*diff*ao*1.2);
}
void main(){
  vec3 rd=camRay(gl_FragCoord.xy);
  vec3 ro=vec3(uP[0].x, uCam.w, uP[0].y);
  vec3 col;
  if(rd.y>-.01){
    col=skyLut(rd)+sunDisc(rd,.006,1.);
    vec4 cl=cloudDeck(ro,rd,2200.,.55,1./2400.,vec2(uLT*.003,0.),.3,5);
    col=mix(col,cl.rgb,cl.a);
    // distant hills on the horizon
    float az=azOf(rd), el=elOf(rd);
    float hill=.012+.02*(fbm(vec2(az*3.,1.),4)*.5+.5);
    if(el<hill){ col=mix(vec3(.05,.07,.06)*(uAmb*2.), skyLut(normalize(vec3(rd.x,.02,rd.z))), .75); }
  } else {
    float t=(ro.y-0.)/-rd.y; vec3 p=ro+rd*t;
    float rx=riverX(p.z);
    float dr=abs(p.x-rx);
    float width=15.+5.*sin(p.z*.013);
    float h;
    vec3 c=canopyCol(p.xz,h);
    vec3 lit=uAmb*.8+uSunCol*max(uSunDir.y,0.)*1.1;
    if(dr<width){
      vec3 n=normalize(vec3(gnoise(p.xz*.08+uLT*.2)*.05,1.,gnoise(p.xz*.07-uLT*.2)*.05));
      vec3 r=reflect(rd,n);
      vec3 w=skyLut(r)*.9+uSunCol*pow(max(dot(r,uSunDir),0.),600.)*60.;
      float sed=fbm(p.xz*vec2(.02,.05)+vec2(0.,uLT*.05),4)*.5+.5;
      vec3 brown=mix(vec3(.014,.011,.006),vec3(.028,.02,.01),sed)*lit;
      vec3 n2=normalize(vec3(gnoise(p.xz*.35+uLT*.6)*.12,1.,gnoise(p.xz*.3-uLT*.5)*.12));
      vec3 r2=reflect(rd,n2);
      w=skyLut(r2)*.9+uSunCol*pow(max(dot(r2,uSunDir),0.),300.)*30.;
      float F=.04+.96*pow(1.-max(dot(n2,-rd),0.),5.);
      vec3 water=mix(brown,w*.55,F*.7+.02);
      water+=uSunCol*pow(max(dot(r2,uSunDir),0.),60.)*.02*smoothstep(.55,.8,gnoise(p.xz*.6+uLT));   // ripple sparkle
      water*=.55+.45*smoothstep(width,width*.45,dr);       // tree shade along the banks
      float edge=smoothstep(width-2.5,width,dr);
      c=mix(water, c*.7, edge);
    } else {
      c*=smoothstep(width,width+9.,dr)*.6+.4;       // shade under trees at the bank
    }
    // low mist banks drifting over the canopy (sampled at their own altitude)
    float tm=(ro.y-35.)/max(-rd.y,1e-3);
    vec3 pm=ro+rd*tm;
    float mist=smoothstep(.5,.85,fbm(pm.xz*.005+vec2(uLT*.02,0.),5)*.5+.5);
    vec3 mc=uAmb*1.1+uSunCol*.35;
    c=mix(c,mc,mist*.55);
    float T=exp(-t*1.6e-4);
    col=c*T+skyLut(normalize(vec3(rd.x,.03,rd.z)))*(1.-T);
  }
  col=aces(col*uExp);
  col=toSRGB(col);
  col=mix(vec3(luma(col)),col,1.12);
  fragColor=vec4(clamp(col,0.,1.),1.);
}`,
  sun: lt => ({ az: -.7, el: .22, kMie: 24e-6 }),
  cam: lt => ({ yaw: .05 * Math.sin(lt * .25), pitch: -.42, fov: 1.0, h: 210 - lt * 2 }),
  exp: 1.0,
  params(lt) { return [Math.sin(lt * .05) * 10, lt * 26, 0, 0]; },
  draw(ctx, lt, t, L) {
    // a pair of hornbills gliding across below us
    const base = F.css(F.disp(L.amb.map(v => v * .06), L.exp));
    for (let i = 0; i < 2; i++) {
      const k = (lt - 1.5 - i * .35) / 7.5;
      if (k < 0 || k > 1) continue;
      const x = -120 + k * 1350 + i * 60, y = 1050 - k * 260 + i * 50 + Math.sin(lt * 2 + i) * 8;
      hornbill(ctx, x, y, 34 + i * 3, lt * 5.5 + i * 2, base);
    }
    F.flock(ctx, lt, { n: 8, seed: 91, x0: 1150, y0: 700, x1: -60, y1: 560, t0: 4, dur: 7, size: 6, spread: 140, col: base });
  },
};
function hornbill(ctx, x, y, s, flap, col) {
  const a = Math.sin(flap) * .7;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, 0, 1.1, .32, -.05, 0, 7); ctx.fill();                          // body
  ctx.beginPath(); ctx.moveTo(1, -.1); ctx.quadraticCurveTo(1.6, -.25, 2.2, .1); ctx.lineTo(1.05, .12); ctx.fill(); // beak
  ctx.beginPath(); ctx.moveTo(1.05, -.18); ctx.quadraticCurveTo(1.45, -.42, 1.75, -.2); ctx.lineTo(1.1, -.05); ctx.fill(); // casque
  ctx.beginPath(); ctx.moveTo(-1, -.05); ctx.lineTo(-2.3, -.15); ctx.lineTo(-2.3, .2); ctx.lineTo(-1, .12); ctx.fill(); // tail
  ctx.fillStyle = 'rgba(235,232,220,.9)'; ctx.fillRect(-2.3, -.15, .45, .35);                      // white tail band
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-.4, -.1); ctx.quadraticCurveTo(-.2, -1.4 * a - .5, .5, -2.1 * a - .2); ctx.quadraticCurveTo(.5, -.9 * a, .45, -.05); ctx.fill(); // wing
  ctx.restore();
}

// ============ S13: deep sea, a whale glides through light shafts (doa Nabi Yunus) ============
SCN.underwater = {
  id: 'underwater', scale: .6, lut: false,
  fs: `
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float t=uLT;
  vec3 deep=vec3(.002,.012,.03), mid=vec3(.01,.06,.11), top=vec3(.08,.3,.42);
  vec3 col=mix(deep, mid, smoothstep(.0,.6,uv.y));
  col=mix(col, top, smoothstep(.55,1.,uv.y));
  // surface + snell window
  float sx=(uv.x-.5)*uRes.x/uRes.y;
  if(uv.y>.86){
    float w=fbm(vec2(sx*6.,t*.4),4)+fbm(vec2(sx*14.-t*.3,uv.y*20.),3)*.5;
    float k=smoothstep(.86,.97,uv.y);
    vec3 surf=vec3(.3,.62,.72)+vec3(.6,.8,.85)*smoothstep(.2,.6,w)*exp(-abs(sx)*2.2);
    col=mix(col, surf, k*.85);
  }
  // light shafts fanning from the surface
  float rays=0.;
  for(int k=0;k<3;k++){
    float fk=float(k);
    float ang=sx/(1.05-uv.y+.15);
    float n=fbm(vec2(ang*(2.5+fk*1.7)+t*(.05+fk*.03), fk*4.),4)*.5+.5;
    rays+=smoothstep(.55,.85,n)*(.5-fk*.12);
  }
  rays*=smoothstep(.0,.9,uv.y)*exp(-abs(sx)*.9);
  col+=vec3(.25,.55,.6)*rays*.45;
  // marine snow
  vec2 g=vec2(sx,uv.y)*vec2(55.,55.)+vec2(0.,t*.6);
  vec2 id=floor(g), f=fract(g)-.5;
  vec3 h=hash32(id);
  float sp=smoothstep(.12,.0,length(f-(h.xy-.5)*.7))*step(.93,h.z);
  col+=vec3(.5,.7,.75)*sp*.35*smoothstep(.0,.8,uv.y);
  col=aces(col*uExp);
  fragColor=vec4(toSRGB(col),1.);
}`,
  sun: () => ({ az: 0, el: .3 }),
  cam: () => ({ yaw: 0, pitch: 0, fov: 1, h: 1 }),
  exp: 1.6,
  params: () => [],
  draw(ctx, lt, t) {
    // whale gliding left -> right, lit from above
    const k = lt / 7.2;
    const x = -380 + k * 1500, y = 930 - k * 120 + Math.sin(lt * .5) * 10;
    Props.whale(ctx, x, y, 1180, lt, { top: 'rgba(52,86,104,1)', belly: 'rgba(6,16,26,1)', tilt: -.1 });
    // light catching the back
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x - 50, y - 110, 10, x - 50, y - 110, 420);
    g.addColorStop(0, 'rgba(110,190,210,.12)'); g.addColorStop(1, 'rgba(110,190,210,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 600, y - 500, 1200, 700); ctx.restore();
    // small fish school
    const r = F.rng(5);
    ctx.fillStyle = 'rgba(150,200,210,.5)';
    for (let i = 0; i < 40; i++) {
      const fx = (r() * 1200 - 60 + lt * (40 + r() * 30)) % 1180 - 40, fy = 420 + r() * 260 + Math.sin(lt * 2 + i) * 6;
      ctx.beginPath(); ctx.ellipse(fx, fy, 7, 2.2, -.1, 0, 7); ctx.fill();
    }
  },
};
