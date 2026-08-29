/* ---------------- GAME STATE ---------------- */
let G=null;
const view=document.getElementById('view'),vc=view.getContext('2d');
/* v90.2 TOPBAR_H - where the bar's bottom edge lands, which is what the
   EDGE-SCROLL band below has to start from. It is exactly the CSS --topbarH and
   NOT that plus the 2px border: the sheet opens with a global
   `*{box-sizing:border-box}`, so the declared height is the outer height and the
   border is drawn inside it. Measured in Chromium to be sure rather than
   reasoned about, because getting it wrong by the border is precisely the kind
   of two-pixel error nothing would ever report.
   It is a second copy of a number the stylesheet also states, which this project
   does not normally allow - but CSS cannot be read from here. So it is handled
   the way the Field Manual's figures are: one constant, and a test that scrapes
   the stylesheet and asserts the two agree (T65.B), so the copy cannot drift the
   way a comment would.
   Same reasoning as applyMMSize below, which already hard-codes the minimap
   wrap's own padding and border for the reserves it writes. */
const TOPBAR_H=84;
/* v97 RDPR - the render device-pixel ratio. Until now the canvases were sized
   in CSS pixels, so on any high-DPI display the browser upscaled the whole
   frame and every sprite went soft - the "units look blurry" the owner saw.
   Backing stores are now device pixels (capped at 2: beyond that the cost
   quadruples for detail nobody can see) while EVERYTHING ELSE stays in CSS
   pixels: the mouse, G.zoom, G.cam, audAt's pan, the camera clamps. Only the
   renderer multiplies by RDPR, at its transform. vpW/vpH answer the CSS size
   wherever screen logic needs it - derived from the canvas rather than stored,
   so a test that pokes view.width directly still reads coherent numbers.
   Client-local, never hashed: two lockstep clients may disagree about RDPR the
   same way they already disagree about window size. #dpr1 forces the old 1:1
   rendering as an escape hatch. Headless the shim pins devicePixelRatio=1, so
   the whole suite runs the exact pre-v97 numbers. */
let RDPR=1;
function calcDPR(){
 let d=(typeof devicePixelRatio==='number'?devicePixelRatio:1)||1;
 if(typeof location!=='undefined'&&/\bdpr1\b/.test(location.hash||''))d=1;
 return Math.max(1,Math.min(d,2));
}
RDPR=calcDPR();
function vpW(){return view.width/RDPR}
function vpH(){return view.height/RDPR}
const mmCv=document.getElementById('minimap'),mm=mmCv.getContext('2d');
/* v27: minimap size cycle (small / medium / large). Pure client-side view
   preference; persisted in localStorage, applied before the first render. */
const MM_SIZES={small:132,medium:176,large:240};
let mmSizeKey=(function(){try{const v=localStorage.getItem('pw_mmsize');return MM_SIZES[v]?v:'medium'}catch(e){return 'medium'}})();
let MM_S=MM_SIZES[mmSizeKey];
function applyMMSize(){
 /* v97: device-pixel backing (CSS size pinned to MM_S) so the minimap is as
    crisp as the field; renderMinimap opens with an RDPR base transform */
 MM_S=MM_SIZES[mmSizeKey];mmCv.width=Math.round(MM_S*RDPR);mmCv.height=Math.round(MM_S*RDPR);
 mmCv.style.width=MM_S+'px';mmCv.style.height=MM_S+'px';
 const bt=document.getElementById('mmSizeBtn');if(bt)bt.textContent='\u25f1 '+mmSizeKey[0].toUpperCase();
 /* v73: the map is pinned to the corner, so everything that shares an edge with
    it has to know how big it currently is. Wrap width = MM_S + 6px padding and
    2px border each side = MM_S + 16; wrap height adds the ~18px header, so
    MM_S + 34. Both reserves add the 8px inset and an 8px gap on top of that.
    Written as plain style properties on purpose: setProperty does not exist on
    the headless shim's style object, so a CSS custom property would throw. */
 const bb=document.getElementById('bottombar');
 if(bb)bb.style.paddingRight=(MM_S+40)+'px';
 const rr=document.getElementById('rightRail');
 if(rr)rr.style.bottom=(MM_S+50)+'px';
 try{localStorage.setItem('pw_mmsize',mmSizeKey)}catch(e){}
}
(function(){const bt=document.getElementById('mmSizeBtn');if(bt)bt.onclick=()=>{mmSizeKey=mmSizeKey==='small'?'medium':mmSizeKey==='medium'?'large':'small';applyMMSize();sClick()};applyMMSize();})();

function resize(){
 const d=calcDPR(); // browser zoom moves devicePixelRatio, and it fires resize
 if(d!==RDPR){RDPR=d;mmCv.width=Math.round(MM_S*RDPR);mmCv.height=Math.round(MM_S*RDPR);}
 view.width=Math.round(innerWidth*RDPR);view.height=Math.round(innerHeight*RDPR);
 view.style.width=innerWidth+'px';view.style.height=innerHeight+'px';
}
addEventListener('resize',resize);resize();

function isoX(x,y){return (x-y)*HW+G.orgX}
function isoY(x,y){return (x+y)*HH}
function unIso(sx,sy){sx-=G.orgX;return {x:(sx/HW+sy/HH)/2,y:(sy/HH-sx/HW)/2}}

/* v74 PROP COLLISION RADII.
   Measured, not guessed: each prop type was baked on a real canvas and its art
   radius read off the sprite alpha as halfWidth / (sqrt(2) * HW). Entries are
   0.85x that, rounded to 0.05, quoted at sc === 1 and multiplied by the prop's
   own sc at the call site. A type absent from this table keeps its call-site r.

   0 means DECOR: the art is smaller than a unit's own radius, so units walk
   over it rather than routing around a footprint nobody can see. The prop still
   spawns exactly where it did, because the call-site r continues to drive both
   the nearExpo placement rejection and (for rock and mushroom) the art scale.

   Line props are listed here too; lineProps feeds the value to blockLine as a
   capsule radius, matched to the drawn limb's half-thickness. Watch the .5 cliff
   there: blockLine tests ox*ox+oy*oy against (r+.5)^2, so any radius over .5
   picks up the four neighbours and the line jumps from one tile wide to three.
   The Desk pencil carries sc 1.5, which is why its base is .32 and not .35. */
const PROP_BLK={
 /* decor: art radius below a unit's own, so nothing blocks */
 mushroom:0, salt:0, gnome:0, sugar:0, blocks:0, shellp:0, can:0, marble:0,
 lamp:0, eraser:0,
 /* small ground clutter */
 remote:.40, plate:.45, soccer:.45, chips:.30, star:.50, beachball:.50,
 wall:.50, tower:.50, books:.50, dino:.55, slipper:.55, mug:.55, toaster:.55,
 keyboard:.60,
 /* mid */
 rock:.70, hose:.70, traincar:.70, shelf:.70, dumptruck:.75, wcan:.80,
 chair:.80, keep:.85, table:.95, pot:1.00, console:1.20, bowl:1.35, couch:1.50,
 /* line props: blockLine capsule radius */
 stick:.35, pencil:.32, fork:.15, rake:.40, shovel:.45, rack:1.10
};
/* collision radius for one placed prop: the table when it has an opinion, the
   call-site radius otherwise, scaled the same way the art is */
function propBlkR(t,r,sc){const b=PROP_BLK[t];return (b==null?r:b)*(sc||1)}
/* v103 ART radius, read back out of the SAME table rather than measured twice.
   PROP_BLK's own header says every entry is 0.85x the sprite radius the type was
   baked at, and that 0 means "art smaller than a unit's own radius" - so the two
   constants below are that header restated as numbers, and the art can never
   drift from the collision it was derived from.
   propBlkR answers "what does this take away"; propArtR answers "how much ground
   does this COVER". Placement asks the second one: a bookshelf blocks .70 of a
   tile and is drawn over .82, which is how a neutral barricade ended up standing
   inside one. */
const PROP_ART_K=0.85;    // PROP_BLK entry / this = the measured sprite radius
const PROP_ART_MIN=0.45;  // what a 0 entry means: about one unit's own radius
function propArtR(t,r,sc){const b=propBlkR(t,r,sc);return b>0?b/PROP_ART_K:PROP_ART_MIN*(sc||1)}
