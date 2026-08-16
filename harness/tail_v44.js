/* tail_v44.js - T24: medic truck station keeping.
   A: the tunables are internally consistent (bands sit inside the heal reach).
   B: medicAim is pure and returns nothing when the truck has no company.
   C: formation slots - medics take the middle, everyone else keeps the v43 spiral.
   D: a medic actually holds station on a marching squad (coverage, not vibes).
   E: several medics spread instead of stacking, and cover more between them.
   F: the v42 firing-hold contract still holds, and a medic now CLOSES on a
      firefight it was parked outside of.
   G: an idle friendly cluster on the route never pins or drags the truck.
   H: determinism, save/load resume, no new serialized field, settle terminates.
   I: AI-only trails match the pinned baseline. Captured from v43, recut at v45
      (damage rescale) and again at v48 (AI overhaul; the v48 AI DOES field
      medics, just not inside this 60s window - the doctrine itself is T29's).
   J: sim-purity lint over the new functions. */
'use strict';
section('T24 v44: medic station keeping');

/* v73 recut. Two of the four rows moved and both moved only in their THIRD
   sample, i.e. after minute one, which is when a bot has u_gunner. The two
   that did not move never research him inside 1800 ticks. sandbox:koth is the
   only combo in the whole suite that actually FIELDS a Machine Gunner - see
   repin_v73.py for the instrumented counts and for why the four tables that
   passed unedited are blind to a unit-stat edit rather than evidence of one. */
const BASE45_AI={
  'backyard:dm:normal:green:3:441001': [16039194, 4097052946, 1472735481],
  'kitchen:ctf:hard:tan:2:441002': [2488116599, 2034676615, 738541080],
  'sandbox:koth:easy:gray:3:441003': [3594012992, 1937298575, 2269408599],
  'livingroom:dm:hard:blue:3:441004': [3328440066, 3229107213, 135628677],
};
// every key a v43 medic could carry into a snapshot (captured from the v43 build),
// plus 'mesc': the v44.1 order tag, movement-only and deliberately unhashed. It is
// listed here as the conscious decision the field-set lint asks for; T25.D pins its
// hygiene (medics only, never hashed, absent from a medic-free save).
/* v79: calmT joins the baseline. It is on EVERY unit by construction (see the
   v79 note in tail_v43), so a medic carries one too; the check this list feeds
   is about station keeping not growing state of its own, and calmT is not that. */
const BASE44_MKEYS=['$flag','$node','$target','ai','anchor','calmT','cargo','cargoT','coneDir','cool','dest','dm','mesc',
 'entrenched','face','hold','hp','id','key','kind','kl','lastHit','lastProg','mhp','mining','oq','parkAtHQ',
 'parked','path','patrol','pi','rot','sp','state','stuck','tface','upg','vr','wedge','wp','x','y'];

const DT44=1/30;
const COV44=MEDIC_HEAL_RADIUS+0.5;                 // what updateUnit's heal test actually reaches
function cfg44(map,mode,diff,fac,opp,seed){return{map,mode,diff,fac:fac||'green',opp:opp||3,seed}}
const mean44=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const med44=a=>{const b=a.slice().sort((x,y)=>x-y),n=b.length;return n?(n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2):0};

/* A controlled arena: plain passable ground, no hazard field, clear of anybody
   else's units and buildings. Mines are defused by the caller so a stray blast
   cannot turn a coverage measurement into a body count. */
function arenaScan44(W,H,LEN,clr){
 /* v66: neutral BARRICADES are excluded from the clearance set. The clearance is
    here to keep anything that can move, shoot, heal or spawn away from a coverage
    measurement; a hedgehog does none of those, it just blocks tiles, and the
    passableR test above already refuses to run the corridor through one. With ~90
    of them per map a flat 10-tile keep-out left no corridor at all on most seeds,
    which turned every coverage check into a null-arena failure. Wildlife dens stay
    in the set: they DO spawn things that bite. */
 const N=G.map.N,r=0.34,others=[...G.units.filter(u=>u.p!==G.human),...G.blds.filter(b=>!(b.p===G.neutral&&b.t.barr))];
 for(let ty=4;ty<N-4-H;ty++)for(let tx=4;tx<N-4-LEN-W;tx++){
  let ok2=true;
  for(let oy=-1;oy<=H&&ok2;oy++)for(let ox=-1;ox<=W+LEN&&ok2;ox++){
   const px=tx+ox+0.5,py=ty+oy+0.5;
   if(!passableR(px,py,r)||fieldAt(px,py)!==0){ok2=false;break}
   for(const f of others)if(dhyp(f.x-px,f.y-py)<clr){ok2=false;break}
  }
  if(ok2)return{x:tx+0.5,y:ty+0.5};
 }
 return null;
}
/* v66: when the scan finds nothing, CARVE the arena instead of returning null.
   The v66 map rework roughly doubled hazard coverage and took barricades from ~18
   to ~90 tiles, and a 22x5 hazard-free corridor no longer exists on ANY seed of
   ANY map - checked over 40 seeds x 4 maps, zero hits. That is a correct map and a
   fixture that had quietly been relying on open ground.

   These are formation tests: what they need is a controlled strip, not a strip the
   generator happened to leave lying around. So pick the emptiest legal position,
   clear its tiles, drop the hazard fields and dens that overlap it, and put every
   neutral structure inside it through the game's own kill() path so no bookkeeping
   is skipped. Nothing that can move, shoot, heal or spawn is carved away: the
   position is still chosen to stand clear of those by `clr`, and if no position
   can, this returns null and the caller still fails loudly. */
function arenaCarve44(W,H,LEN,clr){
 const N=G.map.N,M=G.map;
 const live=[...G.units.filter(u=>u.p!==G.human),...G.blds.filter(b=>b.p!==G.neutral)];
 /* PAD: the scan window is the strip the caller asked for; a carve can afford to
    be generous, and needs to be. A marching pack spreads past its formation box,
    so a strip cleared to exactly the requested rectangle puts hazards right where
    the flanks end up and the coverage numbers pick that up as a medic failure. */
 const PAD=4,w=W+LEN+2+PAD*2,h=H+2+PAD*2;
 let best=null,bd=-1;
 for(let ty=5;ty<N-5-h;ty++)for(let tx=5;tx<N-5-w;tx++){
  const cx=tx+w/2,cy=ty+h/2;
  let d=1e9;
  for(const f of live)d=Math.min(d,dhyp(f.x-cx,f.y-cy));
  for(const st of M.starts)d=Math.min(d,dhyp(st.x-cx,st.y-cy));
  if(d>bd){bd=d;best={tx,ty}}
 }
 if(!best||bd<clr)return null;
 const x0=best.tx,y0=best.ty,x1=best.tx+w-1,y1=best.ty+h-1;
 const inRect=(x,y)=>x>=x0-1&&x<=x1+1&&y>=y0-1&&y<=y1+1;
 /* Neutral structures go through kill(), which is both the game's own removal path
    AND the only one that survives a snapshot: buildings are restored from the save,
    and a den killed this way comes back dead because ns.dead round-trips by index.
    M.nests and M.fields are deliberately NOT spliced - loadState rebuilds both from
    the seed, so a shortened array would re-index the nest snapshot and corrupt the
    reload. Killing is enough; the arrays keep their shape. */
 for(const b of G.blds.slice())if(b.p===G.neutral&&inRect(b.x,b.y))kill(b);
 CARVE44={x0,y0,x1,y1};
 recarve44();
 // the carve must actually have worked; a silent half-clear would poison the measurement
 const r=0.34;
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(!passableR(x+0.5,y+0.5,r)||fieldAt(x+0.5,y+0.5)!==0)return null;
 return{x:x0+PAD+1.5,y:y0+PAD+1.5};
}
function arena44(W,H,LEN,clr){CARVE44=null;return arenaScan44(W,H,LEN,clr)||arenaCarve44(W,H,LEN,clr)}
/* The tile clearing, on its own and re-appliable. loadState regenerates terrain
   from the seed by design and only the PASS grid rides in the snapshot, so the
   hazard grid a carve cleared comes back on reload. Any fixture that carves and
   then reloads has to re-impose its own scenery; the sim state under test is
   untouched by this, and the carve is a pure function of the map, so re-applying
   it reproduces the same grid exactly. */
let CARVE44=null;
function recarve44(){
 if(!CARVE44)return false;
 const N=G.map.N,M=G.map,{x0,y0,x1,y1}=CARVE44;
 for(let y=y0-1;y<=y1+1;y++)for(let x=x0-1;x<=x1+1;x++){
  if(x<0||y<0||x>=N||y>=N)continue;
  M.pass[y*N+x]=1;M.fld[y*N+x]=0;
 }
 return true;
}
// N grunts in a block, M medics behind them, one group order LEN tiles east.
function squad44(map,seed,N,M,LEN,foes,am){
 G=null;newGame(cfg44(map,'dm','normal','green',1,seed));
 for(const mn of (G.map.mines||[]))mn.live=false;
 const W=6,H=Math.ceil(N/W),A=arena44(W,H,LEN,10);
 if(!A)return null;
 const gr=[],ms=[];
 for(let a=0;a<N;a++)gr.push(makeUnit('grunt',G.human,A.x+(a%W),A.y+Math.floor(a/W)));
 for(let a=0;a<M;a++)ms.push(makeUnit('medic',G.human,A.x+a*0.7,A.y-1));
 const foe=G.players.find(p=>p!==G.human);
 for(let a=0;a<(foes||0);a++)makeUnit('grunt',foe,A.x+LEN-2+(a%2),A.y+Math.floor(a/2));
 execCmd({op:'move',pi:G.human.i,a:{ids:gr.concat(ms).map(u=>u.id),x:A.x+LEN,y:A.y+1,am:am?1:0}});
 return {gr,ms,A};
}
function metrics44(s,ticks){
 const cov=[],dist=[],sep=[];
 for(let k=1;k<=ticks;k++){
  update(DT44);
  const live=s.gr.filter(u=>u.hp>0),lm=s.ms.filter(u=>u.hp>0);
  if(!live.length||!lm.length)break;
  let cx=0,cy=0;for(const u of live){cx+=u.x;cy+=u.y}cx/=live.length;cy/=live.length;
  for(const m of lm)dist.push(dhyp(m.x-cx,m.y-cy));
  let c=0;for(const u of live)if(lm.some(m=>dhyp(u.x-m.x,u.y-m.y)<=COV44))c++;
  cov.push(c/live.length);
  if(lm.length>1){let mn=1e9;for(let i=0;i<lm.length;i++)for(let j=i+1;j<lm.length;j++)mn=Math.min(mn,dhyp(lm[i].x-lm[j].x,lm[i].y-lm[j].y));sep.push(mn)}
 }
 return {meanCov:mean44(cov)*100,endCov:(cov[cov.length-1]||0)*100,medD:med44(dist),
         endSep:sep.length?sep[sep.length-1]:null,idle:s.ms.every(m=>m.state==='idle')};
}

/* ---------- A: tunables ---------- */
{
 ok('T24.A the covered test sits inside the heal reach',MEDIC_COVER<COV44&&MEDIC_COVER>MEDIC_HEAL_RADIUS);
 ok('T24.A dead band is inside the covered test',MEDIC_BAND<MEDIC_COVER);
 ok('T24.A direct steering never reaches past the leash',MEDIC_STEER_MAX<=MEDIC_LEASH);
 ok('T24.A the wait radius is wider than the aim leash',MEDIC_WAIT_R>MEDIC_LEASH);
 ok('T24.A separation is a nudge, not a shove',MEDIC_SEP*MEDIC_SEP_K<MEDIC_LEASH/2);
 ok('T24.A catch-up is a small allowance',MEDIC_CATCHUP>1&&MEDIC_CATCHUP<=1.35);
 ok('T24.A repath cadence is a whole number of ticks',MEDIC_REPATH>0&&MEDIC_REPATH===(MEDIC_REPATH|0));
}

/* ---------- B: medicAim purity ---------- */
{
 G=null;newGame(cfg44('backyard','dm','normal','green',1,441201));
 const m=makeUnit('medic',G.human,30,30);m.dest={x:40,y:30};m.state='move';
 const g=makeUnit('grunt',G.human,31,30);g.state='move';g.dest={x:40,y:30};
 const h0=hashState();medicAim(m,false);medicAim(m,true);medicWaitsFor(m);
 ok('T24.B medicAim / medicWaitsFor never touch sim state',hashState()===h0);
 const a=medicAim(m,false);
 ok('T24.B a marching escort under the same order is company',!!a&&a.n===1);
 G.units=[m];
 ok('T24.B no company means no aim',medicAim(m,false)===null);
 G.units=[m,g];g.state='idle';
 ok('T24.B an idle bystander is not company in transit',medicAim(m,false)===null);
 ok('T24.B ...but it counts for the arrival settle',!!medicAim(m,true));
}

/* ---------- C: formation slots ---------- */
{
 G=null;newGame(cfg44('kitchen','dm','normal','green',1,441301));
 const men=[];for(let i=0;i<7;i++)men.push(makeUnit('grunt',G.human,20+i*0.4,20));
 execCmd({op:'move',pi:G.human.i,a:{ids:men.map(u=>u.id),x:34,y:34}});
 let same=true;
 men.forEach((u,i)=>{
  const ang=i*2.39996,r=.5*Math.sqrt(i);
  const px=clamp(34+dcos(ang)*r,1,G.map.N-2),py=clamp(34+dsin(ang)*r,1,G.map.N-2);
  if(dhyp(u.dest.x-px,u.dest.y-py)>1e-12)same=false;
 });
 ok('T24.C an order with no medic hands out the exact v43 spiral slots',same);

 G=null;newGame(cfg44('kitchen','dm','normal','green',1,441302));
 const men2=[],med1=makeUnit('medic',G.human,19,19);
 for(let i=0;i<7;i++)men2.push(makeUnit('grunt',G.human,20+i*0.4,20));
 execCmd({op:'move',pi:G.human.i,a:{ids:[med1].concat(men2).map(u=>u.id),x:34,y:34}});
 ok('T24.C the lone medic is given the centre of the formation',dhyp(med1.dest.x-34,med1.dest.y-34)<1e-12);
 let stillSpiral=true;
 men2.forEach((u,i)=>{
  const ang=i*2.39996,r=.5*Math.sqrt(i);
  if(dhyp(u.dest.x-(34+dcos(ang)*r),u.dest.y-(34+dsin(ang)*r))>1e-12)stillSpiral=false;
 });
 ok('T24.C pulling the medic out does not shift anybody else',stillSpiral);

 G=null;newGame(cfg44('kitchen','dm','normal','green',1,441303));
 const meds3=[],men3=[];
 for(let i=0;i<3;i++)meds3.push(makeUnit('medic',G.human,19+i*0.5,19));
 for(let i=0;i<18;i++)men3.push(makeUnit('grunt',G.human,20+(i%6)*0.4,20+((i/6)|0)*0.4));
 execCmd({op:'move',pi:G.human.i,a:{ids:meds3.concat(men3).map(u=>u.id),x:34,y:34}});
 const rr3=meds3.map(m=>dhyp(m.dest.x-34,m.dest.y-34));
 let ringOK=rr3.every(r=>r>0.3&&Math.abs(r-rr3[0])<1e-9),apart=true;
 for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(dhyp(meds3[i].dest.x-meds3[j].dest.x,meds3[i].dest.y-meds3[j].dest.y)<0.5)apart=false;
 ok('T24.C three medics land on one ring around the centre',ringOK);
 ok('T24.C ...and on distinct slots',apart);
}

/* ---------- D: one medic actually keeps station ---------- */
{
 const s1=squad44('kitchen',9001,12,1,18,0,0);
 const r1=s1?metrics44(s1,520):null;
 ok('T24.D 12-strong march: most of the squad is inside the aura',!!r1&&r1.meanCov>=70);
 ok('T24.D 12-strong march: the whole squad is covered at rest',!!r1&&r1.endCov>=90);
 ok('T24.D 12-strong march: the truck rides in the pack, not behind it',!!r1&&r1.medD<=1.2);

 const s2=squad44('kitchen',9003,24,1,18,0,0);
 const r2=s2?metrics44(s2,520):null;
 ok('T24.D 24-strong march: coverage holds up on a bigger pack',!!r2&&r2.meanCov>=65);
 ok('T24.D 24-strong march: covered at rest',!!r2&&r2.endCov>=90);

 const s3=squad44('kitchen',9001,12,1,18,6,1);
 const r3=s3?metrics44(s3,900):null;
 ok('T24.D attack-move into a fight: the medic covers the firing line',!!r3&&r3.meanCov>=75);
}

/* ---------- E: several medics spread ---------- */
{
 const s1=squad44('kitchen',9003,24,2,18,0,0);
 const r1=s1?metrics44(s1,520):null;
 ok('T24.E two medics on 24: coverage beats the single-truck bar',!!r1&&r1.meanCov>=75);
 ok('T24.E two medics end up apart, not stacked',!!r1&&r1.endSep>=0.4);
 ok('T24.E ...but still inside one pack',!!r1&&r1.endSep<=MEDIC_SEP+1);

 const s2=squad44('kitchen',9003,18,3,18,8,1);
 const r2=s2?metrics44(s2,900):null;
 ok('T24.E three medics in a fight cover nearly everyone',!!r2&&r2.meanCov>=80);
 ok('T24.E three medics: every survivor covered at rest',!!r2&&r2.endCov>=90);
 ok('T24.E three medics never pile onto one spot',!!r2&&r2.endSep>=0.4);
}

/* ---------- F: firing contract ---------- */
{
 // v42's contract: an escort that stops to shoot stops the truck with it. The probe
 // puts the escort one tile away, i.e. already inside the aura, so there is nothing
 // to correct and the truck must not roll.
 const lane44=(r)=>{
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
 G=null;newGame(cfg44('backyard','dm','normal','green',1,7042042));
 const probe=makeUnit('medic',G.human,8,8),r=unitRad(probe),L=lane44(r);
 let held=null,closed=null;
 if(L){
  const m=makeUnit('medic',G.human,L.x,L.y);
  const dest={x:L.x+L.dx*7,y:L.y+L.dy*7};
  m.path=[{x:dest.x,y:dest.y}];m.wp=0;m.dest=dest;m.state='move';
  const e=makeUnit('grunt',G.human,m.x-L.dx,m.y-L.dy);e.state='attack';e.target={hp:100,kind:'unit'};
  G.units=[m,e];
  const sx=m.x,sy=m.y;
  for(let i=0;i<15;i++)updateUnit(m,DT44);
  held=dhyp(m.x-sx,m.y-sy);
 }
 ok('T24.F a covered medic still holds beside a firing escort',held!==null&&held<0.05);

 G=null;newGame(cfg44('backyard','dm','normal','green',1,7042042));
 const probe2=makeUnit('medic',G.human,8,8),L2=lane44(unitRad(probe2));
 if(L2){
  const m=makeUnit('medic',G.human,L2.x,L2.y);
  const dest={x:L2.x+L2.dx*7,y:L2.y+L2.dy*7};
  m.path=[{x:dest.x,y:dest.y}];m.wp=0;m.dest=dest;m.state='move';
  const e=makeUnit('grunt',G.human,m.x+L2.dx*4,m.y+L2.dy*4);e.state='attack';e.target={hp:100,kind:'unit'};
  G.units=[m,e];
  for(let i=0;i<120;i++)updateUnit(m,DT44);
  closed=dhyp(m.x-e.x,m.y-e.y);
 }
 ok('T24.F a medic parked outside a firefight closes into heal range',closed!==null&&closed<=MEDIC_COVER+0.2);
}

/* ---------- G: no drag, no pin ---------- */
{
 G=null;newGame(cfg44('kitchen','dm','normal','green',1,9001));
 for(const mn of (G.map.mines||[]))mn.live=false;
 const A=arena44(6,3,18,10);
 let arrived=false,ticks=0;
 if(A){
  const m=makeUnit('medic',G.human,A.x,A.y+1);
  for(let i=0;i<6;i++){const g=makeUnit('grunt',G.human,A.x+9+(i%3)*0.5,A.y+((i/3)|0)*0.5);g.state='idle'}
  execCmd({op:'move',pi:G.human.i,a:{ids:[m.id],x:A.x+18,y:A.y+1}});
  for(let k=1;k<=900;k++){update(DT44);ticks=k;if(dhyp(m.x-m.dest.x,m.y-m.dest.y)<1.0){arrived=true;break}}
 }
 ok('T24.G a lone medic routed past an idle cluster still reaches its destination',arrived);
 ok('T24.G ...without being dragged into a detour',arrived&&ticks<900);
}

/* ---------- H: determinism, snapshots, termination ---------- */
{
 const trail44=(seed)=>{
  const s=squad44('kitchen',seed,12,2,18,0,0);
  const t=[];for(let i=1;i<=300;i++){update(DT44);if(i%50===0)t.push(hashState())}
  return t;
 };
 const a=trail44(9001),b=trail44(9001);
 ok('T24.H a tracked medic group move is deterministic (dual run)',a.length===6&&a.every((h,i)=>h===b[i]));

 const s=squad44('kitchen',9001,12,2,18,0,0);
 for(let i=0;i<200;i++)update(DT44);
 const h0=hashState(),json=saveState();
 const cont=[];for(let i=1;i<=150;i++){update(DT44);if(i%50===0)cont.push(hashState())}
 loadState(json);
 recarve44(); // v66: loadState rebuilt the terrain from the seed; re-impose the fixture's own carve
 ok('T24.H save/load restores the same hash',hashState()===h0);
 const cont2=[];for(let i=1;i<=150;i++){update(DT44);if(i%50===0)cont2.push(hashState())}
 ok('T24.H save/load resumes on the identical trail',cont.every((h,i)=>h===cont2[i]));
 const snap=JSON.parse(json);
 ok('T24.H snapshot tag is v:44 or newer',snap.v>=44);
 const mu=snap.units.filter(u=>u&&u.key==='medic');
 const extra=[];for(const u of mu)for(const k in u)if(!BASE44_MKEYS.includes(k)&&!extra.includes(k))extra.push(k);
 ok('T24.H station keeping adds no serialized field'+(extra.length?' ('+extra.join(',')+')':''),mu.length>0&&extra.length===0);

 // the arrival re-park must converge: no medic may still be shuffling at the end
 const s2=squad44('kitchen',9001,12,2,18,0,0);
 const r2=metrics44(s2,520);
 ok('T24.H every medic settles into idle after the squad stops',r2.idle);
}

/* ---------- I: AI-only trails are untouched ---------- */
{
 let medicsSeen=0,bad=[];
 for(const key in BASE45_AI){
  const [map,mode,diff,fac,opp,seed]=key.split(':');
  G=null;newGame(cfg44(map,mode,diff,fac,+opp,+seed));
  execCmd({op:'aiTakeover',pi:G.human.i,a:{diff:'normal'}});
  const t=[];
  for(let i=1;i<=1800;i++){update(DT44);if(i%600===0)t.push(hashState())}
  medicsSeen+=G.units.filter(u=>u.t.heal).length;
  const want=BASE45_AI[key];
  if(!(t.length===want.length&&t.every((h,i)=>h===want[i])))bad.push(key);
 }
 ok('T24.I no medic inside the first 60s (fielding is gated on tech + the 1-per-8 ratio; T29 owns the doctrine)',medicsSeen===0);
 ok('T24.I AI-only trails are byte-identical to the v54 baseline'+(bad.length?' ('+bad.join(', ')+')':''),bad.length===0);
}

/* ---------- J: sim-purity lint ---------- */
{
 const BANNED44=['Math.random','Math.hypot','Math.atan2','Math.sin(','Math.cos(','Date.now','performance.now'];
 const PURE44=[['medicAim',medicAim],['medicStep',medicStep],['medicTrack',medicTrack],['medicSettle',medicSettle],
  ['medicWaitsFor',medicWaitsFor],['medicRepath',medicRepath],['medicHold',medicHold],['execCmd',execCmd],['updateUnit',updateUnit]];
 const dirty=[];
 for(const [n,f] of PURE44){const src=f.toString();for(const b of BANNED44)if(src.includes(b))dirty.push(n+' uses '+b)}
 ok(`T24.J ${PURE44.length} medic/command functions use only deterministic math`+(dirty.length?' ('+dirty.join('; ')+')':''),dirty.length===0);
 ok('T24.J medic distance math goes through dhyp',medicAim.toString().includes('dhyp(')&&medicTrack.toString().includes('dhyp('));
 ok('T24.J the repath cadence is keyed on the tick, not the clock',medicRepath.toString().includes('G.tick%MEDIC_REPATH'));
}
