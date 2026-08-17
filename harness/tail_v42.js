/* tail_v42.js - T22: v42 miscellaneous balance + medic behaviour
   1  KOTH victory requirement doubled (75 -> 150 s)
   2  Paratrooper -25% HP & DPS (pre-rescale 229/17.8 -> 171.75/13.35)
   3  Build zone bigger: friendly HQ 10 -> 15, Outpost 4 -> 5 (enemy ring stays 10)
   4a Medics join the Space "select all army" (dump trucks still stay put)
   4c Medic escort pacing (stateless medicHold: stop-to-fire / no-outrun)
   5  Longer unit-vs-unit fights, Option B: unit HP +10%, unit damage -10% (uniform DPS) */
'use strict';
section('T22 v42: KOTH / paratrooper / build zone / medics / combat pacing');

const R42=300/602; // local mirror of RESCALE for expected-value math

/* ---------- 1: KOTH victory requirement doubled ---------- */
ok('T22.1 KOTH_TARGET doubled to 150', KOTH_TARGET===150);

/* ---------- 2: paratrooper -25% HP & DPS ---------- */
{
 // table holds post-load EFFECTIVE numbers; check they sit 25% below the old 229/17.8
 // baselines under the CURRENT scales, so the cut is verified independent of pacing.
 const expHp=Math.round(229*0.75*HP_SCALE), expDm=+(17.8*0.75*DMG_SCALE).toFixed(2);
 ok('T22.2 paratrooper HP is 25% below the old baseline', Math.abs(U.para.hp-expHp)<=1);
 ok('T22.2 paratrooper damage is 25% below the old baseline', Math.abs(U.para.dm-expDm)<0.02);
 ok('T22.2 paratrooper fire rate unchanged (rt .35)', U.para.rt===0.35);
 // the SMG/AT/HE split still rides the base dm (k multiplies dm), so all three drop 25%
 ok('T22.2 munition k factors intact (SMG/AT/HE)', PARA_MUN.smg.k===1&&PARA_MUN.at.k===2.75&&PARA_MUN.he.k===7.5);
}

/* ---------- 3: bigger build zone (HQ 15, Outpost 5); enemy ring stays 10 ---------- */
{
 const pd=placeDeny.toString();
 ok('T22.3 placeDeny HQ zone is 15', BUILD_R_HQ===15&&pd.includes("b.key==='hq'&&dhyp(b.x-fx,b.y-fy)<BUILD_R_HQ)return ''")); // v43: named constant
 ok('T22.3 placeDeny Outpost zone is 6', BUILD_R_OUTPOST===6&&pd.includes("b.key==='outpost'&&dhyp(b.x-fx,b.y-fy)<BUILD_R_OUTPOST)return ''")); // v43: named constant
 ok('T22.3 enemy-HQ exclusion ring still 10', BUILD_R_FOEHQ===10&&pd.includes("b.key==='hq'&&b.hp>0&&dhyp(b.x-fx,b.y-fy)<BUILD_R_FOEHQ)return 'foehq'")); // v43: named constant
 const dg=drawGhost.toString();
 ok('T22.3 placement overlay draws HQ ring 15 / Outpost ring 5',
    dg.includes("b.key==='hq')ring(b.x,b.y,BUILD_R_HQ,")&&dg.includes("b.key==='outpost')ring(b.x,b.y,BUILD_R_OUTPOST,")); // v43: named constants

 // functional: on an open board, prove a barracks is now legal in the 10..15 band around
 // an HQ (illegal under the old <10 rule) and still illegal beyond 15.
 G=null;newGame(cfg('backyard','dm','normal','green',1,420042));run(2);
 const hq=G.human.blds.find(b=>b.key==='hq');
 const foes=[]; for(const q of G.players){if(allied(q,G.human))continue;for(const b of q.blds)if(b.key==='hq')foes.push(b);}
 const outs=G.human.blds.filter(b=>b.key==='outpost');
 const dTo=(bx,by,fx,fy)=>dhyp(bx-fx,by-fy);
 const N=G.map.N; let extended=false, cutoff=false;
 for(let ty=1;ty<N-2&&!(extended&&cutoff);ty++)for(let tx=1;tx<N-2;tx++){
  const fx=tx+1, fy=ty+1; // barracks sz 2 -> footprint centre
  const dHQ=dTo(hq.x,hq.y,fx,fy);
  if(foes.some(f=>dTo(f.x,f.y,fx,fy)<10)||outs.some(o=>dTo(o.x,o.y,fx,fy)<5))continue;
  const legal=canPlace(G.human,'barracks',tx,ty); // deterministic: no fog dependence
  if(!extended&&dHQ>=10.6&&dHQ<14.4&&legal)extended=true;
  if(!cutoff&&dHQ>15.6&&dHQ<19&&!legal&&placeDeny(G.human,'barracks',tx,ty)==='near')cutoff=true;
 }
 ok('T22.3 a barracks is legal in the new 10..15 HQ band', extended);
 ok('T22.3 building is still cut off past 15 tiles (reason "near")', cutoff);
}

/* ---------- 4a: medics join the Space "select all army" ---------- */
{
 G=null;newGame(cfg('backyard','dm','normal','green',1,4242042));
 const gr=makeUnit('grunt',G.human,28,28);
 const md=makeUnit('medic',G.human,29,29);
 const tk=makeUnit('truck',G.human,30,30);
 // exact predicate used by the Space handler (a!=='truck' OR heal)
 const army=G.human.units.filter(u=>!u.garrisoned&&(u.t.a!=='truck'||u.t.heal));
 ok('T22.4a army-select includes the medic', army.includes(md));
 ok('T22.4a army-select includes the grunt', army.includes(gr));
 ok('T22.4a army-select still excludes the dump truck', !army.includes(tk));
 // medic is a truck by class but carries the heal flag that lets it through the filter
 ok('T22.4a medic is class truck yet heal-flagged', md.t.a==='truck'&&!!md.t.heal);
}

/* ---------- 4c: medic escort-pacing (medicHold) ---------- */
{
 G=null;newGame(cfg('backyard','dm','normal','green',1,9042042));
 const med=makeUnit('medic',G.human,30,30); med.dest={x:40,y:30}; // heading +x
 const esc=makeUnit('grunt',G.human,26,30);
 const save=G.units;

 // purity: medicHold reads only hashed state, never mutates G
 const h0=hashState(); medicHold(med); ok('T22.4c medicHold does not mutate sim state', hashState()===h0);

 G.units=[med,esc]; // isolate the two units under test

 // (a) escort stopped to FIRE within leash -> hold, whatever its position
 esc.state='attack'; esc.target={hp:100,kind:'unit'};
 ok('T22.4c holds when a nearby escort is firing', medicHold(med)===true);
 esc.state='idle'; esc.target=null;

 // (b) medic AHEAD of the pack with a >3.5 tile gap -> hold (do not outrun)
 esc.x=26; esc.y=30;
 ok('T22.4c holds when ahead of the pack with a gap', medicHold(med)===true);

 // (c) lumped (nearest escort within 3.5) and not firing -> move
 esc.x=32; esc.y=30;
 ok('T22.4c moves when lumped with the escort', medicHold(med)===false);

 // (d) medic BEHIND the escort (escort closer to dest) -> move to catch up
 esc.x=44; esc.y=30;
 ok('T22.4c moves to catch up when behind the pack', medicHold(med)===false);

 // (e) no combat escort within leash -> move (solo order works)
 G.units=[med];
 ok('T22.4c moves normally with no escort nearby (solo)', medicHold(med)===false);

 G.units=save;

 // integration through updateUnit's move state: with a firing escort beside it the medic
 // must not advance; the same medic with no escort advances. Probe a clear straight lane
 // so the outcome does not hinge on map terrain, then run past path warmup.
 const findLane=(r)=>{ // first passable tile with a clear 7-tile straight lane
  const N=G.map.N;
  for(let ty=4;ty<N-8;ty++)for(let tx=4;tx<N-8;tx++){
   const x=tx+0.5,y=ty+0.5; if(!passableR(x,y,r))continue;
   for(const [ax,ay] of [[1,0],[0,1],[-1,0],[0,-1]]){
    let clear=true; for(let s2=1;s2<=7;s2++){if(!passableR(x+ax*s2,y+ay*s2,r)){clear=false;break;}}
    if(clear)return {x,y,dx:ax,dy:ay};
   }
  }
  return null;
 };
 const runMove=(withEscort)=>{
  G=null;newGame(cfg('backyard','dm','normal','green',1,7042042));
  const probe=makeUnit('medic',G.human,8,8); const r=unitRad(probe);
  const lane=findLane(r); if(!lane)return null; // should not happen on backyard
  const m=makeUnit('medic',G.human,lane.x,lane.y);
  const dest={x:lane.x+lane.dx*7,y:lane.y+lane.dy*7};
  m.path=[{x:dest.x,y:dest.y}]; m.wp=0; m.dest=dest; m.state='move';
  const sx=m.x, sy=m.y; let units=[m];
  if(withEscort){const e=makeUnit('grunt',G.human,m.x-lane.dx,m.y-lane.dy);e.state='attack';e.target={hp:100,kind:'unit'};units=[m,e];}
  G.units=units;
  for(let i=0;i<15;i++)updateUnit(m,1/30);
  return dhyp(m.x-sx,m.y-sy);
 };
 const dHeld=runMove(true), dFree=runMove(false);
 ok('T22.4c move-state: medic holds beside a firing escort', dHeld!==null&&dHeld<0.05);
 ok('T22.4c move-state: same medic advances with no escort', dFree!==null&&dFree>0.1);

 // determinism with a paced medic group move in flight
 const trail=(seed)=>{
  G=null;newGame(cfg('backyard','dm','normal','green',1,seed));
  const grp=[makeUnit('medic',G.human,24,24),makeUnit('grunt',G.human,25,24),makeUnit('grunt',G.human,24,25)];
  for(const u of grp)orderMove(u,40,40,false);
  const t=[];for(let i=1;i<=240;i++){update(1/30);if(i%30===0)t.push(hashState())}return t;
 };
 const a=trail(5551),b=trail(5551);
 ok('T22.4c paced medic group move is deterministic (dual run)', a.length===8&&a.every((h,i)=>h===b[i]));

 // save/load bit-identical resume mid-move (no new serialized field)
 G=null;newGame(cfg('backyard','dm','normal','green',1,5551));
 const grp=[makeUnit('medic',G.human,24,24),makeUnit('grunt',G.human,25,24),makeUnit('grunt',G.human,24,25)];
 for(const u of grp)orderMove(u,40,40,false);
 for(let i=0;i<120;i++)update(1/30);
 const hSnap=hashState(), json=saveState();
 const cont=[];for(let i=1;i<=120;i++){update(1/30);if(i%30===0)cont.push(hashState())}
 loadState(json);
 ok('T22.4c save/load restores the same hash', hashState()===hSnap);
 const cont2=[];for(let i=1;i<=120;i++){update(1/30);if(i%30===0)cont2.push(hashState())}
 ok('T22.4c save/load resumes on the identical trail', cont.every((h,i)=>h===cont2[i]));
 ok('T22.4c snapshot carries no escort/pacing field on units',
    !JSON.parse(json).units.some(u=>u&&('escort' in u||'medicWait' in u)));
}

/* ---------- 5: longer unit-vs-unit fights, Option B ---------- */
{
 ok('T22.5 HP_SCALE is +10% over the 1.4 pacing', Math.abs(HP_SCALE/(1.4*R42)-1.1)<1e-9);
 ok('T22.5 DMG_SCALE is -10% under the 0.9 pacing', Math.abs(DMG_SCALE/(0.9*R42)-0.9)<1e-9);

 // unit-vs-unit TTK (HP_SCALE / DMG_SCALE) grows ~+22% vs v41
 const uvuV41=(1.4*R42)/(0.9*R42), uvuV42=HP_SCALE/DMG_SCALE;
 ok('T22.5 unit-vs-unit TTK is +22% vs v41', Math.abs(uvuV42/uvuV41-1.2222222)<1e-6);

 // building HP is untouched (RESCALE only, NOT HP_SCALE): structure TTK only shifts by
 // the damage change (+11%), never by the HP bump
 ok('T22.5 building HP unchanged (RESCALE only): HQ', B.hq.hp===Math.round(1500*R42));
 ok('T22.5 building HP unchanged (RESCALE only): Garage', B.garage.hp===Math.round(720*R42));

 // Bull card now reads ~330 (was exactly 300 under v41's rescale)
 ok('T22.5 Bull heavy tank reads ~330 HP', Math.abs(U.bulltank.hp-330)<=1);

 // guard-tower damage rides DMG_SCALE, so it inherits the -10% (weaker vs units)
 ok('T22.5 guard-tower damage carries the -10% via DMG_SCALE',
    B.guardtower.dm===+(15*DMG_SCALE).toFixed(2));

 // HP-linked ripples stay proportional to unit HP -> their TTK vs units is unchanged:
 // mine still one-shots a tank, heal keeps pace
 ok('T22.5 mine damage still one-shots a tank (rides HP_SCALE)', MINE_DMG>=U.tank.hp);
 // v85: !t.noPace mirrors the derivation, which gained the same clause for the
 // Signal Runner. See T32.A, where the exemption is proved load-bearing.
 let lo=Infinity;for(const k in U){const t=U[k];if(t.dm>0&&t.rt>0&&!t.heal&&!t.noPace)lo=Math.min(lo,t.dm/t.rt);}
 ok('T22.5 medic heal rides HP_SCALE (proportional to bigger pools)',
    Math.abs(MEDIC_HEAL_RATE-lo*0.9*HP_SCALE)<1e-9);
}
