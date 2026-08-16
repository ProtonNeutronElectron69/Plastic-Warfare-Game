/* tail_soak.js — pre-delivery gate: FULL matrix soak.
   4 maps x 3 modes x 3 difficulties = 36 runs of 3600 ticks (2 sim-minutes),
   human faction cycled so all four factions are exercised. Asserts clean run,
   in-bounds entities, live AI economies, and end-state sanity. */
'use strict';
section('SOAK full matrix: 36 combos x 3600 ticks');
let si=0;
for(const m of T_MAPS)for(const mo of T_MODES)for(const d of T_DIFFS){
 const fac=T_FACS[si%4];si++;
 let err=null;
 try{G=null;newGame(cfg(m,mo,d,fac,3,555000+si));run(3600)}catch(e){err=e}
 ok(`SOAK ${m}/${mo}/${d}/${fac} clean`,!err);
 if(err){console.log('   ',err.stack.split('\n')[0]);continue}
 ok(`SOAK ${m}/${mo}/${d}/${fac} in bounds`,!boundsOK());
 const bots=G.players.filter(p=>!p.human);
 ok(`SOAK ${m}/${mo}/${d}/${fac} every bot acted`,bots.every(p=>p.stats.built>0));
 ok(`SOAK ${m}/${mo}/${d}/${fac} hash stable type`,typeof hashState()==='number');
 if(G.over)ok(`SOAK ${m}/${mo}/${d}/${fac} winner is sane`,G.players.some(p=>p.alive));
}
