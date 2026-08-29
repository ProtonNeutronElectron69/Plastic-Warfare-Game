/* ---------------- UNIT UPDATE ---------------- */
/* v43: one target scan for both callers. cone=true additionally requires the
   candidate to sit inside an entrenched gunner's firing arc. The tests run in the
   same order as the two v42 originals (distance first, arc second) and the arc
   test is skipped entirely when cone is falsy, so both call paths return exactly
   what they returned before. */
function nearestEnemy(u,r,cone){
 let best=null,bd=r*r;
 /* v83: the map's neutral barricades are collected SEPARATELY from best/bd and
    returned only when nothing else was found, which is what makes them a LOW
    priority rather than a near one: a hedgehog two tiles away can never pull a
    bot off a soldier ten tiles away, because it never competes on distance at
    all. It is answered only by a unit with no other target in range. */
 let nbarr=null,nbd=BARR_CLEAR2;
 const aa=!!(u.t&&u.t.aaOnly); // v51: an air-only weapon never acquires a ground target
 const sec=!!(u.t&&u.t.sec);   // v52: ...and a main gun never acquires its secondary's classes
 const cs=!!(u.t&&u.t.cshot&&u.cs); // v81: Called Shot restricts him to infantry outright
 const bl=wcOf(u)!=='a';           // v86: ...and nothing but an AA missile ever acquires an Observation Balloon
 for(const e of G.units){if(allied(e.p,u.p)||e.garrisoned||(aa&&!e.t.fly)||(sec&&secOwns(u,e))||(cs&&armorOf(e)!=='inf')||(bl&&e.t.balloon)||hid81(e,u.p))continue;const d=(e.x-u.x)**2+(e.y-u.y)**2;if(d<bd&&(!cone||inCone(u,e.x,e.y))){bd=d;best=e}}
 for(const b of G.blds){if(aa||cs||allied(b.p,u.p))continue; // v51: no structure is ever airborne. v81: and Called Shot takes no structure either
  // barricades: never chase neutral ones; only break enemy ones when right up against them
  // v25: dens are never auto-targeted by a PLAYER; you break those deliberately.
  // v66: a CPU army does break one, but only a den that is actually roused and
  // right on top of it - otherwise nest regen would bleed every AI attack that
  // ever walks past a hill, with nothing in aiTick able to answer it.
  if(b.key==='nest'){
   if(!(u.p&&u.p.ai))continue;
   const ns=G.map.nests[b.nsi];
   if(!ns||ns.dead||!ns.aggro)continue;
   const d=(b.x-u.x)**2+(b.y-u.y)**2;if(d<NEST_AGGRO2&&d<bd&&(!cone||inCone(u,b.x,b.y))){bd=d;best=b}
   continue;
  }
  if(b.t.barr){ // v88: t.barr
   if(b.p===G.neutral){ // v83: a BOT clears the map's scattered hedgehogs; a player's units still never auto-target them
    if(!(u.p&&u.p.ai)||(u.id%BARR_CLEAR_SHARE))continue; // keyed on id, never on srand: reading the sim stream from a targeting scan would move every trail
    const d=(b.x-u.x)**2+(b.y-u.y)**2;
    if(d<nbd&&(!cone||inCone(u,b.x,b.y))){nbd=d;nbarr=b}
    continue;
   }
   const d=(b.x-u.x)**2+(b.y-u.y)**2;if(d<BARR_AGGRO2&&d<bd&&(!cone||inCone(u,b.x,b.y))){bd=d;best=b}continue;}
  const d=(b.x-u.x)**2+(b.y-u.y)**2;if(d<bd&&(!cone||inCone(u,b.x,b.y))){bd=d;best=b}}
 // also fire on hostile wildlife that's actively threatening
 for(const cr of (G.neutrals||[])){if(cr.hp<=0||cs||(aa&&!cr.t.fly)||(sec&&secOwns(u,cr)))continue;const d=(cr.x-u.x)**2+(cr.y-u.y)**2;if(d<bd&&(!cone||inCone(u,cr.x,cr.y))){bd=d;best=cr}}
 return best||nbarr; // v83: the hedgehog only when the sweep above found nothing at all
}
/* --- TARGET UPLINK ---
   v79. True while any completed Radar Tent of this army is running its uplink. The
   scan mirrors the Munitions Dump read in dmgBonus: a short walk over one
   player's own building list, reading hashed state only. */
function upOn(p){
 if(!p||!p.blds)return false;
 for(const b of p.blds)if(b.t.uplink&&b.upT>0&&b.prog>=1&&b.hp>0)return true;
 return false;
}
/* --- SCRAMBLE (added at v85) ---
   True while any completed Forward Pad of this army is running it. Deliberately a
   carbon copy of upOn above rather than a generalised "is any building running a
   mode" helper: the two read different flags for different effects, and one shared
   scanner would have to be told which, which is the same walk with an argument. */
function scramOn(p){
 if(!p||!p.blds)return false;
 for(const b of p.blds)if(b.t.scram&&b.upT>0&&b.prog>=1&&b.hp>0)return true;
 return false;
}
/* --- THE SIGNAL RUNNER'S TWO AURAS (added at v85) ---
   Both answer "is there a Runner near this man", and both are read off the RUNNER
   rather than written onto the men around him, which is what keeps a sprinting
   platoon from carrying twenty copies of the same fact through the hash and the
   snapshot. Same shape as the Sarge and Chinook loops in dmgBonus.
   The infantry gate comes first and is the reason these are cheap: every vehicle,
   aircraft and truck in the game leaves on the first line without touching G.units.
   Inside the loop the flag test leads, and it is undefined on every unit in the
   file except a Signal Runner, so the body is one property read per unit.
   Unlike "On Me!", both of these DO include the Runner himself: he pays no penalty
   for either, so there is nothing for excluding him to price. */
function rnetOn(u){
 if(!u||u.t.a!=='inf')return false;
 for(const v of G.units){
  if(!v.t.rnet||v.hp<=0||v.garrisoned||!allied(v.p,u.p))continue;
  if((v.x-u.x)**2+(v.y-u.y)**2<=RNET_R*RNET_R)return true;
 }
 return false;
}
function sprintOn(u){
 if(!u||u.t.a!=='inf')return false;
 for(const v of G.units){
  if(!v.spr||v.hp<=0||v.garrisoned||!allied(v.p,u.p))continue;
  if((v.x-u.x)**2+(v.y-u.y)**2<=SPRINT_R*SPRINT_R)return true;
 }
 return false;
}
/* --- THE THREE GREEN AURAS (added at v86) ---
   All three answer "is there one of these near me", all three are read off the
   SOURCE at the point of use, and none of them writes anything onto the entities
   they affect. That is the v85 seam repeated deliberately: Broadcast over a
   twenty-man line, High Ground over a whole army and the Command Post's aura over
   a base are still one boolean, one flag and one building respectively, and
   hashState and the snapshot never grow by a field per affected unit.
   Where these differ from the Runner's pair is the missing infantry gate: a
   reloading gun, a weapon range and a promotion belong to vehicles and aircraft
   as much as to men, so there is no class to leave on first. The flag test still
   leads inside the loop and is undefined on every unit in the file except the two
   Green vehicles, so the body is one property read per unit either way. */
function bcastOn(u){
 if(!u||!u.p)return false;
 for(const v of G.units){
  if(!v.bcast||v.hp<=0||v.garrisoned||!allied(v.p,u.p))continue;
  if((v.x-u.x)**2+(v.y-u.y)**2<=BCAST_R*BCAST_R)return true;
 }
 return false;
}
/* High Ground reaches as far as the balloon can SEE, which is the point of it -
   the aura is the observation, so it has to be the same radius as the sight and
   is read through viOf rather than off the row, so an uplinked balloon extends
   the bonus exactly as far as it extends the vision. viOf never calls rgOf, so
   the pair cannot recurse. */
/* --- FORWARD OBSERVER, ADDED AT v88 ---
   Read off the SOURCE at the point of use, like sprintOn, rnetOn, bcastOn,
   highOn and cpostOn before it. One difference decides the whole shape: every
   other aura in the file asks "is the AFFECTED UNIT in reach of a source", and
   this one asks "is the TARGET". A spotter extends the guns' reach against what
   the SPOTTER can see, not against everything a gun near the spotter feels like
   shelling, so the range test runs from the Choktaw to the target and rgOf takes
   an optional second argument to carry it.
   A call with no target - an acquisition sweep, the entrenched cone, the ring
   the renderer draws - gets the unextended range, and that is correct rather
   than an omission: nothing has been spotted yet, so there is nothing for an
   observer to be looking at.
   Indirect fire is `t.mrg`, the minimum-range flag the Mortar Squad and the
   Rocket Artillery already carry. That is the file's own word for an arcing
   weapon, so a third one added later is covered without being remembered into a
   list of two unit keys. */
function fobOn(u,tgt){
 if(!u||!u.p||!tgt||!u.t.mrg)return false;
 for(const v of G.units){
  if(!v.t.fobs||v.hp<=0||v.garrisoned||!allied(v.p,u.p))continue;
  const vi=viOf(v);
  if((v.x-tgt.x)**2+(v.y-tgt.y)**2<=vi*vi)return true;
 }
 return false;
}
function highOn(u){
 if(!u||!u.p)return false;
 for(const v of G.units){
  if(!v.t.balloon||v.hp<=0||v.garrisoned||!allied(v.p,u.p))continue;
  const vi=viOf(v);
  if((v.x-u.x)**2+(v.y-u.y)**2<=vi*vi)return true;
 }
 return false;
}
/* The Command Post measures to the FOOTPRINT edge, the way the Medic Truck and
   the Forward Pad already do for buildings, so a 2x2 post covers the same ground
   on every side of itself. */
function cpostOn(u){
 if(!u||!u.p)return false;
 for(const b of G.blds){
  if(!b.t.cpost||b.prog<1||b.hp<=0||!allied(b.p,u.p))continue;
  const dx=Math.max(0,Math.abs(u.x-b.x)-b.sz*.5),dy=Math.max(0,Math.abs(u.y-b.y)-b.sz*.5);
  if(dx*dx+dy*dy<=CPOST_R*CPOST_R)return true;
 }
 return false;
}
/* Effective range and sight for a unit. Every sim-side reader goes through
   these two. A zero base stays zero, so an unarmed hull cannot be handed a
   weapon range and a sightless entity cannot be handed vision. */
function rgOf(u,tgt){let r=(u.t.rg||0);if(r>0&&u.t.valve&&u.valve)r+=VALVE_RG;if(r>0&&highOn(u))r+=HIGH_RG;if(r>0&&fobOn(u,tgt))r+=FOB_RG;return r>0&&upOn(u.p)?r+UPLINK_RG:r;} // v86: High Ground rides the same door Pressure Valve and the uplink already use. v88: and Forward Observer, which is the first of them that needs to know WHAT is being shot at
function viOf(u){let v=(u.t.vi||0);if(v>0&&u.t.flat&&u.flat)v+=FLAT_VI;if(v>0&&rnetOn(u))v+=RNET_VI;return nightVi(v>0&&upOn(u.p)?v+UPLINK_VI:v);} // v101: night halves it, bonuses included - the dark shortens what an uplinked eye sees exactly as it shortens a plain one
/* v101 bviOf - the building half of the same door. Structure vision was read
   raw off b.t.vi at three sites (the fog stamp, pVision, the HQ placement
   gate), which was fine while the row was the whole answer; the night cut
   makes it a derived figure, so the read gets a name and every site goes
   through it. Same zero-stays-zero rule as viOf. */
function bviOf(b){return nightVi(b.t.vi||0)}
/* v80: effective ground speed. u.sp is the baked per-unit figure (type row x
   faction modifier x production buff) and stays the base; this is the one place
   a sustained mode may bend it. A unit with no throttle capability returns u.sp
   untouched, so nothing but the Bull can be handed a speed it did not earn.
   Note the flag carry and the terrain multiplier stay OUTSIDE this: they are
   situational and already applied at each call site. */
/* v85: two more modes can bend it, and the shape had to change to take them. The
   v82 chain answered "which ONE of my own flags is set", which cannot express an
   aura the unit does not carry or a building-wide order it never hears about.
   Multiplied rather than chained, so a sprinting infantryman under a Scramble is
   not silently handed only whichever the ternary happened to test first - although
   in practice no unit is both, since Scramble is air-only and Sprint infantry-only.
   The Bull and the Bike keep exclusive first claim on their own hulls, which is the
   v82 behaviour preserved exactly: neither can ever be inside a Sprint (both are
   vehicles) and neither flies. */
function spOf(u){
 let s=u.sp;
 if(u.t.throttle&&u.thr)s*=1+THROTTLE_SPD;
 else if(u.t.flat&&u.flat)s*=1+FLAT_SPD;
 if(u.t.fly&&scramOn(u.p))s*=1+SCRAM_SPD;
 else if(sprintOn(u))s*=1+SPRINT_SPD;
 return s;
}
/* v81 CAMOUFLAGED. "Is not seen" is UNIFORM across every hostile army, so the
   per-player half of the question is the allied() test each door already runs
   and no visibility grid is needed. G.fog is client-local and is NOT consulted
   here; shotT is hashed, so every peer answers this identically.
   Consulted at six sim doors (nearestEnemy, nearestSec, the tower/bunker scan,
   orderAttack, the aiTick threat list) and at visibleToHuman for the client.
   NOT consulted by the retaliation block or the call-for-help sweep, and that
   is deliberate rather than an omission: firing zeroes shotT, so a man who has
   just been shot at can always answer the man who shot him.
   A target already held is KEPT when he goes cold - concealment blocks
   acquisition, it does not break a lock somebody already had. */
function hid81(e,obs){return !!(e&&e.t&&e.t.camo&&e.hp>0&&e.shotT>=CAMO_T&&e.p&&obs&&!allied(e.p,obs));}
/* v81 RIPPLE FIRE. The salvo shape is a per-UNIT question now, not a per-row
   one: fireAt used to read u.t.sal straight off the type table, and the Rocket
   Artillery has no sal of its own to read. Every salvo consumer goes through
   these three, so a toggled shape and the AA truck's fixed one cannot drift. */
function salOf(u){return (u.t.ripple&&u.rip)?RIPPLE_N:(u.t.sal||0);}
function srtOf(u){return (u.t.ripple&&u.rip)?RIPPLE_SRT:(u.t.srt||0);}
/* v86: Broadcast lives here rather than at the u.cool assignment because rtOf IS
   the reload - Ripple Fire's longer one and an entrenched gunner's divided one
   both resolve through it, so a broadcast covers all three shapes at one door and
   leaves the INTER-salvo spacing (srtOf) alone, which is a cadence and not a
   reload. The one shot in the file that does not come through here is the
   Paratrooper's, whose munition carries its own rt exactly as it carries its own
   range past rgOf; a drop-only unit standing outside both doors is the v30
   behaviour and is left as it is. */
function rtOf(u){const rt=(u.t.ripple&&u.rip)?u.t.rt*RIPPLE_RT:u.t.rt;return bcastOn(u)?rt*(1-BCAST_RT):rt;}
/* v81 CALLED SHOT: may this man take this target at all? Shaped like aaOk -
   a class gate, no hp, no range, no garrison. */
function csOk(u,e){return !(u.t.cshot&&u.cs)||(!!e&&e.kind==='unit'&&armorOf(e)==='inf');}
/* v86 THE BALLOON'S ACQUISITION GATE. Shaped like csOk and aaOk - a class test,
   no hp, no range, no garrison - but read the other way round: it is a property of
   the TARGET restricting who may hold it, where those two are properties of the
   shooter restricting what it may hold. wcOf answers for a building as well as a
   unit, so the guard tower and the bunker are covered by the same line and cannot
   plink at a balloon either. Damage is a separate rule at targetDmgMul; this one
   is about whether a weapon may point at it at all, and without it every rifleman
   in the game would stand under one forever dealing nothing. */
function ballOk(a,e){return !(e&&e.t&&e.t.balloon)||wcOf(a)==='a';}
// is a target within the entrench cone? half-angle 50° => 100° total, centered on coneDir.
const CONE_HALF=Math.PI*50/180;
function inCone(u,tx,ty){
 let da=datan2(ty-u.y,tx-u.x)-u.coneDir;
 da=datan2(dsin(da),dcos(da));
 return Math.abs(da)<=CONE_HALF;
}
// nearest enemy that also falls inside the entrench cone (for an entrenched gunner)
function nearestEnemyCone(u,r){return nearestEnemy(u,r,true)}
/* Attacker-side damage buffs, multiplied in fireAt before the counter matrix runs.
   Two independent sources, so they stack with each other but never with themselves:
   the Munitions Dump aura, and (v46) a transport with t.aura steadying the infantry
   around it. Squared distance on the second one - no sqrt, so this stays inside the
   T23.H purity lint - and it reads only hashed state, so nothing new is serialized. */
function dmgBonus(u){
 let m=1;
 for(const b of u.p.blds)if(b.key==='dump'&&b.prog>=1&&dhyp(b.x-u.x,b.y-u.y)<DUMP_R){m*=1+(b.upg?DUMP_AURA_UP:DUMP_AURA);break}
 if(u.t.a==='inf'){
  for(const v of G.units){
   if(!v.t.aura||v.hp<=0||v.garrisoned||!allied(v.p,u.p))continue;
   const R=v.t.auraR;
   if((v.x-u.x)**2+(v.y-u.y)**2<=R*R){m*=1+v.t.aura;break} // first carrier wins: the aura never stacks
  }
  /* v79 "ON ME!". A separate multiplier from the transport loop above, and
     deliberately so: this was approved to STACK with the Chinook, so a Green
     rifleman standing under both an allied Chinook and his own Sarge gets both.
     It does not stack with ITSELF - first Sarge wins - even though only one army
     per match can field one, because two allied armies must not double it.
     Sarge broadcasting does not buff himself; his own shot pays SARGE_SELF. */
  for(const v of G.units){
   if(!v.t.rally||!v.onMe||v.hp<=0||v.garrisoned||v===u||!allied(v.p,u.p))continue;
   if((v.x-u.x)**2+(v.y-u.y)**2<=SARGE_AURA_R*SARGE_AURA_R){m*=1+SARGE_AURA;break}
  }
 }
 if(u.t.cshot&&u.cs)m*=1+CS_DMG;       // v81: Called Shot, paid for by taking no target that is not a man
 if(u.t.valve&&u.valve)m*=1+VALVE_DMG; // v80: Pressure Valve. The recoil that pays for it is in fireAt, where the damage actually dealt is known
 if(u.t.rally&&u.onMe)m*=SARGE_SELF; // the price of the broadcast, paid by the man making it
 return m;
}
// garrison capacity: upgraded bunkers hold more (4 -> 6)
function garCap(b){return b.t.cap?b.t.cap:(b.t.gar?(b.upg?Math.round(b.t.gar*((UPGRADES[b.key]&&UPGRADES[b.key].eff)||1)):b.t.gar):0);} // v30: APC troop bay rides the same readout. v77 D5: the bare 6 was a second derivation of what the info card already computed from UPGRADES; both now read the one table
/* ---- TURRETED HULLS ----
   v41 decoupled the tank hull from its turret by testing a:'tank' inline in three
   places. The AA truck needs the same treatment, so the test is now one predicate.
   Deterministic: reads a static table field and nothing else. */
function turreted(t){return t.a==='tank'||t.a==='aa';}
/* ---- AIR-ONLY WEAPONS ----
   t.aaOnly units acquire nothing that is not flying. Enforced at the two choke
   points every target assignment passes through: nearestEnemy (idle sighting,
   attack-move sighting, the entrench cone) and orderAttack (player orders, AI
   orders, retaliation and the call-for-help sweep). Weapon row 'a' being zero
   against every ground class is the second, independent lock. */
function aaOk(u,e){return !u.t.aaOnly||!!(e&&e.t&&e.t.fly);}
/* Sustained DPS including salvo shape: a salvo weapon fires sal shots srt apart
   and then reloads for rt, so dm/rt understates it badly. For every non-salvo
   unit this returns dm/rt exactly, which is why the info card and aiPickUnit can
   both switch to it without moving a single existing number. */
function unitDPS(t){const n=t.sal||1,cyc=t.rt+(n-1)*(t.srt||0);return cyc>0?t.dm*n/cyc:0;}
/* ---- SECONDARY WEAPON ----
   A unit carrying t.sec runs a completely independent second weapon: its own
   target, its own cooldown, its own counter class. The Bull's hull flamethrower
   is the only user - it burns infantry and wildlife inside 2.6 tiles while the
   main cannon goes on engaging whatever it had already acquired. Stateless apart
   from cool2/target2; acquisition is on a G.tick/id cadence, never a wall clock,
   and every distance goes through dhyp. */
/* ---- THE SECONDARY'S CLASSES ----
   Which target classes a unit's secondary weapon OWNS. This is the single source
   of truth for the split, read by three consumers that must never disagree:
     - secValid()    : may the flamer shoot this? (owns it AND it is alive/exposed)
     - nearestEnemy(): the main gun's acquisition gate skips anything owned here
     - mainOk()      : the main gun's ORDER gate does the same
   v51 shipped the class test inline in nearestEnemy as well as here; that is the
   duplication that would let the two weapons drift apart, so it is gone.
   Pure class predicate: no hp, no garrison, no range - those belong to the callers. */
function secOwns(u,e){
 if(!u.t.sec||!e)return false;
 if(e.kind==='creature')return true;                 // v51: wildlife is a flame target
 return e.kind==='unit'&&armorOf(e)==='inf';         // v51: and infantry
}
function secValid(u,e){
 if(!e||e.hp<=0)return false;
 if(e.kind==='unit'&&e.garrisoned)return false;
 return secOwns(u,e);
}
/* v52: may the MAIN weapon take this target? Air-only units answer to aaOk; a unit
   with a secondary hands that secondary's classes over completely. The Bull's cannon
   therefore ignores infantry and wildlife outright and spends every shell on armor,
   aircraft and structures, while the flamer works its own target in parallel. */
function mainOk(u,e){return aaOk(u,e)&&!secOwns(u,e)&&csOk(u,e)&&ballOk(u,e);} // v86: +the balloon gate
function nearestSec(u,r){
 let best=null,bd=r*r;
 for(const e of G.units){if(allied(e.p,u.p)||!secValid(u,e)||hid81(e,u.p))continue;const d=(e.x-u.x)**2+(e.y-u.y)**2;if(d<bd){bd=d;best=e}}
 for(const cr of (G.neutrals||[])){if(!secValid(u,cr))continue;const d=(cr.x-u.x)**2+(cr.y-u.y)**2;if(d<bd){bd=d;best=cr}}
 return best;
}
/* v88: the secondary stopped ASSUMING a flamethrower. From v80 to v87 the Bull
   was the only carrier of a `sec`, so this function spawned flame, splashed on
   row 'f' and played the hose - three facts about the Bull baked into machinery
   whose whole claim is that it is generic. The Choktaw's door gun is the second
   carrier and it is a machine gun, so the branch reads sc.w the way fireAt reads
   u.t.w, and the Bull's path below is byte-identical to what it always was.
   A bullet secondary lands through applyDmg directly rather than through splash:
   sc.spl is what the flamer sprays and a machine gun has no burst radius at all,
   so a row that declares no spl gets a point hit, which is the same rule fireAt
   applies to weapon row 'b'. */
function fireSec(u,tgt){
 const sc=u.t.sec;
 u.cool2=sc.rt;
 const dm=u.dm*sc.k*dmgBonus(u);
 if(sc.w==='b'){
  applyDmg(tgt,dm,'b',u,sc.wc);
  const gz=u.t.fly?34:9, tz=tgt.kind==='bld'?12:(tgt.t&&tgt.t.fly?34:8);
  const ang=datan2(tgt.y-u.y,tgt.x-u.x);
  tracer2(u.x,u.y,gz,tgt.x,tgt.y,tz,'#ffd23f',2.4);
  muzzle(u.x,u.y,gz,screenAng(ang),'#ffe27a',1.15);
  sparks(tgt.x,tgt.y,tz,'#ffe08a',4);
  sfxGun(u.x,u.y,'vmg',tgt.x,tgt.y);
  return;
 }
 spawnFlame(u.x,u.y,tgt.x,tgt.y,sc.spl);
 splash(tgt.x,tgt.y,sc.spl,dm,'fire',u,sc.wc);
 sfxFlame(u.x,u.y,tgt.x,tgt.y);
}
function updateSec(u,dt){
 const sc=u.t.sec;
 if(u.cool2>0)u.cool2-=dt;
 let tg=u.target2;
 if(tg&&(!secValid(u,tg)||dhyp(tg.x-u.x,tg.y-u.y)>sc.rg))tg=u.target2=null;
 if(!tg&&G.tick%5===u.id%5)tg=u.target2=nearestSec(u,sc.rg);
 if(tg&&u.cool2<=0)fireSec(u,tg);
}
/* --- SMOKE ROUNDS ---
   v79. A smoking mortar picks the friendly unit that has most recently been hit
   inside its own firing band and drops a cloud on it. No target is stored: the
   scan runs only when the tube is actually loaded, which at a 3.4s reload is
   once every 102 ticks per mortar, so there is nothing to serialize and nothing
   to resolve on load.
   The band is the mortar's own rgOf/mrg pair, so its 2-tile minimum range still
   applies - it cannot smoke a man standing on top of it, which is the same
   geometry its high-explosive shells have always had. */
function nearestHurtFriend(u){
 let best=null,bd=1e9;
 const rg=rgOf(u),minR=u.t.mrg||0;
 for(const v of G.units){
  if(v===u||v.hp<=0||v.garrisoned||!allied(v.p,u.p))continue;
  if(v.calmT>=HURT_WINDOW)continue;                 // not under fire right now
  const d=dhyp(v.x-u.x,v.y-u.y);
  if(d>rg||d<minR)continue;
  /* rank on how recently they were hit, distance breaking the tie, then id so
     two mortars with identical readings cannot disagree between peers */
  const sc=v.calmT*1000+d;
  if(sc<bd||(sc===bd&&best&&v.id<best.id)){bd=sc;best=v}
 }
 return best;
}
function updateSmoke(u,dt){
 if(u.cool>0)return;
 const tg=nearestHurtFriend(u);
 if(!tg)return;
 u.face=u.tface=datan2(tg.y-u.y,tg.x-u.x);
 fireAt(u,tg);
}
function fireAt(u,tgt){
 if(u.t.camo)u.shotT=0; // v81: firing is what breaks concealment, and it breaks it here rather than at the muzzle flash so a smoke round would count too
 // v30: the paratrooper swaps munitions with the target class (SMG / AT grenade / HE charge)
 const M=u.key==='para'?paraMun(tgt):null;
 u.cool=(u.entrenched?rtOf(u)/ENTRENCH_RATE:(M?M.rt:rtOf(u))); // v69: 2.0x -> ENTRENCH_RATE (1.5x). v81: the reload is rtOf, which is where Ripple Fire's longer one lives. A named divide, so the UI strings and the help slot read the same number the sim does
 // v51: a salvo weapon spends sal shots srt apart, then pays the full rt as a reload.
 // v81: salOf/srtOf/rtOf, so a toggled salvo and the AA truck's fixed one run the same machinery.
 {const sn81=salOf(u);if(sn81){if(u.salv==null||u.salv<=0)u.salv=sn81;u.salv--;u.cool=u.salv>0?srtOf(u):rtOf(u);}}
 u.tface=datan2(tgt.y-u.y,tgt.x-u.x);
 const isTank=turreted(u.t); if(!isTank)u.face=u.tface; // v41/v51: a turreted hull keeps its travel facing; the turret aims independently
 const aim=isTank?u.tface:u.face; // shells / tracers / muzzle flash emit from the turret for tanks, the hull otherwise
 /* --- v79 WALKING FIRE ---
    u.wf counts CONSECUTIVE shells already landed on u.wfT, so the first shell at
    a new target is always unramped and the ramp is spent, not banked: switching
    target resets it. Both fields are hashed. Smoke rounds do no damage and are
    excluded, so smoking does not quietly bank a ramp for later. */
 let wfM=1;
 if(u.t.wf&&!u.smoke){
  if(u.wfT===tgt.id)u.wf=Math.min(u.wf+1,Math.round(MORT_WF_CAP/MORT_WF_STEP));
  else{u.wfT=tgt.id;u.wf=0}
  wfM=1+Math.min(MORT_WF_CAP,u.wf*MORT_WF_STEP);
 }
 const rip81=!!(u.t.ripple&&u.rip); // v81
 const dm=u.dm*dmgBonus(u)*(M?M.k:1)*wfM*(rip81?RIPPLE_DM:1);
 const w=M?M.w:u.t.w;
 const wc=M?(M.wc||M.w):u.t.w;   // v45: counter class of THIS shot (differs from w only for para AT/HE)
 const col=FAC[u.p.fac].color;
 const sang=screenAng(aim); // v41: screen-space muzzle angle (turret aim for tanks, hull otherwise)
 const gz=u.t.fly?34:(u.t.a==='inf'?11:9); // barrel height
 // barrel tip in screen units, projected back to a world offset for the flash anchor
 const reach=u.t.a==='inf'?0.55:(u.t.big?1.1:0.85);
 const mx=u.x+dcos(aim)*reach, my=u.y+dsin(aim)*reach;
 u.flash=0.1; u.flashAng=aim; // drives the barrel-flash drawn on the unit itself
 if(w==='b'){
  applyDmg(tgt,dm,'b',u,wc);
  const tz=tgt.kind==='bld'?12:(tgt.t&&tgt.t.fly?34:8);
  // sniper: long, thin, bright-white lance. jeep/heli/sarge MG: rapid yellow tracer. grunt: short visible bolt.
  if(u.key==='sniper'){
   tracer2(mx,my,gz,tgt.x,tgt.y,tz,'#ffffff',2.6);
   muzzle(mx,my,gz,sang,'#bfe6ff',1.5);
  } else if(u.key==='jeep'||u.t.fly||u.key==='sarge'||u.key==='bike'){
   tracer2(mx,my,gz,tgt.x,tgt.y,tz,'#ffd23f',2.4);
   muzzle(mx,my,gz,sang,'#ffe27a',1.15);
  } else { // grunt & generic riflemen — make their shots clearly visible
   tracer2(mx,my,gz,tgt.x,tgt.y,tz,'#fff0b0',2.0);
   muzzle(mx,my,gz,sang,'#ffd24a',1);
  }
  sparks(tgt.x,tgt.y,tz,'#ffe08a',4);
  sfxGun(u.x,u.y,gunKind(u),tgt.x,tgt.y);
 } else if(w==='f'){
  spawnFlame(u.x,u.y,tgt.x,tgt.y,u.t.spl);
  muzzle(mx,my,gz,sang,'#ff7b1e',1.3);
  sfxFlame(u.x,u.y,tgt.x,tgt.y);
  /* --- v80 COOK-OFF and PRESSURE VALVE ---
     Cook-Off is keyed on t.cook, so it belongs to the Flamethrower and not to
     weapon row 'f' - the Bull's hull flamer (fireSec) and the Radio Tower's
     napalm both score on that row and neither ignites.
     The valve's recoil is a share of what the shot ACTUALLY dealt, which is
     what splash now returns. Attributed to a null attacker on purpose: it is
     his own hose, so nobody scores the kill, nobody earns veterancy off it and
     the retaliation sweep never sees it. It does route through applyDmg, so it
     resets his own calmT and is reduced by an APC shield or a smoke cloud over
     him exactly as any other damage would be. */
  const dealt80=splash(tgt.x,tgt.y,u.t.spl,dm,'fire',u,wc,u.t.cook?COOK_DPS:0);
  if(u.t.valve&&u.valve&&dealt80>0)applyDmg(u,dealt80*VALVE_BACK,'f',null);
  /* --- v87 SCORCHED EARTH ---
     Keyed on t.scorch, so it belongs to the Firebomb Heli and not to weapon row
     'f' - exactly as Cook-Off above it is keyed on t.cook rather than on the row
     the Flamethrower, the Bull's hull flamer and the tower's napalm all share.
     The two are deliberately different weapons: Cook-Off sets the TARGET alight
     and moves with him, Scorched Earth sets the GROUND alight and stays where the
     bomb fell, so a target that walks away walks out of it and one that holds its
     position does not. */
  if(u.t.scorch)scorchGround(u,tgt.x,tgt.y);
 } else if(w==='g'){
  // GRENADE: a hand-lobbed frag that arcs to the target and bursts with minor splash.
  // Modeled as a fast, high arc projectile with no homing (it lands where aimed).
  const dist=dhyp(tgt.x-u.x,tgt.y-u.y);
  G.projs.push({x:mx,y:my,z:gz+4,tx:tgt.x,ty:tgt.y,tgt:null,sp:M?M.gsp:9,dm,spl:M?M.spl:(u.t.spl||.9),type:'ex',owner:u,wc,arc:true,grenade:1,cls:'gren',cal:M&&M.gsp<6?1.4:1,travel:0,total:dist,trail:false}); // v30: paratrooper AT/HE lobs
  // small throwing puff at the hand, no big back-blast
  spawnEmbers(mx,my,1,.6);
  sfxThrow(u.x,u.y,tgt.x,tgt.y);
 } else { // rockets / mortars / tank shells
  // v51: an AA missile homes like a rocket, only faster (sp 13 vs 11).
  /* v79: a smoke round is the same arcing shell with its damage taken off and a
     smoke:1 tag on it; updateProjs raises a cloud instead of calling splash. The
     projectile is otherwise identical so the flight, the arc and the lead all
     behave exactly as a live shell does. */
  const sm=!!u.smoke;
  /* v81: a ripple rocket lands somewhere inside a box around the aim point
     instead of on it, which is what makes the salvo cover ground a single
     shell does not. The draw is srand(), the seeded sim RNG, never the host
     one - naming the host one here would trip the banned-token lint on its
     own prose, which is the v58 trap. */
  const px81=rip81?tgt.x+(srand()-0.5)*2*RIPPLE_BOX:tgt.x, py81=rip81?tgt.y+(srand()-0.5)*2*RIPPLE_BOX:tgt.y;
  G.projs.push({x:mx,y:my,z:gz,tx:px81,ty:py81,tgt:(w==='r'||w==='a')?tgt:null,sp:w==='m'?7:(w==='a'?13:11),dm:sm?0:dm,spl:sm?0:((u.t.spl||0)*(rip81?RIPPLE_SPL:1)),smoke:sm?1:0,pi:u.p.i,type:'ex',owner:u,wc,arc:w==='m',cls:w==='m'?'mortar':((w==='r'||w==='a')?'rocket':'shell'),cal:u.t.big?1.5:(u.t.a==='inf'?0.8:1.1),travel:0,total:dhyp(px81-u.x,py81-u.y),trail:w!=='m'});
  // big back-blast flash + smoke puff for launchers
  muzzle(mx,my,gz,sang, w==='m'?'#fff0b0':'#ffb347', u.t.big?2.2:1.7);
  // directional smoke kicked out behind the muzzle, plus a few sparks/embers
  const bx=u.x-dcos(u.face)*.4, by=u.y-dsin(u.face)*.4;
  spawnSmoke(bx,by,u.t.big?3:2,{rise:7,grow:6,life:1,r:3,col:'#b8b8b8',z:gz});
  spawnEmbers(mx,my,u.t.big?4:2,1);
  if(u.t.big||u.key==='arty'||u.key==='bulltank'){shakeAt(u.x,u.y,2.5);spawnDust(u.x,u.y,.8);}
  sfxLaunch(u.x,u.y,launchKind(u,w),tgt.x,tgt.y);
 }
}
/* v53: LINEAR falloff. splashMul(d,r) is full at the impact point and half at r,
   then holds at half across the caller's body-size allowance. One curve for units,
   creatures and structures alike - v52 and earlier gave buildings a full-damage
   core twice as wide, which was a body-size correction hidden inside the falloff.
   Pure arithmetic on two numbers: no RNG, no clock, no global state. */
function splashMul(d,r){return r>0?(d<r?1-0.5*(d/r):0.5):1;}
function splash(x,y,r,dm,type,owner,wc,burn){
 spawnExplosion(x,y,type==='fire'?.5:Math.max(.6,r));
 if(type!=='fire')shakeAt(x,y,r*2);
 let tot80=0; // v80: total damage actually applied, so a caller can price a cost against it
 /* v82: a passenger firing OUT of a Chinook is on the battlefield and a blast
   finds him. A bunker garrison and a quiet APC squad keep the exemption
   exactly as before - u.fo is false for both. Owner decision: splash answers
   Air Assault, the APC shield and smoke cover deliberately still do not. */
 const bwc86=wc||wcOf(owner); // v86: the class of THIS burst, for the balloon rule just below
 for(const e of G.units.slice()){if(allied(e.p,owner.p)||(e.garrisoned&&!e.fo))continue;
  /* v86: "splash never touches it" is enforced HERE rather than left to the zero
     multiplier, because a zero-damage applyDmg is not nothing - it resets calmT,
     wakes the retaliation sweep and drops an attack ping. The exception is an AA
     missile, which has to come through: every rocket in this file, the AA row
     included, does ALL of its damage as splash on impact (updateProjs never
     applies a direct hit), so refusing every burst would make the one weapon that
     is supposed to answer a balloon unable to scratch it. */
  if(e.t.balloon&&bwc86!=='a')continue;
  const d=dhyp(e.x-x,e.y-y);if(d<r+.4){tot80+=applyDmg(e,dm*splashMul(d,r),type,owner,wc);if(burn>0&&e.hp>0)applyBurn(e,burn);
  /* v81 SHELL SHOCK: whoever lives through the burst has SHOCK_SET seconds
     added to the reload clock he is already holding. Additive on purpose - a
     floor at this size sits under most reloads in the game and would be inert.
     Keyed on the owner's table row, so only the Rocket Artillery shocks, and
     reached only from splash(), which nothing outside the sim calls. No RNG. */
  if(owner&&owner.t&&owner.t.shock&&e.hp>0&&e.kind==='unit')e.cool+=SHOCK_SET;}}
 for(const cr of (G.neutrals||[])){if(cr.hp<=0||allied(cr.p,owner.p))continue;const d=dhyp(cr.x-x,cr.y-y);if(d<r+.4)tot80+=applyDmg(cr,dm*splashMul(d,r),type,owner,wc)} // v36: splash now hits wave creatures & wildlife (bullets already did). v80: wildlife is NOT ignited - tickBurns has never swept G.neutrals
 for(const b of G.blds.slice()){if(allied(b.p,owner.p))continue;const d=dhyp(b.x-x,b.y-y);if(d<r+b.sz*.6)tot80+=applyDmg(b,dm*splashMul(d,r),type,owner,wc)}
 if(type!=='fire')stampScorch(x,y,8+r*7);
 if(type==='fire'){spawnFlame(x,y,x+(Math.random()-.5),y+(Math.random()-.5));}
 return tot80;
}
/* --- SCUTTLE: the Munitions Dump detonates itself ---
   Added at v80. Deliberately NOT splash(): splash skips everything allied to the owner, and
   this ability is specified to hurt friendlies at SCUTTLE_FF. Three passes in
   a fixed order (units, wildlife, structures), each list collected BEFORE any
   damage is applied, so an entity that dies early cannot change who else was
   in the radius. The dump is excluded from its own sweep and destroyed at the
   end with a null attacker - scuttling your own building is not a kill for
   anyone. Falloff is the shared splashMul, and the blast resolves on weapon
   row 'x' (a dump is in no WC_BLD row), which is the flat 1.00 row every
   hazard and mine in the game already uses. */
function scuttle80(b){
 const us=[],crs=[],bs=[];
 for(const e of G.units){if(e.hp<=0||e.garrisoned)continue;const d=dhyp(e.x-b.x,e.y-b.y);if(d<SCUTTLE_R+.4)us.push([e,d]);}
 for(const cr of (G.neutrals||[])){if(cr.hp<=0)continue;const d=dhyp(cr.x-b.x,cr.y-b.y);if(d<SCUTTLE_R+.4)crs.push([cr,d]);}
 for(const e of G.blds){if(e===b||e.hp<=0)continue;const d=dhyp(e.x-b.x,e.y-b.y);if(d<SCUTTLE_R+e.sz*.6)bs.push([e,d]);}
 spawnExplosion(b.x,b.y,2.2);shakeAt(b.x,b.y,9);stampScorch(b.x,b.y,34);
 spawnSmoke(b.x,b.y,4,{rise:9,grow:7,life:2.8,r:5,col:'#3a3a3a'});sfxBoom(b.x,b.y,'big');
 for(const p80 of us)applyDmg(p80[0],SCUTTLE_DM*splashMul(p80[1],SCUTTLE_R)*(allied(p80[0].p,b.p)?SCUTTLE_FF:1),'ex',b);
 for(const p80 of crs)applyDmg(p80[0],SCUTTLE_DM*splashMul(p80[1],SCUTTLE_R),'ex',b);
 for(const p80 of bs)applyDmg(p80[0],SCUTTLE_DM*splashMul(p80[1],SCUTTLE_R)*(allied(p80[0].p,b.p)?SCUTTLE_FF:1),'ex',b);
 if(b.hp>0){b.hp=0;b.lastHit='ex';kill(b,null);}
}
/* ---------------- RADIO TOWER CALL-DOWNS ---------------- */
const RADIO_CD=180;            // shared 3-minute cooldown across EVERY call-down
// v50: one read point for the call-downs, so testing mode zeroes them all at once.
// The Radar Tent has no abilities; the Radio Tower owns the whole RADIO_ABILITIES
// table. The guard tower's fire-rate `cool` is deliberately NOT touched.
function radioCD(){return (G&&G.test)?0:RADIO_CD;}
/* ARTILLERY BARRAGE. BARRAGE_N off-map shells walk a BARRAGE_BOX-square box, one
   every BARRAGE_GAP seconds after a BARRAGE_FLY-second arc. Impact points are drawn
   from srand() at FIRE time and stored on the strike, so the shells land in the same
   places on every lockstep client and a snapshot taken mid-flight replays exactly.
   Damage runs weapon class q, which is 1.00 against everything except infantry.
   v77: 3 -> 7 shells at half damage each (210 -> 105). Two consequences were taken
   deliberately and are NOT bugs: the walk runs BARRAGE_FLY+(N-1)*GAP seconds
   rather than 5.6s, and total damage rises 630 -> 735 because seven halves are more
   than three wholes. This block sits ABOVE the ability table on purpose - the table
   is built at load time and reads BARRAGE_N for its panel copy, and a const is in
   the temporal dead zone until its own declaration runs.
   v103: GAP 2.0 -> 1.5 on the owner's instruction. The shells are unchanged in
   number, damage and scatter; only the cadence tightens, so the walk closes from
   13.6s to 10.6s and a target has less time to drive out from under it. */
const BARRAGE_N=7, BARRAGE_GAP=1.5, BARRAGE_FLY=1.6;
const BARRAGE_DMG=105, BARRAGE_R=3, BARRAGE_BOX=10;
/* The barrage row below has always built its panel string out of BARRAGE_N and
   BARRAGE_BOX. Napalm and Paradrop were the two that still typed their figures
   into the prose instead, in three places each - the panel row, the help-panel
   sentence and, for the paradrop, the message it prints on arrival. Naming them
   here puts all three call-downs on the same footing. */
const NAPALM_BOX=10;  // napalm bomblet grid, NAPALM_BOX x NAPALM_BOX tiles centred on the target
const PARA_N=5;       // paratroopers per drop
/* v76: ONE table of the tower's call-downs. The right-hand panel, the Field Manual
   info card, the help-panel prose and the vision gate all read it, so adding or
   removing an ability could not leave one surface claiming a different count.
   v77: the Magnifying Glass is gone. Removing the row is the whole removal as far
   as every UI surface is concerned; the sim-side machinery is deleted separately
   below so no dead ability function is left to drift. The barrage panel copy is a
   template literal for the same reason the manual slots are: it was a hand-typed
   shell count and would have gone stale the moment BARRAGE_N moved. */
const LIFT_ICON='\ud83d\ude81';
const SCR_ICON='\ud83c\udf2b\ufe0f'; // Smokescreen, v88 - the last call-down roadmap 2 adds
const DROP_ICON='\ud83d\udce6'; // v86: the Supply Drop's crate
/* v85: a row may now carry `fac`, meaning only that army's tower offers it. The
   three original call-downs carry none and stay shared by every army, which is what
   the absent field means - this is an addition to the table's vocabulary, not a
   re-reading of the rows already in it. Every surface that walks the table walks it
   through radioListFor(p) instead, so the panel, the manual and the vision gate
   agree about who has what without any of them knowing the rule. */
/* v86: `hint` is the line the panel prints once an ability is armed. It moved onto
   the row because the panel used to pick it with a chain of mode-name tests, which
   is a hand-kept copy of the table's own membership: a fourth mode already made
   that chain a nested ternary, and a fifth would have made it wrong. */
const RADIO_ABILITIES=[
 {mode:'napalm',  icon:'\ud83d\udd25',name:'Napalm Strike',   short:'Napalm',  panel:'Heavy fire + burn, '+NAPALM_BOX+'\u00d7'+NAPALM_BOX+' (needs vision)', vision:true, fac:'tan', hint:'Click a target anywhere you have vision.'}, // v87: Tan's alone now. It did not move to a second table or gain a second mechanism - it gained the field v85 put here for exactly this
 {mode:'barrage', icon:'\ud83c\udfaf',name:'Artillery Barrage',short:'Barrage',panel:BARRAGE_N+' heavy shells, '+BARRAGE_BOX+'\u00d7'+BARRAGE_BOX+' (needs vision)', vision:true, hint:'Click a target anywhere you have vision.'},
 {mode:'paradrop',icon:'\ud83e\ude82',name:'Paradrop',        short:'Paradrop',panel:PARA_N+' Paratroopers anywhere, even in fog',      vision:false, hint:'Click anywhere (even in fog) to drop your squad.'},
 {mode:'lift',    icon:LIFT_ICON,     name:'Rapid Redeploy',  short:'Redeploy',panel:'Airlift up to '+LIFT_MAX+' SELECTED infantry anywhere', vision:false, fac:'blue', hint:'Click anywhere (even in fog) to airlift the selected infantry.'},
 {mode:'supply',  icon:DROP_ICON,     name:'Supply Drop',     short:'Supply',  panel:'Two crates: '+DROP_P+' \u2b22 and '+DROP_E+' \u26a1, yours alone', vision:false, fac:'green', hint:'Click anywhere (even in fog) to drop the crates.'},
 {mode:'smokescr',icon:SCR_ICON,      name:'Smokescreen',     short:'Smoke',   panel:SMOKESCR_BOX+'\u00d7'+SMOKESCR_BOX+' cloud: \u2212'+Math.round(SMOKESCR_RED*100)+'% damage to your units AND structures, '+SMOKESCR_T+'s', vision:false, fac:'gray', hint:'Click anywhere (even in fog) to lay the screen.'}
];
function radioAbility(m){return RADIO_ABILITIES.find(a=>a.mode===m)||null;}
function radioNeedsVision(m){const a=radioAbility(m);return !!(a&&a.vision);}
/* the call-downs one army may actually arm. A row with no `fac` belongs to
   everybody; a row with one belongs to that army alone. */
function radioListFor(p){const f=p&&p.fac;return RADIO_ABILITIES.filter(a=>!a.fac||a.fac===f);}
function radioAllowed(p,m){return radioListFor(p).some(a=>a.mode===m);}
function radioAbilityList(){return RADIO_ABILITIES.map(a=>a.icon+' '+a.name).join(', ');}
function radioCDText(){return (RADIO_CD/60)+'-minute';}
function radioBarrage(u,cx,cy){
 const fx=Math.floor(cx)+.5, fy=Math.floor(cy)+.5, sh=[];
 for(let i=0;i<BARRAGE_N;i++){
  const ox=srand()*BARRAGE_BOX-BARRAGE_BOX/2, oy=srand()*BARRAGE_BOX-BARRAGE_BOX/2;
  const ang=srand()*6.28;
  sh.push({x:clamp(fx+ox,1,G.map.N-2),y:clamp(fy+oy,1,G.map.N-2),at:BARRAGE_FLY+i*BARRAGE_GAP,ang,done:false});
 }
 G.strikes.push({kind:'barrage',owner:u,cx:fx,cy:fy,sh,t:0});
 u.abilityCool=radioCD();sfxWhoosh(cx,cy);
 if(u.p.human)msg('Artillery barrage inbound \u2014 '+BARRAGE_N+' shells on target.');
}
// v30: magnify & napalm may target ANYWHERE the owning team currently has live
// vision (paradrop is unrestricted). Computed sim-side from allied unit/building
// sight radii so it stays deterministic under lockstep - the human's fog grid is
// client-local and never consulted by the sim.
function pVision(p,x,y){
 for(const q of G.players){
  if(!q.alive||!allied(q,p))continue;
  for(const u of q.units){if(u.garrisoned)continue;const vi=viOf(u);if((u.x-x)**2+(u.y-y)**2<=vi*vi)return true;}
  for(const b of q.blds){if(b.prog<1)continue;const vi=bviOf(b);if(!vi)continue; // v101: night halves structure vision here too
   const dx=Math.max(0,Math.abs(x-b.x)-b.sz*.5),dy=Math.max(0,Math.abs(y-b.y)-b.sz*.5);
   if(dx*dx+dy*dy<=vi*vi)return true;}
 }
 return false;
}
// NAPALM STRIKE (v30 buffed): incendiary bomblets rain onto a random ~70% subset
// of a NAPALM_BOX-square tile grid centred on the target; each cell erupts, scorches the
// ground and keeps BURNING for 3 seconds after the bomblet lands.
function radioNapalm(u,cx,cy){
 const cells=[];
 for(let gy=0;gy<NAPALM_BOX;gy++)for(let gx=0;gx<NAPALM_BOX;gx++)if(srand()<0.7)cells.push({x:Math.floor(cx)-NAPALM_BOX/2+gx+.5,y:Math.floor(cy)-NAPALM_BOX/2+gy+.5});
 // shuffle for a staggered drop order
 for(let i=cells.length-1;i>0;i--){const j=Math.floor(srand()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]];}
 G.strikes.push({kind:'napalm',owner:u,cells,i:0,t:0,every:0.045,burn:[]}); // v30: burn[] tracks lingering ground fire
 u.abilityCool=radioCD();sfxWhoosh(cx,cy);
}
// PARADROP (v30): a transport flies over and drops 5 PARATROOPERS at the chosen
// point — anywhere on the map, including unexplored fog. They scatter on landing.
function radioParadrop(u,x,y){
 const drops=[];
 for(let i=0;i<PARA_N;i++){const a=i*2.39996,r=.6+.5*Math.sqrt(i);drops.push({x:clamp(x+dcos(a)*r,2,G.map.N-3),y:clamp(y+dsin(a)*r,2,G.map.N-3),delay:i*0.18});}
 G.strikes.push({kind:'paradrop',owner:u,drops,t:0});
 u.abilityCool=radioCD();
 if(u.p.human)msg(`Paradrop inbound — ${PARA_N} Paratroopers deploying.`);
}
/* RAPID REDEPLOY (v85, Blue). The Paradrop's opposite: it creates nobody. It takes
   infantry this army ALREADY owns and moves them, which is why the command carries
   ids - "the selection" is a client-local idea and the sim can never be told to
   read it. execCmd filters the list before it arrives here, so by this point every
   id is a live, ungarrisoned infantryman of p's own.

   Off-map transit reuses u.garrisoned rather than adding a hashed flag of its own,
   and that is the whole reason this needs no new unit state: garrisoned already
   means "not on the field" at every door in the file - targeting skips them,
   splash skips them, the renderer skips them, applyDmg never reaches them. A man
   in the air is exactly that. He is in no building's garrison list, which is safe
   because nothing ever searches for a garrisoned unit's carrier; the strike that
   put him up there is the only thing that knows, and strikes are serialized, so a
   snapshot taken mid-flight lands him on schedule after a reload.
   They stay in G.sel on purpose, unlike a man boarding an APC: he is gone for as
   long as you leave him there, whereas this squad is back in LIFT_T seconds and
   losing the selection would cost the player the order they were about to give. */
function radioLift(u,x,y,ids){
 const drops=[];
 for(let i=0;i<ids.length;i++){
  const m=G.units.find(g=>g.id===ids[i]);if(!m)continue;
  const a=i*2.39996,r=.6+.5*Math.sqrt(i);
  m.garrisoned=true;m.state='idle';m.path=null;m.target=null;m.target2=null;m.node=null;m.oq=[];m.patrol=null;
  drops.push({id:m.id,x:clamp(x+dcos(a)*r,2,G.map.N-3),y:clamp(y+dsin(a)*r,2,G.map.N-3),delay:LIFT_T+i*0.06,done:false});
 }
 if(!drops.length)return false;
 G.strikes.push({kind:'lift',owner:u,drops,t:0});
 u.abilityCool=radioCD();sfxWhoosh(x,y);
 if(u.p.human)msg(`Rapid Redeploy — ${drops.length} infantry in the air.`);
 return true;
}
// put one airlifted man back on the ground where the paradrop would have put him
function landLifted(d){
 const u=G.units.find(g=>g.id===d.id);
 if(!u||u.hp<=0)return;            // shot down in transit is impossible, but a save edited between is not
 let lx=d.x,ly=d.y;
 if(!passableR(lx,ly,unitRad(u))){
  outer:for(let r=1;r<=4;r++)for(let oy=-r;oy<=r;oy++)for(let ox=-r;ox<=r;ox++){const nx=d.x+ox,ny=d.y+oy;if(passable(Math.floor(nx),Math.floor(ny))){lx=nx;ly=ny;break outer;}}
 }
 u.garrisoned=false;u.x=lx;u.y=ly;u.state='idle';u.anchor={x:lx,y:ly};u.dest=null;u.savedDest=null;u.stuck=0;u.lastProg={x:lx,y:ly};
 spawnSmoke(lx,ly,4);spawnShrapnel(lx,ly,'#d9cf8f',4,.6);
}
/* --- THE FIREBOMB HELI'S TWO FIRES (added at v87) ---
   Both are the napalm strike's own shape with different fields, which is the whole
   reason napalmBurn was generalised rather than copied: one sweep, one rate
   constant, one set of FX, and two weapons that differ only in what they say about
   duration and about whose men are standing in it.

   SCORCHED EARTH appends to a strike this helicopter already owns rather than
   pushing a new one per shot. A Firebomb reloads every 1.6s and its fire lasts
   SCORCH_T, so a per-shot strike would leave three live entries per helicopter and
   the sweep is O(strikes x entities); appending keeps it at one. Expired cells are
   spliced out in updateStrikes, so the entry is removed when its last tile goes
   out rather than on a schedule it would have to be told about.

   NAPALM BLAST is its own entry every time, because it is a one-shot on a clock
   and merging two of them would let the second use extend the first's fire. */
function scorchGround(u,x,y){
 let s=null;
 for(const q of G.strikes)if(q.kind==='fbomb'&&q.scorch&&q.owner===u){s=q;break}
 if(!s){s={kind:'fbomb',scorch:1,owner:u,pi:u.p.i,cells:[],i:0,t:0,every:0.045,burn:[],bdps:SCORCH_DPS,gnd:1};G.strikes.push(s)}
 s.burn.push({x,y,until:s.t+SCORCH_T});
 stampScorch(x,y,6);
}
/* The blast pattern is drawn from srand(), the seeded sim stream, exactly as the
   tower's napalm grid and the barrage's scatter are. Naming the host RNG here
   would trip the banned-token lint on its own prose, which is the v58 trap. */
function napalmBlast(u){
 const cells=[];
 for(let i=0;i<FB_N;i++){
  const a=srand()*6.28, r=Math.sqrt(srand())*FB_R; // sqrt keeps the scatter even across the disc rather than clustered at the hub
  cells.push({x:clamp(u.x+dcos(a)*r,1,G.map.N-2),y:clamp(u.y+dsin(a)*r,1,G.map.N-2)});
 }
 G.strikes.push({kind:'fbomb',owner:u,pi:u.p.i,cells,i:0,t:0,every:0.045,burn:[],bdps:GROUND_DPS,ff:1,gnd:1,dm:FB_DM,spl:FB_SPL,until:FB_BURN});
 u.abCool=(G&&G.test)?0:u.t.abCd;
 sfxWhoosh(u.x,u.y);
 if(u.p.human)msg(`Napalm Blast — ${FB_N} firebombs away. Get your own men clear.`);
 return true;
}
/* SUPPLY DROP (v86, Green). Two crates on canopies, one carrying plastic and one
   carrying electricity, and nothing else about it is a strike at all: the crates
   OUTLIVE the call-down. They sit on the ground with no expiry until one of the
   owning player's units walks over them, which is why they live in their own
   hashed and serialized list rather than inside the strike that dropped them - a
   strike is a timed effect and is spliced out when its schedule runs out, and a
   crate has no schedule.
   The strike carries pi rather than leaning on its owner, exactly as the smoke
   cloud does and for the same reason: the crates can land after the tower that
   called them is rubble, and loadState resolves a dead owner to null. */
/* --- PAINT, ADDED AT v88 ---
   The Choktaw's ability, and the only one in roadmap 2 that deals no damage at
   all: it makes everything ELSE hurt more. The box is anchored the way the
   barrage's is, on the floor of the clicked tile, so what the player saw under
   the reticle is what gets marked.
   Enemies only, and the test is `!allied` rather than "not mine" - a painted
   ally in a team game would be a gift to the other side.
   The mark is SET rather than accumulated: repainting a unit that is already lit
   restarts its ten seconds instead of stacking a second +25%, which is why two
   Choktaws over one box are worth exactly one and why Paint has no group button.
   Deterministic: a fixed walk of G.units, no RNG, no clock, every distance in
   tile space. */
function paintArea(u,cx,cy){
 const x0=Math.floor(cx),y0=Math.floor(cy),n=PAINT_BOX;
 let hit=0;
 for(const e of G.units){
  if(e.hp<=0||e.garrisoned||allied(e.p,u.p))continue;
  if(e.x<x0||e.x>=x0+n||e.y<y0||e.y>=y0+n)continue;
  e.paintT=PAINT_T;hit++;
 }
 u.abCool=(G&&G.test)?0:u.t.abCd;
 G.strikes.push({kind:'paint',pi:u.p.i,x:x0,y:y0,n,t:0}); // the marker box the renderer draws; it carries no rule of its own
 sfxWhoosh(cx,cy);
 if(u.p.human)msg(hit?`Target painted — ${hit} marked, +${Math.round(PAINT_DMG*100)}% damage for ${PAINT_T}s.`:'Nothing of theirs in the box.');
 return hit;
}
/* --- SMOKESCREEN, ADDED AT v88 ---
   Gray's call-down and the last of roadmap 2. It is a `fac` row on the shared
   RADIO_ABILITIES table refused at the execCmd door, which is the shape v85
   introduced, v86 followed and v87 moved the Napalm Strike INTO - not a second
   table, and never relying on the panel simply not offering it.
   Deliberately STRONGER than the Mortar's Smoke Rounds, and the gap is the point
   rather than an oversight: SMOKESCR_RED is 40% against SMOKE_RED's 20%, over a
   7-tile square against a 2-tile disc, for 10 seconds against 5, and it covers
   STRUCTURES where the mortar's cloud covers units alone. What it costs is a
   Radio Tower and the shared RADIO_CD; the mortar's costs one loaded tube.
   The record of that decision is in the v88 constants block.
   No vision requirement, on the Paradrop and Supply Drop's rule rather than the
   Barrage's: a screen is laid over your OWN men, and you can always see those. */
function radioSmokescreen(u,x,y){
 const fx=Math.floor(x)+.5,fy=Math.floor(y)+.5;
 G.strikes.push({kind:'smokescr',owner:u,pi:u.p.i,x:fx,y:fy,n:SMOKESCR_BOX,t:0});
 const h=SMOKESCR_BOX/2;
 for(let i=0;i<26;i++)spawnSmoke(fx+(Math.random()-.5)*SMOKESCR_BOX,fy+(Math.random()-.5)*SMOKESCR_BOX,3,{rise:3,grow:15,life:SMOKESCR_T*.5,r:9,col:'#d8d8d4'});
 u.abilityCool=radioCD();sfxWhoosh(x,y);
 if(u.p.human)msg(`Smokescreen laid — −${Math.round(SMOKESCR_RED*100)}% damage inside for ${SMOKESCR_T}s.`);
 return true;
}
function radioSupply(u,x,y){
 const drops=[
  {x:clamp(x-0.7,2,G.map.N-3),y:clamp(y,2,G.map.N-3),kind:'p',amt:DROP_P,delay:DROP_T,done:false},
  {x:clamp(x+0.7,2,G.map.N-3),y:clamp(y,2,G.map.N-3),kind:'e',amt:DROP_E,delay:DROP_T+0.12,done:false}
 ];
 G.strikes.push({kind:'supply',owner:u,pi:u.p.i,drops,t:0});
 u.abilityCool=radioCD();sfxWhoosh(x,y);
 if(u.p.human)msg(`Supply drop inbound — ${DROP_P} ⬢ and ${DROP_E} ⚡.`);
 return true;
}
// put one crate on the ground, on the same near-tile search the airlift and the paradrop use
function landCrate(pi,d){
 let lx=d.x,ly=d.y;
 if(!passable(Math.floor(lx),Math.floor(ly))){
  outer:for(let r=1;r<=4;r++)for(let oy=-r;oy<=r;oy++)for(let ox=-r;ox<=r;ox++){const nx=d.x+ox,ny=d.y+oy;if(passable(Math.floor(nx),Math.floor(ny))){lx=nx;ly=ny;break outer;}}
 }
 G.crates.push({x:lx,y:ly,pi,kind:d.kind,amt:d.amt});
 spawnDust(lx,ly,.8);spawnSmoke(lx,ly,3);
}
/* One sweep per tick over a list that is empty in almost every match. Deterministic
   by construction: the crates are walked newest-last and the owner's units in list
   order, so the FIRST man to be within CRATE_R collects it and every client agrees
   which. Only the owning player's units are even looked at, which is the owner's
   rule and also what keeps this cheap - no allied() call and no sweep of G.units. */
function updateCrates(){
 const cs=G.crates;if(!cs||!cs.length)return;
 for(let i=cs.length-1;i>=0;i--){
  const c=cs[i],p=G.players[c.pi];
  if(!p||!p.alive)continue; // an eliminated army's crates simply lie there; nobody else may have them
  let got=null;
  for(const u of p.units){if(u.hp<=0||u.garrisoned)continue;if((u.x-c.x)**2+(u.y-c.y)**2<=CRATE_R*CRATE_R){got=u;break}}
  if(!got)continue;
  cs.splice(i,1);
  if(c.kind==='e')p.res.e+=c.amt;else p.res.p+=c.amt;
  spawnShrapnel(c.x,c.y,'#6fbf4a',6,.9);spawnDust(c.x,c.y,.6);
  if(p===G.human){msg(`Supplies collected — +${c.amt} ${c.kind==='e'?'⚡':'⬢'}.`);updateTopbar();}
 }
}
// land one Paratrooper with a little dust puff
function dropTrooper(p,x,y){
 // find a passable landing tile near the requested point
 let lx=x,ly=y;
 if(!passableR(lx,ly,unitRad({t:U.para}))){
  outer:for(let r=1;r<=4;r++)for(let oy=-r;oy<=r;oy++)for(let ox=-r;ox<=r;ox++){const nx=x+ox,ny=y+oy;if(passable(Math.floor(nx),Math.floor(ny))){lx=nx;ly=ny;break outer;}}
 }
 const g=makeUnit('para',p,lx,ly);g.state='idle';g.anchor={x:lx,y:ly};
 spawnSmoke(lx,ly,4);spawnShrapnel(lx,ly,'#d9cf8f',4,.6);
 return g;
}
// v30: lingering napalm ground-burn - one damage sweep per frame across every
// still-burning cell (overlapping cells stack, so the heart of the field is
// lethal), plus light flame FX. Mirrors splash's defensive slice() since
// applyDmg can kill mid-iteration.
/* v87: THREE fields generalise this, and every default reproduces the v30 napalm
   exactly, so the tower's call-down is untouched.
     s.bdps  the burn rate, GROUND_DPS unless the caller says otherwise. It was a
             bare 4.3 here; naming it was forced by there now being two callers.
     s.ff    friendly fire. The Firebomb's Blast burns everyone and the tower's
             napalm burns the enemy, which is the difference between an area
             denial weapon you drop on your own line and one you call down on
             theirs. With ff set the allied test disappears entirely rather than
             being inverted - "indiscriminate" is the absence of a side, not the
             other side.
     s.gnd   this fire is ON THE GROUND and cannot reach an aircraft. Set only by
             the Firebomb's two strikes, and set at all because the aircraft that
             dropped the fire is hovering directly over it: without this an
             indiscriminate burn would set light to the helicopter that laid it.
             The tower's napalm is deliberately NOT given it - changing what the
             call-down does to a loitering aircraft is not this release's business.
   The one behaviour change to the existing path is the null guard on s.owner. A
   strike outlives the entity that fired it, and loadState resolves a dead owner to
   null, so a snapshot taken after the tower died and reloaded mid-burn used to
   throw inside update() and take the tick with it. */
function napalmBurn(s,dt){
 const cs=s.burn;if(!cs||!cs.length)return;
 const dm=(s.bdps!=null?s.bdps:GROUND_DPS)*dt;
 const ff=!!s.ff, gnd=!!s.gnd, own=s.owner;
 const skip=e=>ff?(gnd&&e.t&&e.t.fly):(!own||!own.p||allied(e.p,own.p));
 for(const e of G.units.slice()){
  if(e.garrisoned||e.hp<=0||skip(e))continue;
  for(const bc of cs){if(s.t>=bc.until)continue;if(dhyp(e.x-bc.x,e.y-bc.y)<1.2){applyDmg(e,dm,'fire',own,'f');if(e.hp<=0)break;}}
 }
 for(const b of G.blds.slice()){
  if(b.hp<=0||(ff?false:(!own||!own.p||allied(b.p,own.p))))continue;
  for(const bc of cs){if(s.t>=bc.until)continue;if(dhyp(b.x-bc.x,b.y-bc.y)<1.2+b.sz*.5){applyDmg(b,dm,'fire',own,'f');if(b.hp<=0)break;}}
 }
 for(const bc of cs)if(s.t<bc.until&&Math.random()<dt*.35)spawnFlame(bc.x,bc.y,bc.x+(Math.random()-.5),bc.y-(Math.random()*.8));
}
// advance all in-flight call-down strikes
function updateStrikes(dt){
 if(!G.strikes)return;
 for(let i=G.strikes.length-1;i>=0;i--){
  const s=G.strikes[i];s.t+=dt;
  if(s.kind==='napalm'){
   // drop the next bomblets on a cadence (v30: harder hit + heavier FX)
   while(s.i<s.cells.length && s.t>=s.i*s.every){
    const cell=s.cells[s.i++];splash(cell.x,cell.y,1.3,32,'fire',s.owner);
    spawnFlame(cell.x,cell.y,cell.x,cell.y-1);spawnFlame(cell.x,cell.y,cell.x+(Math.random()-.5),cell.y-.6);
    spawnSmoke(cell.x,cell.y,2);stampScorch(cell.x,cell.y,7);
    if(s.i%6===0)spawnExplosion(cell.x,cell.y,.8);
    if(s.i%10===0)shakeAt(cell.x,cell.y,2.5);
    if(s.burn)s.burn.push({x:cell.x,y:cell.y,until:s.t+NAPALM_T});
   }
   napalmBurn(s,dt); // v30: struck ground keeps burning for NAPALM_T per cell (v87: named, because the Firebomb burns for longer off the same machinery)
   if(s.i>=s.cells.length && s.t>s.cells.length*s.every+NAPALM_T+0.4)G.strikes.splice(i,1);
  } else if(s.kind==='barrage'){
   /* one shell per scheduled impact time. splash already paints an explosion, a
      scorch and a shake; the block below is the oversized dressing on top. */
   for(const q of s.sh){
    if(q.done||s.t<q.at)continue;
    q.done=true;
    splash(q.x,q.y,BARRAGE_R,BARRAGE_DMG,'ex',s.owner,'q');
    spawnExplosion(q.x,q.y,2.6);
    spawnSmoke(q.x,q.y,16,{rise:12,grow:10,life:3.4,r:7,col:'#3a3632'});
    spawnSmoke(q.x,q.y,8,{rise:5,grow:14,life:4.2,r:10,col:'#5a544c'});
    spawnShrapnel(q.x,q.y,'#8a8a8a',22,2.4);
    spawnDust(q.x,q.y,1.7);
    shakeAt(q.x,q.y,7);sfxBoom(q.x,q.y,'big');
   }
   if(s.sh.every(q=>q.done)&&s.t>s.sh[s.sh.length-1].at+0.8)G.strikes.splice(i,1);
  } else if(s.kind==='paradrop'){
   for(const d of s.drops){if(!d.done && s.t>=d.delay){d.done=true;dropTrooper(s.owner.p,d.x,d.y);}}
   if(s.drops.every(d=>d.done))G.strikes.splice(i,1);
  } else if(s.kind==='lift'){
   // v85: same schedule as the paradrop, but the men already exist - this puts them back
   for(const d of s.drops){if(!d.done && s.t>=d.delay){d.done=true;landLifted(d);}}
   if(s.drops.every(d=>d.done))G.strikes.splice(i,1);
  } else if(s.kind==='bailout'){
   // v100: the balloon's crew, on the paradrop's schedule and its canopy
   for(const d of s.drops){if(!d.done && s.t>=d.delay){d.done=true;landBailed(s.pi,d);}}
   if(s.drops.every(d=>d.done))G.strikes.splice(i,1);
  } else if(s.kind==='fbomb'){
   /* v87: the same cadence the tower's napalm drops on. A scorch entry carries no
      cells at all, so this loop does nothing for it and the burn list alone keeps
      the entry alive - which is what lets a helicopter append to it shot by shot. */
   while(s.i<s.cells.length && s.t>=s.i*s.every){
    const cell=s.cells[s.i++];
    if(s.owner&&s.owner.hp>0)splash(cell.x,cell.y,s.spl,s.dm,'fire',s.owner,'f');
    spawnFlame(cell.x,cell.y,cell.x,cell.y-1);spawnFlame(cell.x,cell.y,cell.x+(Math.random()-.5),cell.y-.6);
    spawnSmoke(cell.x,cell.y,2);stampScorch(cell.x,cell.y,7);
    if(s.i%3===0)spawnExplosion(cell.x,cell.y,.9);
    if(s.i===FB_N)shakeAt(cell.x,cell.y,3);
    s.burn.push({x:cell.x,y:cell.y,until:s.t+s.until});
   }
   napalmBurn(s,dt);
   // burnt-out tiles leave the list, so the entry dies with its last fire rather
   // than on a schedule, and an appended scorch cell extends it by itself
   for(let j=s.burn.length-1;j>=0;j--)if(s.t>=s.burn[j].until)s.burn.splice(j,1);
   if(s.i>=s.cells.length&&!s.burn.length)G.strikes.splice(i,1);
  } else if(s.kind==='supply'){
   // v86: the strike's whole job is the fall. What it leaves behind is a crate in
   // G.crates, which has no clock at all and is not this list's business afterwards
   for(const d of s.drops){if(!d.done && s.t>=d.delay){d.done=true;landCrate(s.pi,d);}}
   if(s.drops.every(d=>d.done))G.strikes.splice(i,1);
  } else if(s.kind==='smokescr'){
   /* pure duration, exactly like the mortar's cloud above it - applyDmg reads the
      square while the entry is in the list and it leaves when SMOKESCR_T is up.
      Math.random for the drifting puffs, never srand: this runs inside the
      simulation and one seeded offset here would move the shared stream. */
   if(s.t>=SMOKESCR_T)G.strikes.splice(i,1);
   else if(Math.random()<dt*5)spawnSmoke(s.x+(Math.random()-.5)*s.n,s.y+(Math.random()-.5)*s.n,3,{rise:2,grow:12,life:2.6,r:8,col:'#cfcfca'});
  } else if(s.kind==='paint'){
   /* pure duration, like the mortar's cloud: the RULE lives on each marked unit's
      own paintT, and this entry exists only so the box stays drawn for as long as
      the mark lasts. It carries no damage and nothing reads it but the renderer. */
   if(s.t>=PAINT_T)G.strikes.splice(i,1);
  } else if(s.kind==='smoke'){
   /* v79: the cloud is pure duration - applyDmg reads its position while it is
      in the list and it leaves when SMOKE_T is up. The drifting puff on top of
      it is particles, spawned once at impact and not tracked here. */
   if(s.t>=SMOKE_T)G.strikes.splice(i,1);
   else if(Math.random()<dt*1.6)spawnSmoke(s.x+(Math.random()-.5)*SMOKE_R,s.y+(Math.random()-.5)*SMOKE_R,4,{rise:2,grow:9,life:2.2,r:6,col:'#cfcfca'});
  }
 }
}
/* --- FULL THROTTLE: the crush ---
   Added at v80. Enemy infantry and enemy barricades under the hull die outright. Instant
   kill by decision, so it goes through kill() rather than applyDmg: an
   unsurvivable amount routed through applyDmg would still be scaled by the
   difficulty knob, the APC shield and any smoke over the target, and "instant"
   that three multipliers can argue with is not instant. kill() awards the
   crushing Bull the kill and (for infantry, never barricades) the veterancy.
   GARRISONED INFANTRY ARE EXEMPT: a man inside a bunker or an APC is not on
   the ground to be driven over, and his x/y are only synced to his carrier.
   Deterministic: fixed scan order over the live arrays, no RNG, no clock, and
   every distance through dhyp. Both loops iterate a slice() because kill()
   splices the arrays they walk. */
function crush80(u){
 for(const e of G.units.slice()){
  if(e===u||e.hp<=0||e.garrisoned||e.t.fly)continue;
  if(allied(e.p,u.p)||armorOf(e)!=='inf')continue;
  if(dhyp(e.x-u.x,e.y-u.y)>=THROTTLE_R)continue;
  e.hp=0;e.lastHit='ex';kill(e,u);
 }
 for(const b of G.blds.slice()){
  if(b.hp<=0||!b.t.barr||allied(b.p,u.p))continue;
  if(dhyp(b.x-u.x,b.y-u.y)>=THROTTLE_R+.5)continue;
  b.hp=0;b.lastHit='ex';kill(b,u);
 }
}
function moveAlong(u,dt){
 if(!u.path||u.wp>=u.path.length)return true;
 const w=u.path[u.wp];
 const dx=w.x-u.x,dy=w.y-u.y,d=dhyp(dx,dy);
 let sp=spOf(u)*(u.flag?.85:1)*terrainSpeed(u);
 const arr=u.t.fly?.18:.28; // arrive radius (bigger for ground so corners don't trap)
 if(d<arr){u.wp++;return u.wp>=u.path.length}
 u.face=datan2(dy,dx);
 const ux=dx/d,uy=dy/d,step=sp*dt;
 if(u.t.fly){u.x+=ux*step;u.y+=uy*step;return false}
 const r=unitRad(u);
 /* v68: depenetrate FIRST. Everything below tests candidate positions with
    passableR, and if the position we are standing on already fails that test then
    every candidate fails too and the unit is frozen. Sits ahead of the whole stepper
    on purpose. Comment on its own line - a trailing // eats the tail here. */
 if(!passableR(u.x,u.y,r)&&unstick(u,r,step))return false;
 let nx=u.x+ux*step,ny=u.y+uy*step;
 if(passableR(nx,ny,r)){u.x=nx;u.y=ny}
 else {
  // wall slide: try moving along just X, then just Y, so we hug edges instead of clipping
  if(passableR(u.x+ux*step,u.y,r)){u.x+=ux*step}
  else if(passableR(u.x,u.y+uy*step,r)){u.y+=uy*step}
  else {
   // fully blocked — nudge perpendicular to try to round the corner
   const pxX=-uy,pxY=ux;
   if(passableR(u.x+pxX*step,u.y+pxY*step,r)){u.x+=pxX*step;u.y+=pxY*step}
   else if(passableR(u.x-pxX*step,u.y-pxY*step,r)){u.x-=pxX*step;u.y-=pxY*step}
   else u.stuck+=dt;
  }
 }
 if(G.tick%10===u.id%10){
  const moved=dhyp(u.x-u.lastProg.x,u.y-u.lastProg.y);
  if(moved<.15&&u.path)u.stuck+=.34;else{u.stuck=Math.max(0,u.stuck-.2);u.wedge=0;}
  u.lastProg={x:u.x,y:u.y};
  if(u.stuck>.7&&u.dest){
   u.wedge=(u.wedge||0)+1;
   // if repeated repaths haven't freed us, we're truly wedged (e.g. shoved between a
   // sofa and a spill) — hop to the nearest tile we actually fit in, then repath.
   // v68: threshold 4 -> 3. At 4 this branch fired ZERO times across 8 measured
   // matches (wedge peaked at 3 and the decay in the else arm above reset it), so
   // the recovery the v30 comment describes was dead code in practice.
   // v68: and it reuses nearestFit rather than carrying its own ring scan.
   if(u.wedge>=3){
    const rw=unitRad(u),f=nearestFit(u.x,u.y,rw,PF_UNSTICK_R);
    if(f){u.x=f.x;u.y=f.y;}
    u.wedge=0;
   }
   u.path=findPath(u.x,u.y,u.dest.x,u.dest.y,u.key==='truck',unitRad(u));u.wp=0;u.stuck=0;
  }
 }
 return false;
}
function medicHold(u){
 // v42: keep a medic truck lumped with its escort during a group move. Stateless per
 // tick: reads only hashed unit positions/states, adds no serialized field. Combat
 // escorts = friendly units with a weapon (t.dm). Leash 8 tiles, pace gap 3.5 tiles.
 const L2=64, PACE2=12.25; let near=null, nd=1e9, firing=false;
 for(const c of G.units){
  if(c===u||c.garrisoned||c.hp<=0||!c.t.dm||!allied(c.p,u.p))continue;
  const d2=(c.x-u.x)**2+(c.y-u.y)**2; if(d2>L2)continue;
  if(c.state==='attack'&&c.target)firing=true;
  if(d2<nd){nd=d2;near=c;}
 }
 if(!near)return false;          // no escort nearby: move normally (catch up / solo)
 if(firing)return true;          // escort stopped to fire: stop with them
 if(nd>PACE2&&u.dest){           // nearest escort has fallen behind
  const md=dhyp(u.x-u.dest.x,u.y-u.dest.y), ed=dhyp(near.x-u.dest.x,near.y-u.dest.y);
  if(md+0.4<ed)return true;      // medic is ahead toward the goal: wait for the pack
 }
 return false;
}
/* ---- MEDIC STATION KEEPING ----
   medicAim is pure: it reads hashed unit state, allocates one result object and
   mutates nothing. Ownership of an escort is a nearest-medic partition with ties
   going to the lower id - that alone spreads several trucks across a big pack -
   and the separation nudge is applied only by the higher-id medic of a pair, so
   two of them can never push each other around a loop. A medic that owns nobody
   heads for the worst-covered escort in range, which is what fills the thin side
   of a formation. settle=true widens the scan to idle escorts for the one-hop
   re-park at the end of a move; in transit only units under the same order (or in
   a fight right here) count, so driving past an idle garrison cannot pull a medic
   off its route. */
function medicAim(u,settle){
 const leash=settle?MEDIC_SETTLE_R:MEDIC_LEASH, L2=leash*leash, M2=(MEDIC_LEASH*2)*(MEDIC_LEASH*2);
 const esc=[],meds=[];
 for(const c of G.units){
  if(c.hp<=0||c.garrisoned||!allied(c.p,u.p))continue;
  if(c.t.heal){if(c===u||(c.x-u.x)**2+(c.y-u.y)**2<=M2)meds.push(c);continue}
  if(!c.t.dm)continue;                                    // dump trucks are not an escort
  if((c.x-u.x)**2+(c.y-u.y)**2>L2)continue;
  if(!settle&&c.state!=='attack'&&
     !((c.state==='move'||c.state==='amove')&&c.dest&&u.dest&&dhyp(c.dest.x-u.dest.x,c.dest.y-u.dest.y)<=MEDIC_GROUP_R))continue;
  esc.push(c);
 }
 if(!esc.length)return null;
 const mine=[];
 let sx=0,sy=0,n=0,firing=false,worst=null,wd=-1;
 for(const e of esc){
  if(e.state==='attack'&&e.target)firing=true;            // v42 semantics: any company in a firefight holds the truck
  let own=null,od=1e9;
  for(const m of meds){const d2=(e.x-m.x)**2+(e.y-m.y)**2;if(d2<od||(d2===od&&own&&m.id<own.id)){od=d2;own=m}}
  if(od>wd||(od===wd&&worst&&e.id<worst.id)){wd=od;worst=e}
  if(own!==u)continue;
  mine.push(e);sx+=e.x;sy+=e.y;n++;
 }
 let ax,ay;
 if(n){ax=sx/n;ay=sy/n}
 else {                                                   // everyone is another truck's (two medics stacked, say):
  let tx=0,ty=0;for(const e of esc){tx+=e.x;ty+=e.y}       // aim at the whole company and let the nudge below
  ax=tx/esc.length;ay=ty/esc.length;mine.push(worst);      // slide us off the other truck. Chasing the worst-covered
 }                                                        // straggler instead used to walk medics off the map.
 for(const m of meds){                                    // spread: only the higher id gives ground
  if(m===u||m.id>=u.id)continue;
  const dx=ax-m.x,dy=ay-m.y,d=dhyp(dx,dy);
  if(d>=MEDIC_SEP)continue;
  if(d<1e-4){ax+=MEDIC_SEP*MEDIC_SEP_K;continue}          // exactly stacked: break the tie along +x
  const k=(MEDIC_SEP-d)*MEDIC_SEP_K;ax+=dx/d*k;ay+=dy/d*k;
 }
 ax=clamp(ax,1,G.map.N-2);ay=clamp(ay,1,G.map.N-2);
 let out=0;for(const e of mine)if(dhyp(e.x-u.x,e.y-u.y)>MEDIC_COVER)out++;
 return {x:ax,y:ay,n:n,out:out,firing:firing};
}
// one direct step toward the aim point, wall-sliding the same way moveAlong does.
// Returns false when every slide is blocked, so the caller can fall back to real
// pathing instead of grinding a medic into a sofa.
function medicStep(u,dx,dy,d,dt){
 // a medic is exactly as fast as a grunt (both sp 2.3), so with no allowance a truck
 // that starts three tiles adrift can never close the gap on a marching squad. The
 // boost applies only while it is genuinely off station and never to ordered travel.
 const sp=spOf(u)*(u.flag?.85:1)*terrainSpeed(u)*(d>MEDIC_COVER?MEDIC_CATCHUP:1);
 const step=Math.min(d,sp*dt),r=unitRad(u);
 const ux=dx/d,uy=dy/d;
 if(passableR(u.x+ux*step,u.y+uy*step,r)){u.x+=ux*step;u.y+=uy*step;u.face=datan2(dy,dx);return true}
 if(passableR(u.x+ux*step,u.y,r)){u.x+=ux*step;u.face=datan2(0,ux);return true}
 if(passableR(u.x,u.y+uy*step,r)){u.y+=uy*step;u.face=datan2(uy,0);return true}
 return false;
}
// Steering by hand leaves u.path frozen where it was, and a frozen path points at
// wherever the pack used to be: the moment tracking stops the truck would drive
// back to it. Refresh it on a cadence keyed to tick+id (never the wall clock).
function medicRepath(u,to){
 if(!to||G.tick%MEDIC_REPATH!==u.id%MEDIC_REPATH)return;
 const p=findPath(u.x,u.y,to.x,to.y,false,unitRad(u));
 if(p&&p.length){u.path=p;u.wp=0;u.stuck=0}
}
// medicHold only sees company inside the 8-tile leash, so a squad that strings out
// on bad ground used to be abandoned: the truck would arrive alone. If anybody sent
// on the same order is still behind us within MEDIC_WAIT_R, sit and wait instead.
function medicWaitsFor(u){
 if(!u.dest)return false;
 const R2=MEDIC_WAIT_R*MEDIC_WAIT_R;let near=null,nd=1e9;
 for(const c of G.units){
  if(c===u||c.hp<=0||c.garrisoned||!c.t.dm||!allied(c.p,u.p))continue;
  if(c.state!=='attack'&&!((c.state==='move'||c.state==='amove')&&c.dest&&dhyp(c.dest.x-u.dest.x,c.dest.y-u.dest.y)<=MEDIC_GROUP_R))continue;
  const d2=(c.x-u.x)**2+(c.y-u.y)**2;if(d2>R2||d2>=nd)continue;nd=d2;near=c;
 }
 if(!near)return false;
 return dhyp(u.x-u.dest.x,u.y-u.dest.y)+0.4<dhyp(near.x-u.dest.x,near.y-u.dest.y);
}
/* v44.1: an order issued to a medic ON ITS OWN is a direct instruction and has to be
   obeyed - station keeping must not hold it for a firefight it was never sent to. An
   order issued to a medic ALONGSIDE armed units is the case station keeping exists
   for. execCmd is the only place that knows which of the two just happened, so it
   stamps the truck here. Movement-only, exactly like parked/stuck/wedge: serialized,
   never hashed, never written onto a non-medic. Undefined means escorted, so old
   saves, AI orders and patrol legs keep the v44 behaviour. */
function medicOrderTag(list){
 let esc=false;for(const u of list)if(u.t.dm&&!u.garrisoned){esc=true;break}
 for(const u of list)if(u.t.heal)u.mesc=esc?1:0;
}
// does the truck hold its move state because the squad it came with is still going?
function medicStays(u){return u.mesc!==0&&!!medicAim(u,false)}
// move/amove hook. true = this tick's movement is handled, skip moveAlong.
// A direct step is only taken on a clear line: steering blind into scenery would
// slide a truck along a wall forever and, worse, starve moveAlong of the ticks its
// wedge recovery needs. Anything else is walked properly, on a repath cadence.
function medicTrack(u,dt){
 if(u.mesc===0)return false;                              // v44.1: sent on its own - obey the order, full stop
 const a=medicAim(u,false);
 if(a&&a.out>0){                                          // somebody it owns is outside the aura: close on them
  const dx=a.x-u.x,dy=a.y-u.y,d=dhyp(dx,dy);
  if(d>MEDIC_BAND){
   if(d<=MEDIC_STEER_MAX&&losClear(u,a)&&medicStep(u,dx,dy,d,dt)){medicRepath(u,u.dest);return true}
   medicRepath(u,a);                                      // aim is around a corner: walk there properly
   return false;                                          // moveAlong takes it from here, wedge recovery and all
  }
 }
 if(a&&a.firing)return true;                              // the pack stopped to shoot: never roll on past it
 if(medicWaitsFor(u))return true;                         // squad strung out behind: wait, do not arrive alone
 return a?medicHold(u):false;                              // company and covered: pace them the v42 way.
 // With no company under this order we do NOT consult medicHold: its leash counts
 // any armed friendly, so driving past an idle garrison used to pin the truck.
}
// arrival: park on the cluster rather than on the formation slot. At most one hop
// per arrival and only while somebody is still uncovered, so it always terminates.
function medicSettle(u){
 if(u.mesc===0)return false;                              // v44.1: an unescorted order parks where it says
 const a=medicAim(u,true);
 if(!a||a.out<=0)return false;
 const d=dhyp(a.x-u.x,a.y-u.y);
 if(d<=MEDIC_SETTLE_BAND||d>MEDIC_SETTLE_R)return false;
 const p=findPath(u.x,u.y,a.x,a.y,false,unitRad(u));
 if(!p||!p.length)return false;
 u.path=p;u.wp=0;u.dest={x:a.x,y:a.y};u.stuck=0;
 return true;
}
/* v82 AIR ASSAULT. A passenger's whole update is skipped by the garrison
   return below, which is the ONE door that stops him shooting - the eleven
   garrison guards the roadmap warned about are every one of them candidate- or
   defender-side and not one of them blocks him from firing. So this is his
   whole update, driven by his CARRIER rather than by the top-level loop.
   Shaped like u.hold: acquire inside min(sight,reach), fire what is in reach,
   drop what leaves it, never path and never move. He keeps his own clocks
   because fireAt and the concealment test both read them.
   Note he is NOT invulnerable while he does it, and that needed no edit:
   orderAttack, the retaliation block and the call-for-help sweep all take the
   attacker by reference and none of the three tests whether he is aboard, so
   the man he shoots and that man's neighbours answer him already. */
function fireOut82(u,dt){
 if(u.cool>0)u.cool-=dt;
 if(u.shotT!=null&&u.shotT<999)u.shotT+=dt;
 if(u.calmT<999)u.calmT+=dt;
 if(!u.t.dm||u.hp<=0)return;
 const r=Math.min(viOf(u),rgOf(u));
 let tgt=u.target;
 if(!tgt||tgt.hp<=0||!mainOk(u,tgt)||dhyp(tgt.x-u.x,tgt.y-u.y)>r){
  tgt=null;u.target=null;
  if(G.tick%10===u.id%10){tgt=nearestEnemy(u,r);u.target=tgt;}
 }
 if(!tgt||tgt.hp<=0)return;
 const d=dhyp(tgt.x-u.x,tgt.y-u.y)-(tgt.kind==='bld'?tgt.sz*.45:0);
 if(d<=rgOf(u,tgt)&&d>=(u.t.mrg||0)){ // v88: the FIRING test knows its target, so a spotted one is 2 tiles further away
  u.tface=datan2(tgt.y-u.y,tgt.x-u.x);u.face=u.tface;
  if(u.cool<=0)fireAt(u,tgt);
 }
}
/* --- THE OBSERVATION BALLOON COMES DOWN, ADDED AT v86 ---
   Two ways down, and the difference between them is the whole of the Bail ability:
   run the gas out and the crew is lost with the aircraft, press the button and
   four men are standing where it was. It does NOT auto-bail on the fuel clock, by
   owner decision - a balloon left up is a balloon spent.
   The kill goes through kill() with a NULL attacker rather than through applyDmg,
   for two reasons: applyDmg would run the shot through targetDmgMul, and the
   balloon rule there answers zero for every class but 'a', so a crash would deal
   no damage to the thing crashing; and nobody should score the kill, earn
   veterancy off it or have the retaliation sweep sent at them for it. */
/* v100: THE CREW COMES DOWN ON CANOPIES. The men used to appear on the ground on
   the tick Bail was pressed, which read as four soldiers teleporting out of an
   exploding balloon. They now ride the same strike-and-delay machinery the
   Paradrop and the Rapid Redeploy use, and the SAME canopy routine draws them -
   which is the owner's brief: a bail-out should read as a paradrop.
   bailSpot is the old bailMan's placement half, split out so the landing tile is
   computed at LAUNCH and carried on the drop, exactly as radioParadrop and
   radioLift precompute theirs. It consumes no RNG - the scatter is the same
   deterministic sunflower arithmetic those two use - so nothing about the seeded
   stream moves whether or not anybody bails. */
function bailSpot(k,x,y,i){
 const a=i*2.39996,r=.6+.5*Math.sqrt(i);
 let lx=clamp(x+dcos(a)*r,2,G.map.N-3),ly=clamp(y+dsin(a)*r,2,G.map.N-3);
 if(!passableR(lx,ly,unitRad({t:U[k]}))){
  outer:for(let rr=1;rr<=4;rr++)for(let oy=-rr;oy<=rr;oy++)for(let ox=-rr;ox<=rr;ox++){const nx=lx+ox,ny=ly+oy;if(passable(Math.floor(nx),Math.floor(ny))){lx=nx;ly=ny;break outer;}}
 }
 return {x:lx,y:ly};
}
function bailMan(k,p,lx,ly){
 const g=makeUnit(k,p,lx,ly);g.state='idle';g.anchor={x:lx,y:ly};
 spawnSmoke(lx,ly,3);spawnShrapnel(lx,ly,'#d9cf8f',3,.5);
 return g;
}
// put one bailed crewman on the ground when his canopy reaches it
function landBailed(pi,d){
 const p=G.players[pi];
 if(!p||!p.alive)return;   // the army died while its crew was in the air
 bailMan(d.k,p,d.x,d.y);
}
function balloonDown(u,bail){
 const x=u.x,y=u.y,p=u.p,men=[];
 /* the crew's landing tiles are chosen BEFORE the balloon dies, so a Bail into a
    tight pocket still measures the ground under the aircraft rather than the
    ground under whatever moves into the gap while they fall. The supply cap is
    deliberately not consulted: these four were paid for when the balloon was,
    exactly as a Paratrooper is fielded past the cap by the call-down that
    brought him.
    v100: the men are no longer created here - the strike creates each one as his
    canopy touches down. A snapshot taken mid-fall carries the strike, so they
    land on schedule after a reload, which is the same guarantee the Rapid
    Redeploy's men in the air already had. */
 if(bail){
  const drops=BAIL_CREW.map((k,i)=>{const sp=bailSpot(k,x,y,i);return{k,x:sp.x,y:sp.y,delay:BAIL_FALL_T+i*0.1,done:false}});
  G.strikes.push({kind:'bailout',pi:p.i,drops,t:0});
 }
 u.hp=0;kill(u,null);
 spawnExplosion(x,y,1.5);
 spawnSmoke(x,y,12,{rise:10,grow:9,life:2.8,r:6,col:'#4a4640'});
 spawnShrapnel(x,y,'#d9cf8f',10,1.4);
 shakeAt(x,y,3);sfxBoom(x,y,'med');
 return men;
}
function updateUnit(u,dt){
 if(u.garrisoned)return;
 const sx82=u.x,sy82=u.y; // v82: where he started this update, for the Evasive flag written at the foot
 if(u.cool>0)u.cool-=dt;
 if(u.flash>0)u.flash-=dt;
 u.rot+=dt*22;
 const t=u.t;

 // ---- v30 APC: occupants ride along (kept position-synced for save/hash sanity) ----
 if(t.cap&&u.garrison&&u.garrison.length){
  const ao82=!!(t.assault&&u.aslt);
  for(const v of u.garrison){v.x=u.x;v.y=u.y;v.fo=ao82;if(ao82)fireOut82(v,dt);}
 }
 // ---- MEDIC TRUCK: passive area heal ----
 // Heals all friendly units and buildings within MEDIC_HEAL_RADIUS tiles at
 // MEDIC_HEAL_RATE HP/sec (capped at max HP). Targets it tops up are tagged with
 // healedAt so the renderer can draw a soft glow on them this frame.
 if(t.heal){
  const R=t.healR||MEDIC_HEAL_RADIUS, R2=(R+0.5)*(R+0.5), amt=MEDIC_HEAL_RATE*dt;
  for(const v of G.units){ // v29: allied units heal too
   if(v===u||!allied(v.p,u.p)||v.hp>=v.mhp||v.hp<=0||v.garrisoned)continue;
   if((v.x-u.x)**2+(v.y-u.y)**2<=R2){v.hp=Math.min(v.mhp,v.hp+amt);v.healedAt=G.tick;}
  }
  for(const b of G.blds){ // v29: allied structures heal too
   if(!allied(b.p,u.p)||b.hp>=b.mhp||b.hp<=0)continue;
   // measure to the building footprint edge so big bases still heal at the radius
   const dx=Math.max(0,Math.abs(u.x-b.x)-b.sz*0.5), dy=Math.max(0,Math.abs(u.y-b.y)-b.sz*0.5);
   if(dx*dx+dy*dy<=R2){b.hp=Math.min(b.mhp,b.hp+amt);b.healedAt=G.tick;}
  }
 }
 /* --- v79: seconds since this unit was last hit ---
    Reset to 0 by applyDmg. Clamped at 999 rather than left to grow, because a
    long match would otherwise walk it into the float range where +dt stops
    changing the value, and a hashed field that silently stops advancing is a
    lockstep divergence waiting to happen. Nothing reads a value that large:
    the two windows are SARGE_CALM and HURT_WINDOW. */
 if(u.calmT<999)u.calmT+=dt;
 if(u.shotT!=null&&u.shotT<999)u.shotT+=dt; // v81: seconds since he last fired, read by the concealment test
 if(u.abCool>0)u.abCool-=dt; // v87: the unit ability clock, ticked here for the same reason updateBld ticks b.abilityCool for EVERY building - a timer parked inside a branch never runs out
 if(u.paintT>0)u.paintT-=dt; // v88: and the mark, ticked for every unit for that same reason - it is written onto the VICTIM, who has no ability of his own to run it down
 /* --- v86 THE BALLOON'S GAS ---
    Counted DOWN in seconds on the unit, so the remaining life reads straight off
    u.fuel with no need to know what tick it launched on, and a snapshot restores
    a balloon with exactly the time it had left. There is no repair, no refuel and
    no way to stop it: the clock is what a unit with no unit limit and almost no
    counter is balanced against. */
 if(t.balloon){
  if(u.fuel==null)u.fuel=BALLOON_FUEL; // a pre-v86 save has none, and neither does a hand-built fixture
  u.fuel-=dt;
  if(u.fuel<=0){balloonDown(u,false);return;}
 }
 /* v81: a BOT's Called Shot, decided here rather than in aiTick for the reason
    the v80 valve was moved - aiTick runs once every 18 ticks and a target turns
    over faster than that, so a rule on that cadence reads a target the bot has
    already dropped. Derived fresh from what he is actually pointed at, so it
    needs no memory and nothing to expire: a man means restrict and hit harder,
    anything else (including nothing) means free fire. There is no cost to weigh
    up - his rifle scores 0.35 and 0.25 against medium and heavy armour, so a
    target Called Shot forbids is one he should not have been shooting. */
 if(u.t.cshot&&u.p.ai&&!u.garrisoned)u.cs=!!(u.target&&u.target.hp>0&&u.target.kind==='unit'&&armorOf(u.target)==='inf');
 /* --- v79 COMBAT VETERAN ---
    Sarge alone carries t.regen. Deliberately below MEDIC_HEAL_RATE so a Medic
    is still worth bringing; this is between-fight sustain for a unit that is
    capped at one and takes 16 build-seconds to replace. */
 if(t.regen&&u.hp>0&&u.hp<u.mhp&&u.calmT>=SARGE_CALM)u.hp=Math.min(u.mhp,u.hp+SARGE_REGEN*dt);
 // --- v79 SMOKE ROUNDS: support fire, in every state, like the secondary below ---
 if(u.smoke)updateSmoke(u,dt);
 // ---- v51 SECONDARY WEAPON: runs in EVERY state, so the Bull torches infantry
 // while its cannon keeps engaging whatever the main targeting picked. ----
 if(t.sec&&!u.thr)updateSec(u,dt);  // v80: Full Throttle holds the hull flamer as well as the cannon
 // ---- ENTRENCHED MACHINE GUNNER ----
 // stationary: holds position and only acquires/fires on targets inside its 100° cone.
 if(u.entrenched){
  if(u.cool<=0||!u.target||u.target.hp<=0||!inCone(u,u.target.x,u.target.y)){
   if(G.tick%4===u.id%4)u.target=nearestEnemyCone(u,viOf(u));
  }
  const tgt=u.target;
  if(tgt&&tgt.hp>0){
   const d=dhyp(tgt.x-u.x,tgt.y-u.y)-(tgt.kind==='bld'?tgt.sz*.45:0);
   if(d<=rgOf(u)&&inCone(u,tgt.x,tgt.y)){u.tface=datan2(tgt.y-u.y,tgt.x-u.x);if(u.cool<=0)fireAt(u,tgt);}
  }
  // face stays locked toward the cone centre when not actively firing
  if(!u.target)u.face=u.coneDir;
  return;
 }
 /* --- v80 FULL THROTTLE ---
    Holding fire is done by DROPPING the target rather than by gating fireAt:
    a Bull that kept its target and merely declined to shoot would stand in
    range doing nothing, because the attack state pins u.path the moment it is
    inside rgOf. Dropped here, the attack arm falls through to its own
    no-target branch and the Bull resumes its march. The acquisition gates
    below stop it picking a new one up. */
 if(u.thr){u.target=null;u.target2=null;crush80(u);}
 /* --- SPRINT: the same trick, one level out (added at v85) ---
    Dropping the target rather than gating fireAt, for the reason written above the
    Bull: a man who keeps a target and merely declines to shoot stands in range
    doing nothing, because the attack state pins his path the moment he is inside
    rgOf. The difference from Full Throttle is WHOSE flag is being read - a man
    under a Sprint carries none of his own, so this asks the radius, and it costs
    the sprinting Runner his own rifle too because he is inside his own whistle. */
 const spr85=!!(t.dm&&sprintOn(u));   // asked ONCE per tick: the two acquisition gates below read this, not the radius again
 if(spr85){u.target=null;u.target2=null;}
 /* --- v80: the bot's pressure-valve coin flip, rolled at the moment the
    engagement starts. Owner's rule: a CPU flamethrower opens the valve on a
    flat VALVE_AI_INF_P chance whenever it engages infantry, whether or not
    that helps it. Rolled ONCE per target - u.vrt remembers which man the flip
    was made against - so the valve holds its state for the length of an
    engagement instead of strobing, and a new target is a new flip. srand() is
    the shared seeded RNG, so every client draws the same coin in lockstep.
    Sits in the sim rather than in aiTick because aiTick's 18-tick cadence is
    slower than a flamer's engagements and was silently skipping most of them. */
 if(u.p.ai&&u.t.valve&&!u.garrisoned&&u.hp>0){
  const vt80=u.target;
  if(vt80&&vt80.hp>0&&vt80.kind==='unit'&&armorOf(vt80)==='inf'&&u.vrt!==vt80.id){
   u.vrt=vt80.id;u.valve=srand()<VALVE_AI_INF_P;
  }
 }
 if(u.flag&&u.p.ai&&u.state!=='move'){const f=G.flags.find(f=>f.owner===u.p);if(f)orderMove(u,f.hx,f.hy,false)}
 switch(u.state){
  case 'idle':{
   // v29: hold-position pins the unit; otherwise patrol legs and queued orders run first
   if(!u.hold){
    if(u.patrol){patrolNext(u);break}
    if(u.oq&&u.oq.length){popOrder(u);break}
   }
   // v22.1: an idle dump truck always goes back to mining: resume its node if it
   // still has one, otherwise pick a fresh node. A human "move to" parks it (u.parked).
   if(t.a==='truck'&&!t.heal&&!u.parked&&!u.hold&&G.tick%10===u.id%10){
    if(u.node&&u.node.amt>0){u.state='togo';truckToNode(u,u.node);break}
    const n=findNode(u);if(n){orderHarvest(u,n);break}
   }
   if(t.dm&&!u.smoke&&!u.thr&&!u.flat&&!spr85&&G.tick%10===u.id%10){const e=nearestEnemy(u,u.hold?Math.min(viOf(u),rgOf(u)):viOf(u));if(e){u.target=e;u.state='attack';u.anchor={x:u.x,y:u.y}}} // v29: held units only sight what they can shoot. v79: a smoking mortar acquires no enemies at all. v85: nor does anyone inside a Sprint
   break}
  case 'move':{
   if(t.heal&&medicTrack(u,dt))break; // v44: medics keep station on the group they move with
   if(moveAlong(u,dt)){
    if(t.heal&&medicSettle(u))break;      // v44: park on the cluster, not on the formation slot
    if(t.heal&&medicStays(u))break;       // v44: squad still marching - hold the move state and keep tracking
    u.state='idle';u.anchor={x:u.x,y:u.y}
   }
   break}
  case 'amove':{
   if(t.dm&&!u.smoke&&!u.thr&&!u.flat&&!spr85&&G.tick%6===u.id%6){const e=nearestEnemy(u,viOf(u));if(e){u.savedDest=u.dest;u.target=e;u.state='attack';break}}
   if(t.heal&&medicTrack(u,dt))break; // v44: medics keep station (no t.dm, so the sight branch above never fires)
   if(moveAlong(u,dt)){
    if(t.heal&&medicSettle(u))break;
    if(t.heal&&medicStays(u))break;
    u.state='idle';u.anchor={x:u.x,y:u.y};u.savedDest=null
   }
   break}
  case 'attack':{
   const tgt=u.target;
   // v52: also drops a target the main gun has handed to its secondary, so a v51
   // save caught mid-fight resolves on the first tick instead of firing on a class
   // the cannon has given away. Comment sits on its OWN line: a trailing // here
   // eats the savedDest tail, which is the v50 trap and it bit again at v52.
   if(!tgt||tgt.hp<=0||!mainOk(u,tgt)){u.target=null;if(u.savedDest){orderMove(u,u.savedDest.x,u.savedDest.y,true);u.dest=u.savedDest}else u.state='idle';break}
   const d=dhyp(tgt.x-u.x,tgt.y-u.y)-(tgt.kind==='bld'?tgt.sz*.45:0);
   const minR=t.mrg||0;
   const rg=u.key==='para'?paraMun(tgt).rg:rgOf(u,tgt); // v30: paratrooper range follows the selected munition. v79: everything else follows the uplink. v88: ...and a spotted target adds Forward Observer's tiles on top
   if(d<=rg&&d>=minR){u.path=null;u.tface=datan2(tgt.y-u.y,tgt.x-u.x);if(!turreted(t))u.face=u.tface;if(u.cool<=0)fireAt(u,tgt);} // v41: tanks keep their travel-facing hull; the turret aims on its own
   else if(u.hold){u.target=null;u.state='idle';} // v29: hold-position never moves; drop unreachable targets
   else if(d<minR){const a=datan2(u.y-tgt.y,u.x-tgt.x);const nx=u.x+dcos(a)*spOf(u)*dt,ny=u.y+dsin(a)*spOf(u)*dt;if(t.fly||passableR(nx,ny,unitRad(u))){u.x=nx;u.y=ny}}
   else {if(!u.path||G.tick%20===u.id%20){u.dest={x:tgt.x,y:tgt.y};u.path=t.fly?[{x:tgt.x,y:tgt.y}]:findPath(u.x,u.y,tgt.x,tgt.y,false,unitRad(u));u.wp=0}moveAlong(u,dt);}
   break}
  case 'togo':{
   const n=u.node;
   if(!n||n.amt<=0){u.mining=false;if(u.cargo>10){u.state='return';u.path=null;break}u.node=findNode(u);if(u.node){truckToNode(u,u.node)}else u.state='idle';break}
   // if full while en route, go drop off first
   if(u.cargo>=cargoCap(u.cargoT)){u.state='return';u.path=null;u.mining=false;break} // v61: per-resource cap
   /* v68: the arrival test still measures to the NODE - only the drive target moved
      out to the dock ring. NODE_REACH is 2.0 against the old bare 1.75 because a truck
      parked on the 1.6 ring has to count as arrived even after a separation shove. */
   if(dhyp(n.x-u.x,n.y-u.y)<NODE_REACH){u.state='harvest';u.mining=true;u.hT=0;u.path=null;u.face=datan2(n.y-u.y,n.x-u.x)}
   else{
    if(!u.path)truckToNode(u,n);
    /* v68: the re-aim after a path runs out is on a cadence now. It used to fire the
       instant the path emptied, which with a dock point is EVERY tick forever if the
       truck parks a hair outside reach. Keyed on tick+id like every other repath
       cadence in the file, so it stays deterministic and peers agree. */
    if(moveAlong(u,dt)&&G.tick%NODE_REPATH===u.id%NODE_REPATH)truckToNode(u,n);
   }
   break}
  case 'harvest':{
   const n=u.node;
   if(!n||n.amt<=0){u.mining=false;if(u.cargo>10){u.state='return';u.path=null}else{u.node=findNode(u);u.state=u.node?'togo':'idle';u.path=null}break}
   u.mining=true;
   u.face=datan2(n.y-u.y,n.x-u.x);
   /* v61: the type reset moves ABOVE the take. It used to run after, which was
      harmless while both resources shared one cap and inverts the moment they do
      not - 40 plastic aboard against a battery cap of 23 gives take = -17, and
      the truck pays the node. The floor at zero covers the same inversion from a
      v60 save whose truck is carrying 60 into a 45 cap; it drives to the drop-off
      and banks the lot, it does not refund the pile. */
   const cap=cargoCap(n.t);
   if(u.cargoT&&u.cargoT!==n.t)u.cargo=0;
   const take=Math.max(0,Math.min(20*dt,n.amt,cap-u.cargo));
   u.cargoT=n.t;u.cargo+=take;n.amt-=take;
   if(n.amt<=0){removeNode(n);}
   if(u.cargo>=cap){u.state='return';u.mining=false;u.path=null}
   break}
  case 'return':{
   u.mining=false;
   const hq=nearestDrop(u);
   if(!hq){u.state='idle';break}
   u.dest={x:hq.x,y:hq.y};
   if(dhyp(hq.x-u.x,hq.y-u.y)<hq.sz*.5+1.7){
    if(u.cargo>0){u.p.stats.mined=(u.p.stats.mined||0)+u.cargo*TRUCK_DROP_MUL;u.p.res[u.cargoT==='plastic'?'p':'e']+=u.cargo*TRUCK_DROP_MUL;meterDrop(u.p,u.cargoT,u.cargo*TRUCK_DROP_MUL);u.cargo=0;if(u.p.human)updateTopbar();} // v29: mined totals feed the end chart
    if(u.oq&&u.oq.length&&!u.hold){u.state='idle';u.path=null;break} // v29: cargo banked, now run the queued orders
    // resume harvesting if we still have (or can find) a node, unless ordered to park
    if(u.parkAtHQ){u.parkAtHQ=false;u.state='idle';u.path=null;break}
    if(!u.node||u.node.amt<=0)u.node=findNode(u);
    if(u.node){u.state='togo';truckToNode(u,u.node)}else u.state='idle';
   } else {if(!u.path||u.wp>=u.path.length){u.path=findPath(u.x,u.y,hq.x,hq.y,true,unitRad(u));u.wp=0}moveAlong(u,dt);}
   break}
  case 'enterU':{ // v30: board a (possibly moving) friendly APC
   const b=u.targetB;
   if(!b||b.hp<=0||!b.t.cap||!G.units.includes(b)||b.garrison.length>=b.t.cap){u.state='idle';u.targetB=null;break}
   if(dhyp(b.x-u.x,b.y-u.y)<1.15){
    u.garrisoned=true;b.garrison.push(u);u.state='idle';u.path=null;u.target=null;u.targetB=null;
    if(G.sel.includes(u)){G.sel.splice(G.sel.indexOf(u),1);lastSelSig=''}
   }
   else{if(!u.path||G.tick%15===u.id%15){u.path=findPath(u.x,u.y,b.x,b.y,false,unitRad(u));u.wp=0;u.dest={x:b.x,y:b.y}}moveAlong(u,dt)}
   break}
  case 'enterB':{
   const b=u.targetB;
   if(!b||b.hp<=0||b.garrison.length>=garCap(b)){u.state='idle';break}
   if(dhyp(b.x-u.x,b.y-u.y)<b.sz*.5+1.2){u.garrisoned=true;b.garrison.push(u);u.state='idle';u.path=null;if(G.sel.includes(u)){G.sel.splice(G.sel.indexOf(u),1);lastSelSig=''}}
   else{if(!u.path){u.path=findPath(u.x,u.y,b.x,b.y,false,unitRad(u));u.wp=0;u.dest={x:b.x,y:b.y}}moveAlong(u,dt)}
   break}
 }
 /* v82: did he move under his own power this update? Written at the foot so it
    describes the whole update rather than a half-finished one, which makes it
    independent of where the reader sits in the unit order. The entrenched
    early return above cannot skip it for a bike: only the machine gunner
    carries t.entrench. Hashed, because it feeds a damage multiplier. */
 if(t.evade)u.mvg=(u.x!==sx82||u.y!==sy82);
}
/* v68 NODE DOCKING. Every truck used to aim at the node CENTRE, which is blocked:
   the pile carves a radius-1 disc out of pass. findPath's nearest-open scan is
   deterministic, so it handed the ENTIRE fleet the same tile and they arrived on top
   of one another. Measured on one node: at a fleet of 10, seven trucks sat inside a
   2.5-tile disc and 14.7% of truck pairs were interpenetrating below the 0.55
   separation floor; per-truck throughput fell from 699/truck-min at a fleet of 4 to
   593 at 10 and 530 at 16.
   Each truck gets its own slot instead. The slot index is this truck's RANK BY ID
   among the trucks assigned to that node, so two trucks never choose the same slot
   and the choice does not depend on iteration order; a linear probe skips slots that
   are not stand-able, and a node with no usable slot at all falls back to the v67
   centre-aim. No srand() draw, no clock read.
   The dock point is recomputed on demand and lives only in u.dest, which is already
   movement state: nothing new enters hashState, the snapshot encoder or loadState. */
function nodeDock(u,n){
 const r=unitRad(u),slots=[];
 /* Collect the USABLE slots first and rank into that list. A linear probe from a
    per-truck start index looks equivalent and is not: it does not reserve, so on a
    pile where 2 or 3 of the 8 slots are unstandable (about 30% of them across the
    map set) several trucks probe onto the same survivor and dock on top of one
    another, which is the exact pile-up this function exists to remove. */
 for(let k=0;k<NODE_DOCK_N;k++){
  const a=k*(6.283185307179586/NODE_DOCK_N);
  const px=n.x+dcos(a)*NODE_DOCK_R,py=n.y+dsin(a)*NODE_DOCK_R;
  if(passableR(px,py,r))slots.push({x:px,y:py});
 }
 if(!slots.length)return{x:n.x,y:n.y};
 let idx=0;
 for(const v of u.p.units){
  if(v===u||v.key!=='truck'||v.t.heal||v.hp<=0||v.node!==n)continue;
  if(v.id<u.id)idx++;
 }
 /* More trucks than slots wraps rather than failing: they share a slot, which is
    still spread around the ring instead of stacked on one approach tile. */
 return slots[idx%slots.length];
}
/* the one place a truck is sent to a node. Six call sites used to repeat the dest /
   findPath / wp triple by hand, which is exactly how they drifted apart. */
function truckToNode(u,n){
 const d=nodeDock(u,n);
 u.dest={x:d.x,y:d.y};
 u.path=findPath(u.x,u.y,d.x,d.y,true,unitRad(u));
 /* findPath works in TILES and hands back tile CENTRES, so a dock point's
    sub-tile offset is lost and the truck parks up to ~0.7 tiles off its slot.
    That is enough to land it outside NODE_REACH, and then `togo` re-aims it
    every single tick: measured 5850 repaths per 100 sim-seconds against 2058
    findPath calls in the whole of v67, 5557 of them from a truck sitting two
    tiles off the pile. Pin the exact dock on the end of the path. The last
       tile centre and the dock are adjacent and both stand-able, so the extra leg
    is short; anything odd is absorbed by the wall slide and the cadence gate. */
 const L=u.path[u.path.length-1];
 if(!L||dhyp(L.x-d.x,L.y-d.y)>.01)u.path.push({x:d.x,y:d.y});
 u.wp=0;
}
/* v75 RESOURCE SERVO.
   One signed number replaces v22's hard battery filter, v22's battery lean and
   v61's glut push. All three were absolute thresholds on electricity alone, so a
   plastic-starved army was never pulled toward plastic at all; measured, banks
   ran to 3,103 / 5,675 / 4,469 electricity against 532 / 1,001 / 1,527 plastic
   per player at ten minutes.

   RES_REF is the electricity-to-plastic ratio the game's own price lists imply,
   summed over every trainable unit and every buildable structure. It is DERIVED
   rather than tuned, in the style of MEDIC_HEAL_RATE, so re-pricing a unit moves
   the servo's idea of balance with it instead of leaving a stale constant behind.
   A stockpile is balanced when e === p * RES_REF.

   resSkew normalises the imbalance to -1..+1. Positive means battery-poor,
   negative means battery-rich, and the MAGNITUDE is how far off balance the bank
   is, which is what makes the incentive scale with the imbalance rather than
   switching on at a threshold.

   RES_BIAS is applied to both pile types with OPPOSITE signs, so whichever
   resource is scarce gets exactly as much cheaper to visit as the abundant one
   gets dearer. 9 is deliberately the same order as the +9 per-truck crowding
   penalty and the -5 drop-coverage bonus: at full skew the two pile types sit 18
   tiles apart in score, which re-ranks piles decisively without blacklisting one.
   RES_HARD is where preference becomes a filter, the symmetric replacement for
   v22's battery-only rule; findNode's existing "preferred type exhausted -> take
   anything" fallback still catches an empty board.

   Pure arithmetic over the tables and over p.res, read fresh on every call:
   nothing stored on an entity, nothing hashed, nothing serialized. */
const RES_REF=(function(){
 let cp=0,ce=0;
 for(const k in U){if(U[k].noTrain)continue;cp+=U[k].cp;ce+=U[k].ce;}
 for(const k in B){if(k==='nest'||B[k].barr)continue;cp+=B[k].cp;ce+=B[k].ce;} // v88: t.barr - a wall is not part of the roster the harvest ratio is derived from, whichever wall it is
 return cp>0?ce/cp:0.22;
})();
const RES_BIAS=9;     // tiles of score at full skew, per pile type
const RES_HARD=0.6;   // |skew| at which the preference becomes a filter
function resSkew(p){
 const want=p.res.p*RES_REF, have=p.res.e, d=want+have;
 return d>0?(want-have)/d:0;
}
function findNode(u){
 // v22 balanced dispatch: distance + a crowding penalty (each truck already working
 // a node adds ~9 tiles of cost, so a fleet spreads across nodes) + a small danger
 // penalty from the influence map so trucks prefer uncontested nodes. Nodes near a
 // drop building get a bonus. v75: the battery lean is now the two-sided servo.
 const p=u.p;
 let best=null,bs=1e9;
 /* v75: one signed number decides which resource this fleet is short of and by
    how much. Positive skew is battery-poor. */
 const skew=resSkew(p);
 const need=skew>0?'battery':'plastic';
 const hard=(skew<0?-skew:skew)>=RES_HARD&&G.map.nodes.some(n=>n.t===need&&n.amt>0);
 // a truck already carrying a partial load should keep harvesting the same type,
 // otherwise it would dump what it's carrying when it switches resource types.
 const lock=(u&&u.cargo>10)?u.cargoT:null;
 const load=new Map();
 for(const v of p.units)if(v!==u&&v.key==='truck'&&v.node&&v.node.amt>0)load.set(v.node,(load.get(v.node)||0)+1);
 /* v75: signed, and applied to both pile types with opposite signs below, so the
    servo is symmetric - the scarce resource gets cheaper to visit by exactly as
    much as the abundant one gets dearer. */
 const bias=RES_BIAS*skew;
 const covered=n=>p.blds.some(b=>b.t.drop&&b.prog>=1&&dhyp(b.x-n.x,b.y-n.y)<12);
 const pick=filter=>{
  for(const n of G.map.nodes){
   if(n.amt<=0)continue;
   if(filter&&n.t!==filter)continue;
   let s=dhyp(n.x-u.x,n.y-u.y);
   s+=(load.get(n)||0)*9;
   /* v75: skew>0 is battery-poor, so battery piles get cheaper and plastic piles
      get dearer by the same amount; at skew 0 this term vanishes entirely. */
   s+=(n.t==='battery'?-bias:bias);
   if(covered(n))s-=5;
   s+=powAt(p,n.x,n.y,true)*0.1;
   if(s<bs){bs=s;best=n}
  }
 };
 if(lock)pick(lock);else if(hard)pick(need);else pick(null);
 if(!best){bs=1e9;pick(null);} // preferred type exhausted -> take anything
 return best;
}
function nearestDrop(u){let best=null,bd=1e9;for(const b of u.p.blds){if(!b.t.drop||b.prog<1)continue;const d=(b.x-u.x)**2+(b.y-u.y)**2;if(d<bd){bd=d;best=b}}return best}
function removeNode(n){
 const i=G.map.nodes.indexOf(n);if(i<0)return;
 G.map.nodes.splice(i,1);
 // v30.1: the client-local ghost store is INDEX-keyed against G.map.nodes, so it must be
 // spliced in lockstep (unsynced splices misaligned every ghost past i: wrong-amt snapshots,
 // orphan piles rendering after depletion, and pan flicker from inView/draw coord mismatch).
 // A pile mined out while FOGGED persists as a "gone ghost" until re-scouted, mirroring
 // destroyed-while-fogged buildings; one that vanished in plain sight leaves nothing.
 // Client-local only - never hashed or serialized.
 if(G.ghost){const g=G.ghost.nodes[i];G.ghost.nodes.splice(i,1);if(g&&fogAt(n.x,n.y)!==2)G.ghost.goneNodes.push(g);}
 const N=G.map.N;
 for(let y=Math.floor(n.y-1.5);y<=n.y+1.5;y++)for(let x=Math.floor(n.x-1.5);x<=n.x+1.5;x++)if(x>=0&&y>=0&&x<N&&y<N&&dhyp(x+.5-n.x,y+.5-n.y)<=1)G.map.pass[y*N+x]=1;
 pfDirty();
 if(G.sel.includes(n)){G.sel.splice(G.sel.indexOf(n),1);lastSelSig=''} // v40: drop a mined-out pile from the selection
}
// dead units leave a salvageable plastic wreck worth 50% of their plastic build cost.
// wrecks are smaller/lighter than real piles: they don't block the tile, so they never
// trap pathing, and they merge into a nearby wreck if one already exists.
function spawnWreck(x,y,amt,col){
 if(amt<=0)return;
 // clamp into bounds so trucks can always reach it
 const N=G.map.N;x=clamp(x,2,N-3);y=clamp(y,2,N-3);
 for(const n of G.map.nodes){if(n.t==='plastic'&&n.wreck&&dhyp(n.x-x,n.y-y)<2){n.amt=Math.min(n.amt+amt,n.max+amt);n.max=Math.max(n.max,n.amt);return}}
 G.map.nodes.push({t:'plastic',wreck:true,x,y,amt,max:amt,col:col||'#9aa0a8'});
}

/* separation */
function separation(){
 const cell={},key=(x,y)=>x+'_'+y;
 for(const u of G.units){if(u.t.fly||u.garrisoned)continue;const k=key(Math.floor(u.x),Math.floor(u.y));(cell[k]=cell[k]||[]).push(u)}
 /* v68: a mining truck and an entrenched gunner are PINNED - they never initiate a
    push, exactly as before, because a miner that wanders off its node is worse than a
    miner that overlaps. But they may now BE pushed. Until v68 the outer loop skipped
    them entirely while each pair was resolved only by its LOWER-id member, so any
    pair whose lower-id side happened to be mining was never separated at all: that
    was 61% of every observed truck overlap, which is most of the blob that forms
    around a node.
    The share is the whole change. Two mobile units still take half the gap each,
    which is bit-for-bit the v67 arithmetic; when one side is pinned the mobile side
    takes the whole gap instead; when both are pinned nothing moves. */
 const pinned=e=>e.state==='harvest'||e.entrenched;
 for(const u of G.units){
  if(u.t.fly||u.garrisoned)continue;
  const pu=pinned(u)?1:0;
  const cx=Math.floor(u.x),cy=Math.floor(u.y);
  for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
   const lst=cell[key(cx+ox,cy+oy)];if(!lst)continue;
   for(const v of lst){if(v===u||v.id<u.id)continue;
    const pv=pinned(v)?1:0;
    if(pu&&pv)continue;
    const dx=u.x-v.x,dy=u.y-v.y,d=dhyp(dx,dy),min=.55;
    if(d<min&&d>.001){const push=(min-d)/((pu?0:1)+(pv?0:1)),px=dx/d*push,py=dy/d*push;
     if(!pu&&passableR(u.x+px,u.y+py,unitRad(u))){u.x+=px;u.y+=py}
     if(!pv&&passableR(v.x-px,v.y-py,unitRad(v))){v.x-=px;v.y-=py}}
   }
  }
 }
 // flying units keep their own spacing too (they ignore terrain, so no passableR test).
 // this stops helicopters from sitting perfectly stacked on a single tile.
 const fcell={};
 for(const u of G.units){if(!u.t.fly||u.garrisoned)continue;const k=key(Math.floor(u.x),Math.floor(u.y));(fcell[k]=fcell[k]||[]).push(u)}
 const N=G.map.N;
 for(const u of G.units){
  if(!u.t.fly||u.garrisoned)continue;
  const cx=Math.floor(u.x),cy=Math.floor(u.y);
  for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
   const lst=fcell[key(cx+ox,cy+oy)];if(!lst)continue;
   for(const v of lst){if(v===u||v.id<u.id)continue;
    const dx=u.x-v.x,dy=u.y-v.y,d=dhyp(dx,dy),min=.9;
    if(d>=min)continue;
    let px,py;
    if(d>.001){const push=(min-d)/2;px=dx/d*push;py=dy/d*push;}
    else{const a=u.id*2.399963;px=dcos(a)*.32;py=dsin(a)*.32;} // exactly stacked: split deterministically
    u.x=clamp(u.x+px,.5,N-.5);u.y=clamp(u.y+py,.5,N-.5);
    v.x=clamp(v.x-px,.5,N-.5);v.y=clamp(v.y-py,.5,N-.5);
   }
  }
 }
}

