/* tail_v27_1.js — T8: v27.1 fixes.
   Ghost-building render safety (the blank-screen root cause), landmine
   retaliation (frozen units / NaN flyers), the v26 tracer fog-gate
   regression, audAt2 audibility, render exception isolation, and the
   bigger blips + alert sound. Runs after tail_v27. */
'use strict';
section('T8 v27.1: ghost safety, mine retaliation, tracers, audio, blips v2');

G=null;newGame(cfg('backyard','dm','hard','green',3,961001));run(30);

/* ---------- T8.1 ghost snapshots are draw-safe ---------- */
{
 const foe=G.players.find(p=>p!==G.human&&p.ai);
 foe.res.p+=99999;foe.res.e+=99999;
 // find open ground for a 1x1 tower and a 2x2 bunker
 function spot(sz){
  for(let ty=3;ty<G.map.N-3;ty++)for(let tx=3;tx<G.map.N-3;tx++){
   let okp=true;
   for(let oy=0;oy<sz&&okp;oy++)for(let ox=0;ox<sz&&okp;ox++)if(!passable(tx+ox,ty+oy))okp=false;
   if(okp)return{tx,ty};
  }
  return null;
 }
 const s1=spot(1),s2=spot(2);
 const tw=s1&&placeBuilding(foe,'guardtower',s1.tx,s1.ty);
 const bk=s2&&placeBuilding(foe,'bunker',s2.tx,s2.ty);
 ok('T8 tower/bunker placed',!!tw&&!!bk);
 tw.prog=1;bk.prog=1;
 const gt=snapBld(tw),gb=snapBld(bk);
 ok('T8 ghost tface finite',isFinite(gt.tface));
 ok('T8 ghost garrison is an empty list',Array.isArray(gb.garrison)&&gb.garrison.length===0);
 ok('T8 ghost target null / cool zero',gt.target===null&&gt.cool===0);
 ok('T8 ghost barrel math finite',isFinite(Math.cos(screenAng(gt.tface))*16));
 ok('T8 ghost queue frozen empty',Array.isArray(gt.queue)&&gt.queue.length===0);
 let err=null;
 try{const cv=document.createElement('canvas');cv.width=300;cv.height=300;const c2=cv.getContext('2d');
  bldLive(c2,gt,FAC[foe.fac].color);bldLive(c2,gb,FAC[foe.fac].color);
 }catch(e){err=e}
 ok('T8 bldLive tolerates ghosts',!err);
 if(err)console.log('   ',err.message);
 // a hostile snapshot with NO tface at all (pre-fix shape) is also tolerated
 err=null;
 try{const cv=document.createElement('canvas');const c2=cv.getContext('2d');
  const legacy=Object.assign({},gt);delete legacy.tface;delete legacy.garrison;
  bldLive(c2,legacy,FAC[foe.fac].color);
  const legacyB=Object.assign({},gb);delete legacyB.garrison;
  bldLive(c2,legacyB,FAC[foe.fac].color);
 }catch(e){err=e}
 ok('T8 bldLive tolerates legacy field-less ghosts',!err);
}

/* ---------- T8.2 mine retaliation ---------- */
{
 const foe=G.players.find(p=>p!==G.human&&p.ai);
 const g2=makeUnit('grunt',G.human,20,20);g2.state='idle';g2.target=null;
 applyDmg(g2,4,'ex',MINE_OWNER);
 ok('T8 mine survivor stays idle',g2.state==='idle'&&g2.target!==MINE_OWNER);
 const h2=makeUnit('heli',G.human,30,30);h2.state='idle';h2.target=null;
 applyDmg(h2,4,'ex',MINE_OWNER);
 run(90);
 ok('T8 flying mine survivor stays finite',isFinite(h2.x)&&isFinite(h2.y));
 const cr=(G.neutrals||[]).find(c2=>c2.hp>0&&!c2.target);
 if(cr){applyDmg(cr,.5,'ex',MINE_OWNER);ok('T8 wildlife never targets the mine ghost',cr.target!==MINE_OWNER);}
 else ok('T8 wildlife never targets the mine ghost (skipped, none idle)',true);
 // real retaliation still works, for enemy units and for wildlife attackers
 const g3=makeUnit('grunt',G.human,40,40);g3.state='idle';g3.target=null;
 const e3=makeUnit('grunt',foe,41,40);
 applyDmg(g3,2,'b',e3);
 ok('T8 real attackers still draw retaliation',g3.target===e3);
 const g4=makeUnit('grunt',G.human,44,44);g4.state='idle';g4.target=null;
 const critter={kind:'creature',x:44,y:45,hp:30,id:999902,t:{dm:2}};
 applyDmg(g4,2,'b',critter);
 ok('T8 wildlife attackers still draw retaliation',g4.target===critter);
 g3.target=null;g3.state='idle';g4.target=null;g4.state='idle';
}

/* ---------- T8.3 tracer fog gate ---------- */
{
 G.parts.length=0;
 tracer2(10,10,8,14,12,8,'#ffffff',2);
 const tp=G.parts[G.parts.length-1];
 ok('T8 tracer particle lacks x/y (regression precondition)',tp&&tp.t==='tr2'&&tp.x==null);
 const gx=tp.x!=null?tp.x:(tp.x1+tp.x2)*.5, gy=tp.y!=null?tp.y:(tp.y1+tp.y2)*.5;
 ok('T8 tracer gates by segment midpoint',gx===12&&gy===11);
 let err=null;try{render()}catch(e){err=e}
 ok('T8 render clean with tracers present',!err);
 G.parts.length=0;
}

/* ---------- T8.4 audAt2 ---------- */
{
 const hq=G.human.blds.find(b=>b.key==='hq');
 G.cam.x=isoX(hq.x,hq.y)-view.width/2;G.cam.y=isoY(hq.x,hq.y)-view.height/2;
 const aBoth=audAt2(hq.x,hq.y,hq.x+1,hq.y);
 ok('T8 audAt2 both visible -> audible',!!aBoth&&aBoth.gain>0);
 const far={x:G.map.N-3,y:G.map.N-3};
 ok('T8 far corner is fogged (precondition)',fogAt(far.x,far.y)!==2);
 const aHalf=audAt2(far.x,far.y,hq.x,hq.y);
 ok('T8 audAt2 fogged shooter, visible target -> audible',!!aHalf&&aHalf.gain>0);
 ok('T8 audAt2 both fogged -> silent',audAt2(far.x,far.y,far.x+2,far.y)==null);
}

/* ---------- T8.5 render guard + blips v2 ---------- */
{
 const n0=REN_ERRS.size;
 const h0=hashState();
 const cw=console.warn;console.warn=()=>{};
 renderGuard(new Error('t8-test-error'));renderGuard(new Error('t8-test-error'));
 console.warn=cw;
 ok('T8 renderGuard logs each distinct error once',REN_ERRS.size===n0+1);
 ok('T8 renderGuard leaves the sim hash untouched',hashState()===h0);
 ok('T8 renderGuard stamped the HUD throttle',G.renWarnT===G.tick);
 G.atkPings.length=0;atkPing(10,10);atkPing(50,50);
 G.atkPings[0].t=.3;G.atkPings[1].t=1.6; // one in ring phase, one pulsing
 let err=null;
 for(const k2 of ['small','medium','large']){mmSizeKey=k2;applyMMSize();try{renderMinimap()}catch(e){err=e}}
 mmSizeKey='medium';applyMMSize();
 ok('T8 blips v2 render at all minimap sizes',!err);
 ok('T8 alert sound helper is shim-silent',typeof sAtkAlert==='function'&&sAtkAlert()===undefined);
 ok('T8 blips still absent from snapshots',!('atkPings' in JSON.parse(saveState())));
 ok('T8 snapshot tag bumped (>=27.1)',JSON.parse(saveState()).v>=27.1); // v28: monotonic, like T6's tag check
 G.atkPings.length=0;
}
