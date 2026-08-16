#!/usr/bin/env python3
"""
splice_v79.py - Plastic Warfare v78 -> v79.  GREEN ARMY abilities (roadmap 7a).

Every faction-exclusive entity gets one passive and one player toggle. This is
phase 1 of 4: Green only. Tan, Gray and Blue follow at v80/v81/v82.

Scope (approved):
  1. SARGE passive "Combat Veteran": regenerates SARGE_REGEN HP/sec once
     SARGE_CALM seconds have passed without taking damage. Sized under the Medic
     (2.089 HP/s) on purpose so a Medic is never made redundant.
  2. SARGE toggle "On Me!": +SARGE_AURA damage to allied INFANTRY within
     SARGE_AURA_R tiles, and Sarge's own damage is multiplied by SARGE_SELF
     while it runs. Approved to STACK with the Chinook aura (decision 3), so it
     is a second, independent multiplier in dmgBonus rather than a second row in
     the first-carrier-wins loop.
  3. MORTAR passive "Walking Fire": consecutive shells at the same target ramp
     +MORT_WF_STEP each, capped at +MORT_WF_CAP. Resets on target change.
  4. MORTAR toggle "Smoke Rounds": shells do no damage and leave a SMOKE_R-tile
     cloud for SMOKE_T seconds; friendly UNITS under it take SMOKE_RED less.
     While it runs the mortar acquires no enemies and instead shells the
     friendly unit that has been hit most recently inside its own range band.
  5. RADAR TENT passive: the existing 13-tile sight and minimap blips, named.
  6. RADAR TENT activated "Target Uplink": +UPLINK_RG range and +UPLINK_VI
     vision to all your units for UPLINK_T seconds, then UPLINK_CD cooldown.
     Delivered as rgOf()/viOf() accessors that every sim-side site routes
     through; v80's Pressure Valve needs the same accessor.
  7. AI policy for 2 and 6. NOT for 4: a support-fire policy is real work and is
     deferred rather than done badly.

New hashed state: u.calmT, u.onMe, u.smoke, u.wf, u.wfT on units; b.upT on
buildings; kind 'smoke' entries in the existing G.strikes list. All of it is
genuine sim state read by targeting or damage, so all of it is hashed and (via
_encGeneric) serialized. Pre-v79 saves get defaults in loadState.

WHY calmT AND NOT A TICK STAMP: "seconds since last damage" as a float that
accumulates dt is the burnT idiom, already hashed as a float. A tick stamp would
have needed a ticks-per-second token compared against G.tick, and the file has
three pre-existing bare /30 sites that would then all have wanted rerouting.
One field serves both windows: the mortar reads calmT<HURT_WINDOW, Sarge reads
calmT>=SARGE_CALM.

Every edit asserts an exact occurrence count and fails loudly on re-run.
"""
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else 'pw.html'
DST = sys.argv[2] if len(sys.argv) > 2 else SRC

src = open(SRC, encoding='utf-8').read()
EDITS = []
def ed(name, old, new, n=1):
    EDITS.append((name, old, new, n))

# =========================================================================
# GUARDS - trip on re-run, and on a source that is not v78.
# =========================================================================
GUARDS_PRESENT = [
    ("v78 sarge row",  "sarge:{n:'Sarge',a:'inf',hp:210,dm:15,rg:4.2,rt:.42,sp:2.6,vi:7,cp:260,ce:60,bt:16,w:'b',lim:1,tech:'u_sarge',d:'Hero commando (1 max)'}"),
    ("v78 mortar row", "mortar:{n:'Mortar Squad',a:'inf',hp:52,dm:36,rg:7.5,mrg:2,rt:3.4,sp:1.9,vi:6,cp:150,ce:0,bt:9,w:'m',spl:1.5,ex:1,tech:'u_mortar',d:'Long-range arcing shells'}"),
    ("v78 radar row",  "radar:{n:'Radar Tent',hp:420,sz:2,cp:200,ce:50,bt:10,vi:13,req:'barracks',tech:'b_radar',d:'Huge sight + enemy blips on minimap'}"),
    ("v78 dmgBonus",   "function dmgBonus(u){"),
]
GUARDS_ABSENT = [
    ("v79 constants", "const SARGE_AURA="),
    ("v79 accessors", "function rgOf(u)"),
    ("v79 smoke",     "kind:'smoke'"),
]

# =========================================================================
# 1. CONSTANTS.  Placed with the v69/v77 tunables, above HELP_TUNE, because the
#    help slots below read them and a const is in the temporal dead zone until
#    its own declaration runs - the same reason BARRAGE_N sits above
#    RADIO_ABILITIES.
# =========================================================================
ed('1a constants',
"const AI_RADIO_WAIT=8;     // v77: 25 -> 8 AI-ticks (~15s -> ~5s) before the charge goes to a paradrop instead\n",
"""const AI_RADIO_WAIT=8;     // v77: 25 -> 8 AI-ticks (~15s -> ~5s) before the charge goes to a paradrop instead
/* v79 GREEN ABILITIES. Phase 1 of the per-faction ability roadmap: every Green
   exclusive gets one passive and one toggle. Unlike the v69/v77 tunables above,
   these DO have entity state behind them (u.calmT / u.onMe / u.smoke / u.wf /
   u.wfT / b.upT), all hashed and serialized - see the makeUnit and hashState
   edits. The numbers themselves live here and nowhere else: the info cards, the
   panel buttons and the help slots all read these tokens, so a tuning pass moves
   one literal and every surface follows.

   SIZING NOTES, so the next pass knows what these were chosen against:
   SARGE_REGEN is deliberately under MEDIC_HEAL_RATE (2.089/s at v79), so the
   hero sustains himself between fights without displacing the Medic inside one.
   SARGE_AURA_R is 3 because a probe over 4 maps x 3 seeds put a mean of 1.15
   allied infantry inside 3 tiles of a live Sarge and 1.92 inside 5; 3 is a
   micro reward by construction, which is the intent.
   SMOKE_T is 5 against the mortar's 3.4s reload, so one mortar cannot keep a
   cloud standing by itself and two nearly can. */
const SARGE_AURA=0.30;     // "On Me!" damage bonus, allied infantry only
const SARGE_AURA_R=3;      // ...within this many tiles of Sarge
const SARGE_SELF=0.5;      // ...and Sarge's own damage is multiplied by this while it runs
const SARGE_REGEN=1.5;     // Combat Veteran: HP per second, once he has been calm for
const SARGE_CALM=8;        // ...this many seconds without taking a hit
const HURT_WINDOW=2;       // a unit counts as "under fire" for this many seconds after its last hit
const MORT_WF_STEP=0.08;   // Walking Fire: damage added per consecutive shell at one target
const MORT_WF_CAP=0.24;    // ...and the ceiling that ramp stops at
const SMOKE_R=2;           // smoke cloud radius in tiles
const SMOKE_T=5;           // ...and how many seconds it stands
const SMOKE_RED=0.20;      // damage reduction for friendly UNITS under a cloud (buildings are excluded)
const UPLINK_T=20;         // Target Uplink duration in seconds
const UPLINK_CD=120;       // ...and its cooldown, held on the Radar Tent's existing abilityCool
const UPLINK_RG=1;         // range added to every unit of the owning army while it runs
const UPLINK_VI=2;         // ...and vision
""")

# ---- help slots -----------------------------------------------------------
ed('1b help slots',
""" labBlds:()=>LAB_ORDER.filter(k=>k.indexOf('b_')===0&&!INFO_FEXCL_B.includes(k.slice(2))).map(k=>B[k.slice(2)].n).join(', ')
};""",
""" labBlds:()=>LAB_ORDER.filter(k=>k.indexOf('b_')===0&&!INFO_FEXCL_B.includes(k.slice(2))).map(k=>B[k.slice(2)].n).join(', '),
 /* v79: the Green ability numbers, so the help prose cannot drift from the
    constants the sim reads. Percentages are formatted here rather than in the
    markup for the same reason. */
 sargeAura:()=>Math.round(SARGE_AURA*100), sargeR:()=>SARGE_AURA_R,
 sargeSelf:()=>Math.round((1-SARGE_SELF)*100), sargeRegen:()=>SARGE_REGEN, sargeCalm:()=>SARGE_CALM,
 wfStep:()=>Math.round(MORT_WF_STEP*100), wfCap:()=>Math.round(MORT_WF_CAP*100),
 smokeR:()=>SMOKE_R, smokeT:()=>SMOKE_T, smokeRed:()=>Math.round(SMOKE_RED*100),
 upT:()=>UPLINK_T, upCd:()=>UPLINK_CD, upRg:()=>UPLINK_RG, upVi:()=>UPLINK_VI
};""")

# =========================================================================
# 2. TABLES.  Capability flags rather than key tests: the file already gates the
#    gunner on t.entrench and the Bull on t.sec, and the UI, the AI and the sim
#    all read the flag rather than naming the unit.
# =========================================================================
ed('2a sarge row',
"sarge:{n:'Sarge',a:'inf',hp:210,dm:15,rg:4.2,rt:.42,sp:2.6,vi:7,cp:260,ce:60,bt:16,w:'b',lim:1,tech:'u_sarge',d:'Hero commando (1 max)'}",
"sarge:{n:'Sarge',a:'inf',hp:210,dm:15,rg:4.2,rt:.42,sp:2.6,vi:7,cp:260,ce:60,bt:16,w:'b',lim:1,rally:1,regen:1,tech:'u_sarge',"
"d:`Hero commando (1 max). Heals ${SARGE_REGEN} HP/s after ${SARGE_CALM}s out of contact; \"On Me!\" gives allied infantry within ${SARGE_AURA_R} tiles +${Math.round(SARGE_AURA*100)}% damage for half his own`}")

ed('2b mortar row',
"mortar:{n:'Mortar Squad',a:'inf',hp:52,dm:36,rg:7.5,mrg:2,rt:3.4,sp:1.9,vi:6,cp:150,ce:0,bt:9,w:'m',spl:1.5,ex:1,tech:'u_mortar',d:'Long-range arcing shells'}",
"mortar:{n:'Mortar Squad',a:'inf',hp:52,dm:36,rg:7.5,mrg:2,rt:3.4,sp:1.9,vi:6,cp:150,ce:0,bt:9,w:'m',spl:1.5,ex:1,wf:1,smokeCap:1,tech:'u_mortar',"
"d:`Long-range arcing shells. Consecutive shells on one target ramp +${Math.round(MORT_WF_STEP*100)}% each to +${Math.round(MORT_WF_CAP*100)}%; "
"Smoke Rounds shell friendlies instead, cutting damage taken by ${Math.round(SMOKE_RED*100)}%`}")

ed('2c radar row',
"radar:{n:'Radar Tent',hp:420,sz:2,cp:200,ce:50,bt:10,vi:13,req:'barracks',tech:'b_radar',d:'Huge sight + enemy blips on minimap'}",
"radar:{n:'Radar Tent',hp:420,sz:2,cp:200,ce:50,bt:10,vi:13,req:'barracks',tech:'b_radar',uplink:1,"
"d:`Huge sight + enemy blips on minimap. Target Uplink: +${UPLINK_RG} range and +${UPLINK_VI} sight to your whole army for ${UPLINK_T}s`}")

# =========================================================================
# 3. ENTITY STATE.  calmT is seconds-since-damage and rides the burnT idiom (a
#    hashed float advanced by dt), which is why nothing here needs a tick rate.
#    The three ability fields are written only onto units whose TABLE carries the
#    capability, exactly as v51 did for salv/cool2, so a match with no Sarge and
#    no mortar snapshots byte-identically to v78 apart from calmT.
# =========================================================================
ed('3a makeUnit fields',
"""  // v29: order queue / patrol loop / hold-position / veterancy (kills, rank)
  oq:[],patrol:null,hold:false,kl:0,vr:0};""",
"""  // v29: order queue / patrol loop / hold-position / veterancy (kills, rank)
  oq:[],patrol:null,hold:false,kl:0,vr:0,
  /* v79: seconds since this unit last took damage. Every unit carries it because
     both readers are cross-unit - Sarge's regen reads his own, and a smoking
     mortar reads its neighbours' to find who is under fire. Clamped so it cannot
     drift off into a float where +dt stops changing it. */
  calmT:0};""")

ed('3b makeUnit ability fields',
""" if(t.sal)u.salv=t.sal;
 if(t.sec){u.cool2=0;u.target2=null;}""",
""" if(t.sal)u.salv=t.sal;
 if(t.sec){u.cool2=0;u.target2=null;}
 // v79: ability state, written only onto tables that carry the capability
 if(t.rally)u.onMe=false;
 if(t.smokeCap)u.smoke=false;
 if(t.wf){u.wf=0;u.wfT=0;}""")

ed('3c makeBuilding field',
"  queue:[],prodT:0,cool:0,abilityCool:0,tface:0,",
"  queue:[],prodT:0,cool:0,abilityCool:0,upT:0,/* v79: upT is the Target Uplink's REMAINING duration; abilityCool stays its cooldown */tface:0,")

# =========================================================================
# 4. THE UPLINK ACCESSORS.  Range and vision were read raw off the table at
#    every sim site; an army-wide modifier has to go through one door or it will
#    apply in three places and not the fourth. rgOf/viOf are that door, and v80's
#    Pressure Valve (+1 range on the Flamethrower) needs the same one.
#    Guarded on a zero base: a Dump Truck has rg 0 and must not gain a weapon,
#    and G.neutral has no buildings so wildlife is never uplinked.
# =========================================================================
ed('4a accessors',
"""// is a target within the entrench cone? half-angle 50\u00b0 => 100\u00b0 total, centered on coneDir.""",
"""/* --- TARGET UPLINK ---
   v79. True while any completed Radar Tent of this army is running its uplink. The
   scan mirrors the Munitions Dump read in dmgBonus: a short walk over one
   player's own building list, reading hashed state only. */
function upOn(p){
 if(!p||!p.blds)return false;
 for(const b of p.blds)if(b.t.uplink&&b.upT>0&&b.prog>=1&&b.hp>0)return true;
 return false;
}
/* Effective range and sight for a unit. Every sim-side reader goes through
   these two. A zero base stays zero, so an unarmed hull cannot be handed a
   weapon range and a sightless entity cannot be handed vision. */
function rgOf(u){const r=(u.t.rg||0);return r>0&&upOn(u.p)?r+UPLINK_RG:r;}
function viOf(u){const v=(u.t.vi||0);return v>0&&upOn(u.p)?v+UPLINK_VI:v;}
// is a target within the entrench cone? half-angle 50\u00b0 => 100\u00b0 total, centered on coneDir.""")

# ---- route every sim-side range/vision read -------------------------------
ed('4b entrench cone acquire',
"   if(G.tick%4===u.id%4)u.target=nearestEnemyCone(u,t.vi);",
"   if(G.tick%4===u.id%4)u.target=nearestEnemyCone(u,viOf(u));")
ed('4c entrench fire range',
"   if(d<=t.rg&&inCone(u,tgt.x,tgt.y)){u.tface=datan2(tgt.y-u.y,tgt.x-u.x);if(u.cool<=0)fireAt(u,tgt);}",
"   if(d<=rgOf(u)&&inCone(u,tgt.x,tgt.y)){u.tface=datan2(tgt.y-u.y,tgt.x-u.x);if(u.cool<=0)fireAt(u,tgt);}")
ed('4d idle sighting',
"   if(t.dm&&G.tick%10===u.id%10){const e=nearestEnemy(u,u.hold?Math.min(t.vi,t.rg):t.vi);if(e){u.target=e;u.state='attack';u.anchor={x:u.x,y:u.y}}} // v29: held units only sight what they can shoot",
"   if(t.dm&&!u.smoke&&G.tick%10===u.id%10){const e=nearestEnemy(u,u.hold?Math.min(viOf(u),rgOf(u)):viOf(u));if(e){u.target=e;u.state='attack';u.anchor={x:u.x,y:u.y}}} // v29: held units only sight what they can shoot. v79: a smoking mortar acquires no enemies at all")
ed('4e amove sighting',
"   if(t.dm&&G.tick%6===u.id%6){const e=nearestEnemy(u,t.vi);if(e){u.savedDest=u.dest;u.target=e;u.state='attack';break}}",
"   if(t.dm&&!u.smoke&&G.tick%6===u.id%6){const e=nearestEnemy(u,viOf(u));if(e){u.savedDest=u.dest;u.target=e;u.state='attack';break}}")
ed('4f attack range',
"   const rg=u.key==='para'?paraMun(tgt).rg:t.rg; // v30: paratrooper range follows the selected munition",
"   const rg=u.key==='para'?paraMun(tgt).rg:rgOf(u); // v30: paratrooper range follows the selected munition. v79: everything else follows the uplink")
ed('4g pVision unit sight',
"  for(const u of q.units){if(u.garrisoned)continue;const vi=u.t.vi||0;if((u.x-x)**2+(u.y-y)**2<=vi*vi)return true;}",
"  for(const u of q.units){if(u.garrisoned)continue;const vi=viOf(u);if((u.x-x)**2+(u.y-y)**2<=vi*vi)return true;}")
ed('4h fog stamp',
"  for(const u of pl.units)if(!u.garrisoned)stamp(u.x,u.y,u.t.vi); // v66: no code-1 vision clamp; tall grass is gone",
"  for(const u of pl.units)if(!u.garrisoned)stamp(u.x,u.y,viOf(u)); // v66: no code-1 vision clamp; tall grass is gone. v79: the uplink widens the fog reveal too, or the player could not see what the extra range bought")
ed('4i call-for-help radius',
"   const da2=(attacker.x-tgt.x)**2+(attacker.y-tgt.y)**2,vr=tgt.t.vi+2;",
"   const da2=(attacker.x-tgt.x)**2+(attacker.y-tgt.y)**2,vr=viOf(tgt)+2;")
ed('4j entrench cone draw',
"if(u.t&&u.t.entrench&&u.entrenched){drawGroundCone(c,u.x,u.y,u.coneDir,u.t.rg,CONE_HALF,FAC[u.p.fac].color,.16);}",
"if(u.t&&u.t.entrench&&u.entrenched){drawGroundCone(c,u.x,u.y,u.coneDir,rgOf(u),CONE_HALF,FAC[u.p.fac].color,.16);}")

# =========================================================================
# 5. DAMAGE.  Two edits at the one defender-side choke point: the calmT reset
#    that both Green passives read, and the smoke reduction.
#    Smoke multiplies with the APC shield rather than replacing it. They are
#    independent sources and the file's existing pair (dump aura, transport
#    aura) already stacks that way.
# =========================================================================
ed('5a applyDmg smoke + calmT',
""" if(tgt.kind==='unit'&&tgt.t){
  if(tgt.t.shield)amt*=.75;
  else if(tgt.t.a==='inf'&&!tgt.garrisoned){
   for(const c of G.units){if(c.t.shield&&c.hp>0&&allied(c.p,tgt.p)&&(c.x-tgt.x)**2+(c.y-tgt.y)**2<=9){amt*=.75;break}}
  }
 }
 tgt.hp-=amt;tgt.lastHit=type;""",
""" if(tgt.kind==='unit'&&tgt.t){
  if(tgt.t.shield)amt*=.75;
  else if(tgt.t.a==='inf'&&!tgt.garrisoned){
   for(const c of G.units){if(c.t.shield&&c.hp>0&&allied(c.p,tgt.p)&&(c.x-tgt.x)**2+(c.y-tgt.y)**2<=9){amt*=.75;break}}
  }
  /* v79 SMOKE. Friendly UNITS only, by decision: a cloud over a building does
     nothing. Clouds never stack with each other (first one wins, as the auras
     do), but this DOES multiply with the APC shield above - two independent
     sources, the same way the dump aura and the transport aura already stack on
     the attacker side. s.pi rather than s.owner because a strike outlives the
     mortar that fired it and loadState resolves a dead owner to null. */
  if(!tgt.garrisoned)for(const s of (G.strikes||[])){
   if(s.kind!=='smoke')continue;
   const sp=G.players[s.pi];
   if(!sp||!allied(sp,tgt.p))continue;
   if((s.x-tgt.x)**2+(s.y-tgt.y)**2<=SMOKE_R*SMOKE_R){amt*=(1-SMOKE_RED);break}
  }
 }
 tgt.hp-=amt;tgt.lastHit=type;
 // v79: seconds-since-damage, read by Sarge's regen and by a smoking mortar's target pick
 if(tgt.kind==='unit')tgt.calmT=0;""")

# =========================================================================
# 5b. THE TWO OTHER DOORS INTO TARGETING.
#     4d and 4e closed the idle and attack-move sighting against a smoking
#     mortar, but they are not the only ways a unit is handed an enemy. Two
#     more sit inside applyDmg, and BOTH already carry an `entrenched`
#     exclusion, which is the precedent this rides: an entrenched gunner has
#     opted out of ordinary target assignment and so has a smoking tube.
#     Found by T53.D2, which watched a smoking mortar get swept into a
#     firefight by the call-for-help block and start lobbing zero-damage
#     rounds at the enemy - the worst of both modes.
# =========================================================================
ed('5b1 retaliation skips a smoking tube',
"  if(tgt.kind==='unit'&&tgt.p.ai&&tgt.t.dm&&tgt.key!=='truck'&&!tgt.garrisoned&&!tgt.entrenched&&!tgt.aiRole&&tgt.hp>0",
"  if(tgt.kind==='unit'&&tgt.p.ai&&tgt.t.dm&&tgt.key!=='truck'&&!tgt.garrisoned&&!tgt.entrenched&&!tgt.smoke&&!tgt.aiRole&&tgt.hp>0")

ed('5b2 the help sweep skips a smoking tube',
"    if(v===tgt||v.garrisoned||v.entrenched||v.hold||v.aiRole||!v.t.dm||v.key==='truck')continue; // v29: held units stay put",
"    if(v===tgt||v.garrisoned||v.entrenched||v.smoke||v.hold||v.aiRole||!v.t.dm||v.key==='truck')continue; // v29: held units stay put. v79: a smoking mortar has opted out of enemy targeting exactly as an entrenched gunner has")

# =========================================================================
# 6. THE SARGE AURA.  A SECOND multiplier rather than another row in the
#    transport loop, because decision 3 approved it to STACK with the Chinook.
#    Non-stacking against itself (first Sarge wins) - only one army can field
#    one, but an allied pair must not double up either.
# =========================================================================
ed('6a dmgBonus',
""" if(u.t.a==='inf'){
  for(const v of G.units){
   if(!v.t.aura||v.hp<=0||v.garrisoned||!allied(v.p,u.p))continue;
   const R=v.t.auraR;
   if((v.x-u.x)**2+(v.y-u.y)**2<=R*R){m*=1+v.t.aura;break} // first carrier wins: the aura never stacks
  }
 }
 return m;""",
""" if(u.t.a==='inf'){
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
 if(u.t.rally&&u.onMe)m*=SARGE_SELF; // the price of the broadcast, paid by the man making it
 return m;""")

# =========================================================================
# 7. PER-TICK UNIT WORK.  calmT accumulation, Sarge's regen, and the smoking
#    mortar's own fire loop.
#    The smoke loop is modelled on updateSec: it runs BEFORE the state switch
#    and does NOT return, so a smoking mortar still walks, still takes move
#    orders and still holds position. It shares u.cool with the normal weapon,
#    so it cannot fire twice per reload.
# =========================================================================
ed('7a calmT + regen',
""" // ---- v51 SECONDARY WEAPON: runs in EVERY state, so the Bull torches infantry
 // while its cannon keeps engaging whatever the main targeting picked. ----
 if(t.sec)updateSec(u,dt);""",
""" /* --- v79: seconds since this unit was last hit ---
    Reset to 0 by applyDmg. Clamped at 999 rather than left to grow, because a
    long match would otherwise walk it into the float range where +dt stops
    changing the value, and a hashed field that silently stops advancing is a
    lockstep divergence waiting to happen. Nothing reads a value that large:
    the two windows are SARGE_CALM and HURT_WINDOW. */
 if(u.calmT<999)u.calmT+=dt;
 /* --- v79 COMBAT VETERAN ---
    Sarge alone carries t.regen. Deliberately below MEDIC_HEAL_RATE so a Medic
    is still worth bringing; this is between-fight sustain for a unit that is
    capped at one and takes 16 build-seconds to replace. */
 if(t.regen&&u.hp>0&&u.hp<u.mhp&&u.calmT>=SARGE_CALM)u.hp=Math.min(u.mhp,u.hp+SARGE_REGEN*dt);
 // --- v79 SMOKE ROUNDS: support fire, in every state, like the secondary below ---
 if(u.smoke)updateSmoke(u,dt);
 // ---- v51 SECONDARY WEAPON: runs in EVERY state, so the Bull torches infantry
 // while its cannon keeps engaging whatever the main targeting picked. ----
 if(t.sec)updateSec(u,dt);""")

# ---- the smoke fire loop, parked next to updateSec ------------------------
ed('7b updateSmoke',
"""function fireAt(u,tgt){
 // v30: the paratrooper swaps munitions with the target class (SMG / AT grenade / HE charge)""",
"""/* --- SMOKE ROUNDS ---
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
 // v30: the paratrooper swaps munitions with the target class (SMG / AT grenade / HE charge)""")

# =========================================================================
# 8. FIRING.  Walking Fire rides the damage line; the smoke shell rides the
#    mortar's own projectile branch.
# =========================================================================
ed('8a walking fire',
" const dm=u.dm*dmgBonus(u)*(M?M.k:1);",
""" /* --- v79 WALKING FIRE ---
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
 const dm=u.dm*dmgBonus(u)*(M?M.k:1)*wfM;""")

ed('8b smoke shell',
"  G.projs.push({x:mx,y:my,z:gz,tx:tgt.x,ty:tgt.y,tgt:(w==='r'||w==='a')?tgt:null,sp:w==='m'?7:(w==='a'?13:11),dm,spl:u.t.spl||0,type:'ex',owner:u,wc,arc:w==='m',cls:w==='m'?'mortar':((w==='r'||w==='a')?'rocket':'shell'),cal:u.t.big?1.5:(u.t.a==='inf'?0.8:1.1),travel:0,total:dhyp(tgt.x-u.x,tgt.y-u.y),trail:w!=='m'});",
"""  /* v79: a smoke round is the same arcing shell with its damage taken off and a
     smoke:1 tag on it; updateProjs raises a cloud instead of calling splash. The
     projectile is otherwise identical so the flight, the arc and the lead all
     behave exactly as a live shell does. */
  const sm=!!u.smoke;
  G.projs.push({x:mx,y:my,z:gz,tx:tgt.x,ty:tgt.y,tgt:(w==='r'||w==='a')?tgt:null,sp:w==='m'?7:(w==='a'?13:11),dm:sm?0:dm,spl:sm?0:(u.t.spl||0),smoke:sm?1:0,pi:u.p.i,type:'ex',owner:u,wc,arc:w==='m',cls:w==='m'?'mortar':((w==='r'||w==='a')?'rocket':'shell'),cal:u.t.big?1.5:(u.t.a==='inf'?0.8:1.1),travel:0,total:dhyp(tgt.x-u.x,tgt.y-u.y),trail:w!=='m'});""")

ed('8c smoke impact',
"  if(d<=step||d<.15){G.projs.splice(i,1);splash(p.tx,p.ty,Math.max(p.spl,.3),p.dm,'ex',p.owner,p.wc);sfxBoom(p.tx,p.ty,p.spl>1?'big':(p.spl>0?'med':'small'));}",
"""  if(d<=step||d<.15){
   G.projs.splice(i,1);
   /* v79: a smoke round raises a cloud and does no damage at all - not reduced
      damage, none. It carries pi rather than leaning on p.owner because the
      cloud outlives the tube that fired it. */
   if(p.smoke){G.strikes.push({kind:'smoke',owner:p.owner,pi:p.pi,x:p.tx,y:p.ty,t:0});spawnSmoke(p.tx,p.ty,18,{rise:3,grow:16,life:SMOKE_T,r:9,col:'#d8d8d4'});sfxBoom(p.tx,p.ty,'small');}
   else{splash(p.tx,p.ty,Math.max(p.spl,.3),p.dm,'ex',p.owner,p.wc);sfxBoom(p.tx,p.ty,p.spl>1?'big':(p.spl>0?'med':'small'));}
  }""")

ed('8d smoke ages out',
"""  } else if(s.kind==='paradrop'){
   for(const d of s.drops){if(!d.done && s.t>=d.delay){d.done=true;dropTrooper(s.owner.p,d.x,d.y);}}
   if(s.drops.every(d=>d.done))G.strikes.splice(i,1);
  }""",
"""  } else if(s.kind==='paradrop'){
   for(const d of s.drops){if(!d.done && s.t>=d.delay){d.done=true;dropTrooper(s.owner.p,d.x,d.y);}}
   if(s.drops.every(d=>d.done))G.strikes.splice(i,1);
  } else if(s.kind==='smoke'){
   /* v79: the cloud is pure duration - applyDmg reads its position while it is
      in the list and it leaves when SMOKE_T is up. The drifting puff on top of
      it is particles, spawned once at impact and not tracked here. */
   if(s.t>=SMOKE_T)G.strikes.splice(i,1);
   else if(Math.random()<dt*1.6)spawnSmoke(s.x+(Math.random()-.5)*SMOKE_R,s.y+(Math.random()-.5)*SMOKE_R,4,{rise:2,grow:9,life:2.2,r:6,col:'#cfcfca'});
  }""")

# =========================================================================
# 9. COMMANDS.  Three new cases beside the entrench pair they are modelled on.
#    Both unit toggles are plain state flips with no aiming step, unlike
#    entrench: nothing about them needs a direction, so nothing about them
#    should ask for a click.
# =========================================================================
ed('9a commands',
"""  case 'radio':{ // v30: call-downs are issued by the Radio Tower building""",
"""  case 'onme':{ // v79: Sarge's broadcast. No aim step - it is a radius, not an arc
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
   if(p===G.human){msg(`Target uplink online \u2014 +${UPLINK_RG} range, +${UPLINK_VI} sight for ${UPLINK_T}s.`);lastSelSig='';}
   break}
  case 'radio':{ // v30: call-downs are issued by the Radio Tower building""")

# ---- the uplink has to expire, and it expires in the sim -------------------
ed('9b uplink tick',
" if(b.abilityCool>0)b.abilityCool-=dt; // v30.1: tick the shared call-down on EVERY building - the Radio Tower is neither a guardtower nor a garrisoned bunker, so inside the branch below it never recharged after the first use",
""" if(b.abilityCool>0)b.abilityCool-=dt; // v30.1: tick the shared call-down on EVERY building - the Radio Tower is neither a guardtower nor a garrisoned bunker, so inside the branch below it never recharged after the first use
 /* v79: the uplink's REMAINING duration, ticked out here for the same reason the
    cooldown above is - the Radar Tent falls into neither branch below, so a timer
    parked inside one would never run out. Two timers, not one: abilityCool is the
    wait before the next use and upT is how long this use has left. */
 if(b.upT>0)b.upT-=dt;""")

# =========================================================================
# 10. HASHED STATE + LOAD DEFAULTS.
#     The strike hash still takes kind and t only, matching v30: a smoke cloud's
#     position is derived from the shell that raised it and the shell's flight
#     is already covered by the projectile hash.
# =========================================================================
ed('10a hashState units',
"h=hF(h,u.burnT||0);h=hI(h,u.salv||0);h=hF(h,u.cool2||0)} // v51: salvo counter & secondary cooldown are sim state",
"h=hF(h,u.burnT||0);h=hI(h,u.salv||0);h=hF(h,u.cool2||0);h=hF(h,u.calmT||0);h=hI(h,u.onMe?1:0);h=hI(h,u.smoke?1:0);h=hI(h,u.wf||0);h=hI(h,u.wfT||0)} // v51: salvo counter & secondary cooldown are sim state. v79: calm timer, the two Green toggles and the Walking Fire streak")

ed('10b hashState blds',
"h=hI(h,b.garrison.length);h=hF(h,b.abilityCool||0);h=hF(h,b.burnT||0)} // v30: tower cooldown is sim state",
"h=hI(h,b.garrison.length);h=hF(h,b.abilityCool||0);h=hF(h,b.burnT||0);h=hF(h,b.upT||0)} // v30: tower cooldown is sim state. v79: so is the uplink's remaining duration")

ed('10c load defaults',
" G.blds=S.blds.map(o=>{const b=decEnt(o);b.t=B[b.key];if(b.abilityCool==null)b.abilityCool=0;return b}); // v30: pre-v30 saves get the cooldown default",
" G.blds=S.blds.map(o=>{const b=decEnt(o);b.t=B[b.key];if(b.abilityCool==null)b.abilityCool=0;if(b.upT==null)b.upT=0;return b}); // v30: pre-v30 saves get the cooldown default. v79: and the uplink timer")

ed('10d load unit defaults',
"if(!u.oq)u.oq=[];if(u.hold==null)u.hold=false;if(u.kl==null)u.kl=0;if(u.vr==null)u.vr=0;return u}); // v29: pre-v29 saves get queue/hold/vet defaults",
"if(!u.oq)u.oq=[];if(u.hold==null)u.hold=false;if(u.kl==null)u.kl=0;if(u.vr==null)u.vr=0;"
"if(u.calmT==null)u.calmT=0;if(u.t.rally&&u.onMe==null)u.onMe=false;if(u.t.smokeCap&&u.smoke==null)u.smoke=false;if(u.t.wf&&u.wf==null){u.wf=0;u.wfT=0}"
"return u}); // v29: pre-v29 saves get queue/hold/vet defaults. v79: and the ability fields, which a pre-v79 save has none of")

# =========================================================================
# 11. SELECTION PANEL.  The signature has to carry the new modes or the panel
#     will not repaint when one is toggled - the same reason the entrench state
#     is in there twice (single and group).
# =========================================================================
ed('11a sel signature',
""" if(G.sel.length===1){const e=G.sel[0];if(e.kind==='unit'&&e.t.entrench)sig+='|e'+(e.entrenched?1:0);}""",
""" if(G.sel.length===1){const e=G.sel[0];if(e.kind==='unit'&&e.t.entrench)sig+='|e'+(e.entrenched?1:0);}
 // v79: the two Green unit toggles, and the Radar Tent's two timers
 if(G.sel.length===1){const e=G.sel[0];
  if(e.kind==='unit'&&e.t.rally)sig+='|om'+(e.onMe?1:0);
  if(e.kind==='unit'&&e.t.smokeCap)sig+='|sm'+(e.smoke?1:0);
  if(e.kind==='bld'&&e.t.uplink)sig+='|up'+Math.ceil(e.upT||0)+'_'+Math.ceil(e.abilityCool||0);
 }""")

ed('11b group signature',
""" if(G.sel.length>1)for(const e of G.sel)if(e.kind==='unit'&&e.t.entrench)sig+='|ge'+e.id+(e.entrenched?1:0);""",
""" if(G.sel.length>1)for(const e of G.sel)if(e.kind==='unit'&&e.t.entrench)sig+='|ge'+e.id+(e.entrenched?1:0);
 // v79: mortars toggle as a group too, so their modes ride the signature the same way
 if(G.sel.length>1)for(const e of G.sel)if(e.kind==='unit'&&e.t.smokeCap)sig+='|gs'+e.id+(e.smoke?1:0);""")

ed('11c status tag',
"  if(e.kind==='unit'&&e.t.entrench&&e.entrenched)extra=' \u2014 ENTRENCHED';",
"""  if(e.kind==='unit'&&e.t.entrench&&e.entrenched)extra=' \u2014 ENTRENCHED';
  if(e.kind==='unit'&&e.t.rally&&e.onMe)extra+=' \u2014 RALLYING'; // v79
  if(e.kind==='unit'&&e.t.smokeCap&&e.smoke)extra+=' \u2014 SMOKE ROUNDS'; // v79
  if(e.kind==='bld'&&e.t.uplink&&e.upT>0)extra+=` \u2014 UPLINK ${Math.ceil(e.upT)}s`; // v79""")

# ---- the three buttons ----------------------------------------------------
ed('11d single-unit buttons',
"""  // ---- v30 APC: troop bay readout + unload ----""",
"""  /* --- v79 SARGE: the "On Me!" broadcast ---
     Every number in the label reads the constants, so a tuning pass moves one
     literal and the button follows. No aim step: this is a radius. */
  if(e.kind==='unit'&&e.p===G.human&&e.t.rally){
   const bt=document.createElement('button');bt.className='bb'+(e.onMe?' sel':'');
   bt.innerHTML=`<b>${e.onMe?'Stand Down':'On Me!'}</b><br><span style="font-size:10px;opacity:.75">+${Math.round(SARGE_AURA*100)}% damage to infantry within ${SARGE_AURA_R}, \u2212${Math.round((1-SARGE_SELF)*100)}% his own</span>`;
   bt.title=`Allied infantry within ${SARGE_AURA_R} tiles hit ${Math.round(SARGE_AURA*100)}% harder while Sarge broadcasts. His own damage is cut ${Math.round((1-SARGE_SELF)*100)}% for as long as it runs.`;
   bt.onclick=()=>{submitCmd('onme',{ids:[e.id],on:!e.onMe});sClick();};
   pb.appendChild(bt);
  }
  // --- v79 MORTAR: ammunition select ---
  if(e.kind==='unit'&&e.p===G.human&&e.t.smokeCap){
   const bt=document.createElement('button');bt.className='bb'+(e.smoke?' sel':'');
   bt.innerHTML=`<b>${e.smoke?'High Explosive':'Smoke Rounds'}</b><br><span style="font-size:10px;opacity:.75">\u2212${Math.round(SMOKE_RED*100)}% damage taken under a ${SMOKE_R}-tile cloud, ${SMOKE_T}s</span>`;
   bt.title=`Smoke rounds do no damage. The tube shells whichever friendly unit near it is under fire, and anything of yours inside the cloud takes ${Math.round(SMOKE_RED*100)}% less for ${SMOKE_T} seconds.`;
   bt.onclick=()=>{submitCmd('smoke',{ids:[e.id],on:!e.smoke});sClick();};
   pb.appendChild(bt);
  }
  // ---- v30 APC: troop bay readout + unload ----""")

ed('11e radar button',
"""  if(e.kind==='bld'&&e.p.human&&e.prog>=1){
   // ---- v71 CONSTRUCT: the retired standing panel, rehomed under the HQ and,""",
"""  /* --- v79 RADAR TENT: Target Uplink ---
     Sits in the selection panel rather than the Radio Tower's fixed side panel:
     that panel is the call-down rig and is keyed to t.radio, and a second
     always-on rail for a second building would crowd the right edge. */
  if(e.kind==='bld'&&e.p===G.human&&e.t.uplink&&e.prog>=1){
   const ready=(e.abilityCool||0)<=0, live=(e.upT||0)>0;
   const bt=document.createElement('button');bt.className='bb'+(live?' sel':'');
   bt.innerHTML=`<b>Target Uplink</b><br><span style="font-size:10px;opacity:.75">${live?Math.ceil(e.upT)+'s remaining':(ready?`+${UPLINK_RG} range, +${UPLINK_VI} sight, ${UPLINK_T}s`:Math.ceil(e.abilityCool)+'s cooldown')}</span>`;
   bt.title=`Every unit in your army gains +${UPLINK_RG} tile of range and +${UPLINK_VI} tiles of sight for ${UPLINK_T} seconds. ${UPLINK_CD}-second cooldown.`;
   if(!ready)bt.classList.add('dis');
   bt.onclick=()=>{if((e.abilityCool||0)>0){msg(`Uplink recharging \u2014 ${Math.ceil(e.abilityCool)}s.`);return}submitCmd('uplink',{bid:e.id});sClick();};
   pb.appendChild(bt);
  }
  if(e.kind==='bld'&&e.p.human&&e.prog>=1){
   // ---- v71 CONSTRUCT: the retired standing panel, rehomed under the HQ and,""")

ed('11g mortar group toggle',
"""    else{G.radioTargeting={unit:gunners[0],mode:'entrench',group:gunners};msg('Click to aim the entrench cone for the group.');sClick();}
   };
   pb.appendChild(bt);
  }
 }
}""",
"""    else{G.radioTargeting={unit:gunners[0],mode:'entrench',group:gunners};msg('Click to aim the entrench cone for the group.');sClick();}
   };
   pb.appendChild(bt);
  }
  /* v79: mortars in a mixed group switch ammunition together. Same shape as the
     gunner block above, including the p===G.human gate that keeps it off a
     spectator's panel. Any mortar already smoking flips the whole group back to
     high explosive, so the button is never ambiguous about what it will do. */
  const tubes=G.watch?[]:G.sel.filter(s=>s.kind==='unit'&&s.p===G.human&&s.t.smokeCap);
  if(tubes.length){
   const anySm=tubes.some(g=>g.smoke);
   const bt=document.createElement('button');bt.className='bb'+(anySm?' sel':'');
   bt.innerHTML=`<b>${anySm?'High Explosive':'Smoke Rounds'} (${tubes.length})</b><br><span style="font-size:10px;opacity:.75">\u2212${Math.round(SMOKE_RED*100)}% damage taken under the cloud</span>`;
   bt.title='Switch the selected mortars between high explosive and smoke.';
   bt.onclick=()=>{submitCmd('smoke',{ids:tubes.map(g=>g.id),on:!anySm});sClick();};
   pb.appendChild(bt);
  }
 }
}""")

# =========================================================================
# 12. THE GLOW.  Modelled on the medic's heal glow a few lines above it, which
#     is the same shape of question: "is this unit currently being helped by
#     something else". Render-only, keyed on G.tick for the pulse, so nothing
#     new is hashed and nothing new is serialized.
# =========================================================================
ed('12a rally glow',
""" // entrench cone: a translucent ground wedge showing the gunner's locked firing arc""",
""" /* v79 "ON ME!" GLOW: a soft green pulse under any infantryman currently inside
    a broadcasting Sarge's radius. Read live rather than stamped on the unit
    (which is what healedAt does) because the buff is a position test that can
    stop being true between frames with nothing written anywhere. Sarge himself
    is excluded: he is paying for this, not receiving it. */
 if(u.t.a==='inf'&&!u.t.rally&&!u.garrisoned&&rallied(u)){
  const rp=.55+.45*Math.sin(G.tick*.32+u.id);
  c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.32*rp;
  const gy2=sy-gz-4;
  const g2=c.createRadialGradient(sx,gy2,1,sx,gy2,15);
  g2.addColorStop(0,'rgba(140,255,140,.5)');g2.addColorStop(.55,'rgba(76,220,90,.24)');g2.addColorStop(1,'rgba(76,220,90,0)');
  c.fillStyle=g2;c.beginPath();c.ellipse(sx,gy2,15,9,0,0,7);c.fill();
  c.restore();c.globalAlpha=1;
 }
 // entrench cone: a translucent ground wedge showing the gunner's locked firing arc""")

ed('12b rallied predicate',
"""function drawUnit(c,u){""",
"""/* v79: is this unit inside a broadcasting Sarge's radius? The renderer's read of
   exactly the test dmgBonus makes, kept as one function so the glow can never
   show up on a unit that is not actually getting the damage. */
function rallied(u){
 if(!u.p||u.hp<=0)return false;
 for(const v of G.units){
  if(!v.t.rally||!v.onMe||v.hp<=0||v.garrisoned||v===u||!allied(v.p,u.p))continue;
  if((v.x-u.x)**2+(v.y-u.y)**2<=SARGE_AURA_R*SARGE_AURA_R)return true;
 }
 return false;
}
function drawUnit(c,u){""")

# =========================================================================
# 13. AI POLICY.  Without this the Green bot is strictly worse at v79 than it
#     was at v78, because the human gains two abilities and it gains none.
#     Smoke Rounds are deliberately NOT wired: a support-fire policy is real
#     work and a bad one would have mortars shelling their own line instead of
#     the enemy. Green bots keep firing high explosive until that lands.
# =========================================================================
ed('13a ai green abilities',
""" // ---- v33: survival - keep the army home near the central defend point ----""",
""" /* --- v79: Sarge broadcasts only when the broadcast actually pays ---
    DERIVED, not a headcount. The first cut of this used "two allied infantry in
    radius", on the reasoning that two men at +30% out-earn the half share Sarge
    gives up. That reasoning was simply wrong, and measuring it is what showed
    it: Sarge gives up 7.20 DPS, a grunt gains 0.91, so the real break-even is
    EIGHT grunts - or 2.5 gunners, or 2.3 flamers, because it depends entirely
    on what is standing there. A fixed count cannot express that, so the bot
    compares the two sides directly. unitDPS is the same salvo-aware figure the
    info card and aiPickUnit read, so this cannot drift from what the shop says.
    CONSEQUENCE, recorded rather than tuned around: bots hold a mean of 1.15
    infantry inside 3 tiles, so a CPU Sarge will broadcast rarely and only into
    a real clump. That is the honest reading of the ability as specified. */
 for(const u of readyArmy){
  if(!u.t.rally||u.garrisoned)continue;
  const lost79=unitDPS(u.t)*(1-SARGE_SELF);
  let gain79=0;
  for(const v of p.units){
   if(v===u||v.hp<=0||v.garrisoned||v.t.a!=='inf')continue;
   if((v.x-u.x)**2+(v.y-u.y)**2<=SARGE_AURA_R*SARGE_AURA_R)gain79+=unitDPS(v.t)*SARGE_AURA;
  }
  u.onMe=gain79>lost79;
 }
 /* --- v79: the Radar Tent fires its uplink when the army is actually in a
    fight. "Under fire" is read off calmT, the same field the mortar reads, so
    the bot needs no new state and no new cadence of its own. Three units taking
    hits inside HURT_WINDOW is a firefight; one is a scout being shot at. */
 const rad79=p.blds.find(b=>b.t.uplink&&b.prog>=1&&b.hp>0&&b.abilityCool<=0&&b.upT<=0);
 if(rad79){
  let hit79=0;
  for(const u of p.units)if(u.hp>0&&!u.garrisoned&&u.calmT<HURT_WINDOW)hit79++;
  if(hit79>=3){rad79.upT=UPLINK_T;rad79.abilityCool=(G&&G.test)?0:UPLINK_CD;}
 }

 // ---- v33: survival - keep the army home near the central defend point ----""")

# =========================================================================
# 14. HELP PROSE.  Every number is a slot, never a literal: the Green paragraph
#     is exactly the kind of text that goes stale on the next tuning pass.
# =========================================================================
ed('14a help paragraph',
"""  <b>APC</b> (Garage): unarmed transport carrying 10 infantry""",
"""  <b>Green Army exclusives.</b> <b>Sarge</b> patches himself up at <span data-tune="sargeRegen"></span> HP/sec once he has been out of contact for <span data-tune="sargeCalm"></span> seconds, and his <b>On Me!</b> toggle gives allied infantry within <span data-tune="sargeR"></span> tiles +<span data-tune="sargeAura"></span>% damage while cutting his own by <span data-tune="sargeSelf"></span>%. <b>Mortar Squads</b> ramp +<span data-tune="wfStep"></span>% per consecutive shell on one target up to +<span data-tune="wfCap"></span>%, and their <b>Smoke Rounds</b> toggle shells your own men instead: no damage, but a <span data-tune="smokeR"></span>-tile cloud that cuts damage taken by <span data-tune="smokeRed"></span>% for <span data-tune="smokeT"></span> seconds. The <b>Radar Tent</b>'s <b>Target Uplink</b> gives your whole army +<span data-tune="upRg"></span> range and +<span data-tune="upVi"></span> sight for <span data-tune="upT"></span> seconds on a <span data-tune="upCd"></span>-second cooldown.<br><br>
  <b>APC</b> (Garage): unarmed transport carrying 10 infantry""")

# =========================================================================
out = src
fail = []

for what, tok in GUARDS_PRESENT:
    if tok not in out:
        fail.append('  GUARD  %-28s absent - source is not v78' % what)
for what, tok in GUARDS_ABSENT:
    if tok in out:
        fail.append('  GUARD  %-28s already present - splice already applied' % what)

if fail:
    print('splice_v79: REFUSING TO WRITE\n' + '\n'.join(fail))
    sys.exit(1)

for name, old, new, n in EDITS:
    c = out.count(old)
    if c != n:
        fail.append('  %-52s expected %d occurrence(s), found %d' % (name, n, c))
        continue
    out = out.replace(old, new, n)

if fail:
    print('splice_v79: REFUSING TO WRITE\n' + '\n'.join(fail))
    sys.exit(1)

# ---- post-conditions -------------------------------------------------------
POST_PRESENT = [
    ("sarge aura constant",   "const SARGE_AURA=0.30;"),
    ("uplink constants",      "const UPLINK_T=20;"),
    ("range accessor",        "function rgOf(u){"),
    ("vision accessor",       "function viOf(u){"),
    ("uplink predicate",      "function upOn(p){"),
    ("sarge table flag",      "lim:1,rally:1,regen:1,"),
    ("mortar table flags",    "wf:1,smokeCap:1,"),
    ("radar table flag",      "tech:'b_radar',uplink:1,"),
    ("calmT on every unit",   "calmT:0};"),
    ("upT on every building", "abilityCool:0,upT:0,"),
    ("smoke reduction",       "amt*=(1-SMOKE_RED)"),
    ("calmT reset",           "tgt.calmT=0;"),
    ("sarge self cost",       "if(u.t.rally&&u.onMe)m*=SARGE_SELF;"),
    ("walking fire ramp",     "wfM=1+Math.min(MORT_WF_CAP,u.wf*MORT_WF_STEP);"),
    ("smoke fire loop",       "function updateSmoke(u,dt){"),
    ("hurt-friend scan",      "function nearestHurtFriend(u){"),
    ("smoke strike raised",   "G.strikes.push({kind:'smoke'"),
    ("smoke ages out",        "if(s.t>=SMOKE_T)G.strikes.splice(i,1);"),
    ("onme command",          "case 'onme':{"),
    ("smoke command",         "case 'smoke':{"),
    ("uplink command",        "case 'uplink':{"),
    ("uplink ticks down",     "if(b.upT>0)b.upT-=dt;"),
    ("units hashed",          "h=hI(h,u.wfT||0)}"),
    ("blds hashed",           "h=hF(h,b.upT||0)}"),
    ("glow predicate",        "function rallied(u){"),
    ("ai sarge policy",       "u.onMe=gain79>lost79;"),
    ("ai uplink policy",      "if(hit79>=3){rad79.upT=UPLINK_T;"),
    ("help slots wired",      'data-tune="sargeAura"'),
]
POST_ABSENT = [
    ("the raw entrench-cone range",  "nearestEnemyCone(u,t.vi)"),
    ("the raw idle sight",           "nearestEnemy(u,u.hold?Math.min(t.vi,t.rg):t.vi)"),
    ("the raw amove sight",          "nearestEnemy(u,t.vi)"),
    ("the raw attack range",         "paraMun(tgt).rg:t.rg"),
    ("the raw pVision sight",        "const vi=u.t.vi||0;"),
    ("the raw fog stamp",            "stamp(u.x,u.y,u.t.vi)"),
    ("the raw help radius",          "vr=tgt.t.vi+2"),
]
for what, tok in POST_PRESENT:
    if tok not in out:
        fail.append('  POST   %-28s missing after the splice' % what)
for what, tok in POST_ABSENT:
    if tok in out:
        fail.append('  POST   %-28s survived the splice' % what)

if fail:
    print('splice_v79: REFUSING TO WRITE\n' + '\n'.join(fail))
    sys.exit(1)

open(DST, 'w', encoding='utf-8').write(out)
print('splice_v79: applied %d edits, %s -> %s' % (len(EDITS), SRC, DST))
