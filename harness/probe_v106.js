/* probe_v106.js - which unit abilities does a BOT actually use?
 *
 * The v106 measurement tool, the way probe_v89.js is v89's and probe_v99.js is
 * v99's: a MEASUREMENT, not a test - nothing here is pinned and it is not part
 * of seg.sh. Rule 8: a win rate is an OUTCOME and an outcome is consistent with
 * a dozen causes, so this counts the MECHANISM - per ability, how much of the
 * time a bot that owns the ability has it switched on.
 *
 *   cat shim_head.js game.js probe_v106.js > pv106.js
 *   MAP=backyard SEED=101 node pv106.js
 *
 * Samples every SAMP ticks and, for every ability row in UNIT_TOGGLES, counts
 *   carrier-ticks : samples in which a live bot unit carried the ability
 *   on-ticks      : ...of those, samples in which it was switched ON
 *   users         : distinct bot units that had it on at least once
 * A row with carriers > 0 and on = 0 is an ability the bots own and never use,
 * which is exactly what this release is about.
 */
const DT=1/30;
const MAP=process.env.MAP||'backyard', SEED=+(process.env.SEED||101);
const MAXT=+(process.env.MAXT||27000), SAMP=+(process.env.SAMP||30);
G=null;
newGame({map:MAP,mode:'dm',diff:'normal',fac:'green',seed:SEED,watch:true});

const ROWS=UNIT_TOGGLES.map(a=>({f:a.f,s:a.s,name:a.off,car:0,on:0,users:new Set(),owners:new Set()}));
let samples=0;
for(let t=0;t<MAXT&&!G.over;t++){
 update(DT);
 if(G.tick%SAMP)continue;
 samples++;
 for(const u of G.units){
  if(u.hp<=0||!u.p.ai)continue;
  for(const r of ROWS){
   if(!u.t[r.f])continue;
   r.car++;r.owners.add(u.id);
   if(u[r.s]){r.on++;r.users.add(u.id)}
  }
 }
}
const pad=(s,n)=>String(s).padEnd(n);
console.log('\n== probe_v106  map='+MAP+' seed='+SEED+'  ticks='+G.tick+'  samples='+samples+' ==');
console.log(pad('ability',16)+pad('carrier-ticks',15)+pad('on-ticks',10)+pad('on%',8)+pad('owners',8)+'users');
for(const r of ROWS){
 console.log(pad(r.name,16)+pad(r.car,15)+pad(r.on,10)+
   pad(r.car?(100*r.on/r.car).toFixed(1):'-',8)+pad(r.owners.size,8)+r.users.size);
}
const dead=ROWS.filter(r=>r.owners.size>0&&r.users.size===0).map(r=>r.name);
console.log('OWNED BUT NEVER USED: '+(dead.length?dead.join(', '):'(none)'));
