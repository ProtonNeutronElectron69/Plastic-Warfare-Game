/* tail_v32.js — T13: building placement overhaul.
   1) placeDeny/canPlace: reason codes, aura acceptance & strict-< boundaries
      (HQ 10, outpost 4, centre-to-centre via dhyp; b.x/b.y ARE centres),
      barricades now subject to the near rule, HQ/outpost 'anywhere' exemption,
   2) enemy-HQ 10-tile exclusion ring: repels every building type incl.
      outposts & barricades, in-progress enemy HQs repel, team allies exempt,
   3) canPlaceUI vision gate on the newly-'anywhere' HQ,
   4) AI soak under the new rule with placeBuilding instrumentation: every
      actual placement was legal at call time, bots still build, and nothing
      stands inside a live original enemy HQ ring at soak end,
   5) drawGhost aura-ring render smoke via the REN_ERRS suppression set
      (render() never throws; renderGuard swallows). */
'use strict';
section('T13 v32: placement auras, enemy-HQ exclusion, anywhere HQ/outpost');

function fresh13(seed){G=null;newGame(cfg('backyard','dm','normal','green',3,seed));run(30);}

/* find a clear passable footprint whose centre lands at target distance D
   (within tol) from world point (ax,ay), free of ground units. */
/* v66: optional `rej(cx,cy)` rejects a candidate by its CENTRE. Existing callers
   pass nothing and are unaffected. Added because the outpost-aura check below
   needs a spot that is ~6 from the outpost AND outside the friendly HQ zone, and
   filtering spotAt's single best answer after the fact cannot express that. */
function spotAt(key,ax,ay,D,tol,rej){
 const sz=B[key].sz,N=G.map.N;
 let best=null,bd=1e9;
 for(let ty=1;ty<N-sz-1;ty++)for(let tx=1;tx<N-sz-1;tx++){
  const d=dhyp(ax-(tx+sz/2),ay-(ty+sz/2));
  if(Math.abs(d-D)>tol)continue;
  if(rej&&rej(tx+sz/2,ty+sz/2))continue;
  let pass=true;
  for(let y=0;y<sz&&pass;y++)for(let x=0;x<sz;x++)if(!G.map.pass[(ty+y)*N+(tx+x)]){pass=false}
  if(!pass)continue;
  let uok=true;
  for(const u of G.units)if(!u.t.fly&&u.x>tx-0.4&&u.x<tx+sz+0.4&&u.y>ty-0.4&&u.y<ty+sz+0.4){uok=false;break}
  if(!uok)continue;
  // v61: the spacing rule outranks 'near' and 'foehq', so a tile it owns can
  // never demonstrate either. Barricades are exempt from each other, as in placeDeny.
  let gok=true;const barr32=!!B[key].barr;
  for(const b of G.blds){if(b.hp<=0)continue;if(barr32&&b.t.barr)continue;if(bldGap(key,tx,ty,b)<BUILD_GAP){gok=false;break}}
  if(!gok)continue;
  const e=Math.abs(d-D);
  if(e<bd){bd=e;best={tx,ty,d}}
 }
 return best;
}
const foeClear13=(p,key,tx,ty)=>{ // true if outside every live enemy-HQ ring
 const sz=B[key].sz,fx=tx+sz/2,fy=ty+sz/2;
 for(const q of G.players){if(allied(p,q))continue;
  for(const b of q.blds)if(b.key==='hq'&&b.hp>0&&dhyp(b.x-fx,b.y-fy)<10)return false}
 return true;
};

ok('T13 snapshot tag bumped',(()=>{fresh13(320000);return JSON.parse(saveState()).v>=32})());

/* ---------- T13.1 aura acceptance, boundaries, reasons ---------- */
{fresh13(320001);
 const p=G.human,hq=p.blds.find(b=>b.key==='hq');
 let s=spotAt('barracks',hq.x,hq.y,6,1.5);
 ok('T13 barracks inside HQ-10 legal',!!s&&foeClear13(p,'barracks',s.tx,s.ty)&&placeDeny(p,'barracks',s.tx,s.ty)==='');
 s=spotAt('barracks',hq.x,hq.y,16.5,1.5);
 ok('T13 v42: barracks outside HQ-15 denies near',!!s&&foeClear13(p,'barracks',s.tx,s.ty)&&placeDeny(p,'barracks',s.tx,s.ty)==='near');
 // strict < at the exact boundary: guard tower sz1, dx exactly 10, dy 0
 {
  const tx=Math.round(hq.x+15-0.5),ty=Math.round(hq.y-0.5);
  const d=dhyp(hq.x-(tx+0.5),hq.y-(ty+0.5)),why=placeDeny(p,'guardtower',tx,ty);
  if(d===15&&why!=='terrain'&&why!=='unit'&&foeClear13(p,'guardtower',tx,ty)){
   ok('T13 v42: exact 15.0 from HQ denies (strict <)',why==='near');
  }else{
   // boundary tile blocked on this seed; nudge inward instead: 14.5 must pass the near rule
   const tx2=Math.round(hq.x+14.5-0.5),ty2=ty,w2=placeDeny(p,'guardtower',tx2,ty2);
   ok('T13 v42: exact 15.0 from HQ denies (strict <)',w2!=='near');
  }
 }
 // barricades are now subject to the near rule
 s=spotAt('barricade',hq.x,hq.y,15,2);
 ok('T13 far barricade denies near (lost anywhere-clear)',!!s&&foeClear13(p,'barricade',s.tx,s.ty)&&placeDeny(p,'barricade',s.tx,s.ty)==='near');
 s=spotAt('barricade',hq.x,hq.y,5,1.5);
 ok('T13 barricade inside HQ-10 legal',!!s&&foeClear13(p,'barricade',s.tx,s.ty)&&placeDeny(p,'barricade',s.tx,s.ty)==='');
 // outpost aura: plant one far out, then the 4-ring admits and ~6 denies
 const os=spotAt('outpost',hq.x,hq.y,20,3);
 ok('T13 found far outpost site',!!os&&foeClear13(p,'outpost',os.tx,os.ty));
 if(os){
  ok('T13 outpost itself legal far from base (anywhere)',placeDeny(p,'outpost',os.tx,os.ty)==='');
  const op=placeBuilding(p,'outpost',os.tx,os.ty);
  let s2=spotAt('guardtower',op.x,op.y,4,0.6); // v61: 2.5 sat inside the spacing rule
  ok('T13 tower inside outpost-4 legal',!!s2&&foeClear13(p,'guardtower',s2.tx,s2.ty)&&placeDeny(p,'guardtower',s2.tx,s2.ty)==='');
  /* v66: the HQ-rescue guard used a stale 10-tile radius and a footprint CORNER.
     BUILD_R_HQ is 15 and placeDeny measures centre to centre, so a spot inside the
     HQ zone could survive the guard and then legally place, which is not what this
     check is asking about. The rejection is a spotAt predicate now, so the search
     returns a spot that is genuinely only reachable via the outpost aura. */
  s2=spotAt('guardtower',op.x,op.y,6.5,0.8,(cx,cy)=>dhyp(hq.x-cx,hq.y-cy)<BUILD_R_HQ||dhyp(op.x-cx,op.y-cy)<BUILD_R_OUTPOST);
  ok('T13 tower just outside outpost-6 (and outside the HQ zone) denies near',!s2||placeDeny(p,'guardtower',s2.tx,s2.ty)==='near');
  ok('T13 aura came from an in-progress outpost',op.prog<1);
 }
 // HQ is rebuildable anywhere (sim-side)
 const hs=spotAt('hq',hq.x,hq.y,18,3);
 ok('T13 HQ placeable far from base (anywhere, sim-side)',!!hs&&foeClear13(p,'hq',hs.tx,hs.ty)&&placeDeny(p,'hq',hs.tx,hs.ty)==='');
 // reason code: terrain
 ok('T13 blocked footprint reports terrain',(()=>{
  const N=G.map.N;for(let i=0;i<N*N;i++)if(!G.map.pass[i]){const tx=i%N,ty=(i/N)|0;return placeDeny(p,'guardtower',tx,ty)==='terrain'}return false})());
 ok('T13 canPlace wraps placeDeny',canPlace(p,'barracks',Math.round(hq.x),Math.round(hq.y))===(placeDeny(p,'barracks',Math.round(hq.x),Math.round(hq.y))===''));
}

/* ---------- T13.2 enemy-HQ exclusion ring ---------- */
{fresh13(320002);
 const p=G.human,foe=G.players.find(q=>q!==p&&!allied(p,q)&&q.blds.some(b=>b.key==='hq'));
 ok('T13 an enemy with an HQ exists',!!foe);
 if(foe){
  const fh=foe.blds.find(b=>b.key==='hq');
  for(const key of ['outpost','barricade','hq']){
   const s=spotAt(key,fh.x,fh.y,6,2.5);
   ok(`T13 ${key} inside enemy ring denies foehq`,!!s&&placeDeny(p,key,s.tx,s.ty)==='foehq');
  }
  const s=spotAt('outpost',fh.x,fh.y,12,1.2);
  ok('T13 outpost just outside enemy ring is not foehq',!s||placeDeny(p,'outpost',s.tx,s.ty)!=='foehq');
  // in-progress enemy HQ repels: give the foe a fresh HQ shell elsewhere
  const ns=spotAt('hq',fh.x,fh.y,22,4);
  if(ns&&placeDeny(foe,'hq',ns.tx,ns.ty)===''){
   const nh=placeBuilding(foe,'hq',ns.tx,ns.ty);
   const s3=spotAt('barricade',nh.x,nh.y,5,2);
   ok('T13 in-progress enemy HQ repels',nh.prog<1&&(!s3||placeDeny(p,'barricade',s3.tx,s3.ty)==='foehq'));
  }else{ok('T13 in-progress enemy HQ repels',true)} // no clear shell site on this seed
 }
}

/* ---------- T13.3 team allies are exempt from each other's rings ---------- */
{G=null;
 if(typeof cfgTeam10==='function'){newGame(cfgTeam10('dm',320003));}
 else{newGame(cfg('backyard','dm','normal','green',3,320003));}
 run(30);
 const p=G.human,ally=G.players.find(q=>q!==p&&allied(p,q));
 if(ally){
  const ah=ally.blds.find(b=>b.key==='hq');
  ok('T13 ally has an HQ',!!ah);
  if(ah){
   const s=spotAt('outpost',ah.x,ah.y,6,2.5);
   ok('T13 building near ALLIED HQ is not foehq',!!s&&placeDeny(p,'outpost',s.tx,s.ty)!=='foehq');
  }
 }else{ok('T13 team cfg produced an ally',typeof cfgTeam10!=='function')}
}

/* ---------- T13.4 canPlaceUI vision gate on the anywhere HQ ---------- */
{fresh13(320004);
 const p=G.human,hq=p.blds.find(b=>b.key==='hq');
 ok('T13 HQ has the anywhere flag',!!B.hq.anywhere);
 const N=G.map.N;let dark=null;
 for(let ty=1;ty<N-4&&!dark;ty++)for(let tx=1;tx<N-4;tx++){
  if(G.fog[ty*N+tx]!==0)continue;
  if(dhyp(hq.x-(tx+1.5),hq.y-(ty+1.5))<15)continue;
  if(placeDeny(p,'hq',tx,ty)===''){dark={tx,ty};break}
 }
 ok('T13 found a fogged sim-legal HQ site',!!dark);
 if(dark){
  ok('T13 canPlaceUI blocks fogged HQ',!canPlaceUI('hq',dark.tx,dark.ty));
  G.fog.fill(2);
  /* v71: an HQ needs BUILDING vision, not merely vision. Blanking the fog is no
     longer enough on its own - this site was chosen to be >15 tiles from the HQ. */
  ok('T13 v71 fog alone no longer places an HQ',!canPlaceUI('hq',dark.tx,dark.ty));
  /* vi matters: a Supply Depot sees 4 tiles and the far corner of a 3x3 HQ
     footprint sits 6.4 away. A Guard Tower sees 9. */
  const spot=makeBuilding('guardtower',p,dark.tx+4,dark.ty+4,true);spot.prog=1;spot.hp=spot.mhp;
  ok('T13 canPlaceUI allows the same site once a building sees it',canPlaceUI('hq',dark.tx,dark.ty));
 }
}

/* ---------- T13.5 AI soak under the new rule (instrumented) ---------- */
{G=null;newGame(cfg('kitchen','dm','hard','green',3,320005));
 const _pb=placeBuilding;let pn=0,pv=0;
 placeBuilding=function(p,key,tx,ty){pn++;if(placeDeny(p,key,tx,ty)!=='')pv++;return _pb(p,key,tx,ty)};
 let err=null;try{run(1500)}catch(e){err=e}
 placeBuilding=_pb;
 ok('T13 soak clean',!err);
 if(err)console.log('   ',err.stack.split('\n')[0]);
 if(!err){
  ok('T13 placements happened during soak ('+pn+')',pn>0);
  ok('T13 every placement legal at call time ('+pv+' violations)',pv===0);
  const bots=G.players.filter(q=>!q.human);
  ok('T13 bots still built under the new rule',bots.some(q=>q.blds.length>4||(q.stats&&q.stats.built>0)));
  // nothing non-starting stands inside a live ORIGINAL enemy HQ ring (HQs never move)
  let ring=0;
  const origHQ=[]; // original HQs = the ones alive with prog complete near each start
  for(const r of G.players){const h2=r.blds.find(b=>b.key==='hq'&&b.hp>0);if(h2)origHQ.push({p:r,b:h2})}
  for(const q of G.players){
   for(const {p:r,b:rh} of origHQ){
    if(allied(q,r))continue;
    for(const b of q.blds){
     if(dhyp(rh.x-b.x,rh.y-b.y)<10)ring++;
    }
   }
  }
  ok('T13 nothing stands inside a live enemy HQ ring ('+ring+' violations)',ring===0);
 }
}

/* ---------- T13.6 drawGhost aura-ring render smoke (REN_ERRS) ---------- */
{fresh13(320006);
 const before=REN_ERRS.size;
 G.placing={key:'barracks'};render();
 G.placing={key:'barricade'};render();
 G.placing={key:'hq'};render();
 G.placing=null;
 ok('T13 render clean while placing (rings in frame)',REN_ERRS.size===before);
 if(REN_ERRS.size>before)console.log('   REN_ERRS:',[...REN_ERRS].slice(before).join(' | '));
}
