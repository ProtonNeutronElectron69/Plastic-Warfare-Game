/* render_tail_v54.js — real-canvas pixel gate for v54.
   Assembled as: cat shim_head.js game.js render_tail_v54.js > rc.js && node rc.js
   (needs @napi-rs/canvas)

   The headless suite proves what the painters are HANDED. This tail proves the
   pixels land:

     1. the Depot Yard hull rasterizes for every faction, fits inside the BLD_BOX
        that bakeSprites will cut it into, and carries its faction's colour;
     2. it is genuinely an OPEN FRAME - the tarp deck overhangs a narrower band of
        posts beneath it. That silhouette is the whole reason design B was picked
        over a solid prism, and no other structure in the roster has it;
     3. the flame burst actually covers the disc the sim splashes over, including
        the rim, which the v53 line-only spawn never did.

   On (3): what is rasterized is each particle's PLACEMENT and SIZE, using the same
   ellipse(sx,sy,r*.8,r) the renderer uses, filled solid rather than with the radial
   gradient. The gradient is unchanged from v53 and is not what this release moved -
   coverage is. Measuring solid discs is the honest way to ask "is there paint here".

   Non-vacuous by construction: drop the radius argument at the call sites and the
   coverage checks fail; flatten the canopy onto the cargo and the overhang check
   fails. */
'use strict';
const {createCanvas:__cc}=require('@napi-rs/canvas');
let rcPass=0,rcFail=0;
function rok(n,c){if(c){rcPass++}else{rcFail++;console.log('  FAIL: '+n)}}
console.log('== RC v54: the Depot Yard hull, and flame that covers its own splash ==');

const FACS=['green','tan','gray','blue'];
G={tick:0,orgX:0,parts:[]};   // isoX reads G.orgX

/* ================================================================ 1. the hull */
const BOXS=BLD_BOX.supply;
const SSR=3;

function bakeDepot(col){
 const [x0,y0,x1,y1]=BOXS,w=x1-x0,h=y1-y0;
 const cv=__cc(Math.ceil(w*SSR),Math.ceil(h*SSR));
 const c=cv.getContext('2d');c.scale(SSR,SSR);c.translate(-x0,-y0);
 let err=null;
 c.save();try{bldBody(c,'supply',col,B.supply.sz)}catch(e){err=e}c.restore();
 const d=c.getImageData(0,0,cv.width,cv.height).data;
 return {d,W:cv.width,H:cv.height,err};
}

const shots={};
for(const f of FACS){
 const s=shots[f]=bakeDepot(FAC[f].color);
 let opaque=0;
 for(let i=3;i<s.d.length;i+=4)if(s.d[i]>40)opaque++;
 s.opaque=opaque;
 rok(`RC54 ${f}: the depot hull rasterizes without throwing`,!s.err);
 rok(`RC54 ${f}: it is a substantial silhouette`,opaque>8000);
}

/* it must fit the box bakeSprites will cut it into: any paint on the border means
   the sprite is being clipped in-game, which is exactly the v27 garage-door class
   of bug the face-fitted helpers were introduced to stop. */
for(const f of FACS){
 const s=shots[f];const {d,W,H}=s;
 const at=(x,y)=>d[((y*W+x)<<2)+3];
 let edge=0;
 for(let x=0;x<W;x++){if(at(x,0)>40)edge++;if(at(x,H-1)>40)edge++}
 for(let y=0;y<H;y++){if(at(0,y)>40)edge++;if(at(W-1,y)>40)edge++}
 rok(`RC54 ${f}: nothing touches the BLD_BOX border - the bake cell is not clipping it`,edge===0);
}

/* THE OPEN-FRAME SIGNATURE, and the reason design B was picked over a solid prism.
   For each row take the bounding span and the count of opaque pixels inside it. A
   molded prism is 100% filled on every row it occupies. An open frame is not: the
   band between the tarp deck and the cargo beneath it is four thin posts and air,
   so you can see the ground through it. That dip is measurable and binary. */
function fillProfile(key,sz){
 const box=BLD_BOX[key]||[-70,-56,70,62];
 const [x0,y0,x1,y1]=box,w=Math.ceil(x1-x0),h=Math.ceil(y1-y0);
 const cv=__cc(w,h),c=cv.getContext('2d');c.translate(-x0,-y0);
 try{bldBody(c,key,FAC.green.color,sz)}catch(e){return null}
 const d=c.getImageData(0,0,w,h).data;
 let minRatio=1e9,minY=0,widest=0;
 for(let y=0;y<h;y++){
  let lo=-1,hi=-1,fill=0;
  for(let x=0;x<w;x++)if(d[((y*w+x)<<2)+3]>40){if(lo<0)lo=x;hi=x;fill++}
  const span=lo<0?0:hi-lo+1;
  if(span>widest)widest=span;
  if(span>w*0.35){const r=fill/span;if(r<minRatio){minRatio=r;minY=y}}
 }
 return {minRatio,minY,h,widest};
}
{
 const dep=fillProfile('supply',2);
 rok('RC54 the depot profiles without throwing',!!dep);
 rok('RC54 it is an OPEN FRAME - a row of it is see-through, not a filled prism',
     dep&&dep.minRatio<0.85);
 rok('RC54 ...and that gap sits between the deck and the cargo, mid-sprite',
     dep&&dep.minY>dep.h*0.30&&dep.minY<dep.h*0.72);
 // the control: every solid structure in the roster is 100% filled on every row,
 // so this check cannot be passed by accident
 let solid=true,names=[];
 // (the Lab is excluded: its equipment-pod annex leaves a hairline gap. It is still
//  a walled prism, but it is not a clean 100% control.)
 for(const k of ['generator','dump','bunker','barracks']){
  const p2=fillProfile(k,B[k].sz);
  if(!p2||p2.minRatio<0.99){solid=false;names.push(k)}
 }
 rok('RC54 ...while every solid structure fills 100% of every row'+(names.length?' ('+names.join(',')+')':''),solid);
 console.log(`    open-frame gap: depot ${(dep.minRatio*100).toFixed(0)}% fill at ${(dep.minY/dep.h*100|0)}% down; solid structures 100%`);
}

/* faction colour actually reaches the hull, and the four differ from each other */
{
 const mean=f=>{const {d}=shots[f];let r=0,g=0,b=0,n=0;
  for(let i=0;i<d.length;i+=4){if(d[i+3]<40)continue;r+=d[i];g+=d[i+1];b+=d[i+2];n++}
  return n?[r/n,g/n,b/n]:[0,0,0]};
 const M={};for(const f of FACS)M[f]=mean(f);
 rok('RC54 green reads greenest, blue reads bluest',
     M.green[1]>M.green[0]&&M.blue[2]>M.blue[0]);
 let apart=true;
 for(let i=0;i<FACS.length;i++)for(let j=i+1;j<FACS.length;j++){
  const a=M[FACS[i]],b=M[FACS[j]];
  if(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])<18)apart=false;
 }
 rok('RC54 all four factions are visually distinct on the hull',apart);
}

/* ================================================================ 2. the flame */
/* Rasterize the burst the way the renderer places it: one solid ellipse per 'fl'
   particle at (isoX,isoY-z) with radii (r*.8, r). Then ask what fraction of the
   splash disc's own screen footprint has paint on it. */
function coverage(useRadius,spl,shots){
 const TX=20,TY=20;                       // impact point, in tiles
 const PAD=Math.ceil(spl*HW*2.2)+40;
 const cx=PAD,cy=PAD;
 const cv=__cc(PAD*2,PAD*2),c=cv.getContext('2d');
 const ox=isoX(TX,TY),oy=isoY(TX,TY);
 c.translate(cx-ox,cy-oy);
 G={tick:0,orgX:0,parts:[]};   // orgX again: coverage() replaces G wholesale
 for(let s=0;s<shots;s++){
  G.parts.length=0;
  if(useRadius)spawnFlame(TX-1.4,TY,TX,TY,spl); else spawnFlame(TX-1.4,TY,TX,TY);
  c.fillStyle='#fff';
  for(const p of G.parts){
   if(p.t!=='fl')continue;
   const sx=isoX(p.x,p.y),sy=isoY(p.x,p.y)-p.z;
   c.beginPath();c.ellipse(sx,sy,p.r*.8,p.r,0,0,7);c.fill();
  }
 }
 const d=c.getImageData(0,0,PAD*2,PAD*2).data;
 // the splash footprint on screen: an iso-squashed ellipse of tile-radius spl
 const rx=spl*HW,ry=spl*HH;
 let inside=0,hit=0,rim=0,rimHit=0;
 for(let y=0;y<PAD*2;y++)for(let x=0;x<PAD*2;x++){
  const dx=(x-cx)/rx,dy=(y-cy)/ry,q=dx*dx+dy*dy;
  if(q>1)continue;
  inside++;
  const on=d[((y*PAD*2+x)<<2)+3]>40;
  if(on)hit++;
  if(q>0.49){rim++;if(on)rimHit++}      // the outer 30% of the RADIUS
 }
 return {cov:hit/inside,rim:rimHit/rim};
}

for(const spl of [0.625,1.25]){
 const v53=coverage(false,spl,6), v54=coverage(true,spl,6);
 rok(`RC54 spl ${spl}: the v54 burst covers far more of the damage disc than the v53 line`,
     v54.cov>v53.cov*1.35);
 rok(`RC54 spl ${spl}: ...covering most of it outright`,v54.cov>0.80);
 rok(`RC54 spl ${spl}: ...including the outer rim, which is the visible edge`,
     v54.rim>0.70&&v54.rim>v53.rim*1.3);
 console.log(`    spl ${spl}: disc v53 ${(v53.cov*100).toFixed(0)}% -> v54 ${(v54.cov*100).toFixed(0)}%`
             +`   rim v53 ${(v53.rim*100).toFixed(0)}% -> v54 ${(v54.rim*100).toFixed(0)}%`);
}

/* a single shot must already read as a burst, not a handful of dots */
{
 const one=coverage(true,0.625,1);
 rok('RC54 even one shot covers most of its own disc',one.cov>0.55);
}

console.log(`RC54: PASS ${rcPass}  FAIL ${rcFail}`);
if(rcFail)process.exitCode=1;
