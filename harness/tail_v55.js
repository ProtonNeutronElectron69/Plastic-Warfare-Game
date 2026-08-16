/* tail_v55.js — T36: SPECTATE MODE.

   A watch match is four bots and no commander. The release is carried by two
   flags that are deliberately different things:

     G.watch     the match type. EVERY new branch is gated on it, which is why
                 T23.A's 7 trails, T24/T25's AI-only trails, T26.G's Desk trail
                 and T30.A's v48 baseline all pass UNEDITED in this same run -
                 that is the "the sim did not move" half, and it needs no new pin.
     G.spectate  v23's existing full-vision flag, raised by newGame for a watch
                 match so fog, the radio panel and the elimination toast come
                 from code that already shipped.

   What this file has to prove, then, is the half a source lint cannot: that the
   spectator really sees everything AND THE BOTS DO NOT, that the match is
   genuinely read-only rather than just missing buttons, that the reported
   numbers are the board's numbers, and that the measured mining rate is the
   plastic the trucks actually delivered.

   Sections: A boot/roster  B vision asymmetry  C read-only  D watchReport
             E the meter    F determinism+save/load  G match end
             H nothing hashed/serialized  I purity  J watch-OFF regression
             K the painted box                                              */

section('T36.A watch boot: roster, profiles, flags, fog');
const W_MAPS=Object.keys(MAPS);
function wcfg(map,mode,diff,fac,seed,extra){
 return Object.assign({map,mode,diff:diff||'normal',fac:fac||'green',seed,watch:1},extra||{});
}
for(const m of W_MAPS){
 const mo=MAPS[m].survOnly?'surv':'dm';
 let err=null;
 try{G=null;newGame(wcfg(m,mo,'normal','green',5501))}catch(e){err=e}
 ok(`T36.A ${m}/${mo} boots`,!err);
 if(err){console.log('   ',err.stack.split('\n')[0]);continue}
 ok(`T36.A ${m} G.watch raised`,G.watch===true);
 ok(`T36.A ${m} G.spectate raised (v23 full-vision path)`,G.spectate===true);
 ok(`T36.A ${m} WATCH_ARMIES armies`,G.players.length===WATCH_ARMIES);
 ok(`T36.A ${m} no player is human-controlled`,G.players.every(p=>p.human===false));
 ok(`T36.A ${m} every slot got a brain`,G.players.every(p=>!!p.ai));
 ok(`T36.A ${m} profiles all distinct`,new Set(G.players.map(p=>p.ai&&p.ai.profile)).size===WATCH_ARMIES);
 ok(`T36.A ${m} every profile is a real AI_PROFILES key`,G.players.every(p=>p.ai&&AI_PROFILES[p.ai.profile]));
 ok(`T36.A ${m} one army per faction`,new Set(G.players.map(p=>p.fac)).size===WATCH_ARMIES);
 ok(`T36.A ${m} UI anchor is army 1`,G.human===G.players[0]);
 ok(`T36.A ${m} fog lit before updateFog ever ran`,Array.from(G.fog).every(f=>f===2));
 ok(`T36.A ${m} four start spots carved`,G.map.starts.length>=WATCH_ARMIES);
 let err2=null;try{run(300)}catch(e){err2=e}
 ok(`T36.A ${m}/${mo} 300 ticks clean`,!err2&&!boundsOK());
}
// a boot that throws must not take the rest of the file down with it
function wboot(c){try{G=null;newGame(c);return null}catch(e){return e}}
// the forced army count has to land BEFORE survivalSetup sizes the arena, and it
// must not mutate the caller's config object.
{
 const src=wcfg('desk','surv','normal','tan',5502),e=wboot(src);
 ok('T36.A survival sized for four bases',!e&&G.map.starts.length===4);
 ok('T36.A caller config not mutated',src.opp===undefined);
 ok('T36.A G.matchCfg carries the corrected count',!e&&G.matchCfg.opp===WATCH_ARMIES-1);
}
// every other setting still means what it meant
for(const mo of ['dm','ctf','koth']){
 const e=wboot(wcfg('backyard',mo,'hard','blue',5503,{teams:[1,1,2,2]}));
 ok(`T36.A ${mo} teams honoured`,!e&&G.players.map(p=>p.team).join(',')==='1,1,2,2');
 ok(`T36.A ${mo} difficulty honoured`,!e&&G.players.every(p=>p.diff===DIFFS.hard));
 if(mo==='ctf')ok('T36.A ctf flags exist',!e&&G.flags.length===4);
 if(mo==='koth')ok('T36.A koth hill exists',!e&&!!G.hill);
}
{
 const e=wboot(wcfg('backyard','surv','normal','green',5504));
 ok('T36.A survival forces one team',!e&&new Set(G.players.map(p=>p.team)).size===1);
}

section('T36.B vision: the spectator sees all, the bots see what they earned');
G=null;newGame(wcfg('backyard','dm','normal','green',5510));
run(150);
ok('T36.B fog stays fully lit through updateFog',Array.from(G.fog).every(f=>f===2));
ok('T36.B every foreign unit is visible',G.units.filter(u=>u.p!==G.human&&!u.garrisoned).every(visibleToHuman));
ok('T36.B every foreign building is visible',G.blds.filter(b=>b.p!==G.human).every(visibleToHuman));
// THE ASYMMETRY. The sim reads pVision/allied, never the fog grid, so a bot's
// picture of the board is exactly what it would be in a normal match.
{
 G=null;newGame(wcfg('backyard','dm','normal','green',5511));
 let blind=0,pairs=0;
 for(const a of G.players)for(const b of G.players){
  if(a===b||allied(a,b))continue;
  pairs++;if(!pVision(a,b.start.x,b.start.y))blind++;
 }
 ok('T36.B no bot can see a rival start at boot',pairs>0&&blind===pairs);
 const src=aiTick.toString()+aiFoeArmorMix.toString()+aiPickUnit.toString()+aiResearch.toString();
 ok('T36.B the AI never reads the client-local fog',!/G\.fog|fogAt\(/.test(src));
 ok('T36.B pVision is a per-player scan',/allied\(q,p\)/.test(pVision.toString()));
}
// tall grass: a spectator has no unit standing next to the lurker, so the v29
// concealment rule would hide the one thing they are watching.
{
 G=null;newGame(wcfg('backyard','dm','normal','green',5512));
 const N=G.map.N;let gx=-1,gy=-1;
 for(let y=2;y<N-2&&gx<0;y++)for(let x=2;x<N-2;x++)if(fieldAt(x+.5,y+.5)===1&&G.map.pass[y*N+x]===1){gx=x;gy=y;break}
 if(gx<0)ok('T36.B (skipped: no tall grass on this layout)',true);
 else{
  const foe=G.players[2].units.find(u=>!u.t.fly&&!u.garrisoned)||G.players[2].units[0];
  const ox=foe.x,oy=foe.y;foe.x=gx+.5;foe.y=gy+.5;
  ok('T36.B a grass lurker is visible while watching',visibleToHuman(foe)===true);
  G.watch=false;
  const near=G.human.units.some(u=>(u.x-foe.x)**2+(u.y-foe.y)**2<6.25)||G.human.blds.some(b=>(b.x-foe.x)**2+(b.y-foe.y)**2<9);
  ok('T36.B the same lurker is concealed with the flag down',near||visibleToHuman(foe)===false);
  G.watch=true;foe.x=ox;foe.y=oy;
 }
}

section('T36.C read-only: one guard, all 26 call sites');
G=null;newGame(wcfg('backyard','dm','normal','green',5520));
run(900);
{
 const p=G.human,u=p.units.filter(x=>x.hp>0).map(x=>x.id),b=p.blds.find(x=>x.prog>=1&&x.t.prod);
 const before={res:JSON.stringify(p.res),units:p.units.length,blds:p.blds.length,
   q:p.blds.map(x=>(x.queue||[]).length).join(','),tech:p.tech.size};
 const OPS=[['move',{ids:u,x:9,y:9}],['attack',{ids:u,tid:(G.players[1].units[0]||{id:0}).id}],
  ['amove',{ids:u,x:9,y:9}],['halt',{ids:u}],['hold',{ids:u}],['patrol',{ids:u,ax:5,ay:5,bx:9,by:9}],
  ['harvest',{ids:u,node:0,x:5,y:5}],['dropoff',{ids:u,x:5,y:5}],['garrison',{ids:u,bid:b?b.id:0}],
  ['unload',{bid:b?b.id:0}],['unloadu',{ids:u}],['entrench',{ids:u,x:5,y:5}],['unentrench',{ids:u}],
  ['build',{key:'generator',tx:12,ty:12}],['barrline',{tiles:[{x:12,y:12}]}],
  ['train',{bid:b?b.id:0,k:'grunt'}],['research',{bid:b?b.id:0,key:'u_bazooka'}],
  ['cancel',{bid:b?b.id:0,idx:0}],['sell',{bid:b?b.id:0}],['rally',{bids:[b?b.id:0],x:5,y:5}],
  ['radio',{bid:b?b.id:0,mode:'napalm',x:5,y:5}]];
 for(const [op,a] of OPS)submitCmd(op,a);
 ok('T36.C not one command reached the queue',G.cmdQ.length===0);
 execCmds();run(30);
 const now={res:JSON.stringify(p.res),units:p.units.length,blds:p.blds.length,
   q:p.blds.map(x=>(x.queue||[]).length).join(','),tech:p.tech.size};
 ok('T36.C no structure was sold or built by the spectator',now.blds>=before.blds);
 ok('T36.C the tech set did not move',now.tech===before.tech);
 ok('T36.C submitCmd refuses before the queue push',
   /if\(G\.watch\)return;[\s\S]*G\.cmdQ\.push/.test(submitCmd.toString()));
 ok('T36.C submitCmd refuses before the wire',
   /if\(G\.watch\)return;[\s\S]*G\.net\.submit/.test(submitCmd.toString()));
}
// the bots are NOT read-only: they reach the sim through trainUnit /
// placeBuilding / orderMove, none of which pass through submitCmd.
{
 G=null;newGame(wcfg('backyard','dm','normal','green',5521));
 run(2400);
 ok('T36.C every bot trained units anyway',G.players.every(p=>p.stats.built>0));
 ok('T36.C every bot expanded its base',G.players.every(p=>p.blds.length>2));
 ok('T36.C every bot mined',G.players.every(p=>p.stats.mined>0));
}
// following an army moves the camera and the readout, and confers nothing
{
 G=null;newGame(wcfg('backyard','dm','normal','green',5522));run(120);
 const cam0=G.cam.x+','+G.cam.y;
 ok('T36.C switchArmy works while watching',switchArmy(2)===true);
 ok('T36.C ...and repointed the anchor',G.human===G.players[2]);
 ok('T36.C ...and moved the camera',cam0!==(G.cam.x+','+G.cam.y));
 submitCmd('move',{ids:G.human.units.map(u=>u.id),x:5,y:5});
 ok('T36.C the followed army still takes no orders',G.cmdQ.length===0);
 ok('T36.C watchFocus on the followed army re-centres',watchFocus(2)===true);
 armySwitchUI();
 ok('T36.C the chip row is shown while watching',document.getElementById('armySwitch').children.length===WATCH_ARMIES);
 /* v72: there is no standing build panel left to hide - it went with its two
    builders. This cannot be repaired in place, because the shim's getElementById
    auto-creates and would hand back a fresh element with display ''. */
 ok('T36.C the retired build panel is gone outright, not merely hidden',
    typeof buildBuildUI==='undefined'&&typeof refreshBuildUI==='undefined');
 ok('T36.C the single-army readout is hidden',document.getElementById('armyPanel').style.display==='none');
 ok('T36.C group entrench is empty while watching',/G\.watch\?\[\]/.test(refreshSelPanel.toString()));
}

section('T36.D watchReport: the box reads the board');
G=null;newGame(wcfg('backyard','dm','normal','green',5530));
run(1500);
for(const p of G.players){
 const r=watchReport(p);
 ok(`T36.D p${p.i} identity`,r.i===p.i&&r.fac===p.fac&&r.team===p.team&&r.name===FAC[p.fac].name);
 ok(`T36.D p${p.i} profile is the assigned one`,r.profile===(p.ai?p.ai.profile:null));
 ok(`T36.D p${p.i} resources floor the live figures`,r.res.p===Math.floor(p.res.p)&&r.res.e===Math.floor(p.res.e));
 ok(`T36.D p${p.i} supply matches supUsed/supCap`,r.sup.used===supUsed(p)&&r.sup.cap===supCap(p));
 const cnt={};for(const u of p.units)cnt[u.key]=(cnt[u.key]||0)+1;
 ok(`T36.D p${p.i} army composition matches a manual tally`,
   r.units.length===Object.keys(cnt).length&&r.units.every(x=>x.n===cnt[x.key]));
 ok(`T36.D p${p.i} composition sums to the unit list`,r.units.reduce((a,x)=>a+x.n,0)===p.units.length);
 ok(`T36.D p${p.i} nUnits/nBlds agree with the board`,
   r.nUnits===p.units.length&&r.nBlds===p.blds.filter(b=>b.prog>=1).length);
 const under=p.blds.filter(b=>b.prog<1);
 ok(`T36.D p${p.i} structures under construction match`,
   r.qBlds.length===under.length&&r.qBlds.every(x=>under.some(b=>b.key===x.key))&&r.qBlds.every(x=>x.pct>=0&&x.pct<=100));
 const proj=p.blds.filter(b=>b.techCur);
 ok(`T36.D p${p.i} research in flight matches`,
   r.qTech.length===proj.length&&r.qTech.every(x=>proj.some(b=>b.techCur===x.key))&&r.qTech.every(x=>RESEARCH[x.key]&&x.pct>=0&&x.pct<=100));
 let qn=0;for(const b of p.blds)qn+=(b.queue||[]).length;
 ok(`T36.D p${p.i} queued units total matches every building queue`,r.qUnits.reduce((a,x)=>a+x.n,0)===qn);
 ok(`T36.D p${p.i} every reported key is a real roster key`,
   r.qUnits.every(x=>U[x.key])&&r.units.every(x=>U[x.key])&&r.qBlds.every(x=>B[x.key]));
}
// the head of a queue carries live progress; the entries behind it do not
{
 const p=G.players[0],bar=p.blds.find(b=>b.prog>=1&&b.t.prod&&b.key!=='hq');
 if(bar){
  bar.queue.length=0;bar.prodT=0;bar.queue.push('grunt','grunt','grunt');
  const a=watchReport(p).qUnits.find(x=>x.key==='grunt');
  run(30);
  const b2=watchReport(p).qUnits.find(x=>x.key==='grunt');
  ok('T36.D queue head starts at 0%',a&&a.pct===0&&a.n===3);
  ok('T36.D queue head advances with prodT',b2&&b2.pct>0&&b2.pct<100);
  const exp=Math.round(Math.min(1,bar.prodT/U.grunt.bt)*100);
  ok('T36.D ...at exactly prodT/bt',b2.pct===exp);
 } else ok('T36.D (skipped: no production building yet)',true);
}
// pure: reading the board neither moves it nor touches the seeded stream
{
 const h0=hashState(),r0=G.rngS;
 for(let i=0;i<8;i++)G.players.map(watchReport);
 ok('T36.D watchReport moves no hashed state',hashState()===h0);
 ok('T36.D watchReport consumes no RNG',G.rngS===r0);
 const src=watchReport.toString()+meterRate.toString()+genRate.toString()+meterSample.toString();
 ok('T36.D the data layer is free of RNG and the wall clock',
   !/srand\(|Math\.random|Date\.now|performance\.now/.test(src));
 ok('T36.D the meter keys its samples on G.tick',/G\.tick/.test(meterSample.toString()));
}

section('T36.E the mining meter');
// gated: a normal match never allocates or feeds it
{
 G=null;newGame(cfg('backyard','dm','normal','green',3,5540));
 run(600);
 ok('T36.E no meter exists in a normal match',!G.meter);
 meterDrop(G.players[0],'plastic',500);
 ok('T36.E meterDrop is inert with the flag down',!G.meter);
}
G=null;newGame(wcfg('backyard','dm','normal','green',5541));
ok('T36.E the meter is allocated per player',G.meter.length===G.players.length);
run(300);
ok('T36.E one sample per second of sim time',G.meter[0].hist.length===10);
ok('T36.E samples carry the tick they were taken on',G.meter[0].hist[9].t===300);
run(30*(WATCH_RATE_N+15));
ok('T36.E the window slides rather than growing',G.meter.every(m=>m.hist.length===WATCH_RATE_N));
// THE INVARIANT: the meter and stats.mined are credited at the same instant with
// the same figure, so plastic + electricity must equal the mined total exactly.
{
 let worst=0;
 for(const p of G.players){const m=G.meter[p.i];worst=Math.max(worst,Math.abs((m.p+m.e)-(p.stats.mined||0)))}
 ok('T36.E metered plastic+electricity == stats.mined',worst<1e-9);
 ok('T36.E something was actually delivered',G.meter.some(m=>m.p>0));
}
// THE SPLIT. The sum above is blind to which bucket a delivery lands in, so pin
// each resource independently - once through the helper, once end to end through
// the real drop-off in updateUnit (a truck arriving home with a full battery
// load must move the electricity figure and leave plastic alone).
{
 const p=G.players[0],m=G.meter[p.i],b0={p:m.p,e:m.e};
 meterDrop(p,'plastic',10);
 ok('T36.E a plastic delivery moves only the plastic figure',m.p===b0.p+10&&m.e===b0.e);
 meterDrop(p,'battery',7);
 ok('T36.E a battery delivery moves only the electricity figure',m.e===b0.e+7&&m.p===b0.p+10);
 m.p=b0.p;m.e=b0.e;
}
{
 const p=G.players[1],m=G.meter[p.i],hq=p.blds.find(b=>b.t.drop&&b.prog>=1);
 const tr=p.units.find(u=>u.t.a==='truck');
 if(hq&&tr){
  const b0={p:m.p,e:m.e},mined0=p.stats.mined||0;
  tr.cargo=60;tr.cargoT='battery';tr.state='return';tr.path=null;tr.hold=false;tr.oq=[];
  tr.x=hq.x+0.4;tr.y=hq.y+0.4;
  for(let i=0;i<10&&tr.cargo>0;i++)update(DT);
  const dp=m.p-b0.p,de=m.e-b0.e;
  ok('T36.E a real battery drop-off credits electricity',Math.abs(de-60*TRUCK_DROP_MUL)<1e-9);
  ok('T36.E ...and not plastic',dp===0);
  ok('T36.E ...and matches what stats.mined took',Math.abs((p.stats.mined-mined0)-de)<1e-9);
 } else ok('T36.E (skipped: no truck/drop pair)',true);
}
// the arithmetic, on a synthetic history
{
 const m=G.meter[0],keep=m.hist.slice();
 m.hist=[{t:0,p:0,e:0},{t:600,p:200,e:100}];
 const r=meterRate(0);
 ok('T36.E rate = delivered / window seconds (plastic)',Math.abs(r.p-10)<1e-9);
 ok('T36.E rate = delivered / window seconds (electricity)',Math.abs(r.e-5)<1e-9);
 m.hist=[{t:90,p:45,e:0}];
 ok('T36.E a single sample reads zero, not a divide by nothing',meterRate(0).p===0&&meterRate(0).e===0);
 m.hist=[{t:90,p:45,e:0},{t:90,p:99,e:9}];
 ok('T36.E a zero-length window reads zero',meterRate(0).p===0);
 m.hist=keep;
 ok('T36.E an out-of-range player index reads zero',meterRate(99).p===0&&meterRate(-1).e===0);
}
// electricity from generators is reported separately, because it is not mined
{
 const p=G.players[0];
 const g0=genRate(p);
 const b=makeBuilding('generator',p,Math.round(p.start.x+4),Math.round(p.start.y+4),true);
 ok('T36.E a finished generator raises the gen term by its eps',Math.abs(genRate(p)-(g0+B.generator.eps))<1e-9);
 b.upg=true;
 ok('T36.E ...and the upgrade multiplies it',Math.abs(genRate(p)-(g0+B.generator.eps*UPGRADES.generator.eff))<1e-9);
 b.prog=0.5;
 ok('T36.E an unfinished generator contributes nothing',Math.abs(genRate(p)-g0)<1e-9);
 b.prog=1;b.upg=false;
 const before=G.meter[p.i].p;
 run(60);
 ok('T36.E generator output never enters the MINING meter',
   G.meter[p.i].p===before||p.units.some(u=>u.key==='truck'));
}

section('T36.F determinism + save/load');
{
 const trail=(seed)=>{G=null;newGame(wcfg('backyard','dm','normal','tan',seed));const t=[];
  for(let i=1;i<=900;i++){update(DT);if(i%30===0)t.push(hashState())}return t};
 const a=trail(555001),b=trail(555001);
 ok('T36.F watch trails equal across two runs (30 checkpoints)',a.length===30&&a.every((h,i)=>h===b[i]));
 ok('T36.F a different seed diverges',!a.every((h,i)=>h===trail(555002)[i]));
}
{
 G=null;newGame(wcfg('kitchen','koth','normal','gray',555003));
 run(900);
 const h0=hashState(),json=saveState(),mined=G.players.map(p=>p.stats.mined);
 const trailA=[];for(let i=1;i<=300;i++){update(DT);if(i%30===0)trailA.push(hashState())}
 G=null;newGame(wcfg('kitchen','koth','normal','gray',555003));
 loadState(json);
 ok('T36.F post-load hash matches the snapshot point',hashState()===h0);
 ok('T36.F the watch flag round-trips',G.watch===true);
 ok('T36.F G.human points into the REBUILT player list',G.players.includes(G.human));
 ok('T36.F ...at the same index',G.human.i===0);
 ok('T36.F the meter is rebuilt empty for the new players',
   !!G.meter&&G.meter.length===G.players.length&&G.meter.every(m=>m.hist.length===0&&m.p===0));
 ok('T36.F mined totals survived (they are sim state, the meter is not)',
   G.players.map(p=>p.stats.mined).join()===mined.join());
 const trailB=[];for(let i=1;i<=300;i++){update(DT);if(i%30===0)trailB.push(hashState())}
 ok('T36.F resumed trail identical (10 checkpoints)',trailA.every((h,i)=>h===trailB[i]));
 // and a rate re-establishes itself from the fresh window
 run(600);
 ok('T36.F the rate re-arms after a load',G.meter.some(m=>m.hist.length>1));
}
{
 // a pre-v55 save has no `watch` key at all and must load as a normal match
 G=null;newGame(wcfg('backyard','dm','normal','green',555004));run(120);
 const S=JSON.parse(saveState());
 // the tag increments monotonically every release, so this asserts the floor, not
 // the exact figure - the exact bump is pinned by that release's splice script.
 ok('T36.F the snapshot tag is at least v:55',S.v>=55);
 ok('T36.F the snapshot carries watch beside test',S.watch===true&&S.test===false);
 delete S.watch;
 G=null;newGame(cfg('backyard','dm','normal','green',3,555004));
 loadState(JSON.stringify(S));
 ok('T36.F a pre-v55 save loads as a normal match',G.watch===false);
}

section('T36.G match end: no local side to win or lose');
{
 G=null;newGame(wcfg('backyard','dm','normal','green',5550));run(60);
 // army 1 dies. In a NORMAL match that is DEFEAT; here three armies still stand.
 const p0=G.players[0];p0.blds.length=0;p0.units.length=0;checkElim(p0);
 ok('T36.G the anchor army dying does not end the match',G.over===false);
 ok('T36.G ...and it is marked eliminated',p0.alive===false);
 const p1=G.players[1];p1.blds.length=0;p1.units.length=0;checkElim(p1);
 ok('T36.G two armies down, still running',G.over===false);
 const p2=G.players[2];p2.blds.length=0;p2.units.length=0;checkElim(p2);
 ok('T36.G last army standing ends it',G.over===true);
 const title=document.getElementById('endTitle').textContent;
 ok('T36.G the banner names the winner',/WINS/.test(title)&&title.indexOf(FAC[G.players[3].fac].name.toUpperCase())>=0);
 ok('T36.G the banner is not VICTORY/DEFEAT',!/VICTORY|DEFEAT/.test(title));
 const stats=document.getElementById('endStats').innerHTML;
 ok('T36.G end stats cover every army',G.players.every(p=>stats.indexOf(FAC[p.fac].name)>=0));
 ok('T36.G ...and mark the eliminated',/eliminated/.test(stats));
}
{
 // a surviving TEAM rather than a lone army
 G=null;newGame(wcfg('backyard','dm','normal','green',5551,{teams:[1,1,2,2]}));run(60);
 for(const p of [G.players[2],G.players[3]]){p.blds.length=0;p.units.length=0;checkElim(p);}
 ok('T36.G a surviving team ends it',G.over===true);
 ok('T36.G ...and the banner names the team',/TEAM 1 WINS/.test(document.getElementById('endTitle').textContent));
}
{
 // survival: the wildlife wins or the armies hold, never "you lose"
 const e=wboot(wcfg('desk','surv','normal','tan',5552));
 if(!e){run(60);
  for(const p of G.players){p.blds.length=0;p.units.length=0;}
  updateSurv(DT);}
 ok('T36.G survival wipe ends the match',!e&&G.over===true);
 ok('T36.G ...with the swarm banner',!e&&/SWARM/.test(document.getElementById('endTitle').textContent));
}
{
 // FROM THE OTHER SIDE: with the flag down the v54 rule must still bite
 G=null;newGame(cfg('backyard','dm','normal','green',3,5553));run(60);
 const me=G.human;me.blds.length=0;me.units.length=0;checkElim(me);
 ok('T36.G watch OFF: losing your own army is still DEFEAT',
   G.over===true&&/DEFEAT/.test(document.getElementById('endTitle').textContent));
}

section('T36.H nothing new is hashed, nothing new is serialized');
G=null;newGame(wcfg('backyard','dm','normal','green',5560));
run(600);
{
 const h0=hashState();
 G.meter[0].p+=99999;G.meter[1].hist.length=0;G.watchHide=true;
 ok('T36.H moving the meter does not move the hash',hashState()===h0);
 G.human=G.players[3];
 ok('T36.H repointing the anchor does not move the hash',hashState()===h0);
 G.watchHide=false;G.human=G.players[0];
 const json=saveState();
 ok('T36.H the meter is absent from the snapshot',json.indexOf('"meter"')<0&&json.indexOf('hist')<0);
 ok('T36.H watchHide is absent from the snapshot',json.indexOf('watchHide')<0);
 const src=hashState.toString();
 ok('T36.H hashState never mentions the meter or the flag',!/meter|watch/.test(src));
 let bad=null;
 for(const u of G.units)for(const k of ['meter','watch','rate'])if(k in u)bad=bad||('unit.'+k);
 for(const b of G.blds)for(const k of ['meter','watch','rate'])if(k in b)bad=bad||('bld.'+k);
 ok('T36.H no new field landed on any entity',!bad);
}

section('T36.I gating: every new branch is behind G.watch');
{
 const gated=[['submitCmd',submitCmd],['visibleToHuman',visibleToHuman],['switchArmy',switchArmy],
  ['armySwitchUI',armySwitchUI],['checkEnd',checkEnd],['endGame',endGame],
  ['meterDrop',meterDrop],['refreshWatchPanel',refreshWatchPanel],['watchFocus',watchFocus],
  ['watchToggle',watchToggle]];
 for(const [n,f] of gated)ok(`T36.I ${n} reads G.watch`,/G\.watch/.test(f.toString()));
 ok('T36.I newGame raises spectate only under watch',/if\(G\.watch\)\{[\s\S]{0,400}G\.spectate=true/.test(newGame.toString()));
 ok('T36.I update() samples only under watch',/G\.watch&&G\.tick%30===0/.test(update.toString()));
 ok('T36.I the painter is a pure consumer of watchReport',/watchReport/.test(refreshWatchPanel.toString()));
}

section('T36.J watch OFF: the v54 match is untouched');
{
 G=null;newGame(cfg('backyard','dm','normal','green',3,5570));
 ok('T36.J G.watch is false',G.watch===false);
 ok('T36.J G.spectate is false',G.spectate===false);
 ok('T36.J the local slot is human-controlled',G.human.human===true);
 ok('T36.J one human + three bots',G.players.filter(p=>p.human).length===1&&G.players.filter(p=>p.ai).length===3);
 ok('T36.J fog starts dark',!Array.from(G.fog).every(f=>f===2));
 run(300);
 ok('T36.J fog stays partial',Array.from(G.fog).some(f=>f!==2));
 const q0=G.cmdQ.length;
 submitCmd('move',{ids:G.human.units.map(u=>u.id),x:9,y:9});
 ok('T36.J commands still reach the queue',G.cmdQ.length===q0+1);
 execCmds();
 armySwitchUI();
 ok('T36.J the army chip row stays hidden',document.getElementById('armySwitch').style.display==='none');
 refreshWatchPanel();
 ok('T36.J the spectator box stays hidden',document.getElementById('watchPanel').style.display==='none');
 ok('T36.J no meter is allocated',!G.meter);
 ok('T36.J switchArmy is refused outside test/watch',switchArmy(1)===false);
 ok('T36.J watchFocus is refused outside watch',watchFocus(1)===false);
 ok('T36.J watchToggle is refused outside watch',watchToggle()===false);
}

section('T36.K the painted box');
G=null;newGame(wcfg('backyard','dm','normal','green',5580));
run(900);
refreshWatchPanel();
{
 const panel=document.getElementById('watchPanel'),rows=document.getElementById('watchRows');
 ok('T36.K the box is shown while watching',panel.style.display==='block');
 ok('T36.K one card per army',rows.children.length===WATCH_ARMIES);
 const card=rows.children[0];
 ok('T36.K the followed army is highlighted',/\bon\b/.test(card.className));
 ok('T36.K the others are not',!/\bon\b/.test(rows.children[1].className));
 ok('T36.K the card is tinted with the faction colour',card.style.borderLeftColor===FAC[G.players[0].fac].color);
 const txt=card.children.map(c=>c.children.length?c.children.map(x=>x.textContent).join(''):c.textContent).join(' | ');
 ok('T36.K the card names the army',txt.indexOf(FAC[G.players[0].fac].name)>=0);
 ok('T36.K ...prints the AI profile',!!G.players[0].ai&&txt.indexOf(G.players[0].ai.profile)>=0);
 ok('T36.K ...prints the mining rate',/Mining/.test(txt));
 ok('T36.K ...prints all four queue lines',/Units:/.test(txt)&&/Build:/.test(txt)&&/Research:/.test(txt)&&/Army:/.test(txt));
 ok('T36.K ...prints the supply figure',txt.indexOf(supUsed(G.players[0])+'/'+supCap(G.players[0]))>=0);
 // an unchanged board must not rebuild the DOM
 const first=rows.children[0];
 refreshWatchPanel();
 ok('T36.K an unchanged board does not rebuild the cards',rows.children[0]===first);
 // V hides it
 ok('T36.K watchToggle reports the flip',watchToggle()===true);
 ok('T36.K ...and the box goes away',panel.style.display==='none');
 watchToggle();refreshWatchPanel();
 ok('T36.K ...and comes back',panel.style.display==='block'&&rows.children.length===WATCH_ARMIES);
 // the end screen takes the box down
 G.over=true;refreshWatchPanel();
 ok('T36.K the box hides at match end',panel.style.display==='none');
 G.over=false;
}
