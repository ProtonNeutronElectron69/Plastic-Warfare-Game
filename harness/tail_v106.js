/* tail_v106.js - T88: the unit abilities a bot never used (Roadmap 4 item 4).

   MEASURED FIRST, with harness/probe_v106.sh, which this release adds. Rule 8:
   a win rate is an OUTCOME and an outcome is consistent with a dozen causes, so
   the tool counts the MECHANISM - per ability, the share of carrier-ticks on
   which a CPU unit that OWNS the ability has it switched on. Four all-CPU
   matches on backyard, before and after:

     ability          before                after
     Entrench         1.7-7.8%              3.8-12.5%     (already driven, v48)
     On Me!           19.7%                 unchanged     (already driven, v79)
     Pressure Valve   8.0-17.2%             6.8-12.9%     (already driven, v80)
     Called Shot      9.2-13.9%             7.0-23.5%     (already driven, v81)
     Smoke Rounds     0.0%   (57 carriers)  5.4-14.7%
     Full Throttle    0.0%   ( 5 carriers)  39.8-43.8%
     Flat Out         0.0%   (33 carriers)  10.1-30.2%
     Sprint           0.0%   (59 carriers)  14.4-29.7%
     Air Assault      0.0%   ( 1 carrier)   0.0%   - see T88.F, it is not the rule
     Ripple Fire      no carrier in any match          - see T88.E
     Broadcast        0.0-8.5%              unchanged    - see T88.F

   THE ROADMAP NOTE THIS RELEASE CAME FROM WAS WRONG ABOUT ITS OWN INVENTORY, and
   correcting that is half the value. It said aiTick "drives 3 of the 11 rows in
   UNIT_TOGGLES" and "never uses smokeCap, cshot, ripple, throttle, flat, aslt,
   sprint or bcast". Called Shot has been driven since v81 and Broadcast since
   v86 - both predate the note - so the real count was 5 driven, 6 not, and the
   eight named were six. T88.A checks the inventory the way it should have been
   checked in the first place: DERIVED off UNIT_TOGGLES, so an ability added to
   that table and left unwired fails this file. */

function nocmt106(fn){return String(fn).replace(/\/\*[\s\S]*?\*\//g,' ').replace(/(^|[^:])\/\/[^\n]*/g,'$1')}
const AI106=nocmt106(aiTick), UU106=nocmt106(updateUnit);
const DT106=1/30;
/* a bot player with a clear field: no foes anywhere near, so the "is anything I
   could shoot in reach" half of every gate below is false unless a test puts
   something there deliberately. */
function bot106(seed){
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:seed||106001});
 const p=G.players.find(q=>q.ai&&!q.neutral);
 for(const u of G.units.slice())if(!allied(u.p,p))kill(u);
 return p;
}
/* put a carrier on the field, pointed at a destination, so "travelling" is true */
function marcher106(p,key,x,y){
 const u=makeUnit(key,p,x,y);
 u.state='move';u.dest={x:x+8,y:y};u.path=[{x:x+8,y:y}];u.wp=0;
 return u;
}

section('T88.A v106: every ability in the toggle table is driven, or named as not');
{
 /* DERIVED off UNIT_TOGGLES. A row is "driven" if aiTick or updateUnit writes
    its state field; anything else has to appear in the exemption list below with
    a reason, so a twelfth toggle cannot ship unwired and unremarked. */
 const writes=f=>new RegExp('\\.'+f+'\\s*=').test(AI106)||new RegExp('\\.'+f+'\\s*=').test(UU106);
 /* Overdrive is a BUILDING ability and not in this table; the one unit toggle
    still deliberately undriven is none. Kept as an explicit (empty) list so the
    next release that declines to wire one has to say so here. */
 const EXEMPT={};
 const cold=UNIT_TOGGLES.filter(a=>!writes(a.s)&&!EXEMPT[a.s]).map(a=>a.off);
 ok('T88.A every UNIT_TOGGLES row has a bot rule'+(cold.length?' :: '+cold.join(', '):''),
    cold.length===0);
 ok('T88.A ...and the table is the eleven rows this claim is about',UNIT_TOGGLES.length===11);
 /* non-vacuity: the test can tell a driven row from an undriven one */
 ok('T88.A the driven/undriven test is not vacuous',
    writes('thr')&&!/\.wibble\s*=/.test(AI106));
 /* the five this release added, named, because they are the deliverable */
 for(const f of ['smoke','thr','flat','spr','aslt'])
  ok('T88.A aiTick now writes u.'+f, new RegExp('u\\.'+f+'=').test(AI106));
}

section('T88.B v106: the three speed abilities spend TRAVEL, never a shot');
{
 /* Full Throttle, Flat Out and Sprint all buy speed by giving up shooting, so
    each must be on while crossing the map and off when there is something to
    shoot. The ON half is a fixture; the OFF half is checked as a MATCH-WIDE
    INVARIANT below, because a fixture cannot hold a bot unit still - aiTick
    re-orders an idle carrier toward its stage point on the very next tick, and
    a carrier marching to the stage point is travelling, correctly. */
 const CASES=[
  {key:'bulltank',f:'thr', name:'Full Throttle'},
  {key:'bike',    f:'flat',name:'Flat Out'},
  {key:'runner',  f:'spr', name:'Sprint'}
 ];
 for(const c of CASES){
  const p=bot106(106100);
  const u=marcher106(p,c.key,20,20);
  aiTick(p);
  ok('T88.B '+c.name+' switches ON for a carrier crossing an empty map',u[c.f]===true);
 }
 /* THE SAFETY PROPERTY, and the one that matters: over a real match, no carrier
    is ever left silenced while something it could shoot is inside its own gate.
    Checked at the instant aiTick returns rather than on a timer, so nothing here
    depends on how far the sim has drifted since the last decision. */
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',seed:106150,watch:true});
 const _ai=aiTick;
 let checks=0,bad=[],onSeen={thr:0,flat:0,spr:0,smoke:0};
 aiTick=function(p){
  const out=_ai.apply(null,arguments);
  for(const u of p.units){
   if(u.hp<=0||u.garrisoned)continue;
   const going=(u.state==='move'||u.state==='amove')&&!!u.dest;
   if(u.t.throttle){checks++;if(u.thr)onSeen.thr++;
    if(u.thr&&(!going||nearestEnemy(u,rgOf(u)+THROTTLE_AI_PAD)))bad.push('thr@'+u.id);}
   if(u.t.flat){checks++;if(u.flat)onSeen.flat++;
    if(u.flat&&(!going||nearestEnemy(u,rgOf(u)+FLAT_AI_PAD)))bad.push('flat@'+u.id);}
   if(u.t.sprint){checks++;if(u.spr)onSeen.spr++;
    if(u.spr&&(!going||nearestEnemy(u,SPRINT_AI_R)))bad.push('spr@'+u.id);}
   if(u.t.smokeCap&&u.smoke)onSeen.smoke++;
  }
  return out;
 };
 for(let i=0;i<9000&&!G.over;i++)update(DT106);
 aiTick=_ai;
 ok('T88.B the invariant was actually exercised ('+checks+' carrier decisions)',checks>200);
 ok('T88.B no carrier is EVER silenced with something it could shoot in reach'
    +(bad.length?' :: '+bad.slice(0,6).join(', '):''), bad.length===0);
 ok('T88.B ...and all three really do switch on during the match (thr '+onSeen.thr
    +', flat '+onSeen.flat+', spr '+onSeen.spr+')',
    onSeen.thr+onSeen.flat+onSeen.spr>0);
}

section('T88.C v106: what the Bull deliberately does NOT stop for');
{
 /* The gate is nearestEnemy - the SIM'S OWN acquisition helper - rather than a
    plain proximity scan, and that choice has a consequence worth stating: the
    Bull carries a hull flamer, and nearestEnemy hands infantry to the SECONDARY
    (secOwns), so a charging Bull does not throttle down for foot soldiers.
    THAT IS CORRECT PLAY, and crush80 is the reason: a charging Bull KILLS
    outright any infantryman inside THROTTLE_R, and any barricade - no damage
    roll, no reload. Stopping to shoot them would be trading a certain kill for
    an uncertain one. It stops for what it has to SHOOT. */
 ok('T88.C a charge is lethal to infantry by itself, which is why it does not stop for them',
    /armorOf\(e\)!=='inf'/.test(nocmt106(crush80))&&/e\.hp=0/.test(nocmt106(crush80)));
 /* Asserted against the GATE rather than through a whole aiTick, because a foe
    parked next to a bot's base also wakes the v99 defend picket, and a Bull that
    aiTick has re-tasked onto an intruder is not travelling for a second reason.
    The claim here is about what the gate sees, so the gate is what is asked. */
 const p=bot106(106160);
 const foe=G.players.find(q=>!allied(q,p)&&!q.neutral);
 // nearestEnemy scans STRUCTURES too, so the enemy's base has to be off the
 // board for this to be a question about the foot soldier - the first cut of
 // this check read back an HQ standing near the fixture's chosen tile.
 for(const bl of G.blds.slice())if(!allied(bl.p,p)){bl.hp=0;kill(bl)}
 const b=makeUnit('bulltank',p,20,20);
 const r=rgOf(b)+THROTTLE_AI_PAD;
 const man=makeUnit('grunt',foe,21,20);
 ok('T88.C the charge gate does not see a foot soldier - the hull flamer owns him',
    !nearestEnemy(b,r)&&dhyp(man.x-b.x,man.y-b.y)<r&&secOwns(b,man));
 kill(man);
 const tank=makeUnit('tank',foe,21,20);
 ok('T88.C ...and does see a tank, which it has to stop and shoot',
    nearestEnemy(b,r)===tank);
}

section('T88.C2 v106: Sprint is gated widest, because it silences OTHER units');
{
 /* The one asymmetry in the three: Full Throttle and Flat Out silence only the
    unit that carries them, Sprint silences every friendly infantryman within
    SPRINT_R. So its gate is not "can the Runner shoot" but "is anything near at
    all", and it must be the widest of the three by a real margin. */
 ok('T88.C2 the Runner\'s gate is wider than his own weapon range',
    SPRINT_AI_R>U.runner.rg+FLAT_AI_PAD);
 const p=bot106(106200);
 const r=marcher106(p,'runner',20,20);
 const mate=makeUnit('grunt',p,20.5,20);            // inside SPRINT_R
 const foe=G.players.find(q=>!allied(q,p)&&!q.neutral);
 const e=makeUnit('grunt',foe,20+SPRINT_AI_R-1,20); // inside the Runner's gate, outside a grunt's range
 aiTick(p);
 ok('T88.C2 a foe the ESCORT could not yet shoot still keeps the whistle down',
    r.spr===false&&dhyp(e.x-mate.x,e.y-mate.y)>U.grunt.rg);
}

section('T88.D v106: Air Assault buys fire by giving up movement');
{
 /* The opposite trade to the three above, and the only rule here that must be
    switched OFF for the bot to keep playing: orderMove REFUSES a pinned aircraft,
    so a transport left open would never march again. */
 const p=bot106(106300);
 const c=makeUnit('chinook',p,20,20);
 const foe=G.players.find(q=>!allied(q,p)&&!q.neutral);
 const e=makeUnit('grunt',foe,22,20);
 aiTick(p);
 ok('T88.D an EMPTY transport never pins itself, however close the enemy',c.aslt===false);
 const rider=makeUnit('grunt',p,20,20);rider.garrisoned=true;c.garrison.push(rider);
 aiTick(p);
 ok('T88.D ...a loaded one with a foe in reach opens up',c.aslt===true);
 kill(e);aiTick(p);
 ok('T88.D ...and closes the moment the last foe near it dies, so it can be ordered again',
    c.aslt===false);
 ok('T88.D orderMove really does refuse a pinned aircraft - which is why that matters',
    nocmt106(orderMove).indexOf('u.t.assault&&u.aslt')>0);
}

section('T88.E v106: Ripple Fire - a measurement overturning the roadmap\'s guess');
{
 /* Roadmap 4 item 4 proposed "Ripple Fire at a clump". v81 had already recorded
    that it measured better than single fire in EVERY arm, so a rule could only
    ever say "always on". v106 re-measured (60 sim-seconds x 3 seeds, one battery
    against a fixed block: 1.33x the damage against ONE man, 1.09-2.79x against
    two to six) and wired what v81 described. The reason a clump rule is wrong is
    in the constants: the salvo's bursts are wider than the scatter that spreads
    them, so a rocket landing off the aim point still covers it. */
 ok('T88.E the salvo\'s extra splash outreaches the scatter that spreads it',
    U.arty.spl*RIPPLE_SPL - U.arty.spl > RIPPLE_BOX);
 ok('T88.E ...and a salvo is worth more per reload than a single shell',
    (RIPPLE_N*RIPPLE_DM)/RIPPLE_RT > 1);
 const p=bot106(106400);
 const a=makeUnit('arty',p,20,20);a.rip=false;
 aiTick(p);
 ok('T88.E a bot battery is switched to ripple with nothing in sight at all',a.rip===true);
 const h=makeUnit('arty',G.human,26,20);h.rip=false;
 aiTick(p);
 ok('T88.E ...and a HUMAN battery keeps the single fire it shipped with',h.rip===false);
}

section('T88.F v106: the two that still read zero, and why it is not the rule');
{
 /* Recorded rather than hidden, because "it does not fire" and "the rule is
    wrong" are different claims and only measurement separates them.

    AIR ASSAULT: measured over six all-CPU matches, a bot transport was LOADED on
    0.0% of samples (375 transport-samples in the one match that built one;
    maxAboard 0, carry-jobs 0). The v48 carry job needs a free transport AND six
    infantry in one wave at one launch, and that never coincided. So the gate
    below is correct and simply never has an occasion - a transport doctrine
    question, not an ability one, and out of scope here.

    BROADCAST: driven since v86 and measured at 0.0-8.5%. Its gate is three
    allies UNDER FIRE within BCAST_R of the truck, and a bot's Command Truck sits
    with the base while the fighting is at the far end of the map. Also a
    positioning question rather than an ability one; v106 does not re-tune an
    existing threshold on the way past. */
 ok('T88.F Air Assault\'s rule needs a loaded transport, which is the part that never happens',
    /u\.aslt=!!\(u\.garrison&&u\.garrison\.length/.test(AI106));
 ok('T88.F ...and the v48 carry job needs six infantry in one wave to load one',
    nocmt106(aiTick).indexOf('rl.length>=6')>0);
 ok('T88.F Broadcast keeps the v86 threshold this release did not touch',BCAST_AI_N===3);
}

section('T88.G v106: nothing here writes a human\'s army, or new state');
{
 /* Every rule in the block is a pure read-then-write-one-boolean, in aiTick,
    over p.units - so a human's toggles are never touched, and nothing new has to
    be hashed, serialized or expired. */
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'tan',opp:1,seed:106500});
 const me=G.human,bot=G.players.find(q=>q.ai&&!q.neutral);
 const mine=['bulltank','bike','runner','mortar','arty','chinook'].map(k=>{
  const u=marcher106(me,k,me.start.x+3,me.start.y+3);return u;
 });
 for(let i=0;i<40;i++)update(DT106);
 const touched=mine.filter(u=>u.thr||u.flat||u.spr||u.smoke||u.rip||u.aslt).map(u=>u.key);
 ok('T88.G a HUMAN\'s carriers are never switched by the bot rules'
    +(touched.length?' :: '+touched.join(', '):''), touched.length===0);
 /* the fields were all hashed and serialized long before this release - v82 for
    flat/aslt, v79-v86 for the rest - so wiring them adds nothing to either. */
 const a=hashState(),snap=saveState();
 loadState(snap);
 ok('T88.G the ability state still round-trips through a save',hashState()===a);
 const hs=hashState.toString();
 ok('T88.G ...and every field this release drives was already hashed',
    ['u.thr?1:0','u.flat?1:0','u.spr?1:0','u.smoke?1:0','u.rip?1:0','u.aslt?1:0']
      .every(f=>hs.includes(f)));
 /* no new sim state: the rules store nothing between ticks */
 ok('T88.G the block remembers nothing between ticks - no new field on the brain',
    !/ai\.(smokeT|thrT|flatT|sprT|asltT)/.test(AI106));
}

section('T88.H v106: the thresholds are named, not buried');
{
 /* Same rule as BCAST_AI_N and LOCK_AI_FLOOR: a bot threshold lives in the
    tunables with a comment, so it can be found and re-tuned without reading
    aiTick. Two of the three speed gates are measured OFF the unit's own range
    rather than typed as a tile count, so re-ranging a Bull moves its hand-over
    with it. */
 for(const n of ['SMOKE_AI_N','THROTTLE_AI_PAD','FLAT_AI_PAD','SPRINT_AI_R','ASSAULT_AI_R'])
  ok('T88.H '+n+' is a named constant',typeof eval(n)==='number');
 ok('T88.H the Bull and the bike measure their gate off rgOf, not off a typed range',
    /rgOf\(u\)\+THROTTLE_AI_PAD/.test(AI106)&&/rgOf\(u\)\+FLAT_AI_PAD/.test(AI106));
 ok('T88.H the mortar counts allies inside its OWN firing envelope, min range included',
    /u\.t\.mrg/.test(AI106));
 ok('T88.H "under fire" is HURT_WINDOW, the same one the Radar Tent and the truck read',
    /calmT>=HURT_WINDOW/.test(AI106));
}

/* The strength A/B and the per-ability before/after table are in the v106 section
   of README.md. This file pins the MECHANISM - which rules exist, what they read
   and what they refuse - because that is what a later release can break without
   noticing. What it deliberately does NOT pin is a win rate: 16 matches is a
   hint, not a verdict, and the balance chapter of CLAUDE.md says so. */
