/* render_tail_v32.js — pipeline-only real-canvas checks (@napi-rs/canvas).
   Assembled as: cat shim_head.js game.js render_tail_v32.js > rc.js && node rc.js
   Verifies drawGhost actually rasterizes the v32 aura rings under a real 2D
   context: 1) placing a non-anywhere key over base paints green ring pixels
   near the HQ centre, 2) render() end-to-end while placing never throws and
   leaves REN_ERRS untouched. */
'use strict';
const {createCanvas:__cc}=require('@napi-rs/canvas');
let rcPass=0,rcFail=0;
function rok(n,c){if(c){rcPass++}else{rcFail++;console.log('  FAIL: '+n)}}
console.log('== RC v32: real-canvas placement aura-ring checks ==');
function greenish(c,x,y,w,h){const d=c.getImageData(x,y,w,h).data;let n=0;for(let i=0;i<d.length;i+=4){if(d[i+1]>140&&d[i+1]>d[i]+30&&d[i+1]>d[i+2]+30&&d[i+3]>40)n++;}return n}

G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:3,seed:6262});
for(let i=0;i<30;i++)update(1/30);

/* 1) drawGhost paints the green HQ aura ring under a real ctx */
{const hq=G.human.blds.find(b=>b.key==='hq');
 const cv=__cc(560,420),c=cv.getContext('2d');
 // centre the camera on the HQ so the 10-ring lands on-canvas
 const cx=isoX(hq.x,hq.y)-280,cy=isoY(hq.x,hq.y)-210;
 G.zoom=1;G.placing={key:'barracks'};
 let err=null;try{drawGhost(c,cx,cy)}catch(e){err=e}
 const g=err?0:greenish(c,0,0,560,420);
 rok(`RC drawGhost paints green HQ aura ring (${g} green px, need >120)`,!err&&g>120);
 if(err)console.log('   ',err.stack.split('\n')[0]);
 G.placing=null;}

/* 2) full render() while placing never throws (REN_ERRS untouched) */
{const before=REN_ERRS.size;
 G.placing={key:'guardtower'};render();
 G.placing={key:'hq'};render();       // anywhere key: skips friendly rings, still fine
 G.placing=null;
 rok('RC render() clean while placing (REN_ERRS untouched)',REN_ERRS.size===before);
 if(REN_ERRS.size>before)console.log('   ',[...REN_ERRS].slice(before).join(' | '));}

console.log(`RC PASS: ${rcPass}   FAIL: ${rcFail}`);
process.exit(rcFail?1:0);
