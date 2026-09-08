/* ---------------- GROUND MATERIALS ---------------- */
/* v108: THE FLOOR IS A REAL SURFACE, NOT A MOLDED SLAB.
   Through v107 every board's ground was laid one tile at a time by paintIsoTile:
   a diamond of the theme colour with two lit facets and two shaded ones - a
   raised bevel on every tile, which is exactly what a sheet of molded plastic
   looks like, and it was the same on a lawn, a sandbox and a wooden desk. The
   units are toy plastic ON PURPOSE; the floor they stand on is the real house,
   and the owner asked for it to read that way.
   So the ground is laid in three coats now, and the seam is one function
   (groundLay) with two call sites - the board's own bake and the Field Manual's
   little swatch - so the manual's lawn is the board's lawn:
     1. the BASE COAT: one flat diamond per tile in the theme palette, with a
        small tone wobble. No bevel. Under the headless shim, which has no
        canvas that paints, this coat is the whole floor, which is why it stays
        a real fill per tile rather than a single rectangle: the recorders in
        the suite count it, and a browser with no pattern support still gets a
        floor in the right colour.
     2. the MATERIAL SWATCH: a small square of the surface generated per pixel
        at bake time (groundTex) - value noise for the mottle, a stroke pass for
        blades or pile - and tiled over the board as a canvas pattern UNDER THE
        ISO TRANSFORM. A pattern laid in world space foreshortens with the
        board, the way v107.2's hexagons do, so a blade drawn "up" in the swatch
        stands up on the screen and a wood ring runs along the desk. Two themes
        (the kitchen's ceramic and the bathroom's porcelain) tile the swatch as
        an OVERLAY of luminance only, so their checker and mosaic keep their own
        colours and gain the glaze.
     3. the BLOTCHES: a few dozen soft world-space ellipses per board, off the
        terrain's own stream, so the eight-tile repeat of the swatch never lines
        up into a grid - a lawn's dry patch, a carpet's worn path, damp sand.
   The slab skirt went the same way (groundSkirt): a cut turf edge over soil,
   a tile's own thickness over its mortar bed, a carpet's pile over its jute
   backing, a sandbox's plank frame, a desk's varnished edge with its end grain,
   an attic's board ends over the joists. The contact shadow onto the table
   below stays - the board is still a section of floor sitting in the dark.
   None of this is simulation. The swatch runs on its OWN mulberry stream
   (seeded off the map seed) rather than the terrain's, so the decorations laid
   after the ground do not move when the swatch's recipe changes; nothing here
   reads srand() (rule 2). The whole bake is still a one-time cost in newGame. */
const GROUND_TEX=512;     // the material swatch, in pixels
const GROUND_SPAN=8;      // world tiles one swatch spans before it repeats
const GROUND_PAL={
 grass: {base:'#5d9440',alt:'#558a38',edge:'#3a5e26',side:'#2f4d20',sideD:'#223a17'},
 tile:  {base:'#d6dde1',alt:'#c2cace',edge:'#9aa3a8',side:'#aeb6bb',sideD:'#878f94'},
 carpet:{base:'#b6a890',alt:'#aca085',edge:'#857a62',side:'#968a70',sideD:'#776c54'},
 desk:  {base:'#b98a4e',alt:'#ad7e42',edge:'#7c5528',side:'#8a6236',sideD:'#6b4a26'},
 /* v107.2 (owner pass): warm porcelain - a cream white over a mushroom-grey
    skirt - so the bathroom no longer shares the kitchen's cool grey-blue */
 bath:  {base:'#ece6dc',alt:'#e0d8cb',edge:'#a2968a',side:'#c0b5a6',sideD:'#988d7f'},
 attic: {base:'#8c6a45',alt:'#805f3d',edge:'#4e3a22',side:'#5f4629',sideD:'#46331d'},   // v107: dusty floorboards
 sand:  {base:'#ddbd7a',alt:'#d2af68',edge:'#a8884a',side:'#bfa066',sideD:'#9a7d48'}};
function groundPal(th){return GROUND_PAL[th]||GROUND_PAL.sand}

/* periodic value noise. Integer lattice hash, smoothstep blend, and the lattice
   WRAPS at fu x fv cells so a swatch sampled over u,v in [0,1) tiles seamlessly.
   Everything below is a pure function of its arguments - no state, no stream. */
function gHash(x,y,s){let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,1274126177))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296}
function gNoise(u,v,fu,fv,s){
 const x=u*fu,y=v*fv,xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
 const x0=((xi%fu)+fu)%fu,y0=((yi%fv)+fv)%fv,x1=(x0+1)%fu,y1=(y0+1)%fv;
 const a=gHash(x0,y0,s),b=gHash(x1,y0,s),c=gHash(x0,y1,s),d=gHash(x1,y1,s);
 return a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy;}
function gFbm(u,v,f,s,oct){let a=0,w=.5,t=0;for(let i=0;i<oct;i++){a+=gNoise(u,v,f,f,s+i*7)*w;t+=w;w*=.5;f*=2}return a/t}

/* the material swatch: a GROUND_TEX square of the surface, seamless, in world
   orientation (swatch x is world x, swatch y is world y). `overlay` swatches
   are luminance only, centred on mid grey, and are tiled with the 'overlay'
   blend so the coat beneath keeps its colour. */
function groundTex(th,seed){
 const S=GROUND_TEX,cv=document.createElement('canvas');cv.width=S;cv.height=S;const c=cv.getContext('2d');
 const img=c.createImageData(S,S),d=img.data,sd=((seed|0)^0x6f0d)&0xffff;
 const rnd=mulberry(sd^0x51ab),overlay=th==='tile'||th==='bath';
 const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const u=x/S,v=y/S,i=(y*S+x)*4;let r,g,b;
  if(th==='grass'){
   /* turf: a slow patchiness between a deep green and a sun-yellowed one, a
      fast clutter for the blade mass, and a per-pixel jitter so no two pixels
      read the same */
   const m=gFbm(u,v,3,sd,4),f1=gNoise(u,v,96,96,sd+3),f2=gNoise(u,v,180,180,sd+5);
   const k=Math.min(1,Math.max(0,m*.7+f1*.45-.1));
   const col=mix([58,104,40],[128,176,72],k),j=.86+f2*.28;
   r=col[0]*j;g=col[1]*j;b=col[2]*j;
  } else if(th==='sand'){
   /* wind ripples (a warped sine across the swatch), damp patches, and a grain
      speckle: a few bright quartz grains, more dark ones, most in between */
   const w=gFbm(u,v,4,sd,3),rip=Math.sin((v*7+w*1.3+u)*6.283)*.5+.5;   // whole cycles in u AND v: a fractional cycle is a seam
   const damp=gFbm(u+.37,v+.11,2,sd+9,3),gr=gHash(x,y,sd+21),gn=gNoise(u,v,256,256,sd+2);
   const col=mix([214,182,116],[232,205,142],rip*.55+gn*.45);
   const dk=1-(damp-.5)*.22;
   r=col[0]*dk;g=col[1]*dk;b=col[2]*dk;
   if(gr>.975){r=r*.35+240*.65;g=g*.35+232*.65;b=b*.35+205*.65}   // quartz
   else if(gr<.07){r*=.72;g*=.7;b*=.66}                             // a dark grain
  } else if(th==='carpet'){
   /* plush pile: a fine two-scale fuzz stretched along the pile's lay, over a
      slow tuft mottle with a little hue drift */
   const p1=gNoise(u,v,160,64,sd+1),p2=gNoise(u+.5,v,320,128,sd+2),t=gFbm(u,v,5,sd+4,3);
   const pile=.78+(p1*.6+p2*.4)*.42,tone=1+(t-.5)*.16;
   r=(182+(t-.5)*18)*pile*tone;g=(168+(t-.5)*6)*pile*tone;b=(144-(t-.5)*12)*pile*tone;
  } else if(th==='desk'){
   /* a varnished desktop: growth rings running along x, warped so they wander,
      sharpened so each ring has a hard late-wood edge, over fine open pores */
   const w=gFbm(u,v,3,sd,3),ph=v*9+w*2.4+u,ring=Math.sin(ph*6.283)*.5+.5;
   const late=Math.pow(ring,3.2),pore=gNoise(u,v,40,600,sd+8);
   const col=mix([198,150,88],[150,104,52],late*.62+pore*.3);
   const sheen=1+(gFbm(u,v,2,sd+6,2)-.5)*.12;
   r=col[0]*sheen;g=col[1]*sheen;b=col[2]*sheen;
  } else if(th==='attic'){
   /* bare floorboards, two tiles wide, running along x: each board has its own
      tone and its own grain phase, a dark seam on one side, a lit arris on the
      other, and a film of dust that settles in the low-frequency hollows */
   const nb=GROUND_SPAN/2,bi=Math.floor(v*nb),lv=v*nb-bi,bt=gHash(bi,0,sd+11);
   const w=gFbm(u,v,3,sd+bi,3),ph=lv*5+w*1.8+bt*9+u,ring=Math.sin(ph*6.283)*.5+.5;
   const late=Math.pow(ring,2.4),pore=gNoise(u,v,48,400,sd+13);
   const col=mix([150,116,78],[104,76,46],late*.55+pore*.3),tone=.9+bt*.2;
   const dust=gFbm(u,v,4,sd+17,2);
   r=col[0]*tone;g=col[1]*tone;b=col[2]*tone;
   if(dust>.62){const k=(dust-.62)*.9;r+=(190-r)*k;g+=(180-g)*k;b+=(165-b)*k}
   if(lv<.035){const k=1-lv/.035;r*=1-k*.55;g*=1-k*.55;b*=1-k*.55}
   else if(lv>.965){const k=(lv-.965)/.035;r+=(220-r)*k*.5;g+=(200-g)*k*.5;b+=(170-b)*k*.5}
  } else if(th==='tile'){
   /* the kitchen's ceramic, as an overlay: glaze mottle inside each four-tile
      square, a pillowed edge (lit on the north-west sides, shaded on the
      south-east), and a fine grit */
   const n=GROUND_SPAN/4,lu=(u*n)%1,lv=(v*n)%1;
   const m=gFbm(u,v,6,sd,3),grit=gNoise(u,v,256,256,sd+3);
   let L=128+(m-.5)*30+(grit-.5)*10;
   const e=.055;
   if(lu<e)L+=(1-lu/e)*22; if(lv<e)L+=(1-lv/e)*22;
   if(lu>1-e)L-=(1-(1-lu)/e)*26; if(lv>1-e)L-=(1-(1-lv)/e)*26;
   r=g=b=L;
  } else { // bath: porcelain glaze, as an overlay under the mosaic's own grout
   const m=gFbm(u,v,7,sd,3),grit=gNoise(u,v,300,300,sd+3);
   r=g=b=128+(m-.5)*22+(grit-.5)*14;
  }
  d[i]=r<0?0:r>255?255:r;d[i+1]=g<0?0:g>255?255:g;d[i+2]=b<0?0:b>255?255:b;d[i+3]=255;
 }
 c.putImageData(img,0,0);
 /* the stroke pass, in swatch space. A blade that crosses the swatch's edge is
    drawn again one swatch over so the tiling has no seam - every stroke here is
    laid at its four wrapped positions when it is within reach of an edge. */
 const wrapStroke=(x,y,dx,dy)=>{
  const m=12,xs=[0],ys=[0];if(x<m)xs.push(S);else if(x>S-m)xs.push(-S);if(y<m)ys.push(S);else if(y>S-m)ys.push(-S);
  for(const ox of xs)for(const oy of ys){c.beginPath();c.moveTo(x+ox,y+oy);c.lineTo(x+ox+dx,y+oy+dy);c.stroke();}};
 if(th==='grass'){
  /* blades stand UP on the screen: under the iso transform that is the swatch
     direction (-1,-1). Three tones, lighter tips drawn last. */
  c.lineCap='round';
  const tones=['rgba(46,88,30,.55)','rgba(104,160,60,.5)','rgba(160,204,96,.42)','rgba(72,124,44,.5)'];
  for(let i=0;i<3200;i++){const x=rnd()*S,y=rnd()*S,l=3+rnd()*5,a=-2.356+(rnd()-.5)*.7;
   c.strokeStyle=tones[(i*7)%4];c.lineWidth=.9+rnd()*.7;wrapStroke(x,y,Math.cos(a)*l,Math.sin(a)*l);}
 } else if(th==='carpet'){
  c.lineCap='round';c.lineWidth=1;
  /* the pile lays one way, with a scatter: short tufts, light and dark, denser than the fuzz beneath */
  for(let i=0;i<3600;i++){const x=rnd()*S,y=rnd()*S,l=2+rnd()*3,a=-.6+(rnd()-.5)*1.6;
   c.strokeStyle=(i&1)?'rgba(232,218,190,.4)':'rgba(88,76,56,.34)';c.lineWidth=.8+rnd()*.7;wrapStroke(x,y,Math.cos(a)*l,Math.sin(a)*l);}
 } else if(th==='sand'){
  c.fillStyle='rgba(120,98,66,.35)';
  for(let i=0;i<220;i++){const x=rnd()*S,y=rnd()*S,rr2=.8+rnd()*1.4,a=rnd()*3,m=6;
   for(const ox of (x<m?[0,S]:x>S-m?[0,-S]:[0]))for(const oy of (y<m?[0,S]:y>S-m?[0,-S]:[0])){c.beginPath();c.ellipse(x+ox,y+oy,rr2*1.4,rr2,a,0,7);c.fill();}}
 }
 return cv;
}

/* the ground, laid at (ox,oy) as the screen position of world (0,0): the base
   coat, the swatch, the blotches, then the fine strokes that do not repeat.
   `rnd` is the caller's terrain stream; the swatch never touches it. */
function groundLay(c,th,N,rnd,ox,oy,seed){
 const PAL=groundPal(th);
 const X=(x,y)=>(x-y)*HW+ox,Y=(x,y)=>(x+y)*HH+oy;
 // ---- 1. base coat: one flat diamond per tile, a small wobble, NO bevel ----
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const sx=X(x,y),sy=Y(x,y);let col;
  if(th==='tile'){const big=((x>>2)+(y>>2))%2;col=shade(big?PAL.alt:PAL.base,.98+rnd()*.04);}
  else if(th==='bath'){col=shade(PAL.base,.985+rnd()*.03);}   // v107.2: nearly flat under the mosaic
  else if(th==='grass'){col=shade(((x*7+y*5)%9<2)?PAL.alt:PAL.base,.96+rnd()*.08);}
  else{col=shade(PAL.base,.96+rnd()*.08);}
  c.fillStyle=col;c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+HW,sy+HH);c.lineTo(sx,sy+TH);c.lineTo(sx-HW,sy+HH);c.closePath();c.fill();
 }
 // ---- 2. the material swatch, tiled in WORLD space ----
 const overlay=th==='tile'||th==='bath';
 if(!overlay||th==='tile'){ // the bath's overlay goes on AFTER its mosaic, from renderTerrain
  const tex=groundTex(th,seed),k=GROUND_SPAN/GROUND_TEX;
  c.save();
  c.setTransform(HW*k,HH*k,-HW*k,HH*k,ox,oy);   // one swatch pixel = k world tiles
  c.fillStyle=c.createPattern(tex,'repeat');
  if(overlay){c.globalCompositeOperation='overlay';c.globalAlpha=.9}else c.globalAlpha=.94;
  c.fillRect(0,0,N/k,N/k);
  c.restore();
 }
 // ---- 3. blotches: soft world-space ellipses so the swatch's repeat never shows ----
 if(!overlay){
  const B={grass:[['rgba(112,132,52,',.34],['rgba(30,62,24,',.26]],
           sand:[['rgba(150,118,70,',.22],['rgba(246,232,196,',.18]],
           carpet:[['rgba(80,68,48,',.16],['rgba(236,226,206,',.14]],
           desk:[['rgba(60,36,14,',.14],['rgba(240,214,160,',.12]],
           attic:[['rgba(40,26,12,',.22],['rgba(214,200,180,',.16]]}[th]||[['rgba(0,0,0,',.1],['rgba(255,255,255,',.1]];
  c.save();c.setTransform(HW,HH,-HW,HH,ox,oy);
  const n=Math.max(4,Math.floor(N*N/80));
  for(let i=0;i<n;i++){const wx=rnd()*N,wy=rnd()*N,r=2.5+rnd()*6,t=B[i&1],a=t[1]*(.5+rnd()*.5);
   const g=c.createRadialGradient(wx,wy,0,wx,wy,r);g.addColorStop(0,t[0]+a.toFixed(3)+')');g.addColorStop(1,t[0]+'0)');
   c.fillStyle=g;c.beginPath();c.ellipse(wx,wy,r,r*(.6+rnd()*.5),rnd()*3,0,7);c.fill();}
  c.restore();
 }
 // ---- 4. fine strokes that do not repeat: tufts, clover, grain, flecks ----
 if(th==='grass'){
  c.lineWidth=1.1;c.lineCap='round';
  for(let i=0;i<Math.floor(N*N*.22);i++){const gx=rnd()*N,gy=rnd()*N,px=X(gx,gy),py=Y(gx,gy)+HH,s=.7+rnd()*.9;
   c.strokeStyle=rnd()<.5?'rgba(56,104,32,.5)':'rgba(126,188,74,.45)';
   c.beginPath();for(let k2=0;k2<3;k2++){const a=-1.57+(k2-1)*.55+(rnd()-.5)*.3;c.moveTo(px,py);c.lineTo(px+dcos(a)*5.5*s,py+dsin(a)*5.5*s);}c.stroke();}
  // clover: three tiny leaves, darker than the lawn
  c.fillStyle='rgba(38,84,36,.6)';
  for(let i=0;i<Math.floor(N*N*.03);i++){const gx=rnd()*N,gy=rnd()*N,px=X(gx,gy),py=Y(gx,gy)+HH;
   for(let k2=0;k2<3;k2++){const a=k2*2.094+rnd()*.4;c.beginPath();c.ellipse(px+dcos(a)*1.6,py+dsin(a)*1,1.5,.9,a,0,7);c.fill();}}
 } else if(th==='sand'){
  for(let i=0;i<N*N;i++){const gx=rnd()*N,gy=rnd()*N,px=X(gx,gy),py=Y(gx,gy)+HH;
   c.fillStyle=rnd()<.5?'rgba(255,240,200,.14)':'rgba(120,90,44,.16)';c.fillRect(px,py,1.3,1.3);}
 } else if(th==='carpet'){
  c.save();c.globalAlpha=.4;c.lineCap='round';c.lineWidth=1;
  for(let i=0;i<Math.floor(N*N*.3);i++){const gx=rnd()*N,gy=rnd()*N,px=X(gx,gy),py=Y(gx,gy)+HH;
   const a=rnd()*6.28,l=1.5+rnd()*2.5;
   c.strokeStyle=rnd()<.5?'rgba(210,196,168,.6)':'rgba(96,86,64,.6)';
   c.beginPath();c.moveTo(px,py);c.lineTo(px+dcos(a)*l,py+dsin(a)*l*.5);c.stroke();}
  c.restore();
  c.save();c.globalAlpha=.35;for(let i=0;i<Math.floor(N*N*.04);i++){const gx=rnd()*N,gy=rnd()*N;c.fillStyle='rgba(60,52,38,.5)';c.beginPath();c.ellipse(X(gx,gy),Y(gx,gy)+HH,1.6,1,0,0,7);c.fill();}c.restore();
 } else if(th==='desk'){
  // a few real knots, each a whorl of rings, laid in world space so they lie flat
  c.save();c.setTransform(HW,HH,-HW,HH,ox,oy);c.lineWidth=.06;
  for(let i=0;i<Math.max(2,Math.floor(N*N/1300));i++){const wx=rnd()*N,wy=rnd()*N,kr=.22+rnd()*.3;
   c.fillStyle='rgba(84,52,22,.4)';c.beginPath();c.ellipse(wx,wy,kr*1.6,kr,.2,0,7);c.fill();
   c.strokeStyle='rgba(60,36,14,.2)';for(let r=1;r<4;r++){c.beginPath();c.ellipse(wx,wy,kr*1.6*(1+r*.3),kr*(1+r*.36),.2,0,7);c.stroke();}}
  c.restore();
 } else if(th==='tile'){
  for(let i=0;i<Math.floor(N*N*.5);i++){const gx=rnd()*N,gy=rnd()*N,px=X(gx,gy),py=Y(gx,gy)+HH;
   c.fillStyle=rnd()<.5?'rgba(255,255,255,.05)':'rgba(60,70,78,.05)';c.fillRect(px,py,1.6,1.6);}
 } else if(th==='bath'){
  // v107.2: fine porcelain grain, cool against the warm glaze, reading THROUGH the mosaic's translucent glaze pass
  for(let i=0;i<N*N;i++){const gx=rnd()*N,gy=rnd()*N,px=X(gx,gy),py=Y(gx,gy)+HH;
   c.fillStyle=rnd()<.5?'rgba(255,255,255,.07)':'rgba(120,110,96,.06)';c.fillRect(px,py,1.5,1.5);}
 }
}
/* the bath's glaze overlay is laid by renderTerrain after the mosaic, so the
   hexagons and their grout get the mottle rather than the coat under them */
function groundOverlay(c,th,N,ox,oy,seed,alpha){
 const tex=groundTex(th,seed),k=GROUND_SPAN/GROUND_TEX;
 c.save();c.setTransform(HW*k,HH*k,-HW*k,HH*k,ox,oy);
 c.fillStyle=c.createPattern(tex,'repeat');c.globalCompositeOperation='overlay';c.globalAlpha=alpha;
 c.fillRect(0,0,N/k,N/k);c.restore();
}

/* the board's edge: the contact shadow on the table, then the two visible
   faces of the floor's own thickness, drawn as the material's real edge */
function groundSkirt(c,th,N,rnd,ox,oy,DEPTH){
 const PAL=groundPal(th);
 const X=(x,y)=>(x-y)*HW+ox,Y=(x,y)=>(x+y)*HH+oy;
 const E=[X(N,0),Y(N,0)],So=[X(N,N),Y(N,N)],Wp=[X(0,N),Y(0,N)];
 const sp=DEPTH*.57; // the shadow's reach below the slab, scaled with its depth
 // soft contact shadow cast onto the "table" below the slab
 {const sg=c.createLinearGradient(0,So[1]+DEPTH,0,So[1]+DEPTH+sp);sg.addColorStop(0,'rgba(0,0,0,.28)');sg.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=sg;
  c.beginPath();c.moveTo(Wp[0],Wp[1]+DEPTH);c.lineTo(So[0],So[1]+DEPTH+sp*.17);c.lineTo(E[0],E[1]+DEPTH);c.lineTo(E[0]+sp*.4,E[1]+DEPTH+sp*.4);c.lineTo(So[0],So[1]+DEPTH+sp*.65);c.lineTo(Wp[0]-sp*.4,Wp[1]+DEPTH+sp*.4);c.closePath();c.fill();}
 const face=(a,b,fill)=>{c.fillStyle=fill;c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(b[0],b[1]+DEPTH);c.lineTo(a[0],a[1]+DEPTH);c.closePath();c.fill();};
 const band=(a,b,y0,y1,fill)=>{c.fillStyle=fill;c.beginPath();c.moveTo(a[0],a[1]+y0);c.lineTo(b[0],b[1]+y0);c.lineTo(b[0],b[1]+y1);c.lineTo(a[0],a[1]+y1);c.closePath();c.fill();};
 const vgrad=(top,c0,c1)=>{const g=c.createLinearGradient(0,top,0,top+DEPTH);g.addColorStop(0,c0);g.addColorStop(1,c1);return g};
 const along=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 const lip=DEPTH*.17;
 c.save();
 if(th==='grass'){
  // cut turf: a dark root mat over soil, the grass hanging a little over the edge
  face(Wp,So,vgrad(Wp[1],'#6a4a2c','#3a2716'));face(So,E,vgrad(E[1],'#553a22','#2c1d10'));
  band(Wp,So,0,lip,'#3e5224');band(So,E,0,lip,'#33451e');
  c.fillStyle='rgba(20,14,8,.35)';
  for(let i=0;i<N*3;i++){const onW=rnd()<.5,p=along(onW?Wp:So,onW?So:E,rnd()),yy=p[1]+lip+rnd()*(DEPTH-lip);c.beginPath();c.ellipse(p[0],yy,1.4+rnd()*1.6,.8+rnd()*.8,rnd(),0,7);c.fill();}
  c.strokeStyle='rgba(104,150,60,.7)';c.lineWidth=1;c.lineCap='round';
  for(let i=0;i<N*4;i++){const onW=rnd()<.5,p=along(onW?Wp:So,onW?So:E,rnd());c.beginPath();c.moveTo(p[0],p[1]);c.lineTo(p[0]+(rnd()-.5)*2,p[1]+lip*.6+rnd()*lip);c.stroke();}
  c.strokeStyle='rgba(150,110,70,.5)';
  for(let i=0;i<N;i++){const onW=rnd()<.5,p=along(onW?Wp:So,onW?So:E,rnd());c.beginPath();c.moveTo(p[0],p[1]+lip);c.lineTo(p[0]+(rnd()-.5)*4,p[1]+lip+DEPTH*.3+rnd()*DEPTH*.4);c.stroke();}
 } else if(th==='tile'||th==='bath'){
  // the tile's own thickness, a fine dark joint under it, then the mortar bed and its backer
  const mort=th==='tile'?['#a8a49e','#6f6b66']:['#b3aa9c','#7c7368'];
  face(Wp,So,vgrad(Wp[1],mort[0],mort[1]));face(So,E,vgrad(E[1],shade(mort[0],.9),shade(mort[1],.86)));
  band(Wp,So,0,lip,shade(PAL.base,.94));band(So,E,0,lip,shade(PAL.base,.86));
  band(Wp,So,lip,lip+1.5,'rgba(0,0,0,.4)');band(So,E,lip,lip+1.5,'rgba(0,0,0,.45)');
  c.fillStyle='rgba(255,255,255,.35)';
  for(let i=0;i<N*2;i++){const onW=rnd()<.5,p=along(onW?Wp:So,onW?So:E,rnd());c.fillRect(p[0],p[1]+lip+2+rnd()*(DEPTH-lip-3),1.2,1);}
  c.fillStyle='rgba(0,0,0,.17)';   // .17, not .18: T89.F pins .18 as the attic mothball's own
  for(let i=0;i<N*2;i++){const onW=rnd()<.5,p=along(onW?Wp:So,onW?So:E,rnd());c.fillRect(p[0],p[1]+lip+2+rnd()*(DEPTH-lip-3),1.6,1.2);}
 } else if(th==='carpet'){
  // pile over a jute backing, cross-woven
  face(Wp,So,vgrad(Wp[1],'#8a6a44','#5a4430'));face(So,E,vgrad(E[1],'#76593a','#4a3626'));
  c.strokeStyle='rgba(0,0,0,.14)';c.lineWidth=1;
  for(let i=0;i<N*2;i++){for(const [a,b] of [[Wp,So],[So,E]]){const p=along(a,b,i/(N*2));c.beginPath();c.moveTo(p[0],p[1]+lip);c.lineTo(p[0]+DEPTH*.3,p[1]+DEPTH);c.stroke();c.beginPath();c.moveTo(p[0],p[1]+DEPTH);c.lineTo(p[0]+DEPTH*.3,p[1]+lip);c.stroke();}}
  band(Wp,So,0,lip,PAL.sideD);band(So,E,0,lip,shade(PAL.sideD,.85));
  c.lineCap='round';c.lineWidth=1.1;
  for(let i=0;i<N*6;i++){const onW=rnd()<.5,p=along(onW?Wp:So,onW?So:E,rnd());c.strokeStyle=rnd()<.5?'rgba(226,212,184,.5)':'rgba(70,58,40,.5)';c.beginPath();c.moveTo(p[0],p[1]);c.lineTo(p[0]+(rnd()-.5)*1.5,p[1]+lip*.5+rnd()*lip*.7);c.stroke();}
 } else if(th==='desk'){
  // a solid varnished edge: long grain on the west face, end grain on the east one
  face(Wp,So,vgrad(Wp[1],PAL.side,PAL.sideD));face(So,E,vgrad(E[1],shade(PAL.side,.9),shade(PAL.sideD,.8)));
  c.strokeStyle='rgba(60,36,14,.28)';c.lineWidth=1;
  for(let i=0;i<7;i++){const yy=DEPTH*(.12+i*.12)+(rnd()-.5)*3;c.beginPath();c.moveTo(Wp[0],Wp[1]+yy);c.lineTo(So[0],So[1]+yy+(rnd()-.5)*2);c.stroke();}
  c.strokeStyle='rgba(50,30,12,.25)';
  for(let k=0;k<Math.floor(N/4);k++){const p=along(So,E,(k+.5)/Math.floor(N/4)),ry=DEPTH*.5;for(let r=1;r<5;r++){c.beginPath();c.ellipse(p[0],p[1]+ry,r*3.2,r*2.4,0,0,7);c.stroke();}}
  band(Wp,So,0,2,'rgba(255,240,200,.35)');band(So,E,0,2,'rgba(255,240,200,.22)');
 } else if(th==='sand'){
  // the sandbox's plank frame: two courses, grain, nail heads, a corner post
  face(Wp,So,vgrad(Wp[1],'#b07f4c','#7e5630'));face(So,E,vgrad(E[1],'#98693c','#674426'));
  band(Wp,So,DEPTH*.5-1,DEPTH*.5+1,'rgba(30,18,8,.55)');band(So,E,DEPTH*.5-1,DEPTH*.5+1,'rgba(30,18,8,.6)');
  c.strokeStyle='rgba(70,44,18,.25)';c.lineWidth=1;
  for(let i=0;i<10;i++){const yy=DEPTH*(.06+i*.09)+(rnd()-.5)*2;for(const [a,b] of [[Wp,So],[So,E]]){c.beginPath();c.moveTo(a[0],a[1]+yy);c.lineTo(b[0],b[1]+yy+(rnd()-.5)*2);c.stroke();}}
  c.fillStyle='#4a3a2a';
  for(let k=1;k<Math.floor(N/6);k++){for(const [a,b] of [[Wp,So],[So,E]]){const p=along(a,b,k/Math.floor(N/6));for(const yy of [DEPTH*.25,DEPTH*.75]){c.beginPath();c.ellipse(p[0],p[1]+yy,1.8,1.4,0,0,7);c.fill();}}}
  band(Wp,So,0,2,'rgba(255,230,190,.3)');band(So,E,0,2,'rgba(255,230,190,.2)');
  const pw=DEPTH*.22;c.fillStyle='#5e3f22';c.fillRect(So[0]-pw/2,So[1]-2,pw,DEPTH+5);c.fillStyle='rgba(255,220,170,.25)';c.fillRect(So[0]-pw/2,So[1]-2,pw*.4,DEPTH+5);
 } else { // attic: the boards' own thickness, then the joists in the dark below
  face(Wp,So,vgrad(Wp[1],'#2c2016','#181009'));face(So,E,vgrad(E[1],'#241a12','#120c07'));
  c.fillStyle='#3d2c1a';
  for(let k=0;k<Math.floor(N/6);k++){for(const [a,b] of [[Wp,So],[So,E]]){const p=along(a,b,(k+.5)/Math.floor(N/6));c.fillRect(p[0]-5,p[1]+lip,10,DEPTH-lip);}}
  band(Wp,So,0,lip,'#7a5a3a');band(So,E,0,lip,'#6a4c30');
  /* the boards run along x, so the east face (x=N) cuts their ENDS: a joint every
     two tiles, and the end grain of each board between the joints. The west face
     is one board's long side and gets no joints. */
  c.strokeStyle='rgba(40,26,12,.6)';c.lineWidth=1.2;
  for(let i=2;i<N;i+=2){const p=along(E,So,i/N);c.beginPath();c.moveTo(p[0],p[1]);c.lineTo(p[0],p[1]+lip);c.stroke();}
  c.strokeStyle='rgba(60,40,18,.35)';
  for(let k=0;k<N/2;k++){const p=along(E,So,(k+.5)*2/N);for(let r=1;r<3;r++){c.beginPath();c.ellipse(p[0],p[1]+lip*.55,HW*.5*r*.55,lip*.22*r,0,0,7);c.stroke();}}
 }
 c.restore();
}
