/* tail_v30_1.js — T12: v30.1 bugfix suite.
   1) drawUnit paints EVERY unit key (the APC's a:'apc' matched no dispatch
      branch and drew nothing but its shadow; the generic fallback fixes it
      and future-proofs new archetypes),
   2) ghost-node store stays index-aligned through removeNode splices, fogged
      depletion leaves a gone ghost that drops on re-scout, visible depletion
      leaves nothing, render + minimap smoke with gone ghosts in frame,
      position re-key survives save/load,
   3) Radio Tower shared call-down cooldown actually recharges (was stuck at
      180 forever: the decrement lived inside the guardtower/bunker branch),
      second call-down fires after recovery,
   4) shift-queued harvest orders re-resolve by position after index-shifting
      splices; pre-v30.1 index-only orders still pop via the fallback;
      queued coords survive a snapshot round-trip. */
'use strict';
section('T12 v30.1: APC render, ghost-node alignment, radio cooldown, queued harvest');

ok('T12 snapshot tag bumped', (()=>{fresh(301000);return JSON.parse(saveState()).v>=30.1})());

/* ---------- T12.1 every unit key paints through drawUnit ---------- */
{fresh(301001);
 // recording 2d-context proxy: counts actual paint ops (drawImage/fill/stroke/
 // fillRect/fillText). Pre-fix, an APC with nothing selected/flashing recorded
 // ZERO paint ops (only save/translate/scale/restore ran).
 const recCtx=()=>{
  const calls={n:0},PAINT=new Set(['drawImage','fill','stroke','fillRect','fillText','strokeRect']);
  const store={canvas:{width:400,height:300}};
  const px=new Proxy(store,{
   get(t,k){
    if(k in t)return t[k];
    if(k==='getImageData'||k==='createImageData')return (a,b,w,h)=>({data:new Uint8ClampedArray(4),width:1,height:1});
    if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createConicGradient')return ()=>({addColorStop(){}});
    if(k==='createPattern')return ()=>({});
    if(k==='measureText')return s=>({width:(s?String(s).length:1)*6});
    if(k==='getLineDash')return ()=>[];
    return function(){if(PAINT.has(k))calls.n++};
   },
   set(t,k,v){t[k]=v;return true},
  });
  return {px,calls};
 };
 for(const key in U){
  const {px,calls}=recCtx();
  const u=makeUnit(key,G.human,20,20);u.sel=false;u.flash=0;u.mining=false;
  let err=null;try{drawUnit(px,u)}catch(e){err=e}
  ok(`T12 drawUnit paints ${key}`,!err&&calls.n>0);
  if(err)console.log('   ',err.stack.split('\n')[0]);
  // detach the probe so it never joins later sim steps
  G.units.splice(G.units.indexOf(u),1);G.human.units.splice(G.human.units.indexOf(u),1);
 }
}

/* ---------- T12.2 ghost-node index alignment + gone-ghost lifecycle ---------- */
{fresh(301002);
 const aligned=()=>G.map.nodes.every((n,i)=>!G.ghost.nodes[i]||(G.ghost.nodes[i].x===n.x&&G.ghost.nodes[i].y===n.y));
 // reveal everything so a snapshot exists at every index
 G.fog.fill(2);ghostRefresh();
 ok('T12 snapshot per node under full vision',G.map.nodes.length>3&&G.map.nodes.every((n,i)=>G.ghost.nodes[i]&&G.ghost.nodes[i].x===n.x));
 // fog everything, then deplete a low-index node: every later index shifts
 G.fog.fill(1);
 const victim=G.map.nodes[1],countBefore=G.map.nodes.length;
 victim.amt=0;removeNode(victim);
 ok('T12 store spliced in lockstep with G.map.nodes',G.map.nodes.length===countBefore-1&&aligned());
 ok('T12 fogged depletion leaves a gone ghost',(G.ghost.goneNodes||[]).length===1&&G.ghost.goneNodes[0].x===victim.x&&G.ghost.goneNodes[0].y===victim.y);
 // render + minimap smoke with the gone ghost in frame (renderCore directly:
 // render() routes through renderGuard, which suppresses errors)
 G.cam={x:isoX(victim.x,victim.y)-50,y:isoY(victim.x,victim.y)-50};
 let rerr=null;try{renderCore();renderMinimap()}catch(e){rerr=e}
 ok('T12 render + minimap clean with gone ghost in frame',!rerr);
 if(rerr)console.log('   ',rerr.stack.split('\n')[0]);
 // re-scout: the gone ghost drops
 G.fog.fill(2);ghostRefresh();
 ok('T12 re-scout clears the gone ghost',(G.ghost.goneNodes||[]).length===0);
 // depletion in plain sight leaves nothing behind
 const v2=G.map.nodes[0];v2.amt=0;removeNode(v2);
 ok('T12 visible depletion leaves no ghost',(G.ghost.goneNodes||[]).length===0&&aligned());
 // save/load: position re-key keeps frozen fogged snapshots aligned
 G.fog.fill(2);ghostRefresh();G.fog.fill(1);
 const snap=saveState();loadState(snap);
 ok('T12 load re-keys node ghosts by position',aligned()&&G.ghost.nodes.some(g=>!!g));
}

/* ---------- T12.3 radio tower cooldown recharges; second call-down fires ---------- */
{fresh(301003);
 const hu=G.human;
 const rt=makeBuilding('radiotower',hu,Math.floor(hu.blds[0].tx)+5,Math.floor(hu.blds[0].ty),true);
 ok('T12 tower starts ready',rt.abilityCool<=0);
 submitCmd('radio',{bid:rt.id,mode:'paradrop',x:rt.x,y:rt.y+6});execCmds();
 ok('T12 first call-down arms the cooldown',rt.abilityCool===RADIO_CD);
 run(30*5); // 5 sim seconds
 ok('T12 cooldown ticks down on the tower',rt.abilityCool<RADIO_CD-4&&rt.abilityCool>RADIO_CD-7);
 rt.abilityCool=0.4;run(30); // fast-forward to the tail of the cooldown
 ok('T12 cooldown reaches ready again',rt.abilityCool<=0);
 const strikes0=G.strikes.length;
 submitCmd('radio',{bid:rt.id,mode:'paradrop',x:rt.x,y:rt.y+6});execCmds();
 ok('T12 second call-down fires after recovery',rt.abilityCool===RADIO_CD&&G.strikes.length>strikes0);
}

/* ---------- T12.4 queued harvest survives index shifts ---------- */
{fresh(301004);
 const truck=G.human.units.find(u=>u.key==='truck')||makeUnit('truck',G.human,G.human.start.x,G.human.start.y);
 const tgt=G.map.nodes[3];
 // v30.1 orders carry coords; splice a lower index out from under them
 truck.oq=[{op:'harvest',ni:3,nx:tgt.x,ny:tgt.y}];
 const v=G.map.nodes[0];v.amt=0;removeNode(v);
 popOrder(truck);
 ok('T12 queued harvest re-resolves by position after a splice',truck.node===tgt);
 // pre-v30.1 orders (index only) still pop through the fallback
 const t2=G.map.nodes[1];
 truck.oq=[{op:'harvest',ni:1}];
 popOrder(truck);
 ok('T12 legacy index-only orders still pop',truck.node===t2);
 // queued coords round-trip through a snapshot
 truck.oq=[{op:'harvest',ni:3,nx:tgt.x,ny:tgt.y}];
 const tid=truck.id,snap=saveState();loadState(snap);
 const tr2=G.units.find(u=>u.id===tid);
 ok('T12 queued coords survive save/load',!!tr2&&tr2.oq.length===1&&tr2.oq[0].nx===tgt.x&&tr2.oq[0].ny===tgt.y);
}
