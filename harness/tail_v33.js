/* tail_v33.js — T14: PvE Wave Survival mode.
   1) boot every map x ally-count; central cluster + white-flag + arena + economy
   2) CREATURE table: renamed bee, 4 new species, rescale applied, custom fields
   3) wave scheduler & composition; v38: mice jitter/scale too (base reverted 2/4/4/4/8), others
      scale x diff.army x jitter; wave creatures carry wave/nest/owner invariants
   4) roach/mouse frontal cleave (aoe hits several, spares distant units)
   5) fire-ant burn DoT (applyBurn/tickBurns lifecycle)
   6) win (all 15 waves cleared) & lose (every allied HQ down); checkEnd guard
   7) AI leash + live wave combat soak; strays stay near the defend point
   8) determinism dual-run + save/load bit-identical resume with waves in play  */
'use strict';
section('T14 v33: wave survival');

const DIFF_ARMY=k=>DIFFS[k].army;
function survCfg(map,opp,diff,fac,seed){return{map,mode:'surv',diff:diff||'normal',fac:fac||'green',opp:opp||2,seed}}
function bootSurv(map,opp,diff,fac,seed){G=null;newGame(survCfg(map,opp,diff,fac,seed));}
const nearC=(o,c,r)=>dhyp(o.x-c,o.y-c)<r;

/* ---------- T14.1: boot + central setup invariants ---------- */
for(const m of T_MAPS)for(const opp of [1,2,3]){
 let err=null;
 try{bootSurv(m,opp,'normal','green',4400+opp)}catch(e){err=e}
 ok(`T14.1 ${m}/opp${opp} boots`,!err);
 if(err){console.log('   ',err.stack.split('\n')[0]);continue}
 const N=G.map.N,c=N/2+0.5;
 // ---- setup invariants (checked at boot, before the clock ticks / combat drops wreck nodes) ----
 ok(`T14.1 ${m}/opp${opp} defender count = 1+opp`,G.players.length===1+opp);
 ok(`T14.1 ${m}/opp${opp} everyone on one team`,G.players.every(p=>p.team===1));
 ok(`T14.1 ${m}/opp${opp} matchTeamed (shared vision)`,matchTeamed());
 ok(`T14.1 ${m}/opp${opp} G.surv present, wave 0`,!!G.surv&&G.surv.no===0);
 ok(`T14.1 ${m}/opp${opp} build clock starts at 60`,G.surv.t===60);
 ok(`T14.1 ${m}/opp${opp} flag at centre`,Math.abs(G.surv.fx-c)<1e-6&&Math.abs(G.surv.fy-c)<1e-6);
 ok(`T14.1 ${m}/opp${opp} starts clustered at centre`,G.map.starts.every(s=>nearC(s,c,9)));
 ok(`T14.1 ${m}/opp${opp} arena centre passable`,passable(Math.floor(c),Math.floor(c)));
 // starter economy: exactly 2 plastic + 2 battery within 4 tiles of the flag, none native nearby
 const near=G.map.nodes.filter(n=>nearC(n,c,4));
 ok(`T14.1 ${m}/opp${opp} 4 starter nodes by flag`,near.length===4);
 ok(`T14.1 ${m}/opp${opp} starters = 2 plastic + 2 battery`,near.filter(n=>n.t==='plastic').length===2&&near.filter(n=>n.t==='battery').length===2);
 ok(`T14.1 ${m}/opp${opp} arena clear of native piles`,G.map.nodes.filter(n=>nearC(n,c,10)).length===4);
 // ---- runtime invariants after 300 ticks of build phase ----
 let rerr=null;try{run(300)}catch(e){rerr=e}
 ok(`T14.1 ${m}/opp${opp} runs 300 clean`,!rerr);
 if(rerr){console.log('   ',rerr.stack.split('\n')[0]);continue}
 ok(`T14.1 ${m}/opp${opp} in bounds`,!boundsOK());
 ok(`T14.1 ${m}/opp${opp} hash uint32`,typeof hashState()==='number');
 ok(`T14.1 ${m}/opp${opp} build clock counting down`,G.surv.t<60&&G.surv.t>40);
 ok(`T14.1 ${m}/opp${opp} still wave 0 during build`,G.surv.no===0);
 ok(`T14.1 ${m}/opp${opp} no wave creatures yet`,!(G.neutrals||[]).some(cr=>cr.wave));
 let topErr=null;try{updateTopbar()}catch(e){topErr=e}
 ok(`T14.1 ${m}/opp${opp} topbar+banner refresh clean`,!topErr);
}

/* ---------- T14.2: CREATURE table ---------- */
{
 const C=CREATURE;
 ok('T14.2 bee display renamed to Bee',C.bee.n==='Bee');
 ok('T14.2 fireant exists w/ burn, grounded',!!C.fireant&&C.fireant.burn>0&&!C.fireant.fly);
 ok('T14.2 wasp flies, tankier & harder than bee',!!C.wasp&&!!C.wasp.fly&&C.wasp.hp>C.bee.hp&&C.wasp.dm>C.bee.dm);
 ok('T14.2 roach has frontal cleave',!!C.roach&&C.roach.aoe>0);
 ok('T14.2 mouse is a cleaving mini-boss',!!C.mouse&&C.mouse.boss===1&&C.mouse.aoe>0);
 ok('T14.2 mouse HP dwarfs roach',C.mouse.hp>C.roach.hp*3);
 ok('T14.2 rescale applied (hp integer, dm finite)',Object.keys(C).every(k=>Number.isInteger(C[k].hp)&&isFinite(C[k].dm)));
 ok('T14.2 custom fields survive rescale (v37 burn 7.2)',C.mouse.aoe===1.5&&C.roach.aoe===1.1&&C.fireant.burn===7.2);
}

/* ---------- T14.3: wave scheduler + composition ---------- */
{
 bootSurv('backyard',2,'normal','green',5501);
 const before=(G.neutrals||[]).filter(cr=>cr.wave).length;
 G.surv.t=0.0001;update(DT);
 const w1=(G.neutrals||[]).filter(cr=>cr.wave);
 ok('T14.3 wave 1 fires when clock hits 0',G.surv.no===1&&before===0&&w1.length>0);
 ok('T14.3 wave 1 is all ants',w1.every(cr=>cr.species==='ant'));
 ok('T14.3 wave-1 count (v39: 3p pmul 1.2, jittered)',w1.length>=22&&w1.length<=40);
 ok('T14.3 wave creatures: wave flag, no nest, neutral owner',w1.every(cr=>cr.wave===true&&cr.nest==null&&cr.p===G.neutral));
 ok('T14.3 wave clock reset to 60',Math.abs(G.surv.t-60)<1e-6);
 // v38: mice now jitter & scale with diff.army like everything else (assert ranges, not exact)
 let mEasy=0,mHard=0,fEasy=0,fHard=0;
 for(let rep=0;rep<6;rep++){
  bootSurv('backyard',2,'easy','green',6000+rep);G.surv.no=4;G.surv.t=0.0001;update(DT);
  mEasy+=(G.neutrals||[]).filter(cr=>cr.wave&&cr.species==='mouse').length;
  fEasy+=(G.neutrals||[]).filter(cr=>cr.wave&&cr.species==='fireant').length;
  bootSurv('backyard',2,'hard','green',6000+rep);G.surv.no=4;G.surv.t=0.0001;update(DT);
  mHard+=(G.neutrals||[]).filter(cr=>cr.wave&&cr.species==='mouse').length;
  fHard+=(G.neutrals||[]).filter(cr=>cr.wave&&cr.species==='fireant').length;
 }
 ok('T14.3 wave-5 mice jitter/scale on easy (arm .70; 6 reps -> 1-2 each)',mEasy>=6&&mEasy<=12);
 ok('T14.3 wave-5 mice jitter/scale on hard (arm 1.35 x pmul 1.2; 6 reps -> 2-4 each)',mHard>=11&&mHard<=25);
 ok('T14.3 non-mouse scales up on hard vs easy',fHard>fEasy);
}

/* ---------- T14.4: frontal cleave (aoe) ---------- */
{
 bootSurv('backyard',2,'normal','green',7007);
 const c=G.map.N/2+0.5;
 const r=spawnWaveCreature('roach',c,c);r.face=0;r.cool=0; // faces +x world
 const ax=r.x+dcos(0)*1.1,ay=r.y+dsin(0)*1.1;
 // three friendly units clustered inside the cleave, one far outside
 const mine=G.human.units.slice(0,4);
 ok('T14.4 have >=4 friendly units to test',mine.length>=4);
 if(mine.length>=4){
  mine[0].x=ax;      mine[0].y=ay-0.3;
  mine[1].x=ax+0.2;  mine[1].y=ay;
  mine[2].x=ax-0.2;  mine[2].y=ay+0.3;
  mine[3].x=r.x+14;  mine[3].y=r.y+14;   // far away, must be spared
  mine.forEach(u=>{u.hp=u.mhp;u.garrisoned=false;});
  waveAttack(r,mine[0]);
  const hurt=[mine[0],mine[1],mine[2]].filter(u=>u.hp<u.mhp).length;
  ok('T14.4 cleave hits the whole cluster (>=2)',hurt>=2);
  ok('T14.4 cleave spares the distant unit',mine[3].hp===mine[3].mhp);
 }
}

/* ---------- T14.5: fire-ant burn DoT ---------- */
{
 bootSurv('backyard',2,'normal','green',8008);
 const c=G.map.N/2+0.5;
 const f=spawnWaveCreature('fireant',c,c);f.cool=0;
 const u=G.human.units[0];u.x=c+0.4;u.y=c;u.hp=u.mhp;u.garrisoned=false;u.burnT=0;u.burnDps=0;
 const full=u.mhp;
 waveAttack(f,u);
 ok('T14.5 contact damage applied',u.hp<full);
 ok('T14.5 burn timer + dps set',u.burnT>1.5&&u.burnDps===CREATURE.fireant.burn);
 const afterContact=u.hp;
 for(let i=0;i<15;i++)tickBurns(DT);      // ~0.5s of burn
 ok('T14.5 burn ticks damage over time',u.hp<afterContact);
 ok('T14.5 burn timer counts down',u.burnT<2&&u.burnT>0);
 for(let i=0;i<60;i++)tickBurns(DT);       // push well past 2s
 ok('T14.5 burn expires',u.burnT<=0);
 const u2=G.human.units[1];u2.hp=u2.mhp;u2.burnT=0;
 const h2=u2.hp;for(let i=0;i<30;i++)tickBurns(DT);
 ok('T14.5 un-burned unit untouched',u2.hp===h2);
}

/* ---------- T14.6: checkEnd guard + win + lose ---------- */
{
 bootSurv('backyard',3,'normal','green',9009);run(60);
 G.over=false;checkEnd();
 ok('T14.6 checkEnd never ends survival (all one team)',!G.over);

 // WIN: last wave spawned, nothing left alive
 bootSurv('backyard',2,'normal','green',9100);
 G.surv.no=15;G.surv.t=0;
 for(const cr of (G.neutrals||[]))cr.hp=0; // clear any wildlife too (wave check only counts wave creatures)
 (G.neutrals||[]).length=0;
 update(DT);
 ok('T14.6 clearing wave 15 wins',G.over===true);
 ok('T14.6 win shows VICTORY',/VICTORY/.test(document.getElementById('endTitle').textContent));

 // WIN guard: creatures still alive => not over
 bootSurv('backyard',2,'normal','green',9150);
 G.surv.no=15;spawnWaveCreature('ant',5,5);update(DT);
 ok('T14.6 survivors keep the match going',!G.over);

 // LOSE: every allied HQ destroyed
 bootSurv('backyard',3,'normal','green',9200);run(30);
 for(const p of G.players)for(const b of p.blds)if(b.key==='hq')b.hp=0;
 update(DT);
 ok('T14.6 losing all HQs is defeat',G.over===true);
 ok('T14.6 loss shows DEFEAT',/DEFEAT/.test(document.getElementById('endTitle').textContent));

 // LOSE guard: one HQ standing => not over
 bootSurv('backyard',2,'normal','green',9250);run(30);
 let first=true;for(const p of G.players)for(const b of p.blds)if(b.key==='hq'){if(!first)b.hp=0;first=false;}
 update(DT);
 ok('T14.6 one surviving HQ keeps you alive',!G.over);
}

/* ---------- T14.7: AI leash + live wave combat soak ---------- */
for(const [m,opp,diff] of [['backyard',3,'normal'],['kitchen',2,'hard'],['sandbox',3,'easy'],['livingroom',2,'normal']]){
 let err=null;
 try{bootSurv(m,opp,diff,'green',9300);G.surv.t=1.5;run(2000)}catch(e){err=e}
 ok(`T14.7 ${m}/opp${opp}/${diff} soak clean`,!err);
 if(err){console.log('   ',err.stack.split('\n')[0]);continue}
 ok(`T14.7 ${m}/opp${opp}/${diff} in bounds`,!boundsOK());
 ok(`T14.7 ${m}/opp${opp}/${diff} hash uint32`,typeof hashState()==='number');
 ok(`T14.7 ${m}/opp${opp}/${diff} at least one wave spawned`,G.surv.no>=1);
 const c=G.map.N/2+0.5;
 const idle=G.units.filter(u=>u.p!==G.neutral&&u.state==='idle'&&!u.garrisoned);
 const stray=idle.filter(u=>dhyp(u.x-c,u.y-c)>26);
 ok(`T14.7 ${m}/opp${opp}/${diff} idle allies stay near flag`,stray.length===0);
 const fought=G.players.some(p=>p.stats.kills>0)||G.units.some(u=>u.p!==G.neutral&&u.hp<u.mhp)||(G.neutrals||[]).some(cr=>cr.wave&&cr.hp<cr.mhp);
 ok(`T14.7 ${m}/opp${opp}/${diff} combat actually occurred`,fought);
}

/* ---------- T14.8: determinism dual-run ---------- */
{
 const trail=(seed)=>{bootSurv('backyard',2,'normal','tan',seed);G.surv.t=1.0;const t=[];for(let i=1;i<=1200;i++){update(DT);if(i%30===0)t.push(hashState())}return t};
 const a=trail(940001),b=trail(940001);
 ok('T14.8 survival dual-run trails equal (40 pts, waves in play)',a.length===40&&a.every((h,i)=>h===b[i]));
 const d=trail(940002);
 ok('T14.8 different seed diverges',!a.every((h,i)=>h===d[i]));
}

/* ---------- T14.9: save/load bit-identical with a wave alive ---------- */
{
 bootSurv('kitchen',2,'normal','gray',950001);G.surv.t=1.0;
 run(300); // wave 1 has spawned & is fighting; burns may be active
 const waveAlive=(G.neutrals||[]).some(cr=>cr.wave&&cr.hp>0);
 ok('T14.9 a wave is airborne at snapshot time',waveAlive);
 const h0=hashState(),json=saveState();
 const trailA=[];for(let i=1;i<=300;i++){update(DT);if(i%30===0)trailA.push(hashState())}
 bootSurv('kitchen',2,'normal','gray',950001);loadState(json);
 ok('T14.9 post-load hash matches snapshot',hashState()===h0);
 ok('T14.9 survival clock restored',G.surv&&G.surv.no===1);
 const trailB=[];for(let i=1;i<=300;i++){update(DT);if(i%30===0)trailB.push(hashState())}
 ok('T14.9 resumed trail identical (10 pts)',trailA.length===10&&trailA.every((h,i)=>h===trailB[i]));
}
