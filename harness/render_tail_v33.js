/* render_tail_v33.js — pipeline-only real-canvas checks (@napi-rs/canvas).
   Assembled as: cat shim_head.js game.js render_tail_v33.js > rc.js && node rc.js
   Rasterizes every new wave creature (fireant/wasp/roach/mouse) and the white
   defend flag under a real 2D context and confirms each paints, the mouse boss
   HP bar renders, and a full render() with a live wave + flag in frame never
   throws (REN_ERRS untouched). */
'use strict';
const {createCanvas:__cc}=require('@napi-rs/canvas');
let rcPass=0,rcFail=0;
function rok(n,c){if(c){rcPass++}else{rcFail++;console.log('  FAIL: '+n)}}
console.log('== RC v33: real-canvas wave-creature + defend-flag checks ==');
// count non-transparent pixels in a region
function painted(c,x,y,w,h){const d=c.getImageData(x,y,w,h).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)n++;return n}
// count near-white pixels (the flag / ring)
function whiteish(c,x,y,w,h){const d=c.getImageData(x,y,w,h).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]>200&&d[i+2]>200&&d[i+3]>60)n++;return n}
// count reddish pixels (boss HP bar)
function reddish(c,x,y,w,h){const d=c.getImageData(x,y,w,h).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>150&&d[i]>d[i+1]+50&&d[i]>d[i+2]+50&&d[i+3]>60)n++;return n}

G=null;newGame({map:'backyard',mode:'surv',diff:'normal',fac:'green',opp:2,seed:6363});
for(let i=0;i<30;i++)update(1/30);
const cw=G.map.N/2+0.5;

/* 1) each creature sprite rasterizes under a real ctx */
for(const sp of ['ant','fireant','bee','wasp','roach','mouse']){
 const cr=spawnWaveCreature(sp,cw,cw);cr.face=0.6;cr.legph=1.2;cr.wob=0.7;
 const W=160,H=160,cv=__cc(W,H),c=cv.getContext('2d');
 const sx=isoX(cr.x,cr.y),sy=isoY(cr.x,cr.y);
 c.save();c.translate(W/2-sx,H/2-sy);
 let err=null;try{drawBug(c,cr)}catch(e){err=e}
 c.restore();
 const px=err?0:painted(c,0,0,W,H);
 rok(`RC ${sp} sprite paints (${px} px, need >60)`,!err&&px>60);
 if(err)console.log('   ',err.stack.split('\n')[0]);
 // remove so the next sprite renders in isolation
 G.neutrals.pop();
}

/* 2) mouse mini-boss always shows its (wider) HP bar, even at full HP */
{
 const cr=spawnWaveCreature('mouse',cw,cw);cr.face=0.4;
 const W=180,H=180,cv=__cc(W,H),c=cv.getContext('2d');
 const sx=isoX(cr.x,cr.y),sy=isoY(cr.x,cr.y);
 c.save();c.translate(W/2-sx,H/2-sy+30);   // shift down so the bar (above sprite) is on-canvas
 let err=null;try{drawBug(c,cr)}catch(e){err=e}
 c.restore();
 const red=err?0:reddish(c,0,0,W,H);
 rok(`RC mouse boss HP bar renders at full HP (${red} red px, need >20)`,!err&&red>20);
 G.neutrals.pop();
}

/* 3) the white defend flag rasterizes */
{
 const W=140,H=160,cv=__cc(W,H),c=cv.getContext('2d');
 const sx=isoX(G.surv.fx,G.surv.fy),sy=isoY(G.surv.fx,G.surv.fy);
 c.save();c.translate(W/2-sx,H/2-sy+20);   // flag rides above the base point
 let err=null;try{drawDefendFlag(c)}catch(e){err=e}
 c.restore();
 const w=err?0:whiteish(c,0,0,W,H);
 rok(`RC defend flag paints white cloth/ring (${w} px, need >40)`,!err&&w>40);
 if(err)console.log('   ',err.stack.split('\n')[0]);
}

/* 4) full render() with a live wave + flag in frame never throws */
{
 for(let k=0;k<8;k++){const a=k/8*6.28;spawnWaveCreature(k%2?'roach':'wasp',cw+dcos(a)*3,cw+dsin(a)*3);}
 spawnWaveCreature('mouse',cw,cw+2);
 const before=REN_ERRS.size;
 let err=null;try{render();render()}catch(e){err=e}
 rok('RC render() clean with wave + flag in frame',!err&&REN_ERRS.size===before);
 if(err)console.log('   ',err.stack.split('\n')[0]);
 if(REN_ERRS.size>before)console.log('   ',[...REN_ERRS].slice(before).join(' | '));
}

console.log(`RC PASS: ${rcPass}   FAIL: ${rcFail}`);
process.exit(rcFail?1:0);
