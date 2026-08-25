/* ===================== FLAGS ===================== */
// KOTH control zone: a dashed team-coloured ring (gray when empty/contested) + crown
function drawHill(c){
 const h=G.hill;if(!h)return;
 const sx=isoX(h.x,h.y),sy=isoY(h.x,h.y),col=h.holder?FAC[h.holder.fac].color:'#c9cdd4';
 const rx=h.r*HW,ry=h.r*HH,pulse=1+Math.sin(G.tick*.06)*0.03;
 c.save();
 c.globalAlpha=0.12;c.fillStyle=col;c.beginPath();c.ellipse(sx,sy,rx*pulse,ry*pulse,0,0,7);c.fill();
 c.globalAlpha=0.9;c.strokeStyle=col;c.lineWidth=2.4;c.setLineDash([10,7]);c.lineDashOffset=-G.tick*0.5;
 c.beginPath();c.ellipse(sx,sy,rx,ry,0,0,7);c.stroke();c.setLineDash([]);
 c.globalAlpha=1;c.font='20px sans-serif';c.textAlign='center';c.fillText('👑',sx,sy-ry-6);c.textAlign='left';
 c.restore();
}
function drawStand(c,f){
 const sx=isoX(f.hx,f.hy),sy=isoY(f.hx,f.hy),col=FAC[f.owner.fac].color;
 c.fillStyle='#6a7076';c.beginPath();c.ellipse(sx,sy,15,7.5,0,0,7);c.fill();
 c.strokeStyle=col;c.lineWidth=2.6;c.beginPath();c.ellipse(sx,sy,12,6,0,0,7);c.stroke();
 plLimb(c,'#cfd4da',sx,sy,sx,sy-40,3.4);
 if(f.home){const wv=Math.sin(G.tick*.12)*3;c.fillStyle=col;c.beginPath();c.moveTo(sx,sy-40);c.quadraticCurveTo(sx+12,sy-38+wv,sx+24,sy-34+wv);c.lineTo(sx+22,sy-27+wv);c.quadraticCurveTo(sx+11,sy-30,sx,sy-28);c.closePath();c.fill();
  c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,255,255,.2)';c.beginPath();c.moveTo(sx,sy-39);c.quadraticCurveTo(sx+10,sy-37+wv,sx+18,sy-34+wv);c.lineTo(sx+17,sy-32+wv);c.quadraticCurveTo(sx+9,sy-34,sx,sy-33);c.closePath();c.fill();c.restore();}
}
function drawLooseFlag(c,f){
 const sx=isoX(f.x,f.y),sy=isoY(f.x,f.y),col=FAC[f.owner.fac].color,pulse=8+Math.sin(G.tick*.18)*3;
 c.strokeStyle=col;c.lineWidth=2;c.globalAlpha=.7;c.beginPath();c.ellipse(sx,sy,pulse+6,(pulse+6)*.5,0,0,7);c.stroke();c.globalAlpha=1;
 c.save();c.translate(sx,sy);c.rotate(-.5);plLimb(c,'#cfd4da',0,0,0,-26,2.6);c.fillStyle=col;c.beginPath();c.moveTo(0,-26);c.lineTo(16,-21);c.lineTo(0,-15);c.closePath();c.fill();c.restore();
}

/* ---------------- COMMANDS ----------------
   Every human-issued simulation mutation is expressed as a plain-data command
   referencing entities by id. Offline they queue on G.cmdQ and execute at the
   top of the next sim tick; online (v24) the same commands are relayed by the
   host and executed on the agreed tick by every client. UI feedback (markers,
   sounds, messages, selection) stays outside the command path. Execution must
   be fully deterministic: no Math.random, no Math.sin/cos/atan2/hypot, and no
   reads of anything client-local. */
function entById(id){
 if(!id)return null;
 for(const u of G.units)if(u.id===id)return u;
 for(const b of G.blds)if(b.id===id)return b;
 return null;
}
function submitCmd(op,a){
 // v55: SPECTATE MODE IS READ-ONLY, and this is the whole of it. Every player
 // action in the file - orders, build, train, research, sell, unload, entrench,
 // rally, patrol, barricade lines, radio call-downs - reaches the sim through
 // this one function, so refusing here closes all 26 call sites at once. The
 // bots are untouched: aiTick calls trainUnit/placeBuilding/orderMove directly.
 if(G.watch)return;
 const c={op,pi:G.human.i,a:a||{}};
 if(G.net&&G.net.submit)G.net.submit(c); else G.cmdQ.push(c);
}
function execCmds(){
 if(!G.cmdQ.length)return;
 const q=G.cmdQ;G.cmdQ=[];
 for(const c of q){try{execCmd(c)}catch(err){/* a bad command must never kill the tick */}}
}
function cmdUnits(p,ids){
 const out=[];
 if(!ids)return out;
 for(const id of ids){const u=entById(id);if(u&&u.kind==='unit'&&u.p===p&&u.hp>0)out.push(u)}
 return out;
}
function execCmd(c){
 const p=G.players[c.pi];
 if(!p||!p.alive)return;
 const a=c.a||{};
 switch(c.op){
  case 'move':{ // spiral formation spread, mirroring the old issueMove math
   // v44: medics come OUT of the spiral and take the middle of the formation (a
   // small ring of them when there are several), because the truck that has to hold
   // everyone inside a 2-tile aura cannot do it from the rim, and it has no speed
   // margin over infantry to correct the slot later. The spiral index counts only
   // non-medics, so an order with no medic in it hands out exactly the v43 slots.
   const list=[];for(const u of cmdUnits(p,a.ids))if(!u.garrisoned)list.push(u);
   medicOrderTag(list); // v44.1: did this order carry an escort, or is a medic being driven by hand?
   let nmed=0;for(const u of list)if(u.t.heal)nmed++;
   const Rf=.5*Math.sqrt(Math.max(0,list.length-nmed-1));
   const rm=nmed<2?0:Math.min(Rf*0.55,MEDIC_SEP*0.5);
   let i=0,mi=0;
   for(const u of list){
    let ang,r;
    if(u.t.heal){ang=mi*(Math.PI*2/nmed);r=rm;mi++}
    else{ang=i*2.39996;r=.5*Math.sqrt(i);i++}
    const px=clamp(a.x+dcos(ang)*r,1,G.map.N-2),py=clamp(a.y+dsin(ang)*r,1,G.map.N-2);
    if(a.q&&uBusy(u)){qPush(u,{op:'move',x:px,y:py,am:!!a.am});continue} // v29: shift-queue
    clearPlans(u,!a.q);
    orderMove(u,px,py,!!a.am);
    if(u.t.a==='truck')u.parked=true;
   }
   break}
  case 'harvest':{
   const n=G.map.nodes[a.node];
   if(!n||n.amt<=0)break;
   for(const u of cmdUnits(p,a.ids)){
    if(u.garrisoned)continue;
    if(a.q&&uBusy(u)){qPush(u,{op:'harvest',ni:a.node,nx:n.x,ny:n.y});continue} // v29: shift-queue; v30.1: coords ride along so later splices can't redirect the order
    clearPlans(u,!a.q);
    u.t.a==='truck'?orderHarvest(u,n):orderMove(u,a.x!=null?a.x:n.x,a.y!=null?a.y:n.y,false)
   }
   break}
  case 'dropoff':{
   for(const u of cmdUnits(p,a.ids)){
    if(u.garrisoned)continue;
    if(a.q&&uBusy(u)){qPush(u,{op:'dropoff'});continue} // v29: shift-queue
    clearPlans(u,!a.q);
    if(u.t.a==='truck')orderDropoff(u);else if(a.x!=null)orderMove(u,a.x,a.y,false)
   }
   break}
  case 'attack':{
   const t=entById(a.tid);
   if(!t||t.hp<=0||!t.p||allied(t.p,p))break; // v29: allies are never valid targets
   medicOrderTag(cmdUnits(p,a.ids)); // v44.1: a medic sent at a target alone is being driven by hand
   for(const u of cmdUnits(p,a.ids)){
    if(u.garrisoned)continue;
    if(a.q&&uBusy(u)){qPush(u,{op:'attack',tid:a.tid});continue} // v29: shift-queue
    clearPlans(u,!a.q);
    if(!mainOk(u,t))orderMove(u,t.x,t.y,true); // v51/v52: a hand-issued order the main gun cannot take becomes an attack-move to the spot, which walks a Bull into its own flamer range
    else orderAttack(u,t)
   }
   break}
  case 'garrison':{ // v30: also loads infantry into a friendly APC
   const b=entById(a.bid);
   const apc=b&&b.kind==='unit'&&b.t.cap&&b.p===p&&b.hp>0;
   if(!apc&&(!b||b.kind!=='bld'||b.key!=='bunker'||b.p!==p||b.prog<1))break;
   let n=b.garrison.length;
   const cap=garCap(b);
   for(const u of cmdUnits(p,a.ids)){
    if(u.garrisoned||u===b)continue;
    if(u.t.a==='inf'&&n<cap){clearPlans(u,true);u.state=apc?'enterU':'enterB';u.targetB=b;u.path=null;u.target=null;n++} // v29: garrisoning wipes plans
    else{orderMove(u,a.x,a.y+2,false);if(u.t.a==='truck')u.parked=true}
   }
   break}
  case 'rally':{
   for(const id of (a.bids||[])){const b=entById(id);if(b&&b.kind==='bld'&&b.p===p&&b.t.prod)b.rally={x:a.x,y:a.y}}
   break}
  case 'build':{
   if(!B[a.key])break;
   const cost=bcost(p,a.key);
   if(B[a.key].tech&&!hasTech(p,B[a.key].tech))break;
   if(B[a.key].req&&!p.blds.some(b=>b.key===B[a.key].req&&b.prog>=1))break;
   if(B[a.key].lim&&bldCount(p,a.key)>=B[a.key].lim)break; // per-player building limit (radio tower)
   if(p.res.p<cost.p||p.res.e<cost.e)break;
   if(!canPlace(p,a.key,a.tx,a.ty))break;
   placeBuilding(p,a.key,a.tx,a.ty);
   if(p===G.human)updateTopbar();
   break}
  case 'barrline':{
   const cost=bcost(p,'barricade');
   let placed=0;
   for(const t of (a.tiles||[])){
    if(p.res.p<cost.p)break;
    if(canPlace(p,'barricade',t.x,t.y)){placeBuilding(p,'barricade',t.x,t.y);placed++}
   }
   if(placed&&p===G.human)updateTopbar();
   break}
  case 'train':{
   const b=entById(a.bid);
   if(b&&b.kind==='bld'&&b.p===p&&b.prog>=1&&roster(p,b.key).includes(a.k))trainUnit(b,a.k);
   break}
  case 'cancel':{
   const b=entById(a.bid);
   if(b&&b.kind==='bld'&&b.p===p)cancelQueued(b,a.idx);
   break}
  case 'research':{
   const b=entById(a.bid);
   if(b&&b.kind==='bld'&&b.p===p&&b.prog>=1)startResearch(b,a.key);
   break}
  case 'unload':{
   const b=entById(a.bid);
   if(b&&b.kind==='bld'&&b.p===p)unloadBunker(b);
   break}
  case 'unloadu':{ // v30: APC drops its squad here
   for(const c of cmdUnits(p,a.ids)){if(c.t.cap&&c.garrison&&c.garrison.length)apcUnload(c);}
   if(p===G.human)lastSelSig='';
   break}
  case 'entrench':{
   for(const u of cmdUnits(p,a.ids)){
    if(!u.t.entrench||u.garrisoned)continue;
    clearPlans(u,true);u.coneDir=datan2(a.y-u.y,a.x-u.x);u.face=u.coneDir;u.entrenched=true;u.state='idle';u.path=null;u.target=null; // v29: entrenching wipes plans
   }
   if(p===G.human)lastSelSig='';
   break}
  case 'unentrench':{
   for(const u of cmdUnits(p,a.ids)){if(u.entrenched){u.entrenched=false;u.state='idle';u.path=null;u.target=null}}
   if(p===G.human)lastSelSig='';
   break}
  case 'onme':{ // v79: Sarge's broadcast. No aim step - it is a radius, not an arc
   for(const u of cmdUnits(p,a.ids)){if(!u.t.rally||u.garrisoned)continue;u.onMe=!!a.on;}
   if(p===G.human)lastSelSig='';
   break}
  case 'smoke':{ // v79: mortar ammunition select
   for(const u of cmdUnits(p,a.ids)){
    if(!u.t.smokeCap||u.garrisoned)continue;
    u.smoke=!!a.on;
    /* drop whatever it was shooting at either way: coming ON it is holding an
       enemy the smoke loop must not inherit, and going OFF it is holding a
       FRIENDLY that the ordinary attack state would happily keep shelling. */
    u.target=null;if(u.state==='attack')u.state='idle';
    u.wf=0;u.wfT=0;
   }
   if(p===G.human)lastSelSig='';
   break}
  case 'uplink':{ // v79: Radar Tent, on its own abilityCool
   const b=entById(a.bid);
   if(!b||b.kind!=='bld'||!b.t.uplink||b.p!==p||b.prog<1||b.hp<=0||b.abilityCool>0)break;
   b.upT=UPLINK_T;b.abilityCool=(G&&G.test)?0:UPLINK_CD;
   if(p===G.human){msg(`Target uplink online — +${UPLINK_RG} range, +${UPLINK_VI} sight for ${UPLINK_T}s.`);lastSelSig='';}
   break}
  case 'valve':{ // v80: the Flamethrower's pressure valve
   for(const u of cmdUnits(p,a.ids)){if(!u.t.valve||u.garrisoned)continue;u.valve=!!a.on;}
   if(p===G.human)lastSelSig='';
   break}
  case 'throttle':{ // v80: the Bull's charge
   for(const u of cmdUnits(p,a.ids)){
    if(!u.t.throttle||u.garrisoned)continue;
    u.thr=!!a.on;
    /* drop the target on the way IN, for the same reason the smoke case does:
       the hold-fire rule is expressed as having no target, and waiting a tick
       for updateUnit to notice would let one last shell out of the barrel. */
    if(u.thr){u.target=null;u.target2=null;}
   }
   if(p===G.human)lastSelSig='';
   break}
  case 'cshot':{ // v81: the Sniper restricts himself to infantry
   for(const u of cmdUnits(p,a.ids)){
    if(!u.t.cshot||u.garrisoned)continue;
    u.cs=!!a.on;
    /* drop a target he may no longer take, for the same reason the smoke case
       does: waiting for updateUnit's mainOk test would let one more round out
       of the barrel at a hull he has just sworn off. */
    if(u.cs&&u.target&&!csOk(u,u.target)){u.target=null;if(u.state==='attack')u.state='idle';}
   }
   if(p===G.human)lastSelSig='';
   break}
  case 'ripple':{ // v81: the Rocket Artillery's three-rocket salvo
   for(const u of cmdUnits(p,a.ids)){
    if(!u.t.ripple||u.garrisoned)continue;
    u.rip=!!a.on;
    u.salv=0; // the salvo counter belongs to the shape that is running; carrying one across the toggle would fire a part-salvo on the new timing
   }
   if(p===G.human)lastSelSig='';
   break}
  case 'flat':{ // v82: the Scout Bike runs flat out
   for(const u of cmdUnits(p,a.ids)){
    if(!u.t.flat||u.garrisoned)continue;
    u.flat=!!a.on;
    if(u.flat)u.target=null; // he cannot fire while it runs, and holding a target he may not shoot would leave him standing in the attack state
   }
   if(p===G.human)lastSelSig='';
   break}
  case 'assault':{ // v82: the Chinook's squad fires out of the hold
   for(const u of cmdUnits(p,a.ids)){
    if(!u.t.assault||u.garrisoned)continue;
    u.aslt=!!a.on;
    if(u.aslt){u.path=null;u.dest=null;u.state='idle';} // pinned from this tick, not from the end of the march it was on
    else for(const v of (u.garrison||[])){v.fo=false;v.target=null;}
   }
   if(p===G.human)lastSelSig='';
   break}
  case 'sprint':{ // v85: the Signal Runner sounds the whistle
   for(const u of cmdUnits(p,a.ids)){
    if(!u.t.sprint||u.garrisoned)continue;
    u.spr=!!a.on;
    /* dropping targets on the way IN is the same courtesy the smoke, throttle and
       flat cases pay, but it has to reach the whole RADIUS rather than the man
       holding the button - he is not the only one who has just stopped shooting.
       Everyone inside keeps their orders; only the shooting stops. */
    if(u.spr)for(const v of G.units){
     if(v.t.a!=='inf'||v.hp<=0||v.garrisoned||!allied(v.p,u.p))continue;
     if((v.x-u.x)**2+(v.y-u.y)**2<=SPRINT_R*SPRINT_R){v.target=null;v.target2=null;if(v.state==='attack')v.state='idle';}
    }
   }
   if(p===G.human)lastSelSig='';
   break}
  case 'bcast':{ // v86: the Command Truck opens the net
   for(const u of cmdUnits(p,a.ids)){
    if(!u.t.bcast||u.garrisoned)continue;
    u.bcast=!!a.on;
    /* the pin is expressed by dropping the march, not by refusing to advance one:
       a truck that kept its path and merely declined to step would still be
       holding a dest the arrival test never reaches. Pinned from THIS tick rather
       than from the end of whatever march it was on, exactly as Air Assault is. */
    if(u.bcast){u.path=null;u.dest=null;u.savedDest=null;u.state='idle';u.anchor={x:u.x,y:u.y};}
   }
   if(p===G.human)lastSelSig='';
   break}
  case 'napalmblast':{ // v87: the Firebomb Heli empties its racks around itself
   for(const u of cmdUnits(p,a.ids)){
    /* the cooldown is refused HERE rather than in the panel, on the same rule the
       faction call-downs are refused at this door: the panel is client-local and a
       peer can send whatever it likes. Garrisoned is in the list for form's sake -
       nothing carries a Firebomb - and hp>0 because cmdUnits already filtered it. */
    if(!u.t.fbomb||u.garrisoned||u.abCool>0)continue;
    napalmBlast(u);
   }
   if(p===G.human)lastSelSig='';
   break}
  case 'paint':{ // v88: the Choktaw marks a box and everything of theirs inside it
   /* Refused HERE, not in the panel, on the rule every ability door in this file
      follows: the panel is client-local and a peer can send whatever it likes.
      ONE aircraft paints, and it is the first in the list that is actually able
      to - a second Choktaw over the same box would only restart a clock that is
      already running, so spending its cooldown too would be a straight loss. */
   const x=clamp(a.x,1,G.map.N-2),y=clamp(a.y,1,G.map.N-2);
   for(const u of cmdUnits(p,a.ids)){
    if(!u.t.paint||u.garrisoned||u.abCool>0)continue;
    paintArea(u,x,y);break;
   }
   if(p===G.human)lastSelSig='';
   break}
  case 'pour':{ // v87: the Foundry finishes what every Garage is holding
   const b=entById(a.bid);
   if(!b||b.kind!=='bld'||!b.t.pour||b.p!==p||b.prog<1||b.hp<=0||b.abilityCool>0)break;
   /* Walked in p.blds order and paid for one Garage at a time, so a player who can
      afford three pours and owns four gets three - deterministically the same
      three on every client. A pour that nobody can pay for spends no cooldown at
      all, which is the same courtesy radioLift pays a redeploy with nobody in it. */
   let poured=0;
   for(const g of p.blds){
    if(g.key!=='garage'||g.prog<1||g.hp<=0||!g.queue||!g.queue.length)continue;
    const k=g.queue[0], fee=Math.round(ucost(p,k).p*POUR_COST);
    if(p.res.p<fee)continue;
    /* supply is NOT lifted: the queue entry was reserved when it was queued, and a
       pour that fielded a unit past the cap would be a way of buying supply with
       plastic. Refusing here leaves the unit in the queue to finish normally. */
    if(supUsed(p)+supOf(k)>supCap(p))continue;
    p.res.p-=fee;
    g.prodT=U[k].bt; // finished as far as updateBld is concerned; it spawns on the next tick through the ordinary path, so nothing about spawning is duplicated here
    poured++;
   }
   if(!poured)break;
   b.abilityCool=(G&&G.test)?0:POUR_CD;
   if(p===G.human){msg(`Pour — ${poured} vehicle${poured===1?'':'s'} finished on the spot.`);updateTopbar();lastSelSig='';}
   break}
  case 'bail':{ // v86: the crew steps out of the Observation Balloon, and the balloon is gone
   for(const u of cmdUnits(p,a.ids)){
    if(!u.t.bail||u.garrisoned||u.hp<=0)continue;
    balloonDown(u,true);
   }
   if(p===G.human){msg(`Crew away — ${BAIL_CREW.length} men on the ground.`);lastSelSig='';}
   break}
  case 'regroup':{ // v86: the Command Post rallies the men around it
   const b=entById(a.bid);
   if(!b||b.kind!=='bld'||!b.t.regroup||b.p!==p||b.prog<1||b.hp<=0||b.abilityCool>0)break;
   b.abilityCool=(G&&G.test)?0:REGROUP_CD;
   /* instantaneous, so there is no upT to write: the health is handed over on
      this tick and there is nothing left running afterwards. Own army only,
      matching the aura it shares a radius with, and capped at each unit's own
      maximum so a full unit costs the ability nothing. */
   let n86=0;
   for(const u of p.units){
    if(u.hp<=0||u.garrisoned||u.hp>=u.mhp)continue;
    const dx=Math.max(0,Math.abs(u.x-b.x)-b.sz*.5),dy=Math.max(0,Math.abs(u.y-b.y)-b.sz*.5);
    if(dx*dx+dy*dy>CPOST_R*CPOST_R)continue;
    u.hp=Math.min(u.mhp,u.hp+u.mhp*REGROUP_HP);u.healedAt=G.tick;n86++;
   }
   if(p===G.human){msg(`Regroup — ${n86} unit${n86===1?'':'s'} back on their feet.`);lastSelSig='';}
   break}
  case 'scramble':{ // v85: the Forward Pad puts the whole flight on the boil
   const b=entById(a.bid);
   if(!b||b.kind!=='bld'||!b.t.scram||b.p!==p||b.prog<1||b.hp<=0||b.abilityCool>0)break;
   b.upT=SCRAM_T;b.abilityCool=(G&&G.test)?0:SCRAM_CD;
   if(p===G.human){msg(`Scramble — +${Math.round(SCRAM_SPD*100)}% aircraft speed for ${SCRAM_T}s.`);lastSelSig='';}
   break}
  case 'over':{ // v82: the Wind Turbine spends its output ahead of time
   const b=entById(a.bid);
   if(!b||b.kind!=='bld'||!b.t.over||b.p!==p||b.prog<1||b.hp<=0||b.abilityCool>0)break;
   b.upT=OVER_T;b.abilityCool=(G&&G.test)?0:OVER_CD;
   if(p===G.human){msg(`Turbine overdriven \u2014 \u00d7${OVER_MUL} output for ${OVER_T}s, then nothing for ${OVER_OFF}s.`);lastSelSig='';}
   break}
  case 'lock':{ // v81: the Bunker buttons up, on the shared abilityCool
   const b=entById(a.bid);
   if(!b||b.kind!=='bld'||!b.t.lock||b.p!==p||b.prog<1||b.hp<=0||b.abilityCool>0)break;
   b.upT=LOCK_T;b.abilityCool=(G&&G.test)?0:LOCK_CD;b.target=null;
   if(p===G.human){msg(`Bunker locked down \u2014 ${Math.round(LOCK_RED*100)}% less damage taken for ${LOCK_T}s, and the garrison holds fire.`);lastSelSig='';}
   break}
  case 'scuttle':{ // v80: the Munitions Dump goes up, taking its own building with it
   const b=entById(a.bid);
   if(!b||b.kind!=='bld'||!b.t.scuttle||b.p!==p||b.prog<1||b.hp<=0)break;
   scuttle80(b);
   if(p===G.human){msg('Munitions dump scuttled.');lastSelSig='';}
   break}
  case 'radio':{ // v30: call-downs are issued by the Radio Tower building
   const b=entById(a.bid);
   if(!b||b.kind!=='bld'||!b.t.radio||b.p!==p||b.prog<1||b.hp<=0||b.abilityCool>0)break;
   const x=clamp(a.x,1,G.map.N-2),y=clamp(a.y,1,G.map.N-2);
   if(!radioAbility(a.mode))break;
   if(!radioAllowed(p,a.mode))break; // v85: a faction call-down is refused to every other army HERE, not merely left out of their panel - the panel is client-local and a peer can send any mode it likes
   if(radioNeedsVision(a.mode)&&!pVision(p,x,y))break;
   if(a.mode==='napalm')radioNapalm(b,x,y);
   else if(a.mode==='barrage')radioBarrage(b,x,y);
   else if(a.mode==='paradrop')radioParadrop(b,x,y);
   else if(a.mode==='supply')radioSupply(b,x,y);
   else if(a.mode==='smokescr')radioSmokescreen(b,x,y); // v88: reached only past radioAllowed above, which is where a non-Gray peer is refused
   else if(a.mode==='lift'){
    /* the id list is re-filtered from scratch: own units, alive, on the field,
       infantry, capped. cmdUnits already applies the ownership half, so this adds
       only what the redeploy itself requires. A call that filters down to nobody
       spends no cooldown - radioLift returns false and the tower stays ready. */
    const men=cmdUnits(p,a.ids).filter(u=>u.hp>0&&!u.garrisoned&&u.t.a==='inf').slice(0,LIFT_MAX);
    if(!men.length)break;
    radioLift(b,x,y,men.map(u=>u.id));
   }
   if(p===G.human){lastSelSig='';lastRadioSig='';}
   break}
  case 'halt':{
   for(const u of cmdUnits(p,a.ids)){if(!u.garrisoned){clearPlans(u,true);u.state='idle';u.path=null;u.target=null}}
   break}
  case 'hold':{ // v29: pin in place; fires at what it can reach, never moves
   for(const u of cmdUnits(p,a.ids)){
    if(u.garrisoned)continue;
    clearPlans(u,false);u.hold=true;u.state='idle';u.path=null;u.target=null;u.mining=false;
    if(u.t.a==='truck')u.parked=true;
   }
   if(p===G.human)lastSelSig='';
   break}
  case 'patrol':{ // v29: endless A<->B attack-move loop, spiral spread per unit
   const N2=G.map.N-2;
   const pax=clamp(a.ax,1,N2),pay=clamp(a.ay,1,N2),pbx=clamp(a.bx,1,N2),pby=clamp(a.by,1,N2);
   let i=0;
   for(const u of cmdUnits(p,a.ids)){
    if(u.garrisoned)continue;
    const ang=i*2.39996,r=.5*Math.sqrt(i);i++;
    const ox=dcos(ang)*r,oy=dsin(ang)*r;
    clearPlans(u,true);
    if(dhyp(pbx-pax,pby-pay)<1.5){orderMove(u,clamp(pax+ox,1,N2),clamp(pay+oy,1,N2),true);continue} // degenerate: plain attack-move
    u.patrol={ax:clamp(pax+ox,1,N2),ay:clamp(pay+oy,1,N2),bx:clamp(pbx+ox,1,N2),by:clamp(pby+oy,1,N2),leg:1};
    orderMove(u,u.patrol.ax,u.patrol.ay,true);
    if(u.t.a==='truck')u.parked=true;
   }
   break}
  case 'sell':{ // v29: 50% plastic refund; the HQ (and neutral structures) can never be sold
   const b=entById(a.bid);
   if(!b||b.kind!=='bld'||b.p!==p||b.prog<1||b.hp<=0||b.key==='hq'||b.key==='nest')break;
   sellBuilding(b);
   break}
  case 'aiTakeover':{ // v24: a human dropped mid-match; their army converts to CPU control
   if(p.ai||!p.human)break;
   p.human=false;
   p.diff=DIFFS[a.diff]||p.diff||DIFFS.normal;
   const profKey=Object.keys(AI_PROFILES)[Math.floor(srand()*Object.keys(AI_PROFILES).length)];
   p.ai=makeAIBrain(profKey);
   msg(`${FAC[p.fac].name}${p.name?' ('+p.name+')':''} is now CPU-controlled.`);
   break}
 }
}

/* ---------------- STATE HASH + SNAPSHOT ----------------
   hashState(): cheap deterministic digest of everything sim-relevant. Clients
   exchange it every second in online play to detect drift; the harness uses it
   to prove two runs (or a save/load pair) stayed bit-identical. Client-local
   things (fog, selection, particles, the ghost store, camera) are excluded.
   saveState()/loadState(): full sim snapshot as plain JSON. Used by the host to
   resync a drifted client, and by the harness to prove snapshot round-trips.
   The static map regenerates from the seed; only dynamic state is carried. */
const _hF64=new Float64Array(1),_hU32=new Uint32Array(_hF64.buffer);
function hI(h,v){v|=0;h=(h^(v&0xffff))>>>0;h=Math.imul(h,16777619)>>>0;h=(h^(v>>>16))>>>0;h=Math.imul(h,16777619)>>>0;return h}
function hF(h,v){_hF64[0]=v;h=hI(h,_hU32[0]);return hI(h,_hU32[1])}
function hS(h,s){if(!s)return hI(h,0);for(let i=0;i<s.length;i++)h=hI(h,s.charCodeAt(i));return h}
function hashState(){
 let h=2166136261;
 h=hI(h,G.tick);h=hI(h,G.rngS);h=hI(h,EID);h=hF(h,G.hazAcc||0);
 for(const p of G.players){
  h=hF(h,p.res.p);h=hF(h,p.res.e);h=hI(h,p.alive?1:0);h=hI(h,p.score);h=hF(h,p.kothScore);
  h=hI(h,p.tech.size);h=hI(h,p.techDone.size);h=hI(h,p.units.length);h=hI(h,p.blds.length);h=hI(h,p.team||0);
  /* v84: the ledger steers production, so it is hashed. It would surface anyway
     three tables later as a unit-count difference; hashing it says so at the tick
     it diverged instead. Key order is the object literal's insertion order in
     makeAIBrain, which is fixed, so the walk is deterministic. */
  if(p.ai&&p.ai.enc)for(const k in p.ai.enc)h=hF(h,p.ai.enc[k]);
 }
 for(const u of G.units){h=hI(h,u.id);h=hF(h,u.x);h=hF(h,u.y);h=hF(h,u.hp);h=hF(h,u.cool);h=hS(h,u.state);h=hF(h,u.cargo||0);h=hF(h,u.face);h=hI(h,u.entrenched?1:0);h=hI(h,u.garrisoned?1:0);h=hI(h,u.kl||0);h=hI(h,u.hold?1:0);h=hI(h,u.oq?u.oq.length:0);h=hI(h,u.patrol?u.patrol.leg+1:0);h=hF(h,u.burnT||0);h=hI(h,u.salv||0);h=hF(h,u.cool2||0);h=hF(h,u.calmT||0);h=hI(h,u.onMe?1:0);h=hI(h,u.smoke?1:0);h=hI(h,u.wf||0);h=hI(h,u.wfT||0);h=hI(h,u.valve?1:0);h=hI(h,u.thr?1:0);h=hI(h,u.vrt||0);h=hF(h,u.burnDps||0);h=hF(h,u.shotT||0);h=hI(h,u.cs?1:0);h=hI(h,u.rip?1:0);h=hI(h,u.flat?1:0);h=hI(h,u.aslt?1:0);h=hI(h,u.fo?1:0);h=hI(h,u.mvg?1:0);h=hI(h,u.spr?1:0);h=hI(h,u.bcast?1:0);h=hF(h,u.fuel||0);h=hF(h,u.abCool||0);h=hF(h,u.paintT||0)} // v85: the Sprint toggle. v51: salvo counter & secondary cooldown are sim state. v79: calm timer, the two Green toggles and the Walking Fire streak. v80: the two Tan toggles, and the burn RATE - hashed now that Cook-Off is a second writer of it at a different value from the fire ant's. v81: the shot clock the concealment test reads, and the two Gray toggles. v82: the two Blue toggles, the per-passenger firing-out flag its carrier writes, and the movement flag Evasive multiplies damage by. v86: the Broadcast toggle, and the balloon's remaining gas - a clock that decides when a unit dies is sim state whether or not anything else reads it. v87: the first UNIT ability cooldown, on the same footing as the building one that has been hashed since v30. v88: the Paint mark, which is the first ability clock written onto a unit by SOMEBODY ELSE - it decides how hard every future shot lands, so it is sim state on exactly the footing the others are
 for(const b of G.blds){h=hI(h,b.id);h=hF(h,b.hp);h=hF(h,b.prog);h=hI(h,b.queue.length);h=hF(h,b.prodT);h=hF(h,b.techT||0);h=hS(h,b.techCur||'');h=hI(h,b.garrison.length);h=hF(h,b.abilityCool||0);h=hF(h,b.burnT||0);h=hF(h,b.upT||0)} // v30: tower cooldown is sim state. v79: so is the uplink's remaining duration
 for(const pr of G.projs){h=hF(h,pr.x);h=hF(h,pr.y);h=hF(h,pr.z||0);h=hF(h,pr.dm)}
 for(const n of G.map.nodes){h=hF(h,n.amt);h=hI(h,n.wreck?1:0)}
 for(const m of G.map.mines){h=hI(h,m.live?1:0);h=hI(h,m.gray?1:0);h=hI(h,m.pi==null?-1:m.pi);h=hF(h,m.x);h=hF(h,m.y)} // v88: a buried mine is state the SIM created, so where it is has to be agreed as well as whether it is armed - the map's own are fixed by generation and cost nothing extra to carry
 for(const ns of (G.map.nests||[])){h=hI(h,ns.alive|0);h=hI(h,ns.dead?1:0);h=hI(h,ns.poked|0)}
 for(const cr of (G.neutrals||[])){h=hI(h,cr.id);h=hF(h,cr.x);h=hF(h,cr.y);h=hF(h,cr.hp);h=hI(h,cr.wave?1:0)}
 for(const s of (G.strikes||[])){h=hS(h,s.kind);h=hF(h,s.t)}
 /* v86: the supply crates. Hashed because they are spendable resources sitting on
    the board - two clients disagreeing about whether one has been collected is a
    500-plastic divergence - and serialized just below, because a list that is
    hashed and not serialized fails the save/load test by construction. */
 for(const c of (G.crates||[])){h=hF(h,c.x);h=hF(h,c.y);h=hI(h,c.pi);h=hS(h,c.kind);h=hF(h,c.amt)}
 for(const f of (G.flags||[])){h=hF(h,f.x);h=hF(h,f.y);h=hI(h,f.carrier?f.carrier.id:0);h=hI(h,f.home?1:0);h=hI(h,f.owner?f.owner.i+9:0)}
 if(G.hill){h=hI(h,G.hill.holder?G.hill.holder.i+9:0)}
 if(G.surv){h=hI(h,G.surv.no|0);h=hF(h,G.surv.t||0);h=hI(h,G.surv.done?1:0)} // v33
 return h>>>0;
}
/* --- snapshot encode --- */
const SNAP_ENT_SKIP=new Set(['t','p','sel','flash','flashAng','tvis']);
function _encRef(v){return v?v.id:0}
function _encGeneric(e,refFields){
 const o={};
 for(const k in e){
  if(SNAP_ENT_SKIP.has(k))continue;
  const v=e[k];
  if(refFields&&(k in refFields)){o['$'+k]=refFields[k](v);continue}
  o[k]=v;
 }
 return o;
}
const _uRefs={target:_encRef,target2:_encRef,targetB:_encRef, // v51: the secondary weapon's own target
 garrison:v=>(v||[]).map(_encRef),node:v=>v?G.map.nodes.indexOf(v):-1,flag:v=>v?G.flags.indexOf(v):-1}; // v30: APC troop bay
const _bRefs={target:_encRef,garrison:v=>(v||[]).map(_encRef)};
const _prRefs={tgt:_encRef,owner:_encRef};
const _crRefs={target:_encRef,nest:v=>v?G.map.nests.indexOf(v):-1};
const _skRefs={owner:_encRef};
/* v76: strikes need their clock back. See the note on SNAP_ENT_SKIP: the shared
   encoder drops `t` because entities use it for their type row, and a strike
   uses it for elapsed seconds. Restored explicitly rather than by removing it
   from the skip set, which would put a whole type table into every unit. */
function _encStrike(s){const o=_encGeneric(s,_skRefs);o.t=s.t;return o}
function _encAi(ai){
 if(!ai)return null;
 const o={};for(const k in ai){if(k==='grudge'){o.$grudge=ai.grudge?ai.grudge.i:null;continue}o[k]=ai[k]}
 return o;
}
function _diffKey(d){for(const k in DIFFS)if(DIFFS[k]===d)return k;return 'normal'}
/* the pass grid mutates during play (buildings, deaths, mined-out piles opening
   their tiles) and the ORDER of those writes matters for overlapping areas, so it
   cannot be reconstructed by replay. Serialize it directly, run-length encoded
   (grids are long runs of 1s with small 0 clusters, so this is tiny). */
function packPass(){
 const P=G.map.pass,r=[];let v=P[0],c=0;
 for(let i=0;i<P.length;i++){if(P[i]===v)c++;else{r.push(c);v=P[i];c=1}}
 r.push(c);
 return {v0:P[0],r};
}
function unpackPass(pk){
 const P=G.map.pass;let v=pk.v0,i=0;
 for(const c of pk.r){P.fill(v,i,i+c);i+=c;v=v?0:1}
}
function saveState(){
 return JSON.stringify({
  // v50: `test` is match config like mode/diff - serialized so a resync cannot
  // silently restore costs, and NOT folded into hashState.
  v:86,test:!!G.test,watch:!!G.watch,seed:G.seed,rngS:G.rngS,tick:G.tick,EID:EID,hazAcc:G.hazAcc||0,mode:G.mode,mapKey:G.matchCfg?G.matchCfg.map:'backyard',
  over:G.over,
  players:G.players.map(p=>({i:p.i,fac:p.fac,team:p.team,human:p.human,name:p.name||null,diff:_diffKey(p.diff),
   res:{p:p.res.p,e:p.res.e},alive:p.alive,score:p.score,kothScore:p.kothScore,stats:p.stats,start:p.start,
   tech:[...p.tech],techDone:[...p.techDone],techQ:p.techQ.slice(),ai:_encAi(p.ai),
   units:p.units.map(u=>u.id),blds:p.blds.map(b=>b.id)})),
  neutralBlds:G.neutral?G.neutral.blds.map(b=>b.id):[],
  units:G.units.map(u=>{const o=_encGeneric(u,_uRefs);o.pi=u.p.i;return o}),
  blds:G.blds.map(b=>{const o=_encGeneric(b,_bRefs);o.pi=b.p.i;return o}),
  projs:G.projs.map(pr=>_encGeneric(pr,_prRefs)),
  neutrals:(G.neutrals||[]).map(cr=>_encGeneric(cr,_crRefs)),
  strikes:(G.strikes||[]).map(_encStrike),
  crates:(G.crates||[]).map(c=>({x:c.x,y:c.y,pi:c.pi,kind:c.kind,amt:c.amt})), // v86: plain data, no entity references, so it needs no encoder of its own
  flags:(G.flags||[]).map(f=>({hx:f.hx,hy:f.hy,x:f.x,y:f.y,home:f.home,$owner:f.owner?f.owner.i:null,$carrier:_encRef(f.carrier)})),
  hill:G.hill?{x:G.hill.x,y:G.hill.y,r:G.hill.r,$holder:G.hill.holder?G.hill.holder.i:null}:null,
  nodes:G.map.nodes.map(n=>({t:n.t,x:n.x,y:n.y,amt:n.amt,max:n.max,wreck:!!n.wreck,col:n.col||null})),
  mines:G.map.mines.map(m=>({x:m.x,y:m.y,live:!!m.live,gray:m.gray?1:0,pi:m.pi==null?-1:m.pi})), // v88
  nests:(G.map.nests||[]).map(ns=>({alive:ns.alive,aggro:ns.aggro,respT:ns.respT||0,dead:!!ns.dead,poked:ns.poked||0})),
  pass:packPass(),
  surv:G.surv?{no:G.surv.no,t:G.surv.t,done:G.surv.done,fx:G.surv.fx,fy:G.surv.fy}:null, // v33: wave state
  statHist:G.statHist||null, // v29: end-chart history rides along
 });
}
function loadState(json){
 const S=typeof json==='string'?JSON.parse(json):json;
 // remember client-local bits keyed by entity id so they survive the reload
 const oldSelIds=G.sel.map(e=>e.id),oldGroups={};for(const k in G.groups)oldGroups[k]=G.groups[k].map(u=>u.id);
 // static world regenerates from the seed; same seed = identical terrain, so the
 // already-baked terrain canvases stay valid and are NOT re-rendered.
 G.seed=S.seed;G.rngS=S.rngS;G.tick=S.tick;EID=S.EID;G.over=S.over;G.hazAcc=S.hazAcc||0;
 G.test=!!S.test; // v50: before makeMap, so anything downstream that reads it agrees with the save (pre-v50 saves load as a normal match)
 G.watch=!!S.watch; // v55: match config like `test` (pre-v55 saves load as a normal match)
 G.map=makeMap(S.mapKey,S.seed);
 if(S.mode==='surv')survivalSetup({opp:(S.players?S.players.length-1:0)}); // v34: makeMap rebuilds the RAW map; re-run the survival pass so the arena carve + nest/prop/field/mine/barricade prune match the original boot (nodes/mines are restored from the snapshot just below, overwriting survivalSetup's starter-node re-adds). Fixes pre-existing survival save/load map corruption.
 initPF(G.map.N);
 G.map.nodes=S.nodes.map(n=>({t:n.t,x:n.x,y:n.y,amt:n.amt,max:n.max,wreck:n.wreck,col:n.col||undefined}));
 // v30.1: node ghosts are index-keyed against THIS list. Re-key survivors by position so a
 // same-session resume keeps its frozen fogged snapshots (node x/y are immutable, and the
 // save order equals the live order) while a foreign save's mismatched ghosts drop; prune
 // gone ghosts that collide with a live loaded pile (an earlier save can resurrect one).
 if(G.ghost){const old=G.ghost.nodes;G.ghost.nodes=[];G.map.nodes.forEach((n,i)=>{const g=(old||[]).find(g2=>g2&&g2.x===n.x&&g2.y===n.y);if(g)G.ghost.nodes[i]=g;});
  G.ghost.goneNodes=(G.ghost.goneNodes||[]).filter(g=>!G.map.nodes.some(n=>n.x===g.x&&n.y===g.y));}
 G.map.mines=S.mines.map(m=>({x:m.x,y:m.y,live:m.live,gray:m.gray?1:0,pi:(m.pi==null||m.pi<0)?null:m.pi})); // v88: a pre-v88 save has neither field, and a map mine that answers to everybody is the honest default
 (G.map.nests||[]).forEach((ns,i)=>{const s2=S.nests[i];if(s2){ns.alive=s2.alive;ns.aggro=s2.aggro;if(s2.respT)ns.respT=s2.respT;ns.dead=!!s2.dead;if(s2.poked)ns.poked=s2.poked}});
 // the snapshot's pass grid is authoritative (regen only restores the static base)
 if(S.pass)unpackPass(S.pass);
 // players
 G.players=S.players.map(sp=>({i:sp.i,fac:sp.fac,team:(sp.team!=null?sp.team:sp.i+1),human:sp.human,name:sp.name,diff:DIFFS[sp.diff]||DIFFS.normal, // v29: pre-v29 saves load as FFA
  res:{p:sp.res.p,e:sp.res.e},alive:sp.alive,score:sp.score,kothScore:sp.kothScore,stats:sp.stats,start:sp.start,
  tech:new Set(sp.tech),techDone:new Set(sp.techDone),techQ:sp.techQ.slice(),ai:sp.ai?{...sp.ai}:null,
  units:[],blds:[]}));
 G.neutral={fac:'bug',ai:null,human:false,alive:true,i:-1,team:-1,units:[],blds:[],res:{p:0,e:0},score:0,
  stats:{built:0,lost:0,kills:0},tech:new Set(),techDone:new Set(),techQ:[]};
 const pByI=i=>i===-1?G.neutral:G.players[i];
 // entities: pass 1 creates, pass 2 resolves references
 const byId={};
 function decEnt(o,pField){
  const e={};
  for(const k in o){if(k[0]==='$')continue;e[k]=o[k]}
  e.sel=false;e.flash=0;
  if(pField!==undefined)e.p=pByI(o.pi!==undefined?o.pi:pField);
  byId[e.id]=e;
  return e;
 }
 G.units=S.units.map(o=>{const u=decEnt(o);u.t=u.kind==='creature'?CREATURE[u.species]:U[u.key];if(!u.oq)u.oq=[];if(u.hold==null)u.hold=false;if(u.kl==null)u.kl=0;if(u.vr==null)u.vr=0;if(u.calmT==null)u.calmT=0;if(u.t.rally&&u.onMe==null)u.onMe=false;if(u.t.smokeCap&&u.smoke==null)u.smoke=false;if(u.t.wf&&u.wf==null){u.wf=0;u.wfT=0}if(u.t.valve&&u.valve==null){u.valve=false;u.vrt=0}if(u.t.throttle&&u.thr==null)u.thr=false;if(u.t.camo&&u.shotT==null)u.shotT=999;if(u.t.cshot&&u.cs==null)u.cs=false;if(u.t.ripple&&u.rip==null)u.rip=false;if(u.t.evade&&u.mvg==null)u.mvg=false;if(u.t.flat&&u.flat==null)u.flat=false;if(u.t.assault&&u.aslt==null)u.aslt=false;if(u.t.cap&&u.fo==null)u.fo=false;if(u.t.sprint&&u.spr==null)u.spr=false;if(u.t.bcast&&u.bcast==null)u.bcast=false;if(u.t.balloon&&u.fuel==null)u.fuel=BALLOON_FUEL;if(u.t.abCd&&u.abCool==null)u.abCool=0;if(u.paintT==null)u.paintT=0;return u}); // v88: paintT is defaulted for EVERY unit and not gated on a table flag, because unlike every field beside it the mark is worn by units whose own row says nothing about it // v87: a pre-v87 save carries no unit cooldown, and ready is the honest default // v86: a pre-v86 save has neither, and a balloon in one has never burned any gas // v29: pre-v29 saves get queue/hold/vet defaults. v79: and the ability fields, which a pre-v79 save has none of
 G.blds=S.blds.map(o=>{const b=decEnt(o);b.t=B[b.key];if(b.abilityCool==null)b.abilityCool=0;if(b.upT==null)b.upT=0;return b}); // v30: pre-v30 saves get the cooldown default. v79: and the uplink timer
 G.projs=S.projs.map(o=>{const pr={};for(const k in o){if(k[0]==='$')continue;pr[k]=o[k]}return pr});
 G.neutrals=S.neutrals.map(o=>{const cr=decEnt(o);cr.t=CREATURE[cr.species];cr.p=G.neutral;return cr});
 G.strikes=S.strikes.map(o=>{const s={};for(const k in o){if(k[0]==='$')continue;s[k]=o[k]}if(typeof s.t!=='number')s.t=0;return s});
 G.crates=(S.crates||[]).map(c=>({x:c.x,y:c.y,pi:c.pi,kind:c.kind,amt:c.amt})); // v86: a pre-v86 save carries none, and an empty list is the honest answer
 // pass 2: reference resolution
 S.units.forEach((o,i)=>{const u=G.units[i];
  u.p=pByI(o.pi);
  u.target=o.$target?byId[o.$target]||null:null;
  u.targetB=o.$targetB?byId[o.$targetB]||null:null;
  if('$target2' in o)u.target2=o.$target2?byId[o.$target2]||null:null; // v51: GUARDED - an unguarded assign would stamp target2:null onto every loaded unit while fresh ones lack it, which is exactly the v28 'seen' bug

  u.node=(o.$node!=null&&o.$node>=0)?G.map.nodes[o.$node]||null:null;
  if(o.$garrison)u.garrison=o.$garrison.map(id=>byId[id]).filter(Boolean); // v30: APC passengers
  u.flag=null; // re-linked from flags below
 });
 S.blds.forEach((o,i)=>{const b=G.blds[i];
  b.p=pByI(o.pi);
  b.target=o.$target?byId[o.$target]||null:null;
  b.garrison=(o.$garrison||[]).map(id=>byId[id]).filter(Boolean);
 });
 S.projs.forEach((o,i)=>{const pr=G.projs[i];
  pr.tgt=o.$tgt?byId[o.$tgt]||null:null;
  pr.owner=o.$owner?byId[o.$owner]||null:null;
 });
 S.neutrals.forEach((o,i)=>{const cr=G.neutrals[i];
  cr.target=o.$target?byId[o.$target]||null:null;
  cr.nest=(o.$nest!=null&&o.$nest>=0)?G.map.nests[o.$nest]||null:null;
 });
 S.strikes.forEach((o,i)=>{G.strikes[i].owner=o.$owner?byId[o.$owner]||null:null});
 G.flags=S.flags.map(f=>({hx:f.hx,hy:f.hy,x:f.x,y:f.y,home:f.home,owner:f.$owner!=null?pByI(f.$owner):null,carrier:f.$carrier?byId[f.$carrier]||null:null}));
 for(const f of G.flags)if(f.carrier)f.carrier.flag=f;
 G.hill=S.hill?{x:S.hill.x,y:S.hill.y,r:S.hill.r,holder:S.hill.$holder!=null?pByI(S.hill.$holder):null}:null;
 G.surv=S.surv?{no:S.surv.no,t:S.surv.t,done:S.surv.done,fx:S.surv.fx,fy:S.surv.fy}:null; // v33
 // player ai grudge references + membership lists (order preserved exactly)
 S.players.forEach((sp,i)=>{const p=G.players[i];
  if(p.ai){delete p.ai.$grudge;p.ai.grudge=sp.ai&&sp.ai.$grudge!=null?G.players[sp.ai.$grudge]||null:null}
  p.units=sp.units.map(id=>byId[id]).filter(Boolean);
  p.blds=sp.blds.map(id=>byId[id]).filter(Boolean);
 });
 G.neutral.blds=(S.neutralBlds||[]).map(id=>byId[id]).filter(Boolean);
 G.neutral.units=[];
 for(const p of G.players)if(p.stats&&p.stats.mined==null)p.stats.mined=0; // v29: pre-v29 saves
 // v55: G.players was just REBUILT, so a watch match's UI anchor points at a
 // discarded object. Repointing is guarded so no other path's G.human moves.
 // The meter is client-local telemetry with no snapshot, so it restarts empty.
 if(G.watch){G.human=G.players[(G.human&&G.human.i!=null)?G.human.i:0]||G.players[0];meterInit();lastWatchSig='';}
 G.statHist=(S.statHist&&S.statHist.rows&&S.statHist.rows.length===G.players.length)?S.statHist:{iv:150,t:[],rows:G.players.map(()=>({av:[],kl:[],mn:[]}))}; // v29
 // client-local state: remap selection + control groups onto the new objects
 G.sel=oldSelIds.map(id=>byId[id]).filter(Boolean);
 for(const e of G.sel)e.sel=true;
 G.groups={};for(const k in oldGroups)G.groups[k]=oldGroups[k].map(id=>byId[id]).filter(Boolean);
 bakeMapSprites(); // v25: props/nests/nodes are fresh objects after regen; re-bake once
 G.parts=[];G.timers=[];G.cmdQ=[];G.inf=null;
 G.radioTargeting=null;G.placing=null;G.barrDrag=null;G.patrolAim=null;
 lastSelSig='';
}

/* ---------------- NETWORK CORE ----------------
   Pure-WebRTC multiplayer, no server. Signaling is manual copy-paste invite
   codes (compact SDP). Star topology: the host is the authority; each joiner
   holds ONE reliable-ordered DataChannel to the host.
   Deterministic lockstep: only commands cross the wire. The host stamps every
   received command with the sender's player index (a client can never act as
   someone else), batches them into per-tick bundles {t,c}, executes the bundle
   locally and broadcasts it. A client simulates tick T only once bundle T has
   arrived, so every peer feeds identical commands into identical ticks.
   Clients report a state hash every 30 ticks; on mismatch the host ships a full
   snapshot (chunked) and the client loads it and resumes.
   The engine below is transport-agnostic: anything with send/onmessage/onclose
   works, which is how the headless loopback tests drive the real code path. */
const NET_CK_EVERY=30;      // client checksum cadence (ticks)
const NET_RS_COOLDOWN=120;  // min ticks between resyncs per client
const NET_CHUNK=60000;      // snapshot chunk size (chars)
const NET_CATCHUP=5;        // max bundles a lagging client consumes per pump

/* --- game-start wiring --- */
function netStartHost(cfg,chanRecs){ // chanRecs: [{pi,ch,name}]
 G=null;newGame(cfg);
 G.net={host:true,pi:G.human.i,chans:{},pend:[],hashRing:{},hashOld:[],dead:false,
  submit:c=>{G.net.pend.push(c)}};
 for(const r of chanRecs)G.net.chans[r.pi]={pi:r.pi,ch:r.ch,name:r.name||('Player '+(r.pi+1)),alive:true,lastRs:-1e9};
 for(const k in G.net.chans){
  const rec=G.net.chans[k];
  rec.ch.onmessage=ev=>netHostMsg(rec,ev.data);
  rec.ch.onclose=()=>netDropClient(rec);
  rec.ch.onerror=()=>netDropClient(rec);
 }
}
function netStartClient(cfg,you,ch){
 cfg=JSON.parse(JSON.stringify(cfg));
 cfg.slots.forEach((s,i)=>{s.local=(i===you)});
 G=null;newGame(cfg);
 G.net={host:false,pi:you,chan:ch,bundles:new Map(),rsBuf:null,dead:false,
  submit:c=>{try{ch.send(JSON.stringify({c:[c]}))}catch(e){}}};
 ch.onmessage=ev=>netClientMsg(ev.data);
 ch.onclose=()=>netHostLost();
 ch.onerror=()=>netHostLost();
}

/* --- per-frame lockstep pump (called from the main loop instead of update) --- */
function netStep(){
 const n=G.net;if(!n||n.dead||G.over||G.paused)return;
 if(n.host){
  const T=G.tick+1;
  const bundle=n.pend;n.pend=[];
  netBroadcast({b:{t:T,c:bundle}});
  G.cmdQ.push(...bundle);
  update(1/30);
  if(G.tick%NET_CK_EVERY===0){
   n.hashRing[G.tick]=hashState();
   if(n.hashOld.push(G.tick)>40)delete n.hashRing[n.hashOld.shift()];
  }
 }else{
  let steps=0;
  while(steps<NET_CATCHUP){
   const T=G.tick+1,bu=n.bundles.get(T);
   if(bu===undefined)break;               // stall until the host's bundle arrives
   n.bundles.delete(T);
   G.cmdQ.push(...bu);
   update(1/30);
   if(G.tick%NET_CK_EVERY===0){try{n.chan.send(JSON.stringify({ck:G.tick,h:hashState()}))}catch(e){}}
   steps++;
   if(n.bundles.size<3)break;             // burst only while backlogged
  }
 }
}
function netBroadcast(obj){
 const s=JSON.stringify(obj);
 const n=G.net;
 for(const k in n.chans){const c=n.chans[k];if(c.alive)try{c.ch.send(s)}catch(e){}}
}

/* --- host message handling --- */
function netHostMsg(rec,data){
 let m;try{m=JSON.parse(data)}catch(e){return}
 const n=G.net;if(!n)return;
 if(m.c){ // commands: stamp the SENDER's player index; never trust the payload's
  for(const c of m.c)if(c&&typeof c.op==='string')n.pend.push({op:c.op,pi:rec.pi,a:c.a||{}});
 }else if(m.ck!=null){
  const h=n.hashRing[m.ck];
  if(h!==undefined&&h!==m.h&&G.tick-rec.lastRs>NET_RS_COOLDOWN){
   rec.lastRs=G.tick;
   netSendSnapshot(rec);
   msg('🔁 Resyncing '+rec.name+'…');
  }
 }else if(m.bye)netDropClient(rec);
}
function netSendSnapshot(rec){
 const s=saveState(),tot=Math.ceil(s.length/NET_CHUNK)||1;
 for(let i=0;i<tot;i++){
  try{rec.ch.send(JSON.stringify({rc:{i,n:tot,s:s.slice(i*NET_CHUNK,(i+1)*NET_CHUNK)}}))}catch(e){return}
 }
}
function netDropClient(rec){
 const n=G&&G.net;if(!n||!rec.alive)return;
 rec.alive=false;
 const p=G.players[rec.pi];
 if(!G.over&&p&&p.alive&&p.human){
  n.pend.push({op:'aiTakeover',pi:rec.pi,a:{diff:'normal'}});
  msg('⚠ '+rec.name+' disconnected — a CPU general takes over their army.');
 }
}

/* --- client message handling --- */
function netClientMsg(data){
 let m;try{m=JSON.parse(data)}catch(e){return}
 const n=G.net;if(!n)return;
 if(m.b){
  if(m.b.t>G.tick)n.bundles.set(m.b.t,m.b.c||[]);
 }else if(m.rc){
  if(!n.rsBuf||n.rsBuf.n!==m.rc.n)n.rsBuf={n:m.rc.n,parts:{},got:0};
  if(n.rsBuf.parts[m.rc.i]===undefined){n.rsBuf.parts[m.rc.i]=m.rc.s;n.rsBuf.got++}
  if(n.rsBuf.got===n.rsBuf.n){
   let s='';for(let i=0;i<n.rsBuf.n;i++)s+=n.rsBuf.parts[i];
   n.rsBuf=null;
   try{
    loadState(s);
    for(const t of [...n.bundles.keys()])if(t<=G.tick)n.bundles.delete(t);
    msg('🔁 Resynced with the host.');
   }catch(e){}
  }
 }else if(m.pp!=null){
  netSetPausedUI(!!m.pp);
  msg(m.pp?'⏸ The host paused the match.':'▶ The host resumed the match.');
 }else if(m.bye)netHostLost();
}
function netSetPausedUI(v){
 G.paused=v;
 document.getElementById('pausedTag').style.display=v?'block':'none';
 document.getElementById('pauseBtn').textContent=v?'▶ Resume':'⏸ Pause';
}
function netHostLost(){
 const n=G&&G.net;if(!n||n.dead)return;
 n.dead=true;
 if(!G.over){msg('⚠ Connection to the host was lost — match over.');endGame(false)}
}
/* clean teardown on quit: tell peers, close channels */
function netTeardown(){
 const n=G&&G.net;if(!n)return;
 try{
  if(n.host){netBroadcast({bye:1});for(const k in n.chans){try{n.chans[k].ch.close()}catch(e){}}}
  else{try{n.chan.send(JSON.stringify({bye:1}))}catch(e){}try{n.chan.close()}catch(e){}}
 }catch(e){}
 n.dead=true;
}

/* ---------------- COMPACT SDP CODEC ----------------
   A WebRTC session description is ~2KB of mostly boilerplate. Only five things
   actually matter for a datachannel-only session: ufrag, pwd, the DTLS
   fingerprint, the role, and the candidate list. Pack those as JSON -> base64
   (URL-safe) with a "PW1." prefix; rebuild a canonical SDP on the far side. */
/* v57: PW2 CODES. v56 packed an SDP as base64(JSON) - the 32-byte fingerprint
   written out as 64 ASCII hex characters, addresses and mDNS UUIDs as quoted
   strings, all of it then inflated 4/3. A typical Chrome offer came to 398
   characters. PW2 writes the same facts as bytes: the same offer is ~124, short
   enough to sit on one line of a chat message.

   One blob, self-delimiting so several can be concatenated:
     [0]   flags, bit0: 0 = offer, 1 = answer
     [1]   len(ice-ufrag) then that many ASCII bytes
     [.]   len(ice-pwd)   then that many ASCII bytes
     [.]   32 raw bytes of the sha-256 fingerprint
     [.]   candidate count, then per candidate 1 kind byte + address + 2-byte port
             0 host v4 (4B)    1 srflx v4 (4B)    2 host v6 (16B)
             3 srflx v6 (16B)  4 host mDNS (the UUID's own 16 bytes)
   At most PW2_MAXC candidates travel, one per family, reflexive first. A laptop
   with six interfaces used to write six candidate lines into every code and the
   extras never won a connectivity check.

   The envelope carries the lobby id and, per blob, the seat it belongs to, so
   the host can accept a reply into the right slot without being told which.

   Signalling only. No RNG, no clock, nothing hashed, nothing serialized. */
const PW2_MAXC=3;
const PW2_H4=0,PW2_S4=1,PW2_H6=2,PW2_S6=3,PW2_MD=4;
const PW2_INVITE=1,PW2_REPLY=2;
function b64uEnc(b){let s='';for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]&255);
 return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function b64uDec(str){
 let b=String(str==null?'':str).replace(/-/g,'+').replace(/_/g,'/');
 if(!b||/[^A-Za-z0-9+/]/.test(b))throw new Error('there are stray characters in it');
 while(b.length%4)b+='=';
 let raw;try{raw=atob(b)}catch(e){throw new Error('it is damaged - copy the whole thing again')}
 const a=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i)&255;
 return a;
}
function pw2V6(t){ // '2601:648::1' -> 16 bytes, or null if this is not one we can carry
 if(t.indexOf('%')>=0)return null;                       // zone ids are link-local only
 const half=t.split('::');if(half.length>2)return null;
 const head=half[0]?half[0].split(':'):[],tail=(half.length>1&&half[1])?half[1].split(':'):[];
 let full;
 if(half.length===1){if(head.length!==8)return null;full=head}
 else{const fill=8-head.length-tail.length;if(fill<0)return null;
  full=head.concat(new Array(fill).fill('0'),tail)}
 const out=[];
 for(const g of full){if(!/^[0-9a-fA-F]{1,4}$/.test(g))return null;
  const v=parseInt(g,16);out.push((v>>8)&255,v&255)}
 return out.length===16?out:null;
}
function pw2Cands(sdp){ // one candidate per family, reflexive first, PW2_MAXC total
 const re=/a=candidate:\S+ \d+ (?:udp|UDP) \d+ ([\w.:-]+) (\d+) typ (host|srflx)/g;
 let m;const found=[],seen={};
 while((m=re.exec(sdp))){
  const addr=m[1],port=+m[2],typ=m[3];
  if(!(port>0&&port<65536))continue;
  const key=addr+':'+port;if(seen[key])continue;seen[key]=1;
  const md=/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.local$/.test(addr);
  const v4=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(addr);
  let kind=-1,pay=null;
  if(v4){const q=[+v4[1],+v4[2],+v4[3],+v4[4]];if(q.some(x=>x>255))continue;
   kind=(typ==='host')?PW2_H4:PW2_S4;pay=q}
  else if(md){if(typ!=='host')continue;kind=PW2_MD;
   pay=addr.slice(0,36).replace(/-/g,'').match(/.{2}/g).map(h=>parseInt(h,16))}
  else if(addr.indexOf(':')>=0){const g=pw2V6(addr);if(!g)continue;
   kind=(typ==='host')?PW2_H6:PW2_S6;pay=g}
  else continue;
  found.push({kind:kind,pay:pay,port:port});
 }
 const keep=[];
 for(const k of [PW2_S4,PW2_S6,PW2_H4,PW2_H6,PW2_MD]){
  const c=found.find(x=>x.kind===k);if(c)keep.push(c);
 }
 return keep.slice(0,PW2_MAXC);
}
function sdpBlob(desc){ // RTCSessionDescription -> array of bytes
 const sdp=(desc&&desc.sdp)||'',get=re=>{const m=sdp.match(re);return m?m[1]:''};
 const u=get(/a=ice-ufrag:([^\r\n]+)/),p=get(/a=ice-pwd:([^\r\n]+)/);
 const f=get(/a=fingerprint:sha-256 ([^\r\n]+)/).replace(/:/g,'');
 if(!u||!p||u.length>255||p.length>255||!/^[0-9a-fA-F]{64}$/.test(f))
  throw new Error('this browser produced a session description Plastic Warfare cannot pack');
 const b=[(desc.type==='offer')?0:1];
 b.push(u.length);for(let i=0;i<u.length;i++)b.push(u.charCodeAt(i)&255);
 b.push(p.length);for(let i=0;i<p.length;i++)b.push(p.charCodeAt(i)&255);
 for(const h of f.match(/.{2}/g))b.push(parseInt(h,16));
 const cs=pw2Cands(sdp);b.push(cs.length);
 for(const c of cs){b.push(c.kind);for(const x of c.pay)b.push(x&255);b.push((c.port>>8)&255,c.port&255)}
 return b;
}
function blobSdp(a,i0){ // bytes -> {desc, i} ; i is where the next blob starts
 let i=i0;
 const need=n=>{if(i+n>a.length)throw new Error('it is truncated - copy the whole thing')};
 const hex2=v=>('0'+(v&255).toString(16)).slice(-2);
 need(1);const type=(a[i++]&1)?'answer':'offer';
 need(1);const ul=a[i++];need(ul);let u='';for(let k=0;k<ul;k++)u+=String.fromCharCode(a[i++]);
 need(1);const pl=a[i++];need(pl);let p='';for(let k=0;k<pl;k++)p+=String.fromCharCode(a[i++]);
 need(32);const fh=[];for(let k=0;k<32;k++)fh.push(hex2(a[i++]));
 need(1);const n=a[i++],cs=[];
 for(let k=0;k<n;k++){
  need(1);const kind=a[i++];let addr='';
  if(kind===PW2_H4||kind===PW2_S4){need(4);addr=a[i]+'.'+a[i+1]+'.'+a[i+2]+'.'+a[i+3];i+=4}
  else if(kind===PW2_H6||kind===PW2_S6){need(16);const g=[];
   for(let j=0;j<8;j++){g.push((((a[i]<<8)|a[i+1])>>>0).toString(16));i+=2}addr=g.join(':')}
  else if(kind===PW2_MD){need(16);let h='';for(let j=0;j<16;j++)h+=hex2(a[i++]);
   addr=h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)+'.local'}
  else throw new Error('it names an address type this build does not know');
  need(2);const port=((a[i]<<8)|a[i+1])>>>0;i+=2;
  cs.push({addr:addr,port:port,srflx:(kind===PW2_S4||kind===PW2_S6)});
 }
 let sdp='v=0\r\no=- 0 0 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\n'
  +'a=group:BUNDLE 0\r\na=msid-semantic: WMS\r\n'
  +'m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\n'
  +'a=ice-ufrag:'+u+'\r\na=ice-pwd:'+p+'\r\n'
  +'a=fingerprint:sha-256 '+fh.join(':').toUpperCase()+'\r\n'
  +'a=setup:'+((type==='offer')?'actpass':'active')+'\r\n'
  +'a=mid:0\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n';
 cs.forEach((c,k)=>{ // priorities are only a check ORDER; distinct and family-ranked is enough
  sdp+='a=candidate:'+(k+1)+' 1 udp '+((c.srflx?1686052607:2122260223)-k)+' '+c.addr+' '+c.port
   +' typ '+(c.srflx?'srflx':'host')+(c.srflx?' raddr 0.0.0.0 rport 0':'')+'\r\n';
 });
 sdp+='a=end-of-candidates\r\n';
 return {desc:{type:type,sdp:sdp},i:i};
}
function pw2Wrap(kind,lid,items){ // items: [{seat, blob}]
 const b=[kind&255,(lid>>8)&255,lid&255,items.length&255];
 for(const it of items){b.push(it.seat&255);for(const x of it.blob)b.push(x&255)}
 return 'PW2.'+b64uEnc(b);
}
function pw2Read(code){
 const t=String(code==null?'':code).replace(/\s+/g,'');
 if(!t)throw new Error('there is nothing in the box');
 if(t.slice(0,4)==='PW1.')throw new Error('that code came from an older build (v56 or earlier) - both players need the same file');
 if(t.slice(0,4)!=='PW2.')throw new Error('that is not a Plastic Warfare code');
 const a=b64uDec(t.slice(4));
 if(a.length<5)throw new Error('it is truncated - copy the whole thing');
 const kind=a[0],lid=((a[1]<<8)|a[2])>>>0,n=a[3];
 if(kind!==PW2_INVITE&&kind!==PW2_REPLY)throw new Error('that is not a Plastic Warfare code');
 if(!n||n>8)throw new Error('it is damaged - copy the whole thing again');
 let i=4;const items=[];
 for(let k=0;k<n;k++){
  if(i>=a.length)throw new Error('it is truncated - copy the whole thing');
  const seat=a[i++],r=blobSdp(a,i);i=r.i;
  items.push({seat:seat,desc:r.desc});
 }
 return {kind:kind,lid:lid,items:items};
}

