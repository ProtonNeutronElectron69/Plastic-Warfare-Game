/* ---------------- WEBGL PRESENT & POST ---------------- */
/* v93, roadmap 3 phase 3 (first cut): the world still renders through the
   UNCHANGED canvas-2d code into worldCv; this stage uploads that frame as a
   texture and replaces the present+post pass with real shaders - separable
   gaussian bloom, tilt-shift bands, the warm/cool grade and the vignette -
   compositing on its own WebGL canvas that sits UNDER #view in the DOM.
   #view stays on top for input and for the screen-space overlays (placement
   ghost, drag box), which glComposite clears it down to.

   THE RULE FROM PHASES 1-2, APPLIED TO RENDERERS: GL OVERRIDES, IT NEVER
   REPLACES. compositePost() in the previous file is the permanent fallback -
   headless (the shim's fake context flunks the link check on purpose), old
   browsers, a lost GL context, or a player opening the game with #nogl in the
   URL all get exactly the v92 present path. Both paths read their tuning from
   the one POSTV table, so they cannot drift apart. T69 pins all of this.

   NOTHING HERE TOUCHES THE SIMULATION. No srand, no writes to G, no state
   that is hashed or serialized: two lockstep clients can disagree about
   having WebGL and must still agree tick for tick. A GL failure of any kind
   marks the stage dead and answers false; render() never learns why.

   Dependency-free on purpose. The roadmap's phase-3 sketch named PixiJS, but
   a scene-graph library neither helps a post pipeline nor ships inside one
   self-contained file for free; the ~250 lines below are the whole cost. The
   sprite-band migration (phase 3's second cut) will grow INSIDE this stage. */
let GLP=null; // the stage: {gl,cv,...} once alive, {dead:1} once given up on. Client-local, never hashed.
function glComposite(){
 try{
  if(GLP&&GLP.dead)return false;
  if(typeof location!=='undefined'&&/\bnogl\b/.test(location.hash||''))return false; // the A/B escape hatch
  if(!ensureGL())return false;
  const g=GLP,gl=g.gl,W=view.width,H=view.height;
  // the frame the 2d code just drew, up to the GPU
  gl.bindTexture(gl.TEXTURE_2D,g.texWorld);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,worldCv);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  // bloom: bright-pass at quarter res, then a separable gaussian
  pass(g.pBright,g.fbBloomA,g.qw,g.qh,[['uTex',g.texWorld]],p=>{
   gl.uniform1f(p.uBr,POSTV.bloomBr);gl.uniform1f(p.uCon2,POSTV.bloomCon);gl.uniform1f(p.uSat2,POSTV.bloomSat);
  });
  pass(g.pBlur,g.fbBloomB,g.qw,g.qh,[['uTex',g.txBloomA]],p=>{gl.uniform2f(p.uDir,1/g.qw,0);gl.uniform1fv(p.uW,g.wBloom);});
  pass(g.pBlur,g.fbBloomA,g.qw,g.qh,[['uTex',g.txBloomB]],p=>{gl.uniform2f(p.uDir,0,1/g.qh);gl.uniform1fv(p.uW,g.wBloom);});
  // tilt-shift source: third-res copy, same gaussian
  pass(g.pCopy,g.fbTsA,g.tw,g.th,[['uTex',g.texWorld]],null);
  pass(g.pBlur,g.fbTsB,g.tw,g.th,[['uTex',g.txTsA]],p=>{gl.uniform2f(p.uDir,1/g.tw,0);gl.uniform1fv(p.uW,g.wTs);});
  pass(g.pBlur,g.fbTsA,g.tw,g.th,[['uTex',g.txTsB]],p=>{gl.uniform2f(p.uDir,0,1/g.th);gl.uniform1fv(p.uW,g.wTs);});
  // composite to the screen
  pass(g.pComp,null,W,H,[['uWorld',g.texWorld],['uBloom',g.txBloomA],['uTs',g.txTsA]],p=>{
   gl.uniform2f(p.uRes,W,H);
   gl.uniform1f(p.uSat,POSTV.sat);gl.uniform1f(p.uCon,POSTV.con);gl.uniform1f(p.uBloomAdd,POSTV.bloomAdd);
   gl.uniform1f(p.uTopH,POSTV.tsTopH);gl.uniform1f(p.uTopA,POSTV.tsTopA);
   gl.uniform1f(p.uBotH,POSTV.tsBotH);gl.uniform1f(p.uBotA,POSTV.tsBotA);
   const c1=hx2rgb(POSTV.g1c),c2=hx2rgb(POSTV.g2c);
   gl.uniform3f(p.uG1,c1.r/255,c1.g/255,c1.b/255);gl.uniform1f(p.uG1a,POSTV.g1a);
   gl.uniform3f(p.uG2,c2.r/255,c2.g/255,c2.b/255);gl.uniform1f(p.uG2a,POSTV.g2a);
   const vin=POSTV.vinC.split(',');
   gl.uniform3f(p.uVinC,vin[0]/255,vin[1]/255,vin[2]/255);gl.uniform1f(p.uVinA,POSTV.vinA);
   gl.uniform4f(p.uVin,POSTV.vinCX,(POSTV.vinCY0+POSTV.vinCY1)*.5,Math.min(W,H)*POSTV.vinR0,Math.hypot(W,H)*POSTV.vinR1);
  });
  // only the screen-space overlays (ghost, drag box) ride above the GL frame
  vc.setTransform(1,0,0,1,0,0);vc.clearRect(0,0,W,H);
  return true;
 }catch(e){
  if(!GLP)GLP={};
  if(!GLP.dead){
   GLP.dead=1;
   /* headless has no real WebGL and its fake context flunks the link check BY
      DESIGN - that is the suite exercising the fallback, not a failure worth
      shouting about. Only an environment that could have had GL warns. */
   if(typeof WebGLRenderingContext!=='undefined')try{console.warn('[pw] WebGL post stage failed; falling back to the 2d compositor:',e);}catch(_){}
  }
  return false;
 }
}
function pass(prog,fb,w,h,texs,setU){
 const gl=GLP.gl;
 gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
 gl.viewport(0,0,w,h);
 gl.useProgram(prog.p);
 for(let i=0;i<texs.length;i++){
  gl.activeTexture(gl.TEXTURE0+i);
  gl.bindTexture(gl.TEXTURE_2D,texs[i][1]);
  gl.uniform1i(prog[texs[i][0]],i);
 }
 if(setU)setU(prog);
 gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
}
/* GLSL 100, so a WebGL1 context is enough. The color math transcribes the CSS
   filter and canvas blend-mode definitions the 2d compositor uses: brightness/
   contrast/saturate per the filter-effects spec, 'overlay' and 'soft-light'
   per the compositing spec, so the two paths compute the same look. The one
   knowing approximation: the canvas vignette is a two-center radial gradient;
   here it is a single center at the midpoint of the two, which is under half
   a percent of screen height apart - invisible, and noted rather than hidden. */
const GLSL_VERT='attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const GLSL_BRIGHT='precision mediump float;varying vec2 uv;uniform sampler2D uTex;uniform float uBr,uCon2,uSat2;'+
 'void main(){vec3 c=texture2D(uTex,uv).rgb*uBr;c=clamp((c-.5)*uCon2+.5,0.,1.);'+
 'float l=dot(c,vec3(.213,.715,.072));c=clamp(l+(c-l)*uSat2,0.,1.);gl_FragColor=vec4(c,1.);}';
const GLSL_BLUR='precision mediump float;varying vec2 uv;uniform sampler2D uTex;uniform vec2 uDir;uniform float uW[7];'+
 'void main(){vec3 c=texture2D(uTex,uv).rgb*uW[0];'+
 'for(int i=1;i<7;i++){c+=texture2D(uTex,uv+uDir*float(i)).rgb*uW[i];c+=texture2D(uTex,uv-uDir*float(i)).rgb*uW[i];}'+
 'gl_FragColor=vec4(c,1.);}';
const GLSL_COPY='precision mediump float;varying vec2 uv;uniform sampler2D uTex;void main(){gl_FragColor=vec4(texture2D(uTex,uv).rgb,1.);}';
const GLSL_COMP='precision mediump float;varying vec2 uv;'+
 'uniform sampler2D uWorld,uBloom,uTs;uniform vec2 uRes;'+
 'uniform float uSat,uCon,uBloomAdd,uTopH,uTopA,uBotH,uBotA,uG1a,uG2a,uVinA;'+
 'uniform vec3 uG1,uG2,uVinC;uniform vec4 uVin;'+
 'vec3 satcon(vec3 c){float l=dot(c,vec3(.213,.715,.072));c=l+(c-l)*uSat;return clamp((c-.5)*uCon+.5,0.,1.);}'+
 'vec3 ovl(vec3 b,vec3 t){vec3 lo=2.*b*t,hi=1.-2.*(1.-b)*(1.-t);return mix(lo,hi,step(vec3(.5),b));}'+
 'float Dsl(float b){return b<=.25?((16.*b-12.)*b+4.)*b:sqrt(b);}'+
 'float sl1(float b,float t){return t<=.5?b-(1.-2.*t)*b*(1.-b):b+(2.*t-1.)*(Dsl(b)-b);}'+
 'void main(){'+
 'vec3 c=satcon(texture2D(uWorld,uv).rgb);'+
 'c=clamp(c+texture2D(uBloom,uv).rgb*uBloomAdd,0.,1.);'+
 'float syn=1.-uv.y;'+                                          // distance from the top edge, 0..1
 'float m=clamp(uTopA*clamp(1.-syn/uTopH,0.,1.)+uBotA*clamp((syn-(1.-uBotH))/uBotH,0.,1.),0.,1.);'+
 'c=mix(c,texture2D(uTs,uv).rgb,m);'+
 'c=mix(c,ovl(c,uG1),uG1a);'+
 'c=mix(c,vec3(sl1(c.r,uG2.r),sl1(c.g,uG2.g),sl1(c.b,uG2.b)),uG2a);'+
 'float d=distance(vec2(uv.x*uRes.x,syn*uRes.y),vec2(uRes.x*uVin.x,uRes.y*uVin.y));'+
 'c=mix(c,uVinC,uVinA*clamp((d-uVin.z)/max(1.,uVin.w-uVin.z),0.,1.));'+
 'gl_FragColor=vec4(c,1.);}';
function glProg(gl,fsrc,unis){
 const compile=(ty,src)=>{const s=gl.createShader(ty);gl.shaderSource(s,src);gl.compileShader(s);
  if(gl.getShaderParameter(s,gl.COMPILE_STATUS)!==true)throw new Error('shader: '+(gl.getShaderInfoLog?gl.getShaderInfoLog(s):'?'));return s;};
 const p=gl.createProgram();
 gl.attachShader(p,compile(gl.VERTEX_SHADER,GLSL_VERT));
 gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fsrc));
 gl.bindAttribLocation(p,0,'p');gl.linkProgram(p);
 if(gl.getProgramParameter(p,gl.LINK_STATUS)!==true)throw new Error('link: '+(gl.getProgramInfoLog?gl.getProgramInfoLog(p):'?'));
 const o={p};for(const u of unis)o[u]=gl.getUniformLocation(p,u);
 return o;
}
function glGauss(sigma){
 const w=[];let sum=0;
 for(let i=0;i<7;i++){const v=Math.exp(-(i*i)/(2*sigma*sigma));w.push(v);sum+=i?2*v:v;}
 return w.map(v=>v/sum);
}
function ensureGL(){
 if(GLP&&GLP.dead)return false;
 const W=view.width,H=view.height;
 if(!W||!H)return false;
 if(GLP&&GLP.gl){
  if(GLP.cv.width!==W||GLP.cv.height!==H)glSize(W,H);
  return true;
 }
 const cv=document.createElement('canvas');
 cv.width=W;cv.height=H;
 /* v94: refuse a SOFTWARE rasterizer. Measured on a GPU-less box, CPU-emulated
    GL costs ~2x the whole 2d frame - a machine without real GL is exactly the
    machine the 2d fallback exists for. #forcegl overrides, for testing. */
 const att={alpha:false,antialias:false,depth:false,stencil:false,
  failIfMajorPerformanceCaveat:!(typeof location!=='undefined'&&/\bforcegl\b/.test(location.hash||''))};
 const gl=cv.getContext('webgl',att)||cv.getContext('experimental-webgl',att);
 if(!gl)return false;
 /* everything from here throws into glComposite's catch on a fake or broken
    context - the shim's permissive proxy dies at the first link-status check,
    which is exactly the capability test we want */
 GLP={gl,cv};
 GLP.pBright=glProg(gl,GLSL_BRIGHT,['uTex','uBr','uCon2','uSat2']);
 GLP.pBlur=glProg(gl,GLSL_BLUR,['uTex','uDir','uW[0]']);GLP.pBlur.uW=GLP.pBlur['uW[0]'];
 GLP.pCopy=glProg(gl,GLSL_COPY,['uTex']);
 GLP.pComp=glProg(gl,GLSL_COMP,['uWorld','uBloom','uTs','uRes','uSat','uCon','uBloomAdd',
  'uTopH','uTopA','uBotH','uBotA','uG1','uG1a','uG2','uG2a','uVinC','uVinA','uVin']);
 const buf=gl.createBuffer();
 gl.bindBuffer(gl.ARRAY_BUFFER,buf);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
 GLP.texWorld=glTex(gl);
 glSize(W,H); // v97: the gaussian weights moved in here, so a DPR change re-derives them with the buffers
 if(gl.getError()!==0)throw new Error('gl init error');
 /* alive: put the canvas UNDER #view so input and overlays are untouched.
    v97: a canvas is a REPLACED element - inset:0 positions it but never
    stretches it, so with a device-px backing it must carry an explicit CSS
    size (glSize keeps it at the CSS viewport). Pre-v97 the backing WAS the
    CSS size, which is why the missing width never showed. */
 cv.style.position='absolute';cv.style.left='0';cv.style.top='0'; // properties, not cssText: glSize already wrote the CSS size and cssText would wipe it
 view.parentNode.insertBefore(cv,view);
 cv.addEventListener('webglcontextlost',ev=>{try{ev.preventDefault();}catch(_){}GLP.dead=1;try{cv.remove();}catch(_){}});
 return true;
}
/* v94, phase 3 second cut: THE BAND STAGE. renderCore hands the sprite
   band's canvas here before merging it onto the scene; the answer is either
   that canvas untouched (no GL - headless, #nogl, a dead context) or a
   GL-processed copy from an offscreen context of its own.

   v96, phase 5: the passthrough became the LIGHTING SHADER. Two textures go
   up - the color band and the normal band renderCore's blit sites filled in
   register with it - and every band pixel is relit per-pixel: the constant
   lamp (same direction the painters and the offline material pass always
   used) modulated by the pixel's own surface direction, a plastic specular,
   and up to LIGHTV.max point lights collected each frame from what is
   actually burning, exploding or firing on screen. The math is NORMALIZED
   so a flat pixel (no normal map, nm.a<.5) comes out exactly as it went in:
   the whole v95 look is the identity case, procedural fallback cells and
   live-drawn gear included - they simply sit flat under the same lamp.
   Premultiplied in and out for the color band; the normal band uploads
   WITHOUT premultiply, because its RGB are directions, not colors.
   Fallback rule as everywhere: GL overrides, never replaces. */
let GLB=null; // the band stage: {gl,cv,...} once alive, {dead:1} once given up on. Client-local, never hashed.
/* THE LIGHTING TUNING TABLE - the shader's only source of numbers, so the
   look is one edit and one pin. dir/z: the game's constant lamp (LIGHT of
   the painters, given altitude). amb/kd/ks/shin: the normalized relight -
   amb+kd scale RELIEF strength, not overall brightness (flat pixels are
   untouched whatever these hold). Point lights: radius px at zoom 1, color,
   intensity; ptZ their height above the band in px. */
const LIGHTV={
 z:.70,amb:.60,kd:.62,ks:.55,shin:26,
 max:10,ptZ:36,
 ex:{r:170,c:[1.0,.62,.28],i:1.05},   // explosion core flash, by remaining life
 fire:{r:90,c:[1.0,.55,.20],i:.75},   // one burning ground cell (clusters sum). v96.1: owner heard it right - .34/64 read as nothing
 flame:{r:120,c:[1.0,.52,.18],i:.85}, // v96.1: a flame WEAPON mid-stream - flamethrower, firebomb heli - lit at the stream's midpoint
 flash:{r:80,c:[1.0,.78,.42],i:.5}    // a muzzle flash, by remaining flash time
};
const GLSL_BAND='precision mediump float;varying vec2 uv;'+
 'uniform sampler2D uTex,uNrm;uniform vec2 uRes;'+
 'uniform vec3 uLdir;uniform float uAmb,uKd,uKs,uShin;'+
 'uniform int uLn;uniform vec3 uLp[10];uniform vec3 uLc[10];uniform float uLr[10];'+
 'void main(){'+
 'vec4 c=texture2D(uTex,uv);'+
 'vec4 nm=texture2D(uNrm,uv);'+
 'vec3 n=nm.a<.5?vec3(0.,0.,1.):normalize(nm.rgb*2.-1.);'+
 'float base=(uAmb+uKd*max(dot(n,uLdir),0.))/(uAmb+uKd*uLdir.z);'+
 'vec3 hv=normalize(uLdir+vec3(0.,0.,1.));'+
 'float spec=uKs*(pow(max(dot(n,hv),0.),uShin)-pow(hv.z,uShin));'+
 'vec2 px=vec2(uv.x*uRes.x,(1.-uv.y)*uRes.y);'+   // canvas coords, y down - the normals' own frame
 'vec3 add=vec3(0.);'+
 'for(int i=0;i<10;i++){if(i>=uLn)break;'+
  'vec3 d=vec3(uLp[i].xy-px,uLp[i].z);'+
  'float dist=length(d);'+
  'float at=max(0.,1.-dist/uLr[i]);at*=at;'+
  'add+=uLc[i]*at*max(dot(n,d/max(dist,1.)),0.);}'+
 'gl_FragColor=vec4(clamp(c.rgb*base+(spec*c.a)+add*c.a,0.,1.),c.a);}';
/* create-or-resize the band context; shared by bandPresent and bandLit so
   the first lit frame is the first frame. All the v94 discipline lives
   here now: software-GL refusal, #forcegl, context-loss kills the stage. */
function bandEnsure(){
 if(GLB&&GLB.dead)return false;
 if(typeof location!=='undefined'&&/\bnogl\b/.test(location.hash||''))return false;
 const W=view.width,H=view.height;
 if(!W||!H)return false;
 if(GLB&&GLB.gl){
  if(GLB.cv.width!==W||GLB.cv.height!==H){GLB.cv.width=W;GLB.cv.height=H;}
  return true;
 }
 const cv=document.createElement('canvas');cv.width=W;cv.height=H;
 const gl=cv.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,
  failIfMajorPerformanceCaveat:!(typeof location!=='undefined'&&/\bforcegl\b/.test(location.hash||''))}); // v94: same software-GL refusal as the post stage
 if(!gl)return false;
 GLB={gl,cv,lights:[]};
 GLB.prog=glProg(gl,GLSL_BAND,['uTex','uNrm','uRes','uLdir','uAmb','uKd','uKs','uShin',
  'uLn','uLp[0]','uLc[0]','uLr[0]']);
 const buf=gl.createBuffer();
 gl.bindBuffer(gl.ARRAY_BUFFER,buf);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
 GLB.tex=glTex(gl);
 GLB.texN=glTex(gl);
 if(gl.getError()!==0)throw new Error('band gl init error');
 cv.addEventListener('webglcontextlost',ev=>{try{ev.preventDefault();}catch(_){}GLB.dead=1;});
 return true;
}
/* the switch renderCore reads before spending anything on the normal band:
   true only when the GL stage is usable AND the bake actually holds normal
   maps. Never throws - a failure marks the stage dead, like bandPresent. */
function bandLit(){
 try{return !!(SPR.done&&SPR.hasNrm&&bandEnsure());}
 catch(e){GLB={dead:1};return false;}
}
function bandPresent(){
 try{
  if(!bandEnsure())return sprCv;
  const g=GLB,gl=g.gl,W=view.width,H=view.height;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.viewport(0,0,W,H);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D,g.tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,sprCv);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D,g.texN);
  /* directions, not colors: no premultiply, ever */
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,nrmCv||sprCv);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.useProgram(g.prog.p);
  gl.uniform1i(g.prog.uTex,0);gl.uniform1i(g.prog.uNrm,1);
  gl.uniform2f(g.prog.uRes,W,H);
  const dl=Math.hypot(LIGHT.x,LIGHT.y,LIGHTV.z);
  gl.uniform3f(g.prog.uLdir,LIGHT.x/dl,LIGHT.y/dl,LIGHTV.z/dl);
  gl.uniform1f(g.prog.uAmb,LIGHTV.amb);gl.uniform1f(g.prog.uKd,LIGHTV.kd);
  gl.uniform1f(g.prog.uKs,LIGHTV.ks);gl.uniform1f(g.prog.uShin,LIGHTV.shin);
  const ls=g.lights||[],n=Math.min(ls.length,LIGHTV.max);
  const lp=new Float32Array(LIGHTV.max*3),lc=new Float32Array(LIGHTV.max*3),lr=new Float32Array(LIGHTV.max);
  for(let i=0;i<n;i++){const l=ls[i];lp[i*3]=l.x;lp[i*3+1]=l.y;lp[i*3+2]=l.z;lc[i*3]=l.c[0];lc[i*3+1]=l.c[1];lc[i*3+2]=l.c[2];lr[i]=l.r;}
  gl.uniform1i(g.prog.uLn,n);
  gl.uniform3fv(g.prog['uLp[0]'],lp);gl.uniform3fv(g.prog['uLc[0]'],lc);gl.uniform1fv(g.prog['uLr[0]'],lr);
  gl.disable(gl.BLEND);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  /* renderCore drawImages this canvas in the SAME task, before the browser
     composites - which is why no preserveDrawingBuffer is needed */
  return g.cv;
 }catch(e){
  GLB={dead:1};
  if(typeof WebGLRenderingContext!=='undefined')try{console.warn('[pw] WebGL band stage failed; presenting the band directly:',e);}catch(_){}
  return sprCv;
 }
}
/* v96: what is allowed to cast light, gathered fresh each frame in canvas
   pixels. Three sources, all of them things the player can already SEE -
   everything is gated on vision, so a hidden enemy's muzzle flash lights
   nothing (light through fog would be a wallhack). Burning ground cells
   cluster by 4x4 tile buckets so a napalm field is a few steady lights
   rather than a lottery over the cap. Flicker rides G.tick (shared, but
   render-only); no srand, no Math.random, nothing written to G. */
function bandLightsCollect(cx,cy,zz){
 const L=GLB.lights=[];
 const put=(wx,wy,r,c,i)=>{
  if(L.length>=LIGHTV.max||i<=0)return;
  const x=(isoX(wx,wy)-cx)*zz,y=(isoY(wx,wy)-cy)*zz,rr=r*zz;
  if(x<-rr||y<-rr||x>view.width+rr||y>view.height+rr)return;
  L.push({x,y,z:LIGHTV.ptZ*zz,r:rr,c:[c[0]*i,c[1]*i,c[2]*i]});
 };
 for(const p of G.parts){
  if(p.t!=='ex')continue;
  if(fogAt(p.x,p.y)!==2)continue;
  put(p.x,p.y,LIGHTV.ex.r*(p.sc||1),LIGHTV.ex.c,LIGHTV.ex.i*Math.max(0,p.life/.36));
 }
 const buckets={};
 for(const s of G.strikes){
  if(!s.burn)continue;
  for(const b of s.burn){
   if(fogAt(b.x,b.y)!==2)continue;
   const k=(b.x>>2)+'_'+(b.y>>2);
   const e=buckets[k]||(buckets[k]={x:0,y:0,n:0});
   e.x+=b.x+.5;e.y+=b.y+.5;e.n++;
  }
 }
 for(const k in buckets){
  const e=buckets[k],fl=.75+.25*Math.sin(G.tick*.6+e.x*1.7+e.y*2.3);
  put(e.x/e.n,e.y/e.n,LIGHTV.fire.r*Math.sqrt(e.n),LIGHTV.fire.c,LIGHTV.fire.i*Math.min(e.n,6)*fl);
 }
 for(const u of G.units){
  if(!(u.flash>0)||u.garrisoned)continue;
  if(u.p!==G.human&&!visibleToHuman(u))continue;
  /* v96.1: a flame weapon mid-stream is a fire, not a muzzle pop - bigger,
     warmer, and lit at the stream's midpoint so the glow sits on what is
     being burned rather than on the nozzle */
  if(u.t.w==='f'){
   const t=u.target&&u.target.x!=null?u.target:u;
   put((u.x+t.x)/2,(u.y+t.y)/2,LIGHTV.flame.r,LIGHTV.flame.c,LIGHTV.flame.i*Math.min(1,u.flash/.1));
   continue;
  }
  put(u.x,u.y,LIGHTV.flash.r,LIGHTV.flash.c,LIGHTV.flash.i*Math.min(1,u.flash/.1));
 }
}
function glTex(gl){
 const t=gl.createTexture();
 gl.bindTexture(gl.TEXTURE_2D,t);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 return t;
}
function glTarget(gl,w,h){
 const t=glTex(gl);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
 const fb=gl.createFramebuffer();
 gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
 gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
 return {t,fb};
}
function glSize(W,H){
 const g=GLP,gl=g.gl;
 g.cv.width=W;g.cv.height=H;
 g.cv.style.width=Math.round(W/RDPR)+'px';g.cv.style.height=Math.round(H/RDPR)+'px'; // v97: see ensureGL - replaced elements keep their intrinsic size
 /* v97: sigma is a pixel value and the buffers are device pixels now, so the
    same POSTV numbers mean the same VISUAL blur at any RDPR - exactly the
    scaling the 2d compositor applies to its filter strings */
 g.wBloom=glGauss(POSTV.bloomBlur*RDPR);g.wTs=glGauss(POSTV.tsBlur*RDPR);
 g.qw=Math.max(2,Math.round(W/4));g.qh=Math.max(2,Math.round(H/4)); // bloom res, matching blCv
 g.tw=Math.max(2,Math.round(W/3));g.th=Math.max(2,Math.round(H/3)); // tilt res, matching tsCv
 for(const k of ['tgBloomA','tgBloomB','tgTsA','tgTsB'])if(g[k]){gl.deleteTexture(g[k].t);gl.deleteFramebuffer(g[k].fb);}
 g.tgBloomA=glTarget(gl,g.qw,g.qh);g.tgBloomB=glTarget(gl,g.qw,g.qh);
 g.tgTsA=glTarget(gl,g.tw,g.th);g.tgTsB=glTarget(gl,g.tw,g.th);
 g.fbBloomA=g.tgBloomA.fb;g.txBloomA=g.tgBloomA.t;g.fbBloomB=g.tgBloomB.fb;g.txBloomB=g.tgBloomB.t;
 g.fbTsA=g.tgTsA.fb;g.txTsA=g.tgTsA.t;g.fbTsB=g.tgTsB.fb;g.txTsB=g.tgTsB.t;
}
