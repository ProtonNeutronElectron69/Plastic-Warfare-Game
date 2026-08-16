/* ================================================================================
   T31 - v50 TESTING MODE

   A setup-screen toggle (SETUP.test -> G.test) that turns a local skirmish into a
   sandbox: you command every army, everything is free and instant, all research
   starts unlocked, you can build anywhere, there is no fog, and the Radio Tower
   call-downs have no cooldown.

   The release's central claim is that EVERY behavioural change is gated on that
   one flag, so a normal match runs v49's code path bit for bit. That claim is
   already proved by the fact that T23.A's 7 pinned trails + 15 layout hashes,
   T24/T25's 4 AI-only trails, T26.G's Desk trail and T30.A's v48 baseline all
   pass in this same run UNEDITED. Rather than re-pin them here, A tests the
   gates from the other side: with testing mode OFF, every rule this release can
   relax must still bite.

   A: gates are gates - test off leaves costs, build times, fog and placement alone
   B: boot & wiring - every slot human, no AI brain anywhere, 1..4 armies
   C: free - the three cost sources return zero and no army ever spends
   D: instant - buildings top out on tick 1, a whole queue drains in one call
   E: research granted up front, faction-filtered, and it reaches makeBuilding
   F: no fog - lit from tick 0, updateFog holds it, grass concealment lifted
   G: build anywhere - the zone and the enemy-HQ ring drop, terrain/unit do NOT
   H: call-downs - radioCD() is 0 and two strikes fire back to back
   I: army switching - the command surface follows G.human, groups are dropped
   J: snapshot & determinism - test round-trips, is NOT hashed, dual-run, save/load
   K: refused online, and the new code is deterministic-math only
   ================================================================================ */
'use strict';
section('T31 v50: testing mode');

const DT50=1/30;
function cfg50(o){return Object.assign({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:3,seed:515001},o||{})}
function boot50(o){G=null;newGame(cfg50(o));return G}
function run50(n){for(let i=0;i<n;i++)update(DT50)}
// first tile at which this player may legally put `key` (used to build test fixtures)
function spot50(p,key,fromX,fromY){
 const N=G.map.N;
 for(let r=2;r<20;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
  const tx=Math.round(fromX+dx),ty=Math.round(fromY+dy);
  if(tx<1||ty<1||tx>N-4||ty>N-4)continue;
  if(placeDeny(p,key,tx,ty)==='')return{tx,ty};
 }
 return null;
}

/* ---------- A: with testing mode OFF, every relaxed rule still bites ---------- */
{
 boot50({test:0});
 ok('T31.A G.test false in a normal match',G.test===false);
 const p=G.players[0];
 ok('T31.A unit cost is still charged',ucost(p,'grunt').p>0);
 ok('T31.A building cost is still charged',bcost(p,'barracks').p>0);
 ok('T31.A research cost is still charged',rcost(p,'u_tank').p>0);
 ok('T31.A radioCD is the full 3 minutes',radioCD()===180&&RADIO_CD===180);
 ok('T31.A no army starts teched up',G.players.every(q=>q.tech.size===0));
 ok('T31.A CPU slots still get a brain',G.players.filter(q=>q.ai).length===3);
 ok('T31.A fog starts dark',G.fog.some(v=>v===0));
 // a building still takes real time
 const s=spot50(p,'barracks',p.start.x,p.start.y);
 ok('T31.A found a legal barracks spot',!!s);
 if(s){
  const b=makeBuilding('barracks',p,s.tx,s.ty,false);
  updateBld(b,DT50);
  ok('T31.A construction still takes time',b.prog>0&&b.prog<1);
 }
 // and the build zone still exists somewhere on the map
 let sawNear=false;
 for(let t=4;t<G.map.N-4&&!sawNear;t+=3)for(let u2=4;u2<G.map.N-4;u2+=3){
  if(placeDeny(p,'barracks',t,u2)==='near'){sawNear=true;break}
 }
 ok('T31.A the build zone still denies distant sites',sawNear);
}

/* ---------- B: boot & wiring ---------- */
{
 ok('T31.B SETUP defaults to testing mode off',SETUP.test===0);
 for(const m of T_MAPS){
  let err=null;
  try{boot50({map:m,test:1});run50(120)}catch(e){err=e}
  ok(`T31.B ${m} boots in testing mode`,!err);
  if(err){console.log('   ',err.stack.split('\n')[0]);continue}
  ok(`T31.B ${m} 4 armies`,G.players.length===4);
  ok(`T31.B ${m} every slot is human`,G.players.every(p=>p.human===true));
  ok(`T31.B ${m} no AI brain anywhere`,G.players.every(p=>!p.ai));
  ok(`T31.B ${m} distinct armies`,new Set(G.players.map(p=>p.fac)).size===4);
 }
 // the army count is selectable 1..4
 for(let opp=0;opp<=3;opp++){
  boot50({test:1,opp});
  ok(`T31.B ${opp+1}-army match`,G.players.length===opp+1&&G.players.every(p=>p.human&&!p.ai));
 }
 // an all-one-team pick is honoured instead of falling back to FFA
 boot50({test:1,opp:3,teams:[1,1,1,1]});
 ok('T31.B all-one-team is honoured in testing mode',G.players.every(p=>p.team===1));
 boot50({test:0,opp:3,teams:[1,1,1,1]});
 ok('T31.B ...and still falls back to FFA outside it',new Set(G.players.map(p=>p.team)).size===4);
}

/* ---------- C: free ---------- */
{
 boot50({test:1});
 let allZero=true;
 for(const p of G.players){
  for(const k in U)if(ucost(p,k).p!==0||ucost(p,k).e!==0)allZero=false;
  for(const k in B)if(bcost(p,k).p!==0||bcost(p,k).e!==0)allZero=false;
  for(const k in RESEARCH)if(rcost(p,k).p!==0||rcost(p,k).e!==0)allZero=false;
 }
 ok('T31.C every unit/building/research is free for every army',allZero);

 const p=G.players[0],r0={p:p.res.p,e:p.res.e};
 const s=spot50(p,'barracks',p.start.x,p.start.y);
 ok('T31.C found a legal barracks spot',!!s);
 if(s){
  submitCmd('build',{key:'barracks',tx:s.tx,ty:s.ty});execCmds();
  const bar=p.blds.find(b=>b.key==='barracks');
  ok('T31.C the barracks was built',!!bar);
  updateBld(bar,DT50);
  for(let i=0;i<5;i++)trainUnit(bar,'grunt');
  ok('T31.C the queue filled to the cap',bar.queue.length===5);
  ok('T31.C nothing was spent',p.res.p===r0.p&&p.res.e===r0.e);
 }
 // a poor army can still act: zero out the treasury and build anyway. Barracks,
 // because testing mode does NOT lift B[key].req - a Garage would still want one.
 const q=G.players[1];q.res.p=0;q.res.e=0;
 const s2=spot50(q,'barracks',q.start.x,q.start.y);
 ok('T31.C found a legal spot for the broke army',!!s2);
 if(s2){
  const before=q.blds.length;
  G.human=q;submitCmd('build',{key:'barracks',tx:s2.tx,ty:s2.ty});execCmds();G.human=G.players[0];
  ok('T31.C a broke army can still build',q.blds.length===before+1);
  ok('T31.C ...without going into debt',q.res.p===0&&q.res.e===0);
  // ...but the prerequisite chain is NOT lifted: a Garage still needs the Barracks done
  const n0=q.blds.length;
  const s3=spot50(q,'garage',q.start.x,q.start.y);
  if(s3){G.human=q;submitCmd('build',{key:'garage',tx:s3.tx,ty:s3.ty});execCmds();G.human=G.players[0];}
  ok('T31.C prerequisites are NOT lifted',q.blds.length===n0);
 }
}

/* ---------- D: instant ---------- */
{
 boot50({test:1});
 const p=G.players[0];
 const s=spot50(p,'barracks',p.start.x,p.start.y);
 ok('T31.D found a legal barracks spot',!!s);
 if(s){
  const b=makeBuilding('barracks',p,s.tx,s.ty,false);
  ok('T31.D starts unbuilt',b.prog===0);
  updateBld(b,DT50);
  ok('T31.D completes on the first tick',b.prog===1);
  ok('T31.D ...at full HP',b.hp===b.mhp);

  const n0=p.units.length;
  for(let i=0;i<5;i++)trainUnit(b,'grunt');
  ok('T31.D queued five',b.queue.length===5);
  updateBld(b,DT50);
  ok('T31.D the whole queue drains in ONE call',b.queue.length===0);
  ok('T31.D ...spawning all five',p.units.length===n0+5);

  // the population cap is deliberately NOT lifted
  const lab=makeBuilding('lab',p,s.tx,s.ty+3,true);
  lab.techCur='u_tank';lab.techT=0;
  updateBld(lab,DT50);
  ok('T31.D a project in flight finishes on its first tick',lab.techCur===null);
 }
 // the pop cap still holds
 const cap=G.players[1];
 while(cap.units.length<60)makeUnit('grunt',cap,cap.start.x,cap.start.y);
 const s3=spot50(cap,'barracks',cap.start.x,cap.start.y);
 if(s3){
  const b3=makeBuilding('barracks',cap,s3.tx,s3.ty,true);
  trainUnit(b3,'grunt');updateBld(b3,DT50);
  ok('T31.D the 60-unit cap is NOT lifted',cap.units.length===60);
 }
}

/* ---------- E: research granted up front, faction-filtered ---------- */
{
 boot50({test:1});
 let complete=true,leaked=false;
 for(const p of G.players)for(const k in RESEARCH){
  if(techAvailable(p,k)){if(!hasTech(p,k))complete=false}
  else if(hasTech(p,k))leaked=true;
 }
 ok('T31.E every available project is already researched',complete);
 ok('T31.E no army learned another faction\'s exclusive',!leaked);
 const green=G.players.find(p=>p.fac==='green');
 ok('T31.E green has its own unlocks',!!green&&hasTech(green,'u_sarge')&&hasTech(green,'u_mortar'));
 ok('T31.E ...and not the Tan flamethrower',!!green&&!hasTech(green,'u_flamer'));
 ok('T31.E ...and not the Blue Chinook',!!green&&!hasTech(green,'u_chinook'));
 // granting BEFORE the starting-base loop is what makes this true
 const gt=G.players[0].blds.find(b=>b.key==='guardtower');
 ok('T31.E the starting guard tower is built upgraded',!!gt&&gt.upg===true);
 ok('T31.E ...at the upgraded max HP',!!gt&&gt.mhp===Math.round(B.guardtower.hp*FAC[G.players[0].fac].mods.hp*UPGRADES.guardtower.hp));
 boot50({test:0});
 ok('T31.E the starting guard tower is NOT upgraded in a normal match',!G.players[0].blds.find(b=>b.key==='guardtower').upg);
}

/* ---------- F: no fog ---------- */
{
 boot50({test:1});
 ok('T31.F fog is lit before updateFog has ever run',G.fog.every(v=>v===2));
 run50(60);
 ok('T31.F updateFog holds it lit',G.fog.every(v=>v===2));
 ok('T31.F fogAt reads visible everywhere',fogAt(2,2)===2&&fogAt(G.map.N-3,G.map.N-3)===2);
 // an enemy unit is visible no matter what it is standing in
 const foe=G.players[1].units[0];
 ok('T31.F an enemy unit is visible',visibleToHuman(foe));
 const foeB=G.players[2].blds[0];
 ok('T31.F an enemy building is visible',visibleToHuman(foeB));
 // grass concealment is lifted: fake the unit onto a tall-grass tile if the map has one
 let grass=null,N=G.map.N;
 for(let y=1;y<N-1&&!grass;y++)for(let x=1;x<N-1;x++)if(fieldAt(x+.5,y+.5)===1){grass={x:x+.5,y:y+.5};break}
 if(grass){
  const ox=foe.x,oy=foe.y;foe.x=grass.x;foe.y=grass.y;
  ok('T31.F grass concealment is lifted',visibleToHuman(foe));
  foe.x=ox;foe.y=oy;
 }else ok('T31.F grass concealment is lifted (no grass on this map)',true);
 // and a normal match still hides things
 boot50({test:0});run50(30);
 ok('T31.F a normal match still has dark tiles',G.fog.some(v=>v!==2));
}

/* ---------- G: build anywhere, but not on water or on a unit ---------- */
{
 boot50({test:1});
 const p=G.players[0],foe=G.players[1];
 // (1) a site far outside any build zone
 let far=null;
 boot50({test:0});
 {
  const p0=G.players[0];
  for(let t=4;t<G.map.N-4&&!far;t+=2)for(let u2=4;u2<G.map.N-4;u2+=2){
   if(placeDeny(p0,'barracks',t,u2)==='near'){far={tx:t,ty:u2};break}
  }
  ok('T31.G found a site the build zone denies',!!far);
 }
 boot50({test:1});
 if(far)ok('T31.G testing mode allows building outside the zone',placeDeny(G.players[0],'barracks',far.tx,far.ty)==='');
 // (2) inside an enemy HQ exclusion ring
 const fhq=G.players[1].blds.find(b=>b.key==='hq');
 let ring=null;
 for(let dx=-2;dx<=2&&!ring;dx++)for(let dy=-2;dy<=2;dy++){
  const tx=Math.round(fhq.x+dx),ty=Math.round(fhq.y+dy+4);
  if(tx<1||ty<1||tx>G.map.N-4||ty>G.map.N-4)continue;
  if(dhyp(fhq.x-(tx+1),fhq.y-(ty+1))<BUILD_R_FOEHQ&&placeDeny(G.players[0],'barracks',tx,ty)===''){ring={tx,ty};break}
 }
 ok('T31.G a site inside the enemy HQ ring is allowed',!!ring);
 if(ring){
  boot50({test:0});
  ok('T31.G ...and denied \'foehq\' in a normal match',placeDeny(G.players[0],'barracks',ring.tx,ring.ty)==='foehq');
  boot50({test:1});
 }
 // (3) terrain and units are still respected - these guard the passability grid
 const N=G.map.N;
 let water=null;
 for(let y=1;y<N-2&&!water;y++)for(let x=1;x<N-2;x++)if(!G.map.pass[y*N+x]){water={tx:x,ty:y};break}
 ok('T31.G impassable ground is STILL denied',!!water&&placeDeny(G.players[0],'barracks',water.tx,water.ty)==='terrain');
 const g=G.players[0].units.find(u=>!u.t.fly);
 const ux=Math.round(g.x)-1,uy=Math.round(g.y)-1;
 ok('T31.G a unit in the footprint is STILL denied',placeDeny(G.players[0],'barracks',ux,uy)==='unit');
}

/* ---------- H: call-downs have no cooldown ---------- */
{
 boot50({test:1});
 ok('T31.H radioCD is zero',radioCD()===0);
 ok('T31.H ...and the constant itself is untouched',RADIO_CD===180);
 const p=G.players[0];
 const s=spot50(p,'radiotower',p.start.x,p.start.y);
 ok('T31.H found a legal radio tower spot',!!s);
 if(s){
  const rt=makeBuilding('radiotower',p,s.tx,s.ty,true);
  const n0=G.strikes.length;
  submitCmd('radio',{bid:rt.id,mode:'paradrop',x:p.start.x+3,y:p.start.y+3});execCmds();
  ok('T31.H the first call-down fired',G.strikes.length===n0+1);
  ok('T31.H the tower did not go on cooldown',rt.abilityCool===0);
  submitCmd('radio',{bid:rt.id,mode:'paradrop',x:p.start.x-3,y:p.start.y-3});execCmds();
  ok('T31.H a second call-down fires immediately',G.strikes.length===n0+2);
  // napalm still respects the vision rule (it is a targeting rule, not a cooldown)
  submitCmd('radio',{bid:rt.id,mode:'napalm',x:rt.x+1,y:rt.y+1});execCmds();
  ok('T31.H napalm fires in vision too',G.strikes.length===n0+3&&rt.abilityCool===0);
 }
 // a normal match still charges the full cooldown
 boot50({test:0});
 const q=G.players[0],s2=spot50(q,'radiotower',q.start.x,q.start.y);
 if(s2){
  const rt2=makeBuilding('radiotower',q,s2.tx,s2.ty,true);
  submitCmd('radio',{bid:rt2.id,mode:'paradrop',x:q.start.x+3,y:q.start.y+3});execCmds();
  ok('T31.H a normal match still pays 180s',rt2.abilityCool===180);
 }
}

/* ---------- I: army switching ---------- */
{
 boot50({test:1});
 const a0=G.players[0],a2=G.players[2];
 ok('T31.I you start as army 1',G.human===a0);
 G.groups['1']=a0.units.slice(0,2);
 const moved=switchArmy(2);
 ok('T31.I switchArmy reports success',moved===true);
 ok('T31.I G.human followed',G.human===a2);
 ok('T31.I control groups were dropped',!G.groups['1']);
 ok('T31.I the selection was cleared',G.sel.length===0);
 // the command surface follows: an order now belongs to army 3
 const mine=a2.units.find(u=>u.key==='grunt'),theirs=a0.units.find(u=>u.key==='grunt');
 const tx=Math.round(G.map.N/2),ty=Math.round(G.map.N/2);
 submitCmd('move',{ids:[mine.id,theirs.id],x:tx,y:ty});
 ok('T31.I the command is stamped with the new army',G.cmdQ[G.cmdQ.length-1].pi===2);
 const t0={x:theirs.dest?theirs.dest.x:null};
 execCmds();
 ok('T31.I my new army obeys',mine.dest&&Math.abs(mine.dest.x-tx)<6);
 ok('T31.I the army I left does NOT',!theirs.dest||theirs.dest.x===t0.x);
 // switching to the army you are already on is a no-op, and it is refused outside testing mode
 ok('T31.I switching to yourself is a no-op',switchArmy(2)===false);
 ok('T31.I an out-of-range army is refused',switchArmy(9)===false);
 ok('T31.I Tab wraps around the roster',(function(){switchArmy(3);const before=G.human.i;switchArmy((before+1)%G.players.length);return G.human.i===0})());
 boot50({test:0});
 ok('T31.I switching is refused in a normal match',switchArmy(1)===false&&G.human===G.players[0]);
}

/* ---------- J: snapshot, hash, determinism ---------- */
{
 boot50({test:1});
 run50(60);
 const snap=JSON.parse(saveState());
 ok('T31.J the snapshot carries the flag',snap.test===true);
 ok('T31.J snapshot tag is monotonic',snap.v>=50);
 ok('T31.J the snapshot kept its tail keys',snap.mapKey==='backyard'&&snap.mode==='dm'&&typeof snap.rngS==='number'&&typeof snap.EID==='number');
 // the flag is match config, not hashed state
 const h1=hashState();G.test=false;const h2=hashState();G.test=true;
 ok('T31.J G.test is NOT folded into hashState',h1===h2);
 // a normal save says so, and loading it restores a normal match
 boot50({test:0});run50(10);
 ok('T31.J a normal snapshot records test:false',JSON.parse(saveState()).test===false);

 // determinism: two fresh testing-mode matches, identical scripted commands
 function trail50(){
  boot50({test:1,seed:606007});
  const p=G.players[0],out=[];
  const s=spot50(p,'barracks',p.start.x,p.start.y);
  for(let i=1;i<=600;i++){
   if(i===10&&s)submitCmd('build',{key:'barracks',tx:s.tx,ty:s.ty});
   if(i===20){const b=p.blds.find(b2=>b2.key==='barracks');if(b)submitCmd('train',{bid:b.id,k:'grunt'});}
   if(i===40){const ids=p.units.filter(u=>u.key==='grunt').map(u=>u.id);
    if(ids.length)submitCmd('move',{ids,x:Math.round(G.map.N/2),y:Math.round(G.map.N/2)});}
   update(DT50);
   if(i%60===0)out.push(hashState());
  }
  return out;
 }
 const t1=trail50(),t2=trail50();
 ok('T31.J dual-run is bit-identical',t1.length===10&&t1.join(',')===t2.join(','));

 // save/load resumes on the same trail
 boot50({test:1,seed:606008});
 run50(200);
 const mid=saveState();
 const after=[];for(let i=1;i<=180;i++){update(DT50);if(i%60===0)after.push(hashState())}
 loadState(mid);
 ok('T31.J the reload kept testing mode on',G.test===true);
 const after2=[];for(let i=1;i<=180;i++){update(DT50);if(i%60===0)after2.push(hashState())}
 ok('T31.J save/load resumes bit-identical',after.join(',')===after2.join(','));
 // a pre-v50 save (no test key) loads as a normal match
 const legacy=JSON.parse(mid);delete legacy.test;
 loadState(JSON.stringify(legacy));
 ok('T31.J a pre-v50 save loads as a normal match',G.test===false);
}

/* ---------- L: the setup row (source lint + transcribed formula) ----------
   refreshTeamRow is driven entirely by document.querySelector[All], and the shim
   has no selector engine (querySelectorAll returns []), so this row cannot be
   exercised headlessly - the same reason v33/v34/v35 never covered it either.
   Cover it the way T28.G covered lobResolveFacs: lint that the gated expressions
   are the ones in the file, then transcribe the label formula and check its
   outputs independently. */
{
 const rt=refreshTeamRow.toString();
 ok('T31.L refreshTeamRow reads SETUP.test',rt.includes("test=!!SETUP.test"));
 ok('T31.L the army-count row relabels',rt.includes("test?'Armies (all yours)':surv?'Allied Armies':'Enemy Armies'"));
 ok('T31.L the 1-army button shows in testing mode',rt.includes("if(n===0)b.style.display=(surv||test)?'':'none';"));
 ok('T31.L the solo snap-back skips testing mode',rt.includes("if(!surv&&!test&&SETUP.opp===0)"));
 ok('T31.L the team chips relabel',rt.includes("test?'Army '+(i+1):TSLOT_NAMES[i]"));
 ok('T31.L the survival branches are untouched',
    rt.includes("surv?'none':''")&&rt.includes("cd.style.display=surv?'':'none'"));
 // the opp-button label formula, transcribed from the source above
 const OPPLAB="b.textContent=test?((n+1)+(n?' Armies':' Army')):(n===0?'Solo':(n+(n>1?' Opponents':' Opponent')));";
 ok('T31.L the label formula is the one in the file',rt.includes(OPPLAB));
 const lab=(test,n)=>test?((n+1)+(n?' Armies':' Army')):(n===0?'Solo':(n+(n>1?' Opponents':' Opponent')));
 ok('T31.L testing mode reads 1..4 Armies',
    [0,1,2,3].map(n=>lab(true,n)).join('|')==='1 Army|2 Armies|3 Armies|4 Armies');
 ok('T31.L ...and the normal labels are byte-identical to v49',
    [0,1,2,3].map(n=>lab(false,n)).join('|')==='Solo|1 Opponent|2 Opponents|3 Opponents');
 // the toggle handler mirrors the difficulty handler it sits next to
 ok('T31.L SETUP.test is a plain 0/1',SETUP.test===0||SETUP.test===1);
}

/* ---------- K: refused online, deterministic math only ---------- */
{
 const src50=(typeof newGame==='function')?
  [newGame,switchArmy,armySwitchUI,ucost,bcost,rcost,placeDeny,updateBld,updateFog,visibleToHuman,radioCD]
   .map(f=>f.toString()).join('\n'):'';
 ok('T31.K the new code uses no wall clock',!/Date\.now|performance\.now/.test(src50));
 ok('T31.K ...and no Math.random in the sim helpers',
    ![switchArmy,armySwitchUI,ucost,bcost,rcost,placeDeny,radioCD].some(f=>/Math\.random/.test(f.toString())));
 ok('T31.K ...and no Math.hypot',![switchArmy,placeDeny,radioCD].some(f=>/Math\.hypot/.test(f.toString())));
 // the online lobby must never carry the flag into a match
 ok('T31.K lobHostStart does not pass SETUP.test',!/const cfg=\{mode:SETUP\.mode,map:SETUP\.map,diff:'normal',seed:LOBBY\.seed,slots,?\s*test/.test(lobHostStart.toString()));
 ok('T31.K ...and never mentions test at all',!/\btest\b/.test(lobHostStart.toString()));
 // every switch entry point is a safe no-op with no match running
 G=null;
 let err=null;try{switchArmy(1);armySwitchUI()}catch(e){err=e}
 ok('T31.K the switcher is a safe no-op with no match',!err);
}
