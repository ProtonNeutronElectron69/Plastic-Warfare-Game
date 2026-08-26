/* ---------------- WEBRTC GLUE (browser only) ---------------- */
const RTC_CFG={iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}]};
function rtcGather(pc){ // non-trickle: wait for the full candidate set (or 4s)
 return new Promise(res=>{
  if(pc.iceGatheringState==='complete')return res();
  const to=setTimeout(res,4000);
  pc.addEventListener('icegatheringstatechange',()=>{
   if(pc.iceGatheringState==='complete'){clearTimeout(to);res()}
  });
 });
}
async function rtcMakeOffer(onChan){ // host, one per open seat; the blob is bundled by lobInviteCode
 const pc=new RTCPeerConnection(RTC_CFG);
 const ch=pc.createDataChannel('pw',{ordered:true});
 ch.onopen=()=>onChan(ch);
 await pc.setLocalDescription(await pc.createOffer());
 await rtcGather(pc);
 return {pc:pc,ch:ch,blob:sdpBlob(pc.localDescription)};
}
async function rtcTakeAnswer(pc,desc){
 await pc.setRemoteDescription(desc);
}
async function rtcMakeAnswer(desc,onChan){ // joiner, against the seat it picked
 const pc=new RTCPeerConnection(RTC_CFG);
 pc.ondatachannel=ev=>{const ch=ev.channel;ch.onopen=()=>onChan(ch)};
 await pc.setRemoteDescription(desc);
 await pc.setLocalDescription(await pc.createAnswer());
 await rtcGather(pc);
 return {pc:pc,blob:sdpBlob(pc.localDescription)};
}

/* ---------------- INPUT ---------------- */
const KEY={},MOUSE={x:0,y:0,inside:false,down:false,sx:0,sy:0,drag:false};
let mmDown=false;
function screenToWorld(mx,my){return unIso(mx/G.zoom+G.cam.x,my/G.zoom+G.cam.y)}
function pickAt(mx,my){
 const z=G.zoom;
 let best=null,bd=20;
 for(const u of G.units){
  if(u.garrisoned)continue;if(u.p!==G.human&&!visibleToHuman(u))continue;
  const sx=(isoX(u.x,u.y)-G.cam.x)*z,sy=(isoY(u.x,u.y)-G.cam.y)*z-(u.t.fly?40:10)*z;
  const d=Math.hypot(mx-sx,my-sy);if(d<bd*z){bd=d/z;best=u}
 }
 if(best)return best;
 // hostile wildlife
 for(const cr of (G.neutrals||[])){
  if(cr.hp<=0)continue;if(G.fog[Math.floor(cr.y)*G.map.N+Math.floor(cr.x)]!==2)continue;
  const sx=(isoX(cr.x,cr.y)-G.cam.x)*z,sy=(isoY(cr.x,cr.y)-G.cam.y)*z-(cr.t.fly?12:6)*z;
  const d=Math.hypot(mx-sx,my-sy);if(d<bd*z){bd=d/z;best=cr}
 }
 if(best)return best;
 const w=screenToWorld(mx,my);
 for(const b of G.blds){if(b.p!==G.human&&!visibleToHuman(b))continue;if(w.x>=b.tx-.2&&w.x<=b.tx+b.sz+.2&&w.y>=b.ty-.2&&w.y<=b.ty+b.sz+.2)return b;}
 for(const n of G.map.nodes)if(Math.hypot(n.x-w.x,n.y-w.y)<1.6){n.kind='node';return n}
 return null;
}
function setSel(list){for(const s of G.sel)s.sel=false;G.sel=list;for(const s of G.sel)s.sel=true;lastSelSig='';refreshSelPanel();selectionBark(list)}
function clearSel(){setSel([])}
function issueMove(units,w,am,q){if(!units.length)return;submitCmd('move',{ids:units.map(u=>u.id),x:w.x,y:w.y,am:!!am,q:q?1:0});G.parts.push({t:'mk',x:w.x,y:w.y,life:.5,col:am?'#ff6a5a':'#7CFC6E'});}
function rightClick(mx,my,q){ // v29: q = shift held, queue instead of replace
 const own=G.sel.filter(s=>s.p===G.human&&s.hp>0);if(!own.length)return;
 const units=own.filter(s=>s.kind==='unit');
 const w=screenToWorld(mx,my);w.x=clamp(w.x,1,G.map.N-2);w.y=clamp(w.y,1,G.map.N-2);
 if(!units.length){const bids=own.filter(b=>b.kind==='bld'&&b.t.prod).map(b=>b.id);if(bids.length)submitCmd('rally',{bids,x:w.x,y:w.y});G.parts.push({t:'mk',x:w.x,y:w.y,life:.5,col:'#ffec6e'});sClick();return;}
 const tgt=pickAt(mx,my);
 if(tgt&&tgt.kind==='node'){submitCmd('harvest',{ids:units.map(u=>u.id),node:G.map.nodes.indexOf(tgt),x:w.x,y:w.y,q:q?1:0});G.parts.push({t:'mk',x:tgt.x,y:tgt.y,life:.5,col:'#ffb95e'});sClick();return;}
 // right-click a friendly drop-off building (HQ) with trucks selected -> force them to unload now
 if(tgt&&tgt.p===G.human&&tgt.kind==='bld'&&tgt.t.drop&&tgt.prog>=1&&units.some(u=>u.t.a==='truck')){
  submitCmd('dropoff',{ids:units.map(u=>u.id),x:w.x,y:w.y,q:q?1:0});
  if(units.some(u=>u.t.a==='truck'))msg('Dump Trucks heading to HQ to unload.');
  G.parts.push({t:'mk',x:tgt.x,y:tgt.y,life:.5,col:'#7fe3ff'});sClick();return;
 }
 if(tgt&&tgt.p&&!allied(tgt.p,G.human)){submitCmd('attack',{ids:units.map(u=>u.id),tid:tgt.id,q:q?1:0});G.parts.push({t:'mk',x:tgt.x,y:tgt.y,life:.5,col:'#ff6a5a'});sClick();return;}
 if(tgt&&tgt.p===G.human&&tgt.kind==='bld'&&tgt.key==='bunker'&&tgt.prog>=1){submitCmd('garrison',{ids:units.map(u=>u.id),bid:tgt.id,x:w.x,y:w.y});sClick();return;}
 // v30: right-click a friendly transport with infantry selected -> load them aboard
 if(tgt&&tgt.p===G.human&&tgt.kind==='unit'&&tgt.t.cap&&units.some(v=>v!==tgt&&v.t.a==='inf')){
  submitCmd('garrison',{ids:units.filter(v=>v!==tgt).map(v=>v.id),bid:tgt.id,x:w.x,y:w.y});
  msg('Loading the '+tgt.t.n+'.');sClick();return;
 }
 // v26: right-clicking a remembered (ghost) building under partial fog issues an attack-move there
 if(!tgt&&G.ghost)for(const g of G.ghost.blds.values()){if(fogAt(g.x,g.y)!==1)continue;if(w.x>=g.tx-.2&&w.x<=g.tx+g.sz+.2&&w.y>=g.ty-.2&&w.y<=g.ty+g.sz+.2){issueMove(units,w,true,q);sClick();return;}}
 issueMove(units,w,false,q);sClick();
}
// v29: PATROL AIM — two left clicks define the A<->B loop for the captured selection
function handlePatrolClick(mx,my){
 const pa=G.patrolAim;if(!pa)return;
 const w=screenToWorld(mx,my);w.x=clamp(w.x,1,G.map.N-2);w.y=clamp(w.y,1,G.map.N-2);
 pa.pts.push({x:w.x,y:w.y});
 G.parts.push({t:'mk',x:w.x,y:w.y,life:.6,col:'#7CFC6E'});
 if(pa.pts.length<2){msg('Patrol: click the SECOND waypoint.');sClick();return;}
 submitCmd('patrol',{ids:pa.ids,ax:pa.pts[0].x,ay:pa.pts[0].y,bx:pa.pts[1].x,by:pa.pts[1].y});
 G.patrolAim=null;msg('Patrol set.');sClick();
}
function tryPlace(mx,my,keep){
 const key=G.placing.key,sz=B[key].sz,w=screenToWorld(mx,my);
 const tx=Math.round(w.x-sz/2),ty=Math.round(w.y-sz/2),c=bcost(G.human,key);
 if(canPlaceUI(key,tx,ty)&&G.human.res.p>=c.p&&G.human.res.e>=c.e){submitCmd('build',{key,tx,ty});if(!keep)G.placing=null;}
 else if((B[key].barr||B[key].anywhere)&&!footprintVisible(key,tx,ty))msg('Needs vision — you can\u2019t build into the fog of war. Scout it first.');
 else{ // v32: reason-specific placement toasts
  const why=placeDeny(G.human,key,tx,ty);
  if(why==='space')msg(`Too tight: leave ${BUILD_GAP} clear ${BUILD_GAP===1?'tile':'tiles'} around every structure (barricades excepted).`); // v61/v65
  else if(why==='foehq')msg('Too close to an enemy HQ — its 10-tile exclusion zone blocks construction.');
  else if(why==='near')msg(`Needs one of your HQs within ${BUILD_R_HQ} tiles or an Outpost within ${BUILD_R_OUTPOST}.`);
  else msg('Cannot build there — needs clear, unoccupied ground.');
 }
}
// the tile under the cursor for a 1x1 barricade
function barrTileAt(mx,my){const w=screenToWorld(mx,my);return {x:Math.round(w.x-0.5),y:Math.round(w.y-0.5)};}
// rasterize a straight run of tiles between two endpoints (inclusive, deduped)
function barrLineTiles(x0,y0,x1,y1){
 const dx=x1-x0,dy=y1-y0,steps=Math.max(Math.abs(dx),Math.abs(dy));
 if(steps===0)return [{x:x0,y:y0}];
 const out=[];
 for(let i=0;i<=steps;i++){
  const tx=Math.round(x0+dx*i/steps),ty=Math.round(y0+dy*i/steps);
  if(!out.length||out[out.length-1].x!==tx||out[out.length-1].y!==ty)out.push({x:tx,y:ty});
 }
 return out;
}
// commit the dragged barricade line: pay 20 plastic per segment, stop when broke.
// the wall tool stays active afterward (lay more lines) unless plastic runs out.
function placeBarrLine(mx,my){
 if(!G.barrDrag)return;
 const end=barrTileAt(mx,my),cost=bcost(G.human,'barricade');
 const tiles=barrLineTiles(G.barrDrag.x0,G.barrDrag.y0,end.x,end.y);
 let placed=0,broke=false,budget=G.human.res.p;
 const send=[];
 for(const t of tiles){
  if(budget<cost.p){broke=true;break;}
  if(canPlaceUI('barricade',t.x,t.y)){send.push({x:t.x,y:t.y});budget-=cost.p;placed++;}
 }
 if(send.length)submitCmd('barrline',{tiles:send});
 G.barrDrag=null;
 if(broke){msg('Out of plastic — barricade tool closed.');G.placing=null;}
 else if(!placed)msg('Cannot lay barricades there.');
}
function boxSelect(add){
 const z=G.zoom;
 const x1=Math.min(MOUSE.sx,MOUSE.x),x2=Math.max(MOUSE.sx,MOUSE.x),y1=Math.min(MOUSE.sy,MOUSE.y),y2=Math.max(MOUSE.sy,MOUSE.y);
 const got=[],trucksOnly=[];
 for(const u of G.human.units){if(u.garrisoned)continue;const sx=(isoX(u.x,u.y)-G.cam.x)*z,sy=(isoY(u.x,u.y)-G.cam.y)*z-(u.t.fly?40:10)*z;if(sx>=x1&&sx<=x2&&sy>=y1&&sy<=y2){if(u.key==='truck')trucksOnly.push(u);else got.push(u);}}
 // drag-selecting combat units skips only dump trucks; medics ride along with the army.
 // a box that caught ONLY dump trucks still selects them (so they stay box-selectable).
 const pick=got.length?got:trucksOnly;
 if(pick.length)setSel(add?G.sel.concat(pick.filter(u=>!G.sel.includes(u))):pick);
 else if(!add)clearSel();
}
view.addEventListener('mousedown',e=>{
 if(!G||G.over)return;ac();const mx=e.clientX,my=e.clientY;
 if(e.button===0){
  if(G.radioTargeting){handleRadioClick(mx,my);return;}
  if(G.patrolAim){handlePatrolClick(mx,my);return;} // v29: patrol point picking
  if(G.placing){
   // barricades use click-and-drag to lay a whole line; everything else places on click
   if(B[G.placing.key].barr){const t=barrTileAt(mx,my);G.barrDrag={x0:t.x,y0:t.y};return;}
   tryPlace(mx,my,e.shiftKey);return;
  }
  if(G.amove){const w=screenToWorld(mx,my);w.x=clamp(w.x,1,G.map.N-2);w.y=clamp(w.y,1,G.map.N-2);issueMove(G.sel.filter(s=>s.kind==='unit'&&s.p===G.human),w,true);G.amove=false;return;}
  MOUSE.down=true;MOUSE.sx=mx;MOUSE.sy=my;MOUSE.drag=false;
 } else if(e.button===2){if(G.patrolAim){G.patrolAim=null;msg('Patrol cancelled.');return}if(G.radioTargeting){cancelRadioTargeting();return}if(G.placing){G.placing=null;G.barrDrag=null;return}if(G.amove){G.amove=false;return}rightClick(mx,my,e.shiftKey);}
});
// double-click a unit: select every on-screen unit of that same type
function onScreenUnit(u){const z=G.zoom,sx=(isoX(u.x,u.y)-G.cam.x)*z,sy=(isoY(u.x,u.y)-G.cam.y)*z;return sx>=-20&&sx<=vpW()+20&&sy>=-40&&sy<=vpH()+20;} // v97: screen math is CSS px
view.addEventListener('dblclick',e=>{
 if(!G||G.over||G.placing||G.radioTargeting||G.amove)return;
 const t=pickAt(e.clientX,e.clientY);
 if(!t||t.kind!=='unit'||t.p!==G.human)return;
 const list=G.human.units.filter(u=>!u.garrisoned&&u.key===t.key&&onScreenUnit(u));
 if(list.length)setSel(list);
});
// clear an in-progress radio/entrench aim without firing (also drops the ability highlight)
function cancelRadioTargeting(){
 G.radioTargeting=null;lastSelSig='';lastRadioSig='';
}
// resolve a click while a tower call-down / entrench is being aimed
function handleRadioClick(mx,my){
 const rt=G.radioTargeting;
 const w=screenToWorld(mx,my);w.x=clamp(w.x,1,G.map.N-2);w.y=clamp(w.y,1,G.map.N-2);
 if(rt.mode==='entrench'){
  const u=rt.unit;
  if(!u||u.hp<=0||!G.units.includes(u)){cancelRadioTargeting();return;}
  // one gunner, or a whole group — each digs in facing the clicked point from its own spot
  const crew=rt.group&&rt.group.length?rt.group:[u];
  submitCmd('entrench',{ids:crew.filter(g=>g&&g.hp>0).map(g=>g.id),x:w.x,y:w.y});
  G.radioTargeting=null;lastSelSig='';sClick();return;
 }
 if(rt.mode==='paint'){
  const u=rt.unit;
  if(!u||u.hp<=0||!G.units.includes(u)||(u.abCool||0)>0){cancelRadioTargeting();return;}
  submitCmd('paint',{ids:[u.id],x:w.x,y:w.y});
  G.radioTargeting=null;lastSelSig='';sClick();return;
 }
 // v30: call-downs come from the Radio Tower
 const b=rt.bld;
 if(!b||b.hp<=0||!G.blds.includes(b)){cancelRadioTargeting();return;}
 if(b.abilityCool>0){msg(`Radio Tower on cooldown — ${Math.ceil(b.abilityCool)}s.`);cancelRadioTargeting();return;}
 if(radioNeedsVision(rt.mode)&&fogAt(w.x,w.y)!==2){
  msg('Needs vision — pick a target your army can currently see.');return; // keep targeting active
 }
 /* v85: the redeploy is the one call-down whose command carries a payload beyond
    a point, because WHO moves is not derivable from the map. Sent as ids for the
    same reason every other multi-unit command is: the selection is client-local,
    and a peer replaying "the selection" would replay its own. */
 const arg={bid:b.id,mode:rt.mode,x:w.x,y:w.y};
 if(rt.mode==='lift'){
  const men=liftables();
  if(!men.length){msg('Select the infantry you want moved first.');cancelRadioTargeting();return;}
  arg.ids=men.map(g=>g.id);
 }
 submitCmd('radio',arg);
 G.radioTargeting=null;lastSelSig='';lastRadioSig='';sClick();
}
addEventListener('mousemove',e=>{MOUSE.x=e.clientX;MOUSE.y=e.clientY;MOUSE.inside=true;if(MOUSE.down&&Math.hypot(MOUSE.x-MOUSE.sx,MOUSE.y-MOUSE.sy)>4)MOUSE.drag=true;if(mmDown&&G)mmPan(e);});
addEventListener('mouseup',e=>{
 mmDown=false;
 // finish a barricade drag (note: barricade drags don't set MOUSE.down, so handle first)
 if(e.button===0&&G&&!G.over&&G.barrDrag){placeBarrLine(e.clientX,e.clientY);return;}
 if(e.button!==0||!MOUSE.down)return;MOUSE.down=false;if(!G||G.over)return;
 if(MOUSE.drag)boxSelect(e.shiftKey);
 else{const t=pickAt(MOUSE.x,MOUSE.y);if(t&&t.kind==='node'){if(fogAt(t.x,t.y)===2)setSel([t]);else if(!e.shiftKey)clearSel();}else if(t){if(e.shiftKey&&t.p===G.human){if(G.sel.includes(t))setSel(G.sel.filter(s=>s!==t));else setSel(G.sel.concat([t]));}else setSel([t]);}else if(!e.shiftKey)clearSel();}
 MOUSE.drag=false;
});
document.addEventListener('mouseleave',()=>{MOUSE.inside=false});
document.addEventListener('contextmenu',e=>{if(G)e.preventDefault()});
const ZMIN=0.5,ZMAX=2.4;
function setZoom(nz,ax,ay){
 if(!G)return;
 nz=clamp(nz,ZMIN,ZMAX);const z0=G.zoom;if(nz===z0)return;
 // keep the world point under (ax,ay) screen-anchored while zooming
 const wx=ax/z0+G.cam.x, wy=ay/z0+G.cam.y;
 G.zoom=nz;
 G.cam.x=wx-ax/nz; G.cam.y=wy-ay/nz;
 G.cam.x=clamp(G.cam.x,-200,G.terr.width-vpW()/nz+200);
 G.cam.y=clamp(G.cam.y,-150,G.terr.height-vpH()/nz+150);
}
view.addEventListener('wheel',e=>{
 if(!G||G.over)return;e.preventDefault();
 const factor=Math.exp(-e.deltaY*0.0014);
 setZoom(G.zoom*factor, e.clientX, e.clientY);
},{passive:false});
addEventListener('keydown',e=>{
 if(!G||G.over||INFO.open)return;const k=e.key; // v46: the manual is modal - no hotkey leaks through it
 if(k.startsWith('Arrow')){KEY[k]=true;e.preventDefault()}
 else if(k==='w'||k==='W'||k==='a'||k==='A'||k==='d'||k==='D'){KEY[k.toLowerCase()]=true}
 else if(k==='s'||k==='S'){KEY.s2=true}
 /* v73: Q is the HQ shortcut, and the build-menu alphabet is dispatched through
    the registry. The registry is empty unless a menu is on screen, so this is
    context-sensitive without a gate, and MENU_KEYS is disjoint from every branch
    around it, so its position in this chain cannot shadow anything. Modified
    presses fall through: Ctrl+C must still be Ctrl+C. */
 else if((k==='q'||k==='Q')&&!e.ctrlKey&&!e.metaKey&&!e.altKey){hqFocus()}
 else if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&menuHotkey(k)){/* a tile fired */}
 else if(k==='p'||k==='P'){ // v29: patrol — capture the selection, then two clicks aim it
  const ids=G.sel.filter(s=>s.kind==='unit'&&s.p===G.human&&s.hp>0).map(u=>u.id);
  if(ids.length){G.patrolAim={pts:[],ids};msg('Patrol: click the FIRST waypoint (Esc cancels).');}
 }
 else if(k==='Tab'&&(G.test||G.watch)){e.preventDefault();switchArmy((G.human.i+1)%G.players.length);} // v50: cycle armies. v55: in a watch match the same cycle follows an army instead of commanding it
 else if(k==='F9')togglePause(); // v29: pause moved from P
 else if(k==='j'||k==='J'){if(G.lastEvent){G.cam.x=isoX(G.lastEvent.x,G.lastEvent.y)-vpW()/2/G.zoom;G.cam.y=isoY(G.lastEvent.x,G.lastEvent.y)-vpH()/2/G.zoom;pingEvent(G.lastEvent.x,G.lastEvent.y,'#ffe34d');}} // v29: jump-to-event moved from Space
 else if((k==='['||k===']')&&G.watch){watchSpeedStep(k===']'?1:-1);} // v56: step the spectator speed (works with the box hidden)
 else if((k==='v'||k==='V')&&G.watch){watchToggle();} // v55: hide/show the spectator box
 else if(k==='x'||k==='X'){const ids=G.sel.filter(u=>u.kind==='unit'&&u.p===G.human).map(u=>u.id);if(ids.length)submitCmd('halt',{ids})} // v29: stop moved from H
 else if(k===' '){e.preventDefault();const army=G.human.units.filter(u=>!u.garrisoned&&(u.t.a!=='truck'||u.t.heal));if(army.length)setSel(army);} // v42: medics join the army-select; dump trucks still stay put
 else if(k==='Escape'){if(G.patrolAim){G.patrolAim=null;msg('Patrol cancelled.')}else if(G.radioTargeting){cancelRadioTargeting()}else if(G.placing){G.placing=null;G.barrDrag=null;}else if(G.amove)G.amove=false;else clearSel()}
 else if(k==='f'||k==='F'){if(G.sel.some(s=>s.kind==='unit'&&s.p===G.human))G.amove=true}
 else if(k==='h'||k==='H'){const ids=G.sel.filter(u=>u.kind==='unit'&&u.p===G.human).map(u=>u.id);if(ids.length){submitCmd('hold',{ids});msg('Holding position.')}} // v29: hold position
 else if(k==='u'||k==='U'){const car=G.sel.filter(s=>s.kind==='unit'&&s.p===G.human&&s.t.cap&&s.garrison&&s.garrison.length);const ids=car.filter(dropOk).map(s=>s.id);if(ids.length){submitCmd('unloadu',{ids});msg('Unloading.')}else if(car.length)msg('No clear ground below.')} // v30: unload a transport; v46: refuse over open water
 else if(k==='b'||k==='B'){ // preview the blast FX at the cursor (no damage); player-facing, documented in Help
  const w=screenToWorld(MOUSE.x,MOUSE.y);
  spawnExplosion(w.x,w.y,e.shiftKey?2.2:1.2);stampScorch(w.x,w.y,e.shiftKey?22:12);G.shake=Math.max(G.shake,e.shiftKey?6:3);sfxBoom(w.x,w.y,e.shiftKey?'huge':'big');
 }
 else if(k==='+'||k==='='){setZoom(G.zoom*1.2,vpW()/2,vpH()/2)}
 else if(k==='-'||k==='_'){setZoom(G.zoom/1.2,vpW()/2,vpH()/2)}
 else if(k==='0'){setZoom(1,vpW()/2,vpH()/2)}
 else if(/^[1-9]$/.test(k)){
  if(e.ctrlKey||e.metaKey){G.groups[k]=G.sel.filter(s=>s.kind==='unit'&&s.p===G.human);e.preventDefault();msg('Group '+k+' set ('+G.groups[k].length+' units)')}
  else{const g=(G.groups[k]||[]).filter(u=>u.hp>0&&G.units.includes(u));if(g.length)setSel(g)}
 }
});
addEventListener('keyup',e=>{const k=e.key.toLowerCase();KEY[e.key]=false;KEY[k]=false;if(k==='s')KEY.s2=false});
function mmWorld(e){const r=mmCv.getBoundingClientRect(),s=MM_S/G.map.N;return{x:clamp((e.clientX-r.left)/s,0,G.map.N),y:clamp((e.clientY-r.top)/s,0,G.map.N)};}
function mmPan(e){const w=mmWorld(e);G.cam.x=isoX(w.x,w.y)-vpW()/2/G.zoom;G.cam.y=isoY(w.x,w.y)-vpH()/2/G.zoom;}
// right-click on the minimap: order the selected units to that spot (attack a known
// enemy sitting there, otherwise move).
function mmOrder(e){
 const units=G.sel.filter(s=>s.kind==='unit'&&s.p===G.human&&s.hp>0);if(!units.length)return;
 const w=mmWorld(e),tx=clamp(w.x,1,G.map.N-2),ty=clamp(w.y,1,G.map.N-2);
 let tgt=null,bd=9;
 for(const en of G.units){if(allied(en.p,G.human)||en.garrisoned||!visibleToHuman(en))continue;const d=(en.x-tx)**2+(en.y-ty)**2;if(d<bd){bd=d;tgt=en}}
 if(!tgt)for(const b of G.blds){if(allied(b.p,G.human)||!visibleToHuman(b))continue;const d=(b.x-tx)**2+(b.y-ty)**2;if(d<bd){bd=d;tgt=b}}
 if(tgt){submitCmd('attack',{ids:units.map(u=>u.id),tid:tgt.id});G.parts.push({t:'mk',x:tgt.x,y:tgt.y,life:.5,col:'#ff6a5a'});}
 else issueMove(units,{x:tx,y:ty},false);
 sClick();
}
mmCv.addEventListener('mousedown',e=>{if(!G||G.over)return;if(e.button===2){mmOrder(e);e.stopPropagation();e.preventDefault();return;}mmDown=true;mmPan(e);e.stopPropagation()});
mmCv.addEventListener('contextmenu',e=>e.preventDefault());
function togglePause(){
 if(!G||G.over)return;
 if(G.net&&!G.net.host){msg('Only the host can pause an online match.');return}
 netSetPausedUI(!G.paused);
 if(G.net)netBroadcast({pp:G.paused?1:0});
}
document.getElementById('pauseBtn').onclick=togglePause;
document.getElementById('muteBtn').onclick=function(){muted=!muted;this.textContent=muted?'🔇':'🔊';if(AC&&masterGain){try{masterGain.gain.setTargetAtTime(muted?0:0.9,AC.currentTime,0.05);}catch(e){}}if(muted&&typeof speechSynthesis!=='undefined'){try{speechSynthesis.cancel();}catch(e){}}};
document.getElementById('helpBtn').onclick=()=>{const h=document.getElementById('helpBox');h.style.display=h.style.display==='block'?'none':'block'};
document.getElementById('hqBtn').onclick=()=>{hqFocus()}; // v73
/* v90.1: one line, and deliberately no second gate of its own - startPlacing runs
   the cost and limit checks and says why when it refuses, exactly as it does for
   the tile. refreshHqPlaceBtn only decides whether the button is offered. */
document.getElementById('hqPlaceBtn').onclick=()=>{if(hqRebuildState()){startPlacing('hq');sClick()}};

