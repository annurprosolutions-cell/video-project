// Shared GLSL: noise, atmosphere, clouds, stars, water helpers, tonemapping.
const GLSL_HEAD = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uRes;        // render-target size
uniform float uT;         // global time (s)
uniform float uLT;        // local scene time (s)
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSunColHi;  // sunlight at cloud altitude
uniform vec3 uAmb;
uniform float uExp;
uniform vec4 uCam;        // x: yaw, y: pitch, z: vertical fov (rad), w: camera height (m)
uniform vec4 uP[8];       // scene parameters
uniform vec2 uAzR;        // azimuth range covered by per-frame lookup textures
uniform sampler2D uSky;   // sky LUT
#define PI 3.14159265359
`;

const GLSL_LIB = `
float hash11(float p){ p=fract(p*.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
vec3 hash32(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yxz+33.33); return fract((p3.xxy+p3.yzz)*p3.zyx); }

float gnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*f*(f*(f*6.-15.)+10.);
  vec2 ga=hash22(i)*2.-1., gb=hash22(i+vec2(1,0))*2.-1., gc=hash22(i+vec2(0,1))*2.-1., gd=hash22(i+vec2(1,1))*2.-1.;
  float va=dot(ga,f), vb=dot(gb,f-vec2(1,0)), vc=dot(gc,f-vec2(0,1)), vd=dot(gd,f-vec2(1,1));
  return mix(mix(va,vb,u.x),mix(vc,vd,u.x),u.y);
}
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x),u.y); }
const mat2 ROT=mat2(1.6,1.2,-1.2,1.6);
float fbm(vec2 p, int oct){ float a=.5, s=0.; for(int i=0;i<9;i++){ if(i>=oct) break; s+=a*gnoise(p); p=ROT*p; a*=.5; } return s; }
float fbmv(vec2 p, int oct){ float a=.5, s=0.; for(int i=0;i<9;i++){ if(i>=oct) break; s+=a*vnoise(p); p=ROT*p; a*=.5; } return s; }
float ridged(vec2 p, int oct){ float a=.5, s=0.; for(int i=0;i<9;i++){ if(i>=oct) break; s+=a*(1.-abs(gnoise(p)*1.6)); p=ROT*p; a*=.5; } return s; }
float fbm1(float x, float seed, int oct){ return fbm(vec2(x, seed*17.31), oct); }

vec3 aces(vec3 x){ const float a=2.51,b=.03,c=2.43,d=.59,e=.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.); }
vec3 toSRGB(vec3 c){ return pow(c, vec3(1./2.2)); }
float luma(vec3 c){ return dot(c, vec3(.2126,.7152,.0722)); }
float hg(float mu, float g){ float gg=g*g; return (1.-gg)/(4.*PI*pow(1.+gg-2.*g*mu,1.5)); }

// ---------- camera
vec3 camRay(vec2 frag){
  vec2 uv=(frag-.5*uRes)/uRes.y;
  float f=1./tan(uCam.z*.5);
  vec3 rd=normalize(vec3(uv.x*2., uv.y*2., f));
  float cp=cos(uCam.y), sp=sin(uCam.y);
  rd=vec3(rd.x, rd.y*cp+rd.z*sp, -rd.y*sp+rd.z*cp);
  float cy=cos(uCam.x), sy=sin(uCam.x);
  rd=vec3(rd.x*cy+rd.z*sy, rd.y, -rd.x*sy+rd.z*cy);
  return rd;
}
float azOf(vec3 d){ return atan(d.x, d.z); }
float elOf(vec3 d){ return asin(clamp(d.y,-1.,1.)); }

// ---------- sky LUT (azimuth +-1.3 rad, elevation -0.05..pi/2)
const float LUT_AZ=1.3;
vec2 dirToLut(vec3 d){
  float az=clamp(azOf(d), -LUT_AZ, LUT_AZ);
  float el=clamp(elOf(d), -.05, PI*.5);
  return vec2(az/(2.*LUT_AZ)+.5, sqrt((el+.05)/(PI*.5+.05)));
}
vec3 lutToDir(vec2 uv){
  float az=(uv.x-.5)*2.*LUT_AZ;
  float el=uv.y*uv.y*(PI*.5+.05)-.05;
  return vec3(cos(el)*sin(az), sin(el), cos(el)*cos(az));
}
vec3 skyLut(vec3 d){ return texture(uSky, dirToLut(d)).rgb*8.; }   // LUT stores radiance/8

// ---------- atmosphere (single scattering, after wwwtyro/glsl-atmosphere)
vec2 rsi(vec3 r0, vec3 rd, float sr){
  float a=dot(rd,rd), b=2.*dot(rd,r0), c=dot(r0,r0)-sr*sr, d=b*b-4.*a*c;
  if(d<0.) return vec2(1e5,-1e5);
  return vec2((-b-sqrt(d))/(2.*a),(-b+sqrt(d))/(2.*a));
}
vec3 atmosphere(vec3 r, vec3 pSun, float kMie){
  const float rPlanet=6371e3, rAtmos=6471e3, iSun=22., shRlh=8e3, shMie=1.2e3, g=.758;
  const vec3 kRlh=vec3(5.5e-6,13.0e-6,22.4e-6);
  vec3 r0=vec3(0,rPlanet+1000.,0);
  vec2 p=rsi(r0,r,rAtmos); if(p.x>p.y) return vec3(0);
  p.y=min(p.y, rsi(r0,r,rPlanet).x);
  const int IS=16, JS=8;
  float iStep=(p.y-p.x)/float(IS), iTime=0.;
  vec3 tR=vec3(0), tM=vec3(0); float iOdR=0., iOdM=0.;
  float mu=dot(r,pSun), mumu=mu*mu, gg=g*g;
  float pR=3./(16.*PI)*(1.+mumu);
  float pM=3./(8.*PI)*((1.-gg)*(mumu+1.))/(pow(1.+gg-2.*mu*g,1.5)*(2.+gg));
  for(int i=0;i<IS;i++){
    vec3 ip=r0+r*(iTime+iStep*.5);
    float ih=length(ip)-rPlanet;
    float odR=exp(-ih/shRlh)*iStep, odM=exp(-ih/shMie)*iStep;
    iOdR+=odR; iOdM+=odM;
    float jStep=rsi(ip,pSun,rAtmos).y/float(JS), jt=0., jR=0., jM=0.;
    for(int j=0;j<JS;j++){ vec3 jp=ip+pSun*(jt+jStep*.5); float jh=length(jp)-rPlanet; jR+=exp(-jh/shRlh)*jStep; jM+=exp(-jh/shMie)*jStep; jt+=jStep; }
    vec3 att=exp(-(kMie*(iOdM+jM)+kRlh*(iOdR+jR)));
    tR+=odR*att; tM+=odM*att; iTime+=iStep;
  }
  return iSun*(pR*kRlh*tR+pM*kMie*tM);
}

// sun disc + soft corona
vec3 sunDisc(vec3 rd, float size, float glow){
  float mu=dot(rd,uSunDir);
  float a=acos(clamp(mu,-1.,1.));
  float disc=smoothstep(size*1.15, size*.85, a);
  return uSunCol*(disc*40. + glow*exp(-a*a/(size*size*30.))*2.5 + glow*.12*exp(-a*9.));
}

// ---------- 2D cloud deck on a plane; returns colour (linear) and alpha
vec4 cloudDeck(vec3 ro, vec3 rd, float alt, float cover, float scale, vec2 wind, float sharp, int oct){
  if(rd.y<.004) return vec4(0);
  float t=(alt-ro.y)/rd.y;
  vec2 p=(ro.xz+rd.xz*t)*scale+wind;
  float n=fbm(p, oct)*.5+.5;
  float d=smoothstep(cover, cover+sharp, n);
  if(d<.001) return vec4(0);
  vec2 sd=normalize(uSunDir.xz+1e-4)*.35;
  float n2=fbm(p+sd, max(oct-2,3))*.5+.5;
  float occ=smoothstep(cover-.05, cover+sharp, n2);
  float lit=exp(-occ*2.2);
  float mu=dot(rd,uSunDir);
  float silver=hg(mu,.55)*(1.-d*.7)*4.;
  vec3 col=uAmb*(.55+.25*(1.-d)) + uSunColHi*(lit*.55*max(uSunDir.y+.15,0.)*4. + silver*.6)*.35;
  float fade=exp(-t*2.2e-5);
  return vec4(col, d*fade);
}

// ---------- night sky
vec3 stars(vec3 rd, float density, float tw){
  if(rd.y<0.) return vec3(0);
  vec2 p=rd.xz/(rd.y+1.);
  vec3 c=vec3(0);
  // k=0: many faint stars, k=1: fewer bright ones
  for(int k=0;k<2;k++){
    float sc=k==0?520.:170.;
    vec2 q=p*sc+float(k)*37.;
    vec2 id=floor(q), f=fract(q)-.5;
    vec3 h=hash32(id+float(k)*91.);
    float dens=k==0?density*.5:density*.22;
    if(h.z<dens){
      vec2 o=(h.xy-.5)*.6;
      float r=length(f-o);
      float b=k==0?(.03+.12*h.x*h.x):(.25+2.2*pow(hash12(id+7.),5.));
      float twinkle=.75+.25*sin(uT*(2.+h.x*5.)*tw+h.y*40.);
      vec3 tint=mix(vec3(.75,.82,1.), vec3(1.,.86,.7), h.x);
      float w=k==0?.16:.12;
      c+=tint*b*twinkle*exp(-r*r/(w*w))*1.6;
    }
  }
  return c;
}
vec3 milkyWay(vec3 rd, vec3 axis, float strength){
  vec3 ax=normalize(axis);
  float d=dot(rd, ax);
  vec3 t1=normalize(cross(ax, vec3(0.,1.,0.)+vec3(.001)));
  vec3 t2=cross(ax,t1);
  vec2 q=vec2(dot(rd,t1), dot(rd,t2))*3.;
  float band=exp(-d*d*42.);
  float core=exp(-d*d*160.);
  float n=fbm(q*2.2,6)*.5+.5;
  float dust=smoothstep(.48,.72,fbm(q*4.+3.,5)*.5+.5)*smoothstep(.0,.3,band);
  vec3 col=mix(vec3(.45,.52,.75), vec3(1.,.83,.64), core)*band*(.25+n*n*1.3)*(1.-dust*.85);
  float grain=pow(hash12(floor(q*700.)),30.)*band*2.;
  return (col*.35+grain*.6)*strength;
}

// physically-flavoured rainbow (primary + faint secondary)
vec3 rainbow(vec3 rd, float strength){
  vec3 anti=-uSunDir;
  float a=acos(clamp(dot(rd,anti),-1.,1.))*180./PI;
  float x=(a-40.6)/1.9;          // 0 inner (violet) .. 1 outer (red)
  vec3 c=vec3(0);
  if(x>-.2 && x<1.2){
    vec3 spec=clamp(vec3(smoothstep(.45,.95,x)-smoothstep(.95,1.15,x), smoothstep(.15,.5,x)-smoothstep(.55,.85,x), smoothstep(-.1,.15,x)-smoothstep(.25,.5,x)),0.,1.);
    c+=spec;
  }
  float x2=(a-50.2)/3.2;
  if(x2>-.2 && x2<1.2){
    vec3 spec=clamp(vec3(smoothstep(-.1,.15,x2)-smoothstep(.25,.5,x2), smoothstep(.15,.5,x2)-smoothstep(.55,.85,x2), smoothstep(.45,.95,x2)-smoothstep(.95,1.15,x2)),0.,1.);
    c+=spec*.35;
  }
  float inside=smoothstep(41.,30.,a)*.08;   // brighter sky inside the bow
  return (c+inside)*strength;
}

// final grading helper
vec3 grade(vec3 c, vec3 lift, vec3 gain, float sat){
  float l=luma(c);
  c=mix(vec3(l),c,sat);
  return clamp(c*gain+lift*(1.-c),0.,1.);
}
`;

// Sky LUT pass: radiance/8 so it fits RGBA8 with headroom.
const SKY_LUT_FS = GLSL_HEAD + GLSL_LIB + `
uniform float uKMie;
void main(){
  vec3 d=lutToDir(vUv);
  vec3 c=atmosphere(d, uSunDir, uKMie);
  fragColor=vec4(c/8.,1.);
}`;
