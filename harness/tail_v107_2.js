/* tail_v107_2.js - v107.2: the Bathroom Floor's own floor (T91).
   The owner played v107.1 and said the bathroom's basic tiles look too much
   like the Kitchen Counter's. They did, and the reason is stated as a check
   rather than as prose: v107 gave the bathroom the kitchen's palette family
   (a cool grey-blue) under the kitchen's pattern (a square grout grid, every
   other square a shade off). Only the grid's PITCH differed, and a pattern that
   differs only in pitch is the same pattern.
   So the floor is a HEXAGON MOSAIC now - warm porcelain, dark grout, a scattered
   share of taupe accent tiles - and this file asserts the two claims that make
   that answer the complaint: the pattern is hexagonal (driven off the recorded
   path ops, not read out of the source), and the palette is warm where the
   kitchen's is cool (measured off the tones actually painted). Everything the
   bathroom already had - the tub, the mat, the hazards, the layout - is
   untouched, and every other map's floor is asserted unchanged.
   No trail moved: renderTerrain is a bake, and nothing here is simulation.
   T89.F's pinned grout colour took a conscious edit; the layout pins held. */
'use strict';
section('T91 v107.2: the Bathroom gets a floor of its own');

/* Record what renderTerrain PAINTS, not what the file says. Each completed path
   is kept with the fill/stroke colour that was standing when it was drawn, so a
   shape and its colour can be asked about together. Same canvas-proxy shape as
   T89.F's bakeColours107, one level deeper. */
function bakePaths1072(map,seed){
 G=null;newGame({map,mode:'dm',diff:'normal',fac:'green',opp:1,seed});
 const paths=[],fills=[],strokes=[],clipped=[];
 let cur=null,fill='',stroke='';
 const real=document.createElement.bind(document);
 document.createElement=(tag)=>{
  const cv=real(tag);if(String(tag).toLowerCase()!=='canvas')return cv;
  const base=cv.getContext('2d');
  const prox=new Proxy(base,{
   get(t,k){
    if(k==='beginPath')return()=>{cur=[]};
    if(k==='moveTo'||k==='lineTo')return(x,y)=>{if(cur)cur.push([x,y])};
    if(k==='closePath')return()=>{};
    if(k==='clip')return()=>{if(cur)clipped.push(cur.slice())};
    if(k==='fill')return()=>{if(cur&&cur.length)paths.push({pts:cur.slice(),op:'fill',col:fill})};
    if(k==='stroke')return()=>{if(cur&&cur.length)paths.push({pts:cur.slice(),op:'stroke',col:stroke})};
    const v=t[k];return typeof v==='function'?v.bind(t):v;
   },
   set(t,k,v){
    /* a gradient is not a colour, and it must CLEAR the standing tag rather than
       leave it: the first cut kept the last string, so the tub's gradient-filled
       floor was recorded as one more glaze hexagon and the counts came out one
       apart. A recorder that carries stale state answers about the wrong path. */
    if(k==='fillStyle'){fill=typeof v==='string'?v:'';if(typeof v==='string')fills.push(v)}
    if(k==='strokeStyle'){stroke=typeof v==='string'?v:'';if(typeof v==='string')strokes.push(v)}
    t[k]=v;return true;
   }});
  cv.getContext=()=>prox;return cv;
 };
 try{renderTerrain()}finally{document.createElement=real}
 return {paths,fills,strokes,clipped};
}
const GROUT1072='rgba(122,110,96,.55)';   // the mosaic's grout; T89.F pins it as the bath theme's colour
const GLAZE1072='rgba(255,255,255,.165)'; // the smaller hexagon that domes each tile
/* A path measured in WORLD tiles, not in screen pixels. isoX/isoY is a linear
   map that halves y, so a regular world hexagon is a SKEWED screen hexagon and
   its six neighbours sit at three different screen distances - the first cut of
   the lattice test measured exactly that and called the mosaic irregular.
   Inverting the projection is the whole fix, and it states the design claim
   properly: the hexagons are regular in the world the board is laid out in,
   which is why they tile and why they lie DOWN with the board instead of
   floating over it. `sp` is the mean centre-to-vertex distance, the
   circumradius. */
function unIso1072(sx,sy){const u=(sx-G.orgX)/HW,v=sy/HH;return [(u+v)/2,(v-u)/2]}
function shape1072(p){
 const w=p.pts.map(v=>unIso1072(v[0],v[1]));
 let cx=0,cy=0;for(const v of w){cx+=v[0];cy+=v[1]}
 cx/=w.length;cy/=w.length;
 let sp=0;for(const v of w)sp+=Math.hypot(v[0]-cx,v[1]-cy);
 return {cx,cy,sp:sp/w.length};
}
const BATH1072=bakePaths1072('bathroom',771072), KIT1072=bakePaths1072('kitchen',771072);

/* ---------- A: the pattern is hexagonal, and it covers the board ---------- */
section('T91.A the floor is a hexagon mosaic');
{
 const hexes=BATH1072.paths.filter(p=>p.op==='fill'&&p.col!==GLAZE1072&&p.pts.length===6&&/^#[0-9a-f]{6}$/i.test(p.col));
 const grout=BATH1072.paths.filter(p=>p.op==='stroke'&&p.col===GROUT1072);
 const glaze=BATH1072.paths.filter(p=>p.op==='fill'&&p.col===GLAZE1072);
 ok(`T91.A the bathroom paints a field of six-sided tiles (${hexes.length})`, hexes.length>1500);
 ok(`T91.A every one is grouted, and every one is glazed (${grout.length} grout, ${glaze.length} glaze)`,
    grout.length===hexes.length&&glaze.length===hexes.length);
 ok('T91.A every grout path is a hexagon too: the grout IS the tile\'s own edge, not a grid ruled over it',
    grout.every(p=>p.pts.length===6));
 /* THE LATTICE. Six neighbours at one spacing is what makes a hexagonal tiling;
    a square grid has four. Measured off the centroids of the tiles actually
    painted, on the tiles well inside the board so the lattice is complete. */
 const S=hexes.map(shape1072);
 const NB1072=G.map.N;
 const inner=S.filter(h=>h.cx>8&&h.cx<NB1072-8&&h.cy>8&&h.cy<NB1072-8).slice(0,60);
 let sixOk=true,gapOk=true,ratio=0;
 for(const h of inner){
  const d=S.filter(q=>q!==h).map(q=>Math.hypot(q.cx-h.cx,q.cy-h.cy)).sort((a,b)=>a-b);
  if(d.filter(v=>v<d[0]*1.25).length!==6)sixOk=false;  // how many share the shortest spacing
  /* edge to edge: for a regular hexagon of circumradius r two neighbouring
     centres are sqrt(3)*r apart - closer and the tiles overlap, further and the
     floor has gaps in it. 1.732 is the number the mosaic has to reproduce. */
  const r=d[0]/h.sp;ratio=r;
  if(!(r>1.70&&r<1.76))gapOk=false;
 }
 ok(`T91.A each tile has exactly SIX neighbours at one spacing (${inner.length} interior tiles walked) - a square grid has four`, inner.length>=40&&sixOk);
 ok(`T91.A ...and they sit edge to edge, at sqrt(3) circumradii (${ratio.toFixed(3)} against 1.732): the mosaic tiles the plane`, gapOk);
 // it covers the whole slab, and is clipped to it
 const xs=S.map(h=>h.cx),ys=S.map(h=>h.cy);
 const tiles=BATH1072.paths.filter(p=>p.op==='fill'&&p.pts.length===4).map(shape1072);
 const tx=tiles.map(t=>t.cx),ty=tiles.map(t=>t.cy);
 ok('T91.A the mosaic reaches every corner of the board (its span covers the ground tiles\')',
    Math.min(...xs)<=Math.min(...tx)&&Math.max(...xs)>=Math.max(...tx)&&Math.min(...ys)<=Math.min(...ty)&&Math.max(...ys)>=Math.max(...ty));
 /* the clip is LOAD-BEARING and it is attributed, not merely counted: the
    lattice is asked for tiles past the board on every side (a lattice has no
    idea where the mat ends), and one of the run's clip paths is the slab's own
    four corners. Counting clips would have passed on somebody else's. */
 const over=S.some(h=>h.cx<-.2||h.cy<-.2||h.cx>NB1072+.2||h.cy>NB1072+.2);
 const slab=BATH1072.clipped.some(p=>{
  if(p.length!==4)return false;
  const w=p.map(v=>unIso1072(v[0],v[1]));
  return [[0,0],[NB1072,0],[NB1072,NB1072],[0,NB1072]].every(c2=>w.some(v=>Math.abs(v[0]-c2[0])<.01&&Math.abs(v[1]-c2[1])<.01));
 });
 ok('T91.A the lattice overruns the board on purpose, and is clipped to the slab\'s own four corners', over&&slab);
 // the accent tiles: a scattered minority, present but not half the floor
 const lum=(h)=>{const n=parseInt(h.slice(1),16);return ((n>>16&255)*.3+(n>>8&255)*.59+(n&255)*.11)};
 const dark=hexes.filter(p=>lum(p.col)<200).length;
 const sh=dark/hexes.length;
 ok(`T91.A a scattered minority are accent tiles, not a second checkerboard (${(sh*100).toFixed(1)}% of ${hexes.length})`, sh>.03&&sh<.16);
}

/* ---------- B: it no longer reads as the kitchen ---------- */
section('T91.B the owner\'s complaint, stated as a measurement');
{
 /* the floor's own tone: the most-painted flat colour on each board is the
    ground tile, because the tile loop paints one per tile and nothing else
    repeats N*N times. Derived, so neither palette is transcribed here. */
 const modal=(b)=>{const n={};let best='',bc=0;
  for(const s of b.fills)if(/^#[0-9a-f]{6}$/i.test(s)){n[s]=(n[s]||0)+1;if(n[s]>bc){bc=n[s];best=s}}
  return best};
 const rgb=(h)=>{const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255]};
 const bath=rgb(modal(BATH1072)),kit=rgb(modal(KIT1072));
 ok(`T91.B the bathroom floor is WARM (r ${bath[0]} > b ${bath[2]})`, bath[0]>bath[2]+6);
 ok(`T91.B the kitchen counter stays COOL (b ${kit[2]} > r ${kit[0]}), as it always was`, kit[2]>kit[0]+6);
 ok('T91.B so the two floors no longer sit in the same colour family - which is half of what the owner saw',
    (bath[0]-bath[2])-(kit[0]-kit[2])>16);
 // the kitchen's own floor is untouched: still a square grid, still no hexagons
 /* the molded slab's own extruded outline is a hexagon on EVERY board, so the
    claim is about a FIELD of them, not about the shape appearing at all */
 const kitHex=KIT1072.paths.filter(p=>p.pts.length===6&&p.op==='fill').length;
 const kitGrid=KIT1072.strokes.filter(s=>s==='rgba(110,120,128,.55)').length;
 ok(`T91.B the kitchen has no mosaic: no grout, no glaze, and ${kitHex} hexagon (its own slab), not thousands`,
    kitHex<50&&!KIT1072.strokes.includes(GROUT1072)&&!KIT1072.fills.includes(GLAZE1072));
 ok(`T91.B ...and keeps its own square grout grid (${kitGrid} strokes)`, kitGrid>0);
 ok('T91.B the bathroom\'s old square grid is gone from the shipped file, not merely overdrawn',
    !require('fs').readFileSync('pw.html','utf8').includes("rgba(120,138,150,.5)"));
 // and the bathroom's ground tiles no longer carry the kitchen's two-tone checker
 const bt=BATH1072.paths.filter(p=>p.op==='fill'&&p.pts.length===4&&/^#[0-9a-f]{6}$/i.test(p.col));
 const kt=KIT1072.paths.filter(p=>p.op==='fill'&&p.pts.length===4&&/^#[0-9a-f]{6}$/i.test(p.col));
 const spread=(a)=>{const l=a.map(p=>{const n=parseInt(p.col.slice(1),16);return (n>>16&255)});return Math.max(...l)-Math.min(...l)};
 ok(`T91.B the bathroom's ground tiles are near-flat (${spread(bt)} levels), so no square grid shows through the mosaic`, spread(bt)<=12);
 ok(`T91.B the kitchen's are not (${spread(kt)} levels): that IS its checkerboard, and it is untouched`, spread(kt)>=14);
}

/* ---------- C: everything else on the map is where it was ---------- */
section('T91.C only the floor changed');
{
 /* the release is a painter, so the map itself must be byte-identical. The v107
    layout hash, cut again here rather than imported: the same five readings
    T89.H pins, and the pins there are expected to HOLD. */
 function lay1072(M){
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
 const BASE1072={"bathroom:11":2389414214,"bathroom:22":3961821753,"bathroom:33":1983128978};
 let held=true;for(const sd of [11,22,33])if(lay1072(makeMap('bathroom',sd))!==BASE1072['bathroom:'+sd])held=false;
 ok('T91.C the Bathroom\'s layout is byte-identical to v107\'s - this release paints, it does not generate', held);
 // the tub, the mat, the duck and both hazards still paint
 const cols=BATH1072.fills.concat(BATH1072.strokes);
 ok('T91.C the tub floor and its tide line still paint over the mosaic', cols.includes('rgba(130,150,162,.55)'));
 ok('T91.C the bath mat still paints', cols.some(s=>/^hsla\((200|340),40%,62%,\.92\)$/.test(s)));
 ok('T91.C the soap and the bathwater still paint', cols.includes('rgba(140,128,156,.5)')&&cols.includes('rgba(88,118,138,.58)'));
 ok('T91.C the droplet and hair decorations still paint', cols.includes('rgba(255,255,255,.86)')&&cols.includes('rgba(40,28,16,.75)'));
 // no other theme grew a mosaic
 let clean=true;
 for(const m of ['backyard','livingroom','sandbox','attic']){
  const b=bakePaths1072(m,771072);
  if(b.paths.filter(p=>p.op==='fill'&&p.pts.length===6).length>=50||b.strokes.includes(GROUT1072)||b.fills.includes(GLAZE1072))clean=false;
 }
 ok('T91.C no other map grew hexagons, grout or glaze: every change is gated on the bath theme', clean);
}

/* ---------- D: the release stamp ---------- */
section('T91.D v107.2');
ok('T91.D GAME_VER is v107.2', GAME_VER==='v107.2');
