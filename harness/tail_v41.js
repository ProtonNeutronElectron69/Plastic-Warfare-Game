/* tail_v41.js - T21: v41 tank turret decoupling
   T1 hull follows travel, turret aims independently (a==='tank'); shells/flash emit from the turret
   T2 smooth cosmetic turret slew (u.tvis eases toward the aim; never hashed/serialized) */
'use strict';
section('T21 v41: tank hull/turret decoupling + smooth cosmetic turret slew');

/* ---------- T1: hull decoupling (sim) ---------- */
{
 G=null;newGame(cfg('backyard','dm','normal','green',1,941000));
 const enemy=G.players.find(p=>p&&p!==G.human&&p.alive)||G.players[1];

 // a tank firing does NOT turn its hull to the target; only the turret aim (tface) tracks it
 const tk=makeUnit('tank',G.human,30,30);tk.face=0; // hull faces +x (east)
 const tgtS=makeUnit('grunt',enemy,30,40);          // target due south -> aim angle datan2(10,0)
 const aimS=datan2(tgtS.y-tk.y,tgtS.x-tk.x);
 const p0=G.projs.length;
 fireAt(tk,tgtS);
 ok('T21.1 tank hull keeps its travel facing on fire (face unchanged)',tk.face===0);
 ok('T21.1 tank turret aim tracks the target (tface==aim)',tk.tface===aimS);
 // the shell emits from the turret direction, not the hull
 if(G.projs.length>p0){
  const pr=G.projs[G.projs.length-1];
  ok('T21.1 tank shell spawns along the turret aim, not the hull',Math.abs(pr.x-tk.x)<0.2&&(pr.y-tk.y)>0.5);
 } else ok('T21.1 tank shell spawns along the turret aim, not the hull',false);

 // a non-tank (grunt) still turns its whole body to the target, exactly as before
 const gr=makeUnit('grunt',G.human,30,30);gr.face=0;
 const tgtG=makeUnit('grunt',enemy,30,44);
 const aimG=datan2(tgtG.y-gr.y,tgtG.x-gr.x);
 fireAt(gr,tgtG);
 ok('T21.1 infantry still body-aims at the target (face==tface==aim)',gr.face===aimG&&gr.tface===aimG);

 // source: both fire paths gate the hull snap on non-tank
 const fs=fireAt.toString(),us=updateUnit.toString();
 ok('T21.1 fireAt only snaps the hull for units without a turret',/isTank=turreted\(u\.t\); if\(!isTank\)u\.face=u\.tface/.test(fs)); // v51: the a==='tank' test became the turreted() predicate so the AA truck shares it
 ok('T21.1 fireAt barrel/flash emit from the aim angle',fs.includes('screenAng(aim)')&&fs.includes('dcos(aim)')&&fs.includes('u.flashAng=aim'));
 ok("T21.1 attack path skips the hull snap for turreted hulls",us.includes("if(!turreted(t))u.face=u.tface"));
}

/* ---------- T2: cosmetic turret slew ---------- */
{
 G=null;newGame(cfg('backyard','dm','normal','green',1,941100));
 const tk=makeUnit('tank',G.human,20,20);

 // u.tvis is client-local: never hashed, never serialized
 const h0=hashState();tk.tvis=1.2345;
 ok('T21.2 turret visual angle is not hashed',hashState()===h0);
 ok('T21.2 turret visual angle is on the serialization skip-list',SNAP_ENT_SKIP.has('tvis'));
 ok('T21.2 saved snapshot omits tvis',!JSON.parse(saveState()).units.some(u=>u&&'tvis' in u));

 // slew converges toward the goal at TURR_SLEW*RDT per frame, clamped, no overshoot
 const ctx=document.createElement('canvas').getContext('2d');
 RDT=0.1; // 100 ms frame -> tank step = 4.5*0.1 = 0.45 rad/frame
 tk.face=0.5; tk.target={x:1,y:1,hp:100,kind:'unit'}; tk.tface=3.0; tk.tvis=0; tk.sel=false; tk.healedAt=null;
 drawUnit(ctx,tk);
 ok('T21.2 one frame slews by TURR_SLEW*RDT (0.45 rad)',Math.abs(tk.tvis-0.45)<1e-9);
 let guard=0;while(Math.abs(tk.tvis-3.0)>1e-9&&guard<100){drawUnit(ctx,tk);guard++;}
 ok('T21.2 turret converges exactly on the aim (no overshoot)',tk.tvis===3.0&&guard<100);

 // shortest-path wrap: from 0.2 toward -3.0 it rotates the short way (through +pi), landing on the goal
 tk.tface=-3.0; tk.tvis=0.2;
 let g2=0;while(Math.abs(Math.atan2(Math.sin(tk.tvis+3.0),Math.cos(tk.tvis+3.0)))>1e-9&&g2<100){drawUnit(ctx,tk);g2++;}
 ok('T21.2 turret takes the shortest angular path and lands on the goal',g2<100&&Math.abs(Math.atan2(Math.sin(tk.tvis+3.0),Math.cos(tk.tvis+3.0)))<1e-9);

 // idle turret (no target) re-centers on the hull
 tk.target=null; tk.face=1.1; tk.tvis=1.1-0.9;
 let g3=0;while(Math.abs(tk.tvis-1.1)>1e-9&&g3<100){drawUnit(ctx,tk);g3++;}
 ok('T21.2 idle turret re-centers on the hull facing',tk.tvis===1.1&&g3<100);

 // the "Bull" heavy tank slews slower (3.0 rad/s)
 const bt=makeUnit('bulltank',G.human,24,24);
 bt.face=0; bt.target={x:1,y:1,hp:1,kind:'unit'}; bt.tface=3.0; bt.tvis=0; bt.sel=false; bt.healedAt=null;
 drawUnit(ctx,bt);
 ok('T21.2 Bull heavy tank slews at its slower rate (3.0*RDT = 0.30)',Math.abs(bt.tvis-0.30)<1e-9);

 // on-unit muzzle flash follows the visible turret for tanks
 ok('T21.2 on-unit flash tracks the visible turret for turreted hulls',drawUnit.toString().includes("turreted(u.t)&&u.tvis!=null?u.tvis"));
}

/* ---------- T-det: v41 stays internally deterministic, incl. firing tanks ---------- */
{
 function tankTrail(seed){
  G=null;newGame(cfg('backyard','dm','normal','green',1,seed));
  const enemy=G.players.find(p=>p&&p!==G.human&&p.alive)||G.players[1];
  const t1=makeUnit('tank',G.human,30,30),t2=makeUnit('bulltank',G.human,32,30);
  const e1=makeUnit('grunt',enemy,34,30),e2=makeUnit('grunt',enemy,34,32);
  t1.target=e1;t1.state='attack'; t2.target=e2;t2.state='attack';
  const tr=[];for(let i=1;i<=400;i++){update(DT);if(i%20===0)tr.push(hashState())}return tr;
 }
 const a=tankTrail(941700),b=tankTrail(941700);
 ok('T21.det dual runs with firing tanks match (hull decouple active)',JSON.stringify(a)===JSON.stringify(b));

 // save/load round-trip with tanks in the field resumes on the same trail
 G=null;newGame(cfg('backyard','dm','normal','green',1,941800));
 const enemy=G.players.find(p=>p&&p!==G.human&&p.alive)||G.players[1];
 const tt=makeUnit('tank',G.human,28,28),ee=makeUnit('grunt',enemy,33,28);
 tt.target=ee;tt.state='attack';
 for(let i=0;i<120;i++)update(DT);
 const json=saveState();
 const tA=[];for(let i=1;i<=200;i++){update(DT);if(i%25===0)tA.push(hashState())}
 loadState(json);
 const tB=[];for(let i=1;i<=200;i++){update(DT);if(i%25===0)tB.push(hashState())}
 ok('T21.det save/load with a firing tank resumes bit-identically',JSON.stringify(tA)===JSON.stringify(tB));
}
