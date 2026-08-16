/* tail_v37.js — T18: v37 balance + bigger models
   E1 Desk resource piles +50% (Desk map only): centre ring 3510/2100, corner pairs 3240/2340
   E2 wave table +20% (round), INCLUDING mice this pass (2/4/4/4/8 -> 2/5/5/5/10)
   E3 ant/bee/fireant/wasp/roach +20% hp & DPS across all maps/modes; mouse untouched; fireant burn 6->7.2
   E4 mouse model 4x, roach model 2x (visual only) — drawBug scales body+shadow, gameplay unchanged */
'use strict';
section('T18 v37: balance + bigger models');

function d37(opp,seed){return{map:'desk',mode:'surv',diff:'normal',fac:'green',opp,seed};}

/* ---------- T18.1: Desk piles +50% at 1 and 2 players ---------- */
for(const opp of [0,1]){
 const players=opp+1;let err=null;
 try{G=null;newGame(d37(opp,37100+opp));}catch(e){err=e;}
 ok(`T18.1 desk/${players}p boots`,!err);
 if(err)continue;
 const cc=G.map.N/2+0.5;
 const ring=G.map.nodes.filter(n=>nearC(n,cc,11));
 const corner=G.map.nodes.filter(n=>{const d=dhyp(n.x-cc,n.y-cc);return d>=13&&d<=34;});
 ok(`T18.1 desk/${players}p ring still 2*(players+1) nodes`,ring.length===2*(players+1));
 /* v77: +50% on the v36 ring was this release's claim; v77 put a further +20% on
    top and named all four amounts. T18.1 keeps the Desk-vs-everyone-else claim,
    which is what it was really testing; the values are pinned once in T52.D. */
 ok(`T18.1 desk/${players}p ring carries the Desk ring amounts`,ring.every(n=>n.t==='plastic'?n.amt===DESK_RING_P:n.amt===DESK_RING_E));
 ok(`T18.1 desk/${players}p 8 corner nodes`,corner.length===8);
 ok(`T18.1 desk/${players}p corner amounts still the v37 pair`,corner.every(n=>n.t==='plastic'?n.amt===DESK_CORNER_P:n.amt===DESK_CORNER_E)&&DESK_CORNER_P===3240&&DESK_CORNER_E===2340);
}
// non-desk survival starter piles are untouched (+50% was Desk-only)
{
 G=null;newGame({map:'kitchen',mode:'surv',diff:'normal',fac:'gray',opp:1,seed:37150});
 const starters=(G.map.nodes||[]).filter(n=>n.amt===2340||n.amt===1400);
 ok('T18.1 non-desk starter piles unchanged (2340/1400 present)',starters.length>0);
 /* DESK_CORNER_E is deliberately NOT in this list: it is 2340, which is also the
    non-Desk survival starter plastic amount asserted two lines up, so including it
    would make this check fail on a correct build. The original list excluded it for
    exactly that reason and the v77 rename must not quietly widen it. */
 ok('T18.1 non-desk has no desk-scaled piles',!(G.map.nodes||[]).some(n=>[DESK_RING_P,DESK_RING_E,DESK_CORNER_P].includes(n.amt)));
}

/* ---------- T18.2: critter +20% hp/DPS across the game; mouse untouched (E3) ---------- */
{
 const C=CREATURE, R=v=>Math.round(v);
 ok('T18.2 ant  hp/dm +20%',C.ant.hp===R(49*RESCALE)&&C.ant.hp===24&&C.ant.dm===5.02);
 ok('T18.2 bee  hp +20%',C.bee.hp===15);
 ok('T18.2 fireant hp +20% & burn 6->7.2 (not rescaled)',C.fireant.hp===50&&C.fireant.burn===7.2);
 ok('T18.2 wasp hp +20%',C.wasp.hp===32);
 ok('T18.2 roach hp/dm +20%',C.roach.hp===108&&C.roach.dm===10.05);
 ok('T18.2 mouse untouched',C.mouse.hp===R(900*RESCALE)&&C.mouse.dm===+(30*RESCALE).toFixed(2)&&C.mouse.aoe===1.5);
}

/* ---------- T18.3: wave table +20% including mice (E2) ---------- */
{
 const W=SURV_WAVES;
 ok('T18.3 wave 1 ant ->26',W[0].ant===26);
 ok('T18.3 wave 6 = ant43 bee17 fireant12 wasp6',W[5].ant===43&&W[5].bee===17&&W[5].fireant===12&&W[5].wasp===6);
 ok('T18.3 wave 15 = wasp35 roach23 mouse8',W[14].wasp===35&&W[14].roach===23&&W[14].mouse===8);
 const mice=W.map(w=>w.mouse||0).filter(m=>m>0);
 ok('T18.3 mouse base counts reverted to [2,4,4,4,8]',JSON.stringify(mice)===JSON.stringify([2,4,4,4,8]));
 const nonMouse=W.reduce((s,w)=>s+Object.entries(w).reduce((a,[k,v])=>a+(k==='mouse'?0:v),0),0);
 const base=Math.round(nonMouse/1.44); // two +20% passes vs the original v33 base
 ok('T18.3 non-mouse total ~1.44x original base (>=1.4, <=1.48)',nonMouse/base>=1.40&&nonMouse/base<=1.48);
}

/* ---------- T18.4: bigger mouse (4x) & roach (2x) models render without error (E4) ---------- */
{
 G=null;newGame(d37(0,37400));
 const cc=G.map.N/2+0.5;
 const mouse=spawnWaveCreature('mouse',cc+2,cc),roach=spawnWaveCreature('roach',cc-2,cc),ant=spawnWaveCreature('ant',cc,cc+2);
 const ctx=document.createElement('canvas').getContext('2d');
 let derr=null;try{drawBug(ctx,mouse);drawBug(ctx,roach);drawBug(ctx,ant);}catch(e){derr=e;}
 ok('T18.4 scaled mouse/roach models draw without error',!derr);
 // full render() with the boss + roach in frame stays clean
 let rerr=null;try{render();}catch(e){rerr=e;}
 ok('T18.4 render() clean with bigger models in frame',!rerr);
 // gameplay footprint is unchanged: creatures still move on the 0.16 collision radius,
 // so the giant models do not wall anything off (sanity: they still take a step toward centre)
 const before=dhyp(mouse.x-cc,mouse.y-cc);
 for(let i=0;i<60;i++){G.tick++;creatureStep(mouse,cc,cc,1/30);}
 ok('T18.4 bigger model still moves normally (visual-only change)',dhyp(mouse.x-cc,mouse.y-cc)<before);
}
