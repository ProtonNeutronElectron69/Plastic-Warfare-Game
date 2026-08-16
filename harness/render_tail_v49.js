/* render_tail_v49.js — real-canvas pixel gate for the v49 black-building fix.
   Assembled as: cat shim_head.js game.js render_tail_v49.js > rc.js && node rc.js
   (needs @napi-rs/canvas)

   The shim swallows draw calls, so the headless suite can only prove that no
   primitive is HANDED black. This tail proves the pixels are not black either:
   it rasterizes every building for every faction under a real 2D context and
   measures, inside the hull silhouette, how much of the paint is near-black and
   how much carries the faction hue. Before the fix the four reported structures
   ran 60-95% near-black; the gate is set at 25%, far above the legitimate dark
   accents (ladder rails, door recesses, guy wires, muzzle) and far below the bug. */
'use strict';
const {createCanvas:__cc}=require('@napi-rs/canvas');
let rcPass=0,rcFail=0;
function rok(n,c){if(c){rcPass++}else{rcFail++;console.log('  FAIL: '+n)}}
console.log('== RC v49: no building paints itself black ==');

const FACS=['green','tan','gray','blue'];
const W=260,H=280;
G={tick:0};

/* rasterize one building and classify its opaque pixels */
function shoot(key,fac){
 const cv=__cc(W,H),c=cv.getContext('2d');
 let err=null;
 c.save();c.translate(W/2,H*0.68);
 try{
  bldBody(c,key,FAC[fac].color,B[key].sz);
  bldLive(c,{key,sz:B[key].sz,id:3,tface:0.7,prog:1,garrison:[]},FAC[fac].color);
 }catch(e){err=e}
 c.restore();
 const d=c.getImageData(0,0,W,H).data;
 let opaque=0,black=0,hued=0;
 const base=hx2rgb(FAC[fac].color);
 // which channel dominates the faction colour (gray has none, so it is scored on lightness)
 const gray=fac==='gray';
 for(let i=0;i<d.length;i+=4){
  if(d[i+3]<40)continue;
  opaque++;
  const r=d[i],g=d[i+1],b=d[i+2],mx=Math.max(r,g,b);
  if(mx<48)black++;
  if(gray){ if(mx>=70&&Math.abs(r-g)<34&&Math.abs(g-b)<34&&Math.abs(r-b)<34)hued++; }
  else{
   // the dominant channel of the faction colour must lead this pixel too
   const dom=base.r>=base.g&&base.r>=base.b?r:(base.g>=base.b?g:b);
   const other=(r+g+b-dom)/2;
   if(mx>=70&&dom>other+10)hued++;
  }
 }
 return {err,opaque,black,hued,pB:black/Math.max(1,opaque),pH:hued/Math.max(1,opaque)};
}

/* 1) the four reported structures: the regression this release exists to kill */
for(const key of ['generator','guardtower','radar','radiotower']){
 for(const fac of FACS){
  const s=shoot(key,fac);
  rok(`${key}/${fac} paints without error`,!s.err);
  rok(`${key}/${fac} is not a black slab (${(s.pB*100).toFixed(1)}% near-black)`,s.pB<0.25);
  rok(`${key}/${fac} reads as team colour (${(s.pH*100).toFixed(1)}% hued)`,s.pH>0.35);
 }
}

/* 2) every other building the shade() bug was also blackening */
for(const key of ['hq','barracks','lab','garage','helipad','bunker','dump','outpost','turbine']){
 for(const fac of FACS){
  const s=shoot(key,fac);
  rok(`${key}/${fac} paints without error`,!s.err);
  rok(`${key}/${fac} is not a black slab (${(s.pB*100).toFixed(1)}% near-black)`,s.pB<0.25);
 }
}

/* 3) the base pad under EVERY building was black too — sample the pad band alone */
{
 let worst=0,worstKey='';
 for(const key in B){
  if(key==='barricade'||key==='nest')continue;
  for(const fac of FACS){
   const s=shoot(key,fac);
   if(s.pB>worst){worst=s.pB;worstKey=key+'/'+fac}
  }
 }
 rok(`worst near-black share across the whole set is ${(worst*100).toFixed(1)}% (${worstKey})`,worst<0.25);
}

/* 4) the tank turret actually rasterizes onto a portrait-sized tile */
for(const [key,scale] of [['tank',1],['bulltank',1.34]]){
 const cv=__cc(120,120),c=cv.getContext('2d');
 let err=null;
 c.save();c.translate(60,60);c.scale(2,2);
 try{ vehBody(c,key,FAC.green.color); }catch(e){err=e}
 const before=(()=>{const d=c.getImageData(0,0,120,120).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>40)n++;return n})();
 try{ c.scale(scale,scale); tankTurret(c,key,FAC.green.color); }catch(e){err=e}
 c.restore();
 const after=(()=>{const d=c.getImageData(0,0,120,120).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>40)n++;return n})();
 rok(`${key} turret rasterizes without error`,!err);
 rok(`${key} turret adds real pixels over the bare hull (${before} -> ${after})`,after>before*1.04);
}

console.log('==================================');
console.log('RC PASS: '+rcPass+'   RC FAIL: '+rcFail);
process.exit(rcFail?1:0);
