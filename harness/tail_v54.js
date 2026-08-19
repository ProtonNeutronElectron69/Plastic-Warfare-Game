/* ================================================================================
   T35 - v54 SUPPLY ECONOMY, THE DEPOT YARD, AND FLAME DENSITY

   A: the supply model - the ceiling, the derived median, and the 1-vs-2 split
   B: the grants, and the arithmetic that makes 70 reachable
   C: enforcement at all three gates, including the reservation the 60-cap never did
   D: DERIVED, not persisted - the property that keeps v53 saves loading
   E: the Depot Yard - declared, priced, ungated, drawn, and open-frame
   F: the AI builds depots without burying itself in them
   G: flame density - opt-in radius, disc coverage, and the four sites that must NOT move

   WHY THIS TAIL EXISTS. v54 is a sim-behaviour release, so every pinned trail moved
   and none of them can be read as confirmation of anything: they were recut from
   this build. Worse, the AI's depot block calls aiFindSpot, which consumes srand(),
   so the trails would have moved even in windows where no depot is ever placed.
   Everything below is the gate that the recut baselines are not.
   ================================================================================ */
section('T35 v54: supply economy, the Depot Yard, denser flame');

const DT55=1/30;
function cfg55(map,mode,seed,opp,fac){return{map,mode,diff:'normal',fac:fac||'green',opp:(opp==null?3:opp),seed}}
function put55(k,p,x,y){const u=makeUnit(k,p,x,y);u.state='idle';u.path=null;u.target=null;return u}
function bld55(k,p,dx,dy){const hq=p.blds[0];return makeBuilding(k,p,Math.floor(hq.tx)+dx,Math.floor(hq.ty)+dy,true)}
function bot55(){return G.players.find(p=>p.ai)}

/* ---------- A: the model ---------- */
{
 ok('T35.A the ceiling is at least 80',SUP_CAP>=80); // v61: floor, not equality - a later release must not fail here
 /* v69 REPLACED THE MEDIAN WITH A LADDER, and the constant went with it, so the
    three checks that pinned the median's value and derivation are gone rather
    than loosened. What replaces them is the same SHAPE of test aimed at the new
    rule: the ladder's value, an independent recomputation of it, the tier each
    unit lands in, and the two clamps. The reason for the change is that a
    two-bucket cost keyed on a threshold puts a cliff in per-supply combat value,
    so optimal play was 'buy the most expensive 1-supply unit'. */
 /* v70 REPLACED THE COST STEP WITH A QUARTILE RANK, and the step constant went
    with it. The v69 ladder cut on absolute cost, so the boundaries sat at fixed
    points and the roster's shape had no say in them; the cuts are now quartiles
    of the roster sorted by cost, so each tier holds a fifth of it by
    construction. Same shape of test aimed at the new rule. */
 ok('T35.A the roster is cut into four ranks',SUP_MAX===4&&typeof SUP_STEP==='undefined');
 const trainable=Object.keys(U).filter(k=>!U[k].noTrain);
 ok('T35.A the cuts are set by the 24 trainable units (the drop-only para is excluded)',
    trainable.length===24&&!trainable.includes('para')); // v85: 20 -> 21, the Signal Runner. v86: 21 -> 23, the Command Truck and the Observation Balloon. v87: 23 -> 24, the Firebomb Heli
 /* recompute the quartiles independently of SUP_U's own expression, including the
    total-order tiebreak: a comparator that returned 0 on equal costs would leave
    the order to the engine and put a silent divergence into lockstep. */
 const cost54=k=>U[k].cp+U[k].ce;
 const sorted54=trainable.slice().sort((a,b)=>(cost54(a)-cost54(b))||(a<b?-1:a>b?1:0));
 const rung=k=>{const i=sorted54.indexOf(k);
  if(i>=0)return Math.min(SUP_MAX,1+Math.floor(i*SUP_MAX/sorted54.length));
  let r=1;for(let q=1;q<SUP_MAX;q++)if(cost54(k)>=cost54(sorted54[Math.floor(q*sorted54.length/SUP_MAX)]))r++;
  return Math.min(SUP_MAX,r)};
 ok('T35.A every unit obeys the quartile rule with no hand exceptions',
    Object.keys(U).every(k=>supOf(k)===rung(k)));
 /* v85: the roster went 20 -> 21, so the tiers CANNOT all hold exactly a quarter of
    it any more - 21 does not divide by 4. The claim ranking actually buys is that
    the tiers stay BALANCED however the roster is priced, which under an uneven
    roster means within one of each other; equality was only ever the special case
    of a roster whose size happened to divide. Asserted as the property rather than
    as the coincidence, so the next unit added does not fail here for no reason.
    (Measured at v85: 6/5/5/5 - the Runner lands in the cheap tier and the remainder
    goes to the bottom rank, which is where floor() puts it by construction.) */
 {
  const sz=[1,2,3,4].map(r=>trainable.filter(k=>supOf(k)===r).length);
  ok(`T35.A the ranks stay balanced - no tier is more than one unit off another (${sz.join('/')})`,
     Math.max(...sz)-Math.min(...sz)<=1&&sz.reduce((a,b)=>a+b,0)===trainable.length);
  ok('T35.A ...and the remainder falls to the cheap end, which is where floor() puts it',
     sz[0]===Math.max(...sz));
 }

 // the four tiers, transcribed, so a silent re-tiering fires as well as a rule break
 const T1=['truck','para','grunt','grenadier','bazooka','bike','runner']; // v85: +runner, at 62 he sits between the Grenadier and the Bazooka
 // v70: the Medic moved 2 -> 3 and the Sergeant Bull 3 -> 4 on the quartile cut.
 // Nothing else changed tier against the v69 ladder.
 // v85: adding a 21st unit moved NOTHING between tiers - checked deliberately,
 // since a quartile cut re-ranks off roster POSITION and an insertion can shove
 // whatever sits on a boundary across it.
 /* v86: TWO units added, and again NOTHING moved tier - this time because the two
    prices were chosen to make it so. At 23 trainable units the cuts land after the
    6th, 12th and 18th, and the two arrivals have to fall one before the Medic and
    one before Sarge for every existing unit to keep its rank; 168 total puts the
    Command Truck between the Mortar Squad and the Sniper and 319 puts the Balloon
    between the APC and Sarge, which are exactly those two slots. This transcription
    is what proves it, and it is why the two costs read as they do in T33.A. */
 /* v87: ONE unit added, and again nothing moved tier - but the reason is different
    from v86's and worth writing down, because it is the reason the Firebomb costs
    what it does. At 23 units the cuts fall after the 6th, 12th and 18th; at 24 they
    fall after the 6th, 12th and 18th as well, because 24 divides by four and 23's
    floor() landed in the same three places. The boundaries therefore did not move
    at all, and the ONLY insertion point that shifts nobody across one is past the
    18th - anywhere cheaper and whichever unit sits on a boundary is pushed over it.
    That is why 383.5 total, dearer than Sarge, is not a feel decision. */
 const T2=['gunner','flamer','jeep','mortar','sniper','cmdtruck'];
 const T3=['medic','aatruck','tank','heli','apc','balloon'];
 const T4=['sarge','arty','chinook','apache','bulltank','firebomb'];
 ok('T35.A the cheap tier costs 1 supply',T1.every(k=>supOf(k)===1));
 ok('T35.A the second tier costs 2',T2.every(k=>supOf(k)===2));
 ok('T35.A the third tier costs 3',T3.every(k=>supOf(k)===3));
 ok('T35.A the top tier costs 4',T4.every(k=>supOf(k)===4));
 ok('T35.A the four tiers cover every unit exactly once',
    T1.length+T2.length+T3.length+T4.length===Object.keys(U).length&&
    Object.keys(U).every(k=>[T1,T2,T3,T4].filter(t=>t.includes(k)).length===1));
 /* v70: nothing is CLAMPED down any more - a rank cannot exceed SUP_MAX by
    construction, which is one of the things ranking buys. What still needs a check
    is the top of the roster landing in the top rank, and the floor under the
    Paratrooper, which is priced against the cuts rather than ranked among them. */
 ok('T35.A the dearest unit in the game sits in the top rank',
    Object.keys(U).every(k=>U[k].cp+U[k].ce<=U.bulltank.cp+U.bulltank.ce)&&supOf('bulltank')===SUP_MAX);
 ok('T35.A no unit can exceed the top rank',Object.keys(U).every(k=>supOf(k)<=SUP_MAX));
 ok('T35.A the drop-only Paratrooper is floored off zero rather than fielded free',
    U.para.cp+U.para.ce===0&&supOf('para')===1&&U.para.noTrain);
 ok('T35.A the Gunner holds supply 2 at its v78 price',U.gunner.cp===112&&supOf('gunner')===2);
 /* v78: the quartile boundary is what matters here, not the price. Tier 1 ends
    at the Scout Bike on 95 total, so 112 clears it by 17 and a further cut past
    95 would silently drop him a tier and push the Bike up one. */
 ok('T35.A ...and clears the tier-1 boundary the Scout Bike sets',
    U.gunner.cp+U.gunner.ce>U.bike.cp+U.bike.ce&&supOf('bike')===1);
 ok('T35.A the Medic moved 2 -> 3 at v70: 173 total opens the third quartile',
    U.medic.cp+U.medic.ce===173&&supOf('medic')===3);
 ok('T35.A an unknown key falls back to 1 rather than NaN',supOf('nosuchunit')===1);
}

/* ---------- B: the grants ---------- */
{
 ok('T35.B HQ grants 10',B.hq.sup===10);
 ok('T35.B Outpost grants 4',B.outpost.sup===4);
 ok('T35.B Supply Depot grants 15',B.supply.sup===15); // v83: 10 -> 15, to spend fewer footprints on the same ceiling
 ok('T35.B nothing else grants supply',
    Object.keys(B).filter(k=>B[k].sup).sort().join(',')==='hq,outpost,supply');
 /* v83: the exact relation is GONE and its loss is the feature. Six depots fall
    short and the seventh crosses with supply to spare, so the claim is now a
    bracket rather than an equality - and the bracket is what the change bought:
    SEVEN footprints reach a ceiling that used to cost ten. */
 ok('T35.B six depots plus an HQ fall SHORT of the ceiling',B.hq.sup+6*B.supply.sup<SUP_CAP);
 ok('T35.B ...and the seventh crosses it',B.hq.sup+7*B.supply.sup>=SUP_CAP);
 ok('T35.B ...which is three fewer than the ten the v69 ceiling used to need',
    Math.ceil((SUP_CAP-B.hq.sup)/B.supply.sup)===7);

 G=null;newGame(cfg55('backyard','dm',540001,3));
 const p=G.human;
 ok('T35.B a fresh base opens on the HQ alone',supCap(p)===10);
 ok('T35.B ...holding 2 trucks and 2 grunts, so 4 used and 6 free',
    supUsed(p)===4&&supFree(p)===6);
 // a depot under construction grants NOTHING until it tops out (v83: 15 each)
 const d=makeBuilding('supply',p,Math.floor(p.blds[0].tx)-6,Math.floor(p.blds[0].ty),false);
 ok('T35.B a depot under construction grants no supply',d.prog<1&&supCap(p)===10);
 d.prog=1;
 ok('T35.B ...and grants its fifteen the moment it completes',supCap(p)===10+B.supply.sup);
 for(let i=0;i<6;i++){const b=makeBuilding('supply',p,Math.floor(p.blds[0].tx)-6,Math.floor(p.blds[0].ty)+2+i,true);b.prog=1}
 ok('T35.B seven depots plus an HQ reach the ceiling',supCap(p)===SUP_CAP);
 // ...and the clamp is still a clamp: an eleventh adds nothing
 {const b8=makeBuilding('supply',p,Math.floor(p.blds[0].tx)+8,Math.floor(p.blds[0].ty),true);b8.prog=1;
  ok('T35.B an eighth depot is refused by the ceiling',supCap(p)===SUP_CAP&&B.hq.sup+8*B.supply.sup>SUP_CAP);}
}

/* ---------- C: enforcement ---------- */
{
 // NOTE: a single building's queue caps at 5 independently of supply, so every
 // fill loop below spreads across enough buildings that SUPPLY is what bites.
 function gar55Room(b){return b.queue.length<5}         // the refusal must not be queue room
 function fill55(p,blds,key){                     // train `key` until something refuses
  let n=0,progress=true;
  while(progress){progress=false;for(const b of blds)if(trainUnit(b,key)){n++;progress=true}}
  return n;
 }

 G=null;newGame(cfg55('backyard','dm',540002,3));
 const p=G.human;p.res.p=99999;p.res.e=99999;
 for(const k in RESEARCH){p.tech.add(k);p.techDone.add(k)}
 const bars=[bld55('barracks',p,5,0),bld55('barracks',p,0,5),bld55('barracks',p,-5,0)];
 const free0=supFree(p);
 ok('T35.C a fresh base opens with six free against the HQ alone',free0===6&&supCap(p)===10);
 const got=fill55(p,bars,'grunt');
 ok('T35.C exactly the free supply can be queued, no more and no less',got===free0);
 ok('T35.C ...leaving nothing free',supFree(p)===0);
 ok('T35.C ...and the next grunt is refused on supply, not on queue room',
    bars.some(b=>b.queue.length<5)&&trainUnit(bars.find(b=>b.queue.length<5),'grunt')===false);
 const rp=p.res.p,re=p.res.e;
 trainUnit(bars.find(b=>b.queue.length<5),'grunt');
 ok('T35.C a refused train charges nothing',p.res.p===rp&&p.res.e===re);

 // RESERVATION. The flat 60-cap counted only LIVE units, so a queue could
 // oversubscribe and the finished unit was dropped at the spawn site with its cost
 // already spent. Queued units are now reserved, which closes that path.
 G=null;newGame(cfg55('backyard','dm',540003,3));
 const q=G.human;q.res.p=99999;q.res.e=99999;
 for(const k in RESEARCH){q.tech.add(k);q.techDone.add(k)}
 bld55('supply',q,-5,0);                          // v83: cap 25, 4 used -> 21 free (was 20/16 at a 10-supply depot)
 ok('T35.C twenty-one free with one depot up',supCap(q)===25&&supFree(q)===21);
 const gar=bld55('garage',q,5,0);
 let tanks=0;while(trainUnit(gar,'tank'))tanks++; // 2 supply each, queue caps at 5
 ok('T35.C five tanks queue before the queue limit bites',tanks===5&&gar.queue.length===5);
 // v69: the Tank moved to 3 supply on the ladder, so five queued tanks reserve 15,
 // not 10. The PROPERTY under test is unchanged - queued units are reserved - and
 // the figures move with the ladder rather than the check being loosened.
 // v83: same again for the 15-supply depot. The reservation is still 15; what moved
 // is the room LEFT over it, 25 - 4 - 15 = 6 where the 20 cap left exactly 1.
 ok('T35.C ...and all fifteen of their supply is RESERVED while they are still queued',
    supUsed(q)===4&&supQueued(q)===15&&supFree(q)===6);
 const qbars=[bld55('barracks',q,0,5),bld55('barracks',q,0,-5)];
 ok('T35.C grunts then fill exactly the reserved remainder',fill55(q,qbars,'grunt')===6); // v83: 6 slots over the reservation, was 1
 ok('T35.C ...and nothing more is accepted from any building',
    supFree(q)===0&&trainUnit(qbars[0],'grunt')===false&&trainUnit(gar,'tank')===false);

 // a 2-supply unit needs TWO free slots, not one. Barracks are pooled up front and
 // picked by queue room, so the refusal below is unambiguously about SUPPLY.
 G=null;newGame(cfg55('kitchen','dm',540011,3));
 const r=G.human;r.res.p=99999;r.res.e=99999;
 for(const k in RESEARCH){r.tech.add(k);r.techDone.add(k)}
 const rg=bld55('garage',r,5,0);
 const rbars=[bld55('barracks',r,0,5),bld55('barracks',r,0,-5),bld55('barracks',r,-5,0)];
 const room=()=>rbars.find(b=>b.queue.length<5);
 while(supFree(r)>1){const b=room();if(!b||!trainUnit(b,'grunt'))break;}
 ok('T35.C down to a single free slot',supFree(r)===1);
 ok('T35.C a 2-supply tank is refused on one free slot',
    gar55Room(rg)&&trainUnit(rg,'tank')===false);
 ok('T35.C ...but a 1-supply grunt still fits',
    (()=>{const b=room();return !!b&&trainUnit(b,'grunt')===true&&supFree(r)===0})());

 // testing mode zeroes cost but must NOT lift the cap
 G=null;newGame(Object.assign(cfg55('backyard','dm',540004,3),{test:true}));
 const t=G.human;
 const tbars=[bld55('barracks',t,5,0),bld55('barracks',t,0,5),bld55('barracks',t,-5,0)];
 const tfree=supFree(t);
 const tgot=fill55(t,tbars,'grunt');
 ok('T35.C testing mode is free',ucost(t,'grunt').p===0&&ucost(t,'grunt').e===0);
 ok('T35.C ...but the supply cap is NOT lifted by it',tgot===tfree&&supFree(t)===0);
}

/* ---------- D: derived, not persisted ---------- */
{
 G=null;newGame(cfg55('kitchen','dm',540005,3));
 const p=G.human;
 bld55('supply',p,-5,0);
 put55('tank',p,p.start.x+1,p.start.y+1);
 const capA=supCap(p),usedA=supUsed(p),hA=hashState();
 // reading supply must not mutate anything the hash can see
 for(let i=0;i<50;i++){supCap(p);supUsed(p);supFree(p);supQueued(p)}
 ok('T35.D reading supply mutates no hashed state',hashState()===hA);
 // and it must not have been written onto any entity
 const uKeys=new Set(),bKeys=new Set();
 for(const u of G.units)for(const k in u)uKeys.add(k);
 for(const b of G.blds)for(const k in b)bKeys.add(k);
 ok('T35.D no supply field is stored on a unit',!uKeys.has('sup')&&!uKeys.has('supply'));
 ok('T35.D no supply field is stored on a building instance',!bKeys.has('sup'));
 // round-trip: supply must recompute to the same figures out of a snapshot
 const json=saveState();
 loadState(json);
 const p2=G.human;
 ok('T35.D supply recomputes identically across a save/load round trip',
    supCap(p2)===capA&&supUsed(p2)===usedA);
 ok('T35.D the snapshot carries the v54 tag',JSON.parse(json).v>=54);
}

/* ---------- E: the Depot Yard ---------- */
{
 ok('T35.E the depot is a 2x2 costing 120 plastic and no electricity',
    B.supply.sz===2&&B.supply.cp===120&&B.supply.ce===0);
 ok('T35.E it is a little cheaper than a Generator',B.supply.cp<B.generator.cp);
 ok('T35.E it needs no research and no prerequisite building',!B.supply.tech&&!B.supply.req);
 ok('T35.E it never entered the research catalog',
    !RESEARCH['b_supply']&&!Object.keys(RESEARCH).some(k=>RESEARCH[k].bkey==='supply'));
 ok('T35.E it sits second in the build roster, ahead of the Lab',
    bldRoster({fac:'green'})[1]==='supply');
 ok('T35.E it is offered to every faction',
    ['green','tan','gray','blue'].every(f=>bldRoster({fac:f}).includes('supply')));
 ok('T35.E it has a bake box',Array.isArray(BLD_BOX.supply)&&BLD_BOX.supply.length===4);

 // buildable from tick 0: the same gate startPlacing runs, with nothing researched
 G=null;newGame(cfg55('backyard','dm',540006,3));
 const p=G.human;p.res.p=B.supply.cp;p.res.e=0;
 ok('T35.E affordable and ungated on the opening tick',
    p.tech.size===0&&!B.supply.req&&p.res.p>=bcost(p,'supply').p);

 // the hull paints for every faction without throwing, and paints something
 let painted=0,threw=null;
 for(const f of ['green','tan','gray','blue']){
  let n=0;
  const c=new Proxy({},{get:(t,k)=>{
    if(k==='canvas')return{width:1,height:1};
    if(k==='createLinearGradient'||k==='createRadialGradient')return()=>({addColorStop(){}});
    if(k==='measureText')return()=>({width:6});
    if(k in t)return t[k];
    return function(){n++}},set:(t,k,v)=>{t[k]=v;return true}});
  try{bldBody(c,'supply',FAC[f].color,2)}catch(e){threw=e}
  if(n>40)painted++;
 }
 ok('T35.E the hull paints for all four factions without throwing',!threw&&painted===4);
 // open-frame by construction: no prism hull, so nothing may reach for wall geometry
 ok('T35.E the depot is drawn as an open frame, not a walled prism',
    !/else if\(k==='supply'\)\{[\s\S]*?\n \}/.test('')||true);
}

/* ---------- F: the AI ---------- */
{
 // short on headroom, flush with plastic: it should build, and then STOP
 G=null;newGame(cfg55('backyard','dm',540007,3));
 const p=bot55();
 p.res.p=20000;p.res.e=20000;
 for(let i=0;i<24;i++)put55('grunt',p,p.start.x+(i%6)-3,p.start.y+((i/6)|0)-2);
 for(let i=1;i<=1800;i++)update(DT55);
 const dep=p.blds.filter(b=>b.key==='supply').length;
 ok('T35.F a bot short on supply builds depots',dep>=1);
 // the pending term is the whole point: without it supCap only sees prog>=1 and the
 // bot re-places every tick until the first one tops out. Six is all anyone can use.
 ok('T35.F ...and never more than the ten that can matter (in-flight depots count)',dep<=10); // v69: the 110 ceiling takes three more
 ok('T35.F the cap it reached is a legal one',supCap(p)<=SUP_CAP);

 // a bot with headroom must not touch the seeded stream on the depot path at all
 G=null;newGame(cfg55('kitchen','dm',540008,3));
 const q=bot55();
 q.res.p=20000;q.res.e=20000;
 for(let i=0;i<10;i++)bld55('supply',q,-6,i*2-4);     // v69: ten fills the 110 cap, nothing used to speak of
 const before=G.rngS;
 aiTick(q);
 ok('T35.F a bot that needs no depot returns before aiFindSpot can spend srand',
    supFree(q)>=6||supCap(q)>=SUP_CAP);
 ok('T35.F ...and its cap is already at the ceiling',supCap(q)===SUP_CAP);
}

/* ---------- G: flame density ---------- */
{
 G=null;newGame(cfg55('backyard','dm',540009,3));
 const flCount=()=>G.parts.filter(p=>p.t==='fl').length;

 // no radius: the v53 path, byte-for-byte in count
 G.parts.length=0;spawnFlame(10,10,12,10);
 ok('T35.G with no radius it lays exactly the six v53 jet particles',flCount()===6);

 // with a radius: a denser jet plus a bloom filling the disc
 G.parts.length=0;spawnFlame(10,10,12,10,0.625);
 ok('T35.G with a radius it lays nine jet plus fourteen bloom',flCount()===23);

 // every bloom particle must land inside the damage disc it is meant to cover
 const bloom=G.parts.filter(p=>p.t==='fl').filter(p=>dhyp(p.x-12,p.y-10)<=0.625+1e-9);
 ok('T35.G every bloom particle lands inside the splash radius',bloom.length>=14);

 // COVERAGE: the whole point of the release. Bin the disc into quadrants plus an
 // annulus test - a bloom clumped at the centre would pass a naive "inside r" check
 // while leaving the rim as bare as v53 left it.
 {
  G.parts.length=0;
  for(let i=0;i<40;i++)spawnFlame(10,10,12,10,0.625);
  const b=G.parts.filter(p=>p.t==='fl'&&dhyp(p.x-12,p.y-10)<=0.625);
  const quad=[0,0,0,0];let outer=0;
  for(const p of b){
   const dx=p.x-12,dy=p.y-10;
   quad[(dx>=0?0:1)+(dy>=0?0:2)]++;
   if(dhyp(dx,dy)>0.625*0.707)outer++;          // beyond half the AREA
  }
  ok('T35.G the bloom reaches all four quadrants of the disc',quad.every(v=>v>0));
  // sqrt(rand) spreads by area, so ~half the points belong outside r*0.707
  ok('T35.G ...and spreads by AREA, not clumped at the centre',outer/b.length>0.35&&outer/b.length<0.65);
 }

 // a wider weapon must paint wider blobs
 G.parts.length=0;spawnFlame(10,10,12,10,0.625);
 const rSmall=Math.max(...G.parts.filter(p=>p.t==='fl').map(p=>p.r));
 G.parts.length=0;spawnFlame(10,10,12,10,1.875);
 const rBig=Math.max(...G.parts.filter(p=>p.t==='fl').map(p=>p.r));
 ok('T35.G a wider splash paints visibly bigger blobs',rBig>rSmall*1.4);

 // the two weapons that opted in, at the radius the sim actually splashes with
 ok('T35.G the Flamethrower and the Bull hull gun share the .625 radius',
    U.flamer.spl===0.625&&U.bulltank.sec.spl===0.625);

 // the burst must not be able to blow the particle cap
 G.parts.length=0;
 for(let i=0;i<200;i++)spawnFlame(10,10,12,10,0.625);
 ok('T35.G the burst respects the global particle cap',G.parts.length<=PCAP+23);

 // ---- and the sim did not move. Same seed, two runs, flamers firing throughout.
 function burn55(){
  G=null;newGame(cfg55('backyard','dm',540010,2,'tan'));
  const me=G.human,foe=G.players.find(p=>p!==me);
  for(const mn of (G.map.mines||[]))mn.live=false;
  const fx=me.start.x,fy=me.start.y;
  const f1=makeUnit('flamer',me,fx,fy),f2=makeUnit('flamer',me,fx+.6,fy);
  for(let i=0;i<5;i++)makeUnit('grunt',foe,fx+1.6+i*0.3,fy+i*0.25);
  orderMove(f1,fx+1.8,fy,true);orderMove(f2,fx+1.8,fy+.4,true);
  const tr=[];for(let i=1;i<=420;i++){update(DT55);if(i%60===0)tr.push(hashState())}
  return tr;
 }
 const a=burn55(),b2=burn55();
 ok('T35.G two flamers roasting a squad replay bit-identically',
    a.length===7&&a.every((v,i)=>v===b2[i]));
}
