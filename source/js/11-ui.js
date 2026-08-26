/* ---------------- MESSAGES / UI ---------------- */
function msg(t){const d=document.createElement('div');d.className='msg';d.textContent=t;const box=document.getElementById('msgs');box.appendChild(d);setTimeout(()=>d.remove(),5000);while(box.children.length>4)box.firstChild.remove()}
function updateTopbar(){
 document.getElementById('resP').textContent=Math.floor(G.human.res.p);
 document.getElementById('resE').textContent=Math.floor(G.human.res.e);
 (function(){const used=supUsed(G.human),cap=supCap(G.human);
  document.getElementById('popN').textContent=used;
  const ce=document.getElementById('popC');if(ce)ce.textContent=cap;
  // client-local tint only: never hashed, never serialized
  const el=document.getElementById('popN');if(el&&el.parentNode)el.parentNode.style.color=(used>=cap?'#ff9b6b':'#cfe6b8');
 })();
 const mi=document.getElementById('modeinfo');
 if(G.mode==='ctf'){mi.textContent='🚩 '+(matchTeamed()?teamScoreText(p=>p.score,CTF_TARGET):G.players.filter(p=>p.alive).map(p=>`${FAC[p.fac].name.split(' ')[0]} ${p.score}`).join('  •  '))} // v29: team sums
 else if(G.mode==='koth'){mi.textContent='👑 '+(matchTeamed()?teamScoreText(p=>p.kothScore,KOTH_TARGET):G.players.filter(p=>p.alive).map(p=>`${FAC[p.fac].name.split(' ')[0]} ${Math.floor(p.kothScore)}/${KOTH_TARGET}`).join('  •  '))} // v29: team sums
 else if(G.mode==='surv'&&G.surv){const alive=(G.neutrals||[]).filter(cr=>cr.wave&&cr.hp>0).length;mi.textContent=`🛡️ Wave ${G.surv.no}/${SURV_WAVE_N} · enemies ${alive}`;}
 else if(G.mode==='dm'&&DM_TIME>0&&!G.test)mi.textContent='💥 Deathmatch · ⏱ '+dmMMSS(dmLeft()); // v69
 else mi.textContent='💥 Deathmatch';
 refreshSurvBanner(); // v33
 refreshHqBtn();      /* v73: chrome, not a panel - deliberately NOT a sixth entry in the ten-tick pump */
 refreshHqPlaceBtn(); // v90.1: the same, and it rides the same pump for the same reason
}
/* --- the HQ shortcut: the Construct menu from anywhere on the map ---
   The button lives at the left edge of the bottom bar and Q does the same
   thing; both call THIS, because the harness shim's addEventListener is a
   no-op and a branch that only exists inside a keydown listener cannot be
   driven by a fixture. Client-local throughout: it selects and it moves the
   camera, and neither is hashed or serialized. */
function myHQs(){
 if(!G||!G.human)return[];
 return G.human.blds.filter(b=>b.key==='hq'&&b.hp>0&&b.prog>=1).sort((a,b)=>a.id-b.id);
}
function hqCamTarget(b){return{x:isoX(b.x,b.y)-vpW()/2/G.zoom,y:isoY(b.x,b.y)-vpH()/2/G.zoom}}
function hqCentred(b){const t=hqCamTarget(b);return Math.abs(G.cam.x-t.x)<1&&Math.abs(G.cam.y-t.y)<1}
/* Three states, and the ordering is the point: the FIRST press must not move the
   camera, because the common case is "I want to queue a building while I watch
   this fight". Centring is what the second press is for, and a third steps to
   the next HQ if you have one. */
function hqFocus(){
 if(!G||G.over||G.watch||G.spectate)return false;
 const hs=myHQs();
 if(!hs.length){msg('No headquarters standing.');return false}
 const i=(G.sel.length===1&&G.sel[0].kind==='bld')?hs.indexOf(G.sel[0]):-1;
 if(i>=0&&!hqCentred(hs[i])){const t=hqCamTarget(hs[i]);G.cam.x=t.x;G.cam.y=t.y;sClick();return true}
 setSel([i<0?hs[0]:hs[(i+1)%hs.length]]);sClick();return true;
}
function refreshHqBtn(){
 const el=document.getElementById('hqBtn');if(!el)return;
 const n=(!G||G.over||G.watch||G.spectate)?0:myHQs().length;
 el.style.display=n?'block':'none';
 if(n)el.title='Select your HQ and open Construct (Q). Press again to centre on it'
   +(n>1?(', again for the next of your '+n+' HQs.'):'.');
}
/* --- the rebuild button: the way back in when the headquarters falls ---
   Added at v90.1. Losing the HQ used to be quietly unrecoverable. Every build anchor placeDeny
   knows is a STRUCTURE - your own HQ, your own Outpost, a parked Command Truck -
   so an army down to a Barracks and a Garage can place nothing at all, and the
   two structures that ARE exempt from the anchor rule (the HQ and the Outpost)
   were both offered only from a menu you needed a standing HQ or Outpost to
   open. The Outpost's Construct list carried an HQ tile for exactly this case
   and it is the one that survived, so the hole was only ever half covered.
   This button is not a fourth anchor and grants no new permission: it is
   startPlacing('hq'), the same call the tile makes, hung somewhere that does not
   need a selection. Everything downstream is unchanged - the enemy-HQ ring, the
   footprint and spacing rules and the build-vision gate all still refuse it.
   It shows only while you hold NO headquarters, which is the whole of the new
   lim:1 rule read back: with one standing there is nothing this could add.
   Client-local throughout - it reads costs and building counts and writes only
   G.placing, which is a UI mode and is neither hashed nor serialized. */
function hqRebuildState(){
 if(!G||G.over||G.watch||G.spectate||!G.human||!G.human.alive)return null;
 if(bldCount(G.human,'hq')>0)return null; // the lim:1 count, read the way every other door reads it
 const c=bcost(G.human,'hq');
 return {c,afford:G.human.res.p>=c.p&&G.human.res.e>=c.e};
}
function refreshHqPlaceBtn(){
 const el=document.getElementById('hqPlaceBtn');if(!el)return;
 const st=hqRebuildState();
 el.style.display=st?'block':'none';
 if(!st)return;
 /* className by assignment rather than classList.toggle: the headless shim keeps
    the two surfaces separate and the fixtures read className. */
 el.className='tbtn'+(st.afford?'':' dis');
 el.title='Rebuild your HQ \u2014 '+st.c.p+' \u2B22'+(st.c.e?' + '+st.c.e+' \u26A1':'')
  +(st.afford?'. Click, then place it anywhere you can see from a building you still hold.'
             :'. Not enough resources yet.');
}
/* v72: the standing Construct panel's two builders are retired. v71 rehomed
   Construct onto the HQ and the Outpost (structTile / constructRoster) and hid
   the panel, but the builders kept rebuilding its twelve invisible buttons -
   once per structure completion and again every ten ticks. Their names are left
   out of this comment on purpose: the suite greps for them.
   startPlacing is the surviving half; the tiles call straight into it. */
function startPlacing(key){
 const c=bcost(G.human,key);
 const has=!B[key].req||G.human.blds.some(b=>b.key===B[key].req&&b.prog>=1);
 if(!has){msg(`Requires a ${B[B[key].req].n}.`);return}
 if(B[key].tech&&!hasTech(G.human,B[key].tech)){msg(`Research the ${B[key].n} at the Lab first.`);return}
 if(B[key].lim&&bldCount(G.human,key)>=B[key].lim){msg(`Only ${B[key].lim} ${B[key].n} allowed.`);return}
 if(G.human.res.p<c.p||G.human.res.e<c.e){msg('Not enough resources.');return}
 G.placing={key};
}
// terrain+footprint-only placement check for the 1x1 starting guard tower.
// (skips the "near a friendly building" rule and tolerates the fixed starting
//  unit offsets, which canPlace would otherwise reject.)
function canPlaceTower(tx,ty){
 const sz=1,N=G.map.N;
 if(tx<1||ty<1||tx+sz>=N-1||ty+sz>=N-1)return false;
 for(let y=0;y<sz;y++)for(let x=0;x<sz;x++)if(!G.map.pass[(ty+y)*N+(tx+x)])return false;
 for(const u of G.units)if(!u.t.fly&&u.x>tx-0.6&&u.x<tx+sz+0.6&&u.y>ty-0.6&&u.y<ty+sz+0.6)return false;
 return true;
}
// true only if every tile of a building's footprint is currently in the player's vision
// (fog state 2). used to stop the human placing barricades/outposts blindly into fog.
function footprintVisible(key,tx,ty){
 const sz=B[key].sz,N=G.map.N;
 for(let y=0;y<sz;y++)for(let x=0;x<sz;x++){
  const gx=tx+x,gy=ty+y;if(gx<0||gy<0||gx>=N||gy>=N)return false;
  if(!G.fog||G.fog[gy*N+gx]!==2)return false;
 }
 return true;
}
// v32: full deterministic placement check. Returns '' when legal, else a deny
// reason: 'terrain' (blocked footprint), 'unit' (ground unit in the way),
// 'foehq' (inside a live enemy HQ's 10-tile exclusion ring; team allies exempt),
// 'near' (no friendly HQ within BUILD_R_HQ / Outpost within BUILD_R_OUTPOST). HQ & Outpost
// ('anywhere' buildings) skip the 'near' rule but NOT the enemy ring; their
// vision requirement lives UI-side in canPlaceUI (fog is client-local, the sim
// never reads it). Distances are centre-to-centre, strict <, via dhyp (the old
// Math.hypot check was a latent cross-engine determinism smell). b.x/b.y are
// already footprint centres (makeBuilding stores x:tx+sz/2). In-progress
// friendly HQs/outposts grant their aura; in-progress enemy HQs repel.
/* v61: the Chebyshev gap between two axis-aligned footprints, in tiles. Zero
   when they touch or overlap on both axes; a plain subtraction on integer tile
   coords, so no float and nothing to disagree about across clients. Separation on
   EITHER axis is enough - two buildings 2 tiles apart in x may sit at any y - but
   a diagonal corner pinch scores 0 on both and is therefore rejected, which is the
   case that trapped units against a base's own rally pocket. */
function bldGap(key,tx,ty,b){
 const sz=B[key].sz;
 const gx=Math.max(b.tx-(tx+sz),tx-(b.tx+b.sz));
 const gy=Math.max(b.ty-(ty+sz),ty-(b.ty+b.sz));
 return gx>gy?gx:gy;
}
function placeDeny(p,key,tx,ty){
 const sz=B[key].sz,N=G.map.N;
 /* v83 BOUNDS. The footprint sweep below indexes a FLAT row-major array, so an
    out-of-range column does not read as empty - it wraps onto another row. At
    tx+x === N the index (ty+y)*N+(tx+x) is exactly (ty+y+1)*N, the first tile of
    the NEXT row, and a tx of -1 lands on the last tile of the PREVIOUS one. When
    the tile it wrapped onto happened to be passable the placement was allowed and
    the building went up off the edge of the map. It is the EAST and WEST edges
    that leaked: only a column can wrap, because a row out of range walks off the
    end of the array entirely and reads undefined, which denies correctly. Both
    leaking edges were measured on backyard before the fix - tx=N-1 and tx=-1 both
    passed the gate, every out-of-range ty was already refused. Checking the whole
    footprint up front is the fix; the sweep then only ever sees indices that
    belong to the row it is asking about. */
 if(tx<0||ty<0||tx+sz>N||ty+sz>N)return 'terrain';
 for(let y=0;y<sz;y++)for(let x=0;x<sz;x++)if(!G.map.pass[(ty+y)*N+(tx+x)])return 'terrain';
 for(const u of G.units)if(!u.t.fly&&u.x>tx-0.4&&u.x<tx+sz+0.4&&u.y>ty-0.4&&u.y<ty+sz+0.4)return 'unit';
 /* v61 SPACING. Reads G.blds, i.e. EVERY footprint on the map - yours, the
    enemy's, the map's neutral hedgehogs and its wildlife nests - because a unit
    is trapped by a wall regardless of whose it is. Barricades are exempt from
    each other and from nothing else, so a line still lays solid and can still tie
    into a neutral hedgehog cluster. Placement only: a pre-v61 save whose base is
    packed tight loads and stands exactly as it was. */
 const barr=!!B[key].barr;
 for(const b of G.blds){
  if(b.hp<=0)continue;
  if(barr&&b.t.barr)continue;
  if(bldGap(key,tx,ty,b)<BUILD_GAP)return 'space';
 }
 // v50: testing mode drops the build ZONE and the enemy-HQ ring, and nothing else.
 // The terrain and unit checks above deliberately still apply: makeBuilding writes
 // 0 into G.map.pass for the footprint, so building into water or onto a unit would
 // corrupt the grid the pathfinder reads. The UI fog gate needs no edit - G.fog is
 // filled with 2 in testing mode, so footprintVisible passes on its own.
 if(G.test)return '';
 const fx=tx+sz/2,fy=ty+sz/2;
 for(const q of G.players){
  if(allied(p,q))continue;
  for(const b of q.blds)if(b.key==='hq'&&b.hp>0&&dhyp(b.x-fx,b.y-fy)<BUILD_R_FOEHQ)return 'foehq';
 }
 if(B[key].anywhere)return '';
 for(const b of p.blds){
  if(b.key==='hq'&&dhyp(b.x-fx,b.y-fy)<BUILD_R_HQ)return '';
  if(b.key==='outpost'&&dhyp(b.x-fx,b.y-fy)<BUILD_R_OUTPOST)return '';
 }
 /* --- v86 FORWARD COMMAND ---
    The third build anchor, and the first one that moves. It is deliberately not a
    general one: CMD_BLD is the whole list it will carry, so a Command Truck cannot
    plant a Garage, a Lab or a second HQ and become a cheaper Outpost on wheels.
    The list is a constant rather than a chain of name tests here, so the rule is
    readable from the table and the info card states the same three names the door
    enforces. Own units only, matching the loop above it - a team-mate's HQ does
    not open your build zone either. In-progress structures are not a question for
    a unit, so there is no prog gate; hp>0 and not garrisoned is the whole of it,
    and a truck riding in an APC is not on the field to anchor anything. */
 if(CMD_BLD.indexOf(key)>=0)for(const u of p.units){
  if(!u.t.fwdcmd||u.hp<=0||u.garrisoned)continue;
  if(dhyp(u.x-fx,u.y-fy)<CMD_R)return '';
 }
 return 'near';
}
function canPlace(p,key,tx,ty){return placeDeny(p,key,tx,ty)===''}
// local-player placement preview/validation: deterministic canPlace PLUS the
// fog rule (barricades and 'anywhere' buildings only in explored vision). Lives
// UI-side because fog is client-local; the sim never reads it. (v23)
/* v71: the HQ is placeable anywhere the player can SEE A BUILDING FROM, rather
   than anywhere the player can see. Vision from a lone scout used to be enough
   to plant a headquarters on the enemy's doorstep. The Outpost deliberately
   keeps the looser any-vision rule, so a forward expansion is still a scouting
   reward. Client-side, like the fog gate it sits beside: placeDeny is untouched
   and the sim reads neither. */
function bldVisionAt(gx,gy){
 for(const b of G.human.blds){
  if(b.hp<=0||b.prog<1)continue;
  const vi=b.t.vi||0;if(vi<=0)continue;
  if(dhyp(b.x-(gx+0.5),b.y-(gy+0.5))<=vi)return true;
 }
 return false;
}
function footprintBldVisible(key,tx,ty){
 const sz=B[key].sz;
 for(let y=0;y<sz;y++)for(let x=0;x<sz;x++)if(!bldVisionAt(tx+x,ty+y))return false;
 return true;
}
function canPlaceUI(key,tx,ty){
 if(!canPlace(G.human,key,tx,ty))return false;
 if((B[key].barr||B[key].anywhere)&&!footprintVisible(key,tx,ty))return false;
 if(key==='hq'&&!G.test&&!footprintBldVisible(key,tx,ty))return false;
 return true;
}
function placeBuilding(p,key,tx,ty){
 const c=bcost(p,key);p.res.p-=c.p;p.res.e-=c.e;
 const b=makeBuilding(key,p,tx,ty,false);
 if(p.human)sClick();
 return b;
}

/* ---------------- RADIO TOWER CALL-DOWN PANEL ----------------
   A fixed panel pinned just under the Army panel on the right edge. It appears
   once the player owns a completed Radio Tower. Click an ability to arm it,
   then click the map to deploy (right-click / Esc cancels). Every ability in
   RADIO_ABILITIES shares one cooldown, held on the tower itself. */
function myRadioTower(){return (G&&G.human)?G.human.blds.find(b=>b.t.radio&&b.prog>=1&&b.hp>0):null}
/* v85: which of the player's CURRENT selection a Rapid Redeploy would actually
   carry. Client-local by nature - G.sel is a UI list and the sim never reads it -
   so this is only ever used to draw the button and to build the command's id list.
   execCmd re-derives the same filter from the ids it receives and trusts nothing
   here, which is what keeps the call honest against a peer sending anything else.
   Capped at LIFT_MAX by the same slice on both sides, so the button's count is the
   number that will actually fly. */
function liftables(){
 if(!G||!G.human)return [];
 return G.sel.filter(u=>u&&u.kind==='unit'&&u.p===G.human&&u.hp>0&&!u.garrisoned&&u.t.a==='inf').slice(0,LIFT_MAX);
}
let lastRadioSig='';
function refreshRadioPanel(){
 const el=document.getElementById('radioPanel'),bx=document.getElementById('radioBtns');
 if(!el||!bx)return;
 const b=(!G||G.spectate||G.over)?null:myRadioTower();
 if(!b){if(lastRadioSig!==''){el.style.display='none';lastRadioSig=''}return}
 /* v73: no manual positioning any more. This panel used to measure the army
    panel's box on every refresh in order to sit under it; both are flow children
    of #rightRail now and the column stacks them in markup order. The names of
    the two properties it used to read are left out on purpose: T50.A greps this
    function for them, and prose is exactly how that check goes vacuously green. */
 const ready=b.abilityCool<=0;
 const armed=(G.radioTargeting&&G.radioTargeting.bld===b)?G.radioTargeting.mode:'';
 /* v85: the redeploy button reads the live selection, so the count has to be part
    of the signature or the panel would keep showing whatever was selected when it
    last redrew. Only counted when Blue actually offers the row, so the other three
    armies' signatures are byte-for-byte what they were. */
 const liftN=radioAllowed(b.p,'lift')?liftables().length:-1;
 const sig=b.id+':'+(ready?'R':Math.ceil(b.abilityCool))+':'+armed+':'+liftN;
 if(sig===lastRadioSig)return;lastRadioSig=sig;
 el.style.display='block';bx.innerHTML='';
 const ab=radioListFor(b.p).map(a=>[a.mode,a.icon+' '+a.short,a.panel]);
 for(const [mode,label,desc] of ab){
  const bt=document.createElement('button');bt.className='bb'+(armed===mode?' sel':'');
  const sub=(mode==='lift'&&liftN>=0)?desc+' — '+liftN+' selected':desc;
  bt.innerHTML=`<b>${label}</b><br><span style="font-size:10px;opacity:.75">${sub}</span>`;
  bt.title=sub;
  if(!ready||(mode==='lift'&&liftN===0))bt.classList.add('dis');
  bt.onclick=()=>{
   if(b.abilityCool>0){msg(`Radio Tower on cooldown — ${Math.ceil(b.abilityCool)}s.`);return;}
   if(mode==='lift'&&!liftables().length){msg('Select the infantry you want moved first.');return;}
   G.radioTargeting={bld:b,mode};
   msg((radioAbility(mode)||{}).hint||'Click a target anywhere you have vision.'); // v86: the line is on the row, not picked out of a chain of mode names here
   lastRadioSig='';sClick();
  };
  bx.appendChild(bt);
 }
 const d=document.createElement('div');d.className='qItem';d.style.opacity=.7;d.textContent='Call-down: '+(ready?'Ready':Math.ceil(b.abilityCool)+'s');bx.appendChild(d);
}
/* ---------------- TESTING MODE ----------------
   A local sandbox, armed from the setup screen and carried on G.test. Every
   testing-mode branch in the file is gated on that one flag, so a normal match
   runs the v49 code path bit for bit.

   The team switch is deliberately tiny, because newGame already did the work:
   G.human is documented there as the LOCAL player, read by the UI and the fog
   and by nothing in the sim. submitCmd stamps pi:G.human.i, execCmd resolves
   G.players[c.pi] and cmdUnits filters u.p===p, so repointing G.human hands the
   whole command surface to another army with no new plumbing. Everything below
   is client-local: nothing here is hashed, serialized, or seen by another peer
   (which is exactly why testing mode is refused online - see lobHostStart).

   Control groups are CLEARED on a switch rather than remapped: G.groups holds
   live unit objects belonging to the army you just left, and every consumer
   filters on p===G.human, so keeping them would leave silently dead hotkeys. */
function armySwitchUI(){
 const el=document.getElementById('armySwitch');if(!el)return;
 if(!G||(!G.test&&!G.watch)||G.over){el.style.display='none';return}
 while(el.firstChild)el.firstChild.remove(); // shim + browser both honour remove()
 el.style.display='flex';
 G.players.forEach((p,i)=>{
  const b=document.createElement('button');
  b.className='aBtn'+(p===G.human?' on':'');
  b.style.borderColor=FAC[p.fac].color;
  b.textContent=String(i+1);
  b.title=(G.watch?'Follow ':'Command ')+FAC[p.fac].name+' (Tab cycles)';
  b.onclick=()=>{switchArmy(i);sClick()};
  el.appendChild(b);
 });
}
// v55: in a watch match the same chip row moves the CAMERA and the top-bar
// readout only - the command surface it repoints is already dead at submitCmd.
function switchArmy(i){
 if(!G||(!G.test&&!G.watch)||G.over)return false;
 const p=G.players[i];
 if(!p||p===G.human)return false;
 clearSel();
 G.groups={};                                     // they hold the army you just left
 G.placing=null;G.barrDrag=null;G.patrolAim=null;G.amove=false;G.radioTargeting=null;
 G.human=p;
 const hq=p.blds.find(b=>b.key==='hq')||p.blds[0], st=p.start||{x:G.map.N/2,y:G.map.N/2};
 const cx=hq?hq.x:st.x, cy=hq?hq.y:st.y;
 G.cam.x=isoX(cx,cy)-vpW()/2/G.zoom;G.cam.y=isoY(cx,cy)-vpH()/2/G.zoom;
 const fd=document.getElementById('facDot'),fn=document.getElementById('facName');
 if(fd)fd.style.background=FAC[p.fac].color;
 if(fn)fn.textContent=FAC[p.fac].name;
 lastSelSig='';lastArmySig='';lastRadioSig='';   // every cached UI signature is per-army
 updateTopbar();armySwitchUI();
 msg(G.watch?('👁 Following '+FAC[p.fac].name+'.'):('🧪 Now commanding '+FAC[p.fac].name+' (Army '+(i+1)+').'));
 lastWatchSig=''; // the spectator box highlights the followed army
 return true;
}

/* ---------------- UNIT PORTRAITS + ARMY READOUT ----------------
   Square portrait tiles for the multi-select panel, cut from the baked sprite
   cells (head & torso crop for infantry, full hull for vehicles), cached per
   unit key + faction as data URLs. Headless (no toDataURL) falls back to a
   labelled tile so the panel logic still runs under the test shim. */
const PORTRAITS={};
function portraitURL(key,fac){
 const ck=key+'_'+fac;
 if(ck in PORTRAITS)return PORTRAITS[ck];
 let url=null;
 try{
  const t=U[key];
  const cell=t.a==='inf'?(SPR.inf[key]&&SPR.inf[key][fac]&&SPR.inf[key][fac][2]):(SPR.veh[key]&&SPR.veh[key][fac]);
  if(SPR.done&&cell&&cell.cv&&cell.cv.width){
   const P=52,cv=document.createElement('canvas');cv.width=P;cv.height=P;const c=cv.getContext('2d');
   const g=c.createLinearGradient(0,0,P,P);g.addColorStop(0,'#33402a');g.addColorStop(1,'#141b0e');c.fillStyle=g;c.fillRect(0,0,P,P);
   if(t.a==='inf'){
    let sx=0,sy=0,sw=cell.cv.width,sh=cell.cv.height;
    sh*=.62;sw*=.62;sx=(cell.cv.width-sw)/2;  // head & torso crop
    const sc2=Math.min((P-6)/sw,(P-6)/sh),dw=sw*sc2,dh=sh*sc2;
    c.imageSmoothingEnabled=true;
    c.drawImage(cell.cv,sx,sy,sw,sh,(P-dw)/2,(P-dh)/2,dw,dh);
   }
   else vehPortraitPaint(c,key,fac,P,6); // v49: hull + live turret, fitted to the widened box
   if(typeof cv.toDataURL==='function'){const u2=cv.toDataURL();if(typeof u2==='string')url=u2;}
  }
 }catch(e){url=null}
 PORTRAITS[ck]=url;return url;
}
function hpBand(f){return f>2/3?'#58d858':f>1/3?'#ffd24d':'#ff5a5a'}
/* live army composition readout down the right edge: every unit type you
   currently field, with a count. Display-only; rebuilt only when it changes. */
let lastArmySig='';
function refreshArmyPanel(){
 const el=document.getElementById('armyPanel'),rows=document.getElementById('armyRows');
 if(!el||!rows)return;
 if(!G||!G.human||G.spectate){el.style.display='none';lastArmySig='';return}
 const counts={};for(const u of G.human.units)counts[u.key]=(counts[u.key]||0)+1;
 const order=Object.keys(U).filter(k2=>counts[k2]);
 const sig=order.map(k2=>k2+counts[k2]).join(',');
 if(sig===lastArmySig)return;lastArmySig=sig;
 if(!order.length){el.style.display='none';return}
 el.style.display='block';rows.innerHTML='';while(rows.firstChild)rows.removeChild(rows.firstChild);
 for(const k2 of order){
  const d=document.createElement('div');d.className='arow';
  const url=portraitURL(k2,G.human.fac);
  if(url){const im=document.createElement('img');im.src=url;d.appendChild(im);}
  const nm=document.createElement('span');nm.className='an';nm.textContent=U[k2].n;d.appendChild(nm);
  const ct=document.createElement('span');ct.className='ac';ct.textContent='\u00d7'+counts[k2];d.appendChild(ct);
  rows.appendChild(d);
 }
}
/* ---------------- SPECTATE MODE ----------------
   Everything below is reached only through G.watch. Two layers on purpose:
   watchReport() is a PURE fold over one player that returns plain data, and
   refreshWatchPanel() paints it. The numbers are therefore testable headless -
   the shim's querySelectorAll returns [], which is exactly why v33/v34/v35/v50
   could never cover refreshTeamRow.

   G.meter is client-local income telemetry, in the same family as G.atkPings,
   G.ghost and the fog grid: never hashed, never serialized, rebuilt from
   scratch on load. It is fed by ONE gated line in the truck drop-off, so a
   normal match never allocates or touches it. */
let lastWatchSig='';
function meterInit(){G.meter=G.players.map(()=>({p:0,e:0,hist:[]}));G.watchHide=false;}
function meterDrop(p,t,amt){
 if(!G.watch||!G.meter)return;
 const m=G.meter[p.i];if(!m)return;
 if(t==='plastic')m.p+=amt;else m.e+=amt;
}
/* one sample per second of SIM time. WATCH_RATE_N samples spans WATCH_RATE_N-1
   seconds; the oldest is dropped, so the window slides rather than growing. */
function meterSample(){
 if(!G.meter)return;
 for(let i=0;i<G.players.length;i++){
  const m=G.meter[i];if(!m)continue;
  m.hist.push({t:G.tick,p:m.p,e:m.e});
  while(m.hist.length>WATCH_RATE_N)m.hist.shift();
 }
}
/* delivered plastic / electricity per second across the sampled window. Two
   samples are needed before there is a rate at all; until then it reads zero
   rather than dividing by an empty span. */
function meterRate(i){
 const m=G.meter&&G.meter[i];
 if(!m||m.hist.length<2)return {p:0,e:0};
 const a=m.hist[0],b=m.hist[m.hist.length-1],secs=(b.t-a.t)/30;
 if(secs<=0)return {p:0,e:0};
 return {p:(b.p-a.p)/secs,e:(b.e-a.e)/secs};
}
/* generators and turbines are INCOME but not MINING, so they are reported as
   their own term instead of being folded into the measured rate. Same
   expression updateBld charges, so the two can never disagree. */
function genRate(p){
 let g=0;
 for(const b of p.blds){if(b.prog<1||!b.t.eps)continue;g+=b.t.eps*((b.upg&&UPGRADES[b.key])?UPGRADES[b.key].eff:1);}
 return g;
}
/* THE DATA LAYER: everything the box shows about one army, as plain data.
   Pure - no RNG, no clock, no mutation of anything it walks. qUnits carries a
   percentage only for the entry actually in production (queue head); the rest
   are pending counts. */
function watchReport(p){
 const q={},prog={};
 for(const b of p.blds){
  const qu=b.queue||[];
  for(let i=0;i<qu.length;i++){
   const k=qu[i];q[k]=(q[k]||0)+1;
   if(i===0&&U[k]&&U[k].bt>0){const f=Math.min(1,(b.prodT||0)/U[k].bt);if(!(prog[k]>=f))prog[k]=f;}
  }
 }
 const qBlds=[],qTech=[];
 for(const b of p.blds){
  if(b.prog<1)qBlds.push({key:b.key,pct:Math.round(b.prog*100)});
  if(b.techCur){const rt=researchTime(b,b.techCur);qTech.push({key:b.techCur,pct:rt>0?Math.round(Math.min(1,b.techT/rt)*100):100});}
 }
 const cnt={};for(const u of p.units)cnt[u.key]=(cnt[u.key]||0)+1;
 const r=meterRate(p.i);
 return {
  i:p.i,fac:p.fac,name:FAC[p.fac].name,color:FAC[p.fac].color,team:p.team,alive:!!p.alive,
  profile:p.ai?p.ai.profile:null,
  res:{p:Math.floor(p.res.p),e:Math.floor(p.res.e)},
  sup:{used:supUsed(p),cap:supCap(p)},
  rate:{p:r.p,e:r.e,gen:genRate(p)},
  qUnits:Object.keys(U).filter(k=>q[k]).map(k=>({key:k,n:q[k],pct:Math.round((prog[k]||0)*100)})),
  qBlds,qTech,
  units:Object.keys(U).filter(k=>cnt[k]).map(k=>({key:k,n:cnt[k]})),
  nUnits:p.units.length,nBlds:p.blds.filter(b=>b.prog>=1).length
 };
}
/* THE PAINTER: one card per army, rebuilt only when its signature moves (the
   rates are rounded into the signature so a trickling meter cannot rebuild the
   DOM three times a second). */
function refreshWatchPanel(){
 const el=document.getElementById('watchPanel'),rows=document.getElementById('watchRows');
 if(!el||!rows)return;
 if(!G||!G.watch||G.over||G.watchHide){el.style.display='none';lastWatchSig='';return}
 const reps=G.players.map(watchReport);
 const sig=reps.map(r=>[r.i,r.alive?1:0,r.profile,r.team,r.res.p,r.res.e,r.sup.used,r.sup.cap,
  r.rate.p.toFixed(1),r.rate.e.toFixed(1),r.rate.gen.toFixed(1),
  r.qUnits.map(x=>x.key+x.n+'_'+((x.pct/5)|0)).join('/'),
  r.qBlds.map(x=>x.key+'_'+((x.pct/5)|0)).join('/'),
  r.qTech.map(x=>x.key+'_'+((x.pct/5)|0)).join('/'),
  r.units.map(x=>x.key+x.n).join('/')].join('|')).join(';;')+'#'+(G.human?G.human.i:-1);
 if(sig===lastWatchSig)return;lastWatchSig=sig;
 el.style.display='block';
 rows.innerHTML='';while(rows.firstChild)rows.removeChild(rows.firstChild);
 for(const r of reps){
  const card=document.createElement('div');
  card.className='wcard'+((G.human&&G.human.i===r.i)?' on':'');
  card.style.borderLeftColor=r.color;
  card.onclick=()=>{watchFocus(r.i);sClick()};
  const top=document.createElement('div');top.className='wtop';
  const dot=document.createElement('div');dot.className='dotS';dot.style.background=r.color;top.appendChild(dot);
  const nm=document.createElement('span');nm.textContent=r.name;top.appendChild(nm);
  const tm=document.createElement('span');tm.className='wteam';tm.textContent=r.alive?('Team '+r.team):'ELIMINATED';top.appendChild(tm);
  card.appendChild(top);
  const pf=document.createElement('div');pf.className='wprof';
  pf.textContent=(r.profile?('AI: '+r.profile):'AI: none')+' · '+r.nUnits+' units · '+r.nBlds+' blds';
  card.appendChild(pf);
  const l1=document.createElement('div');l1.className='wline';
  l1.textContent='⬢ '+r.res.p+'   ⚡ '+r.res.e+'   🪖 '+r.sup.used+'/'+r.sup.cap;
  card.appendChild(l1);
  const l2=document.createElement('div');l2.className='wline';
  l2.textContent='Mining ⬢ '+r.rate.p.toFixed(1)+'/s  ⚡ '+r.rate.e.toFixed(1)+'/s'+(r.rate.gen>0?('  (+'+r.rate.gen.toFixed(1)+' ⚙)'):'');
  card.appendChild(l2);
  const addQ=(lab,txt)=>{const d=document.createElement('div');d.className='wq';
   const i2=document.createElement('i');i2.textContent=lab+' ';d.appendChild(i2);
   const t2=document.createElement('span');t2.textContent=txt;d.appendChild(t2);card.appendChild(d);};
  addQ('🪖 Units:',r.qUnits.length?r.qUnits.map(x=>U[x.key].n+'×'+x.n+(x.pct?(' '+x.pct+'%'):'')).join(', '):'idle');
  addQ('🏗 Build:',r.qBlds.length?r.qBlds.map(x=>B[x.key].n+' '+x.pct+'%').join(', '):'—');
  addQ('🔬 Research:',r.qTech.length?r.qTech.map(x=>RESEARCH[x.key].name+' '+x.pct+'%').join(', '):'—');
  addQ('⚔ Army:',r.units.length?r.units.map(x=>U[x.key].n+'×'+x.n).join(', '):'none');
  rows.appendChild(card);
 }
}
/* clicking a card (or Tab) follows that army: switchArmy already moves the
   camera and the top-bar readout, and the command surface it repoints is dead
   at submitCmd. Clicking the army already followed just re-centres on it. */
function watchFocus(i){
 if(!G||!G.watch||G.over)return false;
 const p=G.players[i];if(!p)return false;
 if(p!==G.human)return switchArmy(i);
 const hq=p.blds.find(b=>b.key==='hq')||p.blds[0],st=p.start||{x:G.map.N/2,y:G.map.N/2};
 const cx=hq?hq.x:st.x,cy=hq?hq.y:st.y;
 G.cam.x=isoX(cx,cy)-vpW()/2/G.zoom;G.cam.y=isoY(cx,cy)-vpH()/2/G.zoom;
 return true;
}
function watchToggle(){if(!G||!G.watch)return false;G.watchHide=!G.watchHide;lastWatchSig='';refreshWatchPanel();return true;}
function watchEndTitle(win){
 const t=document.getElementById('endTitle');if(!t)return;
 const alive=G.players.filter(p=>p.alive),teams=new Set(alive.map(p=>p.team));
 t.textContent=G.mode==='surv'
  ?(win?'🛡️ THE ARMIES HELD':'🐜 THE SWARM BROKE THROUGH')
  :(!alive.length?'💀 MUTUAL DESTRUCTION'
   :((alive.length>1&&teams.size===1)?('🏆 TEAM '+alive[0].team+' WINS')
    :('🏆 '+FAC[alive[0].fac].name.toUpperCase()+' WINS')));
 t.style.color='#ffe34d';
}
/* v56: SPECTATOR SPEED. Every one of these refuses outside a watch match, and
   none of them touches sim state - G.wspeed is read by exactly one expression,
   in frame(), on the way INTO the fixed-step accumulator. */
function watchSpeedSet(v){
 if(!G||!G.watch)return false;
 if(WATCH_SPEEDS.indexOf(v)<0)return false; // only the offered rungs, never an arbitrary multiplier
 G.wspeed=v;refreshSpeedRow();
 msg('⏩ Speed '+v+'x');
 return true;
}
function watchSpeedStep(d){
 if(!G||!G.watch)return false;
 const i=WATCH_SPEEDS.indexOf(G.wspeed||1);
 return watchSpeedSet(WATCH_SPEEDS[clamp((i<0?WATCH_SPEEDS.indexOf(1):i)+d,0,WATCH_SPEEDS.length-1)]);
}
function buildSpeedRow(){
 const el=document.getElementById('watchSpeed');if(!el)return;
 el.innerHTML='';while(el.firstChild)el.removeChild(el.firstChild);
 for(const v of WATCH_SPEEDS){
  const b=document.createElement('button');b.className='wspd';b.textContent=v+'x';
  b.title='Run the match at '+v+' speed. [ and ] step through the list.';
  b.onclick=()=>{watchSpeedSet(v);sClick()};
  el.appendChild(b);
 }
 refreshSpeedRow();
}
function refreshSpeedRow(){
 const el=document.getElementById('watchSpeed');if(!el)return;
 const kids=el.children||[],cur=(G&&G.wspeed)||1;
 for(let i=0;i<kids.length;i++)kids[i].className='wspd'+(WATCH_SPEEDS[i]===cur?' on':'');
}
function watchInit(){
 meterInit();
 G.wspeed=1; // every match opens at real time
 const ap=document.getElementById('armyPanel');if(ap)ap.style.display='none';  // the build menu and the per-army list are both spectator-irrelevant
 lastWatchSig='';refreshWatchPanel();buildSpeedRow();
 msg('👁 Spectating '+G.players.length+' CPU armies — full vision, no orders.');
 msg('Click an army card or press Tab to follow it. V hides the spectator box, [ and ] change speed.');
}
