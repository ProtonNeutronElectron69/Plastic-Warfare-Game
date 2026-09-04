/* tail_v107_3.js - v107.3: the Bathroom's tub and towel (T92).
   The owner played v107.2 and said the bathtub and the white bath mat are
   overexposed - essentially blank white. Both were, for different reasons, and
   both reasons are asserted here rather than described.
   THE TUB was one radial gradient whose radius was `rx*1.414*HW`: 430px on a
   basin whose own painted screen radius is 299px at its longest and 215px
   across. The whole shape therefore sat inside the gradient's first stops and
   the dark end was never reached anywhere - three stops, one visible, a flat
   near-white disc. A GRADIENT WIDER THAN THE SHAPE IT FILLS HAS NO SHADING IN
   IT. Every radius is derived from the polygon actually walked now, and the tub
   is painted as a basin (a wall ring in shadow, then the floor inside it),
   because a shape-following ring shades an ellipse evenly where a radial
   gradient cannot.
   THE "WHITE BATH MAT" is the dropped towel - the map's coloured mat is a
   separate object and reads fine. The towel was a near-white rectangle with a
   thin outline, which was legible on v107's cool grey-blue tile and became a
   blank slab when v107.2 made the floor warm cream. It is painted as cloth now,
   in a cool teal chosen AGAINST the floor: T92.B asserts the contrast, not the
   colour, so a future palette change has to keep it readable.
   Nothing generates differently: the towel's four rolls are untouched and its
   rectangle is pinned, the layout hashes hold, no trail moved. */
'use strict';
section('T92 v107.3: the tub reads as a basin, the towel as cloth');

/* the canvas proxy of T91, plus the gradients: a gradient is an object, so its
   radius and its colour stops never reach a fillStyle recorder at all - which
   is exactly why nothing caught a gradient too wide to shade the shape. */
function bakeGrad1073(map,seed){
 G=null;newGame({map,mode:'dm',diff:'normal',fac:'green',opp:1,seed});
 const grads=[],paths=[],fills=[],strokes=[];
 let cur=null,tag='';
 const real=document.createElement.bind(document);
 document.createElement=(tag2)=>{
  const cv=real(tag2);if(String(tag2).toLowerCase()!=='canvas')return cv;
  const base=cv.getContext('2d');
  const prox=new Proxy(base,{
   get(t,k){
    if(k==='createRadialGradient')return(...a)=>{const g={kind:'r',args:a,stops:[],addColorStop(o,c2){this.stops.push([o,c2])}};grads.push(g);return g};
    if(k==='createLinearGradient')return(...a)=>{const g={kind:'l',args:a,stops:[],addColorStop(o,c2){this.stops.push([o,c2])}};grads.push(g);return g};
    if(k==='beginPath')return()=>{cur=[]};
    if(k==='moveTo'||k==='lineTo')return(x,y)=>{if(cur)cur.push([x,y])};
    if(k==='fill')return()=>{if(cur&&cur.length)paths.push({pts:cur.slice(),op:'fill',col:tag})};
    if(k==='stroke')return()=>{if(cur&&cur.length)paths.push({pts:cur.slice(),op:'stroke',col:tag})};
    const v=t[k];return typeof v==='function'?v.bind(t):v;
   },
   set(t,k,v){
    if(k==='fillStyle'||k==='strokeStyle'){
     tag=typeof v==='string'?v:(v&&v.stops?'grad:'+v.stops.map(s=>s[1]).join('/'):'');
     if(typeof v==='string')(k==='fillStyle'?fills:strokes).push(v);
    }
    t[k]=v;return true;
   }});
  cv.getContext=()=>prox;return cv;
 };
 try{renderTerrain()}finally{document.createElement=real}
 return {grads,paths,fills,strokes};
}
const lum1073=(r,g,b)=>r*.3+g*.59+b*.11;
const hex1073=(h)=>{const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255]};
/* hsl(h,s%,l%) -> rgb, so a colour the painter states in HSL can be compared
   with one it states in hex. The standard conversion, no rounding games. */
function hsl1073(h,s,l){
 s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l);
 const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
 return [Math.round(f(0)*255),Math.round(f(8)*255),Math.round(f(4)*255)];
}
const BATH1073=bakeGrad1073('bathroom',500000);
/* the tub's own screen extent, walked exactly as the painter walks it */
function tubR1073(){
 const tb=G.map.tub,cx=isoX(tb.cx,tb.cy),cy=isoY(tb.cx,tb.cy),ct=dcos(tb.th||0),st=dsin(tb.th||0);
 let lo=1e9,hi=0;
 for(let i=0;i<48;i++){const a=i/48*6.283,u=tb.rx*dcos(a),v=tb.ry*dsin(a);
  const wx=tb.cx+u*ct-v*st,wy=tb.cy+u*st+v*ct,d=Math.hypot(isoX(wx,wy)-cx,isoY(wx,wy)-cy);
  lo=Math.min(lo,d);hi=Math.max(hi,d);}
 return {lo,hi,old:tb.rx*1.414*HW};
}

/* ---------- A: the tub is a basin, and its dark end is reached ---------- */
section('T92.A the bathtub');
{
 const R=tubR1073();
 const floor=BATH1073.grads.find(g=>g.kind==='r'&&g.stops.length===3&&g.stops[0][1]==='#f4f8fa');
 const wall=BATH1073.grads.find(g=>g.kind==='l'&&g.stops.length===3&&g.stops[0][1]==='#dfe8ed');
 ok('T92.A the tub paints a wall and a floor, each with its own gradient: a basin, not a disc', !!floor&&!!wall);
 if(floor&&wall){
  /* THE DEFECT, stated as arithmetic. The v107.2 radius could not shade the tub
     anywhere; the new one is inside even the SHORT axis, so the dark stop is
     reached all the way round rather than only at the ends. */
  ok(`T92.A v107.2's radius (${R.old.toFixed(0)}px) was wider than the whole tub (${R.hi.toFixed(0)}px at its longest): its dark stop was unreachable`,
     R.old>R.hi);
  ok(`T92.A the floor gradient now ends inside the tub (${floor.args[5].toFixed(0)}px against a shortest radius of ${R.lo.toFixed(0)}px)`,
     floor.args[5]<=R.lo+1);
  ok('T92.A ...and its radius is DERIVED from the polygon, not from a constant times rx',
     /RRx=Math\.max\(RRx,Math\.abs\(isoX\(wx,wy\)-cx2\)\)/.test(String(renderTerrain))&&!/tb\.rx\*1\.414\*HW/.test(String(renderTerrain)));
  // the tones actually reachable now span a real range, top to bottom
  const tones=floor.stops.concat(wall.stops).map(s=>lum1073(...hex1073(s[1])));
  const span=Math.max(...tones)-Math.min(...tones);
  ok(`T92.A the enamel spans ${span.toFixed(0)} levels of light from its highlight to the wall's shadow (v107.2 could reach ~20)`, span>=55);
  ok('T92.A the wall is darker than the floor at its darkest: the basin has a bottom and sides',
     lum1073(...hex1073(wall.stops[2][1]))<lum1073(...hex1073(floor.stops[2][1])));
 }
 // it is still a tub: the two water lines, the drain and the plug all paint
 const cols=BATH1073.fills.concat(BATH1073.strokes);
 ok('T92.A both tide lines still stroke', cols.includes('rgba(130,150,162,.55)')&&cols.includes('rgba(150,170,182,.3)'));
 ok('T92.A the drain and its chrome plug still paint', cols.includes('#8c9ba6')&&cols.includes('#2c3238')&&cols.includes('#d8dfe4'));
 ok('T92.A the enamel wear is drawn off dth, never off the terrain rng (it must not move what is painted after it)',
    /rgba\(120,142,156,\.16\)/.test(String(renderTerrain))&&cols.includes('rgba(120,142,156,.16)'));
}

/* ---------- B: the towel is cloth, and it reads against the floor ---------- */
section('T92.B the dropped towel');
{
 const tw=G.map.patches.filter(p=>p.towel);
 ok('T92.B the bathroom drops exactly one towel, and it is flagged as one', tw.length===1);
 ok('T92.B ...and it carries no fill, stroke or inset: drawTowel owns every tone, and a dead field is a field the next reader believes',
    tw.length===1&&!tw[0].fill&&!tw[0].stroke&&!tw[0].inset);
 const cols=BATH1073.fills.concat(BATH1073.strokes);
 const body=`hsl(${TOWEL_HUE},26%,63%)`;
 ok(`T92.B it paints as cloth: a body (${body}), a fold, woven bands, a hem and a shadow on the tile`,
    cols.includes(body)&&cols.includes(`hsla(${TOWEL_HUE},30%,74%,.85)`)&&cols.includes(`hsla(${TOWEL_HUE},34%,46%,.55)`)
    &&cols.includes(`hsla(${TOWEL_HUE},34%,38%,.85)`)&&cols.includes('rgba(60,54,44,.18)'));
 ok('T92.B the old near-white rectangle is gone from the shipped file, not merely overdrawn',
    !require('fs').readFileSync('pw.html','utf8').includes("rgba(246,240,228,.9)"));
 /* THE OWNER'S COMPLAINT, MEASURED. A towel is readable when it is far from the
    floor it lies on - so the check is the DISTANCE, not the hue. v107.2's towel
    was rgba(246,240,228) on a #ece6dc floor: 5 levels of light apart, which is
    why it read as a blank slab, and why the first cut of this fix (a sand hue
    off dth, drawn on three seeds in four) would have brought it straight back. */
 const modal=(()=>{const n={};let best='',bc=0;
  for(const s of BATH1073.fills)if(/^#[0-9a-f]{6}$/i.test(s)){n[s]=(n[s]||0)+1;if(n[s]>bc){bc=n[s];best=s}}
  return hex1073(best)})();
 const bt=hsl1073(TOWEL_HUE,26,63);
 const gap=Math.abs(lum1073(...modal)-lum1073(...bt));
 const oldGap=Math.abs(lum1073(...modal)-lum1073(246,240,228));
 ok(`T92.B the towel stands ${gap.toFixed(0)} levels of light off the floor it lies on; the old one stood ${oldGap.toFixed(0)}`, gap>=40&&oldGap<15);
 ok('T92.B ...and it is COOL where the floor is warm, so it reads in tone as well as in weight',
    bt[2]>bt[0]+12&&modal[0]>modal[2]+6);
 ok('T92.B the hue is one constant chosen against the floor, not rolled per towel: a roll would consume the terrain stream',
    /const TOWEL_HUE=\d+;/.test(require('fs').readFileSync('../source/js/07-map-terrain.js','utf8')));
 // every other map's patches still paint the plain way
 const kit=bakeGrad1073('kitchen',500000);
 ok('T92.B the kitchen\'s sheet of paper still paints as a filled rectangle, untouched',
    kit.fills.includes('rgba(238,236,230,.92)')&&!kit.fills.includes(body));   // the KITCHEN's own value - the Desk's paper is a different one, and the first cut asserted that
 let others=true;
 for(const m of ['kitchen','sandbox','attic','backyard'])if(makeMap(m,11).patches.some(p=>p.towel))others=false;
 ok('T92.B no other map drops a towel', others);
}

/* ---------- C: nothing generates differently ---------- */
section('T92.C the map is where it was');
{
 /* the towel's rectangle comes off four rnd() draws in makeMap and this release
    does not touch them. Patches are NOT in the layout hash, so they are pinned
    here in their own right rather than assumed. */
 const TOWEL1073={11:[44.029,8.252,11.732,9.551],22:[23.494,14.144,10.759,8.619],33:[53.521,57.999,10.595,7.44]};
 let same=true;
 for(const sd of [11,22,33]){const t=makeMap('bathroom',sd).patches.filter(p=>p.towel)[0],w=TOWEL1073[sd];
  if(!t||[t.x,t.y,t.w,t.h].some((v,i)=>Math.abs(v-w[i])>1e-3))same=false;}
 ok('T92.C the towel lies exactly where v107 put it, on every pinned seed', same);
 function lay1073(M){
  let h=2166136261;
  const P=M.pass;for(let i=0;i<P.length;i++)h=hI(h,P[i]);
  for(const n of M.nodes){h=hF(h,n.x);h=hF(h,n.y);h=hS(h,n.t);h=hF(h,n.amt)}
  for(const s of M.starts){h=hF(h,s.x);h=hF(h,s.y)}
  for(const ns of (M.nests||[])){h=hF(h,ns.x);h=hF(h,ns.y)}
  for(const pr of (M.props||[])){h=hF(h,pr.x);h=hF(h,pr.y);h=hS(h,pr.t)}
  for(const b of (M.barricades||[])){h=hI(h,b.x);h=hI(h,b.y)}
  for(const b of (M.lvl||[])){h=hI(h,b.x);h=hI(h,b.y)}
  return h>>>0;
 }
 const BASE1073={"bathroom:11":2389414214,"bathroom:22":3961821753,"bathroom:33":1983128978};
 let held=true;for(const sd of [11,22,33])if(lay1073(makeMap('bathroom',sd))!==BASE1073['bathroom:'+sd])held=false;
 ok('T92.C the Bathroom\'s layout is still byte-identical to v107\'s: this release paints, it does not generate', held);
 // the mosaic and the rest of the floor are untouched by any of it
 ok('T92.C the v107.2 hexagon mosaic still paints under all of it',
    BATH1073.strokes.includes('rgba(122,110,96,.55)')&&BATH1073.fills.includes('rgba(255,255,255,.165)'));
 ok('T92.C the bath mat - the map\'s OTHER rectangle, and the one that was never white - is untouched',
    BATH1073.fills.some(s=>/^hsla\((200|340),40%,62%,\.92\)$/.test(s)));
}

/* no version pin here: T75.B is the one the project designed for it, and
   v107.1 and v107.2's private copies were deleted this release rather than
   bumped a third time. */
