/* tail_minisoak.js — v30 reduced pre-delivery soak (approved budget cut).
   4 hand-picked combos x 3600 ticks covering all 4 maps, all 3 modes, all 3
   difficulties and 4 factions. Same assertions as the full 36-combo gate. */
'use strict';
section('MINISOAK: 4 combos x 3600 ticks');
const MS=[['backyard','dm','normal','green'],
          ['kitchen','ctf','hard','tan'],
          ['sandbox','koth','easy','gray'],
          ['livingroom','dm','hard','blue']];
let msi=0;
for(const [m,mo,d,fac] of MS){
 msi++;
 let err=null;
 try{G=null;newGame(cfg(m,mo,d,fac,3,777100+msi));run(3600)}catch(e){err=e}
 ok(`MINISOAK ${m}/${mo}/${d}/${fac} clean`,!err);
 if(err){console.log('   ',err.stack.split('\n')[0]);continue}
 ok(`MINISOAK ${m}/${mo}/${d}/${fac} in bounds`,!boundsOK());
 const bots=G.players.filter(p=>!p.human);
 ok(`MINISOAK ${m}/${mo}/${d}/${fac} every bot acted`,bots.every(p=>p.stats.built>0));
 ok(`MINISOAK ${m}/${mo}/${d}/${fac} hash stable type`,typeof hashState()==='number');
 if(G.over)ok(`MINISOAK ${m}/${mo}/${d}/${fac} winner is sane`,G.players.some(p=>p.alive));
}
