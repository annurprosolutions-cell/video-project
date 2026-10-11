// Layered landscape shader (misty ridges, water / padi field, clouds, night sky, rainbow, god rays).
// Built per scene from a config so unused features compile out.
//
// uP[0]: x mist density (1/m), y mist scale height (m), z aerial haze (1/m), w cloud cover (0..1)
// uP[1]: x wave amplitude, y rain ripples, z water darkness, w padi wind
// uP[2]: x stars, y milky way, z moon phase, w lightning flash
// uP[3]: x rainbow, y god rays, z sun size (rad), w sun glow
// uP[4]: xy sun screen uv, z batas x (m), w cloud altitude (m)
// uP[5]: x cam x (m), y cam z (m), z cloud speed (m/s), w cloud scale (1/m)
// uP[6]: xyz moon dir, w moon size (rad)
// uP[7]: x night amount, y mist drift speed, z ground fog tint, w padi ripeness
function landscapeFS(cfg) {
  const L = cfg.layers;
  const arr = (f) => L.map(f).map(v => v.toFixed(5)).join(',');
  const defs = [
    `#define NL ${L.length}`,
    cfg.water ? '#define WATER' : '', cfg.padi ? '#define PADI' : '', cfg.clouds ? '#define CLOUDS' : '',
    cfg.stars ? '#define STARS' : '', cfg.rainbow ? '#define RAINBOW' : '', cfg.godrays ? '#define GODRAYS' : '',
    cfg.ripples ? '#define RIPPLES' : '', cfg.moon ? '#define MOON' : '', cfg.storm ? '#define STORM' : '',
  ].join('\n');
  return defs + `
const float LD[NL]=float[](${arr(l => l.d)});
const float LB[NL]=float[](${arr(l => l.base)});
const float LA[NL]=float[](${arr(l => l.amp)});
const float LF[NL]=float[](${arr(l => l.freq)});
const float LT[NL]=float[](${arr(l => l.tree || 0)});
const vec3 LC[NL]=vec3[](${L.map(l => `vec3(${l.alb.map(v => v.toFixed(4)).join(',')})`).join(',')});
uniform sampler2D uPre;

vec3 camPos(){ return vec3(uP[5].x, uCam.w, uP[5].y); }

float canopy(float x, float s, float seed){
  float c=x/s, id=floor(c), best=0.;
  for(int k=-1;k<=1;k++){
    float j=id+float(k);
    float h=hash11(j*1.37+seed);
    float cx=j+.5+(hash11(j*2.11+seed)-.5)*.7;
    float r=.42+.4*hash11(j*3.7+seed);
    float d=(c-cx)/r;
    float cr=sqrt(max(0.,1.-d*d))*(.45+.7*h)*r;
    if(h>.92) cr*=1.6;                      // emergent trees
    best=max(best,cr);
  }
  return best;
}

float ridgeCompute(int i, float az){
  float D=LD[i];
  float x=tan(clamp(az,-1.35,1.35))*D+uP[5].x;
  float u=x/D*LF[i];
  float sd=float(i)*7.31+${(cfg.seed || 1).toFixed(2)};
  float wv=fbm(vec2(u*.5,sd+2.),3);
  float m=fbm(vec2(u+wv*.8,sd),5)*.5+.5;
  float pk=ridged(vec2(u*1.9+wv,sd*1.3),4);
  float e=LB[i]+LA[i]*(m*1.3+pk*.35-.45);
  if(LT[i]>0.){
    float s=LT[i];
    e+=(canopy(x,s,sd)*.85+canopy(x+s*.37,s*.55,sd+5.)*.45)*s/D;
  }
  return e;
}

uniform sampler2D uRidge;
float ridge(int i, float az){
#ifdef RIDGEPASS
  return ridgeCompute(i, az);
#else
  float u=clamp((az-uAzR.x)/(uAzR.y-uAzR.x),0.,1.);
  return texture(uRidge, vec2((u*1023.+.5)/1024., (float(i)+.5)/float(NL))).r;
#endif
}

// returns layer index, -1 sky, -2 ground; e = ridge elevation of hit layer
int traceLayers(vec3 rd, out float e){
  float az=azOf(rd), el=elOf(rd);
  for(int i=0;i<NL;i++){
    float bottom=-atan(uCam.w/LD[i]);
    if(el<bottom) return -2;
    float ei=ridge(i,az);
    if(el<ei){ e=ei; return i; }
  }
  e=0.;
  return el<0.?-2:-1;
}

vec3 fogColor(vec3 rd){
  vec3 h=skyLut(normalize(vec3(rd.x,.03,rd.z)));
  return h*.62+uAmb*.42+uSunCol*hg(dot(rd,uSunDir),.72)*.22;
}

float mistOD(float y0, float y1, float dist, float x, float z){
  float Hm=uP[0].y;
  float a=exp(-max(y0,-50.)/Hm), b=exp(-max(y1,-50.)/Hm);
  float k=(y1-y0)/Hm;
  float avg=abs(k)<1e-4?a:(a-b)/k;
  float wn=fbm(vec2(x*.0009+uLT*uP[7].y, z*.0009+y1*.003),4)*.5+.5;
  float wisp=.25+1.6*smoothstep(.25,.75,wn);
  return uP[0].x*dist*avg*wisp;
}

vec3 applyFog(vec3 col, vec3 rd, float dist, float yh, float x, float z){
  float od=uP[0].z*dist+mistOD(uCam.w,yh,dist,x,z);
  float T=exp(-od);
  return col*T+fogColor(rd)*(1.-T);
}

vec3 shadeLayer(int i, vec3 rd, float e){
  float D=LD[i];
  float az=azOf(rd), el=elOf(rd);
  float yh=uCam.w+D*tan(el);
  float x=tan(az)*D+uP[5].x;
  float below=(e-el)*D;                         // metres below the ridge line
  float tsz=LT[i]>0.?LT[i]:D*.012;
  vec2 q=vec2(x,yh)/tsz;
  vec3 n=normalize(vec3(gnoise(q*.35)*1.1, .75+.3*gnoise(q*.7+3.), -.75));
  float diff=max(dot(n,uSunDir),0.);
  float ao=mix(1.,.5,clamp(below/(LA[i]*D*.9+1.),0.,1.));
  float tex=fbm(q*.9,4)*.5+.5;
  // individual tree crowns (voronoi) lit from the sun side
  if(LT[i]>0.){
    vec2 cq=vec2(x,yh*1.6)/(LT[i]*.9);
    vec2 ci=floor(cq), cf=fract(cq); float md=9.; vec2 mo=vec2(0);
    for(int a=-1;a<=1;a++) for(int b=-1;b<=1;b++){ vec2 g=vec2(a,b); vec2 o=hash22(ci+g); vec2 r=g+o-cf; float dd=dot(r,r); if(dd<md){md=dd; mo=r;} }
    float crown=1.-smoothstep(.0,.55,md);
    float side=clamp(.5-dot(normalize(mo+1e-4),normalize(uSunDir.xy+vec2(1e-4,0.)))*.5,0.,1.);
    tex*=.55+.6*crown;
    diff*=.4+1.2*side*crown;
  }
  vec3 col=LC[i]*(uAmb*ao*(.65+.5*tex)+uSunCol*diff*(.35+.6*tex)*.55);
  float mu=dot(rd,uSunDir);
  col+=uSunCol*exp(-below/(tsz*.35))*hg(mu,.8)*.9*LC[i]*6.;   // backlit canopy rim
  col+=uSunCol*exp(-below/(tsz*1.5))*hg(mu,.6)*.05;
  return applyFog(col, rd, D, yh, x, uP[5].y+D);
}

vec3 skyCol(vec3 rd, bool refl){
  vec3 c=skyLut(rd);
  c+=sunDisc(rd, uP[3].z, uP[3].w);
#ifdef STARS
  float night=uP[7].x;
  if(night>0.){
    float hz=smoothstep(0.,.25,rd.y);
    c+=(stars(rd,.35,1.)*uP[2].x+milkyWay(rd, normalize(vec3(.75,.35,-.55)), uP[2].y))*hz*night;
  }
#endif
#ifdef MOON
  {
    vec3 md=normalize(uP[6].xyz);
    float a=acos(clamp(dot(rd,md),-1.,1.));
    float r=uP[6].w;
    if(a<r*1.2){
      vec3 t1=normalize(cross(md,vec3(0,1,0))), t2=cross(t1,md);
      vec2 p=vec2(dot(rd-md,t1),dot(rd-md,t2))/r;
      float disc=smoothstep(1.,.96,length(p));
      vec2 sp=p-vec2(uP[2].z,0.);
      float lit=smoothstep(.98,1.02,length(sp)/1.0);
      float maria=.82+.18*fbm(p*3.+5.,4);
      c+=vec3(1.,.97,.9)*disc*(lit*maria*2.2+.05);
    }
    c+=vec3(.6,.7,.9)*exp(-a/(r*6.))*.08*uP[7].x;
  }
#endif
#ifdef CLOUDS
  vec4 cl=cloudDeck(camPos(), rd, uP[4].w, uP[0].w, uP[5].w, vec2(uLT*uP[5].z*uP[5].w, uLT*uP[5].z*uP[5].w*.35), .32, refl?4:6);
  vec3 cc=cl.rgb+vec3(.75,.8,1.)*uP[2].w*1.6;
#ifdef STORM
  cc*=1.-uP[7].z*.82;
  c*=1.-uP[7].z*.45;
  c=mix(c, c*(1.-uP[7].z*.55)+uAmb*.04, smoothstep(.35,.0,rd.y)*uP[7].z);   // rain curtain haze
#endif
  c=mix(c,cc,cl.a);
#endif
#ifdef RAINBOW
  c+=rainbow(rd,uP[3].x)*smoothstep(.0,.04,rd.y)*uSunCol*.04;
#endif
  return c;
}

#ifdef WATER
float wav(vec2 q){
  float t=uLT;
  return gnoise(q*.16+vec2(t*.12,t*.05))*1.+gnoise(q*.41+vec2(-t*.2,t*.17))*.45+gnoise(q*1.05+vec2(t*.38,-t*.31))*.2+gnoise(q*2.6+vec2(-t*.7,t*.6))*.08;
}
vec3 ripples(vec2 q, float dist){
  vec2 g=vec2(0);
  if(dist>45.) return vec3(0);
  for(int k=0;k<3;k++){
    vec2 qq=q*(4.2+float(k)*1.7)+float(k)*7.;
    vec2 id=floor(qq), f=fract(qq)-.5;
    vec2 h=hash22(id+float(k)*13.);
    float ph=fract(uLT*(.9+h.x*.6)+h.y);
    vec2 d=f-(h-.5)*.5;
    float r=length(d), R=ph*.38;
    float ring=sin((r-R)*55.)*exp(-pow((r-R)*16.,2.))*(1.-ph)*(1.-ph);
    g+=normalize(d+1e-4)*ring;
  }
  return vec3(g.x,0.,g.y)*uP[1].y*.45*smoothstep(35.,3.,dist);
}
vec3 shadeWater(vec3 rd){
  vec3 ro=camPos();
  float t=uCam.w/max(-rd.y,1e-4);
  vec3 p=ro+rd*t;
  float fade=1./(1.+t*.0035);
  float e=.06+t*.0025;
  vec2 q=p.xz;
  float h0=wav(q), hx=wav(q+vec2(e,0)), hz=wav(q+vec2(0,e));
  float amp=uP[1].x*fade;
  vec3 n=normalize(vec3(-(hx-h0)/e*amp, 1., -(hz-h0)/e*amp));
#ifdef RIPPLES
  n=normalize(n+ripples(q,t));
#endif
  vec3 rr=reflect(rd,n); rr.y=max(rr.y,.002);
  float er; int li=traceLayers(rr, er);
  vec3 refl=li>=0?shadeLayer(li,rr,er):skyCol(rr,true);
  float F=.02+.98*pow(1.-max(dot(n,-rd),0.),5.);
  vec3 deep=uAmb*vec3(.03,.06,.065)*(1.-uP[1].z);
  vec3 col=mix(deep,refl,F);
  col+=uSunCol*pow(max(dot(rr,uSunDir),0.),700.)*55.*fade;
  return applyFog(col, rd, t, 0., p.x, p.z);
}
#endif

#ifdef PADI
vec3 shadePadi(vec3 rd){
  vec3 ro=camPos();
  float t=uCam.w/max(-rd.y,1e-4);
  vec3 p=ro+rd*t;
  float px=t*.0016+.002;                       // pixel footprint (m)
  float rows=smoothstep(.0,.6,abs(sin(p.x*PI/.28+gnoise(p.xz*.7)*.8)));
  rows=mix(rows,.55,clamp(px*6.,0.,1.));
  float tufts=vnoise(p.xz*vec2(9.,5.))*vnoise(p.xz*vec2(23.,11.)+3.);
  rows=mix(rows, .35+.9*tufts, smoothstep(8.,2.,t));
  float wind=.5+.5*sin((p.x*.35+p.z*.55)*.22-uLT*uP[1].w*1.6+fbm(p.xz*.03,3)*3.);
  float tuft=fbm(p.xz*vec2(1.3,.6),4)*.5+.5;
  vec3 young=vec3(.042,.105,.022), ripe=vec3(.26,.21,.06);
  float patchy=fbm(p.xz*.018+3.,4)*.5+.5;
  vec3 alb=mix(young,ripe,uP[7].w*(.6+.8*patchy))*(.45+.3*rows+.3*tuft)*(.7+.38*wind)*(.62+.45*patchy);
  float mu=dot(rd,uSunDir);
  vec3 col=alb*(uAmb*.9+uSunCol*max(uSunDir.y,0.)*.9)+uSunCol*alb*hg(mu,.55)*(1.5+wind)*.55;
  // batas: narrow grassy embankment with a worn track in the middle
  float bx=abs(p.x-uP[4].z);
  float path=smoothstep(.5+px*2.,.38,bx);
  float track=smoothstep(.22+px,.08,bx);
  float gn=fbm(p.xz*vec2(3.,1.5),4)*.5+.5;
  vec3 grassc=vec3(.05,.075,.025)*(.75+.5*gn);
  vec3 dirt=vec3(.11,.09,.05)*(.8+.4*gn);
  vec3 pathc=mix(grassc,dirt,track*.75)*(uAmb*1.1+uSunCol*.22);
  pathc+=uSunCol*grassc*hg(mu,.55)*.6;
  col=mix(col,pathc,path);
  // water glints between plants (flooded field)
  float wet=smoothstep(.5,.85,fbm(p.xz*.15,3)*.5+.5)*(1.-path)*(1.-uP[7].w);
  vec3 rr=reflect(rd,vec3(0,1,0));
  col=mix(col, skyLut(rr)*.6+uSunCol*pow(max(dot(rr,uSunDir),0.),300.)*20., wet*.35*smoothstep(15.,60.,t));
  return applyFog(col, rd, t, .5, p.x, p.z);
}
#endif

vec3 shadeGround(vec3 rd){
#ifdef WATER
  return shadeWater(rd);
#endif
#ifdef PADI
  return shadePadi(rd);
#endif
  float t=uCam.w/max(-rd.y,1e-4);
  vec3 p=camPos()+rd*t;
  vec3 col=vec3(.04,.07,.035)*(uAmb*.8+uSunCol*.2);
  return applyFog(col, rd, t, 0., p.x, p.z);
}

#ifdef RIDGEPASS
void main(){
  int i=int(floor(gl_FragCoord.y));
  float az=mix(uAzR.x,uAzR.y,(gl_FragCoord.x-.5)/(uRes.x-1.));
  fragColor=vec4(ridgeCompute(i,az),0.,0.,1.);
}
#elif defined(PREPASS)
void main(){
  vec3 rd=camRay(gl_FragCoord.xy);
  float e; int li=traceLayers(rd,e);
  float v=0.;
  if(li==-1){
    v=1.;
  #ifdef CLOUDS
    vec4 cl=cloudDeck(camPos(), rd, uP[4].w, uP[0].w, uP[5].w, vec2(uLT*uP[5].z*uP[5].w, uLT*uP[5].z*uP[5].w*.35), .32, 4);
    v*=1.-cl.a;
  #endif
  }
  fragColor=vec4(v,0.,0.,1.);
}
#else
void main(){
  vec3 rd=camRay(gl_FragCoord.xy);
  float e; int li=traceLayers(rd,e);
  vec3 col;
  if(li>=0) col=shadeLayer(li,rd,e);
  else if(li==-1) col=skyCol(rd,false);
  else col=shadeGround(rd);
#ifdef GODRAYS
  {
    vec2 uv=gl_FragCoord.xy/uRes;
    vec2 sp=uP[4].xy;
    vec2 d=(sp-uv);
    float acc=0., w=1.;
    const int N=40;
    vec2 st=d/float(N);
    float j=hash12(gl_FragCoord.xy+uT);
    vec2 s=uv+st*j;
    for(int k=0;k<N;k++){ acc+=texture(uPre,s).r*w; w*=.965; s+=st; }
    acc/=float(N)*.55;
    float fall=exp(-length(d*vec2(1.,1.6))*1.8);
    col+=uSunCol*acc*fall*uP[3].y*.08;
  }
#endif
  col=aces(col*uExp);
  col=toSRGB(col);
  float lu=luma(col);
  col=mix(vec3(lu),col,${(cfg.sat ?? 1.12).toFixed(3)});
  col=mix(col, col*col*(3.-2.*col), ${(cfg.contrast ?? .25).toFixed(3)});
  fragColor=vec4(clamp(col,0.,1.),1.);
}
#endif
`;
}

// extra passes for a landscape scene: ridge lookup (+ god-ray visibility)
function landscapePasses(n, godrays) {
  const p = [{ name: 'uRidge', define: 'RIDGEPASS', w: 1024, h: n, float: true }];
  if (godrays) p.push({ name: 'uPre', define: 'PREPASS', scale: .25 });
  return p;
}

// Same camera model as camRay() in GLSL; world -> screen px.
function projectPt(cam, p) {
  let d = [p[0] - (cam.x || 0), p[1] - cam.h, p[2] - (cam.z || 0)];
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  d = [d[0] * cy - d[2] * sy, d[1], d[0] * sy + d[2] * cy];
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  d = [d[0], d[1] * cp - d[2] * sp, d[1] * sp + d[2] * cp];
  const f = 1 / Math.tan(cam.fov / 2);
  return [W / 2 + d[0] / d[2] * f / 2 * H, H / 2 - d[1] / d[2] * f / 2 * H, d[2]];
}
function sunScreen(cam, sd) {
  const s = projectPt({ ...cam, x: 0, z: 0 }, [sd[0] * 1e6, cam.h + sd[1] * 1e6, sd[2] * 1e6]);
  return [s[0] / W, 1 - s[1] / H];
}
