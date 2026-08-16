#!/usr/bin/env python3
"""splice_v82.py - Blue Army abilities, spliced onto the v81 game file.

Scout Bike     Evasive (passive), Flat Out (toggle)
Chinook        the existing +15% infantry aura (named passive, no code),
               Air Assault (toggle): the squad fires out, the aircraft is pinned
Wind Turbine   the existing power output (named passive, no code),
               Overdrive (ability): x3 for OVER_T, then dead until the cooldown

Every edit asserts an exact occurrence count and the script refuses to run
against anything but a v81 source, so a re-run fails loudly instead of
double-applying. The file is written BEFORE anything is reported, so a
truncated pipe cannot report success against an unmodified file.
"""
import sys

SRC = '/home/claude/plastic-warfare-v81.html'
DST = '/home/claude/plastic-warfare-v82.html'

s = open(SRC, encoding='utf-8').read()
EDITS = []


def rep(tag, old, new, n=1):
    global s
    c = s.count(old)
    if c != n:
        sys.exit('EDIT %s: expected %d occurrence(s) of anchor, found %d\n---\n%s' % (tag, n, c, old[:240]))
    if new in s and new.strip() and old != new:
        sys.exit('EDIT %s: replacement already present - wrong source version?' % tag)
    EDITS.append(tag)
    s = s.replace(old, new, n)


def ins_after(tag, anchor, add, n=1):
    rep(tag, anchor, anchor + add, n)


# ---- version guard ----------------------------------------------------------
if 'LOCK_AI_FLOOR' not in s or 'EVADE_RED' in s:
    sys.exit('source is not a clean v81 build (missing LOCK_AI_FLOOR or already carries v82)')

# ---- 1. tunables ------------------------------------------------------------
rep('1 tunables',
    "const LOCK_AI_FLOOR=0.50;  // ...and the share of its health a BOT lets a bunker fall to before locking it down\n",
    "const LOCK_AI_FLOOR=0.50;  // ...and the share of its health a BOT lets a bunker fall to before locking it down\n"
    "const EVADE_RED=0.50;      // Evasive: the share of incoming damage a Scout Bike stops taking on a tick he actually moved\n"
    "const FLAT_SPD=0.30;       // Flat Out: speed added while he runs flat out\n"
    "const FLAT_VI=2;           // ...and the sight it adds, on top of whatever the uplink is already giving him\n"
    "const OVER_MUL=3;          // Overdrive: what the Wind Turbine's output is multiplied by while it runs\n"
    "const OVER_T=20;           // ...for how long, held on the building's existing upT\n"
    "const OVER_OFF=70;         // ...and how long it then produces NOTHING\n"
    "const OVER_CD=OVER_T+OVER_OFF; // ...so the cooldown on the shared abilityCool ends exactly when the dead window does. Derived, never typed: the offline test reads abilityCool, and a hand-typed cooldown that drifted from the sum would leave the turbine either dead past its own button or alive before it\n")

# ---- 2. help-panel slots ----------------------------------------------------
rep('2 help slots',
    " lockRed:()=>Math.round(LOCK_RED*100), lockT:()=>LOCK_T, lockCd:()=>LOCK_CD,\n",
    " lockRed:()=>Math.round(LOCK_RED*100), lockT:()=>LOCK_T, lockCd:()=>LOCK_CD,\n"
    " /* v82: the Blue ability numbers. Same rule as every slot above it. */\n"
    " evadeRed:()=>Math.round(EVADE_RED*100), flatSpd:()=>Math.round(FLAT_SPD*100), flatVi:()=>FLAT_VI,\n"
    " overMul:()=>OVER_MUL, overT:()=>OVER_T, overOff:()=>OVER_OFF, overCd:()=>OVER_CD,\n")

# ---- 3. table rows ----------------------------------------------------------
rep('3a bike row',
    " bike:{n:'Scout Bike',a:'bike',hp:70,dm:7,rg:3.5,rt:.625,sp:5.1,vi:9,cp:90,ce:5,bt:6,w:'b',tech:'u_bike',d:'Blazing fast scout'},",
    " bike:{n:'Scout Bike',a:'bike',hp:70,dm:7,rg:3.5,rt:.625,sp:5.1,vi:9,cp:90,ce:5,bt:6,w:'b',evade:1,flat:1,tech:'u_bike',"
    "d:`Blazing fast scout. Evasive: takes ${Math.round(EVADE_RED*100)}% less damage on any tick he actually moved. "
    "Flat Out adds ${Math.round(FLAT_SPD*100)}% speed and +${FLAT_VI} sight, but he cannot fire or be sent at a target`},")

rep('3b chinook row',
    "cap:15,aura:.15,auraR:3,tech:'u_chinook',d:'Unarmed transport: carries 15 infantry (right-click to load, U to unload). Nearby infantry hit 15% harder'},",
    "cap:15,aura:.15,auraR:3,assault:1,tech:'u_chinook',"
    "d:`Unarmed transport: carries 15 infantry (right-click to load, U to unload). Nearby infantry hit ${Math.round(U0AURA*100)}% harder. "
    "Air Assault lets the squad fire out of the hold, but the aircraft cannot move while it runs`},")

rep('3c turbine row',
    " turbine:{n:'Wind Turbine',hp:260,sz:1,cp:110,ce:0,bt:6,vi:4,tech:'b_turbine',eps:2.2,d:'+2.2 \u26a1/sec, cheap'},",
    " turbine:{n:'Wind Turbine',hp:260,sz:1,cp:110,ce:0,bt:6,vi:4,tech:'b_turbine',eps:2.2,over:1,"
    "d:`+2.2 \u26a1/sec, cheap. Overdrive runs it at \u00d7${OVER_MUL} for ${OVER_T}s, then it produces nothing for ${OVER_OFF}s`},")

# The aura percentage in the Chinook card is derived rather than retyped; the row
# cannot read its own literal while it is being written, so the figure is named
# once just above the unit table.
# The constant must be DECLARED ABOVE the table that reads it: a const in the
# temporal dead zone throws on the object literal, and the unit table is built at
# module scope, so a declaration sitting after it fails at boot rather than at use.
rep('3d aura constant',
    "  bug:{name:'Wildlife',color:'#6e5a2a',mods:{cost:1,hp:1,dmg:1,speed:1},desc:'',uu:[],ub:''}\n};\nconst U={".replace('  bug', ' bug'),
    " bug:{name:'Wildlife',color:'#6e5a2a',mods:{cost:1,hp:1,dmg:1,speed:1},desc:'',uu:[],ub:''}\n};\n"
    "const U0AURA=0.15; // v82: the Chinook's infantry aura, named ABOVE the table so its own info card can state the figure the row sets rather than a retyped copy of it\n"
    "const U={")

rep('3e aura reads the constant',
    "cap:15,aura:.15,auraR:3,assault:1,",
    "cap:15,aura:U0AURA,auraR:3,assault:1,")

# ---- 6. per-unit state ------------------------------------------------------
rep('6 makeUnit fields',
    " if(t.ripple)u.rip=false;\n",
    " if(t.ripple)u.rip=false;\n"
    " /* v82: the Blue fields. mvg is \"did he move on his own last update\", written\n"
    "    at the foot of updateUnit and read by the Evasive term in applyDmg; fo is\n"
    "    \"is this passenger firing out\", written by his CARRIER every tick, which is\n"
    "    what saves a passenger needing a back-pointer to the aircraft holding him. */\n"
    " if(t.evade)u.mvg=false;\n"
    " if(t.flat)u.flat=false;\n"
    " if(t.assault)u.aslt=false;\n"
    " if(t.cap)u.fo=false;\n")

# ---- 7. the modifier doors --------------------------------------------------
rep('7a spOf',
    "function spOf(u){return (u.t.throttle&&u.thr)?u.sp*(1+THROTTLE_SPD):u.sp;}",
    "function spOf(u){return (u.t.throttle&&u.thr)?u.sp*(1+THROTTLE_SPD):((u.t.flat&&u.flat)?u.sp*(1+FLAT_SPD):u.sp);}")

rep('7b viOf',
    "function viOf(u){const v=(u.t.vi||0);return v>0&&upOn(u.p)?v+UPLINK_VI:v;}",
    "function viOf(u){let v=(u.t.vi||0);if(v>0&&u.t.flat&&u.flat)v+=FLAT_VI;return v>0&&upOn(u.p)?v+UPLINK_VI:v;}")

# ---- 8. Evasive, defender side ----------------------------------------------
rep('8 evasive',
    " if(tgt.kind==='bld'&&tgt.t.lock&&tgt.upT>0)amt*=(1-LOCK_RED);",
    " if(tgt.kind==='bld'&&tgt.t.lock&&tgt.upT>0)amt*=(1-LOCK_RED);\n"
    " /* v82 EVASIVE. Keyed on whether the bike DISPLACED on its own last update,\n"
    "    not on its state: measured over three matches, 82.3% of a Scout Bike's\n"
    "    incoming damage lands while it is parked in the attack state shooting and\n"
    "    only 1.5% under an ordered march, so a state test would have been inert in\n"
    "    the Shell Shock sense. Displacement covers 17.3%, which is the ceiling on\n"
    "    what this passive can ever be worth and is recorded in tail_v82. */\n"
    " if(tgt.kind==='unit'&&tgt.t.evade&&tgt.mvg)amt*=(1-EVADE_RED);")

# ---- 9. Air Assault: the squad fires out ------------------------------------
rep('9a fireOut82',
    "function updateUnit(u,dt){\n if(u.garrisoned)return;",
    "/* v82 AIR ASSAULT. A passenger's whole update is skipped by the garrison\n"
    "   return below, which is the ONE door that stops him shooting - the eleven\n"
    "   garrison guards the roadmap warned about are every one of them candidate- or\n"
    "   defender-side and not one of them blocks him from firing. So this is his\n"
    "   whole update, driven by his CARRIER rather than by the top-level loop.\n"
    "   Shaped like u.hold: acquire inside min(sight,reach), fire what is in reach,\n"
    "   drop what leaves it, never path and never move. He keeps his own clocks\n"
    "   because fireAt and the concealment test both read them.\n"
    "   Note he is NOT invulnerable while he does it, and that needed no edit:\n"
    "   orderAttack, the retaliation block and the call-for-help sweep all take the\n"
    "   attacker by reference and none of the three tests whether he is aboard, so\n"
    "   the man he shoots and that man's neighbours answer him already. */\n"
    "function fireOut82(u,dt){\n"
    " if(u.cool>0)u.cool-=dt;\n"
    " if(u.shotT!=null&&u.shotT<999)u.shotT+=dt;\n"
    " if(u.calmT<999)u.calmT+=dt;\n"
    " if(!u.t.dm||u.hp<=0)return;\n"
    " const r=Math.min(viOf(u),rgOf(u));\n"
    " let tgt=u.target;\n"
    " if(!tgt||tgt.hp<=0||!mainOk(u,tgt)||dhyp(tgt.x-u.x,tgt.y-u.y)>r){\n"
    "  tgt=null;u.target=null;\n"
    "  if(G.tick%10===u.id%10){tgt=nearestEnemy(u,r);u.target=tgt;}\n"
    " }\n"
    " if(!tgt||tgt.hp<=0)return;\n"
    " const d=dhyp(tgt.x-u.x,tgt.y-u.y)-(tgt.kind==='bld'?tgt.sz*.45:0);\n"
    " if(d<=rgOf(u)&&d>=(u.t.mrg||0)){\n"
    "  u.tface=datan2(tgt.y-u.y,tgt.x-u.x);u.face=u.tface;\n"
    "  if(u.cool<=0)fireAt(u,tgt);\n"
    " }\n"
    "}\n"
    "function updateUnit(u,dt){\n if(u.garrisoned)return;")

rep('9b carrier drives the squad',
    " if(t.cap&&u.garrison&&u.garrison.length)for(const v of u.garrison){v.x=u.x;v.y=u.y;}",
    " if(t.cap&&u.garrison&&u.garrison.length){\n"
    "  const ao82=!!(t.assault&&u.aslt);\n"
    "  for(const v of u.garrison){v.x=u.x;v.y=u.y;v.fo=ao82;if(ao82)fireOut82(v,dt);}\n"
    " }")

# ---- 10. the aircraft is pinned while it runs -------------------------------
rep('10 orderMove refuses a pinned carrier',
    "function orderMove(u,x,y,amove){\n if(u.entrenched){u.entrenched=false;lastSelSig='';}",
    "function orderMove(u,x,y,amove){\n"
    " if(u.t.assault&&u.aslt)return; // v82: Air Assault pins the aircraft. ONE door, so a player order, an AI order, a rally hop and a retaliation march are all refused together\n"
    " if(u.entrenched){u.entrenched=false;lastSelSig='';}")

# ---- 11. Flat Out holds fire and takes no attack order ----------------------
rep('11a orderAttack refuses a bike running flat out',
    " if(hid81(tgt,u.p))return; // v81: nobody can be ordered onto a man nothing has seen - player order, AI order, retaliation and the help sweep all arrive here",
    " if(hid81(tgt,u.p))return; // v81: nobody can be ordered onto a man nothing has seen - player order, AI order, retaliation and the help sweep all arrive here\n"
    " if(u.t.flat&&u.flat)return; // v82: ...and a bike running flat out takes no attack order from any of those four either")

rep('11b idle acquisition',
    "if(t.dm&&!u.smoke&&!u.thr&&G.tick%10===u.id%10)",
    "if(t.dm&&!u.smoke&&!u.thr&&!u.flat&&G.tick%10===u.id%10)")

rep('11c amove acquisition',
    "if(t.dm&&!u.smoke&&!u.thr&&G.tick%6===u.id%6)",
    "if(t.dm&&!u.smoke&&!u.thr&&!u.flat&&G.tick%6===u.id%6)")

# ---- 12. the movement flag Evasive reads ------------------------------------
rep('12 mvg written at the foot of updateUnit',
    "   else{if(!u.path){u.path=findPath(u.x,u.y,b.x,b.y,false,unitRad(u));u.wp=0;u.dest={x:b.x,y:b.y}}moveAlong(u,dt)}\n"
    "   break}\n"
    " }\n"
    "}",
    "   else{if(!u.path){u.path=findPath(u.x,u.y,b.x,b.y,false,unitRad(u));u.wp=0;u.dest={x:b.x,y:b.y}}moveAlong(u,dt)}\n"
    "   break}\n"
    " }\n"
    " /* v82: did he move under his own power this update? Written at the foot so it\n"
    "    describes the whole update rather than a half-finished one, which makes it\n"
    "    independent of where the reader sits in the unit order. The entrenched\n"
    "    early return above cannot skip it for a bike: only the machine gunner\n"
    "    carries t.entrench. Hashed, because it feeds a damage multiplier. */\n"
    " if(t.evade)u.mvg=(u.x!==sx82||u.y!==sy82);\n"
    "}")

rep('12b the position stash the flag compares against',
    "function updateUnit(u,dt){\n if(u.garrisoned)return;\n if(u.cool>0)u.cool-=dt;",
    "function updateUnit(u,dt){\n if(u.garrisoned)return;\n const sx82=u.x,sy82=u.y; // v82: where he started this update, for the Evasive flag written at the foot\n if(u.cool>0)u.cool-=dt;")

# ---- 13. splash stops skipping a man who is firing out ---------------------
rep('13 splash',
    "for(const e of G.units.slice()){if(allied(e.p,owner.p)||e.garrisoned)continue;",
    "/* v82: a passenger firing OUT of a Chinook is on the battlefield and a blast\n"
    "   finds him. A bunker garrison and a quiet APC squad keep the exemption\n"
    "   exactly as before - u.fo is false for both. Owner decision: splash answers\n"
    "   Air Assault, the APC shield and smoke cover deliberately still do not. */\n"
    " for(const e of G.units.slice()){if(allied(e.p,owner.p)||(e.garrisoned&&!e.fo))continue;")

# ---- 14. a passenger who dies leaves the troop bay --------------------------
rep('14 garrison hygiene',
    "  if(e.t.cap&&e.garrison&&e.garrison.length)apcUnload(e,0.85);",
    "  /* v82: before this release a garrisoned man could not be hurt at all, so\n"
    "     nothing ever had to take one out of a hold. Air Assault makes him\n"
    "     killable in place, and a corpse left in the array reads as an occupied\n"
    "     seat: the bay counts against the cap, the panel readout lies, and\n"
    "     apcUnload would later set the corpse to 1 HP without fielding it. */\n"
    "  if(e.garrisoned){\n"
    "   for(const c of G.units){const gi=c.garrison?c.garrison.indexOf(e):-1;if(gi>=0){c.garrison.splice(gi,1);break}}\n"
    "   for(const b of G.blds){const gi=b.garrison?b.garrison.indexOf(e):-1;if(gi>=0){b.garrison.splice(gi,1);break}}\n"
    "  }\n"
    "  if(e.t.cap&&e.garrison&&e.garrison.length)apcUnload(e,0.85);")

rep('14b unloading clears the firing flag',
    "  u.garrisoned=false;\n  if(frac)u.hp=Math.max(1,u.hp*frac);",
    "  u.garrisoned=false;u.fo=false; // v82: a man on the ground is not firing out of anything\n  if(frac)u.hp=Math.max(1,u.hp*frac);")

# ---- 15. Overdrive: the one income door -------------------------------------
rep('15 turbine output',
    " if(b.t.eps){const em=(b.upg&&UPGRADES[b.key])?UPGRADES[b.key].eff:1;b.p.res.e+=b.t.eps*em*dt;}",
    " /* v82 OVERDRIVE, three-way on the two timers the building already has: upT is\n"
    "    the burst, and once that runs out abilityCool is still holding, which IS\n"
    "    the dead window. No new state, and OVER_CD is derived from the two so the\n"
    "    dark period ends on the tick the button comes back. */\n"
    " if(b.t.eps){const em=(b.upg&&UPGRADES[b.key])?UPGRADES[b.key].eff:1;\n"
    "  const om=b.t.over?(b.upT>0?OVER_MUL:(b.abilityCool>0?0:1)):1;\n"
    "  b.p.res.e+=b.t.eps*em*om*dt;}")

# ---- 16. commands -----------------------------------------------------------
rep('16 commands',
    "  case 'lock':{ // v81: the Bunker buttons up, on the shared abilityCool",
    "  case 'flat':{ // v82: the Scout Bike runs flat out\n"
    "   for(const u of cmdUnits(p,a.ids)){\n"
    "    if(!u.t.flat||u.garrisoned)continue;\n"
    "    u.flat=!!a.on;\n"
    "    if(u.flat)u.target=null; // he cannot fire while it runs, and holding a target he may not shoot would leave him standing in the attack state\n"
    "   }\n"
    "   if(p===G.human)lastSelSig='';\n"
    "   break}\n"
    "  case 'assault':{ // v82: the Chinook's squad fires out of the hold\n"
    "   for(const u of cmdUnits(p,a.ids)){\n"
    "    if(!u.t.assault||u.garrisoned)continue;\n"
    "    u.aslt=!!a.on;\n"
    "    if(u.aslt){u.path=null;u.dest=null;u.state='idle';} // pinned from this tick, not from the end of the march it was on\n"
    "    else for(const v of (u.garrison||[])){v.fo=false;v.target=null;}\n"
    "   }\n"
    "   if(p===G.human)lastSelSig='';\n"
    "   break}\n"
    "  case 'over':{ // v82: the Wind Turbine spends its output ahead of time\n"
    "   const b=entById(a.bid);\n"
    "   if(!b||b.kind!=='bld'||!b.t.over||b.p!==p||b.prog<1||b.hp<=0||b.abilityCool>0)break;\n"
    "   b.upT=OVER_T;b.abilityCool=(G&&G.test)?0:OVER_CD;\n"
    "   if(p===G.human){msg(`Turbine overdriven \\u2014 \\u00d7${OVER_MUL} output for ${OVER_T}s, then nothing for ${OVER_OFF}s.`);lastSelSig='';}\n"
    "   break}\n"
    "  case 'lock':{ // v81: the Bunker buttons up, on the shared abilityCool")

# ---- 17. panel buttons ------------------------------------------------------
rep('17 buttons',
    "  // ---- v30 APC: troop bay readout + unload ----",
    "  /* --- v82 SCOUT BIKE: flat out --- */\n"
    "  if(e.kind==='unit'&&e.p===G.human&&e.t.flat){\n"
    "   const bt=document.createElement('button');bt.className='bb'+(e.flat?' sel':'');\n"
    "   bt.innerHTML=`<b>${e.flat?'Slow Down':'Flat Out'}</b><br><span style=\"font-size:10px;opacity:.75\">+${Math.round(FLAT_SPD*100)}% speed, +${FLAT_VI} sight, no guns</span>`;\n"
    "   bt.title=`Run flat out: ${Math.round(FLAT_SPD*100)}% faster and ${FLAT_VI} tiles more sight, but he will not fire and cannot be sent at a target while it runs.`;\n"
    "   bt.onclick=()=>{submitCmd('flat',{ids:[e.id],on:!e.flat});sClick();};\n"
    "   pb.appendChild(bt);\n"
    "  }\n"
    "  /* --- v82 CHINOOK: air assault --- */\n"
    "  if(e.kind==='unit'&&e.p===G.human&&e.t.assault){\n"
    "   const bt=document.createElement('button');bt.className='bb'+(e.aslt?' sel':'');\n"
    "   bt.innerHTML=`<b>${e.aslt?'Cease Fire':'Air Assault'}</b><br><span style=\"font-size:10px;opacity:.75\">the squad fires out; the aircraft cannot move</span>`;\n"
    "   bt.title='Open the hold: every man aboard fires on what he can reach, and can be answered by it. The Chinook is pinned in place for as long as it runs.';\n"
    "   bt.onclick=()=>{submitCmd('assault',{ids:[e.id],on:!e.aslt});sClick();};\n"
    "   pb.appendChild(bt);\n"
    "  }\n"
    "  // ---- v30 APC: troop bay readout + unload ----")

rep('17b turbine button',
    "  /* --- v81 BUNKER: lockdown --- */",
    "  /* --- v82 WIND TURBINE: overdrive --- */\n"
    "  if(e.kind==='bld'&&e.p===G.human&&e.t.over&&e.prog>=1){\n"
    "   const live=e.upT>0, ready=e.abilityCool<=0;\n"
    "   const bt=document.createElement('button');bt.className='bb'+(live?' sel':'');\n"
    "   bt.disabled=!ready;\n"
    "   bt.innerHTML=`<b>Overdrive</b><br><span style=\"font-size:10px;opacity:.75\">${live?Math.ceil(e.upT)+'s remaining':(ready?`\\u00d7${OVER_MUL} output for ${OVER_T}s, then ${OVER_OFF}s dark`:'offline, '+Math.ceil(e.abilityCool)+'s')}</span>`;\n"
    "   bt.title=`Run the turbine at \\u00d7${OVER_MUL} for ${OVER_T} seconds. It then produces nothing at all for ${OVER_OFF} seconds. Over the whole ${OVER_CD}-second cycle this is less electricity than leaving it alone, not more: it buys the power EARLIER.`;\n"
    "   bt.onclick=()=>{if(!ready)return;submitCmd('over',{bid:e.id});sClick();};\n"
    "   pb.appendChild(bt);\n"
    "  }\n"
    "  /* --- v81 BUNKER: lockdown --- */")

# ---- 18. selection signature ------------------------------------------------
rep('18 sel signature',
    "  if(e.kind==='bld'&&e.t.uplink)sig+='|up'+Math.ceil(e.upT||0)+'_'+Math.ceil(e.abilityCool||0);",
    "  if(e.kind==='bld'&&e.t.uplink)sig+='|up'+Math.ceil(e.upT||0)+'_'+Math.ceil(e.abilityCool||0);\n"
    "  if(e.kind==='bld'&&e.t.over)sig+='|ov'+Math.ceil(e.upT||0)+'_'+Math.ceil(e.abilityCool||0); // v82: the Overdrive button reads both clocks, so both have to move the signature or it redraws stale")

# ---- 19. hash + load defaults ----------------------------------------------
rep('19a hash',
    "h=hI(h,u.rip?1:0)}",
    "h=hI(h,u.rip?1:0);h=hI(h,u.flat?1:0);h=hI(h,u.aslt?1:0);h=hI(h,u.fo?1:0);h=hI(h,u.mvg?1:0)}")

rep('19b hash comment',
    "v81: the shot clock the concealment test reads, and the two Gray toggles",
    "v81: the shot clock the concealment test reads, and the two Gray toggles. v82: the two Blue toggles, the per-passenger firing-out flag its carrier writes, and the movement flag Evasive multiplies damage by")

rep('19c load defaults',
    "if(u.t.ripple&&u.rip==null)u.rip=false;return u});",
    "if(u.t.ripple&&u.rip==null)u.rip=false;"
    "if(u.t.evade&&u.mvg==null)u.mvg=false;if(u.t.flat&&u.flat==null)u.flat=false;"
    "if(u.t.assault&&u.aslt==null)u.aslt=false;if(u.t.cap&&u.fo==null)u.fo=false;return u});")

open(DST, 'w', encoding='utf-8').write(s)
print('wrote %s' % DST)
print('%d edits applied:' % len(EDITS))
for t in EDITS:
    print('  ' + t)
