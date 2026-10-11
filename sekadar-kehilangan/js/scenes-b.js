// Custom-shader scenes: rain on the window, beach footprints, surau at night, forest light.

// ============ S2: rain on the window, woman seated looking out ============
// window rectangle in uv (GL, origin bottom-left)
const WIN = { x0: .12, x1: .88, y0: .4, y1: .865 };
SCN.rainWindow = {
  id: 'rain-window', scale: .6, lut: false,
  fs: `
const vec4 WINR=vec4(${WIN.x0},${WIN.y0},${WIN.x1},${WIN.y1});
vec3 outside(vec2 q, float sharp){                // q: 0..1 inside the window
  vec3 sky=mix(vec3(.5,.55,.6), vec3(.74,.77,.8), smoothstep(.35,1.,q.y));
  float tn=fbm(vec2(q.x*2.6+1.3,q.y*1.4),3)*.5+.5;
  float edge=.5+tn*.32-q.y;
  float tree=smoothstep(-.03,.06+(1.-sharp)*.08,edge);
  float leaf=fbm(q*vec2(9.,7.)+2.,sharp>.5?5:3)*.5+.5;
  vec3 green=mix(vec3(.05,.08,.045), vec3(.2,.27,.16), leaf);
  vec3 c=mix(sky,green,tree);
  float roof=smoothstep(.006,0.,abs(q.y-.21-q.x*.05))*step(.55,q.x)*.0;
  // far bokeh lights of a neighbour's house
  for(int i=0;i<4;i++){
    vec2 bp=vec2(.62+float(i)*.07, .3+.02*sin(float(i)*3.));
    float r=length((q-bp)*vec2(1.,1.))/(.018+.02*(1.-sharp));
    c+=vec3(1.,.72,.4)*smoothstep(1.,.6,r)*.35;
  }
  return c;
}
// static droplets height field
float dropH(vec2 p, float t){
  vec2 g=p*vec2(46.,46.);
  vec2 id=floor(g), f=fract(g)-.5;
  vec3 h=hash32(id);
  if(h.z>.62) return 0.;
  vec2 c=(h.xy-.5)*.55;
  float r=.12+.28*hash12(id+3.);
  float life=fract(t*.05*(.5+h.x)+h.y);
  r*=smoothstep(0.,.08,life)*(1.-smoothstep(.85,1.,life)*.3);
  float d=length(f-c);
  return sqrt(max(0.,r*r-d*d))/.4;
}
// sliding drops + their wet trails
vec2 runH(vec2 p, float t){
  float cw=1./9.;
  float col=floor(p.x/cw);
  vec3 h=hash32(vec2(col,7.));
  float x=(col+.5)*cw+(h.x-.5)*cw*.5+sin(p.y*30.+h.y*6.)*.004;
  float sp=.06+.08*h.z;
  float s=t*sp+h.y;
  float y=1.15-fract(s+.04*sin(s*25.))*1.4;
  vec2 d=(p-vec2(x,y))*vec2(1.,.8);
  float r=.012+.008*h.x;
  float drop=sqrt(max(0.,r*r-dot(d,d)))/r;
  float trail=smoothstep(.006,.0,abs(p.x-x))*step(y,p.y)*smoothstep(y+.35,y,p.y);
  // beads left in the trail
  float by=fract(p.y*55.+h.x*5.)-.5;
  float bead=sqrt(max(0.,.04-(by*by*.2+pow((p.x-x)*90.,2.)*.01)))*trail*2.;
  return vec2(drop*1.4+bead, trail);
}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 q=(uv-WINR.xy)/(WINR.zw-WINR.xy);
  float t=uLT;
  vec3 col;
  if(q.x>0.&&q.x<1.&&q.y>0.&&q.y<1.){
    vec2 p=vec2(uv.x*uRes.x/uRes.y, uv.y);
    float e=.0012;
    float h0=dropH(p,t), hx=dropH(p+vec2(e,0),t), hy=dropH(p+vec2(0,e),t);
    vec2 r0=runH(p,t), rx=runH(p+vec2(e,0),t), ry=runH(p+vec2(0,e),t);
    float H0=h0+r0.x;
    vec2 n=vec2(hx+rx.x-H0, hy+ry.x-H0)/e*.0016;
    float inDrop=smoothstep(.0,.25,H0);
    vec3 blurBg=outside(q+n*.0, 0.);
    vec3 sharpBg=outside(q-n*1.8, 1.);
    col=mix(blurBg, sharpBg, max(inDrop, r0.y*.6));
    col*=1.-inDrop*.18*(n.y>0.?1.:.4);
    col+=vec3(1.)*pow(max(0.,dot(normalize(vec3(-n*30.,1.)),normalize(vec3(-.4,.6,1.)))),40.)*inDrop*.35;
    col*=mix(.82,1.,r0.y);                           // fogged glass vs wiped trail
    col=mix(col, vec3(.7,.73,.76), .12*(1.-r0.y));   // condensation haze
  } else {
    // dim room wall lit by the window
    vec2 c=clamp(uv, WINR.xy, WINR.zw);
    float d=length((uv-c)*vec2(1.,.75));
    float l=exp(-d*7.)*.32+.012;
    float grain=fbm(uv*vec2(60.,4.),3)*.5+.5;
    col=vec3(.42,.36,.3)*l*(.85+.3*grain);
  }
  col=pow(clamp(col,0.,1.),vec3(1.05));
  col=mix(vec3(luma(col)),col,.92);
  fragColor=vec4(col,1.);
}`,
  sun: () => ({ az: 0, el: .3 }),
  cam: () => ({ yaw: 0, pitch: 0, fov: 1, h: 1 }),
  params: () => [],
  draw(ctx, lt, t, L) {
    const z = 1 + lt * .004;
    ctx.setTransform(z, 0, 0, z, 540 * (1 - z), 900 * (1 - z));
    const x0 = WIN.x0 * W, x1 = WIN.x1 * W, y0 = (1 - WIN.y1) * H, y1 = (1 - WIN.y0) * H;
    const wood = 'rgba(28,20,14,1)', woodLit = 'rgba(70,58,48,1)';
    // frame + mullions
    ctx.fillStyle = wood;
    ctx.fillRect(x0 - 34, y0 - 34, x1 - x0 + 68, 34); ctx.fillRect(x0 - 34, y1, x1 - x0 + 68, 30);
    ctx.fillRect(x0 - 34, y0 - 34, 34, y1 - y0 + 64); ctx.fillRect(x1, y0 - 34, 34, y1 - y0 + 64);
    ctx.fillRect((x0 + x1) / 2 - 9, y0, 18, y1 - y0);
    for (const k of [1 / 3, 2 / 3]) ctx.fillRect(x0, y0 + (y1 - y0) * k - 7, x1 - x0, 14);
    // inner edge highlight from window light
    ctx.fillStyle = woodLit;
    ctx.fillRect(x0 - 2, y0, 2, y1 - y0); ctx.fillRect(x1, y0, 2, y1 - y0); ctx.fillRect(x0, y1, x1 - x0, 3);
    // sill
    ctx.fillStyle = 'rgba(40,30,22,1)'; ctx.fillRect(x0 - 70, y1 + 24, x1 - x0 + 140, 26);
    ctx.fillStyle = 'rgba(90,76,62,1)'; ctx.fillRect(x0 - 70, y1 + 24, x1 - x0 + 140, 3);
    // translucent curtain on the right
    const cg = ctx.createLinearGradient(x1 - 120, 0, x1 + 40, 0);
    cg.addColorStop(0, 'rgba(235,225,210,0)'); cg.addColorStop(.4, 'rgba(235,225,210,.28)'); cg.addColorStop(1, 'rgba(120,105,90,.85)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.moveTo(x1 - 120, y0 - 34);
    for (let y = y0 - 34; y <= y1 + 60; y += 30) ctx.lineTo(x1 - 110 + Math.sin(y * .03 + lt * .8) * 8 + (y - y0) * .05, y);
    ctx.lineTo(x1 + 60, y1 + 60); ctx.lineTo(x1 + 60, y0 - 34); ctx.closePath(); ctx.fill();
    // cup of tea on the sill (steam)
    ctx.fillStyle = 'rgba(22,16,12,1)';
    ctx.beginPath(); ctx.moveTo(x1 - 210, y1 + 24); ctx.lineTo(x1 - 204, y1 - 26); ctx.lineTo(x1 - 160, y1 - 26); ctx.lineTo(x1 - 166, y1 + 24); ctx.fill();
    ctx.beginPath(); ctx.arc(x1 - 158, y1 - 4, 12, -1.3, 1.3); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(22,16,12,1)'; ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(230,230,235,${.08 + .04 * Math.sin(lt * 1.3 + i)})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x1 - 188 + i * 8, y1 - 34);
      for (let k = 1; k < 8; k++) ctx.lineTo(x1 - 188 + i * 8 + Math.sin(lt * 1.6 + k * .9 + i) * 10, y1 - 34 - k * 16);
      ctx.stroke();
    }
    // the woman seated by the window, back view, lit from the window
    const Lf = { amb: [.02, .02, .022], key: [0, 0, 0], front: 0, exp: 1, ambK: 1, rim: .55, rimDir: -1.2, rimW: 4, glow: 7, halo: .18, rimCol: 'rgba(200,210,220,1)' };
    F.woman(ctx, 360, 1330, 640, { t: lt, sit: true, wind: .0, khimarFill: 'rgba(30,24,26,1)', abayaFill: 'rgba(18,16,20,1)', light: Lf, shadow: false });
  },
};

// ============ S3: footprints on the beach washed away by the sea ============
SCN.beach = {
  id: 'beach', scale: .65,
  fs: `
const float FP_STEP=.68;
float pathX(float z){ return .55+.075*z+.2*sin(z*.23); }
float shoreX(float z){ return pathX(z)+2.3+.45*sin(z*.05+1.); }
// swash excursion (how far the thin water sheet runs up the sand), big wave around lt~6
float swash(float z, float t){
  float a=.6+.5*sin(t*1.05+z*.12)+.3*sin(t*.63+z*.05);
  float big=2.3*exp(-pow((t-6.6+z*.025)/1.6,2.));
  return max(0.,a)+big;
}
float erased(float z, float px){
  float tBig=6.1-z*.025;
  float reach=smoothstep(3.6,2.7,shoreX(z)-px);
  return smoothstep(tBig, tBig+1.2, uLT)*reach;
}
float footH(vec2 p){
  float i=floor(p.y/FP_STEP);
  float h=0.;
  for(int k=-1;k<=1;k++){
    float j=i+float(k);
    float z=(j+.5)*FP_STEP;
    if(z<1.5||z>60.) continue;
    float side=mod(j,2.)<1.?-1.:1.;
    vec2 c=vec2(pathX(z)+side*.11, z);
    vec2 d=p-c;
    float a=.12*side;
    d=mat2(cos(a),-sin(a),sin(a),cos(a))*d;
    float w=mix(.042,.05,smoothstep(-.1,.1,d.y))-.008*exp(-pow(d.y/.03,2.));   // narrower at the arch
    float sole=length(vec2(d.x/w, d.y/.13));
    float m=smoothstep(1.,.45,sole);
    float er=erased(z, c.x);
    h-=m*.04*(1.-er);
  }
  return h;
}
void main(){
  vec3 rd=camRay(gl_FragCoord.xy);
  vec3 ro=vec3(0.,uCam.w,0.);
  vec3 col;
  float t=uLT;
  if(rd.y>0.){
    col=skyLut(rd)+sunDisc(rd,.0058,1.1);
    vec4 cl=cloudDeck(ro,rd,2300.,.52,1./2300.,vec2(t*.004,t*.0015),.32,6);
    col=mix(col,cl.rgb,cl.a);
  } else {
    float tt=ro.y/-rd.y; vec3 p=ro+rd*tt;
    float xs=shoreX(p.z);
    float sw=swash(p.z,t);
    float xw=xs-sw;                                   // water reaches down to here
    vec3 rr=reflect(rd,vec3(0,1,0));
    vec3 skyR=skyLut(rr)+uSunCol*pow(max(dot(rr,uSunDir),0.),400.)*30.;
    if(p.x>xs+.0){
      // open water with breakers
      float dist=p.x-xs;
      float w=fbm(p.xz*vec2(.35,.12)+vec2(-t*.25,0.),4);
      vec3 n=normalize(vec3(gnoise(p.xz*.6+t*.4)*.12, 1., gnoise(p.xz*.5-t*.3)*.12));
      vec3 r2=reflect(rd,n);
      vec3 refl=skyLut(r2)+uSunCol*pow(max(dot(r2,uSunDir),0.),500.)*45.;
      float F=.03+.97*pow(1.-max(dot(n,-rd),0.),5.);
      col=mix(uAmb*vec3(.02,.1,.11)+uSunCol*vec3(.004,.012,.012), refl*.8, F);
      float lines=0.;
      for(int k=0;k<3;k++){
        float ph=fract(t*.16+float(k)*.333);
        float bx=xs+.2+ph*9.;
        lines+=smoothstep(.55,.0,abs(dist+xs-bx-w*.6))*(1.-ph)*(.6+.4*fbm(p.xz*vec2(2.,.6)+float(k)*5.,3));
      }
      col=mix(col, (uAmb*.9+uSunCol*.18)*1.1, clamp(lines,0.,1.)*.85);
    } else {
      // sand: dry -> wet -> swash sheet
      float g=fbm(p.xz*vec2(3.,3.),5)*.5+.5;
      float rip=fbm(p.xz*vec2(2.2,5.),3)*.5+.5;
      float e=.01;
      float hf=footH(p.xz), hx=footH(p.xz+vec2(e,0)), hz=footH(p.xz+vec2(0,e));
      vec3 n=normalize(vec3(-(hx-hf)/e, 1., -(hz-hf)/e)+vec3(gnoise(p.xz*14.)*.06,0.,gnoise(p.xz*14.+5.)*.06)+vec3((rip-.5)*.08,0.,0.));
      vec3 dry=vec3(.44,.36,.27)*(.85+.3*g);
      float wetZone=smoothstep(xs-1.2-sw*.4, xs-.6, p.x)+smoothstep(xs-3.,xs-1.,p.x)*erased(p.z,p.x);
      vec3 sand=mix(dry, dry*.45, clamp(wetZone,0.,1.));
      float diff=max(dot(n,uSunDir),0.);
      col=sand*(uAmb*.9+uSunCol*diff*.55);
      col*=1.+hf*14.;                                   // footprint occlusion
      // wet sand mirror
      col=mix(col, skyR*.55, clamp(wetZone,0.,1.)*.35);
      // swash sheet + foam front
      if(p.x>xw){
        float depth=clamp((p.x-xw)/1.5,0.,1.);
        vec3 nw=normalize(vec3(gnoise(p.xz*3.+t)*.05,1.,gnoise(p.xz*3.-t)*.05));
        vec3 r3=reflect(rd,nw);
        vec3 sheet=skyLut(r3)+uSunCol*pow(max(dot(r3,uSunDir),0.),300.)*25.;
        col=mix(col*.7, sheet*.62, .45+.4*depth);
        float foam=smoothstep(.35,.0,p.x-xw)*(.55+.45*fbm(p.xz*vec2(6.,2.)+t*.3,4));
        float lace=smoothstep(.62,.7,fbm(p.xz*vec2(5.,3.)+vec2(0.,t*.2),4)*.5+.5)*smoothstep(1.8,.2,p.x-xw);
        col=mix(col, uAmb*1.05+uSunCol*.2, clamp(foam+lace*.5,0.,1.)*.9);
      }
    }
    float T=exp(-tt*.004);
    col=col*T+skyLut(normalize(vec3(rd.x,.02,rd.z)))*(1.-T);
  }
  col=aces(col*uExp);
  col=toSRGB(col);
  col=mix(vec3(luma(col)),col,1.1);
  fragColor=vec4(clamp(col,0.,1.),1.);
}`,
  sun: lt => ({ az: .42, el: .065 - lt * .0015, kMie: 26e-6 }),
  cam: lt => ({ yaw: .14, pitch: -.24 + lt * .004, fov: 1.0, h: 1.6 }),
  exp: .92,
  params: () => [],
  draw(ctx, lt, t, L) {
    // the woman far ahead, walking away along the shore
    const cam = { ...this.cam(lt), x: 0, z: 0 };
    const z = 34 + lt * .8;
    const x = .55 + .075 * z + .2 * Math.sin(z * .23);
    const f0 = projectPt(cam, [x, 0, z]), f1 = projectPt(cam, [x, 1.62, z]);
    const su = sunScreen(cam, L.sd);
    const Lf = figLight(L, f0[0], f0[1], su, { front: .06, ambK: .35, rim: .8, rimK: .8, rimW: 2, glow: 3 });
    F.woman(ctx, f0[0], f0[1], f0[1] - f1[1], { t: lt, walk: true, phase: lt * 3.4, wind: .3, khimarFill: fillFor([.62, .5, .5], Lf), abayaFill: fillFor([.16, .18, .24], Lf), light: Lf, shadowA: .2 });
    F.flock(ctx, lt, { n: 3, seed: 61, x0: -40, y0: 330, x1: 1120, y1: 260, t0: 1, dur: 10, size: 10, spread: 90, col: 'rgba(40,30,30,.8)' });
  },
};

// ============ S7: sujud in a wooden surau at night, pelita light, rain outside ============
SCN.surau = {
  id: 'surau', scale: .6, lut: false,
  fs: `
// light from the pelita at screen uv (uP[0].xy), flicker uP[0].z; window rect uP[1]; lightning uP[0].w
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 a=vec2(uRes.x/uRes.y,1.);
  vec2 lp=uP[0].xy;
  float fl=uP[0].z;
  vec3 col;
  float floorY=.38;
  if(uv.y>floorY){
    // vertical wooden planks
    float px=uv.x*14.;
    float id=floor(px);
    float seam=smoothstep(.0,.035,fract(px))*smoothstep(1.,.965,fract(px));
    float grain=fbm(vec2(uv.x*120.+id*13.,uv.y*6.),4)*.5+.5;
    vec3 wood=mix(vec3(.24,.14,.07),vec3(.36,.22,.11),grain)*(.7+.3*hash11(id))*seam;
    float d=length((uv-lp)*a);
    float light=fl*(.9/(1.+d*d*28.))+.02;
    col=wood*light;
    // window
    vec4 wr=uP[1];
    if(uv.x>wr.x&&uv.x<wr.z&&uv.y>wr.y&&uv.y<wr.w){
      vec2 q=(uv-wr.xy)/(wr.zw-wr.xy);
      vec3 night=mix(vec3(.01,.015,.03),vec3(.03,.045,.08),q.y);
      night+=vec3(.5,.55,.7)*uP[0].w*(.5+.5*q.y);
      float rn=0.;
      for(int k=0;k<2;k++){ vec2 rq=q*vec2(40.+float(k)*25.,3.)+vec2(0.,uLT*(4.+float(k)*2.)); rn+=smoothstep(.96,1.,hash12(floor(rq)))*.25; }
      col=night+vec3(.6,.65,.75)*rn*(.25+uP[0].w);
      float bars=step(.47,q.x)*step(q.x,.53)+step(.48,q.y)*step(q.y,.52);
      col=mix(col, wood*light*.8, clamp(bars,0.,1.));
    }
  } else {
    // floor planks in perspective
    float depth=(floorY-uv.y)/floorY;
    float zz=1./(depth+.08);
    float pz=zz*3.;
    float id=floor(pz);
    float seam=smoothstep(.0,.06,fract(pz))*smoothstep(1.,.94,fract(pz));
    float grain=fbm(vec2(uv.x*40./(1.+zz*.2)+id*7.,pz*.5),4)*.5+.5;
    vec3 wood=mix(vec3(.2,.11,.05),vec3(.32,.19,.09),grain)*(.75+.25*hash11(id))*seam;
    float d=length((uv-lp)*a*vec2(1.,1.6));
    float light=fl*(1.1/(1.+d*d*22.))+.015;
    col=wood*light;
    col+=vec3(1.,.6,.3)*pow(max(0.,1.-d*2.2),3.)*.12*fl;
  }
  col=aces(col*uExp);
  fragColor=vec4(toSRGB(col),1.);
}`,
  sun: () => ({ az: 0, el: .3 }),
  cam: () => ({ yaw: 0, pitch: 0, fov: 1, h: 1 }),
  exp: 1.05,
  flick(t) { return .85 + .12 * Math.sin(t * 15.7) * Math.sin(t * 9.1 + 2) + .04 * Math.sin(t * 31); },
  params(lt, t) {
    const fl = this.flick(t);
    const f = flashAt(t, [[82.25, .7], [82.4, .5]]);
    return [.24, .4, fl, f, .62, .58, .9, .9];
  },
  draw(ctx, lt, t) {
    const z = 1.04 + lt * .006;
    ctx.setTransform(z, 0, 0, z, 540 * (1 - z), 1050 * (1 - z));
    // sejadah in perspective
    const mat = [[300, 1300], [930, 1300], [860, 1110], [370, 1110]];
    Props.sejadah(ctx, mat, { base: 'rgba(96,22,30,1)', line: 'rgba(214,170,90,.55)' });
    // light falloff on the mat from the lamp (left)
    const g = ctx.createRadialGradient(260, 1180, 20, 260, 1180, 700);
    g.addColorStop(0, 'rgba(255,170,90,.22)'); g.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = g; ctx.fillRect(0, 1000, W, 400); ctx.restore();
    // telekung in sujud (facing left), warm key from the pelita
    const fl = this.flick(t);
    const warm = [Math.round(214 * fl), Math.round(186 * fl), Math.round(150 * fl)];
    const shade = 'rgba(38,34,42,1)';
    const L = 560, x = 420, y = 1238;
    ctx.save();
    const tg = ctx.createLinearGradient(0, -.45, .85, 0);           // unit space of the figure
    tg.addColorStop(0, F.css(warm)); tg.addColorStop(.55, F.css(warm.map(v => v * .72 | 0))); tg.addColorStop(1, shade);
    const kg = ctx.createLinearGradient(0, -.4, .9, 0);
    kg.addColorStop(0, F.css(warm.map(v => v * .8 | 0))); kg.addColorStop(1, 'rgba(34,30,38,1)');
    F.sujud(ctx, x, y, L, { topFill: tg, kainFill: kg, light: { rim: .45, rimDir: Math.PI * 1.05, rimW: 4, glow: 6, halo: .12, rimCol: 'rgba(255,190,120,1)' },
      detail: c => {
        // drape folds fanning from the hips, a soft occlusion along the hem, highlight on the back
        c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = .006; c.lineCap = 'round';
        for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(.6 - i * .015, -.4 + i * .01); c.quadraticCurveTo(.48 - i * .05, -.22 + i * .02, .32 - i * .045, -.01); c.stroke(); }
        const hg = c.createLinearGradient(.3, -.05, .6, -.3);
        hg.addColorStop(0, 'rgba(0,0,0,.25)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
        c.strokeStyle = hg; c.lineWidth = .03; c.beginPath(); c.moveTo(.22, 0); c.quadraticCurveTo(.48, -.12, .705, -.405); c.stroke();
        c.strokeStyle = 'rgba(255,230,190,.18)'; c.lineWidth = .012; c.beginPath(); c.moveTo(.17, -.155); c.quadraticCurveTo(.45, -.33, .64, -.432); c.stroke();
      } });
    ctx.restore();
    // pelita + a rehal with the Quran near it
    Props.pelita(ctx, 230, 1252, 14, t);
    ctx.fillStyle = 'rgba(30,18,10,1)';
    ctx.beginPath(); ctx.moveTo(120, 1262); ctx.lineTo(200, 1210); ctx.lineTo(160, 1200); ctx.lineTo(90, 1250); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(200, 1262); ctx.lineTo(120, 1210); ctx.lineTo(160, 1200); ctx.lineTo(230, 1250); ctx.closePath(); ctx.fill();
  },
};

// ============ S9: misty rainforest, light shafts, woman walking toward the light ============
SCN.forest = {
  id: 'forest', scale: .62,
  passes: [{ name: 'uPre', define: 'PREPASS', scale: .25 }],
  fs: `
uniform sampler2D uPre;
// trunk layers k=0 (near) .. 5 (far); return occlusion + local coord
const int NK=6;
float trunkMask(vec2 uv, int k, out float u, out float shade){
  float depth=1.+float(k)*1.15;
  float sx=uv.x*uRes.x/uRes.y;
  float camx=uLT*.012;
  float x=(sx-.28+camx/depth)*depth*1.6+float(k)*3.17;
  float cell=floor(x), f=fract(x);
  vec3 h=hash32(vec2(cell,float(k)*11.));
  if(h.z<.18) { u=0.; shade=0.; return 0.; }
  float w=(.07+.07*h.y)*(1.+.6*float(k==0));
  float lean=(h.x-.5)*.06;
  float c=.5+(h.x-.5)*.6+lean*(uv.y-.4)*4.;
  float yb=.36-.07/depth;                  // base height on screen
  float flare=1.+2.2*exp(-(uv.y-yb)*30.)*step(yb,uv.y);    // buttress roots
  float dx=abs(f-c)/(w*flare);
  u=(f-c)/(w*flare);
  shade=h.y;
  return smoothstep(1.,.85,dx)*step(yb-.01,uv.y);
}
float canopy(vec2 uv){
  float n=fbm(uv*vec2(5.,3.5)+vec2(0.,uLT*.01),5)*.5+.5;
  float hole=smoothstep(.56,.62,n+ (uv.y-.86)*1.4);
  return 1.-hole;                          // 1 = leaves
}
vec2 lightUV(){ return uP[0].xy; }
#ifdef PREPASS
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float vis=1.-canopy(uv)*smoothstep(.6,.75,uv.y);
  for(int k=0;k<NK;k++){ float u,s; vis*=1.-trunkMask(uv,k,u,s); }
  vis*=step(.36,uv.y);
  fragColor=vec4(vis,0.,0.,1.);
}
#else
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  vec2 lp=lightUV();
  vec3 fogc=mix(vec3(.2,.26,.19), vec3(.72,.74,.6), exp(-length((uv-uP[0].xy)*vec2(.56,1.))*2.2));
  vec3 lightc=vec3(1.,.9,.7);
  float dl=length((uv-lp)*vec2(.56,1.));
  // background: bright mist + glow toward the light
  vec3 col=mix(vec3(.1,.14,.09), fogc*.85, smoothstep(.2,.8,uv.y))+lightc*exp(-dl*4.)*.6;
  // far-to-near trunk layers with aerial perspective (a trunk is always darker than the mist behind it)
  vec3 bg=col;
  for(int k=NK-1;k>=0;k--){
    float u,s;
    float m=trunkMask(uv,k,u,s);
    if(m>0.){
      float depth=1.+float(k)*1.15;
      float fogk=1.-exp(-float(k)*.3);
      vec3 bark=mix(vec3(.018,.017,.013),vec3(.05,.045,.032),s)*(.75+.5*fbm(vec2(u*3.,uv.y*30.),3));
      bark+=lightc*smoothstep(.3,1.,-u)*.25*(1.-fogk);          // light-side rim
      vec3 c=mix(bark, bg*.92, fogk);
      col=mix(col,c,m);
    }
  }
  // undergrowth + path
  if(uv.y<.4){
    float g=fbm(uv*vec2(14.,26.),5)*.5+.5;
    float path=smoothstep(.12,.0,abs(uv.x-.5-(uv.y-.36)*.6)-(.36-uv.y)*1.4);
    vec3 ground=mix(vec3(.05,.08,.03),vec3(.16,.2,.09),g);
    ground=mix(ground, vec3(.3,.27,.2)*(.8+.4*g), path*.8);
    float fogk=smoothstep(.0,.36,uv.y);
    ground=mix(ground*.6, bg*.8, fogk*.5);
    col=mix(col, ground, smoothstep(.375,.355,uv.y));
  }
  // canopy at the top
  float leaves=canopy(uv)*smoothstep(.62,.8,uv.y);
  col=mix(col, vec3(.03,.05,.025)+lightc*.05, leaves*.95);
  // god rays
  {
    vec2 d=lp-uv; const int N=48; vec2 st=d/float(N);
    float acc=0., w=1.; float j=hash12(gl_FragCoord.xy+uT);
    vec2 s=uv+st*j;
    for(int k=0;k<N;k++){ acc+=texture(uPre,s).r*w; w*=.97; s+=st; }
    acc/=float(N)*.45;
    col+=lightc*acc*.2*uP[0].z;
  }
  col=aces(col*uExp*1.2);
  col=toSRGB(col);
  fragColor=vec4(col,1.);
}
#endif
`,
  lut: false,
  sun: () => ({ az: 0, el: .3 }),
  cam: () => ({ yaw: 0, pitch: 0, fov: 1, h: 1 }),
  exp: .82,
  params(lt) { return [.74, .98, 1, 0]; },
  draw(ctx, lt, t) {
    const z = 1 + lt * .012;
    ctx.setTransform(z, 0, 0, z, 540 * (1 - z), 1150 * (1 - z));
    // woman walking toward the light, slowly receding
    const k = lt / 9;
    const H0 = 330 - k * 70, fx = 520 + k * 20, fy = 1168 - k * 40;
    const Lf = { amb: [.02, .022, .018], key: [0, 0, 0], front: 0, exp: 1, ambK: 1, rim: .85, rimDir: -1.15, rimW: 3, glow: 7, halo: .35, rimCol: 'rgba(255,236,190,1)' };
    F.woman(ctx, fx, fy, H0, { t: lt, walk: true, phase: lt * 2.8, wind: .06, khimarFill: 'rgba(40,40,38,1)', abayaFill: 'rgba(26,28,30,1)', light: Lf, shadowA: .25 });
    // ferns in the foreground corners
    F.grass(ctx, x => H + 20, { x0: -40, x1: 260, n: 40, h: 300, col: 'rgba(8,14,6,.95)', t: lt, wind: .1, seed: 71 });
    F.grass(ctx, x => H + 20, { x0: 820, x1: 1120, n: 40, h: 320, col: 'rgba(8,14,6,.95)', t: lt, wind: .1, seed: 72 });
    motes(ctx, lt, { n: 45, seed: 81, y0: 300, y1: 1200, size: 4, a: .55, col: '255,240,200', drift: 3, rise: 5,
      fade: (x, y) => Math.max(0, 1 - Math.hypot((x - 800) / 700, (y - 200) / 1200)) });
  },
};
