/* ---------------- ORDERS ---------------- */
function orderMove(u,x,y,amove){
 if(u.t.assault&&u.aslt)return; // v82: Air Assault pins the aircraft. ONE door, so a player order, an AI order, a rally hop and a retaliation march are all refused together
 if(u.t.bcast&&u.bcast)return;  // v86: ...and Broadcast pins the Command Truck, at the same door and for the same reason
 if(u.entrenched){u.entrenched=false;lastSelSig='';}
 if(u.t.fly){u.path=[{x,y}];u.wp=0}
 else {u.path=findPath(u.x,u.y,x,y,u.key==='truck',unitRad(u));u.wp=0}
 u.state=amove?'amove':'move';u.target=null;u.node=null;u.dest={x,y};u.stuck=0;u.mining=false;u.parkAtHQ=false;
}
function orderAttack(u,tgt){
 if(!u.t.dm){orderMove(u,tgt.x,tgt.y,false);if(u.p.human&&u.t.a==='truck')u.parked=true;return}
 if(hid81(tgt,u.p))return; // v81: nobody can be ordered onto a man nothing has seen - player order, AI order, retaliation and the help sweep all arrive here
 if(u.t.flat&&u.flat)return; // v82: ...and a bike running flat out takes no attack order from any of those four either
 if(sprintOn(u))return; // v85: ...nor does anyone inside a Sprint. Same door for the same reason: the ability's whole price is that the men under it may not shoot, and an order that set u.target anyway would leave them standing in the attack state until the next tick dropped it again
 if(!mainOk(u,tgt))return; // v51/v52: a main weapon ignores a target it does not own outright. The PLAYER path in execCmd substitutes an attack-move; retaliation and AI orders must NOT drive the unit at its attacker
 u.target=tgt;u.state='attack';u.path=null;u.stuck=0;u.mining=false;u.parkAtHQ=false;
}
function orderHarvest(u,node){
 // only the dump truck harvests; medic trucks (heal) and combat units just move there
 if(u.t.a!=='truck'||u.t.heal)return orderMove(u,node.x,node.y,false);
 u.node=node;u.parkAtHQ=false;u.parked=false;u.stuck=0;
 u.state=u.cargo>=cargoCap(u.cargoT)?'return':'togo'; // v61: per-resource cap
 if(u.state==='togo'){truckToNode(u,node)}else u.path=null;
}
// force selected/own trucks to drop off whatever they're carrying at the nearest HQ
function orderDropoff(u){
 if(u.t.a!=='truck')return;
 u.mining=false;u.state='return';u.path=null;u.parkAtHQ=true;u.parked=false; // unload, then resume mining
}

/* ---------------- TEAM / ORDER QUEUE / PATROL / HOLD / VETERANCY / SELL HELPERS ---------------- */
// are two owners on the same side? (identity or matching team number). The neutral
// wildlife owner carries team -1 and never matches a real player's 1-4.
function allied(a,b){return !!(a&&b&&(a===b||(a.team!=null&&a.team===b.team)));}
// does the match have at least two players sharing a team?
function matchTeamed(){return new Set(G.players.map(p=>p.team)).size<G.players.length;}
// grouped score readout for the topbar in team matches (teams with no survivor drop off)
function teamScoreText(get,target){
 const ts={},alive={};
 for(const p of G.players){ts[p.team]=(ts[p.team]||0)+get(p);alive[p.team]=alive[p.team]||p.alive;}
 return Object.keys(ts).filter(t=>alive[t]).sort((a,b)=>a-b).map(t=>`T${t} ${Math.floor(ts[t])}/${target}`).join('  •  ');
}
// a unit with any standing plan (current order, queue, patrol, or hold)
function uBusy(u){return u.hold||u.patrol!=null||(u.oq&&u.oq.length>0)||u.state!=='idle';}
// wipe queued/patrol plans; hard also releases hold-position (every direct order does)
function clearPlans(u,hard){u.oq=[];u.patrol=null;if(hard)u.hold=false;}
// append to a unit's order queue (cap 8). Queuing replaces an endless patrol:
// the unit finishes its current leg, then runs the queue.
function qPush(u,o){u.patrol=null;if(!u.oq)u.oq=[];if(u.oq.length<8)u.oq.push(o);}
// run the next queued order; stale targets / mined-out nodes skip to the next entry.
// Queue entries hold PRIMITIVES only (ids & node indices) so snapshots stay trivial.
function popOrder(u){
 const o=u.oq.shift();
 if(!o)return;
 if(o.op==='move'){orderMove(u,o.x,o.y,!!o.am);if(u.t.a==='truck')u.parked=true;return;}
 if(o.op==='attack'){const t=entById(o.tid);if(t&&t.hp>0&&t.p&&!allied(t.p,u.p))orderAttack(u,t);else if(u.oq.length)popOrder(u);return;}
 if(o.op==='harvest'){const n=(o.nx!=null)?G.map.nodes.find(m=>m.x===o.nx&&m.y===o.ny):G.map.nodes[o.ni];if(n&&n.amt>0)u.t.a==='truck'?orderHarvest(u,n):orderMove(u,n.x,n.y,false);else if(u.oq.length)popOrder(u);return;} // v30.1: indices shift when removeNode splices - resolve by position (node x/y are immutable; exact float copies, so === is safe); o.ni stays as the pre-v30.1 save fallback
 if(o.op==='dropoff'){if(u.t.a==='truck')orderDropoff(u);else if(u.oq.length)popOrder(u);return;}
}
// send a patrolling unit down its next leg (leg=1 means B is next, else A)
function patrolNext(u){
 const pt=u.patrol;if(!pt)return;
 if(pt.leg===1){orderMove(u,pt.bx,pt.by,true);pt.leg=0;}
 else{orderMove(u,pt.ax,pt.ay,true);pt.leg=1;}
}
/* v75 VETERANCY LADDER. Credit is unchanged: +1 on the killing blow, u.kl stays
   an integer, u.vr stays a rank 0-3, and both were already hashed and serialized,
   so neither changes shape and a v74 save still loads. What moved is the rungs.
   A flat 3/6/12 was unreachable at the measured pace (median combat-unit lifespan
   23.3s, median kills 0, 99.6% of units ending at rank 0, ranks 2 and 3 never
   reached at all), so the ladder is now per class: infantry promote on 1/2/4
   because they are cheap, numerous and take most of the kills, and everything
   else on 2/4/8 because a promoted tank should stay an event.
   Two frozen arrays, selected on the unit TYPE's armor class. No RNG, no clock,
   nothing stored on the unit that was not stored before. */
const VET_INF=[1,2,4], VET_VEH=[2,4,8];
/* v86 THE COMMAND POST'S AURA. "Gains veterancy faster" is spent on the LADDER
   and not on the credit, and the reason is worth stating because the obvious
   implementation is the wrong one. u.kl is a count of kills, it is hashed through
   hI, and hI does v|=0 - so crediting 1.5 kills for one under the aura would
   advance the serialized state and NOT advance the hash, which is a lockstep
   divergence with no symptom at all until two clients disagree about a promotion.
   A cheaper ladder keeps kl an integer, needs no new state anywhere, and says the
   same thing: inside the radius a rank costs CPOST_VET of the usual kills.
   Derived per rung rather than typed as a second pair of arrays, so re-tuning
   VET_INF or VET_VEH cannot leave a stale copy behind; Math.max(1,...) keeps the
   first rung reachable at any multiplier. Read off the POST at the point of use,
   like every other aura in the file, and asked only on a kill - vetRankUp is the
   one caller and it runs once per death, not once per tick. */
function vetSteps(u){
 const base=(u&&u.t&&u.t.a==='inf')?VET_INF:VET_VEH;
 if(!cpostOn(u))return base;
 return base.map(v=>Math.max(1,Math.ceil(v*CPOST_VET)));
}
// ranks grant +10% damage & max HP per rank (the HP delta lands immediately).
// The factor is computed rank-to-rank so repeat promotions and save/load stay
// path-independent.
function vetRankUp(u){
 u.kl=(u.kl||0)+1;
 const st=vetSteps(u);
 const r=u.kl>=st[2]?3:u.kl>=st[1]?2:u.kl>=st[0]?1:0;
 if(r<=(u.vr||0))return;
 const f=(1+0.1*r)/(1+0.1*(u.vr||0));
 u.vr=r;u.dm*=f;
 const nm=Math.round(u.mhp*f);
 u.hp=Math.min(nm,u.hp+(nm-u.mhp));u.mhp=nm;
 if(u.p===G.human)msg(`⭐ ${u.t.n} promoted to rank ${r}!`);
}
// sell a completed structure: queued units refund in full, a mid-research project
// returns to the pool, the garrison pops out unharmed, then SELL_FRAC of the plastic
// cost comes back. No salvage wreck (that would double-dip with the refund).
function sellBuilding(b){
 const p=b.p;
 if(b.queue)for(const k of b.queue){const c=ucost(p,k);p.res.p+=c.p;p.res.e+=c.e;}
 b.queue=[];b.prodT=0;
 if(b.techCur){const qi=p.techQ.indexOf(b.techCur);if(qi>=0)p.techQ.splice(qi,1);b.techCur=null;}
 p.res.p+=Math.round(bcost(p,b.key).p*SELL_FRAC);
 for(const u of (b.garrison||[])){u.garrisoned=false;const sp2=spawnSpot(b);u.x=sp2.x+srand()-.5;u.y=sp2.y+srand()-.5;}
 b.garrison=[];
 G.blds.splice(G.blds.indexOf(b),1);const bi=p.blds.indexOf(b);if(bi>=0)p.blds.splice(bi,1);
 b.hp=0;
 for(let y=0;y<b.sz;y++)for(let x=0;x<b.sz;x++)G.map.pass[(b.ty+y)*G.map.N+(b.tx+x)]=1;
 pfDirty();
 /* --- WHAT SELLING LOOKS LIKE, ADDED AT v87.1 ---
    A sold building used to leave a puff of dust and four flecks of plastic, so
    a structure the player deliberately removed simply blinked out. It gets the
    same teardown a destroyed one does - melt, scorch, shrapnel, the primary
    blast and its staggered cook-offs, the smoke column and the shake - plus the
    heap of plastic it leaves behind.
    Two deliberate differences from kill(). The heap is a stampPile DECAL and not
    a spawnWreck node, because the refund already paid for this building and a
    mineable pile would pay twice. And every offset below is Math.random, never
    srand(): selling runs inside the simulation, so drawing even one seeded
    number here would move the shared RNG stream and desync a live match. */
 const scol=FAC[p.fac].color;
 stampMelt(b.x,b.y,scol,14+b.sz*5);stampScorch(b.x,b.y,b.sz*14);
 stampPile(b.x,b.y,shade(scol,.78),6+b.sz*3);
 spawnShrapnel(b.x,b.y,scol,26,2.2);
 spawnExplosion(b.x,b.y,1.8+b.sz*.2);
 for(let s=0;s<2+b.sz;s++){const ox=(Math.random()-.5)*b.sz,oy=(Math.random()-.5)*b.sz,dl=.06+s*.07;
  setTimeout2(()=>{if(G)spawnExplosion(b.x+ox,b.y+oy,.8+Math.random()*.5)},dl);}
 spawnSmoke(b.x,b.y,6+b.sz*2,{rise:10,grow:8,life:2.8+b.sz*.3,r:5,col:'#2e2e2e'});
 spawnDust(b.x,b.y,1);shakeAt(b.x,b.y,7);sfxBuildingDestroy(b.x,b.y);
 if(G.sel.includes(b))G.sel.splice(G.sel.indexOf(b),1);
 if(p===G.human){msg(`${b.t.n} sold (+⬢${Math.round(bcost(p,b.key).p*SELL_FRAC)}).`);updateTopbar();}
 lastSelSig='';
 checkElim(p);
}
// stat history: sampled every statHist.iv ticks into per-player rows; past 720
// samples the arrays halve and the interval doubles, so hour-long games stay bounded
function statSample(){
 const Hs=G.statHist;if(!Hs)return;
 Hs.t.push(+(G.tick/30).toFixed(1));
 G.players.forEach((p,i)=>{
  let av=0;for(const u of p.units)av+=U[u.key].cp+U[u.key].ce;
  const r=Hs.rows[i];r.av.push(av);r.kl.push(p.stats.kills);r.mn.push(Math.round(p.stats.mined||0));
 });
 if(Hs.t.length>720){
  const dec=a=>a.filter((_,j)=>j%2===0);
  Hs.t=dec(Hs.t);
  for(const r of Hs.rows){r.av=dec(r.av);r.kl=dec(r.kl);r.mn=dec(r.mn);}
  Hs.iv*=2;
 }
}

/* ---------------- PARATROOPER MUNITIONS + APC HELPERS ---------------- */
// The paratrooper swaps munitions with its current target class. k multiplies the
// unit's (faction/vet-modified) SMG damage so upgrades keep riding along; gsp is
// the grenade lob speed (the HE charge is thrown slowly).
const PARA_MUN={
 // v45: wc is the COUNTER class, w stays the FX/projectile class. One unit key,
 // three rows of the matrix, so all three munitions keep a bonus of their own.
 smg:{k:1,rt:.35,rg:3.8,w:'b',wc:'b',spl:0,gsp:9},      // x1.30 vs infantry (UVA.para, guarded to w:'b')
 at:{k:2.75,rt:2.2,rg:3.6,w:'g',wc:'r',spl:.625,gsp:7},   // ~22 effective dmg; row r: x1.35 medium / x1.50 heavy / x1.30 air
 he:{k:7.5,rt:4.5,rg:3.2,w:'g',wc:'d',spl:1.5,gsp:4.5}  // ~60 effective dmg, slow throw; row d: x1.25 vs structures
};
function paraMun(tgt){
 if(!tgt)return PARA_MUN.smg;
 if(tgt.kind==='bld')return PARA_MUN.he;
 if(tgt.kind==='unit'&&tgt.t&&tgt.t.a!=='inf')return PARA_MUN.at;
 return PARA_MUN.smg;
}
// eject every APC occupant onto nearby ground; frac (if given) scales their
// remaining HP - a destroyed APC's squad bails out keeping 85%.
/* v46: UI-side test for "is there anywhere to put them". apcUnload itself always
   places a passenger (widened ring, then a clamped fallback), so this changes no
   command path and no sim state - it only lets the panel and the U key refuse an
   unload over open water instead of dumping the squad somewhere useless. */
function dropOk(c){
 const R=c.t.fly?8:4,bx=Math.floor(c.x),by=Math.floor(c.y);
 for(let r=0;r<=R;r++)for(let oy=-r;oy<=r;oy++)for(let ox=-r;ox<=r;ox++)
  if(passableR(bx+ox+.5,by+oy+.5,.26))return true;
 return false;
}
function apcUnload(c,frac){
 let i=0;
 for(const u of (c.garrison||[])){
  u.garrisoned=false;u.fo=false; // v82: a man on the ground is not firing out of anything
  if(frac)u.hp=Math.max(1,u.hp*frac);
  const a=i*2.39996,r=.9+.4*Math.sqrt(i);i++;
  let lx=clamp(c.x+dcos(a)*r,2,G.map.N-3),ly=clamp(c.y+dsin(a)*r,2,G.map.N-3);
  if(!passableR(lx,ly,unitRad(u))){
   outer:for(let rr2=1;rr2<=(c.t.fly?8:4);rr2++)for(let oy=-rr2;oy<=rr2;oy++)for(let ox=-rr2;ox<=rr2;ox++){ // v46: a flying carrier can be over water, so it searches wider
    const nx=Math.floor(c.x)+ox+.5,ny=Math.floor(c.y)+oy+.5;
    if(passableR(nx,ny,unitRad(u))){lx=nx;ly=ny;break outer;}
   }
  }
  u.x=lx;u.y=ly;u.state='idle';u.anchor={x:u.x,y:u.y};u.path=null;u.target=null;
  spawnDust(u.x,u.y,.5);
 }
 c.garrison=[];
}
