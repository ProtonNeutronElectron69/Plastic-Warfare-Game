/* ================================================================================
   T32 - v51 THE AA MISSILE TRUCK, THE BULL'S SECOND WEAPON, AND TWO REBALANCES

   A: the roster entry, its derived research, and the constants that must NOT move
   B: the salvo - shape, cadence, and the fact that it is state, not a timer
   C: air-only targeting, enforced at BOTH locks (the target filter AND the table)
   D: the Bull's hull flamethrower firing at the same time as its cannon
   E: turret decoupling for a non-tank archetype, world render and portrait
   F: the two rebalance cells, pinned against a transcription of the v50 table
   G: hash / snapshot hygiene, determinism dual-run, save/load, purity lint
   H: the AI only reaches for an anti-air unit when there is air to shoot

   NEGATIVE CONTROL: run against v50 this section does not load at all (U.aatruck
   is undefined and A fails on the first line), which is the intended behaviour for
   a tail whose entire subject is new. The interesting negative control is the
   other direction and it already ran: before repin_v51, the v51 build produced
   exactly 27 failures in the existing tails, every one of them either a pinned
   trail or an assertion naming something this release deliberately edited, and
   ZERO of the 15 map-layout hashes moved.
   ================================================================================ */
section('T32 v51: AA missile truck, the Bull flamer, cannon/bazooka rebalance');

const DT51=1/30;
function cfg51(map,mode,seed,opp,fac){return{map,mode,diff:'normal',fac:fac||'green',opp:(opp==null?3:opp),seed}}
// a clear patch of ground with nothing else within `clr` tiles
function arena51(W,H,clr){return arena44(W,H,0,clr||10)}
function foeOf(){return G.players.find(p=>p!==G.human)}
function quiet51(){for(const mn of (G.map.mines||[]))mn.live=false;}

/* ---------- A: the roster entry ---------- */
{
 const t=U.aatruck;
 ok('T32.A the AA truck exists with its own archetype',!!t&&t.a==='aa'&&t.w==='a'&&t.aaOnly===1);
 ok('T32.A hull and price sit strictly between the MG Jeep and the Tank',
    U.jeep.hp<t.hp&&t.hp<U.tank.hp&&U.jeep.cp<t.cp&&t.cp<U.tank.cp&&U.jeep.ce<t.ce&&t.ce<U.tank.ce);
 ok('T32.A effective hull is 142 (jeep 101, tank 207)',t.hp===142&&U.jeep.hp===101&&U.tank.hp===207);
 ok('T32.A range 7, vision 6, speed 2.5, splash 1.125 after the v53 +25% pass',t.rg===7&&t.vi===6&&t.sp===2.5&&t.spl===1.125);
 ok('T32.A it outranges every aircraft in the game',
    Object.keys(U).filter(k=>U[k].fly&&U[k].rg>0).every(k=>U[k].rg<t.rg));
 ok('T32.A every army can build it, at the garage',
    B.garage.prod.includes('aatruck')&&prodBldOf('aatruck')==='garage'&&
    ['green','tan','gray','blue'].every(f=>techAvailable({fac:f},'u_aatruck'))&&
    researchBuilding('u_aatruck')==='garage');
 ok('T32.A its unlock is derived from cost like every other unit',
    RESEARCH.u_aatruck&&RESEARCH.u_aatruck.cp===rscale(t.cp+t.ce*0.5)&&
    RESEARCH.u_aatruck.ce===rscale(Math.max(t.ce,t.cp*0.45))&&RESEARCH.u_aatruck.time===rtime(t.cp+t.ce));
 ok('T32.A soft-skinned: it classes as a light vehicle, so ground troops answer it',
    armorOf({kind:'unit',t})==='light');
 // The medic heal rate is derived from the LOWEST dm/rt in the roster. A salvo unit
 // reads low on that formula, so this is the pin that stops a future salvo weapon
 // silently retuning every medic in the game.
 /* v85: the clause the derivation gained, mirrored here. This check fired when the
    Signal Runner landed, which is the whole reason it exists - a 5.0-DPS support
    man would have taken every Medic in the game from 2.089 HP/s to 1.30 in a
    release nobody thought was touching the Medic. */
 let lo=Infinity,who='';
 for(const k in U){const q=U[k];if(q.dm>0&&q.rt>0&&!q.heal&&!q.noPace){const d=q.dm/q.rt;if(d<lo){lo=d;who=k}}}
 ok('T32.A the Grunt is still the floor, so MEDIC_HEAL_RATE did not move',
    who==='grunt'&&Math.abs(MEDIC_HEAL_RATE-2.08936)<1e-4);
 /* ...and the exemption is LOAD-BEARING, not decorative: without it the floor
    really would move. A noPace that excluded nothing would leave the check above
    green while proving nothing, so the counterfactual is asserted outright. */
 {
  let lo2=Infinity,who2='';
  for(const k in U){const q=U[k];if(q.dm>0&&q.rt>0&&!q.heal){const d=q.dm/q.rt;if(d<lo2){lo2=d;who2=k}}}
  ok('T32.A MUTATION: drop the exemption and the Signal Runner becomes the floor',
     who2==='runner'&&lo2<lo);
  ok('T32.A ...and exactly one unit claims the exemption',
     Object.keys(U).filter(k=>U[k].noPace).length===1&&!!U.runner.noPace);
 }
}

/* ---------- B: the salvo ---------- */
{
 const t=U.aatruck;
 ok('T32.B salvo shape: 4 missiles 0.22s apart, then a 3s reload',t.sal===4&&t.srt===0.22&&t.rt===3);
 const cyc=t.rt+(t.sal-1)*t.srt;
 ok('T32.B unitDPS models the whole cycle, not the reload alone',
    Math.abs(unitDPS(t)-t.dm*t.sal/cyc)<1e-9&&unitDPS(t)>t.dm/t.rt);
 let same=true;
 for(const k in U){const q=U[k];if(q.sal)continue;if(q.rt>0&&Math.abs(unitDPS(q)-q.dm/q.rt)>1e-12)same=false}
 ok('T32.B unitDPS is exactly dm/rt for every non-salvo unit, so no existing number moved',same);
 ok('T32.B one salvo lands 105.41 effective damage on an aircraft',
    Math.abs(t.dm*t.sal*dmgMulFor('aatruck','a','air')-105.408)<0.01);

 // functional: four shots at srt, then one gap of rt.
 G=null;newGame(cfg51('backyard','dm',51001,1));quiet51();
 const A=arena51(2,2,12);
 const aa=makeUnit('aatruck',G.human,A.x,A.y);
 const heli=makeUnit('heli',foeOf(),A.x+3,A.y);
 heli.hp=heli.mhp=1e9;
 orderAttack(aa,heli);
 const gaps=[];let last=null;
 for(let i=1;i<=400;i++){
  const before=G.projs.length;
  G.tick++;updateUnit(aa,DT51);
  if(G.projs.length>before){if(last!==null)gaps.push(i-last);last=i;G.projs.length=0}
 }
 const intra=Math.round(0.22/DT51),reload=Math.round(3/DT51);
 const short=gaps.filter(g=>g<intra*2).length,long=gaps.filter(g=>g>reload*0.8).length;
 ok('T32.B it fires in bursts: many short gaps, a few long reloads',
    gaps.length>=7&&short>=6&&long>=1&&short>long*2);
 ok('T32.B the salvo counter is entity state, initialised from the table',
    aa.salv!=null&&aa.salv>=0&&aa.salv<U.aatruck.sal+1);
 const g2=makeUnit('grunt',G.human,A.x,A.y+1);
 ok('T32.B nothing but a salvo unit carries the counter',!('salv' in g2)&&!('salv' in heli));
}

/* ---------- C: air-only targeting, both locks ---------- */
{
 // LOCK 1, the target filter.
 G=null;newGame(cfg51('backyard','dm',51002,1));quiet51();
 const A=arena51(3,3,12),foe=foeOf();
 const aa=makeUnit('aatruck',G.human,A.x,A.y);
 const grunt=makeUnit('grunt',foe,A.x+2,A.y);
 const tank=makeUnit('tank',foe,A.x+2.5,A.y+0.5);
 ok('T32.C nothing on the ground is a valid acquisition, at any range',
    nearestEnemy(aa,20)===null);
 const heli=makeUnit('heli',foe,A.x+3,A.y+1);
 ok('T32.C a flyer in the same crowd IS acquired',nearestEnemy(aa,20)===heli);
 ok('T32.C every other unit still sees the ground normally',
    nearestEnemy(makeUnit('grunt',G.human,A.x,A.y+2),20)!==null);
 // structures
 const bld=makeBuilding('barracks',foe,Math.floor(A.x)+4,Math.floor(A.y)+4,true);
 G.units.splice(G.units.indexOf(heli),1);          // nearestEnemy scans the live list, not hp
 ok('T32.C a structure is never airborne, so it is never acquired',nearestEnemy(aa,30)===null&&bld.hp>0);
 G.units.push(heli);heli.hp=heli.mhp=1e9;

 // orders
 orderAttack(aa,tank);
 ok('T32.C an ordered ground attack is ignored outright, not converted into a charge',
    aa.target===null&&aa.state!=='attack');
 orderAttack(aa,heli);
 ok('T32.C an ordered air attack is taken',aa.target===heli&&aa.state==='attack');
 // the player path substitutes an attack-move so a mixed selection still behaves
 aa.target=null;aa.state='idle';
 execCmd({op:'attack',pi:G.human.i,a:{ids:[aa.id],tid:tank.id}});
 ok('T32.C a hand-issued ground order becomes an attack-move to the spot',
    aa.state==='amove'&&aa.dest&&Math.abs(aa.dest.x-tank.x)<1e-9);
 // retaliation must not drag it at its attacker
 aa.state='idle';aa.target=null;aa.dest=null;
 applyDmg(aa,5,'b',grunt);
 ok('T32.C being shot by infantry does not hand it a ground target',
    aa.target===null||!!(aa.target.t&&aa.target.t.fly));

 // LOCK 2, the table. Even if a shot reached the ground it would do nothing.
 const before={};
 for(const v of [grunt,tank,bld]){before[v.id]=v.hp}
 splash(grunt.x,grunt.y,3,500,'ex',aa,'a');
 ok('T32.C weapon row a does exactly zero to infantry, armor and structures',
    grunt.hp===before[grunt.id]&&tank.hp===before[tank.id]&&bld.hp===before[bld.id]);
 const h2=makeUnit('apache',foe,A.x+9,A.y+9);
 const hb=h2.hp;applyDmg(h2,10,'ex',aa,'a');
 ok('T32.C ...and 1.60x to anything flying',Math.abs((hb-h2.hp)-16)<1e-9);
 ok('T32.C the two locks are independent - neither alone is the rule',
    U.aatruck.aaOnly===1&&ARMOR_ORDER.every(c=>c==='air'||WVA.a[c]===0));
}

/* ---------- C2: flying wildlife, so it is not dead weight in survival ---------- */
{
 G=null;newGame(cfg51('desk','surv',51003,1));quiet51();
 const hq=G.human.blds.find(b=>b.key==='hq');
 const aa=makeUnit('aatruck',G.human,hq.x+2,hq.y+2);
 // hand-place one flyer and one walker next to it using the wave spawner's own table
 const mk=(sp,x,y)=>{const c={id:EID++,kind:'creature',species:sp,t:CREATURE[sp],p:G.neutral,x,y,
   hp:CREATURE[sp].hp,mhp:CREATURE[sp].hp,target:null,cool:0,face:0,wave:1};G.neutrals.push(c);return c};
 const ant=mk('ant',aa.x+1,aa.y),wasp=mk('wasp',aa.x+2,aa.y);
 ok('T32.C2 a walking creature is not a target, a flying one is',
    !!CREATURE.wasp.fly&&!CREATURE.ant.fly&&nearestEnemy(aa,20)===wasp);
 const wb=wasp.hp;applyDmg(wasp,10,'ex',aa,'a');
 ok('T32.C2 wildlife stays on the flat bug column - survival damage is untouched',
    Math.abs((wb-wasp.hp)-10)<1e-9&&WVA.a.bug===1);
 ok('T32.C2 the walker is still there, untouched',ant.hp===CREATURE.ant.hp);
}

/* ---------- D: the Bull's hull flamethrower ---------- */
{
 const sc=U.bulltank.sec;
 /* v88: the Bull is no longer alone. The Choktaw's door gun is the second `sec`
    row in the game and the FIRST that is not a flamethrower, which is what forced
    fireSec to read sc.w instead of assuming one. The count is pinned at two so a
    third still has to be declared here, and the Bull's own row is asserted
    UNCHANGED beside it - this release generalised the machinery and had to move
    none of the Bull's numbers to do it. */
 ok('T32.D the Bull carries a second weapon, and its row is untouched',
    !!sc&&sc.w==='f'&&sc.wc==='f'&&sc.rg===2.6&&sc.rt===0.55&&sc.k===0.15);
 ok('T32.D exactly two units carry one now, and the second is the Choktaw',
    Object.keys(U).filter(k=>U[k].sec).length===2&&!!U.choktaw.sec&&U.choktaw.sec.w==='b');
 ok('T32.D ...and fireSec branches on the ROW rather than assuming a flamethrower',
    /sc\.w===.b./.test(fireSec.toString()));

 G=null;newGame(cfg51('backyard','dm',51004,1,'tan'));quiet51();
 const A=arena51(3,3,14),foe=foeOf();
 const bull=makeUnit('bulltank',G.human,A.x,A.y);
 const inf=makeUnit('grunt',foe,A.x+1.6,A.y);          // inside 2.6, flamer range
 const tank=makeUnit('tank',foe,A.x+4.4,A.y);          // outside 2.6, inside cannon range 5
 // clear of BOTH the 2.6 flamer reach and the cannon's 1.0 splash around the tank
 const far=makeUnit('grunt',foe,A.x,A.y+3.2);
 for(const v of [inf,tank,far]){v.hp=v.mhp=99999}
 orderAttack(bull,tank);
 const h0={inf:inf.hp,tank:tank.hp,far:far.hp};
 // updateUnit alone fires the cannon but never resolves the shell, so drive the
 // projectile pass too. Deliberately NOT full update(): this isolates the Bull from
 // the AI and from the foes moving, which is the whole point of the fixture.
 for(let i=0;i<120;i++){G.tick++;updateUnit(bull,DT51);updateProjs(DT51)}
 ok('T32.D the cannon keeps its own target while the flamer burns another',
    tank.hp<h0.tank&&inf.hp<h0.inf&&bull.target===tank&&bull.target2===inf);
 ok('T32.D the flamer respects its own 2.6-tile reach',far.hp===h0.far);
 ok('T32.D the secondary has its own cooldown, not the cannon\u2019s',
    bull.cool2!=null&&bull.cool2<=U.bulltank.sec.rt+1e-9);

 // it burns wildlife too (the approved widening over the original spec)
 G=null;newGame(cfg51('desk','surv',51005,1,'tan'));quiet51();
 const hq=G.human.blds.find(b=>b.key==='hq');
 const b2=makeUnit('bulltank',G.human,hq.x+3,hq.y+3);
 const mk=(sp,x,y)=>{const c={id:EID++,kind:'creature',species:sp,t:CREATURE[sp],p:G.neutral,x,y,
   hp:CREATURE[sp].hp,mhp:CREATURE[sp].hp,target:null,cool:0,face:0,wave:1};G.neutrals.push(c);return c};
 const roach=mk('roach',b2.x+1.4,b2.y);
 const rh=roach.hp;
 for(let i=0;i<60;i++){G.tick++;updateUnit(b2,DT51)}
 ok('T32.D the hull flamer engages wildlife as well as infantry',roach.hp<rh);

 // damage rides the unit's faction/vet-modified dm, exactly like PARA_MUN.k
 const gr=U.bulltank.dm*sc.k*dmgMulFor('bulltank','f','inf');
 ok('T32.D flame damage is a fraction of the unit\u2019s own damage, so upgrades ride along',
    Math.abs(gr-U.bulltank.dm*0.15*1.35)<1e-9&&fireSec.toString().includes('u.dm*sc.k'));
 ok('T32.D the flamer scores on row f and the cannon still scores on row s',
    dmgMulFor('bulltank','f','inf')===1.35&&dmgMulFor('bulltank','s','inf')===0.72);
 ok('T32.D a Bull is now clearly better against infantry than a plain Tank, which is the point',
    (U.bulltank.dm*dmgMulFor('bulltank','s','inf')/U.bulltank.rt)+(U.bulltank.dm*sc.k*1.35/sc.rt)>
    (U.tank.dm*dmgMulFor('tank','s','inf')/U.tank.rt));
 const g3=makeUnit('grunt',G.human,hq.x+1,hq.y+1);
 ok('T32.D no secondary state is written onto a unit that has no secondary',
    !('cool2' in g3)&&!('target2' in g3)&&('cool2' in b2)&&('target2' in b2));
}

/* ---------- E: turret decoupling on a non-tank archetype ---------- */
{
 ok('T32.E turreted() covers both tanks and the AA truck, and nothing else',
    turreted(U.tank)&&turreted(U.bulltank)&&turreted(U.aatruck)&&
    Object.keys(U).filter(k=>turreted(U[k])).length===3);
 ok('T32.E it has its own slew rate',TURR_SLEW.aatruck>0);

 G=null;newGame(cfg51('backyard','dm',51006,1));quiet51();
 const A=arena51(2,2,12),foe=foeOf();
 const aa=makeUnit('aatruck',G.human,A.x,A.y);
 const heli=makeUnit('heli',foe,A.x,A.y+4);            // due "south" of the truck
 heli.hp=heli.mhp=99999;
 aa.face=0;                                            // hull pointing "east"
 const hullBefore=aa.face;
 orderAttack(aa,heli);
 for(let i=0;i<10;i++)updateUnit(aa,DT51);
 ok('T32.E firing does not snap the hull round',aa.face===hullBefore);
 ok('T32.E the turret aim tracks the target on its own',
    Math.abs(aa.tface-datan2(heli.y-aa.y,heli.x-aa.x))<1e-9&&Math.abs(aa.tface-aa.face)>0.5);
 ok('T32.E the cosmetic angle is never hashed and never serialized',
    !hashState.toString().includes('u.tvis')&&SNAP_ENT_SKIP.has('tvis'));

 // render: the hull bakes without the rack, the rack paints live, the portrait has both
 // Functional split: record every colour each painter fills with. The red missile tip
 // must come from the RACK and must be absent from the baked hull, which is what makes
 // an independent swivel possible at all. Source-text checks were tried first and were
 // useless here - the hull branch's own comment names aaTurret.
 function fillsOf(paint){
  const got=[];
  const rec=new Proxy({},{
   get(){return()=>({addColorStop(){}})},
   set(o,k,v){if(k==='fillStyle')got.push(String(v));return true}
  });
  paint(rec);return got;
 }
 const hullFills=fillsOf(c=>vehBody(c,'aatruck','#4caf50'));
 const rackFills=fillsOf(c=>aaTurret(c,'#4caf50'));
 ok('T32.E the red missile tips are painted by the rack and are absent from the baked hull',
    rackFills.includes('#d8352a')&&!hullFills.includes('#d8352a')&&hullFills.length>6&&rackFills.length>6);
 ok('T32.E the hull still bakes its own chassis, radar dish and cab glass',
    hullFills.includes('#23232a')&&hullFills.includes('#b9bec6')&&hullFills.includes('#bfe9ff')&&
    drawUnit.toString().includes('aaTurret('));
 ok('T32.E both halves carry team colour, so the faction reads whichever way the rack points',
    hullFills.some(v=>v==='rgb(76,175,80)')&&rackFills.includes('#4caf50'));
 ok('T32.E the rack pivots behind the cab, not on the sprite origin',AA_PIVOT===-3.5);
 const bx=vehPortraitBox('aatruck');
 ok('T32.E the rack at bake orientation fits inside the portrait box',
    AA_PIVOT+11.3<=bx.x1&&AA_PIVOT-4.6>=bx.x0&&6.4<=bx.y1);
 // the v49 portrait painter must composite exactly one rack for the AA truck and none elsewhere
 ok('T32.E the rack paints all four tubes, so the salvo count reads off the model',
    rackFills.filter(v=>v==='#d8352a').length===U.aatruck.sal);
 ok('T32.E TURR_PORTRAIT lists it, so both portrait paths composite the rack',
    TURR_PORTRAIT.aatruck===1&&vehPortraitPaint.toString().includes('aaTurret'));
}

/* ---------- F: the two rebalance cells, and ONLY those two ---------- */
{
 // transcription of the v50 table, so this fails loudly if any other cell drifted
 const V50={
  b:{inf:1.00,light:1.00,medium:0.85,heavy:0.60,air:1.00,bldg:0.70,bug:1.00},
  g:{inf:1.20,light:1.00,medium:0.85,heavy:0.55,air:0.45,bldg:0.80,bug:1.00},
  r:{inf:0.70,light:1.10,medium:1.35,heavy:1.50,air:1.30,bldg:0.90,bug:1.00},
  s:{inf:0.80,light:1.10,medium:1.20,heavy:1.10,air:0.85,bldg:1.40,bug:1.00},
  m:{inf:1.15,light:1.00,medium:0.90,heavy:0.70,air:0.40,bldg:1.45,bug:1.00},
  f:{inf:1.35,light:1.05,medium:0.75,heavy:0.45,air:0.50,bldg:0.90,bug:1.00},
  d:{inf:0.70,light:0.80,medium:0.80,heavy:0.85,air:0.30,bldg:1.25,bug:1.00},
  x:{inf:1.00,light:1.00,medium:1.00,heavy:1.00,air:1.00,bldg:1.00,bug:1.00}
 };
 const moved=[];
 for(const w in V50)for(const c in V50[w])if(WVA[w][c]!==V50[w][c])moved.push(w+'/'+c+' '+V50[w][c]+'->'+WVA[w][c]);
 ok('T32.F exactly one WVA cell moved from v50, and it is cannon vs infantry'+(moved.length?' ('+moved.join(', ')+')':''),
    moved.length===1&&moved[0].startsWith('s/inf'));
 ok('T32.F cannon vs infantry is exactly 10% off the v50 value',Math.abs(WVA.s.inf-0.80*0.9)<1e-9);
 ok('T32.F it applies to the Tank and the Bull, which are the only cannon in the game',
    Object.keys(U).filter(k=>U[k].w==='s').sort().join()==='bulltank,tank');
 ok('T32.F bazooka vs heavy is exactly 10% above the v50 value',Math.abs(UVA.bazooka.heavy-1.60*1.1)<1e-9);
 ok('T32.F the buff is the bazooka\u2019s alone: the generic rocket row and its other cells are untouched',
    WVA.r.heavy===1.50&&dmgMulFor('apache','r','heavy')===1.50&&dmgMulFor('bazooka','r','medium')===1.35);
 // UVA is the override layer and is NOT held to the 0.25..1.6 band WVA rows are,
 // but it still needs a ceiling or the layer becomes a place to hide anything.
 let hi=0;for(const k in UVA)for(const c in UVA[k])if(c!=='w')hi=Math.max(hi,UVA[k][c]);
 ok('T32.F no override exceeds the 1.80 ceiling the bazooka buff moved us to',hi<=1.80&&hi===1.76);
}

/* ---------- G: hash, snapshot, determinism ---------- */
{
 const hs=hashState.toString();
 ok('T32.G the salvo counter and the secondary cooldown are hashed',
    hs.includes('u.salv')&&hs.includes('u.cool2'));
 ok('T32.G the secondary TARGET is not hashed, matching how u.target is handled',
    !hs.includes('u.target2'));
 ok('T32.G the secondary target is serialized, through the ref encoder',
    !SNAP_ENT_SKIP.has('target2')&&typeof _uRefs.target2==='function');

 // a scripted match with both new weapons hot, run twice
 function run51(ticks){
  G=null;newGame(cfg51('backyard','dm',51007,1,'tan'));quiet51();
  const A=arena51(3,3,14),foe=foeOf();
  const aa=makeUnit('aatruck',G.human,A.x,A.y);
  const bull=makeUnit('bulltank',G.human,A.x+1,A.y+1);
  const heli=makeUnit('heli',foe,A.x+3,A.y);
  const inf=makeUnit('grunt',foe,A.x+2,A.y+1);
  orderAttack(aa,heli);orderAttack(bull,inf);
  const tr=[];for(let i=1;i<=ticks;i++){update(DT51);if(i%60===0)tr.push(hashState())}
  return tr;
 }
 const r1=run51(600),r2=run51(600);
 ok('T32.G a firing AA truck and a flaming Bull replay bit-identically',
    r1.length===10&&r1.every((v,i)=>v===r2[i]));

 // save/load with both live
 G=null;newGame(cfg51('backyard','dm',51007,1,'tan'));quiet51();
 {
  const A=arena51(3,3,14),foe=foeOf();
  const aa=makeUnit('aatruck',G.human,A.x,A.y);
  const bull=makeUnit('bulltank',G.human,A.x+1,A.y+1);
  const heli=makeUnit('heli',foe,A.x+3,A.y);
  const inf=makeUnit('grunt',foe,A.x+2,A.y+1);
  orderAttack(aa,heli);orderAttack(bull,inf);
  for(let i=0;i<200;i++)update(DT51);
  const blob=saveState(),h0=hashState();
  const contd=[];for(let i=0;i<180;i++){update(DT51);contd.push(hashState())}
  loadState(blob);
  ok('T32.G the snapshot restores to the same hash',hashState()===h0);
  const b2=G.units.find(u=>u.key==='bulltank'),a2=G.units.find(u=>u.key==='aatruck');
  ok('T32.G the secondary target survives the round trip as a live reference',
     !!b2&&(b2.target2===null||G.units.includes(b2.target2)||(G.neutrals||[]).includes(b2.target2)));
  ok('T32.G the salvo counter survives the round trip',!!a2&&a2.salv!=null);
  const after=[];for(let i=0;i<180;i++){update(DT51);after.push(hashState())}
  ok('T32.G and the resumed trail is bit-identical',after.every((v,i)=>v===contd[i]));
  // the v28 'seen' trap: a unit that never had target2 must not GAIN it on load
  ok('T32.G loading does not stamp target2 onto units that never had one',
     G.units.filter(u=>!u.t.sec).every(u=>!('target2' in u)));
  ok('T32.G snapshot tag is monotonic and at least 51',JSON.parse(blob).v>=51);
 }

 const BANNED=['Math.random','Math.hypot','Math.atan2','Math.sin(','Math.cos(','Date.now','performance.now'];
 const dirty=[];
 for(const [n,f] of [['turreted',turreted],['aaOk',aaOk],['unitDPS',unitDPS],['secValid',secValid],
                     ['nearestSec',nearestSec],['fireSec',fireSec],['updateSec',updateSec]]){
  const src=f.toString();for(const b of BANNED)if(src.includes(b))dirty.push(n+' uses '+b);
 }
 ok('T32.G the seven new sim functions use only deterministic math'+(dirty.length?' ('+dirty.join('; ')+')':''),
    dirty.length===0);
 ok('T32.G the secondary repath cadence keys on the tick and the unit id, never a clock',
    updateSec.toString().includes('G.tick%5===u.id%5'));
 ok('T32.G distance in the secondary goes through dhyp',
    updateSec.toString().includes('dhyp(')&&!updateSec.toString().includes('Math.hypot'));
}

/* ---------- H: the AI reaches for it only when there is air to shoot ---------- */
{
 ok('T32.H the unlock is on the research plan',aiResearch.toString().includes('u_aatruck'));
 ok('T32.H the anti-air floor now admits the dedicated row',
    aiPickUnit.toString().includes("'brsa'"));
 ok('T32.H the armor mix is read BEFORE the exploration draw, so an air-blind bot cannot roll one',
    aiPickUnit.toString().indexOf('aiFoeArmorMix')<aiPickUnit.toString().indexOf('srand()<AI_EXPLORE'));

 G=null;newGame(cfg51('backyard','dm',51008,1));quiet51();
 const p=G.players.find(q=>q.ai)||G.players[1];
 p.ai=p.ai||makeAIBrain('balanced');
 const foe=G.players.find(q=>q!==p);
 p.ai.grudge=foe;p.res.p=99999;p.res.e=99999;
 const OPTS=['grunt','tank','aatruck','bazooka'];
 // an all-ground foe: the AA truck must never come out, across many draws
 foe.units.length=0;
 for(let i=0;i<8;i++)makeUnit('grunt',foe,10+i*0.3,10);
 let picked=0;for(let i=0;i<300;i++)if(aiPickUnit(p,AI_PROFILES.balanced,OPTS)==='aatruck')picked++;
 ok('T32.H against an all-ground army it is never picked, not even by the 15% exploration draw',picked===0);
 // an air-heavy foe: now it should be the preferred answer
 foe.units.length=0;
 for(let i=0;i<8;i++)makeUnit('heli',foe,10+i*0.3,10);
 let picked2=0;for(let i=0;i<300;i++)if(aiPickUnit(p,AI_PROFILES.balanced,OPTS)==='aatruck')picked2++;
 ok('T32.H against an air-heavy army it becomes the dominant pick',picked2>200);
 ok('T32.H it is scored on its salvo, not on dm/rt',aiPickUnit.toString().includes('unitDPS(t)'));
}
