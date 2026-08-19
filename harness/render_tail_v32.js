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
 /* v86 FIXTURE CORRECTION. The canvas was a fixed 560x420 and the comment said
    "so the 10-ring lands on-canvas" - BUILD_R_HQ was 10 when this was written and
    is 15 now, so at 15*HW = 480 px the ring's widest points sit off both edges and
    its top and bottom arcs sit 30 px past the bottom of a 420-tall canvas. NOTHING
    of it landed, the check read 0 green pixels, and it had been failing on every
    build since the radius moved. Sized off the constant instead, so a further
    re-tune of the build zone moves the canvas with it. Measured on the v85 build
    before the change: identical failure, so this is not a v86 regression. */
 const W32=2*BUILD_R_HQ*HW+60, H32=2*BUILD_R_HQ*HH+60;
 const cv=__cc(W32,H32),c=cv.getContext('2d');
 // centre the camera on the HQ so the whole ring lands on-canvas
 const cx=isoX(hq.x,hq.y)-W32/2,cy=isoY(hq.x,hq.y)-H32/2;
 G.zoom=1;G.placing={key:'barracks'};
 let err=null;try{drawGhost(c,cx,cy)}catch(e){err=e}
 const g=err?0:greenish(c,0,0,W32,H32);
 rok(`RC drawGhost paints green HQ aura ring (${g} green px, need >120)`,!err&&g>120);
 if(err)console.log('   ',err.stack.split('\n')[0]);
 G.placing=null;}

/* 1b) v86: the Command Truck's travelling build zone paints the same green ring,
       and ONLY for the three keys the placement door will actually anchor. */
{const p=G.human;
 const tk=makeUnit('cmdtruck',p,p.start.x+2,p.start.y+2);tk.state='idle';tk.path=null;
 const W=2*CMD_R*HW+60,H=2*CMD_R*HH+60;
 const paint=key=>{const cv=__cc(W,H),c=cv.getContext('2d');
  G.zoom=1;G.placing={key};
  try{drawGhost(c,isoX(tk.x,tk.y)-W/2,isoY(tk.x,tk.y)-H/2)}catch(e){return -1}
  return greenish(c,0,0,W,H)};
 /* Always compared against the SAME key with the truck taken off the field. It has
    to be the same key both times: the placement GHOST is drawn in the faction
    colour, which for Green is green, so a bigger footprint paints more green
    pixels on its own and a cross-key comparison would measure the footprint
    rather than the ring. */
 const delta=key=>{const a=paint(key);tk.hp=0;const b=paint(key);tk.hp=tk.mhp;return a-b};
 const anchored=delta('barricade');
 rok(`RC the Command Truck paints a build ring for a key it anchors (+${anchored} green px)`,anchored>120);
 rok('RC ...and paints none for a key it does not',delta('garage')===0&&delta('lab')===0);
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
