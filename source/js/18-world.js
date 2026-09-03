/* ---------------- FOG ---------------- */
function updateFog(){
 const N=G.map.N,fog=G.fog;
 if(G.spectate||G.test){fog.fill(2);const c0=G.fogCv.getContext('2d');c0.clearRect(0,0,N,N);flushStamps();return}  // v23: eliminated online players watch with full vision. v50: testing mode reuses the same path permanently
 for(let i=0;i<fog.length;i++)if(fog[i]===2)fog[i]=1;
 const stamp=(cx,cy,r)=>{const r2=r*r;for(let y=Math.max(0,Math.floor(cy-r));y<=Math.min(N-1,cy+r);y++)for(let x=Math.max(0,Math.floor(cx-r));x<=Math.min(N-1,cx+r);x++)if((x+.5-cx)**2+(y+.5-cy)**2<=r2)fog[y*N+x]=2;};
 for(const pl of G.players){ // v29: allied vision is shared
  if(!allied(pl,G.human))continue;
  for(const u of pl.units)if(!u.garrisoned)stamp(u.x,u.y,viOf(u)); // v66: no code-1 vision clamp; tall grass is gone. v79: the uplink widens the fog reveal too, or the player could not see what the extra range bought
  for(const b of pl.blds)stamp(b.x,b.y,bviOf(b)); // v101: the fog reveal follows the same night cut viOf just applied to the units
 }
 ghostRefresh();flushStamps(); // v26: freeze last-seen snapshots, paint deferred decals now in vision
 const c=G.fogCv.getContext('2d');
 const img=c.createImageData(N,N),d=img.data;
 for(let i=0;i<fog.length;i++){const f=fog[i];d[i*4+3]=f===2?0:(f===1?115:255)}
 c.putImageData(img,0,0);
}
function visibleToHuman(e){
 if(G.test||G.watch)return true; // v50: no fog in testing mode. v55: a spectator sees everything they are here to watch
 if(allied(e.p,G.human))return true; // v29: your whole team is always visible to you
 if(hid81(e,G.human))return false;   // v81: concealed, so he is not drawn, not on the minimap, and not clickable
 const f=G.fog[Math.floor(e.y)*G.map.N+Math.floor(e.x)];
 if(e.kind==='bld')return f===2; // v26: fogged buildings render from ghost snapshots instead
 // v66: the tall-grass concealment branch lived here. Code 1 is gone from the
 // game, so visibility is now exactly "is the tile in vision".
 return f===2;
}

/* ===================== NEUTRAL WILDLIFE ===================== */
/* Creatures live in G.neutrals (kept out of G.units so they never touch pathfinding,
   the economy, or faction AI). They sit dormant at a nest until any player unit
   enters the nest radius, then swarm out and bite intruders. They drift home and
   heal when no one is around. They damage AND are damaged by any player unit. */
const CREATURE={
 ant:{n:'Soldier Ant',hp:49,dm:10.08,rg:.7,rt:.7,sp:2.9,col:'#7a1f12',sz:3.4,vi:5,leash:9}, // v37: +20% hp/dmg (on v36)
 bee:{n:'Bee',hp:31,dm:12.96,rg:.8,rt:.55,sp:4.2,col:'#e0a82a',sz:3,vi:6,leash:11,fly:1}, // v37: +20% hp/dmg (on v36)
 fireant:{n:'Fire Ant',hp:101,dm:7.2,rg:.7,rt:.75,sp:2.7,col:'#d6381a',sz:3.9,vi:5,leash:9,burn:7.2}, // v37: +20% hp/dmg/burn (on v36)
 wasp:{n:'Wasp',hp:64,dm:23.04,rg:.85,rt:.6,sp:3.8,col:'#2a3050',sz:3.8,vi:6,leash:11,fly:1}, // v37: +20% hp/dmg (on v36)
 roach:{n:'Roach',hp:216,dm:20.16,rg:.8,rt:.9,sp:2.5,col:'#3a2410',sz:4.6,vi:5,leash:9,aoe:1.1}, // v37: +20% hp/dmg (on v36)
 mouse:{n:'Mouse',hp:900,dm:30,rg:.9,rt:1.1,sp:2.0,col:'#8a8f98',sz:6.5,vi:6,leash:9,aoe:1.5,boss:1}
};
// v30: wildlife rides the same effective rescale (units hit them with rescaled damage)
for(const k in CREATURE){CREATURE[k].hp=Math.max(1,Math.round(CREATURE[k].hp*RESCALE));CREATURE[k].dm=+(CREATURE[k].dm*RESCALE).toFixed(2);}
function initNeutrals(){
 // the neutral "owner" holds wildlife AND the scattered barricades. it is never a real
 // player (no AI, no economy, no win condition) but is shaped like one so the shared
 // kill()/draw/targeting code can treat its barricades like any other building.
 G.neutral={fac:'bug',ai:null,human:false,alive:true,i:-1,team:-1,
  units:[],blds:[],res:{p:0,e:0},score:0,
  stats:{built:0,lost:0,kills:0},
  tech:new Set(),techDone:new Set(),techQ:[]};
 G.neutrals=[];
 for(const ns of (G.map.nests||[])){
  ns.alive=ns.count; // remaining creatures to (re)spawn
  ns.aggro=false;
 }
 // turn the map's scattered barricade tiles into real dark-gray obstacle structures
 for(const bc of (G.map.barricades||[])){
  const tx=bc.x|0,ty=bc.y|0;
  if(tx<0||ty<0||tx>=G.map.N||ty>=G.map.N)continue;
  if(G.map.pass[ty*G.map.N+tx]!==1)continue; // tile already blocked by a prop/etc — skip
  makeBuilding('barricade',G.neutral,tx,ty,true);
 }
 /* v107: the Attic's level art. Recorded by makeMap as 2x2 footprints (top-left
    tile) with their tiles already blocked, so mines, hedgehogs and hazards kept
    clear of them during generation; makeBuilding re-blocks the same four tiles. */
 for(const lv of (G.map.lvl||[])){
  const tx=lv.x|0,ty=lv.y|0;
  if(tx<0||ty<0||tx+2>G.map.N||ty+2>G.map.N)continue;
  makeBuilding('crate',G.neutral,tx,ty,true);
 }
 // v25: every wildlife nest doubles as a destructible neutral structure. Smashing
 // it stops the swarm from respawning (survivors stay out, but lose home healing).
 G.map.nests.forEach((ns,i)=>{
  if(ns.dead)return;
  const b=makeBuilding('nest',G.neutral,Math.floor(ns.x),Math.floor(ns.y),true);
  b.nsi=i;
 });
}
function spawnCreature(ns){
 const t=CREATURE[ns.species];
 const a=srand()*6.28,rr2=ns.r*.5*srand();
 /* v68: the drawn point lands on ground the creature cannot stand on about half the
    time - the den's own 1x1 footprint, v66 lane clutter, a barricade, code-3 liquid.
    Measured: 182 of 350 spawns, and an embedded creature fails every branch of its
    stepper forever, so roughly half the wildlife on a map never moved again. Snap it
    to the nearest point it fits in.
    The two srand() draws above are UNCHANGED and still drawn in that order, so the
    sim rng stream is identical to v67; only the resulting position moves. */
 let cx=ns.x+dcos(a)*rr2,cy=ns.y+dsin(a)*rr2;
 if(!t.fly&&!passableR(cx,cy,.16)){const f=nearestFit(cx,cy,.16,PF_SPAWN_R);if(f){cx=f.x;cy=f.y}}
 const cr={kind:'creature',species:ns.species,t,p:G.neutral,nest:ns,
  x:cx,y:cy,
  hp:t.hp,mhp:t.hp,dm:t.dm,sp:t.sp,face:a,tface:a,cool:0,target:null,
  wob:srand()*6.28,bob:srand()*6.28,legph:srand()*6.28,flash:0,id:EID++};
 G.neutrals.push(cr);
 return cr;
}
function nearestIntruder(cr,r){
 let best=null,bd=r*r;
 for(const e of G.units){if(e.garrisoned||e.t.fly&&!cr.t.fly)continue;const d=(e.x-cr.x)**2+(e.y-cr.y)**2;if(d<bd){bd=d;best=e}}
 return best;
}
function updateNeutrals(dt){
 if(!G.neutrals)return;
 // wake nests when a player unit enters; (re)spawn creatures up to the nest's count
 for(const ns of G.map.nests){
  // v66: a living den rebuilds its reserve. Deliberately STATELESS - the schedule
  // is derived from G.tick and the den's own tile, so no new field enters
  // hashState, the snapshot encoder or loadState, and every peer agrees for free.
  // The gate is alive<count, so a den only ever replaces creatures that were
  // KILLED and can never exceed the reserve it was built with. This sits ahead of
  // the early-out below on purpose: a fully cleared den has to be able to return.
  if(!ns.dead&&ns.alive<ns.count&&(G.tick+(((ns.x*7+ns.y*13)|0)%NEST_REGEN))%NEST_REGEN===0)ns.alive++;
  if(ns.dead||ns.alive<=0)continue;
  let intr=false;
  for(const u of G.units){if(u.garrisoned)continue;if((u.x-ns.x)**2+(u.y-ns.y)**2<ns.r*ns.r){intr=true;break}}
  // v25: shooting the den structure rouses the swarm even from outside its radius
  if(!intr&&ns.poked&&G.tick-ns.poked<90)intr=true;
  ns.aggro=intr;
  if(intr){
   const live=G.neutrals.filter(c=>c.nest===ns&&c.hp>0).length;
   if(live<ns.alive&&G.tick%14===0)spawnCreature(ns);
  }
 }
 for(let i=G.neutrals.length-1;i>=0;i--){
  const cr=G.neutrals[i];
  if(cr.hp<=0){
   // creature died: shrink its nest's reserve a touch and burst into bits
   if(cr.nest&&cr.nest.alive>0)cr.nest.alive=Math.max(0,cr.nest.alive-1);
   spawnShrapnel(cr.x,cr.y,cr.t.col,5,.9);sfxBoom(cr.x,cr.y,'small');
   /* v100: and it leaves the selection, exactly as kill() drops a dead unit or
      building from it. Unreachable until this release - nothing could select a
      creature - and it would have left a corpse's stats standing in the panel
      forever. G.sel and lastSelSig are client-local and hashed nowhere, which
      is why sim code may touch them here on kill()'s own precedent. */
   if(G.sel.includes(cr)){G.sel.splice(G.sel.indexOf(cr),1);lastSelSig=''}
   G.neutrals.splice(i,1);continue;
  }
  if(cr.cool>0)cr.cool-=dt;
  if(cr.flash>0)cr.flash-=dt;
  cr.legph+=dt*16;cr.wob+=dt*5;
  if(cr.wave){updateWaveCreature(cr,dt);continue;} // v33: wave creatures ignore nests & leash
  const ns=cr.nest;
  // retarget
  if(!cr.target||cr.target.hp<=0||G.tick%12===cr.id%12){
   cr.target=nearestIntruder(cr,cr.t.vi);
  }
  // leash: if we wandered too far from home, forget the target and return
  const homeD=ns?dhyp(cr.x-ns.x,cr.y-ns.y):0;
  let dest=null;
  if(cr.target&&(!ns||homeD<cr.t.leash)){
   const tg=cr.target,d=dhyp(tg.x-cr.x,tg.y-cr.y);
   cr.tface=datan2(tg.y-cr.y,tg.x-cr.x);cr.face=cr.tface;
   if(d<=cr.t.rg+ (tg.kind==='bld'?tg.sz*.5:.3)){
    if(cr.cool<=0){cr.cool=cr.t.rt;applyDmg(tg,cr.dm,'b',cr);sparks(tg.x,tg.y,6,'#fff0a0',2);cr.flash=.1;}
   } else dest={x:tg.x,y:tg.y};
  } else if(ns){
   // wander/return toward the nest
   if(homeD>1.5){dest={x:ns.x+dcos(cr.wob)*1.2,y:ns.y+dsin(cr.wob)*1.2}}
   else {
    /* v65 SPIN FIX. cr.wob is a monotonic phase (+dt*5 per tick, never wrapped),
       so the old `cr.face = cr.wob` rotated every resting critter at 5 rad/s -
       roughly 0.8 revolutions a second, forever, which is the spin. Face OUTWARD
       from the den instead, with a bounded +-0.45 rad sway off that heading: the
       den still mills about, nothing rotates. Wave creatures never reach this
       branch (they always carry a destination), which is why the defect only
       ever showed on nest wildlife and only while unengaged.
       cr.face is render-only for creatures - hashState hashes u.face, never
       cr.face - so this edit moves no trail by itself. */
    const hx=cr.x-ns.x,hy=cr.y-ns.y;
    const out=(hx||hy)?datan2(hy,hx):cr.face;
    cr.face=out+dsin(cr.wob*0.4)*0.45;
    if(!ns.dead&&cr.hp<cr.mhp)cr.hp=Math.min(cr.mhp,cr.hp+4*dt); // heal at home (not at a smashed den)
   }
  }
  if(dest)creatureStep(cr,dest.x,dest.y,dt); // v36: A* around geometry
 }
}

/* ===================== WAVE SURVIVAL ===================== */
const SURV_BUILD=60;               // seconds of build time before wave 1
// approved wave table (Normal, 2-PLAYER baseline). Counts scale by diff.army, a
// +/-20%/player modifier (v39), then jitter x0.75..1.25; waves 7+ floor at 10 ants / 5 fire ants.
const SURV_WAVES=[
 {ant:26},
 {ant:35,bee:8},
 {ant:26,bee:14,fireant:6},
 {ant:35,bee:12,fireant:12},
 {fireant:17,wasp:12,mouse:2},
 {ant:43,bee:17,fireant:12,wasp:6},
 {fireant:23,wasp:17,roach:6},
 {fireant:17,wasp:23,roach:12},
 {fireant:29,wasp:17,roach:12},
 {wasp:23,roach:17,mouse:4},
 {fireant:35,wasp:23,roach:12},
 {wasp:29,roach:23,mouse:4},
 {fireant:35,wasp:29,roach:17},
 {wasp:23,roach:29,mouse:4},
 {wasp:35,roach:23,mouse:8}
]; // v34: ant x3, every other species x2
const SURV_WAVE_N=SURV_WAVES.length; // v43: wave count IS the table length
// Central start cluster + clean arena + a little starter economy. Runs right
// after makeMap (before renderTerrain / initNeutrals) so the arena bakes in and
// the nest/barricade owners are built from the pruned map. makeMap is untouched.
function survivalSetup(s){
 const M=G.map,N=M.N,c=N/2;
 let cnt=s.slots?s.slots.filter(sl=>sl&&sl.ctrl!=='closed').length:1+(s.opp||0);
 cnt=clamp(cnt,1,4);
 const off=5.2;
 let pts;
 if(cnt<=1)pts=[[c,c]];
 else if(cnt===2)pts=[[c-off,c],[c+off,c]];
 else if(cnt===3)pts=[[c,c-off],[c-off*0.9,c+off*0.55],[c+off*0.9,c+off*0.55]];
 else pts=[[c-off,c-off],[c+off,c-off],[c-off,c+off],[c+off,c+off]];
 M.starts=pts.map(p=>({x:p[0],y:p[1]}));
 const R=off+6;                    // arena radius (covers bases + guard-tower ring)
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){if(dhyp(x+.5-c,y+.5-c)<R){M.pass[y*N+x]=1;M.fld[y*N+x]=0;}}
 M.nests=(M.nests||[]).filter(ns=>dhyp(ns.x-c,ns.y-c)>=R);
 M.props=(M.props||[]).filter(p=>dhyp(p.x-c,p.y-c)>=R);
 M.fields=(M.fields||[]).filter(f=>dhyp(f.cx-c,f.cy-c)>=R);
 M.mines=(M.mines||[]).filter(m=>dhyp(m.x-c,m.y-c)>=R);
 M.barricades=(M.barricades||[]).filter(b=>dhyp((b.x|0)+.5-c,(b.y|0)+.5-c)>=R);
 M.lvl=(M.lvl||[]).filter(b=>dhyp((b.x|0)+1-c,(b.y|0)+1-c)>=R+1.5); // v107: the Attic's crates clear the arena too (2x2, so measured from the block's centre)
 delete M.sides; // v107: the starts below are the central cluster, not the Attic's two sides
 const addNodeAt=(t,wx,wy,amt)=>{const tx=Math.round(wx),ty=Math.round(wy);M.nodes.push({t,x:tx+.5,y:ty+.5,amt,max:amt});if(tx>=0&&ty>=0&&tx<N&&ty<N)M.pass[ty*N+tx]=0;};
 if(M.theme==='desk'){
  // v35: Desk survival economy — (players+1) plastic piles AND (players+1) batteries
  // ringed inside the arena, plus one exposed plastic+battery pair ~45% of the way
  // toward each of the 4 map corners (out in the wave zone). Fully deterministic.
  M.nodes=[];M.expos=[];
  const NP=cnt+1,total=NP*2,rr=8.5,step=Math.PI*2/total;
  for(let i=0;i<total;i++){const a=-Math.PI/2+i*step,pl=(i%2===0);
   addNodeAt(pl?'plastic':'battery',c+dcos(a)*rr,c+dsin(a)*rr,pl?DESK_RING_P:DESK_RING_E);} // v37: +50%; v77: a further +20%, and named
  const clearRing=(wx,wy,r)=>{
   for(let y=Math.max(0,Math.floor(wy-r));y<=Math.min(N-1,Math.ceil(wy+r));y++)for(let x=Math.max(0,Math.floor(wx-r));x<=Math.min(N-1,Math.ceil(wx+r));x++){if(dhyp(x+.5-wx,y+.5-wy)<=r){M.pass[y*N+x]=1;M.fld[y*N+x]=0;}}
   M.props=(M.props||[]).filter(p=>dhyp(p.x-wx,p.y-wy)>r+(p.r||0));
   M.fields=(M.fields||[]).filter(f=>dhyp(f.cx-wx,f.cy-wy)>r+Math.max(f.rx,f.ry));
   M.nests=(M.nests||[]).filter(ns=>dhyp(ns.x-wx,ns.y-wy)>r+1);};
  for(const [sx,sy] of [[-1,-1],[1,1],[1,-1],[-1,1]]){
   const corX=c+sx*(c-6),corY=c+sy*(c-6),px=c+(corX-c)*0.70,py=c+(corY-c)*0.70; // v36: 45%->70% toward corners
   clearRing(px,py,3.2);
   const ang=datan2(corY-c,corX-c),ox=dcos(ang+Math.PI/2)*1.4,oy=dsin(ang+Math.PI/2)*1.4;
   addNodeAt('plastic',px+ox,py+oy,DESK_CORNER_P);addNodeAt('battery',px-ox,py-oy,DESK_CORNER_E); // v37: +50% (on v36); v77: named, value deliberately unchanged
  }
 } else {
  M.nodes=(M.nodes||[]).filter(n=>dhyp(n.x-c,n.y-c)>=R);
  addNodeAt('plastic',c-2,c-2,2340);addNodeAt('plastic',c+2,c+2,2340);
  addNodeAt('battery',c+2,c-2,1400);addNodeAt('battery',c-2,c+2,1400);
 }
}
// nearest player-owned unit OR building within radius r (never neutral).
function nearestDefender(cr,r){
 let best=null,bd=r*r;
 for(const e of G.units){if(e.p===G.neutral||e.garrisoned||(e.t.fly&&!cr.t.fly))continue;const d=(e.x-cr.x)**2+(e.y-cr.y)**2;if(d<bd){bd=d;best=e}}
 for(const b of G.blds){if(b.p===G.neutral||b.hp<=0)continue;const d=(b.x-cr.x)**2+(b.y-cr.y)**2;if(d<bd){bd=d;best=b}}
 return best;
}
// apply a fire-ant burn to a target: a short damage-over-time refreshed on each hit.
function applyBurn(tgt,dps){tgt.burnT=Math.max(tgt.burnT||0,2);tgt.burnDps=dps;}
// tick every burning unit/building (deterministic; attacker null like hazards).
function tickBurns(dt){
 for(const u of G.units){if(u.burnT>0){u.burnT-=dt;applyDmg(u,(u.burnDps||3)*dt,'f',null);}}
 for(const b of G.blds){if(b.burnT>0){b.burnT-=dt;applyDmg(b,(b.burnDps||3)*dt,'f',null);}}
}
// a wave creature's attack: frontal cleave (aoe) hits everything in a small area
// just ahead; otherwise a single hit, plus a burn for fire ants.
function waveAttack(cr,tg){
 const t=cr.t;
 if(t.aoe){
  const ax=cr.x+dcos(cr.face)*1.1,ay=cr.y+dsin(cr.face)*1.1,r=t.aoe;
  for(const u of G.units){if(u.p===G.neutral||u.garrisoned||(u.t.fly&&!t.fly))continue;if(dhyp(u.x-ax,u.y-ay)<r+.3)applyDmg(u,cr.dm,'ex',cr);}
  for(const b of G.blds){if(b.p===G.neutral||b.hp<=0)continue;if(dhyp(b.x-ax,b.y-ay)<r+b.sz*.5)applyDmg(b,cr.dm,'ex',cr);}
  sparks(ax,ay,10,'#ffd0a0',3);
 } else {
  applyDmg(tg,cr.dm,t.burn?'f':'b',cr);
  if(t.burn)applyBurn(tg,t.burn);
  sparks(tg.x,tg.y,6,t.burn?'#ff8a3a':'#fff0a0',2);
 }
 cr.flash=.1;
}
// v36: creatures route around geometry instead of jamming against it. A cheap
// straight step is taken when it's clear; only OBSTRUCTED creatures build a path,
// so open-field waves cost no A*. Recovery (wall-slide / perpendicular nudge /
// wedge-hop) mirrors the unit stepper. Fully deterministic: findPath is pure and
// the repath cadence keys on G.tick & cr.id. cr.cpath/cwp/cgoal/cstuck/clx/cly/
// cwedge are movement-only (never hashed or serialized; rebuilt on demand).
function creatureFollowPath(cr,step,dt){
 const R=0.16;
 if(!cr.cpath||cr.cwp>=cr.cpath.length){cr.cpath=null;return;}
 const w=cr.cpath[cr.cwp],dx=w.x-cr.x,dy=w.y-cr.y,d=dhyp(dx,dy)||1;
 if(d<.3){cr.cwp++;if(cr.cwp>=cr.cpath.length)cr.cpath=null;return;}
 const ux=dx/d,uy=dy/d;cr.face=datan2(dy,dx);
 if(passableR(cr.x+ux*step,cr.y+uy*step,R)){cr.x+=ux*step;cr.y+=uy*step;}
 else if(passableR(cr.x+ux*step,cr.y,R))cr.x+=ux*step;
 else if(passableR(cr.x,cr.y+uy*step,R))cr.y+=uy*step;
 else{const px=-uy,py=ux;
  if(passableR(cr.x+px*step,cr.y+py*step,R)){cr.x+=px*step;cr.y+=py*step;}
  else if(passableR(cr.x-px*step,cr.y-py*step,R)){cr.x-=px*step;cr.y-=py*step;}}
 if(G.tick%10===cr.id%10){
  const mv=dhyp(cr.x-(cr.clx==null?cr.x:cr.clx),cr.y-(cr.cly==null?cr.y:cr.cly));
  if(mv<.12)cr.cstuck=(cr.cstuck||0)+.34;else cr.cstuck=Math.max(0,(cr.cstuck||0)-.2);
  cr.clx=cr.x;cr.cly=cr.y;
  if(cr.cstuck>.7&&cr.cgoal){
   cr.cwedge=(cr.cwedge||0)+1;
   if(cr.cwedge>=4){const bx=Math.floor(cr.x),by=Math.floor(cr.y);let best=null,bd=1e9;
    for(let rr2=1;rr2<=3&&!best;rr2++)for(let oy=-rr2;oy<=rr2;oy++)for(let ox=-rr2;ox<=rr2;ox++){const qx=bx+ox+.5,qy=by+oy+.5;if(passableR(qx,qy,R)){const q=ox*ox+oy*oy;if(q<bd){bd=q;best=[qx,qy];}}}
    if(best){cr.x=best[0];cr.y=best[1];}cr.cwedge=0;}
   cr.cpath=findPath(cr.x,cr.y,cr.cgoal.x,cr.cgoal.y,false,.16);cr.cwp=0;cr.cstuck=0;}
 }
}
function creatureStep(cr,dX,dY,dt){
 const sp=cr.sp*(cr.t.fly?1:terrainSpeed(cr)),step=sp*dt;
 const dx=dX-cr.x,dy=dY-cr.y,dd=dhyp(dx,dy)||1;cr.face=datan2(dy,dx);
 if(cr.t.fly){cr.x+=dx/dd*step;cr.y+=dy/dd*step;return;} // flyers ignore ground geometry
 /* v68: depenetrate before anything else, for the same reason moveAlong does. Every
    branch below and in creatureFollowPath tests passableR, so a creature standing on
    a position that already fails it can never move again without this.
    Comment on its own line: a trailing // eats the tail of the guard. */
 if(!passableR(cr.x,cr.y,.16)&&unstick(cr,.16,step))return;
 const goalMoved=!cr.cgoal||(cr.cgoal.x-dX)**2+(cr.cgoal.y-dY)**2>4;
 if(cr.cpath&&cr.cwp<cr.cpath.length&&!goalMoved){creatureFollowPath(cr,step,dt);return;}
 if(passableR(cr.x+dx/dd*step,cr.y+dy/dd*step,.16)){cr.x+=dx/dd*step;cr.y+=dy/dd*step;cr.cstuck=0;cr.cpath=null;return;}
 cr.cgoal={x:dX,y:dY};cr.cpath=findPath(cr.x,cr.y,dX,dY,false,.16);cr.cwp=0;cr.cstuck=0;
 creatureFollowPath(cr,step,dt);
}
// wave creature AI: seek the centre, hit whatever defender is in reach, no leash.
function updateWaveCreature(cr,dt){
 if(!cr.target||cr.target.hp<=0||G.tick%12===cr.id%12)cr.target=nearestDefender(cr,cr.t.vi);
 const cx=G.surv?G.surv.fx:G.map.N/2,cy=G.surv?G.surv.fy:G.map.N/2;
 let dest=null;
 if(cr.target){
  const tg=cr.target,tr=(tg.kind==='bld'?tg.sz*.5:.3),d=dhyp(tg.x-cr.x,tg.y-cr.y);
  cr.tface=datan2(tg.y-cr.y,tg.x-cr.x);cr.face=cr.tface;
  if(d<=cr.t.rg+tr){if(cr.cool<=0){cr.cool=cr.t.rt;waveAttack(cr,tg);}}
  else dest={x:tg.x,y:tg.y};
 } else dest={x:cx,y:cy};
 if(dest)creatureStep(cr,dest.x,dest.y,dt); // v36: A* around geometry
}
// spawn one wave creature at (x,y), facing the centre.
function spawnWaveCreature(species,x,y){
 const t=CREATURE[species];
 const a=datan2(G.map.N/2-y,G.map.N/2-x);
 const cr={kind:'creature',species,t,p:G.neutral,nest:null,wave:true,
  x,y,hp:t.hp,mhp:t.hp,dm:t.dm,sp:t.sp,face:a,tface:a,cool:0,target:null,
  wob:srand()*6.28,bob:srand()*6.28,legph:srand()*6.28,flash:0,id:EID++};
 G.neutrals.push(cr);
 return cr;
}
// a passable point on a random map edge to spawn a wave creature from.
function waveEdgePoint(){
 const N=G.map.N,e=Math.floor(srand()*4),u=srand();let x,y;
 if(e===0){x=2+u*(N-4);y=2;}
 else if(e===1){x=2+u*(N-4);y=N-3;}
 else if(e===2){x=2;y=2+u*(N-4);}
 else{x=N-3;y=2+u*(N-4);}
 return safeSpot(x,y);
}
// spawn wave n (1..SURV_WAVE_N): counts x diff.army x player-count-mod x jitter per species;
// waves 7+ floor at >=10 ants / >=5 fire ants (v39).
function spawnWave(n){
 const comp=SURV_WAVES[n-1];if(!comp)return;
 const arm=((G.diff)||DIFFS.normal).army;
 const pmul=1+0.2*((G.players?G.players.length:1)-2); // v39: +/-20% per player vs the 2-player baseline (1p .8x, 2p 1x, 3p 1.2x, 4p 1.4x); any human/CPU mix
 const spawned={};
 for(const sp in comp){
  let cnt=comp[sp];if(!cnt)continue;
  cnt=Math.max(1,Math.round(cnt*arm*pmul*(0.75+srand()*0.5))); // v38 jitter+diff.army; v39 x player-count modifier
  spawned[sp]=(spawned[sp]||0)+cnt;
  for(let k=0;k<cnt;k++){const pt=waveEdgePoint();spawnWaveCreature(sp,pt.x,pt.y);}
 }
 if(n>=7){ // v39: guarantee a floor of basic threats every late wave, regardless of player-count/jitter
  const floor={ant:10,fireant:5};
  for(const sp in floor)for(let k=(spawned[sp]||0);k<floor[sp];k++){const pt=waveEdgePoint();spawnWaveCreature(sp,pt.x,pt.y);}
 }
}
// survival clock + win/lose. Lose when every allied HQ is gone; win when the last
// wave has spawned and no wave creatures remain alive.
function updateSurv(dt){
 const S=G.surv;if(!S||S.done)return;
 let hqs=0;for(const p of G.players)if(p.alive)for(const b of p.blds)if(b.key==='hq'&&b.hp>0)hqs++;
 if(hqs===0){S.done=true;endGame(false);return;}
 if(S.no<SURV_WAVE_N){
  S.t-=dt;
  if(S.t<=0){S.no++;spawnWave(S.no);S.t=60;msg(`🌊 Wave ${S.no} of ${SURV_WAVE_N} incoming!`);if(S.no===SURV_WAVE_N)msg('\u26A0 FINAL WAVE - hold the line!');}
 } else if(!G.neutrals.some(cr=>cr.wave&&cr.hp>0)){
  S.done=true;endGame(true);
 }
}
// white defend-flag marker at the arena centre (render-only, client-local).
function drawDefendFlag(c){
 const S=G.surv;if(!S)return;
 const sx=isoX(S.fx,S.fy),sy=isoY(S.fx,S.fy);
 c.save();c.translate(sx,sy);
 plShadow(c,0,2,9,4.5,.3);
 c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=1.5;c.setLineDash([5,5]);c.beginPath();c.ellipse(0,2,HW*.75,HH*.75,0,0,7);c.stroke();c.setLineDash([]);
 c.strokeStyle='#c8cdd4';c.lineWidth=2.4;c.lineCap='round';c.beginPath();c.moveTo(0,2);c.lineTo(0,-30);c.stroke();
 const w=Math.sin(G.tick*.06)*2;
 c.fillStyle='#f4f7fb';c.beginPath();c.moveTo(0,-30);c.quadraticCurveTo(9,-28+w,16,-25);c.quadraticCurveTo(9,-22-w,0,-20);c.closePath();c.fill();
 c.strokeStyle='rgba(120,140,160,.5)';c.lineWidth=.8;c.stroke();
 c.restore();
}
// the prominent top-centre wave banner (client-local UI).
function refreshSurvBanner(){
 const el=document.getElementById('survBanner');if(!el)return;
 if(G.mode!=='surv'||!G.surv||G.over){el.style.display='none';return;}
 el.style.display='block';
 const S=G.surv,mm=Math.max(0,Math.ceil(S.t)),t=`${Math.floor(mm/60)}:${String(mm%60).padStart(2,'0')}`;
 if(S.no===0)el.innerHTML=`<div class="wbig">WAVE 1 INCOMING</div><div class="wsub">Build your defenses \u00B7 ${t}</div>`;
 else if(S.no>=SURV_WAVE_N){const left=(G.neutrals||[]).filter(cr=>cr.wave&&cr.hp>0).length;el.innerHTML=`<div class="wbig">FINAL WAVE \u00B7 ${SURV_WAVE_N} / ${SURV_WAVE_N}</div><div class="wsub">${left} enemies remaining</div>`;}
 else el.innerHTML=`<div class="wbig">WAVE ${S.no} / ${SURV_WAVE_N}</div><div class="wsub">Next wave in ${t}</div>`;
}

/* ---------------- TERRAIN HAZARD DAMAGE ---------------- */
// blow a hidden landmine: a radial blast whose damage falls off with distance
// (mineDmg) so it 1-shots a tank at the centre, a jeep one tile out, a grunt two.
/* --- THE HEAVY BARRICADE'S MINE, ADDED AT v88 ---
   A new KIND of mine rather than a new mine system: it joins G.map.mines, which
   is already hashed, already serialized and already swept every frame, and it
   carries two extra fields that the sweep and the renderer read.
     mn.pi  - whose it is. The sweep skips that player's army and its allies, so
              Gray walks over its own field; every other army trips it.
     mn.gray- that it is one of these at all, which is what the renderer draws and
              what tells the sweep to consult mn.pi in the first place. The map's
              own scattered mines carry neither field and behave exactly as they
              did: invisible to everybody, hostile to everybody.
   "Three tiles in front" is measured toward the nearest enemy HQ, which is what
   the owner meant by front - a wall faces the army it was built to stop. With no
   enemy HQ left on the board there is no front, so no mine is buried; the draw is
   still taken, so the RNG stream is the same either way.
   The landing tile is clamped and must be passable, and the search for a passable
   one walks a fixed ring order - no second srand() draw, so two clients that
   agree on the roll agree on the tile. */
function hbMineFront(b){
 let best=null,bd=1e9;
 for(const q of G.players){
  if(!q.alive||allied(q,b.p))continue;
  for(const h of q.blds){
   if(h.key!=='hq'||h.hp<=0)continue;
   const d=(h.x-b.x)**2+(h.y-b.y)**2;
   if(d<bd){bd=d;best=h}
  }
 }
 return best;
}
function buryHBMine(b){
 const roll=srand();                       // taken for every wall, so the stream never forks on the outcome
 const hq=hbMineFront(b);
 if(roll>=HBARR_MINE_P||!hq)return null;
 const a=datan2(hq.y-b.y,hq.x-b.x);
 let mx=b.x+dcos(a)*HBARR_MINE_D, my=b.y+dsin(a)*HBARR_MINE_D;
 mx=clamp(mx,1.5,G.map.N-1.5);my=clamp(my,1.5,G.map.N-1.5);
 if(!passable(Math.floor(mx),Math.floor(my))){
  let found=false;
  outer:for(let r=1;r<=3&&!found;r++)for(let oy=-r;oy<=r;oy++)for(let ox=-r;ox<=r;ox++){
   const nx=clamp(mx+ox,1.5,G.map.N-1.5),ny=clamp(my+oy,1.5,G.map.N-1.5);
   if(passable(Math.floor(nx),Math.floor(ny))){mx=nx;my=ny;found=true;break outer;}
  }
  if(!found)return null;
 }
 const mn={x:mx,y:my,live:true,gray:1,pi:b.p.i};
 G.map.mines.push(mn);
 if(b.p.human)msg('The work party buried a mine forward of the wall.');
 return mn;
}
/* may this mine answer to this walker? The map's own mines answer to everyone;
   a buried one never answers to the army that buried it or to its allies. */
function mineArms(mn,u){
 if(!mn.gray)return true;
 const owner=G.players[mn.pi];
 return !owner||!allied(owner,u.p);
}
function detonateMine(mn){
 mn.live=false;
 const R=MINE_R;
 // damage every ground unit, structure, and creature caught in the blast
 for(const u of G.units.slice()){
  if(u.hp<=0||u.garrisoned||u.t.fly)continue;
  const d=dhyp(u.x-mn.x,u.y-mn.y);
  if(d<R)applyDmg(u,mineDmg(d),'ex',MINE_OWNER);
 }
 for(const b of G.blds.slice()){
  if(b.hp<=0)continue;
  const d=dhyp(b.x-mn.x,b.y-mn.y);
  if(d<R)applyDmg(b,mineDmg(d),'ex',MINE_OWNER);
 }
 for(const cr of (G.neutrals||[]).slice()){
  if(cr.hp<=0||cr.t.fly)continue;
  const d=dhyp(cr.x-mn.x,cr.y-mn.y);
  if(d<R)applyDmg(cr,mineDmg(d),'ex',MINE_OWNER);
 }
 // FX: a real fireball, scorch stamp, smoke, shrapnel, screen shake
 spawnExplosion(mn.x,mn.y,1.5);
 stampScorch(mn.x,mn.y,R*6);
 spawnSmoke(mn.x,mn.y,5,{rise:9,grow:7,life:2.2,r:4,col:'#2e2e2e'});
 spawnShrapnel(mn.x,mn.y,'#8a8a8a',18,2.0);
 spawnDust(mn.x,mn.y,1.1);
 shakeAt(mn.x,mn.y,5);sfxBoom(mn.x,mn.y,'big');
}
function updateHazards(dt){
 // --- hidden landmines: checked EVERY frame (not throttled like the slow hazards
 //     below) so a fast unit can't skip across one between ticks. ---
 const mines=G.map.mines;
 if(mines&&mines.length){
  for(const u of G.units.slice()){
   if(u.garrisoned||u.t.fly||u.hp<=0)continue;
   for(const mn of mines){
    if(!mn.live||!mineArms(mn,u))continue; // v88: a Gray-buried mine lets Gray walk over it
    const dx=u.x-mn.x,dy=u.y-mn.y;
    if(dx*dx+dy*dy<MINE_TRIG*MINE_TRIG){detonateMine(mn);break;}
   }
  }
 }
 // sand traps deal damage over time to land units standing in them
 G.hazAcc=(G.hazAcc||0)+dt;
 if(G.hazAcc<0.4)return; // tick a few times a second
 const step=G.hazAcc;G.hazAcc=0;
 for(const u of G.units){
  if(u.garrisoned||u.t.fly)continue;
  if(fieldAt(u.x,u.y)===2){applyDmg(u,HAZ_DPS*step,'b',null);
   // v22: idle units step out of quicksand instead of standing in it and burning
   if(u.hp>0&&u.state==='idle'&&!u.entrenched){const s=safeSpot(u.x,u.y);if(dhyp(s.x-u.x,s.y-u.y)>0.6)orderMove(u,s.x,s.y,!!u.t.dm);}
  }
 }
 for(const cr of (G.neutrals||[])){
  if(cr.t.fly)continue;
  if(fieldAt(cr.x,cr.y)===2)applyDmg(cr,HAZ_DPS*step,'b',null);
 }
}

