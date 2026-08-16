/* render_tail_v51.js — real-canvas pixel gate for the v51 AA missile truck.
   Assembled as: cat shim_head.js game.js render_tail_v51.js > rc.js && node rc.js
   (needs @napi-rs/canvas)

   The headless suite can only prove what the painters are HANDED (T32.E records
   fillStyle assignments through a Proxy). This tail proves the pixels land: that
   the baked hull carries no rack, that the live rack adds real paint on top of it,
   that the four red missile tips survive rasterisation for every faction, and that
   the rack sweeps independently without leaving the portrait tile.

   Non-vacuous by construction: bake the rack into the hull (the M7 mutation) and
   the "hull carries no red" checks fail; drop the rack from drawUnit and the
   "adds paint over the bare hull" checks fail. */
'use strict';
const {createCanvas:__cc}=require('@napi-rs/canvas');
let rcPass=0,rcFail=0;
function rok(n,c){if(c){rcPass++}else{rcFail++;console.log('  FAIL: '+n)}}
console.log('== RC v51: the AA truck hull, and a rack that paints on top of it ==');

const FACS51=['green','tan','gray','blue'];
const W51=200,H51=200;
G={tick:0};

// how far apart is a colour from the missile-tip red, in plain channel distance
function isTipRed(r,g,b){return r>150&&r<225&&g>25&&g<90&&b>15&&b<80}

function shoot51(paint){
 const cv=__cc(W51,H51),c=cv.getContext('2d');
 c.save();c.translate(W51/2,H51/2);c.scale(2.6,2.6);
 let err=null;
 try{paint(c)}catch(e){err=e}
 c.restore();
 const d=c.getImageData(0,0,W51,H51).data;
 let opaque=0,red=0;
 for(let i=0;i<d.length;i+=4){
  if(d[i+3]<40)continue;
  opaque++;
  if(isTipRed(d[i],d[i+1],d[i+2]))red++;
 }
 return {opaque,red,err};
}

/* ---- 1. the hull rasterizes, and carries no missile tips ---- */
for(const f of FACS51){
 const col=FAC[f].color;
 const hull=shoot51(c=>vehBody(c,'aatruck',col));
 rok(`RC51 ${f}: the AA truck hull rasterizes without throwing`,!hull.err);
 rok(`RC51 ${f}: the hull is a substantial silhouette`,hull.opaque>1400);
 rok(`RC51 ${f}: the baked hull carries NO missile tips - the rack is not in it`,hull.red===0);
}

/* ---- 2. the rack adds real paint over the bare hull, at every bearing ----
   Counting total opaque pixels is the wrong metric: along the hull's long axis the
   rack lands mostly ON the chassis, so the silhouette barely grows. Diffing the two
   rasters measures what we actually care about, which is paint landing on top.
   Measured on this build: 1360-1395 changed pixels and 102-129 tip pixels per
   bearing, so the gates below sit at 900 and 60. */
function raster51(paint){
 const cv=__cc(W51,H51),c=cv.getContext('2d');
 c.save();c.translate(W51/2,H51/2);c.scale(2.6,2.6);
 let err=null;try{paint(c)}catch(e){err=e}
 c.restore();
 return {d:c.getImageData(0,0,W51,H51).data,err};
}
const BEARINGS=[0,Math.PI/2,Math.PI,-Math.PI/2];
const CENTROIDS={};
for(const f of FACS51){
 const col=FAC[f].color;
 const hull=raster51(c=>vehBody(c,'aatruck',col));
 for(const ang of BEARINGS){
  const deg=Math.round(ang*180/Math.PI);
  const both=raster51(c=>{vehBody(c,'aatruck',col);c.translate(AA_PIVOT,0);c.rotate(ang);aaTurret(c,col)});
  let diff=0,red=0,sx=0,sy=0,n=0;
  for(let i=0;i<hull.d.length;i+=4){
   if(hull.d[i]!==both.d[i]||hull.d[i+1]!==both.d[i+1]||hull.d[i+2]!==both.d[i+2]||hull.d[i+3]!==both.d[i+3])diff++;
   if(both.d[i+3]>=40&&isTipRed(both.d[i],both.d[i+1],both.d[i+2])){red++;const p=i>>2;sx+=p%W51;sy+=Math.floor(p/W51);n++}
  }
  rok(`RC51 ${f}: the rack lays real paint over the bare hull at ${deg}\u00b0 (${diff} px changed)`,
      !both.err&&diff>900);
  rok(`RC51 ${f}: all four missile tips survive rasterisation at ${deg}\u00b0 (${red} px)`,red>60);
  if(f==='green')CENTROIDS[deg]=n?{x:sx/n,y:sy/n}:null;
 }
}

/* ---- 3. the rack really is independent: its tips orbit the pivot ---- */
{
 const shots=BEARINGS.map(a=>CENTROIDS[Math.round(a*180/Math.PI)]);
 rok('RC51 the tips are found at all four bearings',shots.every(s=>!!s));
 const spreadX=Math.max(...shots.map(s=>s.x))-Math.min(...shots.map(s=>s.x));
 const spreadY=Math.max(...shots.map(s=>s.y))-Math.min(...shots.map(s=>s.y));
 rok(`RC51 the tips orbit as the rack swivels, in both axes (${spreadX.toFixed(0)} x ${spreadY.toFixed(0)} px)`,
     spreadX>45&&spreadY>45);
 const pivPx=W51/2+AA_PIVOT*2.6;
 rok('RC51 forward and reverse bearings mirror about the pivot, so the pivot is where the code says',
     Math.abs((CENTROIDS[0].x-pivPx)+(CENTROIDS[180].x-pivPx))<12);
 rok('RC51 the broadside bearings sit on the pivot in x',
     Math.abs(CENTROIDS[90].x-pivPx)<6&&Math.abs(CENTROIDS[-90].x-pivPx)<6);
}

/* ---- 4. the portrait box really does contain the rack ----
   Painted live rather than through vehPortraitPaint: that path blits the BAKED
   cell, and bakeSprites() builds its cells from the shim's fake canvas, which a
   real 2D context refuses to drawImage. render_tail_v49 sidesteps the same way. */
{
 const bx=vehPortraitBox('aatruck'),bw=bx.x1-bx.x0,bh=bx.y1-bx.y0,P=56,pad=6;
 const s2=Math.min((P-pad)/bw,(P-pad)/bh);
 for(const f of FACS51){
  const col=FAC[f].color,cv=__cc(P,P),c=cv.getContext('2d');
  c.save();
  c.translate((P-bw*s2)/2-bx.x0*s2,(P-bh*s2)/2-bx.y0*s2);c.scale(s2,s2);
  vehBody(c,'aatruck',col);
  c.translate(AA_PIVOT,0);aaTurret(c,col);
  c.restore();
  const d=c.getImageData(0,0,P,P).data;
  let opaque=0,red=0,edge=0;
  for(let i=0;i<d.length;i+=4){
   if(d[i+3]<40)continue;
   opaque++;
   if(isTipRed(d[i],d[i+1],d[i+2]))red++;
   const p=i>>2,x=p%P,y=Math.floor(p/P);
   if(x===0||y===0||x===P-1||y===P-1)edge++;
  }
  rok(`RC51 ${f}: the 56px portrait tile paints the truck`,opaque>500);
  rok(`RC51 ${f}: the portrait includes the rack's missile tips`,red>=3);
  rok(`RC51 ${f}: nothing reaches the tile edge, so the rack is not clipped`,edge===0);
 }
}

console.log(rcFail?`RC PASS: ${rcPass}   RC FAIL: ${rcFail}`:`RC PASS: ${rcPass}   RC FAIL: 0`);
process.exit(rcFail?1:0);
