/* tail_v35.js — T16: "The Desk", a Wave-Survival-only map.
   1) registry: Desk is survival-only (survOnly), N=72, theme 'desk'
   2) curated economy at 1 & 4 players: a centre ring of (players+1) plastic +
      (players+1) batteries inside the arena, plus one exposed plastic+battery pair
      ~45% of the way toward each of the 4 corners (8 corner nodes total)
   3) hazards: spilled soda re-skins sand (fld code 2: slows, doesn't block) and the
      water spill blocks (code 3); soda inherits every code-2 rule byte-for-byte
   4) waves spawn & fight cleanly on Desk
   5) determinism dual-run + save/load bit-identical (the Desk economy is rebuilt
      deterministically on load, so this exercises the risky loadState path)         */
'use strict';
section('T16 v35: The Desk (survival-only map)');

// survCfg (from tail_v33) coerces opp||2, which would turn a solo (opp=0) boot into
// a 3-player game; use a pass-through cfg so 1-player Desk is exercised honestly.
function deskCfg(opp,diff,fac,seed){return{map:'desk',mode:'surv',diff:diff||'normal',fac:fac||'green',opp:opp,seed}}
function bootDesk(opp,diff,fac,seed){G=null;newGame(deskCfg(opp,diff,fac,seed));}

/* ---------- T16.0: registry ---------- */
ok('T16.0 desk registered survOnly', !!MAPS.desk && MAPS.desk.survOnly===true);
ok('T16.0 desk theme + size', MAPS.desk && MAPS.desk.theme==='desk' && MAPS.desk.N===72);
ok('T16.0 desk excluded from generic T_MAPS', !T_MAPS.includes('desk'));

/* ---------- T16.1: curated economy at 1 and 4 players ---------- */
for(const opp of [0,3]){
 const players=opp+1;
 let err=null;
 try{bootDesk(opp,'normal','green',6100+opp)}catch(e){err=e}
 ok(`T16.1 desk/${players}p boots`,!err);
 if(err){console.log('   ',err.stack.split('\n')[0]);continue}
 const N=G.map.N, cc=N/2+0.5;
 ok(`T16.1 desk/${players}p defender count = players`,G.players.length===players);
 ok(`T16.1 desk/${players}p everyone on one team`,G.players.every(p=>p.team===1));
 // (at 1 player the solo HQ sits on the exact centre, so check the carved interior, not that one tile)
 let openNear=0;for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){if(passable(Math.floor(cc)+dx,Math.floor(cc)+dy))openNear++;}
 ok(`T16.1 desk/${players}p arena carved open`,openNear>=120);
 ok(`T16.1 desk/${players}p starts clustered at centre`,G.map.starts.every(s=>nearC(s,cc,9)));

 const ring=G.map.nodes.filter(n=>nearC(n,cc,11));
 const corner=G.map.nodes.filter(n=>{const d=dhyp(n.x-cc,n.y-cc);return d>=13&&d<=34;}); // v36: pairs now ~70% out (~30 tiles)
 ok(`T16.1 desk/${players}p centre ring = 2*(players+1) nodes`,ring.length===2*(players+1));
 ok(`T16.1 desk/${players}p ring split (players+1 each)`,
    ring.filter(n=>n.t==='plastic').length===players+1 && ring.filter(n=>n.t==='battery').length===players+1);
 /* v77: the amounts moved (+20%) and are now named. The exact numbers are pinned
    once, in T52.D; what T16.1 owns is that the RING gets ring amounts and not the
    corner ones, which is the claim this section was always making. */
 ok(`T16.1 desk/${players}p ring amounts are the ring amounts`,
    ring.every(n=>n.t==='plastic'?n.amt===DESK_RING_P:n.amt===DESK_RING_E));
 ok(`T16.1 desk/${players}p total nodes = ring + 8 corner`,G.map.nodes.length===2*(players+1)+8);

 // 4 exposed corner pairs, one plastic + one battery per quadrant, out in the wave zone
 ok(`T16.1 desk/${players}p 8 corner nodes`,corner.length===8);
 ok(`T16.1 desk/${players}p corner split 4+4`,
    corner.filter(n=>n.t==='plastic').length===4 && corner.filter(n=>n.t==='battery').length===4);
 ok(`T16.1 desk/${players}p corner amounts (v37 3240 / 2340)`,
    corner.every(n=>n.t==='plastic'?n.amt===3240:n.amt===2340));
 let quadOK=true;
 for(const [sx,sy] of [[-1,-1],[1,1],[1,-1],[-1,1]]){
  const q=corner.filter(n=>Math.sign(n.x-cc)===sx&&Math.sign(n.y-cc)===sy);
  if(q.filter(n=>n.t==='plastic').length!==1||q.filter(n=>n.t==='battery').length!==1)quadOK=false;
 }
 ok(`T16.1 desk/${players}p one plastic+battery pair per corner`,quadOK);
 // ~45% of the way toward the corners: centre->corner(inset 6) is ~43 tiles, 45% ~= 19.4
 ok(`T16.1 desk/${players}p corner pairs ~70% out (v36)`,corner.every(n=>{const d=dhyp(n.x-cc,n.y-cc);return d>=25&&d<=33;}));

 // build phase runs clean
 let rerr=null;try{run(300)}catch(e){rerr=e}
 ok(`T16.1 desk/${players}p runs 300 clean`,!rerr && !boundsOK());
}

/* ---------- T16.2: hazards — spilled soda re-skins sand, water blocks ---------- */
{
 bootDesk(3,'normal','green',6222);
 const N=G.map.N, fld=G.map.fld;
 // find a soda tile (code 2) and a water tile (code 3)
 let soda=null, water=null;
 for(let y=0;y<N&&(!soda||!water);y++)for(let x=0;x<N;x++){const f=fld[y*N+x];
  if(f===2&&!soda)soda={x,y}; if(f===3&&!water)water={x,y}; if(soda&&water)break;}
 ok('T16.2 soda field present (code 2)',!!soda);
 ok('T16.2 water field present (code 3)',!!water);
 ok('T16.2 M.fields carries a soda kind',(G.map.fields||[]).some(f=>f.kind==='soda'));
 /* v66: the Desk's impassable hazard is spilled COFFEE now (still code 3); the
    generic 'water' kind moved to the maps whose theme is actually water. */
 ok('T16.2 M.fields carries a coffee kind',(G.map.fields||[]).some(f=>f.kind==='coffee'));
 if(soda){
  ok('T16.2 soda reads as code 2 via fieldAt',fieldAt(soda.x+.5,soda.y+.5)===2);
  ok('T16.2 soda does NOT block (like sand)',passable(soda.x,soda.y));
  const fake={t:{fly:false},x:soda.x+.5,y:soda.y+.5};
  ok('T16.2 soda slows to sand speed (0.5x)',terrainSpeed(fake)===0.5);
 }
 if(water){
  ok('T16.2 water reads as code 3 via fieldAt',fieldAt(water.x+.5,water.y+.5)===3);
  ok('T16.2 water blocks (impassable)',!passable(water.x,water.y));
 }
 // no rogue sand on the Desk (only water + soda are placed): all code-2 tiles are soda
 ok('T16.2 no stray sand fields on Desk',(G.map.fields||[]).every(f=>f.kind!=='sand'));
}

/* ---------- T16.3: waves spawn & fight on the Desk ---------- */
for(const opp of [0,3]){
 const players=opp+1;
 let err=null;
 try{bootDesk(opp,'normal','green',6300+opp);G.surv.t=1.5;run(1500)}catch(e){err=e}
 ok(`T16.3 desk/${players}p wave soak clean`,!err && !boundsOK());
 if(err){console.log('   ',err.stack.split('\n')[0]);continue}
 ok(`T16.3 desk/${players}p at least one wave spawned`,G.surv.no>=1);
 ok(`T16.3 desk/${players}p hash uint32`,typeof hashState()==='number');
 const fought=G.players.some(p=>p.stats.kills>0)||(G.neutrals||[]).some(cr=>cr.wave&&cr.hp<cr.mhp)||G.units.some(u=>u.p!==G.neutral&&u.hp<u.mhp);
 ok(`T16.3 desk/${players}p combat occurred`,fought);
}

/* ---------- T16.4: determinism dual-run ---------- */
{
 const trail=(seed)=>{bootDesk(3,'normal','tan',seed);G.surv.t=1.0;const t=[];for(let i=1;i<=1200;i++){update(DT);if(i%30===0)t.push(hashState())}return t};
 const a=trail(960001),b=trail(960001);
 ok('T16.4 desk dual-run trails equal (40 pts, waves in play)',a.length===40&&a.every((h,i)=>h===b[i]));
 const d=trail(960002);
 ok('T16.4 desk different seed diverges',!a.every((h,i)=>h===d[i]));
}

/* ---------- T16.5: save/load bit-identical (rebuilt Desk economy on load) ---------- */
{
 bootDesk(3,'normal','gray',970001);G.surv.t=1.0;
 run(300); // a wave is airborne; the Desk economy has been mined a little
 const waveAlive=(G.neutrals||[]).some(cr=>cr.wave&&cr.hp>0);
 ok('T16.5 a wave is airborne at snapshot time',waveAlive);
 const h0=hashState(),ncSave=G.map.nodes.length,json=saveState();
 const trailA=[];for(let i=1;i<=300;i++){update(DT);if(i%30===0)trailA.push(hashState())}
 bootDesk(3,'normal','gray',970001);loadState(json);
 ok('T16.5 post-load hash matches snapshot',hashState()===h0);
 ok('T16.5 survival clock restored',G.surv&&G.surv.no>=1);
 ok('T16.5 node count preserved across load',G.map.nodes.length===ncSave);
 const trailB=[];for(let i=1;i<=300;i++){update(DT);if(i%30===0)trailB.push(hashState())}
 ok('T16.5 resumed trail identical (10 pts)',trailA.length===10&&trailA.every((h,i)=>h===trailB[i]));
}
