/* tail_tests.js — T1..T4 runtime suite, driven headless through the shim.
   T1 boot & invariants   : every map x mode boots and runs 300 ticks clean
   T2 determinism         : two fresh runs, identical hash trail for 900 ticks
   T3 save/load           : snapshot round-trip resumes on the exact same trail
   T4 soak matrix         : longer sims across maps/modes/diffs; AIs must act  */
'use strict';
let PASS=0,FAIL=0;const FAILS=[];
function ok(name,cond){if(cond){PASS++}else{FAIL++;FAILS.push(name);console.log('  FAIL: '+name)}}
function section(s){console.log('== '+s+' ==')}

const T_MAPS=Object.keys(MAPS).filter(k=>!MAPS[k].survOnly); // v35: survival-only maps (Desk) get their own coverage in tail_v35
const T_MODES=['dm','ctf','koth'];
const T_DIFFS=Object.keys(DIFFS);          // easy,normal,hard
const T_FACS=Object.keys(FAC).filter(f=>f!=='bug');
const DT=1/30;
function cfg(map,mode,diff,fac,opp,seed){return{map,mode,diff,fac:fac||'green',opp:opp||3,seed}}
function run(n){for(let i=0;i<n;i++)update(DT)}
function boundsOK(){
 const N=G.map.N;
 for(const u of G.units){
  if(!isFinite(u.x)||!isFinite(u.y)||u.x<-2||u.y<-2||u.x>N+2||u.y>N+2)return 'unit '+u.key+' oob '+u.x+','+u.y;
  if(!isFinite(u.hp))return 'unit hp NaN';
 }
 for(const b of G.blds){if(!isFinite(b.hp))return 'bld hp NaN'}
 return null;
}

/* ---------- T1: boot & invariants ---------- */
section('T1 boot: every map x mode, 300 ticks');
for(const m of T_MAPS)for(const mo of T_MODES){
 let err=null;
 try{G=null;newGame(cfg(m,mo,'normal','green',3,4242));run(300)}catch(e){err=e}
 ok(`T1 ${m}/${mo} runs clean`,!err);
 if(err){console.log('   ',err.stack.split('\n')[0]);continue}
 ok(`T1 ${m}/${mo} entities in bounds`,!boundsOK());
 ok(`T1 ${m}/${mo} hash is uint32`,typeof hashState()==='number');
 ok(`T1 ${m}/${mo} 4 players alive`,G.players.filter(p=>p.alive).length===4);
 if(mo==='ctf')ok(`T1 ${m}/ctf flags exist`,G.flags&&G.flags.length>=2);
 if(mo==='koth')ok(`T1 ${m}/koth hill exists`,!!G.hill);
}

/* ---------- T2: determinism dual run ---------- */
section('T2 determinism: dual 900-tick runs, hash trail compare');
for(const m of T_MAPS){
 const trail=(seed)=>{G=null;newGame(cfg(m,'dm','normal','tan',3,seed));const t=[];
  for(let i=1;i<=900;i++){update(DT);if(i%30===0)t.push(hashState())}return t};
 const a=trail(777001),b=trail(777001);
 ok(`T2 ${m} trails equal (30 checkpoints)`,a.length===30&&a.every((h,i)=>h===b[i]));
 const c=trail(777002);
 ok(`T2 ${m} different seed diverges`,!a.every((h,i)=>h===c[i]));
}

/* ---------- T3: save/load equivalence ---------- */
section('T3 save/load: snapshot resumes bit-identical');
for(const m of T_MAPS){
 G=null;newGame(cfg(m,'koth','normal','gray',3,313131));
 run(600);
 const h0=hashState(),json=saveState();
 const trailA=[];for(let i=1;i<=300;i++){update(DT);if(i%30===0)trailA.push(hashState())}
 G=null;newGame(cfg(m,'koth','normal','gray',3,313131));
 loadState(json);
 ok(`T3 ${m} post-load hash matches snapshot point`,hashState()===h0);
 const trailB=[];for(let i=1;i<=300;i++){update(DT);if(i%30===0)trailB.push(hashState())}
 ok(`T3 ${m} resumed trail identical (10 checkpoints)`,trailA.every((h,i)=>h===trailB[i]));
}

/* ---------- T4: soak matrix ---------- */
section('T4 soak: maps x modes x diffs, 2700 ticks (90s), AI activity');
let sk=0;
for(const m of T_MAPS)for(const mo of T_MODES){
 const diff=T_DIFFS[sk%3],fac=T_FACS[sk%4];sk++;
 let err=null;
 try{G=null;newGame(cfg(m,mo,diff,fac,3,90000+sk));run(2700)}catch(e){err=e}
 ok(`T4 ${m}/${mo}/${diff} soak clean`,!err);
 if(err){console.log('   ',err.stack.split('\n')[0]);continue}
 ok(`T4 ${m}/${mo}/${diff} in bounds after soak`,!boundsOK());
 const bots=G.players.filter(p=>!p.human);
 ok(`T4 ${m}/${mo}/${diff} bots trained units`,bots.every(p=>p.stats.built>0||p.units.length>3));
 ok(`T4 ${m}/${mo}/${diff} some bot expanded or built`,bots.some(p=>p.blds.length>4));
 ok(`T4 ${m}/${mo}/${diff} economy moved`,G.players.some(p=>p.res.p!==0||p.stats.built>0));
}
