/* probe_v99.js - measure order churn: how often bots re-aim units, and whether
 * the whole army twitches at once. The v99 release's measurement tool, the way
 * probe_v89.js is v89's: a MEASUREMENT, not a test - nothing here is pinned.
 *
 *   cat shim_head.js game.js probe_v99.js > pv99.js
 *   MAP=backyard SEED=101 node pv99.js
 *
 * Wraps orderMove/orderAttack (the sim_dm.js wrapper idiom - same-scope
 * function bindings reassigned after newGame, consuming no rng) and records
 * every order a bot issues. Three readouts:
 *
 *   pushes    - wave launches per bot and the gap between them. The v98 bug was
 *               here: pr.repeat says 34-155 aiTicks between waves; the sizeReady
 *               spam fired every single aiTick (18 ticks) once an army outgrew
 *               its capped pushSize. One bot measured 174 pushes, 94% of them
 *               back-to-back, in one 10-minute match.
 *   flips     - a unit traveling toward D that is re-aimed >=12 tiles off D and
 *               re-aimed back within 8 tiles of D inside 150 ticks: the
 *               divert-and-return the owner saw. After v99 these are almost all
 *               the defend picket's fight-then-resume (savedDest), not churn.
 *   simul     - how many units diverted on the SAME tick. The "whole army
 *               twitches at once" number: 26 before v99, quota-bounded after.
 */
const DT=1/30;
const MAP=process.env.MAP||'backyard', SEED=+(process.env.SEED||101), MAXT=+(process.env.MAXT||27000);
G=null;
newGame({map:MAP,mode:'dm',diff:'normal',fac:'green',seed:SEED,watch:true});

const LOG=[];
const _om=orderMove,_oa=orderAttack;
orderMove=function(u,x,y,am){
 if(u.p&&u.p.ai&&u.t.dm)LOG.push({t:G.tick,id:u.id,ps:u.state,pd:u.dest?{x:u.dest.x,y:u.dest.y}:null,x,y});
 return _om(u,x,y,am);
};
orderAttack=function(u,tgt){
 if(u.p&&u.p.ai&&u.t.dm)LOG.push({t:G.tick,id:u.id,ps:u.state,pd:u.dest?{x:u.dest.x,y:u.dest.y}:null,x:tgt.x,y:tgt.y});
 return _oa(u,tgt);
};

const pushes={},lastPush={};
for(let i=0;i<MAXT&&!G.over;i++){
 update(DT);
 for(const p of G.players){
  if(!p.ai)continue;
  const w=p.ai.waveId||0;
  if(lastPush[p.i]==null)lastPush[p.i]={w,t:G.tick};
  if(w>lastPush[p.i].w){(pushes[p.i]=pushes[p.i]||[]).push(G.tick-lastPush[p.i].t);lastPush[p.i]={w,t:G.tick};}
 }
}

const byUnit=new Map();
for(const e of LOG){if(!byUnit.has(e.id))byUnit.set(e.id,[]);byUnit.get(e.id).push(e);}
const flips=[];
for(const [id,evs] of byUnit){
 for(let i=1;i<evs.length;i++){
  const a=evs[i];
  if(!a.pd||(a.ps!=='move'&&a.ps!=='amove'))continue;
  if(Math.hypot(a.x-a.pd.x,a.y-a.pd.y)<12)continue;
  for(let j=i+1;j<evs.length;j++){
   const b=evs[j];
   if(b.t-a.t>150)break;
   if(Math.hypot(b.x-a.pd.x,b.y-a.pd.y)<8){flips.push(a);break;}
  }
 }
}
const perTick={};
for(const f of flips)perTick[f.t]=(perTick[f.t]||0)+1;
const simul=Object.values(perTick).sort((a,b)=>b-a);

console.log(`${MAP} seed ${SEED}: ${G.tick} ticks, ${LOG.length} combat orders, ${byUnit.size} units ordered`);
for(const k in pushes){
 const g=pushes[k].slice().sort((a,b)=>a-b);
 const med=g[Math.floor(g.length/2)],spam=g.filter(x=>x<=19).length;
 console.log(`  bot ${k}: ${g.length} pushes, median gap ${med} ticks (${(med/30).toFixed(1)}s), ${spam} back-to-back`);
}
console.log(`  flips (divert>=12 tiles, return<8 within 150t): ${flips.length}`);
console.log(`  worst same-tick diversions: ${simul.slice(0,5).join(' ')||'none'}`);
