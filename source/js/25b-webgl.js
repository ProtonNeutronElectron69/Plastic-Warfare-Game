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
 const gl=cv.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false})
       ||cv.getContext('experimental-webgl',{alpha:false,antialias:false,depth:false,stencil:false});
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
 GLP.wBloom=glGauss(POSTV.bloomBlur);GLP.wTs=glGauss(POSTV.tsBlur);
 glSize(W,H);
 if(gl.getError()!==0)throw new Error('gl init error');
 /* alive: put the canvas UNDER #view so input and overlays are untouched */
 cv.style.cssText='position:absolute;inset:0';
 view.parentNode.insertBefore(cv,view);
 cv.addEventListener('webglcontextlost',ev=>{try{ev.preventDefault();}catch(_){}GLP.dead=1;try{cv.remove();}catch(_){}});
 return true;
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
 g.qw=Math.max(2,Math.round(W/4));g.qh=Math.max(2,Math.round(H/4)); // bloom res, matching blCv
 g.tw=Math.max(2,Math.round(W/3));g.th=Math.max(2,Math.round(H/3)); // tilt res, matching tsCv
 for(const k of ['tgBloomA','tgBloomB','tgTsA','tgTsB'])if(g[k]){gl.deleteTexture(g[k].t);gl.deleteFramebuffer(g[k].fb);}
 g.tgBloomA=glTarget(gl,g.qw,g.qh);g.tgBloomB=glTarget(gl,g.qw,g.qh);
 g.tgTsA=glTarget(gl,g.tw,g.th);g.tgTsB=glTarget(gl,g.tw,g.th);
 g.fbBloomA=g.tgBloomA.fb;g.txBloomA=g.tgBloomA.t;g.fbBloomB=g.tgBloomB.fb;g.txBloomB=g.tgBloomB.t;
 g.fbTsA=g.tgTsA.fb;g.txTsA=g.tgTsA.t;g.fbTsB=g.tgTsB.fb;g.txTsB=g.tgTsB.t;
}
