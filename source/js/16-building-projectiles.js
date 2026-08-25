/* ---------------- BUILDING UPDATE ---------------- */
function updateBld(b,dt){
 if(b.prog<1){b.prog=G.test?1:Math.min(1,b.prog+dt/b.t.bt);/* v50: testing mode tops out on the first tick */b.hp=Math.min(b.mhp,Math.max(b.hp,b.mhp*b.prog));
  /* v88: the Heavy Barricade's one-time roll, hooked HERE because this branch is
     the single tick on which a structure crosses into being finished - prog jumps
     to 1 inside this expression and the branch is never entered again, so the roll
     cannot fire twice without a flag to remember it by. srand(), because burying a
     mine is simulation: the tile it lands on has to be the same tile on every
     client, and an unseeded draw here would desync a live match. The draw is taken for
     EVERY completed heavy wall whether or not it succeeds, so the RNG stream does
     not depend on the outcome. */
  if(b.prog>=1&&b.t.hbarr)buryHBMine(b);
  if(b.prog>=1&&b.p.human){msg(`${b.t.n} complete.`);lastSelSig=''}return}
 // electricity buildings: generator/turbine produce more when upgraded
 /* v82 OVERDRIVE, three-way on the two timers the building already has: upT is
    the burst, and once that runs out abilityCool is still holding, which IS
    the dead window. No new state, and OVER_CD is derived from the two so the
    dark period ends on the tick the button comes back. */
 if(b.t.eps){const em=(b.upg&&UPGRADES[b.key])?UPGRADES[b.key].eff:1;
  const om=b.t.over?(b.upT>0?OVER_MUL:(b.abilityCool>0?0:1)):1;
  b.p.res.e+=b.t.eps*em*om*dt;}
 // research: labs and production buildings alike advance their current project
 // (production keeps running in parallel below), finishing when its time elapses
 if(b.techCur){
  b.techT+=dt;
  if(G.test||b.techT>=researchTime(b,b.techCur)){ // v50: instant. Mostly unreachable in testing mode (canResearch already refuses a granted tech); it exists for a v49 save loaded with a project in flight
   const key=b.techCur;b.techCur=null;b.techT=0;
   finishResearch(b.p,key);
  }
 }
 // v50: the loop drains the WHOLE queue in testing mode. Outside it the body runs
 // at most once and the arithmetic is the v49 arithmetic unchanged: prodT still
 // accumulates exactly one dt per call and the break leaves it untouched when the
 // unit is not ready yet, so a normal match spawns on the same tick it always did.
 while(b.queue.length){
  const k=b.queue[0];
  if(!G.test){b.prodT+=dt;if(b.prodT<U[k].bt)break;}
  b.prodT=0;b.queue.shift();
  if(supUsed(b.p)+supOf(k)<=supCap(b.p)){ // the supply cap is NOT lifted by testing mode; the queue entry is already shifted, so do not count it twice
   const sp=spawnSpot(b);const u=makeUnit(k,b.p,sp.x,sp.y,b);
   if(k==='truck'){const n=findNode(u);if(n)orderHarvest(u,n);else orderMove(u,b.rally.x,b.rally.y,false)}
   else orderMove(u,b.rally.x,b.rally.y,true);
   if(b.p.human){updateTopbar();lastSelSig=''}
  }
  if(!G.test)break;
 }
 /* --- FORWARD PAD: the repair passive (added at v85) ---
    Sits here rather than in updateUnit because the PAD is the scarce thing: one or
    two per base against however many aircraft, so the walk is over the aircraft
    near a pad and not over the pads near every aircraft.
    allied() rather than b.p, matching the Medic Truck: a team-mate's Huey sets down
    on your pad. Aircraft only - t.fly is the whole filter, so a Chinook full of
    infantry is repaired and the men inside it are not, which is already how the
    Medic treats a loaded APC. Repairs to mhp and no further, and only what is
    actually hurt, so a full flight costs nothing. */
 if(b.t.pad&&b.hp>0){
  for(const u of G.units){
   if(!u.t.fly||u.hp<=0||u.hp>=u.mhp||u.garrisoned||!allied(u.p,b.p))continue;
   const dx=Math.max(0,Math.abs(u.x-b.x)-b.sz*.5),dy=Math.max(0,Math.abs(u.y-b.y)-b.sz*.5);
   if(dx*dx+dy*dy<=PAD_R*PAD_R)u.hp=Math.min(u.mhp,u.hp+PAD_REP*dt);
  }
 }
 if(b.abilityCool>0)b.abilityCool-=dt; // v30.1: tick the shared call-down on EVERY building - the Radio Tower is neither a guardtower nor a garrisoned bunker, so inside the branch below it never recharged after the first use
 /* v79: the uplink's REMAINING duration, ticked out here for the same reason the
    cooldown above is - the Radar Tent falls into neither branch below, so a timer
    parked inside one would never run out. Two timers, not one: abilityCool is the
    wait before the next use and upT is how long this use has left. */
 if(b.upT>0)b.upT-=dt;
 /* v81: a locked-down bunker is buttoned up - the garrison stops firing for as
    long as upT runs, which is the whole cost of the ability. */
 const isT=b.key==='guardtower',isBk=b.key==='bunker'&&b.garrison.length&&!(b.t.lock&&b.upT>0);
 if((isT||isBk)){
  if(b.cool>0)b.cool-=dt;
  if(G.tick%8===b.id%8||!b.target||b.target.hp<=0){
   b.target=null;let bd=(isT?b.t.rg:5.5)**2;
   for(const e of G.units){if(allied(e.p,b.p)||e.garrisoned||!ballOk(b,e)||hid81(e,b.p))continue;const d=(e.x-b.x)**2+(e.y-b.y)**2;if(d<bd){bd=d;b.target=e}}
   for(const cr of (G.neutrals||[])){if(cr.hp<=0)continue;const d=(cr.x-b.x)**2+(cr.y-b.y)**2;if(d<bd){bd=d;b.target=cr}} // v34: towers/bunkers also fire on hostile wildlife (matches nearestEnemy; wave bugs live in G.neutrals)
  }
  if(b.target&&b.cool<=0){
   b.cool=isT?b.t.rt:.7;b.tface=datan2(b.target.y-b.y,b.target.x-b.x);
   // upgraded guard tower hits +12% harder
   const towerUp=(isT&&b.upg)?UPGRADES.guardtower.dm:1;
   const dm=isT?b.t.dm*FAC[b.p.fac].mods.dmg*towerUp:8*HP_SCALE*b.garrison.length;
   applyDmg(b.target,dm,'b',b);
   const gz=isT?26:14, sang=screenAng(b.tface);
   const mx=b.x+dcos(b.tface)*.7, my=b.y+dsin(b.tface)*.7;
   tracer2(mx,my,gz,b.target.x,b.target.y,8,'#ffd23f',2.2);
   muzzle(mx,my,gz,sang,'#ffe27a',1.2);
   sparks(b.target.x,b.target.y,8,'#ffe08a',3);
   sfxGun(b.x,b.y,'tower',b.target.x,b.target.y);
  }
 }
}

/* ---------------- PROJECTILES ---------------- */
function updateProjs(dt){
 for(let i=G.projs.length-1;i>=0;i--){
  const p=G.projs[i];
  if(p.tgt&&p.tgt.hp>0){p.tx=p.tgt.x;p.ty=p.tgt.y}
  const dx=p.tx-p.x,dy=p.ty-p.y,d=dhyp(dx,dy);
  const step=p.sp*dt;p.travel+=step;
  if(d<=step||d<.15){
   G.projs.splice(i,1);
   /* v79: a smoke round raises a cloud and does no damage at all - not reduced
      damage, none. It carries pi rather than leaning on p.owner because the
      cloud outlives the tube that fired it. */
   if(p.smoke){G.strikes.push({kind:'smoke',owner:p.owner,pi:p.pi,x:p.tx,y:p.ty,t:0});spawnSmoke(p.tx,p.ty,18,{rise:3,grow:16,life:SMOKE_T,r:9,col:'#d8d8d4'});sfxBoom(p.tx,p.ty,'small');}
   else{splash(p.tx,p.ty,Math.max(p.spl,.3),p.dm,'ex',p.owner,p.wc);sfxBoom(p.tx,p.ty,p.spl>1?'big':(p.spl>0?'med':'small'));}
  }
  else {p.x+=dx/d*step;p.y+=dy/d*step;if(p.arc){const t=clamp(p.travel/p.total,0,1);p.z=10+60*4*t*(1-t)}
   // rocket/shell exhaust trail: alternating bright ember and a puff of pale smoke
   if(p.trail){
    G.parts.push({t:'em',x:p.x,y:p.y,z:p.z,vx:0,vy:0,vz:6,life:.18,r:1.1});
    if(Math.random()<.7)G.parts.push({t:'sm',x:p.x,y:p.y,z:p.z,vx:0,vy:0,vz:6,life:.55,r:2.4,grow:7,col:'#c8c8c8',seed:Math.random()*6.28});
   } else if(Math.random()<.6)G.parts.push({t:'sm',x:p.x,y:p.y,z:p.z,vx:0,vy:0,vz:5,life:.45,r:2,grow:5,col:'#bdbdbd',seed:Math.random()*6.28});
  }
 }
}

