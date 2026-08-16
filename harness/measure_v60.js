'use strict';
/* v60 audit probe: measures bot army composition by KEY and by CLASS.
   Not a test tail; never shipped. Boots all-CPU watch matches and samples the
   fighting army over the match. */
const DT=1/30;
const SUP={truck:1,medic:1,apc:1,chinook:1};
const cls=k=>{const t=U[k];if(!t)return 'inf';if(t.fly)return 'air';if(t.a==='aa')return 'aa';if(t.a==='inf')return 'inf';return 'veh';};
const MAPS_T=(process.env.MAPS?process.env.MAPS.split(','):Object.keys(MAPS).filter(k=>!MAPS[k].survOnly));
const TICKS=+(process.env.TICKS||18000);
const SEEDS=(process.env.SEEDS||'901,902').split(',').map(Number);
const DIFF=process.env.DIFF||'normal';

// accumulators
const byProfKey={},byProfCls={},allKey={},allCls={};
const padTick={},airTick={},econ={};
let bots=0;
const add=(o,k,v)=>{o[k]=(o[k]||0)+v};

for(const m of MAPS_T)for(const sd of SEEDS){
 G=null;
 newGame({map:m,mode:'dm',diff:DIFF,fac:'green',seed:sd,watch:true});
 const meta=G.players.map(p=>({p,prof:p.ai?p.ai.profile:'human',pad:-1,air:-1}));
 const samples=[];
 for(let i=0;i<TICKS;i++){
  update(DT);
  if(i%300===0)for(const mm of meta){
   if(!mm.p.ai)continue;mm.tech=mm.tech||{};
   for(const k of mm.p.techDone)if(k[0]==='u'&&mm.tech[k]==null)mm.tech[k]=Math.round(G.tick/30);
  }
  for(const mm of meta){
   if(mm.pad<0&&mm.p.blds.some(b=>b.key==='helipad'&&b.prog>=1))mm.pad=G.tick;
   if(mm.air<0&&mm.p.units.some(u=>u.t&&u.t.fly&&!SUP[u.key]))mm.air=G.tick;
  }
  // sample the late window (last 5 sim minutes) every 900 ticks
  if(i>=TICKS-9000&&i%900===0)samples.push(1);
  if(i>=TICKS-9000&&i%900===0){
   for(const mm of meta){
    if(!mm.p.ai)continue;
    const arm=mm.p.units.filter(u=>!SUP[u.key]&&!u.garrisoned&&u.hp>0&&u.t&&u.t.dm>0).length;
    const cap=Math.min(52,Math.round((12+(mm.p.ai.t/300|0))*((mm.p.diff||G.diff).army)));
    mm.sz=(mm.sz||[]);mm.sz.push(arm+'/'+cap+'@'+mm.p.blds.filter(b=>b.prog>=1&&b.t.prod&&b.key!=='hq'&&b.key!=='outpost').length);
    for(const u of mm.p.units){
     if(SUP[u.key]||u.garrisoned||u.hp<=0)continue;
     if(!u.t||!(u.t.dm>0))continue;
     add(byProfKey[mm.prof]=byProfKey[mm.prof]||{},u.key,1);
     add(byProfCls[mm.prof]=byProfCls[mm.prof]||{},cls(u.key),1);
     add(allKey,u.key,1);add(allCls,cls(u.key),1);
    }
   }
  }
 }
 for(const mm of meta){
  if(!mm.p.ai)continue;
  bots++;
  padTick[mm.prof]=(padTick[mm.prof]||[]);padTick[mm.prof].push(mm.pad);
  airTick[mm.prof]=(airTick[mm.prof]||[]);airTick[mm.prof].push(mm.air);
  econ[mm.prof]=(econ[mm.prof]||[]);econ[mm.prof].push(Math.round(mm.p.res.p)+'|'+(mm.sz?mm.sz.slice(-2).join(' '):'-'));
 }
 process.stderr.write('.');
}
const pct=o=>{let t=0;for(const k in o)t+=o[k];const out={};for(const k in o)out[k]=+(100*o[k]/t).toFixed(1);return out};
const srt=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
console.log('\n=== bots sampled:',bots,' ticks:',TICKS,' diff:',DIFF,' seeds:',SEEDS.join(','));
console.log('CLASS all:',JSON.stringify(pct(allCls)));
console.log('KEY all:',JSON.stringify(srt(pct(allKey))));
for(const pf in byProfCls){
 const sec=Math.round(padTick[pf].reduce((a,b)=>a+(b<0?TICKS:b),0)/padTick[pf].length/30);
 const nopad=padTick[pf].filter(x=>x<0).length;
 const asec=Math.round(airTick[pf].reduce((a,b)=>a+(b<0?TICKS:b),0)/airTick[pf].length/30);
 const noair=airTick[pf].filter(x=>x<0).length;
 console.log('---',pf,'cls',JSON.stringify(pct(byProfCls[pf])),'pad@'+sec+'s(miss '+nopad+')','air@'+asec+'s(miss '+noair+')','bank',JSON.stringify(econ[pf]));
 console.log('    keys',JSON.stringify(srt(pct(byProfKey[pf])).slice(0,8)));
}
