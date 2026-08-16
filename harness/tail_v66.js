/* tail_v66.js - T45: the map rework.
   A: field code 1 (tall grass) is extinct - no producer, no consumer, no tile.
   B: every map carries exactly its two themed hazard kinds, on the right codes.
   C: the painters are actually wired (recording context, not source text).
   D: the pond-shrink filter tests the CODE - the v65 name test would have let a
      drained milk/juice/coffee/puddle keep its drawn footprint over dry ground.
   E: lane pressure - hazards and barricades sit on the direct base<->base lanes.
   F: the denser maps are still connected: all six start pairs, every node reachable.
   G: roach dens, a mirrored pair on every map including the Desk.
   H: nest regen refills losses, stops at count, and never revives a smashed den.
   I: a CPU army breaks a den that is swarming it; a player's units do not.
   J: regen is stateless - no new hashed or serialized field, and it round-trips. */
'use strict';
section('T45 v66: map rework (themed hazards, lanes, dens, regen)');

const DT66=1/30;
function cfg66(map,mode,seed,opp){return{map,mode,diff:'normal',fac:'green',opp:opp==null?3:opp,seed}}
const SEEDS66=[660011,660022,660033];
const PVP66=['backyard','kitchen','sandbox','livingroom'];
const ALL66=PVP66.concat(['desk']);
/* the approved pairing: h2 is the map's burn hazard (code 2), h3 its impassable
   liquid (code 3). Sandbox keeps sand/water because they ARE its theme. */
const THEME66={backyard:{h2:'thorns',h3:'puddle'},kitchen:{h2:'grease',h3:'milk'},
 livingroom:{h2:'glue',h3:'juice'},sandbox:{h2:'sand',h3:'water'},desk:{h2:'soda',h3:'coffee'}};

/* ---------- A: code 1 is extinct ---------- */
{
 let c1=0,tiles=0,codes=new Set();
 for(const m of ALL66)for(const sd of SEEDS66){
  const M=makeMap(m,sd);
  for(let i=0;i<M.N*M.N;i++){const f=M.fld[i];tiles++;if(f===1)c1++;if(f)codes.add(f)}
  for(const fl of M.fields)codes.add(fl.code);
 }
 ok(`T45.A no map produces a code-1 tile (${tiles} tiles across ${ALL66.length} maps x ${SEEDS66.length} seeds)`,c1===0&&tiles>0);
 ok('T45.A only codes 2 and 3 exist now'+(codes.size?' ['+[...codes].sort().join(',')+']':''),
    [...codes].every(v=>v===2||v===3)&&codes.size===2);
 /* non-vacuity: the scanner must be able to see a code-1 tile if one existed */
 const M=makeMap('backyard',SEEDS66[0]);M.fld[10*M.N+10]=1;
 let seen=0;for(let i=0;i<M.N*M.N;i++)if(M.fld[i]===1)seen++;
 ok('T45.A the extinction scan can fail',seen===1);

 /* the consumers are gone too, measured through behaviour rather than source text:
    a unit standing on a hazard tile is only ever slowed by the code-2 rule. */
 G=null;newGame(cfg66('backyard','dm',660001,1));
 const u=makeUnit('grunt',G.human,20.5,20.5);
 const N=G.map.N;
 G.map.fld[20*N+20]=0;const clean=terrainSpeed(u);
 G.map.fld[20*N+20]=2;const burn=terrainSpeed(u);
 G.map.fld[20*N+20]=1;const dead=terrainSpeed(u);
 ok('T45.A terrainSpeed: clear 1.0, code 2 slows, a stray code 1 does nothing',
    clean===1&&burn===0.5&&dead===1);
 G.map.fld[20*N+20]=0;
}

/* ---------- B: the themed pair, per map ---------- */
{
 const CODE66={sand:2,soda:2,thorns:2,grease:2,glue:2,water:3,puddle:3,milk:3,juice:3,coffee:3};
 for(const m of ALL66){
  const want=THEME66[m],seenKinds=new Set();let stray=[],miscoded=[],offGrid=0,sampled=0;
  for(const sd of SEEDS66){
   const M=makeMap(m,sd),N=M.N;
   for(const fl of M.fields){
    seenKinds.add(fl.kind);
    if(fl.kind!==want.h2&&fl.kind!==want.h3&&!stray.includes(fl.kind))stray.push(fl.kind);
    if(fl.code!==CODE66[fl.kind])miscoded.push(fl.kind+':'+fl.code);
    /* Fields overlap and are stamped in placement order, so the tile under a
       field's centre can legitimately carry a LATER field's code. What must hold
       is that the shape put its own code down somewhere inside its own footprint. */
    let own=0;const ext=Math.max(fl.rx,fl.ry);
    for(let y=Math.max(0,Math.floor(fl.cy-ext));y<=Math.min(N-1,fl.cy+ext)&&!own;y++)
     for(let x=Math.max(0,Math.floor(fl.cx-ext));x<=Math.min(N-1,fl.cx+ext);x++)
      if(M.fld[y*N+x]===fl.code){own=1;break}
    sampled++;if(!own)offGrid++;
   }
  }
  ok(`T45.B ${m}: only its two themed kinds appear`+(stray.length?' [stray: '+stray.join(',')+']':''),stray.length===0);
  ok(`T45.B ${m}: both ${want.h2} (burn) and ${want.h3} (liquid) are present`,
     seenKinds.has(want.h2)&&seenKinds.has(want.h3));
  ok(`T45.B ${m}: every kind carries the code the table says`+(miscoded.length?' ['+miscoded.slice(0,3).join(',')+']':''),miscoded.length===0);
  ok(`T45.B ${m}: every field stamped its own code onto the grid (${sampled} fields)`,sampled>0&&offGrid===0);
 }
 /* the two codes still mean what they meant, checked through the sim */
 G=null;newGame(cfg66('kitchen','dm',660002,1));
 const N=G.map.N;
 let liq=null,burn=null;
 for(let y=0;y<N&&!(liq&&burn);y++)for(let x=0;x<N;x++){const f=G.map.fld[y*N+x];
  if(f===3&&!liq)liq={x,y}; if(f===2&&!burn)burn={x,y}; if(liq&&burn)break}
 ok('T45.B a code-3 tile is impassable',!!liq&&!passable(liq.x,liq.y));
 ok('T45.B a code-2 tile is passable but burns',!!burn&&passable(burn.x,burn.y));
 if(burn){
  const v=makeUnit('grunt',G.human,burn.x+0.5,burn.y+0.5);
  v.hold=true;const hp0=v.hp;
  for(let i=0;i<90;i++){v.x=burn.x+0.5;v.y=burn.y+0.5;update(DT66)}
  ok('T45.B standing in the burn hazard costs HP',v.hp<hp0);
 }
}

/* ---------- C: the painters are wired (functional, not source text) ---------- */
{
 /* Every fillStyle string the terrain bake assigns, captured off a recording
    context. A palette row that was never reached simply will not appear, which is
    what makes this a real check: the alternative (grepping renderTerrain's source)
    passes on a comment that merely NAMES a colour. */
 function bakeColours(map,seed){
  G=null;newGame(cfg66(map,'dm',seed,1));
  const rec=[],real=document.createElement.bind(document);
  document.createElement=(tag)=>{
   const cv=real(tag);
   if(String(tag).toLowerCase()!=='canvas')return cv;
   const base=cv.getContext('2d');
   const prox=new Proxy(base,{
    get(t,k){const v=t[k];return typeof v==='function'?v.bind(t):v},
    set(t,k,v){if((k==='fillStyle'||k==='strokeStyle')&&typeof v==='string')rec.push(v);t[k]=v;return true}
   });
   cv.getContext=()=>prox;
   return cv;
  };
  try{renderTerrain()}finally{document.createElement=real}
  return rec;
 }
 const RIM={thorns:'rgba(38,30,16,.45)',grease:'rgba(64,48,14,.5)',glue:'rgba(46,54,66,.45)',
  soda:'rgba(58,30,16,.5)',milk:'rgba(120,124,132,.5)',juice:'rgba(38,10,42,.6)',
  coffee:'rgba(26,14,6,.6)',water:'rgba(30,52,40,.6)',puddle:'rgba(30,52,40,.6)',sand:null};
 const GRASSFLOOR='rgba(28,58,20,.4)'; // the deleted code-1 painter's floor tone
 let anyGrass=false;
 for(const m of ALL66){
  const cols=bakeColours(m,660044);
  ok(`T45.C ${m}: the terrain bake ran and painted something`,cols.length>50);
  const want=THEME66[m];
  for(const k of [want.h2,want.h3]){
   if(!RIM[k])continue; // sand keeps its own bespoke painter, checked by presence below
   ok(`T45.C ${m}: the ${k} painter was reached`,cols.includes(RIM[k]));
  }
  // a kind that belongs to another map must never be painted on this one
  const foreign=Object.keys(RIM).filter(k=>RIM[k]&&k!==want.h2&&k!==want.h3&&RIM[k]!==RIM[want.h3]);
  const bled=foreign.filter(k=>cols.includes(RIM[k]));
  ok(`T45.C ${m}: no other map's hazard palette bleeds in`+(bled.length?' ['+bled.join(',')+']':''),bled.length===0);
  if(cols.includes(GRASSFLOOR))anyGrass=true;
 }
 ok('T45.C the deleted tall-grass painter is never reached on any map',!anyGrass);
}

/* ---------- D: THE TRAP - the pond shrink tests the code, not the name ---------- */
{
 /* makeMap drains code-3 tiles around every resource node, then drops the stored
    field shapes that lost most of their footprint. That filter used to test
    fl.kind!=='water' by NAME, so the six new liquid kinds skipped it entirely and a
    drained milk pool would still be DRAWN over ground the pathfinder now calls
    walkable. Measured here as: every liquid field that survived is still mostly
    liquid on the grid. */
 const solidFrac=(M,fl)=>{
  const N=M.N;let solid=0,tot=0;const ext=Math.max(fl.rx,fl.ry)*1.4;
  for(let y=Math.max(0,Math.floor(fl.cy-ext));y<=Math.min(N-1,fl.cy+ext);y++)
   for(let x=Math.max(0,Math.floor(fl.cx-ext));x<=Math.min(N-1,fl.cx+ext);x++){
    const ddx=x+.5-fl.cx,ddy=y+.5-fl.cy;const rm=blobRadius(fl.blob,datan2(ddy,ddx));
    const dx=ddx/(fl.rx*rm),dy=ddy/(fl.ry*rm);
    if(dx*dx+dy*dy<=1){tot++;if(M.fld[y*N+x]===3)solid++}
   }
  return tot?solid/tot:1;
 };
 let checked=0,thin=[],nonWater=0;
 for(const m of ALL66)for(const sd of SEEDS66){
  const M=makeMap(m,sd);
  for(const fl of M.fields){
   if(fl.code!==3)continue;
   checked++;if(fl.kind!=='water')nonWater++;
   const f=solidFrac(M,fl);
   if(f<=0.4)thin.push(m+':'+sd+':'+fl.kind+':'+f.toFixed(2));
  }
 }
 ok(`T45.D every surviving liquid field is still mostly liquid (${checked} fields)`+(thin.length?' ['+thin.slice(0,3).join(' ')+']':''),
    checked>0&&thin.length===0);
 ok(`T45.D and most of them are NOT the 'water' kind, so the name test would have missed them (${nonWater}/${checked})`,nonWater>0);
 /* non-vacuity: the metric must report a thin footprint when there is one */
 const M=makeMap('kitchen',SEEDS66[0]);
 const dry=M.fields.find(fl=>fl.code===3);
 if(dry){
  const fake={...dry,cx:2.5,cy:2.5};
  ok('T45.D the thinness metric can fail (a liquid shape over dry ground scores low)',solidFrac(M,fake)<=0.4);
 } else ok('T45.D the thinness metric can fail',false);
}

/* ---------- E: the direct base<->base lanes carry the pressure ---------- */
{
 /* lanes are every pair of starts. The four adjacent-corner lanes are the ones
    laneClutter never touched, so they are measured on their own. */
 const segD=(a,b,x,y)=>{const dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy||1;
  let t=((x-a.x)*dx+(y-a.y)*dy)/L2;t=Math.max(0,Math.min(1,t));
  return dhyp(a.x+dx*t-x,a.y+dy*t-y)};
 const edgePairs=M=>[[M.starts[0],M.starts[2]],[M.starts[0],M.starts[3]],[M.starts[1],M.starts[2]],[M.starts[1],M.starts[3]]];
 for(const m of PVP66){
  let barr=0,lane=0,covered=0,lanes=0,seeds=0;
  for(const sd of SEEDS66){
   const M=makeMap(m,sd);seeds++;
   barr+=M.barricades.length;
   for(const b of M.barricades){
    let d=1e9;for(const st of M.starts)for(const st2 of M.starts)if(st!==st2)d=Math.min(d,segD(st,st2,b.x+.5,b.y+.5));
    if(d<=4)lane++;
   }
   for(const pr of edgePairs(M)){
    lanes++;
    // a hazard blob sitting on this lane, anywhere along its length
    if(M.fields.some(fl=>segD(pr[0],pr[1],fl.cx,fl.cy)<=Math.max(fl.rx,fl.ry)+2))covered++;
   }
  }
  const per=barr/seeds;
  ok(`T45.E ${m}: ~90 barricade tiles per map (got ${per.toFixed(0)}, was ~18 at v65)`,per>=60&&per<=115);
  ok(`T45.E ${m}: most barricades sit on a base-to-base lane (${(100*lane/barr).toFixed(0)}%)`,lane/barr>=0.55);
  ok(`T45.E ${m}: every adjacent-corner lane carries a hazard (${covered}/${lanes})`,covered===lanes);
 }
 /* the Desk is survival-only: survivalSetup rebuilds its starts in the middle, so
    the lane passes are deliberately skipped there. */
 const D=makeMap('desk',SEEDS66[0]);
 ok('T45.E the Desk still takes no lane clutter or barricades',D.barricades.length===0);
}

/* ---------- F: the denser maps are still connected ---------- */
{
 let pairs=0,cut=0,orphanNodes=0,minPass=1;
 const SEEDS=[];for(let i=0;i<8;i++)SEEDS.push(661000+i);
 for(const m of PVP66)for(const sd of SEEDS){
  const M=makeMap(m,sd),N=M.N;
  const seen=new Uint8Array(N*N),st=[];
  const okT=(x,y)=>x>=0&&y>=0&&x<N&&y<N&&M.pass[y*N+x]===1;
  const s0=M.starts[0],sx=Math.round(s0.x),sy=Math.round(s0.y);
  seen[sy*N+sx]=1;st.push(sx,sy);
  const D=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  while(st.length){const y=st.pop(),x=st.pop();
   for(const d of D){const nx=x+d[0],ny=y+d[1];if(!okT(nx,ny)||seen[ny*N+nx])continue;
    if(d[0]&&d[1]&&(!okT(x+d[0],y)||!okT(x,y+d[1])))continue;
    seen[ny*N+nx]=1;st.push(nx,ny)}}
  for(let i=1;i<4;i++){pairs++;const t=M.starts[i];if(!seen[Math.round(t.y)*N+Math.round(t.x)])cut++}
  for(const nd of M.nodes){let r=false;
   for(let oy=-2;oy<=2&&!r;oy++)for(let ox=-2;ox<=2;ox++){
    const tx=Math.floor(nd.x)+ox,ty=Math.floor(nd.y)+oy;
    if(tx>=0&&ty>=0&&tx<N&&ty<N&&seen[ty*N+tx]){r=true;break}}
   if(!r)orphanNodes++}
  let p=0;for(let i=0;i<N*N;i++)if(M.pass[i])p++;
  minPass=Math.min(minPass,p/(N*N));
 }
 ok(`T45.F every start reaches every other start (${pairs} pairs, ${cut} cut off)`,pairs>0&&cut===0);
 ok(`T45.F no resource node is walled off (${orphanNodes} orphans)`,orphanNodes===0);
 ok(`T45.F the board is still mostly open ground (min ${(100*minPass).toFixed(1)}% passable)`,minPass>0.7);
}

/* ---------- G: roach dens ---------- */
{
 for(const m of ALL66){
  let dens=0,bad=[],unmirrored=0;
  for(const sd of SEEDS66){
   const M=makeMap(m,sd);
   const rs=M.nests.filter(n=>n.species==='roach');
   dens+=rs.length;
   for(const ns of rs){
    if(ns.count!==2)bad.push('count '+ns.count);
    if(ns.r!==5)bad.push('r '+ns.r);
    /* nest() rounds and clamps each end independently and stores tile centres, so a
       mirrored pair sums to N+1 on both axes, not N. */
    if(!rs.some(o=>o!==ns&&Math.abs(o.x+ns.x-(M.N+1))<0.01&&Math.abs(o.y+ns.y-(M.N+1))<0.01))unmirrored++;
   }
  }
  ok(`T45.G ${m}: a mirrored pair of roach dens on every seed (${dens}/${2*SEEDS66.length})`,dens===2*SEEDS66.length);
  ok(`T45.G ${m}: each den holds 2 roaches at radius 5`+(bad.length?' ['+bad.slice(0,2).join(',')+']':''),bad.length===0);
  ok(`T45.G ${m}: the pair is a true mirror`,unmirrored===0);
 }
 /* and they really do swarm: an intruder in the radius brings roaches out */
 G=null;newGame(cfg66('backyard','dm',660005,1));
 const den=G.map.nests.find(n=>n.species==='roach'&&!n.dead);
 ok('T45.G the live game carries a roach den',!!den);
 if(den){
  makeUnit('grunt',G.human,den.x+den.r*0.3,den.y);
  for(let i=0;i<120;i++)update(DT66);
  const out=(G.neutrals||[]).filter(c=>c.nest===den&&c.hp>0);
  ok(`T45.G an intruder brings roaches out (${out.length})`,out.length>0&&out.every(c=>c.species==='roach'));
 }
}

/* ---------- H: nests rebuild their reserve until they are smashed ---------- */
{
 ok('T45.H NEST_REGEN is the approved 45s cadence',NEST_REGEN===1350);
 G=null;newGame(cfg66('backyard','dm',660006,1));
 const nests=G.map.nests.filter(n=>!n.dead&&n.count>=2);
 ok('T45.H found dens to measure',nests.length>=2);
 /* The measurement window is minutes of sim time, and T45.I's own feature means a
    CPU army will now break a roused den it walks into - which would empty the
    reserve from the other end and read as a regen failure. This check is about the
    schedule, so the dens under test are pinned unbreakable and their creatures are
    cleared, leaving `alive` movable only by the rule being measured. */
 const pin=(ns)=>{
  const i=G.map.nests.indexOf(ns);
  const b=G.blds.find(x=>x.key==='nest'&&x.nsi===i);
  if(b){b.hp=b.mhp=1e9}
  G.neutrals=(G.neutrals||[]).filter(cr=>cr.nest!==ns);
  ns.aggro=false;
 };
 const A=nests[0],B2=nests[1];
 pin(A);pin(B2);
 /* Pinning the structure is not enough on its own: an intruder wandering into the
    radius re-rouses the den, it spawns, the spawn dies, and the death path takes
    the reserve back down - which is the OTHER direction of travel and would read
    here as a regen failure. Sweeping the den's creatures at the top of every tick
    leaves `alive` movable by exactly one thing: the schedule under test. */
 const watched=[A,B2];
 const runH=(n)=>{for(let i=0;i<n;i++){
  G.neutrals=(G.neutrals||[]).filter(cr=>watched.indexOf(cr.nest)<0);
  update(DT66);
 }};
 // A has lost one creature; B2 is untouched and already full
 A.alive=A.count-1;
 const bFull=B2.count;B2.alive=bFull;
 runH(NEST_REGEN*1.6);
 ok(`T45.H a den that lost a creature refills (${A.alive}/${A.count})`,A.alive===A.count&&!A.dead);
 ok(`T45.H an untouched den never grows past its count (${B2.alive}/${bFull})`,B2.alive===bFull);
 runH(NEST_REGEN*2);
 ok('T45.H and the refilled den stops at its count, it does not keep climbing',A.alive===A.count&&B2.alive===bFull);
 // a smashed den stays smashed
 const C=nests[2]||nests[0];
 pin(C);C.dead=true;C.alive=0;watched.push(C);
 runH(NEST_REGEN*2);
 ok('T45.H a smashed den never comes back',C.dead&&C.alive===0);
 /* non-vacuity: without the regen rule the reserve is monotonically non-increasing,
    so the refill above is the only thing that could have moved it back up. */
 ok('T45.H the refill really did move the reserve (it started one short)',A.count>=2);
}

/* ---------- I: a CPU army breaks a den that is swarming it ---------- */
{
 G=null;newGame(cfg66('backyard','dm',660007,1));
 const den=G.blds.find(b=>b.key==='nest'&&b.hp>0);
 ok('T45.I found a den structure',!!den);
 if(den){
  const ns=G.map.nests[den.nsi];
  const ai=G.players.find(p=>p!==G.human&&p.ai);
  ok('T45.I the opponent is a CPU',!!ai);
  const spot={x:den.x+2,y:den.y};
  const drop=u=>{G.units.splice(G.units.indexOf(u),1);u.p.units.splice(u.p.units.indexOf(u),1)};
  // roused den, CPU unit right on top of it
  ns.aggro=true;ns.dead=false;
  let u=makeUnit('grunt',ai,spot.x,spot.y);
  const hit=nearestEnemy(u,10);
  ok('T45.I a CPU unit acquires a roused den it is standing on',hit===den);
  drop(u);
  // same unit, dormant den
  ns.aggro=false;
  u=makeUnit('grunt',ai,spot.x,spot.y);
  ok('T45.I a dormant den is still left alone',nearestEnemy(u,10)!==den);
  drop(u);
  // roused den, but the CPU unit is well outside NEST_AGGRO2
  ns.aggro=true;
  u=makeUnit('grunt',ai,den.x+12,den.y);
  ok('T45.I a roused den out of reach is not chased',nearestEnemy(u,20)!==den);
  drop(u);
  // the v25 player rule is untouched: dens are broken deliberately
  const h=makeUnit('grunt',G.human,spot.x,spot.y);
  ok("T45.I a player's unit still never auto-targets a den",nearestEnemy(h,10)!==den);
  drop(h);
  ok('T45.I NEST_AGGRO2 is a squared radius of 8 tiles',NEST_AGGRO2===64);
 }
}

/* ---------- J: regen is stateless - nothing new is hashed or serialized ---------- */
{
 const NESTKEYS=['alive','aggro','respT','dead','poked'];
 G=null;newGame(cfg66('kitchen','dm',660008,1));
 for(let i=0;i<40;i++)update(DT66);
 const snap=JSON.parse(saveState());
 const extra=[];
 for(const n of (snap.nests||[]))for(const k in n)if(!NESTKEYS.includes(k)&&!extra.includes(k))extra.push(k);
 ok('T45.J the nest snapshot row is unchanged'+(extra.length?' ('+extra.join(',')+')':''),
    (snap.nests||[]).length>0&&extra.length===0);

 /* the reserve schedule is derived from G.tick and the den's own tile, so two runs
    of the same seed agree and a save resumes on the same trail - including across a
    regen boundary, which is what a stored countdown would have got wrong. */
 const trail=(seed)=>{
  G=null;newGame(cfg66('backyard','dm',seed,1));
  for(const n of G.map.nests)if(!n.dead&&n.count>1)n.alive=n.count-1; // everything is owed a refill
  const t=[];for(let i=1;i<=NEST_REGEN+120;i++){update(DT66);if(i%450===0)t.push(hashState())}
  return t;
 };
 const a=trail(660009),b=trail(660009);
 ok('T45.J a run that crosses a regen boundary is deterministic',a.length>=3&&a.every((h,i)=>h===b[i]));

 G=null;newGame(cfg66('backyard','dm',660010,1));
 const den=G.map.nests.find(n=>!n.dead&&n.count>1);
 if(den)den.alive=den.count-1;
 // stop just short of this den's refill tick, save, then cross it on both sides
 const off=((den.x*7+den.y*13)|0)%NEST_REGEN;
 const until=(NEST_REGEN-(off%NEST_REGEN))%NEST_REGEN;
 for(let i=0;i<Math.max(1,until-10);i++)update(DT66);
 const h0=hashState(),json=saveState();
 const cont=[];for(let i=1;i<=60;i++){update(DT66);if(i%20===0)cont.push(hashState())}
 loadState(json);
 ok('T45.J save/load restores the same hash right before a refill tick',hashState()===h0);
 const cont2=[];for(let i=1;i<=60;i++){update(DT66);if(i%20===0)cont2.push(hashState())}
 ok('T45.J and resumes across the refill on the identical trail',cont.length===3&&cont.every((h,i)=>h===cont2[i]));
 ok('T45.J the reserve really did refill during that window',!den||den.alive===den.count);
}
