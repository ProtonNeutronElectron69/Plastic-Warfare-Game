/* ---------------- FIELD MANUAL (setup-screen info panel) ----------------
   Pure UI/render layer: reads the U/B/FAC tables and reuses the in-game painters
   (drawUnit / drawBld / bldLive / drawItemShadow / drawBarricade) on a private
   canvas. Those painters read the global G (tick / orgX / neutral), so every
   manual draw swaps in a tiny stub G and restores the real one in a finally
   block within the same synchronous callback - the main frame() loop never sees
   the stub. Touches no sim state, no sim RNG stream, nothing hashed or
   serialized. Only reachable from the setup screen (G===null there). */
const INFO={open:false,tab:'units',kind:null,key:null,fake:null,raf:0,t:0,ground:null,
 /* units/blds: the preview draws ONE entity against an empty world, but the
    renderer still sweeps the entity lists - rallied() walks G.units to decide
    whether an infantryman wears a Sarge glow. The stub carried no such array,
    so every drawUnit call for a foot soldier threw "G.units is not iterable"
    and infoLoop's empty catch swallowed it: the shadow is drawn in a SEPARATE
    try above, so it landed and the man himself silently did not. Empty arrays
    are also the honest answer here - in a preview there is no other unit to
    find, and rallied() correctly returns false instead of throwing. */
 stub:{tick:0,orgX:0,neutral:null,human:null,units:[],blds:[]}};
/* --- THE GALLERY ORDER, ADDED AT v88.1 ---
   Both lists were Object.keys order, i.e. the order the tables happen to be
   written in, which is roughly the order things were ADDED to the game. That is a
   development record and not a reading order: v88's Choktaw sat between the
   Firebomb and the APC because that is when it was written.
   Units are grouped by the building that trains them - Barracks, then Garage,
   then Helipad - and each group runs cheapest to dearest by TOTAL cost. The
   grouping is prodBldOf, the same function the build menus and the Foundry read,
   so a unit cannot appear under one heading here and another there.
   Structures are one run, cheapest to dearest, with no grouping.
   Both sorts break ties on key name for the same reason SUP_U does: a comparator
   that returns 0 leaves the order to the engine, and a gallery that reshuffles
   between loads is a gallery nobody can point at. */
const INFO_COST=k=>(U[k]?U[k].cp+U[k].ce:B[k].cp+B[k].ce);
const INFO_BLD_ORDER=['barracks','garage','helipad'];
const INFO_UNITS=(function(){
 const byBld={};for(const b of INFO_BLD_ORDER)byBld[b]=[];
 const other=[];
 for(const k in U){const b=prodBldOf(k);(byBld[b]||other).push(k)}
 /* noTrain rides at the END of its group whatever it costs. The Paratrooper is
    cp 0 because he is dropped rather than bought, and a plain cost sort put a
    free unit at the head of the Barracks column - which reads as "the cheapest
    thing you can build" and is the one thing he is not. */
 const cmp=(a,b)=>((U[a].noTrain?1:0)-(U[b].noTrain?1:0))||(INFO_COST(a)-INFO_COST(b))||(a<b?-1:a>b?1:0);
 const out=[];
 for(const b of INFO_BLD_ORDER)out.push(...byBld[b].sort(cmp));
 return out.concat(other.sort(cmp)); // nothing lands here today; prodBldOf answers for every row
})();
const INFO_BLDS=(function(){
 const cmp=(a,b)=>(INFO_COST(a)-INFO_COST(b))||(a<b?-1:a>b?1:0);
 return Object.keys(B).filter(k=>k!=='nest'&&!B[k].lvl).sort(cmp); // nests draw from the map layer, not drawBld. v107: level art (t.lvl) is scenery, not a structure you build
})();
/* Read off FAC rather than retyped. These two lists answer "is this entity a
   faction exclusive", which is a question FAC already answers: uu is an army's
   exclusive units and ub its exclusive building. The line just below this pair
   ALREADY searches FAC to decide WHICH army an exclusive belongs to, so a typed
   copy here meant one table deciding ownership and a hand-kept list deciding
   membership - they agreed only for as long as someone remembered to edit both.
   Wildlife contributes nothing: both of its lists are empty.
   v85: ub became an array, so the two lines are now the same line twice. They are
   also the answer techAvailable reads, which is why they are not just an info-panel
   concern - see the note on that function. */
const INFO_FEXCL_U=Object.values(FAC).flatMap(f=>f.uu||[]);
const INFO_FEXCL_B=Object.values(FAC).flatMap(f=>f.ub||[]);
/* v88.1: the DEFAULT is Green rather than the reader's own army. A shared unit is
   shared, and painting it in whichever army happens to be selected made the manual
   say something about ownership that is not true - a Grunt is not a Green Grunt.
   One colour for "anyone can build this" and the owning army's colour for "only
   they can" is the whole distinction the gallery is trying to draw, and it now
   draws it. v46's behaviour (open it mid-match, see YOUR army) is deliberately
   retired: it made the same tile change colour between two readings of the same
   page, which is exactly what a reference must not do. */
const INFO_COMMON_FAC='green';
function infoFacOf(kind,key){ // faction exclusives show in their home army's colors
 if(kind==='unit'&&INFO_FEXCL_U.includes(key))return Object.keys(FAC).find(f=>FAC[f].uu&&FAC[f].uu.includes(key))||INFO_COMMON_FAC;
 if(kind==='bld'&&INFO_FEXCL_B.includes(key))return Object.keys(FAC).find(f=>FAC[f].ub&&FAC[f].ub.includes(key))||INFO_COMMON_FAC;
 return INFO_COMMON_FAC;
}
function infoStub(fn){const real=G;G=INFO.stub;try{fn()}finally{G=real}}
/* --- 5x5 backyard grass patch, baked once. Mirrors renderTerrain's grass tile
       fill, bevel facets, flock and slab skirt at miniature scale, with a LOCAL
       mulberry rng (never the sim stream). --- */
const INFO_G_DEPTH=18,INFO_G_PAD=4;
function infoGround(){
 if(INFO.ground)return INFO.ground;
 const NP=5,gw=NP*TW+8,gh=INFO_G_PAD+NP*TH+INFO_G_DEPTH+14;
 const cv=document.createElement('canvas');cv.width=gw;cv.height=gh;
 const c=cv.getContext('2d'),rnd=mulberry(0x5eed);
 const PAL={base:'#5d9440',alt:'#558a38',side:'#2f4d20',sideD:'#223a17'};
 const ox=gw/2,oy=INFO_G_PAD;
 const ix=(x,y)=>(x-y)*HW+ox, iy=(x,y)=>(x+y)*HH+oy;
 const E=[ix(NP,0),iy(NP,0)],S=[ix(NP,NP),iy(NP,NP)],Wp=[ix(0,NP),iy(0,NP)];
 // contact shadow cast onto the "table" below the mini slab
 {const sg=c.createLinearGradient(0,S[1]+INFO_G_DEPTH,0,S[1]+INFO_G_DEPTH+12);
  sg.addColorStop(0,'rgba(0,0,0,.28)');sg.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=sg;
  c.beginPath();c.moveTo(Wp[0],Wp[1]+INFO_G_DEPTH);c.lineTo(S[0],S[1]+INFO_G_DEPTH+5);c.lineTo(E[0],E[1]+INFO_G_DEPTH);
  c.lineTo(E[0]+9,E[1]+INFO_G_DEPTH+9);c.lineTo(S[0],S[1]+INFO_G_DEPTH+14);c.lineTo(Wp[0]-9,Wp[1]+INFO_G_DEPTH+9);c.closePath();c.fill();}
 // SW slab face (catches fill light) then deeper SE face
 {const g=c.createLinearGradient(0,Wp[1],0,Wp[1]+INFO_G_DEPTH);g.addColorStop(0,PAL.side);g.addColorStop(1,PAL.sideD);c.fillStyle=g;
  c.beginPath();c.moveTo(Wp[0],Wp[1]);c.lineTo(S[0],S[1]);c.lineTo(S[0],S[1]+INFO_G_DEPTH);c.lineTo(Wp[0],Wp[1]+INFO_G_DEPTH);c.closePath();c.fill();}
 {const g=c.createLinearGradient(0,E[1],0,E[1]+INFO_G_DEPTH);g.addColorStop(0,PAL.sideD);g.addColorStop(1,shade(PAL.sideD,.72));c.fillStyle=g;
  c.beginPath();c.moveTo(S[0],S[1]);c.lineTo(E[0],E[1]);c.lineTo(E[0],E[1]+INFO_G_DEPTH);c.lineTo(S[0],S[1]+INFO_G_DEPTH);c.closePath();c.fill();}
 c.save();c.globalCompositeOperation='lighter';c.strokeStyle='rgba(255,255,255,.22)';c.lineWidth=2;
 c.beginPath();c.moveTo(Wp[0],Wp[1]);c.lineTo(S[0],S[1]);c.lineTo(E[0],E[1]);c.stroke();c.restore();
 // ground tiles: the board's own painter, at miniature scale
 for(let y=0;y<NP;y++)for(let x=0;x<NP;x++){
  const v=.92+rnd()*.16;
  paintIsoTile(c,ix(x,y),iy(x,y),shade(((x*7+y*5)%9<2)?PAL.alt:PAL.base,v));
 }
 // grass flock + a few blades
 for(let i=0;i<70;i++){const gx=rnd()*NP,gy=rnd()*NP,px=ix(gx,gy),py=iy(gx,gy)+HH*rnd()*.5;
  c.fillStyle=rnd()<.5?'rgba(214,240,150,.16)':'rgba(22,42,14,.18)';c.fillRect(px,py,1.4,1.4);}
 c.lineWidth=1.1;c.lineCap='round';
 for(let i=0;i<12;i++){const gx=.3+rnd()*(NP-.6),gy=.3+rnd()*(NP-.6),px=ix(gx,gy),py=iy(gx,gy)+HH*.5;
  c.strokeStyle=rnd()<.5?'rgba(56,104,32,.5)':'rgba(126,188,74,.45)';
  c.beginPath();c.moveTo(px,py);c.quadraticCurveTo(px+(rnd()*2-1)*2,py-3,px+(rnd()*2-1)*3,py-4-rnd()*3);c.stroke();}
 INFO.ground=cv;return cv;
}
/* --- fake showcase entities: the minimal field set the painters read --- */
function infoFake(kind,key){
 const fac=infoFacOf(kind,key);
 if(kind==='unit'){
  const t=U[key];
  return {kind:'unit',key,t,p:{fac,human:false},x:2.5,y:2.5,face:Math.PI*.15,id:3,hp:t.hp,mhp:t.hp,
   sel:false,vr:0,hold:false,rot:0,flash:0,mining:false,cargo:0,path:[1],wp:0, // path/wp force the walk cycle
   healedAt:null,target:null,tface:0,garrison:[],entrenched:false};
 }
 const t=B[key],sz=t.sz,tx=Math.floor((5-sz)/2),ty=Math.floor((5-sz)/2);
 return {kind:'bld',key,t,sz,p:{fac,human:false},tx,ty,x:tx+sz/2,y:ty+sz/2,id:3,hp:t.hp,mhp:t.hp,
  sel:false,prog:1,upg:false,tface:0,garrison:[],rally:{x:2.5,y:2.5},healedAt:null};
}
/* --- portrait tiles for the grid (v27 crop recipe; barricade live-paints) --- */
function infoPortraitCv(kind,key,fac){
 const Pz=56,cv=document.createElement('canvas');cv.width=Pz;cv.height=Pz;const c=cv.getContext('2d');
 const grd=c.createLinearGradient(0,0,Pz,Pz);grd.addColorStop(0,'#33402a');grd.addColorStop(1,'#141b0e');
 c.fillStyle=grd;c.fillRect(0,0,Pz,Pz);
 try{
  if(kind==='unit'){
   const t=U[key];
   if(t.a==='inf'){
    const cell=SPR.inf[key]&&SPR.inf[key][fac]&&SPR.inf[key][fac][2];
    if(cell&&cell.cv&&cell.cv.width){
     let sx=0,sy=0,sw=cell.cv.width,sh=cell.cv.height;
     sh*=.62;sw*=.62;sx=(cell.cv.width-sw)/2; // head & torso crop
     const s2=Math.min((Pz-8)/sw,(Pz-8)/sh),dw=sw*s2,dh=sh*s2;
     c.imageSmoothingEnabled=true;
     c.drawImage(cell.cv,sx,sy,sw,sh,(Pz-dw)/2,(Pz-dh)/2,dw,dh);
    }
   }
   else vehPortraitPaint(c,key,fac,Pz,8); // v49: hull + live turret, same painter as the in-game tile
  }else if(B[key].barr){
   /* v88.1: keyed on t.barr, and the stub carries a real `t`. Two faults, both
      introduced at v88 and both invisible until the gallery was reordered and the
      walls landed in the first two cells:
        - the Heavy Barricade fell through to SPR.bld, which is empty for a wall
          because neither wall is baked - it drew nothing at all;
        - drawBarricade reads b.t.hbarr to pick its silhouette, and this stub had
          no `t`, so the ORDINARY wall threw into the try below and drew nothing
          either. The thumbnail had been blank since v88 and nothing said so.
      T30.C's sweep was fixed to pass a real row at v88; this call site is the one
      it does not reach, so tail_v88_1 covers it directly. */
   infoStub(()=>{c.save();c.translate(Pz/2,Pz/2);c.scale(1.7,1.7);
    drawBarricade(c,{key,t:B[key],p:{fac},prog:1},0,6);c.restore();});
  }else{
   const cell=SPR.bld[key]&&SPR.bld[key][fac];
   if(cell&&cell.cv&&cell.cv.width){
    const s2=Math.min((Pz-8)/cell.w,(Pz-8)/cell.h),dw=cell.w*s2,dh=cell.h*s2;
    c.imageSmoothingEnabled=true;
    c.drawImage(cell.cv,(Pz-dw)/2,(Pz-dh)/2,dw,dh);
   }
  }
 }catch(e){}
 return cv;
}
/* --- counter readout, generated straight from WVA/UVA so it tracks the sim --- */
function counterList(key,wc,strong){ // v46: long labels for the info card, same scan as the tooltips
 return counterScan(key,wc,strong).map(e=>ARMOR_LABEL[e[0]]+' \u00d7'+infoFmt(e[1])).join(', ');
}
function counterHtml(key,wc){
 const s=counterList(key,wc,true),wk=counterList(key,wc,false);
 return infoRow('Strong vs',s||'\u2014 (no bonus)')+infoRow('Weak vs',wk||'\u2014 (no penalty)');
}
/* --- stat readout: post-load-scale table values = the real in-game numbers --- */
function infoFmt(v){return (Math.round(v*100)/100).toString()}
function infoRow(label,val){return (val==null||val==='')?'':'<div class="istat"><b>'+label+'</b><span>'+val+'</span></div>'}
function infoStatsHtml(kind,key){
 const IFOOT='<div class="ifoot">Baseline values \u2014 your army\u2019s faction modifiers (cost / HP / damage / speed) and researched upgrades apply on top.</div>';
 if(kind==='unit'){
  const t=U[key],fac=infoFacOf('unit',key);
  /* v77 D2: this was a seven-key copy of the nine-row WC_LABEL, two rows short.
     Nothing rendered blank only because no unit currently fires row d or row q;
     the Paratrooper's HE charge and the barrage would both have. One table now. */
  const W=WC_LABEL[t.w]||null;
  let sp='';
  if(t.fly)sp+='Flies over terrain, water, walls & landmines. ';
  if(t.aaOnly)sp+='Engages AIRCRAFT ONLY \u2014 it cannot fire on ground units or structures at all. ';
  if(t.sal)sp+='Fires a '+t.sal+'-missile salvo, then reloads for '+t.rt+'s. ';
  /* v88: reads the row rather than naming the Bull's hose, now that a second unit
    carries a secondary and it is a machine gun. */
 if(t.sec)sp+=(t.sec.w==='b'?'Door gun engages':'Hull flamethrower burns')+' infantry & wildlife within '+t.sec.rg+' tiles on its own target, at the same time as the main gun. ';
  if(t.spl)sp+='Splash damage (radius '+t.spl+'). ';
  if(t.entrench)sp+='Can entrench: locked '+Math.round(CONE_HALF*2*180/Math.PI)+'\u00b0 cone, '+ENTRENCH_RATE+'\u00d7 fire rate. ';
  if(t.heal)sp+='Passively heals allied units & structures within '+(t.healR||MEDIC_HEAL_RADIUS)+' tiles. '
  +'Moving with a group, it keeps station on the squad it is covering and spreads out from other medics. ';
  if(t.cap)sp+='Transports '+t.cap+' infantry; troops bail out at 85% HP if it is destroyed. ';
  if(t.shield)sp+='Shields itself & nearby allied infantry (-25% damage from every source, never stacks). ';
  if(t.aura)sp+='Allied infantry within '+t.auraR+' tiles deal '+Math.round(t.aura*100)+'% more damage (does not stack with a second carrier). ';
  if(t.lim)sp+='Limit 1 in the field. ';
  return '<h3>'+t.n+'</h3><div class="isub">'+t.d+'</div>'
   +infoRow('Cost',key==='para'?'Free \u2014 arrives only via the \ud83e\ude82 Paradrop call-down':t.cp+' \u2b22'+(t.ce?' + '+t.ce+' \u26a1':''))
   +infoRow('Hit points',t.hp)
   +infoRow('Damage',t.dm>0?(t.sal?infoFmt(t.dm)+' \u00d7'+t.sal+' salvo, then a '+t.rt+'s reload':infoFmt(t.dm)+' per shot, every '+t.rt+'s')+' (\u2248'+infoFmt(unitDPS(t))+' DPS)':'Unarmed') // v51: unitDPS == dm/rt for every non-salvo unit
   +infoRow('Weapon',t.dm>0?W:null)
   +infoRow('Armor',ARMOR_LABEL[armorOf({kind:'unit',t})])
   +(key==='para'
     ?infoRow('SMG',counterList('para','b',true))+infoRow('AT grenade',counterList('para','r',true))+infoRow('HE charge',counterList('para','d',true))
     :(t.dm>0?counterHtml(key,t.w):''))
   +infoRow('Range',t.rg>0?t.rg+' tiles'+(t.mrg?' (min '+t.mrg+')':''):null)
   +infoRow('Speed',infoFmt(t.sp)+' tiles/s')
   +infoRow('Sight',t.vi+' tiles')
   +infoRow('Supply',supOf(key)+' \ud83e\udd96 of '+SUP_CAP)
  +infoRow('Build time',key==='para'?null:infoFmt(t.bt)+'s')
   +infoRow('Trained at',key==='para'?'Radio Tower (call-down)':B[prodBldOf(key)].n)
   +infoRow('Unlock',t.tech?'Research at the '+B[TECH_BLD[t.tech]||'lab'].n:'Available from the start')
   +infoRow('Availability',INFO_FEXCL_U.includes(key)?FAC[fac].name+' exclusive':'All armies')
   +(sp?infoRow('Special',sp):'')+IFOOT;
 }
 const t=B[key],fac=infoFacOf('bld',key);
 let sp='';
 if(t.drop)sp+='Resource drop-off point. ';
 if(t.eps)sp+='Generates '+t.eps+' \u26a1/sec. ';
 if(t.gar)sp+='Garrisons '+t.gar+' infantry ('+Math.round(t.gar*((UPGRADES[key]&&UPGRADES[key].eff)||1))+' upgraded); they fire out. ';
 if(t.lab)sp+='Runs one research project at a time; build several to research in parallel. ';
 if(t.radio)sp+='Opens the call-down panel: '+radioAbilityList()+' \u2014 one shared '+radioCDText()+' cooldown. ';
 if(t.anywhere)sp+='Can be placed anywhere you have vision, even far from base. ';
 if(t.lim)sp+='Limit 1. ';
 if(t.barr)sp+='Blocks ground movement; click-and-drag to lay a whole line. ';
 const reqs=[];
 if(t.req)reqs.push(B[t.req].n+' built');
 if(t.tech)reqs.push('research at the '+B[TECH_BLD[t.tech]||'lab'].n);
 return '<h3>'+t.n+'</h3><div class="isub">'+t.d+'</div>'
  +infoRow('Cost',key==='hq'?'\u2014 (you start with one)':t.cp+' \u2b22'+(t.ce?' + '+t.ce+' \u26a1':''))
  +infoRow('Hit points',t.hp)
  +infoRow('Footprint',t.sz+'\u00d7'+t.sz+' tiles')
  +infoRow('Supply',t.sup?'+'+t.sup+' \ud83e\udd96 (army capacity)':null)
  +infoRow('Build time',infoFmt(t.bt)+'s')
  +infoRow('Sight',t.vi?t.vi+' tiles':null)
  +infoRow('Weapon',t.dm?infoFmt(t.dm)+' dmg every '+t.rt+'s, '+t.rg+'-tile range, fires on its own':null)
  +infoRow('Armor',ARMOR_LABEL.bldg)
  +(t.dm?counterHtml(key,WC_BLD[key]||'b'):'')
  +infoRow('Produces',t.prod?t.prod.map(k2=>U[k2].n).join(', '):null)
  +infoRow('Requires',reqs.length?reqs.join(', plus '):'Nothing \u2014 buildable from the start')
  +infoRow('Sell value',key==='hq'?'Cannot be sold':Math.round(t.cp*SELL_FRAC)+' \u2b22 ('+Math.round(SELL_FRAC*100)+'%)')
  +infoRow('Availability',INFO_FEXCL_B.includes(key)?FAC[fac].name+' exclusive':'All armies')
  +(sp?infoRow('Special',sp):'')+IFOOT;
}
/* --- grid / tabs / selection --- */
function infoBuildGrid(){
 const grid=document.getElementById('infoGrid');grid.innerHTML='';
 const kind=INFO.tab==='units'?'unit':'bld';
 for(const k of (INFO.tab==='units'?INFO_UNITS:INFO_BLDS)){
  const t=kind==='unit'?U[k]:B[k];
  const cell=document.createElement('div');
  cell.className='icell'+(INFO.kind===kind&&INFO.key===k?' sel':'');
  cell.appendChild(infoPortraitCv(kind,k,infoFacOf(kind,k)));
  const nm=document.createElement('div');nm.className='inm';nm.textContent=t.n;cell.appendChild(nm);
  cell.onclick=()=>{infoSelect(kind,k)};
  grid.appendChild(cell);
 }
}
function infoSelect(kind,key){
 INFO.kind=kind;INFO.key=key;INFO.fake=infoFake(kind,key);
 document.getElementById('infoStats').innerHTML=infoStatsHtml(kind,key);
 infoBuildGrid();
}
function infoShowTab(tab){
 INFO.tab=tab;
 document.querySelectorAll('#infoHead .itab').forEach(b=>b.classList.toggle('sel',b.dataset.itab===tab));
 const ctrl=tab==='controls';
 document.getElementById('infoGrid').style.display=ctrl?'none':'grid';
 document.getElementById('infoDetail').style.display=ctrl?'none':'flex';
 document.getElementById('infoControls').style.display=ctrl?'block':'none';
 if(!ctrl){
  const kind=tab==='units'?'unit':'bld';
  if(INFO.kind!==kind)infoSelect(kind,(tab==='units'?INFO_UNITS:INFO_BLDS)[0]);
  else infoBuildGrid();
 }
}
/* --- live preview loop: stub tick advances at the sim's 30 Hz feel --- */
function infoLoop(){
 if(!INFO.open){INFO.raf=0;return}
 INFO.raf=requestAnimationFrame(infoLoop);
 if(INFO.tab==='controls'||!INFO.fake)return;
 const cv=document.getElementById('infoCv'),c=cv.getContext('2d');
 INFO.t+=.5;
 const f=INFO.fake;
 if(f.kind==='unit'){
  /* v65: the "slow showcase turn" rotated the whole body once every ~6 seconds,
     which is the same spin defect by intent rather than by accident. The preview
     now holds the frame-0 three-quarter pose infoFake sets (Math.PI*.15). Moving
     PARTS stay: the rotor below, and the guard tower's gun sweep. Turret hulls
     settle on their own - with no target drawUnit's turret goal is f.face, so
     f.tvis eases to the frozen hull angle and the barrel centres. */
  if(f.t.a==='heli')f.rot=(f.rot||0)+.5;         // rotor spin
 }else if(f.key==='guardtower'){f.tface=(f.tface+.008)%(Math.PI*2)} // gun sweep
 const g=infoGround();
 c.clearRect(0,0,cv.width,cv.height);
 // vertical extents in stub world space (orgX=0: world (0,0) -> screen (0,0))
 const K=f.kind==='unit'?(USCALE[f.key]||1):1;
 const topY=f.kind==='bld'
  ? (f.x+f.y)*HH+((BLD_BOX[f.key]||[-70,-70,70,60])[1])
  : 5*HH-(f.t.fly?34:0)-46*K;
 const botY=10*HH+INFO_G_DEPTH+12;
 const sc=Math.min(f.kind==='unit'?1.9:1.5,(cv.height-20)/(botY-topY),(cv.width-16)/g.width);
 c.save();
 c.translate(cv.width/2,cv.height/2);
 c.scale(sc,sc);
 c.translate(0,-(topY+botY)/2);
 c.drawImage(g,-g.width/2,-INFO_G_PAD);
 infoStub(()=>{
  INFO.stub.tick=INFO.t;
  try{drawItemShadow(c,[0,0,f,f.kind]);}catch(e){}
  try{if(f.kind==='unit')drawUnit(c,f);else drawBld(c,f);}catch(e){}
 });
 c.restore();
}
function openInfo(){
 bakeSprites(); // standalone: no G, no sim-RNG use; one-time (same bake a match does)
 INFO.open=true;document.getElementById('infoPanel').classList.add('open');
 // v46: reachable from the top bar during a match too. infoStub swaps G synchronously
 // inside a finally, so frame() can never see the stub; the match is NOT paused (a
 // local pause would desync an online lockstep game, and ? Help already sets that
 // precedent), it just stops being drawn while the panel covers it.
 document.getElementById('infoClose').textContent=G?'\u2715 Close':'\u2715 Back';
 infoShowTab(INFO.tab||'units');
 if(!INFO.raf)INFO.raf=requestAnimationFrame(infoLoop);
}
function closeInfo(){
 INFO.open=false;document.getElementById('infoPanel').classList.remove('open');
 if(INFO.raf){cancelAnimationFrame(INFO.raf);INFO.raf=0}
}
document.getElementById('infoBtn').onclick=()=>{ac();openInfo()};
document.getElementById('manualBtn').onclick=()=>{openInfo();sClick()};
document.getElementById('infoClose').onclick=()=>{closeInfo()};
document.querySelectorAll('#infoHead .itab').forEach(b=>b.onclick=()=>{infoShowTab(b.dataset.itab)});
/* v98: the manual answers the cursor and the click the same way the setup screen
   does, through the one delegated pair in 03-audio.js. The gallery is rebuilt on
   every tab and on every selection, so per-cell wiring would have to be redone
   on each rebuild; the host outlives all of them. #manualBtn is NOT in here - it
   lives in the HUD and keeps sClick(), because the HUD's voice did not change. */
menuAudioBind(document.getElementById('infoPanel'));
addEventListener('keydown',e=>{if(INFO.open&&e.key==='Escape')closeInfo()});

