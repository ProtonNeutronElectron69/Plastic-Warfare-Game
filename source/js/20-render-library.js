/* ===================== DRAWING - PLASTIC RENDER LIBRARY =====================
   A small toy-styrene "shader" kit. Everything is lit from the
   upper-left by a single hard key light, so every rounded form
   shares the same highlight placement and the scene reads as a
   bin of glossy injection-molded toys rather than flat sprites.
   ------------------------------------------------------------
   LIGHT = unit vector toward the key light (screen space)        */
const LIGHT={x:-0.46,y:-0.66}; // up & to the left
/* hex -> {r,g,b} */
function hx2rgb(hex){const n=parseInt(hex.slice(1),16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255}}
function rgb(r,g,b){return`rgb(${r|0},${g|0},${b|0})`}
function rgba(r,g,b,a){return`rgba(${r|0},${g|0},${b|0},${a})`}
/* --- THE DRAG BOX WEARS YOUR ARMY'S COLOUR, ADDED AT v87.1 ---
   Read off FAC at the point of use, lifted so the two darker armies still
   read against terrain. A watch match has no human player, so the old
   yellow stays as the spectator's fallback. */
const DRAG_BOX_LIFT=1.3, DRAG_BOX_NEUTRAL={r:255,g:236,b:110};
function dragBoxCol(){return G.human?hx2rgb(shade(FAC[G.human.fac].color,DRAG_BOX_LIFT)):DRAG_BOX_NEUTRAL}
/* mix two rgb objects */
function mixc(a,b,t){return{r:a.r+(b.r-a.r)*t,g:a.g+(b.g-a.g)*t,b:a.b+(b.b-a.b)*t}}
const WHITE={r:255,g:255,b:255},BLACK={r:0,g:0,b:0};
/* a cool shadow tint for ambient occlusion / undersides (greenish-slate) */
const AMB={r:26,g:34,b:24};

/* soft contact shadow that grounds a form to the playmat. Now slightly offset
   away from the key light (down-right) with a darker contact core, so forms read
   as physically sitting on the surface rather than floating. */
function plShadow(c,x,y,rx,ry,a){a=a||.34;
 if(BAKING)return;
 const ox=-LIGHT.x*rx*.22, oy=-LIGHT.y*ry*.22+ry*.12; // push shadow opposite the light
 c.save();
 // broad soft penumbra
 const g=c.createRadialGradient(x+ox,y+oy,0.5,x+ox,y+oy,rx*1.12);
 g.addColorStop(0,'rgba(12,20,10,'+a+')');g.addColorStop(.55,'rgba(12,20,10,'+a*.5+')');g.addColorStop(1,'rgba(12,20,10,0)');
 c.fillStyle=g;c.beginPath();c.ellipse(x+ox,y+oy,rx*1.12,ry*1.12,0,0,7);c.fill();
 // tight dark contact core right under the form
 const cg=c.createRadialGradient(x,y,0.5,x,y,rx*.5);
 cg.addColorStop(0,'rgba(8,14,7,'+Math.min(.5,a*1.2)+')');cg.addColorStop(1,'rgba(8,14,7,0)');
 c.fillStyle=cg;c.beginPath();c.ellipse(x,y,rx*.5,ry*.55,0,0,7);c.fill();
 c.restore();
}

/* glossy specular streak — the signature "wet toy plastic" highlight.
   A small, sharp, elongated white blob placed on the lit shoulder. */
function gloss(c,x,y,rx,ry){
 c.save();c.globalCompositeOperation='lighter';
 const g=c.createRadialGradient(x,y,0,x,y,Math.max(rx,ry)*1.6);
 g.addColorStop(0,'rgba(255,255,255,.85)');g.addColorStop(.35,'rgba(255,255,255,.32)');g.addColorStop(1,'rgba(255,255,255,0)');
 c.fillStyle=g;c.translate(x,y);c.rotate(-.7);c.beginPath();c.ellipse(0,0,rx*1.5,ry*1.5,0,0,7);c.fill();
 c.restore();
}
/* tiny crisp pinpoint glint for the very brightest spot */
function glint(c,x,y,r){c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.95)';c.beginPath();c.ellipse(x,y,r,r*.7,-.6,0,7);c.fill();c.restore();}

/* warm translucent rim along the SHADOW edge — toy plastic is slightly
   see-through so light bleeds around the dark side as a colored glow */
function plRim(c,base,x,y,rx,ry){
 const lit=mixc(base,WHITE,.55);
 c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.34;
 c.strokeStyle=rgb(lit.r,lit.g,lit.b);c.lineWidth=Math.max(1.1,Math.min(rx,ry)*.16);
 c.beginPath();c.ellipse(x,y,rx*.96,ry*.96,0,Math.PI*.15,Math.PI*1.05);c.stroke();
 c.restore();c.globalAlpha=1;
}

/* ---- core primitive: a molded plastic SPHERE / dome / bead ----
   col = hex body color. Renders saturated body, dark lower-right,
   bright lit shoulder, glossy spec, subsurface rim & a faint seam. */
function plSphere(c,col,x,y,r,sq,seam){
 sq=sq==null?1:sq; const b=hx2rgb(col);
 const body=b, dark=mixc(b,AMB,.62), deep=mixc(b,BLACK,.34), litc=mixc(b,WHITE,.42);
 // base body radial, light from upper-left
 const g=c.createRadialGradient(x+LIGHT.x*r*.5,y+LIGHT.y*r*.5,r*.05,x-LIGHT.x*r*.3,y-LIGHT.y*r*.3,r*1.15);
 g.addColorStop(0,rgb(litc.r,litc.g,litc.b));
 g.addColorStop(.34,rgb(mixc(b,WHITE,.12).r,mixc(b,WHITE,.12).g,mixc(b,WHITE,.12).b));
 g.addColorStop(.7,rgb(body.r,body.g,body.b));
 g.addColorStop(1,rgb(deep.r,deep.g,deep.b));
 c.fillStyle=g;c.beginPath();c.ellipse(x,y,r,r*sq,0,0,7);c.fill();
 // ambient-occluded underside crescent
 c.save();c.globalAlpha=.5;c.fillStyle=rgb(dark.r,dark.g,dark.b);
 c.beginPath();c.ellipse(x-LIGHT.x*r*.34,y-LIGHT.y*r*.34+r*sq*.12,r*.84,r*sq*.6,0,Math.PI*.1,Math.PI*.95);c.fill();c.restore();
 // subsurface rim
 plRim(c,col,x,y,r,r*sq);
 // injection seam (faint vertical mold line)
 if(seam){c.save();c.globalAlpha=.16;c.strokeStyle=rgb(deep.r,deep.g,deep.b);c.lineWidth=.7;c.beginPath();c.moveTo(x,y-r*sq*.86);c.lineTo(x,y+r*sq*.86);c.stroke();c.restore();}
 // glossy spec on the lit shoulder
 gloss(c,x+LIGHT.x*r*.5,y+LIGHT.y*r*.55,r*.3,r*sq*.24);
 glint(c,x+LIGHT.x*r*.52,y+LIGHT.y*r*.6,r*.1);
}

/* ---- core primitive: a molded plastic rounded PANEL / box face ----
   lit top-left, AO bottom-right, gloss band, rim. drop-in for old box() */
function box(c,col,dk,lt,x,y,w,h,r){
 const b=hx2rgb(col);
 const litc=mixc(b,WHITE,.40),deep=mixc(b,AMB,.55),mid=b;
 const g=c.createLinearGradient(x,y,x+w*.4,y+h);
 g.addColorStop(0,rgb(litc.r,litc.g,litc.b));
 g.addColorStop(.42,rgb(mid.r,mid.g,mid.b));
 g.addColorStop(1,rgb(deep.r,deep.g,deep.b));
 c.fillStyle=g;rr(c,x,y,w,h,r);c.fill();
 c.save();rr(c,x,y,w,h,r);c.clip();
 // top satin band
 const tg=c.createLinearGradient(x,y,x,y+h*.5);tg.addColorStop(0,'rgba(255,255,255,.3)');tg.addColorStop(1,'rgba(255,255,255,0)');
 c.fillStyle=tg;c.fillRect(x,y,w,h*.5);
 // right + bottom AO
 const dg=c.createLinearGradient(x+w*.5,y,x+w,y+h*.2);dg.addColorStop(0,'rgba(0,0,0,0)');dg.addColorStop(1,rgba(AMB.r,AMB.g,AMB.b,.4));
 c.fillStyle=dg;c.fillRect(x+w*.5,y,w*.5,h);
 const bg=c.createLinearGradient(x,y+h*.5,x,y+h);bg.addColorStop(0,'rgba(0,0,0,0)');bg.addColorStop(1,rgba(AMB.r,AMB.g,AMB.b,.5));
 c.fillStyle=bg;c.fillRect(x,y+h*.5,w,h*.5);
 c.restore();
 // crisp lit top-left edge
 c.strokeStyle=rgba(litc.r,litc.g,litc.b,.7);c.lineWidth=1.4;
 c.beginPath();c.moveTo(x+r,y+.7);c.lineTo(x+w-r,y+.7);c.stroke();
 c.beginPath();c.moveTo(x+.7,y+r);c.lineTo(x+.7,y+h-r);c.stroke();
 plRim(c,col,x+w/2,y+h*.5,w*.5,h*.5);
 gloss(c,x+w*.24,y+h*.2,w*.12,h*.08);
}
/* a thick 3D plastic SLAB with an extruded south/east face — sells real height */
function slab(c,col,x,y,w,h,depth,r){
 const b=hx2rgb(col),side=mixc(b,AMB,.5),sidd=mixc(b,BLACK,.3);
 // south/east extruded sides
 c.fillStyle=rgb(side.r,side.g,side.b);
 rr(c,x,y+depth*.0,w,h,r);// placeholder to keep path clean
 c.beginPath();c.moveTo(x+r,y+h);c.lineTo(x+w-r,y+h);c.quadraticCurveTo(x+w,y+h,x+w,y+h-r);c.lineTo(x+w,y+h-r+depth);c.quadraticCurveTo(x+w,y+h+depth,x+w-r,y+h+depth);c.lineTo(x+r,y+h+depth);c.quadraticCurveTo(x,y+h+depth,x,y+h-r+depth);c.lineTo(x,y+h-r);c.quadraticCurveTo(x,y+h,x+r,y+h);c.closePath();
 const sg=c.createLinearGradient(x,y+h,x,y+h+depth);sg.addColorStop(0,rgb(side.r,side.g,side.b));sg.addColorStop(1,rgb(sidd.r,sidd.g,sidd.b));c.fillStyle=sg;c.fill();
 // top face
 box(c,col,0,0,x,y,w,h,r);
}

/* injection-molded toy figure base disc (the oval all army men stand on) */
function moldBase(c,col,rx,ry){
 const b=hx2rgb(col),litc=mixc(b,WHITE,.34),deep=mixc(b,AMB,.5);
 plShadow(c,0,ry*.5,rx*1.5,ry*1.1,.3);
 const g=c.createRadialGradient(LIGHT.x*rx*.4,LIGHT.y*ry+.5,1,0,0,rx);
 g.addColorStop(0,rgb(litc.r,litc.g,litc.b));g.addColorStop(.7,rgb(b.r,b.g,b.b));g.addColorStop(1,rgb(deep.r,deep.g,deep.b));
 c.fillStyle=g;c.beginPath();c.ellipse(0,1.5,rx,ry,0,0,7);c.fill();
 // recessed inner step
 c.fillStyle=rgb(deep.r,deep.g,deep.b);c.beginPath();c.ellipse(0,2,rx*.78,ry*.74,0,0,7);c.fill();
 const ig=c.createRadialGradient(LIGHT.x*rx*.3,1+LIGHT.y*ry*.4,1,0,1.5,rx*.72);
 ig.addColorStop(0,rgb(mixc(b,WHITE,.18).r,mixc(b,WHITE,.18).g,mixc(b,WHITE,.18).b));ig.addColorStop(1,rgb(b.r,b.g,b.b));
 c.fillStyle=ig;c.beginPath();c.ellipse(0,1.6,rx*.7,ry*.66,0,0,7);c.fill();
 c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.28)';c.lineWidth=1;c.beginPath();c.ellipse(0,1,rx*.92,ry*.9,0,Math.PI*.1,Math.PI*1.0);c.stroke();c.restore();
}

/* a smooth lit cylinder/limb along a stroke, used for arms/legs/barrels */
function plLimb(c,col,x1,y1,x2,y2,wd){
 const b=hx2rgb(col),litc=mixc(b,WHITE,.4),deep=mixc(b,AMB,.5);
 const ang=Math.atan2(y2-y1,x2-x1),nx=Math.cos(ang+Math.PI/2),ny=Math.sin(ang+Math.PI/2);
 const g=c.createLinearGradient(x1+nx*wd*.5,y1+ny*wd*.5,x1-nx*wd*.5,y1-ny*wd*.5);
 // shift lit side toward upper-left
 const lt=(nx*LIGHT.x+ny*LIGHT.y)>0;
 g.addColorStop(0,rgb((lt?litc:deep).r,(lt?litc:deep).g,(lt?litc:deep).b));
 g.addColorStop(.5,rgb(b.r,b.g,b.b));
 g.addColorStop(1,rgb((lt?deep:litc).r,(lt?deep:litc).g,(lt?deep:litc).b));
 c.strokeStyle=g;c.lineWidth=wd;c.lineCap='round';c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
}

function screenAng(worldAng){const fx=Math.cos(worldAng),fy=Math.sin(worldAng);return Math.atan2((fx+fy)/2,fx-fy)}
function drawHP(c,x,y,f){c.fillStyle='rgba(0,0,0,.55)';rr(c,x-12,y-1,24,5,2.5);c.fill();c.fillStyle=f>.5?'#7be85f':f>.25?'#ffd24d':'#ff5e4d';rr(c,x-10.6,y+.2,21.2*clamp(f,0,1),2.6,1.3);c.fill();c.fillStyle='rgba(255,255,255,.4)';rr(c,x-10.6,y+.2,21.2*clamp(f,0,1),1,1);c.fill();}
// v29: gold veterancy chevrons stacked above the health-bar anchor
function drawChevrons(c,x,y,r){
 c.save();c.strokeStyle='#ffd24d';c.lineWidth=1.7;c.lineCap='round';
 for(let i=0;i<r;i++){const yy=y-i*3.6;c.beginPath();c.moveTo(x-4.2,yy);c.lineTo(x,yy-2.8);c.lineTo(x+4.2,yy);c.stroke();}
 c.restore();
}
// v29: small "pause bars" badge marking a unit on hold-position
function drawHoldBadge(c,x,y){
 c.save();c.fillStyle='rgba(18,28,42,.85)';rr(c,x-5.5,y-5,11,10,2.5);c.fill();
 c.strokeStyle='#7fb2e8';c.lineWidth=1.5;c.lineCap='round';
 c.beginPath();c.moveTo(x-1.8,y-2);c.lineTo(x-1.8,y+2.2);c.moveTo(x+2,y-2);c.lineTo(x+2,y+2.2);c.stroke();
 c.restore();
}

/* glossy black rubber toy wheels */
function toyWheel(c,x,y,rw,rh){
 c.fillStyle='#15151a';c.beginPath();c.ellipse(x,y,rw,rh,0,0,7);c.fill();
 c.fillStyle='#2a2a30';c.beginPath();c.ellipse(x,y,rw*.92,rh*.86,0,0,7);c.fill();
 c.fillStyle='#48484f';c.beginPath();c.ellipse(x,y,rw*.42,rh*.42,0,0,7);c.fill();
 c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.4)';c.beginPath();c.ellipse(x-rw*.3,y-rh*.4,rw*.3,rh*.22,-.5,0,7);c.fill();c.restore();
}
function wheel4(c,x,y){for(const w of[[-x,-y],[x,-y],[-x,y],[x,y]])toyWheel(c,w[0],w[1],2.9,2);}
function wheel6(c){for(const wx of[-8,0,8])for(const wy of[-6.6,6.6])toyWheel(c,wx,wy,3,2);}
function armsToGun(c,col,ang){plLimb(c,col,-3.2,-13,Math.cos(ang)*2.5,-10.5+Math.sin(ang)*1.2,2.8);plLimb(c,col,3.2,-13,Math.cos(ang)*5.5,-10.5+Math.sin(ang)*2.6,2.8);}

/* ===================== SPRITE BAKE PIPELINE =====================
   Units, vehicles and buildings are painted once at load into supersampled
   sprite cells, run through a molded-plastic enrichment pass (edge rim light,
   saturation/contrast pop), and blitted at runtime. Weapons, turrets, rotors,
   beacons and other animated parts stay live so continuous aim survives. */
let BAKING=false;
const SS=4; // bake supersample. v97: 3 covered max zoom (2.4) only at 1:1 pixels; with RDPR the frame renders at zoom*RDPR device px, so 4 keeps sprites crisp up to ~1.7 DPR at full zoom. The texture pipeline renders at RS=2*SS and must match (tools/material_v95.py).
const SPR={inf:{},veh:{},bld:{},barr:{},done:false};
const VEH_BOX={truck:[-18,-14,18,14],medic:[-18,-14,18,14],jeep:[-15,-13,15,13],bike:[-12,-9,12,9],
 tank:[-16,-13,16,13],bulltank:[-22,-17,22,17],aatruck:[-18,-13,18,13],arty:[-16,-13,17,13],heli:[-28,-11,16,11],chinook:[-38,-16,24,16],apache:[-32,-13,18,13],apc:[-20,-14,20,14],
 cmdtruck:[-20,-30,20,15],balloon:[-26,-52,26,20],
 firebomb:[-34,-15,20,15], // v87: wider than the Huey's box - the belly racks hang outside the hull // v86: both boxes are TALL - the Command Truck's aerials stand well above the cab and the balloon is mostly envelope
 choktaw:[-33,-16,18,16]}; // v95: it had NO entry, so it baked in the 48-wide default and its tail boom (painted to x=-31.3) was clipped off every sprite since v88
/* v96.1: the walls joined the texture pass (owner feedback - they were the one
   baked-table hole left). drawBarricade's own measured extents plus margin;
   the heavy wall is broader and taller than the plain one on purpose. */
const BARR_BOX={barricade:[-14,-17,14,13],hbarricade:[-19,-23,19,16]};
const BLD_BOX={hq:[-102,-80,102,86],barracks:[-70,-52,70,62],lab:[-70,-48,70,62],garage:[-102,-64,102,86],
 supply:[-68,-54,68,62],
 helipad:[-102,-30,102,86],generator:[-70,-34,70,62],turbine:[-38,-54,38,36],guardtower:[-38,-66,38,36],
 radar:[-70,-44,70,62],radiotower:[-70,-78,70,62],dump:[-70,-38,70,62],bunker:[-70,-34,70,62],outpost:[-70,-40,70,62],
 cmdpost:[-70,-56,70,62],foundry:[-70,-58,70,62]};
function bakeCell(x0,y0,x1,y1,paint){
 const w=x1-x0,h=y1-y0;
 const cv=document.createElement('canvas');cv.width=Math.ceil(w*SS);cv.height=Math.ceil(h*SS);
 const c=cv.getContext('2d');c.scale(SS,SS);c.translate(-x0,-y0);
 BAKING=true;try{c.save();paint(c);c.restore();}finally{BAKING=false;}
 enrichCell(cv);
 return {cv,sil:silOf(cv,w,h),ax:-x0,ay:-y0,w,h};
}
/* image-space molded-plastic pass: crisp rim light along the lit silhouette
   edge, darkened shadow edge, mild saturation & contrast pop */
function enrichCell(cv){
 let c,id;try{c=cv.getContext('2d');c.setTransform(1,0,0,1,0,0);id=c.getImageData(0,0,cv.width,cv.height);}catch(e){return;}
 const d=id.data,W=cv.width,H=cv.height,off=Math.max(2,Math.round(1.1*SS));
 const al=(x,y)=>(x<0||y<0||x>=W||y>=H)?0:d[((y*W+x)<<2)+3];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)<<2,a=d[i+3];if(a<40)continue;
  let r=d[i],g=d[i+1],bl=d[i+2];
  if(al(x-off,y-off)<40){r+=64;g+=64;bl+=56;}
  else if(al(x+off,y+off)<40){r*=.75;g*=.77;bl*=.81;}
  const l=(r+g+bl)/3;
  r=l+(r-l)*1.15;g=l+(g-l)*1.15;bl=l+(bl-l)*1.15;
  r=(r-128)*1.05+131;g=(g-128)*1.05+131;bl=(bl-128)*1.05+130;
  d[i]=r<0?0:r>255?255:r;d[i+1]=g<0?0:g>255?255:g;d[i+2]=bl<0?0:bl>255?255:bl;
 }
 c.putImageData(id,0,0);
}
/* soft black silhouette at logical resolution, used by the cast-shadow pass */
function silOf(cv,w,h){
 const s=document.createElement('canvas');s.width=Math.max(1,Math.ceil(w));s.height=Math.max(1,Math.ceil(h));
 const c=s.getContext('2d');
 try{c.filter='blur(1px)';}catch(e){}
 c.drawImage(cv,0,0,s.width,s.height);
 try{c.filter='none';}catch(e){}
 c.globalCompositeOperation='source-in';c.fillStyle='#0b140a';c.fillRect(0,0,s.width,s.height);
 return s;
}
/* v95: a loaded texture becomes a cell of exactly the shape bakeCell returns,
   so every consumer downstream - the draw sites, the shadow pass, the
   portraits - cannot tell the two apart. No enrichCell: the offline material
   pass bakes the same finish (same rim/shadow offsets, same sat/contrast
   numbers) into the file. The png must be the box at SS supersample. */
function cellFromImg(im,x0,y0,x1,y1){
 const w=x1-x0,h=y1-y0;
 const cv=document.createElement('canvas');cv.width=Math.ceil(w*SS);cv.height=Math.ceil(h*SS);
 cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);
 return {cv,sil:silOf(cv,w,h),ax:-x0,ay:-y0,w,h};
}
/* v96: the normal-map companion of a textured cell, as a canvas the band
   pass can blit beside the color. Same box, same supersample; alpha is
   coverage, RGB encodes which way each pixel's surface faces (x right,
   y down, z out, n*0.5+0.5). No silhouette, no enrich - it is data for
   the lighting shader, not a picture. Missing map = the cell lights FLAT,
   which is pixel-for-pixel the v95 look. */
function nrmFromImg(im,cell){
 const cv=document.createElement('canvas');cv.width=cell.cv.width;cv.height=cell.cv.height;
 cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);
 return cv;
}
/* v96: a vehicle's hull rotates continuously, and canvas rotation turns the
   normal map's pixel POSITIONS but not the direction VALUES stored in them -
   a tank facing south would still claim its deck faces the northern light.
   So the band pass draws, inside the exactly-rotated context, a variant
   whose stored vectors were pre-rotated to one of 16 headings; positions
   land exact, directions land within 11.25 degrees, which is invisible in
   shading. Variants are built lazily and cached on the cell - client-local
   scratch, like every canvas here. */
const NROT_STEPS=16;
function nrmRot(cell,ang){
 const step=((Math.round(ang/(Math.PI*2/NROT_STEPS))%NROT_STEPS)+NROT_STEPS)%NROT_STEPS;
 if(!cell._nr)cell._nr=[];
 if(cell._nr[step])return cell._nr[step];
 if(step===0)return cell._nr[0]=cell.nrm;
 const src=cell.nrm,w=src.width,h=src.height;
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;
 const c=cv.getContext('2d');
 let id;
 try{
  c.drawImage(src,0,0);
  id=c.getImageData(0,0,w,h);
 }catch(e){return cell._nr[step]=src;}
 const d=id.data,a=step*Math.PI*2/NROT_STEPS,ca=Math.cos(a),sa=Math.sin(a);
 for(let i=0;i<d.length;i+=4){
  if(d[i+3]<10)continue;
  const x=d[i]/127.5-1,y=d[i+1]/127.5-1;
  d[i]=Math.max(0,Math.min(255,(x*ca-y*sa+1)*127.5));
  d[i+1]=Math.max(0,Math.min(255,(x*sa+y*ca+1)*127.5));
 }
 c.putImageData(id,0,0);
 return cell._nr[step]=cv;
}
/* v95: the field manual can bake from the main menu before the page-open
   asset load resolves; if that happened, re-bake once the textures are in.
   Client-local, render-only - two players may legitimately re-bake at
   different wall times, or never. */
function rebakeIfAssetsLate(){
 if(SPR.done&&!SPR.assets&&Object.keys(ASSETS.img).length){
  SPR.done=false;SPR.inf={};SPR.veh={};SPR.bld={};SPR.barr={};bakeSprites();
 }
}
function blitVeh(c,key,fac){
 const cell=SPR.done&&SPR.veh[key]&&SPR.veh[key][fac];
 if(!cell)return false;
 c.drawImage(cell.cv,-cell.ax,-cell.ay,cell.w,cell.h);
 /* v96: mirror the blit into the normal band under the SAME transform, read
    straight off the color context - rotation included, which is what picks
    the pre-rotated variant (see nrmRot). NCTX is non-null only while the
    band pass runs with a live GL lighting stage. */
 if(NCTX&&cell.nrm){
  const m=c.getTransform();
  NCTX.setTransform(m);
  NCTX.drawImage(nrmRot(cell,Math.atan2(m.b,m.a)),-cell.ax,-cell.ay,cell.w,cell.h);
 }
 return true;
}
function bakeSprites(){
 if(SPR.done)return;
 SPR.hasNrm=false; // v96: set below if any texture brings its normal map; bandLit() reads it
 const facs=Object.keys(FAC).filter(f=>f!=='bug');
 for(const key in U){
  if(U[key].a==='inf'){
   SPR.inf[key]={};
   for(const f of facs){const col=FAC[f].color;SPR.inf[key][f]=[];
    for(let i=0;i<5;i++){const bob=i*.5-1;
     const id='inf_'+key+'_'+f+'_'+i,im=imgAsset(id); // v95: texture overrides, painter falls back
     const cell=im?cellFromImg(im,-22,-31,22,10):bakeCell(-22,-31,22,10,cc=>trooperBody(cc,key,col,bob));
     const nm=im&&imgAsset('nrm_'+id);if(nm){cell.nrm=nrmFromImg(nm,cell);SPR.hasNrm=true} // v96: relief for the lighting shader
     SPR.inf[key][f].push(cell);}}
  } else {
   const bx=VEH_BOX[key]||[-24,-16,24,16];SPR.veh[key]={};
   for(const f of facs){
    const id='veh_'+key+'_'+f,im=imgAsset(id);
    const cell=im?cellFromImg(im,bx[0],bx[1],bx[2],bx[3]):bakeCell(bx[0],bx[1],bx[2],bx[3],cc=>vehBody(cc,key,FAC[f].color));
    const nm=im&&imgAsset('nrm_'+id);if(nm){cell.nrm=nrmFromImg(nm,cell);SPR.hasNrm=true}
    SPR.veh[key][f]=cell;
   }
  }
 }
 for(const k in B){
  if(B[k].barr){
   /* v96.1: the walls take a texture cell now (owner feedback) - but ONLY a
      texture: there is no procedural bake behind them, because drawBarricade
      itself is the fallback, exactly as it has painted since v88. A shared
      wall also exists NEUTRAL on maps, so that is a fifth colour. */
   SPR.barr[k]={};
   for(const f of facs.concat('neutral')){
    const id='bld_'+k+'_'+f,im=imgAsset(id);
    if(!im)continue;
    const bx=BARR_BOX[k],cell=cellFromImg(im,bx[0],bx[1],bx[2],bx[3]);
    const nm=imgAsset('nrm_'+id);if(nm){cell.nrm=nrmFromImg(nm,cell);SPR.hasNrm=true}
    SPR.barr[k][f]=cell;
   }
   continue;
  }
  const sz=B[k].sz,S=sz*HW,HD=sz*HH;
  const box=BLD_BOX[k]||[-S-10,-Math.max(70,S*1.2),S+10,HD*1.58+8];
  SPR.bld[k]={};
  for(const f of facs){
   const id='bld_'+k+'_'+f,im=imgAsset(id);
   const cell=im?cellFromImg(im,box[0],box[1],box[2],box[3]):bakeCell(box[0],box[1],box[2],box[3],cc=>bldBody(cc,k,FAC[f].color,sz));
   const nm=im&&imgAsset('nrm_'+id);if(nm){cell.nrm=nrmFromImg(nm,cell);SPR.hasNrm=true}
   SPR.bld[k][f]=cell;
  }
 }
 SPR.assets=assetsReady(); // v95: lets rebakeIfAssetsLate spot a bake that ran too early
 SPR.done=true;
}
/* bake box per prop type (local coords); rotated long props get a square box */
function propBox(p){
 const t=p.t,r=p.r||1,L=(p.len||1)*HW*.95+22;
 const B={hose:[-72,-24,72,16],pot:[-60,-86,60,18],marble:[-22,-34,22,10],rock:[-44,-34,44,14],
  mushroom:[-16*r-10,-26*r-8,16*r+10,10],can:[-20,-64,20,10],sugar:[-18,-30,18,12],
  bowl:[-74,-42,74,16],wall:[-30,-30,30,12],bucket:[-56,-68,56,14],star:[-32,-28,32,10],
  dino:[-36,-42,36,12],tower:[-64,-96,64,18],
  soccer:[-30,-48,30,14],gnome:[-22,-62,22,12],wcan:[-48,-56,48,14],snail:[-20,-22,20,10],
  plate:[-28,-26,28,10],mug:[-24,-46,30,10],salt:[-14,-44,14,10],toaster:[-36,-52,36,12],
  beachball:[-30,-52,30,14],dumptruck:[-46,-46,46,14],keep:[-70,-118,70,20],slipper:[-34,-22,34,12],
  remote:[-26,-18,26,12],books:[-34,-42,34,12],traincar:[-40,-44,40,14],
  keyboard:[-42,-28,42,16],chips:[-26,-44,26,16],eraser:[-16,-18,16,10]}; // v35
 const S=p.sc||1; // v36: per-prop uniform scale (Desk clutter); byte-identical when unset
 if(B[t])return S!==1?B[t].map(v=>v*S):B[t];
 if(t==='stick'||t==='pencil'||t==='fork'||t==='spoon'||t==='shovel'||t==='rake'||t==='rack')return [-L*S,-L*S,L*S,L*S];
 return null;
}
/* bake (or re-bake) one node cell for its current amount bucket */
function bakeNode(n,f){
 const q=(n.wreck?'w':n.t==='plastic'?'p':'b')+Math.ceil(f*5);
 if(n._q===q)return;
 n._q=q;
 const bx=n.wreck?[-34,-34,34,16]:(n.t==='plastic'?[-48,-74,48,22]:[-18,-58,18,10]);
 n._spr=bakeCell(bx[0],bx[1],bx[2],bx[3],cc=>nodeBody(cc,n,f));
}
/* per-map bakes: props and wildlife nests are static for the whole match */
function bakeMapSprites(){
 for(const p of (G.map.props||[])){
  const bx=propBox(p);
  p._spr=bx?bakeCell(bx[0],bx[1],bx[2],bx[3],cc=>propBody(cc,p)):null;
 }
 for(const ns of (G.map.nests||[])){
  const bx=ns.species==='ant'?[-24,-28,24,18]:ns.species==='roach'?[-22,-24,22,16]:[-18,-40,18,18]; // v66: roach den box
  ns._spr=bakeCell(bx[0],bx[1],bx[2],bx[3],cc=>nestBody(cc,ns));
 }
 // pre-bake every node at its starting amount so first sight never hitches;
 // later re-bakes happen one node at a time as piles shrink through fifths
 for(const n of (G.map.nodes||[]))bakeNode(n,clamp(n.amt/n.max,0,1));
}

/* ---- VEHICLE HULL PAINTER ----
   Static parts only; baked into sprite cells.
   Drawn in the vehicle's unrotated local frame; heading rotation and all
   animated bits (beacons, cargo, turrets, rotors) stay live. ---- */
function vehBody(c,key,col){
 const b=hx2rgb(col),dk=shade(col,.62),lt=shade(col,1.32);
 const deep=mixc(b,AMB,.55),litc=mixc(b,WHITE,.4);
 if(key==='medic'){

  // MEDIC TRUCK: a boxy ambulance — team-tinted cab, white medical box, red cross,
  // and a soft pulsing beacon on the roof.
  wheel6(c);
  c.fillStyle='#23232a';rr(c,-13,-5.5,26,11,2.5);c.fill();
  // cab (front), team colour
  box(c,col,dk,lt,6,-6.5,8.5,13,3);
  c.fillStyle='#bfe9ff';rr(c,11.2,-4.6,2.6,9,1);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.6)';rr(c,11.4,-4.2,1,3.4,.5);c.fill();c.restore();
  // white medical box body
  (function(){const g=c.createLinearGradient(-14,-8,-14,8);g.addColorStop(0,'#ffffff');g.addColorStop(.55,'#eef2ee');g.addColorStop(1,'#c8d0c8');c.fillStyle=g;rr(c,-14,-8,17,16,2.5);c.fill();})();
  c.fillStyle='rgba(70,80,70,.25)';rr(c,-13.4,2,15.6,5,2);c.fill();
  // red cross on the side of the box
  c.fillStyle='#d8352a';c.fillRect(-7.5,-2.4,5,1.8);c.fillRect(-5.6,-4.3,1.8,5.6);
  // team-colour stripe along the bottom of the box so the faction still reads
  c.fillStyle=rgb(b.r,b.g,b.b);rr(c,-14,6.2,17,1.8,1);c.fill();
  plRim(c,col,9,-2,5,6);
 }
 else if(key==='truck'){
  wheel6(c);
  // chassis
  c.fillStyle='#23232a';rr(c,-13,-5.5,26,11,2.5);c.fill();
  // cab (front)
  box(c,col,dk,lt,5,-7,9.5,14,3);
  c.fillStyle='#bfe9ff';rr(c,11.6,-5,2.6,9.6,1);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.6)';rr(c,11.8,-4.6,1,3.6,.5);c.fill();c.restore();
  // dump bed
  (function(){const g=c.createLinearGradient(-14,-8,-14,8);g.addColorStop(0,rgb(litc.r,litc.g,litc.b));g.addColorStop(.5,rgb(b.r,b.g,b.b));g.addColorStop(1,rgb(deep.r,deep.g,deep.b));c.fillStyle=g;rr(c,-14,-8,18,16,2.5);c.fill();})();
  c.fillStyle=rgba(AMB.r,AMB.g,AMB.b,.5);rr(c,-13,-1,16,8,2);c.fill();
  plRim(c,col,9,-2,5,6);
 }
 else if(key==='bike'){
toyWheel(c,-6.5,0,3.4,2.9);toyWheel(c,7,0,3.4,2.9);
   (function(){const g=c.createLinearGradient(0,-3,0,3);g.addColorStop(0,rgb(litc.r,litc.g,litc.b));g.addColorStop(.5,rgb(b.r,b.g,b.b));g.addColorStop(1,rgb(deep.r,deep.g,deep.b));c.fillStyle=g;rr(c,-5,-2.6,11,5.2,2.4);c.fill();})();
   plSphere(c,col,-.5,-1.4,2.6,1,false);plRim(c,col,0,-1,4.5,1.6); }
 else if(key==='jeep'){
  wheel4(c,7,6.8);
   (function(){const g=c.createLinearGradient(0,-7,0,7);g.addColorStop(0,rgb(litc.r,litc.g,litc.b));g.addColorStop(.5,rgb(b.r,b.g,b.b));g.addColorStop(1,rgb(deep.r,deep.g,deep.b));c.fillStyle=g;rr(c,-11,-6,23,12,3);c.fill();})();
   c.fillStyle=rgba(AMB.r,AMB.g,AMB.b,.4);rr(c,-10,1,21,5,2.5);c.fill();
   // seats well
   c.fillStyle=rgb(deep.r,deep.g,deep.b);rr(c,-6,-4,9,8,2);c.fill();
   // hood
   box(c,col,dk,lt,3,-5.2,8.6,10.4,2);
   // roll bar
   c.strokeStyle='#26262c';c.lineWidth=2.2;c.beginPath();c.moveTo(-2,-4);c.lineTo(-2,4);c.stroke();
   // mounted MG
   c.strokeStyle='#1f1f25';c.lineWidth=2.4;c.lineCap='round';c.beginPath();c.moveTo(-3,-1);c.lineTo(7,-1);c.stroke();
   plRim(c,col,0,-4,8,2);glint(c,-6,-4,.9);
  decalStar(c,7.4,-.2,2.3,'#f4f7fa');
 }
 else if(key==='tank'||key==='bulltank'||key==='arty'){
  const big=key==='bulltank';c.scale(big?1.34:1,big?1.34:1);

  // treads with molded links
  for(const ty of[-10,3.5]){c.fillStyle='#1b1b20';rr(c,-13,ty,26,6.5,3);c.fill();
   c.strokeStyle='#33333a';c.lineWidth=1;for(let i=-12;i<13;i+=3){c.beginPath();c.moveTo(i,ty+.5);c.lineTo(i,ty+6);c.stroke();}
   c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.08)';rr(c,-13,ty,26,1.6,3);c.fill();c.restore();}
  // hull
  (function(){const g=c.createLinearGradient(0,-6,0,6);g.addColorStop(0,rgb(litc.r,litc.g,litc.b));g.addColorStop(.5,rgb(b.r,b.g,b.b));g.addColorStop(1,rgb(deep.r,deep.g,deep.b));c.fillStyle=g;rr(c,-11.5,-6.5,22,13,3);c.fill();})();
  c.fillStyle=rgba(AMB.r,AMB.g,AMB.b,.4);rr(c,-11,2,22,4.5,2.5);c.fill();
  // glacis bevel
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.14)';c.beginPath();c.moveTo(-11,-6);c.lineTo(11,-6);c.lineTo(8,-3.5);c.lineTo(-8,-3.5);c.closePath();c.fill();c.restore();
  if(key==='arty'){

   // missile rack pod
   c.fillStyle=rgb(deep.r,deep.g,deep.b);rr(c,-8.5,-6.4,15.5,12.8,2);c.fill();
   for(let ix=0;ix<3;ix++)for(let iy=0;iy<2;iy++){c.fillStyle='#141416';c.beginPath();c.ellipse(-4+ix*4.8,-2.5+iy*5,2,1.8,0,0,7);c.fill();
    c.fillStyle='#ff7a3a';c.beginPath();c.ellipse(-4+ix*4.8,-2.5+iy*5,.8,.7,0,0,7);c.fill();
    c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.3)';c.beginPath();c.arc(-4.7+ix*4.8,-3.2+iy*5,.5,0,7);c.fill();c.restore();}
  } else decalStar(c,8.6,0,2.2,'#f4f7fa');
 }
 else if(key==='heli'||key==='apache'){
  const apa=key==='apache';const hs=apa?1.12:1;c.scale(hs,hs);

  // tail boom
  (function(){const tg=c.createLinearGradient(-22,0,-6,0);tg.addColorStop(0,rgb(deep.r,deep.g,deep.b));tg.addColorStop(1,rgb(b.r,b.g,b.b));c.fillStyle=tg;c.beginPath();c.moveTo(-6,-2.4);c.lineTo(-22,-1.1);c.lineTo(-22,1.1);c.lineTo(-6,2.4);c.closePath();c.fill();})();
  // tail fin
  c.fillStyle=rgb(deep.r,deep.g,deep.b);c.beginPath();c.moveTo(-22,-1);c.lineTo(-25,-5);c.lineTo(-22,1);c.closePath();c.fill();
  // body pod
  plSphere(c,col,0,0,11.5,.56,false);
  // belly AO
  c.fillStyle=rgba(AMB.r,AMB.g,AMB.b,.3);c.beginPath();c.ellipse(0,3,10,2.6,0,0,Math.PI);c.fill();
  // cockpit bubble
  (function(){const cp=c.createRadialGradient(5,-1.6,.5,6.2,0,5);cp.addColorStop(0,'#f2fbff');cp.addColorStop(.5,'#a8d8f0');cp.addColorStop(1,'#5a92b4');c.fillStyle=cp;c.beginPath();c.ellipse(6.4,0,4.8,4.2,0,-1.5,1.5);c.fill();})();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.6)';c.beginPath();c.ellipse(5.4,-1.6,1.4,1,-.5,0,7);c.fill();c.restore();
  if(apa){ // v30 Apache: stub wings carrying rocket pods
   c.fillStyle=rgb(deep.r,deep.g,deep.b);rr(c,-3,-8.6,7,2.2,1);c.fill();rr(c,-3,6.4,7,2.2,1);c.fill();
   c.fillStyle='#1f1f25';rr(c,2.2,-8.4,3.6,1.8,.8);c.fill();rr(c,2.2,6.6,3.6,1.8,.8);c.fill();
   c.fillStyle='#ff7a3a';c.beginPath();c.arc(5.8,-7.5,.6,0,7);c.fill();c.beginPath();c.arc(5.8,7.5,.6,0,7);c.fill();
  }
 }
 else if(key==='firebomb'){
  /* v87: a gunship hull carrying belly racks of firebombs. It has to be tellable
     from the Apache at a glance, which the racks and the fat cabin do: the Apache
     is a thin dart with rocket pods, this is a broad one with drums slung under
     it. The rotor, like every other helicopter's, is live-painted in drawUnit. */
  plLimb(c,shade(col,.72),-6,0,-27,-1,5);                                   // tail boom
  c.fillStyle=shade(col,.6);c.beginPath();c.moveTo(-25,-1);c.lineTo(-31,-9);c.lineTo(-28,0);c.closePath();c.fill(); // tail fin
  (function(){const g=c.createLinearGradient(-8,-9,8,9);
   g.addColorStop(0,rgb(litc.r,litc.g,litc.b));g.addColorStop(.55,rgb(b.r,b.g,b.b));g.addColorStop(1,rgb(deep.r,deep.g,deep.b));
   c.fillStyle=g;rr(c,-10,-8,25,16,6);c.fill();})();                         // fat cabin
  c.fillStyle='#bfe9ff';rr(c,8,-5.5,6,11,3);c.fill();                        // canopy
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.55)';rr(c,9,-4.6,2.2,4.4,1);c.fill();c.restore();
  // belly racks: two drums a side, painted in the incendiary's own orange
  c.fillStyle='#2b2b31';rr(c,-6,-11.6,16,2.4,1);c.fill();rr(c,-6,9.2,16,2.4,1);c.fill();
  for(const ry of [-13.4,10.6])for(const rx of [-3,4]){
   plSphere(c,'#c8621f',rx,ry,2.6,.72,false);
   c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,200,120,.5)';c.beginPath();c.ellipse(rx-.9,ry-.7,1,.7,0,0,7);c.fill();c.restore();
  }
  // skids
  c.strokeStyle='#3a3a42';c.lineWidth=1.6;
  c.beginPath();c.moveTo(-6,-9.8);c.lineTo(9,-9.8);c.moveTo(-6,9.8);c.lineTo(9,9.8);c.stroke();
  plRim(c,col,2,0,10,8);gloss(c,-2,-5,2.6,3.2);glint(c,10,-4,.9);
 }
 else if(key==='choktaw'){
  /* v88: it has to read as TWO weapons at a glance, because that is the whole of
     what the unit is - stub wings carrying the Apache's rocket pods, and a door
     gun poking out of the cabin on both sides. Broader in the shoulder than the
     Apache's thin dart and shorter in the boom than the Firebomb, so the three
     gunships are tellable apart at map zoom. The rotor, like every other
     helicopter's, is live-painted in drawUnit. */
  c.scale(1.08,1.08);
  plLimb(c,shade(col,.7),-7,0,-25,-1,4.6);                                    // tail boom
  c.fillStyle=shade(col,.58);c.beginPath();c.moveTo(-23,-1);c.lineTo(-29,-8);c.lineTo(-26,1);c.closePath();c.fill(); // tail fin
  (function(){const g=c.createLinearGradient(-9,-8,9,8);
   g.addColorStop(0,rgb(litc.r,litc.g,litc.b));g.addColorStop(.55,rgb(b.r,b.g,b.b));g.addColorStop(1,rgb(deep.r,deep.g,deep.b));
   c.fillStyle=g;rr(c,-9,-7.2,23,14.4,5.5);c.fill();})();                     // cabin
  c.fillStyle=rgba(AMB.r,AMB.g,AMB.b,.3);rr(c,-7,3.4,19,3.4,2);c.fill();      // belly AO
  (function(){const cp=c.createRadialGradient(9.4,-2,.5,10.4,0,5.4);
   cp.addColorStop(0,'#f2fbff');cp.addColorStop(.5,'#a8d8f0');cp.addColorStop(1,'#5a92b4');
   c.fillStyle=cp;c.beginPath();c.ellipse(10,0,4.4,5,0,0,7);c.fill();})();     // canopy
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.55)';
  c.beginPath();c.ellipse(8.8,-2.2,1.5,1.1,-.5,0,7);c.fill();c.restore();
  // STUB WINGS + ROCKET PODS, the Apache's hardpoints on a wider shoulder
  c.fillStyle=rgb(deep.r,deep.g,deep.b);rr(c,-4,-11.4,9,2.6,1.2);c.fill();rr(c,-4,8.8,9,2.6,1.2);c.fill();
  for(const wy of [-13.6,10.8]){
   c.fillStyle='#23232a';rr(c,0,wy,7.5,3.2,1.4);c.fill();
   for(let i=0;i<3;i++){c.fillStyle='#101014';c.beginPath();c.ellipse(1.4+i*2.3,wy+1.6,.9,.8,0,0,7);c.fill();
    c.fillStyle='#ff7a3a';c.beginPath();c.ellipse(1.4+i*2.3,wy+1.6,.4,.35,0,0,7);c.fill();}
  }
  // DOOR GUN, a stubby barrel out of each side of the cabin
  c.strokeStyle='#2e2e36';c.lineWidth=1.8;c.lineCap='round';
  c.beginPath();c.moveTo(1,-6.6);c.lineTo(4.5,-9.6);c.moveTo(1,6.6);c.lineTo(4.5,9.6);c.stroke();
  c.fillStyle='#4a4a54';c.beginPath();c.arc(4.6,-9.8,1.1,0,7);c.fill();c.beginPath();c.arc(4.6,9.8,1.1,0,7);c.fill();
  // skids
  c.strokeStyle='#3a3a42';c.lineWidth=1.5;
  c.beginPath();c.moveTo(-5,-8.6);c.lineTo(8,-8.6);c.moveTo(-5,8.6);c.lineTo(8,8.6);c.stroke();
  plRim(c,col,1.5,0,9.5,7.2);gloss(c,-1,-4.4,2.4,3);glint(c,11,-3.6,.9);
 }
 else if(key==='chinook'){ // v46: tandem-rotor troop transport - long slab hull, rear ramp, no weapon hardpoints
  c.scale(1.25,1.25);
  // rear loading ramp, dropped open off the tail
  c.fillStyle=rgb(deep.r,deep.g,deep.b);c.beginPath();c.moveTo(-19,-6.5);c.lineTo(-28,-4.6);c.lineTo(-28,4.6);c.lineTo(-19,6.5);c.closePath();c.fill();
  // fuselage
  (function(){const g=c.createLinearGradient(0,-9,0,9);g.addColorStop(0,rgb(litc.r,litc.g,litc.b));g.addColorStop(.5,rgb(b.r,b.g,b.b));g.addColorStop(1,rgb(deep.r,deep.g,deep.b));c.fillStyle=g;rr(c,-20,-9,38,18,5);c.fill();})();
  c.fillStyle=rgba(AMB.r,AMB.g,AMB.b,.34);rr(c,-18,4.2,34,4.4,2.4);c.fill();
  // cockpit glass in the nose
  (function(){const cp=c.createRadialGradient(14.6,-2,.5,15.6,0,6);cp.addColorStop(0,'#f2fbff');cp.addColorStop(.5,'#a8d8f0');cp.addColorStop(1,'#5a92b4');c.fillStyle=cp;c.beginPath();c.ellipse(15.2,0,4.2,5.4,0,0,7);c.fill();})();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.55)';c.beginPath();c.ellipse(14,-2.4,1.5,1.1,-.5,0,7);c.fill();c.restore();
  // rotor pylons, fore and aft - the tandem silhouette
  c.fillStyle=rgb(deep.r,deep.g,deep.b);rr(c,9.5,-4.5,7.5,9,2.5);c.fill();rr(c,-19.5,-5.5,9.5,11,3);c.fill();
  c.fillStyle=dk;rr(c,10.5,-2.5,5.5,5,2);c.fill();rr(c,-18,-3,6.5,6,2.4);c.fill();
  // sponsons down each flank + window strip
  c.fillStyle=rgb(deep.r,deep.g,deep.b);rr(c,-13,-11,20,3.2,1.6);c.fill();rr(c,-13,7.8,20,3.2,1.6);c.fill();
  c.fillStyle='#0e1a24';for(let i=0;i<4;i++){rr(c,-9+i*6,-7.4,3.4,1.8,.8);c.fill();rr(c,-9+i*6,5.6,3.4,1.8,.8);c.fill();}
  // hull seams
  c.strokeStyle='#26262c';c.lineWidth=1.1;c.beginPath();c.moveTo(-19,-9);c.lineTo(-19,9);c.moveTo(6,-9);c.lineTo(6,9);c.stroke();
  decalStar(c,1,0,2.4,'#f4f7fa');
 }
 else if(key==='aatruck'){ // v51: air-defence truck. HULL ONLY - the missile rack is live-painted by aaTurret so it can swivel independently
  // six road wheels, shifted forward to clear the launcher turntable
  for(const wx of[-9,-1,7])for(const wy of[-6.6,6.6])toyWheel(c,wx,wy,3,2);
  c.fillStyle='#23232a';rr(c,-15,-5.5,29,11,2.5);c.fill();
  // search radar on the left rear shoulder: the silhouette cue that reads as AA at any zoom
  c.fillStyle='#3a3a42';rr(c,-10.9,-9.4,0.9,3.6,.4);c.fill();
  c.fillStyle='#b9bec6';c.beginPath();c.ellipse(-10.5,-9.4,3.4,1.7,0,0,7);c.fill();
  c.fillStyle='#7d838c';c.beginPath();c.ellipse(-10.5,-9.4,1.9,0.9,0,0,7);c.fill();
  // turntable deck the rack sits on (the rack itself is drawn live, on top of this)
  c.fillStyle=rgb(deep.r,deep.g,deep.b);c.beginPath();c.ellipse(-3.5,0,6.2,5.4,0,0,7);c.fill();
  plRim(c,col,-3.5,0,6.2,.9);
  // cab
  box(c,col,dk,lt,6,-6.6,9,13.2,3);
  c.fillStyle='#bfe9ff';rr(c,12.6,-4.6,2.6,9.2,1);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.6)';rr(c,12.9,-4,1,3.4,.5);c.fill();c.restore();
  // team stripe along the chassis skirt
  c.fillStyle=rgb(b.r,b.g,b.b);rr(c,-15,4.2,29,1.8,.9);c.fill();
  decalStar(c,9.2,0,2,'#f4f7fa');
 }
 else if(key==='cmdtruck'){
  /* v86: a box-body radio lorry. The point of the silhouette is that it must not
     read as a Dump Truck at a glance: same six wheels, but a tall closed body with
     a map board on the flank, an aerial array standing over the roof and a small
     dish, so both of its abilities are things you can see coming the way the
     Signal Runner's set is. */
  wheel6(c);
  c.fillStyle='#23232a';rr(c,-13,-5.5,26,11,2.5);c.fill();
  box(c,col,dk,lt,6,-6.5,9,13,3);                                        // cab
  c.fillStyle='#bfe9ff';rr(c,12.2,-4.6,2.4,9.2,1);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.6)';rr(c,12.4,-4.2,1,3.4,.5);c.fill();c.restore();
  // closed signals body
  (function(){const g=c.createLinearGradient(-14,-9,-14,9);g.addColorStop(0,rgb(litc.r,litc.g,litc.b));g.addColorStop(.5,rgb(b.r,b.g,b.b));g.addColorStop(1,rgb(deep.r,deep.g,deep.b));c.fillStyle=g;rr(c,-15,-9,20,18,3);c.fill();})();
  c.fillStyle=rgba(AMB.r,AMB.g,AMB.b,.42);rr(c,-14,4,18,4,1.6);c.fill();  // shadowed skirt
  c.fillStyle='#2b2b33';rr(c,-12,-6.5,9,5.5,1.2);c.fill();                // map board bolted to the flank
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(180,230,255,.25)';rr(c,-11.4,-6,7.8,2,.8);c.fill();c.restore();
  // aerial array over the roof, plus the little dish that says "net"
  c.strokeStyle='#8d8d99';c.lineWidth=1.2;
  for(const ax of [-12,-7.5,-3]){c.beginPath();c.moveTo(ax,-9);c.lineTo(ax-1.4,-26);c.stroke();}
  c.fillStyle='#c8c8d2';for(const ax of [-13.4,-8.9,-4.4]){c.beginPath();c.arc(ax,-26,.9,0,7);c.fill();}
  c.save();c.translate(1.5,-11);c.rotate(-.5);
  (function(){const dg=c.createLinearGradient(-6,-4,5,4);dg.addColorStop(0,'#fafcff');dg.addColorStop(1,'#aeb6c0');c.fillStyle=dg;c.beginPath();c.ellipse(0,0,6.5,3.6,0,0,7);c.fill();})();
  c.fillStyle='#4a4e54';c.fillRect(-.6,0,1.2,4);c.restore();
  plRim(c,col,-5,-2,7,7);gloss(c,-9,-7,2.2,2.8);
 }
 else if(key==='balloon'){
  /* v86: envelope, rigging and basket. Drawn tall in the sprite's own frame and
     NOT rotated at the call site - a gas bag has no heading, and spinning one with
     its travel direction is the single thing that would make it read as a badly
     drawn aircraft rather than as a balloon. */
  const env=hx2rgb(col);
  (function(){const g=c.createRadialGradient(-7,-38,2,0,-32,22);
   g.addColorStop(0,rgb(mixc(env,WHITE,.55).r,mixc(env,WHITE,.55).g,mixc(env,WHITE,.55).b));
   g.addColorStop(.6,rgb(env.r,env.g,env.b));
   g.addColorStop(1,rgb(mixc(env,AMB,.5).r,mixc(env,AMB,.5).g,mixc(env,AMB,.5).b));
   c.fillStyle=g;c.beginPath();c.ellipse(0,-32,17,19,0,0,7);c.fill();})();
  // moulded seams down the envelope, and the pale gore between them
  c.save();c.globalAlpha=.35;c.strokeStyle=rgb(mixc(env,BLACK,.4).r,mixc(env,BLACK,.4).g,mixc(env,BLACK,.4).b);c.lineWidth=1.1;
  for(const sx of [-10,-3.5,3.5,10]){c.beginPath();c.moveTo(sx,-49);c.quadraticCurveTo(sx*1.5,-32,sx*.55,-14.5);c.stroke();}
  c.restore();
  plRim(c,col,0,-32,15,17);gloss(c,-7,-40,3.4,4.6);
  // nose cone and tail fins
  c.fillStyle=rgb(mixc(env,BLACK,.22).r,mixc(env,BLACK,.22).g,mixc(env,BLACK,.22).b);
  c.beginPath();c.ellipse(0,-13.6,7,3.2,0,0,7);c.fill();
  // rigging down to the basket
  c.strokeStyle='rgba(60,56,48,.85)';c.lineWidth=1;
  for(const rx of [-6,-2,2,6]){c.beginPath();c.moveTo(rx,-14);c.lineTo(rx*.62,-5.5);c.stroke();}
  // wicker basket
  c.fillStyle='#8a6a3c';rr(c,-5.4,-6,10.8,8,1.6);c.fill();
  c.save();c.globalAlpha=.4;c.strokeStyle='#5c4526';c.lineWidth=.9;
  for(const wy of [-4,-1.6,.8]){c.beginPath();c.moveTo(-5,wy);c.lineTo(5,wy);c.stroke();}
  c.restore();
  c.fillStyle=rgb(mixc(env,BLACK,.15).r,mixc(env,BLACK,.15).g,mixc(env,BLACK,.15).b);rr(c,-5.6,-6.6,11.2,1.8,.8);c.fill(); // painted coaming
  glint(c,-9,-42,1);
 }
 else if(key==='apc'){ // v30: boxy armored troop carrier on treads
  c.scale(1.25,1.25);
  for(const ty of[-10,4]){c.fillStyle='#1b1b20';rr(c,-13,ty,26,6,3);c.fill();
   c.strokeStyle='#33333a';c.lineWidth=1;for(let i=-12;i<13;i+=3){c.beginPath();c.moveTo(i,ty+.5);c.lineTo(i,ty+5.5);c.stroke();}
   c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.08)';rr(c,-13,ty,26,1.6,3);c.fill();c.restore();}
  (function(){const g=c.createLinearGradient(0,-8,0,8);g.addColorStop(0,rgb(litc.r,litc.g,litc.b));g.addColorStop(.5,rgb(b.r,b.g,b.b));g.addColorStop(1,rgb(deep.r,deep.g,deep.b));c.fillStyle=g;rr(c,-12,-8,24,16,3);c.fill();})();
  c.fillStyle=rgba(AMB.r,AMB.g,AMB.b,.4);rr(c,-11.5,3,23,4.5,2.5);c.fill();
  // sloped nose highlight
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.14)';c.beginPath();c.moveTo(8,-8);c.lineTo(12,-4);c.lineTo(12,4);c.lineTo(8,8);c.closePath();c.fill();c.restore();
  // twin roof hatches for the squad
  c.fillStyle=rgb(deep.r,deep.g,deep.b);c.beginPath();c.arc(-4,0,3,0,7);c.fill();c.beginPath();c.arc(4,0,3,0,7);c.fill();
  plRim(c,col,-4,0,3,1.2);plRim(c,col,4,0,3,1.2);
  // rear door seam
  c.strokeStyle='#26262c';c.lineWidth=1.2;c.beginPath();c.moveTo(-12,-5);c.lineTo(-12,5);c.stroke();
  decalStar(c,8,0,2.2,'#f4f7fa');
 }
}
/* ---- TANK TURRET ----
   The turret is live-painted (v41) so continuous aim survives the bake, which is
   why it is absent from SPR.veh and therefore from every portrait tile. Geometry
   below is the v41 inline block verbatim; the CALLER owns the translate/scale/
   rotate, so drawUnit's world render is unchanged and the portraits can reuse it.
   Reads nothing but its arguments - no G, no tick, no clock, no RNG. */
function tankTurret(c,key,col){
 const big=key==='bulltank';
 // turret dome
 plSphere(c,col,-1,0,6.6,.82,false);
 // barrel
 c.save();
 plLimb(c,'#2a2a30',3,0,big?19:18,0,big?3.6:3);
 c.fillStyle='#15151a';c.beginPath();c.ellipse(big?19:18,0,1.4,1.8,0,0,7);c.fill();
 glint(c,8,-1.4,.8);c.restore();
}
/* ---- AA MISSILE RACK ----
   Live-painted for the same reason the tank turret is (v41): continuous aim cannot
   survive the bake. Drawn in the rack's OWN frame with the pivot at its origin, so
   every caller does translate(AA_PIVOT,0) first and then rotates. Reads nothing but
   its arguments - no G, no tick, no clock, no RNG. Outermost point is the outer
   missile nose at (11.3, 4.7), i.e. 12.24 from the pivot; that is the swept radius. */
const AA_PIVOT=-3.5;
function aaTurret(c,col){
 plSphere(c,col,0,0,5.4,.92,false);
 c.fillStyle='#2a2a30';rr(c,-4.6,-6.4,9.2,12.8,2);c.fill();
 c.fillStyle='#41414b';rr(c,-4.6,-6.4,9.2,2,1);c.fill();
 c.fillStyle=col;rr(c,-4.6,-6.4,2,12.8,1);c.fill();
 for(const ty of[-4.7,-1.57,1.57,4.7]){
  c.fillStyle='#3a3a44';rr(c,-3.6,ty-1.3,13.4,2.6,1.3);c.fill();
  c.fillStyle='#4d4d58';rr(c,-3.6,ty-1.3,13.4,.9,.45);c.fill();
  c.fillStyle='#141416';c.fillRect(8.6,ty-1.3,1.2,2.6);
  c.fillStyle='#d8352a';c.beginPath();c.ellipse(10.3,ty,1,1.25,0,0,7);c.fill(); // v51: red missile tips
 }
 glint(c,2,-5.2,.9);
}
/* keys whose portrait needs the live turret composited on, -> the scale drawUnit
   applies to it (Bull draws its turret 1.34x, matching its hull blit). */
const TURR_PORTRAIT={tank:1,bulltank:1.34,aatruck:1};
/* v49: the logical box a vehicle portrait must fit = the baked hull's VEH_BOX
   widened by whatever the live turret reaches past it, so the barrel is not
   clipped at the tile edge. Barrel tip = plLimb endpoint + half its round cap;
   the dome reaches 7.6 to the -x side (centre -1, radius 6.6) and 6.6*.82 in y. */
function vehPortraitBox(key){
 const bx=VEH_BOX[key]||[-24,-16,24,16], s=TURR_PORTRAIT[key];
 if(!s)return{x0:bx[0],y0:bx[1],x1:bx[2],y1:bx[3]};
 // v51: the AA rack is a box on a pivot, not a barrel on a dome. At bake orientation it
 // spans AA_PIVOT-4.6 .. AA_PIVOT+11.3 in x and +/-6.4 in y, all inside its own VEH_BOX.
 if(key==='aatruck')return{x0:Math.min(bx[0],(AA_PIVOT-4.6)*s),y0:Math.min(bx[1],-6.4*s),x1:Math.max(bx[2],(AA_PIVOT+11.3)*s),y1:Math.max(bx[3],6.4*s)};
 const big=key==='bulltank',w=big?3.6:3;
 const tx=((big?19:18)+w*.5)*s, ty=Math.max(6.6*.82,w*.5)*s, lx=-7.6*s;
 return{x0:Math.min(bx[0],lx),y0:Math.min(bx[1],-ty),x1:Math.max(bx[2],tx),y1:Math.max(bx[3],ty)};
}
/* v49: ONE vehicle-portrait painter, shared by the in-game tile and the field
   manual card so the two can never drift apart again. Fits vehPortraitBox into a
   Pz-square tile with `pad` px of margin, blits the baked hull at the same offset
   blitVeh uses, then live-paints the turret at the hull's bake orientation
   (barrel to +x). Returns false if the cell is not baked yet. */
function vehPortraitPaint(c,key,fac,Pz,pad){
 const cell=SPR.veh[key]&&SPR.veh[key][fac];
 if(!cell||!cell.cv||!cell.cv.width)return false;
 const bx=vehPortraitBox(key),bw=bx.x1-bx.x0,bh=bx.y1-bx.y0;
 const s2=Math.min((Pz-pad)/bw,(Pz-pad)/bh);
 c.save();
 c.translate((Pz-bw*s2)/2-bx.x0*s2,(Pz-bh*s2)/2-bx.y0*s2);c.scale(s2,s2);
 c.imageSmoothingEnabled=true;
 c.drawImage(cell.cv,-cell.ax,-cell.ay,cell.w,cell.h);
 const ts=TURR_PORTRAIT[key];
 if(ts){c.scale(ts,ts);if(key==='aatruck'){c.translate(AA_PIVOT,0);aaTurret(c,FAC[fac].color);}else tankTurret(c,key,FAC[fac].color);} // v51: same painter split as drawUnit
 c.restore();return true;
}
/* painted white service star, squashed for the top-down vehicle view */
function decalStar(c,x,y,r,col){
 c.save();c.translate(x,y);c.fillStyle=col;c.globalAlpha=.8;c.beginPath();
 for(let i=0;i<10;i++){const a2=i*Math.PI/5-Math.PI/2,r2=i%2?r*.42:r;
  i?c.lineTo(Math.cos(a2)*r2,Math.sin(a2)*r2*.62):c.moveTo(Math.cos(a2)*r2,Math.sin(a2)*r2*.62);}
 c.closePath();c.fill();c.restore();
}

/* ---- BUILDING HULL PAINTER ----
   Static parts only; baked per faction.
   Local frame centered on the building; animated bits live in bldLive. ---- */
function bldBody(c,k,col,sz){
 const S=sz*HW, HD=sz*HH;
 const B0=hx2rgb(col),dk=shade(col,.68),lt=shade(col,1.3);
 const deep=mixc(B0,AMB,.55),litc=mixc(B0,WHITE,.4);
 // every building sits on a faction-tinted molded base pad keyed to its footprint
 const padHW=S*0.96, padHD=HD*0.96;
 basePad(c,shade(col,.74),0,HD*.62,padHW,padHD,5);

 if(k==='hq'){
  // wide command bastion: stepped prism block + domed roof + comms mast + flag, all stacked
  const body=prism(c,col,0,HD*.55,S*.82,HD*.82,30);
  // upper set-back tier
  const tier=prism(c,shade(col,1.06),0,body.topY+HD*.28,S*.5,HD*.5,14);
  // armored door recessed into the SE wall plane, plus molded panel seams
  const seW=wallCorners(body,1),swW=wallCorners(body,-1),jam=mixc(B0,AMB,.7);
  c.fillStyle=rgb(jam.r,jam.g,jam.b);quadPatch(c,seW,.08,0,.34,.62);c.fill();
  c.fillStyle=rgb(deep.r,deep.g,deep.b);quadPatch(c,seW,.11,0,.31,.52);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(120,160,255,.18)';quadPatch(c,seW,.14,.06,.19,.44);c.fill();c.restore();
  c.save();c.globalAlpha=.35;const seam=mixc(B0,AMB,.5);c.strokeStyle=rgb(seam.r,seam.g,seam.b);c.lineWidth=1;
  for(const uu of [.45,.62,.79]){const p0=qp(seW,uu,.06),p1=qp(seW,uu,.9);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();}
  for(const uu of [.3,.5,.7]){const p0=qp(swW,uu,.06),p1=qp(swW,uu,.9);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();}
  c.restore();
  // corner bollards on the pad (small gray accents)
  plSphere(c,'#4a4e54',padHW*.94,HD*.62,3,.7,false);plSphere(c,'#4a4e54',-padHW*.94,HD*.62,3,.7,false);plSphere(c,'#4a4e54',0,HD*.62+padHD*.94,3,.7,false);
  // command dome on the top tier
  plSphere(c,shade(col,1.1),0,tier.topY+2,S*.34,.7,true);
  // gold star on the dome
  c.fillStyle='#ffd24d';c.save();c.translate(0,tier.topY-2);c.beginPath();for(let i=0;i<10;i++){const a2=i*Math.PI/5-Math.PI/2,r2=i%2?2.6:6.4;i?c.lineTo(Math.cos(a2)*r2,Math.sin(a2)*r2):c.moveTo(Math.cos(a2)*r2,Math.sin(a2)*r2);}c.closePath();c.fill();c.restore();
  // comms mast rising from the back corner of the body
  const mx=-S*.5, mtop=body.topY-30;
  c.strokeStyle='#3c3c44';c.lineWidth=2.6;c.beginPath();c.moveTo(mx,body.topY+2);c.lineTo(mx,mtop);c.stroke();
  c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.3)';c.lineWidth=1;c.beginPath();c.moveTo(mx-.7,body.topY+2);c.lineTo(mx-.7,mtop);c.stroke();c.restore();

 }
 else if(k==='barracks'){
  // a gable-roofed hut: low prism walls, a proper two-slope molded roof with
  // end walls, a doorway fitted flush into the SE wall, and sandbag lines that
  // hug the pad's front edges instead of cutting straight across the hull
  const body=prism(c,shade(col,.92),0,HD*.55,S*.74,HD*.74,12);
  const roof=gableRoof(c,col,0,body.topY,S*.86,HD*.86,17);
  // ridge cap
  const cap=mixc(B0,BLACK,.3);
  c.strokeStyle=rgb(cap.r,cap.g,cap.b);c.lineWidth=2.2;c.lineCap='round';
  c.beginPath();c.moveTo(roof.ridgeA.x,roof.ridgeA.y);c.lineTo(roof.ridgeB.x,roof.ridgeB.y);c.stroke();c.lineCap='butt';
  // two molded vents on the SW roof slope
  const swSlope=[roof.W,roof.S,roof.ridgeB,roof.ridgeA],vent=mixc(B0,AMB,.6);
  c.fillStyle=rgb(vent.r,vent.g,vent.b);
  quadPatch(c,swSlope,.32,.42,.44,.72);c.fill();quadPatch(c,swSlope,.58,.42,.7,.72);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.14)';quadPatch(c,swSlope,.32,.64,.44,.72);c.fill();quadPatch(c,swSlope,.58,.64,.7,.72);c.fill();c.restore();
  // doorway fitted into the SE wall: jamb, dark opening, inner lamp glow
  const seW=wallCorners(body,1),jam=mixc(B0,AMB,.66);
  c.fillStyle=rgb(jam.r,jam.g,jam.b);quadPatch(c,seW,.1,0,.44,.8);c.fill();
  c.fillStyle='#241c14';quadPatch(c,seW,.14,0,.4,.66);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,240,200,.14)';quadPatch(c,seW,.17,.06,.24,.6);c.fill();c.restore();
  // sandbags along the pad's front edges (following the iso slope)
  for(let i=0;i<4;i++){const u=.16+i*.2;plSphere(c,'#9a8a5e',u*padHW,HD*.62+(1-u)*padHD*.92,4.2,.62,false);}
  for(let i=0;i<3;i++){const u=.2+i*.2;plSphere(c,'#8f8054',-u*padHW,HD*.62+(1-u)*padHD*.92,4,.62,false);}
  for(let i=0;i<2;i++){const u=.28+i*.2;plSphere(c,'#a5946a',u*padHW,HD*.62+(1-u)*padHD*.92-4.6,3.8,.62,false);}
 }
 else if(k==='lab'){
  // research lab: prism block with a glowing observation dome, a glazed console
  // band and crew door fitted flush into the walls, and an equipment pod annex
  const body=prism(c,shade(col,.9),0,HD*.55,S*.78,HD*.78,20);
  // equipment pod hugging the left-front wall
  prism(c,shade(col,.78),-S*.52,HD*.66,S*.14,HD*.14,9,{matte:true});
  // glass observation dome on top, lit from within
  plSphere(c,shade(col,1.12),0,body.topY+2,S*.4,.66,true);
  // glazed viewport band fitted into the SE wall, with mullions
  const seW=wallCorners(body,1),frm=mixc(B0,AMB,.7);
  c.fillStyle=rgb(frm.r,frm.g,frm.b);quadPatch(c,seW,.1,.32,.72,.68);c.fill();
  c.fillStyle='rgba(125,205,235,.85)';quadPatch(c,seW,.13,.37,.69,.63);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(190,240,255,.35)';quadPatch(c,seW,.13,.52,.69,.63);c.fill();c.restore();
  c.strokeStyle=rgb(deep.r,deep.g,deep.b);c.lineWidth=1.2;
  for(const mu of [.27,.41,.55]){const p0=qp(seW,mu,.37),p1=qp(seW,mu,.63);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();}
  // crew door fitted into the SW wall
  const swW=wallCorners(body,-1),jam=mixc(B0,AMB,.66);
  c.fillStyle=rgb(jam.r,jam.g,jam.b);quadPatch(c,swW,.16,0,.4,.72);c.fill();
  c.fillStyle='#1c2126';quadPatch(c,swW,.19,0,.37,.6);c.fill();
  // little antenna with a blinking node
  c.strokeStyle='#3c3c44';c.lineWidth=2;c.beginPath();c.moveTo(S*.5,body.topY+2);c.lineTo(S*.5,body.topY-14);c.stroke();

  // flask emblem
  c.fillStyle='#bfe7ff';c.font='bold 13px sans-serif';c.textAlign='center';c.fillText('🔬',0,body.topY-4);c.textAlign='left';
 }
 else if(k==='garage'){
  // a hangar: tall prism, long low gable roof, and a roll-up door recessed INTO
  // the SE wall. Jamb, slats and the hazard lintel all follow the wall plane,
  // so nothing hangs past the hull anymore.
  const body=prism(c,col,0,HD*.55,S*.84,HD*.84,24);
  gableRoof(c,shade(col,.8),0,body.topY,S*.9,HD*.9,12);
  const seW=wallCorners(body,1),jam=mixc(B0,AMB,.72);
  c.fillStyle=rgb(jam.r,jam.g,jam.b);quadPatch(c,seW,.15,0,.91,.74);c.fill();
  c.fillStyle=rgb(deep.r,deep.g,deep.b);quadPatch(c,seW,.18,0,.88,.62);c.fill();
  // corrugation slats following the wall plane
  const slat=mixc(B0,AMB,.74);c.strokeStyle=rgb(slat.r,slat.g,slat.b);c.lineWidth=1.4;
  for(let i=1;i<5;i++){const v=i*.124,p0=qp(seW,.18,v),p1=qp(seW,.88,v);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();}
  c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.14)';c.lineWidth=1;
  for(let i=1;i<5;i++){const v=i*.124+.03,p0=qp(seW,.18,v),p1=qp(seW,.88,v);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();}c.restore();
  // hazard chevron strip along the door lintel, inside the wall plane
  for(let i=0;i<7;i++){c.fillStyle=i%2?'#191919':'#ffd24d';quadPatch(c,seW,.18+i*.1,.62,.28+i*.1,.7);c.fill();}
  // crew door + small window fitted into the SW wall
  const swW=wallCorners(body,-1),jam2=mixc(B0,AMB,.66);
  c.fillStyle=rgb(jam2.r,jam2.g,jam2.b);quadPatch(c,swW,.16,0,.34,.56);c.fill();
  c.fillStyle='#20242a';quadPatch(c,swW,.19,0,.31,.46);c.fill();
  c.fillStyle='rgba(125,205,235,.8)';quadPatch(c,swW,.46,.28,.66,.46);c.fill();
  // rooftop exhaust stack (small dark accent poking past the roofline)
  c.fillStyle='#3c3c44';rr(c,S*.26-2.6,-30,5.2,14,2);c.fill();
  c.fillStyle='#2a2a30';c.beginPath();c.ellipse(S*.26,-30,4,1.8,0,0,7);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.2)';rr(c,S*.26-2.2,-29,1.4,12,1);c.fill();c.restore();
  // wrench emblem on the roof
  c.fillStyle='#ffd24d';c.font='bold 13px sans-serif';c.textAlign='center';c.fillText('🔧',0,body.topY-6);c.textAlign='left';
 }
 else if(k==='helipad'){
  // a raised landing platform: low prism plinth + flat circular pad with H + corner lights
  const body=prism(c,shade(col,.86),0,HD*.55,S*.86,HD*.86,9,{matte:true});
  const py=body.topY;
  // dark tarmac disc
  c.fillStyle=rgb(deep.r,deep.g,deep.b);c.beginPath();c.ellipse(0,py,S*.78,HD*.78,0,0,7);c.fill();
  (function(){const pg=c.createRadialGradient(LIGHT.x*S*.3,py+LIGHT.y*HD*.3,2,0,py,S*.8);pg.addColorStop(0,rgb(mixc(B0,BLACK,.2).r,mixc(B0,BLACK,.2).g,mixc(B0,BLACK,.2).b));pg.addColorStop(1,rgb(mixc(B0,BLACK,.5).r,mixc(B0,BLACK,.5).g,mixc(B0,BLACK,.5).b));c.fillStyle=pg;c.beginPath();c.ellipse(0,py,S*.7,HD*.7,0,0,7);c.fill();})();
  // yellow ring + H
  c.save();c.beginPath();c.ellipse(0,py,S*.7,HD*.7,0,0,7);c.clip();
  c.strokeStyle='rgba(255,210,77,.8)';c.lineWidth=3;c.beginPath();c.ellipse(0,py,S*.56,HD*.56,0,0,7);c.stroke();
  c.strokeStyle='#f4f7fa';c.lineWidth=4;c.lineCap='round';c.beginPath();c.moveTo(-8,py-6);c.lineTo(-8,py+6);c.moveTo(8,py-6);c.lineTo(8,py+6);c.moveTo(-8,py);c.lineTo(8,py);c.stroke();c.restore();
  // molded pad lip, skid scuffs, and a control kiosk on the back corner (v27)
  const lip=mixc(B0,BLACK,.45);
  c.save();c.globalAlpha=.6;c.strokeStyle=rgb(lip.r,lip.g,lip.b);c.lineWidth=2;c.beginPath();c.ellipse(0,py,S*.74,HD*.74,0,0,7);c.stroke();c.restore();
  c.save();c.beginPath();c.ellipse(0,py,S*.7,HD*.7,0,0,7);c.clip();
  c.strokeStyle='rgba(16,16,18,.4)';c.lineWidth=2.6;c.lineCap='round';
  c.beginPath();c.moveTo(-S*.3,py+HD*.2);c.quadraticCurveTo(-S*.12,py+HD*.28,S*.08,py+HD*.16);c.stroke();
  c.beginPath();c.moveTo(-S*.24,py+HD*.3);c.quadraticCurveTo(-S*.05,py+HD*.38,S*.12,py+HD*.26);c.stroke();
  c.restore();c.lineCap='butt';
  const kio=prism(c,shade(col,1.04),-S*.5,py-HD*.28,S*.13,HD*.13,11);
  c.fillStyle='rgba(125,205,235,.85)';quadPatch(c,wallCorners(kio,1),.14,.42,.86,.7);c.fill();
  c.fillStyle='#22262b';quadPatch(c,wallCorners(kio,-1),.2,0,.5,.62);c.fill();
  // four corner lights

 }
 else if(k==='fwdpad'){
  /* v85: deliberately the Helipad's poor relation - a field strip, not a hangar.
     Same read at a glance (a flat disc you set an aircraft down on) so its purpose
     is obvious, but marked with a repair cross instead of an H, ringed in the
     medic's green rather than the helipad's yellow, and carrying a fuel bowser and
     a windsock instead of a control kiosk. */
  const body=prism(c,shade(col,.9),0,HD*.5,S*.8,HD*.8,7,{matte:true});
  const py=body.topY;
  c.fillStyle=rgb(deep.r,deep.g,deep.b);c.beginPath();c.ellipse(0,py,S*.72,HD*.72,0,0,7);c.fill();
  (function(){const pg=c.createRadialGradient(LIGHT.x*S*.3,py+LIGHT.y*HD*.3,2,0,py,S*.74);pg.addColorStop(0,rgb(mixc(B0,BLACK,.18).r,mixc(B0,BLACK,.18).g,mixc(B0,BLACK,.18).b));pg.addColorStop(1,rgb(mixc(B0,BLACK,.48).r,mixc(B0,BLACK,.48).g,mixc(B0,BLACK,.48).b));c.fillStyle=pg;c.beginPath();c.ellipse(0,py,S*.64,HD*.64,0,0,7);c.fill();})();
  // green ring + repair cross
  c.save();c.beginPath();c.ellipse(0,py,S*.64,HD*.64,0,0,7);c.clip();
  c.strokeStyle='rgba(120,225,140,.8)';c.lineWidth=3;c.beginPath();c.ellipse(0,py,S*.5,HD*.5,0,0,7);c.stroke();
  c.fillStyle='#eaf6ec';c.fillRect(-2.6,py-8,5.2,16);c.fillRect(-9,py-2.6,18,5.2);
  c.restore();
  const lip=mixc(B0,BLACK,.45);
  c.save();c.globalAlpha=.55;c.strokeStyle=rgb(lip.r,lip.g,lip.b);c.lineWidth=2;c.beginPath();c.ellipse(0,py,S*.68,HD*.68,0,0,7);c.stroke();c.restore();
  // fuel bowser squatting on the north corner
  const bow=prism(c,shade(col,1.02),-S*.46,py-HD*.24,S*.15,HD*.12,8);
  c.fillStyle='#2a2e34';quadPatch(c,wallCorners(bow,-1),.18,.05,.6,.7);c.fill();
  c.strokeStyle='rgba(30,30,36,.75)';c.lineWidth=1.4;c.lineCap='round';
  c.beginPath();c.moveTo(-S*.38,py-HD*.12);c.quadraticCurveTo(-S*.2,py+HD*.1,-S*.06,py+HD*.04);c.stroke();c.lineCap='butt';
  // windsock on a mast at the far corner, so the pad reads as an airfield
  c.strokeStyle=rgb(mixc(B0,WHITE,.3).r,mixc(B0,WHITE,.3).g,mixc(B0,WHITE,.3).b);c.lineWidth=1.6;
  c.beginPath();c.moveTo(S*.5,py-HD*.1);c.lineTo(S*.5,py-HD*.1-16);c.stroke();
  c.fillStyle='#e8663a';c.beginPath();c.moveTo(S*.5,py-HD*.1-16);c.lineTo(S*.5+9,py-HD*.1-13.6);c.lineTo(S*.5+9,py-HD*.1-10.4);c.lineTo(S*.5,py-HD*.1-11);c.closePath();c.fill();
  c.fillStyle='rgba(245,245,245,.85)';c.beginPath();c.moveTo(S*.5+4.4,py-HD*.1-14.8);c.lineTo(S*.5+6.4,py-HD*.1-14.3);c.lineTo(S*.5+6.4,py-HD*.1-10.8);c.lineTo(S*.5+4.4,py-HD*.1-11.2);c.closePath();c.fill();
 }
 else if(k==='generator'){
  // a power shed: prism housing with the glowing cell recessed into the SE
  // wall, a molded vent grille on the roof, and a ground cable to the pad edge
  const body=prism(c,shade(col,.9),0,HD*.55,S*.72,HD*.72,18);
  const seW=wallCorners(body,1),frm=mixc(B0,AMB,.7);
  c.fillStyle=rgb(frm.r,frm.g,frm.b);quadPatch(c,seW,.2,.08,.5,.76);c.fill();
  (function(){const pt=qp(seW,.24,.7),pb=qp(seW,.24,.14);const vg=c.createLinearGradient(pt.x,pt.y,pb.x,pb.y);vg.addColorStop(0,'#fff0a0');vg.addColorStop(.5,'#f4c430');vg.addColorStop(1,'#b8860b');c.fillStyle=vg;quadPatch(c,seW,.24,.14,.46,.7);c.fill();})();
  c.strokeStyle='rgba(20,20,24,.55)';c.lineWidth=1;
  for(const vv of [.28,.42,.56]){const p0=qp(seW,.24,vv),p1=qp(seW,.46,vv);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();}
  // junction box + sagging ground cable off the SW wall to the pad edge
  const swW=wallCorners(body,-1);
  c.fillStyle=shade(col,.55);quadPatch(c,swW,.3,.3,.44,.52);c.fill();
  const jb=qp(swW,.37,.3);
  c.strokeStyle=shade(col,.42);c.lineWidth=1.8;c.beginPath();c.moveTo(jb.x,jb.y);c.quadraticCurveTo(jb.x-6,jb.y+14,-padHW*.7,HD*.62+padHD*.24);c.stroke();
  // molded vent grille block on the roof
  const gr=prism(c,shade(col,.5),S*.2,body.topY+HD*.2,S*.16,HD*.16,5,{matte:true});
  c.strokeStyle='rgba(200,205,215,.35)';c.lineWidth=1;
  for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(gr.cx+i*3.6,gr.topY+1);c.lineTo(gr.cx+i*3.6-2.2,gr.topY+HD*.14);c.stroke();}
  c.fillStyle='#fffce0';c.font='bold 12px sans-serif';c.textAlign='center';c.fillText('⚡',0,body.topY+2);c.textAlign='left';
 }
 else if(k==='turbine'){
  // tapered tower mast + spinning rotor; mast grounded on the pad
  const baseTopY=HD*.4;
  // molded base collar grounding the mast (small gray accent, v27)
  c.fillStyle='#3c4046';c.beginPath();c.ellipse(0,baseTopY+1.5,7.5,3.4,0,0,7);c.fill();
  c.fillStyle='#4a4e54';rr(c,-7.5,baseTopY-4,15,5.5,2.5);c.fill();
  c.fillStyle='#565b62';c.beginPath();c.ellipse(0,baseTopY-4,7.5,3.4,0,0,7);c.fill();
  c.fillStyle='#22262b';rr(c,-1.8,baseTopY-3.2,3.6,3,1.2);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.18)';c.beginPath();c.ellipse(-2.4,baseTopY-4.6,2.6,1.1,0,0,7);c.fill();c.restore();
  (function(){const g=c.createLinearGradient(-4,0,4,0);g.addColorStop(0,'#d6dbe1');g.addColorStop(.5,'#fbfdff');g.addColorStop(1,'#aeb4bc');c.fillStyle=g;c.beginPath();c.moveTo(-3.4,baseTopY);c.lineTo(3.4,baseTopY);c.lineTo(1.5,-40);c.lineTo(-1.5,-40);c.closePath();c.fill();})();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.4)';c.beginPath();c.moveTo(-3,baseTopY);c.lineTo(-1.2,baseTopY);c.lineTo(-.6,-40);c.lineTo(-1.4,-40);c.closePath();c.fill();c.restore();
  // nacelle + blades

 }
 else if(k==='guardtower'){
  // TALL legged watch tower: four splayed legs, a boxed platform with a railing,
  // a pitched roof, and a rotating auto-cannon on top. Self-firing defense.
  const legTop=-30, legSpread=S*.66, footY=HD*.5;
  // legs are a dark shade of the team color so the tower reads as one molded piece
  const legc=mixc(B0,AMB,.42),legCol=rgb(legc.r,legc.g,legc.b);
  function drawLeg(lx,lz){c.strokeStyle=legCol;c.lineWidth=3.4;c.lineCap='round';c.beginPath();c.moveTo(lx*.45,legTop+6);c.lineTo(lx,footY+lz);c.stroke();c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.2)';c.lineWidth=1.2;c.beginPath();c.moveTo(lx*.45,legTop+6);c.lineTo(lx,footY+lz);c.stroke();c.restore();}
  drawLeg(-legSpread,0);drawLeg(legSpread*.4,-HD*.4);drawLeg(legSpread,0);drawLeg(-legSpread*.4,HD*.4);
  // cross-bracing (same dark team tint, a touch more transparent)
  c.save();c.globalAlpha=.8;c.strokeStyle=legCol;c.lineWidth=1.6;c.beginPath();c.moveTo(-legSpread,footY-2);c.lineTo(legSpread,footY-2);c.moveTo(-legSpread*.6,legTop+18);c.lineTo(legSpread*.6,legTop+18);c.stroke();c.restore();
  // X-bracing across the front + a ladder up to the platform (v27)
  c.save();c.globalAlpha=.7;c.strokeStyle=legCol;c.lineWidth=1.3;
  c.beginPath();c.moveTo(-legSpread,footY);c.lineTo(legSpread*.45,legTop+16);c.moveTo(legSpread,footY);c.lineTo(-legSpread*.45,legTop+16);c.stroke();c.restore();
  const lx0=legSpread*.12,lx1=legSpread*.34,lyA=footY+HD*.26,lyB=footY+HD*.2,lyT=legTop+10;
  c.strokeStyle='#3a3a40';c.lineWidth=1.2;
  c.beginPath();c.moveTo(lx0,lyA);c.lineTo(lx0,lyT);c.moveTo(lx1,lyB);c.lineTo(lx1,lyT);c.stroke();
  for(let i=0;i<6;i++){const t=i/5;c.beginPath();c.moveTo(lx0,lyA+(lyT-lyA)*t);c.lineTo(lx1,lyB+(lyT-lyB)*t);c.stroke();}
  plSphere(c,'#9a8a5e',-legSpread*.8,footY+2,3.4,.6,false);plSphere(c,'#8f8054',-legSpread*.52,footY+3.5,3.2,.6,false);
  // platform box (small prism)
  const plat=prism(c,shade(col,.96),0,legTop+8,S*.6,HD*.6,10);
  // railing posts around the platform top
  c.strokeStyle=rgb(deep.r,deep.g,deep.b);c.lineWidth=1.6;
  for(const cor of [[-S*.55,plat.topY+1],[S*.55,plat.topY+1],[0,plat.topY-HD*.5],[0,plat.topY+HD*.5]]){c.beginPath();c.moveTo(cor[0],cor[1]);c.lineTo(cor[0],cor[1]-6);c.stroke();}
  // pitched roof over the platform
  hipRoof(c,shade(col,.82),0,plat.topY,S*.66,HD*.66,12);
  // rotating auto-cannon mounted just under the roof eave (dark team-shade barrel + tiny black muzzle)

 }
 else if(k==='radar'){
  // a sensor cabin: fitted console glazing and crew door, an equipment box
  // alongside, and a braced post for the sweeping dish (drawn live)
  const body=prism(c,shade(col,.92),0,HD*.55,S*.66,HD*.66,14);
  const seW=wallCorners(body,1),swW=wallCorners(body,-1);
  c.fillStyle='rgba(125,205,235,.8)';quadPatch(c,seW,.16,.36,.6,.62);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(190,240,255,.3)';quadPatch(c,seW,.16,.52,.6,.62);c.fill();c.restore();
  c.strokeStyle=rgb(deep.r,deep.g,deep.b);c.lineWidth=1.1;
  for(const mu of [.31,.46]){const p0=qp(seW,mu,.36),p1=qp(seW,mu,.62);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();}
  const jam=mixc(B0,AMB,.66);
  c.fillStyle=rgb(jam.r,jam.g,jam.b);quadPatch(c,swW,.18,0,.4,.7);c.fill();
  c.fillStyle='#20242a';quadPatch(c,swW,.21,0,.37,.58);c.fill();
  // equipment box beside the cabin
  prism(c,'#3a3a40',S*.54,HD*.66,S*.13,HD*.13,7,{matte:true});
  // braced dish post with guy wires down to the pad
  c.fillStyle=rgb(deep.r,deep.g,deep.b);c.fillRect(-1.4,body.topY-26,2.8,26);
  c.strokeStyle='rgba(44,44,50,.7)';c.lineWidth=1;
  c.beginPath();c.moveTo(0,body.topY-22);c.lineTo(-S*.5,HD*.62);c.moveTo(0,body.topY-22);c.lineTo(S*.42,HD*.7);c.stroke();
 }
 else if(k==='foundry'){
  /* v87: a casting shed - a low hall with a banded stack, a glowing pour spout cut
     into the SE wall and slag heaped on the pad. The heat is what the building IS,
     so it is in the silhouette rather than in an overlay; the PULSE on the spout is
     the live half, in bldLive. */
  const body=prism(c,shade(col,.86),0,HD*.55,S*.7,HD*.7,15);
  const seW=wallCorners(body,1),swW=wallCorners(body,-1);
  c.fillStyle='#2a1c12';quadPatch(c,seW,.3,0,.4,.55);c.fill();               // the spout, recessed
  c.fillStyle='#ff7a1e';quadPatch(c,seW,.34,.04,.32,.4);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,220,120,.5)';quadPatch(c,seW,.38,.06,.24,.26);c.fill();c.restore();
  c.save();c.globalAlpha=.4;const sm=mixc(B0,AMB,.5);c.strokeStyle=rgb(sm.r,sm.g,sm.b);c.lineWidth=1;
  for(const uu of [.3,.5,.7]){const p0=qp(swW,uu,.06),p1=qp(swW,uu,.92);c.beginPath();c.moveTo(p0.x,p0.y);c.lineTo(p1.x,p1.y);c.stroke();}
  c.restore();
  const stx=-S*.4, stop=body.topY-40;                                         // the stack
  c.fillStyle=shade(col,.6);c.fillRect(stx-4,stop,8,body.topY-stop+3);
  c.fillStyle='#3a3a42';for(let i2=0;i2<3;i2++)c.fillRect(stx-4.6,stop+6+i2*11,9.2,2.4);
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.22)';c.fillRect(stx-3.4,stop,2,body.topY-stop);c.restore();
  c.fillStyle='#20242a';c.beginPath();c.ellipse(stx,stop,4.2,1.8,0,0,7);c.fill();
  c.fillStyle=shade('#6b5a44',1);                                             // slag heaps
  c.beginPath();c.ellipse(S*.62,HD*.6,S*.16,HD*.2,0,0,7);c.fill();
  c.beginPath();c.ellipse(S*.44,HD*.74,S*.12,HD*.16,0,0,7);c.fill();
  plSphere(c,'#8a6a3c',S*.62,HD*.56,3,.7,false);
 }
 else if(k==='cmdpost'){
  /* v86: a low sandbagged command hut under a map awning, with a standard on a
     short pole. It has to read as a place men gather rather than as a machine, so
     there is no dish, no mast and no glazing beyond the door - the Radar Tent next
     to it in Green's build list already owns that silhouette. */
  const body=prism(c,shade(col,.9),0,HD*.55,S*.62,HD*.62,13);
  const seW=wallCorners(body,1),swW=wallCorners(body,-1),jam=mixc(B0,AMB,.66);
  c.fillStyle=rgb(jam.r,jam.g,jam.b);quadPatch(c,seW,.34,0,.32,.66);c.fill();     // doorway
  c.fillStyle='#20242a';quadPatch(c,seW,.37,0,.26,.55);c.fill();
  // a briefing board pinned to the SW wall
  c.fillStyle='#2b2b33';quadPatch(c,swW,.22,.3,.5,.5);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(180,230,255,.22)';quadPatch(c,swW,.25,.36,.42,.36);c.fill();c.restore();
  // sandbag courses hugging the pad's front edges
  c.fillStyle=shade('#b9a878',.98);
  for(let i2=0;i2<5;i2++){c.beginPath();c.ellipse(-S*.62+i2*S*.3,HD*.66,S*.14,HD*.2,0,0,7);c.fill();}
  c.fillStyle=shade('#b9a878',.86);
  for(let i2=0;i2<4;i2++){c.beginPath();c.ellipse(-S*.48+i2*S*.3,HD*.56,S*.13,HD*.18,0,0,7);c.fill();}
  // the map awning: a flat canopy on four thin legs over the top of the hut
  c.strokeStyle=rgb(deep.r,deep.g,deep.b);c.lineWidth=1.6;
  for(const lx of [-S*.42,S*.42]){c.beginPath();c.moveTo(lx,body.topY+2);c.lineTo(lx,body.topY-13);c.stroke();}
  c.fillStyle=shade(col,1.12);c.beginPath();
  c.moveTo(-S*.52,body.topY-13);c.lineTo(0,body.topY-19);c.lineTo(S*.52,body.topY-13);c.lineTo(0,body.topY-7);c.closePath();c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.18)';c.beginPath();
  c.moveTo(-S*.52,body.topY-13);c.lineTo(0,body.topY-19);c.lineTo(0,body.topY-13);c.closePath();c.fill();c.restore();
  // flag pole (the standard itself waves in bldLive)
  c.strokeStyle='#3c3c44';c.lineWidth=2;c.beginPath();c.moveTo(S*.5,body.topY-11);c.lineTo(S*.5,body.topY-34);c.stroke();
  plSphere(c,'#ffd24d',S*.5,body.topY-35,2,1,false);
 }
 else if(k==='radiotower'){
  // v30: a squat equipment cabin under a tall guyed lattice mast with a beacon
  const body=prism(c,shade(col,.92),0,HD*.55,S*.5,HD*.5,10);
  const seW=wallCorners(body,1);
  c.fillStyle='rgba(125,205,235,.8)';quadPatch(c,seW,.2,.34,.5,.6);c.fill();
  const mtop=body.topY-52;
  c.strokeStyle=shade(col,.5);c.lineWidth=2.6;c.beginPath();c.moveTo(0,body.topY+2);c.lineTo(0,mtop);c.stroke();
  c.strokeStyle=shade(col,.42);c.lineWidth=1.2;
  for(let i2=1;i2<=4;i2++){const yy=body.topY-i2*10;c.beginPath();c.moveTo(-7+i2,yy);c.lineTo(7-i2,yy);c.stroke();}
  c.strokeStyle='rgba(44,44,50,.7)';c.lineWidth=1;
  c.beginPath();c.moveTo(0,mtop+8);c.lineTo(-S*.6,HD*.66);c.moveTo(0,mtop+8);c.lineTo(S*.55,HD*.74);c.stroke();
  c.fillStyle='#ffd24d';c.beginPath();c.arc(0,mtop,1.7,0,7);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,220,120,.35)';c.beginPath();c.arc(0,mtop,3.4,0,7);c.fill();c.restore();
 }
 else if(k==='dump'){
  // ammo depot: low concrete prism + stacked crates + warhead sign
  const body=prism(c,'#a07f4e',0,HD*.55,S*.7,HD*.7,12,{matte:true});
  // faction banner stripe on the front
  c.fillStyle=col;quadPatch(c,wallCorners(body,1),.08,.32,.82,.5);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.14)';quadPatch(c,wallCorners(body,1),.08,.44,.82,.5);c.fill();c.restore();
  // stacked crates on top
  const cr1=prism(c,'#9a7d54',-6,body.topY+HD*.22,6,3.2,5,{matte:true});
  prism(c,'#8a6f46',7,body.topY+HD*.28,5.4,3,4.5,{matte:true});
  const cr3=prism(c,'#a58960',-6,cr1.topY+1.2,5,2.7,4,{matte:true});
  c.save();c.globalAlpha=.45;c.strokeStyle='#5e4a2c';c.lineWidth=1;
  for(const q of [cr1,cr3]){c.beginPath();c.moveTo(q.W.x,q.W.y);c.lineTo(q.E.x,q.E.y);c.stroke();}
  c.restore();
  // warning sign on a post at the roof edge (the emblem sits on the board)
  c.strokeStyle='#3a3a40';c.lineWidth=2;c.beginPath();c.moveTo(0,body.topY-8);c.lineTo(0,body.topY-19);c.stroke();
  c.fillStyle='#2e2e34';rr(c,-8,body.topY-33,16,14,3);c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.12)';rr(c,-8,body.topY-33,16,4,3);c.fill();c.restore();
  c.fillStyle='#ffd24d';c.font='bold 11px sans-serif';c.textAlign='center';c.fillText('💥',0,body.topY-22);c.textAlign='left';
 }
 else if(k==='bunker'){
  // squat fortified pillbox: heavy low prism, domed cap with a hatch ring, and
  // firing slits fitted per wall face with molded lintels
  const body=prism(c,shade(col,.86),0,HD*.55,S*.86,HD*.86,12,{matte:true});
  plSphere(c,col,0,body.topY+2,S*.6,.6,true);
  // hatch ring on the dome cap
  const hat=mixc(B0,BLACK,.35);
  c.save();c.globalAlpha=.55;c.strokeStyle=rgb(hat.r,hat.g,hat.b);c.lineWidth=1.6;
  c.beginPath();c.ellipse(-S*.1,body.topY-S*.36*.6,S*.15,HD*.12,0,0,7);c.stroke();c.restore();
  // firing slits: two on the SE wall, one on the SW wall, each with a lintel
  const seW=wallCorners(body,1),swW=wallCorners(body,-1),lin=mixc(B0,BLACK,.4);
  function slit(Q,u0,u1){
   c.fillStyle=rgb(lin.r,lin.g,lin.b);quadPatch(c,Q,u0-.02,.4,u1+.02,.74);c.fill();
   c.fillStyle='#0e0e10';quadPatch(c,Q,u0,.46,u1,.66);c.fill();
   c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(120,160,255,.25)';quadPatch(c,Q,u0,.59,u1,.66);c.fill();c.restore();
  }
  slit(seW,.16,.38);slit(seW,.52,.74);slit(swW,.24,.5);
 }
 else if(k==='outpost'){
  // forward base: sandbag ring around a small shack, with field supplies inside
  c.fillStyle=shade('#9a8456',.66);c.beginPath();c.ellipse(0,HD*.55,S*.92,HD*.92,0,0,7);c.fill();
  for(let i=0;i<11;i++){const a=i/11*6.28;plSphere(c,'#b39a64',Math.cos(a)*S*.82,HD*.55+Math.sin(a)*HD*.82,4.6,.6,false);}
  // second sandbag course over the front arc
  for(let i=0;i<4;i++){const a=(.14+i*.09)*6.28;plSphere(c,'#a5946a',Math.cos(a)*S*.82,HD*.55+Math.sin(a)*HD*.82-4.4,4,.6,false);}
  const body=prism(c,col,0,HD*.3,S*.5,HD*.5,16);
  // doorway fitted into the SE wall
  const seW=wallCorners(body,1),jam=mixc(B0,AMB,.66);
  c.fillStyle=rgb(jam.r,jam.g,jam.b);quadPatch(c,seW,.14,0,.5,.74);c.fill();
  c.fillStyle='#241e18';quadPatch(c,seW,.18,0,.46,.6);c.fill();
  // supply crate + fuel drum tucked inside the ring
  const cr=prism(c,'#8a6f46',-S*.62,HD*.62,S*.11,HD*.11,6,{matte:true});
  c.save();c.globalAlpha=.5;c.strokeStyle='#5e4a2c';c.lineWidth=1;c.beginPath();c.moveTo(cr.W.x,cr.W.y);c.lineTo(cr.E.x,cr.E.y);c.stroke();c.restore();
  (function(){const dx=S*.6,dy=HD*.68;c.fillStyle='#4e545c';c.beginPath();c.ellipse(dx,dy,4.4,2.2,0,0,7);c.fill();c.fillStyle='#5a6068';rr(c,dx-4.4,dy-8,8.8,8,1.5);c.fill();c.fillStyle='#676d76';c.beginPath();c.ellipse(dx,dy-8,4.4,2.2,0,0,7);c.fill();c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.2)';rr(c,dx-3.2,dy-7.6,1.6,7,1);c.fill();c.restore();})();
  // flag on a corner post
  const px=S*.34,ptop=body.topY-16;
  c.strokeStyle='#4a4a52';c.lineWidth=2;c.beginPath();c.moveTo(px,body.topY);c.lineTo(px,ptop);c.stroke();

  c.fillStyle='#ff9b3a';c.font='bold 12px sans-serif';c.textAlign='center';c.fillText('⬢',0,body.topY-2);c.textAlign='left';
 }
 else if(k==='supply'){
  // depot yard: an open tarp canopy on four posts over stacked pallets. Cargo is
  // painted BEFORE the canopy so the roof genuinely overhangs it, and the deck is
  // a bare diamond rather than a prism top so it reads as fabric, not molded shell.
  function pallet(px,py,pw,pd,ph,tone){
   const q=prism(c,tone,px,py,pw,pd,ph,{matte:true});
   c.save();c.globalAlpha=.42;c.strokeStyle='#4e3f26';c.lineWidth=1;
   c.beginPath();c.moveTo(q.W.x,q.W.y);c.lineTo(q.E.x,q.E.y);c.stroke();c.restore();
   return q;
  }
  const p1=pallet(-S*.34,HD*.66,S*.24,HD*.24,13,'#9a7d54');
  pallet(-S*.34,p1.topY+HD*.06,S*.20,HD*.20,9,'#a58960');
  const p3=pallet(S*.30,HD*.72,S*.22,HD*.22,10,'#8a6f46');
  pallet(S*.30,p3.topY+HD*.05,S*.17,HD*.17,7,'#9a7d54');
  const cm=pallet(0,HD*.58,S*.26,HD*.26,14,shade(col,.86));
  c.save();c.globalAlpha=.5;c.fillStyle='#f2e9c8';c.font='bold 7px sans-serif';c.textAlign='center';
  c.fillText('SUPPLY',cm.cx,cm.topY+HD*.30);c.textAlign='left';c.restore();
  // fuel drums along the SW edge
  for(let i=0;i<3;i++){const dx=-S*.72+i*7,dy=HD*.86-i*2.4;
   c.fillStyle='#4a5058';c.beginPath();c.ellipse(dx,dy,4.2,2.1,0,0,7);c.fill();
   c.fillStyle='#586069';rr(c,dx-4.2,dy-8.4,8.4,8.4,1.5);c.fill();
   c.fillStyle='#666e78';c.beginPath();c.ellipse(dx,dy-8.4,4.2,2.1,0,0,7);c.fill();}
  // four corner posts, then the tarp deck they carry
  const CH=34,cex=S*.86,cey=HD*.86;
  const posts=[[0,-cey],[cex,0],[0,cey],[-cex,0]].map(q=>({x:q[0],y:HD*.55+q[1]}));
  c.strokeStyle=shade(col,.42);c.lineWidth=3;c.lineCap='round';
  for(const q of posts){c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x,q.y-CH);c.stroke();}
  c.lineCap='butt';
  const tN={x:0,y:HD*.55-cey-CH},tE={x:cex,y:HD*.55-CH},tS={x:0,y:HD*.55+cey-CH},tW={x:-cex,y:HD*.55-CH};
  (function(){const tg=c.createLinearGradient(tW.x,tN.y,tE.x,tS.y);
   tg.addColorStop(0,rgb(mixc(B0,WHITE,.58).r,mixc(B0,WHITE,.58).g,mixc(B0,WHITE,.58).b));
   tg.addColorStop(1,rgb(mixc(B0,WHITE,.10).r,mixc(B0,WHITE,.10).g,mixc(B0,WHITE,.10).b));
   c.fillStyle=tg;c.beginPath();c.moveTo(tN.x,tN.y);c.lineTo(tE.x,tE.y);c.lineTo(tS.x,tS.y);c.lineTo(tW.x,tW.y);c.closePath();c.fill();})();
  // tarp skirt hanging off the two front edges
  (function(){const sk=mixc(B0,AMB,.36);c.fillStyle=rgb(sk.r,sk.g,sk.b);
   c.beginPath();c.moveTo(tE.x,tE.y);c.lineTo(tS.x,tS.y);c.lineTo(tS.x,tS.y+6);c.lineTo(tE.x,tE.y+6);c.closePath();c.fill();
   c.beginPath();c.moveTo(tS.x,tS.y);c.lineTo(tW.x,tW.y);c.lineTo(tW.x,tW.y+6);c.lineTo(tS.x,tS.y+6);c.closePath();c.fill();})();
  // tie-down creases across the deck, then the lit NW eave
  c.save();c.globalAlpha=.3;c.strokeStyle=rgb(mixc(B0,BLACK,.35).r,mixc(B0,BLACK,.35).g,mixc(B0,BLACK,.35).b);c.lineWidth=1;
  for(const uu of [.28,.5,.72]){c.beginPath();c.moveTo(tW.x+(tN.x-tW.x)*uu,tW.y+(tN.y-tW.y)*uu);c.lineTo(tS.x+(tE.x-tS.x)*uu,tS.y+(tE.y-tS.y)*uu);c.stroke();}
  c.restore();
  c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.4)';c.lineWidth=1.4;
  c.beginPath();c.moveTo(tW.x,tW.y);c.lineTo(tN.x,tN.y);c.stroke();c.restore();
  c.fillStyle='#e8f0d8';c.font='bold 12px sans-serif';c.textAlign='center';c.fillText('🪖',0,tN.y+HD*.62);c.textAlign='left';
 }
}
/* animated building parts drawn live over the baked hull */
function bldLive(c,b,col){
 const k=b.key,sz=b.sz,S=sz*HW,HD=sz*HH;
 const B0=hx2rgb(col),deep=mixc(B0,AMB,.55);
 if(k==='hq'){
  const mx=-S*.5, mtop=HD*.55-60;
 const wv=Math.sin(G.tick*.12+b.id)*2.5;c.fillStyle=col;c.beginPath();c.moveTo(mx,mtop);c.quadraticCurveTo(mx+13,mtop+2+wv,mx+21,mtop+6+wv);c.lineTo(mx+19,mtop+12+wv);c.quadraticCurveTo(mx+11,mtop+9,mx,mtop+10);c.closePath();c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.25)';c.beginPath();c.moveTo(mx,mtop);c.quadraticCurveTo(mx+13,mtop+2+wv,mx+21,mtop+6+wv);c.lineTo(mx+20,mtop+8+wv);c.quadraticCurveTo(mx+11,mtop+5,mx,mtop+4);c.closePath();c.fill();c.restore();
 }
 else if(k==='lab'){
  const body={topY:HD*.55-20};
  c.save();c.globalCompositeOperation='lighter';const gl=.4+Math.sin(G.tick*.13+b.id)*.28;c.globalAlpha=gl;
  c.fillStyle='#9fe8ff';c.beginPath();c.ellipse(0,body.topY-1,S*.3,HD*.3,0,0,7);c.fill();c.restore();
  const bk=.5+Math.sin(G.tick*.22+b.id)*.5;c.save();c.globalCompositeOperation='lighter';c.fillStyle=`rgba(120,230,255,${.4+bk*.5})`;c.beginPath();c.arc(S*.5,body.topY-14,2.4,0,7);c.fill();c.restore();
 }
 else if(k==='helipad'){
  const py=HD*.55-9;
  const blink=.5+Math.sin(G.tick*.2+b.id)*.5;
  for(const cor of [[-S*.66,py],[S*.66,py],[0,py-HD*.66],[0,py+HD*.66]]){c.save();c.globalCompositeOperation='lighter';c.fillStyle=`rgba(255,90,60,${.4+blink*.5})`;c.beginPath();c.arc(cor[0],cor[1],2.4,0,7);c.fill();c.restore();}
 }
 else if(k==='generator'){
  const P={cx:0,baseY:HD*.55,hw:S*.72,hd:HD*.72,H:18};
  c.save();c.globalCompositeOperation='lighter';const pulse=.45+Math.sin(G.tick*.15+b.id)*.3;c.globalAlpha=pulse;c.fillStyle='#fff04d';quadPatch(c,wallCorners(P,1),.24,.14,.46,.7);c.fill();c.restore();
 }
 else if(k==='turbine'){
  c.save();c.translate(0,-40);c.rotate(G.tick*.06+b.id);
  for(let i=0;i<3;i++){c.rotate(Math.PI*2/3);const bg=c.createLinearGradient(0,0,0,-19);bg.addColorStop(0,'#ffffff');bg.addColorStop(1,'#b8bec6');c.fillStyle=bg;c.beginPath();c.moveTo(-1.5,0);c.lineTo(1.5,0);c.lineTo(.6,-19);c.lineTo(-.5,-19);c.closePath();c.fill();}
  c.restore();
  plSphere(c,'#e4e8ec',0,-40,3,1,false);
 }
 else if(k==='guardtower'){
  const plat={topY:-32};
  const gy=plat.topY-2;
  plSphere(c,shade(col,1.05),0,gy,6.5,.7,false);
  const a2=screenAng(b.tface||0); // v27.1: tolerate snapshots with no aim
  const barc=mixc(B0,BLACK,.28);
  plLimb(c,rgb(barc.r,barc.g,barc.b),0,gy-1,Math.cos(a2)*16,gy-1+Math.sin(a2)*8,3.6);
  c.fillStyle='#1a1a1c';c.beginPath();c.ellipse(Math.cos(a2)*16,gy-1+Math.sin(a2)*8,1.4,1.6,0,0,7);c.fill();
  glint(c,-2,gy-2,.8);
 }
 else if(k==='radar'){
  const body={topY:HD*.55-14};
  c.save();c.translate(0,body.topY-28);c.rotate(Math.sin(G.tick*.04)*.7);
  (function(){const dg=c.createLinearGradient(-11,-6,9,7);dg.addColorStop(0,'#fafcff');dg.addColorStop(1,'#aeb6c0');c.fillStyle=dg;c.beginPath();c.ellipse(0,0,12,6.5,-.5,0,7);c.fill();})();
  c.fillStyle='#8a9098';c.beginPath();c.ellipse(1.6,1.6,6.5,3.6,-.5,0,7);c.fill();
  c.fillStyle='#4a4e54';c.fillRect(-.8,0,1.6,7);
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.5)';c.beginPath();c.ellipse(-3.4,-2.6,3.2,1.7,-.5,0,7);c.fill();c.restore();
  c.restore();
 }
 else if(k==='bunker'){
  const body={topY:HD*.55-12};
  const gar=b.garrison||[]; // v27.1: ghost snapshots carry an empty garrison
  if(gar.length){c.fillStyle='#fff';c.font='bold 10px sans-serif';c.textAlign='center';c.fillText(gar.length+'/'+garCap(b),0,body.topY-S*.5);c.textAlign='left';}
 }
 else if(k==='foundry'){
  // v87: the pour spout breathes. Same clock every other live overlay reads
  // (G.tick and the building id), never srand - this is the render layer.
  const body={topY:HD*.55-15};
  const gl=.45+Math.sin(G.tick*.09+b.id)*.35;
  c.save();c.globalCompositeOperation='lighter';c.globalAlpha=gl*.8;
  const g=c.createRadialGradient(S*.22,body.topY+HD*.2,1,S*.22,body.topY+HD*.2,S*.5);
  g.addColorStop(0,'rgba(255,180,80,.75)');g.addColorStop(.5,'rgba(255,120,30,.3)');g.addColorStop(1,'rgba(255,110,20,0)');
  c.fillStyle=g;c.beginPath();c.ellipse(S*.22,body.topY+HD*.2,S*.5,HD*.5,0,0,7);c.fill();
  c.restore();c.globalAlpha=1;
 }
 else if(k==='cmdpost'){
  // v86: the standard on the pole baked above it. Same wave the HQ and the Outpost
  // pennants already use, so all three flags in the game move as one idea.
  const ptop=HD*.55-13-34+1,px=S*.5;
  const wv=Math.sin(G.tick*.11+b.id)*2.2;c.fillStyle=col;
  c.beginPath();c.moveTo(px,ptop);c.quadraticCurveTo(px-10,ptop+2+wv,px-17,ptop+5+wv);c.lineTo(px-16,ptop+11+wv);c.quadraticCurveTo(px-9,ptop+8,px,ptop+9);c.closePath();c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.22)';
  c.beginPath();c.moveTo(px,ptop);c.quadraticCurveTo(px-10,ptop+2+wv,px-17,ptop+5+wv);c.lineTo(px-16,ptop+7+wv);c.quadraticCurveTo(px-9,ptop+4,px,ptop+3);c.closePath();c.fill();c.restore();
 }
 else if(k==='outpost'){
  const body={topY:HD*.3-16},px=S*.34,ptop=body.topY-16;
  const wv=Math.sin(G.tick*.12+b.id)*2;c.fillStyle=col;c.beginPath();c.moveTo(px,ptop);c.quadraticCurveTo(px+11,ptop+2+wv,px+18,ptop+5+wv);c.lineTo(px+17,ptop+10+wv);c.quadraticCurveTo(px+9,ptop+7,px,ptop+8);c.closePath();c.fill();
 }
}


