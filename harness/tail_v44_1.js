/* tail_v44_1.js - T25: an issued order outranks station keeping.
   A: the order tag - escorted orders stamp 1, hand orders stamp 0, on both the
      move and the attack command.
   B: the bug itself - a medic peeled off a firefight by hand drives away at once.
   C: escorted behaviour is untouched (coverage bars from T24 and the v42 hold).
   D: field hygiene - never on a non-medic, never hashed, survives a round trip.
   E: an absent tag means escorted, so v44 saves and AI/patrol orders are unaffected.
   F: AI-only trails are still byte-identical to the pinned baselines (re-cut at v45).
   G: determinism and save/load resume with a hand-driven medic in flight.
   H: sim-purity lint on the two new functions. */
'use strict';
section('T25 v44.1: issued orders override medic station keeping');

const DT441=1/30;
function cfg441(map,mode,diff,fac,opp,seed){return{map,mode,diff,fac:fac||'green',opp:opp||3,seed}}
/* v66: this was a byte-for-byte copy of the v44 helper, so it inherited the same
   dead end when the v66 maps stopped leaving 22-tile corridors lying around. One
   implementation now, in tail_v44.js, which loads first: scan, then carve. */
function arena441(W,H,LEN,clr){return arena44(W,H,LEN,clr)}
/* A squad that walks into a pinned defence. The defenders hold position and their
   player's brain is switched off: this fixture is about the medic, not about AI
   manoeuvre, and an AI that marches its grunts off to raid never makes contact. */
function battle441(seed,N,M){
 G=null;newGame(cfg441('kitchen','dm','normal','green',1,seed));
 for(const mn of (G.map.mines||[]))mn.live=false;
 const A=arena441(6,3,18,10);
 if(!A)return null;
 const gr=[],ms=[];
 for(let i=0;i<N;i++)gr.push(makeUnit('grunt',G.human,A.x+(i%6),A.y+((i/6)|0)));
 for(let i=0;i<M;i++)ms.push(makeUnit('medic',G.human,A.x+i*0.7,A.y-1));
 const foe=G.players.find(p=>p!==G.human);
 for(let i=0;i<6;i++){const e=makeUnit('grunt',foe,A.x+16+(i%2),A.y+((i/2)|0));e.hold=true}
 foe.ai=null;
 execCmd({op:'move',pi:G.human.i,a:{ids:gr.concat(ms).map(u=>u.id),x:A.x+18,y:A.y+1,am:1}});
 let fightAt=-1;
 for(let k=1;k<=900;k++){update(DT441);if(gr.some(u=>u.state==='attack')){fightAt=k;break}}
 if(fightAt<0)return null;
 for(let k=0;k<60;k++)update(DT441);      // let the firing line settle in
 return {A,gr,ms,foe};
}

/* ---------- A: the order tag ---------- */
{
 G=null;newGame(cfg441('kitchen','dm','normal','green',1,441501));
 const men=[];for(let i=0;i<4;i++)men.push(makeUnit('grunt',G.human,20+i*0.4,20));
 const m1=makeUnit('medic',G.human,19,19),m2=makeUnit('medic',G.human,19.6,19);
 execCmd({op:'move',pi:G.human.i,a:{ids:men.concat([m1,m2]).map(u=>u.id),x:32,y:32}});
 ok('T25.A an order carrying armed units stamps both medics escorted',m1.mesc===1&&m2.mesc===1);
 execCmd({op:'move',pi:G.human.i,a:{ids:[m1.id],x:26,y:26}});
 ok('T25.A a medic sent on its own is stamped unescorted',m1.mesc===0);
 ok('T25.A ...and the medic left with the army keeps its escorted tag',m2.mesc===1);
 execCmd({op:'move',pi:G.human.i,a:{ids:[m1.id,m2.id],x:24,y:24}});
 ok('T25.A a medics-only order is a hand order, however many trucks',m1.mesc===0&&m2.mesc===0);
 ok('T25.A the tag is never written onto a combat unit',men.every(u=>!('mesc' in u)));

 const foe=G.players.find(p=>p!==G.human);
 const tgt=makeUnit('grunt',foe,40,40);
 execCmd({op:'attack',pi:G.human.i,a:{ids:[m1.id],tid:tgt.id}});
 ok('T25.A a medic sent at a target alone is a hand order',m1.mesc===0);
 execCmd({op:'attack',pi:G.human.i,a:{ids:men.concat([m1]).map(u=>u.id),tid:tgt.id}});
 ok('T25.A ...but an assault it rides along with is escorted',m1.mesc===1);
}

/* ---------- B: the reported bug ---------- */
{
 const b=battle441(9001,12,1);
 let closed5s=null,arrived=-1,gap0=null;
 if(b){
  const m=b.ms[0],dst={x:b.A.x+2,y:b.A.y+1};
  execCmd({op:'move',pi:G.human.i,a:{ids:[m.id],x:dst.x,y:dst.y}});
  gap0=dhyp(m.x-dst.x,m.y-dst.y);
  for(let k=1;k<=600;k++){
   update(DT441);
   if(k===150)closed5s=gap0-dhyp(m.x-dst.x,m.y-dst.y);
   if(arrived<0&&dhyp(m.x-dst.x,m.y-dst.y)<1.0)arrived=k;
  }
 }
 ok('T25.B the fixture actually put the medic in a firefight',gap0!==null&&gap0>6);
 // v44 measured -1.86 tiles here: station keeping dragged it back toward the fight.
 ok('T25.B a hand order mid-firefight makes real progress in 5s',closed5s!==null&&closed5s>=6);
 ok('T25.B ...and the medic reaches where it was sent',arrived>0&&arrived<=300);

 // the same order, but the medic is peeled off WITH an escort: still station keeping
 const b2=battle441(9001,12,1);
 let escortedHeld=null;
 if(b2){
  const m=b2.ms[0],esc=b2.gr[0];
  execCmd({op:'move',pi:G.human.i,a:{ids:[m.id,esc.id],x:b2.A.x+2,y:b2.A.y+1}});
  escortedHeld=m.mesc===1;
 }
 ok('T25.B pulling a medic out WITH a grunt is still an escorted order',escortedHeld===true);
}

/* ---------- C: escorted behaviour is untouched ---------- */
{
 // the v42 contract: a covered medic holds beside a firing escort under the same order
 const lane441=(r)=>{
  const N=G.map.N;
  for(let ty=4;ty<N-8;ty++)for(let tx=4;tx<N-8;tx++){
   const x=tx+0.5,y=ty+0.5;if(!passableR(x,y,r))continue;
   for(const [ax,ay] of [[1,0],[0,1],[-1,0],[0,-1]]){
    let clear=true;for(let s=1;s<=7;s++){if(!passableR(x+ax*s,y+ay*s,r)){clear=false;break}}
    if(clear)return{x,y,dx:ax,dy:ay};
   }
  }
  return null;
 };
 G=null;newGame(cfg441('backyard','dm','normal','green',1,7042042));
 const probe=makeUnit('medic',G.human,8,8),L=lane441(unitRad(probe));
 let held=null;
 if(L){
  const m=makeUnit('medic',G.human,L.x,L.y);m.mesc=1;
  const dest={x:L.x+L.dx*7,y:L.y+L.dy*7};
  m.path=[{x:dest.x,y:dest.y}];m.wp=0;m.dest=dest;m.state='move';
  const e=makeUnit('grunt',G.human,m.x-L.dx,m.y-L.dy);e.state='attack';e.target={hp:100,kind:'unit'};
  G.units=[m,e];
  const sx=m.x,sy=m.y;
  for(let i=0;i<15;i++)updateUnit(m,DT441);
  held=dhyp(m.x-sx,m.y-sy);
 }
 ok('T25.C an escorted medic still holds beside a firing escort',held!==null&&held<0.05);

 // and the T24 coverage bar still clears on a plain escorted march
 const s=(()=>{
  G=null;newGame(cfg441('kitchen','dm','normal','green',1,9001));
  for(const mn of (G.map.mines||[]))mn.live=false;
  const A=arena441(6,2,18,10);if(!A)return null;
  const gr=[];for(let i=0;i<12;i++)gr.push(makeUnit('grunt',G.human,A.x+(i%6),A.y+((i/6)|0)));
  const m=makeUnit('medic',G.human,A.x,A.y-1);
  execCmd({op:'move',pi:G.human.i,a:{ids:gr.concat([m]).map(u=>u.id),x:A.x+18,y:A.y+1}});
  const cov=[];
  for(let k=1;k<=520;k++){
   update(DT441);
   const live=gr.filter(u=>u.hp>0);if(!live.length||m.hp<=0)break;
   let c=0;for(const u of live)if(dhyp(u.x-m.x,u.y-m.y)<=MEDIC_HEAL_RADIUS+0.5)c++;
   cov.push(c/live.length);
  }
  return cov;
 })();
 const meanCov=s&&s.length?s.reduce((a,b)=>a+b,0)/s.length*100:0;
 ok('T25.C escorted coverage still clears the v44 bar',meanCov>=70);
 ok('T25.C ...and the squad is fully covered at rest',s&&s[s.length-1]*100>=90);
}

/* ---------- D: field hygiene ---------- */
{
 G=null;newGame(cfg441('kitchen','dm','normal','green',1,441601));
 const men=[];for(let i=0;i<4;i++)men.push(makeUnit('grunt',G.human,20+i*0.4,20));
 const m=makeUnit('medic',G.human,19,19);
 execCmd({op:'move',pi:G.human.i,a:{ids:men.concat([m]).map(u=>u.id),x:30,y:30}});
 const h0=hashState();
 m.mesc=m.mesc===1?0:1;
 ok('T25.D the order tag is movement state, never hashed',hashState()===h0);
 m.mesc=1;
 const json=saveState(),snap=JSON.parse(json);
 const tagged=snap.units.filter(u=>u&&'mesc' in u);
 ok('T25.D only medics carry the tag into a snapshot',tagged.length>0&&tagged.every(u=>u.key==='medic'));
 execCmd({op:'move',pi:G.human.i,a:{ids:[m.id],x:24,y:24}});
 const before=JSON.parse(saveState()).units.find(u=>u.key==='medic').mesc;
 loadState(saveState());
 const after=G.units.find(u=>u.t.heal).mesc;
 ok('T25.D the tag round-trips through save/load',before===0&&after===0);

 // a match with no medic in it must snapshot exactly as it did without the field
 G=null;newGame(cfg441('kitchen','dm','normal','green',1,441602));
 const men2=[];for(let i=0;i<5;i++)men2.push(makeUnit('grunt',G.human,20+i*0.4,20));
 execCmd({op:'move',pi:G.human.i,a:{ids:men2.map(u=>u.id),x:30,y:30}});
 for(let i=0;i<60;i++)update(DT441);
 ok('T25.D a medic-free game never mentions the tag at all',saveState().indexOf('mesc')<0);
}

/* ---------- E: an absent tag means escorted (v44 saves, AI and patrol orders) ---------- */
{
 G=null;newGame(cfg441('backyard','dm','normal','green',1,441701));
 const m=makeUnit('medic',G.human,30,30);m.dest={x:40,y:30};m.state='move';
 const g=makeUnit('grunt',G.human,31,30);g.state='move';g.dest={x:40,y:30};
 G.units=[m,g];
 ok('T25.E a medic with no tag still keeps station',!('mesc' in m)&&medicStays(m)===true);
 m.mesc=0;
 ok('T25.E ...and stops the moment it is stamped as hand-driven',medicStays(m)===false);
 ok('T25.E an unescorted medic never re-parks on arrival either',medicSettle(m)===false);
 m.mesc=1;
 ok('T25.E an escorted medic still tracks',medicStays(m)===true);
}

/* ---------- F: AI-only trails, still ---------- */
{
 let bad=[],medicsSeen=0;
 for(const key in BASE45_AI){
  const [map,mode,diff,fac,opp,seed]=key.split(':');
  G=null;newGame(cfg441(map,mode,diff,fac,+opp,+seed));
  execCmd({op:'aiTakeover',pi:G.human.i,a:{diff:'normal'}});
  const t=[];
  for(let i=1;i<=1800;i++){update(DT441);if(i%600===0)t.push(hashState())}
  medicsSeen+=G.units.filter(u=>u.t.heal).length;
  const want=BASE45_AI[key];
  if(!(t.length===want.length&&t.every((h,i)=>h===want[i])))bad.push(key);
 }
 ok('T25.F no medic inside the first 60s (see T24.I; T29 owns the doctrine)',medicsSeen===0);
 ok('T25.F AI-only trails remain byte-identical to the v54 baseline'+(bad.length?' ('+bad.join(', ')+')':''),bad.length===0);
}

/* ---------- G: determinism and snapshots with a hand order in flight ---------- */
{
 const trail441=()=>{
  const b=battle441(9001,12,2);
  if(!b)return null;
  execCmd({op:'move',pi:G.human.i,a:{ids:[b.ms[0].id],x:b.A.x+2,y:b.A.y+1}});
  const t=[];for(let i=1;i<=300;i++){update(DT441);if(i%50===0)t.push(hashState())}
  return t;
 };
 const a=trail441(),b=trail441();
 ok('T25.G a hand-driven medic mid-battle is deterministic (dual run)',!!a&&a.length===6&&a.every((h,i)=>h===b[i]));

 const bt=battle441(9001,12,2);
 if(bt)execCmd({op:'move',pi:G.human.i,a:{ids:[bt.ms[0].id],x:bt.A.x+2,y:bt.A.y+1}});
 for(let i=0;i<120;i++)update(DT441);
 const h0=hashState(),json=saveState();
 const cont=[];for(let i=1;i<=120;i++){update(DT441);if(i%40===0)cont.push(hashState())}
 loadState(json);
 recarve44(); // v66: loadState rebuilt the terrain from the seed; re-impose the fixture's own carve
 ok('T25.G save/load restores the same hash',hashState()===h0);
 const cont2=[];for(let i=1;i<=120;i++){update(DT441);if(i%40===0)cont2.push(hashState())}
 ok('T25.G save/load resumes on the identical trail',cont.every((h,i)=>h===cont2[i]));
 ok('T25.G snapshot tag is v:44.1 or newer',JSON.parse(json).v>=44.1);
}

/* ---------- H: sim-purity lint ---------- */
{
 const BANNED441=['Math.random','Math.hypot','Math.atan2','Math.sin(','Math.cos(','Date.now','performance.now'];
 const dirty=[];
 for(const [n,f] of [['medicOrderTag',medicOrderTag],['medicStays',medicStays],['execCmd',execCmd]]){
  const src=f.toString();for(const b of BANNED441)if(src.includes(b))dirty.push(n+' uses '+b);
 }
 ok('T25.H the order-tag path uses only deterministic math'+(dirty.length?' ('+dirty.join('; ')+')':''),dirty.length===0);
 ok('T25.H the tag is read, not inferred, by both gates',
    medicTrack.toString().includes('u.mesc===0')&&medicSettle.toString().includes('u.mesc===0'));
 ok('T25.H hashState still does not look at the tag',!hashState.toString().includes('mesc'));
}
