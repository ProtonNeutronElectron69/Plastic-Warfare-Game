/* ==========================================================================
   T15  v34: wave-survival tuning + fixes
     1) guard towers & garrisoned bunkers fire on hostile wildlife (G.neutrals),
        in survival AND in other modes (Option A) - the divergence-causing fix
     2) wave table rebalance: ant x3, every other species x2
     3) survival playable solo (opp 0), no CPU ally
     4) wave spawns land randomly on the map edges (audited invariant, now locked)
     5) the two starter plastic piles grow 30% (1800 -> 2340); batteries unchanged
   ========================================================================== */
'use strict';
section('T15 v34: survival tuning + fixes');

// bootSurv can't express opp 0 (survCfg does opp||2), so solo boots go direct.
function bootSolo(map,diff,fac,seed){G=null;newGame({map:map,mode:'surv',diff:diff||'normal',fac:fac||'green',opp:0,seed:seed});}

/* ---------- T15.1: towers & bunkers acquire and fire on wildlife ---------- */
{
 bootSurv('backyard',2,'normal','green',7001);
 const me=G.human;

 // guard tower vs a wave creature inside its range
 const gt=G.blds.find(b=>b.key==='guardtower'&&b.p===me&&b.prog>=1);
 ok('T15.1 player guard tower present',!!gt);
 // use a tanky roach so the target survives the window (a killed target resets to null)
 const crT=spawnWaveCreature('roach',gt.x+2,gt.y);crT.wave=true;const hT0=crT.hp;
 gt.cool=0;gt.target=null;
 for(let i=0;i<40;i++){G.tick++;updateBld(gt,DT);}
 ok('T15.1 guard tower acquires the wildlife target',gt.target===crT&&crT.hp>0);
 ok('T15.1 guard tower damages the wave creature',crT.hp<hT0);

 // garrisoned bunker vs a wave creature inside its range
 const bk=makeBuilding('bunker',me,Math.round(gt.x+7),Math.round(gt.y),true);bk.prog=1;
 const g=makeUnit('grunt',me,bk.x,bk.y);g.garrisoned=true;g.state='garrison';bk.garrison=[g.id];
 const crB=spawnWaveCreature('roach',bk.x+2,bk.y);crB.wave=true;const hB0=crB.hp;
 bk.cool=0;bk.target=null;
 for(let i=0;i<40;i++){G.tick++;updateBld(bk,DT);}
 ok('T15.1 garrisoned bunker acquires the wildlife target',bk.target===crB&&crB.hp>0);
 ok('T15.1 garrisoned bunker damages the wave creature',crB.hp<hB0);

 // an EMPTY bunker still ignores everything (garrison-gated, unchanged)
 const bk2=makeBuilding('bunker',me,Math.round(gt.x-7),Math.round(gt.y),true);bk2.prog=1;bk2.garrison=[];
 const crE=spawnWaveCreature('ant',bk2.x+2,bk2.y);crE.wave=true;const hE0=crE.hp;
 bk2.cool=0;bk2.target=null;
 for(let i=0;i<40;i++){G.tick++;updateBld(bk2,DT);}
 ok('T15.1 empty bunker does not fire',crE.hp===hE0);
}
{
 // Option A generalises to non-survival modes: a tower fires on nest wildlife too.
 G=null;newGame({map:'backyard',mode:'dm',diff:'normal',fac:'green',opp:1,seed:7100});
 const me=G.players.find(p=>p.human);
 // drop a guard tower for the human and a neutral creature right next to it
 const spot=(function(){for(let r=2;r<8;r++)for(let i=0;i<16;i++){const a=i/16*6.28;const tx=Math.round(me.start.x+dcos(a)*r-0.5),ty=Math.round(me.start.y+dsin(a)*r-0.5);if(canPlaceTower(tx,ty))return{tx,ty}}return null})();
 ok('T15.1 dm: found a tower spot',!!spot);
 const gt=makeBuilding('guardtower',me,spot.tx,spot.ty,true);gt.prog=1;
 const cr={kind:'creature',species:'roach',t:CREATURE.roach,p:G.neutral,nest:null,wave:false,
   x:gt.x+2,y:gt.y,hp:CREATURE.roach.hp,mhp:CREATURE.roach.hp,dm:CREATURE.roach.dm,sp:CREATURE.roach.sp,
   face:0,tface:0,cool:0,target:null,wob:0,bob:0,legph:0,flash:0,id:EID++};
 G.neutrals.push(cr);const h0=cr.hp;
 gt.cool=0;gt.target=null;
 for(let i=0;i<40;i++){G.tick++;updateBld(gt,DT);}
 ok('T15.1 dm: tower fires on nest wildlife (Option A generalises)',cr.hp<h0&&gt.target===cr&&cr.hp>0);
}

/* ---------- T15.2: wave table rebalance (ant x3, others x2) ---------- */
{
 ok('T15.2 wave 1 ant base (v37 +20%) =26',SURV_WAVES[0].ant===26);
 ok('T15.2 wave 2 = ant35 bee8',SURV_WAVES[1].ant===35&&SURV_WAVES[1].bee===8);
 ok('T15.2 wave 5 = fireant17 wasp12 mouse2',SURV_WAVES[4].fireant===17&&SURV_WAVES[4].wasp===12&&SURV_WAVES[4].mouse===2);
 ok('T15.2 wave 6 = ant43 bee17 fireant12 wasp6',SURV_WAVES[5].ant===43&&SURV_WAVES[5].bee===17&&SURV_WAVES[5].fireant===12&&SURV_WAVES[5].wasp===6);
 ok('T15.2 wave 11 fireant (v37) =35',SURV_WAVES[10].fireant===35);
 ok('T15.2 wave 15 = wasp35 roach23 mouse8',SURV_WAVES[14].wasp===35&&SURV_WAVES[14].roach===23&&SURV_WAVES[14].mouse===8);
 // v38: mouse base counts reverted to 2/4/4/4/8 (they now jitter/scale at spawn like other species)
 const mice=SURV_WAVES.map(w=>w.mouse||0).filter(m=>m>0);
 ok('T15.2 mouse base counts reverted = [2,4,4,4,8]',JSON.stringify(mice)===JSON.stringify([2,4,4,4,8]));
 // relative to the old base (soldier-ant tripled, everything else doubled): a
 // couple of spot ratio checks against the known pre-v34 values.
 ok('T15.2 wave 3 = ant26 bee14 fireant6 (v37 +20%)',
    SURV_WAVES[2].ant===26&&SURV_WAVES[2].bee===14&&SURV_WAVES[2].fireant===6);
}

/* ---------- T15.3: survival playable solo (no CPU ally) ---------- */
for(const m of T_MAPS){
 bootSolo(m,'normal','green',8000+m.length);
 const c=G.map.N/2;
 ok(`T15.3 ${m} solo = exactly 1 player`,G.players.length===1);
 ok(`T15.3 ${m} solo player is human, team 1`,G.players[0].human&&G.players[0].team===1);
 ok(`T15.3 ${m} solo has 1 central start`,G.map.starts.length===1&&nearC(G.map.starts[0],c,1));
 ok(`T15.3 ${m} solo not matchTeamed`,!matchTeamed());
 ok(`T15.3 ${m} solo G.surv present, wave 0, clock 60`,!!G.surv&&G.surv.no===0&&G.surv.t===60);
 // build phase runs clean
 let rerr=null;try{for(let i=0;i<300;i++)update(DT)}catch(e){rerr=e}
 ok(`T15.3 ${m} solo 300-tick build runs clean`,!rerr);
 ok(`T15.3 ${m} solo in bounds`,!boundsOK());
 ok(`T15.3 ${m} solo hash uint32`,(hashState()>>>0)===hashState());
 // trigger wave 1 and let it fight; game must NOT end while the lone HQ stands
 G.surv.t=0.0001;update(DT);
 const w1=(G.neutrals||[]).filter(cr=>cr.wave);
 ok(`T15.3 ${m} solo wave 1 spawns ants (v39: 1p pmul 0.8)`,w1.length>=15&&w1.length<=27&&w1.every(cr=>cr.species==='ant'));
 for(let i=0;i<300;i++)update(DT);
 ok(`T15.3 ${m} solo survives with HQ intact & not over`,!G.over&&G.players[0].blds.some(b=>b.key==='hq'&&b.hp>0));
}
{
 // lose condition still fires solo: nuke the only HQ, updateSurv ends the game
 bootSolo('backyard','normal','green',8500);
 for(let i=0;i<60;i++)update(DT);
 for(const b of G.players[0].blds.slice())if(b.key==='hq')b.hp=0;
 update(DT);
 ok('T15.3 solo loss when the lone HQ falls',G.over===true);
}

/* ---------- T15.4: wave spawns are edge-random (audited invariant) ---------- */
{
 bootSurv('backyard',2,'normal','green',8800);
 const N=G.map.N,edges={top:0,bottom:0,left:0,right:0,interior:0};
 const tiles=new Set();
 for(let i=0;i<600;i++){
  const p=waveEdgePoint();
  tiles.add(Math.round(p.x)+','+Math.round(p.y));
  const T=Math.abs(p.y-2)<3.5,B=Math.abs(p.y-(N-3))<3.5,L=Math.abs(p.x-2)<3.5,R=Math.abs(p.x-(N-3))<3.5;
  if(T)edges.top++;else if(B)edges.bottom++;else if(L)edges.left++;else if(R)edges.right++;else edges.interior++;
 }
 ok('T15.4 every spawn point lands on the perimeter',edges.interior===0);
 ok('T15.4 all four edges are used',edges.top>0&&edges.bottom>0&&edges.left>0&&edges.right>0);
 ok('T15.4 spawns spread across many edge tiles',tiles.size>=40);
 // determinism: same seed -> identical spawn sequence
 bootSurv('backyard',2,'normal','green',8800);
 let same=true;const seq=[];for(let i=0;i<50;i++){const p=waveEdgePoint();seq.push(p.x+','+p.y)}
 bootSurv('backyard',2,'normal','green',8800);
 for(let i=0;i<50;i++){const p=waveEdgePoint();if(seq[i]!==p.x+','+p.y){same=false;break}}
 ok('T15.4 edge-spawn RNG is deterministic (srand-only)',same);
}

/* ---------- T15.5: starter plastic +30% (batteries unchanged) ---------- */
for(const m of T_MAPS){
 bootSurv(m,2,'normal','green',9000+m.length);
 const c=G.map.N/2;
 const near=(G.map.nodes||[]).filter(n=>dhyp(n.x-c,n.y-c)<6);
 const plast=near.filter(n=>n.t==='plastic'),batt=near.filter(n=>n.t==='battery');
 ok(`T15.5 ${m} 2 starter plastic @ 2340`,plast.length===2&&plast.every(n=>n.amt===2340&&n.max===2340));
 ok(`T15.5 ${m} 2 starter battery @ 1400 (unchanged)`,batt.length===2&&batt.every(n=>n.amt===1400));
}

/* ---------- T15.6: solo determinism (dual-run + save/load) ---------- */
{
 const trail=(seed)=>{bootSolo('backyard','normal','tan',seed);G.surv.t=1.0;const t=[];for(let i=1;i<=900;i++){update(DT);if(i%30===0)t.push(hashState())}return t};
 const a=trail(960001),b=trail(960001);
 ok('T15.6 solo dual-run trails equal (30 pts, wave in play)',a.length===30&&a.every((h,i)=>h===b[i]));
 // save/load mid-wave in a solo game
 bootSolo('kitchen','normal','gray',960100);G.surv.t=0.5;
 for(let i=0;i<200;i++)update(DT);
 const airborne=(G.neutrals||[]).some(cr=>cr.wave&&cr.hp>0);
 ok('T15.6 solo has a wave airborne at snapshot',airborne);
 const h0=hashState(),json=saveState();
 const tA=[];for(let i=1;i<=150;i++){update(DT);if(i%30===0)tA.push(hashState())}
 // count arena nests before load so we can prove the re-carve prunes them on load too
 const arenaR=5.2+6,cc=G.map.N/2,nestsBoot=G.map.nests.length;
 bootSolo('kitchen','normal','gray',960100);loadState(json);
 ok('T15.6 solo post-load hash matches snapshot',hashState()===h0);
 // S7: loadState re-runs survivalSetup, so the reloaded map has the SAME pruned nest
 // list as the original boot (no arena nests reintroduced by makeMap).
 ok('T15.6 loadState re-carves the survival arena (nest count preserved)',
    G.map.nests.length===nestsBoot&&!G.map.nests.some(ns=>dhyp(ns.x-cc,ns.y-cc)<arenaR));
 const tB=[];for(let i=1;i<=150;i++){update(DT);if(i%30===0)tB.push(hashState())}
 ok('T15.6 solo resumed trail identical (5 pts)',tA.length===5&&tA.every((h,i)=>h===tB[i]));
}
