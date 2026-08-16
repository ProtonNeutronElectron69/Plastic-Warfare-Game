/* tail_v26.js — T6: v26 behavior checks.
   Ghost store lifecycle (last-seen freeze, destroyed-while-fogged persistence,
   re-scout cleanup), deferred terrain stamps, AI retaliation rules, projectile
   class/caliber tagging, vision-gated shake, and render smoke tests with
   ghosts + fogged munitions in frame. Runs after tail_tests/tail_expo. */
'use strict';
section('T6 v26: fog ghosts, deferred stamps, AI retaliation, munitions');

function fresh(seed){G=null;newGame(cfg('backyard','dm','normal','green',3,seed));run(30);}
function tp(u,x,y){u.x=x;u.y=y;u.path=null;u.state='idle';u.target=null;}

/* ---------- T6.1 ghost building lifecycle (neutral barricade) ---------- */
fresh(616101);
{
 const b0=G.blds.find(b=>b.p===G.neutral&&b.key==='barricade');
 ok('T6 a neutral barricade exists to test against',!!b0);
 const scout=makeUnit('grunt',G.human,b0.x+1.5,b0.y);
 updateFog();
 const g0=G.ghost.blds.get(b0.id);
 ok('T6 ghost created when tile is in vision',!!g0);
 ok('T6 ghost snapshots hp',g0&&g0.hp===b0.hp);
 ok('T6 ghost is a frozen copy, not a live ref',g0!==b0);
 tp(scout,G.human.start.x,G.human.start.y);updateFog();
 ok('T6 tile drops to explored fog after leaving',fogAt(b0.x,b0.y)===1);
 const hpSeen=G.ghost.blds.get(b0.id).hp;
 applyDmg(b0,30,'b',scout);
 ok('T6 live hp drops while fogged',b0.hp<hpSeen);
 ok('T6 ghost hp frozen at last-seen value',G.ghost.blds.get(b0.id).hp===hpSeen);
 const q0=G.ghost.stampQ.length;
 kill(b0,scout);
 ok('T6 fogged kill removed the live building',!G.blds.includes(b0));
 ok('T6 ghost persists after destroyed-while-fogged',G.ghost.blds.has(b0.id));
 ok('T6 terrain decals deferred while fogged',G.ghost.stampQ.length>q0);
 tp(scout,b0.x+1.5,b0.y);updateFog();
 ok('T6 re-scouting rubble drops the ghost',!G.ghost.blds.has(b0.id));
 ok('T6 deferred decals flushed once tile is seen',
    !G.ghost.stampQ.some(s=>Math.floor(s.x)===Math.floor(b0.x)&&Math.floor(s.y)===Math.floor(b0.y)));
 // hash + snapshot stay blind to the ghost store
 const h0=hashState();G.ghost.blds.set(999999,{x:1,y:1});
 ok('T6 hashState ignores ghost store',hashState()===h0);
 G.ghost.blds.delete(999999);
 ok('T6 snapshot excludes ghost store',saveState().indexOf('"ghost"')===-1);
 ok('T6 snapshot tag tracks the build (>=26)',JSON.parse(saveState()).v>=26);
}

/* ---------- T6.2 node ghost freeze + unexplored stays unknown ---------- */
fresh(616102);
{
 let ni=-1;G.map.nodes.forEach((n,i)=>{if(ni<0&&fogAt(n.x,n.y)===0)ni=i});
 ok('T6 an unexplored node exists',ni>=0);
 const n=G.map.nodes[ni];
 ok('T6 unexplored node has no ghost',!G.ghost.nodes[ni]);
 const scout=makeUnit('grunt',G.human,n.x+1,n.y);
 updateFog();
 ok('T6 node ghost created on sight',!!G.ghost.nodes[ni]&&G.ghost.nodes[ni].amt===n.amt);
 tp(scout,G.human.start.x,G.human.start.y);updateFog();
 const seenAmt=G.ghost.nodes[ni].amt;
 n.amt=Math.max(0,n.amt-50);
 ok('T6 node ghost amount frozen while fogged',G.ghost.nodes[ni].amt===seenAmt&&n.amt!==seenAmt);
}

/* ---------- T6.3 nest ghost freeze ---------- */
fresh(616103);
{
 const nests=G.map.nests||[];
 ok('T6 map has wildlife nests',nests.length>0);
 if(nests.length){
  const i=0,ns=nests[0];
  const scout=makeUnit('grunt',G.human,ns.x+1,ns.y);
  updateFog();
  ok('T6 nest ghost created on sight',!!G.ghost.nests[i]&&G.ghost.nests[i].dead===ns.dead);
  tp(scout,G.human.start.x,G.human.start.y);updateFog();
  ns.dead=true;
  ok('T6 nest ghost state frozen while fogged',!G.ghost.nests[i].dead);
 }
}

/* ---------- T6.4 AI retaliation ---------- */
fresh(616104);
{
 const p1=G.players.find(p=>p!==G.human&&p.ai);
 ok('T6 an AI opponent exists',!!p1);
 const tank=makeUnit('tank',p1,20,20);
 const truck=makeUnit('truck',G.human,23,20);
 const grunt=makeUnit('grunt',G.human,21.5,20);
 orderAttack(tank,truck);
 ok('T6 setup: AI tank locked on the dump truck',tank.state==='attack'&&tank.target===truck);
 applyDmg(tank,4,'b',grunt);
 ok('T6 tank under fire drops the truck chase for the shooter',tank.target===grunt&&tank.state==='attack');
 ok('T6 retaliation stamps its throttle',tank.retalT===G.tick);
 orderAttack(tank,truck);
 applyDmg(tank,4,'b',grunt);
 ok('T6 retaliation is throttled (no same-window ping-pong)',tank.target===truck);
 // a real, closer, armed target is kept even when shot from farther away
 tank.retalT=G.tick-200;
 const nearFoe=makeUnit('grunt',G.human,21,20);
 orderAttack(tank,nearFoe);
 const farFoe=makeUnit('grunt',G.human,26,20);
 applyDmg(tank,4,'b',farFoe);
 ok('T6 close armed target is not abandoned for a distant shooter',tank.target===nearFoe);
 // marching units interrupt the march, remember the destination
 const jeep=makeUnit('jeep',p1,30,30);
 orderMove(jeep,40,40,false);
 const jg=makeUnit('grunt',G.human,31,30);
 applyDmg(jeep,4,'b',jg);
 ok('T6 marching AI unit turns to return fire',jeep.state==='attack'&&jeep.target===jg);
 ok('T6 interrupted march keeps its destination',jeep.savedDest&&jeep.savedDest.x===40&&jeep.savedDest.y===40);
 // shooters beyond reach (vision+2) never derail the unit
 const tank2=makeUnit('tank',p1,50,50);
 const truck2=makeUnit('truck',G.human,53,50);
 orderAttack(tank2,truck2);
 const sniperFar=makeUnit('grunt',G.human,60,50); // 10 tiles > vi(6)+2
 applyDmg(tank2,4,'b',sniperFar);
 ok('T6 out-of-reach shooters are ignored',tank2.target===truck2);
 // scouts keep scouting
 const bike=makeUnit('bike',p1,60,20);bike.aiRole='scout';
 const truck3=makeUnit('truck',G.human,63,20);
 orderAttack(bike,truck3);
 const bg2=makeUnit('grunt',G.human,61,20);
 applyDmg(bike,4,'b',bg2);
 ok('T6 AI scouts are exempt from retaliation',bike.target===truck3);
 // human orders are never overridden
 const hg=makeUnit('grunt',G.human,70,40);
 const atr=makeUnit('truck',p1,73,40);
 orderAttack(hg,atr);
 const ag=makeUnit('grunt',p1,71,40);
 applyDmg(hg,4,'b',ag);
 ok('T6 human attack orders are never overridden',hg.target===atr);
}

/* ---------- T6.5 projectile class + caliber tags ---------- */
fresh(616105);
{
 const p1=G.players.find(p=>p!==G.human&&p.ai);
 const victim=makeUnit('grunt',G.human,25,25);
 const shots=[['tank','shell',1.1],['bulltank','shell',1.5],['bazooka','rocket',0.8],
              ['apache','rocket',1.1],['mortar','mortar',0.8],['arty','mortar',1.1],
              ['grenadier','gren',1]];
 for(const [key,cls,cal] of shots){
  const u=makeUnit(key,p1,22,25);
  const before=G.projs.length;
  fireAt(u,victim);
  const pr=G.projs[G.projs.length-1];
  ok(`T6 ${key} fires a tagged '${cls}' round`,G.projs.length===before+1&&pr.cls===cls);
  ok(`T6 ${key} caliber ${cal}`,Math.abs(pr.cal-cal)<1e-9);
 }
 ok('T6 rocket rounds home (tgt set), shells do not',
    G.projs.some(p=>p.cls==='rocket'&&p.tgt===victim)&&G.projs.filter(p=>p.cls==='shell').every(p=>!p.tgt));
 ok('T6 mortar rounds arc',G.projs.filter(p=>p.cls==='mortar').every(p=>p.arc));
}

/* ---------- T6.6 vision-gated shake + deferred stamp direct checks ---------- */
fresh(616106);
{
 // start corners rotate by seed, so hunt for a genuinely unexplored tile
 let ux=-1,uy=-1;const N6=G.map.N;
 outer:for(let y=2;y<N6-2;y++)for(let x=2;x<N6-2;x++)if(G.fog[y*N6+x]===0){ux=x+.5;uy=y+.5;break outer}
 ok('T6 an unexplored tile exists',ux>=0);
 G.shake=0;shakeAt(ux,uy,5);
 ok('T6 explosions in unexplored fog do not shake the screen',G.shake===0);
 shakeAt(G.human.start.x,G.human.start.y,5);
 ok('T6 explosions in vision shake the screen',G.shake===5);
 const q0=G.ghost.stampQ.length;
 stampScorch(ux,uy,10);
 ok('T6 fogged scorch queues instead of painting',G.ghost.stampQ.length===q0+1);
 stampScorch(G.human.start.x,G.human.start.y,10);
 ok('T6 visible scorch paints immediately',G.ghost.stampQ.length===q0+1);
}

/* ---------- T6.7 render smoke tests with ghosts + fogged munitions ---------- */
fresh(616107);
{
 // stand a ghost up, then render with the camera on it (fog 1: ghost path draws)
 const b0=G.blds.find(b=>b.p!==G.human&&b.p!==G.neutral);
 const scout=makeUnit('grunt',G.human,b0.x+1.5,b0.y);
 updateFog();
 tp(scout,G.human.start.x,G.human.start.y);updateFog();
 G.cam={x:isoX(b0.x,b0.y)-50,y:isoY(b0.x,b0.y)-50};
 // park munitions of every class in the fogged area (gate path) and one in vision
 for(const cls of ['gren','rocket','mortar','shell'])
  G.projs.push({x:b0.x,y:b0.y,z:12,tx:b0.x+3,ty:b0.y,tgt:null,sp:9,dm:1,spl:0,type:'ex',owner:scout,arc:cls==='mortar',grenade:cls==='gren'?1:0,cls,cal:1.1,travel:1,total:4,trail:false});
 let err=null;try{render();}catch(e){err=e}
 ok('T6 render clean with ghost building + fogged munitions',!err);
 if(err)console.log('   ',err.stack.split('\n')[0]);
 // now with vision on the same spot (live + oriented-munition draw paths)
 tp(scout,b0.x+1.5,b0.y);updateFog();
 err=null;try{render();}catch(e){err=e}
 ok('T6 render clean with live munitions in vision',!err);
 if(err)console.log('   ',err.stack.split('\n')[0]);
 // ghost node + nest in frame
 let ni=-1;G.map.nodes.forEach((n,i)=>{if(ni<0&&fogAt(n.x,n.y)===0)ni=i});
 if(ni>=0){const n=G.map.nodes[ni];tp(scout,n.x+1,n.y);updateFog();tp(scout,G.human.start.x,G.human.start.y);updateFog();
  G.cam={x:isoX(n.x,n.y)-50,y:isoY(n.x,n.y)-50};
  err=null;try{render();}catch(e){err=e}
  ok('T6 render clean with ghost node in frame',!err);
  if(err)console.log('   ',err.stack.split('\n')[0]);
 } else ok('T6 render clean with ghost node in frame',true);
 // uScale sanity
 ok('T6 uScale table live',uScale({key:'grunt'})===.82&&uScale({key:'tank'})===1.15&&uScale({key:'nosuch'})===1);
}
