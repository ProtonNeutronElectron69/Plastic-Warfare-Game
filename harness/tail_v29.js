/* tail_v29.js — T10: v29 feature suite.
   Order queues (shift-queue semantics, pop sequence, truck bank-then-run),
   patrol oscillation and clearing, hold-position (no chase, fires in range),
   veterancy math and kill()/creature credit (barricades excluded), sell
   (refund math, removal, pass tiles, garrison pop, HQ rejection, research
   release), teams (targeting, splash, fog, flags, hill, win conditions, a
   1200-tick no-ally-targeting soak plus a 2700-tick team stability soak),
   stat history (sampling cadence, decimation, serialization), snapshot
   round-trips with plans active, pre-v29 save compat, medic speed. */
'use strict';
section('T10 v29: queues, patrol, hold, veterancy, sell, teams, stat history');

const DT10=1/30;

/* team match config: green+tan (team 1) vs gray+blue (team 2) */
function cfgTeam10(mode,seed){return{map:'backyard',mode,diff:'normal',fac:'green',opp:3,seed,slots:[
 {ctrl:'human',fac:'green',diff:'normal',local:true,team:1},
 {ctrl:'cpu',fac:'tan',diff:'normal',team:1},
 {ctrl:'cpu',fac:'gray',diff:'normal',team:2},
 {ctrl:'cpu',fac:'blue',diff:'normal',team:2}]}}

/* open ground far from every start, nest, and the hill: a quiet test arena.
   Tries strict clearance first, then progressively relaxes so every map yields one. */
function clearSpot10(){
 const N=G.map.N;
 /* v66: the den clearance joins the relaxation ladder. Every map now carries a
    mirrored pair of roach dens on top of its ant/bee dens, and a flat 13-tile
    keep-out no longer leaves a 6x2 clear rectangle anywhere on some seeds. The
    loosest tier still sits well outside any den's aggro radius (~5 tiles). */
 const tries=[{w:6,h:2,st:20,ns:13},{w:5,h:2,st:16,ns:13},{w:4,h:1,st:14,ns:11},{w:3,h:1,st:10,ns:8}];
 for(const t of tries){
  for(let y=8;y<N-8;y++)for(let x=8;x<N-8;x++){
   let good=true;
   for(let dy=-t.h;dy<=t.h&&good;dy++)for(let dx=-t.w;dx<=t.w;dx++){
    // clear ground only: passable, no quicksand sting, no concealing grass
    if(!passable(x+dx,y+dy)||G.map.fld[(y+dy)*N+(x+dx)]!==0){good=false;break}
   }
   if(!good)continue;
   for(const st of G.map.starts)if((st.x-x)**2+(st.y-y)**2<t.st*t.st)good=false;
   for(const ns of (G.map.nests||[]))if((ns.x-x)**2+(ns.y-y)**2<t.ns*t.ns)good=false;  // outside the den's reach
   for(const m of (G.map.mines||[]))if(m.live&&(m.x-x)**2+(m.y-y)**2<(t.w+3)**2)good=false; // no buried mines
   if(G.hill&&(G.hill.x-x)**2+(G.hill.y-y)**2<10*10)good=false;
   if(good)return{x:x+.5,y:y+.5};
  }
 }
 return null;
}

/* ================= order queue: pop sequence ================= */
{
 G=null;newGame(cfg('backyard','dm','normal','green',1,910001));
 const sp=clearSpot10();ok('T10 arena found (queue)',!!sp);
 /* v74: the tier ladder can hand back a 3-wide arena, so the old fixed -5 / +5
    span reached ground the picker never checked. Measure the clear run each way
    and place the spawn and the far waypoint inside it. RR>=4 keeps every pair of
    waypoints at least 2 tiles apart, comfortably outside the 1.2 arrival
    tolerance, so the ordering assertion below stays strict. */
 const aX=Math.floor(sp.x),aY=Math.floor(sp.y);
 let RL=0;while(RL<5&&passable(aX-RL-1,aY))RL++;
 let RR=0;while(RR<5&&passable(aX+RR+1,aY))RR++;
 ok('T10 arena run wide enough for the queue',RL>=2&&RR>=4);
 const u=makeUnit('grunt',G.human,sp.x-RL,sp.y);
 const A={x:sp.x-2,y:sp.y},B={x:sp.x+2,y:sp.y},C={x:sp.x+RR,y:sp.y};
 submitCmd('move',{ids:[u.id],x:A.x,y:A.y,am:0});
 submitCmd('move',{ids:[u.id],x:B.x,y:B.y,am:0,q:1});
 submitCmd('move',{ids:[u.id],x:C.x,y:C.y,am:0,q:1});
 run(2);
 ok('T10 queue holds 2 pending orders after submit',u.oq.length===2);
 let tA=0,tB=0,tC=0;
 for(let i=3;i<=900;i++){update(DT10);
  if(!tA&&dhyp(u.x-A.x,u.y-A.y)<1.2)tA=i;
  if(!tB&&dhyp(u.x-B.x,u.y-B.y)<1.2)tB=i;
  if(!tC&&dhyp(u.x-C.x,u.y-C.y)<1.2)tC=i;
  if(tC)break;
 }
 ok('T10 queued waypoints visited in order',tA>0&&tB>tA&&tC>tB);
 ok('T10 queue drained after the run',u.oq.length===0);
 // a plain (unshifted) order wipes any queue
 submitCmd('move',{ids:[u.id],x:A.x,y:A.y,am:0,q:1});
 submitCmd('move',{ids:[u.id],x:B.x,y:B.y,am:0,q:1});
 run(1);
 submitCmd('move',{ids:[u.id],x:C.x,y:C.y,am:0});
 run(1);
 ok('T10 plain order clears the queue',u.oq.length===0);
}

/* ================= patrol: oscillation + clearing ================= */
{
 G=null;newGame(cfg('backyard','dm','normal','green',1,910002));
 const sp=clearSpot10();ok('T10 arena found (patrol)',!!sp);
 const u=makeUnit('grunt',G.human,sp.x,sp.y);
 const A={x:sp.x-3,y:sp.y},B={x:sp.x+3,y:sp.y};
 submitCmd('patrol',{ids:[u.id],ax:A.x,ay:A.y,bx:B.x,by:B.y});
 run(1);
 ok('T10 patrol installed',!!u.patrol);
 let visA=0,visB=0,atA=false,atB=false;
 for(let i=0;i<1500;i++){update(DT10);
  const dA=dhyp(u.x-A.x,u.y-A.y)<1.2,dB=dhyp(u.x-B.x,u.y-B.y)<1.2;
  if(dA&&!atA){visA++;atA=true}else if(!dA)atA=false;
  if(dB&&!atB){visB++;atB=true}else if(!dB)atB=false;
  if(visA>=2&&visB>=2)break;
 }
 ok('T10 patrol oscillates A<->B (2+ visits each)',visA>=2&&visB>=2);
 ok('T10 patrol persists across legs',!!u.patrol);
 submitCmd('move',{ids:[u.id],x:sp.x,y:sp.y,am:0});
 run(1);
 ok('T10 a direct order clears the patrol',u.patrol==null);
 // degenerate patrol (A~B) degrades to a plain attack-move, no endless flip
 submitCmd('patrol',{ids:[u.id],ax:sp.x,ay:sp.y,bx:sp.x+0.5,by:sp.y});
 run(1);
 ok('T10 degenerate patrol declines to install',u.patrol==null&&(u.state==='amove'||u.state==='idle'));
}

/* ================= hold position: no chase, fires in range ================= */
{
 G=null;newGame(cfg('backyard','dm','normal','green',1,910003));
 const sp=clearSpot10();ok('T10 arena found (hold)',!!sp);
 const holder=makeUnit('grunt',G.human,sp.x,sp.y);
 // neutral-owned bait: hostile to the holder (team -1), but no AI economy can
 // re-dispatch it (the CPU truck dispatcher ignores parked and would drive an
 // enemy-owned bait through the holder's ring — pre-existing behavior)
 const bait=makeUnit('truck',G.neutral,sp.x+5,sp.y);bait.parked=true;
 submitCmd('hold',{ids:[holder.id]});
 run(300);
 ok('T10 hold set',holder.hold===true);
 ok('T10 held unit refuses to chase (drift < 0.8)',dhyp(holder.x-sp.x,holder.y-sp.y)<0.8);
 ok('T10 out-of-range bait untouched',bait.hp===bait.mhp);
 bait.x=sp.x+2.5;bait.y=sp.y;bait.parked=true; // now inside grunt range
 run(200);
 ok('T10 held unit fires at what it can reach',bait.hp<bait.mhp);
 ok('T10 held unit still anchored after firing',dhyp(holder.x-sp.x,holder.y-sp.y)<0.8);
 // X (halt) releases hold
 submitCmd('halt',{ids:[holder.id]});
 run(1);
 ok('T10 halt releases hold',holder.hold===false);
}

/* ================= veterancy: math + credit paths ================= */
{
 G=null;newGame(cfg('backyard','dm','normal','green',1,910004));
 const sp=clearSpot10();
 /* v75: the rungs are per class now - VET_INF for anything whose armor class is
    'inf', VET_VEH for the rest - so the ladder is walked TWICE, once on a Grunt
    and once on a Tank. The multipliers, the immediate HP grant and the
    rank-to-rank compounding are all unchanged and are still asserted here. */
 ok('T10 the ladder is 1/2/4 for infantry and 2/4/8 for everything else',
    VET_INF.join()==='1,2,4'&&VET_VEH.join()==='2,4,8');
 const u=makeUnit('grunt',G.human,sp.x,sp.y);
 const tk=makeUnit('tank',G.human,sp.x+2,sp.y);
 ok('T10 the ladder is picked off the unit TYPE, not the unit',
    vetSteps(u)===VET_INF&&vetSteps(tk)===VET_VEH);
 const d0=u.dm,m0=u.mhp;
 const m1=Math.round(m0*1.1);
 vetRankUp(u);
 ok('T10 infantry rank 1 at 1 kill: +10% dmg',u.kl===1&&u.vr===1&&Math.abs(u.dm-d0*1.1)<1e-9);
 ok('T10 rank 1: +10% max HP granted immediately',u.mhp===m1&&u.hp===m1);
 vetRankUp(u);
 const m2=Math.round(m1*(1.2/1.1));
 ok('T10 infantry rank 2 at 2 kills: +20% dmg total',u.vr===2&&Math.abs(u.dm-d0*1.2)<1e-6);
 ok('T10 rank 2 max HP compounds from rank 1',u.mhp===m2);
 vetRankUp(u);
 ok('T10 no rank 3 before 4 kills',u.kl===3&&u.vr===2);
 vetRankUp(u);
 ok('T10 infantry rank 3 at 4 kills, capped',u.kl===4&&u.vr===3&&Math.abs(u.dm-d0*1.3)<1e-6);
 vetRankUp(u);
 ok('T10 kills past rank 3 still count, rank stays 3',u.kl===5&&u.vr===3);
 // ...and the same ladder one rung apart on a vehicle
 const t0=tk.dm;
 vetRankUp(tk);
 ok('T10 a vehicle holds rank 0 at one kill',tk.kl===1&&tk.vr===0&&tk.dm===t0);
 vetRankUp(tk);
 ok('T10 vehicle rank 1 at 2 kills',tk.vr===1&&Math.abs(tk.dm-t0*1.1)<1e-9);
 for(let i=0;i<2;i++)vetRankUp(tk);
 ok('T10 vehicle rank 2 at 4 kills',tk.kl===4&&tk.vr===2&&Math.abs(tk.dm-t0*1.2)<1e-6);
 for(let i=0;i<4;i++)vetRankUp(tk);
 ok('T10 vehicle rank 3 at 8 kills, capped',tk.kl===8&&tk.vr===3&&Math.abs(tk.dm-t0*1.3)<1e-6);
 // kill() integration: enemy unit death credits the attacker
 const foe=G.players.find(p=>p!==G.human);
 const victim=makeUnit('grunt',foe,sp.x+3,sp.y);
 const k0=u.kl;kill(victim,u);
 ok('T10 kill() credits veterancy',u.kl===k0+1);
 // barricades never grant credit (stats.kills still counts, as before)
 const bx=Math.floor(sp.x+5),by=Math.floor(sp.y+2);
 const wall=makeBuilding('barricade',G.neutral,bx,by,true);
 const k1=u.kl,s1=G.human.stats.kills;
 kill(wall,u);
 ok('T10 barricade kills grant no veterancy',u.kl===k1&&G.human.stats.kills===s1+1);
 // creature deaths credit through applyDmg (they bypass kill())
 const cr={kind:'creature',hp:5,x:sp.x,y:sp.y,t:CREATURE.ant,p:G.neutral};
 const k2=u.kl;applyDmg(cr,999,'b',u);
 ok('T10 creature kills credit veterancy',cr.hp===0&&u.kl===k2+1);
}

/* ================= sell: refunds, removal, garrison, HQ, research ================= */
{
 G=null;newGame(cfg('backyard','dm','normal','green',1,910005));
 const sp=clearSpot10();
 const p=G.human;p.res.p=5000;p.res.e=5000;
 const tx=Math.floor(sp.x-3),ty=Math.floor(sp.y-1);
 const b=makeBuilding('barracks',p,tx,ty,true);
 trainUnit(b,'grunt');
 const before={p:p.res.p,e:p.res.e};
 const uc=ucost(p,'grunt'),half=Math.round(bcost(p,'barracks').p*0.5);
 submitCmd('sell',{bid:b.id});execCmds();
 ok('T10 sell refunds queue + 50% plastic',p.res.p===before.p+uc.p+half&&p.res.e===before.e+uc.e);
 ok('T10 sold building removed from the world',!G.blds.includes(b)&&!p.blds.includes(b));
 let freed=true;
 for(let y=0;y<b.sz;y++)for(let x=0;x<b.sz;x++)if(G.map.pass[(ty+y)*G.map.N+(tx+x)]!==1)freed=false;
 ok('T10 sold footprint walkable again',freed);
 // bunker: garrison pops out unharmed
 const b2=makeBuilding('bunker',p,tx+5,ty,true);
 const g=makeUnit('grunt',p,tx+5,ty+3);
 g.garrisoned=true;b2.garrison.push(g);
 submitCmd('sell',{bid:b2.id});execCmds();
 ok('T10 sold bunker pops its garrison unharmed',g.garrisoned===false&&g.hp===g.mhp&&!G.blds.includes(b2));
 // the HQ can never be sold
 const hq=p.blds.find(x=>x.key==='hq');
 submitCmd('sell',{bid:hq.id});execCmds();
 ok('T10 HQ sell rejected',p.blds.includes(hq)&&hq.hp>0);
 // selling mid-research releases the project back to the pool
 const lab=makeBuilding('lab',p,tx,ty+5,true);
 const key=researchCatalog(p).find(k=>!hasTech(p,k)&&!p.techQ.includes(k));
 ok('T10 research key available for the sell test',!!key);
 startResearch(lab,key);
 ok('T10 research underway before sell',lab.techCur===key&&p.techQ.includes(key));
 submitCmd('sell',{bid:lab.id});execCmds();
 ok('T10 sold lab releases its research project',!p.techQ.includes(key)&&!hasTech(p,key));
}

/* ================= teams: targeting, splash, fog, flags, probes ================= */
{
 G=null;newGame(cfgTeam10('ctf',910006));
 const [pg,pt,pgr]=[G.players[0],G.players[1],G.players[2]];
 ok('T10 team slots applied',pg.team===1&&pt.team===1&&pgr.team===2&&G.players[3].team===2);
 ok('T10 allied() basics',allied(pg,pt)&&!allied(pg,pgr)&&!allied(pg,G.neutral));
 ok('T10 match reads as teamed',matchTeamed()===true);
 const sp=clearSpot10();
 const me=makeUnit('grunt',pg,sp.x,sp.y);
 const ally=makeUnit('grunt',pt,sp.x+2,sp.y);
 ok('T10 nearestEnemy ignores the adjacent ally',nearestEnemy(me,6)==null);
 const foe=makeUnit('grunt',pgr,sp.x+3.2,sp.y);
 ok('T10 nearestEnemy still finds the enemy',nearestEnemy(me,6)===foe);
 const ah=ally.hp,fh=foe.hp;
 splash(sp.x+2.6,sp.y,2.2,30,'ex',me);
 ok('T10 splash spares the ally',ally.hp===ah);
 ok('T10 splash still burns the enemy',foe.hp<fh);
 // shared vision: an allied unit lights the fog; an enemy does not
 const aFar=makeUnit('grunt',pt,4.5,4.5);
 updateFog();
 ok('T10 allied unit reveals fog',G.fog[Math.floor(aFar.y)*G.map.N+Math.floor(aFar.x)]===2);
 // find a still-unexplored tile, drop an ENEMY there: the fog must stay shut
 let dark=-1;const N10=G.map.N;
 for(let i=0;i<G.fog.length;i++)if(G.fog[i]===0){dark=i;break}
 ok('T10 an unexplored tile exists for the enemy-fog probe',dark>=0);
 const eFar=makeUnit('grunt',pgr,(dark%N10)+0.5,Math.floor(dark/N10)+0.5);
 updateFog();
 ok('T10 enemy unit does not reveal fog',G.fog[dark]!==2);
 ok('T10 visibleToHuman covers the whole team',visibleToHuman(aFar)===true);
 // CTF: allies never steal each other's flags; enemies still can
 const flag=G.flags.find(f=>f.owner===pg);
 ally.x=flag.x;ally.y=flag.y;updateFlags();
 ok('T10 ally cannot pick up your flag',flag.carrier==null&&ally.flag==null);
 foe.x=flag.x;foe.y=flag.y;foe.hp=foe.mhp;updateFlags();
 ok('T10 enemy still captures your flag',flag.carrier===foe);
 dropFlag(foe); // tidy up for the probes below
}

/* ================= teams: KOTH hill sharing + team-sum win ================= */
{
 G=null;newGame(cfgTeam10('koth',910007));
 const h=G.hill;
 const ug=makeUnit('grunt',G.players[0],h.x,h.y);
 const ut=makeUnit('grunt',G.players[1],h.x+1,h.y);
 updateHill(DT10);
 ok('T10 two allies alone on the hill still hold it',h.holder===G.players[0]);
 ok('T10 hill score accrues to the holding player',G.players[0].kothScore>0);
 const ue=makeUnit('grunt',G.players[2],h.x,h.y+1);
 updateHill(DT10);
 ok('T10 an enemy on the hill contests it',h.holder==null);
 ue.x=2.5;ue.y=2.5; // enemy leaves
 G.players[0].kothScore=KOTH_TARGET*0.6;
 G.players[1].kothScore=KOTH_TARGET*0.5; // summed: over the target
 let winArg=null;const realEnd=endGame;endGame=w=>{winArg=w;realEnd(w)};
 updateHill(DT10);
 endGame=realEnd;
 ok('T10 KOTH: the TEAM sum wins',G.over===true&&winArg===true);
}

/* ================= teams: CTF team-sum win ================= */
{
 G=null;newGame(cfgTeam10('ctf',910008));
 G.players[0].score=2;G.players[1].score=1; // team 1 sums to 3
 let winArg=null;const realEnd=endGame;endGame=w=>{winArg=w;realEnd(w)};
 checkEnd();
 endGame=realEnd;
 ok('T10 CTF: the TEAM sum of captures wins',G.over===true&&winArg===true);
}

/* ================= teams: DM win when all enemy teams fall ================= */
{
 G=null;newGame(cfgTeam10('dm',910009));
 let winArg=null;const realEnd=endGame;endGame=w=>{winArg=w;realEnd(w)};
 for(const b of G.players[2].blds.slice())kill(b,null);
 ok('T10 first enemy elimination alone does not end a team match',G.over===false&&G.players[2].alive===false);
 for(const b of G.players[3].blds.slice())kill(b,null);
 endGame=realEnd;
 ok('T10 DM: last enemy team down ends the match in victory',G.over===true&&winArg===true&&G.players[3].alive===false);
}

/* ================= teams: no ally targeting across a 1200-tick soak ================= */
{
 G=null;newGame(cfgTeam10('dm',910010));
 let vio=0;
 for(let i=1;i<=1200;i++){update(DT10);
  if(i%30===0){
   for(const u of G.units)if(u.target&&u.target.p&&allied(u.p,u.target.p))vio++;
   for(const b of G.blds)if(b.target&&b.target.p&&allied(b.p,b.target.p))vio++;
  }
 }
 ok('T10 soak: nothing ever targets an ally',vio===0);
 ok('T10 soak: the team match stays alive and populated',!G.over&&G.units.length>8);
 const be=boundsOK();
 ok('T10 soak: bounds & HP sane in team play'+(be?' ('+be+')':''),be==null);
}

/* ================= stat history: cadence, content, decimation ================= */
{
 G=null;newGame(cfg('backyard','dm','normal','green',2,910011));
 run(900);
 const Hs=G.statHist;
 ok('T10 stat samples at tick 1 then every 150 (7 by tick 900)',Hs.t.length===7&&Hs.iv===150);
 ok('T10 stat rows track every player at every sample',Hs.rows.length===G.players.length&&Hs.rows.every(r=>r.av.length===7&&r.kl.length===7&&r.mn.length===7));
 ok('T10 army value samples are positive',Hs.rows[0].av[0]>0);
 ok('T10 mining totals accumulate by 30s',(G.human.stats.mined||0)>0&&Hs.rows[G.human.i].mn[6]>0);
 ok('T10 mined totals are monotonic',Hs.rows[G.human.i].mn.every((v,i,a)=>i===0||v>=a[i-1]));
 // decimation: fabricate a 721-sample history, the next sample halves it
 const fake=n=>Array.from({length:n},(_,i)=>i);
 Hs.t=fake(721).map(i=>+(i*5).toFixed(1));
 for(const r of Hs.rows){r.av=fake(721);r.kl=fake(721);r.mn=fake(721);}
 statSample();
 ok('T10 decimation halves the history past 720 samples',Hs.t.length===361&&Hs.rows[0].av.length===361&&Hs.iv===300);
}

/* ================= snapshots: plans survive a round trip bit-identically ================= */
{
 G=null;newGame(cfgTeam10('dm',910012));
 run(300); // a few stat samples + live sim state
 const sp=clearSpot10();
 const uq=makeUnit('grunt',G.human,sp.x,sp.y);
 const up=makeUnit('grunt',G.human,sp.x+1,sp.y);
 const uh=makeUnit('grunt',G.human,sp.x+2,sp.y);
 const uv=makeUnit('grunt',G.human,sp.x+3,sp.y);
 submitCmd('move',{ids:[uq.id],x:sp.x-4,y:sp.y,am:0});
 submitCmd('move',{ids:[uq.id],x:sp.x-4,y:sp.y+2,am:1,q:1});
 submitCmd('move',{ids:[uq.id],x:sp.x-4,y:sp.y+4,am:0,q:1});
 submitCmd('patrol',{ids:[up.id],ax:sp.x+1,ay:sp.y-3,bx:sp.x+1,by:sp.y+3});
 submitCmd('hold',{ids:[uh.id]});
 run(2);
 vetRankUp(uv);vetRankUp(uv);vetRankUp(uv);
 // v75: three kills on infantry is rank 2 now (VET_INF 1/2/4), not rank 1
 ok('T10 snapshot prep: plans live',uq.oq.length===2&&up.patrol!=null&&uh.hold===true&&uv.vr===2);
 const h1=hashState(),hist1=JSON.stringify(G.statHist),ids={q:uq.id,p:up.id,h:uh.id,v:uv.id};
 const sv=saveState();
 ok('T10 snapshot tag is v29+',JSON.parse(sv).v>=29);
 loadState(sv);
 ok('T10 loaded game resumes on a bit-identical hash',hashState()===h1);
 ok('T10 stat history survives the round trip exactly',JSON.stringify(G.statHist)===hist1);
 const q2=G.units.find(u=>u.id===ids.q),p2=G.units.find(u=>u.id===ids.p),h2=G.units.find(u=>u.id===ids.h),v2=G.units.find(u=>u.id===ids.v);
 ok('T10 order queue survives load',q2&&q2.oq.length===2&&q2.oq[0].op==='move');
 ok('T10 patrol survives load',p2&&p2.patrol&&typeof p2.patrol.leg==='number');
 ok('T10 hold survives load',h2&&h2.hold===true);
 ok('T10 veterancy survives load',v2&&v2.vr===2&&v2.kl===3);
 ok('T10 teams survive load',G.players[1].team===1&&G.players[2].team===2);
 // and the loaded game keeps running identically to a second load
 const tA2=[];for(let i=1;i<=150;i++){update(DT10);if(i%30===0)tA2.push(hashState())}
 loadState(sv);
 const tB2=[];for(let i=1;i<=150;i++){update(DT10);if(i%30===0)tB2.push(hashState())}
 ok('T10 loaded games evolve on identical trails',tA2.length===5&&tA2.every((h,i)=>h===tB2[i]));
}

/* ================= pre-v29 saves: defaults applied, loads clean ================= */
{
 G=null;newGame(cfg('backyard','dm','normal','tan',3,910013));
 run(240);
 const legacy=JSON.parse(saveState());
 legacy.v=28;
 delete legacy.statHist;
 for(const sp2 of legacy.players){delete sp2.team;if(sp2.stats)delete sp2.stats.mined;}
 for(const u of legacy.units){delete u.oq;delete u.patrol;delete u.hold;delete u.kl;delete u.vr;}
 let err=null;
 try{loadState(JSON.stringify(legacy));}catch(e){err=e}
 ok('T10 pre-v29 save loads clean',err==null);
 ok('T10 legacy units get queue/hold/vet defaults',err==null&&G.units.every(u=>Array.isArray(u.oq)&&u.hold===false&&u.kl===0&&u.vr===0));
 ok('T10 legacy players load as FFA with mined=0',err==null&&G.players.every((p,i)=>p.team===i+1&&p.stats.mined===0));
 ok('T10 legacy games get a fresh stat history',err==null&&G.statHist&&G.statHist.t.length===0&&G.statHist.rows.length===G.players.length);
 let err2=null;try{run(60)}catch(e){err2=e}
 ok('T10 legacy game runs on after load',err2==null&&!isNaN(hashState()));
}

/* ================= medic speed ================= */
ok('T10 medic truck paces the grunt',U.medic.sp===U.grunt.sp&&U.medic.sp===2.3);

/* ================= team stability soak: koth + ctf, 2700 ticks ================= */
for(const [mode,seed] of [['koth',910014],['ctf',910015]]){
 G=null;newGame(cfgTeam10(mode,seed));
 let err=null,vio=0;
 try{
  for(let i=1;i<=2700;i++){update(DT10);
   if(G.over)break;
   if(i%90===0){for(const u of G.units)if(u.target&&u.target.p&&allied(u.p,u.target.p))vio++;}
  }
 }catch(e){err=e}
 const be=boundsOK();
 ok(`T10 team ${mode} soak: 90s clean (no throw, no ally fire, sane bounds)`,err==null&&vio===0&&be==null);
}
