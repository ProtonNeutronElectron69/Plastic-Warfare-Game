/* ================================================================================
   T26 - v45 UNIT COUNTER MATRIX

   A: table shape and bounds; the bug column is pinned flat in every row
   B: armorOf over the whole roster; wcOf over every kind of attacker in the game
   C: the full multiplier grid, pinned cell by cell
   D: the paratrooper's three munitions, three rows, three bonuses
   E: the shot class actually reaches applyDmg down every firing path
   F: the paths v45 deliberately left alone (mines, quicksand, burn, bites, towers)
   G: wave survival damage is untouched - the pre-v45 Desk trail still reproduces
      once the Gunner's price is put back, which isolates the matrix from the cost
   H: Gunner cost 90 -> 115 and what it does to damage per plastic
   I: the info screen reads the same numbers the sim does
   J: determinism dual-run + save/load with a mixed-arms fight in flight
   ================================================================================ */
section('T26 v45: unit counter matrix');

const DT45=1/30;
function cfg45(map,mode,seed,opp){return{map,mode,diff:'normal',fac:'tan',opp:(opp==null?3:opp),seed}}

/* The Desk survival trail with the Gunner at its pre-v45 price of 90, recut from
   the v48 build (the AI overhaul moves every trail, so the original pre-v45
   capture can no longer reproduce under any price). Kept here, only for G. */
const BASE43_DESK=[1136472970, 2858797107, 3611692740, 744562274, 4239204299, 2626646524, 4181348723, 1098921714, 1158861741, 336626201, 2660866583, 4144824822, 2016882219, 1095119793, 2934643888, 2160987690, 834484655, 3858461510, 4241971238, 2142278903, 3023419247, 3140267272, 1104562015, 1863961727, 2215958338, 3963885992];
/* ---------- A: table shape ---------- */
{
 const WCS=['b','g','r','s','m','f','d','a','q','x'], COLS=ARMOR_ORDER.concat(['bug']);
 // v51: 'a' is the AA-missile row. It is deliberately ZERO against every ground
 // class, which is the second, table-level lock on air-only targeting, so it is
 // exempt from the 0.25..1.6 band and from the bonus/penalty reachability scan.
 const GND=WCS.filter(w=>w!=='a');
 ok('T26.A ten weapon rows, no more no less',
    Object.keys(WVA).length===10&&WCS.every(w=>!!WVA[w]));
 ok('T26.A every row carries every armor column',
    WCS.every(w=>COLS.every(c=>typeof WVA[w][c]==='number')&&Object.keys(WVA[w]).length===COLS.length));
 ok('T26.A the bug column is pinned flat in all ten rows - survival cannot drift',
    WCS.every(w=>WVA[w].bug===1));
 ok('T26.A the x row is flat 1.00 - mines, hazards, burn DoT and bites keep v44 numbers',
    COLS.every(c=>WVA.x[c]===1));
 ok('T26.A no cell is a wall or a free win, and the air-only row is exactly zero off-air',
    GND.every(w=>COLS.every(c=>WVA[w][c]>=0.25&&WVA[w][c]<=1.6))&&
    WVA.a.air===1.6&&WVA.a.bug===1&&ARMOR_ORDER.every(c=>c==='air'||WVA.a[c]===0));
 ok('T26.A every armor column is reachable from some row at a bonus and some row at a penalty',
    ARMOR_ORDER.every(c=>GND.some(w=>WVA[w][c]>1)&&GND.some(w=>WVA[w][c]<1)));
 ok('T26.A ARMOR_LABEL covers every class armorOf can return',
    COLS.every(c=>typeof ARMOR_LABEL[c]==='string'&&ARMOR_LABEL[c].length>0));
 // overrides must be well formed: real unit key, real weapon guard, real armor cells
 let ovOk=true;
 for(const k in UVA){
  const o=UVA[k];
  if(!U[k]||!o.w||!WVA[o.w])ovOk=false;
  for(const c in o){if(c==='w')continue;if(!COLS.includes(c)||typeof o[c]!=='number')ovOk=false;}
 }
 ok('T26.A every override names a real unit, a real weapon and real armor cells',ovOk);
 ok('T26.A overrides are guarded so a multi-weapon unit cannot leak one bonus onto another',
    Object.keys(UVA).every(k=>!!UVA[k].w));
 ok('T26.A an override REPLACES its cell rather than multiplying it',
    dmgMulFor('bazooka','r','heavy')===UVA.bazooka.heavy&&UVA.bazooka.heavy!==WVA.r.heavy);
 ok('T26.A an override does not leak onto cells it does not name',
    dmgMulFor('bazooka','r','medium')===WVA.r.medium&&dmgMulFor('sniper','b','light')===WVA.b.light);
}

/* ---------- B: classification ---------- */
{
 const WANT={grunt:'inf',grenadier:'inf',gunner:'inf',bazooka:'inf',sarge:'inf',mortar:'inf',
   flamer:'inf',sniper:'inf',para:'inf',runner:'inf',truck:'light',medic:'light',bike:'light',arty:'light',
   jeep:'medium',apc:'medium',tank:'heavy',bulltank:'heavy',heli:'air',apache:'air',chinook:'air',
   aatruck:'light', // v51: a soft-skinned truck, so ground troops have a clean answer to it
   /* v86, and both of these are declared deliberately. The Command Truck rides the
      'cmd' archetype - its own, so nothing in the file mistakes it for a harvester -
      and ARMOR_OF_A answers 'light' for it, which is the class a soft-skinned lorry
      belongs in. The Observation Balloon is 'air' by the t.fly fallback, exactly as
      the three helicopters are; what makes it untouchable is NOT its armor class but
      the pair of rules at ballOk and targetDmgMul, which sit above the matrix. */
   cmdtruck:'light', balloon:'air',
   /* v87: the Firebomb Heli is a helicopter and classes as one. Nothing about it
      is special-cased here - what makes it Tan's is the weapon row and the two
      abilities, not the armour it wears. */
   firebomb:'air',
   /* v88: the Choktaw is a helicopter and classes as one, exactly as the Firebomb
      does. What makes it Gray's is the two weapons and the two abilities, not the
      armour it wears - and its dual armament changes nothing here either, because
      armorOf answers for what a unit IS, never for what it shoots. */
   choktaw:'air'};
 let bad=[];
 for(const k in U){const got=armorOf({kind:'unit',t:U[k]});if(got!==WANT[k])bad.push(k+'='+got);}
 ok('T26.B every unit in the roster lands in its intended armor class'+(bad.length?' ('+bad.join(', ')+')':''),
    bad.length===0&&Object.keys(WANT).length===Object.keys(U).length);
 ok('T26.B every structure is one lumped class, HQ through barricade and nest',
    ['hq','barracks','guardtower','bunker','barricade','nest','turbine'].every(k=>armorOf({kind:'bld',key:k,t:B[k]})==='bldg'));
 ok('T26.B creatures are their own class',
    Object.keys(CREATURE).every(k=>armorOf({kind:'creature',t:CREATURE[k]})==='bug'));
 ok('T26.B an unknown flying unit would still classify as air, not as a soft skin',
    armorOf({kind:'unit',t:{a:'zeppelin',fly:1}})==='air'&&armorOf({kind:'unit',t:{a:'zeppelin'}})==='light');

 ok('T26.B a unit shoots on its own weapon class',
    Object.keys(U).filter(k=>U[k].dm>0).every(k=>wcOf({kind:'unit',key:k,t:U[k]})===U[k].w));
 ok('T26.B guard tower and bunker fire small arms',
    wcOf({kind:'bld',key:'guardtower'})==='b'&&wcOf({kind:'bld',key:'bunker'})==='b');
 ok('T26.B the radio tower owns magnify and napalm, so it burns',
    wcOf({kind:'bld',key:'radiotower'})==='f');
 ok('T26.B an unarmed building, a creature, the mine ghost and nothing at all are all unclassed',
    wcOf({kind:'bld',key:'hq'})==='x'&&wcOf({kind:'creature'})==='x'&&wcOf(MINE_OWNER)==='x'&&wcOf(null)==='x');
 ok('T26.B unarmed vehicles cannot resolve to a live row either',
    wcOf({kind:'unit',key:'apc',t:U.apc})==='x'&&wcOf({kind:'unit',key:'truck',t:U.truck})==='x'&&
    wcOf({kind:'unit',key:'chinook',t:U.chinook})==='x');
}

/* ---------- C: the grid, pinned ---------- */
{
 const GRID={
  grunt:[1.00,1.00,0.85,0.60,1.00,0.70], grenadier:[1.20,1.00,0.85,0.55,0.45,0.80],
  gunner:[1.00,1.00,0.85,0.60,1.00,0.70], bazooka:[0.70,1.10,1.35,1.76,1.30,0.90],
  jeep:[1.00,1.00,0.85,0.60,1.00,0.70],   tank:[0.72,1.10,1.20,1.10,0.85,1.40],
  heli:[1.30,1.00,0.85,0.60,1.00,0.70],   sarge:[1.00,1.00,0.85,0.60,1.00,0.70],
  mortar:[1.15,1.00,0.90,0.70,0.40,1.45], flamer:[1.35,1.05,0.75,0.45,0.50,0.90],
  bulltank:[0.72,1.10,1.20,1.10,0.85,1.40], sniper:[1.40,1.00,0.35,0.25,1.00,0.70],
  arty:[1.15,1.00,0.90,0.70,0.40,1.45],   bike:[1.00,1.00,0.85,0.60,1.00,0.70],
  apache:[0.70,1.10,1.35,1.50,1.30,0.90],
  para:[1.30,1.00,0.85,0.60,1.00,0.70],
  /* v87: the Firebomb Heli fires weapon row 'f' - the row the Flamethrower, the
     Bull's hull flamer and the tower's napalm already share - so its row is the
     plain flame row, identical to the Flamethrower's. That is the point of not
     inventing an eleventh weapon class for it: what changed is what Tan can do
     with fire, not what fire does. */
  firebomb:[1.35,1.05,0.75,0.45,0.50,0.90],
  // v85: the Signal Runner's pistol is weapon row 'b', so his row is the plain
  // small-arms row - identical to the Grunt's. That is the point of not giving a
  // sidearm a tenth weapon row: it changes what he does, not what small arms do.
  runner:[1.00,1.00,0.85,0.60,1.00,0.70],
  aatruck:[0.00,0.00,0.00,0.00,1.60,0.00],
  /* v88: the Choktaw's MAIN weapon is row 'r' - the Apache's rocket row - so its
     line here is the Apache's line, character for character. That is deliberate
     and is asserted as an identity just below: a unit carrying two weapons did not
     need a new weapon class, because the grid answers for the ROW and the door gun
     is scored separately through t.sec (which fires row 'b' with wc 'b'). */
  choktaw:[0.70,1.10,1.35,1.50,1.30,0.90]
 };
 ok('T26.C the Choktaw\'s rocket row IS the Apache\'s, not a new one',
    ARMOR_ORDER.every(ar=>dmgMulFor('choktaw',U.choktaw.w,ar)===dmgMulFor('apache',U.apache.w,ar)));
 ok('T26.C ...and its door gun scores on the small-arms row, through t.sec',
    U.choktaw.sec.wc==='b'&&dmgMulFor(null,'b','inf')===dmgMulFor(null,U.grunt.w,'inf'));
 let bad=[];
 for(const k in GRID)ARMOR_ORDER.forEach((ar,i)=>{
  const got=dmgMulFor(k,U[k].w,ar);
  if(Math.abs(got-GRID[k][i])>1e-9)bad.push(k+'/'+ar+'='+got);
 });
 ok('T26.C the whole multiplier grid is exactly as specified'+(bad.length?' ('+bad.slice(0,6).join(', ')+')':''),bad.length===0);
 ok('T26.C every armed unit is covered by the pinned grid',
    Object.keys(U).filter(k=>U[k].dm>0).every(k=>!!GRID[k]));

 // the counter relationships the release exists to create
 ok('T26.C small arms glance off heavy armor but not off aircraft',
    dmgMulFor('gunner','b','heavy')===0.6&&dmgMulFor('gunner','b','air')===1);
 ok('T26.C rockets are the armor answer and cannot replace a rifle',
    dmgMulFor('bazooka','r','heavy')>1.5&&dmgMulFor('bazooka','r','inf')<0.75);
 ok('T26.C tanks out-siege every gun that is not artillery',
    dmgMulFor('tank','s','bldg')===1.4&&dmgMulFor('arty','m','bldg')===1.45&&
    dmgMulFor('tank','s','bldg')>dmgMulFor('gunner','b','bldg'));
 ok('T26.C arcing shells and frag are not anti-air',
    dmgMulFor('arty','m','air')===0.4&&dmgMulFor('mortar','m','air')===0.4&&dmgMulFor('grenadier','g','air')===0.45);
 ok('T26.C flame melts men and cannot open a hull',
    dmgMulFor('flamer','f','inf')===1.35&&dmgMulFor('flamer','f','heavy')===0.45);
 ok('T26.C the sniper is anti-personnel only',
    dmgMulFor('sniper','b','inf')===1.4&&dmgMulFor('sniper','b','heavy')===0.25&&
    dmgMulFor('sniper','b','heavy')<dmgMulFor('grunt','b','heavy'));
 ok('T26.C the Huey keeps its v30 identity, the Apache keeps and sharpens its own',
    dmgMulFor('heli','b','inf')===1.3&&dmgMulFor('apache','r','heavy')===1.5&&dmgMulFor('apache','r','inf')===0.7);

 // no target class is without an efficient answer, and none has an unanswerable one
 const armed=Object.keys(U).filter(k=>U[k].dm>0&&U[k].rt>0&&U[k].cp>0);
 const eff=(k,ar)=>unitDPS(U[k])*dmgMulFor(k,U[k].w,ar)/U[k].cp; // v51: salvo-aware; unitDPS==dm/rt for every non-salvo unit, so no existing score moves
 /* v65 MOVED THIS, and the movement is recorded here rather than smoothed away.
    eff() divides by PLASTIC cost and the Grunt is the cheapest armed unit in the
    game, so its price sets the scale for every class at once. The approved +20%
    dropped it from 63.0% of the air leader to 52.5%, i.e. under the 55% cut, and
    the air pool went 3 -> 2. Air is not unanswerable: the AA Missile Truck is a
    dedicated hard counter at 100% of its own pool and the Machine Gunner sits at
    77%. But the third answer is gone, and restoring it is a balance decision for
    a later release, not something this tail should hide.
    The pool size is now pinned PER CLASS, so the guardrail is no weaker than the
    blanket >=3 it replaces: any further drop, in any class, still fires.
    v69 MOVED THIS UPWARD, which is the release landing rather than drift. Pricing
    the Gunner 115 -> 140 pulled the top of three columns down toward the field, so
    more of the roster clears the 55% cut: light 3 -> 7, medium 5 -> 7, bldg 4 -> 8.
    A WIDER pool is the stated goal of the change (one generalist was winning the
    specialists' own columns), so it is recorded at the measured figure and any
    future NARROWING still fires. Air stayed at 2: that is the v65 Grunt-price
    knock-on, untouched there and still a decision for a later release.
    v73 MOVED THIS IN BOTH DIRECTIONS and neither direction is smoothed away.
    The Machine Gunner's -15% pulled the top out of three columns he was leading,
    so more of the roster clears the 55% cut: light 7 -> 9 and medium 7 -> 9. That
    is the release landing, the same way v69's did.
    It also dropped him OUT of two pools. heavy 3 -> 2 is the release working as
    designed - he was never meant to be an armor answer, T48.C exists to stop him
    being one, and bazooka + apache still clear the cut between them.
    air 2 -> 1 is NOT the release working. He goes 64% -> 54% of the AA Missile
    Truck against a 55% cut, and the AA truck is aaOnly, so aircraft are now
    answered competitively by exactly one unit and that unit can shoot nothing
    else. The blanket invariant below is therefore kept INTACT for the other five
    classes and air is pulled out into its own named, two-sided check rather than
    quietly written down as 1. The margin is one percentage point: -10.5% would
    have left him at 57% and held the pool at 2. A standing v74 question. */
 /* v78 MOVED THREE OF THESE, and every one of them is the jeep or the bike.
    Measured by isolating each of the three unit edits against the v77 build:
      MG Jeep alone   inf 4 -> 5, bldg 8 -> 9   (+15% hull, -15% reload lifts
                      him over the 55% cut in two columns he sat just under)
      Scout Bike alone light 9 -> 8, medium 9 -> 8, bldg 9 -> 8  (-20% fire
                      rate drops him out of three he was marginal in)
      Machine Gunner alone: NOTHING. Not one pool, either direction.
    The bldg column takes one of each and lands back on 8. The Gunner reading
    zero is the whole reason option 1b was chosen over a deeper price cut: his
    damage per plastic is dm/(rt*cp) and 0.5*112 === 0.4*140, so every column
    he appears in sees exactly the unit he was. A narrowing still fires - light
    and medium are recorded DOWN, and the check stays two-sided. */
/* v88 MOVED EXACTLY ONE OF THESE, and it moved the safe way. Measured by running
    the same scan with and without the choktaw row on the v88 build:
      medium 8 -> 9, and the ninth member IS the Choktaw.
      inf 5, light 8, heavy 2, air 1, bldg 8 - all unmoved, and no existing unit
      entered or left any pool.
    A release that adds an armed unit and widens exactly the one column that unit
    belongs in is the release landing, the same way v69's and v73's widenings were,
    so it is recorded at the measured figure and any future NARROWING still fires.
    AIR IS STILL 1, and the Choktaw does NOT answer it: its rockets are 1.30 into
    air, which reads well, but unitDPS/cp puts it under the 55% cut against the AA
    Missile Truck. The standing v74 question is untouched by this release. */
 const WANT_POOL={inf:5,light:8,medium:9,heavy:2,air:1,bldg:8};
 let uncounterable=[],poolDrift=[];
 for(const ar of ARMOR_ORDER){
  const scored=armed.map(k=>({k,v:eff(k,ar)})).sort((a,b)=>b.v-a.v);
  const n=scored.filter(s=>s.v>=scored[0].v*0.55).length;
  if(n<2&&ar!=='air')uncounterable.push(ar);   // air is checked by name below
  if(n!==WANT_POOL[ar])poolDrift.push(ar+':'+n+'!='+WANT_POOL[ar]);
 }
 ok('T26.C no ground or structure class is left without a competitive answer'+(uncounterable.length?' ('+uncounterable.join(', ')+')':''),
    uncounterable.length===0);
 ok('T26.C the competitive pool per class matches the v73 record'+(poolDrift.length?' ('+poolDrift.join(', ')+')':''),
    poolDrift.length===0&&ARMOR_ORDER.every(ar=>ar in WANT_POOL));
 {
  /* AIR, ON THE RECORD. Bounded on both sides on purpose: a further slip fires,
     and so does a fix, because the day this is answered the pin must be read
     again rather than silently kept passing. */
  const sc=armed.map(k=>({k,v:eff(k,'air')})).sort((a,b)=>b.v-a.v);
  const share=sc[1].v/sc[0].v;
  /* v88.1: the runner-up changed identity, not standing. The Machine Gunner's
     price rose 112 -> 125, which drops HIS air figure below the Grunt's, so the
     Grunt is now the second-best answer to aircraft at 53% of the AA truck. The
     pool is still ONE and the question is still standing - what moved is which
     unit is closest to answering it. Kept two-sided so a fix fires. */
  ok(`T26.C AIR has ONE competitive answer and it is the dedicated counter - the runner-up (${sc[1].k}) sits at ${(share*100).toFixed(0)}% of it against a 55% cut. A STANDING v74 QUESTION`,
     sc[0].k==='aatruck'&&U.aatruck.aaOnly===1&&sc[1].k==='grunt'&&share<0.55&&share>0.50);
 }
 ok('T26.C air keeps a DEDICATED hard counter at the head of its pool',
    armed.map(k=>({k,v:eff(k,'air')})).sort((a,b)=>b.v-a.v)[0].k==='aatruck'&&U.aatruck.aaOnly===1);
 let dominant=[];
 for(const k of armed){
  const wins=ARMOR_ORDER.filter(ar=>dmgMulFor(k,U[k].w,ar)>1).length;
  if(wins===ARMOR_ORDER.length)dominant.push(k);
 }
 ok('T26.C no weapon is above 1.00 against every class at once'+(dominant.length?' ('+dominant.join(', ')+')':''),
    dominant.length===0);
}

/* ---------- D: the paratrooper's three weapons ---------- */
{
 ok('T26.D three munitions, three counter classes, all distinct',
    PARA_MUN.smg.wc==='b'&&PARA_MUN.at.wc==='r'&&PARA_MUN.he.wc==='d');
 ok('T26.D the counter class is separate from the FX class, so the AT/HE lobs still look like grenades',
    PARA_MUN.at.w==='g'&&PARA_MUN.he.w==='g'&&PARA_MUN.at.wc!==PARA_MUN.at.w&&PARA_MUN.he.wc!==PARA_MUN.he.w);
 ok('T26.D the SMG carries a bonus against infantry',
    dmgMulFor('para',PARA_MUN.smg.wc,'inf')===1.3&&dmgMulFor('para',PARA_MUN.smg.wc,'inf')>1);
 ok('T26.D the AT grenade carries a bonus against every vehicle class and aircraft',
    ['light','medium','heavy','air'].every(ar=>dmgMulFor('para',PARA_MUN.at.wc,ar)>1));
 ok('T26.D the HE charge carries a bonus against structures and nothing else',
    dmgMulFor('para',PARA_MUN.he.wc,'bldg')===1.25&&
    ARMOR_ORDER.filter(ar=>ar!=='bldg').every(ar=>dmgMulFor('para',PARA_MUN.he.wc,ar)<1));
 ok('T26.D each munition is the best of the three against the class it is for',
    dmgMulFor('para','b','inf')>Math.max(dmgMulFor('para','r','inf'),dmgMulFor('para','d','inf'))&&
    dmgMulFor('para','r','heavy')>Math.max(dmgMulFor('para','b','heavy'),dmgMulFor('para','d','heavy'))&&
    dmgMulFor('para','d','bldg')>Math.max(dmgMulFor('para','b','bldg'),dmgMulFor('para','r','bldg')));
 ok('T26.D auto-select still routes each target class to its munition',
    paraMun({kind:'bld',t:{}})===PARA_MUN.he&&
    paraMun({kind:'unit',t:{a:'tank'}})===PARA_MUN.at&&
    paraMun({kind:'unit',t:{a:'heli',fly:1}})===PARA_MUN.at&&
    paraMun({kind:'unit',t:{a:'inf'}})===PARA_MUN.smg&&paraMun(null)===PARA_MUN.smg);
 ok('T26.D the HE charge is still the slow long-cycle throw',
    PARA_MUN.he.gsp<PARA_MUN.at.gsp&&PARA_MUN.he.rt>PARA_MUN.at.rt&&PARA_MUN.he.k===7.5);
}

/* ---------- E: the shot class reaches applyDmg down every path ---------- */
{
 G=null;newGame(cfg45('backyard','dm',990045,1));
 const me=G.players[0],foe=G.players[1];
 const mk=(k,p,x,y)=>{const u=makeUnit(k,p,x,y);u.state='idle';u.anchor={x,y};return u};
 const dmgTaken=(tgt,fn)=>{const h0=tgt.hp;fn();return h0-tgt.hp};

 // direct bullet path: para SMG at infantry must land the 1.30
 {
  const a=mk('para',me,20,20), d=mk('grunt',foe,21,20);
  a.cool=0;
  const want=a.dm*dmgBonus(a)*PARA_MUN.smg.k*1.30;
  const got=dmgTaken(d,()=>fireAt(a,d));
  ok('T26.E a bullet applies the shot class on impact',Math.abs(got-want)<1e-6);
 }
 // projectiles must carry the class they were fired with
 {
  const a=mk('para',me,30,30);
  const b=foe.blds[0]||mk('tank',foe,31,30);
  G.projs.length=0;a.cool=0;fireAt(a,b);
  ok('T26.E the HE charge leaves the barrel tagged as demolition',
     G.projs.length===1&&G.projs[0].wc==='d');
  const t2=mk('tank',foe,31,31);
  G.projs.length=0;a.cool=0;fireAt(a,t2);
  ok('T26.E the AT grenade leaves the barrel tagged as a rocket, not as frag',
     G.projs.length===1&&G.projs[0].wc==='r'&&G.projs[0].wc!==PARA_MUN.at.w);
  const g=mk('grenadier',me,30,32), t3=mk('grunt',foe,31,32);
  G.projs.length=0;g.cool=0;fireAt(g,t3);
  ok('T26.E an ordinary grenadier still throws frag',G.projs.length===1&&G.projs[0].wc==='g');
  const tk=mk('tank',me,34,30), t4=mk('grunt',foe,35,30);
  G.projs.length=0;tk.cool=0;fireAt(tk,t4);
  ok('T26.E a tank shell is tagged as cannon',G.projs.length===1&&G.projs[0].wc==='s');
  const bz=mk('bazooka',me,34,33), t5=mk('grunt',foe,35,33);
  G.projs.length=0;bz.cool=0;fireAt(bz,t5);
  ok('T26.E a bazooka rocket is tagged as a rocket',G.projs.length===1&&G.projs[0].wc==='r');
  G.projs.length=0;
 }
 // splash carries it too: the flamethrower's cone is a splash call
 {
  const a=mk('flamer',me,40,40), d=mk('grunt',foe,40.6,40);
  a.cool=0;
  const want=a.dm*dmgBonus(a)*1.35;
  const got=dmgTaken(d,()=>fireAt(a,d));
  ok('T26.E flame splash applies the flame row, not a bare 1.00',Math.abs(got-want)<1e-6);
 }
 // an explicit wc beats the derived one, and omitting it derives correctly
 {
  const d=mk('tank',foe,44,44);
  const h0=d.hp;applyDmg(d,100,'b',null,'r');
  ok('T26.E an explicitly named shot class is honoured',Math.abs((h0-d.hp)-150)<1e-6);
  const h1=d.hp;applyDmg(d,100,'b',null);
  ok('T26.E omitting it falls back to the unclassed row',Math.abs((h1-d.hp)-100)<1e-6);
 }
}

/* ---------- F: what v45 deliberately did not touch ---------- */
{
 G=null;newGame(cfg45('backyard','dm',990046,1));
 const foe=G.players[1];
 const mk=(k,p,x,y)=>{const u=makeUnit(k,p,x,y);u.state='idle';u.anchor={x,y};return u};
 const t=mk('tank',foe,25,25);

 let h=t.hp;applyDmg(t,50,'ex',MINE_OWNER);
 ok('T26.F a landmine still does flat damage to a tank - the manual still reads true',Math.abs((h-t.hp)-50)<1e-6);
 h=t.hp;applyDmg(t,50,'b',null);
 ok('T26.F quicksand still does flat damage',Math.abs((h-t.hp)-50)<1e-6);
 h=t.hp;applyDmg(t,50,'f',null);
 ok('T26.F burn damage over time is still flat',Math.abs((h-t.hp)-50)<1e-6);

 /* every creature, biting every armor class, is flat.
    v86 EXEMPTS THE OBSERVATION BALLOON, and the exemption is the claim rather than
    a way round a failure: a bite is weapon row 'x', and the whole point of the
    balloon is that nothing outside row 'a' can touch it. A wasp doing full damage
    to a barrage balloon would be the bug. The counterfactual is asserted directly
    below, so the exemption cannot become a way of quietly excusing a real drift. */
 let bites=[];
 for(const sp in CREATURE)for(const k in U){
  if(U[k].balloon)continue;
  const m=targetDmgMul({kind:'creature',t:CREATURE[sp]},{kind:'unit',t:U[k]});
  if(m!==1)bites.push(sp+'->'+k+'='+m);
 }
 ok('T26.F no creature bites harder or softer than it did in v44'+(bites.length?' ('+bites.slice(0,4).join(', ')+')':''),bites.length===0);
 ok('T26.F ...and the one exemption is real: every creature in the game bites a balloon for nothing',
    Object.keys(CREATURE).every(sp=>targetDmgMul({kind:'creature',t:CREATURE[sp]},{kind:'unit',t:U.balloon})===0)&&
    Object.keys(U).filter(k=>U[k].balloon).length===1);
 // and nothing in the game hits a creature differently either
 let vsBug=[];
 for(const k in U){
  const m=targetDmgMul({kind:'unit',key:k,t:U[k]},{kind:'creature',t:CREATURE.ant});
  if(m!==1)vsBug.push(k+'='+m);
 }
 for(const wc of ['b','g','r','s','m','f','d','x'])
  if(targetDmgMul(null,{kind:'creature',t:CREATURE.roach},wc)!==1)vsBug.push('wc:'+wc);
 ok('T26.F nothing in the roster hits a creature differently either'+(vsBug.length?' ('+vsBug.slice(0,4).join(', ')+')':''),vsBug.length===0);

 ok('T26.F the APC shield is untouched and stacks on top of the matrix, not instead of it',
    U.apc.cap===10&&U.apc.rad===.46);
}

/* ---------- G: wave survival damage is untouched ---------- */
{
 // v48 recut: with the Gunner back at 90 the run must reproduce THIS pinned trail
 // exactly - a determinism + price-coupling pin (the price feeds the AI's counter-
 // aware scoring, so it must still move the army). The original v43-vs-v45
 // isolation argument is history; the bug-column-inert property it once carried
 // is proven directly by the damage checks in F.
 // The Gunner's price also feeds RESEARCH.u_gunner (unlock cost and duration are
 // derived from unit cost at load), so both have to go back for a clean comparison.
 const keepC=U.gunner.cp, R=RESEARCH.u_gunner, keepR={cp:R.cp,ce:R.ce,time:R.time};
 U.gunner.cp=90;
 R.cp=rscale(90+U.gunner.ce*0.5);R.ce=rscale(Math.max(U.gunner.ce,90*0.45));R.time=rtime(90+U.gunner.ce);
 G=null;newGame(cfg45('desk','surv',424243,1));
 const got=[];for(let i=1;i<=2400;i++){update(DT45);if(i%90===0)got.push(hashState())}
 U.gunner.cp=keepC;R.cp=keepR.cp;R.ce=keepR.ce;R.time=keepR.time;
 ok('T26.G the Gunner-at-90 Desk trail reproduces the v54 baseline exactly',
    got.length===BASE43_DESK.length&&got.every((v,i)=>v===BASE43_DESK[i]));
 ok('T26.G ...and everything was put back afterwards',
    U.gunner.cp===125&&RESEARCH.u_gunner.cp===keepR.cp&&RESEARCH.u_gunner.time===keepR.time);
}

/* ---------- H: the Gunner ---------- */
{
 /* v88.1: 112 -> 125, and for the supply rank alone - v88's 25th trainable unit
    slid the quartile cut past him and put him back on 1 supply. The reload did NOT
    move with it this time, so unlike v78 this is a genuine efficiency cut. */
 ok('T26.H Machine Gunner costs 125 plastic since v88.1',U.gunner.cp===125&&U.gunner.ce===0);
 /* v78: hull, reload and price all moved together and the DAMAGE did not,
    which is the shape of the change - dm is still the v30 figure. */
 ok('T26.H the v78 hull and reload, and nothing else about him moved',
    U.gunner.dm===+(12*DMG_SCALE).toFixed(2)&&U.gunner.hp===Math.round(100*HP_SCALE)&&
    U.gunner.rt===.5&&U.gunner.rg===4&&U.gunner.entrench===1);
 const inf=Object.keys(U).filter(k=>U[k].a==='inf'&&U[k].dm>0&&U[k].cp>0);
 const perCost=k=>U[k].dm/U[k].rt/U[k].cp;
 const best=inf.slice().sort((a,b)=>perCost(b)-perCost(a));
 /* v65 widened this to 1.41x, v69 closed it to 1.16x, and v73 CROSSED it. The
    bound v69 wrote was two-sided precisely so a release that flattened his lead
    away would fire rather than pass, and that is what happened: -15% DPS puts the
    Flamethrower ahead of him by 1.0124x. The check is not loosened, it is
    re-aimed - same shape, same two-sided bound, new head of the table.
    Accepted rather than merely tolerated because the Flamethrower is
    TAN-EXCLUSIVE: for green, gray and blue the Gunner still leads their own
    infantry, which T50.C proves faction by faction. */
 /* v88.1 crosses it a second time and in the same direction: the price rise puts
    the plain Grunt ahead of him too, so he is THIRD. Re-aimed on the same rule
    v73's crossing was - same shape, same two-sided bound, new order - and the
    reason it is accepted rather than merely tolerated is unchanged and checked in
    T50.C: this measure cannot see Entrench or his hull, which are what he is for. */
 ok('T26.H the Flamethrower leads infantry damage per plastic, and the Gunner is third',
    best[0]==='flamer'&&best[1]==='grunt'&&best[2]==='gunner');
 ok(`T26.H the lead is the v88.1 figure (${(perCost(best[0])/perCost('gunner')).toFixed(4)}x, was 1.0124x at v73 and 1.1621x the other way at v69)`,
    Math.abs(perCost(best[0])/perCost('gunner')-1.1299)<0.005);
 ok('T26.H the Barracks still trains him',B.barracks.prod.includes('gunner'));
}

/* ---------- I: the info screen reads the sim ---------- */
{
 let threw=null, missingArmor=[];
 for(const k in U){
  try{
   const h=infoStatsHtml('unit',k);
   if(h.indexOf('Armor')<0||h.indexOf(ARMOR_LABEL[armorOf({kind:'unit',t:U[k]})])<0)missingArmor.push(k);
  }catch(e){threw=k+': '+e.message}
 }
 for(const k in B){try{infoStatsHtml('bld',k)}catch(e){threw=threw||('bld '+k+': '+e.message)}}
 ok('T26.I the info screen renders for every unit and every building'+(threw?' ('+threw+')':''),!threw);
 ok('T26.I ...and states an armor class for each'+(missingArmor.length?' ('+missingArmor.join(', ')+')':''),missingArmor.length===0);

 const gh=infoStatsHtml('unit','gunner');
 ok('T26.I the Gunner card shows the new price',gh.indexOf('125')>=0);
 const bh=infoStatsHtml('unit','bazooka');
 ok('T26.I a rocket unit is listed strong against armor and weak against infantry',
    bh.indexOf('Strong vs')>=0&&bh.indexOf('Weak vs')>=0&&
    bh.indexOf(ARMOR_LABEL.heavy)>=0&&bh.indexOf(ARMOR_LABEL.inf)>=0);
 const ph=infoStatsHtml('unit','para');
 ok('T26.I the paratrooper card lists all three of its weapons',
    ph.indexOf('SMG')>=0&&ph.indexOf('AT grenade')>=0&&ph.indexOf('HE charge')>=0);
 const th=infoStatsHtml('bld','guardtower');
 ok('T26.I an armed building lists its counters too',th.indexOf('Strong vs')>=0&&th.indexOf(ARMOR_LABEL.bldg)>=0);
 ok('T26.I an unarmed building lists no counters',infoStatsHtml('bld','turbine').indexOf('Strong vs')<0);

 // the readout is generated, so it cannot disagree with the sim
 let mism=[];
 for(const k in U){
  if(!(U[k].dm>0))continue;
  for(const ar of ARMOR_ORDER){
   const m=dmgMulFor(k,U[k].w,ar), listed=counterList(k,U[k].w,m>=1.05);
   if(m>=1.05&&listed.indexOf(ARMOR_LABEL[ar])<0)mism.push(k+'/'+ar);
   if(m<=0.95&&counterList(k,U[k].w,false).indexOf(ARMOR_LABEL[ar])<0)mism.push(k+'/'+ar);
  }
 }
 ok('T26.I every bonus and penalty in the grid appears in the readout'+(mism.length?' ('+mism.slice(0,5).join(', ')+')':''),mism.length===0);
}

/* ---------- J: determinism + snapshots with mixed arms in contact ---------- */
{
 // a deliberately mixed fight so every row of the matrix is exercised on the trail
 const stage=()=>{
  G=null;newGame(cfg45('kitchen','dm',450045,1));
  const me=G.players[0],foe=G.players[1];
  const put=(k,p,x,y)=>{const u=makeUnit(k,p,x,y);u.state='idle';u.anchor={x,y};return u};
  const cx=G.map.N/2, cy=G.map.N/2;
  ['grunt','gunner','bazooka','flamer','grenadier','sniper','mortar'].forEach((k,i)=>put(k,me,cx-3,cy-3+i*0.7));
  ['tank','jeep','bike','apc'].forEach((k,i)=>put(k,foe,cx+3,cy-2+i*0.9));
  put('heli',foe,cx+3,cy+2.5);put('apache',foe,cx+4,cy+2.5);
  put('tank',me,cx-4,cy+2);put('arty',me,cx-6,cy);
  for(const u of me.units)if(u.t.dm)orderMove(u,cx+3,cy,true);
  for(const u of foe.units)if(u.t.dm)orderMove(u,cx-3,cy,true);
 };
 const run=n=>{const t=[];for(let i=1;i<=n;i++){update(DT45);if(i%40===0)t.push(hashState())}return t};
 stage();const a=run(600);
 stage();const b=run(600);
 ok('T26.J a mixed-arms fight is deterministic across two runs',a.length===b.length&&a.every((h,i)=>h===b[i]));
 ok('T26.J ...and the fight actually happened',a.some((h,i)=>i&&h!==a[i-1]));

 stage();run(240);
 const snap=saveState(), h0=hashState();
 const cont=run(200);
 loadState(snap);
 ok('T26.J save/load restores the identical state',hashState()===h0);
 const cont2=run(200);
 ok('T26.J ...and resumes on the identical trail',cont.length===cont2.length&&cont.every((h,i)=>h===cont2[i]));
 ok('T26.J the snapshot carries a v45-or-later tag',parseFloat(JSON.parse(snap).v)>=45);
 ok('T26.J projectile shot classes survive the round trip',
    G.projs.every(p=>p.wc===undefined||typeof p.wc==='string'));
}
