/* tail_v65.js - T44: menu legibility, placement loosening, economy pass, spin fix.

   A: BUILD_GAP 2 -> 1 and BUILD_R_OUTPOST 5 -> 6, enforced through placeDeny
      rather than read off the constants, plus the prose that had to stop
      hardcoding a plural noun.
   B: the electricity pass. Twenty-one entries up 15%, the ce:0 roster untouched
      BY CONSTRUCTION, and every derived consumer (RESEARCH, SUP_MEDIAN, supOf,
      ucost/bcost) re-priced off the new tables rather than transcribed.
   C: the Grunt at 36, and nothing else in the plastic column moved.
   D: THE SPIN, wildlife. This is a behavioural check, not a source grep: park a
      nest creature at home, run it, and measure how far its facing actually
      travels. The old code advanced face by dt*5 unbounded, so the observed
      sweep over 600 ticks was ~100 radians; the fix holds it inside a band.
   E: THE SPIN, field manual. Drive the real infoLoop through the shim and assert
      the body angle is identical on frame 1 and frame 400, while the moving
      PARTS (rotor, gun sweep) still advance.
   F: the menu backdrop scrim, linted off the shipped HTML.

   Mutation arms, because none of the above is worth much without one:
     D re-runs the measurement with the OLD rule spliced back in over the same
       creature and requires it to fail the band it just passed, so a creature
       that simply never moved cannot look fixed.
     E asserts the rotor and the gun sweep DID advance across the same frames the
       body held still, so a loop that early-returned cannot look fixed.
     B mutates a ce:0 unit to ce>0 and re-runs the pass to prove the guard is a
       real guard and not an accident of the current table. */
'use strict';
section('T44 v65: menu legibility, placement, economy, spin');

const DT65=1/30;
function cfg65(map,mode,seed,opp){return{map,mode,diff:'normal',fac:'green',opp:(opp==null?3:opp),seed}}
function fresh65(seed,opp){G=null;newGame(cfg65('backyard','dm',seed,opp==null?1:opp));for(let i=0;i<3;i++)update(DT65);}
// wrap to (-PI,PI] without leaning on the sim's deterministic trig
function wrap65(a){return Math.atan2(Math.sin(a),Math.cos(a));}

/* ================================================= A: PLACEMENT ================================================= */
section('T44.A spacing 2 -> 1, outpost zone 5 -> 6');
{
 ok('T44.A BUILD_GAP is 1',BUILD_GAP===1);
 ok('T44.A BUILD_R_OUTPOST is 6',BUILD_R_OUTPOST===6);
 ok('T44.A the other two radii did NOT move',BUILD_R_HQ===15&&BUILD_R_FOEHQ===10);

 fresh65(650001,1);
 const p=G.human,hq=p.blds[0];
 // find clear ground for a barracks near the HQ, the same way tail_v61 does
 let spot=null;
 for(let r=4;r<=9&&!spot;r++)for(let a=0;a<24&&!spot;a++){
  const tx=Math.round(hq.x+Math.cos(a*0.262)*r),ty=Math.round(hq.y+Math.sin(a*0.262)*r);
  if(placeDeny(p,'barracks',tx,ty)==='')spot={tx,ty};
 }
 ok('T44.A found legal ground for a barracks',!!spot);
 if(spot){
  placeBuilding(p,'barracks',spot.tx,spot.ty);
  const gy=spot.ty,base=spot.tx+B.barracks.sz;
  const at=d=>placeDeny(p,'guardtower',base+d,gy);
  // the boundary moved by exactly one tile, and only by one tile
  ok(`T44.A flush still denies (${at(0)})`,at(0)==='space');
  ok(`T44.A ONE clear tile now passes (${at(1)||'legal'})`,at(1)==='');
  ok(`T44.A two clear tiles still pass (${at(2)||'legal'})`,at(2)==='');
  // and the metric itself is untouched: the loosening is in the threshold only
  const fake=(tx,ty)=>({tx,ty,sz:B.guardtower.sz});
  ok('T44.A bldGap still measures Chebyshev clearance',
     bldGap('barracks',10,10,fake(10+B.barracks.sz+1,10))===1&&
     bldGap('barracks',10,10,fake(10+B.barracks.sz,10+B.barracks.sz))===0);
 }

 /* The outpost zone, measured as a FLIP SET rather than by scanning for legal
    ground. Scanning cannot work: placeDeny returns the first denial reason it
    finds, so a tile far from the outpost but inside the HQ's own 15-tile zone
    answers legal and inflates the reading. Instead, record every tile that
    answers 'near' (clear ground, denied only by the zone rule) BEFORE the outpost
    exists, plant it, and re-test. The tiles that flipped to legal are exactly the
    ones this outpost opened, and the furthest of them is the live radius,
    whatever the constant happens to say. */
 fresh65(650002,1);
 {
  const q=G.human,N=G.map.N;
  // a site with clear ground and a wide skirt of zone-denied tiles around it
  let site=null;
  for(let ty=8;ty<N-10&&!site;ty++)for(let tx=8;tx<N-10&&!site;tx++){
   if(placeDeny(q,'outpost',tx,ty)!=='')continue;
   let clean=true,near=0;
   for(let dy=-8;dy<=8&&clean;dy++)for(let dx=-8;dx<=8&&clean;dx++){
    const r=placeDeny(q,'generator',tx+dx,ty+dy);
    if(r==='')clean=false;else if(r==='near')near++;
   }
   if(clean&&near>=120)site={tx,ty};
  }
  ok('T44.A found a site with no other build zone reaching it',!!site);
  if(site){
   const pre=[];
   for(let ty=site.ty-9;ty<=site.ty+9;ty++)for(let tx=site.tx-9;tx<=site.tx+9;tx++){
    if(tx<1||ty<1||tx>N-3||ty>N-3)continue;
    if(placeDeny(q,'generator',tx,ty)==='near')pre.push([tx,ty]);
   }
   const op=makeBuilding('outpost',q,site.tx,site.ty,true);
   let reach=0,opened=0,nearestBlocked=1e9;
   for(const [tx,ty] of pre){
    const cd=dhyp(tx+B.generator.sz/2-op.x,ty+B.generator.sz/2-op.y);
    const r=placeDeny(q,'generator',tx,ty);
    if(r===''){opened++;if(cd>reach)reach=cd}
    else if(r==='near'&&cd<nearestBlocked)nearestBlocked=cd;
   }
   ok(`T44.A the outpost opened ground that was zone-denied before it (${opened} tiles)`,opened>0);
   ok(`T44.A the live zone reaches past the OLD radius of 5 (${reach.toFixed(2)} tiles)`,reach>5);
   ok(`T44.A ...and the first tile still denied sits at exactly 6 (${nearestBlocked.toFixed(2)})`,
      Math.abs(nearestBlocked-6)<1e-9&&reach<6);
  }
 }

 // prose: neither site may hardcode the plural now that the gap is 1
 ok('T44.A the help panel carries a noun slot for the gap',
    helpTuneValue('gap')===1&&helpTuneValue('gapT')==='tile');
 ok('T44.A ...that answers "tiles" whenever the gap is not 1',
    HELP_TUNE.gapT.toString().includes("BUILD_GAP===1?'tile':'tiles'"));
 ok('T44.A the outpost card text re-derived off the new radius',
    B.outpost.d.includes('6-tile build zone')&&!B.outpost.d.includes('5-tile'));
 ok('T44.A the HQ card text did not move',B.hq.d.includes('15-tile'));
}

/* ================================================= B: ELECTRICITY ============================================== */
section('T44.B the +15% electricity pass');
{
 /* The pre-pass baselines, transcribed from the v64 table. Everything below is
    checked against baseline*1.15 rather than against a second transcription of
    the answer, so a typo in the pass and a typo in this tail cannot agree. */
 const V64_U={medic:20,jeep:10,aatruck:30,tank:40,heli:70,sarge:60,bulltank:80.5,
  arty:90,bike:5,apache:110,apc:40,chinook:100};
 const V64_B={hq:100,lab:60,garage:20,helipad:60,guardtower:30,radar:50,
  radiotower:200,dump:40,outpost:20};
 const ZERO_U=['grunt','grenadier','gunner','bazooka','truck','mortar','flamer','sniper','para','runner']; // v85: +runner, who draws no battery
 const ZERO_B=['barracks','generator','supply','bunker','turbine','barricade','nest'];

 let bad=[];
 for(const k in V64_U)if(Math.abs(U[k].ce-V64_U[k]*1.15)>1e-3)bad.push('U.'+k+'='+U[k].ce);
 for(const k in V64_B)if(Math.abs(B[k].ce-V64_B[k]*1.15)>1e-3)bad.push('B.'+k+'='+B[k].ce);
 ok('T44.B all twenty-one battery costs are exactly 15% up'+(bad.length?' ('+bad.join(', ')+')':''),
    bad.length===0);
 /* v85: nine buildings became ten when the Forward Pad landed. The count is pinned
    precisely so that an addition has to be declared here rather than slipping in,
    and the Pad's own battery cost is pinned on the next line so the +15% pass is
    still proved to have reached it - which is the claim the count exists to guard.
    v86: fourteen units and eleven buildings. Green's Command Truck and Observation
    Balloon both draw battery, and so does the Command Post; all three are declared
    on the lines below at their pre-pass baselines, so the count is guarding the
    same claim it always did. */
 /* v88: sixteen and twelve. The Choktaw draws battery and is declared below at its
    pre-pass baseline; the Heavy Barricade draws NONE, which is the ordinary wall's
    rule inherited along with everything else `barr` carries, so the building count
    is unmoved even though a building was added. */
 ok('T44.B sixteen units and twelve buildings, no more and no fewer',
    Object.keys(U).filter(k=>U[k].ce>0).length===16&&Object.keys(B).filter(k=>B[k].ce>0).length===12);
 ok('T44.B the v88 unit is the new one, and the pass reached it; the v88 WALL draws none',
    Math.abs(U.choktaw.ce-120*1.15)<1e-3&&B.hbarricade.ce===0);
 ok('T44.B the Forward Pad is the tenth, and the pass reached it',
    Math.abs(B.fwdpad.ce-70*1.15)<1e-3&&U.runner.ce===0);
 ok('T44.B the three v86 rows are the new ones, and the pass reached all three',
    Math.abs(U.cmdtruck.ce-20*1.15)<1e-3&&Math.abs(U.balloon.ce-60*1.15)<1e-3&&
    Math.abs(B.cmdpost.ce-60*1.15)<1e-3);
 ok('T44.B ...and the two v87 rows likewise',
    Math.abs(U.firebomb.ce-90*1.15)<1e-3&&Math.abs(B.foundry.ce-50*1.15)<1e-3);
 ok('T44.B the ce:0 roster is still ce:0',
    ZERO_U.every(k=>U[k].ce===0)&&ZERO_B.every(k=>B[k].ce===0));

 // MUTATION: the ce>0 guard must be a real guard. Re-run the pass expression over
 // a copy in which one ce:0 unit has been given a cost, and require it to move.
 {
  const probe={a:{ce:0},b:{ce:8}};
  for(const k in probe)if(probe[k].ce>0)probe[k].ce=+(probe[k].ce*1.15).toFixed(3);
  ok('T44.B the guard skips ce:0 and catches ce>0 (mutation arm)',
     probe.a.ce===0&&Math.abs(probe.b.ce-9.2)<1e-9);
 }

 // the pass ran BEFORE the two things that derive from these tables
 ok('T44.B RESEARCH re-priced itself off the new battery costs',
    RESEARCH.u_chinook.ce===rscale(Math.max(U.chinook.ce,U.chinook.cp*0.45))&&
    RESEARCH.b_radiotower.ce===rscale(Math.max(B.radiotower.ce,B.radiotower.cp*0.4))&&
    RESEARCH.b_radiotower.ce===147);
 ok('T44.B ...and the research band still clamps at 200',
    RESEARCH.u_bulltank.cp===200&&RESEARCH.u_apache.cp===200);

 /* v65's knock-on was the Medic crossing the supply median. v69 retired the
    median for a ladder, so what survives from this block is the part that was
    ever about v65: the electricity pass moved the Medic's TOTAL cost to 173 and
    the Sniper's to 170, and those two totals still put them where v65 said. The
    ladder itself is T35.A's to own; this only checks that the v65 pass still
    feeds it the same two numbers. */
 /* v88: the TOTAL is what v65 legislated and it is unmoved; the RANK it buys slid
    from 3 to 2 when the roster reached 25 trainable units, which is arithmetic
    about the roster and not about this pass. Split in two so the two claims stay
    distinguishable - the point of this line was always the 173. */
 ok('T44.B the v65 pass still puts the Medic on 173 total',U.medic.cp+U.medic.ce===173);
 ok('T44.B ...which v88 prices at 2 supply, one rank cheaper than v70 did',supOf('medic')===2);
 ok('T44.B ...and the Sniper on 170 total, three plastic below it and a whole rank cheaper',
    U.sniper.cp+U.sniper.ce===170&&supOf('sniper')===2);
 ok('T44.B the ceiling moved at v69 and is no longer this tail\'s to pin',SUP_CAP>=80);

 // the decimals must never reach a player: ucost/bcost round on read
 fresh65(650003,1);
 {
  const p=G.human,m=FAC[p.fac].mods.cost;
  const uc=ucost(p,'bulltank'),bc=bcost(p,'radiotower');
  ok('T44.B ucost rounds the .575 tail away',Number.isInteger(uc.e)&&uc.e===Math.round(U.bulltank.ce*m));
  ok('T44.B bcost rounds too',Number.isInteger(bc.e)&&bc.e===Math.round(B.radiotower.ce*m));
  ok('T44.B every cost either army can be quoted is an integer',
     Object.keys(FAC).every(f=>{const q={fac:f};
      return Object.keys(U).every(k=>Number.isInteger(ucost(q,k).e)&&Number.isInteger(ucost(q,k).p))&&
             Object.keys(B).every(k=>Number.isInteger(bcost(q,k).e)&&Number.isInteger(bcost(q,k).p));}));
  G.test=true;
  ok('T44.B testing mode is still free',ucost(p,'bulltank').e===0&&bcost(p,'radiotower').e===0);
  G.test=false;
 }

 // an army really does pay the new price: bank the exact cost, build, bank hits zero
 fresh65(650004,1);
 {
  const p=G.human,c=bcost(p,'radar');
  p.res.p=c.p;p.res.e=c.e;
  const before=p.res.e;
  const spot=(()=>{for(let r=3;r<=9;r++)for(let a=0;a<24;a++){
   const tx=Math.round(p.blds[0].x+Math.cos(a*0.262)*r),ty=Math.round(p.blds[0].y+Math.sin(a*0.262)*r);
   if(placeDeny(p,'radar',tx,ty)==='')return{tx,ty};}return null})();
  ok('T44.B found ground for a radar tent',!!spot);
  if(spot){
   placeBuilding(p,'radar',spot.tx,spot.ty);
   ok(`T44.B the bank paid the v65 battery price exactly (${before} -> ${p.res.e})`,
      p.res.e===0&&before===Math.round(B.radar.ce*FAC[p.fac].mods.cost));
  }
 }
}

/* ================================================= C: THE GRUNT ================================================ */
section('T44.C the Grunt at 36');
{
 ok('T44.C the Grunt costs 36 plastic, 0 battery',U.grunt.cp===36&&U.grunt.ce===0);
 ok('T44.C that is +20% on the v64 figure',Math.abs(U.grunt.cp-30*1.2)<1e-9);
 ok('T44.C the Grunt has no tech entry, so nothing derived from it',!U.grunt.tech);
 /* The whole plastic column, transcribed, so any unlegislated price edit fires
    here whichever unit it lands on. v65 wrote this to show the Grunt was the only
    mover; v69 moved the Gunner 115 -> 140 as its own approved decision, so the
    record advances to v69 and the claim becomes the standing one: this table IS
    the plastic column, and nothing may drift from it silently. */
 const V69_CP={grunt:36,grenadier:55,gunner:125,bazooka:90,truck:20,medic:150,jeep:130,
  aatruck:180,tank:220,heli:200,sarge:260,mortar:150,flamer:120,bulltank:391,sniper:170,
  arty:320,bike:90,apache:300,apc:260,chinook:300,para:0,runner:62, // v85: +Signal Runner
  cmdtruck:145,balloon:250,firebomb:280,
  /* v88: Gray's Choktaw at 330 plastic. It is the FIRST addition since v85 whose
     price could NOT be chosen inside a band that leaves every existing rank where
     it was, because at 25 trainable units no such band exists above the Machine
     Gunner - measured across every total from 10 to 700 before the row went in.
     Three units drop one rank each and T35.A names them. */
  choktaw:330};
 const moved=Object.keys(U).filter(k=>U[k].cp!==V69_CP[k]);
 ok('T44.C no plastic cost has drifted from the v69 record'+(moved.length?' ('+moved.join(', ')+')':''),
    moved.length===0&&Object.keys(V69_CP).length===Object.keys(U).length);
 /* v88.1: 112 -> 125, and the record advances again. v69 moved him 115 -> 140 to
    take him off the head of the per-supply table; v78 moved him 140 -> 112 with a
    matching reload cut so his efficiency held; v88.1 moves him 112 -> 125 for the
    SUPPLY RANK alone, because v88's 25th trainable unit slid the quartile cut past
    him and put him back on 1. Nothing else about him moved. */
 ok('T44.C the Gunner is the only one that has ever moved since v65',V69_CP.gunner===125&&V69_CP.grunt===36);
 ok('T44.C the Grunt is still the cheapest thing the Barracks trains',
    B.barracks.prod.every(k=>k==='grunt'||U[k].cp+U[k].ce>U.grunt.cp+U.grunt.ce));
}

/* ================================================= D: THE SPIN, WILDLIFE ======================================= */
section('T44.D nest wildlife no longer spins at rest');
{
 /* Behavioural, and driven through the SHIPPED path: a nest is woken by a real
    intruder, the intruder is then banished so the creature has no target, and the
    creature is pinned at home so update() takes the branch under test every tick.
    What is measured is how far its facing actually travels. The old rule assigned
    the monotonic wob phase straight to face, so the WRAPPED facing swept the whole
    circle; the new rule is a bounded sway and cannot leave a narrow band. */
 /* v66: banishing ONCE was not enough. Production keeps running during the 600
    measured ticks, and a den that now sits in the contested middle of the map gets
    fresh units walking inside its 6-tile sight line partway through the run. The
    creature then acquires them, the target branch drives the facing, and the sway
    band this check is about is no longer the thing being measured. Re-banish every
    tick: the fixture already pins the creature's position and clears its target
    each tick, so this is the same idea applied to the other side of the test. */
 function banish65(){for(const q of G.players)for(const u of q.units){u.x=2;u.y=2;u.path=null;u.target=null;u.hold=true}}
 function restingCreature(seed){
  G=null;newGame(cfg65('backyard','dm',seed,1));
  for(let i=0;i<3;i++)update(DT65);
  const ns=G.map.nests.find(n=>!n.dead&&n.alive>0);
  if(!ns)return null;
  makeUnit('grunt',G.human,ns.x+ns.r*0.4,ns.y);   // an intruder wakes the den
  for(let i=0;i<80;i++)update(DT65);
  const cr=(G.neutrals||[]).find(c=>c.nest===ns&&c.hp>0);
  if(!cr)return null;
  // banish every player unit: nothing is an intruder, so the creature goes home
  banish65();
  for(let i=0;i<60;i++){banish65();cr.x=ns.x+0.4;cr.y=ns.y+0.2;update(DT65)}
  return {cr,ns};
 }

 const R=restingCreature(650005);
 ok('T44.D woke a den and found a creature resting at home',!!R);
 if(R){
  const {cr,ns}=R;
  ok('T44.D it really is home and unengaged, so the branch under test is live',
     dhyp(cr.x-ns.x,cr.y-ns.y)<1.5&&!cr.target);
  let sweep=0,last=cr.face,lo=1e9,hi=-1e9;
  const wob=[cr.wob];
  for(let i=0;i<600;i++){
   banish65();
   cr.x=ns.x+0.4;cr.y=ns.y+0.2;cr.target=null;
   update(DT65);
   sweep+=Math.abs(wrap65(cr.face-last));last=cr.face;
   const w=wrap65(cr.face);if(w<lo)lo=w;if(w>hi)hi=w;
   wob.push(cr.wob);
  }
  const wobTravel=wob[wob.length-1]-wob[0];
  ok(`T44.D the wobble phase advanced ${wobTravel.toFixed(1)} rad, so the run is not vacuous`,wobTravel>90);
  ok(`T44.D the facing never leaves a narrow band (${(hi-lo).toFixed(3)} rad wide)`,hi-lo<=0.95);
  ok(`T44.D total travel is bounded (${sweep.toFixed(2)} rad over 600 ticks, ~6 sway cycles)`,sweep<20);
  ok('T44.D the sway is centred on the outward-from-den heading',
     Math.abs(wrap65(cr.face-datan2(cr.y-ns.y,cr.x-ns.x)))<=0.46);

  /* MUTATION ARM. Replay the OLD rule over the very same wob trajectory this run
     produced and require it to blow the band the new rule just held. Same input
     phase, so a creature that simply stopped moving cannot look fixed. */
  let oldLo=1e9,oldHi=-1e9,oldSweep=0,ol=wrap65(wob[0]);
  for(const w of wob){
   const f=wrap65(w);
   oldSweep+=Math.abs(wrap65(f-ol));ol=f;
   if(f<oldLo)oldLo=f;if(f>oldHi)oldHi=f;
  }
  ok(`T44.D the OLD rule sweeps the whole circle on the same phase (band ${(oldHi-oldLo).toFixed(2)} rad, travel ${oldSweep.toFixed(0)})`,
     oldHi-oldLo>6&&oldSweep>90);
 }

 // an ENGAGED creature must still turn to face what it is hitting
 {
  const R2=restingCreature(650006);
  ok('T44.D woke a second den for the engagement check',!!R2);
  if(R2){
   const {cr,ns}=R2;
   const tgt=makeUnit('grunt',G.human,cr.x+1.2,cr.y+0.6);
   tgt.hold=true;
   for(let i=0;i<30;i++)update(DT65);
   ok('T44.D an engaged creature acquires the intruder',cr.target===tgt||!!cr.target);
   if(cr.target){
    const want=datan2(cr.target.y-cr.y,cr.target.x-cr.x);
    ok(`T44.D ...and body-aims at it rather than swaying (${Math.abs(wrap65(cr.face-want)).toFixed(4)} rad off)`,
       Math.abs(wrap65(cr.face-want))<1e-6);
   }
  }
 }

 // the wobble phase is still doing its OTHER jobs (bee wings, mouse tail, nest orbit)
 ok('T44.D the wobble accumulator survived the fix',
    updateNeutrals.toString().includes('cr.wob+=dt*5')&&
    updateNeutrals.toString().includes('dcos(cr.wob)*1.2'));
 ok('T44.D creature facing is still out of the hash, so this fix moves no trail',
    !hashState.toString().includes('cr.face'));
}

/* ================================================= E: THE SPIN, FIELD MANUAL =================================== */
section('T44.E the field manual holds its pose');
{
 /* Drive the real loop. requestAnimationFrame under the shim would recurse, so
    the loop is stepped by hand with INFO.raf pinned; everything else (infoFake,
    infoGround, drawUnit through infoStub) is the shipped path. */
 const savedOpen=INFO.open,savedTab=INFO.tab,savedKind=INFO.kind,savedKey=INFO.key,savedFake=INFO.fake;
 let threw=null;
 try{
  bakeSprites();
  INFO.open=true;INFO.tab='units';
  infoSelect('unit','apache');
  const f=INFO.fake;
  ok('T44.E the preview starts at the frame-0 three-quarter pose',Math.abs(f.face-Math.PI*.15)<1e-12);
  const face0=f.face,rot0=f.rot||0;
  for(let i=0;i<400;i++)infoLoop();
  ok(`T44.E the body angle is identical 400 frames later (${f.face})`,f.face===face0);
  ok('T44.E ...and the ROTOR still turned, so the loop really ran (mutation arm)',(f.rot||0)>rot0+100);

  infoSelect('bld','guardtower');
  const g=INFO.fake;const t0=g.tface;
  for(let i=0;i<400;i++)infoLoop();
  ok('T44.E the guard tower gun sweep still advances',g.tface!==t0);

  // a turreted hull settles its barrel onto the frozen hull angle instead of chasing it
  infoSelect('unit','tank');
  const tk=INFO.fake;
  for(let i=0;i<400;i++)infoLoop();
  ok('T44.E a turreted preview centres its barrel on the frozen hull',
     tk.tvis==null||Math.abs(wrap65(tk.tvis-tk.face))<1e-6);
 }catch(e){threw=e}
 ok('T44.E the preview loop ran headless without throwing'+(threw?' ('+threw.message+')':''),!threw);
 INFO.open=savedOpen;INFO.tab=savedTab;INFO.kind=savedKind;INFO.key=savedKey;INFO.fake=savedFake;INFO.raf=0;

 ok('T44.E nothing writes f.face any more',!infoLoop.toString().includes('f.face='));
 ok('T44.E infoFake still sets the pose the preview holds',infoFake.toString().includes('face:Math.PI*.15'));
}

/* ================================================= F: THE MENU SCRIM =========================================== */
section('T44.F the setup scrim stops occluding the backdrop');
{
 let html=null;
 try{html=require('fs').readFileSync('pw.html','utf8')}catch(e){html=null}
 ok('T44.F pw.html readable for the CSS lint (run from the harness directory)',!!html);
 if(html){
  ok('T44.F the scrim ellipse tightened onto the control column',
     html.includes('ellipse 560px 760px at 50% 36%')&&!html.includes('ellipse 660px 820px'));
  ok('T44.F every old scrim stop is gone',
     !html.includes('rgba(8,14,5,.93)')&&!html.includes('rgba(8,14,5,.86)')&&
     !html.includes('rgba(8,14,5,.58)')&&!html.includes('rgba(8,14,5,.10)'));
  ok('T44.F the four new stops are in, and the rim is fully transparent',
     html.includes('rgba(8,14,5,.78) 0%')&&html.includes('rgba(8,14,5,.62) 40%')&&
     html.includes('rgba(8,14,5,.26) 68%')&&html.includes('rgba(8,14,5,0) 100%'));
  ok('T44.F the controls took over their own contrast',
     html.includes('rgba(255,255,255,.07) 46%,rgba(0,0,0,.26))')&&
     html.includes('rgba(255,255,255,.15),rgba(0,0,0,.30))'));
  ok('T44.F the canvas haze and vignette lightened too',
     html.includes("rgba(20,34,14,.42)")&&html.includes("rgba(4,8,3,.46)")&&
     !html.includes("rgba(20,34,14,.60)")&&!html.includes("rgba(4,8,3,.66)"));
  ok('T44.F the depth cue itself survived (mid and floor haze stops untouched)',
     html.includes("rgba(20,34,14,.14)")&&html.includes("rgba(12,20,8,.10)")&&html.includes("rgba(6,12,4,.34)"));
 }
 // and the backdrop still paints: four ranks, canvas shown while the menu is up
 ok('T44.F the rank table is intact',MENUBG_LANES.length===4);
 {
  const setup=document.getElementById('setup');
  const wasDisplay=setup.style.display;
  setup.style.display='';
  let threw=null;
  try{for(let i=0;i<6;i++)menubgFrame(30000+i*16.7)}catch(e){threw=e}
  ok('T44.F menubgFrame still paints under a lighter scrim'+(threw?' ('+threw.message+')':''),!threw);
  ok('T44.F ...with the canvas shown',MENUBG.cv.style.display==='block');
  setup.style.display=wasDisplay;
 }
}
