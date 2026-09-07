/* tail_v108.js - v108: the ground as a real surface (T93).
   Roadmap 4 item 5, in the form the owner asked for: not the sprite pipeline's
   textured plastic, but the real house - a lawn, a ceramic counter, a carpet, a
   varnished desk, a sandbox with a plank frame, a porcelain mosaic, bare attic
   boards. Through v107 every board's floor was paintIsoTile's bevelled diamond
   per tile, which is what a sheet of molded plastic looks like whatever colour
   it is painted; the seven boards differed only in palette and in what was
   scattered on top.
   The mechanism (07b-ground.js) is three coats and an edge:
     - a BASE COAT of one flat diamond per tile (T41.C, rewritten, pins that);
     - a MATERIAL SWATCH generated per pixel at bake time and tiled over the
       board as a canvas pattern UNDER THE ISO TRANSFORM, so it lies down with
       the board - two themes tile it as a luminance OVERLAY so their checker
       and mosaic keep their colours;
     - BLOTCHES off the terrain stream so the swatch's repeat never grids;
     - a SKIRT painted as the material's own edge.
   What this file asserts is the mechanism, measured off the bytes the generator
   actually writes (the shim hands back the ImageData it is asked for, so the
   per-pixel loop is testable even though nothing paints): the swatch is
   seamless, deterministic, opaque, textured and the right hue; the overlay
   swatches are grey and centred; the boards and the ceramic have the structure
   their painters claim; the pattern is laid under the iso transform with the
   blend its kind needs; the swatch consumes nothing from the terrain stream and
   the bake nothing from srand(); every theme's skirt is its own; and the Field
   Manual's swatch is the board's own painter. The frames were read in Chromium
   (rule 7); this file is the half a test can hold. No trail moved. */
'use strict';
section('T93 v108: the floor is a real surface');

/* ---- recorders ---- */
/* the swatch's own bytes: the shim's createImageData returns a real buffer, so
   intercepting the call hands back exactly what groundTex wrote into it */
function swatch108(th,seed){
 let img=null;
 const real=document.createElement.bind(document);
 document.createElement=(tag)=>{
  const cv=real(tag);if(String(tag).toLowerCase()!=='canvas')return cv;
  const base=cv.getContext('2d');
  const prox=new Proxy(base,{get(t,k){
   if(k==='createImageData')return(w,h)=>{img=base.createImageData(w,h);return img};
   const v=t[k];return typeof v==='function'?v.bind(t):v;}});
  cv.getContext=()=>prox;return cv;
 };
 try{groundTex(th,seed)}finally{document.createElement=real}
 return img;
}
/* an ordered op log over the shim's context for one painter call: transforms,
   patterns, rects, composite state, and every path fill/stroke */
function opLog108(fn){
 const ops=[];let cur=null,pat=0,fill='';
 const real=document.createElement.bind(document);
 document.createElement=(tag)=>{
  const cv=real(tag);if(String(tag).toLowerCase()!=='canvas')return cv;
  const base=cv.getContext('2d');
  const prox=new Proxy(base,{
   get(t,k){
    if(k==='setTransform')return(...a)=>{ops.push({op:'xf',a})};
    if(k==='createPattern')return(src,rep)=>{const p={pat:++pat,w:src&&src.width,h:src&&src.height,rep};ops.push({op:'pattern',p});return p};
    if(k==='createRadialGradient')return(...a)=>{ops.push({op:'rgrad',a});return {addColorStop(){}}};
    if(k==='fillRect')return(...a)=>{ops.push({op:'fillRect',a,fill,comp:t.globalCompositeOperation,alpha:t.globalAlpha})};
    if(k==='beginPath')return()=>{cur=[]};
    if(k==='moveTo'||k==='lineTo')return(x,y)=>{if(cur)cur.push([x,y])};
    if(k==='ellipse')return(...a)=>{ops.push({op:'ellipse',a,fill})};
    if(k==='fill')return()=>{if(cur&&cur.length)ops.push({op:'fill',pts:cur.slice(),col:fill})};
    if(k==='stroke')return()=>{if(cur&&cur.length)ops.push({op:'stroke',pts:cur.slice(),col:t.strokeStyle})};
    const v=t[k];return typeof v==='function'?v.bind(t):v;
   },
   set(t,k,v){if(k==='fillStyle')fill=v;t[k]=v;return true}});
  cv.getContext=()=>prox;return cv;
 };
 try{fn()}finally{document.createElement=real}
 return ops;
}
const THEMES108=['grass','tile','carpet','desk','sand','bath','attic'];
const MAPS108={backyard:'grass',kitchen:'tile',sandbox:'sand',livingroom:'carpet',desk:'desk',bathroom:'bath',attic:'attic'};
const lum=(d,i)=>d[i]*.3+d[i+1]*.59+d[i+2]*.11;

/* ---------- A: the swatch is a real, seamless, deterministic material ---------- */
section('T93.A the material swatch, measured off its own bytes');
{
 const S=GROUND_TEX;
 let okSize=true,okOpaque=true,okSeam=true,okTex=true,okGrey=true,okHue=true,okDet=true,worstSeam=0;
 const stats={};
 for(const th of THEMES108){
  const img=swatch108(th,500000),d=img&&img.data;
  if(!img||img.width!==S||img.height!==S){okSize=false;continue}
  let opaque=true;for(let i=3;i<d.length;i+=4)if(d[i]!==255){opaque=false;break}
  if(!opaque)okOpaque=false;
  /* THE SEAM. The noise lattice wraps, so the last row is the first row's
     neighbour: the mean step across the seam must be no larger than the mean
     step between two interior rows. Same across the columns. A swatch that
     did not tile would show its edge every eight tiles across the whole board. */
  const rowStep=(y0,y1)=>{let s=0;for(let x=0;x<S;x++)s+=Math.abs(lum(d,(y0*S+x)*4)-lum(d,(y1*S+x)*4));return s/S};
  const colStep=(x0,x1)=>{let s=0;for(let y=0;y<S;y++)s+=Math.abs(lum(d,(y*S+x0)*4)-lum(d,(y*S+x1)*4));return s/S};
  /* against the LARGEST interior step, not the typical one: the attic's board
     seams and the ceramic's pillowed edges are hard edges by design, and on
     those two themes the wrap lands on one - which is the claim. A true seam
     (a phase that did not come round to a whole cycle) is a step larger than
     any the material itself has. The first cut compared the wrap to a mid-board
     row and called the board seam a defect. */
  let maxR=0,maxC=0;for(let y=0;y<S-1;y++)maxR=Math.max(maxR,rowStep(y,y+1));for(let x=0;x<S-1;x++)maxC=Math.max(maxC,colStep(x,x+1));
  const seamR=rowStep(S-1,0)/Math.max(.5,maxR),seamC=colStep(S-1,0)/Math.max(.5,maxC);
  worstSeam=Math.max(worstSeam,seamR,seamC);
  if(seamR>1.1||seamC>1.1)okSeam=false;
  // texture: it is not a flat colour
  let m=0;for(let i=0;i<d.length;i+=4)m+=lum(d,i);m/=S*S;
  let v=0;for(let i=0;i<d.length;i+=4){const q=lum(d,i)-m;v+=q*q}
  const sd=Math.sqrt(v/(S*S));
  let mr=0,mg=0,mb=0,grey=true;for(let i=0;i<d.length;i+=4){mr+=d[i];mg+=d[i+1];mb+=d[i+2];if(d[i]!==d[i+1]||d[i+1]!==d[i+2])grey=false}
  mr/=S*S;mg/=S*S;mb/=S*S;
  stats[th]={mean:m,sd,mr,mg,mb,grey};
  const overlay=th==='tile'||th==='bath';
  if(sd<(overlay?3:6))okTex=false;   // an overlay is quiet by design: it adds glaze to a floor that already has a pattern
  /* an overlay swatch is luminance only and centred on mid grey, so that
     under the 'overlay' blend it adds texture without shifting the coat's tone */
  if(overlay){if(!grey||Math.abs(m-128)>8)okGrey=false}
  else{
   if(grey)okGrey=false;
   // the hue is the material's: a lawn is green, everything else here is warm
   if(th==='grass'){if(!(mg>mr+20&&mr>mb))okHue=false}
   else if(!(mr>mg&&mg>mb))okHue=false;
  }
  // deterministic off its seed, and only its seed
  const again=swatch108(th,500000).data,other=swatch108(th,500001).data;
  let same=true,diff=0;for(let i=0;i<d.length;i+=97){if(again[i]!==d[i])same=false;if(other[i]!==d[i])diff++}
  if(!same||diff<d.length/97*.5)okDet=false;
 }
 ok('T93.A every theme generates a GROUND_TEX square', okSize);
 ok('T93.A ...fully opaque', okOpaque);
 ok(`T93.A ...and SEAMLESS: the step across the wrap is no larger than the largest step inside the swatch (worst ratio ${worstSeam.toFixed(2)})`, okSeam);
 ok(`T93.A ...and textured, not a flat fill (luminance sd ${THEMES108.map(t=>stats[t]?stats[t].sd.toFixed(1):'?').join('/')})`, okTex);
 ok('T93.A the two overlay swatches (ceramic, porcelain) are grey and centred on mid grey; the five colour swatches are not grey', okGrey);
 ok('T93.A the colour swatches carry the material\'s hue: the lawn green, the rest warm', okHue);
 ok('T93.A the swatch is a pure function of its seed: same seed same bytes, next seed different bytes', okDet);
}

/* ---------- B: the structure the painters claim is in the bytes ---------- */
section('T93.B floorboards and ceramic squares are where their painters say');
{
 const S=GROUND_TEX;
 /* the attic: GROUND_SPAN/2 boards per swatch, each with a dark seam on its
    first rows. Mean luminance of the seam rows against the board's middle. */
 {const d=swatch108('attic',500000).data,nb=GROUND_SPAN/2,bh=S/nb;
  const rowMean=y=>{let s=0;for(let x=0;x<S;x++)s+=lum(d,(y*S+x)*4);return s/S};
  let seams=0,mids=0;
  for(let b=0;b<nb;b++){seams+=rowMean(Math.round(b*bh)+1);mids+=rowMean(Math.round(b*bh+bh*.5))}
  ok(`T93.B the attic swatch holds ${nb} boards with a dark seam each (seam rows ${(seams/nb).toFixed(0)} against mid-board ${(mids/nb).toFixed(0)})`,
     mids/nb-seams/nb>14);
  ok('T93.B ...and the boards are two tiles wide, on the pitch the v107 gap strokes are laid at (every 2 tiles from y=0)',
     GROUND_SPAN%2===0 && /i<=N;i\+=2\)\{c\.beginPath\(\);c\.moveTo\(isoX\(0,i\)/.test(renderTerrain.toString()));}
 /* the kitchen: GROUND_SPAN/4 ceramic squares per swatch side, lit on the
    north-west edges and shaded on the south-east - on the four-tile pitch the
    grout strokes are ruled at */
 {const d=swatch108('tile',500000).data,n=GROUND_SPAN/4,q=S/n;
  const rowMean=y=>{let s=0;for(let x=0;x<S;x++)s+=lum(d,(y*S+x)*4);return s/S};
  let lit=0,mid=0,shade2=0;
  for(let b=0;b<n;b++){lit+=rowMean(Math.round(b*q)+2);mid+=rowMean(Math.round(b*q+q*.5));shade2+=rowMean(Math.round((b+1)*q)-3)}
  ok(`T93.B the ceramic squares are pillowed: lit edge ${(lit/n).toFixed(0)} > face ${(mid/n).toFixed(0)} > shaded edge ${(shade2/n).toFixed(0)}`,
     lit>mid+n*6 && mid>shade2+n*6);
  ok('T93.B ...on the kitchen\'s own four-tile pitch, so the swatch\'s edges land on its grout lines',
     GROUND_SPAN%4===0 && /i<=N;i\+=4\)\{c\.beginPath\(\);c\.moveTo\(isoX\(i,0\)/.test(renderTerrain.toString()));}
}

/* ---------- C: the swatch is laid in WORLD space, blended by kind ---------- */
section('T93.C the pattern is tiled under the iso transform, with the blend its kind needs');
{
 const k=GROUND_SPAN/GROUND_TEX,N=6,ox=333,oy=77;
 const layOf=(th)=>opLog108(()=>groundLay(document.createElement('canvas').getContext('2d'),th,N,mulberry(3),ox,oy,500000));
 const near=(a,b)=>Math.abs(a-b)<1e-9;
 const laid=(ops)=>{
  // the pattern fill: a fillRect whose fill is the pattern, and the transform standing when it was issued
  let xf=null,pat=null,rect=null;
  for(const o of ops){if(o.op==='xf')xf=o.a;if(o.op==='pattern')pat=o.p;if(o.op==='fillRect'&&o.fill===pat&&pat){rect=o;rect.xf=xf;break}}
  return rect;};
 const g=laid(layOf('grass')),t=laid(layOf('tile')),b=laid(layOf('bath'));
 ok('T93.C the lawn\'s swatch is filled as a pattern under the iso matrix: (HW,HH,-HW,HH) scaled by tiles-per-pixel, at the board origin',
    !!g && near(g.xf[0],HW*k)&&near(g.xf[1],HH*k)&&near(g.xf[2],-HW*k)&&near(g.xf[3],HH*k)&&near(g.xf[4],ox)&&near(g.xf[5],oy));
 ok('T93.C ...over exactly the board, N tiles square in swatch units', !!g && near(g.a[2],N/k)&&near(g.a[3],N/k)&&g.a[0]===0&&g.a[1]===0);
 ok('T93.C ...from a GROUND_TEX swatch set to repeat', !!g && g.fill.w===GROUND_TEX&&g.fill.h===GROUND_TEX&&g.fill.rep==='repeat');
 ok('T93.C a colour swatch is laid source-over at near-full opacity, so the material is the floor', !!g && g.comp==='source-over'&&g.alpha>.9&&g.alpha<1);
 ok('T93.C the kitchen\'s is laid as an OVERLAY, so its checker keeps its colours', !!t && t.comp==='overlay'&&t.alpha>.5);
 ok('T93.C the bathroom lays no swatch in groundLay at all: its glaze goes on after the mosaic', !b);
 /* the bathroom's overlay comes AFTER the last hexagon, over the tiles and
    their grout, from renderTerrain */
 G=null;newGame({map:'bathroom',mode:'dm',diff:'normal',fac:'green',opp:1,seed:771108});
 const ops=opLog108(()=>renderTerrain());
 let lastHex=-1,glaze=-1,pat=null;
 ops.forEach((o,i)=>{if(o.op==='fill'&&o.pts.length===6&&/^#[0-9a-f]{6}$/i.test(o.col))lastHex=i;if(o.op==='pattern')pat=o.p;if(o.op==='fillRect'&&pat&&o.fill===pat&&o.comp==='overlay')glaze=i});
 ok('T93.C the bathroom\'s glaze overlay is laid after the last hexagon of the mosaic', lastHex>1000&&glaze>lastHex);
 /* the blotches: world-space radial gradients, enough of them, and only on the
    colour themes - an overlay theme keeps its own pattern's regularity */
 const blot=(th)=>layOf(th).filter(o=>o.op==='rgrad').length;
 ok(`T93.C the colour themes lay their blotches (${blot('grass')} on a 6x6) and the overlay themes lay none (${blot('tile')})`,
    blot('grass')>=4 && blot('sand')>=4 && blot('tile')===0 && blot('bath')===0);
}

/* ---------- D: the streams. The swatch is on its own; the bake touches no sim state ---------- */
section('T93.D the swatch consumes nothing from the terrain stream, and the bake nothing from srand()');
{
 /* count the terrain stream's draws through groundLay with the real swatch,
    then with the swatch stubbed: equal counts mean the swatch never reached it.
    Function declarations are writable bindings, which is what makes the stub
    possible without a seam in the code. */
 const count=(stub)=>{
  let n=0;const r=mulberry(9),rnd=()=>{n++;return r()};
  const keep=groundTex;if(stub)groundTex=()=>document.createElement('canvas');
  try{groundLay(document.createElement('canvas').getContext('2d'),'grass',6,rnd,0,0,500000)}finally{groundTex=keep}
  return n;};
 const a=count(false),b=count(true);
 ok(`T93.D the terrain stream is drawn the same number of times with and without the swatch (${a} = ${b})`, a===b && a>36);
 // and rule 2, on every map: the bake is a bake
 let clean=true;
 for(const map of Object.keys(MAPS108)){
  G=null;newGame({map,mode:map==='desk'?'surv':'dm',diff:'normal',fac:'green',opp:1,seed:660108});
  const r0=G.rngS,h0=hashState();renderTerrain();
  if(G.rngS!==r0||hashState()!==h0)clean=false;
 }
 ok('T93.D renderTerrain leaves srand() and the state hash where it found them on all seven maps', clean);
 ok('T93.D no ground painter names srand', !/srand\(/.test(groundTex.toString()+groundLay.toString()+groundSkirt.toString()+groundOverlay.toString()));
}

/* ---------- E: the skirt is the material's own edge ---------- */
section('T93.E every theme\'s edge is its own, and the molded lip is gone');
{
 const cols=(th)=>{const set=new Set();opLog108(()=>groundSkirt(document.createElement('canvas').getContext('2d'),th,8,mulberry(5),200,10,46)).forEach(o=>{if((o.op==='fill'||o.op==='stroke')&&typeof o.col==='string')set.add(o.col);if((o.op==='ellipse'||o.op==='fillRect')&&typeof o.fill==='string')set.add(o.fill)});return set};
 const sets={};for(const th of THEMES108)sets[th]=cols(th);
 /* each theme paints at least one colour no other theme paints - a signature,
    derived rather than transcribed, so a palette edit does not fail here
    unless it makes two edges the same edge */
 let own=true;
 for(const th of THEMES108){const others=new Set();for(const o of THEMES108)if(o!==th)sets[o].forEach(s=>others.add(s));if(![...sets[th]].some(s=>!others.has(s)))own=false}
 ok('T93.E each of the seven themes paints a colour on its edge that no other theme paints', own);
 ok('T93.E the tile and bath edges share one recipe (a tile\'s thickness over mortar) in two palettes',
    sets.tile.has('rgba(0,0,0,.4)') && sets.bath.has('rgba(0,0,0,.4)') && [...sets.tile].some(s=>!sets.bath.has(s)));
 ok('T93.E the molded-plastic lip and its scuffs are gone from the bake: the skirt code left renderTerrain',
    !renderTerrain.toString().includes('PAL.sideD') && !renderTerrain.toString().includes('worn chips'));
 // and the skirt is drawn BELOW the board, never over it: every fill's y is at or under the edge it hangs from
 const ops=opLog108(()=>groundSkirt(document.createElement('canvas').getContext('2d'),'sand',8,mulberry(5),200,10,46));
 const top=10+8*HH; // the west corner's screen y for N=8 at oy=10
 ok('T93.E the skirt hangs below the board\'s edge', ops.filter(o=>o.op==='fill').every(o=>o.pts.every(p=>p[1]>=top-1e-6)));
}

/* ---------- F: the Field Manual's swatch is the board's painter ---------- */
section('T93.F the manual\'s lawn is the Backyard\'s lawn');
{
 let lay=null,skirt=null;
 const kl=groundLay,ks=groundSkirt;
 groundLay=function(c,th,N,rnd,ox,oy,seed){lay={th,N};return kl(c,th,N,rnd,ox,oy,seed)};
 groundSkirt=function(c,th,N,rnd,ox,oy,d){skirt={th,N,d};return ks(c,th,N,rnd,ox,oy,d)};
 try{INFO.ground=null;infoGround()}finally{groundLay=kl;groundSkirt=ks}
 ok('T93.F infoGround lays a 5x5 grass swatch through groundLay', !!lay && lay.th==='grass' && lay.N===5);
 ok('T93.F ...and its edge through groundSkirt, at the manual\'s own depth', !!skirt && skirt.th==='grass' && skirt.N===5 && skirt.d===INFO_G_DEPTH);
 ok('T93.F the palette lives in one table now: infoGround declares no colours of its own', !/#[0-9a-f]{6}/i.test(infoGround.toString()));
}

/* ---------- G: the shipped file ---------- */
section('T93.G the new file ships, in order, and the old painter does not');
{
 const fs=require('fs');
 const order=(fs.readFileSync('../source/order.txt','utf8')||'').split('\n').map(l=>l.replace(/#.*/,'').trim()).filter(Boolean);
 ok('T93.G 07b-ground.js is listed directly after 07-map-terrain.js', order.indexOf('07b-ground.js')===order.indexOf('07-map-terrain.js')+1);
 const src=fs.readFileSync('pw.html','utf8');
 ok('T93.G the shipped file carries the ground painters and no paintIsoTile', src.includes('function groundLay(')&&src.includes('function groundTex(')&&src.includes('function groundSkirt(')&&!src.includes('function paintIsoTile('));
 ok('T93.G the swatch constants are what the painters assume: an eight-tile span, a power-of-two swatch', GROUND_SPAN===8 && (GROUND_TEX&(GROUND_TEX-1))===0);
}
