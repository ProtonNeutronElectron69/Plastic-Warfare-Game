/* render_tail_v66.js - real-canvas pixel gate for the v66 hazard painters.
   Assembled as: cat shim_head.js game.js render_tail_v66.js > rc.js && node rc.js
   (needs @napi-rs/canvas)

   T45.C in the standard suite proves each new painter branch is REACHED, by
   recording the fillStyle strings the bake assigns. Under the shim that is as far
   as it can go: draw calls are swallowed, so a branch can be reached and still put
   nothing on the board. This tail rasterizes the terrain for real and measures the
   pixels inside each hazard's footprint:

     1. the hazard actually marks the ground - its patch differs from clean terrain
        sampled on the same map,
     2. it is not painted black or left transparent (the v49 failure mode, which the
        molded-plastic primitives are still capable of if a colour string is ever
        re-parsed through hx2rgb),
     3. a map's two themed hazards are visibly different from EACH OTHER, which is
        the whole point of theming them,
     4. and the two liquids that share the pond painter across maps (milk, juice,
        coffee) really do come out as three different liquids. */
'use strict';
const {createCanvas:__cc}=require('@napi-rs/canvas');
let rcPass=0,rcFail=0;
function rok(n,c){if(c){rcPass++}else{rcFail++;console.log('  FAIL: '+n)}}
console.log('== RC v66: the themed hazard painters put real pixels down ==');

const THEME={backyard:{h2:'thorns',h3:'puddle'},kitchen:{h2:'grease',h3:'milk'},
 livingroom:{h2:'glue',h3:'juice'},sandbox:{h2:'sand',h3:'water'},desk:{h2:'soda',h3:'coffee'}};
const MAPS66=Object.keys(THEME);

/* Route the terrain bake onto a real canvas. renderTerrain builds its own canvas
   through document.createElement, so that is the seam. */
function bakeReal(map,seed){
 const cfg={map,mode:map==='desk'?'surv':'dm',diff:'normal',fac:'tan',opp:1,seed};
 G=null;newGame(cfg);
 const real=document.createElement.bind(document);
 let made=null;
 document.createElement=(tag)=>{
  if(String(tag).toLowerCase()!=='canvas')return real(tag);
  const holder={width:1,height:1,_cv:null,
   getContext(){if(!holder._cv)holder._cv=__cc(holder.width|0,holder.height|0);return holder._cv.getContext('2d')}};
  return new Proxy(holder,{
   get(t,k){if(k==='getContext')return t.getContext;return t[k]},
   set(t,k,v){t[k]=v;if((k==='width'||k==='height'))t._cv=null;return true}
  });
 };
 try{renderTerrain()}finally{document.createElement=real}
 made=G.terr;
 const ctx=made.getContext('2d');
 return {cv:made,ctx,W:made.width|0,H:made.height|0};
}

/* mean opaque colour over a small screen-space disc, plus what fraction of it is
   near-black or transparent */
function sample(bake,wx,wy,rpx){
 const px=isoX(wx,wy),py=isoY(wx,wy);
 const x0=Math.max(0,Math.round(px-rpx)),y0=Math.max(0,Math.round(py-rpx));
 const w=Math.min(bake.W-x0,Math.round(rpx*2)),h=Math.min(bake.H-y0,Math.round(rpx*2));
 if(w<=0||h<=0)return null;
 const d=bake.ctx.getImageData(x0,y0,w,h).data;
 let n=0,r=0,g=0,b=0,dark=0,clear=0;
 for(let i=0;i<d.length;i+=4){
  if(d[i+3]<40){clear++;continue}
  n++;r+=d[i];g+=d[i+1];b+=d[i+2];
  if(Math.max(d[i],d[i+1],d[i+2])<28)dark++;
 }
 if(!n)return null;
 return {r:r/n,g:g/n,b:b/n,n,darkFrac:dark/n,clearFrac:clear/(n+clear)};
}
const dist=(a,b)=>Math.sqrt((a.r-b.r)**2+(a.g-b.g)**2+(a.b-b.b)**2);

/* a tile on this map carrying no hazard code and no prop, for a clean reference */
function cleanSpot(M){
 const N=M.N;
 for(let y=6;y<N-6;y++)for(let x=6;x<N-6;x++){
  let ok2=true;
  for(let oy=-2;oy<=2&&ok2;oy++)for(let ox=-2;ox<=2;ox++)
   if(M.fld[(y+oy)*N+(x+ox)]||!M.pass[(y+oy)*N+(x+ox)]){ok2=false;break}
  if(ok2)return{x:x+0.5,y:y+0.5};
 }
 return null;
}

const MEAN={};
for(const map of MAPS66){
 const bake=bakeReal(map,660501);
 const M=G.map,want=THEME[map];
 const clean=cleanSpot(M);
 rok(`RC66 ${map}: found clean reference ground`,!!clean);
 const ref=clean&&sample(bake,clean.x,clean.y,10);
 rok(`RC66 ${map}: the terrain bake produced opaque ground`,!!ref&&ref.clearFrac<0.5);

 const got={};
 for(const kind of [want.h2,want.h3]){
  /* The biggest field of this kind that nothing else is drawn over. Picking purely
     by size reads whatever landed on top: the Living Room's largest juice pool has
     a glue spill across it and sampled as 215,200,225 - glue's own near-white -
     while every unobstructed juice pool on the same map reads 153,68,174. That is
     an overlap artefact, not a painter fault, and sampling it would have been a
     false failure here and a false PASS the day a palette really did collapse. */
  const of_=(M.fields||[]).filter(f=>f.kind===kind).sort((a,b)=>b.rx*b.ry-a.rx*a.ry);
  const clear_=of_.filter(f=>!(M.fields||[]).some(g2=>g2!==f&&
   dhyp(g2.cx-f.cx,g2.cy-f.cy)<Math.max(g2.rx,g2.ry)*1.4+Math.max(f.rx,f.ry)*0.6));
  const fl=clear_[0]||of_[0];
  rok(`RC66 ${map}: a ${kind} field exists to sample`,!!fl);
  if(!fl)continue;
  const s=sample(bake,fl.cx,fl.cy,Math.max(8,Math.min(fl.rx,fl.ry)*HW*0.45));
  rok(`RC66 ${map}: the ${kind} patch has opaque pixels`,!!s&&s.clearFrac<0.5);
  if(!s)continue;
  got[kind]=s;
  rok(`RC66 ${map}: ${kind} is not painted black (${(100*s.darkFrac).toFixed(0)}% near-black)`,s.darkFrac<0.25);
  if(ref)rok(`RC66 ${map}: ${kind} actually marks the ground (dC ${dist(s,ref).toFixed(0)} vs clean)`,dist(s,ref)>18);
  MEAN[kind]=s;
 }
 const a=got[want.h2],b=got[want.h3];
 if(a&&b)rok(`RC66 ${map}: its burn hazard and its liquid look different (dC ${dist(a,b).toFixed(0)})`,dist(a,b)>25);
}

/* the three liquids share one painter and a palette table: prove the table is what
   distinguishes them, not luck of the map */
{
 const LIQ=['milk','juice','coffee'];
 const have=LIQ.filter(k=>MEAN[k]);
 rok(`RC66 all three pond-painter liquids were sampled (${have.join(',')})`,have.length===3);
 if(have.length===3){
  let worst=1e9,pair='';
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
   const d=dist(MEAN[LIQ[i]],MEAN[LIQ[j]]);
   if(d<worst){worst=d;pair=LIQ[i]+'/'+LIQ[j]}
  }
  rok(`RC66 no two liquids collapse onto the same colour (closest ${pair} at dC ${worst.toFixed(0)})`,worst>30);
 }
 // and the same for the goo painter
 const GOO=['thorns','grease','glue','soda'].filter(k=>MEAN[k]);
 rok(`RC66 every code-2 hazard was sampled (${GOO.join(',')})`,GOO.length===4);
 if(GOO.length===4){
  let worst=1e9,pair='';
  for(let i=0;i<GOO.length;i++)for(let j=i+1;j<GOO.length;j++){
   const d=dist(MEAN[GOO[i]],MEAN[GOO[j]]);
   if(d<worst){worst=d;pair=GOO[i]+'/'+GOO[j]}
  }
  rok(`RC66 no two burn hazards collapse onto the same colour (closest ${pair} at dC ${worst.toFixed(0)})`,worst>25);
 }
}

/* non-vacuity: the sampler must be able to report a difference of zero */
{
 const bake=bakeReal('kitchen',660501);
 const M=G.map,c1=cleanSpot(M);
 if(c1){
  const a=sample(bake,c1.x,c1.y,8),b=sample(bake,c1.x,c1.y,8);
  rok('RC66 the sampler is stable on identical ground (dC 0)',a&&b&&dist(a,b)===0);
 } else rok('RC66 the sampler is stable on identical ground',false);
}

console.log('==================================');
console.log('RC66: PASS '+rcPass+'  FAIL '+rcFail);
process.exit(rcFail?1:0);
